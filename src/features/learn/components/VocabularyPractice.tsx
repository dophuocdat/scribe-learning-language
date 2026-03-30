import { useState, useMemo, useEffect, useRef } from 'react'
import {
  List,
  Layers,
  Gamepad2,
  Keyboard,
  Volume2,
  Puzzle,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Star,
  Shuffle,
  Trophy,
  Sparkles,
  Gauge,
} from 'lucide-react'
import type { Vocabulary } from '@/shared/types/database'
import { useLearnStore } from '../stores/learnStore'
import { WordScramble } from './WordScramble'
import { useTTS, SPEED_OPTIONS, DEFAULT_SPEED } from '@/shared/hooks/useTTS'

type PracticeMode = 'list' | 'flashcard' | 'match' | 'type' | 'scramble'

interface VocabularyPracticeProps {
  vocabulary: Vocabulary[]
}

/* ========================================================================== */
/*  Speed Control Component (shared)                                          */
/* ========================================================================== */

function SpeedControl({
  speed,
  onChange,
  compact = false,
}: {
  speed: number
  onChange: (s: number) => void
  compact?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Gauge className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-surface-200/30 shrink-0`} />
      {!compact && <span className="text-xs text-surface-200/40">Tốc độ:</span>}
      <div className={`flex gap-0.5 ${compact ? '' : 'bg-surface-800/40 rounded-lg p-0.5'}`}>
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-all ${
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
  )
}

/* ========================================================================== */
/*  Main Container                                                            */
/* ========================================================================== */

export function VocabularyPractice({ vocabulary }: VocabularyPracticeProps) {
  const [mode, setMode] = useState<PracticeMode>('list')

  const modes = [
    { id: 'list' as const, icon: List, label: 'Danh sách' },
    { id: 'flashcard' as const, icon: Layers, label: 'Flashcard' },
    { id: 'match' as const, icon: Gamepad2, label: 'Nối từ' },
    { id: 'type' as const, icon: Keyboard, label: 'Gõ từ' },
    { id: 'scramble' as const, icon: Puzzle, label: 'Xáo chữ' },
  ]

  if (vocabulary.length === 0) {
    return (
      <div className="glass-card p-8 text-center animate-fade-in">
        <Sparkles className="w-10 h-10 mx-auto text-surface-200/20 mb-3" />
        <p className="text-surface-200/40 text-sm">Chưa có từ vựng trong bài học này</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mode selector */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl">
        {modes.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              mode === id
                ? 'bg-primary-500/15 text-primary-400 shadow-lg shadow-primary-500/5'
                : 'text-surface-200/40 hover:text-surface-200/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Active mode */}
      {mode === 'list' && <VocabList vocabulary={vocabulary} />}
      {mode === 'flashcard' && <FlashcardMode vocabulary={vocabulary} />}
      {mode === 'match' && <MatchingGame vocabulary={vocabulary} />}
      {mode === 'type' && <TypingPractice vocabulary={vocabulary} />}
      {mode === 'scramble' && <WordScramble vocabulary={vocabulary} />}
    </div>
  )
}

/* ========================================================================== */
/*  Mode 1: Vocabulary List (enhanced)                                        */
/* ========================================================================== */

function VocabList({ vocabulary }: { vocabulary: Vocabulary[] }) {
  const { addToSrs } = useLearnStore()
  const { speakWord, isSpeaking } = useTTS()
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)

  const handleAddToSrs = async (id: string) => {
    const ok = await addToSrs(id)
    if (ok) setAddedIds((prev) => new Set(prev).add(id))
  }

  return (
    <div className="space-y-2">
      {/* Global speed control */}
      <div className="flex justify-end">
        <SpeedControl speed={speed} onChange={setSpeed} compact />
      </div>

      {vocabulary.map((v, idx) => (
        <div
          key={v.id}
          className="glass-card overflow-hidden transition-all duration-300"
        >
          <button
            onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
            className="w-full p-4 flex items-center gap-3 text-left hover:bg-surface-700/20 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-primary-500/10 text-primary-400 text-xs font-bold flex items-center justify-center shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-50">{v.word}</p>
              <p className="text-xs text-surface-200/40 truncate">
                {v.ipa_pronunciation && <span className="mr-2">{v.ipa_pronunciation}</span>}
                {v.part_of_speech && <span className="text-primary-400/60">{v.part_of_speech}</span>}
              </p>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-surface-200/20 transition-transform duration-300 ${
                expandedId === v.id ? 'rotate-90' : ''
              }`}
            />
          </button>

          {/* Expanded details */}
          {expandedId === v.id && (
            <div className="px-4 pb-4 space-y-2 animate-fade-in border-t border-surface-700/30">
              <div className="pt-3 space-y-1.5">
                {v.definition_en && (
                  <p className="text-xs text-surface-200/60">
                    <span className="text-surface-200/30 mr-1">EN:</span> {v.definition_en}
                  </p>
                )}
                {v.definition_vi && (
                  <p className="text-xs text-surface-200/60">
                    <span className="text-surface-200/30 mr-1">VI:</span> {v.definition_vi}
                  </p>
                )}
                {v.example_sentence && (
                  <p className="text-xs text-surface-200/40 italic mt-1">
                    "{v.example_sentence}"
                  </p>
                )}
                {v.context_note && (
                  <p className="text-xs text-accent-400/50 mt-1">💡 {v.context_note}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                {/* Always show speak button */}
                <button
                  onClick={() => speakWord(v.word, v.audio_url, speed)}
                  className={`p-2 rounded-lg transition-colors ${
                    isSpeaking
                      ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                      : 'bg-surface-700/30 text-surface-200/40 hover:text-primary-400'
                  }`}
                  title="Phát âm"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleAddToSrs(v.id)}
                  disabled={addedIds.has(v.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    addedIds.has(v.id)
                      ? 'bg-success/10 text-success/60 cursor-default'
                      : 'bg-primary-500/10 text-primary-400 hover:bg-primary-500/20'
                  }`}
                >
                  {addedIds.has(v.id) ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Đã thêm SRS
                    </>
                  ) : (
                    <>
                      <Star className="w-3 h-3" /> Thêm vào SRS
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ========================================================================== */
/*  Mode 2: Flashcard                                                         */
/* ========================================================================== */

function FlashcardMode({ vocabulary }: { vocabulary: Vocabulary[] }) {
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<number>>(new Set())
  const [unknown, setUnknown] = useState<Set<number>>(new Set())
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const { speakWord, isSpeaking } = useTTS()

  const word = vocabulary[current]
  const total = vocabulary.length
  const reviewed = known.size + unknown.size
  const finished = reviewed >= total

  const handleFlip = () => setFlipped(!flipped)

  const handleKnow = () => {
    setKnown((prev) => new Set(prev).add(current))
    goNext()
  }

  const handleDontKnow = () => {
    setUnknown((prev) => new Set(prev).add(current))
    goNext()
  }

  const goNext = () => {
    setFlipped(false)
    if (current < total - 1) setCurrent(current + 1)
  }

  const handleReset = () => {
    setCurrent(0)
    setFlipped(false)
    setKnown(new Set())
    setUnknown(new Set())
  }

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation()
    speakWord(word.word, word.audio_url, speed)
  }

  if (finished) {
    const percent = Math.round((known.size / total) * 100)
    return (
      <div className="glass-card p-8 text-center animate-fade-in space-y-4">
        <Trophy className={`w-14 h-14 mx-auto ${percent >= 70 ? 'text-yellow-400' : 'text-surface-200/30'}`} />
        <h3 className="text-lg font-bold text-surface-50">Hoàn thành! 🎉</h3>
        <p className="text-sm text-surface-200/50">
          Biết: <span className="text-success font-bold">{known.size}</span> / Chưa biết:{' '}
          <span className="text-error font-bold">{unknown.size}</span> / Tổng:{' '}
          <span className="font-bold">{total}</span>
        </p>
        <div className="h-2 bg-surface-800 rounded-full overflow-hidden max-w-xs mx-auto">
          <div
            className="h-full bg-gradient-to-r from-success to-success/70 rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <button
          onClick={handleReset}
          className="mx-auto px-5 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 font-medium text-sm hover:bg-primary-500/20 transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Ôn lại
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Speed control */}
      <div className="flex justify-center">
        <SpeedControl speed={speed} onChange={setSpeed} />
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-surface-200/40">
        <span>
          {current + 1}/{total}
        </span>
        <span>
          ✅ {known.size} | ❌ {unknown.size}
        </span>
      </div>
      <div className="h-1 bg-surface-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div
        onClick={handleFlip}
        className="glass-card p-8 min-h-[220px] flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 hover:border-primary-500/20"
        style={{ perspective: '800px' }}
      >
        {!flipped ? (
          /* Front: Word */
          <div className="text-center space-y-2 animate-fade-in">
            <p className="text-2xl font-bold text-surface-50">{word.word}</p>
            {word.ipa_pronunciation && (
              <p className="text-sm text-surface-200/40">{word.ipa_pronunciation}</p>
            )}
            {word.part_of_speech && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400">
                {word.part_of_speech}
              </span>
            )}
            {/* Always show speak button */}
            <div className="pt-2">
              <button
                onClick={handleSpeak}
                className={`p-2.5 rounded-xl transition-colors ${
                  isSpeaking
                    ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                    : 'bg-surface-800/60 text-surface-200/40 hover:text-primary-400'
                }`}
                title="Phát âm"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-surface-200/25 mt-4">Chạm để lật</p>
          </div>
        ) : (
          /* Back: Definition */
          <div className="text-center space-y-3 animate-fade-in">
            <div className="flex items-center justify-center gap-2">
              <p className="text-lg font-semibold text-surface-50">{word.word}</p>
              <button
                onClick={handleSpeak}
                className={`p-1.5 rounded-lg transition-colors ${
                  isSpeaking
                    ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                    : 'text-surface-200/30 hover:text-primary-400'
                }`}
                title="Phát âm"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            {word.definition_vi && (
              <p className="text-sm text-accent-400">{word.definition_vi}</p>
            )}
            {word.definition_en && (
              <p className="text-sm text-surface-200/50">{word.definition_en}</p>
            )}
            {word.example_sentence && (
              <p className="text-xs text-surface-200/40 italic max-w-md">
                "{word.example_sentence}"
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDontKnow}
          className="flex-1 py-3 rounded-xl bg-error/10 text-error font-medium text-sm hover:bg-error/20 transition-colors flex items-center justify-center gap-2"
        >
          <XCircle className="w-4 h-4" /> Chưa biết
        </button>
        <button
          onClick={handleKnow}
          className="flex-1 py-3 rounded-xl bg-success/10 text-success font-medium text-sm hover:bg-success/20 transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" /> Đã biết
        </button>
      </div>
    </div>
  )
}

/* ========================================================================== */
/*  Mode 3: Matching Game                                                     */
/* ========================================================================== */

interface MatchItem {
  id: string
  text: string
  type: 'word' | 'definition'
  vocabId: string
}

function MatchingGame({ vocabulary }: { vocabulary: Vocabulary[] }) {
  const subset = useMemo(() => vocabulary.slice(0, Math.min(6, vocabulary.length)), [vocabulary])

  const [items, setItems] = useState<MatchItem[]>([])
  const [selected, setSelected] = useState<MatchItem | null>(null)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null)
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState(0)

  // Initialize items
  useEffect(() => {
    const words: MatchItem[] = subset.map((v) => ({
      id: `w-${v.id}`,
      text: v.word,
      type: 'word',
      vocabId: v.id,
    }))
    const defs: MatchItem[] = subset.map((v) => ({
      id: `d-${v.id}`,
      text: v.definition_vi || v.definition_en || v.word,
      type: 'definition',
      vocabId: v.id,
    }))
    // Shuffle each column independently
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)
    const shuffledDefs = [...defs].sort(() => Math.random() - 0.5)
    setItems([...shuffledWords, ...shuffledDefs])
    setSelected(null)
    setMatched(new Set())
    setWrongPair(null)
    setScore(0)
    setAttempts(0)
  }, [subset])

  const words = items.filter((i) => i.type === 'word')
  const defs = items.filter((i) => i.type === 'definition')
  const finished = matched.size === subset.length

  const handleSelect = (item: MatchItem) => {
    if (matched.has(item.vocabId)) return
    if (wrongPair) return // still showing wrong animation

    if (!selected) {
      setSelected(item)
      return
    }

    // Can't select two of the same type
    if (selected.type === item.type) {
      setSelected(item)
      return
    }

    setAttempts((p) => p + 1)

    // Check match
    if (selected.vocabId === item.vocabId) {
      // Correct!
      setMatched((prev) => new Set(prev).add(item.vocabId))
      setScore((p) => p + 1)
      setSelected(null)
    } else {
      // Wrong
      setWrongPair([selected.id, item.id])
      setTimeout(() => {
        setWrongPair(null)
        setSelected(null)
      }, 600)
    }
  }

  const handleReset = () => {
    const words: MatchItem[] = subset.map((v) => ({
      id: `w-${v.id}`,
      text: v.word,
      type: 'word',
      vocabId: v.id,
    }))
    const defs: MatchItem[] = subset.map((v) => ({
      id: `d-${v.id}`,
      text: v.definition_vi || v.definition_en || v.word,
      type: 'definition',
      vocabId: v.id,
    }))
    setItems([
      ...[...words].sort(() => Math.random() - 0.5),
      ...[...defs].sort(() => Math.random() - 0.5),
    ])
    setSelected(null)
    setMatched(new Set())
    setWrongPair(null)
    setScore(0)
    setAttempts(0)
  }

  if (finished) {
    return (
      <div className="glass-card p-8 text-center animate-fade-in space-y-4">
        <Trophy className="w-14 h-14 mx-auto text-yellow-400" />
        <h3 className="text-lg font-bold text-surface-50">Tuyệt vời! 🎯</h3>
        <p className="text-sm text-surface-200/50">
          Nối đúng {score}/{subset.length} cặp trong {attempts} lần thử
        </p>
        <button
          onClick={handleReset}
          className="mx-auto px-5 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 font-medium text-sm hover:bg-primary-500/20 transition-colors flex items-center gap-2"
        >
          <Shuffle className="w-4 h-4" /> Chơi lại
        </button>
      </div>
    )
  }

  const getItemStyle = (item: MatchItem) => {
    if (matched.has(item.vocabId)) return 'bg-success/10 border-success/20 text-success/60 scale-95 opacity-60'
    if (wrongPair?.includes(item.id)) return 'bg-error/10 border-error/30 text-error animate-shake'
    if (selected?.id === item.id) return 'bg-primary-500/15 border-primary-500/40 text-primary-300 ring-1 ring-primary-500/20'
    return 'bg-surface-800/40 border-surface-700/50 text-surface-200/70 hover:border-surface-600 hover:bg-surface-700/30'
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between text-xs text-surface-200/40">
        <span>Nối từ với nghĩa</span>
        <span>
          {matched.size}/{subset.length} cặp
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Words column */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-surface-200/25 font-semibold text-center mb-1">
            Từ vựng
          </p>
          {words.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              disabled={matched.has(item.vocabId)}
              className={`w-full p-3 rounded-xl border text-sm font-medium transition-all duration-300 ${getItemStyle(item)}`}
            >
              {item.text}
            </button>
          ))}
        </div>

        {/* Definitions column */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-surface-200/25 font-semibold text-center mb-1">
            Nghĩa
          </p>
          {defs.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              disabled={matched.has(item.vocabId)}
              className={`w-full p-3 rounded-xl border text-sm transition-all duration-300 ${getItemStyle(item)}`}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ========================================================================== */
/*  Mode 4: Typing Practice                                                   */
/* ========================================================================== */

function TypingPractice({ vocabulary }: { vocabulary: Vocabulary[] }) {
  const [current, setCurrent] = useState(0)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [score, setScore] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const inputRef = useRef<HTMLInputElement>(null)
  const { speakWord, isSpeaking } = useTTS()

  const word = vocabulary[current]
  const total = vocabulary.length
  const finished = current >= total

  useEffect(() => {
    inputRef.current?.focus()
  }, [current])

  const checkAnswer = () => {
    const answer = input.trim().toLowerCase()
    const correct = word.word.trim().toLowerCase()

    if (answer === correct) {
      setResult('correct')
      setScore((p) => p + 1)
    } else {
      setResult('wrong')
    }
  }

  const handleNext = () => {
    setCurrent((p) => p + 1)
    setInput('')
    setResult(null)
    setShowHint(false)
  }

  const handleReset = () => {
    setCurrent(0)
    setInput('')
    setResult(null)
    setScore(0)
    setShowHint(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (result) handleNext()
      else checkAnswer()
    }
  }

  if (finished) {
    const percent = Math.round((score / total) * 100)
    return (
      <div className="glass-card p-8 text-center animate-fade-in space-y-4">
        <Trophy className={`w-14 h-14 mx-auto ${percent >= 70 ? 'text-yellow-400' : 'text-surface-200/30'}`} />
        <h3 className="text-lg font-bold text-surface-50">Hoàn thành!</h3>
        <p className="text-sm text-surface-200/50">
          Đúng <span className="text-success font-bold">{score}</span>/{total} từ ({percent}%)
        </p>
        <button
          onClick={handleReset}
          className="mx-auto px-5 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 font-medium text-sm hover:bg-primary-500/20 transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Luyện lại
        </button>
      </div>
    )
  }

  // Generate hint: first letter + underscores
  const hint = word.word[0] + ' _ '.repeat(Math.max(0, word.word.length - 1)).trim()

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-surface-200/40">
        <span>
          Từ {current + 1}/{total}
        </span>
        <span>Đúng: {score}</span>
      </div>
      <div className="h-1 bg-surface-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-500 to-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      {/* Speed control */}
      <div className="flex justify-center">
        <SpeedControl speed={speed} onChange={setSpeed} compact />
      </div>

      {/* Prompt card */}
      <div className="glass-card p-6 space-y-4">
        <p className="text-xs text-surface-200/30 uppercase tracking-wider">
          Gõ từ tiếng Anh cho nghĩa sau:
        </p>

        <div className="text-center py-4">
          <p className="text-lg font-semibold text-accent-400">
            {word.definition_vi || word.definition_en || '—'}
          </p>
          {word.part_of_speech && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-700/50 text-surface-200/40 mt-2 inline-block">
              {word.part_of_speech}
            </span>
          )}
          {/* Listen button */}
          <div className="mt-3">
            <button
              onClick={() => speakWord(word.word, word.audio_url, speed)}
              className={`p-2 rounded-lg transition-colors ${
                isSpeaking
                  ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                  : 'bg-surface-700/30 text-surface-200/40 hover:text-primary-400'
              }`}
              title="Nghe phát âm"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          {word.example_sentence && (
            <p className="text-xs text-surface-200/30 italic mt-3 max-w-md mx-auto">
              "{word.example_sentence.replace(new RegExp(word.word, 'gi'), '___')}"
            </p>
          )}
        </div>

        {/* Hint */}
        {showHint && (
          <p className="text-xs text-primary-400/60 text-center animate-fade-in">
            Gợi ý: <span className="font-mono tracking-widest">{hint}</span>
          </p>
        )}

        {/* Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={result !== null}
            placeholder="Nhập từ..."
            className={`w-full p-3.5 rounded-xl border text-sm text-center font-medium outline-none transition-all ${
              result === 'correct'
                ? 'bg-success/10 border-success/30 text-success'
                : result === 'wrong'
                  ? 'bg-error/10 border-error/30 text-error'
                  : 'bg-surface-800/40 border-surface-700/50 text-surface-50 placeholder:text-surface-200/25 focus:border-primary-500/40'
            }`}
          />
        </div>

        {/* Result feedback */}
        {result === 'correct' && (
          <p className="text-sm text-success text-center flex items-center justify-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" /> Chính xác!
          </p>
        )}
        {result === 'wrong' && (
          <div className="text-center animate-fade-in space-y-1">
            <p className="text-sm text-error flex items-center justify-center gap-1.5">
              <XCircle className="w-4 h-4" /> Sai rồi
            </p>
            <p className="text-xs text-surface-200/50">
              Đáp án: <span className="text-surface-50 font-semibold">{word.word}</span>
            </p>
            {/* Listen to correct answer */}
            <button
              onClick={() => speakWord(word.word, word.audio_url, speed)}
              className={`inline-flex items-center gap-1 text-xs mt-1 px-2 py-1 rounded-lg transition-colors ${
                isSpeaking
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-surface-200/40 hover:text-primary-400'
              }`}
            >
              <Volume2 className="w-3 h-3" /> Nghe phát âm
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {result === null ? (
            <>
              {!showHint && (
                <button
                  onClick={() => setShowHint(true)}
                  className="px-4 py-2.5 rounded-xl bg-surface-700/30 text-surface-200/40 font-medium text-xs hover:bg-surface-700/50 transition-colors"
                >
                  💡 Gợi ý
                </button>
              )}
              <button
                onClick={checkAnswer}
                disabled={!input.trim()}
                className="flex-1 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Kiểm tra
              </button>
            </>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 font-medium text-sm hover:bg-primary-500/20 transition-colors flex items-center justify-center gap-1.5"
            >
              {current < total - 1 ? 'Từ tiếp theo' : 'Xem kết quả'}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
