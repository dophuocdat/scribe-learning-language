-- =============================================
-- Lesson Skill Exercises — Luyện 4 kỹ năng trong courses
-- =============================================

-- 1. Exercises table
CREATE TABLE IF NOT EXISTS lesson_skill_exercises (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  skill           TEXT NOT NULL CHECK (skill IN ('listening','speaking','reading','writing')),
  mode            TEXT NOT NULL,
  title           TEXT NOT NULL,
  title_vi        TEXT,
  instruction_vi  TEXT,
  content         JSONB NOT NULL,
  order_index     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_skill_exercises_lesson
  ON lesson_skill_exercises(lesson_id, skill);

-- 2. Progress table
CREATE TABLE IF NOT EXISTS lesson_skill_progress (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES lesson_skill_exercises(id) ON DELETE CASCADE,
  score           INT,
  is_completed    BOOLEAN DEFAULT false,
  attempts        INT DEFAULT 0,
  best_score      INT DEFAULT 0,
  xp_earned       INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_skill_progress_user
  ON lesson_skill_progress(user_id);

-- 3. RLS
ALTER TABLE lesson_skill_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_skill_progress ENABLE ROW LEVEL SECURITY;

-- Exercises: follow lesson/course visibility
CREATE POLICY "lesson_skill_exercises_read" ON lesson_skill_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = lesson_skill_exercises.lesson_id
      AND (courses.is_published = true OR courses.created_by = auth.uid())
    )
  );

CREATE POLICY "lesson_skill_exercises_admin" ON lesson_skill_exercises
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
    OR EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = lesson_skill_exercises.lesson_id
      AND courses.created_by = auth.uid()
    )
  );

-- Progress: own data only
CREATE POLICY "lesson_skill_progress_own" ON lesson_skill_progress
  FOR ALL USING (user_id = auth.uid());
