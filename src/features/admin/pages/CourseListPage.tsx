import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, Edit3, BookOpen, ChevronRight } from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { Badge } from '@/shared/components/ui/Badge'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { SkeletonTable } from '@/shared/components/ui/Skeleton'
import { useToastStore } from '@/shared/stores/toastStore'

export function CourseListPage() {
  const { courses, categories, loadingCourses, fetchCourses, fetchCategories, deleteCourse } = useAdminStore()
  const isLoading = loadingCourses
  const { addToast } = useToastStore()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchCourses()
    fetchCategories()
  }, [fetchCourses, fetchCategories])

  const filtered = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !filterCategory || c.category_id === filterCategory
    return matchSearch && matchCategory
  })

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
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
            <input
              type="text"
              placeholder="Tìm khóa học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-sm text-surface-200 focus:outline-none focus:border-primary-500/50 transition-all"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <Link
          to="/admin/courses/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tạo khóa học
        </Link>
      </div>

      {/* Course List */}
      {isLoading ? (
        <div className="glass-card p-4">
          <SkeletonTable rows={5} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-surface-200/30 mb-3" />
          <p className="text-surface-200/50 text-sm">
            {search || filterCategory ? 'Không tìm thấy khóa học phù hợp' : 'Chưa có khóa học nào'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium text-surface-200/40 uppercase tracking-wide border-b border-surface-700/50">
            <div className="col-span-4">Tên khóa học</div>
            <div className="col-span-2">Danh mục</div>
            <div className="col-span-1">Cấp độ</div>
            <div className="col-span-2 text-center">Bài học</div>
            <div className="col-span-1">Trạng thái</div>
            <div className="col-span-2 text-right">Thao tác</div>
          </div>

          {/* Rows */}
          {filtered.map((course) => (
            <div
              key={course.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center px-5 py-4 border-b border-surface-800/30 hover:bg-surface-800/30 transition-all"
            >
              <div className="col-span-4">
                <Link
                  to={`/admin/courses/${course.id}/edit`}
                  className="text-sm font-medium text-surface-50 hover:text-primary-400 transition-colors"
                >
                  {course.title}
                </Link>
                <p className="text-xs text-surface-200/40 truncate mt-0.5">{course.description || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-surface-200/60">{course.category?.name ?? '—'}</span>
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
              <div className="col-span-1">
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
