import { useEffect, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { useScanStore } from '../stores/scanStore'
import { FolderList } from '../components/FolderList'
import { FolderDocuments } from '../components/FolderDocuments'
import { DocumentUploader } from '../components/DocumentUploader'
import { ScanResultView } from '../components/ScanResultView'
import type { UserFolder } from '@/shared/types/database'

type ViewState = 'folders' | 'documents' | 'upload' | 'result'

export function SmartScanPage() {
  const {
    fetchFolders,
    checkScanStatus,
    setCurrentFolder,
    scanStatus,
  } = useScanStore()

  const [view, setView] = useState<ViewState>('folders')
  const [selectedFolder, setSelectedFolder] = useState<UserFolder | null>(null)

  useEffect(() => {
    fetchFolders()
    checkScanStatus()
  }, [fetchFolders, checkScanStatus])

  const handleSelectFolder = (folder: UserFolder) => {
    setSelectedFolder(folder)
    setCurrentFolder(folder)
    setView('documents')
  }

  const handleBackToFolders = () => {
    setSelectedFolder(null)
    setCurrentFolder(null)
    setView('folders')
  }

  const handleStartScan = () => {
    setView('upload')
  }

  const handleScanComplete = () => {
    setView('result')
  }

  const handleBackToDocuments = () => {
    setView('documents')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Smart Scan</h1>
            <p className="text-xs text-surface-200/40">
              Quét tài liệu · AI tạo bài tập tự động
            </p>
          </div>
        </div>
        {scanStatus && (
          <div className="text-right">
            <p className="text-xs text-surface-200/40">Lượt scan hôm nay</p>
            <p className="text-sm font-semibold text-surface-50">
              <span className={scanStatus.remainingScans > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {scanStatus.remainingScans}
              </span>
              <span className="text-surface-200/30">/{scanStatus.maxScans}</span>
            </p>
          </div>
        )}
      </div>

      {/* View Router */}
      {view === 'folders' && (
        <FolderList onSelectFolder={handleSelectFolder} />
      )}

      {view === 'documents' && selectedFolder && (
        <FolderDocuments
          folder={selectedFolder}
          onBack={handleBackToFolders}
          onStartScan={handleStartScan}
        />
      )}

      {view === 'upload' && selectedFolder && (
        <DocumentUploader
          folderId={selectedFolder.id}
          onBack={handleBackToDocuments}
          onScanComplete={handleScanComplete}
        />
      )}

      {view === 'result' && (
        <ScanResultView onBack={handleBackToDocuments} />
      )}
    </div>
  )
}
