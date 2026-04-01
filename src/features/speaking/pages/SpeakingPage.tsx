import { ArrowLeft, Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSpeakingStore } from '../stores/speakingStore'
import { SpeakingConfig } from '../components/SpeakingConfig'
import { PronunciationExercise } from '../components/PronunciationExercise'
import { PronunciationResult } from '../components/PronunciationResult'
import { ShadowingExercise } from '../components/ShadowingExercise'
import { ShadowingResult } from '../components/ShadowingResult'

export function SpeakingPage() {
  const navigate = useNavigate()
  const { phase, mode, resetToConfig } = useSpeakingStore()

  const renderContent = () => {
    if (phase === 'config') {
      return <SpeakingConfig />
    }

    if (phase === 'exercise') {
      if (mode === 'pronunciation') return <PronunciationExercise />
      if (mode === 'shadowing') return <ShadowingExercise />
    }

    if (phase === 'result') {
      if (mode === 'pronunciation') return <PronunciationResult />
      if (mode === 'shadowing') return <ShadowingResult />
    }

    return <SpeakingConfig />
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (phase === 'config') {
              navigate('/')
            } else {
              resetToConfig()
            }
          }}
          className="p-2 rounded-lg hover:bg-surface-800/50 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-surface-200/60" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold gradient-text">Luyện nói</h1>
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}
