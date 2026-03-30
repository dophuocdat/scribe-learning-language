import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Star, BookOpen } from 'lucide-react'
import { useListeningPracticeStore, type ComprehensionContent } from '../stores/listeningPracticeStore'

export function ComprehensionResult() {
  const { comprehensionResult, content, batchItems, currentBatchIndex, reset, advanceToNext, generateExercise } =
    useListeningPracticeStore()
  if (!comprehensionResult) return null

  const compContent = content as ComprehensionContent
  const {
    score, answers_evaluation, grammar_issues,
    overall_feedback_vi, vocabulary_score, grammar_score, comprehension_score, xp_earned,
  } = comprehensionResult

  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const scoreBg = score >= 80 ? 'from-emerald-500/20' : score >= 60 ? 'from-yellow-500/20' : 'from-red-500/20'
  const hasMore = currentBatchIndex < batchItems.length - 1
  const progressText = `${currentBatchIndex + 1}/${batchItems.length}`

  const handleNext = () => {
    if (!advanceToNext()) {
      generateExercise()
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Batch progress */}
      <div className="flex items-center gap-2">
        {batchItems.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < currentBatchIndex + 1 ? 'gradient-bg' : i === currentBatchIndex + 1 ? 'bg-primary-500/30' : 'bg-surface-800/50'
            }`}
          />
        ))}
        <span className="text-[10px] text-surface-200/30 ml-1">{progressText}</span>
      </div>

      {/* Score Card */}
      <div className={`glass-card p-6 text-center bg-gradient-to-br ${scoreBg} to-transparent`}>
        <div className={`text-5xl font-black ${scoreColor} mb-1`}>{score}</div>
        <p className="text-xs text-surface-200/40">Điểm tổng</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <ScoreBadge label="Comprehension" value={comprehension_score} />
          <ScoreBadge label="Grammar" value={grammar_score} />
          <ScoreBadge label="Vocabulary" value={vocabulary_score} />
          <span className="flex items-center gap-1 text-xs text-yellow-400">
            <Star className="w-3 h-3" /> +{xp_earned} XP
          </span>
        </div>
      </div>

      {/* Answer Evaluations */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">Đánh giá từng câu</p>
        <div className="space-y-2.5">
          {answers_evaluation.map((ae, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border ${
                ae.is_correct
                  ? 'bg-emerald-500/5 border-emerald-500/15'
                  : 'bg-red-500/5 border-red-500/15'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {ae.is_correct ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className="text-xs font-semibold text-surface-50">Câu {ae.question_index + 1}</span>
                <span className={`text-[10px] ml-auto ${ae.score >= 70 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ae.score}/100
                </span>
              </div>
              <p className="text-xs text-surface-200/60 leading-relaxed">{ae.feedback_vi}</p>
              {ae.corrected_answer && (
                <p className="text-xs text-primary-400/80 mt-1.5">
                  ✏️ Gợi ý: <span className="italic">{ae.corrected_answer}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Grammar Issues */}
      {grammar_issues && grammar_issues.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/40 mb-3 font-medium">📝 Lỗi ngữ pháp</p>
          <div className="space-y-2">
            {grammar_issues.map((gi, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-400 line-through shrink-0">{gi.original}</span>
                <span className="text-surface-200/30">→</span>
                <span className="text-emerald-400 shrink-0">{gi.correction}</span>
                <span className="text-surface-200/40 ml-1">({gi.explanation_vi})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Answer */}
      {compContent?.sample_answer && (
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/40 mb-2 font-medium">📜 Bài mẫu</p>
          <p className="text-sm text-surface-200/70 leading-relaxed italic">{compContent.sample_answer}</p>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-2 font-medium">💡 Nhận xét</p>
        <p className="text-sm text-surface-200/70 leading-relaxed">{overall_feedback_vi}</p>
      </div>

      {/* Key Vocabulary */}
      {compContent?.key_vocabulary && compContent.key_vocabulary.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/40 mb-2 font-medium flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" /> Từ vựng quan trọng
          </p>
          <div className="space-y-1.5">
            {compContent.key_vocabulary.map((v, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-primary-400">{v.word}</span>
                {v.phonetic && <span className="text-surface-200/30">{v.phonetic}</span>}
                <span className="text-surface-200/50">— {v.meaning_vi}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleNext}
          className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
        >
          <ArrowRight className="w-4 h-4" />
          {hasMore ? `Bài tiếp theo (${currentBatchIndex + 2}/${batchItems.length})` : 'Tạo thêm bài mới'}
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

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="text-center">
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-surface-200/30">{label}</div>
    </div>
  )
}
