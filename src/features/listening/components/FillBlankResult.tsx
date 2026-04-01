import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Star } from 'lucide-react'
import { useListeningStore, type FillBlankContent, type FillBlankResult as FillBlankResultType } from '../stores/listeningStore'

export function FillBlankResult() {
  const { result, content, batchItems, currentBatchIndex, reset, advanceToNext, generateExercise } =
    useListeningStore()

  const fillResult = result as FillBlankResultType
  if (!fillResult) return null

  const fillContent = content as FillBlankContent
  const { score, total_blanks, correct_blanks, answers, overall_feedback_vi, xp_earned } = fillResult

  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const scoreBg = score >= 80 ? 'from-emerald-500/20' : score >= 60 ? 'from-yellow-500/20' : 'from-red-500/20'
  const hasMore = currentBatchIndex < batchItems.length - 1

  const handleNext = () => {
    if (!advanceToNext()) generateExercise()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {batchItems.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= currentBatchIndex ? 'gradient-bg' : 'bg-surface-800/50'}`} />
        ))}
        <span className="text-[10px] text-surface-200/30 ml-1">{currentBatchIndex + 1}/{batchItems.length}</span>
      </div>

      {/* Score Card */}
      <div className={`glass-card p-6 text-center bg-gradient-to-br ${scoreBg} to-transparent`}>
        <div className={`text-5xl font-black ${scoreColor} mb-1`}>{correct_blanks}/{total_blanks}</div>
        <p className="text-xs text-surface-200/40">từ điền đúng</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-surface-200/50">
          <span>📊 Điểm: {score}/100</span>
          <span className="flex items-center gap-1 text-yellow-400">
            <Star className="w-3 h-3" /> +{xp_earned} XP
          </span>
        </div>
      </div>

      {/* Answer Details */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">Chi tiết từng từ</p>
        <div className="space-y-2">
          {answers.map((a, i) => (
            <div key={i} className={`p-3 rounded-xl border ${a.is_correct
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-red-500/5 border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {a.is_correct ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-xs font-medium text-surface-50">
                  Blank #{a.blank_index + 1}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs mt-1">
                <span className={a.is_correct ? 'text-emerald-400' : 'text-red-400 line-through'}>
                  {a.user_answer || '(trống)'}
                </span>
                {!a.is_correct && (
                  <>
                    <span className="text-surface-200/30">→</span>
                    <span className="text-emerald-400 font-semibold">{a.expected}</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-surface-200/50 mt-1">{a.feedback_vi}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Full passage + translation */}
      {fillContent && (
        <div className="glass-card p-4 space-y-2">
          <p className="text-xs text-surface-200/40 font-medium">Đoạn văn gốc</p>
          <p className="text-sm text-surface-50 leading-relaxed">
            {fillContent.passage.replace(/___\d+___/g, (match) => {
              const idx = parseInt(match.replace(/___/g, ''))
              const blank = fillContent.blanks.find(b => b.index === idx)
              return `[${blank?.answer || '?'}]`
            })}
          </p>
          <p className="text-xs text-surface-200/40 italic">{fillContent.passage_translation_vi}</p>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-2 font-medium">💡 Nhận xét</p>
        <p className="text-sm text-surface-200/70 leading-relaxed">{overall_feedback_vi}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleNext}
          className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
        >
          <ArrowRight className="w-4 h-4" />
          {hasMore ? `Bài tiếp (${currentBatchIndex + 2}/${batchItems.length})` : 'Tạo thêm bài mới'}
        </button>
        <button
          onClick={reset}
          className="py-3 px-5 rounded-xl border border-surface-700 text-surface-200/70 hover:text-surface-50 hover:border-surface-600 font-medium flex items-center justify-center gap-2 transition-all text-sm"
        >
          <RotateCcw className="w-4 h-4" /> Chọn lại
        </button>
      </div>
    </div>
  )
}
