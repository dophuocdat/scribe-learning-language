/*
 * ─── SPEECH SCORING UTILITIES ─────────────────────────────────
 *
 * Compare spoken text vs target text for pronunciation scoring.
 * Uses Levenshtein distance with normalization.
 * ─────────────────────────────────────────────────────────────
 */

export interface WordError {
  index: number
  expected: string
  actual: string
  type: 'correct' | 'misspelled' | 'missing' | 'extra'
}

export interface SpeechScoreResult {
  similarity: number           // 0-100
  isPassed: boolean            // similarity >= threshold
  wordErrors: WordError[]
  correctWords: number
  totalWords: number
  extraWords: number
  missingWords: number
}

/** Normalize text for comparison: lowercase, remove punctuation, collapse spaces */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '') // Keep apostrophes (don't, I'm)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split into words */
function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean)
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/** Word-level similarity (0-1) */
function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/**
 * Compare spoken text against target text.
 * Returns detailed scoring with word-level errors.
 */
export function compareTexts(
  spoken: string,
  target: string,
  passThreshold: number = 70
): SpeechScoreResult {
  const spokenWords = tokenize(spoken)
  const targetWords = tokenize(target)

  const wordErrors: WordError[] = []
  let correctWords = 0
  let si = 0 // spoken index
  let ti = 0 // target index

  while (si < spokenWords.length || ti < targetWords.length) {
    if (si >= spokenWords.length) {
      // Missing words at end
      wordErrors.push({
        index: ti,
        expected: targetWords[ti],
        actual: '',
        type: 'missing',
      })
      ti++
    } else if (ti >= targetWords.length) {
      // Extra words at end
      wordErrors.push({
        index: si,
        expected: '',
        actual: spokenWords[si],
        type: 'extra',
      })
      si++
    } else {
      const sim = wordSimilarity(spokenWords[si], targetWords[ti])

      if (sim >= 0.8) {
        // Match (exact or close enough)
        wordErrors.push({
          index: ti,
          expected: targetWords[ti],
          actual: spokenWords[si],
          type: sim === 1 ? 'correct' : 'misspelled',
        })
        if (sim >= 0.8) correctWords++
        si++
        ti++
      } else {
        // Check if it's a missing word or extra word
        // Look ahead: is the next spoken word a match for current target?
        const nextSpokenMatch =
          si + 1 < spokenWords.length &&
          wordSimilarity(spokenWords[si + 1], targetWords[ti]) >= 0.8

        // Look ahead: is current spoken word a match for next target?
        const nextTargetMatch =
          ti + 1 < targetWords.length &&
          wordSimilarity(spokenWords[si], targetWords[ti + 1]) >= 0.8

        if (nextSpokenMatch) {
          // Current spoken word is extra
          wordErrors.push({
            index: si,
            expected: '',
            actual: spokenWords[si],
            type: 'extra',
          })
          si++
        } else if (nextTargetMatch) {
          // Current target word is missing
          wordErrors.push({
            index: ti,
            expected: targetWords[ti],
            actual: '',
            type: 'missing',
          })
          ti++
        } else {
          // Misspelled
          wordErrors.push({
            index: ti,
            expected: targetWords[ti],
            actual: spokenWords[si],
            type: 'misspelled',
          })
          si++
          ti++
        }
      }
    }
  }

  const totalWords = targetWords.length
  const extraWords = wordErrors.filter((e) => e.type === 'extra').length
  const missingWords = wordErrors.filter((e) => e.type === 'missing').length

  // Similarity score
  const similarity = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0

  return {
    similarity,
    isPassed: similarity >= passThreshold,
    wordErrors,
    correctWords,
    totalWords,
    extraWords,
    missingWords,
  }
}

/**
 * Get a simple text similarity percentage (no word details).
 * Useful for quick checks.
 */
export function getTextSimilarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 100
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 100
  return Math.round((1 - levenshtein(na, nb) / maxLen) * 100)
}
