import { useEffect, useState } from 'react'
import {
  PenTool,
  SpellCheck,
  ShieldCheck,
  RefreshCw,
  Lock,
} from 'lucide-react'
import { useWritingToolsStore } from '../stores/writingToolsStore'
import { GrammarChecker } from '../components/GrammarChecker'
import { PlagiarismChecker } from '../components/PlagiarismChecker'
import { Paraphraser } from '../components/Paraphraser'

type Tab = 'grammar' | 'paraphrase' | 'plagiarism'

export function WritingToolsPage() {
  const { fetchUsageStatus, usageStatus } = useWritingToolsStore()
  const [activeTab, setActiveTab] = useState<Tab>('grammar')

  useEffect(() => {
    fetchUsageStatus()
  }, [fetchUsageStatus])

  const tabs = [
    {
      id: 'grammar' as Tab,
      label: 'Grammar Checker',
      shortLabel: 'Grammar',
      icon: SpellCheck,
      remaining: usageStatus?.grammar.remainingChecks,
      max: usageStatus?.grammar.maxChecks,
      locked: false,
    },
    {
      id: 'paraphrase' as Tab,
      label: 'Paraphraser',
      shortLabel: 'Paraphrase',
      icon: RefreshCw,
      remaining: usageStatus?.paraphrase?.remainingChecks,
      max: usageStatus?.paraphrase?.maxChecks,
      locked: false,
    },
    {
      id: 'plagiarism' as Tab,
      label: 'Plagiarism Checker',
      shortLabel: 'Plagiarism',
      icon: ShieldCheck,
      remaining: undefined,
      max: undefined,
      locked: true,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <PenTool className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Công cụ viết</h1>
            <p className="text-xs text-surface-200/40">
              Kiểm tra ngữ pháp · Viết lại văn bản · Kiểm tra đạo văn
            </p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="glass-card p-1.5 flex gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const isLocked = tab.locked
          return (
            <button
              key={tab.id}
              onClick={() => !isLocked && setActiveTab(tab.id)}
              disabled={isLocked}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                text-sm font-medium transition-all duration-200
                ${isLocked
                  ? 'text-surface-200/25 cursor-not-allowed'
                  : isActive
                    ? 'gradient-bg text-white shadow-lg'
                    : 'text-surface-200/60 hover:text-surface-50 hover:bg-surface-800/40'
                }
              `}
            >
              {isLocked ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <tab.icon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {isLocked ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-800/50 text-surface-200/30 font-semibold">
                  Sắp ra mắt
                </span>
              ) : tab.remaining !== undefined && (
                <span className={`
                  text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : tab.remaining > 0
                      ? 'bg-surface-800 text-surface-200/60'
                      : 'bg-red-500/20 text-red-400'
                  }
                `}>
                  {tab.remaining}/{tab.max}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'grammar' && <GrammarChecker />}
        {activeTab === 'paraphrase' && <Paraphraser />}
        {activeTab === 'plagiarism' && !tabs.find(t => t.id === 'plagiarism')?.locked && <PlagiarismChecker />}
      </div>
    </div>
  )
}
