import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Plus, Trash2, Edit3, ArrowLeft, GripVertical } from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { useToastStore } from '@/shared/stores/toastStore'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Skeleton } from '@/shared/components/ui/Skeleton'

export function LessonListPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { currentCourse, lessons, loadingLessons: isLoading, fetchCourse, fetchLessons, deleteLesson } = useAdminStore()
  const { addToast } = useToastStore()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (courseId) {
      fetchCourse(courseId)
      fetchLessons(courseId)
    }
  }, [courseId, fetchCourse, fetchLessons])

  const handleDelete = async () => {
    if (!deleteId || !courseId) return
    await deleteLesson(deleteId)
    addToast('success', 'Đã xóa bài học')
    setDeleteId(null)
    fetchLessons(courseId)
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
          <h2 className="text-xl font-bold text-surface-50">Quản lý bài học</h2>
          {currentCourse && (
            <p className="text-sm text-surface-200/50">{currentCourse.title}</p>
          )}
        </div>
        <Link
          to={`/admin/courses/${courseId}/lessons/new`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Thêm bài học
        </Link>
      </div>

      {/* Lesson List */}
      {isLoading ? (
        <div className="glass-card p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-3">
              <Skeleton className="w-6 h-6 rounded" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-surface-200/50 text-sm mb-2">Chưa có bài học nào</p>
          <Link
            to={`/admin/courses/${courseId}/lessons/new`}
            className="text-primary-400 text-sm hover:underline"
          >
            Tạo bài học đầu tiên →
          </Link>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-surface-800/30 hover:bg-surface-800/20 transition-all group"
            >
              <div className="text-surface-200/30 cursor-grab">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-400 text-sm font-bold">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/admin/courses/${courseId}/lessons/${lesson.id}/edit`}
                  className="text-sm font-medium text-surface-50 hover:text-primary-400 transition-colors"
                >
                  {lesson.title}
                </Link>
                {lesson.ai_summary && (
                  <p className="text-xs text-surface-200/40 truncate mt-0.5">{lesson.ai_summary}</p>
                )}
              </div>
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  to={`/admin/courses/${courseId}/lessons/${lesson.id}/edit`}
                  className="p-2 rounded-lg text-surface-200/50 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setDeleteId(lesson.id)}
                  className="p-2 rounded-lg text-surface-200/50 hover:text-error hover:bg-error/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Xóa bài học"
        message="Xóa bài học sẽ xóa toàn bộ từ vựng và quiz liên quan."
        confirmText="Xóa bài học"
      />
    </div>
  )
}
