-- =============================================
-- Sub-project 1: Foundation Tables
-- 4-Skills Practice System (Listening, Speaking, Reading, Writing)
-- =============================================

-- 1. skill_sessions — Unified sessions cho cả 4 kỹ năng
CREATE TABLE IF NOT EXISTS skill_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill           TEXT NOT NULL CHECK (skill IN ('listening','speaking','reading','writing')),
  mode            TEXT NOT NULL,
  level           TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic           TEXT,
  config          JSONB,

  -- Progress
  total_exercises INT DEFAULT 0,
  completed_count INT DEFAULT 0,
  avg_score       NUMERIC(5,2) DEFAULT 0,
  total_time_sec  INT DEFAULT 0,

  -- AI Summary (cuối session)
  ai_summary      JSONB,

  -- XP
  xp_earned       INT DEFAULT 0,

  -- Timing
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_sessions_user ON skill_sessions(user_id, skill);
CREATE INDEX IF NOT EXISTS idx_skill_sessions_date ON skill_sessions(user_id, created_at DESC);

-- RLS
ALTER TABLE skill_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON skill_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON skill_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON skill_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON skill_sessions FOR DELETE
  USING (auth.uid() = user_id);


-- 2. skill_attempts — Từng bài tập trong session
-- OPTIMIZED: dùng pool_item_id reference thay vì duplicate JSONB
CREATE TABLE IF NOT EXISTS skill_attempts (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id              UUID NOT NULL REFERENCES skill_sessions(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Exercise reference (tránh duplicate JSONB)
  exercise_index          INT DEFAULT 0,
  pool_item_id            UUID REFERENCES exercise_content_pool(id),
  exercise_data_override  JSONB,

  -- User input
  user_answer             TEXT,
  user_audio_url          TEXT,

  -- AI Evaluation (compact)
  score                   INT,
  is_correct              BOOLEAN,
  error_summary           TEXT,
  ai_feedback             JSONB,

  -- Timing
  time_spent_sec          INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_attempts_session ON skill_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_attempts_user ON skill_attempts(user_id, created_at DESC);

-- RLS
ALTER TABLE skill_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts"
  ON skill_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
  ON skill_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- 3. user_word_bank — Từ vựng user lưu khi đọc/nghe
CREATE TABLE IF NOT EXISTS user_word_bank (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word            TEXT NOT NULL,
  meaning_vi      TEXT,
  ipa             TEXT,
  part_of_speech  TEXT,
  example_sentence TEXT,
  source          TEXT,
  source_context  TEXT,
  mastered        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_user_word_bank ON user_word_bank(user_id, mastered);

-- RLS
ALTER TABLE user_word_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own word bank"
  ON user_word_bank FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own words"
  ON user_word_bank FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own words"
  ON user_word_bank FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own words"
  ON user_word_bank FOR DELETE
  USING (auth.uid() = user_id);


-- 4. ALTER user_profiles — Thêm limits + preferences
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS max_daily_speaking_exercises INT DEFAULT 15;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS max_daily_reading_exercises INT DEFAULT 20;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS reading_interests TEXT[] DEFAULT '{"Technology","Daily Life"}';

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS preferred_reading_level TEXT DEFAULT 'B1';
