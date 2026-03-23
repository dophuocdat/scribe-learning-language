import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  BookOpen,
  Languages,
  Brain,
} from 'lucide-react'
import { useScanStore } from '../stores/scanStore'

interface ScanResultViewProps {
  onBack: () => void
}

export function ScanResultView({ onBack }: ScanResultViewProps) {
  const navigate = useNavigate()
  const { scanResult, generating, generateLesson, error, clearError } = useScanStore()
  const [showFullText, setShowFullText] = useState(false)

  if (!scanResult) return null

  const handleGenerate = async () => {
    clearError()
    const result = await generateLesson(scanResult.scanLogId)
    if (result) {
      // Navigate to the lesson
      if (result.lessonId) {
        navigate(`/lessons/${result.lessonId}`)
      } else if (result.courseId) {
        navigate(`/courses/${result.courseId}`)
      }
    }
  }

  const displayText = showFullText
    ? scanResult.text
    : scanResult.text.substring(0, 500) + (scanResult.text.length > 500 ? '...' : '')

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
          <h2 className="text-lg font-semibold text-surface-50">Kết quả scan</h2>
          <p className="text-xs text-surface-200/40">{scanResult.charCount} ký tự · còn {scanResult.remainingScans} lượt scan</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Extracted Text */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 flex items-center gap-2 border-b border-surface-800">
          <FileText className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-surface-50">Nội dung trích xuất</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-surface-200/70 leading-relaxed whitespace-pre-wrap">
            {displayText}
          </p>
          {scanResult.text.length > 500 && (
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="mt-2 text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              {showFullText ? 'Thu gọn' : 'Xem toàn bộ'}
            </button>
          )}
        </div>
      </div>

      {/* What AI will generate */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-surface-50 mb-3">AI sẽ tạo cho bạn:</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-surface-800/40">
            <BookOpen className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
            <p className="text-[11px] text-surface-200/50">Nội dung bài học</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-surface-800/40">
            <Languages className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-[11px] text-surface-200/50">10 từ vựng</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-surface-800/40">
            <Brain className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
            <p className="text-[11px] text-surface-200/50">8 bài tập</p>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all text-sm"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI đang tạo bài tập...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            AI Tạo bài tập
          </>
        )}
      </button>

      {generating && (
        <div className="glass-card p-5 text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary-400 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-surface-50 mb-1">Đang tạo bài tập</p>
          <p className="text-xs text-surface-200/40">
            AI đang phân tích nội dung và tạo từ vựng, bài tập cho bạn. Quá trình này mất khoảng 15-30 giây...
          </p>
        </div>
      )}
    </div>
  )
}
