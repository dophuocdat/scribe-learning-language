-- =============================================
-- SCRIBE: Smart Scan — User scan logs + RLS
-- =============================================

-- ===== 1. USER SCAN LOGS =====
CREATE TABLE user_scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES user_folders(id) ON DELETE CASCADE NOT NULL,
  content_hash TEXT NOT NULL,
  extracted_text TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  scan_status TEXT DEFAULT 'scanned' CHECK (scan_status IN ('scanned','generating','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: user chỉ thao tác data của mình
ALTER TABLE user_scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_logs_own" ON user_scan_logs FOR ALL USING (user_id = auth.uid());

-- Index cho rate limit query (scans today)
CREATE INDEX idx_scan_logs_user_date ON user_scan_logs(user_id, created_at);

-- Unique index ngăn scan lại cùng nội dung
CREATE UNIQUE INDEX idx_scan_logs_content ON user_scan_logs(user_id, content_hash);

-- ===== 2. RLS bổ sung cho vocabulary, quizzes, quiz_questions =====
-- Cho phép user INSERT/UPDATE/DELETE vocabulary/quizzes/quiz_questions
-- trên course is_personal mà user sở hữu

-- Vocabulary: user insert/update/delete trên personal courses
CREATE POLICY "vocabulary_personal_write" ON vocabulary FOR ALL USING (
  EXISTS (
    SELECT 1 FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    WHERE lessons.id = vocabulary.lesson_id
    AND courses.is_personal = true
    AND courses.created_by = auth.uid()
  )
);

-- Quizzes: user insert/update/delete trên personal courses
CREATE POLICY "quizzes_personal_write" ON quizzes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    WHERE lessons.id = quizzes.lesson_id
    AND courses.is_personal = true
    AND courses.created_by = auth.uid()
  )
);

-- Quiz Questions: user insert/update/delete trên personal courses
CREATE POLICY "quiz_questions_personal_write" ON quiz_questions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM quizzes
    JOIN lessons ON lessons.id = quizzes.lesson_id
    JOIN courses ON courses.id = lessons.course_id
    WHERE quizzes.id = quiz_questions.quiz_id
    AND courses.is_personal = true
    AND courses.created_by = auth.uid()
  )
);

-- Lessons: user insert/update/delete trên personal courses
CREATE POLICY "lessons_personal_write" ON lessons FOR ALL USING (
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = lessons.course_id
    AND courses.is_personal = true
    AND courses.created_by = auth.uid()
  )
);
