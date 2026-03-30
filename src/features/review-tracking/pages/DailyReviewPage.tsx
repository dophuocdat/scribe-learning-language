import { useEffect, useCallback, useRef, useState } from 'react'
import {
  Brain,
  Sparkles,
  Loader2,
  History,
  AlertTriangle,
} from 'lucide-react'
import { useReviewTrackingStore } from '../stores/reviewTrackingStore'
import { ReviewBlockComponent } from '../components/ReviewBlock'
import { QuizBlock } from '../components/QuizBlock'
import { MasteryResult } from '../components/MasteryResult'
import { AntiCheatOverlay } from '../components/AntiCheatOverlay'
import { LearningHistory } from '../components/LearningHistory'

export function DailyReviewPage() {
  const {
    lessonsDue, dueCount, phase, isLoading, error,
    exerciseBlocks, currentBlockIndex,
    tabSwitchCount, masteryResult, isResumed,
    fetchLessonsDue, checkExistingSession, generateDailyReview, advanceToNextQuestion,
    finishSession, recordTabSwitch, recordContextMenu, reset,
  } = useReviewTrackingStore()

  const [showHistory, setShowHistory] = useState(false)
  const [showAntiCheat, setShowAntiCheat] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check for resumable session first, then fetch lessons if none
    const init = async () => {
      const hasSession = await checkExistingSession()
      if (!hasSession) {
        await fetchLessonsDue()
      }
    }
    init()
    return () => { reset() }
  }, [checkExistingSession, fetchLessonsDue, reset])

  // Anti-cheat: visibility change detection
  useEffect(() => {
    if (phase !== 'quiz' && phase !== 'reviewing') return

    const handleVisibility = () => {
      if (document.hidden) {
        recordTabSwitch()
        setShowAntiCheat(true)
        setTimeout(() => setShowAntiCheat(false), 3000)
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      recordContextMenu()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [phase, recordTabSwitch, recordContextMenu])

  const handleNextBlock = useCallback(() => {
    const hasMore = advanceToNextQuestion()
    if (!hasMore) {
      finishSession()
    }
    // Scroll to top on block change
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [advanceToNextQuestion, finishSession])

  const handleRetry = useCallback(() => {
    reset()
    fetchLessonsDue()
  }, [reset, fetchLessonsDue])

  const currentBlock = exerciseBlocks[currentBlockIndex]
  const totalBlocks = exerciseBlocks.length
  const progress = totalBlocks > 0 ? ((currentBlockIndex + 1) / totalBlocks) * 100 : 0

  return (
    <div
      className="space-y-6 animate-fade-in max-w-3xl mx-auto"
      ref={containerRef}
      style={{ userSelect: phase === 'quiz' ? 'none' : 'auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            Ôn tập hàng ngày
          </h1>
          <p className="text-sm text-surface-200/50 mt-1">
            Luyện tập kiến thức đã học với AI
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-4 py-2 rounded-xl bg-surface-800/40 text-surface-200/60 text-sm hover:bg-surface-800/60 transition-colors flex items-center gap-2"
        >
          <History className="w-4 h-4" />
          Lịch sử
        </button>
      </div>

      {/* History panel */}
      {showHistory && (
        <LearningHistory onClose={() => setShowHistory(false)} />
      )}

      {/* Anti-cheat overlay */}
      {showAntiCheat && <AntiCheatOverlay count={tabSwitchCount} />}

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border border-error/30 bg-error/5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-error shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Loading initial check */}
      {isLoading && phase === 'idle' && !showHistory && (
        <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
          <Loader2 className="w-10 h-10 text-primary-400 animate-spin mx-auto" />
          <p className="text-sm text-surface-200/50">Đang kiểm tra bài ôn tập...</p>
        </div>
      )}

      {/* Resume indicator */}
      {isResumed && (phase === 'reviewing' || phase === 'quiz') && (
        <div className="px-4 py-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs text-primary-300 flex items-center gap-2">
          <History className="w-3.5 h-3.5" />
          Tiếp tục bài ôn tập trước đó
        </div>
      )}

      {/* ===== IDLE STATE ===== */}
      {phase === 'idle' && !showHistory && !isLoading && (
        <div className="glass-card p-8 text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/10 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary-400" />
          </div>

          {dueCount > 0 ? (
            <>
              <div>
                <h2 className="text-xl font-bold text-surface-50">
                  {dueCount} bài cần ôn tập hôm nay
                </h2>
                <p className="text-sm text-surface-200/50 mt-2">
                  AI sẽ tạo bài ôn tập tổng hợp từ các bài đã học, với từ vựng và cấu trúc lặp lại để bạn ghi nhớ tốt hơn.
                </p>
              </div>

              <div className="space-y-2 max-w-sm mx-auto">
                {lessonsDue.slice(0, 5).map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/30 text-left">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      l.status === 'completed' ? 'bg-success' : 'bg-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-50 truncate">{l.lesson_title}</p>
                      <p className="text-[11px] text-surface-200/30">{l.course_title}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 shrink-0">
                      Lv.{l.interval_level}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={generateDailyReview}
                disabled={isLoading}
                className="px-8 py-3.5 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                Bắt đầu ôn tập
              </button>
            </>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-surface-50">
                🎉 Không có bài cần ôn!
              </h2>
              <p className="text-sm text-surface-200/50 mt-2">
                Bạn đã ôn tập xong tất cả. Hãy học thêm bài mới nhé!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== GENERATING ===== */}
      {phase === 'generating' && (
        <div className="glass-card p-12 text-center space-y-4 animate-fade-in">
          <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-surface-50">AI đang tạo bài ôn tập...</h2>
            <p className="text-sm text-surface-200/40 mt-1">
              Tổng hợp kiến thức từ {dueCount} bài học
            </p>
          </div>
        </div>
      )}

      {/* ===== PROGRESS BAR (during quiz/review) ===== */}
      {(phase === 'reviewing' || phase === 'quiz') && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-surface-200/50">
            <span className="font-medium">
              Block {currentBlockIndex + 1}/{totalBlocks}
              {currentBlock?.type === 'review' ? ' • Ôn kiến thức' : ' • Bài tập'}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ===== REVIEW BLOCK ===== */}
      {phase === 'reviewing' && currentBlock?.type === 'review' && (
        <ReviewBlockComponent
          block={currentBlock}
          onContinue={handleNextBlock}
        />
      )}

      {/* ===== QUIZ BLOCK ===== */}
      {phase === 'quiz' && currentBlock?.type === 'quiz' && (
        <QuizBlock
          block={currentBlock}
          onBlockComplete={handleNextBlock}
        />
      )}

      {/* ===== COMPLETED ===== */}
      {phase === 'completed' && masteryResult && (
        <MasteryResult
          mastery={masteryResult}
          answers={useReviewTrackingStore.getState().answers}
          onRetry={handleRetry}
        />
      )}
    </div>
  )
}
