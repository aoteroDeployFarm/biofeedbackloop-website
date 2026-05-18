-- ─────────────────────────────────────────────────────────────────────────────
-- Open Brain — Biometric Signal Relational Schema
-- Database: biofeedback (PostgreSQL 16)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram text search on foods field

-- ── accounts ──────────────────────────────────────────────────────────────────
-- One row per Firebase Auth user. uid is the Firebase UID string.
CREATE TABLE IF NOT EXISTS accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT       NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accounts_firebase_uid_idx ON accounts (firebase_uid);

-- ── subjects ──────────────────────────────────────────────────────────────────
-- Each account may track multiple subjects (self + household members, etc.)
-- Default subject is created automatically on first signal mirror.
CREATE TABLE IF NOT EXISTS subjects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  label       TEXT        NOT NULL DEFAULT 'self',   -- "self", "partner", "child-1"
  metadata    JSONB       NOT NULL DEFAULT '{}',     -- arbitrary per-subject tags
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, label)
);

CREATE INDEX IF NOT EXISTS subjects_account_id_idx ON subjects (account_id);

-- ── biometric_signals ─────────────────────────────────────────────────────────
-- Mirror of Firestore users/${uid}/signals/${id}.
-- raw_payload   — exact Firestore payload, unmodified
-- ai_enrichment — AI-derived fields (parseMeal output, future enrichments)
CREATE TABLE IF NOT EXISTS biometric_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id    TEXT        NOT NULL,               -- Firestore document ID
  subject_id      UUID        NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  signal_type     TEXT        NOT NULL CHECK (signal_type IN ('meal', 'movement', 'sensation')),
  recorded_at     TIMESTAMPTZ NOT NULL,               -- Firestore timestamp → UTC
  raw_payload     JSONB       NOT NULL DEFAULT '{}',  -- {foods, satiety, portion, ...}
  ai_enrichment   JSONB       NOT NULL DEFAULT '{}',  -- {protein_grams, calorie_range_low, ...}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, firestore_id)
);

-- Primary access patterns
CREATE INDEX IF NOT EXISTS bms_subject_recorded_idx
  ON biometric_signals (subject_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS bms_signal_type_idx
  ON biometric_signals (signal_type);

-- GIN indexes for JSONB containment queries  (@>)
CREATE INDEX IF NOT EXISTS bms_raw_payload_gin
  ON biometric_signals USING GIN (raw_payload jsonb_path_ops);

CREATE INDEX IF NOT EXISTS bms_ai_enrichment_gin
  ON biometric_signals USING GIN (ai_enrichment jsonb_path_ops);

-- Trigram index on foods text for fuzzy search
CREATE INDEX IF NOT EXISTS bms_foods_trgm
  ON biometric_signals USING GIN ((raw_payload->>'foods') gin_trgm_ops);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Convenience view ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW signal_summary AS
SELECT
  bs.id,
  bs.firestore_id,
  bs.signal_type,
  bs.recorded_at,
  bs.raw_payload->>'foods'                        AS foods,
  (bs.raw_payload->>'satiety')::INT               AS satiety,
  (bs.raw_payload->>'hunger_return_hrs')::NUMERIC  AS hunger_return_hrs,
  (bs.raw_payload->>'energy_level')::NUMERIC       AS energy_level,
  bs.raw_payload->>'bloating'                      AS bloating,
  (bs.ai_enrichment->>'protein_grams')::INT        AS protein_grams,
  (bs.ai_enrichment->>'calorie_range_low')::INT    AS calorie_range_low,
  (bs.ai_enrichment->>'calorie_range_high')::INT   AS calorie_range_high,
  (bs.ai_enrichment->>'satiety_potential')::INT    AS satiety_potential,
  bs.ai_enrichment->>'confidence'                  AS ai_confidence,
  sub.label                                        AS subject_label,
  acc.firebase_uid
FROM biometric_signals bs
JOIN subjects sub ON sub.id = bs.subject_id
JOIN accounts acc  ON acc.id = sub.account_id;
