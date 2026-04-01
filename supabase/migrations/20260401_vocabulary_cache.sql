-- =============================================
-- Migration: Vocabulary Cache (lookup results)
-- Created: 2026-04-01
-- Stores AI-generated word lookups to avoid repeated API calls
-- =============================================

CREATE TABLE IF NOT EXISTS vocabulary_cache (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word          TEXT NOT NULL UNIQUE,
  meaning_vi    TEXT NOT NULL,
  ipa           TEXT DEFAULT '',
  part_of_speech TEXT DEFAULT '',
  example       TEXT DEFAULT '',
  context       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast word lookup
CREATE INDEX IF NOT EXISTS idx_vocabulary_cache_word
  ON vocabulary_cache(word);

-- Enable RLS but allow all authenticated users to read
ALTER TABLE vocabulary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vocabulary cache"
  ON vocabulary_cache FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert (via edge function)
CREATE POLICY "Service role can insert vocabulary cache"
  ON vocabulary_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update vocabulary cache"
  ON vocabulary_cache FOR UPDATE
  TO service_role
  USING (true);
