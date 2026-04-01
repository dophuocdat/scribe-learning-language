import { RotateCcw, ArrowUpRight, BookOpen, Sparkles } from 'lucide-react'
import { useWritingStore, type EssayEvalResult } from '../stores/writingStore'

export function EssayFeedback() {
  const { evalResult, resetToConfig } = useWritingStore()
  const result = evalResult as EssayEvalResult
  if (!result) return null

  const rubrics = [
    { label: 'Task Response', score: result.task_response, color: 'from-blue-500 to-blue-400' },
    { label: 'Grammar', score: result.grammar_score, color: 'from-green-500 to-green-400' },
    { label: 'Vocabulary', score: result.vocabulary_score, color: 'from-purple-500 to-purple-400' },
    { label: 'Coherence', score: result.coherence_score, color: 'from-orange-500 to-orange-400' },
  ]

  const overallColor = result.overall_score >= 80 ? 'text-green-400' : result.overall_score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const bgColor = result.overall_score >= 80 ? 'bg-green-500/15' : result.overall_score >= 60 ? 'bg-yellow-500/15' : 'bg-red-500/15'

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Overall score */}
      <div className="glass-card p-6 text-center">
        <div className={`w-24 h-24 rounded-full mx-auto flex flex-col items-center justify-center ${bgColor} mb-3`}>
          <span className={`text-3xl font-bold ${overallColor}`}>{result.overall_score}</span>
          <span className="text-[9px] text-surface-200/40">/100</span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xs font-bold text-surface-50">Band: {result.band_estimate}</span>
          {result.xp_earned > 0 && (
            <span className="text-xs text-yellow-400">+{result.xp_earned} XP</span>
          )}
        </div>
        {result.word_count && (
          <p className="text-[10px] text-surface-200/30">{result.word_count} từ</p>
        )}
      </div>

      {/* Rubric scores */}
      <div className="glass-card p-4 space-y-3">
        {rubrics.map(r => (
          <div key={r.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-surface-200/50">{r.label}</span>
              <span className="text-xs font-bold text-surface-100">{r.score}/100</span>
            </div>
            <div className="h-2 bg-surface-800/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${r.color} transition-all duration-700`}
                style={{ width: `${r.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-100 leading-relaxed">{result.feedback_vi}</p>
      </div>

      {/* Structure feedback */}
      {result.structure_feedback_vi && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-primary-300" />
            <p className="text-[10px] text-surface-200/30">Cấu trúc bài viết</p>
          </div>
          <p className="text-xs text-surface-200/70">{result.structure_feedback_vi}</p>
        </div>
      )}

      {/* Corrections */}
      {result.corrections?.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
            <p className="text-[10px] text-surface-200/30">Sửa lỗi ({result.corrections.length})</p>
          </div>
          <div className="space-y-2.5">
            {result.corrections.map((c, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-surface-800/30 border border-surface-700/20">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-xs text-red-300 line-through shrink-0">{c.original}</span>
                  <span className="text-xs text-surface-200/30">→</span>
                  <span className="text-xs text-green-300 shrink-0">{c.corrected}</span>
                </div>
                <p className="text-[10px] text-surface-200/50">{c.explanation_vi}</p>
                <span className="text-[8px] bg-surface-800/50 text-surface-200/30 px-1 py-0.5 rounded mt-1 inline-block">{c.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Better vocabulary */}
      {result.better_vocab?.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-[10px] text-surface-200/30">Từ vựng nâng cao</p>
          </div>
          <div className="space-y-2">
            {result.better_vocab.map((v, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-surface-200/50">{v.original_word}</span>
                  <span className="text-xs text-surface-200/30">→</span>
                  <span className="text-xs text-purple-300 font-semibold">{v.better_word}</span>
                </div>
                <p className="text-[10px] text-surface-200/40 italic">"{v.context}"</p>
                <p className="text-[10px] text-surface-200/50 mt-0.5">{v.explanation_vi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back */}
      <button
        onClick={resetToConfig}
        className="w-full py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
      >
        <RotateCcw className="w-4 h-4" /> Luyện tiếp
      </button>
    </div>
  )
}
