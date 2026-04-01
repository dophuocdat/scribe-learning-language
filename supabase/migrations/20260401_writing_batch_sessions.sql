-- =============================================
-- Migration: Writing Batch Sessions
-- Created: 2026-04-01
-- Stores writing practice sessions (sentence building, paraphrase, essay)
-- =============================================

CREATE TABLE IF NOT EXISTS writing_batch_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL CHECK (mode IN ('sentence_building', 'paraphrase', 'essay')),
  exercise_type TEXT NOT NULL DEFAULT 'sentence_building',
  level         TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic         TEXT DEFAULT 'General',
  batch_items   JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_index INT DEFAULT 0,
  total_count   INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_writing_batch_sessions_user
  ON writing_batch_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_writing_batch_sessions_mode
  ON writing_batch_sessions(user_id, mode);

-- RLS
ALTER TABLE writing_batch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own writing sessions"
  ON writing_batch_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own writing sessions"
  ON writing_batch_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own writing sessions"
  ON writing_batch_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own writing sessions"
  ON writing_batch_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
