import { create } from 'zustand'
import { invokeAiApi } from '@/shared/lib/edgeFunctions'

/* eslint-disable @typescript-eslint/no-explicit-any */

// AI-generated types (before saving to DB — no id/lesson_id)
export interface GeneratedVocabulary {
  word: string
  ipa_pronunciation: string | null
  part_of_speech: string | null
  definition_en: string | null
  definition_vi: string | null
  example_sentence: string | null
  difficulty_rank: number | null
  selected?: boolean // for UI toggle
}

export interface GeneratedQuestion {
  question_text: string
  question_type: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  order_index: number
  selected?: boolean
}

interface AIState {
  isGenerating: boolean
  generatedVocabulary: GeneratedVocabulary[] | null
  generatedQuestions: GeneratedQuestion[] | null
  generatedSummary: string | null
  error: string | null

  generateVocabulary: (text: string, difficulty?: string, maxItems?: number) => Promise<void>
  generateQuiz: (text: string, vocabContext?: string[], questionCount?: number) => Promise<void>
  generateSummary: (text: string) => Promise<void>
  generateAll: (text: string) => Promise<void>

  toggleVocabSelection: (index: number) => void
  toggleQuestionSelection: (index: number) => void
  selectAllVocab: (selected: boolean) => void
  selectAllQuestions: (selected: boolean) => void

  clearGenerated: () => void
  clearVocabulary: () => void
  clearQuestions: () => void
  clearSummary: () => void
}

// Use shared helper — alias for backward compat
const aiApi = invokeAiApi

export const useAIStore = create<AIState>((set, get) => ({
  isGenerating: false,
  generatedVocabulary: null,
  generatedQuestions: null,
  generatedSummary: null,
  error: null,

  generateVocabulary: async (text, difficulty, maxItems) => {
    set({ isGenerating: true, error: null })
    const { data, error } = await aiApi<{ vocabulary: GeneratedVocabulary[] }>(
      'generate-vocabulary',
      { text, difficulty, maxItems }
    )
    if (error) {
      set({ isGenerating: false, error })
      return
    }
    const vocab = (data?.vocabulary || []).map(v => ({ ...v, selected: true }))
    set({ isGenerating: false, generatedVocabulary: vocab })
  },

  generateQuiz: async (text, vocabContext, questionCount) => {
    set({ isGenerating: true, error: null })
    const { data, error } = await aiApi<{ questions: GeneratedQuestion[] }>(
      'generate-quiz',
      { text, vocabContext, questionCount }
    )
    if (error) {
      set({ isGenerating: false, error })
      return
    }
    const questions = (data?.questions || []).map(q => ({ ...q, selected: true }))
    set({ isGenerating: false, generatedQuestions: questions })
  },

  generateSummary: async (text) => {
    set({ isGenerating: true, error: null })
    const { data, error } = await aiApi<{ summary: string }>(
      'generate-summary',
      { text }
    )
    if (error) {
      set({ isGenerating: false, error })
      return
    }
    set({ isGenerating: false, generatedSummary: data?.summary || '' })
  },

  generateAll: async (text) => {
    set({ isGenerating: true, error: null })
    const { data, error } = await aiApi<{
      vocabulary: GeneratedVocabulary[]
      questions: GeneratedQuestion[]
      summary: string
    }>('generate-all', { text })

    if (error) {
      set({ isGenerating: false, error })
      return
    }

    const vocab = (data?.vocabulary || []).map(v => ({ ...v, selected: true }))
    const questions = (data?.questions || []).map(q => ({ ...q, selected: true }))

    set({
      isGenerating: false,
      generatedVocabulary: vocab,
      generatedQuestions: questions,
      generatedSummary: data?.summary || '',
    })
  },

  toggleVocabSelection: (index) => {
    const vocab = get().generatedVocabulary
    if (!vocab) return
    const updated = [...vocab]
    updated[index] = { ...updated[index], selected: !updated[index].selected }
    set({ generatedVocabulary: updated })
  },

  toggleQuestionSelection: (index) => {
    const questions = get().generatedQuestions
    if (!questions) return
    const updated = [...questions]
    updated[index] = { ...updated[index], selected: !updated[index].selected }
    set({ generatedQuestions: updated })
  },

  selectAllVocab: (selected) => {
    const vocab = get().generatedVocabulary
    if (!vocab) return
    set({ generatedVocabulary: vocab.map(v => ({ ...v, selected })) })
  },

  selectAllQuestions: (selected) => {
    const questions = get().generatedQuestions
    if (!questions) return
    set({ generatedQuestions: questions.map(q => ({ ...q, selected })) })
  },

  clearGenerated: () => set({
    generatedVocabulary: null,
    generatedQuestions: null,
    generatedSummary: null,
    error: null,
  }),

  clearVocabulary: () => set({ generatedVocabulary: null }),
  clearQuestions: () => set({ generatedQuestions: null }),
  clearSummary: () => set({ generatedSummary: null }),
}))
