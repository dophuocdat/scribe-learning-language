import { create } from 'zustand'
import { invokeWritingApi } from '@/shared/lib/edgeFunctions'

/* ===== Types ===== */

export interface GrammarIssue {
  type: 'grammar' | 'spelling' | 'punctuation' | 'style' | 'clarity'
  original: string
  replacement: string
  explanation_vi: string
  position: { start: number; end: number }
}

export interface GrammarResult {
  issues: GrammarIssue[]
  corrected_text: string
  quality_score: number
  summary_vi: string
}

export interface PlagiarismFlag {
  text: string
  type: 'likely_copied' | 'needs_citation' | 'paraphrased' | 'ai_generated'
  confidence: number
  suggestion_vi: string
  position: { start: number; end: number }
}

export interface PlagiarismResult {
  originality_score: number
  flags: PlagiarismFlag[]
  summary_vi: string
}

export interface WritingUsage {
  checksToday: number
  maxChecks: number
  remainingChecks: number
}

export interface WritingUsageStatus {
  grammar: WritingUsage
  plagiarism: WritingUsage
  paraphrase: WritingUsage
}

export type ParaphraseMode = 'standard' | 'formal' | 'simple' | 'creative' | 'academic' | 'shorten' | 'expand'

export interface ParaphraseResult {
  paraphrased_text: string
  changes_summary_vi: string
  difference_score: number
  word_count_original: number
  word_count_paraphrased: number
  mode: ParaphraseMode
}

/* ===== Store ===== */

interface WritingToolsState {
  // Grammar
  grammarText: string
  grammarResult: GrammarResult | null
  checkingGrammar: boolean

  // Plagiarism
  plagiarismText: string
  plagiarismResult: PlagiarismResult | null
  checkingPlagiarism: boolean

  // Paraphrase
  paraphraseText: string
  paraphraseResult: ParaphraseResult | null
  paraphrasing: boolean
  paraphraseMode: ParaphraseMode

  // Usage
  usageStatus: WritingUsageStatus | null
  loadingStatus: boolean

  // Error
  error: string | null

  // Actions
  setGrammarText: (text: string) => void
  setPlagiarismText: (text: string) => void
  setParaphraseMode: (mode: ParaphraseMode) => void
  checkGrammar: (text: string) => Promise<GrammarResult | null>
  checkPlagiarism: (text: string) => Promise<PlagiarismResult | null>
  paraphrase: (text: string, mode: ParaphraseMode) => Promise<ParaphraseResult | null>
  applyGrammarFix: (issueIndex: number) => void
  applyAllFixes: () => void
  fetchUsageStatus: () => Promise<void>
  clearGrammarResult: () => void
  clearPlagiarismResult: () => void
  clearParaphraseResult: () => void
  clearError: () => void
}

export const useWritingToolsStore = create<WritingToolsState>((set, get) => ({
  grammarText: '',
  grammarResult: null,
  checkingGrammar: false,

  plagiarismText: '',
  plagiarismResult: null,
  checkingPlagiarism: false,

  paraphraseText: '',
  paraphraseResult: null,
  paraphrasing: false,
  paraphraseMode: 'standard',

  usageStatus: null,
  loadingStatus: false,
  error: null,

  setGrammarText: (text) => set({ grammarText: text }),
  setPlagiarismText: (text) => set({ plagiarismText: text }),
  setParaphraseMode: (mode) => set({ paraphraseMode: mode }),

  checkGrammar: async (text) => {
    set({ checkingGrammar: true, error: null, grammarResult: null })
    try {
      const { data, error } = await invokeWritingApi<GrammarResult & { usage: WritingUsage }>('check-grammar', { text })

      if (error) {
        set({ checkingGrammar: false, error })
        return null
      }

      if (!data) {
        set({ checkingGrammar: false, error: 'Empty response from server' })
        return null
      }

      const { usage, ...result } = data

      // Update usage status
      if (usage && get().usageStatus) {
        set({
          usageStatus: {
            ...get().usageStatus!,
            grammar: usage,
          },
        })
      }

      set({ checkingGrammar: false, grammarResult: result, grammarText: text })
      return result
    } catch (err) {
      console.error('[writingToolsStore] checkGrammar:', err)
      set({ checkingGrammar: false, error: (err as Error).message })
      return null
    }
  },

  checkPlagiarism: async (text) => {
    set({ checkingPlagiarism: true, error: null, plagiarismResult: null })
    try {
      const { data, error } = await invokeWritingApi<PlagiarismResult & { usage: WritingUsage }>('check-plagiarism', { text })

      if (error) {
        set({ checkingPlagiarism: false, error })
        return null
      }

      if (!data) {
        set({ checkingPlagiarism: false, error: 'Empty response from server' })
        return null
      }

      const { usage, ...result } = data

      if (usage && get().usageStatus) {
        set({
          usageStatus: {
            ...get().usageStatus!,
            plagiarism: usage,
          },
        })
      }

      set({ checkingPlagiarism: false, plagiarismResult: result, plagiarismText: text })
      return result
    } catch (err) {
      console.error('[writingToolsStore] checkPlagiarism:', err)
      set({ checkingPlagiarism: false, error: (err as Error).message })
      return null
    }
  },

  applyGrammarFix: (issueIndex) => {
    const result = get().grammarResult
    if (!result) return

    const issue = result.issues[issueIndex]
    if (!issue) return

    let text = get().grammarText
    // Replace the specific occurrence
    const before = text.substring(0, issue.position.start)
    const after = text.substring(issue.position.end)
    text = before + issue.replacement + after

    // Recalculate positions for remaining issues
    const lengthDiff = issue.replacement.length - issue.original.length
    const updatedIssues = result.issues
      .filter((_, i) => i !== issueIndex)
      .map((iss) => {
        if (iss.position.start > issue.position.start) {
          return {
            ...iss,
            position: {
              start: iss.position.start + lengthDiff,
              end: iss.position.end + lengthDiff,
            },
          }
        }
        return iss
      })

    set({
      grammarText: text,
      grammarResult: {
        ...result,
        issues: updatedIssues,
      },
    })
  },

  applyAllFixes: () => {
    const result = get().grammarResult
    if (!result || !result.corrected_text) return

    set({
      grammarText: result.corrected_text,
      grammarResult: {
        ...result,
        issues: [],
      },
    })
  },

  fetchUsageStatus: async () => {
    set({ loadingStatus: true })
    try {
      const { data, error } = await invokeWritingApi<WritingUsageStatus>('writing-status', {})

      if (error) {
        console.error('[writingToolsStore] fetchUsageStatus:', error)
        return
      }

      if (data) set({ usageStatus: data })
    } catch (err) {
      console.error('[writingToolsStore] fetchUsageStatus:', err)
    } finally {
      set({ loadingStatus: false })
    }
  },

  clearGrammarResult: () => set({ grammarResult: null, grammarText: '' }),
  clearPlagiarismResult: () => set({ plagiarismResult: null, plagiarismText: '' }),
  clearParaphraseResult: () => set({ paraphraseResult: null, paraphraseText: '' }),
  clearError: () => set({ error: null }),

  paraphrase: async (text, mode) => {
    set({ paraphrasing: true, error: null, paraphraseResult: null })
    try {
      const { data, error } = await invokeWritingApi<ParaphraseResult & { usage: WritingUsage }>('paraphrase', { text, mode })

      if (error) {
        set({ paraphrasing: false, error })
        return null
      }

      if (!data) {
        set({ paraphrasing: false, error: 'Empty response from server' })
        return null
      }

      const { usage, ...result } = data

      if (usage && get().usageStatus) {
        set({
          usageStatus: {
            ...get().usageStatus!,
            paraphrase: usage,
          },
        })
      }

      set({ paraphrasing: false, paraphraseResult: result, paraphraseText: text })
      return result
    } catch (err) {
      console.error('[writingToolsStore] paraphrase:', err)
      set({ paraphrasing: false, error: (err as Error).message })
      return null
    }
  },
}))
