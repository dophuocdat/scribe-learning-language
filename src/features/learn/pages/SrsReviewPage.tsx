import { useEffect, useState } from 'react'
import { Brain, CheckCircle2, Trophy, Sparkles, RotateCcw } from 'lucide-react'
import { useLearnStore } from '../stores/learnStore'
import { FlashCard } from '../components/FlashCard'

export function SrsReviewPage() {
  const { srsCards, srsStats, loadingSrs, fetchSrsCards, reviewSrsCard } = useLearnStore()
  const [reviewed, setReviewed] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)

  useEffect(() => {
    fetchSrsCards()
  }, [fetchSrsCards])

  const currentCard = srsCards[0]

  const handleReview = async (quality: number) => {
    if (!currentCard) return
    await reviewSrsCard(currentCard.id, quality)
    setReviewed((p) => p + 1)

    // If no more cards, show complete
    if (srsCards.length <= 1) {
      setSessionComplete(true)
    }
  }

  const handleRestart = () => {
    setReviewed(0)
    setSessionComplete(false)
    fetchSrsCards()
  }

  if (loadingSrs) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-7 w-48 bg-surface-800/60 rounded animate-pulse" />
        <div className="glass-card p-6 h-80 flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Ôn tập SRS
          </h1>
          <p className="text-sm text-surface-200/50 mt-1">
            Hệ thống lặp lại ngắt quãng — ôn đúng lúc, nhớ lâu hơn
          </p>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-primary-400">{srsStats.dueToday}</p>
          <p className="text-[10px] uppercase tracking-wider text-surface-200/30 mt-1">
            Cần ôn hôm nay
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-success">{srsStats.mastered}</p>
          <p className="text-[10px] uppercase tracking-wider text-surface-200/30 mt-1">
            Đã thuộc
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-surface-200/60">{srsStats.total}</p>
          <p className="text-[10px] uppercase tracking-wider text-surface-200/30 mt-1">
            Tổng thẻ
          </p>
        </div>
      </div>

      {/* Session complete */}
      {sessionComplete ? (
        <div className="glass-card p-12 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-surface-50 mb-2">
            Hoàn thành! 🎉
          </h2>
          <p className="text-sm text-surface-200/50 mb-1">
            Bạn đã ôn tập {reviewed} thẻ trong phiên này
          </p>
          <p className="text-xs text-surface-200/30 mb-6">
            Hãy quay lại sau để tiếp tục ôn tập thẻ mới
          </p>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 font-medium text-sm hover:bg-primary-500/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Kiểm tra lại
          </button>
        </div>
      ) : srsCards.length === 0 && !sessionComplete ? (
        // No cards due
        <div className="glass-card p-12 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-10 h-10 text-primary-400" />
          </div>
          <h2 className="text-xl font-bold text-surface-50 mb-2">
            Không có thẻ nào cần ôn
          </h2>
          <p className="text-sm text-surface-200/50 mb-1">
            Bạn đã ôn tập tất cả! Hãy quay lại sau.
          </p>
          <p className="text-xs text-surface-200/30">
            Thêm từ vựng mới từ các bài học để tạo thẻ ôn tập
          </p>
        </div>
      ) : (
        // Flashcard review
        <div>
          {/* Progress */}
          <div className="flex items-center justify-between text-xs text-surface-200/30 mb-4">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              Đã ôn: {reviewed}
            </span>
            <span>Còn lại: {srsCards.length}</span>
          </div>

          {currentCard && currentCard.vocabulary && (
            <FlashCard
              vocabulary={currentCard.vocabulary}
              onReview={handleReview}
            />
          )}
        </div>
      )}
    </div>
  )
}
