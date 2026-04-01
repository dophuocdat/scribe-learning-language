import { useState, useCallback, useEffect, useRef } from 'react'
import { Mic, MicOff, Send, AlertCircle, Loader2, Volume2, RotateCcw } from 'lucide-react'
import { useReadingStore, type ReadingAloudContent } from '../stores/readingStore'
import { useSTT } from '@/shared/hooks/useSTT'
import { useMediaRecorder } from '@/shared/hooks/useMediaRecorder'
import { useTTS } from '@/shared/hooks/useTTS'
import { WordPopup } from './WordPopup'

type WordStatus = 'unread' | 'current' | 'correct' | 'wrong' | 'skipped'

export function ReadingAloud() {
  const { content, evaluating, error, submitReadingAloud, clearError, batchItems, currentBatchIndex } = useReadingStore()
  const passage = content as ReadingAloudContent
  const { startListening, stopListening, transcribeAudio, transcript, interimTranscript, isTranscribing, isSupported, reset: resetSTT } = useSTT()
  const { startRecording, stopRecording, audioBlob } = useMediaRecorder()
  const { speak, isSpeaking } = useTTS()

  const [phase, setPhase] = useState<'idle' | 'reading' | 'done'>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [finalTranscript, setFinalTranscript] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const karaokeRef = useRef<HTMLDivElement>(null)

  // Word popup state
  const [selectedWord, setSelectedWord] = useState<{
    word: string; position: { x: number; y: number }; context: string
  } | null>(null)

  // Words for karaoke
  const passageWords = (passage?.content || '').split(/\s+/).filter(Boolean)
  const passageWordsClean = passageWords.map(w => w.toLowerCase().replace(/[^\w'-]/g, ''))

  // Word statuses for karaoke display
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>(() => passageWords.map(() => 'unread'))

  // Track how many STT words we've processed
  const lastProcessedCountRef = useRef(0)
  const matchIndexRef = useRef(0) // current position in passage

  // Reset statuses when content changes
  useEffect(() => {
    setWordStatuses(passageWords.map(() => 'unread'))
    lastProcessedCountRef.current = 0
    matchIndexRef.current = 0
  }, [passage?.content])

  // Real-time karaoke: process new STT words incrementally
  useEffect(() => {
    if (phase !== 'reading') return

    const currentText = (transcript || '') + ' ' + (interimTranscript || '')
    const sttWords = currentText.trim().toLowerCase().replace(/[^\w\s'-]/g, '').split(/\s+/).filter(Boolean)

    if (sttWords.length <= lastProcessedCountRef.current) return

    // Process only NEW words since last check
    const newWords = sttWords.slice(lastProcessedCountRef.current)
    lastProcessedCountRef.current = sttWords.length

    setWordStatuses(prev => {
      const updated = [...prev]
      let passageIdx = matchIndexRef.current

      for (const spokenWord of newWords) {
        if (passageIdx >= passageWordsClean.length) break

        const expectedWord = passageWordsClean[passageIdx]

        if (wordsMatch(spokenWord, expectedWord)) {
          // Correct!
          updated[passageIdx] = 'correct'
          passageIdx++
        } else {
          // Check if user skipped a word and said the next one
          if (passageIdx + 1 < passageWordsClean.length && wordsMatch(spokenWord, passageWordsClean[passageIdx + 1])) {
            updated[passageIdx] = 'skipped' // mark skipped word
            updated[passageIdx + 1] = 'correct'
            passageIdx += 2
          } else {
            // Wrong pronunciation
            updated[passageIdx] = 'wrong'
            passageIdx++
          }
        }
      }

      // Mark current word
      if (passageIdx < updated.length) {
        // Don't overwrite already-judged words
        if (updated[passageIdx] === 'unread') {
          updated[passageIdx] = 'current'
        }
      }

      matchIndexRef.current = passageIdx
      return updated
    })
  }, [transcript, interimTranscript, phase, passageWordsClean])

  if (!passage) return null

  const handleStart = useCallback(() => {
    clearError()
    resetSTT()
    setFinalTranscript('')
    setElapsedSec(0)
    setPhase('reading')
    setWordStatuses(passageWords.map(() => 'unread'))
    lastProcessedCountRef.current = 0
    matchIndexRef.current = 0

    // Start timer
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)

    // Start recording + STT
    startRecording()
    if (isSupported) {
      try { startListening('en-US') } catch { /* ignore */ }
    }
  }, [clearError, resetSTT, isSupported, startListening, startRecording, passageWords])

  const handleStop = useCallback(() => {
    setPhase('done')

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    stopRecording()
    if (isSupported) {
      try { stopListening() } catch { /* ignore */ }
    }

    // Mark remaining unread words as skipped
    setWordStatuses(prev => prev.map(s => s === 'unread' || s === 'current' ? 'skipped' : s))

    if (transcript) {
      setFinalTranscript(transcript)
    }
  }, [isSupported, stopListening, stopRecording, transcript])

  // Whisper fallback when audioBlob available
  useEffect(() => {
    if (phase === 'done' && audioBlob && !finalTranscript && !isTranscribing) {
      transcribeAudio(audioBlob, 'en').then(text => {
        if (text) setFinalTranscript(text)
      })
    }
  }, [phase, audioBlob, finalTranscript, isTranscribing, transcribeAudio])

  // Use Web Speech transcript if available
  useEffect(() => {
    if (phase === 'done' && transcript && !finalTranscript) {
      setFinalTranscript(transcript)
    }
  }, [phase, transcript, finalTranscript])

  const handleRetry = useCallback(() => {
    setPhase('idle')
    setFinalTranscript('')
    setWordStatuses(passageWords.map(() => 'unread'))
    lastProcessedCountRef.current = 0
    matchIndexRef.current = 0
    resetSTT()
    clearError()
  }, [passageWords, resetSTT, clearError])

  const handleSubmit = async () => {
    const text = finalTranscript || transcript
    if (!text?.trim()) return
    await submitReadingAloud(text.trim(), elapsedSec)
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Statistics
  const correctCount = wordStatuses.filter(s => s === 'correct').length
  const wrongCount = wordStatuses.filter(s => s === 'wrong').length
  const skippedCount = wordStatuses.filter(s => s === 'skipped').length

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Batch progress */}
      {batchItems.length > 1 && (
        <div className="flex items-center gap-2">
          {batchItems.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < currentBatchIndex ? 'gradient-bg' : i === currentBatchIndex ? 'bg-primary-500/50 animate-pulse' : 'bg-surface-800/50'
              }`}
            />
          ))}
          <span className="text-[10px] text-surface-200/30 ml-1">{currentBatchIndex + 1}/{batchItems.length}</span>
        </div>
      )}

      {/* Header */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-surface-50">{passage.title}</h2>
          <button
            onClick={() => speak(passage.content, 0.9)}
            disabled={isSpeaking || phase === 'reading'}
            className="p-2 rounded-lg gradient-bg text-white hover:opacity-90 transition-all disabled:opacity-50"
            title="Nghe mẫu"
          >
            <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-pulse' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-surface-200/40">
          <span>{passage.word_count} từ</span>
          <span>~{passage.estimated_wpm} WPM gợi ý</span>
          {phase === 'reading' && (
            <span className="text-primary-300 font-mono">{formatTime(elapsedSec)}</span>
          )}
        </div>
        {passage.difficulty_note_vi && (
          <p className="text-[10px] text-surface-200/30 mt-1">💡 {passage.difficulty_note_vi}</p>
        )}
      </div>

      {/* Karaoke Text */}
      <div ref={karaokeRef} className="glass-card p-5 relative">
        <div className="text-base leading-8 font-medium">
          {passageWords.map((word, idx) => {
            const status = wordStatuses[idx]
            let colorClass = 'text-surface-200/40' // unread — dim

            if (status === 'correct') colorClass = 'text-green-400'
            else if (status === 'wrong') colorClass = 'text-red-400 bg-red-500/10 rounded px-0.5'
            else if (status === 'skipped') colorClass = 'text-yellow-500/70 line-through'
            else if (status === 'current') colorClass = 'text-primary-300 underline decoration-2 decoration-primary-400 underline-offset-4 animate-pulse'

            const canClick = phase !== 'reading'
            const cleanW = word.replace(/[^\w'-]/g, '').toLowerCase()

            return (
              <span
                key={idx}
                onClick={canClick && cleanW.length >= 2 ? (e: React.MouseEvent) => {
                  const rect = karaokeRef.current?.getBoundingClientRect()
                  if (!rect) return
                  const sentences = passage.content.split(/[.!?]+/)
                  const ctx = sentences.find(s => s.toLowerCase().includes(cleanW)) || ''
                  setSelectedWord({
                    word: cleanW,
                    position: { x: e.clientX, y: e.clientY },
                    context: ctx.trim(),
                  })
                } : undefined}
                className={`transition-all duration-300 ${colorClass} ${canClick && cleanW.length >= 2 ? 'cursor-pointer hover:bg-primary-500/15' : ''}`}
              >
                {word}{' '}
              </span>
            )
          })}
        </div>

        {/* Word Popup */}
        {selectedWord && (
          <WordPopup
            word={selectedWord.word}
            vocabData={null}
            context={selectedWord.context}
            position={selectedWord.position}
            containerWidth={karaokeRef.current?.offsetWidth || 600}
            onClose={() => setSelectedWord(null)}
            onSave={() => {}}
          />
        )}

        {/* Progress bar */}
        {phase !== 'idle' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-surface-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${passageWords.length > 0 ? (matchIndexRef.current / passageWords.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-surface-200/40 shrink-0">
                {matchIndexRef.current}/{passageWords.length}
              </span>
            </div>

            {/* Live stats */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-green-400">✓ {correctCount}</span>
              <span className="text-red-400">✗ {wrongCount}</span>
              <span className="text-yellow-500">↷ {skippedCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {phase !== 'idle' && (
        <div className="flex items-center gap-4 text-[10px] text-surface-200/40 px-1">
          <span><span className="text-green-400">■</span> Đọc đúng</span>
          <span><span className="text-red-400">■</span> Đọc sai</span>
          <span><span className="text-yellow-500">■</span> Bỏ qua</span>
          <span><span className="text-primary-300">■</span> Từ hiện tại</span>
        </div>
      )}

      {/* Controls */}
      <div className="glass-card p-5 flex flex-col items-center gap-3">
        {phase === 'idle' && (
          <button
            onClick={handleStart}
            className="w-20 h-20 rounded-full gradient-bg shadow-lg shadow-primary-500/20 flex items-center justify-center hover:opacity-90 transition-all"
          >
            <Mic className="w-8 h-8 text-white" />
          </button>
        )}

        {phase === 'reading' && (
          <button
            onClick={handleStop}
            className="w-20 h-20 rounded-full bg-red-500 shadow-lg shadow-red-500/30 animate-pulse flex items-center justify-center hover:bg-red-600 transition-all"
          >
            <MicOff className="w-8 h-8 text-white" />
          </button>
        )}

        {phase === 'done' && isTranscribing && (
          <div className="flex items-center gap-2 text-xs text-surface-200/40">
            <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
            Đang nhận dạng giọng nói...
          </div>
        )}

        <p className="text-xs text-surface-200/40">
          {phase === 'idle' ? 'Nhấn để bắt đầu đọc' :
           phase === 'reading' ? `Đang ghi âm — ${formatTime(elapsedSec)}` :
           isTranscribing ? 'Đang xử lý...' : 'Đã ghi xong!'}
        </p>

        {/* Transcript preview */}
        {(finalTranscript || transcript || interimTranscript) && phase === 'done' && (
          <div className="w-full p-3 rounded-xl bg-surface-800/50 border border-surface-700/30">
            <p className="text-[10px] text-surface-200/30 mb-1">Bạn đọc:</p>
            <p className="text-xs text-surface-100">{finalTranscript || transcript || interimTranscript}</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Action buttons */}
      {phase === 'done' && (
        <div className="flex gap-2">
          {/* Retry button */}
          <button
            onClick={handleRetry}
            className="flex-1 py-3 rounded-xl bg-surface-800/50 border border-surface-700/30 text-surface-200/60 font-semibold flex items-center justify-center gap-2 hover:bg-surface-800/70 hover:text-surface-100 transition-all text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Ghi âm lại
          </button>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={evaluating || (!finalTranscript && !transcript)}
            className="flex-1 py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
          >
            {evaluating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang chấm...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Nộp bài
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// Strict word matching: exact or 1 character difference (for minor STT errors)
function wordsMatch(spoken: string, expected: string): boolean {
  if (spoken === expected) return true
  if (spoken.length < 2 || expected.length < 2) return spoken === expected

  // Allow 1 character difference for words > 3 chars
  if (Math.abs(spoken.length - expected.length) > 1) return false
  if (spoken.length <= 3 && expected.length <= 3) return spoken === expected

  let diff = 0
  const maxLen = Math.max(spoken.length, expected.length)
  for (let i = 0; i < maxLen; i++) {
    if (spoken[i] !== expected[i]) diff++
    if (diff > 1) return false
  }
  return true
}
