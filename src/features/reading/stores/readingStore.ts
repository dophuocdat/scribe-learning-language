import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import { invokeWritingApi } from '@/shared/lib/edgeFunctions'

// ─── Types ─────────────────────────────────────────────

export type ReadingMode = 'level_reading' | 'reading_aloud'
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type ReadingPhase = 'config' | 'reading' | 'questions' | 'result'

export interface VocabWord {
  word: string
  meaning_vi: string
  ipa: string
  part_of_speech: string
  example: string
}

export interface ReadingQuestion {
  question: string
  type: string
  options: string[]
  correct_answer: string
  explanation_vi: string
}

export interface LevelReadingContent {
  title: string
  content: string
  word_count: number
  questions: ReadingQuestion[]
  vocabulary: VocabWord[]
}

export interface ReadingAloudContent {
  title: string
  content: string
  word_count: number
  estimated_wpm: number
  difficulty_note_vi: string
}

export type ReadingContent = LevelReadingContent | ReadingAloudContent

export interface ReadingEvalResult {
  score: number
  total_questions: number
  correct_count: number
  results: {
    question_index: number
    user_answer: string
    correct_answer: string
    is_correct: boolean
    explanation_vi: string
  }[]
  overall_feedback_vi: string
  xp_earned: number
}

export interface ReadingAloudResult {
  accuracy: number
  wpm: number
  total_words: number
  matched_words: number
  missed_words: number
  word_results: { word: string; matched: boolean }[]
  xp_earned: number
  feedback_vi: string
}

export interface SavedBatchSession {
  id: string
  mode: ReadingMode
  exercise_type: string
  level: CEFRLevel
  topic: string
  current_index: number
  total_count: number
  created_at: string
}

interface BatchItem {
  content: ReadingContent
  exerciseLibraryId: string | null
}

// ─── Store ─────────────────────────────────────────────

interface ReadingStore {
  phase: ReadingPhase
  mode: ReadingMode
  level: CEFRLevel
  topic: string
  batchSize: number

  content: ReadingContent | null
  evalResult: ReadingEvalResult | ReadingAloudResult | null
  loading: boolean
  evaluating: boolean
  error: string | null

  // Batch
  batchItems: BatchItem[]
  currentBatchIndex: number
  currentSessionId: string | null

  // User interaction
  userAnswers: Record<string, string>
  clickedWords: string[]
  readingStartTime: number | null

  // Sessions
  activeSessions: SavedBatchSession[]

  // Actions
  setConfig: (mode: ReadingMode, level: CEFRLevel, topic: string) => void
  setBatchSize: (size: number) => void
  generateExercise: () => Promise<void>
  setUserAnswer: (questionIndex: number, answer: string) => void
  addClickedWord: (word: string) => void
  submitAnswers: () => Promise<void>
  submitReadingAloud: (transcript: string, durationSec: number) => Promise<void>
  goToQuestions: () => void
  nextInBatch: () => void
  resetToConfig: () => void
  clearError: () => void

  // Sessions
  loadActiveSessions: () => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
}

export const useReadingStore = create<ReadingStore>((set, get) => ({
  phase: 'config',
  mode: 'level_reading',
  level: 'A2',
  topic: 'Daily Life',
  batchSize: 1,

  content: null,
  evalResult: null,
  loading: false,
  evaluating: false,
  error: null,

  batchItems: [],
  currentBatchIndex: 0,
  currentSessionId: null,

  userAnswers: {},
  clickedWords: [],
  readingStartTime: null,

  activeSessions: [],

  setConfig: (mode, level, topic) => set({ mode, level, topic }),
  setBatchSize: (size) => set({ batchSize: Math.max(1, Math.min(5, size)) }),

  // ─── Generate ────────────────────────────────────────

  generateExercise: async () => {
    const { mode, level, topic, batchSize } = get()
    set({ loading: true, error: null })

    try {
      const promises = Array.from({ length: batchSize }, (_, i) =>
        invokeWritingApi<{
          exercises: Array<{
            content: ReadingContent
            exercise_library_id: string | null
            source: string
          }>
        }>('generate-reading', {
          mode,
          level,
          topic,
          variation_index: i + 1,
        })
      )

      const results = await Promise.allSettled(promises)

      const items: BatchItem[] = []
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.data?.exercises) {
          for (const ex of r.value.data.exercises) {
            items.push({
              content: ex.content,
              exerciseLibraryId: ex.exercise_library_id || null,
            })
          }
        }
      }

      if (items.length === 0) {
        set({ loading: false, error: 'Không thể tạo bài đọc. Vui lòng thử lại.' })
        return
      }

      // Save session
      let sessionId: string | null = null
      try {
        const { data, error } = await supabase
          .from('reading_batch_sessions')
          .insert({
            mode,
            exercise_type: 'article',
            level,
            topic: topic || 'General',
            batch_items: items.map(it => it.content),
            current_index: 0,
            total_count: items.length,
          })
          .select('id')
          .single()

        if (!error && data) sessionId = data.id
      } catch (err) {
        console.error('[readingStore] Session save error:', err)
      }

      set({
        batchItems: items,
        currentBatchIndex: 0,
        currentSessionId: sessionId,
        content: items[0].content,
        evalResult: null,
        userAnswers: {},
        clickedWords: [],
        readingStartTime: Date.now(),
        phase: 'reading',
        loading: false,
      })

      get().loadActiveSessions()
    } catch (err) {
      set({ loading: false, error: `Lỗi tạo bài đọc: ${(err as Error).message}` })
    }
  },

  // ─── User Actions ────────────────────────────────────

  setUserAnswer: (questionIndex, answer) => {
    set(s => ({ userAnswers: { ...s.userAnswers, [String(questionIndex)]: answer } }))
  },

  addClickedWord: (word) => {
    set(s => ({
      clickedWords: s.clickedWords.includes(word) ? s.clickedWords : [...s.clickedWords, word],
    }))
  },

  goToQuestions: () => set({ phase: 'questions' }),

  // ─── Submit Answers (Level Reading) ──────────────────

  submitAnswers: async () => {
    const { content, userAnswers, currentSessionId, currentBatchIndex } = get()
    if (!content || !('questions' in content)) return

    set({ evaluating: true, error: null })

    try {
      const { data, error: apiError } = await invokeWritingApi<ReadingEvalResult>('evaluate-reading', {
        questions: (content as LevelReadingContent).questions,
        user_answers: userAnswers,
      })

      if (apiError || !data) {
        set({ evaluating: false, error: apiError || 'Lỗi chấm điểm' })
        return
      }

      // Update session
      if (currentSessionId) {
        try {
          await supabase
            .from('reading_batch_sessions')
            .update({ current_index: currentBatchIndex + 1, updated_at: new Date().toISOString() })
            .eq('id', currentSessionId)
        } catch { /* ignore */ }
      }

      set({ evalResult: data, evaluating: false, phase: 'result' })
    } catch (err) {
      set({ evaluating: false, error: `Lỗi chấm điểm: ${(err as Error).message}` })
    }
  },

  // ─── Submit Reading Aloud ────────────────────────────

  submitReadingAloud: async (transcript, durationSec) => {
    const { content, currentSessionId, currentBatchIndex } = get()
    if (!content) return

    set({ evaluating: true, error: null })

    try {
      const { data, error: apiError } = await invokeWritingApi<ReadingAloudResult>('evaluate-reading-aloud', {
        original_text: content.content,
        user_transcript: transcript,
        duration_sec: durationSec,
      })

      if (apiError || !data) {
        set({ evaluating: false, error: apiError || 'Lỗi chấm điểm' })
        return
      }

      if (currentSessionId) {
        try {
          await supabase
            .from('reading_batch_sessions')
            .update({ current_index: currentBatchIndex + 1, updated_at: new Date().toISOString() })
            .eq('id', currentSessionId)
        } catch { /* ignore */ }
      }

      set({ evalResult: data, evaluating: false, phase: 'result' })
    } catch (err) {
      set({ evaluating: false, error: `Lỗi chấm điểm: ${(err as Error).message}` })
    }
  },

  // ─── Batch Navigation ────────────────────────────────

  nextInBatch: () => {
    const { batchItems, currentBatchIndex } = get()
    const nextIdx = currentBatchIndex + 1

    if (nextIdx >= batchItems.length) {
      set({ phase: 'config', content: null, evalResult: null, batchItems: [], currentBatchIndex: 0, currentSessionId: null })
      get().loadActiveSessions()
      return
    }

    set({
      currentBatchIndex: nextIdx,
      content: batchItems[nextIdx].content,
      evalResult: null,
      userAnswers: {},
      clickedWords: [],
      readingStartTime: Date.now(),
      phase: 'reading',
    })
  },

  resetToConfig: () => set({
    phase: 'config', content: null, evalResult: null,
    loading: false, evaluating: false, error: null,
    batchItems: [], currentBatchIndex: 0, currentSessionId: null,
    userAnswers: {}, clickedWords: [], readingStartTime: null,
  }),

  clearError: () => set({ error: null }),

  // ─── Sessions ────────────────────────────────────────

  loadActiveSessions: async () => {
    try {
      const { data, error } = await supabase
        .from('reading_batch_sessions')
        .select('id, mode, exercise_type, level, topic, current_index, total_count, created_at')
        .order('updated_at', { ascending: false })
        .limit(30)

      if (!error) set({ activeSessions: (data || []) as SavedBatchSession[] })
    } catch (err) {
      console.error('[readingStore] loadActiveSessions:', err)
    }
  },

  resumeSession: async (sessionId) => {
    set({ loading: true, error: null })

    try {
      const { data, error } = await supabase
        .from('reading_batch_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        set({ loading: false, error: 'Không tìm thấy phiên.' })
        return
      }

      const items: BatchItem[] = (data.batch_items as ReadingContent[]).map(c => ({
        content: c,
        exerciseLibraryId: null,
      }))

      const idx = Math.min(data.current_index, items.length - 1)

      set({
        mode: data.mode as ReadingMode,
        level: data.level as CEFRLevel,
        topic: data.topic || 'General',
        batchItems: items,
        currentBatchIndex: idx,
        currentSessionId: sessionId,
        content: items[idx].content,
        evalResult: null,
        userAnswers: {},
        clickedWords: [],
        readingStartTime: Date.now(),
        phase: 'reading',
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: 'Lỗi tải phiên.' })
    }
  },

  deleteSession: async (sessionId) => {
    if (!confirm('Xóa phiên này?')) return

    try {
      await supabase.from('reading_batch_sessions').delete().eq('id', sessionId)
      get().loadActiveSessions()
    } catch (err) {
      console.error('[readingStore] deleteSession:', err)
    }
  },
}))
