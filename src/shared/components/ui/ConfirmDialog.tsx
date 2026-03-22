import { Modal } from './Modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  confirmVariant?: 'danger' | 'primary'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  message,
  confirmText = 'Xác nhận',
  confirmVariant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="text-center">
        <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${
          confirmVariant === 'danger' ? 'bg-error/15' : 'bg-primary-500/15'
        }`}>
          <AlertTriangle className={`w-7 h-7 ${
            confirmVariant === 'danger' ? 'text-error' : 'text-primary-400'
          }`} />
        </div>
        <h3 className="text-lg font-semibold text-surface-50 mb-2">{title}</h3>
        <p className="text-sm text-surface-200/60 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 transition-all disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-error text-white hover:bg-error/80'
                : 'gradient-bg text-white hover:opacity-90'
            }`}
          >
            {isLoading ? 'Đang xử lý...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
