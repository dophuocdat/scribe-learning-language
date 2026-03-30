-- Listening exercises table
CREATE TABLE IF NOT EXISTS listening_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('dictation', 'comprehension')),
  exercise_type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic TEXT,
  content JSONB NOT NULL,        -- generated exercise content
  user_answer TEXT,
  result JSONB,                  -- evaluation result
  score INT,                     -- 0-100
  accuracy DECIMAL(5,2),         -- dictation accuracy %
  xp_earned INT DEFAULT 0,
  playback_speed DECIMAL(3,2) DEFAULT 1.0,
  replay_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listening_exercises_user_date
  ON listening_exercises(user_id, created_at);

ALTER TABLE listening_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own listening exercises"
  ON listening_exercises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own listening exercises"
  ON listening_exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add daily limit
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS max_daily_listening_exercises INT NOT NULL DEFAULT 20;

