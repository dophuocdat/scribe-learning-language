import { Headphones, ArrowLeft } from 'lucide-react'
import { useListeningStore } from '../stores/listeningStore'
import { ListeningConfig } from '../components/ListeningConfig'
import { DictationExercise } from '../components/DictationExercise'
import { DictationResult } from '../components/DictationResult'
import { FillBlankExercise } from '../components/FillBlankExercise'
import { FillBlankResult } from '../components/FillBlankResult'
import { DialogueExercise } from '../components/DialogueExercise'
import { DialogueResult } from '../components/DialogueResult'

const MODE_LABELS: Record<string, string> = {
  dictation: 'Nghe chép',
  fill_blank: 'Điền từ',
  dialogue: 'Hội thoại',
}

export function ListeningPage() {
  const { phase, mode, level, exerciseType, reset } = useListeningStore()

  const getSubtitle = () => {
    if (phase === 'config') return 'Chọn chế độ luyện tập'
    const modeLabel = MODE_LABELS[mode] || mode
    return `${modeLabel} · ${level} · ${exerciseType.replace(/_/g, ' ')}`
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Luyện nghe</h1>
            <p className="text-xs text-surface-200/40">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Phase Content */}
      <div className="max-w-3xl mx-auto">
        {phase === 'config' && <ListeningConfig />}

        {phase === 'exercise' && mode === 'dictation' && <DictationExercise />}
        {phase === 'exercise' && mode === 'fill_blank' && <FillBlankExercise />}
        {phase === 'exercise' && mode === 'dialogue' && <DialogueExercise />}

        {phase === 'result' && mode === 'dictation' && <DictationResult />}
        {phase === 'result' && mode === 'fill_blank' && <FillBlankResult />}
        {phase === 'result' && mode === 'dialogue' && <DialogueResult />}
      </div>
    </div>
  )
}
