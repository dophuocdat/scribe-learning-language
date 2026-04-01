import { CheckCircle2, XCircle, RotateCcw, ArrowRight, Award, BookOpen } from 'lucide-react'
import { useSpeakingStore, type PronunciationResult as PronResult, type PronunciationContent } from '../stores/speakingStore'

export function PronunciationResult() {
  const { content, result, nextInBatch, batchItems, currentBatchIndex, resetToConfig } = useSpeakingStore()
  const pronContent = content as PronunciationContent
  const pronResult = result as PronResult

  if (!pronResult) return null

  const isLastInBatch = currentBatchIndex >= batchItems.length - 1

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score Header */}
      <div className="glass-card p-5 text-center space-y-2">
        <div className={`inline-flex w-20 h-20 rounded-full items-center justify-center text-2xl font-black ${
          pronResult.score >= 80 ? 'bg-green-500/20 text-green-400' :
          pronResult.score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {pronResult.score}
        </div>
        <p className="text-sm text-surface-200/60">{pronResult.overall_feedback_vi}</p>
        {pronResult.xp_earned > 0 && (
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs">
            <Award className="w-3 h-3" /> +{pronResult.xp_earned} XP
          </div>
        )}
      </div>

      {/* Word-by-word Results */}
      <div className="glass-card p-4 space-y-2">
        <h3 className="text-xs font-medium text-surface-200/50 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Chi tiết từng từ
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {pronResult.word_results?.map((w, i) => (
            <div
              key={i}
              className={`group relative px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                w.correct
                  ? 'bg-green-500/10 border-green-500/20 text-green-300'
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {w.correct ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-400" />
                )}
                <span>{w.word}</span>
              </div>

              {/* Error details */}
              {!w.correct && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-[10px] text-red-300/60">
                    Bạn nói: <span className="text-red-300">{w.user_word || '(thiếu)'}</span>
                  </p>
                  {w.ipa && (
                    <p className="text-[10px] text-primary-300/60 font-mono">{w.ipa}</p>
                  )}
                  {w.tip_vi && (
                    <p className="text-[10px] text-surface-200/40">{w.tip_vi}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Original Sentence */}
      <div className="glass-card p-3">
        <p className="text-xs text-surface-200/30 mb-1">Câu gốc:</p>
        <p className="text-sm text-surface-100">{pronContent?.sentence}</p>
        {pronContent?.phonetic_guide && (
          <p className="text-xs text-primary-300/40 font-mono mt-1">{pronContent.phonetic_guide}</p>
        )}
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
