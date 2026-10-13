-- Yukina VIP API: initial schema for Discord identity and sessions.
-- Apply to a Cloudflare D1 database before configuring the Worker binding.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_discord_id ON sessions(discord_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Payment tables and checkout are intentionally not enabled in this migration.
