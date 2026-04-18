import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import type {
  Course,
  UserLearningPath,
  PathCheckpoint,
  CourseWithProgress,
  RoadmapNode,
  CheckpointQuizResponse,
  CheckpointSubmitResponse,
} from '@/shared/types/database'

/* ===== Constants ===== */

const FOCUS_CATEGORY_ORDER: Record<string, string[]> = {
  general: ['Grammar', 'Vocabulary', 'Communication', 'Reading & Writing', 'Pronunciation'],
  communication: ['Communication', 'Pronunciation', 'Vocabulary', 'Grammar', 'Reading & Writing'],
  ielts: ['Grammar', 'Vocabulary', 'Reading & Writing', 'IELTS'],
  toeic: ['Grammar', 'Vocabulary', 'TOEIC'],
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const REVIEW_THRESHOLD_DAYS = 30
const MAX_REVIEW_DISPLAY = 3

/* ===== Store Interface ===== */

interface LearningPathState {
  path: UserLearningPath | null
  roadmap: RoadmapNode[]
  totalLessons: number
  completedLessons: number
  loading: boolean

  checkpointQuiz: CheckpointQuizResponse | null
  checkpointLoading: boolean
  checkpointSubmitting: boolean

  fetchPath: () => Promise<void>
  savePath: (currentLevel: string, targetLevel: string, focusArea: string) => Promise<void>
  resetPath: () => Promise<void>

  startCheckpoint: (courseIds: string[], label: string) => Promise<void>
  submitCheckpoint: (answers: Record<string, string>) => Promise<CheckpointSubmitResponse | null>
  closeCheckpoint: () => void

  generatePathCourses: (
    currentLevel: string,
    targetLevel: string,
    focusArea: string,
    allCourses: Course[],
  ) => (string | PathCheckpoint)[]
}

/* ===== Store ===== */

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  path: null,
  roadmap: [],
  totalLessons: 0,
  completedLessons: 0,
  loading: false,

  checkpointQuiz: null,
  checkpointLoading: false,
  checkpointSubmitting: false,

  /* ===== FETCH PATH ===== */
  fetchPath: async () => {
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: pathData } = await supabase
        .from('user_learning_paths')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!pathData) {
        set({ path: null, roadmap: [], totalLessons: 0, completedLessons: 0, loading: false })
        return
      }

      const path = pathData as unknown as UserLearningPath

      // Extract course IDs (skip checkpoint objects)
      const courseIds = (path.path_courses || []).filter(
        (item): item is string => typeof item === 'string'
      )

      if (courseIds.length === 0) {
        set({ path, roadmap: [], totalLessons: 0, completedLessons: 0, loading: false })
        return
      }

      // Load course details
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, difficulty_level, is_published, categories(name)')
        .in('id', courseIds)

      const validCourseIds = new Set(
        (courses || []).filter((c: any) => c.is_published).map((c: any) => c.id)
      )
      const courseMap = new Map<string, any>()
      for (const c of courses || []) courseMap.set(c.id, c)

      // RPC: batch progress
      const { data: progressData } = await supabase.rpc('get_path_progress', {
        p_user_id: user.id,
        p_course_ids: courseIds,
      })

      const progressMap = new Map<string, { total: number; completed: number; lastDate: string | null }>()
      for (const p of progressData || []) {
        progressMap.set(p.course_id, {
          total: Number(p.total_lessons),
          completed: Number(p.completed_lessons),
          lastDate: p.last_activity_date,
        })
      }

      // Checkpoint results
      const { data: checkpointResults } = await supabase
        .from('user_checkpoint_results')
        .select('*')
        .eq('user_id', user.id)
        .eq('passed', true)

      const passedCheckpoints = new Set(
        (checkpointResults || []).map((r: any) => r.checkpoint_label)
      )

      // Build roadmap
      const now = Date.now()
      const roadmap: RoadmapNode[] = []
      let totalLessons = 0
      let completedLessons = 0
      let foundNext = false
      let reviewCount = 0

      for (const item of path.path_courses) {
        if (typeof item === 'object' && item.type === 'checkpoint') {
          const checkpoint = item as PathCheckpoint
          const prevDone = checkpoint.courses.every(cid => {
            const p = progressMap.get(cid)
            return p && p.completed >= p.total && p.total > 0
          })

          let status: 'passed' | 'ready' | 'locked' = 'locked'
          if (passedCheckpoints.has(checkpoint.label)) status = 'passed'
          else if (prevDone) status = 'ready'

          roadmap.push({
            type: 'checkpoint',
            label: checkpoint.label,
            review_course_ids: checkpoint.courses,
            status,
          })
        } else if (typeof item === 'string') {
          if (!validCourseIds.has(item)) continue
          const course = courseMap.get(item)
          if (!course) continue

          const progress = progressMap.get(item)
          const total = progress?.total || 0
          const completed = progress?.completed || 0
          const lastDate = progress?.lastDate

          totalLessons += total
          completedLessons += completed

          let status: CourseWithProgress['status'] = 'not_started'
          if (total > 0 && completed >= total) {
            if (lastDate && reviewCount < MAX_REVIEW_DISPLAY) {
              const daysSince = (now - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
              if (daysSince > REVIEW_THRESHOLD_DAYS) {
                status = 'needs_review'
                reviewCount++
              } else {
                status = 'completed'
              }
            } else {
              status = 'completed'
            }
          } else if (completed > 0) {
            status = 'in_progress'
          }

          const isNext = !foundNext && status === 'not_started'
          if (isNext) foundNext = true

          roadmap.push({
            id: item,
            title: course.title,
            difficulty_level: course.difficulty_level || '',
            category_name: (course as any).categories?.name || '',
            total_lessons: total,
            completed_lessons: completed,
            last_activity_date: lastDate || null,
            status,
            is_next: isNext,
          })
        }
      }

      set({ path, roadmap, totalLessons, completedLessons })
    } catch (err) {
      console.error('[learningPathStore] fetchPath:', err)
    } finally {
      set({ loading: false })
    }
  },

  /* ===== SAVE PATH ===== */
  savePath: async (currentLevel, targetLevel, focusArea) => {
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: courses } = await supabase
        .from('courses')
        .select('*, categories(name)')
        .eq('is_published', true)
        .eq('is_personal', false)

      if (!courses) return

      const pathCourses = get().generatePathCourses(
        currentLevel, targetLevel, focusArea, courses as Course[]
      )

      const { error } = await supabase
        .from('user_learning_paths')
        .upsert({
          user_id: user.id,
          current_level: currentLevel,
          target_level: targetLevel,
          focus_area: focusArea,
          path_courses: pathCourses,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error
      await get().fetchPath()
    } catch (err) {
      console.error('[learningPathStore] savePath:', err)
    } finally {
      set({ loading: false })
    }
  },

  /* ===== RESET PATH ===== */
  resetPath: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_learning_paths').delete().eq('user_id', user.id)
      set({ path: null, roadmap: [], totalLessons: 0, completedLessons: 0 })
    } catch (err) {
      console.error('[learningPathStore] resetPath:', err)
    }
  },

  /* ===== CHECKPOINT QUIZ ===== */
  startCheckpoint: async (courseIds, label) => {
    set({ checkpointLoading: true, checkpointQuiz: null })
    try {
      const { data, error } = await supabase.functions.invoke('checkpoint-quiz', {
        body: { course_ids: courseIds, checkpoint_label: label },
      })
      if (error) throw error
      set({ checkpointQuiz: data as CheckpointQuizResponse })
    } catch (err) {
      console.error('[learningPathStore] startCheckpoint:', err)
    } finally {
      set({ checkpointLoading: false })
    }
  },

  submitCheckpoint: async (answers) => {
    const quiz = get().checkpointQuiz
    if (!quiz) return null
    set({ checkpointSubmitting: true })
    try {
      const { data, error } = await supabase.functions.invoke('checkpoint-quiz-submit', {
        body: { checkpoint_id: quiz.checkpoint_id, answers },
      })
      if (error) throw error
      const result = data as CheckpointSubmitResponse
      await get().fetchPath()
      return result
    } catch (err) {
      console.error('[learningPathStore] submitCheckpoint:', err)
      return null
    } finally {
      set({ checkpointSubmitting: false })
    }
  },

  closeCheckpoint: () => set({ checkpointQuiz: null }),

  /* ===== GENERATE PATH ===== */
  generatePathCourses: (currentLevel, targetLevel, focusArea, allCourses) => {
    const startIdx = CEFR_ORDER.indexOf(currentLevel)
    let endIdx = CEFR_ORDER.indexOf(targetLevel)
    if (startIdx === -1 || endIdx === -1) return []

    // Auto-adjust for IELTS/TOEIC
    if (focusArea === 'ielts') endIdx = Math.max(endIdx, CEFR_ORDER.indexOf('B2'))
    if (focusArea === 'toeic') endIdx = Math.max(endIdx, CEFR_ORDER.indexOf('B1'))

    const levels = CEFR_ORDER.slice(startIdx, endIdx + 1)
    const categoryOrder = FOCUS_CATEGORY_ORDER[focusArea] || FOCUS_CATEGORY_ORDER.general

    const result: (string | PathCheckpoint)[] = []
    let coursesSinceCheckpoint = 0

    for (const level of levels) {
      const levelCourses = allCourses
        .filter(c => c.difficulty_level === level && !c.is_personal)
        .filter(c => {
          const cat = (c as any).categories?.name || ''
          // For IELTS, below B2 only allow core categories
          if (focusArea === 'ielts' && CEFR_ORDER.indexOf(level) < CEFR_ORDER.indexOf('B2')) {
            return ['Grammar', 'Vocabulary', 'Reading & Writing'].includes(cat)
          }
          if (focusArea === 'toeic' && CEFR_ORDER.indexOf(level) < CEFR_ORDER.indexOf('B1')) {
            return ['Grammar', 'Vocabulary'].includes(cat)
          }
          // Skip IELTS/TOEIC category courses from CEFR levels — they go at the end
          if (cat === 'IELTS' || cat === 'TOEIC') return false
          return true
        })
        .sort((a, b) => {
          const catA = (a as any).categories?.name || ''
          const catB = (b as any).categories?.name || ''
          const idxA = categoryOrder.indexOf(catA)
          const idxB = categoryOrder.indexOf(catB)
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
        })

      for (const course of levelCourses) {
        result.push(course.id)
        coursesSinceCheckpoint++

        if (coursesSinceCheckpoint >= 3) {
          const recentIds = result.filter((item): item is string => typeof item === 'string').slice(-3)
          result.push({
            type: 'checkpoint',
            label: `Checkpoint ${level}-${Math.ceil(result.filter(i => typeof i === 'object').length)}`,
            courses: recentIds,
          })
          coursesSinceCheckpoint = 0
        }
      }
    }

    // Append IELTS/TOEIC specialty courses at the end
    const specialtyCat = focusArea === 'ielts' ? 'IELTS' : focusArea === 'toeic' ? 'TOEIC' : null
    if (specialtyCat) {
      const specialtyCourses = allCourses
        .filter(c => (c as any).categories?.name === specialtyCat && !c.is_personal)
        .sort((a, b) => a.order_index - b.order_index)

      for (const course of specialtyCourses) {
        if (!result.includes(course.id)) {
          result.push(course.id)
          coursesSinceCheckpoint++
          if (coursesSinceCheckpoint >= 3) {
            const recentIds = result.filter((item): item is string => typeof item === 'string').slice(-3)
            result.push({
              type: 'checkpoint',
              label: `${specialtyCat} Checkpoint ${Math.ceil(result.filter(i => typeof i === 'object').length)}`,
              courses: recentIds,
            })
            coursesSinceCheckpoint = 0
          }
        }
      }
    }

    return result
  },
}))
