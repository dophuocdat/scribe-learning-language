# Course Skills Integration — Implementation Plan

**Goal:** Thêm luyện 4 kỹ năng (Nghe, Nói, Đọc, Viết) vào mỗi lesson trong hệ thống courses hiện tại. Bài tập được admin pre-generate bằng AI dựa trên nội dung lesson, lưu DB, user mở ra làm ngay.

**Architecture:** Thêm 2 bảng mới (`lesson_skill_exercises`, `lesson_skill_progress`), 1 tab mới trong `LessonStudyPage`, 2 component mới (`SkillPracticeGrid`, `SkillExercisePlayer`), 1 endpoint mới trong `writing-api`. Exercise components tái sử dụng 100% từ 4 skill modules bằng cơ chế "Store Injection" — set data vào store trước khi render component.

**Tech Stack:** React + Vite, Zustand stores, Supabase PostgreSQL + Edge Functions, Gemini API

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260404_lesson_skill_exercises.sql`

- [ ] **Step 1: Create migration file**

```sql
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
```

- [ ] **Step 2: Run migration in Supabase**

Run: Apply the SQL via Supabase dashboard (SQL Editor) or `supabase db push`
Expected: Tables created successfully, indexes visible

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260404_lesson_skill_exercises.sql
git commit -m "feat: add lesson_skill_exercises and progress tables"
```

---

### Task 2: Extend learnStore with Skill Exercise Actions

**Files:**
- Modify: `src/features/learn/stores/learnStore.ts`

- [ ] **Step 1: Add types for skill exercises**

Add these interfaces before the `LearnState` interface:

```typescript
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
```

- [ ] **Step 2: Add state and actions to LearnState interface**

Add to the interface:

```typescript
// Skill exercises
skillExercises: LessonSkillExercise[]
skillProgress: Record<string, LessonSkillProgress>
loadingSkills: boolean

// Skill exercise actions
fetchLessonSkillExercises: (lessonId: string) => Promise<void>
saveSkillProgress: (exerciseId: string, score: number, isCompleted: boolean) => Promise<void>
```

- [ ] **Step 3: Implement the actions**

Add to the store body (after `submitQuizAttempt`):

```typescript
skillExercises: [],
skillProgress: {},
loadingSkills: false,

fetchLessonSkillExercises: async (lessonId: string) => {
  set({ loadingSkills: true })
  try {
    const { data: exercises, error } = await supabase
      .from('lesson_skill_exercises')
      .select('*')
      .eq('lesson_id', lessonId)
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
    await get().fetchLessonSkillExercises(
      get().skillExercises.find(e => e.id === exerciseId)?.lesson_id || ''
    )
  } catch (err) {
    console.error('[learnStore] saveSkillProgress:', err)
  }
},
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/learn/stores/learnStore.ts
git commit -m "feat: add skill exercise fetch and progress actions to learnStore"
```

---

### Task 3: SkillPracticeGrid Component

**Files:**
- Create: `src/features/learn/components/SkillPracticeGrid.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useEffect, useState } from 'react'
import { Headphones, Mic, BookOpenText, PenTool, Check, Loader2, ArrowLeft } from 'lucide-react'
import { useLearnStore, type LessonSkillExercise, type SkillType } from '../stores/learnStore'
import { SkillExercisePlayer } from './SkillExercisePlayer'

const SKILL_CONFIG: Record<SkillType, {
  label: string
  icon: typeof Headphones
  gradient: string
  color: string
  bgLight: string
}> = {
  listening: {
    label: 'Nghe',
    icon: Headphones,
    gradient: 'from-violet-500 to-blue-500',
    color: 'text-violet-400',
    bgLight: 'bg-violet-500/10',
  },
  speaking: {
    label: 'Nói',
    icon: Mic,
    gradient: 'from-rose-500 to-orange-500',
    color: 'text-rose-400',
    bgLight: 'bg-rose-500/10',
  },
  reading: {
    label: 'Đọc',
    icon: BookOpenText,
    gradient: 'from-emerald-500 to-teal-500',
    color: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10',
  },
  writing: {
    label: 'Viết',
    icon: PenTool,
    gradient: 'from-amber-500 to-yellow-500',
    color: 'text-amber-400',
    bgLight: 'bg-amber-500/10',
  },
}

const SKILL_ORDER: SkillType[] = ['listening', 'speaking', 'reading', 'writing']

interface SkillPracticeGridProps {
  lessonId: string
}

export function SkillPracticeGrid({ lessonId }: SkillPracticeGridProps) {
  const { skillExercises, skillProgress, loadingSkills, fetchLessonSkillExercises } = useLearnStore()
  const [activeExercise, setActiveExercise] = useState<LessonSkillExercise | null>(null)

  useEffect(() => {
    fetchLessonSkillExercises(lessonId)
  }, [lessonId, fetchLessonSkillExercises])

  // Group exercises by skill
  const exercisesBySkill: Record<SkillType, LessonSkillExercise[]> = {
    listening: [], speaking: [], reading: [], writing: [],
  }
  for (const ex of skillExercises) {
    if (exercisesBySkill[ex.skill as SkillType]) {
      exercisesBySkill[ex.skill as SkillType].push(ex)
    }
  }

  if (activeExercise) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => {
            setActiveExercise(null)
            fetchLessonSkillExercises(lessonId) // refresh progress
          }}
          className="inline-flex items-center gap-1.5 text-sm text-surface-200/40 hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại 4 kỹ năng
        </button>
        <SkillExercisePlayer
          exercise={activeExercise}
          onComplete={() => {
            setActiveExercise(null)
            fetchLessonSkillExercises(lessonId)
          }}
        />
      </div>
    )
  }

  if (loadingSkills) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-surface-800/60" />
            <div className="h-4 w-16 rounded bg-surface-800/60" />
            <div className="h-2 w-full rounded bg-surface-800/60" />
          </div>
        ))}
      </div>
    )
  }

  if (skillExercises.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Headphones className="w-10 h-10 text-surface-200/20 mx-auto mb-3" />
        <p className="text-sm text-surface-200/40">
          Bài học này chưa có bài luyện 4 kỹ năng
        </p>
        <p className="text-xs text-surface-200/25 mt-1">
          Admin có thể tạo bài tập từ trang quản trị
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-200/40">
        Luyện tập dựa trên nội dung bài học. Nhấn vào kỹ năng để bắt đầu.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {SKILL_ORDER.map(skill => {
          const config = SKILL_CONFIG[skill]
          const Icon = config.icon
          const exercises = exercisesBySkill[skill]

          if (exercises.length === 0) {
            return (
              <div key={skill} className="glass-card p-5 opacity-40 cursor-not-allowed">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bgLight} mb-2`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
                <p className="text-[10px] text-surface-200/30 mt-1">Chưa có bài tập</p>
              </div>
            )
          }

          // Calculate progress for this skill
          const completedCount = exercises.filter(ex => skillProgress[ex.id]?.is_completed).length
          const bestScore = exercises.reduce((max, ex) => {
            const prog = skillProgress[ex.id]
            return prog?.best_score ? Math.max(max, prog.best_score) : max
          }, 0)
          const isAllDone = completedCount === exercises.length

          return (
            <button
              key={skill}
              onClick={() => setActiveExercise(exercises[0])}
              className={`glass-card p-5 text-left group transition-all hover:border-primary-500/30 ${isAllDone ? 'border-success/20' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isAllDone
                    ? `bg-gradient-to-br ${config.gradient} shadow-lg`
                    : `${config.bgLight} group-hover:bg-gradient-to-br group-hover:${config.gradient}`
                }`}>
                  <Icon className={`w-5 h-5 ${isAllDone ? 'text-white' : config.color + ' group-hover:text-white'}`} />
                </div>
                {isAllDone && (
                  <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-surface-800/50 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                  style={{ width: `${exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-surface-200/30">
                  {completedCount}/{exercises.length} bài
                </span>
                {bestScore > 0 && (
                  <span className={`text-[10px] font-bold ${bestScore >= 80 ? 'text-success' : bestScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                    {bestScore}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/features/learn/components/SkillPracticeGrid.tsx
git commit -m "feat: add SkillPracticeGrid component with 4 skill cards"
```

---

### Task 4: SkillExercisePlayer Component (Store Injection)

**Files:**
- Create: `src/features/learn/components/SkillExercisePlayer.tsx`

- [ ] **Step 1: Create the player component**

This is the core "Store Injection" mechanism. Before rendering existing exercise components, it injects data into their zustand stores so they render with pre-saved content from DB instead of AI-generated content.

```typescript
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Loader2 } from 'lucide-react'
import type { LessonSkillExercise } from '../stores/learnStore'
import { useLearnStore } from '../stores/learnStore'

// Import stores for injection
import { useListeningStore } from '@/features/listening/stores/listeningStore'
import { useSpeakingStore } from '@/features/speaking/stores/speakingStore'
import { useReadingStore } from '@/features/reading/stores/readingStore'
import { useWritingStore } from '@/features/writing/stores/writingStore'

// Import exercise components
import { DictationExercise } from '@/features/listening/components/DictationExercise'
import { FillBlankExercise } from '@/features/listening/components/FillBlankExercise'
import { DialogueExercise } from '@/features/listening/components/DialogueExercise'
import { DictationResult } from '@/features/listening/components/DictationResult'
import { FillBlankResult } from '@/features/listening/components/FillBlankResult'
import { DialogueResult } from '@/features/listening/components/DialogueResult'

import { PronunciationExercise } from '@/features/speaking/components/PronunciationExercise'
import { ShadowingExercise } from '@/features/speaking/components/ShadowingExercise'
import { PronunciationResult } from '@/features/speaking/components/PronunciationResult'
import { ShadowingResult } from '@/features/speaking/components/ShadowingResult'

import { LevelReading } from '@/features/reading/components/LevelReading'
import { ReadingQuestions } from '@/features/reading/components/ReadingQuestions'
import { ReadingAloud } from '@/features/reading/components/ReadingAloud'
import { ReadingResult } from '@/features/reading/components/ReadingResult'
import { ReadingAloudResult } from '@/features/reading/components/ReadingAloudResult'

import { SentenceBuilding } from '@/features/writing/components/SentenceBuilding'
import { ParaphraseExercise } from '@/features/writing/components/ParaphraseExercise'
import { EssayWriting } from '@/features/writing/components/EssayWriting'
import { SentenceBuildingResult } from '@/features/writing/components/SentenceBuildingResult'
import { ParaphraseResult } from '@/features/writing/components/ParaphraseResult'
import { EssayFeedback } from '@/features/writing/components/EssayFeedback'

interface SkillExercisePlayerProps {
  exercise: LessonSkillExercise
  onComplete: () => void
}

export function SkillExercisePlayer({ exercise, onComplete }: SkillExercisePlayerProps) {
  const { saveSkillProgress } = useLearnStore()
  const [saved, setSaved] = useState(false)
  const injectedRef = useRef(false)

  // Inject exercise content into the appropriate store
  useEffect(() => {
    injectedRef.current = false

    if (exercise.skill === 'listening') {
      useListeningStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        result: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'speaking') {
      useSpeakingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        result: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'reading') {
      useReadingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'reading',
        result: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'writing') {
      useWritingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        evalResult: null,
        error: null,
        batchItems: [exercise.content],
        currentBatchIndex: 0,
      })
    }

    injectedRef.current = true
    setSaved(false)

    return () => {
      // Cleanup: reset stores on unmount
      if (exercise.skill === 'listening') {
        useListeningStore.setState({ phase: 'config', content: null, result: null })
      } else if (exercise.skill === 'speaking') {
        useSpeakingStore.setState({ phase: 'config', content: null, result: null })
      } else if (exercise.skill === 'reading') {
        useReadingStore.setState({ phase: 'config', content: null, result: null })
      } else if (exercise.skill === 'writing') {
        useWritingStore.setState({ phase: 'config', content: null, evalResult: null })
      }
    }
  }, [exercise])

  // Watch for result phase to save progress
  const listeningPhase = useListeningStore(s => s.phase)
  const listeningResult = useListeningStore(s => s.result)
  const speakingPhase = useSpeakingStore(s => s.phase)
  const speakingResult = useSpeakingStore(s => s.result)
  const readingPhase = useReadingStore(s => s.phase)
  const readingResult = useReadingStore(s => s.result)
  const writingPhase = useWritingStore(s => s.phase)
  const writingResult = useWritingStore(s => s.evalResult)

  useEffect(() => {
    if (saved || !injectedRef.current) return

    let score = 0
    let hasResult = false

    if (exercise.skill === 'listening' && listeningPhase === 'result' && listeningResult) {
      score = (listeningResult as any).score || (listeningResult as any).accuracy || 0
      hasResult = true
    } else if (exercise.skill === 'speaking' && speakingPhase === 'result' && speakingResult) {
      score = (speakingResult as any).score || (speakingResult as any).overall_score || 0
      hasResult = true
    } else if (exercise.skill === 'reading' && readingPhase === 'result' && readingResult) {
      score = (readingResult as any).score || (readingResult as any).accuracy || 0
      hasResult = true
    } else if (exercise.skill === 'writing' && writingPhase === 'result' && writingResult) {
      score = (writingResult as any).overall_score || (writingResult as any).xp_earned ? 80 : 0
      if ((writingResult as any).is_correct) score = 100
      hasResult = true
    }

    if (hasResult) {
      setSaved(true)
      saveSkillProgress(exercise.id, score, score >= 50)
    }
  }, [exercise, saved, listeningPhase, listeningResult, speakingPhase, speakingResult, readingPhase, readingResult, writingPhase, writingResult, saveSkillProgress])

  // Render exercise + result component based on skill + mode
  const renderExercise = () => {
    const { skill, mode } = exercise

    if (skill === 'listening') {
      if (listeningPhase === 'result') {
        if (mode === 'dictation') return <DictationResult />
        if (mode === 'fill_blank') return <FillBlankResult />
        if (mode === 'dialogue') return <DialogueResult />
      }
      if (mode === 'dictation') return <DictationExercise />
      if (mode === 'fill_blank') return <FillBlankExercise />
      if (mode === 'dialogue') return <DialogueExercise />
    }

    if (skill === 'speaking') {
      if (speakingPhase === 'result') {
        if (mode === 'pronunciation') return <PronunciationResult />
        if (mode === 'shadowing') return <ShadowingResult />
      }
      if (mode === 'pronunciation') return <PronunciationExercise />
      if (mode === 'shadowing') return <ShadowingExercise />
    }

    if (skill === 'reading') {
      if (readingPhase === 'result') {
        if (mode === 'level_reading') return <ReadingResult />
        if (mode === 'reading_aloud') return <ReadingAloudResult />
      }
      if (readingPhase === 'questions') return <ReadingQuestions />
      if (mode === 'level_reading') return <LevelReading />
      if (mode === 'reading_aloud') return <ReadingAloud />
    }

    if (skill === 'writing') {
      if (writingPhase === 'result') {
        if (mode === 'sentence_building') return <SentenceBuildingResult />
        if (mode === 'paraphrase') return <ParaphraseResult />
        if (mode === 'essay') return <EssayFeedback />
      }
      if (mode === 'sentence_building') return <SentenceBuilding />
      if (mode === 'paraphrase') return <ParaphraseExercise />
      if (mode === 'essay') return <EssayWriting />
    }

    return <p className="text-sm text-surface-200/40">Không hỗ trợ loại bài tập: {skill}/{mode}</p>
  }

  // Check if in result phase
  const isResultPhase =
    (exercise.skill === 'listening' && listeningPhase === 'result') ||
    (exercise.skill === 'speaking' && speakingPhase === 'result') ||
    (exercise.skill === 'reading' && readingPhase === 'result') ||
    (exercise.skill === 'writing' && writingPhase === 'result')

  return (
    <div className="space-y-4">
      {/* Exercise title */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold text-surface-50">{exercise.title_vi || exercise.title}</h3>
        {exercise.instruction_vi && (
          <p className="text-xs text-surface-200/50 mt-1">{exercise.instruction_vi}</p>
        )}
      </div>

      {/* Exercise component */}
      {renderExercise()}

      {/* Post-result actions */}
      {isResultPhase && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={onComplete}
            className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
          >
            <ArrowRight className="w-4 h-4" />
            Quay lại
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/features/learn/components/SkillExercisePlayer.tsx
git commit -m "feat: add SkillExercisePlayer with store injection mechanism"
```

---

### Task 5: Add "Luyện kỹ năng" Tab to LessonStudyPage

**Files:**
- Modify: `src/features/learn/pages/LessonStudyPage.tsx`

- [ ] **Step 1: Add the new tab**

Add import at top:
```typescript
import { Headphones } from 'lucide-react'
import { SkillPracticeGrid } from '../components/SkillPracticeGrid'
```

Update `Tab` type:
```typescript
type Tab = 'content' | 'vocabulary' | 'quiz' | 'skills'
```

Add the tab to the `tabs` array:
```typescript
{ key: 'skills', label: 'Luyện kỹ năng', icon: <Headphones className="w-4 h-4" /> },
```

Add tab content after the quiz tab section:
```typescript
{/* Skills Tab */}
{activeTab === 'skills' && currentLesson && (
  <SkillPracticeGrid lessonId={currentLesson.id} />
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Test in browser**

Run: `npm run dev`
Expected: Open a lesson → see 4 tabs including "Luyện kỹ năng" → click tab shows grid or empty state

- [ ] **Step 4: Commit**

```bash
git add src/features/learn/pages/LessonStudyPage.tsx
git commit -m "feat: add 'Luyện kỹ năng' tab to LessonStudyPage"
```

---

### Task 6: Edge Function — generate-lesson-skills Endpoint

**Files:**
- Modify: `supabase/functions/writing-api/index.ts`

- [ ] **Step 1: Add generate-lesson-skills handler function**

Add after last handler function (before `Deno.serve`):

```typescript
async function handleGenerateLessonSkills(req: Request, userId: string) {
  const { lesson_id, skills_count } = await req.json()
  if (!lesson_id) return errorResponse('Missing lesson_id')

  const serviceClient = getServiceClient()

  // Fetch lesson content + vocabulary
  const { data: lesson, error: lessonErr } = await serviceClient
    .from('lessons')
    .select('id, title, raw_content, processed_content, ai_summary')
    .eq('id', lesson_id)
    .single()

  if (lessonErr || !lesson) return errorResponse('Lesson not found', 404)

  const { data: vocabulary } = await serviceClient
    .from('vocabulary')
    .select('word, definition_vi, definition_en, example_sentence, part_of_speech')
    .eq('lesson_id', lesson_id)
    .limit(50)

  const lessonContent = lesson.processed_content || lesson.raw_content || ''
  const vocabList = (vocabulary || []).map(v => `${v.word} (${v.part_of_speech || ''}): ${v.definition_vi || v.definition_en || ''}`).join('\n')
  const counts = skills_count || { listening: 1, speaking: 1, reading: 1, writing: 1 }

  console.log(`[writing-api] Generate lesson skills for: ${lesson.title}, vocab: ${vocabulary?.length || 0}`)

  const results: { skill: string; mode: string; title: string; title_vi: string; content: unknown }[] = []

  // Generate Listening exercise
  for (let i = 0; i < (counts.listening || 1); i++) {
    try {
      const prompt = `You are an English language teacher creating a DICTATION listening exercise.
CONTEXT: This exercise is based on a lesson titled "${lesson.title}".
LESSON CONTENT (use vocabulary and themes from this):
${lessonContent.substring(0, 2000)}

VOCABULARY TO INCLUDE:
${vocabList.substring(0, 1000)}

TASK: Create a dictation exercise using 2-4 vocabulary words from the list above in a natural sentence.

Return JSON:
{
  "text": "English sentence using lesson vocabulary (10-20 words)",
  "translation_vi": "Vietnamese translation",
  "word_count": 15,
  "difficulty_note_vi": "Short note about difficulty",
  "key_vocabulary": [{ "word": "word", "meaning_vi": "meaning" }]
}`
      const raw = await callGemini(prompt, 4096)
      const content = extractJson(raw)
      results.push({
        skill: 'listening',
        mode: 'dictation',
        title: `Listening: ${lesson.title}`,
        title_vi: `Nghe: ${lesson.title}`,
        content,
      })
    } catch (err) {
      console.error('[writing-api] Listening generation failed:', err)
    }
  }

  // Generate Speaking exercise
  for (let i = 0; i < (counts.speaking || 1); i++) {
    try {
      const prompt = `You are an English pronunciation coach creating a PRONUNCIATION exercise.
CONTEXT: Based on lesson "${lesson.title}".
VOCABULARY:
${vocabList.substring(0, 1000)}

TASK: Create a pronunciation practice sentence using 2-3 vocabulary words from the lesson.

Return JSON:
{
  "sentence": "English sentence for pronunciation practice",
  "sentence_vi": "Vietnamese translation",
  "phonetic_guide": "/IPA transcription/",
  "key_sounds": [{ "sound": "th", "tip_vi": "Pronunciation tip in Vietnamese", "ipa": "/θ/" }],
  "difficulty_note_vi": "Note about pronunciation difficulty"
}`
      const raw = await callGemini(prompt, 4096)
      const content = extractJson(raw)
      results.push({
        skill: 'speaking',
        mode: 'pronunciation',
        title: `Speaking: ${lesson.title}`,
        title_vi: `Nói: ${lesson.title}`,
        content,
      })
    } catch (err) {
      console.error('[writing-api] Speaking generation failed:', err)
    }
  }

  // Generate Reading exercise
  for (let i = 0; i < (counts.reading || 1); i++) {
    try {
      const prompt = `You are an English teacher creating a READING COMPREHENSION exercise.
CONTEXT: Based on lesson "${lesson.title}".
LESSON CONTENT:
${lessonContent.substring(0, 2000)}
VOCABULARY:
${vocabList.substring(0, 1000)}

TASK: Create a short reading passage (100-200 words) related to the lesson topic, with 3-4 comprehension questions.

Return JSON:
{
  "title": "Article title",
  "content": "Reading passage text (100-200 words) using lesson vocabulary",
  "word_count": 150,
  "questions": [
    { "question": "Question text", "type": "mcq", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation_vi": "Explanation" }
  ],
  "vocabulary": [{ "word": "word", "meaning_vi": "meaning", "ipa": "/ipa/", "part_of_speech": "noun", "example": "example sentence" }]
}`
      const raw = await callGemini(prompt, 8192)
      const content = extractJson(raw)
      results.push({
        skill: 'reading',
        mode: 'level_reading',
        title: `Reading: ${lesson.title}`,
        title_vi: `Đọc: ${lesson.title}`,
        content,
      })
    } catch (err) {
      console.error('[writing-api] Reading generation failed:', err)
    }
  }

  // Generate Writing exercise
  for (let i = 0; i < (counts.writing || 1); i++) {
    try {
      const prompt = `You are an English teacher creating a SENTENCE BUILDING exercise.
CONTEXT: Based on lesson "${lesson.title}".
VOCABULARY:
${vocabList.substring(0, 1000)}

TASK: Create a sentence building exercise using vocabulary from the lesson. The student arranges shuffled words into a correct sentence.

Return JSON:
{
  "correct_sentence": "The correct English sentence using lesson vocabulary",
  "words_shuffled": ["array", "of", "shuffled", "words"],
  "distractors": ["1-2", "wrong", "words"],
  "grammar_hint_vi": "Grammar hint in Vietnamese",
  "translation_vi": "Vietnamese translation"
}`
      const raw = await callGemini(prompt, 4096)
      const content = extractJson(raw)
      results.push({
        skill: 'writing',
        mode: 'sentence_building',
        title: `Writing: ${lesson.title}`,
        title_vi: `Viết: ${lesson.title}`,
        content,
      })
    } catch (err) {
      console.error('[writing-api] Writing generation failed:', err)
    }
  }

  if (results.length === 0) {
    return errorResponse('Failed to generate any exercises', 500)
  }

  // Save to DB
  const exercises = results.map((r, i) => ({
    lesson_id: lesson_id,
    skill: r.skill,
    mode: r.mode,
    title: r.title,
    title_vi: r.title_vi,
    instruction_vi: null,
    content: r.content,
    order_index: i,
  }))

  const { data: saved, error: saveErr } = await serviceClient
    .from('lesson_skill_exercises')
    .insert(exercises)
    .select('id, skill, mode, title')

  if (saveErr) {
    console.error('[writing-api] Save exercises error:', saveErr)
    return errorResponse(`Failed to save: ${saveErr.message}`, 500)
  }

  console.log(`[writing-api] Generated ${saved?.length || 0} skill exercises for lesson ${lesson_id}`)

  return jsonResponse({
    exercises: saved,
    total: saved?.length || 0,
  })
}
```

- [ ] **Step 2: Add route to switch statement**

Add in the `switch (endpoint)` block:

```typescript
// ─── Lesson Skill Exercises ───
case 'generate-lesson-skills':
  return await handleGenerateLessonSkills(handlerReq, userId)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/writing-api/index.ts
git commit -m "feat: add generate-lesson-skills endpoint for course skill exercises"
```

---

### Task 7: Admin UI — Generate Skills in LessonFormPage

**Files:**
- Modify: `src/features/admin/pages/LessonFormPage.tsx`

- [ ] **Step 1: Add state for skill generation**

Add to the state declarations (after `savingBatch`):

```typescript
const [generatingSkills, setGeneratingSkills] = useState(false)
const [skillExercises, setSkillExercises] = useState<any[]>([])
const [skillCounts, setSkillCounts] = useState({ listening: 1, speaking: 1, reading: 1, writing: 1 })
```

Add fetch on edit load (inside the `useEffect` for `isEdit`):

```typescript
// Fetch existing skill exercises
if (isEdit && lessonId) {
  supabase
    .from('lesson_skill_exercises')
    .select('id, skill, mode, title, title_vi')
    .eq('lesson_id', lessonId)
    .order('order_index')
    .then(({ data }) => {
      if (data) setSkillExercises(data)
    })
}
```

- [ ] **Step 2: Add handler functions**

```typescript
const handleGenerateSkills = async () => {
  if (!lessonId) {
    addToast('error', 'Vui lòng lưu bài học trước')
    return
  }
  setGeneratingSkills(true)
  try {
    const { invokeWritingApi } = await import('@/shared/lib/edgeFunctions')
    const { data, error } = await invokeWritingApi('generate-lesson-skills', {
      lesson_id: lessonId,
      skills_count: skillCounts,
    })
    if (error) {
      addToast('error', `Lỗi: ${error}`)
      return
    }
    addToast('success', `Đã tạo ${data?.total || 0} bài luyện kỹ năng!`)
    // Refresh
    const { data: refreshed } = await supabase
      .from('lesson_skill_exercises')
      .select('id, skill, mode, title, title_vi')
      .eq('lesson_id', lessonId)
      .order('order_index')
    if (refreshed) setSkillExercises(refreshed)
  } catch (err) {
    addToast('error', `Lỗi: ${(err as Error).message}`)
  } finally {
    setGeneratingSkills(false)
  }
}

const handleDeleteSkillExercise = async (id: string) => {
  if (!confirm('Xóa bài luyện này?')) return
  await supabase.from('lesson_skill_exercises').delete().eq('id', id)
  setSkillExercises(prev => prev.filter(e => e.id !== id))
  addToast('success', 'Đã xóa')
}
```

- [ ] **Step 3: Add "skills" tab to tabs array**

Update the `TabId` type:
```typescript
type TabId = 'content' | 'vocabulary' | 'quiz' | 'skills'
```

Add to `tabs` array:
```typescript
{ id: 'skills' as TabId, label: '4 Kỹ năng', icon: Sparkles, count: skillExercises.length },
```

- [ ] **Step 4: Add tab content UI**

After the quiz tab panel, add:

```typescript
{/* ============ SKILLS TAB ============ */}
{activeTab === 'skills' && (
  <div className="space-y-4">
    {/* Generate controls */}
    <div className="glass-card p-5 space-y-4">
      <h3 className="text-sm font-bold text-surface-50 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary-400" />
        Tạo bài luyện 4 kỹ năng
      </h3>
      <p className="text-xs text-surface-200/40">
        AI sẽ tạo bài tập dựa trên nội dung và từ vựng của bài học này
      </p>

      {/* Skill count controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['listening', 'speaking', 'reading', 'writing'] as const).map(skill => (
          <div key={skill} className="flex items-center justify-between p-2 rounded-lg bg-surface-800/30">
            <span className="text-xs text-surface-200/60 capitalize">{
              skill === 'listening' ? '🎧 Nghe' :
              skill === 'speaking' ? '🎙️ Nói' :
              skill === 'reading' ? '📖 Đọc' : '✍️ Viết'
            }</span>
            <input
              type="number"
              min={0}
              max={5}
              value={skillCounts[skill]}
              onChange={(e) => setSkillCounts(prev => ({ ...prev, [skill]: parseInt(e.target.value) || 0 }))}
              className="w-12 text-center px-1 py-0.5 rounded bg-surface-900/60 border border-surface-700/50 text-surface-50 text-xs"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleGenerateSkills}
        disabled={generatingSkills || !isEdit}
        className="w-full py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {generatingSkills ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> AI đang tạo bài tập...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Tạo bài 4 kỹ năng</>
        )}
      </button>
    </div>

    {/* Existing skill exercises */}
    {skillExercises.length > 0 && (
      <div className="glass-card p-5 space-y-3">
        <h4 className="text-sm font-semibold text-surface-50">Bài luyện đã tạo ({skillExercises.length})</h4>
        {skillExercises.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/30">
            <div className="flex items-center gap-2">
              <span className="text-xs">
                {ex.skill === 'listening' ? '🎧' : ex.skill === 'speaking' ? '🎙️' : ex.skill === 'reading' ? '📖' : '✍️'}
              </span>
              <span className="text-xs text-surface-50">{ex.title_vi || ex.title}</span>
              <span className="text-[10px] text-surface-200/30">({ex.mode})</span>
            </div>
            <button
              onClick={() => handleDeleteSkillExercise(ex.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-200/30 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Add supabase import at the top of the file**

Add if not already present:
```typescript
import { supabase } from '@/shared/lib/supabase'
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/pages/LessonFormPage.tsx
git commit -m "feat: add 4 skills generation UI to admin LessonFormPage"
```

---

### Task 8: Verification

- [ ] **Step 1: Build verification**

Run: `npm run build`
Expected: exit 0, no TypeScript errors

- [ ] **Step 2: Browser flow test**

Run: `npm run dev`
Test flow:
1. Login as admin → go to admin → edit a lesson
2. Click "4 Kỹ năng" tab → set counts → click "Tạo bài 4 kỹ năng"
3. Wait for AI → verify exercises appear in list
4. Go to user-facing lesson → click "Luyện kỹ năng" tab
5. See grid with 4 skill cards → click one → exercise loads
6. Complete exercise → verify result shows → verify progress saved

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete course skills integration — 4 skills practice per lesson"
```
