import { useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle2, XCircle, Send, Keyboard, ArrowRight } from 'lucide-react'
import type { ReviewBlock } from '../stores/reviewTrackingStore'
import { useReviewTrackingStore } from '../stores/reviewTrackingStore'

interface QuizBlockProps {
  block: ReviewBlock
  onBlockComplete: () => void
}

/**
 * Fuzzy comparison for translation/text answers.
 * Returns a score from 0 to 1 (1 = exact match).
 */
function similarityScore(userAnswer: string, correctAnswer: string): number {
  const a = userAnswer.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')
  const b = correctAnswer.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ')

  if (a === b) return 1

  // Levenshtein distance
  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i]
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        matrix[i][j] = j
      } else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        )
      }
    }
  }

  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - matrix[a.length][b.length] / maxLen
}

/**
 * Check answer correctness with fuzzy matching for text/translation types.
 * Returns: 'correct' | 'close' | 'wrong'
 */
function checkAnswer(
  userAnswer: string,
  correctAnswer: string,
  questionType: string,
): 'correct' | 'close' | 'wrong' {
  if (!userAnswer || !correctAnswer) return 'wrong'

  const ua = (userAnswer || '').toLowerCase().trim()
  const ca = (correctAnswer || '').toLowerCase().trim()

  // Exact match (for all types)
  if (ua === ca) return 'correct'

  // For option-based types, strict match only
  if (questionType === 'multiple_choice' || questionType === 'true_false') {
    return 'wrong'
  }

  // For text-input types, use fuzzy matching
  const score = similarityScore(userAnswer, correctAnswer)
  if (score >= 0.85) return 'correct'  // Minor typos OK
  if (score >= 0.6) return 'close'     // Partially correct
  return 'wrong'
}

export function QuizBlock({ block, onBlockComplete }: QuizBlockProps) {
  const { submitAnswer, currentQuestionIndex } = useReviewTrackingStore()
  const questions = block.questions || []
  const question = questions[currentQuestionIndex]

  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [textAnswer, setTextAnswer] = useState('')
  const [showResult, setShowResult] = useState(false)
  const questionStartTime = useRef(Date.now())

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer('')
    setTextAnswer('')
    setShowResult(false)
    questionStartTime.current = Date.now()
  }, [currentQuestionIndex])


  const handleSubmitAnswer = useCallback(() => {
    if (showResult) return
    const answer = selectedAnswer || textAnswer
    if (!answer.trim()) return

    const responseTime = Date.now() - questionStartTime.current
    submitAnswer(answer, responseTime)
    setShowResult(true)
  }, [showResult, selectedAnswer, textAnswer, submitAnswer])

  // Auto-submit for option-based questions
  const handleSelectAndSubmit = useCallback((opt: string) => {
    if (showResult) return
    setSelectedAnswer(opt)
    // Submit immediately after selection
    const responseTime = Date.now() - questionStartTime.current
    submitAnswer(opt, responseTime)
    setShowResult(true)
  }, [showResult, submitAnswer])

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      useReviewTrackingStore.setState(s => ({
        currentQuestionIndex: s.currentQuestionIndex + 1,
      }))
    } else {
      onBlockComplete()
    }
  }, [currentQuestionIndex, questions.length, onBlockComplete])

  if (!question) return null

  const userAnswer = selectedAnswer || textAnswer
  const correctAnswer = question.correct_answer || ''
  const hasOptions = question.options && question.options.length > 0
  
  // Determine result with fuzzy matching
  const result = showResult ? checkAnswer(userAnswer, correctAnswer, question.type) : null
  const isCorrect = result === 'correct'
  const isClose = result === 'close'

  // Badge label
  const typeLabel = question.type === 'fill_blank' ? 'Điền từ' :
    question.type === 'multiple_choice' ? 'Trắc nghiệm' :
    question.type === 'true_false' ? 'Đúng/Sai' :
    question.type === 'translation' ? 'Dịch' :
    question.type === 'word_guess' ? 'Đoán từ' :
    question.type === 'matching' ? 'Nối' : question.type

  const typeBadgeClass = question.type === 'fill_blank' ? 'bg-primary-500/10 text-primary-400' :
    question.type === 'multiple_choice' ? 'bg-accent-500/10 text-accent-400' :
    question.type === 'true_false' ? 'bg-amber-500/10 text-amber-400' :
    question.type === 'translation' ? 'bg-emerald-500/10 text-emerald-400' :
    question.type === 'word_guess' ? 'bg-purple-500/10 text-purple-400' :
    'bg-surface-700/50 text-surface-200/50'

  return (
    <div className="glass-card p-6 space-y-5 animate-fade-in">
      {/* Question counter */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-200/40">
          Câu {currentQuestionIndex + 1}/{questions.length}
        </span>
        <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wide font-semibold ${typeBadgeClass}`}>
          {typeLabel}
        </span>
      </div>

      {/* Question text */}
      <p className="text-base font-semibold text-surface-50 leading-relaxed">
        {question.question}
      </p>

      {/* Answer area */}
      <div>
        {hasOptions ? (
          /* === Options-based questions (multiple_choice, true_false) === */
          <div className="grid gap-2.5">
            {question.options!.map((opt, i) => {
              if (opt == null) return null
              const selected = selectedAnswer === opt
              const optStr = String(opt)
              const optCorrect = showResult && optStr.toLowerCase().trim() === correctAnswer.toLowerCase().trim()

              let cls = 'bg-surface-800/40 border-surface-700/50 text-surface-200/60 hover:border-surface-600 hover:bg-surface-800/60'

              if (showResult) {
                if (optCorrect) {
                  cls = 'bg-success/10 border-success/30 text-success'
                } else if (selected && !isCorrect) {
                  cls = 'bg-error/10 border-error/30 text-error'
                } else {
                  cls = 'bg-surface-800/20 border-surface-700/30 text-surface-200/30'
                }
              } else if (selected) {
                cls = 'bg-primary-500/10 border-primary-500/30 text-primary-300'
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelectAndSubmit(optStr)}
                  disabled={showResult}
                  className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all disabled:cursor-default ${cls}`}
                >
                  <span className="font-semibold mr-2 opacity-50">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                  {showResult && optCorrect && (
                    <CheckCircle2 className="inline w-4 h-4 ml-2 text-success" />
                  )}
                  {showResult && selected && !isCorrect && !optCorrect && (
                    <XCircle className="inline w-4 h-4 ml-2 text-error" />
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          /* === Text input questions (fill_blank, translation, word_guess) === */
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmitAnswer()
                  }
                }}
                disabled={showResult}
                placeholder="Nhập câu trả lời..."
                rows={question.type === 'translation' ? 2 : 1}
                className={`w-full p-3.5 rounded-xl border text-sm outline-none transition-all disabled:cursor-default resize-none ${
                  showResult
                    ? isCorrect
                      ? 'bg-success/5 border-success/30 text-success'
                      : isClose
                        ? 'bg-amber-500/5 border-amber-500/30 text-amber-300'
                        : 'bg-error/5 border-error/30 text-error'
                    : 'bg-surface-800/40 border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/20'
                }`}
              />
              {!showResult && (
                <Keyboard className="absolute right-3 top-3.5 w-4 h-4 text-surface-200/20" />
              )}
            </div>

            {/* Result feedback for text answers */}
            {showResult && isClose && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1 animate-fade-in">
                <p className="text-amber-300 font-medium">⚡ Gần đúng!</p>
                <p className="text-surface-200/60">
                  Đáp án chính xác: <strong className="text-success">{question.correct_answer}</strong>
                </p>
              </div>
            )}
            {showResult && !isCorrect && !isClose && (
              <p className="text-xs text-success/70 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Đáp án: <strong>{question.correct_answer}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Explanation (after submit) */}
      {showResult && question.explanation && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300/80 flex items-start gap-2 animate-fade-in">
          <span className="shrink-0 mt-0.5">💡</span>
          <span>{question.explanation}</span>
        </div>
      )}

      {/* Submit / Next button */}
      <div className="flex justify-end">
        {!showResult && !hasOptions ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={!textAnswer.trim()}
            className="px-6 py-2.5 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Xác nhận
          </button>
        ) : showResult ? (
          <button
            onClick={handleNext}
            className="px-6 py-2.5 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {currentQuestionIndex < questions.length - 1 ? 'Câu tiếp' : 'Tiếp tục'}
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
