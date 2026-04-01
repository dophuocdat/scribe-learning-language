import { Send, Loader2, AlertCircle } from 'lucide-react'
import { useReadingStore, type LevelReadingContent } from '../stores/readingStore'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  main_idea: { label: 'Ý chính', color: 'text-blue-400 bg-blue-500/10' },
  detail: { label: 'Chi tiết', color: 'text-cyan-400 bg-cyan-500/10' },
  inference: { label: 'Suy luận', color: 'text-violet-400 bg-violet-500/10' },
  vocabulary_in_context: { label: 'Từ vựng', color: 'text-amber-400 bg-amber-500/10' },
}

export function ReadingQuestions() {
  const { content, userAnswers, evaluating, error, setUserAnswer, submitAnswers } = useReadingStore()
  const article = content as LevelReadingContent

  if (!article?.questions) return null

  const allAnswered = article.questions.every((_, i) => userAnswers[String(i)])

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Questions */}
      {article.questions.map((q, idx) => {
        const typeInfo = TYPE_LABELS[q.type] || { label: q.type, color: 'text-surface-200/40 bg-surface-800/40' }
        const selected = userAnswers[String(idx)] || ''

        return (
          <div key={idx} className="glass-card p-4 space-y-3">
            {/* Question header */}
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>
                <p className="text-sm text-surface-100 leading-relaxed">{q.question}</p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-1.5 pl-8">
              {q.options.map((opt, oIdx) => {
                const letter = String.fromCharCode(65 + oIdx)
                const isSelected = selected === letter

                return (
                  <button
                    key={oIdx}
                    onClick={() => setUserAnswer(idx, letter)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-primary-500/15 border border-primary-500/30 text-primary-300'
                        : 'bg-surface-800/30 border border-surface-800/20 text-surface-200/60 hover:border-surface-700/40 hover:text-surface-100'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isSelected
                        ? 'border-primary-400 bg-primary-500/20 text-primary-300'
                        : 'border-surface-600/50 text-surface-200/40'
                    }`}>
                      {letter}
                    </span>
                    {opt.replace(/^[A-D]\.\s*/, '')}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submitAnswers}
        disabled={evaluating || !allAnswered}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {evaluating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang chấm điểm...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Nộp bài ({Object.keys(userAnswers).length}/{article.questions.length})
          </>
        )}
      </button>
    </div>
  )
}
