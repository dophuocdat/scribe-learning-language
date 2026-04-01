import { create } from 'zustand'
import { invokeWritingApi } from '@/shared/lib/edgeFunctions'
import { supabase } from '@/shared/lib/supabase'

// ─── Types ───

export type WritingMode = 'sentence_building' | 'paraphrase' | 'essay'
export type WritingPhase = 'config' | 'exercise' | 'result'
export type EssayType = 'email' | 'paragraph' | 'essay'

export interface SentenceBuildingItem {
  correct_sentence: string
  words_shuffled: string[]
  distractors: string[]
  grammar_hint_vi: string
  translation_vi: string
}

export interface ParaphraseItem {
  original: string
  hint_vi: string
  hint_style: string
  example_rewrites: string[]
  key_structures: string[]
}

export interface EssayPrompt {
  prompt_en: string
  prompt_vi: string
  essay_type: EssayType
  word_limit_min: number
  word_limit_max: number
  hints_vi: string[]
  useful_phrases: string[]
}

export interface SentenceEvalResult {
  is_correct: boolean
  correct_sentence: string
  user_answer: string
  xp_earned: number
  feedback_vi: string
}

export interface ParaphraseEvalResult {
  meaning_score: number
  naturalness_score: number
  level_upgrade_score: number
  overall_score: number
  is_correct: boolean
  feedback_vi: string
  corrections: { type: string; issue: string; suggestion: string; explanation_vi: string }[]
  better_alternatives: string[]
  xp_earned: number
}

export interface EssayEvalResult {
  task_response: number
  grammar_score: number
  vocabulary_score: number
  coherence_score: number
  overall_score: number
  band_estimate: string
  feedback_vi: string
  corrections: { original: string; corrected: string; type: string; explanation_vi: string }[]
  better_vocab: { original_word: string; better_word: string; context: string; explanation_vi: string }[]
  structure_feedback_vi: string
  xp_earned: number
  word_count: number
}

export interface SavedWritingSession {
  id: string
  mode: WritingMode
  level: string
  topic: string
  batch_items: any[]
  current_index: number
  total_count: number
  updated_at: string
}

// ─── Store ───

interface WritingState {
  phase: WritingPhase
  mode: WritingMode
  level: string
  topic: string
  essayType: EssayType
  batchSize: number
  loading: boolean
  evaluating: boolean
  error: string | null

  // Batch
  batchItems: any[]
  currentBatchIndex: number

  // Current content
  content: any | null
  evalResult: any | null

  // Sentence building state
  userSentence: string[]

  // Paraphrase state
  userRewrite: string

  // Essay state
  userEssay: string

  // Sessions
  sessions: SavedWritingSession[]

  // Actions
  setMode: (mode: WritingMode) => void
  setLevel: (level: string) => void
  setTopic: (topic: string) => void
  setEssayType: (type: EssayType) => void
  setBatchSize: (size: number) => void
  clearError: () => void

  generateExercise: () => Promise<void>
  submitSentence: (answer: string) => Promise<void>
  submitParaphrase: () => Promise<void>
  submitEssay: () => Promise<void>

  setUserSentence: (words: string[]) => void
  setUserRewrite: (text: string) => void
  setUserEssay: (text: string) => void

  nextInBatch: () => void
  resetToConfig: () => void

  loadSessions: () => Promise<void>
  resumeSession: (session: SavedWritingSession) => void
  deleteSession: (id: string) => Promise<void>
}

export const useWritingStore = create<WritingState>((set, get) => ({
  phase: 'config',
  mode: 'sentence_building',
  level: 'A2',
  topic: 'General',
  essayType: 'paragraph',
  batchSize: 3,
  loading: false,
  evaluating: false,
  error: null,

  batchItems: [],
  currentBatchIndex: 0,

  content: null,
  evalResult: null,

  userSentence: [],
  userRewrite: '',
  userEssay: '',

  sessions: [],

  setMode: (mode) => set({ mode }),
  setLevel: (level) => set({ level }),
  setTopic: (topic) => set({ topic }),
  setEssayType: (essayType) => set({ essayType }),
  setBatchSize: (batchSize) => set({ batchSize }),
  clearError: () => set({ error: null }),

  generateExercise: async () => {
    const { mode, level, topic, batchSize, essayType } = get()
    set({ loading: true, error: null })

    try {
      let items: any[] = []

      if (mode === 'sentence_building') {
        const { data } = await invokeWritingApi<{ exercises: SentenceBuildingItem[] }>('generate-sentence-building', {
          level, topic, count: batchSize, variation_index: Math.floor(Math.random() * 100),
        })
        items = data?.exercises || []
      } else if (mode === 'paraphrase') {
        const { data } = await invokeWritingApi<{ exercises: ParaphraseItem[] }>('generate-paraphrase-exercise', {
          level, topic, count: batchSize, variation_index: Math.floor(Math.random() * 100),
        })
        items = data?.exercises || []
      } else if (mode === 'essay') {
        const { data } = await invokeWritingApi<EssayPrompt>('generate-essay-prompt', {
          level, topic, essay_type: essayType, variation_index: Math.floor(Math.random() * 100),
        })
        if (data) items = [data]
      }

      if (items.length === 0) throw new Error('Không thể tạo bài tập')

      // Save session
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('writing_batch_sessions').insert({
          mode, level, topic,
          exercise_type: mode === 'essay' ? essayType : mode,
          batch_items: items,
          current_index: 0,
          total_count: items.length,
        })
      }

      set({
        batchItems: items,
        currentBatchIndex: 0,
        content: items[0],
        phase: 'exercise',
        loading: false,
        evalResult: null,
        userSentence: [],
        userRewrite: '',
        userEssay: '',
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  submitSentence: async (answer: string) => {
    const { content } = get()
    if (!content) return
    set({ evaluating: true, error: null })
    try {
      const { data } = await invokeWritingApi<SentenceEvalResult>('evaluate-sentence', {
        correct_sentence: content.correct_sentence,
        user_answer: answer,
      })
      set({ evalResult: data, phase: 'result', evaluating: false })
    } catch (err) {
      set({ error: (err as Error).message, evaluating: false })
    }
  },

  submitParaphrase: async () => {
    const { content, userRewrite } = get()
    if (!content || !userRewrite.trim()) return
    set({ evaluating: true, error: null })
    try {
      const { data } = await invokeWritingApi<ParaphraseEvalResult>('evaluate-paraphrase', {
        original: content.original,
        user_rewrite: userRewrite.trim(),
      })
      set({ evalResult: data, phase: 'result', evaluating: false })
    } catch (err) {
      set({ error: (err as Error).message, evaluating: false })
    }
  },

  submitEssay: async () => {
    const { content, userEssay, level } = get()
    if (!content || !userEssay.trim()) return
    set({ evaluating: true, error: null })
    try {
      const { data } = await invokeWritingApi<EssayEvalResult>('evaluate-essay', {
        prompt_text: content.prompt_en,
        user_essay: userEssay.trim(),
        level,
      })
      set({ evalResult: data, phase: 'result', evaluating: false })
    } catch (err) {
      set({ error: (err as Error).message, evaluating: false })
    }
  },

  setUserSentence: (words) => set({ userSentence: words }),
  setUserRewrite: (text) => set({ userRewrite: text }),
  setUserEssay: (text) => set({ userEssay: text }),

  nextInBatch: () => {
    const { batchItems, currentBatchIndex } = get()
    const nextIdx = currentBatchIndex + 1
    if (nextIdx < batchItems.length) {
      set({
        currentBatchIndex: nextIdx,
        content: batchItems[nextIdx],
        phase: 'exercise',
        evalResult: null,
        userSentence: [],
        userRewrite: '',
        userEssay: '',
      })
    }
  },

  resetToConfig: () => {
    set({
      phase: 'config',
      content: null,
      evalResult: null,
      batchItems: [],
      currentBatchIndex: 0,
      userSentence: [],
      userRewrite: '',
      userEssay: '',
      error: null,
    })
    get().loadSessions()
  },

  loadSessions: async () => {
    try {
      const { data } = await supabase
        .from('writing_batch_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20)
      if (data) set({ sessions: data as SavedWritingSession[] })
    } catch { /* ignore */ }
  },

  resumeSession: (session) => {
    set({
      mode: session.mode as WritingMode,
      level: session.level,
      topic: session.topic,
      batchItems: session.batch_items,
      currentBatchIndex: session.current_index,
      content: session.batch_items[session.current_index],
      phase: 'exercise',
      evalResult: null,
      userSentence: [],
      userRewrite: '',
      userEssay: '',
    })
  },

  deleteSession: async (id) => {
    await supabase.from('writing_batch_sessions').delete().eq('id', id)
    get().loadSessions()
  },
}))
