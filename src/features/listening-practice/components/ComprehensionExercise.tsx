import { useState } from 'react'
import { Send, AlertCircle, Info } from 'lucide-react'
import { useListeningPracticeStore, type ComprehensionContent } from '../stores/listeningPracticeStore'
import { AudioPlayer } from './AudioPlayer'

export function ComprehensionExercise() {
  const { content, evaluating, exerciseType, error, submitAnswer, clearError, batchItems, currentBatchIndex } = useListeningPracticeStore()
  const compContent = content as ComprehensionContent
  if (!compContent) return null

  const [answers, setAnswers] = useState<string[]>(
    compContent.questions ? compContent.questions.map(() => '') : ['']
  )

  const setAnswer = (index: number, value: string) => {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
  }

  const handleSubmit = async () => {
    const combined = exerciseType === 'fill_blank'
      ? answers.map((a, i) => `Q${i + 1}: ${a}`).join('\n')
      : exerciseType === 'short_answer'
        ? answers.map((a, i) => `Q${i + 1}: ${a}`).join('\n')
        : answers[0] || ''

    if (!combined.trim()) return
    clearError()
    await submitAnswer(combined)
  }

  const hasQuestions = compContent.questions && compContent.questions.length > 0
  const isOpenEnded = exerciseType === 'summary' || exerciseType === 'opinion' || exerciseType === 'essay'

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

      {/* Audio Player */}
      <AudioPlayer text={compContent.passage} />

      {/* Instruction */}
      <div className="glass-card p-3 flex items-start gap-2 text-xs text-surface-200/50">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary-400" />
        <span>{compContent.instruction_vi}</span>
      </div>

      {/* Questions / Writing Area */}
      {hasQuestions && !isOpenEnded ? (
        <div className="space-y-3">
          {compContent.questions.map((q, i) => (
            <div key={i} className="glass-card overflow-hidden">
              <div className="p-3 border-b border-surface-800">
                <p className="text-xs font-medium text-surface-50">
                  {q.type === 'fill_blank' && q.blank_text ? (
                    <span className="font-mono">
                      {q.blank_text.split('___').map((part, j, arr) => (
                        <span key={j}>
                          {part}
                          {j < arr.length - 1 && (
                            <span className="inline-block min-w-[60px] border-b-2 border-primary-400/50 mx-1" />
                          )}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <>
                      <span className="text-primary-400 mr-1.5">Q{i + 1}.</span>
                      {q.question}
                    </>
                  )}
                </p>
                <p className="text-[10px] text-surface-200/30 mt-1">{q.question_vi}</p>
              </div>
              <div className="p-3">
                <input
                  type="text"
                  value={answers[i] || ''}
                  onChange={(e) => setAnswer(i, e.target.value)}
                  placeholder="Nhập câu trả lời..."
                  className="w-full bg-transparent text-sm text-surface-200/80 placeholder-surface-200/30 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="p-3.5 border-b border-surface-800">
            <span className="text-sm font-medium text-surface-50">
              {exerciseType === 'summary' ? '📝 Viết tóm tắt' :
               exerciseType === 'opinion' ? '💭 Viết ý kiến' :
               '📄 Viết bài luận'}
            </span>
          </div>
          <div className="p-4">
            <textarea
              value={answers[0] || ''}
              onChange={(e) => setAnswer(0, e.target.value)}
              placeholder="Viết câu trả lời của bạn tại đây..."
              className="w-full min-h-[180px] bg-transparent text-sm text-surface-200/80 placeholder-surface-200/30 resize-y outline-none leading-relaxed"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={evaluating || answers.every(a => !a.trim())}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {evaluating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang chấm bài...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" /> Nộp bài
          </>
        )}
      </button>
    </div>
  )
}
