import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Edit3, Save, X, ChevronRight } from 'lucide-react'
import { useAdminStore } from '@/features/admin/stores/adminStore'
import { useToastStore } from '@/shared/stores/toastStore'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Skeleton } from '@/shared/components/ui/Skeleton'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function CategoryManagerPage() {
  const { categories, isSaving, loadingCategories, fetchCategories, createCategory, updateCategory, deleteCategory } = useAdminStore()
  const { addToast } = useToastStore()
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const [form, setForm] = useState({ name: '', description: '' })

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      addToast('error', 'Vui lòng nhập tên danh mục')
      return
    }
    await createCategory({
      name: form.name.trim(),
      slug: slugify(form.name),
      description: form.description.trim() || undefined,
    })
    addToast('success', 'Đã tạo danh mục')
    setForm({ name: '', description: '' })
    setShowNew(false)
  }

  const handleUpdate = async () => {
    if (!editId || !form.name.trim()) return
    await updateCategory(editId, {
      name: form.name.trim(),
      slug: slugify(form.name),
      description: form.description.trim() || null,
    })
    addToast('success', 'Đã cập nhật danh mục')
    setEditId(null)
    setForm({ name: '', description: '' })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteCategory(deleteId)
    addToast('success', 'Đã xóa danh mục')
    setDeleteId(null)
  }

  const startEdit = (cat: { id: string; name: string; description: string | null }) => {
    setEditId(cat.id)
    setForm({ name: cat.name, description: cat.description ?? '' })
    setShowNew(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-50">Danh mục</h2>
          <p className="text-sm text-surface-200/50">Phân loại khóa học theo chủ đề</p>
        </div>
        {!showNew && (
          <button
            onClick={() => { setShowNew(true); setEditId(null); setForm({ name: '', description: '' }) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Thêm danh mục
          </button>
        )}
      </div>

      {/* New Category Form */}
      {showNew && (
        <div className="glass-card p-5 space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold text-surface-50">Tạo danh mục mới</h3>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Tên danh mục (VD: TOEIC, IELTS, Grammar)"
            className="w-full px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all text-sm"
            autoFocus
          />
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Mô tả (tùy chọn)"
            className="w-full px-4 py-2.5 rounded-xl bg-surface-900/60 border border-surface-700/50 text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 transition-all text-sm"
          />
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
              onClick={() => { setShowNew(false); setForm({ name: '', description: '' }) }}
              className="px-4 py-2 rounded-xl text-sm bg-surface-800 text-surface-200 hover:bg-surface-700 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loadingCategories ? (
        <div className="glass-card p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-surface-200/50 text-sm">Chưa có danh mục nào</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-surface-800/30 hover:bg-surface-800/20 transition-all"
            >
              {editId === cat.id ? (
                /* Edit mode */
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs gradient-bg text-white font-medium disabled:opacity-50"
                    >
                      {isSaving ? 'Lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => { setEditId(null); setForm({ name: '', description: '' }) }}
                      className="px-3 py-1.5 rounded-lg text-xs bg-surface-800 text-surface-200"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <Link
                    to={`/admin/categories/${cat.id}/courses`}
                    className="flex-1 min-w-0 group cursor-pointer"
                  >
                    <p className="text-sm font-medium text-surface-50 group-hover:text-primary-400 transition-colors">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-surface-200/40 mt-0.5">{cat.description}</p>
                    )}
                    <p className="text-[11px] text-surface-200/30 mt-0.5">slug: {cat.slug}</p>
                  </Link>
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={(e) => { e.preventDefault(); startEdit(cat) }}
                      className="p-2 rounded-lg text-surface-200/50 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setDeleteId(cat.id) }}
                      className="p-2 rounded-lg text-surface-200/50 hover:text-error hover:bg-error/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link
                      to={`/admin/categories/${cat.id}/courses`}
                      className="p-2 rounded-lg text-surface-200/50 hover:text-accent-400 hover:bg-accent-500/10 transition-all"
                      title="Xem khóa học"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
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
        title="Xóa danh mục"
        message="Xóa danh mục không xóa khóa học liên quan. Khóa học sẽ trở thành 'Chưa phân loại'."
        confirmText="Xóa"
      />
    </div>
  )
}
