import { useEffect } from 'react'
import {
  Headphones,
  PenLine,
  Sparkles,
  BookOpen,
  RefreshCw,
  Trash2,
  Trophy,
  RotateCcw,
  Play,
  Loader2,
} from 'lucide-react'
import {
  useListeningPracticeStore,
  DICTATION_TYPES,
  COMPREHENSION_TYPES,
  TOPICS,
  type ExerciseMode,
  type CEFRLevel,
  type SavedExercise,
  type SavedBatchSession,
} from '../stores/listeningPracticeStore'

const LEVELS: { id: CEFRLevel; label: string; color: string }[] = [
  { id: 'A1', label: 'A1 Beginner', color: 'from-green-500 to-green-400' },
  { id: 'A2', label: 'A2 Elementary', color: 'from-emerald-500 to-emerald-400' },
  { id: 'B1', label: 'B1 Intermediate', color: 'from-blue-500 to-blue-400' },
  { id: 'B2', label: 'B2 Upper-Inter', color: 'from-indigo-500 to-indigo-400' },
  { id: 'C1', label: 'C1 Advanced', color: 'from-purple-500 to-purple-400' },
  { id: 'C2', label: 'C2 Proficiency', color: 'from-pink-500 to-pink-400' },
]

const TYPE_LABELS: Record<string, string> = {
  word: 'Từ vựng', phrase: 'Cụm từ', short_sentence: 'Câu ngắn',
  complex_sentence: 'Câu phức', short_paragraph: 'Đoạn ngắn', long_paragraph: 'Đoạn dài',
  fill_blank: 'Điền từ', short_answer: 'Trả lời ngắn', summary: 'Tóm tắt',
  opinion: 'Ý kiến', essay: 'Bài luận',
}

const MODE_LABELS: Record<string, string> = {
  dictation: 'Nghe chép',
  comprehension: 'Nghe hiểu',
}

export function ExerciseConfig() {
  const {
    mode, level, exerciseType, topic,
    generating, usage, loadingSession,
    activeSessions,
    savedExercises, loadingSaved,
    setMode, setLevel, setExerciseType, setTopic,
    generateExercise, resumeSession, practiceFromSaved,
    loadActiveSessions, deleteSession,
    loadSavedExercises, deleteSavedExercise,
  } = useListeningPracticeStore()

  const exerciseTypes = mode === 'dictation' ? DICTATION_TYPES : COMPREHENSION_TYPES
  const isDisabled = usage !== null && usage.remaining <= 0

  useEffect(() => {
    loadActiveSessions()
  }, [loadActiveSessions])

  useEffect(() => {
    loadSavedExercises()
  }, [mode, level, loadSavedExercises])

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Active Batch Sessions — resume list */}
      {activeSessions.length > 0 && (
        <div className="glass-card p-4 border border-primary-500/20">
          <p className="text-xs text-primary-400 mb-3 font-medium flex items-center gap-1.5">
            <Play className="w-3 h-3" /> Phiên luyện tập chưa hoàn thành ({activeSessions.length})
          </p>
          <div className="space-y-1.5">
            {activeSessions.map((session) => (
              <ActiveSessionCard
                key={session.id}
                session={session}
                onResume={() => resumeSession(session.id)}
                onDelete={() => deleteSession(session.id)}
                loading={loadingSession}
              />
            ))}
          </div>
        </div>
      )}

      {/* Saved Exercises */}
      {(savedExercises.length > 0 || loadingSaved) && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-surface-200/40 font-medium flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" /> Bài tập đã lưu ({savedExercises.length})
            </p>
            <button
              onClick={loadSavedExercises}
              className="text-[10px] text-surface-200/30 hover:text-primary-400 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loadingSaved ? 'animate-spin' : ''}`} />
              Tải lại
            </button>
          </div>
          {loadingSaved ? (
            <div className="text-center py-4">
              <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {savedExercises.map((saved) => (
                <SavedExerciseCard
                  key={saved.id}
                  saved={saved}
                  onPractice={() => practiceFromSaved(saved)}
                  onDelete={() => deleteSavedExercise(saved.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode Selector */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">Chọn chế độ luyện tập</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'dictation' as ExerciseMode, label: 'Dictation', desc: 'Nghe & viết lại chính xác', icon: Headphones },
            { id: 'comprehension' as ExerciseMode, label: 'Comprehension', desc: 'Nghe hiểu & viết câu trả lời', icon: PenLine },
          ]).map((m) => {
            const isActive = mode === m.id
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`
                  flex items-center gap-3 p-3.5 rounded-xl transition-all text-left
                  ${isActive
                    ? 'gradient-bg text-white shadow-lg'
                    : 'glass-card hover:bg-surface-800/60 text-surface-200/60 hover:text-surface-50'
                  }
                `}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className={`text-[10px] ${isActive ? 'text-white/70' : 'text-surface-200/30'}`}>{m.desc}</p>
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
          {LEVELS.map((l) => {
            const isActive = level === l.id
            return (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`
                  py-2 px-2 rounded-xl text-center transition-all text-xs font-semibold
                  ${isActive
                    ? `bg-gradient-to-r ${l.color} text-white shadow-lg`
                    : 'text-surface-200/50 hover:text-surface-50 hover:bg-surface-800/40'
                  }
                `}
              >
                {l.id}
              </button>
            )
          })}
        </div>
      </div>

      {/* Exercise Type Selector */}
      <div className="glass-card p-4">
        <p className="text-xs text-surface-200/40 mb-3 font-medium">
          {mode === 'dictation' ? 'Loại bài nghe chép' : 'Loại bài nghe hiểu'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
          <BookOpen className="w-3 h-3" /> Chủ đề (tùy chọn)
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

      {/* Usage Info */}
      {usage && (
        <div className="text-center text-[10px] text-surface-200/30">
          Hôm nay: {usage.exercisesToday}/{usage.maxExercises} bài tập
        </div>
      )}

      {/* Generate New Button */}
      <button
        onClick={generateExercise}
        disabled={generating || isDisabled}
        className="w-full py-4 rounded-xl gradient-bg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang tạo 5 bài tập...
          </>
        ) : isDisabled ? (
          'Đã hết bài tập hôm nay'
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Tạo 5 bài tập mới (AI)
          </>
        )}
      </button>
    </div>
  )
}

/* ===== Active Session Card ===== */

function ActiveSessionCard({
  session,
  onResume,
  onDelete,
  loading,
}: {
  session: SavedBatchSession
  onResume: () => void
  onDelete: () => void
  loading: boolean
}) {
  const levelInfo = LEVELS.find(l => l.id === session.level)
  const typeLabel = TYPE_LABELS[session.exercise_type] || session.exercise_type
  const modeLabel = MODE_LABELS[session.mode] || session.mode
  const progress = Math.round((session.current_index / session.total_count) * 100)
  const remaining = session.total_count - session.current_index

  const createdAt = new Date(session.created_at)
  const timeAgo = getTimeAgo(createdAt)

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary-500/5 border border-primary-500/10 hover:bg-primary-500/10 transition-all group">
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${levelInfo?.color || 'from-blue-500 to-blue-400'} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>
        {session.level}
      </div>

      <div className="flex-1 min-w-0" onClick={onResume} role="button">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-surface-50">{modeLabel} · {typeLabel}</span>
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
        <p className="text-[10px] text-surface-200/30 mt-0.5">
          Còn {remaining} bài · {timeAgo}
        </p>
      </div>

      <div className="flex gap-1 shrink-0">
        <button
          onClick={onResume}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg gradient-bg text-[10px] font-semibold text-white hover:opacity-90 transition-all flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Tiếp tục
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-surface-200/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

/* ===== Saved Exercise Card ===== */

function SavedExerciseCard({
  saved,
  onPractice,
  onDelete,
}: {
  saved: SavedExercise
  onPractice: () => void
  onDelete: () => void
}) {
  const typeLabel = TYPE_LABELS[saved.exercise_type] || saved.exercise_type
  const levelInfo = LEVELS.find(l => l.id === saved.level)

  const content = saved.content as unknown as Record<string, unknown>
  const preview = (content?.text as string) || (content?.passage as string) || ''
  const shortPreview = preview.length > 80 ? preview.slice(0, 80) + '...' : preview

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-800/30 transition-all group">
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${levelInfo?.color || 'from-blue-500 to-blue-400'} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>
        {saved.level}
      </div>

      <div className="flex-1 min-w-0" onClick={onPractice} role="button">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-surface-50 truncate">{typeLabel}</span>
          {saved.topic && <span className="text-[10px] text-surface-200/30">{saved.topic}</span>}
        </div>
        <p className="text-[10px] text-surface-200/40 truncate">{shortPreview}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-surface-200/30">
          <span className="flex items-center gap-0.5">
            <RotateCcw className="w-2.5 h-2.5" /> {saved.times_practiced}x
          </span>
          {saved.best_score !== null && (
            <span className="flex items-center gap-0.5">
              <Trophy className="w-2.5 h-2.5 text-yellow-400/60" /> {saved.best_score}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 shrink-0">
        <button
          onClick={onPractice}
          className="px-2.5 py-1.5 rounded-lg gradient-bg text-[10px] font-semibold text-white hover:opacity-90 transition-all"
        >
          Luyện
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-surface-200/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

/* ===== Helpers ===== */

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}
