import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search, Filter, GraduationCap, ArrowRight, Sparkles, TrendingUp } from 'lucide-react'
import { useLearnStore } from '../stores/learnStore'
import { CourseCard } from '../components/CourseCard'
import { supabase } from '@/shared/lib/supabase'
import type { DifficultyLevel } from '@/shared/types/database'

export function CoursesCatalogPage() {
  const { courses, loadingCourses, fetchPublishedCourses, userProgress, fetchUserProgress } = useLearnStore()
  const [search, setSearch] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [levels, setLevels] = useState<DifficultyLevel[]>([])

  useEffect(() => {
    fetchPublishedCourses().then(() => {
      fetchUserProgress()
    })
    supabase.from('difficulty_levels').select('*').order('order_index').then(({ data }) => {
      if (data) setLevels(data)
    })
  }, [fetchPublishedCourses, fetchUserProgress])

  const filtered = courses.filter((c) => {
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
    const matchLevel = !selectedLevel || c.difficulty_level === selectedLevel
    return matchSearch && matchLevel
  })

  // Separate in-progress courses for "Continue Learning" section
  const inProgressCourses = courses.filter((c) => {
    const prog = userProgress[c.id]
    return prog && prog.completedLessons > 0 && prog.completedLessons < prog.totalLessons
  })

  // Get the most recently accessed course
  const lastCourse = inProgressCourses.length > 0
    ? inProgressCourses.reduce((latest, curr) => {
        const latestTime = userProgress[latest.id]?.lastAccessedAt || ''
        const currTime = userProgress[curr.id]?.lastAccessedAt || ''
        return currTime > latestTime ? curr : latest
      })
    : null
  const lastProgress = lastCourse ? userProgress[lastCourse.id] : null

  // Group by category
  const categorized = new Map<string, typeof filtered>()
  const uncategorized: typeof filtered = []
  filtered.forEach((c) => {
    if (c.category?.name) {
      const list = categorized.get(c.category.name) || []
      list.push(c)
      categorized.set(c.category.name, list)
    } else {
      uncategorized.push(c)
    }
  })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600/20 via-surface-800/80 to-accent-500/10 border border-surface-700/50 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-500/5 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">Khóa học</h1>
              <p className="text-xs text-surface-200/50">
                Khám phá {courses.length} khóa học được biên soạn bởi AI
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-surface-200/40" />
              <span className="text-sm text-surface-200/60">{courses.length} khóa học</span>
            </div>
            {Object.keys(userProgress).length > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400/60" />
                <span className="text-sm text-surface-200/60">
                  {inProgressCourses.length} đang học
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Continue Learning Banner */}
      {lastCourse && lastProgress && (
        <Link
          to={lastProgress.lastLessonId ? `/lessons/${lastProgress.lastLessonId}` : `/courses/${lastCourse.id}`}
          className="glass-card p-4 sm:p-5 flex items-center gap-4 group hover:border-primary-500/30 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center shrink-0 group-hover:bg-primary-500/30 transition-colors">
            <Sparkles className="w-6 h-6 text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary-400 font-medium mb-0.5">Tiếp tục học</p>
            <h3 className="text-sm font-semibold text-surface-50 truncate">
              {lastCourse.title}
            </h3>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden max-w-[200px]">
                <div
                  className="h-full bg-primary-400 rounded-full transition-all"
                  style={{
                    width: `${Math.round((lastProgress.completedLessons / lastProgress.totalLessons) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[11px] text-surface-200/40">
                {lastProgress.completedLessons}/{lastProgress.totalLessons} bài
              </span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-surface-200/20 group-hover:text-primary-400 transition-colors shrink-0" />
        </Link>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
          <input
            type="text"
            placeholder="Tìm kiếm khóa học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-800/60 border border-surface-700 text-surface-50 text-sm placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-surface-200/40 shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedLevel(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !selectedLevel
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'bg-surface-800/60 text-surface-200/50 border border-transparent hover:border-surface-700'
              }`}
            >
              Tất cả
            </button>
            {levels.map((level) => (
              <button
                key={level.code}
                onClick={() => setSelectedLevel(selectedLevel === level.code ? null : level.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedLevel === level.code
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'bg-surface-800/60 text-surface-200/50 border border-transparent hover:border-surface-700'
                }`}
              >
                {level.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Course Grid */}
      {loadingCourses ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card overflow-hidden">
              <div className="h-40 bg-surface-800/60 animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-surface-800/60 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-surface-800/60 rounded animate-pulse w-full" />
                <div className="h-3 bg-surface-800/60 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-800/60 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-surface-200/30" />
          </div>
          <h3 className="text-lg font-semibold text-surface-200/60 mb-1">
            {search || selectedLevel ? 'Không tìm thấy khóa học' : 'Chưa có khóa học nào'}
          </h3>
          <p className="text-sm text-surface-200/30">
            {search || selectedLevel
              ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
              : 'Các khóa học sẽ xuất hiện ở đây khi được xuất bản'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Render by categories if available */}
          {Array.from(categorized.entries()).map(([categoryName, categoryCourses]) => (
            <div key={categoryName}>
              <h2 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-primary-500" />
                {categoryName}
                <span className="text-xs text-surface-200/30 font-normal ml-1">
                  ({categoryCourses.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {categoryCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={userProgress[course.id]}
                  />
                ))}
              </div>
            </div>
          ))}
          {/* Uncategorized courses */}
          {uncategorized.length > 0 && (
            <div>
              {categorized.size > 0 && (
                <h2 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-surface-500" />
                  Khác
                  <span className="text-xs text-surface-200/30 font-normal ml-1">
                    ({uncategorized.length})
                  </span>
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {uncategorized.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={userProgress[course.id]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
