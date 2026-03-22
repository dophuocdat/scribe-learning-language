-- ============================================
-- Fix RLS policies: admin role path in JWT
-- Supabase stores custom claims in app_metadata
-- Correct path: auth.jwt() -> 'app_metadata' ->> 'role'
-- ============================================

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== CATEGORIES =====
DROP POLICY IF EXISTS "categories_admin" ON categories;
CREATE POLICY "categories_admin" ON categories FOR ALL USING (
  public.is_admin()
);

-- ===== COURSES =====
DROP POLICY IF EXISTS "courses_insert_admin" ON courses;
CREATE POLICY "courses_insert_admin" ON courses FOR INSERT WITH CHECK (
  public.is_admin() OR is_personal = true
);

DROP POLICY IF EXISTS "courses_update_own" ON courses;
CREATE POLICY "courses_update_own" ON courses FOR UPDATE USING (
  created_by = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "courses_delete_own" ON courses;
CREATE POLICY "courses_delete_own" ON courses FOR DELETE USING (
  created_by = auth.uid() OR public.is_admin()
);

-- ===== LESSONS =====
DROP POLICY IF EXISTS "lessons_admin" ON lessons;
CREATE POLICY "lessons_admin" ON lessons FOR ALL USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.created_by = auth.uid()
  )
);

-- ===== VOCABULARY (add admin write policies) =====
CREATE POLICY "vocabulary_admin" ON vocabulary FOR ALL USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    WHERE lessons.id = vocabulary.lesson_id AND courses.created_by = auth.uid()
  )
);

-- ===== QUIZZES (add admin write policies) =====
CREATE POLICY "quizzes_admin" ON quizzes FOR ALL USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM lessons
    JOIN courses ON courses.id = quizzes.lesson_id
    WHERE lessons.id = quizzes.lesson_id AND courses.created_by = auth.uid()
  )
);

-- ===== QUIZ QUESTIONS (add admin write policies) =====
CREATE POLICY "quiz_questions_admin" ON quiz_questions FOR ALL USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM quizzes
    JOIN lessons ON lessons.id = quizzes.lesson_id
    JOIN courses ON courses.id = lessons.course_id
    WHERE quizzes.id = quiz_questions.quiz_id AND courses.created_by = auth.uid()
  )
);
