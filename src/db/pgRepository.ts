import { Pool, PoolClient } from 'pg';
import {
  ApiRequestBegin,
  GuildConfig,
  LinkCode,
  NewSession,
  Presence,
  Repository,
  RobloxLink,
  ServiceSession,
  SessionPatch,
  StoredResponse,
  Tx,
  UniqueViolationError,
} from '../domain/types';

interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

async function run(db: Queryable, text: string, params: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
  try {
    const res = await db.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount ?? 0 };
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === '23505') throw new UniqueViolationError(e.constraint);
    throw err;
  }
}

function mapSession(r: any): ServiceSession {
  return {
    id: String(r.id),
    guildId: r.guild_id,
    discordId: r.discord_id,
    robloxUserId: Number(r.roblox_user_id),
    robloxUsername: r.roblox_username,
    status: r.status,
    requestedAt: r.requested_at,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    lastSeenAt: r.last_seen_at,
    durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
    endReason: r.end_reason,
    jobId: r.job_id,
  };
}

function mapLink(r: any): RobloxLink {
  return {
    discordId: r.discord_id,
    robloxUserId: Number(r.roblox_user_id),
    robloxUsername: r.roblox_username,
    linkedAt: r.linked_at,
  };
}

function mapPresence(r: any): Presence {
  return {
    robloxUserId: Number(r.roblox_user_id),
    robloxUsername: r.roblox_username,
    jobId: r.job_id,
    joinedAt: r.joined_at,
    lastSeenAt: r.last_seen_at,
  };
}

const PATCH_COLUMNS: Record<keyof SessionPatch, string> = {
  status: 'status',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  lastSeenAt: 'last_seen_at',
  durationSeconds: 'duration_seconds',
  endReason: 'end_reason',
  jobId: 'job_id',
  robloxUsername: 'roblox_username',
};

class PgTx implements Tx {
  constructor(private readonly db: Queryable) {}

  async getOpenSessionByDiscordForUpdate(discordId: string): Promise<ServiceSession | null> {
    const { rows } = await run(
      this.db,
      "SELECT * FROM service_sessions WHERE discord_id = $1 AND status IN ('pending','active') FOR UPDATE",
      [discordId],
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async getOpenSessionByRobloxForUpdate(robloxUserId: number): Promise<ServiceSession | null> {
    const { rows } = await run(
      this.db,
      "SELECT * FROM service_sessions WHERE roblox_user_id = $1 AND status IN ('pending','active') FOR UPDATE",
      [robloxUserId],
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async insertSession(s: NewSession): Promise<ServiceSession> {
    const { rows } = await run(
      this.db,
      `INSERT INTO service_sessions (guild_id, discord_id, roblox_user_id, roblox_username, status, requested_at, started_at, last_seen_at, job_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [s.guildId, s.discordId, s.robloxUserId, s.robloxUsername, s.status, s.requestedAt, s.startedAt, s.lastSeenAt, s.jobId],
    );
    return mapSession(rows[0]);
  }

  async updateSession(id: string, patch: SessionPatch): Promise<ServiceSession> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const col = PATCH_COLUMNS[key as keyof SessionPatch];
      if (!col) continue;
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    }
    params.push(id);
    const sql = sets.length
      ? `UPDATE service_sessions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
      : `SELECT * FROM service_sessions WHERE id = $${params.length}`;
    const { rows } = await run(this.db, sql, params);
    if (!rows[0]) throw new Error(`Sesión ${id} no encontrada`);
    return mapSession(rows[0]);
  }

  async getPresence(robloxUserId: number): Promise<Presence | null> {
    const { rows } = await run(this.db, 'SELECT * FROM game_presence WHERE roblox_user_id = $1', [robloxUserId]);
    return rows[0] ? mapPresence(rows[0]) : null;
  }

  async upsertPresence(p: Presence): Promise<void> {
    await run(
      this.db,
      `INSERT INTO game_presence (roblox_user_id, roblox_username, job_id, joined_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (roblox_user_id) DO UPDATE SET
         roblox_username = EXCLUDED.roblox_username,
         joined_at = CASE WHEN game_presence.job_id = EXCLUDED.job_id THEN game_presence.joined_at ELSE EXCLUDED.joined_at END,
         job_id = EXCLUDED.job_id,
         last_seen_at = GREATEST(game_presence.last_seen_at, EXCLUDED.last_seen_at)`,
      [p.robloxUserId, p.robloxUsername, p.jobId, p.joinedAt, p.lastSeenAt],
    );
  }

  async deletePresenceIfJob(robloxUserId: number, jobId: string): Promise<boolean> {
    const { rowCount } = await run(this.db, 'DELETE FROM game_presence WHERE roblox_user_id = $1 AND job_id = $2', [
      robloxUserId,
      jobId,
    ]);
    return rowCount > 0;
  }

  async deleteStalePresence(cutoff: Date): Promise<number> {
    const { rowCount } = await run(this.db, 'DELETE FROM game_presence WHERE last_seen_at < $1', [cutoff]);
    return rowCount;
  }

  async lockStaleActiveSessions(cutoff: Date, limit: number): Promise<ServiceSession[]> {
    const { rows } = await run(
      this.db,
      "SELECT * FROM service_sessions WHERE status = 'active' AND last_seen_at < $1 ORDER BY last_seen_at LIMIT $2 FOR UPDATE SKIP LOCKED",
      [cutoff, limit],
    );
    return rows.map(mapSession);
  }

  async lockExpiredPendingSessions(cutoff: Date, limit: number): Promise<ServiceSession[]> {
    const { rows } = await run(
      this.db,
      "SELECT * FROM service_sessions WHERE status = 'pending' AND requested_at < $1 ORDER BY requested_at LIMIT $2 FOR UPDATE SKIP LOCKED",
      [cutoff, limit],
    );
    return rows.map(mapSession);
  }

  async getLinkCodeForUpdate(codeHash: string): Promise<LinkCode | null> {
    const { rows } = await run(this.db, 'SELECT * FROM link_codes WHERE code_hash = $1 FOR UPDATE', [codeHash]);
    const r = rows[0];
    if (!r) return null;
    return { codeHash: r.code_hash, discordId: r.discord_id, createdAt: r.created_at, expiresAt: r.expires_at, usedAt: r.used_at };
  }

  async insertLinkCode(c: { codeHash: string; discordId: string; createdAt: Date; expiresAt: Date }): Promise<void> {
    await run(this.db, 'INSERT INTO link_codes (code_hash, discord_id, created_at, expires_at) VALUES ($1,$2,$3,$4)', [
      c.codeHash,
      c.discordId,
      c.createdAt,
      c.expiresAt,
    ]);
  }

  async deleteUnusedLinkCodes(discordId: string): Promise<void> {
    await run(this.db, 'DELETE FROM link_codes WHERE discord_id = $1 AND used_at IS NULL', [discordId]);
  }

  async markLinkCodeUsed(codeHash: string, robloxUserId: number, usedAt: Date): Promise<void> {
    await run(this.db, 'UPDATE link_codes SET used_at = $2, used_by_roblox_id = $3 WHERE code_hash = $1', [
      codeHash,
      usedAt,
      robloxUserId,
    ]);
  }

  async getLinkByRoblox(robloxUserId: number): Promise<RobloxLink | null> {
    const { rows } = await run(this.db, 'SELECT * FROM roblox_links WHERE roblox_user_id = $1', [robloxUserId]);
    return rows[0] ? mapLink(rows[0]) : null;
  }

  async upsertLink(link: RobloxLink): Promise<void> {
    await run(
      this.db,
      `INSERT INTO roblox_links (discord_id, roblox_user_id, roblox_username, linked_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (discord_id) DO UPDATE SET roblox_user_id = EXCLUDED.roblox_user_id,
         roblox_username = EXCLUDED.roblox_username, linked_at = EXCLUDED.linked_at`,
      [link.discordId, link.robloxUserId, link.robloxUsername, link.linkedAt],
    );
  }

  async deleteLink(discordId: string): Promise<boolean> {
    const { rowCount } = await run(this.db, 'DELETE FROM roblox_links WHERE discord_id = $1', [discordId]);
    return rowCount > 0;
  }
}

export class PgRepository implements Repository {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    let broken = false;
    try {
      await client.query('BEGIN');
      const result = await fn(new PgTx(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {
        broken = true;
      });
      throw err;
    } finally {
      client.release(broken);
    }
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async getLinkByDiscord(discordId: string): Promise<RobloxLink | null> {
    const { rows } = await run(this.pool, 'SELECT * FROM roblox_links WHERE discord_id = $1', [discordId]);
    return rows[0] ? mapLink(rows[0]) : null;
  }

  async getLinkByRoblox(robloxUserId: number): Promise<RobloxLink | null> {
    const { rows } = await run(this.pool, 'SELECT * FROM roblox_links WHERE roblox_user_id = $1', [robloxUserId]);
    return rows[0] ? mapLink(rows[0]) : null;
  }

  async upsertLink(link: RobloxLink): Promise<void> {
    await run(
      this.pool,
      `INSERT INTO roblox_links (discord_id, roblox_user_id, roblox_username, linked_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (discord_id) DO UPDATE SET roblox_user_id = EXCLUDED.roblox_user_id,
         roblox_username = EXCLUDED.roblox_username, linked_at = EXCLUDED.linked_at`,
      [link.discordId, link.robloxUserId, link.robloxUsername, link.linkedAt],
    );
  }

  async getOpenSessionByDiscord(discordId: string): Promise<ServiceSession | null> {
    const { rows } = await run(
      this.pool,
      "SELECT * FROM service_sessions WHERE discord_id = $1 AND status IN ('pending','active')",
      [discordId],
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async getRecentSessions(discordId: string, limit: number): Promise<ServiceSession[]> {
    const { rows } = await run(
      this.pool,
      "SELECT * FROM service_sessions WHERE discord_id = $1 AND status IN ('active','ended') ORDER BY started_at DESC LIMIT $2",
      [discordId, limit],
    );
    return rows.map(mapSession);
  }

  async getTotalSeconds(discordId: string, since: Date): Promise<number> {
    const { rows } = await run(
      this.pool,
      `SELECT COALESCE(SUM(CASE
          WHEN status = 'ended' THEN duration_seconds
          WHEN status = 'active' THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - started_at))))
          ELSE 0 END), 0)::bigint AS total
       FROM service_sessions WHERE discord_id = $1 AND started_at >= $2`,
      [discordId, since],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    const { rows } = await run(this.pool, 'SELECT * FROM guild_config WHERE guild_id = $1', [guildId]);
    const r = rows[0];
    if (!r) return null;
    return { guildId: r.guild_id, staffRoleId: r.staff_role_id, panelChannelId: r.panel_channel_id, panelMessageId: r.panel_message_id };
  }

  async upsertGuildConfig(cfg: { guildId: string; staffRoleId: string; updatedBy: string }): Promise<void> {
    await run(
      this.pool,
      `INSERT INTO guild_config (guild_id, staff_role_id, updated_by) VALUES ($1,$2,$3)
       ON CONFLICT (guild_id) DO UPDATE SET staff_role_id = EXCLUDED.staff_role_id, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [cfg.guildId, cfg.staffRoleId, cfg.updatedBy],
    );
  }

  async setPanelMessage(guildId: string, channelId: string, messageId: string): Promise<void> {
    await run(
      this.pool,
      'UPDATE guild_config SET panel_channel_id = $2, panel_message_id = $3, updated_at = now() WHERE guild_id = $1',
      [guildId, channelId, messageId],
    );
  }

  async beginApiRequest(requestId: string, endpoint: string, now: Date): Promise<ApiRequestBegin> {
    const inserted = await run(
      this.pool,
      `INSERT INTO api_requests (request_id, endpoint, created_at) VALUES ($1,$2,$3)
       ON CONFLICT (request_id) DO UPDATE SET created_at = EXCLUDED.created_at
       WHERE api_requests.response IS NULL AND api_requests.endpoint = EXCLUDED.endpoint
         AND api_requests.created_at < EXCLUDED.created_at - interval '60 seconds'
       RETURNING request_id`,
      [requestId, endpoint, now],
    );
    if (inserted.rowCount > 0) return { state: 'new' };
    const { rows } = await run(this.pool, 'SELECT endpoint, response FROM api_requests WHERE request_id = $1', [requestId]);
    const r = rows[0];
    if (!r) return { state: 'in_progress' };
    if (r.endpoint !== endpoint) return { state: 'conflict' };
    if (r.response === null) return { state: 'in_progress' };
    return { state: 'done', response: r.response as StoredResponse };
  }

  async completeApiRequest(requestId: string, response: StoredResponse): Promise<void> {
    await run(this.pool, 'UPDATE api_requests SET response = $2::jsonb WHERE request_id = $1', [
      requestId,
      JSON.stringify(response),
    ]);
  }

  async abortApiRequest(requestId: string): Promise<void> {
    await run(this.pool, 'DELETE FROM api_requests WHERE request_id = $1 AND response IS NULL', [requestId]);
  }

  async pruneApiRequests(before: Date): Promise<number> {
    const { rowCount } = await run(this.pool, 'DELETE FROM api_requests WHERE created_at < $1', [before]);
    return rowCount;
  }

  async deleteExpiredLinkCodes(before: Date): Promise<number> {
    const { rowCount } = await run(this.pool, 'DELETE FROM link_codes WHERE expires_at < $1', [before]);
    return rowCount;
  }
}
