import { Link } from 'react-router-dom'
import { BookOpen, Clock, Signal, Play, Trophy } from 'lucide-react'
import type { CourseWithMeta, CourseProgress } from '../stores/learnStore'

const difficultyColors: Record<string, string> = {
  A1: 'bg-emerald-500/20 text-emerald-400',
  A2: 'bg-green-500/20 text-green-400',
  B1: 'bg-blue-500/20 text-blue-400',
  B2: 'bg-indigo-500/20 text-indigo-400',
  C1: 'bg-purple-500/20 text-purple-400',
  C2: 'bg-rose-500/20 text-rose-400',
}

interface CourseCardProps {
  course: CourseWithMeta
  progress?: CourseProgress
}

export function CourseCard({ course, progress }: CourseCardProps) {
  const diffClass = course.difficulty_level
    ? difficultyColors[course.difficulty_level] || 'bg-surface-700 text-surface-200'
    : ''

  const completionPercent = progress && progress.totalLessons > 0
    ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
    : 0
  const isStarted = completionPercent > 0
  const isCompleted = completionPercent === 100

  return (
    <Link
      to={`/courses/${course.id}`}
      className="glass-card group overflow-hidden flex flex-col relative"
    >
      {/* Completion badge */}
      {isCompleted && (
        <div className="absolute top-3 right-3 z-20 bg-emerald-500/90 backdrop-blur-sm rounded-full p-1.5">
          <Trophy className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Cover Image */}
      <div className="relative h-40 bg-gradient-to-br from-primary-600/30 to-accent-500/20 overflow-hidden">
        {course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-surface-200/20" />
          </div>
        )}
        {/* Category badge */}
        {course.category && (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider font-semibold bg-black/40 backdrop-blur-sm text-white/80 px-2.5 py-1 rounded-full">
            {course.category.name}
          </span>
        )}
        {/* Progress bar at bottom of image */}
        {isStarted && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-900/50">
            <div
              className={`h-full transition-all duration-500 ${isCompleted ? 'bg-emerald-400' : 'bg-primary-400'}`}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-semibold text-surface-50 group-hover:text-primary-400 transition-colors line-clamp-2 mb-2">
          {course.title}
        </h3>
        {course.description && (
          <p className="text-xs text-surface-200/50 line-clamp-2 mb-4 flex-1">
            {course.description}
          </p>
        )}

        {/* Progress + Meta row */}
        <div className="space-y-3">
          {/* Progress info */}
          {isStarted && (
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isCompleted ? 'text-emerald-400' : 'text-primary-400'}`}>
                {isCompleted ? 'Hoàn thành!' : `${completionPercent}% hoàn thành`}
              </span>
              <span className="text-[11px] text-surface-200/40">
                {progress?.completedLessons}/{progress?.totalLessons} bài
              </span>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-surface-200/40">
              {course.difficulty_level && (
                <span className={`px-2 py-0.5 rounded-full font-semibold ${diffClass}`}>
                  <Signal className="w-3 h-3 inline mr-1" />
                  {course.difficulty_level}
                </span>
              )}
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {course.lessons_count || 0} bài
              </span>
              {course.estimated_time_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {course.estimated_time_minutes}p
                </span>
              )}
            </div>
            {/* Continue / Start button */}
            {isStarted && !isCompleted && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary-400 bg-primary-500/10 px-2.5 py-1 rounded-full">
                <Play className="w-3 h-3" />
                Tiếp tục
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
