import { useState } from 'react'
import { Send, Loader2, Lightbulb, Eye, EyeOff } from 'lucide-react'
import { useWritingStore, type ParaphraseItem } from '../stores/writingStore'

export function ParaphraseExercise() {
  const { content, evaluating, error, userRewrite, setUserRewrite, submitParaphrase, batchItems, currentBatchIndex } = useWritingStore()
  const exercise = content as ParaphraseItem
  const [showExamples, setShowExamples] = useState(false)

  if (!exercise) return null

  const wordCount = userRewrite.trim().split(/\s+/).filter(Boolean).length

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

      {/* Original sentence */}
      <div className="glass-card p-5">
        <p className="text-[10px] text-surface-200/30 mb-2">Câu gốc:</p>
        <p className="text-base text-surface-50 font-medium leading-relaxed">"{exercise.original}"</p>

        {/* Hint */}
        <div className="mt-3 flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs text-yellow-300/70">{exercise.hint_vi}</span>
          {exercise.hint_style && (
            <span className="text-[9px] bg-primary-500/15 text-primary-300 px-1.5 py-0.5 rounded font-medium">
              {exercise.hint_style}
            </span>
          )}
        </div>

        {/* Key structures */}
        {exercise.key_structures?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exercise.key_structures.map((s, i) => (
              <span key={i} className="text-[9px] bg-surface-800/40 text-surface-200/50 px-1.5 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* User input */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-surface-200/30">Viết lại câu:</p>
          <span className={`text-[10px] ${wordCount > 0 ? 'text-primary-300' : 'text-surface-200/20'}`}>
            {wordCount} từ
          </span>
        </div>
        <textarea
          value={userRewrite}
          onChange={e => setUserRewrite(e.target.value)}
          placeholder="Viết lại câu trên theo cách khác..."
          rows={3}
          className="w-full bg-surface-800/30 border border-surface-700/30 rounded-xl p-3 text-sm text-surface-50 placeholder:text-surface-200/20 focus:outline-none focus:border-primary-500/50 resize-none"
        />
      </div>

      {/* Show examples toggle */}
      {exercise.example_rewrites?.length > 0 && (
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="flex items-center gap-2 text-xs text-surface-200/40 hover:text-surface-200/60 transition-all px-1"
        >
          {showExamples ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showExamples ? 'Ẩn gợi ý' : 'Xem gợi ý'}
        </button>
      )}

      {showExamples && (
        <div className="glass-card p-4 border border-yellow-500/10">
          <p className="text-[10px] text-yellow-300/50 mb-2">Ví dụ cách viết lại:</p>
          {exercise.example_rewrites.map((ex, i) => (
            <p key={i} className="text-xs text-surface-200/60 mb-1 italic">• "{ex}"</p>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{error}</div>
      )}

      {/* Submit */}
      <button
        onClick={submitParaphrase}
        disabled={!userRewrite.trim() || evaluating}
        className="w-full py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {evaluating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Đang chấm...</>
        ) : (
          <><Send className="w-4 h-4" /> Nộp bài</>
        )}
      </button>
    </div>
  )
}
