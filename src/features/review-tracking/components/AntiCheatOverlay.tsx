import { AlertTriangle, EyeOff } from 'lucide-react'

interface AntiCheatOverlayProps {
  count: number
}

export function AntiCheatOverlay({ count }: AntiCheatOverlayProps) {
  const isFlagged = count > 3

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/80 backdrop-blur-sm animate-fade-in pointer-events-none">
      <div className={`glass-card p-6 max-w-sm mx-4 text-center space-y-3 border ${
        isFlagged ? 'border-error/40 bg-error/10' : 'border-amber-500/40 bg-amber-500/10'
      }`}>
        <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
          isFlagged ? 'bg-error/20' : 'bg-amber-500/20'
        }`}>
          {isFlagged
            ? <EyeOff className="w-7 h-7 text-error" />
            : <AlertTriangle className="w-7 h-7 text-amber-400" />}
        </div>

        <h3 className={`text-lg font-bold ${isFlagged ? 'text-error' : 'text-amber-400'}`}>
          {isFlagged ? '⚠️ Bài tập bị đánh dấu' : '⚠️ Vui lòng tập trung!'}
        </h3>

        <p className="text-sm text-surface-200/60">
          {isFlagged
            ? 'Bạn đã rời trang quá nhiều lần. Kết quả bài này sẽ không được tính vào mastery.'
            : `Phát hiện chuyển tab (${count}/3 lần). Hãy tập trung làm bài mà không sử dụng công cụ hỗ trợ khác.`}
        </p>
      </div>
    </div>
  )
}
