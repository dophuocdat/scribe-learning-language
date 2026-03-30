import { useState, useCallback, useRef, useEffect } from 'react'

/*
 * ─── TTS STRATEGY (v5) ────────────────────────────────────────────────
 *
 * Problem history:
 * - speechSynthesis: unreliable on mobile (no sound)
 * - Google TTS URL directly: CORS blocked (403)
 * - Supabase TTS proxy: 401 because verify_jwt was still enabled
 *
 * Fix (v5):
 * - TTS proxy redeployed via MCP with verify_jwt=false (CONFIRMED)
 * - On mobile: use TTS proxy (no auth needed now)
 * - On desktop: use speechSynthesis (fast, local)
 * - audio_url takes priority if available
 *
 * CRITICAL: audio.play() must be SYNCHRONOUS from user gesture.
 * ─────────────────────────────────────────────────────────────────────
 */

const IS_MOBILE = typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)

/** Build the Supabase TTS proxy URL — NO auth needed */
function getTTSProxyUrl(text: string, lang = 'en'): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const encoded = encodeURIComponent(text.slice(0, 200))
  return `${supabaseUrl}/functions/v1/tts?text=${encoded}&lang=${lang}`
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const voicesLoadedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCallRef = useRef(0)

  // Pre-load voices for speechSynthesis
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) {
        voicesRef.current = v
        voicesLoadedRef.current = true
      }
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    setTimeout(loadVoices, 100)
    setTimeout(loadVoices, 500)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  /* ─── STOP ─────────────────────────────────────────────────────── */

  const stop = useCallback(() => {
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }

    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      } catch { /* ignore */ }
      audioRef.current = null
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setIsSpeaking(false)
  }, [])

  /* ─── PLAY AUDIO URL (synchronous — preserves user gesture) ────── */

  const playUrl = useCallback(
    (url: string, rate: number = 1, onFail?: () => void) => {
      stop()

      const audio = new Audio(url)
      audio.playbackRate = rate
      audio.volume = 1
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        audioRef.current = null
      }

      audio.onerror = () => {
        console.warn('[TTS] Audio playback failed, trying fallback')
        setIsSpeaking(false)
        audioRef.current = null
        if (onFail) onFail()
      }

      // CRITICAL: Call play() IMMEDIATELY — synchronous from user gesture
      const promise = audio.play()
      if (promise) {
        promise
          .then(() => setIsSpeaking(true))
          .catch(() => {
            console.warn('[TTS] audio.play() rejected')
            setIsSpeaking(false)
            audioRef.current = null
            if (onFail) onFail()
          })
      }
    },
    [stop]
  )

  /* ─── SPEAK WITH BROWSER TTS (desktop) ─────────────────────────── */

  const speakWithBrowserTTS = useCallback(
    (text: string, rate: number = 1) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = rate
      utterance.pitch = 1
      utterance.volume = 1

      const voices = voicesLoadedRef.current
        ? voicesRef.current
        : window.speechSynthesis.getVoices()

      const voice =
        voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google')) ||
        voices.find((v) => v.lang.startsWith('en') && v.localService) ||
        voices.find((v) => v.lang.startsWith('en'))

      if (voice) utterance.voice = voice

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      }

      window.speechSynthesis.speak(utterance)

      // iOS workaround: pause/resume every 10s
      timerRef.current = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          setIsSpeaking(false)
          return
        }
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }, 10000)
    },
    []
  )

  /* ─── SPEAK (SYNCHRONOUS!) ─────────────────────────────────────── */

  const speak = useCallback(
    (text: string, rate: number = 1) => {
      stop()

      if (IS_MOBILE) {
        // MOBILE: Use Supabase TTS proxy (verify_jwt=false, no auth needed)
        // Fallback to speechSynthesis if proxy fails
        const url = getTTSProxyUrl(text)
        playUrl(url, rate, () => {
          console.warn('[TTS] Proxy failed, trying speechSynthesis')
          speakWithBrowserTTS(text, rate)
        })
      } else {
        // DESKTOP: Use speechSynthesis (fast, reliable)
        if (window.speechSynthesis) {
          speakWithBrowserTTS(text, rate)
        } else {
          playUrl(getTTSProxyUrl(text), rate)
        }
      }
    },
    [stop, playUrl, speakWithBrowserTTS]
  )

  /* ─── PLAY AUDIO FILE (with TTS fallback) ──────────────────────── */

  const playAudio = useCallback(
    (url: string, rate: number = 1, fallbackText?: string) => {
      stop()
      playUrl(url, rate, fallbackText ? () => speak(fallbackText, rate) : undefined)
    },
    [stop, playUrl, speak]
  )

  /* ─── SMART SPEAK WORD (500ms COOLDOWN) ────────────────────────── */

  const speakWord = useCallback(
    (word: string, audioUrl: string | null | undefined, rate: number = 1) => {
      // 500ms cooldown
      const now = Date.now()
      if (now - lastCallRef.current < 500) return
      lastCallRef.current = now

      if (audioUrl) {
        playAudio(audioUrl, rate, word)
      } else {
        speak(word, rate)
      }
    },
    [playAudio, speak]
  )

  return { speak, playAudio, speakWord, isSpeaking, stop }
}

/* ─── SPEED CONTROL CONSTANTS ───────────────────────────────────── */

export const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
] as const

export const DEFAULT_SPEED = 1
