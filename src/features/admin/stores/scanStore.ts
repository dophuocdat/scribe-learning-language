import { create } from 'zustand'
import { invokeScanApi, invokeAiApi } from '@/shared/lib/edgeFunctions'

interface VocabItem {
  word: string
  ipa: string
  part_of_speech: string
  meaning_vi: string
  example_sentence: string
}

interface ExerciseItem {
  type: 'fill_blank' | 'word_guess' | 'matching' | 'true_false' | 'translation' | 'multiple_choice'
  question: string
  options: string[] | null
  correct_answer: string
  explanation: string
}

interface FormatResult {
  formatted_content: string
  ai_summary: string
  detected_topics: string[]
  vocabulary: VocabItem[]
  exercises: ExerciseItem[]
}

interface ScanState {
  // Scanning phase
  isScanning: boolean
  // AI formatting phase  
  isFormatting: boolean
  // Raw OCR text (kept for reference)
  rawOcrText: string | null
  // AI-formatted result for preview
  formattedResult: FormatResult | null
  error: string | null

  scanImage: (file: File) => Promise<void>
  scanUrl: (url: string) => Promise<void>
  scanWebUrl: (url: string) => Promise<void>
  clearScan: () => void
  clearPreview: () => void
}

// Use shared helpers — alias for backward compat
const scanApi = invokeScanApi
const aiApi = invokeAiApi

// Convert File to base64 (strip data URL prefix)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Pipeline: OCR → AI format
async function ocrThenFormat(
  set: (partial: Partial<ScanState>) => void,
  ocrFn: () => Promise<{ data: { text: string; charCount: number } | null; error: string | null }>
) {
  set({ isScanning: true, isFormatting: false, error: null, rawOcrText: null, formattedResult: null })

  // Step 1: OCR
  const { data: ocrData, error: ocrError } = await ocrFn()
  if (ocrError || !ocrData?.text?.trim()) {
    set({ isScanning: false, error: ocrError || 'OCR returned empty text' })
    return
  }

  console.log(`[scanStore] OCR done: ${ocrData.charCount} chars → starting AI format...`)
  set({ isScanning: false, isFormatting: true, rawOcrText: ocrData.text })

  // Step 2: AI format
  const { data: formatData, error: formatError } = await aiApi<FormatResult>(
    'format-content',
    { text: ocrData.text }
  )

  if (formatError) {
    set({ isFormatting: false, error: formatError })
    return
  }

  console.log(`[scanStore] AI format done: ${formatData?.formatted_content?.length || 0} chars`)
  set({
    isFormatting: false,
    formattedResult: formatData,
  })
}

export const useScanStore = create<ScanState>((set) => ({
  isScanning: false,
  isFormatting: false,
  rawOcrText: null,
  formattedResult: null,
  error: null,

  scanImage: async (file: File) => {
    const imageBase64 = await fileToBase64(file)
    await ocrThenFormat(set, () =>
      scanApi<{ text: string; charCount: number }>('scan-image', { imageBase64, mimeType: file.type })
    )
  },

  scanUrl: async (url: string) => {
    await ocrThenFormat(set, () =>
      scanApi<{ text: string; charCount: number }>('scan-url', { imageUrl: url })
    )
  },

  scanWebUrl: async (url: string) => {
    await ocrThenFormat(set, async () => {
      const { data, error } = await scanApi<{ text: string; charCount: number; sourceUrl: string }>(
        'fetch-url',
        { url }
      )
      if (error) return { data: null, error }
      return { data: data ? { text: data.text, charCount: data.charCount } : null, error: null }
    })
  },

  clearScan: () => set({ rawOcrText: null, formattedResult: null, error: null }),
  clearPreview: () => set({ formattedResult: null }),
}))
