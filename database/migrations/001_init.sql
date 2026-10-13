CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  staff_role_id TEXT NOT NULL,
  panel_channel_id TEXT,
  panel_message_id TEXT,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roblox_links (
  discord_id TEXT PRIMARY KEY,
  roblox_user_id BIGINT NOT NULL CHECK (roblox_user_id > 0),
  roblox_username TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roblox_links_roblox_user_id_key UNIQUE (roblox_user_id)
);

CREATE TABLE IF NOT EXISTS link_codes (
  code_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_roblox_id BIGINT,
  CONSTRAINT link_codes_expiry_chk CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS link_codes_discord_unused_idx ON link_codes (discord_id) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS link_codes_expires_idx ON link_codes (expires_at);

CREATE TABLE IF NOT EXISTS game_presence (
  roblox_user_id BIGINT PRIMARY KEY,
  roblox_username TEXT NOT NULL,
  job_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS game_presence_last_seen_idx ON game_presence (last_seen_at);

CREATE TABLE IF NOT EXISTS service_sessions (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  roblox_user_id BIGINT NOT NULL,
  roblox_username TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  end_reason TEXT,
  job_id TEXT,
  CONSTRAINT service_sessions_status_chk CHECK (status IN ('pending', 'active', 'ended', 'expired')),
  CONSTRAINT service_sessions_active_chk CHECK (status <> 'active' OR (started_at IS NOT NULL AND last_seen_at IS NOT NULL)),
  CONSTRAINT service_sessions_ended_chk CHECK (status <> 'ended' OR (started_at IS NOT NULL AND ended_at IS NOT NULL AND duration_seconds IS NOT NULL)),
  CONSTRAINT service_sessions_order_chk CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
  CONSTRAINT service_sessions_duration_chk CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS service_sessions_one_open_per_discord ON service_sessions (discord_id) WHERE status IN ('pending', 'active');
CREATE UNIQUE INDEX IF NOT EXISTS service_sessions_one_open_per_roblox ON service_sessions (roblox_user_id) WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS service_sessions_discord_started_idx ON service_sessions (discord_id, started_at DESC);
CREATE INDEX IF NOT EXISTS service_sessions_active_last_seen_idx ON service_sessions (last_seen_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS service_sessions_pending_requested_idx ON service_sessions (requested_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS api_requests (
  request_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  response JSONB
);
CREATE INDEX IF NOT EXISTS api_requests_created_idx ON api_requests (created_at);
