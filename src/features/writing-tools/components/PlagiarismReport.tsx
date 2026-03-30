import { useState, type ReactNode } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  BookOpen,
  Bot,
  FileText,
  Copy,
  CheckCircle2,
} from 'lucide-react'
import type { PlagiarismResult, PlagiarismFlag } from '../stores/writingToolsStore'

interface PlagiarismReportProps {
  result: PlagiarismResult
  originalText: string
}

const flagConfig: Record<PlagiarismFlag['type'], { label: string; icon: typeof ShieldAlert; color: string; bg: string }> = {
  likely_copied: {
    label: 'Có thể sao chép',
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  needs_citation: {
    label: 'Cần trích dẫn',
    icon: BookOpen,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  paraphrased: {
    label: 'Paraphrase',
    icon: FileText,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  ai_generated: {
    label: 'AI tạo',
    icon: Bot,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
}

export function PlagiarismReport({ result, originalText }: PlagiarismReportProps) {
  const [copiedReport, setCopiedReport] = useState(false)

  const scoreColor = result.originality_score >= 80
    ? 'text-emerald-400'
    : result.originality_score >= 60
    ? 'text-yellow-400'
    : result.originality_score >= 40
    ? 'text-orange-400'
    : 'text-red-400'

  const scoreGradient = result.originality_score >= 80
    ? 'from-emerald-500 to-emerald-400'
    : result.originality_score >= 60
    ? 'from-yellow-500 to-yellow-400'
    : result.originality_score >= 40
    ? 'from-orange-500 to-orange-400'
    : 'from-red-500 to-red-400'

  // Render highlighted text
  const renderHighlightedText = () => {
    if (!result.flags.length) return <span>{originalText}</span>

    const sorted = [...result.flags].sort((a, b) => a.position.start - b.position.start)
    const parts: ReactNode[] = []
    let lastEnd = 0

    sorted.forEach((flag, idx) => {
      if (flag.position.start > lastEnd) {
        parts.push(
          <span key={`t-${idx}`}>{originalText.substring(lastEnd, flag.position.start)}</span>
        )
      }

      const highlightColors: Record<string, string> = {
        likely_copied: 'bg-red-500/20 border-b-2 border-red-400',
        needs_citation: 'bg-yellow-500/20 border-b-2 border-yellow-400',
        paraphrased: 'bg-orange-500/20 border-b-2 border-orange-400',
        ai_generated: 'bg-purple-500/20 border-b-2 border-purple-400',
      }

      parts.push(
        <span
          key={`f-${idx}`}
          className={`${highlightColors[flag.type]} cursor-help`}
          title={flag.suggestion_vi}
        >
          {originalText.substring(flag.position.start, flag.position.end)}
        </span>
      )

      lastEnd = flag.position.end
    })

    if (lastEnd < originalText.length) {
      parts.push(<span key="t-end">{originalText.substring(lastEnd)}</span>)
    }

    return <>{parts}</>
  }

  // Copy report as text
  const handleCopyReport = async () => {
    const report = [
      `=== BÁO CÁO KIỂM TRA ĐẠO VĂN ===`,
      `Điểm nguyên gốc: ${result.originality_score}/100`,
      `Tổng quan: ${result.summary_vi}`,
      '',
      ...(result.flags.length > 0
        ? [
            `--- Các đoạn bị đánh dấu (${result.flags.length}) ---`,
            ...result.flags.map((f, i) => [
              `${i + 1}. [${flagConfig[f.type].label}] (${Math.round(f.confidence * 100)}%)`,
              `   Đoạn: "${f.text.substring(0, 100)}${f.text.length > 100 ? '...' : ''}"`,
              `   Gợi ý: ${f.suggestion_vi}`,
            ].join('\n')),
          ]
        : ['Không phát hiện vấn đề nào.']),
    ].join('\n')

    await navigator.clipboard.writeText(report)
    setCopiedReport(true)
    setTimeout(() => setCopiedReport(false), 2000)
  }

  // Count flags by type
  const flagCounts = result.flags.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Originality Score */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 ${scoreColor}`} />
            <h3 className="text-sm font-medium text-surface-50">Điểm nguyên gốc</h3>
          </div>
          <button
            onClick={handleCopyReport}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-surface-700 text-surface-200/60 hover:text-surface-50 hover:border-surface-600 transition-all flex items-center gap-1"
          >
            {copiedReport ? (
              <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Đã copy</>
            ) : (
              <><Copy className="w-3 h-3" /> Xuất báo cáo</>
            )}
          </button>
        </div>

        {/* Circular score */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-surface-800"
              />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${result.originality_score * 2.64} 264`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" className={scoreColor} stopColor="currentColor" />
                  <stop offset="100%" className={scoreColor} stopColor="currentColor" stopOpacity="0.6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${scoreColor}`}>{result.originality_score}%</span>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-xs text-surface-200/60 leading-relaxed mb-3">{result.summary_vi}</p>

            {/* Score bar (linear) */}
            <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${scoreGradient}`}
                style={{ width: `${result.originality_score}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Flag Stats */}
      {Object.keys(flagCounts).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(flagCounts).map(([type, count]) => {
            const config = flagConfig[type as PlagiarismFlag['type']]
            if (!config) return null
            const Icon = config.icon
            return (
              <div key={type} className={`${config.bg} rounded-xl p-3 flex items-center gap-2`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
                <div>
                  <p className={`text-sm font-bold ${config.color}`}>{count}</p>
                  <p className="text-[10px] text-surface-200/40">{config.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Highlighted Text */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-surface-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-surface-50">Văn bản phân tích</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-surface-200/80 leading-relaxed whitespace-pre-wrap">
            {renderHighlightedText()}
          </p>
        </div>
      </div>

      {/* Flagged Passages Detail */}
      {result.flags.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-surface-50">
            Các đoạn bị đánh dấu ({result.flags.length})
          </h3>
          {result.flags.map((flag, idx) => {
            const config = flagConfig[flag.type]
            const Icon = config.icon

            return (
              <div key={idx} className={`glass-card p-3.5 border border-transparent hover:${config.bg.replace('/10', '/20')} transition-all`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-surface-200/40">
                    {Math.round(flag.confidence * 100)}% chắc chắn
                  </span>
                </div>

                <p className={`text-sm ${config.bg} ${config.color} px-2 py-1.5 rounded-lg mb-2 leading-relaxed`}>
                  "{flag.text.length > 200 ? flag.text.substring(0, 200) + '...' : flag.text}"
                </p>

                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-surface-200/40 mt-0.5 shrink-0" />
                  <p className="text-xs text-surface-200/50 leading-relaxed">
                    {flag.suggestion_vi}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No issues */}
      {result.flags.length === 0 && (
        <div className="glass-card p-6 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-surface-50 mb-1">Nguyên gốc!</p>
          <p className="text-xs text-surface-200/40">Không phát hiện vấn đề đạo văn nào trong văn bản.</p>
        </div>
      )}
    </div>
  )
}
