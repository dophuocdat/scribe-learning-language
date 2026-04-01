import { useState, useCallback } from 'react'
import { Check, RotateCcw, Loader2 } from 'lucide-react'
import { useWritingStore, type SentenceBuildingItem } from '../stores/writingStore'

export function SentenceBuilding() {
  const { content, evaluating, error, submitSentence, batchItems, currentBatchIndex, clearError } = useWritingStore()
  const exercise = content as SentenceBuildingItem
  
  // All available words (shuffled + distractors mixed)
  const allWords = [...(exercise?.words_shuffled || []), ...(exercise?.distractors || [])]
  
  const [availableWords, setAvailableWords] = useState<{ word: string; id: number }[]>(
    () => allWords.map((w, i) => ({ word: w, id: i }))
  )
  const [selectedWords, setSelectedWords] = useState<{ word: string; id: number }[]>([])
  const [submitted, setSubmitted] = useState(false)

  // Reset when content changes
  const resetWords = useCallback(() => {
    const words = [...(exercise?.words_shuffled || []), ...(exercise?.distractors || [])]
    setAvailableWords(words.map((w, i) => ({ word: w, id: i })))
    setSelectedWords([])
    setSubmitted(false)
  }, [exercise])

  if (!exercise) return null

  const handleSelectWord = (item: { word: string; id: number }) => {
    if (submitted) return
    setSelectedWords(prev => [...prev, item])
    setAvailableWords(prev => prev.filter(w => w.id !== item.id))
  }

  const handleRemoveWord = (item: { word: string; id: number }) => {
    if (submitted) return
    setAvailableWords(prev => [...prev, item])
    setSelectedWords(prev => prev.filter(w => w.id !== item.id))
  }

  const handleSubmit = async () => {
    if (selectedWords.length === 0) return
    setSubmitted(true)
    const answer = selectedWords.map(w => w.word).join(' ')
    await submitSentence(answer)
  }

  const handleReset = () => {
    clearError()
    resetWords()
  }

  const userAnswer = selectedWords.map(w => w.word).join(' ')

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

      {/* Instruction */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold text-surface-50 mb-1">Sắp xếp thành câu hoàn chỉnh</h3>
        <p className="text-[10px] text-surface-200/40">Nhấn vào từ để thêm vào câu · Nhấn từ trong câu để bỏ ra</p>
        {exercise.grammar_hint_vi && (
          <p className="text-[10px] text-primary-300/60 mt-1.5">💡 {exercise.grammar_hint_vi}</p>
        )}
      </div>

      {/* Answer zone */}
      <div className="glass-card p-5">
        <p className="text-[10px] text-surface-200/30 mb-3">Câu của bạn:</p>
        <div className="min-h-[60px] p-3 rounded-xl bg-surface-800/30 border-2 border-dashed border-surface-700/30 flex flex-wrap gap-2 items-start">
          {selectedWords.length === 0 ? (
            <span className="text-xs text-surface-200/20 italic">Nhấn vào từ bên dưới để bắt đầu...</span>
          ) : (
            selectedWords.map((item, idx) => (
              <button
                key={`sel-${item.id}-${idx}`}
                onClick={() => handleRemoveWord(item)}
                disabled={submitted}
                className="px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-200 text-sm font-medium border border-primary-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-all disabled:pointer-events-none"
              >
                {item.word}
              </button>
            ))
          )}
        </div>
        {userAnswer && (
          <p className="text-xs text-surface-200/50 mt-2 italic">"{userAnswer}"</p>
        )}
      </div>

      {/* Available words */}
      <div className="glass-card p-5">
        <p className="text-[10px] text-surface-200/30 mb-3">Từ có sẵn:</p>
        <div className="flex flex-wrap gap-2">
          {availableWords.map((item) => (
            <button
              key={`avail-${item.id}`}
              onClick={() => handleSelectWord(item)}
              disabled={submitted}
              className="px-3 py-1.5 rounded-lg bg-surface-800/50 text-surface-100 text-sm font-medium border border-surface-700/30 hover:gradient-bg hover:text-white hover:border-primary-500/30 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {item.word}
            </button>
          ))}
        </div>
      </div>

      {/* Translation hint */}
      {exercise.translation_vi && (
        <div className="px-1">
          <p className="text-[10px] text-surface-200/30">🇻🇳 {exercise.translation_vi}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{error}</div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className="px-4 py-3 rounded-xl bg-surface-800/50 border border-surface-700/30 text-surface-200/60 hover:text-surface-100 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={selectedWords.length === 0 || evaluating || submitted}
          className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
        >
          {evaluating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Đang chấm...</>
          ) : submitted ? (
            <><Check className="w-4 h-4" /> Đã nộp</>
          ) : (
            <><Check className="w-4 h-4" /> Kiểm tra</>
          )}
        </button>
      </div>
    </div>
  )
}
