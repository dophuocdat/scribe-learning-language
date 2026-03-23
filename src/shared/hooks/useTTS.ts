import { useState, useCallback, useRef, useEffect } from 'react'

/*
 * ─── TTS STRATEGY ───────────────────────────────────────────────────
 *
 * Mobile browsers have many issues with speechSynthesis (Web Speech API):
 * - iOS Safari: voices load async, gets stuck, often produces no sound
 * - Android Chrome: ignores lang, limited voices
 * - Both: autoplay policies can block audio
 *
 * Google Translate TTS URL is blocked with 403 when called cross-origin
 * from the browser (needs cookies/referrer from google.com domain).
 *
 * SOLUTION: Supabase Edge Function `/tts?text=word&lang=en` acts as a
 * server-side proxy — fetches audio from Google TTS and returns it from
 * our own Supabase domain. No CORS issues, works on ALL browsers.
 *
 * Fallback chain:
 * 1. audio_url (if vocabulary has pre-generated audio)
 * 2. Supabase TTS proxy (reliable on all platforms)
 * 3. speechSynthesis (desktop fallback, fast)
 *
 * CRITICAL for mobile: audio.play() must be called SYNCHRONOUSLY
 * from the user gesture (click/tap) call stack. No async/await!
 * ─────────────────────────────────────────────────────────────────────
 */

const IS_MOBILE = typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)

/** Build the Supabase TTS proxy URL */
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
  const lastCallRef = useRef(0) // cooldown debounce timestamp

  // Pre-load voices for desktop speechSynthesis
  useEffect(() => {
    if (!window.speechSynthesis) return

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) {
        voicesRef.current = v
        voicesLoadedRef.current = true
      }
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
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

      // Do NOT set crossOrigin — it triggers CORS preflight which
      // many audio servers (including our Supabase proxy) handle fine,
      // but it's unnecessary and can cause issues with some CDNs.
      const audio = new Audio(url)
      audio.playbackRate = rate
      audio.volume = 1
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        audioRef.current = null
      }

      audio.onerror = () => {
        setIsSpeaking(false)
        audioRef.current = null
        if (onFail) onFail()
      }

      // CRITICAL: Call play() IMMEDIATELY — synchronous from user gesture.
      // Do not defer to canplaythrough or any other event.
      const promise = audio.play()
      if (promise) {
        promise
          .then(() => setIsSpeaking(true))
          .catch(() => {
            setIsSpeaking(false)
            audioRef.current = null
            if (onFail) onFail()
          })
      }
    },
    [stop]
  )

  /* ─── SPEAK WITH BROWSER TTS (desktop only) ────────────────────── */

  const speakWithBrowserTTS = useCallback(
    (text: string, rate: number = 1) => {
      if (!window.speechSynthesis) return

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

  /* ─── SPEAK (SYNCHRONOUS — no async/await!) ────────────────────── */

  const speak = useCallback(
    (text: string, rate: number = 1) => {
      stop()

      if (IS_MOBILE) {
        // MOBILE: Use Supabase TTS proxy (server-side, reliable)
        // Fallback: try speechSynthesis if proxy fails
        const url = getTTSProxyUrl(text)
        playUrl(url, rate, () => speakWithBrowserTTS(text, rate))
      } else {
        // DESKTOP: Use speechSynthesis (fast, works well)
        // Fallback: Supabase TTS proxy
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

  /* ─── SMART SPEAK WORD (SYNCHRONOUS + 500ms COOLDOWN) ──────────── */

  const speakWord = useCallback(
    (word: string, audioUrl: string | null | undefined, rate: number = 1) => {
      // 500ms cooldown to prevent spam calls to edge function
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
