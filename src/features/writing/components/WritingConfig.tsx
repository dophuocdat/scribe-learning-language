import { useEffect } from 'react'
import { Puzzle, RefreshCw, FileText, Loader2, Trash2, PlayCircle } from 'lucide-react'
import { useWritingStore, type WritingMode } from '../stores/writingStore'

const modes: { id: WritingMode; label: string; desc: string; icon: typeof Puzzle }[] = [
  { id: 'sentence_building', label: 'Sắp xếp câu', desc: 'Kéo thả từ → tạo câu đúng', icon: Puzzle },
  { id: 'paraphrase', label: 'Viết lại câu', desc: 'Viết lại câu dùng cấu trúc khác', icon: RefreshCw },
  { id: 'essay', label: 'Viết bài', desc: 'Email/đoạn văn/bài luận', icon: FileText },
]

const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const topics = ['General', 'Travel', 'Food', 'School', 'Work', 'Family', 'Sports', 'Technology', 'Nature', 'Culture']
const essayTypes = [
  { id: 'email' as const, label: 'Email', desc: '80-150 từ' },
  { id: 'paragraph' as const, label: 'Đoạn văn', desc: '100-200 từ' },
  { id: 'essay' as const, label: 'Bài luận', desc: '150-300 từ' },
]

export function WritingConfig() {
  const {
    mode, level, topic, essayType, batchSize, loading, error,
    setMode, setLevel, setTopic, setEssayType, setBatchSize,
    generateExercise, loadSessions, sessions, resumeSession, deleteSession,
  } = useWritingStore()

  useEffect(() => { loadSessions() }, [loadSessions])

  const modeSessions = sessions.filter(s => s.mode === mode)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mode Selection */}
      <div className="glass-card p-4">
        <h3 className="text-xs text-surface-200/40 mb-3 font-medium">Chế độ luyện tập</h3>
        <div className="grid grid-cols-3 gap-2">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`p-3 rounded-xl text-center transition-all ${
                mode === m.id
                  ? 'gradient-bg text-white shadow-lg'
                  : 'bg-surface-800/40 text-surface-200/60 hover:text-surface-50 hover:bg-surface-800/60'
              }`}
            >
              <m.icon className={`w-5 h-5 mx-auto mb-1.5 ${mode === m.id ? 'text-white' : 'text-surface-200/40'}`} />
              <span className="text-xs font-semibold block">{m.label}</span>
              <span className="text-[9px] block mt-0.5 opacity-60">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Level */}
      <div className="glass-card p-4">
        <h3 className="text-xs text-surface-200/40 mb-3 font-medium">Trình độ</h3>
        <div className="flex gap-2 flex-wrap">
          {levels.map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                level === l
                  ? 'gradient-bg text-white'
                  : 'bg-surface-800/40 text-surface-200/60 hover:text-surface-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div className="glass-card p-4">
        <h3 className="text-xs text-surface-200/40 mb-3 font-medium">Chủ đề</h3>
        <div className="flex gap-2 flex-wrap">
          {topics.map(t => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                topic === t
                  ? 'gradient-bg text-white'
                  : 'bg-surface-800/40 text-surface-200/50 hover:text-surface-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Essay type (only for essay mode) */}
      {mode === 'essay' && (
        <div className="glass-card p-4">
          <h3 className="text-xs text-surface-200/40 mb-3 font-medium">Loại bài viết</h3>
          <div className="grid grid-cols-3 gap-2">
            {essayTypes.map(et => (
              <button
                key={et.id}
                onClick={() => setEssayType(et.id)}
                className={`p-3 rounded-xl transition-all ${
                  essayType === et.id
                    ? 'gradient-bg text-white'
                    : 'bg-surface-800/40 text-surface-200/60 hover:text-surface-50'
                }`}
              >
                <span className="text-xs font-semibold block">{et.label}</span>
                <span className="text-[9px] opacity-60">{et.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Batch size (not for essay) */}
      {mode !== 'essay' && (
        <div className="glass-card p-4">
          <h3 className="text-xs text-surface-200/40 mb-3 font-medium">Số câu ({batchSize})</h3>
          <div className="flex gap-2">
            {[1, 3, 5].map(n => (
              <button
                key={n}
                onClick={() => setBatchSize(n)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  batchSize === n ? 'gradient-bg text-white' : 'bg-surface-800/40 text-surface-200/60 hover:text-surface-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved sessions */}
      {modeSessions.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs text-surface-200/40 mb-3 font-medium">Phiên đã lưu</h3>
          <div className="space-y-2">
            {modeSessions.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-800/30 border border-surface-700/20">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-surface-100 font-medium truncate">
                    {s.level} · {s.topic} · {s.current_index + 1}/{s.total_count}
                  </p>
                  <p className="text-[10px] text-surface-200/30">{new Date(s.updated_at).toLocaleDateString('vi-VN')}</p>
                </div>
                <button onClick={() => resumeSession(s)} className="p-1.5 rounded-lg text-primary-400 hover:bg-primary-500/10">
                  <PlayCircle className="w-4 h-4" />
                </button>
                <button onClick={() => deleteSession(s.id)} className="p-1.5 rounded-lg text-red-400/60 hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Start */}
      <button
        onClick={generateExercise}
        disabled={loading}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo bài tập...</>
        ) : (
          'Bắt đầu luyện viết'
        )}
      </button>
    </div>
  )
}
