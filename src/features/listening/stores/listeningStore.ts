import { create } from 'zustand'
import { invokeWritingApi } from '@/shared/lib/edgeFunctions'
import { supabase } from '@/shared/lib/supabase'

/* ===== Types ===== */

export type ListeningMode = 'dictation' | 'fill_blank' | 'dialogue'
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type DictationType = 'word' | 'phrase' | 'short_sentence' | 'complex_sentence' | 'short_paragraph' | 'long_paragraph'
export type FillBlankType = 'verbs' | 'prepositions' | 'vocabulary' | 'mixed'
export type DialogueType = 'daily' | 'service' | 'business' | 'debate'

/* ─── Content Types ─────────────────────────────────────────── */

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
  linking_rules?: LinkingRule[]
}

export interface LinkingRule {
  phrase: string
  sounds_like: string
  explanation_vi: string
}

export interface FillBlankContent {
  passage: string
  full_text?: string
  passage_translation_vi: string
  blanks: FillBlankItem[]
  word_count: number
  difficulty_note_vi: string
  key_vocabulary: KeyVocabulary[]
}

export interface FillBlankItem {
  index: number
  answer: string
  hint_vi?: string
  word_type: string  // 'verb' | 'preposition' | 'noun' | 'adjective'
}

export interface DialogueLine {
  speaker: 'A' | 'B'
  text: string
}

export interface DialogueQuestion {
  question: string
  question_vi: string
  type: 'multiple_choice' | 'true_false'
  options?: string[]
  answer: string
  explanation_vi?: string
}

export interface DialogueContent {
  scenario: string
  scenario_vi: string
  speaker_a: string  // "Hotel Receptionist"
  speaker_b: string  // "Guest"
  dialogue: DialogueLine[]
  questions: DialogueQuestion[]
  word_count: number
  key_vocabulary: KeyVocabulary[]
}

/* ─── Result Types ──────────────────────────────────────────── */

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
  linking_rules_vi?: LinkingRule[]
  score: number
  xp_earned: number
}

export interface FillBlankResult {
  score: number
  total_blanks: number
  correct_blanks: number
  answers: {
    blank_index: number
    expected: string
    user_answer: string
    is_correct: boolean
    feedback_vi: string
  }[]
  overall_feedback_vi: string
  xp_earned: number
}

export interface DialogueResult {
  score: number
  answers: {
    question_index: number
    is_correct: boolean
    user_answer: string
    correct_answer: string
    feedback_vi: string
  }[]
  overall_feedback_vi: string
  xp_earned: number
}

export type ExerciseContent = DictationContent | FillBlankContent | DialogueContent
export type ExerciseResult = DictationResult | FillBlankResult | DialogueResult

/* ─── Store Types ──────────────────────────────────────────── */

export interface ListeningUsage {
  exercisesToday: number
  maxExercises: number
  remaining: number
}

export interface SavedBatchSession {
  id: string
  mode: ListeningMode
  exercise_type: string
  level: CEFRLevel
  topic: string
  current_index: number
  total_count: number
  created_at: string
}

interface BatchItem {
  content: ExerciseContent
  exerciseLibraryId: string | null
  source: 'cache' | 'ai'
}

/* ─── Config Options ────────────────────────────────────────── */

export const DICTATION_TYPES: { id: DictationType; label: string; levels: CEFRLevel[] }[] = [
  { id: 'word', label: 'Từ vựng', levels: ['A1'] },
  { id: 'phrase', label: 'Cụm từ', levels: ['A1', 'A2'] },
  { id: 'short_sentence', label: 'Câu ngắn', levels: ['A2', 'B1'] },
  { id: 'complex_sentence', label: 'Câu phức', levels: ['B1', 'B2'] },
  { id: 'short_paragraph', label: 'Đoạn ngắn', levels: ['B2', 'C1'] },
  { id: 'long_paragraph', label: 'Đoạn dài', levels: ['C1', 'C2'] },
]

export const FILL_BLANK_TYPES: { id: FillBlankType; label: string; levels: CEFRLevel[] }[] = [
  { id: 'verbs', label: 'Động từ', levels: ['A1', 'A2', 'B1'] },
  { id: 'prepositions', label: 'Giới từ', levels: ['A2', 'B1', 'B2'] },
  { id: 'vocabulary', label: 'Từ vựng mới', levels: ['B1', 'B2', 'C1'] },
  { id: 'mixed', label: 'Hỗn hợp', levels: ['B1', 'B2', 'C1', 'C2'] },
]

export const DIALOGUE_TYPES: { id: DialogueType; label: string; levels: CEFRLevel[] }[] = [
  { id: 'daily', label: 'Đời thường', levels: ['A1', 'A2', 'B1'] },
  { id: 'service', label: 'Dịch vụ', levels: ['A2', 'B1', 'B2'] },
  { id: 'business', label: 'Công sở', levels: ['B1', 'B2', 'C1'] },
  { id: 'debate', label: 'Tranh luận', levels: ['B2', 'C1', 'C2'] },
]

export const TOPICS = [
  'Daily Life', 'Travel', 'Technology', 'Business',
  'Science', 'Education', 'Culture', 'Health',
  'Environment', 'Sports', 'Food', 'Entertainment',
]

export const MODE_OPTIONS = [
  { id: 'dictation' as ListeningMode, label: 'Nghe chép', desc: 'Nghe & viết lại chính xác', emoji: '✍️' },
  { id: 'fill_blank' as ListeningMode, label: 'Điền từ', desc: 'Nghe & điền từ vào chỗ trống', emoji: '📝' },
  { id: 'dialogue' as ListeningMode, label: 'Hội thoại', desc: 'Nghe hội thoại & trả lời câu hỏi', emoji: '💬' },
]

/* ===== Store ===== */

type ExercisePhase = 'config' | 'exercise' | 'result'

interface ListeningState {
  // Config
  mode: ListeningMode
  level: CEFRLevel
  exerciseType: string
  topic: string
  playbackSpeed: number

  // Batch
  phase: ExercisePhase
  batchSize: number
  batchItems: BatchItem[]
  currentBatchIndex: number
  sessionId: string | null
  content: ExerciseContent | null
  exerciseLibraryId: string | null
  generating: boolean
  evaluating: boolean
  replayCount: number
  maxReplays: number

  // Results
  result: ExerciseResult | null

  // Sessions
  activeSessions: SavedBatchSession[]
  loadingSession: boolean

  // Usage
  usage: ListeningUsage | null

  // Error
  error: string | null

  // ─── Actions ─────────────────────────────────────
  setMode: (mode: ListeningMode) => void
  setLevel: (level: CEFRLevel) => void
  setExerciseType: (type: string) => void
  setTopic: (topic: string) => void
  setBatchSize: (size: number) => void
  setPlaybackSpeed: (speed: number) => void

  generateExercise: () => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  submitAnswer: (answer: string | string[] | Record<string, string>) => Promise<void>
  advanceToNext: () => boolean
  incrementReplay: () => void
  reset: () => void
  clearError: () => void

  loadActiveSessions: () => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
}

const MAX_SESSIONS_PER_MODE = 3
const DEFAULT_BATCH_SIZE = 3

export const useListeningStore = create<ListeningState>((set, get) => ({
  // Defaults
  mode: 'dictation',
  level: 'B1',
  exerciseType: 'short_sentence',
  topic: '',
  playbackSpeed: 1.0,

  phase: 'config',
  batchSize: DEFAULT_BATCH_SIZE,
  batchItems: [],
  currentBatchIndex: 0,
  sessionId: null,
  content: null,
  exerciseLibraryId: null,
  generating: false,
  evaluating: false,
  replayCount: 0,
  maxReplays: 3,

  result: null,

  activeSessions: [],
  loadingSession: false,

  usage: null,
  error: null,

  // ─── Config Setters ─────────────────────────────────
  setMode: (mode) => {
    const defaultTypes: Record<ListeningMode, string> = {
      dictation: 'short_sentence',
      fill_blank: 'mixed',
      dialogue: 'daily',
    }
    set({ mode, exerciseType: defaultTypes[mode] })
  },
  setLevel: (level) => set({ level }),
  setExerciseType: (type) => set({ exerciseType: type }),
  setTopic: (topic) => set({ topic }),
  setBatchSize: (size) => set({ batchSize: Math.max(1, Math.min(5, size)) }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  // ─── Generate ─────────────────────────────────────────
  generateExercise: async () => {
    const { mode, exerciseType, level, topic, activeSessions, batchSize } = get()

    // Check max 3 sessions per mode
    const sessionsForMode = activeSessions.filter(s => s.mode === mode)
    if (sessionsForMode.length >= MAX_SESSIONS_PER_MODE) {
      set({ error: `Bạn đã lưu tối đa ${MAX_SESSIONS_PER_MODE} phiên cho chế độ này. Hãy xóa bớt phiên cũ để tạo mới.` })
      return
    }

    set({
      generating: true, error: null, content: null, exerciseLibraryId: null,
      result: null, replayCount: 0,
      batchItems: [], currentBatchIndex: 0, sessionId: null,
    })

    try {
      // Determine endpoint based on mode
      let endpoint = 'generate-exercise'
      if (mode === 'fill_blank') endpoint = 'generate-fill-blank'
      else if (mode === 'dialogue') endpoint = 'generate-dialogue'

      // Call API batchSize times in parallel with unique variation index
      const promises = Array.from({ length: batchSize }, (_, i) =>
        invokeWritingApi<{
          exercises: Array<{
            content: ExerciseContent
            exercise_library_id: string | null
            source: 'cache' | 'ai'
          }>
          usage: ListeningUsage
        }>(endpoint, {
          mode,
          exercise_type: exerciseType,
          level,
          topic: topic || undefined,
          variation_index: i + 1,
          batch_total: batchSize,
        })
      )

      const results = await Promise.allSettled(promises)

      // Collect successful exercises
      const items: BatchItem[] = []
      let lastUsage: ListeningUsage | null = null

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.data?.exercises) {
          for (const ex of r.value.data.exercises) {
            items.push({
              content: ex.content,
              exerciseLibraryId: ex.exercise_library_id || null,
              source: ex.source || 'ai',
            })
          }
          if (r.value.data.usage) lastUsage = r.value.data.usage
        }
      }

      if (items.length === 0) {
        set({ generating: false, error: 'Không thể tạo bài tập. Vui lòng thử lại.' })
        return
      }

      // Save session to DB
      const normalizedTopic = topic || 'General'
      const { data: session, error: sessionError } = await supabase
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

      if (sessionError) {
        console.error('[listeningStore] Failed to save session:', sessionError)
      }

      set({
        generating: false,
        batchItems: items,
        currentBatchIndex: 0,
        sessionId: session?.id || null,
        content: items[0].content,
        exerciseLibraryId: items[0].exerciseLibraryId,
        phase: 'exercise',
        usage: lastUsage,
      })

      // Reload sessions list so UI stays in sync
      get().loadActiveSessions()
    } catch (err) {
      console.error('[listeningStore] generateExercise:', err)
      set({ generating: false, error: (err as Error).message })
    }
  },

  // ─── Resume ─────────────────────────────────────────
  resumeSession: async (sessionId) => {
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
        await supabase.from('listening_batch_sessions').delete().eq('id', sessionId)
        set({ loadingSession: false, error: 'Phiên học đã hoàn thành.' })
        return
      }

      set({
        loadingSession: false,
        mode: session.mode as ListeningMode,
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
        result: null,
      })
    } catch (err) {
      console.error('[listeningStore] resumeSession:', err)
      set({ loadingSession: false, error: (err as Error).message })
    }
  },

  // ─── Submit ─────────────────────────────────────────
  submitAnswer: async (answer) => {
    const { mode, exerciseType, level, topic, content, playbackSpeed, replayCount, exerciseLibraryId } = get()
    if (!content) return

    set({ evaluating: true, error: null })

    try {
      let endpoint = 'evaluate-exercise'
      if (mode === 'fill_blank') endpoint = 'evaluate-fill-blank'
      else if (mode === 'dialogue') endpoint = 'evaluate-dialogue'

      const { data, error } = await invokeWritingApi<ExerciseResult>(endpoint, {
        mode,
        exercise_type: exerciseType,
        level,
        topic,
        content,
        user_answer: answer,
        playback_speed: playbackSpeed,
        replay_count: replayCount,
        exercise_library_id: exerciseLibraryId,
      })

      if (error) {
        set({ evaluating: false, error })
        return
      }

      if (!data) {
        set({ evaluating: false, error: 'Empty evaluation response' })
        return
      }

      set({ evaluating: false, result: data, phase: 'result' })
    } catch (err) {
      console.error('[listeningStore] submitAnswer:', err)
      set({ evaluating: false, error: (err as Error).message })
    }
  },

  // ─── Advance ─────────────────────────────────────────
  advanceToNext: () => {
    const { batchItems, currentBatchIndex, sessionId } = get()
    const nextIdx = currentBatchIndex + 1

    if (nextIdx >= batchItems.length) {
      // Mark session as completed but DON'T delete — user can redo
      if (sessionId) {
        supabase.from('listening_batch_sessions')
          .update({ current_index: 0, updated_at: new Date().toISOString() })
          .eq('id', sessionId)
          .then(() => {})
      }
      set({ sessionId: null })
      return false
    }

    const nextItem = batchItems[nextIdx]

    if (sessionId) {
      supabase.from('listening_batch_sessions')
        .update({ current_index: nextIdx, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then(() => {})
    }

    set({
      currentBatchIndex: nextIdx,
      content: nextItem.content,
      exerciseLibraryId: nextItem.exerciseLibraryId,
      phase: 'exercise',
      replayCount: 0,
      result: null,
      error: null,
    })
    return true
  },

  incrementReplay: () => set((s) => ({ replayCount: s.replayCount + 1 })),

  reset: () => set({
    phase: 'config',
    batchItems: [],
    currentBatchIndex: 0,
    sessionId: null,
    content: null,
    exerciseLibraryId: null,
    generating: false,
    evaluating: false,
    replayCount: 0,
    result: null,
    error: null,
  }),

  clearError: () => set({ error: null }),

  // ─── Sessions ─────────────────────────────────────────
  loadActiveSessions: async () => {
    try {
      const { data, error } = await supabase
        .from('listening_batch_sessions')
        .select('id, mode, exercise_type, level, topic, current_index, total_count, created_at')
        .order('updated_at', { ascending: false })
        .limit(30)

      if (error) {
        console.error('[listeningStore] loadActiveSessions:', error)
        return
      }

      set({ activeSessions: (data || []) as SavedBatchSession[] })
    } catch (err) {
      console.error('[listeningStore] loadActiveSessions:', err)
    }
  },

  deleteSession: async (sessionId) => {
    if (!confirm('Xóa phiên này? Bài tập sẽ bị mất vĩnh viễn.')) return

    try {
      const { error } = await supabase
        .from('listening_batch_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) {
        console.error('[listeningStore] deleteSession error:', error)
        set({ error: 'Không thể xóa phiên. Vui lòng thử lại.' })
        return
      }

      // Reload from DB to ensure consistency
      get().loadActiveSessions()
    } catch (err) {
      console.error('[listeningStore] deleteSession:', err)
    }
  },
}))
