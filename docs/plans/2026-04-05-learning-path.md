# Learning Path Implementation Plan

**Goal:** Cho phép user chọn trình độ + mục tiêu → hệ thống generate lộ trình khóa học cá nhân hóa với roadmap gamified, checkpoints, và review system.

**Architecture:** Feature module `learning-path` với Zustand store, 2 DB tables, 1 RPC function, 2 Edge Functions, và 4 UI components. Tất cả persistent trên Supabase.

**Tech Stack:** React + TypeScript, Zustand, Supabase (Postgres + Edge Functions), Lucide Icons, existing design system (glass-card, gradient-bg).

**Design Spec:** `docs/designs/2026-04-04-learning-path-design.md`

---

## Task 1: Database Migration — Tables + RPC

**Files:**
- Create: Migration via Supabase MCP

- [ ] **Step 1: Create `user_learning_paths` table**

```sql
CREATE TABLE public.user_learning_paths (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_level TEXT NOT NULL DEFAULT 'A1',
  target_level TEXT NOT NULL DEFAULT 'B2',
  focus_area TEXT NOT NULL DEFAULT 'general',
  path_courses JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own path" ON public.user_learning_paths
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own path" ON public.user_learning_paths
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own path" ON public.user_learning_paths
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own path" ON public.user_learning_paths
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Step 2: Create `user_checkpoint_results` table**

```sql
CREATE TABLE public.user_checkpoint_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checkpoint_label TEXT NOT NULL,
  course_ids JSONB NOT NULL,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_checkpoint_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own results" ON public.user_checkpoint_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own results" ON public.user_checkpoint_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 3: Create RPC `get_path_progress`**

```sql
CREATE OR REPLACE FUNCTION public.get_path_progress(p_user_id UUID, p_course_ids JSONB)
RETURNS TABLE(
  course_id UUID,
  total_lessons BIGINT,
  completed_lessons BIGINT,
  last_activity_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.course_id,
    COUNT(DISTINCT l.id) AS total_lessons,
    COUNT(DISTINCT CASE 
      WHEN uqa.id IS NOT NULL AND uqa.score >= (uqa.total_questions * 0.7) THEN l.id 
      ELSE NULL 
    END) AS completed_lessons,
    MAX(uqa.completed_at) AS last_activity_date
  FROM public.lessons l
  LEFT JOIN public.quizzes q ON q.lesson_id = l.id
  LEFT JOIN public.user_quiz_attempts uqa 
    ON uqa.quiz_id = q.id AND uqa.user_id = p_user_id
  WHERE l.course_id::TEXT IN (
    SELECT jsonb_array_elements_text(p_course_ids)
  )
  GROUP BY l.course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 4: Verify migrations**

Run: Query `user_learning_paths` and `user_checkpoint_results` to confirm they exist.

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/shared/types/database.ts`

- [ ] **Step 1: Add learning path types**

Append after `WritingCheck` interface (line ~323):

```typescript
/* ===== Learning Path Types ===== */

export interface UserLearningPath {
  id: string
  user_id: string
  current_level: string
  target_level: string
  focus_area: 'general' | 'communication' | 'ielts' | 'toeic'
  path_courses: (string | PathCheckpoint)[]
  created_at: string
  updated_at: string
}

export interface PathCheckpoint {
  type: 'checkpoint'
  label: string
  courses: string[]
}

export interface UserCheckpointResult {
  id: string
  user_id: string
  checkpoint_label: string
  course_ids: string[]
  score: number
  passed: boolean
  completed_at: string
}

/* Learning Path derived types (frontend only) */

export interface CourseWithProgress {
  id: string
  title: string
  difficulty_level: string
  category_name: string
  total_lessons: number
  completed_lessons: number
  last_activity_date: string | null
  status: 'completed' | 'needs_review' | 'in_progress' | 'not_started'
  is_next: boolean
}

export interface CheckpointNode {
  type: 'checkpoint'
  label: string
  review_course_ids: string[]
  status: 'passed' | 'ready' | 'locked'
}

export type RoadmapNode = CourseWithProgress | CheckpointNode

export interface CheckpointQuestion {
  id: string
  question_text: string
  question_type: string
  options: string[]
  source_course: string
}

export interface CheckpointQuizResponse {
  checkpoint_id: string
  questions: CheckpointQuestion[]
  total_questions: number
  passing_score: number
}

export interface CheckpointSubmitResponse {
  score: number
  passed: boolean
  results: { question_id: string; correct: boolean; correct_answer: string }[]
}
```

---

## Task 3: Zustand Store — `learningPathStore.ts`

**Files:**
- Create: `src/features/learning-path/stores/learningPathStore.ts`

- [ ] **Step 1: Create store with full implementation**

```typescript
import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import type {
  Course,
  UserLearningPath,
  PathCheckpoint,
  CourseWithProgress,
  CheckpointNode,
  RoadmapNode,
  UserCheckpointResult,
  CheckpointQuizResponse,
  CheckpointSubmitResponse,
} from '@/shared/types/database'

// Category priority maps for each focus area
const FOCUS_CATEGORY_ORDER: Record<string, string[]> = {
  general: ['Grammar', 'Vocabulary', 'Communication', 'Reading & Writing', 'Pronunciation'],
  communication: ['Communication', 'Pronunciation', 'Vocabulary', 'Grammar', 'Reading & Writing'],
  ielts: ['Grammar', 'Vocabulary', 'Reading & Writing', 'IELTS'],
  toeic: ['Grammar', 'Vocabulary', 'TOEIC'],
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const REVIEW_THRESHOLD_DAYS = 30
const MAX_REVIEW_DISPLAY = 3

interface LearningPathState {
  // State
  path: UserLearningPath | null
  roadmap: RoadmapNode[]
  totalLessons: number
  completedLessons: number
  loading: boolean

  // Checkpoint quiz state
  checkpointQuiz: CheckpointQuizResponse | null
  checkpointLoading: boolean
  checkpointSubmitting: boolean

  // Actions
  fetchPath: () => Promise<void>
  savePath: (currentLevel: string, targetLevel: string, focusArea: string) => Promise<void>
  resetPath: () => Promise<void>

  // Checkpoint
  startCheckpoint: (courseIds: string[], label: string) => Promise<void>
  submitCheckpoint: (answers: Record<string, string>) => Promise<CheckpointSubmitResponse | null>
  closeCheckpoint: () => void

  // Pure
  generatePathCourses: (
    currentLevel: string,
    targetLevel: string,
    focusArea: string,
    allCourses: Course[],
    completedCourseIds: string[]
  ) => (string | PathCheckpoint)[]
}

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  path: null,
  roadmap: [],
  totalLessons: 0,
  completedLessons: 0,
  loading: false,

  checkpointQuiz: null,
  checkpointLoading: false,
  checkpointSubmitting: false,

  // ===== FETCH PATH =====
  fetchPath: async () => {
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Load saved path
      const { data: pathData } = await supabase
        .from('user_learning_paths')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!pathData) {
        set({ path: null, roadmap: [], loading: false })
        return
      }

      const path = pathData as UserLearningPath

      // 2. Extract course IDs (skip checkpoint objects)
      const courseIds = (path.path_courses || []).filter(
        (item): item is string => typeof item === 'string'
      )

      if (courseIds.length === 0) {
        set({ path, roadmap: [], loading: false })
        return
      }

      // 3. Load course details
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, difficulty_level, category_id, is_published, categories(name)')
        .in('id', courseIds)

      // 4. Filter orphan IDs (courses deleted/unpublished)
      const validCourseIds = new Set(
        (courses || [])
          .filter((c: any) => c.is_published)
          .map((c: any) => c.id)
      )

      const courseMap = new Map<string, any>()
      for (const c of courses || []) {
        courseMap.set(c.id, c)
      }

      // 5. Load progress via RPC (single call)
      const { data: progressData } = await supabase.rpc('get_path_progress', {
        p_user_id: user.id,
        p_course_ids: JSON.stringify(courseIds),
      })

      const progressMap = new Map<string, { total: number; completed: number; lastDate: string | null }>()
      for (const p of progressData || []) {
        progressMap.set(p.course_id, {
          total: Number(p.total_lessons),
          completed: Number(p.completed_lessons),
          lastDate: p.last_activity_date,
        })
      }

      // 6. Load checkpoint results
      const { data: checkpointResults } = await supabase
        .from('user_checkpoint_results')
        .select('*')
        .eq('user_id', user.id)

      const passedCheckpoints = new Set(
        (checkpointResults || [])
          .filter((r: any) => r.passed)
          .map((r: any) => r.checkpoint_label)
      )

      // 7. Build roadmap nodes
      const now = Date.now()
      const roadmap: RoadmapNode[] = []
      let totalLessons = 0
      let completedLessons = 0
      let foundNext = false
      let reviewCount = 0

      for (const item of path.path_courses) {
        if (typeof item === 'object' && item.type === 'checkpoint') {
          // Checkpoint node
          const checkpoint = item as PathCheckpoint
          const prevCoursesCompleted = checkpoint.courses.every(cid => {
            const p = progressMap.get(cid)
            return p && p.completed >= p.total && p.total > 0
          })

          let status: 'passed' | 'ready' | 'locked' = 'locked'
          if (passedCheckpoints.has(checkpoint.label)) {
            status = 'passed'
          } else if (prevCoursesCompleted) {
            status = 'ready'
          }

          roadmap.push({
            type: 'checkpoint',
            label: checkpoint.label,
            review_course_ids: checkpoint.courses,
            status,
          })
        } else if (typeof item === 'string') {
          // Course node
          if (!validCourseIds.has(item)) continue

          const course = courseMap.get(item)
          if (!course) continue

          const progress = progressMap.get(item)
          const total = progress?.total || 0
          const completed = progress?.completed || 0
          const lastDate = progress?.lastDate

          totalLessons += total
          completedLessons += completed

          // Determine status
          let status: CourseWithProgress['status'] = 'not_started'
          if (total > 0 && completed >= total) {
            // Check if needs review (>30 days since last activity)
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

  // ===== SAVE PATH =====
  savePath: async (currentLevel, targetLevel, focusArea) => {
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch all published courses
      const { data: courses } = await supabase
        .from('courses')
        .select('*, categories(name)')
        .eq('is_published', true)
        .eq('is_personal', false)

      if (!courses) return

      // 2. Get user's completed course IDs
      const { data: attempts } = await supabase
        .from('user_quiz_attempts')
        .select('quiz_id, quizzes(lesson_id)')
        .eq('user_id', user.id)

      const completedCourseIds: string[] = []
      // Simple heuristic: if user has any attempt in a course, mark as started
      // (real completion is checked via progress)

      // 3. Generate path
      const pathCourses = get().generatePathCourses(
        currentLevel,
        targetLevel,
        focusArea,
        courses as Course[],
        completedCourseIds
      )

      // 4. Upsert
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

      // 5. Reload
      await get().fetchPath()
    } catch (err) {
      console.error('[learningPathStore] savePath:', err)
    } finally {
      set({ loading: false })
    }
  },

  // ===== RESET PATH =====
  resetPath: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('user_learning_paths')
        .delete()
        .eq('user_id', user.id)

      set({ path: null, roadmap: [], totalLessons: 0, completedLessons: 0 })
    } catch (err) {
      console.error('[learningPathStore] resetPath:', err)
    }
  },

  // ===== CHECKPOINT QUIZ =====
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
      // Refresh roadmap
      await get().fetchPath()
      return result
    } catch (err) {
      console.error('[learningPathStore] submitCheckpoint:', err)
      return null
    } finally {
      set({ checkpointSubmitting: false })
    }
  },

  closeCheckpoint: () => {
    set({ checkpointQuiz: null })
  },

  // ===== GENERATE PATH COURSES =====
  generatePathCourses: (currentLevel, targetLevel, focusArea, allCourses, _completedCourseIds) => {
    const startIdx = CEFR_ORDER.indexOf(currentLevel)
    const endIdx = CEFR_ORDER.indexOf(targetLevel)
    if (startIdx === -1 || endIdx === -1) return []

    const levels = CEFR_ORDER.slice(startIdx, endIdx + 1)
    const categoryOrder = FOCUS_CATEGORY_ORDER[focusArea] || FOCUS_CATEGORY_ORDER.general

    const result: (string | PathCheckpoint)[] = []
    let coursesSinceCheckpoint = 0

    for (const level of levels) {
      // Get courses for this level, sorted by category priority
      const levelCourses = allCourses
        .filter(c => c.difficulty_level === level && !c.is_personal)
        .sort((a, b) => {
          const catA = (a as any).categories?.name || ''
          const catB = (b as any).categories?.name || ''

          // Filter by focus: for ielts/toeic, skip non-related categories at certain levels
          const idxA = categoryOrder.indexOf(catA)
          const idxB = categoryOrder.indexOf(catB)
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
        })
        // For IELTS focus, at levels below B2 only include core categories
        .filter(c => {
          const cat = (c as any).categories?.name || ''
          if (focusArea === 'ielts' && CEFR_ORDER.indexOf(level) < CEFR_ORDER.indexOf('B2')) {
            return ['Grammar', 'Vocabulary', 'Reading & Writing'].includes(cat)
          }
          if (focusArea === 'toeic' && CEFR_ORDER.indexOf(level) < CEFR_ORDER.indexOf('B1')) {
            return ['Grammar', 'Vocabulary'].includes(cat)
          }
          return true
        })

      for (const course of levelCourses) {
        result.push(course.id)
        coursesSinceCheckpoint++

        // Insert checkpoint every 3 courses
        if (coursesSinceCheckpoint >= 3) {
          const recentIds = result
            .filter((item): item is string => typeof item === 'string')
            .slice(-3)

          result.push({
            type: 'checkpoint',
            label: `Checkpoint ${level}-${Math.ceil(result.length / 4)}`,
            courses: recentIds,
          })
          coursesSinceCheckpoint = 0
        }
      }
    }

    // Add IELTS/TOEIC specific courses at the end if focus matches
    if (focusArea === 'ielts') {
      const ieltsCourses = allCourses
        .filter(c => (c as any).categories?.name === 'IELTS' && !c.is_personal)
        .sort((a, b) => a.order_index - b.order_index)

      for (const course of ieltsCourses) {
        if (!result.includes(course.id)) {
          result.push(course.id)
          coursesSinceCheckpoint++
          if (coursesSinceCheckpoint >= 3) {
            const recentIds = result
              .filter((item): item is string => typeof item === 'string')
              .slice(-3)
            result.push({
              type: 'checkpoint',
              label: `IELTS Checkpoint ${Math.ceil(result.length / 4)}`,
              courses: recentIds,
            })
            coursesSinceCheckpoint = 0
          }
        }
      }
    }

    if (focusArea === 'toeic') {
      const toeicCourses = allCourses
        .filter(c => (c as any).categories?.name === 'TOEIC' && !c.is_personal)
        .sort((a, b) => a.order_index - b.order_index)

      for (const course of toeicCourses) {
        if (!result.includes(course.id)) {
          result.push(course.id)
          coursesSinceCheckpoint++
          if (coursesSinceCheckpoint >= 3) {
            const recentIds = result
              .filter((item): item is string => typeof item === 'string')
              .slice(-3)
            result.push({
              type: 'checkpoint',
              label: `TOEIC Checkpoint ${Math.ceil(result.length / 4)}`,
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
```

---

## Task 4: Edge Function — `checkpoint-quiz`

**Files:**
- Create: `supabase/functions/checkpoint-quiz/index.ts`

- [ ] **Step 1: Create checkpoint quiz generator**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { preCheckJwt } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Missing authorization', 401)
  
  const preCheck = preCheckJwt(authHeader)
  if (!preCheck.valid) return errorResponse(preCheck.reason, 401)

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return errorResponse('Invalid token', 401)

  const { course_ids, checkpoint_label } = await req.json()
  if (!course_ids || !Array.isArray(course_ids) || course_ids.length === 0) {
    return errorResponse('course_ids required')
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Get all quiz questions from these courses
  const { data: questions, error: qErr } = await adminClient
    .from('quiz_questions')
    .select(`
      id, question_text, question_type, options, correct_answer,
      quizzes!inner(lesson_id, lessons!inner(course_id, courses!inner(title)))
    `)
    .in('quizzes.lessons.course_id', course_ids)

  if (qErr || !questions || questions.length === 0) {
    return errorResponse('No questions found for these courses')
  }

  // 2. Get user's wrong answers (questions they got wrong before)
  const quizIds = [...new Set(questions.map((q: any) => q.quizzes?.id).filter(Boolean))]
  const { data: attempts } = await adminClient
    .from('user_quiz_attempts')
    .select('quiz_id, answers, score, total_questions')
    .eq('user_id', user.id)
    .in('quiz_id', quizIds)

  // Find question IDs the user answered incorrectly
  const wrongQuestionIds = new Set<string>()
  for (const attempt of attempts || []) {
    if (attempt.answers && attempt.score < attempt.total_questions * 0.7) {
      // This was a failed attempt — all questions in it are candidates
      for (const questionId of Object.keys(attempt.answers || {})) {
        wrongQuestionIds.add(questionId)
      }
    }
  }

  // 3. Split into pools
  const poolA = questions.filter((q: any) => wrongQuestionIds.has(q.id))
  const poolB = questions.filter((q: any) => !wrongQuestionIds.has(q.id))

  // 4. Pick questions: prioritize wrong, ensure balance across courses
  const TARGET_TOTAL = 15
  const perCourse = Math.max(3, Math.floor(TARGET_TOTAL / course_ids.length))
  
  const selectedIds = new Set<string>()
  const selected: any[] = []

  // Helper to get course title from question
  const getCourseTitle = (q: any) => (q as any).quizzes?.lessons?.courses?.title || 'Unknown'
  const getCourseId = (q: any) => (q as any).quizzes?.lessons?.course_id

  // First pass: pick wrong answers, balanced per course
  for (const courseId of course_ids) {
    const courseWrong = poolA.filter((q: any) => getCourseId(q) === courseId)
    const shuffled = courseWrong.sort(() => Math.random() - 0.5)
    for (const q of shuffled.slice(0, perCourse)) {
      if (selected.length >= TARGET_TOTAL) break
      selectedIds.add(q.id)
      selected.push(q)
    }
  }

  // Second pass: fill remaining from poolB, balanced
  for (const courseId of course_ids) {
    const courseRight = poolB.filter((q: any) => getCourseId(q) === courseId && !selectedIds.has(q.id))
    const shuffled = courseRight.sort(() => Math.random() - 0.5)
    const needed = Math.max(0, perCourse - selected.filter(q => getCourseId(q) === courseId).length)
    for (const q of shuffled.slice(0, needed)) {
      if (selected.length >= TARGET_TOTAL) break
      selectedIds.add(q.id)
      selected.push(q)
    }
  }

  // Final fill if still under target
  const remaining = [...poolA, ...poolB]
    .filter(q => !selectedIds.has(q.id))
    .sort(() => Math.random() - 0.5)
  for (const q of remaining) {
    if (selected.length >= TARGET_TOTAL) break
    selected.push(q)
  }

  // 5. Shuffle and format (WITHOUT correct_answer!)
  const shuffledQuestions = selected
    .sort(() => Math.random() - 0.5)
    .map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options || [],
      source_course: getCourseTitle(q),
    }))

  // 6. Store checkpoint session in memory (via checkpoint_id)
  const checkpointId = crypto.randomUUID()

  // Save checkpoint session temporarily (correct answers for grading)
  await adminClient
    .from('user_checkpoint_results')
    .insert({
      id: checkpointId,
      user_id: user.id,
      checkpoint_label: checkpoint_label || 'Checkpoint',
      course_ids: course_ids,
      score: -1,  // pending
      passed: false,
    })

  return jsonResponse({
    checkpoint_id: checkpointId,
    questions: shuffledQuestions,
    total_questions: shuffledQuestions.length,
    passing_score: 70,
    // Store answer key serverside for grading
    _answer_key_stored: true,
  })
})
```

- [ ] **Step 2: Deploy edge function**

Deploy via Supabase MCP.

---

## Task 5: Edge Function — `checkpoint-quiz-submit`

**Files:**
- Create: `supabase/functions/checkpoint-quiz-submit/index.ts`

- [ ] **Step 1: Create checkpoint quiz submit handler**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { preCheckJwt } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Missing authorization', 401)
  
  const preCheck = preCheckJwt(authHeader)
  if (!preCheck.valid) return errorResponse(preCheck.reason, 401)

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return errorResponse('Invalid token', 401)

  const { checkpoint_id, answers } = await req.json()
  if (!checkpoint_id || !answers) {
    return errorResponse('checkpoint_id and answers required')
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Get the question IDs from answers
  const questionIds = Object.keys(answers)

  // 2. Fetch correct answers from DB
  const { data: questions, error: qErr } = await adminClient
    .from('quiz_questions')
    .select('id, correct_answer')
    .in('id', questionIds)

  if (qErr || !questions) {
    return errorResponse('Failed to fetch answers')
  }

  // 3. Grade
  const answerMap = new Map(questions.map((q: any) => [q.id, q.correct_answer]))
  const results: { question_id: string; correct: boolean; correct_answer: string }[] = []
  let correctCount = 0

  for (const [qId, userAnswer] of Object.entries(answers)) {
    const correctAnswer = answerMap.get(qId) || ''
    const isCorrect = String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()
    if (isCorrect) correctCount++
    results.push({
      question_id: qId,
      correct: isCorrect,
      correct_answer: correctAnswer,
    })
  }

  const totalQuestions = questionIds.length
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
  const passed = score >= 70

  // 4. Update checkpoint result
  await adminClient
    .from('user_checkpoint_results')
    .update({ score, passed, completed_at: new Date().toISOString() })
    .eq('id', checkpoint_id)
    .eq('user_id', user.id)

  return jsonResponse({ score, passed, results })
})
```

- [ ] **Step 2: Deploy edge function**

Deploy via Supabase MCP.

---

## Task 6: UI — PathWizard Component

**Files:**
- Create: `src/features/learning-path/components/PathWizard.tsx`

- [ ] **Step 1: Create 3-step wizard component**

Full wizard with steps for current level, target level, and focus area selection. Uses glass-card design, gradient progress bar, animated transitions.

Key features:
- Step 1: 6 CEFR level cards (A1-C2) with descriptions
- Step 2: Target level cards (only levels > current)
- Step 3: 4 focus area cards with icons
- Auto-adjust: IELTS → min B2, TOEIC → min B1
- C2 + general → show message "Bạn đã ở level cao nhất!"
- C2 + ielts/toeic → skip step 2, target = C2
- Loading state on "Tạo lộ trình" button

---

## Task 7: UI — PathRoadmap Component

**Files:**
- Create: `src/features/learning-path/components/PathRoadmap.tsx`

- [ ] **Step 1: Create timeline roadmap component**

Vertical timeline with:
- Header card: level range + focus + lesson-based progress bar + "Đổi lộ trình" button
- Level separator badges
- Collapsible completed levels
- 4 course node states (completed/needs_review/in_progress/not_started)
- Next Up highlight (bright + CTA)
- Checkpoint nodes (gold border, lock/ready/passed states)
- Click course → navigate to `/courses/:courseId`

---

## Task 8: UI — CheckpointQuizModal Component

**Files:**
- Create: `src/features/learning-path/components/CheckpointQuizModal.tsx`

- [ ] **Step 1: Create quiz overlay modal**

Full-screen modal overlay on top of roadmap:
- Loading state "Đang tạo bài kiểm tra..."
- One question per screen, progress bar "Câu 3/15"
- Source course badge per question
- Next/Previous navigation
- Submit → show results (score, pass/fail, correct answers)
- Pass → close modal, roadmap refreshes
- Fail → "Thử lại" button (re-generates quiz)

---

## Task 9: UI — PathDashboardCard Component

**Files:**
- Create: `src/features/learning-path/components/PathDashboardCard.tsx`

- [ ] **Step 1: Create dashboard integration card**

Two modes:
- **No path:** Gradient banner CTA "🗺️ Thiết lập lộ trình học!" + "Chọn lộ trình →" button
- **Has path:** Compact glass-card with level range, lesson progress bar, next course, review count warning

---

## Task 10: UI — Main Page + Integration

**Files:**
- Create: `src/features/learning-path/pages/LearningPathPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/shared/components/layout/Sidebar.tsx`
- Modify: `src/shared/components/layout/MobileNav.tsx`
- Modify: `src/features/dashboard/pages/DashboardPage.tsx`

- [ ] **Step 1: Create LearningPathPage**

```typescript
// Simple page that fetches path and renders Wizard or Roadmap
import { useEffect } from 'react'
import { useLearningPathStore } from '../stores/learningPathStore'
import { PathWizard } from '../components/PathWizard'
import { PathRoadmap } from '../components/PathRoadmap'
import { CheckpointQuizModal } from '../components/CheckpointQuizModal'

export function LearningPathPage() {
  const { path, loading, fetchPath, checkpointQuiz } = useLearningPathStore()

  useEffect(() => {
    fetchPath()
  }, [fetchPath])

  if (loading) return <LoadingSpinner />

  return (
    <div className="animate-fade-in">
      {path ? <PathRoadmap /> : <PathWizard />}
      {checkpointQuiz && <CheckpointQuizModal />}
    </div>
  )
}
```

- [ ] **Step 2: Add route to App.tsx**

Add import and Route for `/learning-path`.

- [ ] **Step 3: Update Sidebar.tsx**

Add `{ path: '/learning-path', label: 'Lộ trình', icon: Map }` after Home.

- [ ] **Step 4: Update MobileNav.tsx**

Add Map icon to `moreItems` array.

- [ ] **Step 5: Update DashboardPage.tsx**

Import and render `PathDashboardCard` between Welcome Header and Quick Actions sections.

---

## Task 11: CSS Animations

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add roadmap-specific animations**

```css
/* Learning Path Roadmap animations */
@keyframes nodePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
}

@keyframes nodeGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.3); }
  50% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.5); }
}

.animate-node-pulse {
  animation: nodePulse 2s ease-in-out infinite;
}

.animate-node-glow {
  animation: nodeGlow 2s ease-in-out infinite;
}
```

---

## Task 12: Verify & Deploy

- [ ] **Step 1: Build project**

Run: `npm run build`
Expected: No TypeScript errors, clean build.

- [ ] **Step 2: Test wizard flow in browser**

1. Open /learning-path → Wizard appears
2. Select A2 → B2 → General → "Tạo lộ trình"
3. Roadmap appears with courses + checkpoints
4. Reload → roadmap persists

- [ ] **Step 3: Test checkpoint flow**

1. Navigate to a ready checkpoint
2. Click "Kiểm tra →" → Quiz modal opens
3. Answer questions → Submit → Results show
4. Pass → checkpoint turns green

- [ ] **Step 4: Test dashboard card**

1. Open Dashboard → Banner CTA visible (if no path)
2. After creating path → Compact card with progress

- [ ] **Step 5: Deploy**

Run: `npm run deploy` (if applicable)
