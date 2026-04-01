import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import { invokeWritingApi } from '@/shared/lib/edgeFunctions'

// ─── Types ─────────────────────────────────────────────

export type SpeakingMode = 'pronunciation' | 'shadowing'

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type SpeakingPhase = 'config' | 'exercise' | 'result'

export interface PronunciationContent {
  sentence: string
  sentence_vi: string
  phonetic_guide: string   // IPA
  key_sounds: { sound: string; tip_vi: string; ipa: string }[]
  difficulty_note_vi: string
}

export interface ShadowingContent {
  sentence: string
  sentence_vi: string
  stress_pattern: string   // e.g. "I'd LIKE to ORDER a LARGE coffee"
  speed_wpm: number
  phonetic_guide: string
  key_sounds: { sound: string; tip_vi: string; ipa: string }[]
  difficulty_note_vi: string
}

export type ExerciseContent = PronunciationContent | ShadowingContent

export interface PronunciationResult {
  score: number
  word_results: {
    word: string
    user_word: string
    correct: boolean
    ipa?: string
    tip_vi?: string
  }[]
  overall_feedback_vi: string
  xp_earned: number
}

export interface ShadowingResult {
  accuracy_score: number
  fluency_score: number
  overall_score: number
  word_results: {
    word: string
    user_word: string
    correct: boolean
  }[]
  fluency_feedback_vi: string
  overall_feedback_vi: string
  xp_earned: number
}

export type EvaluationResult = PronunciationResult | ShadowingResult

export interface SavedBatchSession {
  id: string
  mode: SpeakingMode
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
}

// ─── Store ─────────────────────────────────────────────

interface SpeakingStore {
  // Phase
  phase: SpeakingPhase
  mode: SpeakingMode
  level: CEFRLevel
  topic: string
  batchSize: number

  // Exercise state
  content: ExerciseContent | null
  result: EvaluationResult | null
  loading: boolean
  evaluating: boolean
  error: string | null

  // Batch
  batchItems: BatchItem[]
  currentBatchIndex: number
  currentSessionId: string | null

  // Sessions
  activeSessions: SavedBatchSession[]

  // Actions
  setConfig: (mode: SpeakingMode, level: CEFRLevel, topic: string) => void
  setBatchSize: (size: number) => void
  generateExercise: () => Promise<void>
  submitAnswer: (userTranscript: string) => Promise<void>
  nextInBatch: () => void
  resetToConfig: () => void
  clearError: () => void

  // Sessions
  loadActiveSessions: () => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
}

export const useSpeakingStore = create<SpeakingStore>((set, get) => ({
  phase: 'config',
  mode: 'pronunciation',
  level: 'A2',
  topic: 'Daily Life',
  batchSize: 3,

  content: null,
  result: null,
  loading: false,
  evaluating: false,
  error: null,

  batchItems: [],
  currentBatchIndex: 0,
  currentSessionId: null,

  activeSessions: [],

  // ─── Config ──────────────────────────────────────────

  setConfig: (mode, level, topic) => set({ mode, level, topic }),

  setBatchSize: (size) => set({ batchSize: Math.max(1, Math.min(5, size)) }),

  // ─── Generate ────────────────────────────────────────

  generateExercise: async () => {
    const { mode, level, topic, batchSize } = get()
    set({ loading: true, error: null })

    try {
      const endpoint = mode === 'pronunciation'
        ? 'generate-pronunciation'
        : 'generate-shadowing'

      // Parallel generation with variation
      const promises = Array.from({ length: batchSize }, (_, i) =>
        invokeWritingApi<{
          exercises: Array<{
            content: ExerciseContent
            exercise_library_id: string | null
            source: string
          }>
          usage: unknown
        }>(endpoint, {
          mode,
          exercise_type: 'sentence',
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
        set({ loading: false, error: 'Không thể tạo bài tập. Vui lòng thử lại.' })
        return
      }

      // Save session to DB
      let sessionId: string | null = null
      try {
        const { data, error } = await supabase
          .from('speaking_batch_sessions')
          .insert({
            mode,
            exercise_type: 'sentence',
            level,
            topic: topic || 'General',
            batch_items: items.map(it => it.content),
            current_index: 0,
            total_count: items.length,
          })
          .select('id')
          .single()

        if (!error && data) {
          sessionId = data.id
        } else {
          console.error('[speakingStore] Failed to save session:', error)
        }
      } catch (err) {
        console.error('[speakingStore] Session save error:', err)
      }

      set({
        batchItems: items,
        currentBatchIndex: 0,
        currentSessionId: sessionId,
        content: items[0].content,
        result: null,
        phase: 'exercise',
        loading: false,
      })

      // Reload sessions list
      get().loadActiveSessions()
    } catch (err) {
      console.error('[speakingStore] Generate error:', err)
      set({
        loading: false,
        error: `Lỗi tạo bài tập: ${(err as Error).message}`,
      })
    }
  },

  // ─── Submit ──────────────────────────────────────────

  submitAnswer: async (userTranscript: string) => {
    const { mode, content, currentSessionId, currentBatchIndex } = get()
    if (!content) return

    set({ evaluating: true, error: null })

    try {
      const endpoint = mode === 'pronunciation'
        ? 'evaluate-pronunciation'
        : 'evaluate-shadowing'

      const { data: response, error: apiError } = await invokeWritingApi(endpoint, {
        original_text: (content as PronunciationContent).sentence,
        user_transcript: userTranscript,
      })

      if (apiError || !response) {
        set({ evaluating: false, error: apiError || 'Lỗi chấm điểm' })
        return
      }

      // Update session progress
      if (currentSessionId) {
        try {
          await supabase
            .from('speaking_batch_sessions')
            .update({
              current_index: currentBatchIndex + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSessionId)
        } catch { /* ignore */ }
      }

      set({
        result: response as EvaluationResult,
        evaluating: false,
        phase: 'result',
      })
    } catch (err) {
      console.error('[speakingStore] Evaluate error:', err)
      set({
        evaluating: false,
        error: `Lỗi chấm điểm: ${(err as Error).message}`,
      })
    }
  },

  // ─── Batch Navigation ────────────────────────────────

  nextInBatch: () => {
    const { batchItems, currentBatchIndex } = get()
    const nextIdx = currentBatchIndex + 1

    if (nextIdx >= batchItems.length) {
      // Finished all items — back to config
      set({
        phase: 'config',
        content: null,
        result: null,
        batchItems: [],
        currentBatchIndex: 0,
        currentSessionId: null,
      })
      get().loadActiveSessions()
      return
    }

    set({
      currentBatchIndex: nextIdx,
      content: batchItems[nextIdx].content,
      result: null,
      phase: 'exercise',
    })
  },

  // ─── Reset ───────────────────────────────────────────

  resetToConfig: () => set({
    phase: 'config',
    content: null,
    result: null,
    loading: false,
    evaluating: false,
    error: null,
    batchItems: [],
    currentBatchIndex: 0,
    currentSessionId: null,
  }),

  clearError: () => set({ error: null }),

  // ─── Sessions ────────────────────────────────────────

  loadActiveSessions: async () => {
    try {
      const { data, error } = await supabase
        .from('speaking_batch_sessions')
        .select('id, mode, exercise_type, level, topic, current_index, total_count, created_at')
        .order('updated_at', { ascending: false })
        .limit(30)

      if (error) {
        console.error('[speakingStore] loadActiveSessions:', error)
        return
      }

      set({ activeSessions: (data || []) as SavedBatchSession[] })
    } catch (err) {
      console.error('[speakingStore] loadActiveSessions:', err)
    }
  },

  resumeSession: async (sessionId: string) => {
    set({ loading: true, error: null })

    try {
      const { data, error } = await supabase
        .from('speaking_batch_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        set({ loading: false, error: 'Không tìm thấy phiên.' })
        return
      }

      const items: BatchItem[] = (data.batch_items as ExerciseContent[]).map(c => ({
        content: c,
        exerciseLibraryId: null,
      }))

      const idx = Math.min(data.current_index, items.length - 1)

      set({
        mode: data.mode as SpeakingMode,
        level: data.level as CEFRLevel,
        topic: data.topic || 'General',
        batchItems: items,
        currentBatchIndex: idx,
        currentSessionId: sessionId,
        content: items[idx].content,
        result: null,
        phase: 'exercise',
        loading: false,
      })
    } catch (err) {
      console.error('[speakingStore] resumeSession:', err)
      set({ loading: false, error: 'Lỗi tải phiên.' })
    }
  },

  deleteSession: async (sessionId: string) => {
    if (!confirm('Xóa phiên này? Bài tập sẽ bị mất vĩnh viễn.')) return

    try {
      const { error } = await supabase
        .from('speaking_batch_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) {
        console.error('[speakingStore] deleteSession error:', error)
        set({ error: 'Không thể xóa phiên. Vui lòng thử lại.' })
        return
      }

      get().loadActiveSessions()
    } catch (err) {
      console.error('[speakingStore] deleteSession:', err)
    }
  },
}))
