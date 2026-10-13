export type SessionStatus = 'pending' | 'active' | 'ended' | 'expired';

export interface ServiceSession {
  id: string;
  guildId: string;
  discordId: string;
  robloxUserId: number;
  robloxUsername: string;
  status: SessionStatus;
  requestedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  lastSeenAt: Date | null;
  durationSeconds: number | null;
  endReason: string | null;
  jobId: string | null;
}

export interface NewSession {
  guildId: string;
  discordId: string;
  robloxUserId: number;
  robloxUsername: string;
  status: 'pending' | 'active';
  requestedAt: Date;
  startedAt: Date | null;
  lastSeenAt: Date | null;
  jobId: string | null;
}

export interface SessionPatch {
  status?: SessionStatus;
  startedAt?: Date | null;
  endedAt?: Date | null;
  lastSeenAt?: Date | null;
  durationSeconds?: number | null;
  endReason?: string | null;
  jobId?: string | null;
  robloxUsername?: string;
}

export interface RobloxLink {
  discordId: string;
  robloxUserId: number;
  robloxUsername: string;
  linkedAt: Date;
}

export interface LinkCode {
  codeHash: string;
  discordId: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface Presence {
  robloxUserId: number;
  robloxUsername: string;
  jobId: string;
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface GuildConfig {
  guildId: string;
  staffRoleId: string;
  panelChannelId: string | null;
  panelMessageId: string | null;
}

export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export type ApiRequestBegin =
  | { state: 'new' }
  | { state: 'done'; response: StoredResponse }
  | { state: 'in_progress' }
  | { state: 'conflict' };

export class UniqueViolationError extends Error {
  constructor(public readonly constraint?: string) {
    super(`unique_violation${constraint ? `:${constraint}` : ''}`);
    this.name = 'UniqueViolationError';
  }
}

export interface Tx {
  getOpenSessionByDiscordForUpdate(discordId: string): Promise<ServiceSession | null>;
  getOpenSessionByRobloxForUpdate(robloxUserId: number): Promise<ServiceSession | null>;
  insertSession(s: NewSession): Promise<ServiceSession>;
  updateSession(id: string, patch: SessionPatch): Promise<ServiceSession>;
  getPresence(robloxUserId: number): Promise<Presence | null>;
  upsertPresence(p: Presence): Promise<void>;
  deletePresenceIfJob(robloxUserId: number, jobId: string): Promise<boolean>;
  deleteStalePresence(cutoff: Date): Promise<number>;
  lockStaleActiveSessions(cutoff: Date, limit: number): Promise<ServiceSession[]>;
  lockExpiredPendingSessions(cutoff: Date, limit: number): Promise<ServiceSession[]>;
  getLinkCodeForUpdate(codeHash: string): Promise<LinkCode | null>;
  insertLinkCode(c: { codeHash: string; discordId: string; createdAt: Date; expiresAt: Date }): Promise<void>;
  deleteUnusedLinkCodes(discordId: string): Promise<void>;
  markLinkCodeUsed(codeHash: string, robloxUserId: number, usedAt: Date): Promise<void>;
  getLinkByRoblox(robloxUserId: number): Promise<RobloxLink | null>;
  upsertLink(link: RobloxLink): Promise<void>;
  deleteLink(discordId: string): Promise<boolean>;
}

export interface Repository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  getLinkByDiscord(discordId: string): Promise<RobloxLink | null>;
  getLinkByRoblox(robloxUserId: number): Promise<RobloxLink | null>;
  upsertLink(link: RobloxLink): Promise<void>;
  getOpenSessionByDiscord(discordId: string): Promise<ServiceSession | null>;
  getRecentSessions(discordId: string, limit: number): Promise<ServiceSession[]>;
  getTotalSeconds(discordId: string, since: Date): Promise<number>;
  getGuildConfig(guildId: string): Promise<GuildConfig | null>;
  upsertGuildConfig(cfg: { guildId: string; staffRoleId: string; updatedBy: string }): Promise<void>;
  setPanelMessage(guildId: string, channelId: string, messageId: string): Promise<void>;
  beginApiRequest(requestId: string, endpoint: string, now: Date): Promise<ApiRequestBegin>;
  completeApiRequest(requestId: string, response: StoredResponse): Promise<void>;
  abortApiRequest(requestId: string): Promise<void>;
  pruneApiRequests(before: Date): Promise<number>;
  deleteExpiredLinkCodes(before: Date): Promise<number>;
}
