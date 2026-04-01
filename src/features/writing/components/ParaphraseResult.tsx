import { ArrowRight, RotateCcw, X } from 'lucide-react'
import { useWritingStore, type ParaphraseEvalResult } from '../stores/writingStore'

export function ParaphraseResult() {
  const { evalResult, batchItems, currentBatchIndex, nextInBatch, resetToConfig } = useWritingStore()
  const result = evalResult as ParaphraseEvalResult
  if (!result) return null

  const hasNext = currentBatchIndex + 1 < batchItems.length
  const scores = [
    { label: 'Giữ nghĩa', value: result.meaning_score, color: 'text-blue-400' },
    { label: 'Tự nhiên', value: result.naturalness_score, color: 'text-green-400' },
    { label: 'Nâng cấp', value: result.level_upgrade_score, color: 'text-purple-400' },
  ]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Overall */}
      <div className={`glass-card p-6 text-center ${result.is_correct ? 'border border-green-500/20' : 'border border-orange-500/20'}`}>
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-3 ${
          result.overall_score >= 80 ? 'bg-green-500/20' : result.overall_score >= 50 ? 'bg-yellow-500/20' : 'bg-red-500/20'
        }`}>
          <span className={`text-2xl font-bold ${
            result.overall_score >= 80 ? 'text-green-400' : result.overall_score >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>{result.overall_score}</span>
        </div>
        <p className="text-xs text-surface-200/40">Điểm tổng</p>
        {result.xp_earned > 0 && (
          <p className="text-xs text-yellow-400 mt-1">+{result.xp_earned} XP</p>
        )}
      </div>

      {/* Score bars */}
      <div className="glass-card p-4 space-y-3">
        {scores.map(s => (
          <div key={s.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-surface-200/50">{s.label}</span>
              <span className={`text-xs font-bold ${s.color}`}>{s.value}/100</span>
            </div>
            <div className="h-2 bg-surface-800/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                style={{ width: `${s.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-100">{result.feedback_vi}</p>
      </div>

      {/* Corrections */}
      {result.corrections?.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-[10px] text-surface-200/30 mb-2">Sửa lỗi:</p>
          {result.corrections.map((c, i) => (
            <div key={i} className="flex items-start gap-2 mb-2 p-2 rounded-lg bg-surface-800/30">
              <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-surface-100">{c.explanation_vi || c.issue}</p>
                {c.suggestion && (
                  <p className="text-[10px] text-green-300/70 mt-0.5">→ {c.suggestion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Better alternatives */}
      {result.better_alternatives?.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-[10px] text-surface-200/30 mb-2">Cách viết khác:</p>
          {result.better_alternatives.map((alt, i) => (
            <p key={i} className="text-xs text-primary-300/70 mb-1 italic">• "{alt}"</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={resetToConfig} className="px-4 py-3 rounded-xl bg-surface-800/50 border border-surface-700/30 text-surface-200/60 hover:text-surface-100 transition-all">
          <RotateCcw className="w-4 h-4" />
        </button>
        {hasNext ? (
          <button onClick={nextInBatch} className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm">
            Câu tiếp theo <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={resetToConfig} className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-all text-sm">
            Hoàn thành
          </button>
        )}
      </div>
    </div>
  )
}
