/**
 * TTS Service — Constants and utilities for Text-to-Speech
 *
 * Audio playback is handled by `useTTS` hook (`@/shared/hooks/useTTS.ts`)
 * which already manages mobile (Supabase TTS proxy) vs desktop (speechSynthesis).
 *
 * This file provides:
 * - Speed/accent presets for the UI
 * - Long text chunking for the TTS proxy (200 char limit per request)
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
  { value: 'en-US', label: '🇺🇸 US', desc: 'American English' },
  { value: 'en-GB', label: '🇬🇧 UK', desc: 'British English' },
  { value: 'en-AU', label: '🇦🇺 AU', desc: 'Australian English' },
]

/**
 * Split long text into chunks that fit the TTS proxy's 200-char limit.
 * Splits on sentence boundaries where possible.
 */
export function chunkText(text: string, maxLen = 190): string[] {
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
