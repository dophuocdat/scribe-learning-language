-- Speaking batch sessions table (same pattern as listening_batch_sessions)
CREATE TABLE IF NOT EXISTS speaking_batch_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL CHECK (mode IN ('pronunciation', 'shadowing', 'roleplay')),
  exercise_type TEXT NOT NULL DEFAULT 'sentence',
  level         TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic         TEXT DEFAULT 'General',
  batch_items   JSONB NOT NULL DEFAULT '[]',
  current_index INT DEFAULT 0,
  total_count   INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_user 
  ON speaking_batch_sessions(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_updated 
  ON speaking_batch_sessions(updated_at DESC);

-- RLS
ALTER TABLE speaking_batch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own speaking sessions"
  ON speaking_batch_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own speaking sessions"
  ON speaking_batch_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own speaking sessions"
  ON speaking_batch_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own speaking sessions"
  ON speaking_batch_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Add max_daily_speaking_exercises to user_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'max_daily_speaking_exercises'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN max_daily_speaking_exercises INT DEFAULT 15;
  END IF;
END $$;
