import { CheckCircle2, ArrowRight } from 'lucide-react'
import type { GrammarIssue } from '../stores/writingToolsStore'

interface GrammarIssueCardProps {
  issue: GrammarIssue
  index: number
  isHighlighted: boolean
  onApply: () => void
  onHover: () => void
  onLeave: () => void
}

const typeConfig: Record<GrammarIssue['type'], { label: string; color: string; bg: string; border: string }> = {
  grammar: {
    label: 'Ngữ pháp',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  spelling: {
    label: 'Chính tả',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  punctuation: {
    label: 'Dấu câu',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
  },
  style: {
    label: 'Văn phong',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  clarity: {
    label: 'Rõ ràng',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
}

export function GrammarIssueCard({
  issue,
  isHighlighted,
  onApply,
  onHover,
  onLeave,
}: GrammarIssueCardProps) {
  const config = typeConfig[issue.type]

  return (
    <div
      className={`
        glass-card p-3.5 border transition-all duration-200 cursor-pointer
        ${isHighlighted ? `${config.border} shadow-lg shadow-${config.color}/10` : 'border-transparent'}
        hover:${config.border}
      `}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Type badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
          {config.label}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onApply()
          }}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 font-medium transition-colors flex items-center gap-1"
        >
          <CheckCircle2 className="w-3 h-3" />
          Áp dụng
        </button>
      </div>

      {/* Original → Replacement */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-sm text-red-300 line-through bg-red-500/10 px-1.5 py-0.5 rounded">
          {issue.original}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-surface-200/30 mt-1 shrink-0" />
        <span className="text-sm text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
          {issue.replacement}
        </span>
      </div>

      {/* Explanation */}
      <p className="text-xs text-surface-200/50 leading-relaxed">
        💡 {issue.explanation_vi}
      </p>
    </div>
  )
}
