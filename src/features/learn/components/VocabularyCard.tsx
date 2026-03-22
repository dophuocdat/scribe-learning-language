import { useState } from 'react'
import { Volume2, Plus, Check, BookMarked, Gauge } from 'lucide-react'
import type { Vocabulary } from '@/shared/types/database'
import { useLearnStore } from '../stores/learnStore'
import { useTTS, SPEED_OPTIONS, DEFAULT_SPEED } from '@/shared/hooks/useTTS'

export function VocabularyCard({ vocab }: { vocab: Vocabulary }) {
  const { addToSrs } = useLearnStore()
  const { speakWord, isSpeaking } = useTTS()
  const [added, setAdded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)

  const handleAddToSrs = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await addToSrs(vocab.id)
    if (ok) setAdded(true)
  }

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation()
    speakWord(vocab.word, vocab.audio_url, speed)
  }

  const posColors: Record<string, string> = {
    noun: 'text-blue-400 bg-blue-500/10',
    verb: 'text-emerald-400 bg-emerald-500/10',
    adjective: 'text-amber-400 bg-amber-500/10',
    adverb: 'text-purple-400 bg-purple-500/10',
    preposition: 'text-pink-400 bg-pink-500/10',
  }

  const posClass = vocab.part_of_speech
    ? posColors[vocab.part_of_speech.toLowerCase()] || 'text-surface-200/50 bg-surface-700/50'
    : ''

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`glass-card p-4 cursor-pointer transition-all duration-300 ${
        expanded ? 'ring-1 ring-primary-500/20' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-surface-50 text-sm">{vocab.word}</h4>
            {vocab.ipa_pronunciation && (
              <span className="text-xs text-surface-200/30 font-mono">
                /{vocab.ipa_pronunciation}/
              </span>
            )}
            {/* Always show speak button */}
            <button
              onClick={handleSpeak}
              className={`p-1 rounded-lg transition-colors ${
                isSpeaking
                  ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                  : 'hover:bg-surface-700/50 text-surface-200/40 hover:text-primary-400'
              }`}
              title="Phát âm"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {vocab.part_of_speech && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${posClass}`}>
                {vocab.part_of_speech}
              </span>
            )}
            {vocab.definition_en && (
              <span className="text-xs text-surface-200/50 truncate">
                {vocab.definition_en}
              </span>
            )}
          </div>
        </div>

        {/* Add to SRS button */}
        <button
          onClick={handleAddToSrs}
          disabled={added}
          className={`shrink-0 p-2 rounded-xl transition-all ${
            added
              ? 'bg-success/10 text-success cursor-default'
              : 'bg-primary-500/10 text-primary-400 hover:bg-primary-500/20'
          }`}
          title={added ? 'Đã thêm vào ôn tập' : 'Thêm vào ôn tập SRS'}
        >
          {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded details  */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-surface-700/50 space-y-2.5 animate-fade-in">
          {/* Speed control */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Gauge className="w-3 h-3 text-surface-200/30 shrink-0" />
            <span className="text-[10px] text-surface-200/30 shrink-0">Tốc độ</span>
            <div className="flex gap-1">
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSpeed(opt.value)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    speed === opt.value
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-surface-200/30 hover:text-surface-200/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {vocab.definition_vi && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-surface-200/30 font-semibold">
                Nghĩa tiếng Việt
              </span>
              <p className="text-sm text-surface-200/70 mt-0.5">{vocab.definition_vi}</p>
            </div>
          )}
          {vocab.example_sentence && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-surface-200/30 font-semibold">
                Ví dụ
              </span>
              <p className="text-sm text-surface-200/70 mt-0.5 italic">
                "{vocab.example_sentence}"
              </p>
            </div>
          )}
          {vocab.context_note && (
            <div className="flex items-start gap-2 bg-primary-500/5 rounded-lg p-2.5">
              <BookMarked className="w-3.5 h-3.5 text-primary-400 mt-0.5 shrink-0" />
              <p className="text-xs text-surface-200/60">{vocab.context_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
