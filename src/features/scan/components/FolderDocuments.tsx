import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Plus,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
  ScanLine,
} from 'lucide-react'
import { useScanStore } from '../stores/scanStore'
import type { UserFolder } from '@/shared/types/database'

interface FolderDocumentsProps {
  folder: UserFolder
  onBack: () => void
  onStartScan: () => void
}

export function FolderDocuments({ folder, onBack, onStartScan }: FolderDocumentsProps) {
  const { scanLogs, loadingLogs, fetchScanLogs, scanStatus } = useScanStore()

  useEffect(() => {
    fetchScanLogs(folder.id)
  }, [folder.id, fetchScanLogs])

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3" /> Hoàn thành
          </span>
        )
      case 'generating':
        return (
          <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" /> Đang tạo
          </span>
        )
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" /> Lỗi
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" /> Đã scan
          </span>
        )
    }
  }

  const remainingScans = scanStatus?.remainingScans ?? 2

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-surface-800/60 text-surface-200/50 hover:text-surface-50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-surface-50 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color_code }} />
              {folder.name}
            </h2>
            <p className="text-xs text-surface-200/40">{scanLogs.length} tài liệu</p>
          </div>
        </div>

        <button
          onClick={onStartScan}
          disabled={remainingScans <= 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Thêm tài liệu
          {remainingScans < 2 && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
              còn {remainingScans}
            </span>
          )}
        </button>
      </div>

      {/* Document List */}
      {loadingLogs ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse flex gap-4">
              <div className="w-10 h-10 bg-surface-800/60 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 bg-surface-800/60 rounded" />
                <div className="h-3 w-1/4 bg-surface-800/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : scanLogs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <ScanLine className="w-12 h-12 text-surface-200/20 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-surface-200/60 mb-2">
            Chưa có tài liệu nào
          </h3>
          <p className="text-sm text-surface-200/40 mb-5 max-w-sm mx-auto">
            Nhấn "Thêm tài liệu" để chụp ảnh hoặc upload file và bắt đầu học
          </p>
          <button
            onClick={onStartScan}
            disabled={remainingScans <= 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-all"
          >
            <ScanLine className="w-4 h-4" />
            Scan tài liệu đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {scanLogs.map((log) => {
            const courseTitle = log.course?.title || 'Tài liệu chưa xử lý'
            const date = new Date(log.created_at).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            if (log.scan_status === 'completed' && log.course_id) {
              // Find the first lesson from the course
              return (
                <Link
                  key={log.id}
                  to={`/courses/${log.course_id}`}
                  className="glass-card p-4 flex items-center gap-4 hover:bg-surface-800/60 transition-all group block"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-surface-50 truncate group-hover:text-primary-400 transition-colors">
                      {courseTitle}
                    </h4>
                    <p className="text-xs text-surface-200/40">{date}</p>
                  </div>
                  {statusBadge(log.scan_status)}
                </Link>
              )
            }

            return (
              <div key={log.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-800/60 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-surface-200/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-surface-200/60 truncate">
                    {courseTitle}
                  </h4>
                  <p className="text-xs text-surface-200/40">{date}</p>
                </div>
                {statusBadge(log.scan_status)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
