import { useState, type ReactNode } from 'react'
import {
  SpellCheck,
  AlertCircle,
  CheckCircle2,
  Copy,
  Sparkles,
  RotateCcw,
  Wand2,
} from 'lucide-react'
import { useWritingToolsStore, type GrammarIssue } from '../stores/writingToolsStore'
import { GrammarIssueCard } from './GrammarIssueCard'

const CHAR_LIMIT = 5000

export function GrammarChecker() {
  const {
    grammarText,
    grammarResult,
    checkingGrammar,
    usageStatus,
    error,
    checkGrammar,
    applyGrammarFix,
    applyAllFixes,
    clearGrammarResult,
    clearError,
  } = useWritingToolsStore()

  const [inputText, setInputText] = useState(grammarText)
  const [copiedText, setCopiedText] = useState(false)
  const [highlightedIssue, setHighlightedIssue] = useState<number | null>(null)

  const remaining = usageStatus?.grammar.remainingChecks ?? null
  const isDisabled = remaining !== null && remaining <= 0

  const handleCheck = async () => {
    if (!inputText.trim() || isDisabled) return
    clearError()
    await checkGrammar(inputText)
  }

  const handleCopy = async () => {
    const text = grammarResult ? grammarText : inputText
    await navigator.clipboard.writeText(text)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const handleReset = () => {
    setInputText('')
    clearGrammarResult()
    clearError()
  }

  const handleApplyFix = (index: number) => {
    applyGrammarFix(index)
    setInputText(useWritingToolsStore.getState().grammarText)
  }

  const handleApplyAll = () => {
    applyAllFixes()
    setInputText(useWritingToolsStore.getState().grammarText)
  }

  // Build highlighted text with issues marked
  const renderHighlightedText = () => {
    if (!grammarResult || grammarResult.issues.length === 0) {
      return <span>{grammarText || inputText}</span>
    }

    const text = grammarText
    const sorted = [...grammarResult.issues].sort((a, b) => a.position.start - b.position.start)
    const parts: ReactNode[] = []
    let lastEnd = 0

    sorted.forEach((issue, idx) => {
      // Text before issue
      if (issue.position.start > lastEnd) {
        parts.push(
          <span key={`t-${idx}`}>{text.substring(lastEnd, issue.position.start)}</span>
        )
      }

      const colorMap: Record<GrammarIssue['type'], string> = {
        grammar: 'bg-red-500/20 border-b-2 border-red-400',
        spelling: 'bg-orange-500/20 border-b-2 border-orange-400',
        punctuation: 'bg-yellow-500/20 border-b-2 border-yellow-400',
        style: 'bg-blue-500/20 border-b-2 border-blue-400',
        clarity: 'bg-purple-500/20 border-b-2 border-purple-400',
      }

      const isHighlighted = highlightedIssue === idx

      parts.push(
        <span
          key={`i-${idx}`}
          className={`${colorMap[issue.type]} ${isHighlighted ? 'ring-2 ring-white/50 rounded' : ''} cursor-pointer transition-all`}
          title={issue.explanation_vi}
          onMouseEnter={() => setHighlightedIssue(idx)}
          onMouseLeave={() => setHighlightedIssue(null)}
        >
          {text.substring(issue.position.start, issue.position.end)}
        </span>
      )

      lastEnd = issue.position.end
    })

    // Remaining text
    if (lastEnd < text.length) {
      parts.push(<span key="t-end">{text.substring(lastEnd)}</span>)
    }

    return <>{parts}</>
  }

  // Issue count by type
  const issueCounts = grammarResult?.issues.reduce((acc, iss) => {
    acc[iss.type] = (acc[iss.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Text Input */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SpellCheck className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-medium text-surface-50">
              {grammarResult ? 'Kết quả phân tích' : 'Nhập văn bản tiếng Anh'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${inputText.length > CHAR_LIMIT ? 'text-red-400' : 'text-surface-200/40'}`}>
              {(grammarResult ? grammarText : inputText).length}/{CHAR_LIMIT}
            </span>
            {(grammarResult || inputText) && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg hover:bg-surface-800/60 text-surface-200/50 hover:text-surface-50 transition-all"
                title="Copy text"
              >
                {copiedText ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="p-4">
          {grammarResult ? (
            <div className="text-sm text-surface-200/80 leading-relaxed whitespace-pre-wrap min-h-[150px]">
              {renderHighlightedText()}
            </div>
          ) : (
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste hoặc nhập đoạn văn tiếng Anh cần kiểm tra ngữ pháp tại đây..."
              className="w-full min-h-[200px] bg-transparent text-sm text-surface-200/80 placeholder-surface-200/30 resize-y outline-none leading-relaxed"
              maxLength={CHAR_LIMIT}
            />
          )}
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
      {!grammarResult && (
        <button
          onClick={handleCheck}
          disabled={checkingGrammar || !inputText.trim() || inputText.length > CHAR_LIMIT || isDisabled}
          className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
        >
          {checkingGrammar ? (
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
              Kiểm tra ngữ pháp
            </>
          )}
        </button>
      )}

      {/* Loading State */}
      {checkingGrammar && (
        <div className="glass-card p-5 text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 animate-spin" />
            <SpellCheck className="absolute inset-0 m-auto w-6 h-6 text-primary-400 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-surface-50 mb-1">Đang phân tích ngữ pháp</p>
          <p className="text-xs text-surface-200/40">
            AI đang kiểm tra grammar, spelling, punctuation, style và clarity...
          </p>
        </div>
      )}

      {/* Results */}
      {grammarResult && !checkingGrammar && (
        <>
          {/* Quality Score */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-surface-50">Điểm chất lượng</h3>
              <span className={`text-2xl font-bold ${
                grammarResult.quality_score >= 80 ? 'text-emerald-400' :
                grammarResult.quality_score >= 60 ? 'text-yellow-400' :
                grammarResult.quality_score >= 40 ? 'text-orange-400' : 'text-red-400'
              }`}>
                {grammarResult.quality_score}/100
              </span>
            </div>

            {/* Score bar */}
            <div className="w-full h-2.5 bg-surface-800 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  grammarResult.quality_score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                  grammarResult.quality_score >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                  grammarResult.quality_score >= 40 ? 'bg-gradient-to-r from-orange-500 to-orange-400' : 'bg-gradient-to-r from-red-500 to-red-400'
                }`}
                style={{ width: `${grammarResult.quality_score}%` }}
              />
            </div>

            {/* Summary */}
            <p className="text-xs text-surface-200/60 leading-relaxed">{grammarResult.summary_vi}</p>
          </div>

          {/* Issue Stats */}
          {issueCounts && Object.keys(issueCounts).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.entries(issueCounts).map(([type, count]) => {
                const colorMap: Record<string, string> = {
                  grammar: 'text-red-400 bg-red-500/10',
                  spelling: 'text-orange-400 bg-orange-500/10',
                  punctuation: 'text-yellow-400 bg-yellow-500/10',
                  style: 'text-blue-400 bg-blue-500/10',
                  clarity: 'text-purple-400 bg-purple-500/10',
                }
                const labelMap: Record<string, string> = {
                  grammar: 'Ngữ pháp',
                  spelling: 'Chính tả',
                  punctuation: 'Dấu câu',
                  style: 'Văn phong',
                  clarity: 'Rõ ràng',
                }
                return (
                  <div key={type} className={`${colorMap[type]} rounded-xl p-2.5 text-center`}>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-[10px] opacity-70">{labelMap[type]}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Issues List */}
          {grammarResult.issues.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-surface-50">
                  Các lỗi ({grammarResult.issues.length})
                </h3>
                <button
                  onClick={handleApplyAll}
                  className="text-xs px-3 py-1.5 rounded-lg gradient-bg text-white font-medium hover:opacity-90 transition-all flex items-center gap-1.5"
                >
                  <Wand2 className="w-3 h-3" />
                  Sửa tất cả
                </button>
              </div>
              {grammarResult.issues.map((issue, idx) => (
                <GrammarIssueCard
                  key={idx}
                  issue={issue}
                  index={idx}
                  isHighlighted={highlightedIssue === idx}
                  onApply={() => handleApplyFix(idx)}
                  onHover={() => setHighlightedIssue(idx)}
                  onLeave={() => setHighlightedIssue(null)}
                />
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-surface-50 mb-1">Hoàn hảo!</p>
              <p className="text-xs text-surface-200/40">Không tìm thấy lỗi nào trong văn bản.</p>
            </div>
          )}

          {/* Reset Button */}
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
