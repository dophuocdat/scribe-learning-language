import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, GraduationCap, Languages, Users, Plus, FolderTree,
  HelpCircle, Dumbbell, Zap, Trophy, ScanLine, Brain,
  TrendingUp, BarChart3, Target, Clock,
} from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { Skeleton } from '@/shared/components/ui/Skeleton'

/* ───── Animated Counter ───── */
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    const start = performance.now()
    const from = 0
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration])
  return <>{display.toLocaleString()}</>
}

/* ───── CSS Progress Bar ───── */
function ProgressBar({ value, max, color = 'var(--color-primary-500)', label, showPercent = true }: {
  value: number; max: number; color?: string; label: string; showPercent?: boolean
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-surface-200/70">{label}</span>
        <span className="text-surface-50 font-medium">
          {value}/{max} {showPercent && <span className="text-surface-200/50">({pct}%)</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-800/80 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        />
      </div>
    </div>
  )
}

/* ───── Horizontal Bar Chart ───── */
function HorizontalBarChart({ items, maxValue }: {
  items: { name: string; count: number; color?: string }[]
  maxValue: number
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={item.name} className="group">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-surface-200/70 truncate mr-2">{item.name}</span>
            <span className="text-surface-50 font-semibold shrink-0">{item.count}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-800/80 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: maxValue > 0 ? `${(item.count / maxValue) * 100}%` : '0%',
                background: item.color || `hsl(${220 + i * 30}, 70%, 60%)`,
                transitionDelay: `${i * 100}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───── Donut Ring (CSS conic-gradient) ───── */
function DonutRing({ value, total, label, color = '#6366f1' }: {
  value: number; total: number; label: string; color?: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(51,65,85,0.5) ${pct * 3.6}deg)`,
        }}
      >
        <div className="w-11 h-11 rounded-full bg-surface-900 flex items-center justify-center">
          <span className="text-sm font-bold text-surface-50">{pct}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-surface-50">{label}</p>
        <p className="text-xs text-surface-200/50">{value} / {total}</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══════ MAIN DASHBOARD COMPONENT ═══════ */
/* ═══════════════════════════════════════════════ */

export function AdminDashboardPage() {
  const { stats, loadingStats, loadingCourses, fetchStats, courses, fetchCourses } = useAdminStore()
  const isLoading = loadingStats || loadingCourses

  useEffect(() => {
    fetchStats()
    fetchCourses()
  }, [fetchStats, fetchCourses])

  /* ── Section 1: Overview Stats ── */
  const statItems = [
    { label: 'Khóa học', value: stats?.totalCourses ?? 0, icon: BookOpen, color: 'text-primary-400 bg-primary-500/15', borderColor: 'border-primary-500/20' },
    { label: 'Bài học', value: stats?.totalLessons ?? 0, icon: GraduationCap, color: 'text-accent-400 bg-accent-500/15', borderColor: 'border-accent-500/20' },
    { label: 'Từ vựng', value: stats?.totalVocabulary ?? 0, icon: Languages, color: 'text-success bg-success/15', borderColor: 'border-success/20' },
    { label: 'Câu hỏi Quiz', value: stats?.totalQuizQuestions ?? 0, icon: HelpCircle, color: 'text-warning bg-warning/15', borderColor: 'border-warning/20' },
    { label: 'Bài tập kỹ năng', value: stats?.totalSkillExercises ?? 0, icon: Dumbbell, color: 'text-pink-400 bg-pink-500/15', borderColor: 'border-pink-500/20' },
    { label: 'Người dùng', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-violet-400 bg-violet-500/15', borderColor: 'border-violet-500/20' },
  ]

  const maxCatCount = Math.max(...(stats?.coursesByCategory ?? []).map(c => c.count), 1)
  const maxDiffCount = Math.max(...(stats?.coursesByDifficulty ?? []).map(d => d.count), 1)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ═══ SECTION 1: OVERVIEW STATS ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-surface-50">Tổng quan</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statItems.map((item, idx) => (
            <div
              key={item.label}
              className={`glass-card p-4 border ${item.borderColor}`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="w-9 h-9 rounded-xl" />
                  <Skeleton className="h-7 w-14" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              ) : (
                <>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${item.color}`}>
                    <item.icon className="w-4.5 h-4.5" />
                  </div>
                  <p className="text-2xl font-bold text-surface-50 tabular-nums">
                    <AnimatedNumber value={item.value} />
                  </p>
                  <p className="text-xs text-surface-200/50 mt-0.5">{item.label}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SECTION 2: CONTENT QUALITY ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-accent-400" />
          <h2 className="text-lg font-semibold text-surface-50">Chất lượng nội dung</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="glass-card p-5">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-4 w-full" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Category & Difficulty breakdown */}
            <div className="space-y-4">
              {/* Courses by Category */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-accent-400" />
                  Khóa học theo danh mục
                </h3>
                {(stats?.coursesByCategory ?? []).length > 0 ? (
                  <HorizontalBarChart
                    items={(stats?.coursesByCategory ?? []).map((c, i) => ({
                      name: c.name,
                      count: c.count,
                      color: `hsl(${220 + i * 35}, 65%, 58%)`,
                    }))}
                    maxValue={maxCatCount}
                  />
                ) : (
                  <p className="text-xs text-surface-200/40">Chưa có dữ liệu</p>
                )}
              </div>

              {/* Courses by Difficulty */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-warning" />
                  Khóa học theo cấp độ
                </h3>
                {(stats?.coursesByDifficulty ?? []).length > 0 ? (
                  <HorizontalBarChart
                    items={(stats?.coursesByDifficulty ?? []).map(d => ({
                      name: d.label,
                      count: d.count,
                      color: d.color,
                    }))}
                    maxValue={maxDiffCount}
                  />
                ) : (
                  <p className="text-xs text-surface-200/40">Chưa có dữ liệu</p>
                )}
              </div>
            </div>

            {/* Right: Ratios & Coverage */}
            <div className="space-y-4">
              {/* Published / Draft + Coverage */}
              <div className="glass-card p-5 space-y-5">
                <h3 className="text-sm font-semibold text-surface-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-success" />
                  Tỷ lệ & Độ phủ
                </h3>

                {/* Published vs Draft */}
                <DonutRing
                  value={stats?.publishedCourses ?? 0}
                  total={(stats?.publishedCourses ?? 0) + (stats?.draftCourses ?? 0)}
                  label="Đã xuất bản"
                  color="#10b981"
                />

                {/* Quiz Coverage */}
                <ProgressBar
                  value={stats?.lessonsWithQuiz ?? 0}
                  max={stats?.totalLessons ?? 0}
                  color="#f59e0b"
                  label="Bài học có Quiz"
                />

                {/* Skill Exercise Coverage */}
                <ProgressBar
                  value={stats?.lessonsWithSkillExercises ?? 0}
                  max={stats?.totalLessons ?? 0}
                  color="#ec4899"
                  label="Bài học có bài tập kỹ năng"
                />

                {/* Avg Vocab */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
                    <Languages className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-surface-50">{stats?.avgVocabPerLesson ?? 0}</p>
                    <p className="text-xs text-surface-200/50">Từ vựng TB / bài học</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ SECTION 3: USER ACTIVITY ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-surface-50">Hoạt động người dùng</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="glass-card p-5">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map(j => <Skeleton key={j} className="h-4 w-full" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Active Users + Learning Stats */}
            <div className="space-y-4">
              {/* Active Users */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-400" />
                  Người dùng hoạt động
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Hôm nay', value: stats?.activeUsersToday ?? 0, color: 'text-success' },
                    { label: 'Tuần này', value: stats?.activeUsersWeek ?? 0, color: 'text-accent-400' },
                    { label: 'Tháng này', value: stats?.activeUsersMonth ?? 0, color: 'text-primary-400' },
                  ].map(item => (
                    <div key={item.label} className="bg-surface-800/40 rounded-xl p-3 text-center">
                      <p className={`text-xl font-bold ${item.color}`}>
                        <AnimatedNumber value={item.value} />
                      </p>
                      <p className="text-[11px] text-surface-200/50 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Progress Grid */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  Tiến trình học tập
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tổng XP', value: stats?.totalXpEarned ?? 0, icon: Zap, color: 'text-warning bg-warning/10' },
                    { label: 'Quiz Attempts', value: stats?.totalQuizAttempts ?? 0, icon: HelpCircle, color: 'text-accent-400 bg-accent-500/10' },
                    { label: 'Điểm TB Quiz', value: stats?.avgQuizScore ?? 0, icon: Target, color: 'text-success bg-success/10', suffix: '%' },
                    { label: 'Cards Mastered', value: stats?.masteredCards ?? 0, icon: Brain, color: 'text-primary-400 bg-primary-500/10' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 bg-surface-800/30 rounded-xl p-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-surface-50 tabular-nums">
                          <AnimatedNumber value={item.value} />
                          {'suffix' in item && <span className="text-xs font-normal text-surface-200/50">{item.suffix}</span>}
                        </p>
                        <p className="text-[11px] text-surface-200/50 truncate">{item.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scan Usage */}
                <div className="mt-4 pt-3 border-t border-surface-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-surface-200/70">
                      <ScanLine className="w-3.5 h-3.5" />
                      Scan hôm nay
                    </div>
                    <span className="text-sm font-bold text-surface-50">{stats?.scansToday ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Top Users */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" />
                Top người dùng
              </h3>
              {(stats?.topUsers ?? []).length > 0 ? (
                <div className="space-y-2">
                  {(stats?.topUsers ?? []).map((user, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-800/30 hover:bg-surface-800/50 transition-colors"
                    >
                      {/* Rank */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-warning/20 text-warning' :
                        i === 1 ? 'bg-surface-200/10 text-surface-200/70' :
                        i === 2 ? 'bg-orange-500/15 text-orange-400' :
                        'bg-surface-800/50 text-surface-200/40'
                      }`}>
                        {i + 1}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-50 truncate">
                          {user.display_name || 'Ẩn danh'}
                        </p>
                        <p className="text-[11px] text-surface-200/40">
                          Lv.{user.current_level} · 🔥 {user.current_streak} ngày
                        </p>
                      </div>

                      {/* XP */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-warning tabular-nums">
                          {user.total_xp.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-surface-200/40">XP</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 mx-auto text-surface-200/20 mb-2" />
                  <p className="text-xs text-surface-200/40">Chưa có người dùng</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ SECTION 4: QUICK ACTIONS ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-warning" />
          <h2 className="text-lg font-semibold text-surface-50">Hành động nhanh</h2>
        </div>
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
      </div>

      {/* ═══ SECTION 5: RECENT COURSES ═══ */}
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
