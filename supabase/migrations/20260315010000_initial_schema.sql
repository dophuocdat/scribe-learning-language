-- =============================================
-- SCRIBE: AI Language Learning Platform
-- Database Migration v1.0
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== 1. CATEGORIES =====
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. USER FOLDERS (must be before courses for FK) =====
CREATE TABLE user_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color_code TEXT DEFAULT '#2563eb',
  icon TEXT DEFAULT 'folder',
  parent_folder_id UUID REFERENCES user_folders(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 3. COURSES (Hierarchical) =====
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('A1','A2','B1','B2','C1','C2')),
  source_type TEXT CHECK (source_type IN ('scan','url','file','manual')),
  source_url TEXT,
  is_published BOOLEAN DEFAULT false,
  is_personal BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  folder_id UUID REFERENCES user_folders(id) ON DELETE SET NULL,
  order_index INTEGER DEFAULT 0,
  estimated_time_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 4. LESSONS =====
CREATE TABLE lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  raw_content TEXT,
  processed_content TEXT,
  ai_summary TEXT,
  difficulty_level TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 5. VOCABULARY =====
CREATE TABLE vocabulary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  ipa_pronunciation TEXT,
  part_of_speech TEXT,
  definition_en TEXT,
  definition_vi TEXT,
  example_sentence TEXT,
  context_note TEXT,
  audio_url TEXT,
  difficulty_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vocabulary_word ON vocabulary(word);
CREATE INDEX idx_vocabulary_lesson ON vocabulary(lesson_id);

-- ===== 6. QUIZZES =====
CREATE TABLE quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  quiz_type TEXT CHECK (quiz_type IN ('multiple_choice','true_false','matching','fill_blank','listening')),
  time_limit_seconds INTEGER,
  passing_score INTEGER DEFAULT 70,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 7. QUIZ QUESTIONS =====
CREATE TABLE quiz_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  reference_position TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 8. SRS CARDS (SM-2 Algorithm) =====
CREATE TABLE user_srs_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  easiness_factor FLOAT DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  quality_last INTEGER,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  is_mastered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vocabulary_id)
);

CREATE INDEX idx_srs_review ON user_srs_cards(user_id, next_review_at);

-- ===== 9. QUIZ ATTEMPTS =====
CREATE TABLE user_quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_spent_seconds INTEGER,
  answers JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 10. USER PROFILES (Gamification) =====
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  target_exam TEXT,
  target_score INTEGER,
  daily_goal_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 11. XP HISTORY =====
CREATE TABLE user_xp_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_id UUID,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 12. ACHIEVEMENTS =====
CREATE TABLE achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  requirement_type TEXT,
  requirement_value INTEGER,
  xp_reward INTEGER DEFAULT 0
);

CREATE TABLE user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES achievements(id) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- ===== ROW LEVEL SECURITY (RLS) =====

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_srs_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Categories: Everyone can read
CREATE POLICY "categories_read" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_admin" ON categories FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);

-- Courses: Published courses readable by all, personal only by owner
CREATE POLICY "courses_read_published" ON courses FOR SELECT USING (
  is_published = true OR created_by = auth.uid()
);
CREATE POLICY "courses_insert_admin" ON courses FOR INSERT WITH CHECK (
  auth.jwt() ->> 'role' = 'admin' OR is_personal = true
);
CREATE POLICY "courses_update_own" ON courses FOR UPDATE USING (
  created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
);
CREATE POLICY "courses_delete_own" ON courses FOR DELETE USING (
  created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
);

-- Lessons: Follow course visibility
CREATE POLICY "lessons_read" ON lessons FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lessons.course_id
    AND (courses.is_published = true OR courses.created_by = auth.uid())
  )
);
CREATE POLICY "lessons_admin" ON lessons FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
  OR EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.created_by = auth.uid()
  )
);

-- Vocabulary: Follow lesson/course visibility
CREATE POLICY "vocabulary_read" ON vocabulary FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    WHERE lessons.id = vocabulary.lesson_id
    AND (courses.is_published = true OR courses.created_by = auth.uid())
  )
);

-- Quizzes/Questions: Follow lesson/course visibility
CREATE POLICY "quizzes_read" ON quizzes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    WHERE lessons.id = quizzes.lesson_id
    AND (courses.is_published = true OR courses.created_by = auth.uid())
  )
);
CREATE POLICY "quiz_questions_read" ON quiz_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM quizzes
    JOIN lessons ON lessons.id = quizzes.lesson_id
    JOIN courses ON courses.id = lessons.course_id
    WHERE quizzes.id = quiz_questions.quiz_id
    AND (courses.is_published = true OR courses.created_by = auth.uid())
  )
);

-- User Folders: Own data only
CREATE POLICY "folders_own" ON user_folders FOR ALL USING (user_id = auth.uid());

-- SRS Cards: Own data only
CREATE POLICY "srs_own" ON user_srs_cards FOR ALL USING (user_id = auth.uid());

-- Quiz Attempts: Own data only
CREATE POLICY "attempts_own" ON user_quiz_attempts FOR ALL USING (user_id = auth.uid());

-- User Profiles: Read own, insert/update own
CREATE POLICY "profiles_read_own" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE USING (id = auth.uid());

-- XP History: Own data only
CREATE POLICY "xp_own" ON user_xp_history FOR ALL USING (user_id = auth.uid());

-- Achievements: Everyone can read definitions
CREATE POLICY "achievements_read" ON achievements FOR SELECT USING (true);

-- User Achievements: Own data only
CREATE POLICY "user_achievements_own" ON user_achievements FOR ALL USING (user_id = auth.uid());

-- ===== TRIGGER: Auto-create profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'Learner'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== FUNCTION: Update SRS Card (SM-2 Algorithm) =====
CREATE OR REPLACE FUNCTION update_srs_card(
  p_card_id UUID,
  p_quality INTEGER  -- 0-5 (0=blackout, 5=perfect)
)
RETURNS void AS $$
DECLARE
  v_ef FLOAT;
  v_interval INTEGER;
  v_reps INTEGER;
BEGIN
  SELECT easiness_factor, interval_days, repetitions
  INTO v_ef, v_interval, v_reps
  FROM user_srs_cards WHERE id = p_card_id AND user_id = auth.uid();

  IF p_quality >= 3 THEN
    -- Correct response
    IF v_reps = 0 THEN
      v_interval := 1;
    ELSIF v_reps = 1 THEN
      v_interval := 6;
    ELSE
      v_interval := ROUND(v_interval * v_ef);
    END IF;
    v_reps := v_reps + 1;
  ELSE
    -- Incorrect response
    v_reps := 0;
    v_interval := 1;
  END IF;

  -- Update EF (minimum 1.3)
  v_ef := GREATEST(1.3, v_ef + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02)));

  UPDATE user_srs_cards
  SET
    easiness_factor = v_ef,
    interval_days = v_interval,
    repetitions = v_reps,
    quality_last = p_quality,
    next_review_at = NOW() + (v_interval || ' days')::INTERVAL,
    last_reviewed_at = NOW(),
    is_mastered = (v_ef > 2.5 AND v_reps > 5)
  WHERE id = p_card_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
