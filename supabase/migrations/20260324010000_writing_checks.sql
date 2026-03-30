-- Writing checks table for grammar and plagiarism checker features
-- Stores history of checks for rate limiting and internal comparison

CREATE TABLE IF NOT EXISTS writing_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('grammar', 'plagiarism')),
  input_text TEXT NOT NULL,
  input_char_count INT NOT NULL DEFAULT 0,
  result JSONB,
  quality_score INT,  -- grammar: quality 0-100, plagiarism: originality 0-100
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for rate limiting (user + date lookups)
CREATE INDEX idx_writing_checks_user_date
  ON writing_checks(user_id, created_at);

-- Index for plagiarism internal comparison
CREATE INDEX idx_writing_checks_type
  ON writing_checks(check_type, user_id);

-- RLS policies
ALTER TABLE writing_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own writing checks"
  ON writing_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own writing checks"
  ON writing_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add daily limits to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS max_daily_grammar_checks INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_daily_plagiarism_checks INT NOT NULL DEFAULT 5;
