import { useState, useCallback, useRef } from 'react'

/**
 * Custom hook for Text-to-Speech using the Web Speech API.
 * Falls back to audio_url if available, otherwise uses browser TTS.
 */
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  /**
   * Speak text using Web Speech API
   */
  const speak = useCallback(
    (text: string, rate: number = 1) => {
      if (!window.speechSynthesis) return
      stop()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = rate
      utterance.pitch = 1

      // Try to pick a good English voice
      const voices = window.speechSynthesis.getVoices()
      const englishVoice = voices.find(
        (v) => v.lang.startsWith('en') && v.name.includes('Google')
      ) || voices.find((v) => v.lang.startsWith('en'))
      if (englishVoice) utterance.voice = englishVoice

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      window.speechSynthesis.speak(utterance)
    },
    [stop]
  )

  /**
   * Play an audio file with adjustable speed
   */
  const playAudio = useCallback(
    (url: string, rate: number = 1) => {
      stop()
      const audio = new Audio(url)
      audio.playbackRate = rate
      audioRef.current = audio

      audio.onplay = () => setIsSpeaking(true)
      audio.onended = () => {
        setIsSpeaking(false)
        audioRef.current = null
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        audioRef.current = null
      }

      audio.play().catch(() => setIsSpeaking(false))
    },
    [stop]
  )

  /**
   * Smart speak: prefers audio_url, falls back to Web Speech API TTS
   */
  const speakWord = useCallback(
    (word: string, audioUrl: string | null | undefined, rate: number = 1) => {
      if (audioUrl) {
        playAudio(audioUrl, rate)
      } else {
        speak(word, rate)
      }
    },
    [playAudio, speak]
  )

  return { speak, playAudio, speakWord, isSpeaking, stop }
}

/**
 * Speed control constants
 */
export const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
] as const

export const DEFAULT_SPEED = 1
