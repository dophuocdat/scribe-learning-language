import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { useXpStore } from '@/shared/stores/xpStore'

export function XpToast() {
  const { latestEvent, dismissEvent } = useXpStore()
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!latestEvent) {
      setVisible(false)
      return
    }

    // Enter animation
    setLeaving(false)
    setVisible(true)

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setLeaving(true)
      setTimeout(() => {
        setVisible(false)
        dismissEvent()
      }, 400) // exit animation duration
    }, 3000)

    return () => clearTimeout(timer)
  }, [latestEvent, dismissEvent])

  if (!visible || !latestEvent) return null

  return (
    <div
      className={`
        fixed top-6 right-6 z-[100]
        flex items-center gap-3 px-5 py-3
        rounded-2xl border border-amber-400/30
        bg-gradient-to-r from-amber-500/15 to-yellow-500/10
        backdrop-blur-xl shadow-2xl shadow-amber-500/10
        transition-all duration-400 ease-out
        ${leaving
          ? 'translate-y-[-20px] opacity-0 scale-95'
          : 'translate-y-0 opacity-100 scale-100 animate-xp-enter'
        }
      `}
      onClick={() => {
        setLeaving(true)
        setTimeout(() => {
          setVisible(false)
          dismissEvent()
        }, 300)
      }}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
        <Zap className="w-5 h-5 text-white" />
      </div>

      {/* Content */}
      <div>
        <div className="text-lg font-bold text-amber-400 leading-tight">
          +{latestEvent.amount} XP
        </div>
        <div className="text-xs text-surface-200/60">
          {latestEvent.label}
        </div>
      </div>
    </div>
  )
}
