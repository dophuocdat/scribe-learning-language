import { useEffect } from 'react'
import {
  Headphones,
  PenLine,
  MessageSquare,
  Sparkles,
  BookOpen,
  Trash2,
  Play,
  Loader2,
} from 'lucide-react'
import {
  useListeningStore,
  DICTATION_TYPES,
  FILL_BLANK_TYPES,
  DIALOGUE_TYPES,
  TOPICS,
  MODE_OPTIONS,
  type CEFRLevel,
  type SavedBatchSession,
} from '../stores/listeningStore'

const LEVELS: { id: CEFRLevel; label: string; color: string }[] = [
  { id: 'A1', label: 'A1 Beginner', color: 'from-green-500 to-green-400' },
  { id: 'A2', label: 'A2 Elementary', color: 'from-emerald-500 to-emerald-400' },
  { id: 'B1', label: 'B1 Intermediate', color: 'from-blue-500 to-blue-400' },
  { id: 'B2', label: 'B2 Upper-Inter', color: 'from-indigo-500 to-indigo-400' },
  { id: 'C1', label: 'C1 Advanced', color: 'from-purple-500 to-purple-400' },
  { id: 'C2', label: 'C2 Proficiency', color: 'from-pink-500 to-pink-400' },
]

const MODE_ICONS: Record<string, typeof Headphones> = {
  dictation: Headphones,
  fill_blank: PenLine,
  dialogue: MessageSquare,
}

export function ListeningConfig() {
  const {
    mode, level, exerciseType, topic, batchSize,
    generating, usage, loadingSession,
    activeSessions,
    setMode, setLevel, setExerciseType, setTopic, setBatchSize,
    generateExercise, resumeSession,
    loadActiveSessions, deleteSession,
  } = useListeningStore()

  const exerciseTypes =
    mode === 'dictation' ? DICTATION_TYPES :
    mode === 'fill_blank' ? FILL_BLANK_TYPES :
    DIALOGUE_TYPES

  const isDisabled = usage !== null && usage.remaining <= 0

  // Filter sessions for current mode
  const sessionsForMode = activeSessions.filter(s => s.mode === mode)
  const isAtSessionLimit = sessionsForMode.length >= MAX_SESSIONS_PER_MODE

  useEffect(() => {
    loadActiveSessions()
  }, [loadActiveSessions])

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Saved Sessions for current mode */}
      {sessionsForMode.length > 0 && (
        <div className="glass-card p-4 border border-primary-500/20">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-primary-400 font-medium flex items-center gap-1.5">
              <Play className="w-3 h-3" /> Bài tập đã lưu
            </p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              isAtSessionLimit
                ? 'bg-red-500/15 text-red-400'
                : 'bg-primary-500/15 text-primary-400'
            }`}>
              {sessionsForMode.length}/{MAX_SESSIONS_PER_MODE}
            </span>
          </div>
          <div className="space-y-1.5">
            {sessionsForMode.map((session) => (
              <ActiveSessionCard
                key={session.id}
                session={session}
                onResume={() => resumeSession(session.id)}
                onDelete={() => deleteSession(session.id)}
                loading={loadingSession}
              />
            ))}
          </div>
          {isAtSessionLimit && (
            <p className="text-[10px] text-amber-400/70 mt-2 text-center">
              ⚠️ Đã đạt tối đa {MAX_SESSIONS_PER_MODE} phiên. Xóa bớt để tạo mới.
            </p>
          )}
        </div>
      )}

      {/* Mode Selector — 3 modes */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">Chọn chế độ luyện tập</p>
        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((m) => {
            const isActive = mode === m.id
            const Icon = MODE_ICONS[m.id] || Headphones
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`
                  flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all text-center
                  ${isActive
                    ? 'gradient-bg text-white shadow-lg'
                    : 'glass-card hover:bg-surface-800/60 text-surface-200/60 hover:text-surface-50'
                  }
                `}
              >
                <div className={`text-xl ${isActive ? '' : 'grayscale opacity-60'}`}>{m.emoji}</div>
                <Icon className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{m.label}</p>
                  <p className={`text-[9px] mt-0.5 ${isActive ? 'text-white/70' : 'text-surface-200/30'}`}>{m.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Level Selector */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">Cấp độ CEFR</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLevel(l.id)}
              className={`
                py-2 px-2 rounded-xl text-center transition-all text-xs font-semibold
                ${level === l.id
                  ? `bg-gradient-to-r ${l.color} text-white shadow-lg`
                  : 'text-surface-200/50 hover:text-surface-50 hover:bg-surface-800/40'
                }
              `}
            >
              {l.id}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Type */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">
          {mode === 'dictation' ? 'Loại bài nghe chép' :
           mode === 'fill_blank' ? 'Từ vựng cần điền' :
           'Loại hội thoại'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {exerciseTypes.map((et) => {
            const isActive = exerciseType === et.id
            const isRecommended = et.levels.includes(level)
            return (
              <button
                key={et.id}
                onClick={() => setExerciseType(et.id)}
                className={`
                  py-2.5 px-3 rounded-xl text-xs font-medium transition-all relative
                  ${isActive
                    ? 'gradient-bg text-white shadow-lg'
                    : 'text-surface-200/50 hover:text-surface-50 hover:bg-surface-800/40'
                  }
                `}
              >
                {et.label}
                {isRecommended && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" title="Phù hợp level" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Topic Selector */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" /> Chủ đề
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTopic('')}
            className={`px-3 py-1.5 rounded-full text-xs transition-all ${
              !topic ? 'gradient-bg text-white' : 'bg-surface-800/30 text-surface-200/40 hover:bg-surface-800/60'
            }`}
          >
            🎲 Ngẫu nhiên
          </button>
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                topic === t ? 'gradient-bg text-white' : 'bg-surface-800/30 text-surface-200/40 hover:bg-surface-800/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Size Selector */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">Số bài tập mỗi lần tạo</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setBatchSize(n)}
              className={`
                flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
                ${batchSize === n
                  ? 'gradient-bg text-white shadow-lg'
                  : 'bg-surface-800/30 text-surface-200/50 hover:bg-surface-800/60 hover:text-surface-50'
                }
              `}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Usage */}
      {usage && (
        <div className="text-center text-[10px] text-surface-200/30">
          Hôm nay: {usage.exercisesToday}/{usage.maxExercises} bài tập
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateExercise}
        disabled={generating || isDisabled || isAtSessionLimit}
        className="w-full py-4 rounded-xl gradient-bg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang tạo bài tập...
          </>
        ) : isAtSessionLimit ? (
          `Đã đạt tối đa ${MAX_SESSIONS_PER_MODE} phiên — xóa bớt để tạo mới`
        ) : isDisabled ? (
          'Đã hết bài tập hôm nay'
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Tạo {batchSize} bài tập mới
          </>
        )}
      </button>
    </div>
  )
}

const MAX_SESSIONS_PER_MODE = 3

/* ===== Active Session Card ===== */

const MODE_LABELS: Record<string, string> = {
  dictation: 'Nghe chép', fill_blank: 'Điền từ', dialogue: 'Hội thoại',
}

function ActiveSessionCard({
  session, onResume, onDelete, loading,
}: {
  session: SavedBatchSession; onResume: () => void; onDelete: () => void; loading: boolean
}) {
  const levelInfo = LEVELS.find(l => l.id === session.level)
  const modeLabel = MODE_LABELS[session.mode] || session.mode
  const progress = Math.round((session.current_index / session.total_count) * 100)
  const remaining = session.total_count - session.current_index

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary-500/5 border border-primary-500/10 hover:bg-primary-500/10 transition-all group">
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${levelInfo?.color || 'from-blue-500 to-blue-400'} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>
        {session.level}
      </div>

      <div className="flex-1 min-w-0" onClick={onResume} role="button">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-surface-50">{modeLabel}</span>
          {session.topic && session.topic !== 'General' && (
            <span className="text-[10px] text-surface-200/30">{session.topic}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-surface-800/50 rounded-full overflow-hidden">
            <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-surface-200/40 shrink-0">
            {session.current_index}/{session.total_count}
          </span>
        </div>
        <p className="text-[10px] text-surface-200/30 mt-0.5">Còn {remaining} bài</p>
      </div>

      <div className="flex gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onResume}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg gradient-bg text-[10px] font-semibold text-white hover:opacity-90 transition-all flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Tiếp tục
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete() }}
          className="px-2 py-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/15 transition-all flex items-center gap-1"
          title="Xóa phiên này"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
