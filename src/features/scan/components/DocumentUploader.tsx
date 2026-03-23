import { useState, useRef } from 'react'
import {
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  ArrowLeft,
  ScanLine,
  Plus,
} from 'lucide-react'
import { useScanStore } from '../stores/scanStore'

const MAX_IMAGES = 3

interface DocumentUploaderProps {
  folderId: string
  onBack: () => void
  onScanComplete: () => void
}

export function DocumentUploader({ folderId, onBack, onScanComplete }: DocumentUploaderProps) {
  const { scanning, scanDocument, error, clearError } = useScanStore()
  const [previews, setPreviews] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const addMoreRef = useRef<HTMLInputElement>(null)

  const addImage = (file: File) => {
    clearError()
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return
    if (file.size > 10 * 1024 * 1024) return
    if (previews.length >= MAX_IMAGES) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setPreviews(prev => [...prev, result])
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (index: number) => {
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    for (const file of files.slice(0, MAX_IMAGES - previews.length)) {
      addImage(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files.slice(0, MAX_IMAGES - previews.length)) {
      addImage(file)
    }
    e.target.value = ''
  }

  const handleScan = async () => {
    if (previews.length === 0) return

    // Extract base64 from all previews
    const base64List = previews
      .map(p => p.split(',')[1])
      .filter(Boolean) as string[]

    if (base64List.length === 0) return

    const result = await scanDocument(base64List, folderId)
    if (result) {
      onScanComplete()
    }
  }

  const canAddMore = previews.length < MAX_IMAGES

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-surface-800/60 text-surface-200/50 hover:text-surface-50 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-surface-50">Thêm tài liệu</h2>
          <p className="text-xs text-surface-200/40">Tối đa {MAX_IMAGES} trang/ảnh</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {previews.length === 0 ? (
        <>
          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`glass-card p-12 border-2 border-dashed cursor-pointer text-center transition-all ${
              dragActive
                ? 'border-primary-500 bg-primary-500/5'
                : 'border-surface-700 hover:border-primary-500/50 hover:bg-surface-800/40'
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-4 ${dragActive ? 'text-primary-400' : 'text-surface-200/30'}`} />
            <p className="text-sm font-medium text-surface-200/60 mb-1">
              Kéo thả ảnh vào đây hoặc nhấn để chọn
            </p>
            <p className="text-xs text-surface-200/30">
              Hỗ trợ: JPG, PNG, WEBP · Tối đa {MAX_IMAGES} ảnh · Mỗi ảnh tối đa 10MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Camera Capture */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full glass-card p-5 flex items-center gap-4 hover:bg-surface-800/60 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0 group-hover:bg-primary-500/20 transition-colors">
              <Camera className="w-6 h-6 text-primary-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-surface-50">Chụp ảnh trực tiếp</p>
              <p className="text-xs text-surface-200/40">Sử dụng camera để chụp tài liệu</p>
            </div>
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
        </>
      ) : (
        <>
          {/* Preview Grid */}
          <div className="glass-card overflow-hidden">
            <div className="p-3 flex items-center justify-between border-b border-surface-800">
              <span className="text-xs text-surface-200/50 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                {previews.length}/{MAX_IMAGES} trang
              </span>
              <button
                onClick={() => { setPreviews([]); clearError() }}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                Xóa tất cả
              </button>
            </div>

            <div className="p-4 grid grid-cols-3 gap-3 bg-surface-900/50">
              {previews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={`Trang ${index + 1}`}
                    className="w-full aspect-[3/4] rounded-lg object-cover border border-surface-700/50"
                  />
                  {/* Page number */}
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white">
                    {index + 1}
                  </span>
                  {/* Remove button */}
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Add more button */}
              {canAddMore && (
                <button
                  onClick={() => addMoreRef.current?.click()}
                  className="w-full aspect-[3/4] rounded-lg border-2 border-dashed border-surface-700 hover:border-primary-500/50 flex flex-col items-center justify-center gap-1.5 text-surface-200/30 hover:text-primary-400 transition-all"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Thêm ảnh</span>
                </button>
              )}
            </div>
          </div>

          <input
            ref={addMoreRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="w-full py-3 rounded-xl gradient-bg text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all"
          >
            {scanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang scan {previews.length} trang...
              </>
            ) : (
              <>
                <ScanLine className="w-4 h-4" />
                Scan {previews.length} trang
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}
