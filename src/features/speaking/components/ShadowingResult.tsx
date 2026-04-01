import { CheckCircle2, XCircle, RotateCcw, ArrowRight, Award, BarChart3 } from 'lucide-react'
import { useSpeakingStore, type ShadowingResult as ShadowResult, type ShadowingContent } from '../stores/speakingStore'

export function ShadowingResult() {
  const { content, result, nextInBatch, batchItems, currentBatchIndex, resetToConfig } = useSpeakingStore()
  const shadowContent = content as ShadowingContent
  const shadowResult = result as ShadowResult

  if (!shadowResult) return null

  const isLastInBatch = currentBatchIndex >= batchItems.length - 1

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score Header */}
      <div className="glass-card p-5 text-center space-y-3">
        <div className={`inline-flex w-20 h-20 rounded-full items-center justify-center text-2xl font-black ${
          shadowResult.overall_score >= 80 ? 'bg-green-500/20 text-green-400' :
          shadowResult.overall_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {shadowResult.overall_score}
        </div>

        {/* Score breakdown */}
        <div className="flex justify-center gap-6">
          <div className="text-center">
            <p className="text-lg font-bold text-blue-400">{shadowResult.accuracy_score}</p>
            <p className="text-[10px] text-surface-200/40">Chính xác</p>
          </div>
          <div className="w-px bg-surface-800/50" />
          <div className="text-center">
            <p className="text-lg font-bold text-purple-400">{shadowResult.fluency_score}</p>
            <p className="text-[10px] text-surface-200/40">Trôi chảy</p>
          </div>
        </div>

        <p className="text-sm text-surface-200/60">{shadowResult.overall_feedback_vi}</p>

        {shadowResult.fluency_feedback_vi && (
          <p className="text-xs text-surface-200/40 italic">{shadowResult.fluency_feedback_vi}</p>
        )}

        {shadowResult.xp_earned > 0 && (
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs">
            <Award className="w-3 h-3" /> +{shadowResult.xp_earned} XP
          </div>
        )}
      </div>

      {/* Word-by-word */}
      <div className="glass-card p-4 space-y-2">
        <h3 className="text-xs font-medium text-surface-200/50 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Chi tiết từng từ
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {shadowResult.word_results?.map((w, i) => (
            <div
              key={i}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${
                w.correct
                  ? 'bg-green-500/10 text-green-300 border border-green-500/20'
                  : 'bg-red-500/10 text-red-300 border border-red-500/20'
              }`}
            >
              {w.correct ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {w.word}
              {!w.correct && w.user_word && (
                <span className="text-red-400/50 ml-1">→ {w.user_word}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Original with stress */}
      <div className="glass-card p-3 space-y-1">
        <p className="text-xs text-surface-200/30">Stress pattern:</p>
        <p className="text-sm text-surface-100">{shadowContent?.stress_pattern || shadowContent?.sentence}</p>
        <p className="text-xs text-surface-200/30 mt-1">{shadowContent?.sentence_vi}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={resetToConfig}
          className="flex-1 py-3 rounded-xl bg-surface-800/50 text-surface-200/60 font-medium flex items-center justify-center gap-2 hover:bg-surface-800/70 transition-all text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Về cấu hình
        </button>
        <button
          onClick={nextInBatch}
          className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
        >
          {isLastInBatch ? 'Hoàn thành' : 'Bài tiếp theo'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
