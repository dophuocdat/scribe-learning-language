import { useState, useMemo, useCallback, useRef } from 'react'
import {
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Keyboard,
  Lightbulb,
  Play,
  Send,
  Target,
  Minus,
  Plus,
  Zap,
} from 'lucide-react'
import type { Quiz, QuizQuestion } from '@/shared/types/database'
import { useLearnStore } from '../stores/learnStore'

/* ------------------------------------------------------------------ */
/*  Utility: Fisher-Yates shuffle                                     */
/* ------------------------------------------------------------------ */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface QuizPlayerProps {
  quiz: Quiz & { questions?: QuizQuestion[] }
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */
export function QuizPlayer({ quiz }: QuizPlayerProps) {
  const { submitQuizAttempt, submittingQuiz } = useLearnStore()
  const rawQuestions = useMemo(() => quiz.questions || [], [quiz.questions])

  const maxCount = rawQuestions.length
  const defaultCount = Math.min(10, maxCount)

  type Phase = 'idle' | 'active' | 'graded'
  const [phase, setPhase] = useState<Phase>('idle')
  const [questionCount, setQuestionCount] = useState(defaultCount)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [hintsOpen, setHintsOpen] = useState<Record<string, boolean>>({})
  const [startTime, setStartTime] = useState(0)

  const listRef = useRef<HTMLDivElement>(null)

  /* ---- Derived ---- */
  const answeredCount = Object.keys(answers).length
  const totalCount = questions.length

  const scoreInfo = useMemo(() => {
    if (phase !== 'graded') return null
    const correct = questions.reduce((acc, q) => {
      const ua = (answers[q.id] || '').toLowerCase().trim()
      const ca = (q.correct_answer || '').toLowerCase().trim()
      return acc + (ua === ca ? 1 : 0)
    }, 0)
    const percent = totalCount > 0 ? Math.round((correct / totalCount) * 100) : 0
    const passed = percent >= quiz.passing_score
    const xpEarned = Math.round(10 + (totalCount > 0 ? correct / totalCount : 0) * 40)
    return { correct, percent, passed, xpEarned }
  }, [phase, questions, answers, totalCount, quiz.passing_score])

  /* ---- Handlers ---- */
  const handleStart = useCallback(() => {
    const count = Math.min(questionCount, maxCount)
    setQuestions(shuffle(rawQuestions).slice(0, count))
    setAnswers({})
    setHintsOpen({})
    setStartTime(Date.now())
    setPhase('active')
  }, [rawQuestions, questionCount, maxCount])

  const handleSelectOption = useCallback(
    (qId: string, opt: string) => {
      if (phase !== 'active') return
      setAnswers((prev) => ({ ...prev, [qId]: opt }))
    },
    [phase]
  )

  const handleTextChange = useCallback(
    (qId: string, value: string) => {
      if (phase !== 'active') return
      setAnswers((prev) => ({ ...prev, [qId]: value }))
    },
    [phase]
  )

  const toggleHint = useCallback((qId: string) => {
    setHintsOpen((prev) => ({ ...prev, [qId]: !prev[qId] }))
  }, [])

  const handleSubmit = useCallback(async () => {
    const correct = questions.reduce((acc, q) => {
      const ua = (answers[q.id] || '').toLowerCase().trim()
      const ca = (q.correct_answer || '').toLowerCase().trim()
      return acc + (ua === ca ? 1 : 0)
    }, 0)
    const timeSpent = Math.floor((Date.now() - startTime) / 1000)

    await submitQuizAttempt(quiz.id, answers, correct, totalCount, timeSpent)
    setPhase('graded')

    // Scroll to top to see score
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [questions, answers, startTime, quiz.id, totalCount, submitQuizAttempt])

  /* ================================================================ */
  /*  Empty state                                                      */
  /* ================================================================ */
  if (rawQuestions.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-surface-200/40 text-sm">
        Quiz này chưa có câu hỏi nào
      </div>
    )
  }

  /* ================================================================ */
  /*  IDLE — Start screen                                              */
  /* ================================================================ */
  if (phase === 'idle') {
    return (
      <div className="glass-card p-8 text-center space-y-5 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-500/10 flex items-center justify-center">
          <Target className="w-8 h-8 text-primary-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-surface-50">{quiz.title}</h3>
          <p className="text-sm text-surface-200/50 mt-1">
            {rawQuestions.length} câu hỏi · Điểm đạt: {quiz.passing_score}%
          </p>
        </div>

        {/* Question count selector */}
        <div className="flex flex-col items-center gap-2">
          <label className="text-xs text-surface-200/50 font-medium">Số câu muốn làm</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuestionCount((c) => Math.max(1, c - 1))}
              disabled={questionCount <= 1}
              className="w-8 h-8 rounded-lg bg-surface-700/50 text-surface-200/60 flex items-center justify-center hover:bg-surface-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={1}
              max={maxCount}
              value={questionCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) setQuestionCount(Math.max(1, Math.min(maxCount, v)))
              }}
              className="w-16 text-center py-1.5 rounded-lg bg-surface-800/60 border border-surface-700/50 text-surface-50 text-lg font-bold outline-none focus:border-primary-500/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setQuestionCount((c) => Math.min(maxCount, c + 1))}
              disabled={questionCount >= maxCount}
              className="w-8 h-8 rounded-lg bg-surface-700/50 text-surface-200/60 flex items-center justify-center hover:bg-surface-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-surface-200/30">Tối đa: {maxCount} câu</p>
        </div>

        <ul className="text-xs text-surface-200/40 space-y-1 max-w-xs mx-auto text-left">
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary-400" />
            Câu hỏi hiển thị cùng lúc, xáo trộn ngẫu nhiên
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-accent-400" />
            Bấm gợi ý nếu cần trợ giúp
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-success" />
            Nộp bài để chấm điểm ngay
          </li>
        </ul>
        <button
          onClick={handleStart}
          className="px-8 py-3 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
        >
          <Play className="w-5 h-5" />
          Bắt đầu làm bài ({questionCount} câu)
        </button>
      </div>
    )
  }

  /* ================================================================ */
  /*  ACTIVE / GRADED — Question list                                  */
  /* ================================================================ */
  return (
    <div className="space-y-4 animate-fade-in" ref={listRef}>
      {/* ---- Score banner (graded only) ---- */}
      {phase === 'graded' && scoreInfo && (
        <div
          className={`glass-card p-5 flex flex-col sm:flex-row items-center gap-4 border ${
            scoreInfo.passed ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              scoreInfo.passed ? 'bg-success/10' : 'bg-error/10'
            }`}
          >
            <Trophy className={`w-7 h-7 ${scoreInfo.passed ? 'text-success' : 'text-error'}`} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-surface-50">
              {scoreInfo.passed ? 'Xuất sắc! 🎉' : 'Chưa đạt — Hãy thử lại!'}
            </h3>
            <p className="text-sm text-surface-200/60">
              Đúng {scoreInfo.correct}/{totalCount} câu ({scoreInfo.percent}%) · Yêu cầu:{' '}
              {quiz.passing_score}%
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/20">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-bold text-amber-400">+{scoreInfo.xpEarned} XP</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleStart}
            className="px-5 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 font-medium text-sm hover:bg-primary-500/20 transition-colors flex items-center gap-2 shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Làm lại
          </button>
        </div>
      )}

      {/* ---- Progress bar (active only) ---- */}
      {phase === 'active' && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-surface-200/50">
            <span className="font-medium">{quiz.title}</span>
            <span>
              {answeredCount}/{totalCount} đã trả lời
            </span>
          </div>
          <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* ---- All questions ---- */}
      {questions.map((q, idx) => {
        const hasOptions = q.options && q.options.length > 0
        const userAnswer = answers[q.id] || ''
        const hintVisible = hintsOpen[q.id]

        // Grading per question
        const isGraded = phase === 'graded'
        const isCorrect = isGraded
          ? userAnswer.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim()
          : false

        return (
          <div
            key={q.id}
            className={`glass-card p-5 space-y-3 transition-all ${
              isGraded
                ? isCorrect
                  ? 'border border-success/20 bg-success/[0.03]'
                  : 'border border-error/20 bg-error/[0.03]'
                : ''
            }`}
          >
            {/* Question header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isGraded
                      ? isCorrect
                        ? 'bg-success/10 text-success'
                        : 'bg-error/10 text-error'
                      : userAnswer
                        ? 'bg-primary-500/10 text-primary-400'
                        : 'bg-surface-700/50 text-surface-200/40'
                  }`}
                >
                  {isGraded ? (
                    isCorrect ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )
                  ) : (
                    idx + 1
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-700/50 text-surface-200/50 uppercase tracking-wide font-semibold">
                      {q.question_type === 'fill_blank'
                        ? 'Điền từ'
                        : q.question_type === 'true_false'
                          ? 'Đúng/Sai'
                          : 'Trắc nghiệm'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-surface-50">{q.question_text}</p>
                </div>
              </div>

              {/* Hint button */}
              {q.explanation && phase === 'active' && (
                <button
                  onClick={() => toggleHint(q.id)}
                  className={`shrink-0 p-2 rounded-lg text-xs transition-all ${
                    hintVisible
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-surface-700/40 text-surface-200/40 hover:text-amber-400 hover:bg-amber-500/10'
                  }`}
                  title="Gợi ý"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Hint content */}
            {hintVisible && q.explanation && phase === 'active' && (
              <div className="ml-10 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300/80 flex items-start gap-2 animate-fade-in">
                <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>{q.explanation}</span>
              </div>
            )}

            {/* Answer area */}
            <div className="ml-10">
              {hasOptions ? (
                /* Multiple choice / true_false */
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options!.map((opt, optIdx) => {
                    const selected = userAnswer === opt
                    const optCorrect =
                      isGraded && opt.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim()

                    let optClass =
                      'bg-surface-800/40 border-surface-700/50 text-surface-200/60 hover:border-surface-600'

                    if (isGraded) {
                      if (optCorrect) {
                        optClass = 'bg-success/10 border-success/30 text-success'
                      } else if (selected && !isCorrect) {
                        optClass = 'bg-error/10 border-error/30 text-error'
                      } else {
                        optClass = 'bg-surface-800/20 border-surface-700/30 text-surface-200/30'
                      }
                    } else if (selected) {
                      optClass = 'bg-primary-500/10 border-primary-500/30 text-primary-300'
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectOption(q.id, opt)}
                        disabled={isGraded}
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-all disabled:cursor-default ${optClass}`}
                      >
                        <span className="font-semibold mr-2 opacity-50">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {opt}
                        {isGraded && optCorrect && (
                          <CheckCircle2 className="inline w-3.5 h-3.5 ml-2 text-success" />
                        )}
                        {isGraded && selected && !isCorrect && !optCorrect && (
                          <XCircle className="inline w-3.5 h-3.5 ml-2 text-error" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                /* Fill-in-the-blank */
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                      disabled={isGraded}
                      placeholder="Nhập câu trả lời..."
                      className={`w-full p-3 rounded-xl border text-sm outline-none transition-all disabled:cursor-default ${
                        isGraded
                          ? isCorrect
                            ? 'bg-success/5 border-success/30 text-success'
                            : 'bg-error/5 border-error/30 text-error'
                          : 'bg-surface-800/40 border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/20'
                      }`}
                    />
                    <Keyboard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/20" />
                  </div>
                  {isGraded && !isCorrect && (
                    <p className="text-xs text-success/70 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Đáp án đúng: <strong>{q.correct_answer}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Explanation after grading */}
            {isGraded && q.explanation && (
              <div className="ml-10 p-3 rounded-xl bg-surface-700/20 border border-surface-700/30 text-xs text-surface-200/50 flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400/60" />
                <span>{q.explanation}</span>
              </div>
            )}
          </div>
        )
      })}

      {/* ---- Submit / Retry bar ---- */}
      {phase === 'active' && (
        <div className="glass-card p-4 flex items-center justify-between gap-4 sticky bottom-4">
          <p className="text-xs text-surface-200/40">
            {answeredCount === totalCount
              ? '✅ Đã trả lời hết — sẵn sàng nộp bài!'
              : `Còn ${totalCount - answeredCount} câu chưa trả lời`}
          </p>
          <button
            onClick={handleSubmit}
            disabled={answeredCount === 0 || submittingQuiz}
            className="px-6 py-2.5 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
          >
            {submittingQuiz ? (
              'Đang nộp...'
            ) : (
              <>
                <Send className="w-4 h-4" />
                Nộp bài ({answeredCount}/{totalCount})
              </>
            )}
          </button>
        </div>
      )}

      {/* ---- Bottom retry (graded) ---- */}
      {phase === 'graded' && (
        <div className="glass-card p-4 flex items-center justify-center gap-3">
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Làm lại (câu hỏi xáo trộn)
          </button>
        </div>
      )}
    </div>
  )
}
