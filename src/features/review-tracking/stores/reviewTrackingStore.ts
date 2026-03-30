import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import { invokeAiApi } from '@/shared/lib/edgeFunctions'
import { useXpStore } from '@/shared/stores/xpStore'

/* ===== Types ===== */

export interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  course_id: string
  status: 'started' | 'completed' | 'mastered'
  completion_count: number
  best_score_percent: number
  total_time_spent_sec: number
  vocabulary_learned: number
  interval_level: number
  next_review_at: string | null
  last_reviewed_at: string | null
  review_count: number
  first_started_at: string
  created_at: string
  // Joined data
  lesson_title?: string
  course_title?: string
}

export interface ReviewBlock {
  type: 'review' | 'quiz'
  title?: string
  items?: Array<{
    word: string
    meaning: string
    part_of_speech?: string
    example?: string
    note?: string
    structure?: string
  }>
  questions?: Array<ReviewQuestion>
}

export interface ReviewQuestion {
  type: 'fill_blank' | 'multiple_choice' | 'true_false' | 'translation' | 'word_guess' | 'matching'
  question: string
  options?: string[] | null
  correct_answer: string
  explanation: string
}

export interface ReviewAnswer {
  questionIndex: number
  questionType: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  responseTimeMs: number
}

export interface MasteryDetails {
  accuracy: number
  avgResponseSec: number
  fastRatio: number
  tabSwitchCount: number
  isFocused: boolean
  isMastered: boolean
}

interface ReviewTrackingState {
  // Lesson progress
  lessonsDue: LessonProgress[]
  allProgress: LessonProgress[]
  dueCount: number

  // Session
  sessionId: string | null
  exerciseBlocks: ReviewBlock[]
  currentBlockIndex: number
  currentQuestionIndex: number
  answers: ReviewAnswer[]
  startedAt: number | null
  isResumed: boolean

  // Anti-cheat
  tabSwitchCount: number
  contextMenuCount: number

  // UI states
  phase: 'idle' | 'loading' | 'generating' | 'reviewing' | 'quiz' | 'completed'
  isLoading: boolean
  error: string | null
  masteryResult: MasteryDetails | null

  // Actions
  fetchLessonsDue: () => Promise<void>
  fetchAllProgress: () => Promise<void>
  checkExistingSession: () => Promise<boolean>
  generateDailyReview: () => Promise<void>
  submitAnswer: (answer: string, responseTimeMs: number) => void
  advanceToNextQuestion: () => boolean
  recordTabSwitch: () => void
  recordContextMenu: () => void
  finishSession: () => Promise<void>
  reset: () => void
}

// Session expiry: 1 day in milliseconds
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000

function calculateMastery(answers: ReviewAnswer[], tabSwitchCount: number): MasteryDetails {
  const total = answers.length
  if (total === 0) {
    return { accuracy: 0, avgResponseSec: 0, fastRatio: 0, tabSwitchCount, isFocused: true, isMastered: false }
  }

  const correct = answers.filter(a => a.isCorrect).length
  const accuracy = (correct / total) * 100
  const totalResponseMs = answers.reduce((sum, a) => sum + a.responseTimeMs, 0)
  const avgResponseSec = totalResponseMs / total / 1000
  const fastCount = answers.filter(a => a.responseTimeMs < 10000).length
  const fastRatio = (fastCount / total) * 100
  const isFocused = tabSwitchCount <= 3

  const isMastered = accuracy >= 85 && avgResponseSec <= 15 && fastRatio >= 80 && isFocused

  return { accuracy, avgResponseSec, fastRatio, tabSwitchCount, isFocused, isMastered }
}

// Get all quiz questions from blocks in order
function getAllQuestions(blocks: ReviewBlock[]): { blockIndex: number; questionIndex: number; question: ReviewQuestion }[] {
  const result: { blockIndex: number; questionIndex: number; question: ReviewQuestion }[] = []
  blocks.forEach((block, bi) => {
    if (block.type === 'quiz' && block.questions) {
      block.questions.forEach((q, qi) => {
        result.push({ blockIndex: bi, questionIndex: qi, question: q })
      })
    }
  })
  return result
}

/**
 * Given saved answers count, find which block/question index to resume from.
 */
function findResumePosition(blocks: ReviewBlock[], answeredCount: number): { blockIndex: number; questionIndex: number } {
  let count = 0
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]
    if (block.type === 'quiz' && block.questions) {
      for (let qi = 0; qi < block.questions.length; qi++) {
        if (count >= answeredCount) {
          return { blockIndex: bi, questionIndex: qi }
        }
        count++
      }
    } else if (block.type === 'review') {
      // If we've answered all questions before this review block, resume at this review block
      if (count >= answeredCount) {
        return { blockIndex: bi, questionIndex: 0 }
      }
    }
  }
  // All questions answered — go to last block
  return { blockIndex: blocks.length - 1, questionIndex: 0 }
}

export const useReviewTrackingStore = create<ReviewTrackingState>((set, get) => ({
  lessonsDue: [],
  allProgress: [],
  dueCount: 0,

  sessionId: null,
  exerciseBlocks: [],
  currentBlockIndex: 0,
  currentQuestionIndex: 0,
  answers: [],
  startedAt: null,
  isResumed: false,

  tabSwitchCount: 0,
  contextMenuCount: 0,

  phase: 'idle',
  isLoading: false,
  error: null,
  masteryResult: null,

  /* ===== CHECK EXISTING SESSION ===== */
  checkExistingSession: async () => {
    try {
      set({ isLoading: true })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { set({ isLoading: false }); return false }

      // Find incomplete sessions (no completed_at) within expiry window
      const expiryTime = new Date(Date.now() - SESSION_EXPIRY_MS).toISOString()

      const { data: sessions, error } = await supabase
        .from('daily_review_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('completed_at', null)
        .gte('created_at', expiryTime)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      if (!sessions || sessions.length === 0) {
        set({ isLoading: false })
        return false
      }

      const session = sessions[0]
      const blocks: ReviewBlock[] = session.exercise_data || []

      if (blocks.length === 0) {
        set({ isLoading: false })
        return false
      }

      // Load saved answers for this session
      const { data: savedAnswers } = await supabase
        .from('daily_review_answers')
        .select('*')
        .eq('session_id', session.id)
        .order('question_index', { ascending: true })

      const answers: ReviewAnswer[] = (savedAnswers || []).map((a: any) => ({
        questionIndex: a.question_index,
        questionType: a.question_type,
        userAnswer: a.user_answer,
        correctAnswer: a.correct_answer,
        isCorrect: a.is_correct,
        responseTimeMs: a.response_time_ms || 0,
      }))

      // Check if all questions already answered
      const allQ = getAllQuestions(blocks)
      if (answers.length >= allQ.length) {
        set({ isLoading: false })
        return false
      }

      // Use saved block position from DB (tracks review block progress too)
      const savedBlockIdx = session.current_block_index || 0
      const savedQuestionIdx = session.current_question_index || 0

      // If saved position is beyond all blocks, use answer-based fallback
      let blockIndex = savedBlockIdx
      let questionIndex = savedQuestionIdx
      if (blockIndex >= blocks.length) {
        const pos = findResumePosition(blocks, answers.length)
        blockIndex = pos.blockIndex
        questionIndex = pos.questionIndex
      }

      const resumeBlock = blocks[blockIndex]

      set({
        sessionId: session.id,
        exerciseBlocks: blocks,
        currentBlockIndex: blockIndex,
        currentQuestionIndex: questionIndex,
        answers,
        startedAt: session.started_at ? new Date(session.started_at).getTime() : Date.now(),
        tabSwitchCount: session.tab_switch_count || 0,
        contextMenuCount: session.context_menu_count || 0,
        phase: resumeBlock?.type === 'review' ? 'reviewing' : 'quiz',
        isLoading: false,
        isResumed: true,
      })

      console.log(`[reviewTracking] Resumed session ${session.id}, ${answers.length}/${allQ.length} answered, block=${blockIndex}, q=${questionIndex}`)
      return true
    } catch (err) {
      console.error('[reviewTracking] checkExistingSession:', err)
      set({ isLoading: false })
      return false
    }
  },

  /* ===== FETCH LESSONS DUE ===== */
  fetchLessonsDue: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date().toISOString()

      // 1. Lessons due for review (next_review_at <= now)
      const { data: dueLessons, error } = await supabase
        .from('user_lesson_progress')
        .select('*, lessons:lesson_id(title), courses:course_id(title)')
        .eq('user_id', user.id)
        .lte('next_review_at', now)
        .neq('status', 'mastered')
        .order('next_review_at', { ascending: true })
        .limit(5)

      if (error) throw error

      let results = dueLessons || []

      // 2. Fallback: if no due lessons, check completed lessons not yet reviewed
      if (results.length === 0) {
        const { data: fallbackLessons, error: fbError } = await supabase
          .from('user_lesson_progress')
          .select('*, lessons:lesson_id(title), courses:course_id(title)')
          .eq('user_id', user.id)
          .neq('status', 'mastered')
          .eq('review_count', 0)
          .not('next_review_at', 'is', null)
          .order('first_started_at', { ascending: false })
          .limit(5)

        if (!fbError && fallbackLessons && fallbackLessons.length > 0) {
          results = fallbackLessons
        }
      }

      const mapped: LessonProgress[] = results.map((d: any) => ({
        ...d,
        lesson_title: d.lessons?.title,
        course_title: d.courses?.title,
        lessons: undefined,
        courses: undefined,
      }))

      set({ lessonsDue: mapped, dueCount: mapped.length })
    } catch (err) {
      console.error('[reviewTracking] fetchLessonsDue:', err)
    }
  },

  /* ===== FETCH ALL PROGRESS ===== */
  fetchAllProgress: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_lesson_progress')
        .select('*, lessons:lesson_id(title), courses:course_id(title)')
        .eq('user_id', user.id)
        .order('first_started_at', { ascending: false })

      if (error) throw error

      const mapped: LessonProgress[] = (data || []).map((d: any) => ({
        ...d,
        lesson_title: d.lessons?.title,
        course_title: d.courses?.title,
        lessons: undefined,
        courses: undefined,
      }))

      set({ allProgress: mapped })
    } catch (err) {
      console.error('[reviewTracking] fetchAllProgress:', err)
    }
  },

  /* ===== GENERATE DAILY REVIEW ===== */
  generateDailyReview: async () => {
    set({ phase: 'generating', error: null, isLoading: true })
    try {
      const { lessonsDue } = get()
      if (lessonsDue.length === 0) {
        set({ phase: 'idle', error: 'Không có bài nào cần ôn hôm nay!', isLoading: false })
        return
      }

      // Delete any old incomplete sessions (expired or abandoned) before creating new
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        await supabase
          .from('daily_review_sessions')
          .delete()
          .eq('user_id', currentUser.id)
          .is('completed_at', null)
      }

      // Fetch vocabulary + content for each lesson
      const lessonIds = lessonsDue.map(l => l.lesson_id)
      const [vocabRes, lessonsRes] = await Promise.all([
        supabase
          .from('vocabulary')
          .select('word, definition_vi, example_sentence, part_of_speech, lesson_id')
          .in('lesson_id', lessonIds),
        supabase
          .from('lessons')
          .select('id, title, ai_summary, processed_content')
          .in('id', lessonIds),
      ])

      // Build lessons data for AI
      const lessonsData = (lessonsRes.data || []).map((l: any) => {
        const vocab = (vocabRes.data || [])
          .filter((v: any) => v.lesson_id === l.id)
          .map((v: any) => ({
            word: v.word,
            meaning_vi: v.definition_vi || '',
            example_sentence: v.example_sentence || '',
            part_of_speech: v.part_of_speech || '',
          }))

        return {
          title: l.title,
          vocabulary: vocab,
          summary: l.ai_summary || '',
          grammar: '',
        }
      })

      // Call AI
      const { data, error } = await invokeAiApi('generate-daily-review', { lessons: lessonsData })

      if (error || !data) {
        throw new Error(error || 'Failed to generate review')
      }

      const blocks: ReviewBlock[] = (data as any).blocks || []

      // Create session in DB
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const totalQuestions = getAllQuestions(blocks).length

      const { data: session, error: sessErr } = await supabase
        .from('daily_review_sessions')
        .insert({
          user_id: user.id,
          source_lessons: lessonsDue.map(l => ({
            lesson_id: l.lesson_id,
            course_id: l.course_id,
            title: l.lesson_title || '',
          })),
          exercise_data: blocks,
          total_questions: totalQuestions,
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (sessErr) throw sessErr

      set({
        sessionId: session.id,
        exerciseBlocks: blocks,
        currentBlockIndex: 0,
        currentQuestionIndex: 0,
        answers: [],
        startedAt: Date.now(),
        tabSwitchCount: 0,
        contextMenuCount: 0,
        phase: blocks[0]?.type === 'review' ? 'reviewing' : 'quiz',
        isLoading: false,
        masteryResult: null,
        isResumed: false,
      })
    } catch (err) {
      console.error('[reviewTracking] generateDailyReview:', err)
      set({ phase: 'idle', error: (err as Error).message, isLoading: false })
    }
  },

  /* ===== SUBMIT ANSWER ===== */
  submitAnswer: (answer: string, responseTimeMs: number) => {
    const { exerciseBlocks, currentBlockIndex, currentQuestionIndex, answers, sessionId } = get()
    const block = exerciseBlocks[currentBlockIndex]
    if (block?.type !== 'quiz' || !block.questions) return

    const question = block.questions[currentQuestionIndex]
    if (!question) return

    const correctAnswer = question.correct_answer || ''
    const userStr = (answer || '').toLowerCase().trim()
    const correctStr = correctAnswer.toLowerCase().trim()
    
    // Fuzzy match for text-input types (translation, fill_blank, word_guess)
    let isCorrect = userStr === correctStr
    if (!isCorrect && question.type !== 'multiple_choice' && question.type !== 'true_false') {
      const cleanUser = userStr.replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
      const cleanCorrect = correctStr.replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
      isCorrect = cleanUser === cleanCorrect
      if (!isCorrect && cleanUser.length > 0 && cleanCorrect.length > 0) {
        const maxLen = Math.max(cleanUser.length, cleanCorrect.length)
        const matrix: number[][] = []
        for (let i = 0; i <= cleanUser.length; i++) {
          matrix[i] = [i]
          for (let j = 1; j <= cleanCorrect.length; j++) {
            if (i === 0) { matrix[i][j] = j }
            else {
              const cost = cleanUser[i-1] === cleanCorrect[j-1] ? 0 : 1
              matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost)
            }
          }
        }
        const similarity = 1 - matrix[cleanUser.length][cleanCorrect.length] / maxLen
        isCorrect = similarity >= 0.85
      }
    }

    // Build global question index
    const allQ = getAllQuestions(exerciseBlocks)
    const globalIdx = allQ.findIndex(
      q => q.blockIndex === currentBlockIndex && q.questionIndex === currentQuestionIndex
    )

    const newAnswer: ReviewAnswer = {
      questionIndex: globalIdx >= 0 ? globalIdx : answers.length,
      questionType: question.type,
      userAnswer: answer,
      correctAnswer: correctAnswer,
      isCorrect,
      responseTimeMs,
    }

    const updatedAnswers = [...answers, newAnswer]
    set({ answers: updatedAnswers })

    // Save answer + current position to DB immediately (fire-and-forget for speed)
    if (sessionId) {
      Promise.all([
        supabase
          .from('daily_review_answers')
          .insert({
            session_id: sessionId,
            question_index: newAnswer.questionIndex,
            question_type: newAnswer.questionType,
            user_answer: newAnswer.userAnswer,
            correct_answer: newAnswer.correctAnswer,
            is_correct: newAnswer.isCorrect,
            response_time_ms: newAnswer.responseTimeMs,
          }),
        supabase
          .from('daily_review_sessions')
          .update({
            current_block_index: currentBlockIndex,
            current_question_index: currentQuestionIndex,
          })
          .eq('id', sessionId),
      ]).then(([ansRes]) => {
        const error = ansRes.error
          if (error) console.warn('[reviewTracking] Failed to save answer:', error)
        })
    }
  },

  /* ===== ADVANCE TO NEXT ===== */
  advanceToNextQuestion: () => {
    const { exerciseBlocks, currentBlockIndex, currentQuestionIndex, sessionId } = get()
    const block = exerciseBlocks[currentBlockIndex]

    if (block?.type === 'quiz' && block.questions) {
      if (currentQuestionIndex < block.questions.length - 1) {
        const newQIdx = currentQuestionIndex + 1
        set({ currentQuestionIndex: newQIdx })
        // Save position to DB
        if (sessionId) {
          supabase.from('daily_review_sessions').update({
            current_block_index: currentBlockIndex,
            current_question_index: newQIdx,
          }).eq('id', sessionId).then(() => {})
        }
        return true
      }
    }

    // Move to next block
    const nextBlock = currentBlockIndex + 1
    if (nextBlock < exerciseBlocks.length) {
      const nextType = exerciseBlocks[nextBlock].type
      set({
        currentBlockIndex: nextBlock,
        currentQuestionIndex: 0,
        phase: nextType === 'review' ? 'reviewing' : 'quiz',
      })
      // Save block position to DB
      if (sessionId) {
        supabase.from('daily_review_sessions').update({
          current_block_index: nextBlock,
          current_question_index: 0,
        }).eq('id', sessionId).then(() => {})
      }
      return true
    }

    // No more blocks
    return false
  },

  /* ===== ANTI-CHEAT ===== */
  recordTabSwitch: () => {
    set(s => ({ tabSwitchCount: s.tabSwitchCount + 1 }))
  },

  recordContextMenu: () => {
    set(s => ({ contextMenuCount: s.contextMenuCount + 1 }))
  },

  /* ===== FINISH SESSION ===== */
  finishSession: async () => {
    const { sessionId, answers, tabSwitchCount, contextMenuCount, startedAt } = get()
    if (!sessionId) return

    const mastery = calculateMastery(answers, tabSwitchCount)
    const totalTimeSec = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0
    const totalResponseMs = answers.reduce((sum, a) => sum + a.responseTimeMs, 0)
    const correct = answers.filter(a => a.isCorrect).length
    const wrong = answers.length - correct
    const fast = answers.filter(a => a.responseTimeMs < 10000).length
    const isFlagged = tabSwitchCount > 3

    try {
      // Update session as completed
      await supabase
        .from('daily_review_sessions')
        .update({
          total_questions: answers.length,
          correct_count: correct,
          wrong_count: wrong,
          total_time_seconds: totalTimeSec,
          avg_response_ms: answers.length > 0 ? Math.round(totalResponseMs / answers.length) : 0,
          fast_response_count: fast,
          tab_switch_count: tabSwitchCount,
          context_menu_count: contextMenuCount,
          is_mastered: mastery.isMastered,
          is_flagged: isFlagged,
          mastery_details: mastery,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      // Note: individual answers already saved in real-time via submitAnswer

      // Update lesson progress via DB function
      await supabase.rpc('update_lesson_review_progress', {
        p_session_id: sessionId,
      })

      // Award XP
      if (!isFlagged && answers.length > 0) {
        const scorePct = answers.length > 0 ? (correct / answers.length) * 100 : 0
        const xp = Math.round(15 + (scorePct / 100) * 35) // 15-50 XP
        await useXpStore.getState().awardXp(xp, 'daily_review', sessionId)
        await useXpStore.getState().updateStreak()
      }

      set({ phase: 'completed', masteryResult: mastery })
    } catch (err) {
      console.error('[reviewTracking] finishSession:', err)
    }
  },

  /* ===== RESET ===== */
  reset: () => {
    set({
      sessionId: null,
      exerciseBlocks: [],
      currentBlockIndex: 0,
      currentQuestionIndex: 0,
      answers: [],
      startedAt: null,
      tabSwitchCount: 0,
      contextMenuCount: 0,
      phase: 'idle',
      isLoading: false,
      error: null,
      masteryResult: null,
      isResumed: false,
    })
  },
}))
