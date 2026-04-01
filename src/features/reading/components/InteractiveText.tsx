import { useState, useCallback, useRef } from 'react'
import { WordPopup } from './WordPopup'
import type { VocabWord } from '../stores/readingStore'

interface InteractiveTextProps {
  content: string
  vocabulary: VocabWord[]
  onWordClicked: (word: string) => void
  onSaveWord: (word: VocabWord) => void
}

export function InteractiveText({ content, vocabulary, onWordClicked, onSaveWord }: InteractiveTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedWord, setSelectedWord] = useState<{
    word: string
    position: { x: number; y: number }
    context: string
  } | null>(null)

  // Build vocab lookup map (lowercased)
  const vocabMap = new Map<string, VocabWord>()
  vocabulary.forEach(v => vocabMap.set(v.word.toLowerCase(), v))

  // Split content into paragraphs → words
  const paragraphs = content.split(/\n+/)

  const handleWordClick = useCallback((word: string, e: React.MouseEvent) => {
    const cleanWord = word.replace(/[^\w'-]/g, '').toLowerCase()
    if (cleanWord.length < 2) return

    onWordClicked(cleanWord)

    // Find the sentence containing this word for context
    const sentences = content.split(/[.!?]+/)
    const context = sentences.find(s => s.toLowerCase().includes(cleanWord)) || ''

    // Pass viewport coordinates directly (popup uses portal + fixed positioning)
    setSelectedWord({
      word: cleanWord,
      position: {
        x: e.clientX,
        y: e.clientY,
      },
      context: context.trim(),
    })
  }, [content, onWordClicked])

  const renderWord = (word: string, idx: number) => {
    const cleanWord = word.replace(/[^\w'-]/g, '').toLowerCase()
    const hasVocab = vocabMap.has(cleanWord)

    // Keep trailing punctuation
    const trailingPunct = word.match(/[^a-zA-Z'-]+$/)?.[0] || ''
    const displayWord = word.replace(/[^a-zA-Z'-]+$/, '')

    if (displayWord.length < 2) {
      return <span key={idx}>{word} </span>
    }

    return (
      <span key={idx}>
        <span
          onClick={(e) => handleWordClick(word, e)}
          className={`cursor-pointer rounded-sm transition-all hover:bg-primary-500/15 hover:text-primary-300 ${
            hasVocab ? 'border-b border-dotted border-primary-500/30' : ''
          }`}
        >
          {displayWord}
        </span>
        {trailingPunct}{' '}
      </span>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="text-sm leading-7 text-surface-100 space-y-3">
        {paragraphs.map((para, pIdx) => (
          <p key={pIdx}>
            {para.split(/\s+/).map((word, wIdx) => renderWord(word, pIdx * 10000 + wIdx))}
          </p>
        ))}
      </div>

      {/* Word Popup — positioned absolute within container */}
      {selectedWord && (
        <WordPopup
          word={selectedWord.word}
          vocabData={vocabMap.get(selectedWord.word) || null}
          context={selectedWord.context}
          position={selectedWord.position}
          containerWidth={containerRef.current?.offsetWidth || 600}
          onClose={() => setSelectedWord(null)}
          onSave={onSaveWord}
        />
      )}
    </div>
  )
}
