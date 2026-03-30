import { useEffect } from 'react'
import { X, Calendar, CheckCircle2, Star, Clock, TrendingUp } from 'lucide-react'
import { useReviewTrackingStore, type LessonProgress } from '../stores/reviewTrackingStore'

interface LearningHistoryProps {
  onClose: () => void
}

const INTERVALS = [1, 3, 7, 14, 30, 60]

function statusBadge(status: string) {
  switch (status) {
    case 'mastered':
      return { icon: <Star className="w-3 h-3" />, text: 'Thuần thục', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    case 'completed':
      return { icon: <CheckCircle2 className="w-3 h-3" />, text: 'Hoàn thành', cls: 'bg-success/10 text-success border-success/20' }
    default:
      return { icon: <Clock className="w-3 h-3" />, text: 'Đang học', cls: 'bg-primary-500/10 text-primary-400 border-primary-500/20' }
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0) return `Quá hạn ${Math.abs(diff)} ngày`
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Ngày mai'
  return `Sau ${diff} ngày`
}

export function LearningHistory({ onClose }: LearningHistoryProps) {
  const { allProgress, fetchAllProgress } = useReviewTrackingStore()

  useEffect(() => {
    fetchAllProgress()
  }, [fetchAllProgress])

  const grouped = allProgress.reduce<Record<string, LessonProgress[]>>((acc, p) => {
    const key = p.course_title || 'Khác'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="glass-card p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-surface-50 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-400" />
          Lịch sử học tập
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-surface-700/40 text-surface-200/40 hover:bg-surface-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {allProgress.length === 0 ? (
        <p className="text-sm text-surface-200/40 text-center py-6">
          Chưa có lịch sử học tập nào. Bắt đầu học một bài để theo dõi tiến độ!
        </p>
      ) : (
        Object.entries(grouped).map(([courseName, lessons]) => (
          <div key={courseName} className="space-y-2">
            <h4 className="text-xs font-semibold text-surface-200/40 uppercase tracking-wider">
              {courseName}
            </h4>
            {lessons.map(lp => {
              const badge = statusBadge(lp.status)
              const isDue = lp.next_review_at && new Date(lp.next_review_at) <= new Date()

              return (
                <div
                  key={lp.id}
                  className={`p-3 rounded-xl bg-surface-800/30 border ${
                    isDue ? 'border-primary-500/30' : 'border-surface-700/30'
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-surface-50 truncate">
                        {lp.lesson_title || 'Bài học'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${badge.cls}`}>
                        {badge.icon} {badge.text}
                      </span>
                      {isDue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-500/15 text-primary-400 border border-primary-500/20 shrink-0">
                          Cần ôn
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-surface-200/30">
                    <span>Điểm cao: {lp.best_score_percent}%</span>
                    <span>Ôn: {lp.review_count} lần</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(lp.next_review_at)}
                    </span>
                    <span>Level: {INTERVALS[lp.interval_level] || 1}d</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
