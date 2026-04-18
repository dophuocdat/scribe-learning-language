import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Map, ArrowRight, AlertTriangle } from 'lucide-react'
import { useLearningPathStore } from '../stores/learningPathStore'
import type { CourseWithProgress } from '@/shared/types/database'

const FOCUS_LABELS: Record<string, string> = {
  general: 'Tổng quát',
  communication: 'Giao tiếp',
  ielts: 'IELTS',
  toeic: 'TOEIC',
}

export function PathDashboardCard() {
  const { path, roadmap, totalLessons, completedLessons, loading, fetchPath } = useLearningPathStore()

  useEffect(() => {
    fetchPath()
  }, [fetchPath])

  if (loading) return null

  // No path — show CTA banner
  if (!path) {
    return (
      <Link
        to="/learning-path"
        className="block rounded-2xl gradient-bg p-5 group hover:shadow-lg hover:shadow-primary-500/20 transition-all duration-300"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Map className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">🗺️ Thiết lập lộ trình học!</h3>
            <p className="text-xs text-white/60 mt-0.5">Chọn mục tiêu và để Scribe hướng dẫn bạn từng bước</p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>
    )
  }

  // Has path — show compact card
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const nextCourse = roadmap.find(
    (n): n is CourseWithProgress => 'id' in n && !('type' in n) && (n.is_next || n.status === 'in_progress')
  )

  const reviewCount = roadmap.filter(
    (n): n is CourseWithProgress => 'id' in n && !('type' in n) && n.status === 'needs_review'
  ).length

  return (
    <Link
      to="/learning-path"
      className="block rounded-2xl bg-surface-800/40 border border-surface-700/50 p-4 hover:border-primary-500/30 hover:bg-surface-800/60 transition-all duration-200 group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center shrink-0">
          <Map className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-50 truncate">
            {path.current_level} → {path.target_level} · {FOCUS_LABELS[path.focus_area]}
          </p>
          <p className="text-[11px] text-surface-200/40">
            {completedLessons}/{totalLessons} bài ({progressPercent}%)
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-surface-200/30 group-hover:text-primary-400 transition-colors" />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-700/50 rounded-full overflow-hidden mb-2">
        <div
          className="h-full gradient-bg rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        {nextCourse && (
          <span className="text-surface-200/40 truncate">
            Tiếp: <span className="text-primary-400">{nextCourse.title}</span>
          </span>
        )}
        {reviewCount > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" /> {reviewCount} cần ôn
          </span>
        )}
      </div>
    </Link>
  )
}
