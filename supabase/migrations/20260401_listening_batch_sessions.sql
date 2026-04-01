-- =============================================
-- listening_batch_sessions: Lưu sessions bài tập đã tạo
-- User có thể resume/redo bài. Max 3 per mode.
-- =============================================

CREATE TABLE IF NOT EXISTS listening_batch_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,       -- 'dictation' | 'fill_blank' | 'dialogue'
  exercise_type   TEXT NOT NULL,       -- 'short_sentence', 'verbs', 'daily', etc.
  level           TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic           TEXT DEFAULT 'General',
  
  -- Batch data (JSON array of exercises)
  batch_items     JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_index   INT DEFAULT 0,
  total_count     INT DEFAULT 0,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lbs_user_mode ON listening_batch_sessions(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_lbs_updated ON listening_batch_sessions(user_id, updated_at DESC);

-- RLS
ALTER TABLE listening_batch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own batch sessions"
  ON listening_batch_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own batch sessions"
  ON listening_batch_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch sessions"
  ON listening_batch_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own batch sessions"
  ON listening_batch_sessions FOR DELETE
  USING (auth.uid() = user_id);
