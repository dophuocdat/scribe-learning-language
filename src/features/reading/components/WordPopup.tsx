import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Volume2, Bookmark, X, Loader2 } from 'lucide-react'
import { useTTS } from '@/shared/hooks/useTTS'
import { invokeWritingApi } from '@/shared/lib/edgeFunctions'
import type { VocabWord } from '../stores/readingStore'

interface WordPopupProps {
  word: string
  vocabData: VocabWord | null
  context: string
  position: { x: number; y: number }
  containerWidth?: number  // kept for backward compat but unused
  onClose: () => void
  onSave: (word: VocabWord) => void
}

export function WordPopup({ word, vocabData, context, position, onClose, onSave }: WordPopupProps) {
  const { speak, isSpeaking } = useTTS()
  const [data, setData] = useState<VocabWord | null>(vocabData)
  const [loading, setLoading] = useState(!vocabData)
  const [saved, setSaved] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const [viewportPos, setViewportPos] = useState<{ left: number; top: number } | null>(null)

  // Convert container-relative position to viewport position on mount
  useEffect(() => {
    // The parent passes container-relative coords, but we need viewport coords for fixed positioning
    // We'll use the position as-is since callers now pass clientX/clientY directly
    const popupWidth = 280
    const popupHeight = 250
    const pad = 12

    let left = position.x - popupWidth / 2
    let top = position.y + pad

    // Clamp horizontal
    left = Math.max(pad, Math.min(left, window.innerWidth - popupWidth - pad))
    // If too close to bottom, show above
    if (top + popupHeight > window.innerHeight) {
      top = position.y - popupHeight - pad
    }

    setViewportPos({ left, top })
  }, [position])

  // AI lookup if no pre-generated data
  useEffect(() => {
    if (vocabData) {
      setData(vocabData)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    invokeWritingApi<VocabWord>('lookup-word', { word, context })
      .then(({ data: result }) => {
        if (!cancelled && result) {
          setData(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            word,
            meaning_vi: 'Không tra được nghĩa',
            ipa: '',
            part_of_speech: '',
            example: '',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [word, context, vocabData])

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!viewportPos) return null

  const popupContent = (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        left: viewportPos.left,
        top: viewportPos.top,
        zIndex: 99999,
        width: 280,
      }}
      className="bg-surface-900 p-3.5 shadow-2xl shadow-black/50 border border-primary-500/30 animate-fade-in rounded-xl ring-1 ring-black/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-surface-50">{word}</h3>
          {data?.ipa && (
            <p className="text-[10px] text-primary-300/60 font-mono">{data.ipa}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => speak(word)}
            disabled={isSpeaking}
            className="p-1.5 rounded-lg gradient-bg text-white hover:opacity-90 transition-all"
            title="Phát âm"
          >
            <Volume2 className={`w-3 h-3 ${isSpeaking ? 'animate-pulse' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-surface-200/30 hover:text-surface-200/60 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-3.5 h-3.5 text-primary-400 animate-spin" />
          <span className="text-xs text-surface-200/40">Đang tra nghĩa...</span>
        </div>
      ) : data ? (
        <>
          {data.part_of_speech && (
            <span className="text-[9px] bg-primary-500/15 text-primary-300 px-1.5 py-0.5 rounded font-medium">
              {data.part_of_speech}
            </span>
          )}

          <p className="text-xs text-surface-100 mt-2">{data.meaning_vi}</p>

          {data.example && (
            <div className="mt-2 p-2 rounded-lg bg-surface-800/40">
              <p className="text-[10px] text-surface-200/50 italic">"{data.example}"</p>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={() => { if (data) { onSave(data); setSaved(true) } }}
            disabled={saved}
            className={`mt-2.5 w-full py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
              saved
                ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                : 'bg-primary-500/10 text-primary-300 border border-primary-500/20 hover:bg-primary-500/20'
            }`}
          >
            <Bookmark className="w-3 h-3" />
            {saved ? 'Đã lưu!' : 'Lưu vào từ vựng'}
          </button>
        </>
      ) : null}
    </div>
  )

  // Render via portal at document.body level — escapes ALL stacking contexts
  return createPortal(popupContent, document.body)
}
