import { useEffect } from 'react'
import {
  BookOpen,
  ScanLine,
  Brain,
  Flame,
  Trophy,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { useLearnStore } from '@/features/learn/stores/learnStore'

export function DashboardPage() {
  const { profile } = useAuthStore()
  const { courses, srsStats, fetchPublishedCourses, fetchSrsCards, loadingCourses } =
    useLearnStore()

  useEffect(() => {
    fetchPublishedCourses()
    fetchSrsCards()
  }, [fetchPublishedCourses, fetchSrsCards])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <section className="relative overflow-hidden rounded-2xl gradient-bg p-8">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Xin chào, {profile?.display_name || 'Learner'} 👋
          </h1>
          <p className="text-white/70 mt-2 text-sm sm:text-base">
            Hãy tiếp tục hành trình chinh phục ngôn ngữ của bạn!
          </p>
          <div className="flex flex-wrap gap-4 mt-6">
            <StatBadge icon={<Flame className="w-4 h-4" />} label="Streak" value={`${profile?.current_streak || 0} ngày`} />
            <StatBadge icon={<Trophy className="w-4 h-4" />} label="Level" value={`${profile?.current_level || 1}`} />
            <StatBadge icon={<Sparkles className="w-4 h-4" />} label="XP" value={`${profile?.total_xp || 0}`} />
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-10 -right-20 w-60 h-60 rounded-full bg-white/5" />
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickAction
          to="/scan"
          icon={<ScanLine className="w-6 h-6" />}
          title="Smart Scan"
          description="Quét tài liệu & tạo bài học"
          gradient="from-primary-600 to-primary-500"
        />
        <QuickAction
          to="/review"
          icon={<Brain className="w-6 h-6" />}
          title="Ôn tập SRS"
          description={`${srsStats.dueToday} từ cần ôn hôm nay`}
          gradient="from-accent-600 to-accent-400"
        />
        <QuickAction
          to="/courses"
          icon={<BookOpen className="w-6 h-6" />}
          title="Khóa học"
          description={`${courses.length} khóa học có sẵn`}
          gradient="from-success to-emerald-400"
        />
      </section>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Courses */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-400" />
              Khóa học mới nhất
            </h2>
            <Link to="/courses" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {loadingCourses ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/30">
                  <div className="w-10 h-10 rounded-lg bg-surface-700/50 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-2/3 bg-surface-700/50 rounded animate-pulse" />
                    <div className="h-2.5 w-1/3 bg-surface-700/50 rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : courses.length > 0 ? (
              courses.slice(0, 4).map((course) => (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/30 hover:bg-surface-800/50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600/30 to-accent-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {course.cover_image_url ? (
                      <img src={course.cover_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-surface-200/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-50 truncate group-hover:text-primary-400 transition-colors">
                      {course.title}
                    </p>
                    <p className="text-xs text-surface-200/30">
                      {course.lessons_count || 0} bài · {course.difficulty_level || '—'}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-surface-200/20 group-hover:text-primary-400 transition-colors shrink-0" />
                </Link>
              ))
            ) : (
              <EmptyState message="Chưa có khóa học nào. Bắt đầu khám phá ngay!" />
            )}
          </div>
        </section>

        {/* SRS Stats + Personal Corner */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-400" />
              Ôn tập & Tiến độ
            </h2>
            <Link to="/review" className="text-sm text-accent-400 hover:text-accent-500 flex items-center gap-1 transition-colors">
              Ôn tập ngay <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* SRS Mini Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-surface-800/40 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-primary-400">{srsStats.dueToday}</p>
              <p className="text-[10px] text-surface-200/30 uppercase tracking-wider">Cần ôn</p>
            </div>
            <div className="bg-surface-800/40 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-success">{srsStats.mastered}</p>
              <p className="text-[10px] text-surface-200/30 uppercase tracking-wider">Đã thuộc</p>
            </div>
            <div className="bg-surface-800/40 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-surface-200/60">{srsStats.total}</p>
              <p className="text-[10px] text-surface-200/30 uppercase tracking-wider">Tổng thẻ</p>
            </div>
          </div>

          {srsStats.total === 0 ? (
            <EmptyState message="Thêm từ vựng từ bài học để bắt đầu ôn tập SRS!" />
          ) : srsStats.dueToday > 0 ? (
            <Link
              to="/review"
              className="block w-full text-center py-3 rounded-xl bg-accent-500/10 text-accent-400 text-sm font-medium hover:bg-accent-500/20 transition-colors"
            >
              Bắt đầu ôn tập {srsStats.dueToday} thẻ →
            </Link>
          ) : (
            <p className="text-center text-xs text-surface-200/30 py-3">
              🎉 Bạn đã ôn tập xong tất cả hôm nay!
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
      {icon}
      <div>
        <p className="text-[10px] text-white/50 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  )
}

function QuickAction({
  to,
  icon,
  title,
  description,
  gradient,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  gradient: string
}) {
  return (
    <Link
      to={to}
      className="glass-card p-5 group flex items-start gap-4 hover:scale-[1.02] transition-all"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0 shadow-lg`}>
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-surface-50 group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-surface-200/50 mt-0.5">{description}</p>
      </div>
    </Link>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-surface-200/30 text-sm">
      {message}
    </div>
  )
}
