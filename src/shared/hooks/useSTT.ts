import { useState, useCallback, useRef } from 'react'

/*
 * ─── STT STRATEGY ───────────────────────────────────────────────
 *
 * Fallback chain:
 *   1. 🗣️ Web Speech API — free, real-time, Chrome/Android
 *   2. 🤖 HF Space Whisper — accurate, all platforms, ~2-3s
 *
 * Priority: Web Speech API (if supported) > HF Space Whisper
 *
 * iOS Safari does NOT support Web Speech Recognition.
 * On iOS → automatically uses HF Whisper endpoint.
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

export function useSTT() {
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const isSupported = isSpeechRecognitionSupported()

  /* ─── Web Speech API: Real-time STT ─────────────────────────── */

  const startListening = useCallback(
    (lang: string = 'en-US', onInterim?: (text: string) => void) => {
      const SpeechRecognitionClass = getSpeechRecognition()
      if (!SpeechRecognitionClass) {
        setError('Speech Recognition not supported in this browser')
        return
      }

      // Stop any existing
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch { /* ignore */ }
      }

      const recognition = new SpeechRecognitionClass()
      recognition.lang = lang
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
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
        // Silently ignore common non-critical errors:
        // - no-speech: user didn't speak
        // - aborted: recognition was stopped programmatically
        // - not-allowed: mic permission issue (we have MediaRecorder fallback)
        const silentErrors = ['no-speech', 'aborted', 'not-allowed']
        if (!silentErrors.includes(event.error)) {
          setError(`Speech recognition error: ${event.error}`)
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        setInterimTranscript('')
      }

      recognitionRef.current = recognition
      recognition.start()
    },
    []
  )

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  /* ─── HF Space Whisper: File-based STT ──────────────────────── */

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
        setError(msg)
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
    isSupported,
    error,

    // Actions
    startListening,
    stopListening,
    transcribeAudio,
    reset,
  }
}
