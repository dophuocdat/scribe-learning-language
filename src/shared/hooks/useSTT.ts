import { useState, useCallback, useRef } from 'react'

/*
 * ─── STT STRATEGY ───────────────────────────────────────────────
 *
 * The Web Speech API (SpeechRecognition) is UNRELIABLE on mobile:
 * - Android: mic exclusive access conflicts with MediaRecorder
 * - Samsung Internet: partial/no support
 * - iOS Safari: NOT supported at all
 *
 * SOLUTION:
 *   Desktop → Web Speech API (real-time, free)
 *   Mobile  → MediaRecorder only → Whisper on HF Space
 *
 * Components should check `isMobileDevice` and choose:
 *   Mobile:  MediaRecorder → transcribeAudio() after stop
 *   Desktop: startListening() for real-time + MediaRecorder backup
 * ─────────────────────────────────────────────────────────────────
 */

const STT_BASE = 'https://kiro-d-scribe-tts.hf.space'

/** Check if Web Speech API is supported */
function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  )
}

/** Get SpeechRecognition constructor */
function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  )
}

/** Detect mobile device */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry/i.test(navigator.userAgent)
}

export function useSTT() {
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const shouldRestartRef = useRef(false)
  const isSupported = isSpeechRecognitionSupported() && !isMobileDevice()
  // ^ On mobile, we report Web Speech as NOT supported to force Whisper fallback

  /* ─── Web Speech API: Real-time STT (DESKTOP ONLY) ──────────── */

  const startListening = useCallback(
    (lang: string = 'en-US', onInterim?: (text: string) => void) => {
      const SpeechRecognitionClass = getSpeechRecognition()
      if (!SpeechRecognitionClass) {
        setError('Speech Recognition không được hỗ trợ trên trình duyệt này')
        return
      }

      // Stop any existing
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
        recognitionRef.current = null
      }

      const recognition = new SpeechRecognitionClass()
      recognition.lang = lang
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      shouldRestartRef.current = true

      recognition.onstart = () => {
        console.log('[STT] Recognition started')
        setIsListening(true)
        setError(null)
        setTranscript('')
        setInterimTranscript('')
      }

      recognition.onresult = (event: any) => {
        let final = ''
        let interim = ''

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            final += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }

        if (final) setTranscript(final)
        setInterimTranscript(interim)
        if (onInterim) onInterim(interim || final)
      }

      recognition.onerror = (event: any) => {
        console.warn('[STT] Recognition error:', event.error)

        if (event.error === 'not-allowed') {
          setError('Microphone bị chặn. Vào Cài đặt → Quyền trang web → Microphone.')
          shouldRestartRef.current = false
          setIsListening(false)
          return
        }

        // no-speech: just silence, will auto-restart via onend
        if (event.error === 'no-speech' || event.error === 'aborted') return

        setError(`Lỗi nhận dạng giọng nói: ${event.error}`)
        setIsListening(false)
        shouldRestartRef.current = false
      }

      recognition.onend = () => {
        // Auto-restart if user hasn't explicitly stopped
        if (shouldRestartRef.current) {
          try {
            recognition.start()
            return
          } catch { /* fall through */ }
        }
        setIsListening(false)
        setInterimTranscript('')
      }

      recognitionRef.current = recognition

      try {
        recognition.start()
      } catch (err) {
        console.error('[STT] Failed to start:', err)
        setError('Không thể khởi động nhận dạng giọng nói')
        shouldRestartRef.current = false
      }
    },
    []
  )

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  /* ─── HF Space Whisper: File-based STT (ALL PLATFORMS) ──────── */

  const transcribeAudio = useCallback(
    async (audioBlob: Blob, lang: string = 'en'): Promise<string> => {
      setIsTranscribing(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('file', audioBlob, 'recording.webm')
        formData.append('lang', lang)

        const response = await fetch(`${STT_BASE}/api/stt`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`STT server returned ${response.status}`)
        }

        const data = await response.json()
        const text = data.text || ''

        setTranscript(text)
        setIsTranscribing(false)
        return text
      } catch (err) {
        const msg = (err as Error).message
        console.error('[STT] Whisper transcription failed:', msg)
        setError(`Lỗi chuyển giọng nói: ${msg}`)
        setIsTranscribing(false)
        return ''
      }
    },
    []
  )

  /* ─── Reset ─────────────────────────────────────────────────── */

  const reset = useCallback(() => {
    stopListening()
    setTranscript('')
    setInterimTranscript('')
    setError(null)
    setIsTranscribing(false)
  }, [stopListening])

  return {
    // State
    transcript,
    interimTranscript,
    isListening,
    isTranscribing,
    isSupported, // false on mobile → forces MediaRecorder + Whisper path
    error,

    // Actions
    startListening,  // Desktop only
    stopListening,
    transcribeAudio, // Works everywhere (sends to Whisper)
    reset,
  }
}
