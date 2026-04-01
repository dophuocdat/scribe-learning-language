import { useState, useCallback, useEffect } from 'react'
import { Mic, MicOff, Send, Volume2, AlertCircle, Zap, Gauge } from 'lucide-react'
import { useSpeakingStore, type ShadowingContent } from '../stores/speakingStore'
import { useSTT } from '@/shared/hooks/useSTT'
import { useMediaRecorder } from '@/shared/hooks/useMediaRecorder'
import { useTTS } from '@/shared/hooks/useTTS'

const SPEED_PRESETS = [
  { value: 0.5, label: '0.5x', color: 'text-blue-400' },
  { value: 0.75, label: '0.75x', color: 'text-cyan-400' },
  { value: 1, label: '1x', color: 'text-green-400' },
  { value: 1.25, label: '1.25x', color: 'text-orange-400' },
]

export function ShadowingExercise() {
  const { content, evaluating, error, submitAnswer, clearError, batchItems, currentBatchIndex } = useSpeakingStore()
  const shadowContent = content as ShadowingContent
  const { startListening, stopListening, transcribeAudio, transcript, interimTranscript, isTranscribing, isSupported, reset: resetSTT } = useSTT()
  const { startRecording, stopRecording, audioBlob } = useMediaRecorder()
  const { speak, isSpeaking, stop: stopTTS } = useTTS()

  const [userText, setUserText] = useState('')
  const [phase, setPhase] = useState<'listen' | 'record' | 'done'>('listen')
  const [speed, setSpeed] = useState(1)

  if (!shadowContent) return null

  const handlePlayModel = (rate?: number) => {
    const playRate = rate ?? speed
    speak(shadowContent.sentence, playRate)
  }

  const handleStartRecording = useCallback(() => {
    clearError()
    resetSTT()
    setUserText('')
    setPhase('record')

    // Always use MediaRecorder for reliable audio capture
    startRecording()

    // Additionally try Web Speech API for real-time transcript preview
    if (isSupported) {
      try { startListening('en-US') } catch { /* ignore */ }
    }
  }, [clearError, resetSTT, isSupported, startListening, startRecording])

  const handleStopRecording = useCallback(() => {
    setPhase('done')
    stopRecording()
    if (isSupported) {
      try { stopListening() } catch { /* ignore */ }
    }
  }, [isSupported, stopListening, stopRecording])

  // When recording stops, transcribe via Whisper (unless Web Speech got it)
  useEffect(() => {
    if (phase === 'done' && audioBlob && !transcript && !userText && !isTranscribing) {
      transcribeAudio(audioBlob, 'en').then(text => {
        if (text) setUserText(text)
      })
    }
  }, [phase, audioBlob, transcript, userText, isTranscribing, transcribeAudio])

  // If Web Speech API got a transcript, use it
  useEffect(() => {
    if (transcript && !userText) {
      setUserText(transcript)
    }
  }, [transcript, userText])

  const handleSubmit = async () => {
    const finalText = userText || transcript
    if (!finalText.trim()) return
    await submitAnswer(finalText.trim())
  }

  const displayTranscript = userText || transcript || interimTranscript

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

      {/* Step 1: Listen to model */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs text-surface-200/40">
          <Zap className="w-3.5 h-3.5 text-primary-400" />
          <span className="font-medium">
            {phase === 'listen' ? 'Bước 1: Nghe mẫu' :
             phase === 'record' ? 'Bước 2: Lặp lại' :
             'Bước 3: Kiểm tra'}
          </span>
        </div>

        {/* Play buttons row */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handlePlayModel()}
            disabled={isSpeaking}
            className="px-4 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
            {isSpeaking ? 'Đang phát...' : `Nghe mẫu ${speed !== 1 ? `(${speed}x)` : ''}`}
          </button>

          {/* Slow play button */}
          <button
            onClick={() => handlePlayModel(0.6)}
            disabled={isSpeaking}
            className="px-3 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-300 text-xs font-medium flex items-center gap-1.5 hover:bg-blue-500/25 transition-all disabled:opacity-50"
            title="Nghe chậm 0.6x"
          >
            <Gauge className="w-3.5 h-3.5" />
            Nghe chậm
          </button>
        </div>

        {/* Speed presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-surface-200/30 mr-1">Tốc độ:</span>
          {SPEED_PRESETS.map(s => (
            <button
              key={s.value}
              onClick={() => { setSpeed(s.value); stopTTS() }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                speed === s.value
                  ? `bg-primary-500/20 ${s.color} border border-primary-500/30`
                  : 'bg-surface-800/40 text-surface-200/30 hover:bg-surface-800/60'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Show stress pattern after first listen */}
        {phase !== 'listen' && shadowContent.stress_pattern && (
          <p className="text-xs text-surface-200/50 italic">
            {shadowContent.stress_pattern}
          </p>
        )}

        {/* Show sentence only after recording (shadowing = don't see text while listening) */}
        {phase === 'done' && (
          <div className="pt-2 border-t border-surface-800/30">
            <p className="text-sm text-surface-100">{shadowContent.sentence}</p>
            <p className="text-xs text-surface-200/30 mt-1">{shadowContent.sentence_vi}</p>
            {shadowContent.phonetic_guide && (
              <p className="text-xs text-primary-300/40 font-mono mt-1">{shadowContent.phonetic_guide}</p>
            )}
          </div>
        )}

        {/* Speed info */}
        <p className="text-[10px] text-surface-200/20">
          Tốc độ mẫu: ~{shadowContent.speed_wpm || 120} WPM
        </p>
      </div>

      {/* Recording Area */}
      <div className="glass-card p-5 flex flex-col items-center gap-4">
        <button
          onClick={phase === 'record' ? handleStopRecording : handleStartRecording}
          disabled={isTranscribing}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
            phase === 'record'
              ? 'bg-red-500 shadow-red-500/30 animate-pulse hover:bg-red-600'
              : 'gradient-bg shadow-primary-500/20 hover:opacity-90'
          }`}
        >
          {isTranscribing ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : phase === 'record' ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>

        <p className="text-xs text-surface-200/40">
          {isTranscribing ? 'Đang nhận dạng...' :
           phase === 'record' ? 'Đang ghi âm — Nhấn để dừng' :
           phase === 'done' ? 'Đã ghi xong!' :
           'Nghe mẫu trước, sau đó nhấn để ghi âm'}
        </p>

        {/* Transcript */}
        {displayTranscript && (
          <div className="w-full p-3 rounded-xl bg-surface-800/50 border border-surface-700/30">
            <p className="text-xs text-surface-200/30 mb-1">Bạn nói:</p>
            <p className="text-sm text-surface-100">{displayTranscript}</p>
          </div>
        )}

        {/* Manual fallback */}
        {phase === 'done' && !displayTranscript && (
          <div className="w-full">
            <p className="text-[10px] text-surface-200/30 mb-1">Gõ thủ công:</p>
            <input
              type="text"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Gõ câu bạn đã nói..."
              className="w-full px-3 py-2 rounded-lg bg-surface-800/50 border border-surface-700/30 text-sm text-surface-100 placeholder-surface-200/20 outline-none focus:border-primary-500/50"
            />
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

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={evaluating || (!userText && !transcript)}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {evaluating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang chấm...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" /> Nộp bài
          </>
        )}
      </button>
    </div>
  )
}
