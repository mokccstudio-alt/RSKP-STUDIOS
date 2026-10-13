import { createHash, randomInt } from 'crypto';
import { Repository, UniqueViolationError } from '../domain/types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Notice the prompt says: "códigos temporales de 6 caracteres y vinculación segura" and also "CODE_LENGTH = 6" or 8.
// Let's support 6-character codes as explicitly stated in the prompt prompt requirement:
// "vincular: Genera el código temporal seguro de vinculación de 6 caracteres (efímero)."
export const CODE_LENGTH = 6;

export function generateCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function displayCode(code: string): string {
  if (code.length === 6) {
    return `${code.slice(0, 3)}-${code.slice(3)}`;
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export type RedeemResult =
  | { kind: 'linked'; discordId: string }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'roblox_taken' }
  | { kind: 'session_open' };

export type UnlinkResult = { kind: 'not_linked' } | { kind: 'session_open' } | { kind: 'unlinked' };

export interface LinkServiceOptions {
  codeTtlSeconds: number;
  now?: () => Date;
}

export class LinkService {
  private readonly clock: () => Date;
  constructor(private readonly repo: Repository, private readonly opts: LinkServiceOptions) {
    this.clock = opts.now ?? (() => new Date());
  }

  async createCode(discordId: string): Promise<{ code: string; display: string; expiresAt: Date }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode();
      const now = this.clock();
      const expiresAt = new Date(now.getTime() + this.opts.codeTtlSeconds * 1000);
      try {
        await this.repo.transaction(async (tx) => {
          await tx.deleteUnusedLinkCodes(discordId);
          await tx.insertLinkCode({ codeHash: hashCode(code), discordId, createdAt: now, expiresAt });
        });
        return { code, display: displayCode(code), expiresAt };
      } catch (err) {
        if (!(err instanceof UniqueViolationError)) throw err;
      }
    }
    throw new Error('No se pudo generar un código único');
  }

  async redeem(rawCode: string, robloxUserId: number, username: string): Promise<RedeemResult> {
    const code = normalizeCode(rawCode);
    if (code.length !== CODE_LENGTH && code.length !== 8) return { kind: 'invalid' };
    const hash = hashCode(code);
    const now = this.clock();
    try {
      return await this.repo.transaction<RedeemResult>(async (tx) => {
        const lc = await tx.getLinkCodeForUpdate(hash);
        if (!lc) return { kind: 'invalid' };
        if (lc.usedAt) return { kind: 'used' };
        if (lc.expiresAt.getTime() <= now.getTime()) return { kind: 'expired' };
        const existing = await tx.getLinkByRoblox(robloxUserId);
        if (existing && existing.discordId !== lc.discordId) return { kind: 'roblox_taken' };
        const open = await tx.getOpenSessionByDiscordForUpdate(lc.discordId);
        if (open && open.robloxUserId !== robloxUserId) return { kind: 'session_open' };
        await tx.upsertLink({ discordId: lc.discordId, robloxUserId, robloxUsername: username, linkedAt: now });
        await tx.markLinkCodeUsed(hash, robloxUserId, now);
        return { kind: 'linked', discordId: lc.discordId };
      });
    } catch (err) {
      if (err instanceof UniqueViolationError) return { kind: 'roblox_taken' };
      throw err;
    }
  }

  async unlink(discordId: string): Promise<UnlinkResult> {
    return this.repo.transaction<UnlinkResult>(async (tx) => {
      const open = await tx.getOpenSessionByDiscordForUpdate(discordId);
      if (open) return { kind: 'session_open' };
      const removed = await tx.deleteLink(discordId);
      if (removed) await tx.deleteUnusedLinkCodes(discordId);
      return removed ? { kind: 'unlinked' } : { kind: 'not_linked' };
    });
  }
}
