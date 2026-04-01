import { useState, useCallback, useEffect } from 'react'
import { Mic, MicOff, Send, Volume2, AlertCircle, BookOpen } from 'lucide-react'
import { useSpeakingStore, type PronunciationContent } from '../stores/speakingStore'
import { useSTT } from '@/shared/hooks/useSTT'
import { useMediaRecorder } from '@/shared/hooks/useMediaRecorder'
import { useTTS } from '@/shared/hooks/useTTS'

export function PronunciationExercise() {
  const { content, evaluating, error, submitAnswer, clearError, batchItems, currentBatchIndex } = useSpeakingStore()
  const pronContent = content as PronunciationContent
  const { startListening, stopListening, transcribeAudio, transcript, interimTranscript, isTranscribing, isSupported, reset: resetSTT } = useSTT()
  const { startRecording, stopRecording, audioBlob } = useMediaRecorder()
  const { speak, isSpeaking } = useTTS()

  const [userText, setUserText] = useState('')
  const [recordingMode, setRecordingMode] = useState<'idle' | 'recording' | 'done'>('idle')

  if (!pronContent) return null

  const handlePlayModel = () => {
    speak(pronContent.sentence)
  }

  const handleStartRecording = useCallback(() => {
    clearError()
    resetSTT()
    setUserText('')
    setRecordingMode('recording')

    // Always use MediaRecorder for reliable audio capture
    startRecording()

    // Additionally try Web Speech API for real-time transcript preview
    // If it fails (Edge, some browsers), it's fine — we still have the recording
    if (isSupported) {
      try { startListening('en-US') } catch { /* ignore */ }
    }
  }, [clearError, resetSTT, isSupported, startListening, startRecording])

  const handleStopRecording = useCallback(() => {
    setRecordingMode('done')
    stopRecording()
    if (isSupported) {
      try { stopListening() } catch { /* ignore */ }
    }
  }, [isSupported, stopListening, stopRecording])

  // When recording stops and audioBlob is available, transcribe via Whisper
  // (unless Web Speech API already got a transcript)
  useEffect(() => {
    if (recordingMode === 'done' && audioBlob && !transcript && !userText && !isTranscribing) {
      transcribeAudio(audioBlob, 'en').then(text => {
        if (text) setUserText(text)
      })
    }
  }, [recordingMode, audioBlob, transcript, userText, isTranscribing, transcribeAudio])

  // If Web Speech API got a transcript, use it immediately
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

      {/* Target Sentence */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-medium text-surface-50 leading-relaxed">{pronContent.sentence}</p>
            <p className="text-xs text-surface-200/40 mt-1">{pronContent.sentence_vi}</p>
          </div>

          {/* Play Model Button */}
          <button
            onClick={handlePlayModel}
            disabled={isSpeaking}
            className="p-2.5 rounded-xl gradient-bg text-white hover:opacity-90 transition-all shrink-0 disabled:opacity-50"
            title="Nghe mẫu"
          >
            <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
          </button>
        </div>

        {/* IPA */}
        <p className="text-xs text-primary-300/60 font-mono">{pronContent.phonetic_guide}</p>
      </div>

      {/* Key Sounds Guide */}
      <div className="glass-card p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-surface-200/40">
          <BookOpen className="w-3.5 h-3.5 text-primary-400 shrink-0" />
          <span className="font-medium">Lưu ý phát âm</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {pronContent.key_sounds?.map((s, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-primary-500/5">
              <span className="text-xs font-bold text-primary-300 font-mono min-w-[60px]">{s.ipa}</span>
              <span className="text-[10px] text-surface-200/60">{s.tip_vi}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recording Area */}
      <div className="glass-card p-5 flex flex-col items-center gap-4">
        {/* Mic Button */}
        <button
          onClick={recordingMode === 'recording' ? handleStopRecording : handleStartRecording}
          disabled={isTranscribing}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
            recordingMode === 'recording'
              ? 'bg-red-500 shadow-red-500/30 animate-pulse hover:bg-red-600'
              : 'gradient-bg shadow-primary-500/20 hover:opacity-90'
          }`}
        >
          {isTranscribing ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : recordingMode === 'recording' ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>

        <p className="text-xs text-surface-200/40">
          {isTranscribing ? 'Đang nhận dạng...' :
           recordingMode === 'recording' ? 'Đang ghi âm — Nhấn để dừng' :
           recordingMode === 'done' ? 'Đã ghi xong!' :
           'Nhấn để bắt đầu ghi âm'}
        </p>

        {/* Live Transcript */}
        {displayTranscript && (
          <div className="w-full p-3 rounded-xl bg-surface-800/50 border border-surface-700/30">
            <p className="text-xs text-surface-200/30 mb-1">Bạn nói:</p>
            <p className="text-sm text-surface-100">
              {displayTranscript}
              {interimTranscript && <span className="text-surface-200/30 ml-1">...</span>}
            </p>
          </div>
        )}

        {/* Manual input fallback */}
        {recordingMode === 'done' && !displayTranscript && (
          <div className="w-full">
            <p className="text-[10px] text-surface-200/30 mb-1">Không nhận được giọng nói? Gõ thủ công:</p>
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
            AI đang chấm phát âm...
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
