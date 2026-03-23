import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import { invokeScanApiUser } from '@/shared/lib/edgeFunctions'
import type { UserFolder, UserScanLog, Course } from '@/shared/types/database'

/* ===== Types (mirror admin scanStore) ===== */

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

export interface ScanStatus {
  scansToday: number
  maxScans: number
  remainingScans: number
}

export interface ScanResult {
  text: string
  charCount: number
  scanLogId: string
  remainingScans: number
}

export interface GenerateResult {
  courseId: string
  lessonId: string
  title: string
  vocabularyCount: number
  exercisesCount: number
}

interface ScanState {
  // Data
  folders: UserFolder[]
  currentFolder: UserFolder | null
  scanLogs: (UserScanLog & { course?: Course })[]
  scanStatus: ScanStatus | null
  scanResult: ScanResult | null

  // AI format (mirrors admin scanStore)
  isFormatting: boolean
  formattedResult: FormatResult | null

  // UI
  loadingFolders: boolean
  loadingLogs: boolean
  scanning: boolean
  generating: boolean
  error: string | null

  // Folder CRUD
  fetchFolders: () => Promise<void>
  createFolder: (name: string, colorCode?: string) => Promise<UserFolder | null>
  updateFolder: (id: string, updates: { name?: string; color_code?: string }) => Promise<boolean>
  deleteFolder: (id: string) => Promise<boolean>
  setCurrentFolder: (folder: UserFolder | null) => void

  // Scan operations (same pattern as admin)
  checkScanStatus: () => Promise<void>
  scanDocument: (imageBase64List: string[], folderId: string) => Promise<ScanResult | null>
  generateLesson: (scanLogId: string) => Promise<GenerateResult | null>

  // Scan logs
  fetchScanLogs: (folderId: string) => Promise<void>

  // Utility
  clearScanResult: () => void
  clearError: () => void
}

// Convert File to base64 (strip data URL prefix) — same as admin
export function fileToBase64(file: File): Promise<string> {
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

export const useScanStore = create<ScanState>((set, get) => ({
  folders: [],
  currentFolder: null,
  scanLogs: [],
  scanStatus: null,
  scanResult: null,
  isFormatting: false,
  formattedResult: null,

  loadingFolders: false,
  loadingLogs: false,
  scanning: false,
  generating: false,
  error: null,

  // ===== FOLDER CRUD =====
  fetchFolders: async () => {
    set({ loadingFolders: true, error: null })
    try {
      const { data, error } = await supabase
        .from('user_folders')
        .select('*')
        .order('order_index', { ascending: true })

      if (error) throw error

      // Get doc count per folder
      const folders = data || []
      if (folders.length > 0) {
        const { data: logs } = await supabase
          .from('user_scan_logs')
          .select('folder_id')
          .in('folder_id', folders.map(f => f.id))

        const countMap: Record<string, number> = {}
        for (const l of (logs || [])) {
          countMap[l.folder_id] = (countMap[l.folder_id] || 0) + 1
        }
        set({ folders: folders.map(f => ({ ...f, doc_count: countMap[f.id] || 0 })) })
      } else {
        set({ folders })
      }
    } catch (err) {
      console.error('[scanStore] fetchFolders:', err)
      set({ error: (err as Error).message })
    } finally {
      set({ loadingFolders: false })
    }
  },

  createFolder: async (name, colorCode) => {
    set({ error: null })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('user_folders')
        .insert({
          user_id: user.id,
          name,
          color_code: colorCode || '#2563eb',
          order_index: get().folders.length,
        })
        .select()
        .single()

      if (error) throw error

      set({ folders: [...get().folders, data] })
      return data as UserFolder
    } catch (err) {
      console.error('[scanStore] createFolder:', err)
      set({ error: (err as Error).message })
      return null
    }
  },

  updateFolder: async (id, updates) => {
    set({ error: null })
    try {
      const { error } = await supabase
        .from('user_folders')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      set({
        folders: get().folders.map(f =>
          f.id === id ? { ...f, ...updates } : f
        ),
      })
      return true
    } catch (err) {
      console.error('[scanStore] updateFolder:', err)
      set({ error: (err as Error).message })
      return false
    }
  },

  deleteFolder: async (id) => {
    set({ error: null })
    try {
      const { error } = await supabase
        .from('user_folders')
        .delete()
        .eq('id', id)

      if (error) throw error
      set({
        folders: get().folders.filter(f => f.id !== id),
        currentFolder: get().currentFolder?.id === id ? null : get().currentFolder,
      })
      return true
    } catch (err) {
      console.error('[scanStore] deleteFolder:', err)
      set({ error: (err as Error).message })
      return false
    }
  },

  setCurrentFolder: (folder) => set({ currentFolder: folder, scanResult: null, formattedResult: null }),

  // ===== SCAN OPERATIONS (uses invokeScanApiUser like admin uses invokeScanApi) =====
  checkScanStatus: async () => {
    try {
      const { data, error } = await invokeScanApiUser<ScanStatus>('user-scan-status', {})
      if (error) {
        console.error('[scanStore] checkScanStatus:', error)
        return
      }
      if (data) set({ scanStatus: data })
    } catch (err) {
      console.error('[scanStore] checkScanStatus:', err)
    }
  },

  scanDocument: async (imageBase64List, folderId) => {
    set({ scanning: true, error: null, scanResult: null, formattedResult: null })
    try {
      // Step 1: OCR via scan-api-user — send array of images
      console.log(`[scanStore] Calling invokeScanApiUser user-scan-image with ${imageBase64List.length} images...`)
      const { data: ocrData, error: ocrError } = await invokeScanApiUser<{
        text: string
        charCount: number
        scanLogId: string
        remainingScans: number
        duplicate?: boolean
        message?: string
      }>('user-scan-image', { imageBase64List, folderId })

      console.log('[scanStore] invokeScanApiUser returned:', { ocrData, ocrError })

      if (ocrError) {
        console.error('[scanStore] scanDocument OCR error:', ocrError)
        set({ scanning: false, error: ocrError })
        return null
      }

      if (!ocrData) {
        console.error('[scanStore] scanDocument: ocrData is null/undefined')
        set({ scanning: false, error: 'Scan returned empty response' })
        return null
      }

      // Handle duplicate
      if (ocrData.duplicate) {
        set({ scanning: false, error: ocrData.message || 'Tài liệu đã scan trước đó' })
        return null
      }

      console.log(`[scanStore] OCR done: ${ocrData.charCount} chars, scanLogId=${ocrData.scanLogId}`)

      const result: ScanResult = {
        text: ocrData.text,
        charCount: ocrData.charCount,
        scanLogId: ocrData.scanLogId,
        remainingScans: ocrData.remainingScans,
      }

      // Update scan status
      set({
        scanning: false,
        scanResult: result,
        scanStatus: get().scanStatus
          ? { ...get().scanStatus!, remainingScans: result.remainingScans, scansToday: get().scanStatus!.maxScans - result.remainingScans }
          : null,
      })

      return result
    } catch (err) {
      console.error('[scanStore] scanDocument:', err)
      set({ scanning: false, error: (err as Error).message })
      return null
    }
  },

  generateLesson: async (scanLogId) => {
    set({ generating: true, error: null })
    try {
      // Call scan-api-user to generate lesson (same pattern as admin)
      const { data, error } = await invokeScanApiUser<{
        courseId: string
        lessonId: string
        title: string
        vocabularyCount: number
        exercisesCount: number
        message?: string
      }>('user-generate-lesson', { scanLogId })

      if (error) {
        set({ generating: false, error })
        return null
      }

      if (!data) {
        set({ generating: false, error: 'Generate returned empty response' })
        return null
      }

      console.log(`[scanStore] Lesson generated: course=${data.courseId}, lesson=${data.lessonId}`)

      const result: GenerateResult = {
        courseId: data.courseId,
        lessonId: data.lessonId || '',
        title: data.title || '',
        vocabularyCount: data.vocabularyCount || 0,
        exercisesCount: data.exercisesCount || 0,
      }

      // Refresh scan logs
      if (get().currentFolder) {
        await get().fetchScanLogs(get().currentFolder!.id)
      }

      set({ generating: false })
      return result
    } catch (err) {
      console.error('[scanStore] generateLesson:', err)
      set({ generating: false, error: (err as Error).message })
      return null
    }
  },

  // ===== SCAN LOGS =====
  fetchScanLogs: async (folderId) => {
    set({ loadingLogs: true })
    try {
      const { data, error } = await supabase
        .from('user_scan_logs')
        .select('*, courses(*)')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const logs = (data || []).map((log: any) => ({
        ...log,
        course: log.courses || null,
        courses: undefined,
      }))

      set({ scanLogs: logs })
    } catch (err) {
      console.error('[scanStore] fetchScanLogs:', err)
    } finally {
      set({ loadingLogs: false })
    }
  },

  // ===== UTILITY =====
  clearScanResult: () => set({ scanResult: null, formattedResult: null }),
  clearError: () => set({ error: null }),
}))
