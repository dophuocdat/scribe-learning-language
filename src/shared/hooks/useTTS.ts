import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuthStore } from '@/features/auth/stores/authStore'

/*
 * ─── TTS STRATEGY (v6 — Coqui TTS) ───────────────────────────────────
 *
 * Fallback chain:
 *   1. 🐸 Coqui VITS (HF Space) — best quality, 109 voices, ~2-6s
 *   2. 🔊 Google TTS proxy (Supabase) — reliable fallback
 *   3. 🗣️ Web Speech API — browser built-in, always works
 *
 * Priority: audio_url > Coqui TTS > Google TTS > speechSynthesis
 *
 * CRITICAL: audio.play() must be SYNCHRONOUS from user gesture.
 * ─────────────────────────────────────────────────────────────────────
 */

// ─── TTS Configuration ──────────────────────────────────────────
const TTS_BASE = 'https://kiro-d-scribe-tts.hf.space'

/** Piper voice IDs (routed to /api/tts-piper) */
const PIPER_VOICES = new Set(['amy', 'ryan'])

/** VITS speaker mapping per accent (fallback when no voice specified) */
const VITS_SPEAKERS: Record<string, string> = {
  'en-US': 'p243',     // Male, clear US-like
  'en-GB': 'p225',     // Female, British
  'en-AU': 'p245',     // Male, varied accent
  'en-default': 'p225', // Female, clear
}

/** In-memory URL cache to avoid re-generating same text */
const ttsUrlCache = new Map<string, string>()

/** Build TTS URL — auto-routes Piper vs VITS based on voice ID */
function getTTSUrl(text: string, accent = 'en-US', voice?: string): string {
  const encoded = encodeURIComponent(text.slice(0, 500))
  
  // Piper voices → /api/tts-piper
  if (voice && PIPER_VOICES.has(voice)) {
    return `${TTS_BASE}/api/tts-piper?text=${encoded}&voice=${voice}`
  }
  
  // VITS voices → /api/tts
  const speaker = voice || VITS_SPEAKERS[accent] || VITS_SPEAKERS['en-default']
  return `${TTS_BASE}/api/tts?text=${encoded}&speaker=${speaker}`
}

/** Build the Supabase TTS proxy URL — NO auth needed */
function getTTSProxyUrl(text: string, lang = 'en'): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const encoded = encodeURIComponent(text.slice(0, 200))
  return `${supabaseUrl}/functions/v1/tts?text=${encoded}&lang=${lang}`
}

/** Cache key for text+accent */
function cacheKey(text: string, accent: string): string {
  return `${accent}:${text.slice(0, 100)}`
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

  /* ─── SPEAK (v6 — Multi-engine TTS with fallback chain) ────────────── */

  const speak = useCallback(
    (text: string, rate?: number, accent?: string, voice?: string) => {
      // Auto-inject user's saved TTS preferences from profile
      const profile = useAuthStore.getState().profile
      const effectiveVoice = voice ?? profile?.tts_voice ?? 'amy'
      const effectiveAccent = accent ?? profile?.tts_accent ?? 'en-US'
      const effectiveRate = rate ?? profile?.tts_speed ?? 1

      stop()

      const key = cacheKey(text, effectiveAccent + effectiveVoice)

      // ❶ Check in-memory cache
      const cachedUrl = ttsUrlCache.get(key)
      if (cachedUrl) {
        console.log('[TTS] Cache hit')
        playUrl(cachedUrl, effectiveRate)
        return
      }

      // ❷ Try TTS server (auto-routes Piper vs VITS)
      const ttsUrl = getTTSUrl(text, effectiveAccent, effectiveVoice)
      playUrl(ttsUrl, effectiveRate, () => {
        console.warn('[TTS] Primary TTS failed, trying Google TTS proxy')

        // ❸ Fallback: Google TTS proxy (Supabase)
        const googleUrl = getTTSProxyUrl(text)
        playUrl(googleUrl, effectiveRate, () => {
          console.warn('[TTS] Google proxy failed, trying speechSynthesis')

          // ❹ Final fallback: Web Speech API
          speakWithBrowserTTS(text, effectiveRate)
        })
      })

      // Cache the URL (will be used if it succeeds)
      ttsUrlCache.set(key, ttsUrl)

      // Limit cache size
      if (ttsUrlCache.size > 200) {
        const firstKey = ttsUrlCache.keys().next().value
        if (firstKey) ttsUrlCache.delete(firstKey)
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
