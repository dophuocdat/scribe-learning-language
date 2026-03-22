import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Signal,
  FileText,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useLearnStore } from '../stores/learnStore'

const difficultyColors: Record<string, string> = {
  A1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  A2: 'bg-green-500/20 text-green-400 border-green-500/30',
  B1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  B2: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  C1: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  C2: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { currentCourse, courseLessons, loadingCourse, fetchCourseDetail } =
    useLearnStore()

  useEffect(() => {
    if (courseId) fetchCourseDetail(courseId)
  }, [courseId, fetchCourseDetail])

  if (loadingCourse) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-6 w-48 bg-surface-800/60 rounded animate-pulse" />
        <div className="glass-card p-6 space-y-4">
          <div className="h-48 bg-surface-800/60 rounded-xl animate-pulse" />
          <div className="h-8 w-2/3 bg-surface-800/60 rounded animate-pulse" />
          <div className="h-4 w-full bg-surface-800/60 rounded animate-pulse" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-surface-800/60 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-surface-800/60 rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-surface-800/60 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!currentCourse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-card p-12 text-center max-w-md">
          <h2 className="text-xl font-bold text-surface-200/60 mb-2">
            Không tìm thấy khóa học
          </h2>
          <Link to="/courses" className="text-primary-400 text-sm hover:underline">
            ← Quay lại danh sách
          </Link>
        </div>
      </div>
    )
  }

  const diffClass = currentCourse.difficulty_level
    ? difficultyColors[currentCourse.difficulty_level]
    : ''

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-surface-200/40 hover:text-primary-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Khóa học
      </Link>

      {/* Course Hero */}
      <div className="glass-card overflow-hidden">
        <div className="relative h-52 bg-gradient-to-br from-primary-600/30 to-accent-500/20">
          {currentCourse.cover_image_url ? (
            <img
              src={currentCourse.cover_image_url}
              alt={currentCourse.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-surface-200/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900/90 via-surface-900/30 to-transparent" />
        </div>

        <div className="p-6 -mt-16 relative z-10">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            {currentCourse.category && (
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-surface-800/80 text-surface-200/60 px-2.5 py-1 rounded-full border border-surface-700">
                {currentCourse.category.name}
              </span>
            )}
            {currentCourse.difficulty_level && (
              <span
                className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border ${diffClass}`}
              >
                <Signal className="w-3 h-3 inline mr-0.5" />
                {currentCourse.difficulty_level}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-surface-50 mb-2">
            {currentCourse.title}
          </h1>

          {currentCourse.description && (
            <p className="text-sm text-surface-200/50 mb-4 max-w-2xl">
              {currentCourse.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-surface-200/40">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {courseLessons.length} bài học
            </span>
            {currentCourse.estimated_time_minutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                ~{currentCourse.estimated_time_minutes} phút
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lessons List */}
      <div>
        <h2 className="text-lg font-semibold text-surface-50 mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-400" />
          Danh sách bài học
        </h2>

        {courseLessons.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <FileText className="w-10 h-10 text-surface-200/20 mx-auto mb-3" />
            <p className="text-sm text-surface-200/40">
              Khóa học này chưa có bài học nào
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {courseLessons.map((lesson, idx) => (
              <Link
                key={lesson.id}
                to={`/lessons/${lesson.id}`}
                className="glass-card p-4 flex items-center gap-4 group hover:border-primary-500/30"
              >
                {/* Order indicator */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-500/10 text-primary-400 font-bold text-sm shrink-0 group-hover:bg-primary-500/20 transition-colors">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-surface-50 group-hover:text-primary-400 transition-colors truncate">
                    {lesson.title}
                  </h3>
                  {lesson.ai_summary && (
                    <p className="text-xs text-surface-200/40 truncate mt-0.5">
                      {lesson.ai_summary}
                    </p>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-surface-200/20 group-hover:text-primary-400 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
