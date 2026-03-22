import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit3, Save, X, Palette } from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { useToastStore } from '@/shared/stores/toastStore'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Skeleton } from '@/shared/components/ui/Skeleton'

const colorPresets = [
  '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#dc2626',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#64748b',
]

export function DifficultyLevelPage() {
  const { difficultyLevels, isSaving, fetchDifficultyLevels, createDifficultyLevel, updateDifficultyLevel, deleteDifficultyLevel } = useAdminStore()
  const { addToast } = useToastStore()
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const emptyForm = { code: '', label: '', description: '', color: '#6366f1' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetchDifficultyLevels().finally(() => setLoading(false))
  }, [fetchDifficultyLevels])

  const resetForm = () => { setForm(emptyForm); setShowNew(false); setEditId(null) }

  const handleCreate = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      addToast('error', 'Vui lòng nhập mã và tên cấp độ')
      return
    }
    const result = await createDifficultyLevel({
      code: form.code.trim().toUpperCase(),
      label: form.label.trim(),
      description: form.description.trim() || null,
      color: form.color,
      order_index: difficultyLevels.length + 1,
    })
    if (result) {
      addToast('success', `Đã tạo cấp độ ${result.code}`)
      resetForm()
    }
  }

  const handleUpdate = async () => {
    if (!editId || !form.label.trim()) return
    await updateDifficultyLevel(editId, {
      label: form.label.trim(),
      description: form.description.trim() || null,
      color: form.color,
    })
    addToast('success', 'Đã cập nhật cấp độ')
    resetForm()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteDifficultyLevel(deleteId)
    addToast('success', 'Đã xóa cấp độ')
    setDeleteId(null)
  }

  const startEdit = (lvl: { id: string; label: string; description: string | null; color: string }) => {
    setEditId(lvl.id)
    setForm({ code: '', label: lvl.label, description: lvl.description ?? '', color: lvl.color })
    setShowNew(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-50">Cấp độ</h2>
          <p className="text-sm text-surface-200/50">Quản lý các cấp độ dùng cho khóa học</p>
        </div>
        {!showNew && (
          <button
            onClick={() => { setShowNew(true); setEditId(null); setForm({ ...emptyForm }) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Thêm cấp độ
          </button>
        )}
      </div>

      {/* New Level Form */}
      {showNew && (
        <div className="glass-card p-5 space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold text-surface-50">Tạo cấp độ mới</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Mã cấp độ (VD: A1, TOEIC)"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all text-sm uppercase"
              autoFocus
            />
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Tên hiển thị (VD: A1 — Sơ cấp)"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all text-sm"
            />
          </div>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Mô tả (tùy chọn)"
            className="w-full px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all text-sm"
          />
          {/* Color picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <Palette className="w-4 h-4 text-surface-200/50" />
            {colorPresets.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  form.color === c ? 'border-white scale-110 ring-2 ring-white/20' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Đang lưu...' : 'Tạo'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl text-sm bg-surface-800 text-surface-200 hover:bg-surface-700 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="glass-card p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 p-3">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ) : difficultyLevels.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-surface-200/50 text-sm">Chưa có cấp độ nào</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {difficultyLevels.map((lvl) => (
            <div
              key={lvl.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-surface-800/30 hover:bg-surface-800/20 transition-all"
            >
              {editId === lvl.id ? (
                /* Edit mode */
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900/60 border border-primary-500/50 text-surface-50 text-sm focus:outline-none"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả"
                    className="w-full px-3 py-2 rounded-lg bg-surface-900/60 border border-surface-700/50 text-surface-50 text-sm focus:outline-none"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Palette className="w-3.5 h-3.5 text-surface-200/50" />
                    {colorPresets.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          form.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs gradient-bg text-white font-medium disabled:opacity-50"
                    >
                      {isSaving ? 'Lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={resetForm}
                      className="px-3 py-1.5 rounded-lg text-xs bg-surface-800 text-surface-200"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: lvl.color }}
                  >
                    {lvl.code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-50">{lvl.label}</p>
                    {lvl.description && (
                      <p className="text-xs text-surface-200/40 mt-0.5">{lvl.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => startEdit(lvl)}
                      className="p-2 rounded-lg text-surface-200/50 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(lvl.id)}
                      className="p-2 rounded-lg text-surface-200/50 hover:text-error hover:bg-error/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Xóa cấp độ"
        message="Xóa cấp độ sẽ bỏ liên kết với các khóa học đang sử dụng. Tiếp tục?"
        confirmText="Xóa"
      />
    </div>
  )
}
