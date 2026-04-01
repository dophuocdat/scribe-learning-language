import { useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Gauge,
  Snail,
} from 'lucide-react'
import { useTTS, SPEED_OPTIONS } from '@/shared/hooks/useTTS'
import { useListeningStore } from '../stores/listeningStore'

interface AudioPlayerProps {
  text: string
  /** If true, show slow playback button (0.6x) */
  showSlowButton?: boolean
}

export function AudioPlayer({ text, showSlowButton = true }: AudioPlayerProps) {
  const { playbackSpeed, setPlaybackSpeed, replayCount, maxReplays, incrementReplay } =
    useListeningStore()

  const { speak, isSpeaking, stop } = useTTS()
  const [played, setPlayed] = useState(false)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)

  const handlePlay = (speed?: number) => {
    if (isSpeaking) {
      stop()
      return
    }

    if (played && replayCount >= maxReplays) return

    if (played) {
      incrementReplay()
    }

    speak(text, speed || playbackSpeed)
    setPlayed(true)
  }

  const handlePlaySlow = () => {
    if (isSpeaking) {
      stop()
      return
    }
    if (played && replayCount >= maxReplays) return
    if (played) incrementReplay()
    speak(text, 0.6)
    setPlayed(true)
  }

  const replaysLeft = maxReplays - replayCount

  return (
    <div className="glass-card p-4 relative z-20">
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={() => handlePlay()}
          disabled={played && replaysLeft <= 0 && !isSpeaking}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all
            ${isSpeaking
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'gradient-bg text-white hover:opacity-90'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          {isSpeaking ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        {/* Slow Button */}
        {showSlowButton && (
          <button
            onClick={handlePlaySlow}
            disabled={(played && replaysLeft <= 0 && !isSpeaking)}
            className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
            title="Nghe chậm (0.6x)"
          >
            <Snail className="w-4 h-4" />
          </button>
        )}

        {/* Status */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-50">
            {isSpeaking ? 'Đang phát...' : played ? 'Nhấn để nghe lại' : 'Nhấn để nghe'}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-surface-200/40">
            <span className="flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Nghe lại: {replaysLeft}/{maxReplays}
            </span>
            {replayCount > 1 && (
              <span className="text-yellow-400/60">(-{(replayCount - 1) * 2} XP)</span>
            )}
          </div>
        </div>

        {/* Speed */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu) }}
            className="px-2.5 py-1.5 rounded-lg bg-surface-800/50 text-xs text-surface-200/60 hover:text-surface-50 hover:bg-surface-800 transition-all flex items-center gap-1"
          >
            <Gauge className="w-3 h-3" />
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface-900 border border-surface-700 rounded-xl p-1 z-50 shadow-xl min-w-[100px]">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={(e) => { e.stopPropagation(); setPlaybackSpeed(s.value); setShowSpeedMenu(false) }}
                  className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                    playbackSpeed === s.value ? 'gradient-bg text-white' : 'text-surface-200/60 hover:bg-surface-800'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Volume2 className={`w-4 h-4 shrink-0 ${isSpeaking ? 'text-primary-400 animate-pulse' : 'text-surface-200/30'}`} />
      </div>
    </div>
  )
}
