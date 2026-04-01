import { useEffect } from 'react'
import {
  BookOpen, Mic, Play, Trash2, Loader2, ChevronRight,
} from 'lucide-react'
import { useReadingStore, type ReadingMode, type CEFRLevel, type SavedBatchSession } from '../stores/readingStore'

const MODES: { value: ReadingMode; label: string; desc: string; icon: typeof BookOpen }[] = [
  { value: 'level_reading', label: 'Đọc hiểu', desc: 'Đọc bài + trả lời câu hỏi', icon: BookOpen },
  { value: 'reading_aloud', label: 'Đọc thành tiếng', desc: 'Đọc karaoke + chấm WPM', icon: Mic },
]

const LEVELS: { value: CEFRLevel; label: string; color: string }[] = [
  { value: 'A1', label: 'A1 · Sơ cấp', color: 'from-emerald-500 to-green-400' },
  { value: 'A2', label: 'A2 · Cơ bản', color: 'from-teal-500 to-cyan-400' },
  { value: 'B1', label: 'B1 · Trung cấp', color: 'from-blue-500 to-indigo-400' },
  { value: 'B2', label: 'B2 · Khá', color: 'from-violet-500 to-purple-400' },
  { value: 'C1', label: 'C1 · Nâng cao', color: 'from-orange-500 to-amber-400' },
  { value: 'C2', label: 'C2 · Thành thạo', color: 'from-red-500 to-pink-400' },
]

const TOPICS = ['Daily Life', 'Travel', 'Food', 'Science', 'Technology', 'Health', 'Sports', 'Environment', 'Culture', 'Education']

export function ReadingConfig() {
  const {
    mode, level, topic, batchSize, loading, error,
    activeSessions,
    setConfig, setBatchSize, generateExercise,
    loadActiveSessions, resumeSession, deleteSession,
  } = useReadingStore()

  useEffect(() => { loadActiveSessions() }, [loadActiveSessions])

  const currentSessions = activeSessions.filter(s => s.mode === mode)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Mode */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-surface-200/50 uppercase tracking-wider">Chế độ luyện tập</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODES.map(m => {
            const Icon = m.icon
            const active = mode === m.value
            return (
              <button
                key={m.value}
                onClick={() => setConfig(m.value, level, topic)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-primary-500/50 bg-primary-500/10 shadow-lg shadow-primary-500/5'
                    : 'border-surface-800/50 bg-surface-900/30 hover:border-surface-700/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'gradient-bg' : 'bg-surface-800/50'}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${active ? 'text-primary-300' : 'text-surface-100'}`}>{m.label}</p>
                    <p className="text-[10px] text-surface-200/40">{m.desc}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Level */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-surface-200/50 uppercase tracking-wider">Trình độ</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {LEVELS.map(l => (
            <button
              key={l.value}
              onClick={() => setConfig(mode, l.value, topic)}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                level === l.value
                  ? `bg-gradient-to-br ${l.color} text-white shadow-md`
                  : 'bg-surface-800/40 text-surface-200/50 hover:bg-surface-800/60'
              }`}
            >
              {l.value}
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-surface-200/50 uppercase tracking-wider">Chủ đề</label>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map(t => (
            <button
              key={t}
              onClick={() => setConfig(mode, level, t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                topic === t
                  ? 'gradient-bg text-white shadow-md'
                  : 'bg-surface-800/40 text-surface-200/40 hover:bg-surface-800/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Size */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-surface-200/50 uppercase tracking-wider">Số lượng bài ({batchSize})</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setBatchSize(n)}
              className={`w-10 h-10 rounded-lg text-xs font-bold transition-all ${
                batchSize === n
                  ? 'gradient-bg text-white shadow-md'
                  : 'bg-surface-800/40 text-surface-200/40 hover:bg-surface-800/60'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">{error}</div>
      )}

      {/* Generate */}
      <button
        onClick={generateExercise}
        disabled={loading}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm shadow-lg shadow-primary-600/20"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tạo {batchSize} bài...
          </>
        ) : (
          <>
            <BookOpen className="w-4 h-4" />
            Bắt đầu luyện đọc ({batchSize} bài)
          </>
        )}
      </button>

      {/* Saved Sessions */}
      {currentSessions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button className="text-xs text-surface-200/50 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" /> Bài tập đã lưu
            </button>
            <span className="text-[10px] text-primary-400">{currentSessions.length}/3</span>
          </div>
          <div className="space-y-1.5">
            {currentSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                loading={loading}
                onResume={() => resumeSession(session.id)}
                onDelete={() => deleteSession(session.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SessionCard({ session, loading, onResume, onDelete }: {
  session: SavedBatchSession
  loading: boolean
  onResume: () => void
  onDelete: () => void
}) {
  const levelInfo = LEVELS.find(l => l.value === session.level)
  const modeLabel = MODES.find(m => m.value === session.mode)?.label || session.mode
  const remaining = session.total_count - session.current_index
  const progress = session.total_count > 0 ? (session.current_index / session.total_count) * 100 : 0

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
          <span className="text-[10px] text-surface-200/40 shrink-0">{session.current_index}/{session.total_count}</span>
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
