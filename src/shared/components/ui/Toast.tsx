import { useToastStore } from '@/shared/stores/toastStore'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-error/30 bg-error/10 text-error',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-primary-400/30 bg-primary-400/10 text-primary-400',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[60] space-y-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md animate-slide-up ${styles[toast.type]}`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded hover:bg-surface-50/10 transition-all shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
