import { Check, X, ArrowRight, RotateCcw } from 'lucide-react'
import { useWritingStore, type SentenceEvalResult } from '../stores/writingStore'

export function SentenceBuildingResult() {
  const { evalResult, batchItems, currentBatchIndex, nextInBatch, resetToConfig, content } = useWritingStore()
  const result = evalResult as SentenceEvalResult
  if (!result) return null

  const hasNext = currentBatchIndex + 1 < batchItems.length

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score badge */}
      <div className={`glass-card p-6 text-center ${result.is_correct ? 'border border-green-500/20' : 'border border-red-500/20'}`}>
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 ${
          result.is_correct ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {result.is_correct ? (
            <Check className="w-8 h-8 text-green-400" />
          ) : (
            <X className="w-8 h-8 text-red-400" />
          )}
        </div>

        <h2 className={`text-lg font-bold ${result.is_correct ? 'text-green-400' : 'text-red-400'}`}>
          {result.is_correct ? 'Chính xác!' : 'Chưa đúng'}
        </h2>

        {result.xp_earned > 0 && (
          <p className="text-xs text-yellow-400 mt-1">+{result.xp_earned} XP</p>
        )}
      </div>

      {/* Correct sentence */}
      <div className="glass-card p-4">
        <p className="text-[10px] text-surface-200/30 mb-2">Câu đúng:</p>
        <p className="text-sm text-green-300 font-medium">✓ {result.correct_sentence}</p>

        {!result.is_correct && (
          <>
            <p className="text-[10px] text-surface-200/30 mt-3 mb-1">Câu của bạn:</p>
            <p className="text-sm text-red-300">✗ {result.user_answer}</p>
          </>
        )}
      </div>

      {/* Grammar hint */}
      {content?.grammar_hint_vi && (
        <div className="glass-card p-4">
          <p className="text-[10px] text-surface-200/30 mb-1">💡 Cấu trúc ngữ pháp</p>
          <p className="text-xs text-surface-100">{content.grammar_hint_vi}</p>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-100">{result.feedback_vi}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={resetToConfig}
          className="px-4 py-3 rounded-xl bg-surface-800/50 border border-surface-700/30 text-surface-200/60 hover:text-surface-100 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        {hasNext ? (
          <button
            onClick={nextInBatch}
            className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
          >
            Câu tiếp theo <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={resetToConfig}
            className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
          >
            Hoàn thành
          </button>
        )}
      </div>
    </div>
  )
}
