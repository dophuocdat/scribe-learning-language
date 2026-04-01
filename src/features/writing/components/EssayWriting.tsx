import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Clock, Lightbulb } from 'lucide-react'
import { useWritingStore, type EssayPrompt } from '../stores/writingStore'

export function EssayWriting() {
  const { content, evaluating, error, userEssay, setUserEssay, submitEssay } = useWritingStore()
  const prompt = content as EssayPrompt
  const [elapsedSec, setElapsedSec] = useState(0)
  const [showHints, setShowHints] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  if (!prompt) return null

  const wordCount = userEssay.trim().split(/\s+/).filter(Boolean).length
  const isInRange = wordCount >= prompt.word_limit_min && wordCount <= prompt.word_limit_max
  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Prompt */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] bg-primary-500/15 text-primary-300 px-2 py-0.5 rounded-full font-medium uppercase">
            {prompt.essay_type}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-surface-200/30">
            <Clock className="w-3 h-3" />
            {formatTime(elapsedSec)}
          </div>
        </div>

        <h2 className="text-sm font-bold text-surface-50 mb-1.5">{prompt.prompt_en}</h2>
        <p className="text-xs text-surface-200/50">{prompt.prompt_vi}</p>

        <div className="mt-2 flex items-center gap-2 text-[10px] text-surface-200/30">
          <span>📏 {prompt.word_limit_min}-{prompt.word_limit_max} từ</span>
        </div>
      </div>

      {/* Hints toggle */}
      <button
        onClick={() => setShowHints(!showHints)}
        className="flex items-center gap-1.5 text-xs text-yellow-400/60 hover:text-yellow-400 transition-all px-1"
      >
        <Lightbulb className="w-3.5 h-3.5" />
        {showHints ? 'Ẩn gợi ý' : 'Xem gợi ý viết'}
      </button>

      {showHints && (
        <div className="glass-card p-4 border border-yellow-500/10 space-y-3">
          {/* Structure hints */}
          {prompt.hints_vi?.length > 0 && (
            <div>
              <p className="text-[10px] text-yellow-300/50 mb-1.5">Cấu trúc gợi ý:</p>
              {prompt.hints_vi.map((h, i) => (
                <p key={i} className="text-xs text-surface-200/60 mb-1">• {h}</p>
              ))}
            </div>
          )}

          {/* Useful phrases */}
          {prompt.useful_phrases?.length > 0 && (
            <div>
              <p className="text-[10px] text-yellow-300/50 mb-1.5">Cụm từ hay:</p>
              {prompt.useful_phrases.map((p, i) => (
                <p key={i} className="text-xs text-primary-300/60 mb-1 italic">"{p}"</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Writing area */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-surface-200/30">Bài viết của bạn:</p>
          <span className={`text-[10px] font-mono ${
            wordCount === 0 ? 'text-surface-200/20' :
            isInRange ? 'text-green-400' : 
            wordCount < prompt.word_limit_min ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {wordCount}/{prompt.word_limit_min}-{prompt.word_limit_max}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={userEssay}
          onChange={e => setUserEssay(e.target.value)}
          placeholder="Bắt đầu viết bài..."
          rows={10}
          className="w-full bg-surface-800/30 border border-surface-700/30 rounded-xl p-4 text-sm text-surface-50 placeholder:text-surface-200/20 focus:outline-none focus:border-primary-500/50 resize-none leading-relaxed"
        />

        {/* Word count bar */}
        <div className="mt-2 h-1.5 bg-surface-800/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isInRange ? 'bg-green-500' : wordCount > prompt.word_limit_max ? 'bg-red-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min(100, (wordCount / prompt.word_limit_max) * 100)}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{error}</div>
      )}

      {/* Submit */}
      <button
        onClick={submitEssay}
        disabled={wordCount < 10 || evaluating}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all"
      >
        {evaluating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Đang chấm bài...</>
        ) : (
          <><Send className="w-4 h-4" /> Nộp bài viết</>
        )}
      </button>
    </div>
  )
}
