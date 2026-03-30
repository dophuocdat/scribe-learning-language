/* ===== Database Types ===== */

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'>
        Update: Partial<Omit<Category, 'id'>>
        Relationships: []
      }
      courses: {
        Row: Course
        Insert: Omit<Course, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Course, 'id'>>
        Relationships: []
      }
      lessons: {
        Row: Lesson
        Insert: Omit<Lesson, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Lesson, 'id'>>
        Relationships: []
      }
      vocabulary: {
        Row: Vocabulary
        Insert: Omit<Vocabulary, 'id' | 'created_at'>
        Update: Partial<Omit<Vocabulary, 'id'>>
        Relationships: []
      }
      quizzes: {
        Row: Quiz
        Insert: Omit<Quiz, 'id' | 'created_at'>
        Update: Partial<Omit<Quiz, 'id'>>
        Relationships: []
      }
      quiz_questions: {
        Row: QuizQuestion
        Insert: Omit<QuizQuestion, 'id' | 'created_at'>
        Update: Partial<Omit<QuizQuestion, 'id'>>
        Relationships: []
      }
      user_folders: {
        Row: UserFolder
        Insert: Omit<UserFolder, 'id' | 'created_at'>
        Update: Partial<Omit<UserFolder, 'id'>>
        Relationships: []
      }
      user_srs_cards: {
        Row: UserSrsCard
        Insert: Omit<UserSrsCard, 'id' | 'created_at'>
        Update: Partial<Omit<UserSrsCard, 'id'>>
        Relationships: []
      }
      user_quiz_attempts: {
        Row: UserQuizAttempt
        Insert: Omit<UserQuizAttempt, 'id' | 'completed_at'>
        Update: Partial<Omit<UserQuizAttempt, 'id'>>
        Relationships: []
      }
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserProfile, 'id'>>
        Relationships: []
      }
      user_xp_history: {
        Row: UserXpHistory
        Insert: Omit<UserXpHistory, 'id' | 'earned_at'>
        Update: Partial<Omit<UserXpHistory, 'id'>>
        Relationships: []
      }
      achievements: {
        Row: Achievement
        Insert: Omit<Achievement, 'id'>
        Update: Partial<Omit<Achievement, 'id'>>
        Relationships: []
      }
      user_achievements: {
        Row: UserAchievement
        Insert: Omit<UserAchievement, 'id' | 'unlocked_at'>
        Update: Partial<Omit<UserAchievement, 'id'>>
        Relationships: []
      }
      user_scan_logs: {
        Row: UserScanLog
        Insert: Omit<UserScanLog, 'id' | 'created_at'>
        Update: Partial<Omit<UserScanLog, 'id'>>
        Relationships: []
      }
      writing_checks: {
        Row: WritingCheck
        Insert: Omit<WritingCheck, 'id' | 'created_at'>
        Update: Partial<Omit<WritingCheck, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      update_srs_card: {
        Args: { p_card_id: string; p_quality: number }
        Returns: undefined
      }
      award_xp_atomic: {
        Args: { p_user_id: string; p_amount: number; p_source: string; p_source_id: string | null }
        Returns: undefined
      }
      update_streak_atomic: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/* ===== Model Types ===== */

export interface DifficultyLevel {
  id: string
  code: string
  label: string
  description: string | null
  color: string
  order_index: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon_url: string | null
  order_index: number
  created_at: string
}

export interface Course {
  id: string
  parent_id: string | null
  category_id: string | null
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  difficulty_level: string | null
  source_type: 'scan' | 'url' | 'file' | 'manual' | null
  source_url: string | null
  is_published: boolean
  is_personal: boolean
  created_by: string | null
  folder_id: string | null
  order_index: number
  estimated_time_minutes: number | null
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  course_id: string
  title: string
  raw_content: string | null
  processed_content: string | null
  ai_summary: string | null
  difficulty_level: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface Vocabulary {
  id: string
  lesson_id: string | null
  word: string
  ipa_pronunciation: string | null
  part_of_speech: string | null
  definition_en: string | null
  definition_vi: string | null
  example_sentence: string | null
  context_note: string | null
  audio_url: string | null
  difficulty_rank: number | null
  created_at: string
}

export interface Quiz {
  id: string
  lesson_id: string
  title: string
  quiz_type: 'multiple_choice' | 'true_false' | 'matching' | 'fill_blank' | 'listening'
  time_limit_seconds: number | null
  passing_score: number
  order_index: number
  created_at: string
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question_text: string
  question_type: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  reference_position: string | null
  order_index: number
  created_at: string
}

export interface UserFolder {
  id: string
  user_id: string
  name: string
  color_code: string
  icon: string
  parent_folder_id: string | null
  order_index: number
  created_at: string
}

export interface UserSrsCard {
  id: string
  user_id: string
  vocabulary_id: string
  easiness_factor: number
  interval_days: number
  repetitions: number
  quality_last: number | null
  next_review_at: string
  last_reviewed_at: string | null
  is_mastered: boolean
  created_at: string
  // Joined fields
  vocabulary?: Vocabulary
}

export interface UserQuizAttempt {
  id: string
  user_id: string
  quiz_id: string
  score: number
  total_questions: number
  time_spent_seconds: number | null
  answers: Record<string, string> | null
  completed_at: string
}

export interface UserProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  total_xp: number
  current_level: number
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  target_exam: 'TOEIC' | 'IELTS' | null
  target_score: number | null
  daily_goal_minutes: number
  max_daily_scans: number
  max_daily_grammar_checks: number
  max_daily_plagiarism_checks: number
  max_daily_paraphrase_checks: number
  max_daily_listening_exercises: number
  tts_voice: string
  tts_accent: string
  tts_speed: number
  created_at: string
  updated_at: string
}

export interface UserXpHistory {
  id: string
  user_id: string
  xp_amount: number
  source: 'quiz_complete' | 'srs_review' | 'scan' | 'streak_bonus' | 'achievement'
  source_id: string | null
  earned_at: string
}

export interface Achievement {
  id: string
  name: string
  description: string | null
  icon: string | null
  category: 'learning' | 'streak' | 'mastery' | 'exploration' | null
  requirement_type: string | null
  requirement_value: number | null
  xp_reward: number
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  unlocked_at: string
}

export interface UserScanLog {
  id: string
  user_id: string
  folder_id: string
  content_hash: string
  extracted_text: string | null
  course_id: string | null
  scan_status: 'scanned' | 'generating' | 'completed' | 'failed'
  created_at: string
  // Joined fields
  course?: Course
}

export interface WritingCheck {
  id: string
  user_id: string
  check_type: 'grammar' | 'plagiarism' | 'paraphrase'
  input_text: string
  input_char_count: number
  result: Record<string, unknown> | null
  quality_score: number | null
  created_at: string
}
