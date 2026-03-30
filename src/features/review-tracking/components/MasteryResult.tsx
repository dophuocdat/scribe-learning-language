import {
  Trophy, RotateCcw, Zap, Target, Clock, Eye, TrendingUp,
  CheckCircle2, XCircle,
} from 'lucide-react'
import type { MasteryDetails, ReviewAnswer } from '../stores/reviewTrackingStore'

interface MasteryResultProps {
  mastery: MasteryDetails
  answers: ReviewAnswer[]
  onRetry: () => void
}

export function MasteryResult({ mastery, answers, onRetry }: MasteryResultProps) {
  const correct = answers.filter(a => a.isCorrect).length
  const total = answers.length

  const metrics = [
    {
      icon: <Target className="w-4 h-4" />,
      label: 'Độ chính xác',
      value: `${Math.round(mastery.accuracy)}%`,
      threshold: '≥ 85%',
      passed: mastery.accuracy >= 85,
      color: mastery.accuracy >= 85 ? 'text-success' : 'text-error',
    },
    {
      icon: <Clock className="w-4 h-4" />,
      label: 'Tốc độ TB',
      value: `${mastery.avgResponseSec.toFixed(1)}s`,
      threshold: '≤ 15s',
      passed: mastery.avgResponseSec <= 15,
      color: mastery.avgResponseSec <= 15 ? 'text-success' : 'text-error',
    },
    {
      icon: <TrendingUp className="w-4 h-4" />,
      label: 'Trả lời nhanh',
      value: `${Math.round(mastery.fastRatio)}%`,
      threshold: '≥ 80%',
      passed: mastery.fastRatio >= 80,
      color: mastery.fastRatio >= 80 ? 'text-success' : 'text-error',
    },
    {
      icon: <Eye className="w-4 h-4" />,
      label: 'Tập trung',
      value: mastery.isFocused ? 'Tốt' : `${mastery.tabSwitchCount} lần rời`,
      threshold: '≤ 3 lần',
      passed: mastery.isFocused,
      color: mastery.isFocused ? 'text-success' : 'text-error',
    },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Score banner */}
      <div
        className={`glass-card p-6 text-center border ${
          mastery.isMastered
            ? 'border-success/30 bg-success/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}
      >
        <div
          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
            mastery.isMastered ? 'bg-success/10' : 'bg-amber-500/10'
          }`}
        >
          <Trophy className={`w-8 h-8 ${mastery.isMastered ? 'text-success' : 'text-amber-400'}`} />
        </div>

        <h2 className="text-2xl font-bold text-surface-50">
          {mastery.isMastered ? '🎉 Thuần thục!' : '💪 Cần ôn thêm'}
        </h2>
        <p className="text-sm text-surface-200/50 mt-2">
          Đúng {correct}/{total} câu ({Math.round(mastery.accuracy)}%)
        </p>

        {mastery.isMastered && (
          <div className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/20">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">
              +{Math.round(15 + (mastery.accuracy / 100) * 35)} XP
            </span>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-surface-200/50">
                {m.icon}
                <span className="text-xs font-medium">{m.label}</span>
              </div>
              {m.passed ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <XCircle className="w-4 h-4 text-error" />
              )}
            </div>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-[10px] text-surface-200/30">Cần: {m.threshold}</p>
          </div>
        ))}
      </div>

      {/* Message */}
      {!mastery.isMastered && (
        <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/5">
          <p className="text-sm text-amber-300/80">
            💡 {mastery.accuracy < 85
              ? 'Hãy ôn lại từ vựng và cấu trúc, nhiều câu chưa chính xác.'
              : mastery.avgResponseSec > 15
                ? 'Bạn cần phản xạ nhanh hơn! Hãy luyện tập thêm.'
                : !mastery.isFocused
                  ? 'Hãy tập trung vào bài tập, tránh chuyển tab.'
                  : 'Cần cải thiện tốc độ trả lời nhanh hơn.'}
          </p>
          <p className="text-xs text-surface-200/30 mt-2">
            Bài này sẽ xuất hiện lại vào ngày mai để ôn lại.
          </p>
        </div>
      )}

      {mastery.isMastered && (
        <div className="glass-card p-4 border border-success/20 bg-success/5">
          <p className="text-sm text-success/80">
            ✅ Tuyệt vời! Khoảng cách ôn tập sẽ được tăng lên. Bạn đã thuần thục hơn rồi!
          </p>
        </div>
      )}

      {/* Retry button */}
      <div className="flex justify-center">
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 font-semibold text-sm hover:bg-primary-500/20 transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          {mastery.isMastered ? 'Ôn bài khác' : 'Làm lại'}
        </button>
      </div>
    </div>
  )
}
