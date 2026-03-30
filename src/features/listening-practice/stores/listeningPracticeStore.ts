import { create } from 'zustand'
import { invokeWritingApi } from '@/shared/lib/edgeFunctions'
import { supabase } from '@/shared/lib/supabase'

/* ===== Types ===== */

export type ExerciseMode = 'dictation' | 'comprehension'
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type DictationType = 'word' | 'phrase' | 'short_sentence' | 'complex_sentence' | 'short_paragraph' | 'long_paragraph'
export type ComprehensionType = 'fill_blank' | 'short_answer' | 'summary' | 'opinion' | 'essay'

export interface KeyVocabulary {
  word: string
  meaning_vi: string
  phonetic?: string
}

export interface DictationContent {
  text: string
  translation_vi: string
  word_count: number
  difficulty_note_vi: string
  key_vocabulary: KeyVocabulary[]
}

export interface ComprehensionQuestion {
  question: string
  question_vi: string
  type: 'short_answer' | 'fill_blank' | 'open_ended'
  blank_text?: string
  answer: string
}

export interface ComprehensionContent {
  passage: string
  passage_translation_vi: string
  word_count: number
  instruction_vi: string
  questions: ComprehensionQuestion[]
  sample_answer: string
  key_vocabulary: KeyVocabulary[]
}

export interface WordComparison {
  original: string
  user: string
  status: 'correct' | 'misspelled' | 'missing' | 'extra'
  note_vi?: string
}

export interface DictationResult {
  accuracy: number
  total_words: number
  correct_words: number
  word_comparison: WordComparison[]
  feedback_vi: string
  score: number
  xp_earned: number
}

export interface AnswerEvaluation {
  question_index: number
  is_correct: boolean
  score: number
  feedback_vi: string
  corrected_answer?: string
}

export interface ComprehensionResult {
  score: number
  answers_evaluation: AnswerEvaluation[]
  grammar_issues: { original: string; correction: string; explanation_vi: string }[]
  overall_feedback_vi: string
  vocabulary_score: number
  grammar_score: number
  comprehension_score: number
  xp_earned: number
}

export interface ListeningUsage {
  exercisesToday: number
  maxExercises: number
  remaining: number
}

export interface SavedExercise {
  id: string
  mode: ExerciseMode
  exercise_type: string
  level: CEFRLevel
  topic: string | null
  content: DictationContent | ComprehensionContent
  times_practiced: number
  best_score: number | null
  best_accuracy: number | null
  created_at: string
}

/** An exercise item in the batch */
interface BatchItem {
  content: DictationContent | ComprehensionContent
  exerciseLibraryId: string | null
  source: 'cache' | 'ai'
}

/** Saved session from DB */
export interface SavedBatchSession {
  id: string
  mode: ExerciseMode
  exercise_type: string
  level: CEFRLevel
  topic: string
  current_index: number
  total_count: number
  created_at: string
}

// Exercise types options for UI
export const DICTATION_TYPES: { id: DictationType; label: string; levels: CEFRLevel[] }[] = [
  { id: 'word', label: 'Từ vựng', levels: ['A1'] },
  { id: 'phrase', label: 'Cụm từ', levels: ['A1', 'A2'] },
  { id: 'short_sentence', label: 'Câu ngắn', levels: ['A2', 'B1'] },
  { id: 'complex_sentence', label: 'Câu phức', levels: ['B1', 'B2'] },
  { id: 'short_paragraph', label: 'Đoạn ngắn', levels: ['B2', 'C1'] },
  { id: 'long_paragraph', label: 'Đoạn dài', levels: ['C1', 'C2'] },
]

export const COMPREHENSION_TYPES: { id: ComprehensionType; label: string; levels: CEFRLevel[] }[] = [
  { id: 'fill_blank', label: 'Điền từ', levels: ['A1', 'A2'] },
  { id: 'short_answer', label: 'Trả lời ngắn', levels: ['A2', 'B1'] },
  { id: 'summary', label: 'Tóm tắt', levels: ['B1', 'B2'] },
  { id: 'opinion', label: 'Viết ý kiến', levels: ['B2', 'C1'] },
  { id: 'essay', label: 'Viết bài luận', levels: ['C1', 'C2'] },
]

export const TOPICS = [
  'Daily Life', 'Travel', 'Technology', 'Business',
  'Science', 'Education', 'Culture', 'Health',
  'Environment', 'Sports', 'Food', 'Entertainment',
]

/* ===== Store ===== */

type ExercisePhase = 'config' | 'exercise' | 'result'

interface ListeningPracticeState {
  // Config
  mode: ExerciseMode
  level: CEFRLevel
  exerciseType: string
  topic: string
  playbackSpeed: number
  accent: string

  // Batch
  phase: ExercisePhase
  batchItems: BatchItem[]
  currentBatchIndex: number
  sessionId: string | null
  content: DictationContent | ComprehensionContent | null
  exerciseLibraryId: string | null
  generating: boolean
  evaluating: boolean
  replayCount: number
  maxReplays: number

  // Results
  dictationResult: DictationResult | null
  comprehensionResult: ComprehensionResult | null

  // Active sessions
  activeSessions: SavedBatchSession[]
  loadingSession: boolean

  // Saved exercises (legacy)
  savedExercises: SavedExercise[]
  loadingSaved: boolean

  // Usage
  usage: ListeningUsage | null

  // Error
  error: string | null

  // Actions — Config
  setMode: (mode: ExerciseMode) => void
  setLevel: (level: CEFRLevel) => void
  setExerciseType: (type: string) => void
  setTopic: (topic: string) => void
  setPlaybackSpeed: (speed: number) => void
  setAccent: (accent: string) => void

  // Actions — Exercise
  generateExercise: () => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  practiceFromSaved: (saved: SavedExercise) => void
  submitAnswer: (answer: string) => Promise<void>
  advanceToNext: () => boolean
  incrementReplay: () => void
  reset: () => void
  clearError: () => void

  // Actions — Sessions
  loadActiveSessions: () => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>

  // Actions — Saved
  loadSavedExercises: () => Promise<void>
  deleteSavedExercise: (id: string) => Promise<void>
}

const BATCH_SIZE = 5

export const useListeningPracticeStore = create<ListeningPracticeState>((set, get) => ({
  // Defaults
  mode: 'dictation',
  level: 'B1',
  exerciseType: 'short_sentence',
  topic: '',
  playbackSpeed: 1.0,
  accent: 'en-US',

  phase: 'config',
  batchItems: [],
  currentBatchIndex: 0,
  sessionId: null,
  content: null,
  exerciseLibraryId: null,
  generating: false,
  evaluating: false,
  replayCount: 0,
  maxReplays: 3,

  dictationResult: null,
  comprehensionResult: null,

  activeSessions: [],
  loadingSession: false,

  savedExercises: [],
  loadingSaved: false,

  usage: null,
  error: null,

  // Config setters
  setMode: (mode) => {
    const newType = mode === 'dictation' ? 'short_sentence' : 'short_answer'
    set({ mode, exerciseType: newType })
  },
  setLevel: (level) => set({ level }),
  setExerciseType: (type) => set({ exerciseType: type }),
  setTopic: (topic) => set({ topic }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setAccent: (accent) => set({ accent }),

  generateExercise: async () => {
    const { mode, exerciseType, level, topic } = get()
    set({
      generating: true, error: null, content: null, exerciseLibraryId: null,
      dictationResult: null, comprehensionResult: null, replayCount: 0,
      batchItems: [], currentBatchIndex: 0, sessionId: null,
    })

    try {
      const { data, error } = await invokeWritingApi<{
        exercises: Array<{
          content: DictationContent | ComprehensionContent
          exercise_library_id: string | null
          source: 'cache' | 'ai'
        }>
        usage: ListeningUsage
      }>('generate-batch', {
        mode,
        exercise_type: exerciseType,
        level,
        topic: topic || undefined,
        batch_size: BATCH_SIZE,
      })

      if (error) {
        set({ generating: false, error })
        return
      }

      const exercises = data?.exercises || []
      if (exercises.length === 0) {
        set({ generating: false, error: 'Không thể tạo bài tập. Vui lòng thử lại.' })
        return
      }

      const items: BatchItem[] = exercises.map(e => ({
        content: e.content,
        exerciseLibraryId: e.exercise_library_id || null,
        source: e.source || 'ai',
      }))

      // Save session to DB
      const normalizedTopic = topic || 'General'
      const { data: session } = await supabase
        .from('listening_batch_sessions')
        .insert({
          mode,
          exercise_type: exerciseType,
          level,
          topic: normalizedTopic,
          batch_items: items,
          current_index: 0,
          total_count: items.length,
        })
        .select('id')
        .single()

      const sessionId = session?.id || null
      console.log(`[listeningStore] Session saved: ${sessionId}`)

      set({
        generating: false,
        batchItems: items,
        currentBatchIndex: 0,
        sessionId,
        content: items[0].content,
        exerciseLibraryId: items[0].exerciseLibraryId,
        phase: 'exercise',
        usage: data?.usage || null,
      })
    } catch (err) {
      console.error('[listeningStore] generateExercise:', err)
      set({ generating: false, error: (err as Error).message })
    }
  },

  resumeSession: async (sessionId: string) => {
    set({ loadingSession: true, error: null })

    try {
      const { data: session, error } = await supabase
        .from('listening_batch_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error || !session) {
        set({ loadingSession: false, error: 'Không tìm thấy phiên học.' })
        return
      }

      const items = session.batch_items as BatchItem[]
      const idx = session.current_index as number

      if (!items || items.length === 0 || idx >= items.length) {
        // Session is complete, delete it
        await supabase.from('listening_batch_sessions').delete().eq('id', sessionId)
        set({ loadingSession: false, error: 'Phiên học đã hoàn thành.' })
        return
      }

      set({
        loadingSession: false,
        mode: session.mode as ExerciseMode,
        exerciseType: session.exercise_type,
        level: session.level as CEFRLevel,
        topic: session.topic,
        batchItems: items,
        currentBatchIndex: idx,
        sessionId,
        content: items[idx].content,
        exerciseLibraryId: items[idx].exerciseLibraryId,
        phase: 'exercise',
        replayCount: 0,
        dictationResult: null,
        comprehensionResult: null,
      })
    } catch (err) {
      console.error('[listeningStore] resumeSession:', err)
      set({ loadingSession: false, error: (err as Error).message })
    }
  },

  practiceFromSaved: (saved: SavedExercise) => {
    set({
      mode: saved.mode,
      level: saved.level,
      exerciseType: saved.exercise_type,
      topic: saved.topic || '',
      content: saved.content,
      exerciseLibraryId: saved.id,
      batchItems: [{ content: saved.content, exerciseLibraryId: saved.id, source: 'cache' }],
      currentBatchIndex: 0,
      sessionId: null,
      phase: 'exercise',
      replayCount: 0,
      dictationResult: null,
      comprehensionResult: null,
      error: null,
    })
  },

  submitAnswer: async (answer: string) => {
    const { mode, exerciseType, level, topic, content, playbackSpeed, replayCount, exerciseLibraryId } = get()
    if (!content) return

    set({ evaluating: true, error: null })

    try {
      const { data, error } = await invokeWritingApi<DictationResult | ComprehensionResult>(
        'evaluate-exercise',
        {
          mode,
          exercise_type: exerciseType,
          level,
          topic,
          content,
          user_answer: answer,
          playback_speed: playbackSpeed,
          replay_count: replayCount,
          exercise_library_id: exerciseLibraryId,
        }
      )

      if (error) {
        set({ evaluating: false, error })
        return
      }

      if (!data) {
        set({ evaluating: false, error: 'Empty evaluation response' })
        return
      }

      if (mode === 'dictation') {
        set({ evaluating: false, dictationResult: data as DictationResult, phase: 'result' })
      } else {
        set({ evaluating: false, comprehensionResult: data as ComprehensionResult, phase: 'result' })
      }
    } catch (err) {
      console.error('[listeningStore] submitAnswer:', err)
      set({ evaluating: false, error: (err as Error).message })
    }
  },

  /** Advance to next exercise. Updates DB session. Returns false if batch done. */
  advanceToNext: () => {
    const { batchItems, currentBatchIndex, sessionId } = get()
    const nextIdx = currentBatchIndex + 1

    if (nextIdx >= batchItems.length) {
      // Batch complete — delete session
      if (sessionId) {
        supabase.from('listening_batch_sessions').delete().eq('id', sessionId)
          .then(() => console.log(`[listeningStore] Session deleted: ${sessionId}`))
      }
      set({ sessionId: null })
      return false
    }

    const nextItem = batchItems[nextIdx]

    // Update DB session
    if (sessionId) {
      supabase.from('listening_batch_sessions')
        .update({ current_index: nextIdx, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then(() => console.log(`[listeningStore] Session updated: index=${nextIdx}`))
    }

    set({
      currentBatchIndex: nextIdx,
      content: nextItem.content,
      exerciseLibraryId: nextItem.exerciseLibraryId,
      phase: 'exercise',
      replayCount: 0,
      dictationResult: null,
      comprehensionResult: null,
      error: null,
    })
    return true
  },

  incrementReplay: () => {
    set((s) => ({ replayCount: s.replayCount + 1 }))
  },

  reset: () => {
    set({
      phase: 'config',
      batchItems: [],
      currentBatchIndex: 0,
      sessionId: null,
      content: null,
      exerciseLibraryId: null,
      generating: false,
      evaluating: false,
      replayCount: 0,
      dictationResult: null,
      comprehensionResult: null,
      error: null,
    })
  },

  clearError: () => set({ error: null }),

  // ===== Sessions =====

  loadActiveSessions: async () => {
    try {
      const { data, error } = await supabase
        .from('listening_batch_sessions')
        .select('id, mode, exercise_type, level, topic, current_index, total_count, created_at')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('[listeningStore] loadActiveSessions:', error)
        return
      }

      set({ activeSessions: (data || []) as SavedBatchSession[] })
    } catch (err) {
      console.error('[listeningStore] loadActiveSessions:', err)
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await supabase.from('listening_batch_sessions').delete().eq('id', sessionId)
      set((s) => ({ activeSessions: s.activeSessions.filter(s => s.id !== sessionId) }))
    } catch (err) {
      console.error('[listeningStore] deleteSession:', err)
    }
  },

  // ===== Saved Exercises (legacy) =====

  loadSavedExercises: async () => {
    const { mode, level } = get()
    set({ loadingSaved: true })

    try {
      const { data, error } = await invokeWritingApi<{ exercises: SavedExercise[] }>(
        'list-exercises',
        { mode, level, limit: 20 }
      )

      if (error) {
        console.error('[listeningStore] loadSaved:', error)
        set({ loadingSaved: false })
        return
      }

      set({ savedExercises: data?.exercises || [], loadingSaved: false })
    } catch (err) {
      console.error('[listeningStore] loadSaved:', err)
      set({ loadingSaved: false })
    }
  },

  deleteSavedExercise: async (id: string) => {
    try {
      const { error } = await invokeWritingApi('delete-exercise', { exercise_id: id })
      if (!error) {
        set((s) => ({ savedExercises: s.savedExercises.filter(e => e.id !== id) }))
      }
    } catch (err) {
      console.error('[listeningStore] deleteSaved:', err)
    }
  },
}))
