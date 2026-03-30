import { BookOpen, ArrowRight } from 'lucide-react'
import type { ReviewBlock } from '../stores/reviewTrackingStore'

interface ReviewBlockProps {
  block: ReviewBlock
  onContinue: () => void
}

export function ReviewBlockComponent({ block, onContinue }: ReviewBlockProps) {
  return (
    <div className="glass-card p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-accent-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-surface-50">
            {block.title || 'Ôn tập kiến thức'}
          </h3>
          <p className="text-xs text-surface-200/40">
            Đọc kỹ trước khi làm bài tập
          </p>
        </div>
      </div>

      {/* Vocabulary / Grammar items */}
      <div className="space-y-3">
        {block.items?.map((item, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface-800/30 border border-surface-700/30 space-y-2 hover:border-accent-500/20 transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-surface-50">
                {item.word || item.structure}
              </span>
              {item.part_of_speech && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-700/50 text-surface-200/50 uppercase">
                  {item.part_of_speech}
                </span>
              )}
            </div>
            <p className="text-sm text-primary-300">{item.meaning}</p>
            {item.example && (
              <p className="text-sm text-surface-200/60 italic">
                📝 {item.example}
              </p>
            )}
            {item.note && (
              <p className="text-xs text-surface-200/40">
                💡 {item.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="w-full py-3 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        Đã ghi nhớ — Tiếp tục
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
