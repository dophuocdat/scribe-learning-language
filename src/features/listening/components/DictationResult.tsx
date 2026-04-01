import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, ArrowRight, Star, Link2 } from 'lucide-react'
import { useListeningStore, type DictationContent, type DictationResult as DictationResultType } from '../stores/listeningStore'

export function DictationResult() {
  const { result, content, batchItems, currentBatchIndex, reset, advanceToNext, generateExercise } =
    useListeningStore()

  const dictResult = result as DictationResultType
  if (!dictResult) return null

  const dictContent = content as DictationContent
  const { accuracy, total_words, correct_words, word_comparison, feedback_vi, score, xp_earned, linking_rules_vi } = dictResult

  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const scoreBg = score >= 80 ? 'from-emerald-500/20' : score >= 60 ? 'from-yellow-500/20' : 'from-red-500/20'
  const hasMore = currentBatchIndex < batchItems.length - 1

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
              i <= currentBatchIndex ? 'gradient-bg' : 'bg-surface-800/50'
            }`}
          />
        ))}
        <span className="text-[10px] text-surface-200/30 ml-1">{currentBatchIndex + 1}/{batchItems.length}</span>
      </div>

      {/* Score Card */}
      <div className={`glass-card p-6 text-center bg-gradient-to-br ${scoreBg} to-transparent`}>
        <div className={`text-5xl font-black ${scoreColor} mb-1`}>{Math.round(accuracy)}%</div>
        <p className="text-xs text-surface-200/40">Độ chính xác</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-surface-200/50">
          <span>✅ {correct_words}/{total_words} từ đúng</span>
          <span>📊 Điểm: {score}/100</span>
          <span className="flex items-center gap-1 text-yellow-400">
            <Star className="w-3 h-3" /> +{xp_earned} XP
          </span>
        </div>
      </div>

      {/* Word-by-word Comparison */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">So sánh từng từ</p>
        <div className="flex flex-wrap gap-1.5">
          {word_comparison.map((w, i) => {
            let bgClass = ''
            let Icon = CheckCircle2

            switch (w.status) {
              case 'correct':
                bgClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                Icon = CheckCircle2
                break
              case 'misspelled':
                bgClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                Icon = AlertTriangle
                break
              case 'missing':
                bgClass = 'bg-red-500/10 text-red-400 border-red-500/20'
                Icon = XCircle
                break
              case 'extra':
                bgClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                Icon = XCircle
                break
            }

            return (
              <div
                key={i}
                className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 ${bgClass}`}
                title={w.note_vi || w.status}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="font-mono">
                  {w.status === 'missing' ? (
                    <span className="line-through opacity-60">{w.original}</span>
                  ) : w.status === 'misspelled' ? (
                    <>
                      <span className="line-through opacity-60">{w.user}</span>
                      <span className="mx-1">→</span>
                      <span className="font-semibold">{w.original}</span>
                    </>
                  ) : (
                    w.original
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Linking Rules — NEW */}
      {linking_rules_vi && linking_rules_vi.length > 0 && (
        <div className="glass-card p-4 border border-amber-500/20">
          <p className="text-xs text-amber-400 mb-3 font-medium flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Luật nối âm (Linking Words)
          </p>
          <div className="space-y-2.5">
            {linking_rules_vi.map((rule, i) => (
              <div key={i} className="bg-amber-500/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-semibold text-amber-300">"{rule.phrase}"</span>
                  <span className="text-[10px] text-surface-200/30">→</span>
                  <span className="text-xs font-mono text-amber-400/70">nghe như "{rule.sounds_like}"</span>
                </div>
                <p className="text-[11px] text-surface-200/50 leading-relaxed">{rule.explanation_vi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Original Text + Translation */}
      {dictContent && (
        <div className="glass-card p-4 space-y-2">
          <p className="text-xs text-surface-200/40 font-medium">Bản gốc</p>
          <p className="text-sm text-surface-50 leading-relaxed">{dictContent.text}</p>
          <p className="text-xs text-surface-200/40 italic">{dictContent.translation_vi}</p>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-2 font-medium">💡 Nhận xét</p>
        <p className="text-sm text-surface-200/70 leading-relaxed">{feedback_vi}</p>
      </div>

      {/* Key Vocabulary */}
      {dictContent?.key_vocabulary && dictContent.key_vocabulary.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/40 mb-2 font-medium">📖 Từ vựng quan trọng</p>
          <div className="space-y-1.5">
            {dictContent.key_vocabulary.map((v, i) => (
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
