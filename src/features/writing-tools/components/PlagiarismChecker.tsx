import { useState } from 'react'
import {
  ShieldCheck,
  AlertCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { useWritingToolsStore } from '../stores/writingToolsStore'
import { PlagiarismReport } from './PlagiarismReport'

const CHAR_LIMIT = 10000

export function PlagiarismChecker() {
  const {
    plagiarismText,
    plagiarismResult,
    checkingPlagiarism,
    usageStatus,
    error,
    setPlagiarismText,
    checkPlagiarism,
    clearPlagiarismResult,
    clearError,
  } = useWritingToolsStore()

  const [inputText, setInputText] = useState(plagiarismText)

  const remaining = usageStatus?.plagiarism.remainingChecks ?? null
  const isDisabled = remaining !== null && remaining <= 0

  const handleCheck = async () => {
    if (!inputText.trim() || isDisabled) return
    clearError()
    setPlagiarismText(inputText)
    await checkPlagiarism(inputText)
  }

  const handleReset = () => {
    setInputText('')
    clearPlagiarismResult()
    clearError()
  }

  return (
    <div className="space-y-4">
      {/* Text Input */}
      {!plagiarismResult && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-surface-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-surface-50">
                Nhập văn bản cần kiểm tra
              </span>
            </div>
            <span className={`text-xs ${inputText.length > CHAR_LIMIT ? 'text-red-400' : 'text-surface-200/40'}`}>
              {inputText.length}/{CHAR_LIMIT}
            </span>
          </div>

          <div className="p-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste hoặc nhập đoạn văn tiếng Anh cần kiểm tra đạo văn tại đây..."
              className="w-full min-h-[250px] bg-transparent text-sm text-surface-200/80 placeholder-surface-200/30 resize-y outline-none leading-relaxed"
              maxLength={CHAR_LIMIT}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Check Button */}
      {!plagiarismResult && (
        <button
          onClick={handleCheck}
          disabled={checkingPlagiarism || !inputText.trim() || inputText.length > CHAR_LIMIT || isDisabled}
          className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
        >
          {checkingPlagiarism ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              AI đang phân tích...
            </>
          ) : isDisabled ? (
            <>
              <AlertCircle className="w-4 h-4" />
              Đã hết lượt kiểm tra hôm nay
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Kiểm tra đạo văn
            </>
          )}
        </button>
      )}

      {/* Loading State */}
      {checkingPlagiarism && (
        <div className="glass-card p-5 text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin" />
            <ShieldCheck className="absolute inset-0 m-auto w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-surface-50 mb-1">Đang kiểm tra đạo văn</p>
          <p className="text-xs text-surface-200/40">
            AI đang phân tích tính nguyên gốc, kiểm tra copy pattern và so sánh nội bộ...
          </p>
        </div>
      )}

      {/* Results */}
      {plagiarismResult && !checkingPlagiarism && (
        <>
          <PlagiarismReport
            result={plagiarismResult}
            originalText={plagiarismText}
          />

          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl border border-surface-700 text-surface-200/70 hover:text-surface-50 hover:border-surface-600 font-medium flex items-center justify-center gap-2 transition-all text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Kiểm tra văn bản mới
          </button>
        </>
      )}
    </div>
  )
}
