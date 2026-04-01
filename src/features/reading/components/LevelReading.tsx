import { useState, useEffect } from 'react'
import { Clock, BookOpen, ChevronRight, Type } from 'lucide-react'
import { useReadingStore, type LevelReadingContent, type VocabWord } from '../stores/readingStore'
import { InteractiveText } from './InteractiveText'

export function LevelReading() {
  const { content, batchItems, currentBatchIndex, addClickedWord, goToQuestions } = useReadingStore()
  const article = content as LevelReadingContent

  const [elapsedSec, setElapsedSec] = useState(0)

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!article) return null

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const estimatedMin = Math.max(1, Math.round((article.word_count || 200) / 200))

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

      {/* Article Header */}
      <div className="glass-card p-4 space-y-2">
        <h2 className="text-base font-bold text-surface-50">{article.title}</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-surface-200/40">
            <Type className="w-3 h-3" /> {article.word_count || '~200'} từ
          </span>
          <span className="flex items-center gap-1 text-[10px] text-surface-200/40">
            <Clock className="w-3 h-3" /> ~{estimatedMin} phút đọc
          </span>
          <span className="flex items-center gap-1 text-[10px] text-primary-300/60">
            <Clock className="w-3 h-3" /> {formatTime(elapsedSec)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-surface-200/30">
            <BookOpen className="w-3 h-3" /> {article.vocabulary?.length || 0} từ vựng
          </span>
        </div>
        <p className="text-[10px] text-surface-200/30">💡 Nhấn vào bất kỳ từ nào để xem nghĩa và phát âm</p>
      </div>

      {/* Article Content */}
      <div className="glass-card p-5">
        <InteractiveText
          content={article.content}
          vocabulary={article.vocabulary || []}
          onWordClicked={(word) => addClickedWord(word)}
          onSaveWord={(_word: VocabWord) => {
            // TODO: save to user SRS cards
          }}
        />
      </div>

      {/* Navigate to Questions */}
      <button
        onClick={goToQuestions}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm shadow-lg shadow-primary-600/20"
      >
        <ChevronRight className="w-4 h-4" />
        Trả lời câu hỏi ({article.questions?.length || 0} câu)
      </button>
    </div>
  )
}
