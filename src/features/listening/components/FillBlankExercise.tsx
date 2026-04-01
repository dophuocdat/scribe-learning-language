import { useState } from 'react'
import { Send, AlertCircle, BookOpen } from 'lucide-react'
import { useListeningStore, type FillBlankContent } from '../stores/listeningStore'
import { AudioPlayer } from './AudioPlayer'

export function FillBlankExercise() {
  const { content, evaluating, error, submitAnswer, clearError, batchItems, currentBatchIndex } = useListeningStore()
  const fillContent = content as FillBlankContent
  if (!fillContent) return null

  const [answers, setAnswers] = useState<Record<number, string>>({})

  const handleChange = (index: number, value: string) => {
    setAnswers(prev => ({ ...prev, [index]: value }))
  }

  const handleSubmit = async () => {
    clearError()
    // Build answer string: index→answer mapping
    const answerMap: Record<string, string> = {}
    fillContent.blanks.forEach(blank => {
      answerMap[String(blank.index)] = answers[blank.index]?.trim() || ''
    })
    await submitAnswer(answerMap)
  }

  const allFilled = fillContent.blanks.every(b => answers[b.index]?.trim())

  // Build passage with blanks replaced by inputs
  const renderPassage = () => {
    const parts = fillContent.passage.split(/___(\d+)___/)
    return parts.map((part, i) => {
      // Even indices are text, odd indices are blank numbers
      if (i % 2 === 0) {
        return <span key={i} className="text-surface-200/80">{part}</span>
      }

      const blankIndex = parseInt(part)
      const blank = fillContent.blanks.find(b => b.index === blankIndex)

      return (
        <span key={i} className="inline-block mx-1 align-middle">
          <input
            type="text"
            value={answers[blankIndex] || ''}
            onChange={(e) => handleChange(blankIndex, e.target.value)}
            placeholder={blank?.hint_vi || `(${blank?.word_type || '?'})`}
            className="w-28 sm:w-32 px-2 py-1 rounded-lg bg-primary-500/10 border border-primary-500/30 text-primary-300 text-sm text-center placeholder-primary-500/30 outline-none focus:border-primary-400 focus:bg-primary-500/15 transition-all"
          />
        </span>
      )
    })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Batch progress */}
      {batchItems.length > 1 && (
        <div className="flex items-center gap-2">
          {batchItems.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < currentBatchIndex ? 'gradient-bg' : i === currentBatchIndex ? 'bg-primary-500/50 animate-pulse' : 'bg-surface-800/50'
              }`}
            />
          ))}
          <span className="text-[10px] text-surface-200/30 ml-1">{currentBatchIndex + 1}/{batchItems.length}</span>
        </div>
      )}

      {/* Audio Player — read FULL text (with all words, no blanks) */}
      <AudioPlayer
        text={
          fillContent.full_text ||
          // Fallback: reconstruct full text from passage + blanks
          fillContent.blanks.reduce(
            (text, blank) => text.replace(`___${blank.index}___`, blank.answer),
            fillContent.passage
          )
        }
        showSlowButton
      />

      {/* Hint */}
      <div className="glass-card p-3 flex items-center gap-2 text-xs text-surface-200/40">
        <BookOpen className="w-3.5 h-3.5 shrink-0 text-primary-400" />
        <span>Nghe và điền {fillContent.blanks.length} từ vào chỗ trống</span>
        <span className="ml-auto text-surface-200/30">{fillContent.word_count} từ</span>
      </div>

      {/* Passage with blanks */}
      <div className="glass-card p-5">
        <p className="text-sm leading-[2.2] text-surface-200/80">
          {renderPassage()}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={evaluating || !allFilled}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {evaluating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang chấm bài...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" /> Nộp bài ({Object.keys(answers).filter(k => answers[Number(k)]?.trim()).length}/{fillContent.blanks.length})
          </>
        )}
      </button>
    </div>
  )
}
