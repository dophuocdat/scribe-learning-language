-- Exercise Library: stores AI-generated exercise content for reuse
-- Users can replay saved exercises without regenerating (saves API tokens)
CREATE TABLE IF NOT EXISTS exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('dictation', 'comprehension')),
  exercise_type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic TEXT,
  content JSONB NOT NULL,
  times_practiced INT NOT NULL DEFAULT 0,
  best_score INT,
  best_accuracy DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_library_user
  ON exercise_library(user_id, mode, level, created_at DESC);

ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved exercises"
  ON exercise_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved exercises"
  ON exercise_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved exercises"
  ON exercise_library FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved exercises"
  ON exercise_library FOR DELETE
  USING (auth.uid() = user_id);

-- Link listening_exercises to exercise_library for tracking
ALTER TABLE listening_exercises
  ADD COLUMN IF NOT EXISTS exercise_library_id UUID REFERENCES exercise_library(id) ON DELETE SET NULL;
