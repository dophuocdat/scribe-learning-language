import { Headphones, ArrowLeft } from 'lucide-react'
import { useListeningPracticeStore } from '../stores/listeningPracticeStore'
import { ExerciseConfig } from '../components/ExerciseConfig'
import { DictationExercise } from '../components/DictationExercise'
import { DictationResult } from '../components/DictationResult'
import { ComprehensionExercise } from '../components/ComprehensionExercise'
import { ComprehensionResult } from '../components/ComprehensionResult'

export function ListeningPracticePage() {
  const { phase, mode, level, exerciseType, reset } = useListeningPracticeStore()

  const getSubtitle = () => {
    if (phase === 'config') return 'Cấu hình bài tập'
    const modeLabel = mode === 'dictation' ? 'Dictation' : 'Comprehension'
    return `${modeLabel} · ${level} · ${exerciseType.replace('_', ' ')}`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {phase !== 'config' && (
            <button
              onClick={reset}
              className="w-9 h-9 rounded-xl bg-surface-800/50 flex items-center justify-center text-surface-200/50 hover:text-surface-50 hover:bg-surface-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Luyện nghe & viết</h1>
            <p className="text-xs text-surface-200/40">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Phase Content */}
      <div className="max-w-3xl mx-auto">
        {phase === 'config' && <ExerciseConfig />}

        {phase === 'exercise' && mode === 'dictation' && <DictationExercise />}
        {phase === 'exercise' && mode === 'comprehension' && <ComprehensionExercise />}

        {phase === 'result' && mode === 'dictation' && <DictationResult />}
        {phase === 'result' && mode === 'comprehension' && <ComprehensionResult />}
      </div>
    </div>
  )
}
