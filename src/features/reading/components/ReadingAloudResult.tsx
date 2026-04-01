import { XCircle, ChevronRight, Award, Gauge, BarChart3 } from 'lucide-react'
import { useReadingStore, type ReadingAloudResult as AloudResult } from '../stores/readingStore'

export function ReadingAloudResult() {
  const { evalResult, batchItems, currentBatchIndex, nextInBatch, resetToConfig } = useReadingStore()
  const result = evalResult as AloudResult

  if (!result) return null

  const isLast = currentBatchIndex >= batchItems.length - 1
  const accColor = result.accuracy >= 90 ? 'text-green-400' : result.accuracy >= 70 ? 'text-yellow-400' : 'text-red-400'
  const wpmColor = result.wpm >= 120 ? 'text-green-400' : result.wpm >= 80 ? 'text-yellow-400' : 'text-blue-400'

  const missedWords = result.word_results?.filter(w => !w.matched) || []

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Accuracy */}
        <div className="glass-card p-4 text-center space-y-1">
          <BarChart3 className={`w-5 h-5 mx-auto ${accColor}`} />
          <div className={`text-3xl font-black ${accColor}`}>{result.accuracy}%</div>
          <p className="text-[10px] text-surface-200/40">Độ chính xác</p>
          <p className="text-[10px] text-surface-200/30">
            {result.matched_words}/{result.total_words} từ
          </p>
        </div>

        {/* WPM */}
        <div className="glass-card p-4 text-center space-y-1">
          <Gauge className={`w-5 h-5 mx-auto ${wpmColor}`} />
          <div className={`text-3xl font-black ${wpmColor}`}>{result.wpm}</div>
          <p className="text-[10px] text-surface-200/40">Từ/phút (WPM)</p>
          <p className="text-[10px] text-surface-200/30">
            {result.wpm >= 120 ? 'Tốc độ tốt!' : result.wpm >= 80 ? 'Tốc độ vừa phải' : 'Đọc chậm — cần luyện thêm'}
          </p>
        </div>
      </div>

      {/* XP */}
      {result.xp_earned > 0 && (
        <div className="flex items-center justify-center gap-1.5">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-amber-400">+{result.xp_earned} XP</span>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card p-3">
        <p className="text-xs text-surface-200/60">{result.feedback_vi}</p>
      </div>

      {/* Word Results */}
      {result.word_results && result.word_results.length > 0 && (
        <div className="glass-card p-4 space-y-2">
          <p className="text-xs text-surface-200/40 font-medium">Kết quả từng từ</p>
          <div className="flex flex-wrap gap-1">
            {result.word_results.map((w, i) => (
              <span
                key={i}
                className={`text-xs px-1.5 py-0.5 rounded transition-all ${
                  w.matched
                    ? 'text-green-400/80'
                    : 'text-red-400 bg-red-500/10 border border-red-500/20 font-medium'
                }`}
              >
                {w.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missed Words Summary */}
      {missedWords.length > 0 && (
        <div className="glass-card p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-red-400/70">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-medium">Từ bị bỏ qua ({missedWords.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missedWords.map((w, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/20">
                {w.word}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-surface-200/30">💡 Hãy luyện phát âm lại những từ này</p>
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
