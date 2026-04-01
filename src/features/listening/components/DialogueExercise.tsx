import { useState } from 'react'
import { Send, AlertCircle, Users, Play, Pause, Eye, EyeOff } from 'lucide-react'
import { useListeningStore, type DialogueContent } from '../stores/listeningStore'
import { useTTS } from '@/shared/hooks/useTTS'

export function DialogueExercise() {
  const { content, evaluating, error, submitAnswer, clearError, batchItems, currentBatchIndex } = useListeningStore()
  const dialogueContent = content as DialogueContent
  if (!dialogueContent) return null

  const { speak, isSpeaking, stop } = useTTS()
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [showTranscript, setShowTranscript] = useState(false)
  const [playingLine, setPlayingLine] = useState(-1)

  // Play all dialogue lines sequentially with natural pauses
  const handlePlayAll = async () => {
    if (isSpeaking) {
      stop()
      setPlayingLine(-1)
      return
    }

    for (let i = 0; i < dialogueContent.dialogue.length; i++) {
      const line = dialogueContent.dialogue[i]
      const prevLine = i > 0 ? dialogueContent.dialogue[i - 1] : null
      setPlayingLine(i)

      // Pause between lines — longer between different speakers (turn-taking)
      if (i > 0) {
        const isSpeakerSwitch = prevLine && prevLine.speaker !== line.speaker
        const pauseMs = isSpeakerSwitch ? 1200 : 600
        await new Promise(r => setTimeout(r, pauseMs))
      }

      // Use slightly different speed per speaker for audible distinction
      const speed = line.speaker === 'A' ? 1.0 : 0.95
      speak(line.text, speed)

      // Wait for speech to finish (better estimate: ~90ms per char + base)
      const waitMs = Math.max(1800, line.text.length * 90 + 500)
      await new Promise(r => setTimeout(r, waitMs))
    }
    setPlayingLine(-1)
  }

  const handlePlayLine = (index: number) => {
    if (isSpeaking) {
      stop()
      setPlayingLine(-1)
      return
    }
    setPlayingLine(index)
    const line = dialogueContent.dialogue[index]
    speak(line.text, 1.0)
    const waitMs = Math.max(1000, line.text.length * 80)
    setTimeout(() => setPlayingLine(-1), waitMs)
  }

  const handleSubmit = async () => {
    clearError()
    await submitAnswer(answers)
  }

  const allAnswered = dialogueContent.questions.every((_, i) => answers[i]?.trim())

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

      {/* Scenario */}
      <div className="glass-card p-4 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">{dialogueContent.scenario_vi}</span>
        </div>
        <div className="flex gap-4 text-xs text-surface-200/40">
          <span>🅰️ {dialogueContent.speaker_a}</span>
          <span>🅱️ {dialogueContent.speaker_b}</span>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayAll}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
              isSpeaking
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'gradient-bg text-white hover:opacity-90'
            }`}
          >
            {isSpeaking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isSpeaking ? 'Dừng' : 'Nghe hội thoại'}
          </button>

          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="px-3 py-2.5 rounded-xl text-xs text-surface-200/60 hover:text-surface-50 bg-surface-800/30 hover:bg-surface-800/60 flex items-center gap-1.5 transition-all"
          >
            {showTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showTranscript ? 'Ẩn transcript' : 'Xem transcript'}
          </button>
        </div>

        {/* Transcript (hidden by default) */}
        {showTranscript && (
          <div className="mt-3 space-y-2 pt-3 border-t border-surface-800">
            {dialogueContent.dialogue.map((line, i) => (
              <div
                key={i}
                className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                  playingLine === i ? 'bg-primary-500/10' : 'hover:bg-surface-800/30'
                }`}
                onClick={() => handlePlayLine(i)}
              >
                <span className={`text-xs font-bold shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  line.speaker === 'A' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                }`}>
                  {line.speaker}
                </span>
                <p className={`text-sm ${playingLine === i ? 'text-primary-300' : 'text-surface-200/70'}`}>
                  {line.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-3">
        <p className="text-xs text-surface-200/40 font-medium">
          📋 Trả lời {dialogueContent.questions.length} câu hỏi
        </p>

        {dialogueContent.questions.map((q, i) => (
          <div key={i} className="glass-card p-4">
            <p className="text-sm font-medium text-surface-50 mb-1">{q.question}</p>
            <p className="text-[11px] text-surface-200/40 mb-3">{q.question_vi}</p>

            {q.type === 'multiple_choice' && q.options ? (
              <div className="space-y-1.5">
                {q.options.map((opt, optIdx) => (
                  <button
                    key={optIdx}
                    onClick={() => setAnswers(prev => ({ ...prev, [i]: opt }))}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs transition-all ${
                      answers[i] === opt
                        ? 'gradient-bg text-white'
                        : 'bg-surface-800/30 text-surface-200/60 hover:bg-surface-800/60 hover:text-surface-50'
                    }`}
                  >
                    {String.fromCharCode(65 + optIdx)}. {opt}
                  </button>
                ))}
              </div>
            ) : q.type === 'true_false' ? (
              <div className="flex gap-2">
                {['True', 'False'].map(val => (
                  <button
                    key={val}
                    onClick={() => setAnswers(prev => ({ ...prev, [i]: val }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      answers[i] === val
                        ? val === 'True' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-surface-800/30 text-surface-200/60 hover:bg-surface-800/60 border border-transparent'
                    }`}
                  >
                    {val === 'True' ? '✅ Đúng' : '❌ Sai'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
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
        disabled={evaluating || !allAnswered}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {evaluating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang chấm bài...
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
