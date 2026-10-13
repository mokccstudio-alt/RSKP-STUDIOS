import { Repository, ServiceSession, Tx, UniqueViolationError } from '../domain/types';

export interface SessionServiceOptions {
  graceSeconds: number;
  pendingTtlSeconds: number;
  now?: () => Date;
}

export type StartResult =
  | { kind: 'not_linked' }
  | { kind: 'already_open'; session: ServiceSession }
  | { kind: 'roblox_busy' }
  | { kind: 'started'; session: ServiceSession }
  | { kind: 'pending'; session: ServiceSession };

export type StopResult =
  | { kind: 'none' }
  | { kind: 'cancelled'; session: ServiceSession }
  | { kind: 'ended'; session: ServiceSession };

export interface PresencePlayer {
  robloxUserId: number;
  username: string;
}

export interface PresenceResult {
  activated: ServiceSession[];
  ended: ServiceSession[];
  expired: ServiceSession[];
  activeUserIds: number[];
}

export interface ReconcileResult {
  timedOut: ServiceSession[];
  expired: ServiceSession[];
  prunedPresence: number;
}

export function secondsBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 1000));
}

function maxDate(a: Date | null, b: Date): Date {
  return a && a.getTime() > b.getTime() ? a : b;
}

const emptyResult = (): PresenceResult => ({ activated: [], ended: [], expired: [], activeUserIds: [] });

export class SessionService {
  private readonly clock: () => Date;
  constructor(private readonly repo: Repository, private readonly opts: SessionServiceOptions) {
    this.clock = opts.now ?? (() => new Date());
  }

  get pendingTtlSeconds(): number {
    return this.opts.pendingTtlSeconds;
  }

  private isStale(lastSeen: Date | null, now: Date): boolean {
    return !lastSeen || now.getTime() - lastSeen.getTime() > this.opts.graceSeconds * 1000;
  }

  private pendingExpired(s: ServiceSession, now: Date): boolean {
    return now.getTime() - s.requestedAt.getTime() > this.opts.pendingTtlSeconds * 1000;
  }

  private endActive(tx: Tx, s: ServiceSession, endedAt: Date, reason: string): Promise<ServiceSession> {
    const start = s.startedAt ?? s.requestedAt;
    const end = endedAt.getTime() < start.getTime() ? start : endedAt;
    return tx.updateSession(s.id, {
      status: 'ended',
      endedAt: end,
      durationSeconds: secondsBetween(start, end),
      endReason: reason,
    });
  }

  async start(guildId: string, discordId: string): Promise<StartResult> {
    const link = await this.repo.getLinkByDiscord(discordId);
    if (!link) return { kind: 'not_linked' };
    const now = this.clock();
    try {
      return await this.repo.transaction<StartResult>(async (tx) => {
        const open = await tx.getOpenSessionByDiscordForUpdate(discordId);
        if (open) return { kind: 'already_open', session: open };
        const busy = await tx.getOpenSessionByRobloxForUpdate(link.robloxUserId);
        if (busy) return { kind: 'roblox_busy' };
        const presence = await tx.getPresence(link.robloxUserId);
        const inGame = presence !== null && !this.isStale(presence.lastSeenAt, now);
        const session = await tx.insertSession({
          guildId,
          discordId,
          robloxUserId: link.robloxUserId,
          robloxUsername: presence?.robloxUsername ?? link.robloxUsername,
          status: inGame ? 'active' : 'pending',
          requestedAt: now,
          startedAt: inGame ? now : null,
          lastSeenAt: inGame ? now : null,
          jobId: inGame && presence ? presence.jobId : null,
        });
        return inGame ? { kind: 'started', session } : { kind: 'pending', session };
      });
    } catch (err) {
      if (err instanceof UniqueViolationError) {
        const open = await this.repo.getOpenSessionByDiscord(discordId);
        return open ? { kind: 'already_open', session: open } : { kind: 'roblox_busy' };
      }
      throw err;
    }
  }

  async stop(discordId: string, reason = 'manual'): Promise<StopResult> {
    const now = this.clock();
    return this.repo.transaction<StopResult>(async (tx) => {
      const open = await tx.getOpenSessionByDiscordForUpdate(discordId);
      if (!open) return { kind: 'none' };
      if (open.status === 'pending') {
        const session = await tx.updateSession(open.id, { status: 'expired', endedAt: now, endReason: 'cancelled' });
        return { kind: 'cancelled', session };
      }
      return { kind: 'ended', session: await this.endActive(tx, open, now, reason) };
    });
  }

  private async seen(
    tx: Tx,
    robloxUserId: number,
    username: string,
    jobId: string,
    now: Date,
    result: PresenceResult,
  ): Promise<void> {
    const open = await tx.getOpenSessionByRobloxForUpdate(robloxUserId);
    if (!open) return;
    if (open.status === 'pending') {
      if (this.pendingExpired(open, now)) {
        result.expired.push(await tx.updateSession(open.id, { status: 'expired', endedAt: now, endReason: 'pending_timeout' }));
        return;
      }
      result.activated.push(
        await tx.updateSession(open.id, { status: 'active', startedAt: now, lastSeenAt: now, jobId, robloxUsername: username }),
      );
      result.activeUserIds.push(robloxUserId);
      return;
    }
    if (this.isStale(open.lastSeenAt, now)) {
      result.ended.push(await this.endActive(tx, open, open.lastSeenAt ?? now, 'timeout'));
      return;
    }
    await tx.updateSession(open.id, { lastSeenAt: maxDate(open.lastSeenAt, now), jobId, robloxUsername: username });
    result.activeUserIds.push(robloxUserId);
  }

  async join(robloxUserId: number, username: string, jobId: string): Promise<PresenceResult> {
    const now = this.clock();
    const result = emptyResult();
    await this.repo.transaction(async (tx) => {
      await tx.upsertPresence({ robloxUserId, robloxUsername: username, jobId, joinedAt: now, lastSeenAt: now });
      await this.seen(tx, robloxUserId, username, jobId, now, result);
    });
    return result;
  }

  async heartbeat(jobId: string, players: PresencePlayer[]): Promise<PresenceResult> {
    const now = this.clock();
    const result = emptyResult();
    const unique = new Map<number, string>();
    for (const p of players) unique.set(p.robloxUserId, p.username);
    const ordered = [...unique.entries()].sort((a, b) => a[0] - b[0]);
    await this.repo.transaction(async (tx) => {
      for (const [robloxUserId, username] of ordered) {
        await tx.upsertPresence({ robloxUserId, robloxUsername: username, jobId, joinedAt: now, lastSeenAt: now });
        await this.seen(tx, robloxUserId, username, jobId, now, result);
      }
    });
    return result;
  }

  async leave(robloxUserId: number, jobId: string): Promise<PresenceResult & { ignored: boolean }> {
    const now = this.clock();
    const result = emptyResult();
    const ignored = await this.repo.transaction<boolean>(async (tx) => {
      const removed = await tx.deletePresenceIfJob(robloxUserId, jobId);
      if (!removed) return true;
      const open = await tx.getOpenSessionByRobloxForUpdate(robloxUserId);
      if (open && open.status === 'active' && open.jobId === jobId) {
        if (this.isStale(open.lastSeenAt, now)) {
          result.ended.push(await this.endActive(tx, open, open.lastSeenAt ?? now, 'timeout'));
        } else {
          await tx.updateSession(open.id, { lastSeenAt: maxDate(open.lastSeenAt, now) });
        }
      }
      return false;
    });
    return { ...result, ignored };
  }

  async reconcile(): Promise<ReconcileResult> {
    const now = this.clock();
    const graceCutoff = new Date(now.getTime() - this.opts.graceSeconds * 1000);
    const pendingCutoff = new Date(now.getTime() - this.opts.pendingTtlSeconds * 1000);
    return this.repo.transaction<ReconcileResult>(async (tx) => {
      const timedOut: ServiceSession[] = [];
      const expired: ServiceSession[] = [];
      for (const s of await tx.lockStaleActiveSessions(graceCutoff, 200)) {
        timedOut.push(await this.endActive(tx, s, s.lastSeenAt ?? now, 'timeout'));
      }
      for (const s of await tx.lockExpiredPendingSessions(pendingCutoff, 200)) {
        expired.push(await tx.updateSession(s.id, { status: 'expired', endedAt: now, endReason: 'pending_timeout' }));
      }
      const prunedPresence = await tx.deleteStalePresence(graceCutoff);
      return { timedOut, expired, prunedPresence };
    });
  }
}
