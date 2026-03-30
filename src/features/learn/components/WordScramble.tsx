import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Play,
  RotateCcw,
  Trophy,
  Zap,
  Lightbulb,
  Volume2,
  Timer,
  Flame,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { Vocabulary } from '@/shared/types/database'
import { useXpStore } from '@/shared/stores/xpStore'
import { useTTS, DEFAULT_SPEED } from '@/shared/hooks/useTTS'

/* ------------------------------------------------------------------ */
/*  Utility: Fisher-Yates shuffle                                     */
/* ------------------------------------------------------------------ */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const ROUND_TIME = 30 // seconds per word
const MAX_HINTS = 2
const XP_BASE = 5
const XP_MAX = 20
const COMBO_THRESHOLD = 3

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface LetterTile {
  char: string
  originalIndex: number
  id: string // unique key for animation
}

type GamePhase = 'idle' | 'active' | 'result' | 'finished'

interface RoundResult {
  word: string
  definitionVi: string | null
  correct: boolean
  timeUsed: number
  hintsUsed: number
}

/* ================================================================== */
/*  WordScramble Component                                             */
/* ================================================================== */
interface WordScrambleProps {
  vocabulary: Vocabulary[]
}

export function WordScramble({ vocabulary }: WordScrambleProps) {
  /* ---- Game state ---- */
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [words, setWords] = useState<Vocabulary[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])

  /* ---- Round state ---- */
  const [scrambled, setScrambled] = useState<LetterTile[]>([])
  const [placed, setPlaced] = useState<LetterTile[]>([])
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null)
  const [totalScore, setTotalScore] = useState(0)

  /* ---- Refs ---- */
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundStartRef = useRef(0)

  /* ---- Hooks ---- */
  const { speakWord, isSpeaking } = useTTS()
  const { awardXp, updateStreak } = useXpStore()

  /* ---- Current word ---- */
  const currentWord = words[currentIdx]
  const totalWords = words.length

  /* ---- Cleanup timer ---- */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  /* ---- Timer countdown ---- */
  useEffect(() => {
    if (phase !== 'active') return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — auto-fail this round
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIdx])

  /* ---- Auto-check when all letters placed ---- */
  useEffect(() => {
    if (phase !== 'active' || !currentWord) return
    if (placed.length === currentWord.word.length) {
      checkAnswer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed.length])

  /* ---- Scramble a word (ensure it's different from original) ---- */
  const scrambleWord = useCallback((word: string): LetterTile[] => {
    const letters: LetterTile[] = word.split('').map((char, idx) => ({
      char: char.toLowerCase(),
      originalIndex: idx,
      id: `${idx}-${char}-${Math.random().toString(36).slice(2, 6)}`,
    }))

    let shuffled = shuffle(letters)
    // Make sure it's actually scrambled (for words > 2 chars)
    if (word.length > 2) {
      let attempts = 0
      while (
        shuffled.map((l) => l.char).join('') === word.toLowerCase() &&
        attempts < 10
      ) {
        shuffled = shuffle(letters)
        attempts++
      }
    }
    return shuffled
  }, [])

  /* ---- Start game ---- */
  const handleStart = useCallback(() => {
    const gameWords = shuffle(vocabulary).slice(0, Math.min(10, vocabulary.length))
    setWords(gameWords)
    setCurrentIdx(0)
    setResults([])
    setCombo(0)
    setMaxCombo(0)
    setTotalScore(0)

    // Initialize first round
    const first = gameWords[0]
    setScrambled(scrambleWord(first.word))
    setPlaced([])
    setTimeLeft(ROUND_TIME)
    setHintsUsed(0)
    setShowResult(null)
    roundStartRef.current = Date.now()
    setPhase('active')
  }, [vocabulary, scrambleWord])

  /* ---- Select letter from scrambled → placed ---- */
  const handleSelectLetter = useCallback(
    (tile: LetterTile) => {
      if (phase !== 'active' || showResult) return
      setScrambled((prev) => prev.filter((t) => t.id !== tile.id))
      setPlaced((prev) => [...prev, tile])
    },
    [phase, showResult]
  )

  /* ---- Remove letter from placed → scrambled ---- */
  const handleRemoveLetter = useCallback(
    (tile: LetterTile) => {
      if (phase !== 'active' || showResult) return
      setPlaced((prev) => prev.filter((t) => t.id !== tile.id))
      setScrambled((prev) => [...prev, tile])
    },
    [phase, showResult]
  )

  /* ---- Check answer ---- */
  const checkAnswer = useCallback(() => {
    if (!currentWord) return
    if (timerRef.current) clearInterval(timerRef.current)

    const userAnswer = placed.map((t) => t.char).join('')
    const correctAnswer = currentWord.word.toLowerCase()
    const isCorrect = userAnswer === correctAnswer
    const timeUsed = Math.round((Date.now() - roundStartRef.current) / 1000)

    if (isCorrect) {
      // Score: base + time bonus + combo bonus
      const timeBonus = Math.max(0, ROUND_TIME - timeUsed)
      const comboBonus = combo >= COMBO_THRESHOLD ? combo * 2 : 0
      const roundScore = 10 + timeBonus + comboBonus
      setTotalScore((prev) => prev + roundScore)
      setCombo((prev) => {
        const newCombo = prev + 1
        setMaxCombo((mc) => Math.max(mc, newCombo))
        return newCombo
      })
    } else {
      setCombo(0)
    }

    setShowResult(isCorrect ? 'correct' : 'wrong')

    setResults((prev) => [
      ...prev,
      {
        word: currentWord.word,
        definitionVi: currentWord.definition_vi,
        correct: isCorrect,
        timeUsed,
        hintsUsed,
      },
    ])
  }, [currentWord, placed, combo, hintsUsed])

  /* ---- Time's up ---- */
  const handleTimeUp = useCallback(() => {
    if (!currentWord) return
    if (timerRef.current) clearInterval(timerRef.current)

    const timeUsed = ROUND_TIME
    setCombo(0)
    setShowResult('wrong')

    // Auto-fill correct answer for display
    const correctLetters: LetterTile[] = currentWord.word
      .split('')
      .map((char, idx) => ({
        char: char.toLowerCase(),
        originalIndex: idx,
        id: `correct-${idx}`,
      }))
    setPlaced(correctLetters)
    setScrambled([])

    setResults((prev) => [
      ...prev,
      {
        word: currentWord.word,
        definitionVi: currentWord.definition_vi,
        correct: false,
        timeUsed,
        hintsUsed,
      },
    ])
  }, [currentWord, hintsUsed])

  /* ---- Next word ---- */
  const handleNext = useCallback(async () => {
    const nextIdx = currentIdx + 1

    if (nextIdx >= totalWords) {
      // Game over — award XP
      // results already includes the current one from checkAnswer
      const finalCorrect = results.filter((r) => r.correct).length
      const percent = totalWords > 0 ? finalCorrect / totalWords : 0
      const xpAmount = Math.round(XP_BASE + percent * (XP_MAX - XP_BASE))

      if (xpAmount > 0) {
        await awardXp(xpAmount, 'quiz_complete', undefined)
        await updateStreak()
      }

      setPhase('finished')
      return
    }

    // Next round
    const nextWord = words[nextIdx]
    setCurrentIdx(nextIdx)
    setScrambled(scrambleWord(nextWord.word))
    setPlaced([])
    setTimeLeft(ROUND_TIME)
    setHintsUsed(0)
    setShowResult(null)
    roundStartRef.current = Date.now()
  }, [currentIdx, totalWords, words, scrambleWord, results, showResult, awardXp, updateStreak])

  /* ---- Hint: reveal one correct letter ---- */
  const handleHint = useCallback(() => {
    if (!currentWord || hintsUsed >= MAX_HINTS || showResult) return

    const correctWord = currentWord.word.toLowerCase()
    const currentPlaced = placed.map((t) => t.char)

    // Find the next position that needs a letter
    const nextPos = currentPlaced.length

    if (nextPos >= correctWord.length) return

    const neededChar = correctWord[nextPos]

    // Find this char in scrambled tiles
    const tileIdx = scrambled.findIndex((t) => t.char === neededChar)

    if (tileIdx !== -1) {
      const tile = scrambled[tileIdx]
      setScrambled((prev) => prev.filter((t) => t.id !== tile.id))
      setPlaced((prev) => [...prev, { ...tile, id: `hint-${tile.id}` }])
      setHintsUsed((prev) => prev + 1)
    }
  }, [currentWord, hintsUsed, showResult, scrambled, placed])

  /* ---- Derived ---- */
  const finishedResults = useMemo(() => {
    if (phase !== 'finished') return null
    const correct = results.filter((r) => r.correct).length
    const percent = totalWords > 0 ? Math.round((correct / totalWords) * 100) : 0
    const xpEarned = Math.round(XP_BASE + (correct / Math.max(1, totalWords)) * (XP_MAX - XP_BASE))
    return { correct, percent, xpEarned }
  }, [phase, results, totalWords])

  /* ================================================================ */
  /*  IDLE — Start screen                                              */
  /* ================================================================ */
  if (phase === 'idle') {
    return (
      <div className="glass-card p-8 text-center space-y-5 animate-fade-in scramble-idle-card">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-surface-50">Xáo Chữ</h3>
          <p className="text-sm text-surface-200/50 mt-1">
            Sắp xếp lại các chữ cái để tạo thành từ đúng
          </p>
        </div>

        <ul className="text-xs text-surface-200/40 space-y-1.5 max-w-xs mx-auto text-left">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
            {Math.min(10, vocabulary.length)} từ ngẫu nhiên, mỗi từ {ROUND_TIME}s
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
            Combo streak → điểm thưởng cao hơn
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Tối đa {MAX_HINTS} gợi ý mỗi từ
          </li>
        </ul>

        <button
          onClick={handleStart}
          className="px-8 py-3 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
        >
          <Play className="w-5 h-5" />
          Bắt đầu chơi
        </button>
      </div>
    )
  }

  /* ================================================================ */
  /*  FINISHED — Summary screen                                        */
  /* ================================================================ */
  if (phase === 'finished' && finishedResults) {
    const { correct, percent, xpEarned } = finishedResults

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Score card */}
        <div
          className={`glass-card p-6 text-center space-y-4 border ${
            percent >= 70
              ? 'border-success/30 bg-success/5'
              : 'border-warning/30 bg-warning/5'
          }`}
        >
          <div
            className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
              percent >= 70 ? 'bg-success/10' : 'bg-warning/10'
            }`}
          >
            <Trophy
              className={`w-8 h-8 ${percent >= 70 ? 'text-yellow-400' : 'text-surface-200/40'}`}
            />
          </div>

          <div>
            <h3 className="text-lg font-bold text-surface-50">
              {percent >= 90
                ? 'Xuất sắc! 🎉'
                : percent >= 70
                  ? 'Tốt lắm! 👏'
                  : percent >= 50
                    ? 'Khá tốt! 💪'
                    : 'Cố gắng thêm! 📚'}
            </h3>
            <p className="text-sm text-surface-200/50 mt-1">
              Đúng {correct}/{totalWords} từ ({percent}%)
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-6 text-xs text-surface-200/40">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>
                Combo max: <span className="text-surface-50 font-bold">{maxCombo}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Điểm: <span className="text-surface-50 font-bold">{totalScore}</span>
              </span>
            </div>
          </div>

          {/* XP badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/20">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">+{xpEarned} XP</span>
          </div>

          <button
            onClick={handleStart}
            className="mx-auto px-6 py-2.5 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Chơi lại
          </button>
        </div>

        {/* Results breakdown */}
        <div className="glass-card p-4 space-y-2 scramble-results-card">
          <h4 className="text-xs font-semibold text-surface-200/40 uppercase tracking-wider">
            Chi tiết
          </h4>
          {results.map((r, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-2.5 rounded-lg text-sm ${
                r.correct
                  ? 'bg-success/5 border border-success/10'
                  : 'bg-error/5 border border-error/10'
              }`}
            >
              {r.correct ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-error shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-surface-50">{r.word}</span>
                {r.definitionVi && (
                  <span className="text-surface-200/40 ml-2 text-xs">— {r.definitionVi}</span>
                )}
              </div>
              <span className="text-xs text-surface-200/30 shrink-0">{r.timeUsed}s</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ================================================================ */
  /*  ACTIVE / RESULT — Game play                                      */
  /* ================================================================ */
  if (!currentWord) return null

  const timerPercent = (timeLeft / ROUND_TIME) * 100
  const timerColor =
    timeLeft > 20
      ? 'from-success to-success/70'
      : timeLeft > 10
        ? 'from-warning to-warning/70'
        : 'from-error to-error/70'

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress + Combo bar */}
      <div className="glass-card p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-200/40">
            Từ {currentIdx + 1}/{totalWords}
          </span>
          <div className="flex items-center gap-3">
            {combo >= COMBO_THRESHOLD && (
              <span className="flex items-center gap-1 text-orange-400 font-bold animate-combo-flash">
                <Flame className="w-3.5 h-3.5" />
                Combo x{combo}!
              </span>
            )}
            <span className="text-surface-200/40">
              Điểm: <span className="text-surface-50 font-bold">{totalScore}</span>
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-surface-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
            style={{ width: `${((currentIdx + 1) / totalWords) * 100}%` }}
          />
        </div>
      </div>

      {/* Timer bar */}
      <div className="relative h-2 bg-surface-800/60 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${timerColor} rounded-full transition-all duration-1000 ease-linear`}
          style={{ width: `${timerPercent}%` }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Timer className="w-3 h-3 text-surface-200/40" />
          <span className="text-[10px] font-mono font-bold text-surface-200/50">
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Clue card */}
      <div className="glass-card p-5 space-y-3 scramble-clue-card">
        <p className="text-[10px] uppercase tracking-wider text-surface-200/25 font-semibold">
          Sắp xếp chữ cái để tạo từ:
        </p>

        <div className="text-center space-y-2">
          {/* Definition clue */}
          <p className="text-base font-semibold text-accent-400">
            {currentWord.definition_vi || currentWord.definition_en || '—'}
          </p>

          {currentWord.part_of_speech && (
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-surface-700/50 text-surface-200/40">
              {currentWord.part_of_speech}
            </span>
          )}

          {/* Example sentence with word hidden */}
          {currentWord.example_sentence && (
            <p className="text-xs text-surface-200/30 italic max-w-md mx-auto">
              "
              {currentWord.example_sentence.replace(
                new RegExp(currentWord.word, 'gi'),
                '___'
              )}
              "
            </p>
          )}

          {/* TTS button */}
          <button
            onClick={() => speakWord(currentWord.word, currentWord.audio_url, DEFAULT_SPEED)}
            className={`mt-1 p-2 rounded-lg transition-colors inline-flex ${
              isSpeaking
                ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                : 'bg-surface-700/30 text-surface-200/40 hover:text-primary-400'
            }`}
            title="Nghe phát âm"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Placed letters (answer area) */}
      <div className="glass-card p-4 min-h-[72px] scramble-answer-card">
        <p className="text-[10px] uppercase tracking-wider text-surface-200/20 font-semibold mb-2">
          Câu trả lời
        </p>
        <div className="flex flex-wrap gap-2 justify-center min-h-[44px] items-center">
          {placed.length === 0 && (
            <span className="text-xs text-surface-200/20">Chạm chữ bên dưới để sắp xếp...</span>
          )}
          {placed.map((tile, idx) => {
            const isCorrectPosition =
              showResult && tile.char === currentWord.word[idx]?.toLowerCase()
            const isWrongPosition =
              showResult === 'wrong' && tile.char !== currentWord.word[idx]?.toLowerCase()

            return (
              <button
                key={tile.id}
                onClick={() => handleRemoveLetter(tile)}
                disabled={!!showResult}
                className={`w-10 h-10 rounded-xl text-lg font-bold uppercase transition-all duration-200 animate-letter-pop ${
                  showResult === 'correct'
                    ? 'bg-success/20 border border-success/40 text-success'
                    : isWrongPosition
                      ? 'bg-error/20 border border-error/40 text-error animate-shake'
                      : isCorrectPosition
                        ? 'bg-success/20 border border-success/40 text-success'
                        : 'bg-primary-500/15 border border-primary-500/30 text-primary-300 hover:bg-primary-500/25 hover:scale-110 cursor-pointer'
                } disabled:cursor-default`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {tile.char}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrambled letters (source area) */}
      {!showResult && (
        <div className="flex flex-wrap gap-2 justify-center py-2">
          {scrambled.map((tile, idx) => (
            <button
              key={tile.id}
              onClick={() => handleSelectLetter(tile)}
              className="w-11 h-11 rounded-xl bg-surface-700/50 border border-surface-600/50 text-lg font-bold text-surface-100 uppercase
                hover:bg-primary-500/15 hover:border-primary-500/30 hover:text-primary-300 hover:scale-110
                active:scale-95 transition-all duration-150 animate-bounce-in"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              {tile.char}
            </button>
          ))}
        </div>
      )}

      {/* Result feedback */}
      {showResult === 'correct' && (
        <div className="glass-card p-4 text-center border border-success/20 bg-success/5 animate-fade-in">
          <p className="text-sm font-semibold text-success flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Chính xác! 🎉
          </p>
          {combo >= COMBO_THRESHOLD && (
            <p className="text-xs text-orange-400 mt-1 flex items-center justify-center gap-1">
              <Flame className="w-3 h-3" />
              Combo x{combo}!
            </p>
          )}
        </div>
      )}
      {showResult === 'wrong' && (
        <div className="glass-card p-4 text-center border border-error/20 bg-error/5 animate-fade-in space-y-1">
          <p className="text-sm font-semibold text-error flex items-center justify-center gap-2">
            <XCircle className="w-5 h-5" />
            {timeLeft <= 0 ? 'Hết thời gian!' : 'Sai rồi!'}
          </p>
          <p className="text-xs text-surface-200/50">
            Đáp án: <span className="text-surface-50 font-bold">{currentWord.word}</span>
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {!showResult ? (
          <>
            <button
              onClick={handleHint}
              disabled={hintsUsed >= MAX_HINTS}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                hintsUsed >= MAX_HINTS
                  ? 'bg-surface-800/30 text-surface-200/20 cursor-not-allowed'
                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Gợi ý ({MAX_HINTS - hintsUsed})
            </button>
            <button
              onClick={() => {
                setPlaced([])
                setScrambled(scrambleWord(currentWord.word))
              }}
              className="px-4 py-2.5 rounded-xl bg-surface-700/30 text-surface-200/40 text-xs font-medium hover:bg-surface-700/50 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Xáo lại
            </button>
          </>
        ) : (
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {currentIdx + 1 >= totalWords ? (
              <>
                <Trophy className="w-4 h-4" />
                Xem kết quả
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                Từ tiếp theo
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
