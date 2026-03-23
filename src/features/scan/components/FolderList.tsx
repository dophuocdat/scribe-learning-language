import { useState } from 'react'
import {
  FolderOpen,
  Plus,
  X,
  Palette,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useScanStore } from '../stores/scanStore'
import type { UserFolder } from '@/shared/types/database'

const FOLDER_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0d9488',
]

interface FolderListProps {
  onSelectFolder: (folder: UserFolder) => void
}

export function FolderList({ onSelectFolder }: FolderListProps) {
  const { folders, loadingFolders, createFolder, deleteFolder } = useScanStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0])
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (e: React.MouseEvent, folderId: string, folderName: string) => {
    e.stopPropagation()
    if (!confirm(`Xóa thư mục "${folderName}"? Tất cả tài liệu bên trong sẽ bị xóa.`)) return
    setDeletingId(folderId)
    await deleteFolder(folderId)
    setDeletingId(null)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const folder = await createFolder(newName.trim(), newColor)
    setCreating(false)
    if (folder) {
      setShowCreate(false)
      setNewName('')
      setNewColor(FOLDER_COLORS[0])
    }
  }

  if (loadingFolders) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="w-10 h-10 bg-surface-800/60 rounded-xl mb-3" />
            <div className="h-4 w-2/3 bg-surface-800/60 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-surface-50">Thư mục của bạn</h2>
          <p className="text-sm text-surface-200/50 mt-0.5">
            {folders.length === 0
              ? 'Tạo thư mục đầu tiên để bắt đầu scan tài liệu'
              : `${folders.length} thư mục`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/15 text-primary-400 text-sm font-medium hover:bg-primary-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          Tạo thư mục
        </button>
      </div>

      {/* Create Folder Modal */}
      {showCreate && (
        <div className="glass-card p-5 border border-primary-500/20 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-50">Tạo thư mục mới</h3>
            <button onClick={() => setShowCreate(false)} className="text-surface-200/40 hover:text-surface-50">
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên thư mục..."
            className="w-full px-4 py-2.5 rounded-xl bg-surface-800/60 border border-surface-700 text-surface-50 text-sm placeholder:text-surface-200/30 focus:outline-none focus:border-primary-500/50 mb-3"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />

          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-4 h-4 text-surface-200/40" />
            <div className="flex gap-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    newColor === color ? 'ring-2 ring-offset-2 ring-offset-surface-900 ring-white scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="w-full py-2.5 rounded-xl gradient-bg text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
          >
            {creating ? 'Đang tạo...' : 'Tạo thư mục'}
          </button>
        </div>
      )}

      {/* Folder Grid */}
      {folders.length === 0 && !showCreate ? (
        <div className="glass-card p-12 text-center">
          <FolderOpen className="w-12 h-12 text-surface-200/20 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-surface-200/60 mb-2">
            Chưa có thư mục nào
          </h3>
          <p className="text-sm text-surface-200/40 mb-5 max-w-sm mx-auto">
            Bạn cần tạo thư mục trước để lưu trữ và tổ chức tài liệu scan của mình
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tạo thư mục đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {folders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => onSelectFolder(folder)}
              className="glass-card p-5 text-left hover:bg-surface-800/60 transition-all group cursor-pointer relative"
            >
              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, folder.id, folder.name)}
                disabled={deletingId === folder.id}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-surface-200/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                title="Xóa thư mục"
              >
                {deletingId === folder.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${folder.color_code}20` }}
              >
                <FolderOpen className="w-5 h-5" style={{ color: folder.color_code }} />
              </div>
              <h3 className="text-sm font-medium text-surface-50 truncate">{folder.name}</h3>
              <p className="text-[11px] text-surface-200/40 mt-0.5">
                {(folder as any).doc_count || 0} tài liệu
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
