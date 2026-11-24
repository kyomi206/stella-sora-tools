-- Idempotent schema for private visitor feedback inbox

CREATE TABLE IF NOT EXISTS community_feedback (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('bug', 'math', 'feature', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  page_context TEXT,
  message TEXT NOT NULL,
  contact TEXT,
  submitter_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_community_feedback_status_created
  ON community_feedback (status, created_at DESC);
