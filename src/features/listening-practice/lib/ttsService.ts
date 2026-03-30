/**
 * TTS Service — Constants and utilities for Text-to-Speech
 *
 * Audio playback is handled by `useTTS` hook (`@/shared/hooks/useTTS.ts`)
 * which uses the Coqui VITS + Piper TTS engines (Hugging Face Space)
 * with fallback to Google TTS proxy and Web Speech API.
 *
 * This file provides:
 * - Speed/accent presets for the UI
 * - Voice configuration (Piper + VITS curated)
 * - Long text chunking
 */

// ===== Speed presets =====

export const SPEED_PRESETS = [
  { value: 0.5, label: '0.5x', desc: 'Rất chậm' },
  { value: 0.75, label: '0.75x', desc: 'Chậm' },
  { value: 1.0, label: '1x', desc: 'Bình thường' },
  { value: 1.25, label: '1.25x', desc: 'Nhanh' },
  { value: 1.5, label: '1.5x', desc: 'Rất nhanh' },
]

// ===== Accent presets =====

export const ACCENT_PRESETS = [
  { value: 'en-US', label: '🇺🇸 US', desc: 'American English', speaker: 'p243' },
  { value: 'en-GB', label: '🇬🇧 UK', desc: 'British English', speaker: 'p225' },
  { value: 'en-AU', label: '🇦🇺 AU', desc: 'Australian English', speaker: 'p245' },
]

// ===== Voice Configuration (Piper + VITS curated) =====

export type TTSEngine = 'piper' | 'vits'

export interface VoiceOption {
  id: string
  engine: TTSEngine
  label: string
  gender: 'M' | 'F'
  accent: string
  desc: string
}

/** Curated voice list — Piper first (natural & fast), best VITS voices after */
export const VOICE_LIST: VoiceOption[] = [
  // ─── Piper voices (natural, fastest ~0.3-0.5s) ─────────
  { id: 'amy',  engine: 'piper', label: 'Amy',  gender: 'F', accent: 'US',      desc: 'Nữ Mỹ — Tự nhiên, rõ ràng' },
  { id: 'ryan', engine: 'piper', label: 'Ryan', gender: 'M', accent: 'US',      desc: 'Nam Mỹ — Ấm, chuyên nghiệp' },
  // ─── VITS voices (109 voices, ~2-6s) ────────────────────
  { id: 'p225', engine: 'vits',  label: 'Emma',    gender: 'F', accent: 'British', desc: 'Nữ Anh — Rõ ràng, phù hợp learning' },
  { id: 'p226', engine: 'vits',  label: 'Oliver',  gender: 'M', accent: 'British', desc: 'Nam Anh — Giọng ấm' },
  { id: 'p243', engine: 'vits',  label: 'James',   gender: 'M', accent: 'British', desc: 'Nam — Trung tính, rõ ràng' },
  { id: 'p232', engine: 'vits',  label: 'William', gender: 'M', accent: 'British', desc: 'Nam — Trầm, chuyên nghiệp' },
]

/** Default voice for new users */
export const DEFAULT_VOICE = 'amy'

/**
 * Split long text into chunks that fit TTS limits.
 * Coqui VITS handles up to 500 chars, Google TTS only 200.
 * Splits on sentence boundaries where possible.
 */
export function chunkText(text: string, maxLen = 450): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}
