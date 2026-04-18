import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Save, ArrowLeft, Plus, Trash2, BookOpen, Languages, HelpCircle,
  Edit3, Camera, Sparkles, Loader2, Check, X, Upload, Link, CheckSquare, Square,
  Eye, Globe, EyeOff,
} from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { useScanStore } from '@/features/admin/stores/scanStore'
import { useAIStore } from '@/features/admin/stores/aiStore'
import type { GeneratedVocabulary, GeneratedQuestion } from '@/features/admin/stores/aiStore'
import { useToastStore } from '@/shared/stores/toastStore'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { Badge } from '@/shared/components/ui/Badge'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import type { Vocabulary, QuizQuestion } from '@/shared/types/database'

type TabId = 'content' | 'vocabulary' | 'quiz' | 'skills'

const partsOfSpeech = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase']
const questionTypes = ['multiple_choice', 'true_false', 'fill_blank']

/* eslint-disable @typescript-eslint/no-explicit-any */

// Helper: call admin-api for batch operations (uses SDK for JWT security)
async function adminApiBatch(
  resource: string,
  body: Record<string, any>
): Promise<{ data: any; error: string | null }> {
  const { invokeAdminApi } = await import('@/shared/lib/edgeFunctions')
  return invokeAdminApi(resource, 'POST', {}, body)
}

export function LessonFormPage() {
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const {
    currentLesson, vocabularyItems, quizzes, isSaving,
    fetchLesson, fetchVocabulary, fetchQuizzes,
    createLesson, updateLesson,
    createVocabulary, updateVocabulary, deleteVocabulary,
    createQuiz,
    createQuizQuestion, deleteQuizQuestion,
  } = useAdminStore()
  const { addToast } = useToastStore()
  const {
    isScanning, isFormatting, formattedResult, scanImage, clearScan, clearPreview,
  } = useScanStore()
  const {
    isGenerating, generatedVocabulary, generatedQuestions, generatedSummary, error: aiError,
    generateVocabulary, generateQuiz, generateSummary,
    toggleVocabSelection, toggleQuestionSelection, selectAllVocab, selectAllQuestions,
    clearVocabulary, clearQuestions, clearSummary,
  } = useAIStore()

  const isEdit = !!lessonId
  const [loading, setLoading] = useState(isEdit)
  const [activeTab, setActiveTab] = useState<TabId>('content')
  const [deleteVocabId, setDeleteVocabId] = useState<string | null>(null)
  const [savingBatch, setSavingBatch] = useState(false)

  // Skill exercises
  const [generatingSkills, setGeneratingSkills] = useState(false)
  const [skillExercises, setSkillExercises] = useState<any[]>([])
  const [skillCounts, setSkillCounts] = useState({ listening: 1, speaking: 1, reading: 1, writing: 1 })
  const [previewExercise, setPreviewExercise] = useState<any | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualForm, setManualForm] = useState({
    skill: 'listening' as 'listening' | 'speaking' | 'reading' | 'writing',
    mode: 'dictation',
    title: '',
    title_vi: '',
    contentJson: '',
  })
  const [savingManual, setSavingManual] = useState(false)

  // Scan mode
  const [scanMode, setScanMode] = useState<'upload' | 'url' | null>(null)
  const [scanUrlInput, setScanUrlInput] = useState('')
  // Editable preview of AI-formatted content
  const [editablePreview, setEditablePreview] = useState<{ content: string; summary: string } | null>(null)

  // Lesson form
  const [form, setForm] = useState({
    title: '',
    raw_content: '',
    ai_summary: '',
  })

  // New vocabulary form
  const [vocabForm, setVocabForm] = useState({
    word: '',
    ipa_pronunciation: '',
    part_of_speech: '',
    definition_en: '',
    definition_vi: '',
    example_sentence: '',
    difficulty_rank: '',
  })
  const [editingVocabId, setEditingVocabId] = useState<string | null>(null)

  // New quiz question form
  const [qForm, setQForm] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    options: ['', '', '', ''],
    correct_answer: '',
    explanation: '',
  })

  useEffect(() => {
    if (isEdit && lessonId) {
      Promise.all([
        fetchLesson(lessonId),
        fetchVocabulary(lessonId),
        fetchQuizzes(lessonId),
      ]).then(() => setLoading(false))

      // Fetch existing skill exercises
      import('@/shared/lib/supabase').then(({ supabase }) => {
        supabase
          .from('lesson_skill_exercises')
          .select('id, skill, mode, title, title_vi, is_published, content')
          .eq('lesson_id', lessonId)
          .order('order_index')
          .then(({ data }) => {
            if (data) setSkillExercises(data)
          })
      })
    }
  }, [lessonId, isEdit, fetchLesson, fetchVocabulary, fetchQuizzes])

  useEffect(() => {
    if (isEdit && currentLesson) {
      setForm({
        title: currentLesson.title ?? '',
        raw_content: currentLesson.raw_content ?? '',
        ai_summary: currentLesson.ai_summary ?? '',
      })
    }
  }, [isEdit, currentLesson])

  // When AI format result arrives, populate editable preview
  useEffect(() => {
    if (formattedResult) {
      setEditablePreview({
        content: formattedResult.formatted_content || '',
        summary: formattedResult.ai_summary || '',
      })
      setScanMode(null)
      addToast('success', 'AI đã format nội dung! Xem trước và nhấn Apply.')
    }
  }, [formattedResult, addToast])

  // Append AI summary
  useEffect(() => {
    if (generatedSummary) {
      setForm(f => ({ ...f, ai_summary: generatedSummary }))
      clearSummary()
      addToast('success', 'Đã tạo tóm tắt AI!')
    }
  }, [generatedSummary, clearSummary, addToast])

  // --- Scan handlers ---
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await scanImage(file)
  }, [scanImage])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    await scanImage(file)
  }, [scanImage])

  // --- Lesson CRUD ---
  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      addToast('error', 'Vui lòng nhập tiêu đề bài học')
      return
    }

    const payload = {
      course_id: courseId!,
      title: form.title.trim(),
      raw_content: form.raw_content || null,
      processed_content: null,
      ai_summary: form.ai_summary || null,
      difficulty_level: null,
      order_index: 0,
    }

    if (isEdit && lessonId) {
      await updateLesson(lessonId, payload)
      addToast('success', 'Đã cập nhật bài học')
    } else {
      const created = await createLesson(payload)
      if (created) {
        addToast('success', 'Đã tạo bài học — Bắt đầu AI Generate!')
        navigate(`/admin/courses/${courseId}/lessons/${created.id}/edit`, { replace: true })
        // Auto-switch to vocabulary tab after creation
        setTimeout(() => setActiveTab('vocabulary'), 300)
      }
    }
  }

  // --- Vocabulary CRUD ---
  const handleAddVocab = async () => {
    if (!vocabForm.word.trim() || !lessonId) {
      addToast('error', 'Vui lòng nhập từ vựng')
      return
    }

    const data = {
      lesson_id: lessonId,
      word: vocabForm.word.trim(),
      ipa_pronunciation: vocabForm.ipa_pronunciation || null,
      part_of_speech: vocabForm.part_of_speech || null,
      definition_en: vocabForm.definition_en || null,
      definition_vi: vocabForm.definition_vi || null,
      example_sentence: vocabForm.example_sentence || null,
      context_note: null,
      audio_url: null,
      difficulty_rank: vocabForm.difficulty_rank ? parseInt(vocabForm.difficulty_rank) : null,
    }

    if (editingVocabId) {
      await updateVocabulary(editingVocabId, data)
      addToast('success', 'Đã cập nhật từ vựng')
      setEditingVocabId(null)
    } else {
      await createVocabulary(data)
      addToast('success', 'Đã thêm từ vựng')
    }

    setVocabForm({ word: '', ipa_pronunciation: '', part_of_speech: '', definition_en: '', definition_vi: '', example_sentence: '', difficulty_rank: '' })
    await fetchVocabulary(lessonId)
  }

  const startEditVocab = (v: Vocabulary) => {
    setEditingVocabId(v.id)
    setVocabForm({
      word: v.word,
      ipa_pronunciation: v.ipa_pronunciation ?? '',
      part_of_speech: v.part_of_speech ?? '',
      definition_en: v.definition_en ?? '',
      definition_vi: v.definition_vi ?? '',
      example_sentence: v.example_sentence ?? '',
      difficulty_rank: v.difficulty_rank?.toString() ?? '',
    })
  }

  const handleDeleteVocab = async () => {
    if (!deleteVocabId || !lessonId) return
    await deleteVocabulary(deleteVocabId)
    addToast('success', 'Đã xóa từ vựng')
    setDeleteVocabId(null)
    await fetchVocabulary(lessonId)
  }

  // --- Batch save AI vocabulary ---
  const handleSaveAIVocabulary = async () => {
    if (!generatedVocabulary || !lessonId) return
    const selected = generatedVocabulary.filter(v => v.selected)
    if (selected.length === 0) {
      addToast('error', 'Chọn ít nhất 1 từ vựng để lưu')
      return
    }

    setSavingBatch(true)
    const items = selected.map((v, i) => ({
      lesson_id: lessonId,
      word: v.word,
      ipa_pronunciation: v.ipa_pronunciation,
      part_of_speech: v.part_of_speech,
      definition_en: v.definition_en,
      definition_vi: v.definition_vi,
      example_sentence: v.example_sentence,
      difficulty_rank: v.difficulty_rank ?? i + 1,
      context_note: null,
      audio_url: null,
    }))

    const { error } = await adminApiBatch('vocabulary-batch', { items })
    setSavingBatch(false)

    if (error) {
      addToast('error', `Lưu thất bại: ${error}`)
      return
    }

    addToast('success', `Đã lưu ${items.length} từ vựng!`)
    clearVocabulary()
    await fetchVocabulary(lessonId)
  }

  // --- Batch save AI quiz ---
  const handleSaveAIQuiz = async () => {
    if (!generatedQuestions || !lessonId) return
    const selected = generatedQuestions.filter(q => q.selected)
    if (selected.length === 0) {
      addToast('error', 'Chọn ít nhất 1 câu hỏi để lưu')
      return
    }

    setSavingBatch(true)
    const items = selected.map((q, i) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      reference_position: null,
      order_index: i,
    }))

    const { error } = await adminApiBatch('quiz-questions-batch', { items, lessonId })
    setSavingBatch(false)

    if (error) {
      addToast('error', `Lưu thất bại: ${error}`)
      return
    }

    addToast('success', `Đã lưu ${items.length} câu hỏi quiz!`)
    clearQuestions()
    await fetchQuizzes(lessonId)
  }

  // --- Quiz manual add ---
  const handleAddQuestion = async () => {
    if (!qForm.question_text.trim() || !qForm.correct_answer.trim() || !lessonId) {
      addToast('error', 'Vui lòng nhập câu hỏi và đáp án')
      return
    }

    let quiz = quizzes[0]
    if (!quiz) {
      const created = await createQuiz({
        lesson_id: lessonId,
        title: `Quiz - ${form.title}`,
        quiz_type: 'multiple_choice',
        time_limit_seconds: null,
        passing_score: 70,
        order_index: 0,
      })
      if (!created) return
      quiz = { ...created, questions: [] }
    }

    await createQuizQuestion({
      quiz_id: quiz.id,
      question_text: qForm.question_text.trim(),
      question_type: qForm.question_type,
      options: qForm.options.filter((o) => o.trim()),
      correct_answer: qForm.correct_answer.trim(),
      explanation: qForm.explanation || null,
      reference_position: null,
      order_index: (quiz.questions?.length ?? 0),
    })

    addToast('success', 'Đã thêm câu hỏi')
    setQForm({ question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', explanation: '' })
    await fetchQuizzes(lessonId)
  }

  // --- Generate 4 skills ---
  const handleGenerateSkills = async () => {
    if (!lessonId) {
      addToast('error', 'Vui lòng lưu bài học trước')
      return
    }
    setGeneratingSkills(true)
    try {
      const { invokeWritingApi } = await import('@/shared/lib/edgeFunctions')
      const { data, error } = await invokeWritingApi('generate-lesson-skills', {
        lesson_id: lessonId,
        skills_count: skillCounts,
      })
      if (error) {
        addToast('error', `Lỗi: ${error}`)
        return
      }
      addToast('success', `Đã tạo ${data?.total || 0} bài luyện kỹ năng!`)
      // Refresh list
      const { supabase } = await import('@/shared/lib/supabase')
      const { data: refreshed } = await supabase
        .from('lesson_skill_exercises')
        .select('id, skill, mode, title, title_vi, is_published, content')
        .eq('lesson_id', lessonId)
        .order('order_index')
      if (refreshed) setSkillExercises(refreshed)
    } catch (err) {
      addToast('error', `Lỗi: ${(err as Error).message}`)
    } finally {
      setGeneratingSkills(false)
    }
  }

  const handleDeleteSkillExercise = async (id: string) => {
    if (!confirm('Xóa bài luyện này?')) return
    const { supabase } = await import('@/shared/lib/supabase')
    await supabase.from('lesson_skill_exercises').delete().eq('id', id)
    setSkillExercises(prev => prev.filter(e => e.id !== id))
    addToast('success', 'Đã xóa')
  }

  const handleTogglePublish = async (id: string, current: boolean) => {
    const { supabase } = await import('@/shared/lib/supabase')
    await supabase.from('lesson_skill_exercises').update({ is_published: !current }).eq('id', id)
    setSkillExercises(prev => prev.map(e => e.id === id ? { ...e, is_published: !current } : e))
    addToast('success', !current ? 'Đã publish' : 'Đã chuyển về draft')
  }

  const handlePublishAll = async () => {
    const { supabase } = await import('@/shared/lib/supabase')
    const ids = skillExercises.map(e => e.id)
    await supabase.from('lesson_skill_exercises').update({ is_published: true }).in('id', ids)
    setSkillExercises(prev => prev.map(e => ({ ...e, is_published: true })))
    addToast('success', `Đã publish ${ids.length} bài tập`)
  }

  const handleUnpublishAll = async () => {
    const { supabase } = await import('@/shared/lib/supabase')
    const ids = skillExercises.map(e => e.id)
    await supabase.from('lesson_skill_exercises').update({ is_published: false }).in('id', ids)
    setSkillExercises(prev => prev.map(e => ({ ...e, is_published: false })))
    addToast('success', `Đã chuyển ${ids.length} bài về draft`)
  }

  // Skill mode options per skill type
  const SKILL_MODES: Record<string, { value: string; label: string }[]> = {
    listening: [{ value: 'dictation', label: 'Nghe chép (Dictation)' }],
    speaking: [
      { value: 'pronunciation', label: 'Phát âm (Pronunciation)' },
      { value: 'shadowing', label: 'Bắt chước (Shadowing)' },
    ],
    reading: [
      { value: 'level_reading', label: 'Đọc hiểu (Reading Comprehension)' },
      { value: 'reading_aloud', label: 'Đọc to (Reading Aloud)' },
    ],
    writing: [{ value: 'sentence_building', label: 'Viết câu (Sentence Building)' }],
  }

  const CONTENT_TEMPLATES: Record<string, string> = {
    dictation: JSON.stringify({
      text: "English sentence for dictation",
      translation_vi: "Vietnamese translation",
      word_count: 12,
      difficulty_note_vi: "Ghi chú độ khó",
      key_vocabulary: [{ word: "example", meaning_vi: "ví dụ" }],
    }, null, 2),
    pronunciation: JSON.stringify({
      sentence: "English sentence for pronunciation",
      sentence_vi: "Vietnamese translation",
      phonetic_guide: "/IPA/",
      key_sounds: [{ sound: "th", tip_vi: "Đặt lưỡi giữa hai hàm răng", ipa: "/θ/" }],
      difficulty_note_vi: "Ghi chú",
    }, null, 2),
    shadowing: JSON.stringify({
      sentence: "English sentence for shadowing",
      sentence_vi: "Vietnamese translation",
      phonetic_guide: "/IPA/",
      stress_pattern: "STRESS pattern description",
      speed_wpm: 120,
    }, null, 2),
    level_reading: JSON.stringify({
      title: "Article Title",
      content: "Reading passage (100-200 words)...",
      word_count: 150,
      questions: [
        { question: "Question?", type: "mcq", options: ["A", "B", "C", "D"], correct_answer: "A", explanation_vi: "Giải thích" }
      ],
      vocabulary: [{ word: "word", meaning_vi: "nghĩa", ipa: "/ipa/", part_of_speech: "noun", example: "Example" }],
    }, null, 2),
    reading_aloud: JSON.stringify({
      title: "Passage Title",
      content: "Reading passage text...",
      word_count: 100,
      estimated_wpm: 120,
      difficulty_note_vi: "Ghi chú",
    }, null, 2),
    sentence_building: JSON.stringify({
      correct_sentence: "The correct English sentence",
      words_shuffled: ["correct", "The", "sentence", "English"],
      distractors: ["wrong1", "wrong2"],
      grammar_hint_vi: "Gợi ý ngữ pháp",
      translation_vi: "Vietnamese translation",
    }, null, 2),
  }

  const handleManualSkillCreate = async () => {
    if (!lessonId) {
      addToast('error', 'Vui lòng lưu bài học trước')
      return
    }
    if (!manualForm.title.trim()) {
      addToast('error', 'Vui lòng nhập tiêu đề')
      return
    }

    let content: unknown
    try {
      content = JSON.parse(manualForm.contentJson)
    } catch {
      addToast('error', 'JSON nội dung không hợp lệ! Kiểm tra lại cú pháp.')
      return
    }

    setSavingManual(true)
    try {
      const { supabase } = await import('@/shared/lib/supabase')
      const { data, error } = await supabase
        .from('lesson_skill_exercises')
        .insert({
          lesson_id: lessonId,
          skill: manualForm.skill,
          mode: manualForm.mode,
          title: manualForm.title.trim(),
          title_vi: manualForm.title_vi.trim() || manualForm.title.trim(),
          content,
          order_index: skillExercises.length,
        })
        .select('id, skill, mode, title, title_vi, is_published, content')
        .single()

      if (error) throw error
      setSkillExercises(prev => [...prev, data])
      addToast('success', 'Đã tạo bài luyện thủ công!')
      setManualForm({ skill: 'listening', mode: 'dictation', title: '', title_vi: '', contentJson: '' })
      setShowManualForm(false)
    } catch (err) {
      addToast('error', `Lỗi: ${(err as Error).message}`)
    } finally {
      setSavingManual(false)
    }
  }

  const tabs: { id: TabId; label: string; icon: typeof BookOpen; count?: number }[] = [
    { id: 'content', label: 'Nội dung', icon: BookOpen },
    { id: 'vocabulary', label: 'Từ vựng', icon: Languages, count: vocabularyItems.length },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle, count: quizzes[0]?.questions?.length ?? 0 },
    { id: 'skills', label: '4 Kỹ năng', icon: Sparkles, count: skillExercises.length },
  ]

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="glass-card p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-surface-200/50 hover:text-surface-50 hover:bg-surface-800/50 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-surface-50">
          {isEdit ? 'Chỉnh sửa bài học' : 'Tạo bài học mới'}
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-900/50 border border-surface-800/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (!isEdit && tab.id !== 'content') {
                addToast('info', 'Vui lòng lưu bài học trước khi sử dụng AI')
                return
              }
              setActiveTab(tab.id)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                ? 'bg-primary-500/15 text-primary-400'
                : !isEdit && tab.id !== 'content'
                  ? 'text-surface-200/20 cursor-not-allowed'
                  : 'text-surface-200/60 hover:text-surface-50 hover:bg-surface-800/50'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {!isEdit && tab.id !== 'content' && (
              <span className="text-[10px] text-surface-200/30">🔒</span>
            )}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-surface-700 text-surface-200/70">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============ CONTENT TAB ============ */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveLesson} className="glass-card p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Tiêu đề *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="VD: Unit 1 - Business Vocabulary"
                className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 text-sm transition-all"
              />
            </div>

            {/* Scan Upload Zone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-surface-200/70">📷 Scan tài liệu → AI Format</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setScanMode(scanMode === 'upload' ? null : 'upload')}
                    disabled={isScanning || isFormatting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                      scanMode === 'upload' ? 'bg-accent-500/15 text-accent-400' : 'bg-surface-800/50 text-surface-200/60 hover:text-surface-50'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode(scanMode === 'url' ? null : 'url')}
                    disabled={isScanning || isFormatting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                      scanMode === 'url' ? 'bg-accent-500/15 text-accent-400' : 'bg-surface-800/50 text-surface-200/60 hover:text-surface-50'
                    }`}
                  >
                    <Link className="w-3.5 h-3.5" />
                    URL Web
                  </button>
                </div>
              </div>

              {/* 2-phase loading */}
              {(isScanning || isFormatting) && (
                <div className="border-2 border-dashed border-accent-500/30 rounded-xl p-6 text-center bg-accent-500/5">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
                    <p className="text-sm text-accent-400 font-medium">
                      {isScanning ? '🌐 Đang lấy nội dung...' : '🤖 AI đang format nội dung...'}
                    </p>
                    <p className="text-xs text-surface-200/30">
                      {isScanning ? 'Bước 1/2 — Trích xuất text từ nguồn' : 'Bước 2/2 — Tạo từ vựng và bài tập'}
                    </p>
                  </div>
                </div>
              )}

              {/* Upload Zone */}
              {scanMode === 'upload' && !isScanning && !isFormatting && (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative border-2 border-dashed border-accent-500/30 rounded-xl p-6 text-center hover:border-accent-500/50 transition-all bg-accent-500/5"
                >
                  <Camera className="w-8 h-8 mx-auto text-surface-200/30 mb-2" />
                  <p className="text-sm text-surface-200/50">Kéo thả ảnh hoặc click để chọn</p>
                  <p className="text-xs text-surface-200/30 mt-1">Hỗ trợ: JPG, PNG, PDF scanned</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              )}

              {/* URL Input */}
              {scanMode === 'url' && !isScanning && !isFormatting && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={scanUrlInput}
                    onChange={(e) => setScanUrlInput(e.target.value)}
                    placeholder="https://example.com/english-lesson"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-accent-500/50"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!scanUrlInput.trim()) return
                      const { scanWebUrl } = useScanStore.getState()
                      await scanWebUrl(scanUrlInput.trim())
                      setScanUrlInput('')
                    }}
                    disabled={isScanning || isFormatting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-500/15 text-accent-400 text-sm font-medium hover:bg-accent-500/25 disabled:opacity-50 transition-all"
                  >
                    <Link className="w-4 h-4" />
                    Fetch & Format
                  </button>
                </div>
              )}
            </div>

            {/* AI Format Preview Card */}
            {editablePreview && (
              <div className="border border-emerald-500/30 rounded-xl bg-emerald-500/5 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-300">AI Format Preview</span>
                    {formattedResult?.detected_topics && (
                      <div className="flex gap-1 ml-2">
                        {formattedResult.detected_topics.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingBatch}
                      onClick={async () => {
                        if (!editablePreview) return
                        console.log('[Apply] Starting apply flow...')
                        setSavingBatch(true)

                        try {
                          // 1. Update content form — convert " | " separators to real newlines
                          const newContent = editablePreview.content.replace(/ \| /g, '\n')
                          const newSummary = editablePreview.summary.replace(/ \| /g, '\n')
                          setForm(f => ({
                            ...f,
                            raw_content: f.raw_content
                              ? `${f.raw_content}\n\n${newContent}`
                              : newContent,
                            ai_summary: newSummary || f.ai_summary,
                          }))

                          // 2. Auto-save lesson if editing (so vocab/quiz can reference lesson_id)
                          let targetLessonId = lessonId
                          if (isEdit && lessonId) {
                            console.log('[Apply] Updating existing lesson:', lessonId)
                            await updateLesson(lessonId, {
                              course_id: courseId!,
                              title: form.title.trim() || 'Untitled Lesson',
                              raw_content: form.raw_content
                                ? `${form.raw_content}\n\n${newContent}`
                                : newContent,
                              processed_content: null,
                              ai_summary: newSummary || form.ai_summary || null,
                              difficulty_level: null,
                              order_index: 0,
                            })
                          } else if (!isEdit) {
                            console.log('[Apply] Creating new lesson...')
                            const created = await createLesson({
                              course_id: courseId!,
                              title: form.title.trim() || 'Untitled Lesson',
                              raw_content: newContent,
                              processed_content: null,
                              ai_summary: newSummary || null,
                              difficulty_level: null,
                              order_index: 0,
                            })
                            if (created) {
                              targetLessonId = created.id
                              console.log('[Apply] Lesson created:', created.id)
                              navigate(`/admin/courses/${courseId}/lessons/${created.id}/edit`, { replace: true })
                            }
                          }

                          if (!targetLessonId) {
                            addToast('error', 'Không thể lưu bài học')
                            return
                          }

                          let vocabCount = 0
                          let exerciseCount = 0

                          // 3. Save vocabulary via batch API
                          if (formattedResult?.vocabulary && formattedResult.vocabulary.length > 0) {
                            console.log('[Apply] Saving vocabulary:', formattedResult.vocabulary.length, 'items')
                            const vocabItems = formattedResult.vocabulary.map((v, i) => ({
                              lesson_id: targetLessonId,
                              word: v.word,
                              ipa_pronunciation: v.ipa || null,
                              part_of_speech: v.part_of_speech || null,
                              definition_en: null,
                              definition_vi: v.meaning_vi || null,
                              example_sentence: v.example_sentence || null,
                              context_note: null,
                              audio_url: null,
                              difficulty_rank: i + 1,
                            }))
                            const { error: vocabErr } = await adminApiBatch('vocabulary-batch', { items: vocabItems })
                            if (vocabErr) {
                              console.error('[Apply] Vocab batch error:', vocabErr)
                              addToast('error', `Lỗi lưu từ vựng: ${vocabErr}`)
                            } else {
                              vocabCount = vocabItems.length
                            }
                          }

                          // 4. Save exercises via quiz-questions-batch API
                          if (formattedResult?.exercises && formattedResult.exercises.length > 0) {
                            console.log('[Apply] Saving exercises:', formattedResult.exercises.length, 'items')
                            const exerciseItems = formattedResult.exercises.map((ex, i) => ({
                              question_text: ex.question,
                              question_type: ex.type === 'true_false' ? 'true_false'
                                : (ex.options && ex.options.length > 2) ? 'multiple_choice'
                                : 'fill_blank',
                              options: ex.options || [],
                              correct_answer: ex.correct_answer,
                              explanation: ex.explanation || null,
                              reference_position: null,
                              order_index: i,
                            }))
                            const { error: quizErr } = await adminApiBatch('quiz-questions-batch', {
                              items: exerciseItems,
                              lessonId: targetLessonId,
                            })
                            if (quizErr) {
                              console.error('[Apply] Quiz batch error:', quizErr)
                              addToast('error', `Lỗi lưu bài tập: ${quizErr}`)
                            } else {
                              exerciseCount = exerciseItems.length
                            }
                          }

                          // 5. Refresh data
                          await Promise.all([
                            fetchVocabulary(targetLessonId!),
                            fetchQuizzes(targetLessonId!),
                            fetchLesson(targetLessonId!),
                          ])

                          // 6. Clear preview & switch tab
                          setEditablePreview(null)
                          clearPreview()

                          const msgs: string[] = ['✅ Đã apply nội dung!']
                          if (vocabCount > 0) msgs.push(`📚 ${vocabCount} từ vựng`)
                          if (exerciseCount > 0) msgs.push(`🎯 ${exerciseCount} bài tập`)
                          addToast('success', msgs.join(' • '))

                          // Switch to vocabulary tab to show results
                          setTimeout(() => setActiveTab('vocabulary'), 300)
                        } catch (err) {
                          console.error('[Apply] Unhandled error:', err)
                          addToast('error', `Lỗi: ${(err as Error).message}`)
                        } finally {
                          setSavingBatch(false)
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
                    >
                      {savingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {savingBatch ? 'Đang lưu...' : 'Apply tất cả'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditablePreview(null)
                        clearPreview()
                        clearScan()
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Bỏ qua
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {/* Formatted Content */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-400/70 mb-1">📄 Nội dung đã format</label>
                    <textarea
                      value={editablePreview.content.replace(/ \| /g, '\n')}
                      onChange={(e) => setEditablePreview(p => p ? { ...p, content: e.target.value } : p)}
                      rows={8}
                      className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-emerald-500/20 text-surface-50 text-sm focus:outline-none focus:border-emerald-500/50 transition-all resize-none font-mono"
                    />
                  </div>

                  {/* Summary */}
                  <div>
                    <label className="block text-xs font-medium text-emerald-400/70 mb-1">📝 Tóm tắt AI</label>
                    <textarea
                      value={editablePreview.summary}
                      onChange={(e) => setEditablePreview(p => p ? { ...p, summary: e.target.value } : p)}
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-emerald-500/20 text-surface-50 text-sm focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                    />
                  </div>

                  {/* Vocabulary Table */}
                  {formattedResult?.vocabulary && formattedResult.vocabulary.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-emerald-400/70 mb-2">
                        📚 Từ vựng ({formattedResult.vocabulary.length} từ)
                      </label>
                      <div className="rounded-xl border border-emerald-500/20 overflow-hidden">
                        <div className="grid grid-cols-[1fr_auto_1fr_2fr] gap-0 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-300 uppercase tracking-wide">
                          <span>Từ vựng</span>
                          <span>Loại từ</span>
                          <span>Nghĩa</span>
                          <span>Ví dụ</span>
                        </div>
                        {formattedResult.vocabulary.map((v, i) => (
                          <div key={i} className="grid grid-cols-[1fr_auto_1fr_2fr] gap-0 px-3 py-2.5 border-t border-emerald-500/10 hover:bg-emerald-500/5 transition-all">
                            <div>
                              <span className="text-sm font-semibold text-surface-50">{v.word}</span>
                              {v.ipa && <span className="block text-[10px] text-surface-200/40">{v.ipa}</span>}
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/15 text-violet-400 h-fit self-center">{v.part_of_speech}</span>
                            <span className="text-xs text-accent-400 self-center">{v.meaning_vi}</span>
                            <span className="text-xs text-surface-200/50 italic self-center">"{v.example_sentence}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exercises List */}
                  {formattedResult?.exercises && formattedResult.exercises.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-emerald-400/70 mb-2">
                        🎯 Bài tập ({formattedResult.exercises.length} câu)
                      </label>
                      <div className="space-y-2">
                        {formattedResult.exercises.map((ex, i) => {
                          const typeLabels: Record<string, { label: string; color: string }> = {
                            fill_blank: { label: 'Điền từ', color: 'bg-blue-500/15 text-blue-400' },
                            word_guess: { label: 'Đoán từ', color: 'bg-amber-500/15 text-amber-400' },
                            matching: { label: 'Nối từ', color: 'bg-pink-500/15 text-pink-400' },
                            true_false: { label: 'Đúng/Sai', color: 'bg-cyan-500/15 text-cyan-400' },
                            translation: { label: 'Dịch câu', color: 'bg-orange-500/15 text-orange-400' },
                            multiple_choice: { label: 'Trắc nghiệm', color: 'bg-violet-500/15 text-violet-400' },
                          }
                          const info = typeLabels[ex.type] || { label: ex.type, color: 'bg-surface-700 text-surface-200' }

                          return (
                            <div key={i} className="rounded-xl border border-surface-800/30 bg-surface-900/40 p-3">
                              <div className="flex items-start gap-2 mb-1.5">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-bold shrink-0">{i + 1}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${info.color}`}>{info.label}</span>
                              </div>
                              <p className="text-sm text-surface-50 whitespace-pre-line mb-1.5">{ex.question}</p>
                              {ex.options && ex.options.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                  {ex.options.map((opt, j) => (
                                    <span
                                      key={j}
                                      className={`text-xs px-2 py-0.5 rounded-full ${
                                        opt === ex.correct_answer
                                          ? 'bg-success/15 text-success border border-success/20'
                                          : 'bg-surface-800 text-surface-200/60'
                                      }`}
                                    >
                                      {String.fromCharCode(65 + j)}. {opt}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs text-surface-200/50 mt-1">
                                <span className="text-emerald-400 font-medium">✅ Đáp án: </span>
                                <span className="text-emerald-300">{ex.correct_answer}</span>
                              </div>
                              {ex.explanation && (
                                <p className="text-xs text-surface-200/40 mt-1">💡 {ex.explanation}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hide raw content & summary fields when scan result is available — they become redundant */}
            {!formattedResult && (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Nội dung bài học</label>
                  <textarea
                    value={form.raw_content}
                    onChange={(e) => setForm((f) => ({ ...f, raw_content: e.target.value }))}
                    placeholder="Nhập nội dung bài học, đoạn văn, bài đọc... hoặc dùng Scan để extract từ ảnh"
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 text-sm transition-all resize-none font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-surface-200/70">Tóm tắt AI</label>
                    {isEdit && form.raw_content.trim().length > 50 && (
                      <button
                        type="button"
                        onClick={() => generateSummary(form.raw_content)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 disabled:opacity-50 transition-all"
                      >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        AI Tóm tắt
                      </button>
                    )}
                  </div>
                  <textarea
                    value={form.ai_summary}
                    onChange={(e) => setForm((f) => ({ ...f, ai_summary: e.target.value }))}
                    placeholder="Tóm tắt chính của bài học..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 text-sm transition-all resize-none"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo bài học'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============ VOCABULARY TAB ============ */}
      {activeTab === 'vocabulary' && isEdit && (
        <div className="space-y-4">
          {/* AI Generate Vocabulary */}
          {form.raw_content.trim().length > 50 && (
            <div className="glass-card p-5 border border-violet-500/20 bg-violet-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-50">AI Tạo từ vựng</h3>
                    <p className="text-xs text-surface-200/40">Gemini phân tích nội dung và trích xuất từ vựng tự động</p>
                  </div>
                </div>
                <button
                  onClick={() => generateVocabulary(form.raw_content)}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 text-violet-400 text-sm font-medium hover:bg-violet-500/25 disabled:opacity-50 transition-all"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? 'Đang tạo...' : '🤖 Generate'}
                </button>
              </div>

              {aiError && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-error/10 text-error text-xs">{aiError}</div>
              )}
            </div>
          )}

          {/* AI Generated Vocabulary Preview */}
          {generatedVocabulary && generatedVocabulary.length > 0 && (
            <div className="glass-card overflow-hidden border border-violet-500/20">
              <div className="px-5 py-3 bg-violet-500/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-violet-300">
                    AI đã tạo {generatedVocabulary.length} từ vựng
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectAllVocab(!generatedVocabulary.every(v => v.selected))}
                    className="text-xs text-surface-200/50 hover:text-surface-50 transition-all"
                  >
                    {generatedVocabulary.every(v => v.selected) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                  <button
                    onClick={handleSaveAIVocabulary}
                    disabled={savingBatch || generatedVocabulary.filter(v => v.selected).length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 disabled:opacity-50 transition-all"
                  >
                    {savingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Lưu đã chọn ({generatedVocabulary.filter(v => v.selected).length})
                  </button>
                  <button
                    onClick={clearVocabulary}
                    className="p-1.5 rounded-lg text-surface-200/40 hover:text-error hover:bg-error/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {generatedVocabulary.map((v: GeneratedVocabulary, i: number) => (
                <div
                  key={i}
                  onClick={() => toggleVocabSelection(i)}
                  className={`flex items-center gap-3 px-5 py-3 border-b border-surface-800/20 cursor-pointer transition-all ${
                    v.selected ? 'bg-violet-500/5' : 'opacity-40'
                  }`}
                >
                  {v.selected ? (
                    <CheckSquare className="w-4 h-4 text-violet-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-surface-200/30 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-surface-50">{v.word}</span>
                      {v.ipa_pronunciation && <span className="text-xs text-surface-200/40">{v.ipa_pronunciation}</span>}
                      {v.part_of_speech && <Badge variant="primary" size="sm">{v.part_of_speech}</Badge>}
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      {v.definition_en && <span className="text-xs text-surface-200/60">{v.definition_en}</span>}
                      {v.definition_vi && <span className="text-xs text-accent-400">{v.definition_vi}</span>}
                    </div>
                    {v.example_sentence && (
                      <p className="text-xs text-surface-200/30 mt-0.5 italic">"{v.example_sentence}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual Add/Edit Vocabulary Form */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-surface-50">
              {editingVocabId ? 'Chỉnh sửa từ vựng' : 'Thêm từ vựng thủ công'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" value={vocabForm.word} onChange={(e) => setVocabForm((f) => ({ ...f, word: e.target.value }))} placeholder="Từ vựng *" className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
              <input type="text" value={vocabForm.ipa_pronunciation} onChange={(e) => setVocabForm((f) => ({ ...f, ipa_pronunciation: e.target.value }))} placeholder="IPA (VD: /ˈbɪznəs/)" className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
              <select value={vocabForm.part_of_speech} onChange={(e) => setVocabForm((f) => ({ ...f, part_of_speech: e.target.value }))} className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-200 text-sm focus:outline-none focus:border-primary-500/50">
                <option value="">Loại từ</option>
                {partsOfSpeech.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" value={vocabForm.definition_en} onChange={(e) => setVocabForm((f) => ({ ...f, definition_en: e.target.value }))} placeholder="Nghĩa tiếng Anh" className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
              <input type="text" value={vocabForm.definition_vi} onChange={(e) => setVocabForm((f) => ({ ...f, definition_vi: e.target.value }))} placeholder="Nghĩa tiếng Việt" className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
            </div>
            <input type="text" value={vocabForm.example_sentence} onChange={(e) => setVocabForm((f) => ({ ...f, example_sentence: e.target.value }))} placeholder="Câu ví dụ" className="w-full px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
            <div className="flex gap-2">
              <button onClick={handleAddVocab} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Plus className="w-4 h-4" />
                {editingVocabId ? 'Cập nhật' : 'Thêm'}
              </button>
              {editingVocabId && (
                <button onClick={() => { setEditingVocabId(null); setVocabForm({ word: '', ipa_pronunciation: '', part_of_speech: '', definition_en: '', definition_vi: '', example_sentence: '', difficulty_rank: '' }) }} className="px-4 py-2 rounded-xl text-sm bg-surface-800 text-surface-200">
                  Hủy
                </button>
              )}
            </div>
          </div>

          {/* Existing Vocabulary List */}
          {vocabularyItems.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Languages className="w-8 h-8 mx-auto text-surface-200/30 mb-2" />
              <p className="text-sm text-surface-200/50">Chưa có từ vựng</p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-2.5 bg-surface-800/30 border-b border-surface-800/30">
                <span className="text-xs font-medium text-surface-200/50">Từ vựng đã lưu ({vocabularyItems.length})</span>
              </div>
              {vocabularyItems.map((v) => (
                <div key={v.id} className="flex items-center gap-4 px-5 py-3 border-b border-surface-800/30 hover:bg-surface-800/20 transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-surface-50">{v.word}</span>
                      {v.ipa_pronunciation && <span className="text-xs text-surface-200/40">{v.ipa_pronunciation}</span>}
                      {v.part_of_speech && <Badge variant="primary" size="sm">{v.part_of_speech}</Badge>}
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      {v.definition_en && <span className="text-xs text-surface-200/60">{v.definition_en}</span>}
                      {v.definition_vi && <span className="text-xs text-accent-400">{v.definition_vi}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditVocab(v)} className="p-1.5 rounded-lg text-surface-200/50 hover:text-primary-400 hover:bg-primary-500/10">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteVocabId(v.id)} className="p-1.5 rounded-lg text-surface-200/50 hover:text-error hover:bg-error/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ QUIZ TAB ============ */}
      {activeTab === 'quiz' && isEdit && (
        <div className="space-y-4">
          {/* AI Generate Quiz */}
          {form.raw_content.trim().length > 50 && (
            <div className="glass-card p-5 border border-violet-500/20 bg-violet-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-50">AI Tạo quiz</h3>
                    <p className="text-xs text-surface-200/40">Gemini tạo câu hỏi kiểm tra từ nội dung bài học</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const vocabWords = vocabularyItems.map(v => v.word)
                    generateQuiz(form.raw_content, vocabWords.length > 0 ? vocabWords : undefined)
                  }}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 text-violet-400 text-sm font-medium hover:bg-violet-500/25 disabled:opacity-50 transition-all"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? 'Đang tạo...' : '🤖 Generate'}
                </button>
              </div>

              {aiError && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-error/10 text-error text-xs">{aiError}</div>
              )}
            </div>
          )}

          {/* AI Generated Quiz Preview */}
          {generatedQuestions && generatedQuestions.length > 0 && (
            <div className="glass-card overflow-hidden border border-violet-500/20">
              <div className="px-5 py-3 bg-violet-500/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-violet-300">
                    AI đã tạo {generatedQuestions.length} câu hỏi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectAllQuestions(!generatedQuestions.every(q => q.selected))}
                    className="text-xs text-surface-200/50 hover:text-surface-50 transition-all"
                  >
                    {generatedQuestions.every(q => q.selected) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                  <button
                    onClick={handleSaveAIQuiz}
                    disabled={savingBatch || generatedQuestions.filter(q => q.selected).length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 disabled:opacity-50 transition-all"
                  >
                    {savingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Lưu đã chọn ({generatedQuestions.filter(q => q.selected).length})
                  </button>
                  <button
                    onClick={clearQuestions}
                    className="p-1.5 rounded-lg text-surface-200/40 hover:text-error hover:bg-error/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {generatedQuestions.map((q: GeneratedQuestion, i: number) => (
                <div
                  key={i}
                  onClick={() => toggleQuestionSelection(i)}
                  className={`flex items-start gap-3 px-5 py-4 border-b border-surface-800/20 cursor-pointer transition-all ${
                    q.selected ? 'bg-violet-500/5' : 'opacity-40'
                  }`}
                >
                  {q.selected ? (
                    <CheckSquare className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-surface-200/30 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-bold">{i + 1}</span>
                      <Badge variant="primary" size="sm">{q.question_type === 'multiple_choice' ? 'Trắc nghiệm' : q.question_type === 'true_false' ? 'Đúng/Sai' : 'Điền từ'}</Badge>
                    </div>
                    <p className="text-sm text-surface-50 mt-1">{q.question_text}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {q.options.map((opt, j) => (
                          <span
                            key={j}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              opt === q.correct_answer
                                ? 'bg-success/15 text-success border border-success/20'
                                : 'bg-surface-800 text-surface-200/60'
                            }`}
                          >
                            {String.fromCharCode(65 + j)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <p className="text-xs text-surface-200/40 mt-1">💡 {q.explanation}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual Add Question Form */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-surface-50">Thêm câu hỏi thủ công</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <input type="text" value={qForm.question_text} onChange={(e) => setQForm((f) => ({ ...f, question_text: e.target.value }))} placeholder="Nhập câu hỏi *" className="w-full px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
              </div>
              <select value={qForm.question_type} onChange={(e) => setQForm((f) => ({ ...f, question_type: e.target.value }))} className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-200 text-sm focus:outline-none focus:border-primary-500/50">
                {questionTypes.map((t) => (
                  <option key={t} value={t}>{t === 'multiple_choice' ? 'Trắc nghiệm' : t === 'true_false' ? 'Đúng/Sai' : 'Điền từ'}</option>
                ))}
              </select>
            </div>
            {qForm.question_type === 'multiple_choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {qForm.options.map((opt, i) => (
                  <input key={i} type="text" value={opt} onChange={(e) => { const newOpts = [...qForm.options]; newOpts[i] = e.target.value; setQForm((f) => ({ ...f, options: newOpts })) }} placeholder={`Đáp án ${String.fromCharCode(65 + i)}`} className="px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" value={qForm.correct_answer} onChange={(e) => setQForm((f) => ({ ...f, correct_answer: e.target.value }))} placeholder="Đáp án đúng *" className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
              <input type="text" value={qForm.explanation} onChange={(e) => setQForm((f) => ({ ...f, explanation: e.target.value }))} placeholder="Giải thích (tùy chọn)" className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 text-sm focus:outline-none focus:border-primary-500/50" />
            </div>
            <button onClick={handleAddQuestion} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Plus className="w-4 h-4" />
              Thêm câu hỏi
            </button>
          </div>

          {/* Existing Questions List */}
          {(!quizzes[0]?.questions || quizzes[0].questions.length === 0) ? (
            <div className="glass-card p-8 text-center">
              <HelpCircle className="w-8 h-8 mx-auto text-surface-200/30 mb-2" />
              <p className="text-sm text-surface-200/50">Chưa có câu hỏi quiz</p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-2.5 bg-surface-800/30 border-b border-surface-800/30">
                <span className="text-xs font-medium text-surface-200/50">Câu hỏi đã lưu ({quizzes[0].questions!.length})</span>
              </div>
              {quizzes[0].questions!.map((q: QuizQuestion, index: number) => (
                <div key={q.id} className="flex items-start gap-4 px-5 py-4 border-b border-surface-800/30 hover:bg-surface-800/20 transition-all group">
                  <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center text-warning text-xs font-bold shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-50">{q.question_text}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {q.options.map((opt: string, i: number) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${opt === q.correct_answer ? 'bg-success/15 text-success border border-success/20' : 'bg-surface-800 text-surface-200/60'}`}>
                            {String.fromCharCode(65 + i)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                    {q.explanation && <p className="text-xs text-surface-200/40 mt-1">💡 {q.explanation}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await deleteQuizQuestion(q.id)
                      addToast('success', 'Đã xóa câu hỏi')
                      if (lessonId) fetchQuizzes(lessonId)
                    }}
                    className="p-1.5 rounded-lg text-surface-200/30 hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ SKILLS TAB ============ */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          {/* Generate controls */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-surface-50 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-400" />
              Tạo bài luyện 4 kỹ năng
            </h3>
            <p className="text-xs text-surface-200/40">
              AI sẽ tạo bài tập dựa trên nội dung và từ vựng của bài học này
            </p>

            {/* Skill count controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['listening', 'speaking', 'reading', 'writing'] as const).map(skill => (
                <div key={skill} className="flex items-center justify-between p-2 rounded-lg bg-surface-800/30">
                  <span className="text-xs text-surface-200/60">{skill === 'listening' ? '🎧 Nghe' : skill === 'speaking' ? '🎙️ Nói' : skill === 'reading' ? '📖 Đọc' : '✍️ Viết'}</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={skillCounts[skill]}
                    onChange={(e) => setSkillCounts(prev => ({ ...prev, [skill]: parseInt(e.target.value) || 0 }))}
                    className="w-12 text-center px-1 py-0.5 rounded bg-surface-900/60 border border-surface-700/50 text-surface-50 text-xs"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerateSkills}
              disabled={generatingSkills || !isEdit}
              className="w-full py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
            >
              {generatingSkills ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> AI đang tạo bài tập...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Tạo bài 4 kỹ năng</>
              )}
            </button>
          </div>

          {/* Manual creation toggle & form */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-50 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Tạo thủ công
              </h3>
              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showManualForm
                    ? 'bg-surface-700/50 text-surface-200/60'
                    : 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25'
                }`}
              >
                {showManualForm ? 'Đóng' : 'Mở form'}
              </button>
            </div>

            {showManualForm && (
              <div className="space-y-3 animate-fade-in">
                {/* Skill + Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-surface-200/40 mb-1 block">Kỹ năng</label>
                    <select
                      value={manualForm.skill}
                      onChange={(e) => {
                        const skill = e.target.value as typeof manualForm.skill
                        const defaultMode = SKILL_MODES[skill][0].value
                        setManualForm(f => ({
                          ...f,
                          skill,
                          mode: defaultMode,
                          contentJson: CONTENT_TEMPLATES[defaultMode] || '',
                        }))
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/50 text-surface-50 text-xs"
                    >
                      <option value="listening">🎧 Nghe (Listening)</option>
                      <option value="speaking">🎙️ Nói (Speaking)</option>
                      <option value="reading">📖 Đọc (Reading)</option>
                      <option value="writing">✍️ Viết (Writing)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-200/40 mb-1 block">Loại bài</label>
                    <select
                      value={manualForm.mode}
                      onChange={(e) => {
                        const mode = e.target.value
                        setManualForm(f => ({
                          ...f,
                          mode,
                          contentJson: f.contentJson || CONTENT_TEMPLATES[mode] || '',
                        }))
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/50 text-surface-50 text-xs"
                    >
                      {SKILL_MODES[manualForm.skill].map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Titles */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-surface-200/40 mb-1 block">Tiêu đề (EN)</label>
                    <input
                      type="text"
                      value={manualForm.title}
                      onChange={(e) => setManualForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Listening: Daily Routines"
                      className="w-full px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/50 text-surface-50 text-xs placeholder-surface-200/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-200/40 mb-1 block">Tiêu đề (VI)</label>
                    <input
                      type="text"
                      value={manualForm.title_vi}
                      onChange={(e) => setManualForm(f => ({ ...f, title_vi: e.target.value }))}
                      placeholder="e.g. Nghe chép: Thói quen hàng ngày"
                      className="w-full px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/50 text-surface-50 text-xs placeholder-surface-200/20"
                    />
                  </div>
                </div>

                {/* Content JSON */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-surface-200/40">Nội dung (JSON)</label>
                    <button
                      onClick={() => setManualForm(f => ({ ...f, contentJson: CONTENT_TEMPLATES[f.mode] || '' }))}
                      className="text-[10px] text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      📋 Tải template mẫu
                    </button>
                  </div>
                  <textarea
                    value={manualForm.contentJson}
                    onChange={(e) => setManualForm(f => ({ ...f, contentJson: e.target.value }))}
                    rows={12}
                    placeholder="Nhập JSON nội dung bài tập..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/50 text-surface-50 text-xs font-mono placeholder-surface-200/20 resize-y"
                    spellCheck={false}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleManualSkillCreate}
                    disabled={savingManual || !isEdit}
                    className="flex-1 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-cyan-500/30 transition-all text-sm border border-cyan-500/30"
                  >
                    {savingManual ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</>
                    ) : (
                      <><Plus className="w-4 h-4" /> Tạo bài luyện</>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowManualForm(false)
                      setManualForm({ skill: 'listening', mode: 'dictation', title: '', title_vi: '', contentJson: '' })
                    }}
                    className="px-4 py-2.5 rounded-xl bg-surface-800/50 text-surface-200/60 text-sm hover:bg-surface-700/50 transition-all"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing skill exercises */}
          {skillExercises.length > 0 && (
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-surface-50">Bài luyện đã tạo ({skillExercises.length})</h4>
                <div className="flex items-center gap-2">
                  {skillExercises.some(e => !e.is_published) && (
                    <button
                      onClick={handlePublishAll}
                      className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium hover:bg-success/30 transition-all flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" /> Publish tất cả
                    </button>
                  )}
                  {skillExercises.some(e => e.is_published) && (
                    <button
                      onClick={handleUnpublishAll}
                      className="px-3 py-1.5 rounded-lg bg-surface-800/50 text-surface-200/60 text-xs font-medium hover:bg-surface-700/50 transition-all flex items-center gap-1"
                    >
                      <EyeOff className="w-3 h-3" /> Unpublish tất cả
                    </button>
                  )}
                </div>
              </div>
              {skillExercises.map((ex) => (
                <div key={ex.id} className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  ex.is_published ? 'bg-success/5 border border-success/20' : 'bg-surface-800/30'
                }`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs shrink-0">
                      {ex.skill === 'listening' ? '🎧' : ex.skill === 'speaking' ? '🎙️' : ex.skill === 'reading' ? '📖' : '✍️'}
                    </span>
                    <span className="text-xs text-surface-50 truncate">{ex.title_vi || ex.title}</span>
                    <span className="text-[10px] text-surface-200/30 shrink-0">({ex.mode})</span>
                    {ex.is_published && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success font-medium shrink-0">LIVE</span>
                    )}
                    {!ex.is_published && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-200/40 font-medium shrink-0">DRAFT</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Preview */}
                    <button
                      onClick={() => setPreviewExercise(ex)}
                      className="p-1.5 rounded-lg hover:bg-primary-500/10 text-surface-200/40 hover:text-primary-400 transition-all"
                      title="Xem trước / Chạy thử"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {/* Publish toggle */}
                    <button
                      onClick={() => handleTogglePublish(ex.id, ex.is_published)}
                      className={`p-1.5 rounded-lg transition-all ${
                        ex.is_published
                          ? 'hover:bg-amber-500/10 text-success hover:text-amber-400'
                          : 'hover:bg-success/10 text-surface-200/30 hover:text-success'
                      }`}
                      title={ex.is_published ? 'Chuyển về Draft' : 'Publish cho user'}
                    >
                      {ex.is_published ? <Globe className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteSkillExercise(ex.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-200/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={!!deleteVocabId}
        onClose={() => setDeleteVocabId(null)}
        onConfirm={handleDeleteVocab}
        title="Xóa từ vựng"
        message="Xóa từ vựng này khỏi bài học?"
        confirmText="Xóa"
      />

      {/* ============ SKILL PREVIEW MODAL ============ */}
      {previewExercise && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewExercise(null)}>
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-900 border border-surface-700/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-surface-800 bg-surface-900/95 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary-400" />
                <h3 className="text-sm font-bold text-surface-50">Preview: {previewExercise.title_vi || previewExercise.title}</h3>
                {previewExercise.is_published ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success font-medium">LIVE</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-200/40 font-medium">DRAFT</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!previewExercise.is_published && (
                  <button
                    onClick={() => {
                      handleTogglePublish(previewExercise.id, false)
                      setPreviewExercise((prev: any) => prev ? { ...prev, is_published: true } : null)
                    }}
                    className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium hover:bg-success/30 transition-all flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" /> Publish
                  </button>
                )}
                <button
                  onClick={() => setPreviewExercise(null)}
                  className="p-2 rounded-lg hover:bg-surface-800 text-surface-200/40 hover:text-surface-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal body — SkillExercisePlayer */}
            <div className="p-5">
              <SkillPreviewPlayer exercise={previewExercise} />
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Inline Preview Player (reuses store injection) ─── */
import { useListeningStore } from '@/features/listening/stores/listeningStore'
import { useSpeakingStore } from '@/features/speaking/stores/speakingStore'
import { useReadingStore } from '@/features/reading/stores/readingStore'
import { useWritingStore } from '@/features/writing/stores/writingStore'

import { DictationExercise } from '@/features/listening/components/DictationExercise'
import { FillBlankExercise } from '@/features/listening/components/FillBlankExercise'
import { DialogueExercise } from '@/features/listening/components/DialogueExercise'
import { DictationResult } from '@/features/listening/components/DictationResult'
import { FillBlankResult } from '@/features/listening/components/FillBlankResult'
import { DialogueResult } from '@/features/listening/components/DialogueResult'
import { PronunciationExercise } from '@/features/speaking/components/PronunciationExercise'
import { ShadowingExercise } from '@/features/speaking/components/ShadowingExercise'
import { PronunciationResult } from '@/features/speaking/components/PronunciationResult'
import { ShadowingResult } from '@/features/speaking/components/ShadowingResult'
import { LevelReading } from '@/features/reading/components/LevelReading'
import { ReadingQuestions } from '@/features/reading/components/ReadingQuestions'
import { ReadingAloud } from '@/features/reading/components/ReadingAloud'
import { ReadingResult } from '@/features/reading/components/ReadingResult'
import { ReadingAloudResult } from '@/features/reading/components/ReadingAloudResult'
import { SentenceBuilding } from '@/features/writing/components/SentenceBuilding'
import { ParaphraseExercise } from '@/features/writing/components/ParaphraseExercise'
import { EssayWriting } from '@/features/writing/components/EssayWriting'
import { SentenceBuildingResult } from '@/features/writing/components/SentenceBuildingResult'
import { ParaphraseResult } from '@/features/writing/components/ParaphraseResult'
import { EssayFeedback } from '@/features/writing/components/EssayFeedback'

/* eslint-disable @typescript-eslint/no-explicit-any */

function SkillPreviewPlayer({ exercise }: { exercise: any }) {
  const [injected, setInjected] = useState(false)

  useEffect(() => {
    setInjected(false)

    if (exercise.skill === 'listening') {
      useListeningStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        result: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null, source: 'cache' as const }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'speaking') {
      useSpeakingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        result: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'reading') {
      useReadingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'reading',
        evalResult: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'writing') {
      useWritingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        evalResult: null,
        error: null,
        batchItems: [exercise.content],
        currentBatchIndex: 0,
      })
    }

    setInjected(true)

    return () => {
      if (exercise.skill === 'listening') useListeningStore.setState({ phase: 'config', content: null, result: null })
      else if (exercise.skill === 'speaking') useSpeakingStore.setState({ phase: 'config', content: null, result: null })
      else if (exercise.skill === 'reading') useReadingStore.setState({ phase: 'config', content: null, evalResult: null })
      else if (exercise.skill === 'writing') useWritingStore.setState({ phase: 'config', content: null, evalResult: null })
    }
  }, [exercise])

  const listeningPhase = useListeningStore(s => s.phase)
  const speakingPhase = useSpeakingStore(s => s.phase)
  const readingPhase = useReadingStore(s => s.phase)
  const writingPhase = useWritingStore(s => s.phase)

  if (!injected) return null

  const { skill, mode } = exercise

  if (skill === 'listening') {
    if (listeningPhase === 'result') {
      if (mode === 'dictation') return <DictationResult />
      if (mode === 'fill_blank') return <FillBlankResult />
      if (mode === 'dialogue') return <DialogueResult />
    }
    if (mode === 'dictation') return <DictationExercise />
    if (mode === 'fill_blank') return <FillBlankExercise />
    if (mode === 'dialogue') return <DialogueExercise />
  }
  if (skill === 'speaking') {
    if (speakingPhase === 'result') {
      if (mode === 'pronunciation') return <PronunciationResult />
      if (mode === 'shadowing') return <ShadowingResult />
    }
    if (mode === 'pronunciation') return <PronunciationExercise />
    if (mode === 'shadowing') return <ShadowingExercise />
  }
  if (skill === 'reading') {
    if (readingPhase === 'result') {
      if (mode === 'level_reading') return <ReadingResult />
      if (mode === 'reading_aloud') return <ReadingAloudResult />
    }
    if (readingPhase === 'questions') return <ReadingQuestions />
    if (mode === 'level_reading') return <LevelReading />
    if (mode === 'reading_aloud') return <ReadingAloud />
  }
  if (skill === 'writing') {
    if (writingPhase === 'result') {
      if (mode === 'sentence_building') return <SentenceBuildingResult />
      if (mode === 'paraphrase') return <ParaphraseResult />
      if (mode === 'essay') return <EssayFeedback />
    }
    if (mode === 'sentence_building') return <SentenceBuilding />
    if (mode === 'paraphrase') return <ParaphraseExercise />
    if (mode === 'essay') return <EssayWriting />
  }

  return <p className="text-sm text-surface-200/40">Không hỗ trợ loại: {skill}/{mode}</p>
}
