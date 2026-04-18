import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Check, XCircle, Trophy, RotateCcw } from 'lucide-react'
import { useLearningPathStore } from '../stores/learningPathStore'
import type { CheckpointSubmitResponse } from '@/shared/types/database'

export function CheckpointQuizModal() {
  const { checkpointQuiz, checkpointSubmitting, submitCheckpoint, closeCheckpoint } =
    useLearningPathStore()

  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CheckpointSubmitResponse | null>(null)

  if (!checkpointQuiz) return null

  const questions = checkpointQuiz.questions
  const currentQ = questions[currentIdx]
  const total = questions.length
  const allAnswered = Object.keys(answers).length === total

  const selectAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const handleSubmit = async () => {
    const res = await submitCheckpoint(answers)
    if (res) setResult(res)
  }

  const handleRetry = () => {
    // Re-generate quiz
    setResult(null)
    setAnswers({})
    setCurrentIdx(0)
    // The checkpoint quiz data from store is still the same course_ids
    // We need to call startCheckpoint again — parent handles this
    closeCheckpoint()
  }

  // Result screen
  if (result) {
    const passed = result.passed
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md mx-4 rounded-2xl bg-surface-900 border border-surface-700 overflow-hidden shadow-2xl">
          {/* Result Header */}
          <div className={`p-8 text-center ${passed ? 'bg-success/10' : 'bg-error/10'}`}>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${passed ? 'bg-success/20' : 'bg-error/20'}`}>
              {passed ? <Trophy className="w-8 h-8 text-success" /> : <XCircle className="w-8 h-8 text-error" />}
            </div>
            <h2 className={`text-2xl font-bold mt-4 ${passed ? 'text-success' : 'text-error'}`}>
              {passed ? '🎉 Checkpoint Passed!' : '❌ Chưa đạt'}
            </h2>
            <p className="text-4xl font-bold text-surface-50 mt-2">{result.score}%</p>
            <p className="text-sm text-surface-200/50 mt-1">
              {result.results.filter(r => r.correct).length}/{result.results.length} câu đúng
              {!passed && ' · Cần đạt 70%'}
            </p>
          </div>

          {/* Answer review */}
          <div className="p-4 max-h-60 overflow-y-auto">
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {result.results.map((r, i) => (
                <div
                  key={i}
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium
                    ${r.correct ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}
                  `}
                >
                  {r.correct ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-surface-700/50 flex gap-3">
            {passed ? (
              <button
                onClick={closeCheckpoint}
                className="flex-1 py-3 rounded-xl bg-success/20 text-success font-medium hover:bg-success/30 transition-all"
              >
                Tiếp tục lộ trình →
              </button>
            ) : (
              <>
                <button
                  onClick={closeCheckpoint}
                  className="flex-1 py-3 rounded-xl bg-surface-800 text-surface-200/60 font-medium hover:bg-surface-700 transition-all"
                >
                  Đóng
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 rounded-xl bg-primary-500/20 text-primary-400 font-medium hover:bg-primary-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Thử lại
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Quiz screen
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-950/95 backdrop-blur-lg animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <button onClick={closeCheckpoint} className="p-2 rounded-lg hover:bg-surface-800 text-surface-200/60 transition-all">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-xs text-surface-200/40 font-medium">Câu {currentIdx + 1}/{total}</p>
        </div>
        <div className="w-9 h-9" /> {/* Spacer */}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-surface-800">
        <div
          className="h-full bg-primary-500 transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-lg space-y-6 animate-fade-in" key={currentIdx}>
          {/* Source badge */}
          <div className="flex justify-center">
            <span className="text-[10px] px-2 py-1 rounded-full bg-surface-800 text-surface-200/40 font-medium">
              Từ: {currentQ.source_course}
            </span>
          </div>

          {/* Question text */}
          <p className="text-lg font-medium text-surface-50 text-center leading-relaxed">
            {currentQ.question_text}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {(currentQ.options as string[]).map((option, oi) => {
              const isSelected = answers[currentQ.id] === option
              return (
                <button
                  key={oi}
                  onClick={() => selectAnswer(currentQ.id, option)}
                  className={`
                    w-full p-4 rounded-xl text-left transition-all duration-200 border
                    ${isSelected
                      ? 'bg-primary-500/15 border-primary-500/50 text-surface-50'
                      : 'bg-surface-800/40 border-surface-700/50 text-surface-200/70 hover:border-surface-600 hover:bg-surface-800/60'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-medium
                      ${isSelected ? 'border-primary-500 bg-primary-500 text-white' : 'border-surface-600 text-surface-200/40'}
                    `}>
                      {String.fromCharCode(65 + oi)}
                    </div>
                    <span className="text-sm">{option}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between px-4 py-4 border-t border-surface-800">
        <button
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-surface-200/50 hover:text-surface-50 hover:bg-surface-800 transition-all disabled:opacity-20"
        >
          <ChevronLeft className="w-4 h-4" /> Trước
        </button>

        {/* Quick nav dots */}
        <div className="flex gap-1 max-w-[200px] overflow-hidden">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIdx ? 'bg-primary-500 w-4' : answers[questions[i].id] ? 'bg-success/50' : 'bg-surface-700'
              }`}
            />
          ))}
        </div>

        {currentIdx < total - 1 ? (
          <button
            onClick={() => setCurrentIdx(currentIdx + 1)}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-primary-400 hover:bg-primary-500/10 transition-all"
          >
            Tiếp <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || checkpointSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 text-white font-medium disabled:opacity-30 transition-all"
          >
            {checkpointSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Nộp bài
          </button>
        )}
      </div>
    </div>
  )
}
