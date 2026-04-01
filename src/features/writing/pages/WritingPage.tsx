import { useState } from 'react'
import { PenTool, ArrowLeft, BookOpen, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWritingStore } from '../stores/writingStore'
import { WritingConfig } from '../components/WritingConfig'
import { SentenceBuilding } from '../components/SentenceBuilding'
import { SentenceBuildingResult } from '../components/SentenceBuildingResult'
import { ParaphraseExercise } from '../components/ParaphraseExercise'
import { ParaphraseResult } from '../components/ParaphraseResult'
import { EssayWriting } from '../components/EssayWriting'
import { EssayFeedback } from '../components/EssayFeedback'

// Legacy tools
import { GrammarChecker } from '../../writing-tools/components/GrammarChecker'
import { Paraphraser } from '../../writing-tools/components/Paraphraser'

type TopTab = 'practice' | 'tools'

export function WritingPage() {
  const navigate = useNavigate()
  const { phase, mode, resetToConfig } = useWritingStore()
  const [topTab, setTopTab] = useState<TopTab>('practice')
  const [toolTab, setToolTab] = useState<'grammar' | 'paraphrase'>('grammar')

  const renderPracticeContent = () => {
    if (phase === 'config') return <WritingConfig />

    if (phase === 'exercise') {
      switch (mode) {
        case 'sentence_building': return <SentenceBuilding />
        case 'paraphrase': return <ParaphraseExercise />
        case 'essay': return <EssayWriting />
      }
    }

    if (phase === 'result') {
      switch (mode) {
        case 'sentence_building': return <SentenceBuildingResult />
        case 'paraphrase': return <ParaphraseResult />
        case 'essay': return <EssayFeedback />
      }
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => phase === 'config' ? navigate('/') : resetToConfig()}
          className="p-2 -ml-2 rounded-xl text-surface-200/40 hover:text-surface-50 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center">
          <PenTool className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold gradient-text">Luyện viết</h1>
          <p className="text-[10px] text-surface-200/30">Sắp xếp câu · Viết lại câu · Viết bài</p>
        </div>
      </div>

      {/* Top tab: Practice / Tools */}
      {phase === 'config' && (
        <div className="glass-card p-1.5 flex gap-1">
          <button
            onClick={() => setTopTab('practice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
              topTab === 'practice'
                ? 'gradient-bg text-white shadow-lg'
                : 'text-surface-200/60 hover:text-surface-50 hover:bg-surface-800/40'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Luyện viết
          </button>
          <button
            onClick={() => setTopTab('tools')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
              topTab === 'tools'
                ? 'gradient-bg text-white shadow-lg'
                : 'text-surface-200/60 hover:text-surface-50 hover:bg-surface-800/40'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Công cụ
          </button>
        </div>
      )}

      {/* Content */}
      {topTab === 'practice' || phase !== 'config' ? (
        renderPracticeContent()
      ) : (
        <div className="space-y-4">
          {/* Tool tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setToolTab('grammar')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                toolTab === 'grammar' ? 'gradient-bg text-white' : 'bg-surface-800/40 text-surface-200/60 hover:text-surface-50'
              }`}
            >
              Grammar Checker
            </button>
            <button
              onClick={() => setToolTab('paraphrase')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                toolTab === 'paraphrase' ? 'gradient-bg text-white' : 'bg-surface-800/40 text-surface-200/60 hover:text-surface-50'
              }`}
            >
              Paraphraser
            </button>
          </div>

          {/* Tool content */}
          <div className="animate-fade-in">
            {toolTab === 'grammar' && <GrammarChecker />}
            {toolTab === 'paraphrase' && <Paraphraser />}
          </div>
        </div>
      )}
    </div>
  )
}
