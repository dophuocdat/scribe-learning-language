import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import { useXpStore } from '@/shared/stores/xpStore'
import type {
  Course,
  Category,
  Lesson,
  Vocabulary,
  Quiz,
  QuizQuestion,
  UserSrsCard,
  UserQuizAttempt,
} from '@/shared/types/database'

/* ===== Types ===== */

export interface CourseWithMeta extends Course {
  category?: Category | null
  lessons_count?: number
}

export interface CourseProgress {
  courseId: string
  completedLessons: number
  totalLessons: number
  lastAccessedAt?: string
  lastLessonId?: string
  lastLessonTitle?: string
}

export interface LessonWithContent extends Lesson {
  vocabulary?: Vocabulary[]
  quizzes?: (Quiz & { questions?: QuizQuestion[] })[]
}

export type SkillType = 'listening' | 'speaking' | 'reading' | 'writing'

export interface LessonSkillExercise {
  id: string
  lesson_id: string
  skill: SkillType
  mode: string
  title: string
  title_vi: string | null
  instruction_vi: string | null
  content: any
  order_index: number
}

export interface LessonSkillProgress {
  id: string
  user_id: string
  exercise_id: string
  score: number | null
  is_completed: boolean
  attempts: number
  best_score: number
  xp_earned: number
  last_attempt_at: string | null
}

interface LearnState {
  // Data
  courses: CourseWithMeta[]
  currentCourse: CourseWithMeta | null
  courseLessons: Lesson[]
  currentLesson: LessonWithContent | null
  srsCards: (UserSrsCard & { vocabulary?: Vocabulary })[]
  srsStats: { dueToday: number; mastered: number; total: number }
  userProgress: Record<string, CourseProgress>

  // Skill exercises
  skillExercises: LessonSkillExercise[]
  skillProgress: Record<string, LessonSkillProgress>
  loadingSkills: boolean

  // UI
  loadingCourses: boolean
  loadingCourse: boolean
  loadingLesson: boolean
  loadingSrs: boolean
  submittingQuiz: boolean

  // Course catalog
  fetchPublishedCourses: () => Promise<void>
  fetchCourseDetail: (courseId: string) => Promise<void>
  fetchUserProgress: () => Promise<void>

  // Lesson study
  fetchLessonDetail: (lessonId: string) => Promise<void>

  // SRS
  fetchSrsCards: () => Promise<void>
  addToSrs: (vocabularyId: string) => Promise<boolean>
  reviewSrsCard: (cardId: string, quality: number) => Promise<void>

  // Quiz
  submitQuizAttempt: (
    quizId: string,
    answers: Record<string, string>,
    score: number,
    totalQuestions: number,
    timeSpent: number
  ) => Promise<UserQuizAttempt | null>

  // Skill exercises
  fetchLessonSkillExercises: (lessonId: string) => Promise<void>
  saveSkillProgress: (exerciseId: string, score: number, isCompleted: boolean) => Promise<void>
}

export const useLearnStore = create<LearnState>((set, get) => ({
  courses: [],
  currentCourse: null,
  courseLessons: [],
  currentLesson: null,
  srsCards: [],
  srsStats: { dueToday: 0, mastered: 0, total: 0 },
  userProgress: {},

  skillExercises: [],
  skillProgress: {},
  loadingSkills: false,

  loadingCourses: false,
  loadingCourse: false,
  loadingLesson: false,
  loadingSrs: false,
  submittingQuiz: false,

  // ===== COURSE CATALOG =====
  fetchPublishedCourses: async () => {
    set({ loadingCourses: true })
    try {
      // RLS enforces: only published + own courses visible
      const { data, error } = await supabase
        .from('courses')
        .select('*, categories(*)')
        .eq('is_published', true)
        .order('order_index', { ascending: true })

      if (error) throw error

      const courses: CourseWithMeta[] = (data || []).map((c: any) => ({
        ...c,
        category: c.categories || null,
        categories: undefined,
      }))

      // Get lesson counts
      const courseIds = courses.map((c) => c.id)
      if (courseIds.length > 0) {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('course_id')
          .in('course_id', courseIds)

        const countMap: Record<string, number> = {}
        lessons?.forEach((l: any) => {
          countMap[l.course_id] = (countMap[l.course_id] || 0) + 1
        })
        courses.forEach((c) => {
          c.lessons_count = countMap[c.id] || 0
        })
      }

      set({ courses })
    } catch (err) {
      console.error('[learnStore] fetchPublishedCourses:', err)
    } finally {
      set({ loadingCourses: false })
    }
  },

  // ===== USER PROGRESS =====
  fetchUserProgress: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Step 1: Get quiz attempts with quiz info (single-level join only)
      const { data: attempts, error: attErr } = await supabase
        .from('user_quiz_attempts')
        .select('quiz_id, completed_at, quizzes(id, lesson_id)')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      if (attErr) {
        console.error('[learnStore] fetchUserProgress attempts error:', attErr)
        return
      }
      if (!attempts || attempts.length === 0) return

      // Step 2: Collect unique lesson IDs from the attempts
      const lessonIds = [...new Set(
        (attempts as any[])
          .map((a: any) => a.quizzes?.lesson_id)
          .filter(Boolean)
      )]

      if (lessonIds.length === 0) return

      // Step 3: Fetch lessons to get their course_ids and titles
      const { data: lessons, error: lesErr } = await supabase
        .from('lessons')
        .select('id, title, course_id')
        .in('id', lessonIds)

      if (lesErr) {
        console.error('[learnStore] fetchUserProgress lessons error:', lesErr)
        return
      }

      // Build a lookup map: lessonId -> { course_id, title }
      const lessonMap: Record<string, { course_id: string; title: string }> = {}
      for (const l of (lessons || []) as any[]) {
        lessonMap[l.id] = { course_id: l.course_id, title: l.title }
      }

      // Step 4: Build progress map
      const progressMap: Record<string, CourseProgress> = {}
      const seenLessons = new Set<string>()

      for (const attempt of attempts as any[]) {
        const lessonId = (attempt as any).quizzes?.lesson_id
        if (!lessonId || !lessonMap[lessonId]) continue

        const { course_id: courseId, title: lessonTitle } = lessonMap[lessonId]

        if (!progressMap[courseId]) {
          const course = get().courses.find(c => c.id === courseId)
          progressMap[courseId] = {
            courseId,
            completedLessons: 0,
            totalLessons: course?.lessons_count || 0,
            lastAccessedAt: (attempt as any).completed_at,
            lastLessonId: lessonId,
            lastLessonTitle: lessonTitle,
          }
        }

        const key = `${courseId}:${lessonId}`
        if (!seenLessons.has(key)) {
          seenLessons.add(key)
          progressMap[courseId].completedLessons++
        }
      }

      set({ userProgress: progressMap })
    } catch (err) {
      console.error('[learnStore] fetchUserProgress:', err)
    }
  },

  // ===== COURSE DETAIL =====
  fetchCourseDetail: async (courseId: string) => {
    set({ loadingCourse: true, currentCourse: null, courseLessons: [] })
    try {
      const [courseRes, lessonsRes] = await Promise.all([
        supabase
          .from('courses')
          .select('*, categories(*)')
          .eq('id', courseId)
          .single(),
        supabase
          .from('lessons')
          .select('*')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true }),
      ])

      if (courseRes.error) throw courseRes.error

      const course: CourseWithMeta = {
        ...(courseRes.data as any),
        category: (courseRes.data as any).categories || null,
      }

      set({
        currentCourse: course,
        courseLessons: lessonsRes.data || [],
      })
    } catch (err) {
      console.error('[learnStore] fetchCourseDetail:', err)
    } finally {
      set({ loadingCourse: false })
    }
  },

  // ===== LESSON DETAIL =====
  fetchLessonDetail: async (lessonId: string) => {
    set({ loadingLesson: true, currentLesson: null })
    try {
      const [lessonRes, vocabRes, quizRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', lessonId).single(),
        supabase
          .from('vocabulary')
          .select('*')
          .eq('lesson_id', lessonId)
          .order('difficulty_rank', { ascending: true }),
        supabase
          .from('quizzes')
          .select('*, quiz_questions(*)')
          .eq('lesson_id', lessonId)
          .order('order_index', { ascending: true }),
      ])

      if (lessonRes.error) throw lessonRes.error

      const lesson: LessonWithContent = {
        ...(lessonRes.data as Lesson),
        vocabulary: vocabRes.data || [],
        quizzes: (quizRes.data || []).map((q: any) => ({
          ...q,
          questions: q.quiz_questions || [],
          quiz_questions: undefined,
        })),
      }

      set({ currentLesson: lesson })
    } catch (err) {
      console.error('[learnStore] fetchLessonDetail:', err)
    } finally {
      set({ loadingLesson: false })
    }
  },

  // ===== SRS =====
  fetchSrsCards: async () => {
    set({ loadingSrs: true })
    try {
      const now = new Date().toISOString()

      // Cards due for review
      const { data: dueCards, error } = await supabase
        .from('user_srs_cards')
        .select('*, vocabulary(*)')
        .lte('next_review_at', now)
        .eq('is_mastered', false)
        .order('next_review_at', { ascending: true })

      if (error) throw error

      // Stats
      const { count: totalCount } = await supabase
        .from('user_srs_cards')
        .select('*', { count: 'exact', head: true })

      const { count: masteredCount } = await supabase
        .from('user_srs_cards')
        .select('*', { count: 'exact', head: true })
        .eq('is_mastered', true)

      set({
        srsCards: dueCards || [],
        srsStats: {
          dueToday: dueCards?.length || 0,
          mastered: masteredCount || 0,
          total: totalCount || 0,
        },
      })
    } catch (err) {
      console.error('[learnStore] fetchSrsCards:', err)
    } finally {
      set({ loadingSrs: false })
    }
  },

  addToSrs: async (vocabularyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { error } = await supabase
        .from('user_srs_cards')
        .upsert(
          {
            user_id: user.id,
            vocabulary_id: vocabularyId,
            next_review_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,vocabulary_id' }
        )

      if (error) throw error
      return true
    } catch (err) {
      console.error('[learnStore] addToSrs:', err)
      return false
    }
  },

  reviewSrsCard: async (cardId: string, quality: number) => {
    try {
      // Call the SM-2 database function
      const { error } = await supabase.rpc('update_srs_card', {
        p_card_id: cardId,
        p_quality: quality,
      })

      if (error) throw error

      // Remove reviewed card from local state
      set({
        srsCards: get().srsCards.filter((c) => c.id !== cardId),
        srsStats: {
          ...get().srsStats,
          dueToday: Math.max(0, get().srsStats.dueToday - 1),
        },
      })

      // Award XP for SRS review
      await useXpStore.getState().awardXp(5, 'srs_review', cardId)
      await useXpStore.getState().updateStreak()
    } catch (err) {
      console.error('[learnStore] reviewSrsCard:', err)
    }
  },

  // ===== QUIZ =====
  submitQuizAttempt: async (quizId, answers, score, totalQuestions, timeSpent) => {
    set({ submittingQuiz: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_quiz_attempts')
        .insert({
          user_id: user.id,
          quiz_id: quizId,
          score,
          total_questions: totalQuestions,
          time_spent_seconds: timeSpent,
          answers,
        })
        .select()
        .single()

      if (error) throw error

      // Check if quiz belongs to personal course (scan-generated) → skip XP
      let isPersonal = false
      try {
        const { data: quiz } = await supabase
          .from('quizzes')
          .select('lesson_id')
          .eq('id', quizId)
          .single()

        if (quiz?.lesson_id) {
          const { data: lesson } = await supabase
            .from('lessons')
            .select('course_id')
            .eq('id', quiz.lesson_id)
            .single()

          if (lesson?.course_id) {
            const { data: course } = await supabase
              .from('courses')
              .select('is_personal')
              .eq('id', lesson.course_id)
              .single()

            isPersonal = course?.is_personal === true
          }
        }
      } catch {
        // If check fails, award XP normally
      }

      if (!isPersonal) {
        // Award XP based on score percentage
        const percent = totalQuestions > 0 ? score / totalQuestions : 0
        const xpAmount = Math.round(10 + percent * 40) // 10–50 XP

        // Use centralized xpStore for XP + streak (handles notification + profile refresh)
        await useXpStore.getState().awardXp(xpAmount, 'quiz_complete', quizId)
        await useXpStore.getState().updateStreak()
      }

      // Auto-track lesson progress for daily review scheduling
      try {
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('lesson_id')
          .eq('id', quizId)
          .single()

        if (quizData?.lesson_id) {
          const { data: lessonData } = await supabase
            .from('lessons')
            .select('id, course_id')
            .eq('id', quizData.lesson_id)
            .single()

          if (lessonData?.course_id) {
            const scorePct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0
            await supabase
              .from('user_lesson_progress')
              .upsert({
                user_id: user.id,
                lesson_id: lessonData.id,
                course_id: lessonData.course_id,
                status: scorePct >= 85 ? 'completed' : 'started',
                completion_count: 1,
                best_score_percent: scorePct,
                total_time_spent_sec: timeSpent,
                // Set to start of next day (midnight UTC) so review is available next morning
                next_review_at: (() => {
                  const tomorrow = new Date()
                  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
                  tomorrow.setUTCHours(0, 0, 0, 0)
                  return tomorrow.toISOString()
                })(),
              }, {
                onConflict: 'user_id,lesson_id',
              })
          }
        }
      } catch (trackErr) {
        console.warn('[learnStore] Auto-track lesson progress failed:', trackErr)
      }

      return data as UserQuizAttempt
    } catch (err) {
      console.error('[learnStore] submitQuizAttempt:', err)
      return null
    } finally {
      set({ submittingQuiz: false })
    }
  },

  // ===== SKILL EXERCISES =====
  fetchLessonSkillExercises: async (lessonId: string) => {
    set({ loadingSkills: true })
    try {
      const { data: exercises, error } = await supabase
        .from('lesson_skill_exercises')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('is_published', true)
        .order('order_index', { ascending: true })

      if (error) throw error

      // Fetch progress for current user
      const { data: { user } } = await supabase.auth.getUser()
      let progressMap: Record<string, LessonSkillProgress> = {}

      if (user && exercises && exercises.length > 0) {
        const { data: progress } = await supabase
          .from('lesson_skill_progress')
          .select('*')
          .eq('user_id', user.id)
          .in('exercise_id', exercises.map(e => e.id))

        if (progress) {
          for (const p of progress) {
            progressMap[p.exercise_id] = p as LessonSkillProgress
          }
        }
      }

      set({
        skillExercises: (exercises || []) as LessonSkillExercise[],
        skillProgress: progressMap,
      })
    } catch (err) {
      console.error('[learnStore] fetchLessonSkillExercises:', err)
    } finally {
      set({ loadingSkills: false })
    }
  },

  saveSkillProgress: async (exerciseId: string, score: number, isCompleted: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const xpEarned = isCompleted ? Math.round(score / 10) * 5 : 0

      const { data: existing } = await supabase
        .from('lesson_skill_progress')
        .select('id, attempts, best_score')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('lesson_skill_progress')
          .update({
            score,
            is_completed: isCompleted || existing.best_score >= 60,
            attempts: existing.attempts + 1,
            best_score: Math.max(existing.best_score, score),
            xp_earned: xpEarned,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('lesson_skill_progress')
          .insert({
            user_id: user.id,
            exercise_id: exerciseId,
            score,
            is_completed: isCompleted,
            attempts: 1,
            best_score: score,
            xp_earned: xpEarned,
            last_attempt_at: new Date().toISOString(),
          })
      }

      // Award XP
      if (xpEarned > 0) {
        await useXpStore.getState().awardXp(xpEarned, 'skill_exercise', exerciseId)
        await useXpStore.getState().updateStreak()
      }

      // Refresh progress
      const lessonId = get().skillExercises.find(e => e.id === exerciseId)?.lesson_id
      if (lessonId) {
        await get().fetchLessonSkillExercises(lessonId)
      }
    } catch (err) {
      console.error('[learnStore] saveSkillProgress:', err)
    }
  },

}))
