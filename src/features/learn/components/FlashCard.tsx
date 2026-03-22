import { useState } from 'react'
import { RotateCcw, Check, X, Volume2, Gauge } from 'lucide-react'
import type { Vocabulary } from '@/shared/types/database'
import { useTTS, SPEED_OPTIONS, DEFAULT_SPEED } from '@/shared/hooks/useTTS'

interface FlashCardProps {
  vocabulary: Vocabulary
  onReview: (quality: number) => void
}

export function FlashCard({ vocabulary, onReview }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const { speakWord, isSpeaking } = useTTS()

  const handleFlip = () => {
    if (!animating) setFlipped(!flipped)
  }

  const handleGrade = (quality: number) => {
    setAnimating(true)
    setTimeout(() => {
      onReview(quality)
      setFlipped(false)
      setAnimating(false)
    }, 300)
  }

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation()
    speakWord(vocabulary.word, vocabulary.audio_url, speed)
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Speed control */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Gauge className="w-3.5 h-3.5 text-surface-200/30" />
        <span className="text-xs text-surface-200/40">Tốc độ:</span>
        <div className="flex gap-1 bg-surface-800/40 rounded-lg p-1">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSpeed(opt.value)}
              className={`text-[10px] px-2 py-1 rounded-md font-medium transition-all ${
                speed === opt.value
                  ? 'bg-primary-500/20 text-primary-400 shadow-sm'
                  : 'text-surface-200/30 hover:text-surface-200/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card */}
      <div
        onClick={handleFlip}
        className={`relative min-h-[280px] cursor-pointer transition-all duration-500 preserve-3d ${
          flipped ? 'rotate-y-180' : ''
        }`}
        style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 glass-card p-8 flex flex-col items-center justify-center text-center backface-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <span className="text-xs text-surface-200/30 uppercase tracking-wider mb-4">
            Nhìn từ → Nhớ nghĩa
          </span>
          <h2 className="text-3xl font-bold text-surface-50 mb-3">
            {vocabulary.word}
          </h2>
          {vocabulary.ipa_pronunciation && (
            <p className="text-sm text-surface-200/40 font-mono mb-2">
              /{vocabulary.ipa_pronunciation}/
            </p>
          )}
          {vocabulary.part_of_speech && (
            <span className="text-xs text-primary-400/60 bg-primary-500/10 px-3 py-1 rounded-full">
              {vocabulary.part_of_speech}
            </span>
          )}
          {/* Always show speak button */}
          <button
            onClick={handleSpeak}
            className={`mt-4 p-2.5 rounded-xl transition-colors ${
              isSpeaking
                ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                : 'bg-surface-800/60 text-surface-200/40 hover:text-primary-400'
            }`}
            title="Phát âm"
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <p className="absolute bottom-4 text-[10px] text-surface-200/20">
            Nhấn để lật thẻ
          </p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 glass-card p-8 flex flex-col items-center justify-center text-center"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <span className="text-xs text-surface-200/30 uppercase tracking-wider mb-3">
            Nghĩa
          </span>
          {vocabulary.definition_en && (
            <p className="text-lg text-surface-50 font-medium mb-2">
              {vocabulary.definition_en}
            </p>
          )}
          {vocabulary.definition_vi && (
            <p className="text-sm text-surface-200/50 mb-3">
              {vocabulary.definition_vi}
            </p>
          )}
          {vocabulary.example_sentence && (
            <p className="text-xs text-surface-200/40 italic max-w-xs">
              "{vocabulary.example_sentence}"
            </p>
          )}
        </div>
      </div>

      {/* Grade buttons (visible only when flipped) */}
      {flipped && (
        <div className="mt-6 flex items-center justify-center gap-3 animate-fade-in">
          <button
            onClick={() => handleGrade(1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-error/10 text-error text-sm font-medium hover:bg-error/20 transition-colors"
          >
            <X className="w-4 h-4" />
            Quên
          </button>
          <button
            onClick={() => handleGrade(3)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-warning/10 text-warning text-sm font-medium hover:bg-warning/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Khó
          </button>
          <button
            onClick={() => handleGrade(4)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
          >
            <Check className="w-4 h-4" />
            Tốt
          </button>
          <button
            onClick={() => handleGrade(5)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-colors"
          >
            <Check className="w-4 h-4" />
            Dễ
          </button>
        </div>
      )}
    </div>
  )
}
