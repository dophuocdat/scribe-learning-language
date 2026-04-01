import { CheckCircle, XCircle, ChevronRight, Award, BookOpen } from 'lucide-react'
import { useReadingStore, type ReadingEvalResult, type LevelReadingContent } from '../stores/readingStore'

export function ReadingResult() {
  const { evalResult, content, clickedWords, batchItems, currentBatchIndex, nextInBatch, resetToConfig } = useReadingStore()
  const result = evalResult as ReadingEvalResult
  const article = content as LevelReadingContent

  if (!result) return null

  const isLast = currentBatchIndex >= batchItems.length - 1
  const scoreColor = result.score >= 80 ? 'text-green-400' : result.score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const scoreGlow = result.score >= 80 ? 'shadow-green-500/20' : result.score >= 60 ? 'shadow-yellow-500/20' : 'shadow-red-500/20'

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score Card */}
      <div className={`glass-card p-6 text-center space-y-2 shadow-lg ${scoreGlow}`}>
        <div className={`text-5xl font-black ${scoreColor}`}>{result.score}%</div>
        <p className="text-xs text-surface-200/50">
          {result.correct_count}/{result.total_questions} câu đúng
        </p>

        {/* XP Badge */}
        {result.xp_earned > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">+{result.xp_earned} XP</span>
          </div>
        )}

        <p className="text-xs text-surface-200/60 max-w-xs mx-auto">{result.overall_feedback_vi}</p>
      </div>

      {/* Question Results */}
      <div className="space-y-2">
        {result.results.map((r, idx) => {
          const question = article?.questions?.[idx]

          return (
            <div key={idx} className={`glass-card p-3 ${r.is_correct ? 'border-l-2 border-green-500' : 'border-l-2 border-red-500'}`}>
              <div className="flex items-start gap-2">
                {r.is_correct ? (
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-xs text-surface-100 mb-1">{question?.question}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={r.is_correct ? 'text-green-400' : 'text-red-400'}>
                      Bạn chọn: {r.user_answer}
                    </span>
                    {!r.is_correct && (
                      <span className="text-green-400">Đáp án: {r.correct_answer}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-surface-200/50 mt-1">{r.explanation_vi}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Words Clicked */}
      {clickedWords.length > 0 && (
        <div className="glass-card p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-surface-200/40">
            <BookOpen className="w-3.5 h-3.5 text-primary-400" />
            <span className="font-medium">Từ bạn đã tra ({clickedWords.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clickedWords.map((w, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-primary-500/10 text-primary-300 border border-primary-500/20">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next / Complete */}
      <button
        onClick={isLast ? resetToConfig : nextInBatch}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
      >
        <ChevronRight className="w-4 h-4" />
        {isLast ? 'Hoàn thành' : `Bài tiếp theo (${currentBatchIndex + 2}/${batchItems.length})`}
      </button>
    </div>
  )
}
