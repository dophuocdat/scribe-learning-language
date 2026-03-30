import { useState } from 'react'
import {
  RefreshCw,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Copy,
  CheckCircle2,
  ArrowBigDown,
  ArrowBigUp,
  GraduationCap,
  Briefcase,
  Lightbulb,
  Zap,
  Type,
} from 'lucide-react'
import {
  useWritingToolsStore,
  type ParaphraseMode,
} from '../stores/writingToolsStore'

const CHAR_LIMIT = 5000

const MODES: { id: ParaphraseMode; label: string; desc: string; icon: typeof Type }[] = [
  { id: 'standard', label: 'Chuẩn', desc: 'Viết lại tự nhiên', icon: Type },
  { id: 'formal', label: 'Trang trọng', desc: 'Văn phong chuyên nghiệp', icon: Briefcase },
  { id: 'simple', label: 'Đơn giản', desc: 'Dễ hiểu, A2-B1', icon: Lightbulb },
  { id: 'creative', label: 'Sáng tạo', desc: 'Sinh động, cuốn hút', icon: Sparkles },
  { id: 'academic', label: 'Học thuật', desc: 'Phong cách nghiên cứu', icon: GraduationCap },
  { id: 'shorten', label: 'Rút gọn', desc: 'Ngắn gọn hơn', icon: ArrowBigDown },
  { id: 'expand', label: 'Mở rộng', desc: 'Chi tiết hơn', icon: ArrowBigUp },
]

export function Paraphraser() {
  const {
    paraphraseResult,
    paraphrasing,
    paraphraseMode,
    usageStatus,
    error,
    setParaphraseMode,
    paraphrase,
    clearParaphraseResult,
    clearError,
  } = useWritingToolsStore()

  const [inputText, setInputText] = useState('')
  const [copiedText, setCopiedText] = useState(false)

  const remaining = usageStatus?.paraphrase?.remainingChecks ?? null
  const isDisabled = remaining !== null && remaining <= 0

  const handleParaphrase = async () => {
    if (!inputText.trim() || isDisabled) return
    clearError()
    await paraphrase(inputText, paraphraseMode)
  }

  const handleCopy = async () => {
    const text = paraphraseResult?.paraphrased_text || inputText
    await navigator.clipboard.writeText(text)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const handleReset = () => {
    setInputText('')
    clearParaphraseResult()
    clearError()
  }

  const handleReparaphrase = async () => {
    if (!inputText.trim()) return
    clearError()
    clearParaphraseResult()
    await paraphrase(inputText, paraphraseMode)
  }

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="glass-card p-3">
        <p className="text-xs text-surface-200/40 mb-2.5 font-medium">Chế độ viết lại</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {MODES.map((mode) => {
            const isActive = paraphraseMode === mode.id
            const Icon = mode.icon
            return (
              <button
                key={mode.id}
                onClick={() => setParaphraseMode(mode.id)}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all
                  ${isActive
                    ? 'gradient-bg text-white shadow-lg'
                    : 'text-surface-200/50 hover:text-surface-50 hover:bg-surface-800/40'
                  }
                `}
                title={mode.desc}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium leading-tight">{mode.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Input / Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input */}
        <div className="glass-card overflow-hidden">
          <div className="p-3.5 border-b border-surface-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-medium text-surface-50">Văn bản gốc</span>
            </div>
            <span className={`text-xs ${inputText.length > CHAR_LIMIT ? 'text-red-400' : 'text-surface-200/40'}`}>
              {inputText.length}/{CHAR_LIMIT}
            </span>
          </div>
          <div className="p-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập hoặc paste đoạn văn tiếng Anh cần viết lại tại đây..."
              className="w-full min-h-[220px] bg-transparent text-sm text-surface-200/80 placeholder-surface-200/30 resize-y outline-none leading-relaxed"
              maxLength={CHAR_LIMIT}
            />
          </div>
        </div>

        {/* Output */}
        <div className="glass-card overflow-hidden">
          <div className="p-3.5 border-b border-surface-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-surface-50">Kết quả</span>
            </div>
            {paraphraseResult && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg hover:bg-surface-800/60 text-surface-200/50 hover:text-surface-50 transition-all"
                title="Copy kết quả"
              >
                {copiedText ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          <div className="p-4">
            {paraphrasing ? (
              <div className="flex flex-col items-center justify-center min-h-[220px] gap-3">
                <div className="w-12 h-12 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 animate-spin" />
                  <RefreshCw className="absolute inset-0 m-auto w-5 h-5 text-primary-400 animate-pulse" />
                </div>
                <p className="text-xs text-surface-200/40">AI đang viết lại...</p>
              </div>
            ) : paraphraseResult ? (
              <div className="min-h-[220px]">
                <p className="text-sm text-surface-200/80 leading-relaxed whitespace-pre-wrap mb-4">
                  {paraphraseResult.paraphrased_text}
                </p>

                {/* Stats */}
                <div className="border-t border-surface-800 pt-3 mt-auto space-y-2">
                  {/* Difference Score */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-surface-200/40 w-16 shrink-0">Khác biệt</span>
                    <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          paraphraseResult.difference_score >= 70 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                          paraphraseResult.difference_score >= 40 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                          'bg-gradient-to-r from-orange-500 to-orange-400'
                        }`}
                        style={{ width: `${paraphraseResult.difference_score}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${
                      paraphraseResult.difference_score >= 70 ? 'text-emerald-400' :
                      paraphraseResult.difference_score >= 40 ? 'text-yellow-400' : 'text-orange-400'
                    }`}>
                      {paraphraseResult.difference_score}%
                    </span>
                  </div>

                  {/* Word count */}
                  <div className="flex items-center gap-3 text-[10px] text-surface-200/40">
                    <span>Gốc: {paraphraseResult.word_count_original} từ</span>
                    <span>→</span>
                    <span>Mới: {paraphraseResult.word_count_paraphrased} từ</span>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-surface-200/50 leading-relaxed">
                    💡 {paraphraseResult.changes_summary_vi}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[220px]">
                <p className="text-xs text-surface-200/30 text-center">
                  Kết quả viết lại sẽ xuất hiện tại đây
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!paraphraseResult ? (
          <button
            onClick={handleParaphrase}
            disabled={paraphrasing || !inputText.trim() || inputText.length > CHAR_LIMIT || isDisabled}
            className="flex-1 py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
          >
            {paraphrasing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang viết lại...
              </>
            ) : isDisabled ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Đã hết lượt hôm nay
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Viết lại
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={handleReparaphrase}
              disabled={paraphrasing}
              className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Viết lại lần nữa
            </button>
            <button
              onClick={handleReset}
              className="py-3 px-5 rounded-xl border border-surface-700 text-surface-200/70 hover:text-surface-50 hover:border-surface-600 font-medium flex items-center justify-center gap-2 transition-all text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Mới
            </button>
          </>
        )}
      </div>
    </div>
  )
}
