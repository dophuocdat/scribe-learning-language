import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Trash2, BookOpen, Sparkles } from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { useToastStore } from '@/shared/stores/toastStore'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Skeleton } from '@/shared/components/ui/Skeleton'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}



export function CourseFormPage() {
  const { courseId, categoryId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { currentCourse, categories, difficultyLevels, isSaving, fetchCourse, fetchCategories, fetchDifficultyLevels, createCourse, updateCourse, deleteCourse } = useAdminStore()
  const { addToast } = useToastStore()

  const isEdit = !!courseId
  const fromCategory = !!categoryId
  const backPath = fromCategory ? `/admin/categories/${categoryId}/courses` : '/admin/courses'
  const [loading, setLoading] = useState(isEdit)
  const [formReady, setFormReady] = useState(!isEdit)
  const [showDelete, setShowDelete] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: categoryId ?? '',
    difficulty_level: '' as string,
    cover_image_url: '',
    estimated_time_minutes: '',
    is_published: false,
  })

  // Clear stale currentCourse, then fetch fresh data for this courseId
  useEffect(() => {
    fetchCategories()
    fetchDifficultyLevels()
    if (isEdit && courseId) {
      // Reset stale state so form doesn't flash old data
      useAdminStore.setState({ currentCourse: null })
      setFormReady(false)
      fetchCourse(courseId).then(() => setLoading(false))
    }
  }, [courseId, isEdit, fetchCourse, fetchCategories])

  // Auto-fill form when fresh currentCourse arrives
  useEffect(() => {
    if (isEdit && currentCourse && currentCourse.id === courseId) {
      setForm({
        title: currentCourse.title ?? '',
        description: currentCourse.description ?? '',
        category_id: currentCourse.category_id ?? '',
        difficulty_level: currentCourse.difficulty_level ?? '',
        cover_image_url: currentCourse.cover_image_url ?? '',
        estimated_time_minutes: currentCourse.estimated_time_minutes?.toString() ?? '',
        is_published: currentCourse.is_published ?? false,
      })
      setFormReady(true)
    }
  }, [isEdit, currentCourse, courseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) {
      addToast('error', 'Vui lòng nhập tên khóa học')
      return
    }

    const payload = {
      title: form.title.trim(),
      slug: slugify(form.title),
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      difficulty_level: form.difficulty_level || null,
      cover_image_url: form.cover_image_url.trim() || null,
      estimated_time_minutes: form.estimated_time_minutes ? parseInt(form.estimated_time_minutes) : null,
      is_published: form.is_published,
      is_personal: false,
      source_type: 'manual' as const,
      created_by: user?.id ?? null,
      order_index: 0,
      parent_id: null,
      source_url: null,
      folder_id: null,
    }

    if (isEdit && courseId) {
      await updateCourse(courseId, payload)
      addToast('success', 'Đã cập nhật khóa học')
    } else {
      const created = await createCourse(payload)
      if (created) {
        addToast('success', 'Đã tạo khóa học — Tạo bài học đầu tiên với AI!')
        // Always navigate to lesson creation so user sees AI features immediately
        navigate(`/admin/courses/${created.id}/lessons/new`, { replace: true })
      }
    }
  }

  const handleDelete = async () => {
    if (!courseId) return
    await deleteCourse(courseId)
    addToast('success', 'Đã xóa khóa học')
    navigate(backPath, { replace: true })
  }

  if (loading || (isEdit && !formReady)) {
    return (
      <div className="space-y-5 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="glass-card p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
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
        <div className="flex-1">
          <h2 className="text-xl font-bold text-surface-50">
            {isEdit ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
          </h2>
        </div>
        {isEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/admin/courses/${courseId}/lessons`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500/15 text-accent-400 text-sm font-medium hover:bg-accent-500/25 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Bài học
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error/10 text-error text-sm font-medium hover:bg-error/20 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Xóa
            </button>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Tên khóa học *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="VD: TOEIC 500 Essential Words"
            className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all"
          />
          {form.title && (
            <p className="text-xs text-surface-200/40 mt-1">Slug: {slugify(form.title)}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Mô tả</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Mô tả ngắn gọn về khóa học..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all resize-none"
          />
        </div>

        {/* Category & Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Danh mục</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-200 focus:outline-none focus:border-primary-500/50 transition-all"
            >
              <option value="">Chưa phân loại</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Cấp độ</label>
            <select
              value={form.difficulty_level}
              onChange={(e) => setForm((f) => ({ ...f, difficulty_level: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-200 focus:outline-none focus:border-primary-500/50 transition-all"
            >
              <option value="">Chọn cấp độ</option>
              {difficultyLevels.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cover Image & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-200/70 mb-1.5">URL ảnh bìa</label>
            <input
              type="url"
              value={form.cover_image_url}
              onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Thời gian (phút)</label>
            <input
              type="number"
              value={form.estimated_time_minutes}
              onChange={(e) => setForm((f) => ({ ...f, estimated_time_minutes: e.target.value }))}
              placeholder="VD: 120"
              min="0"
              className="w-full px-4 py-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all"
            />
          </div>
        </div>

        {/* Published Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              form.is_published ? 'bg-success' : 'bg-surface-700'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              form.is_published ? 'left-[22px]' : 'left-0.5'
            }`} />
          </button>
          <span className="text-sm text-surface-200/70">
            {form.is_published ? 'Published — Hiển thị cho người dùng' : 'Draft — Chưa xuất bản'}
          </span>
        </div>

        {/* Actions */}
        {/* Hint for new course */}
        {!isEdit && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Sparkles className="w-5 h-5 text-violet-400 shrink-0" />
            <p className="text-sm text-violet-300">
              Sau khi tạo khóa học, bạn sẽ được chuyển đến <strong>tạo bài học</strong> với tính năng <strong>AI Scan & Generate</strong> từ vựng, quiz tự động.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isEdit ? <Save className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {isSaving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo & Bắt đầu AI'}
          </button>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 transition-all"
          >
            Hủy
          </button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Xóa khóa học"
        message="Xóa khóa học sẽ xóa toàn bộ bài học, từ vựng, quiz liên quan. Hành động này không thể hoàn tác."
        confirmText="Xóa vĩnh viễn"
      />
    </div>
  )
}
