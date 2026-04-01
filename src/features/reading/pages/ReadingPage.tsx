import { ArrowLeft, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useReadingStore } from '../stores/readingStore'
import { ReadingConfig } from '../components/ReadingConfig'
import { LevelReading } from '../components/LevelReading'
import { ReadingQuestions } from '../components/ReadingQuestions'
import { ReadingResult } from '../components/ReadingResult'
import { ReadingAloud } from '../components/ReadingAloud'
import { ReadingAloudResult } from '../components/ReadingAloudResult'

export function ReadingPage() {
  const navigate = useNavigate()
  const { phase, mode, resetToConfig } = useReadingStore()

  const renderContent = () => {
    if (phase === 'config') return <ReadingConfig />

    if (phase === 'reading') {
      if (mode === 'reading_aloud') return <ReadingAloud />
      return <LevelReading />
    }

    if (phase === 'questions') return <ReadingQuestions />

    if (phase === 'result') {
      if (mode === 'reading_aloud') return <ReadingAloudResult />
      return <ReadingResult />
    }

    return <ReadingConfig />
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (phase === 'config') navigate('/')
            else resetToConfig()
          }}
          className="p-2 rounded-lg hover:bg-surface-800/50 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-surface-200/60" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold gradient-text">Luyện đọc</h1>
        </div>
      </div>

      {renderContent()}
    </div>
  )
}
