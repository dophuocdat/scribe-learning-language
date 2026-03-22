import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, ArrowLeft, Trash2, Edit3, BookOpen, ChevronRight } from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { Badge } from '@/shared/components/ui/Badge'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { SkeletonTable } from '@/shared/components/ui/Skeleton'
import { useToastStore } from '@/shared/stores/toastStore'

export function CategoryCoursesPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { courses, categories, loadingCourses: isLoading, fetchCourses, fetchCategories, deleteCourse } = useAdminStore()
  const { addToast } = useToastStore()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchCourses()
    fetchCategories()
  }, [fetchCourses, fetchCategories])

  const category = categories.find((c) => c.id === categoryId)
  const filtered = courses.filter((c) => c.category_id === categoryId)

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    await deleteCourse(deleteId)
    addToast('success', 'Đã xóa khóa học')
    setDeleteId(null)
    setIsDeleting(false)
  }

  const difficultyVariant = (level: string | null) => {
    if (!level) return 'default' as const
    if (['A1', 'A2'].includes(level)) return 'success' as const
    if (['B1', 'B2'].includes(level)) return 'warning' as const
    return 'error' as const
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
            {category?.name ?? 'Danh mục'}
          </h2>
          {category?.description && (
            <p className="text-sm text-surface-200/50 mt-0.5">{category.description}</p>
          )}
        </div>
        <Link
          to={`/admin/categories/${categoryId}/courses/new`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tạo khóa học
        </Link>
      </div>

      {/* Course List */}
      {isLoading ? (
        <div className="glass-card p-4">
          <SkeletonTable rows={4} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-surface-200/30 mb-3" />
          <p className="text-surface-200/50 text-sm mb-4">
            Chưa có khóa học nào trong danh mục này
          </p>
          <Link
            to={`/admin/categories/${categoryId}/courses/new`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tạo khóa học đầu tiên
          </Link>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium text-surface-200/40 uppercase tracking-wide border-b border-surface-700/50">
            <div className="col-span-5">Tên khóa học</div>
            <div className="col-span-1">Cấp độ</div>
            <div className="col-span-2 text-center">Bài học</div>
            <div className="col-span-2">Trạng thái</div>
            <div className="col-span-2 text-right">Thao tác</div>
          </div>

          {/* Rows */}
          {filtered.map((course) => (
            <div
              key={course.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center px-5 py-4 border-b border-surface-800/30 hover:bg-surface-800/30 transition-all"
            >
              <div className="col-span-5">
                <Link
                  to={`/admin/courses/${course.id}/edit`}
                  className="text-sm font-medium text-surface-50 hover:text-primary-400 transition-colors"
                >
                  {course.title}
                </Link>
                <p className="text-xs text-surface-200/40 truncate mt-0.5">{course.description || '—'}</p>
              </div>
              <div className="col-span-1">
                <Badge variant={difficultyVariant(course.difficulty_level)}>
                  {course.difficulty_level ?? '—'}
                </Badge>
              </div>
              <div className="col-span-2 text-center">
                <Link
                  to={`/admin/courses/${course.id}/lessons`}
                  className="text-sm text-primary-400 hover:underline"
                >
                  {course.lessons_count ?? 0} bài học
                </Link>
              </div>
              <div className="col-span-2">
                <Badge variant={course.is_published ? 'success' : 'default'}>
                  {course.is_published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <div className="col-span-2 flex gap-2 justify-end">
                <Link
                  to={`/admin/courses/${course.id}/edit`}
                  className="p-2 rounded-lg text-surface-200/50 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                  title="Chỉnh sửa"
                >
                  <Edit3 className="w-4 h-4" />
                </Link>
                <Link
                  to={`/admin/courses/${course.id}/lessons`}
                  className="p-2 rounded-lg text-surface-200/50 hover:text-accent-400 hover:bg-accent-500/10 transition-all"
                  title="Bài học"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setDeleteId(course.id)}
                  className="p-2 rounded-lg text-surface-200/50 hover:text-error hover:bg-error/10 transition-all"
                  title="Xóa"
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
        title="Xóa khóa học"
        message="Bạn có chắc chắn muốn xóa khóa học này? Tất cả bài học, từ vựng và quiz liên quan sẽ bị xóa."
        confirmText="Xóa khóa học"
        isLoading={isDeleting}
      />
    </div>
  )
}
