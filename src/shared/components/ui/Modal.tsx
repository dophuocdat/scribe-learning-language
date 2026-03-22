import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-950/70 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div className={`relative w-full ${maxWidth} glass-card p-0 animate-slide-up`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/50">
            <h3 className="text-lg font-semibold text-surface-50">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-surface-200/50 hover:text-surface-50 hover:bg-surface-700/50 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
