-- =============================================
-- Migration: Reading Batch Sessions
-- Created: 2026-04-01
-- =============================================

-- Table for reading practice session management
CREATE TABLE IF NOT EXISTS reading_batch_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL CHECK (mode IN ('level_reading', 'reading_aloud')),
  exercise_type TEXT NOT NULL DEFAULT 'article',
  level         TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic         TEXT DEFAULT 'General',
  batch_items   JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_index INT DEFAULT 0,
  total_count   INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reading_batch_sessions_user 
  ON reading_batch_sessions(user_id, mode);

CREATE INDEX IF NOT EXISTS idx_reading_batch_sessions_updated 
  ON reading_batch_sessions(user_id, updated_at DESC);

-- RLS: Users can only access their own sessions
ALTER TABLE reading_batch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reading sessions"
  ON reading_batch_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading sessions"
  ON reading_batch_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reading sessions"
  ON reading_batch_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reading sessions"
  ON reading_batch_sessions FOR DELETE
  USING (auth.uid() = user_id);
