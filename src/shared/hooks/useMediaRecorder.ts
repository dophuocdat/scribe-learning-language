import { useState, useCallback, useRef } from 'react'

/*
 * ─── MEDIA RECORDER HOOK ──────────────────────────────────────
 *
 * Cross-browser audio recording using MediaRecorder API.
 * Outputs WebM/Opus (Chrome/Firefox) or MP4/AAC (Safari).
 * ─────────────────────────────────────────────────────────────
 */

/** Get best supported MIME type */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }

  return 'audio/webm' // fallback
}

export function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      })

      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })

      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)

        setAudioBlob(blob)
        setAudioUrl(url)
        setIsRecording(false)

        // Clean up timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }

      recorder.onerror = () => {
        setError('Recording failed')
        setIsRecording(false)
      }

      mediaRecorderRef.current = recorder
      recorder.start(100) // Collect data every 100ms

      startTimeRef.current = Date.now()
      setIsRecording(true)

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch (err) {
      const msg = (err as Error).message
      console.error('[MediaRecorder] Failed to start:', msg)

      if (msg.includes('Permission denied') || msg.includes('NotAllowed')) {
        setError('Vui lòng cho phép truy cập microphone')
      } else {
        setError(`Không thể ghi âm: ${msg}`)
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    stopRecording()

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setIsRecording(false)
    setError(null)

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [stopRecording, audioUrl])

  return {
    // State
    isRecording,
    audioBlob,
    audioUrl,
    duration,
    error,

    // Actions
    startRecording,
    stopRecording,
    reset,
  }
}
