import { useState } from 'react'
import { Send, AlertCircle, BookOpen } from 'lucide-react'
import { useListeningStore, type DictationContent } from '../stores/listeningStore'
import { AudioPlayer } from './AudioPlayer'

export function DictationExercise() {
  const { content, evaluating, error, submitAnswer, clearError, batchItems, currentBatchIndex } = useListeningStore()
  const [answer, setAnswer] = useState('')

  const dictContent = content as DictationContent
  if (!dictContent) return null

  const handleSubmit = async () => {
    if (!answer.trim()) return
    clearError()
    await submitAnswer(answer.trim())
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

      {/* Audio Player — enhanced with slow button */}
      <AudioPlayer text={dictContent.text} showSlowButton />

      {/* Hint */}
      <div className="glass-card p-3 flex items-center gap-2 text-xs text-surface-200/40">
        <BookOpen className="w-3.5 h-3.5 shrink-0 text-primary-400" />
        <span>{dictContent.difficulty_note_vi}</span>
        <span className="ml-auto text-surface-200/30">{dictContent.word_count} từ</span>
      </div>

      {/* Answer Input */}
      <div className="glass-card overflow-hidden">
        <div className="p-3.5 border-b border-surface-800 flex items-center justify-between">
          <span className="text-sm font-medium text-surface-50">✍️ Viết lại những gì bạn nghe được</span>
          <span className="text-[10px] text-surface-200/30">{answer.length} ký tự</span>
        </div>
        <div className="p-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Gõ lại chính xác những gì bạn nghe được..."
            className="w-full min-h-[140px] bg-transparent text-sm text-surface-200/80 placeholder-surface-200/30 resize-y outline-none leading-relaxed"
            autoFocus
          />
        </div>
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
        disabled={evaluating || !answer.trim()}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {evaluating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang chấm bài...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" /> Nộp bài
          </>
        )}
      </button>
    </div>
  )
}
