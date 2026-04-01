import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Star } from 'lucide-react'
import { useListeningStore, type DialogueContent, type DialogueResult as DialogueResultType } from '../stores/listeningStore'

export function DialogueResult() {
  const { result, content, batchItems, currentBatchIndex, reset, advanceToNext, generateExercise } =
    useListeningStore()

  const dialogueResult = result as DialogueResultType
  if (!dialogueResult) return null

  const dialogueContent = content as DialogueContent
  const { score, answers, overall_feedback_vi, xp_earned } = dialogueResult
  const correctCount = answers.filter(a => a.is_correct).length

  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const scoreBg = score >= 80 ? 'from-emerald-500/20' : score >= 60 ? 'from-yellow-500/20' : 'from-red-500/20'
  const hasMore = currentBatchIndex < batchItems.length - 1

  const handleNext = () => {
    if (!advanceToNext()) generateExercise()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {batchItems.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= currentBatchIndex ? 'gradient-bg' : 'bg-surface-800/50'}`} />
        ))}
        <span className="text-[10px] text-surface-200/30 ml-1">{currentBatchIndex + 1}/{batchItems.length}</span>
      </div>

      {/* Score Card */}
      <div className={`glass-card p-6 text-center bg-gradient-to-br ${scoreBg} to-transparent`}>
        <div className={`text-5xl font-black ${scoreColor} mb-1`}>{correctCount}/{answers.length}</div>
        <p className="text-xs text-surface-200/40">câu đúng</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-surface-200/50">
          <span>📊 Điểm: {score}/100</span>
          <span className="flex items-center gap-1 text-yellow-400">
            <Star className="w-3 h-3" /> +{xp_earned} XP
          </span>
        </div>
      </div>

      {/* Answers */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">Chi tiết câu trả lời</p>
        <div className="space-y-2.5">
          {answers.map((a, i) => {
            const question = dialogueContent?.questions?.[a.question_index]
            return (
              <div key={i} className={`p-3 rounded-xl border ${
                a.is_correct
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="flex items-start gap-2 mb-1.5">
                  {a.is_correct ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-surface-50">{question?.question}</p>
                    <p className="text-[10px] text-surface-200/30 mt-0.5">{question?.question_vi}</p>
                  </div>
                </div>

                <div className="ml-6 mt-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-surface-200/40">Bạn:</span>
                    <span className={a.is_correct ? 'text-emerald-400' : 'text-red-400'}>{a.user_answer}</span>
                  </div>
                  {!a.is_correct && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-surface-200/40">Đáp án:</span>
                      <span className="text-emerald-400 font-semibold">{a.correct_answer}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-surface-200/50 mt-1">{a.feedback_vi}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dialogue transcript */}
      {dialogueContent && (
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/40 mb-3 font-medium">💬 Đoạn hội thoại</p>
          <div className="space-y-1.5">
            {dialogueContent.dialogue.map((line, i) => (
              <div key={i} className="flex gap-3">
                <span className={`text-[10px] font-bold shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  line.speaker === 'A' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                }`}>
                  {line.speaker}
                </span>
                <p className="text-xs text-surface-200/70">{line.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-2 font-medium">💡 Nhận xét</p>
        <p className="text-sm text-surface-200/70 leading-relaxed">{overall_feedback_vi}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleNext}
          className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
        >
          <ArrowRight className="w-4 h-4" />
          {hasMore ? `Bài tiếp (${currentBatchIndex + 2}/${batchItems.length})` : 'Tạo thêm bài mới'}
        </button>
        <button
          onClick={reset}
          className="py-3 px-5 rounded-xl border border-surface-700 text-surface-200/70 hover:text-surface-50 hover:border-surface-600 font-medium flex items-center justify-center gap-2 transition-all text-sm"
        >
          <RotateCcw className="w-4 h-4" /> Chọn lại
        </button>
      </div>
    </div>
  )
}
