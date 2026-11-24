-- Idempotent schema for anonymous community builds, metrics, and rate limiting

CREATE TABLE IF NOT EXISTS community_builds (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'verified', 'archived', 'removed')),
  title TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  element TEXT NOT NULL,
  archetype TEXT NOT NULL DEFAULT 'Custom Squad',
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('f2p', 'standard', 'premium')),
  modes JSONB NOT NULL DEFAULT '["general"]'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  rotation JSONB NOT NULL DEFAULT '[]'::jsonb,
  combat_rotation JSONB,
  adv_code TEXT NOT NULL,
  in_game_code TEXT,
  verified_patch TEXT NOT NULL,
  submitter_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_community_builds_status_created
  ON community_builds (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_builds_active_adv_code
  ON community_builds (adv_code)
  WHERE status IN ('live', 'verified');

CREATE TABLE IF NOT EXISTS build_metrics (
  build_id TEXT PRIMARY KEY,
  views_count INTEGER NOT NULL DEFAULT 0,
  upvotes_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS build_votes (
  build_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (build_id, voter_hash)
);

CREATE TABLE IF NOT EXISTS build_views (
  build_id TEXT NOT NULL,
  viewer_hash TEXT NOT NULL,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (build_id, viewer_hash, view_date)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (scope, actor_hash, window_start)
);
