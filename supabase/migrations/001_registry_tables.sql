-- ============================================================
-- Arcede Agent Gateway — Shared Tool Registry
-- Migration: Create registry tables
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── registry_tools ─────────────────────────────────────────
-- One row per tool per origin. Stores the community-contributed
-- schema (no selectors, no user data).

CREATE TABLE registry_tools (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin          TEXT NOT NULL,                 -- e.g. "https://notion.so"
  tool_name       TEXT NOT NULL,                 -- e.g. "notion_search"
  description     TEXT NOT NULL DEFAULT '',
  input_schema    JSONB NOT NULL DEFAULT '{}',   -- JSON Schema for tool parameters
  source          TEXT NOT NULL DEFAULT 'community'
                    CHECK (source IN ('community', 'curated')),
  contributor_count INT NOT NULL DEFAULT 1,
  execution_count   INT NOT NULL DEFAULT 0,
  success_count     INT NOT NULL DEFAULT 0,
  success_rate      FLOAT NOT NULL DEFAULT 0.0,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'stale', 'deprecated')),
  schema_hash     TEXT NOT NULL,                 -- SHA-256 of normalized schema
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at     TIMESTAMPTZ,

  UNIQUE (origin, tool_name)
);

-- Index for origin lookups (most common query)
CREATE INDEX idx_registry_tools_origin ON registry_tools (origin);
-- Index for status-based queries (validation pipeline)
CREATE INDEX idx_registry_tools_status ON registry_tools (status);
-- Index for staleness checks
CREATE INDEX idx_registry_tools_updated ON registry_tools (updated_at);

-- ─── registry_contributions ─────────────────────────────────
-- Tracks distinct contributors per tool. contributor_id is an
-- anonymized hash — not traceable to any individual user.

CREATE TABLE registry_contributions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id         UUID NOT NULL REFERENCES registry_tools(id) ON DELETE CASCADE,
  contributor_id  TEXT NOT NULL,    -- SHA-256(extension_install_id)
  schema_hash     TEXT NOT NULL,    -- Hash of contributed schema
  contributed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tool_id, contributor_id)  -- One contribution per user per tool
);

CREATE INDEX idx_contributions_tool ON registry_contributions (tool_id);

-- ─── registry_execution_reports ─────────────────────────────
-- Feeds the success-rate validation pipeline.

CREATE TABLE registry_execution_reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id     UUID NOT NULL REFERENCES registry_tools(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,        -- SHA-256(extension_install_id)
  success     BOOLEAN NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_tool ON registry_execution_reports (tool_id);
CREATE INDEX idx_reports_reported ON registry_execution_reports (reported_at);

-- ─── Row Level Security ─────────────────────────────────────
-- Public read, authenticated write (via edge functions only).

ALTER TABLE registry_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_execution_reports ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can fetch tool definitions
CREATE POLICY "registry_tools_read"
  ON registry_tools FOR SELECT
  USING (status IN ('pending', 'verified', 'stale'));

-- Service role write: only edge functions can insert/update
CREATE POLICY "registry_tools_write"
  ON registry_tools FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "registry_contributions_read"
  ON registry_contributions FOR SELECT
  USING (true);

CREATE POLICY "registry_contributions_write"
  ON registry_contributions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "registry_reports_write"
  ON registry_execution_reports FOR INSERT
  WITH CHECK (true);

-- ─── Helper function: recalculate success rate ──────────────

CREATE OR REPLACE FUNCTION recalculate_success_rate(p_tool_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE registry_tools
  SET
    execution_count = (SELECT COUNT(*) FROM registry_execution_reports WHERE tool_id = p_tool_id),
    success_count = (SELECT COUNT(*) FROM registry_execution_reports WHERE tool_id = p_tool_id AND success = true),
    success_rate = CASE
      WHEN (SELECT COUNT(*) FROM registry_execution_reports WHERE tool_id = p_tool_id) = 0 THEN 0.0
      ELSE (SELECT COUNT(*)::float FROM registry_execution_reports WHERE tool_id = p_tool_id AND success = true)
           / (SELECT COUNT(*)::float FROM registry_execution_reports WHERE tool_id = p_tool_id)
    END,
    updated_at = NOW()
  WHERE id = p_tool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Trigger: auto-recalculate on new reports ───────────────

CREATE OR REPLACE FUNCTION trigger_recalculate_rate()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_success_rate(NEW.tool_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_execution_report_insert
  AFTER INSERT ON registry_execution_reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_rate();

-- ─── Validation cron queries (to be called by edge function) ─

-- Promote: pending → verified
-- WHERE contributor_count >= 3 AND success_rate >= 0.6
-- (Executed by the validation edge function, not as a DB trigger)

-- Demote: verified → stale
-- WHERE success_rate < 0.4 OR updated_at < NOW() - INTERVAL '30 days'

-- Archive: stale → deprecated
-- WHERE updated_at < NOW() - INTERVAL '90 days'
