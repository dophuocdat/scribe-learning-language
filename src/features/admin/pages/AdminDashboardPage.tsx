import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, GraduationCap, Languages, Users, Plus, FolderTree } from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { Skeleton } from '@/shared/components/ui/Skeleton'

export function AdminDashboardPage() {
  const { stats, loadingStats, loadingCourses, fetchStats, courses, fetchCourses } = useAdminStore()
  const isLoading = loadingStats || loadingCourses

  useEffect(() => {
    fetchStats()
    fetchCourses()
  }, [fetchStats, fetchCourses])

  const statItems = [
    { label: 'Khóa học', value: stats?.totalCourses ?? 0, icon: BookOpen, color: 'text-primary-400 bg-primary-500/15' },
    { label: 'Bài học', value: stats?.totalLessons ?? 0, icon: GraduationCap, color: 'text-accent-400 bg-accent-500/15' },
    { label: 'Từ vựng', value: stats?.totalVocabulary ?? 0, icon: Languages, color: 'text-success bg-success/15' },
    { label: 'Người dùng', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-warning bg-warning/15' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item) => (
          <div key={item.label} className="glass-card p-5">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ) : (
              <>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-surface-50">{item.value}</p>
                <p className="text-sm text-surface-200/50">{item.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/admin/courses/new"
          className="glass-card p-5 flex items-center gap-4 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-surface-50">Tạo khóa học mới</p>
            <p className="text-sm text-surface-200/50">Thêm khóa học và bài giảng</p>
          </div>
        </Link>
        <Link
          to="/admin/categories"
          className="glass-card p-5 flex items-center gap-4 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-accent-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FolderTree className="w-6 h-6 text-accent-400" />
          </div>
          <div>
            <p className="font-semibold text-surface-50">Quản lý danh mục</p>
            <p className="text-sm text-surface-200/50">Phân loại khóa học theo chủ đề</p>
          </div>
        </Link>
      </div>

      {/* Recent Courses */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-surface-50 mb-4">Khóa học gần đây</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-10 h-10 mx-auto text-surface-200/30 mb-2" />
            <p className="text-sm text-surface-200/50">Chưa có khóa học nào</p>
            <Link to="/admin/courses/new" className="text-primary-400 text-sm hover:underline mt-1 inline-block">
              Tạo khóa học đầu tiên →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {courses.slice(0, 5).map((course) => (
              <Link
                key={course.id}
                to={`/admin/courses/${course.id}/lessons`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-800/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-50 truncate group-hover:text-primary-400 transition-colors">
                    {course.title}
                  </p>
                  <p className="text-xs text-surface-200/50">
                    {course.category?.name ?? 'Chưa phân loại'} · {course.lessons_count ?? 0} bài học
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                  course.is_published
                    ? 'bg-success/15 text-success border border-success/20'
                    : 'bg-surface-700/60 text-surface-200/70 border border-surface-600/30'
                }`}>
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
