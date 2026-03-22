import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { ShieldOff } from 'lucide-react'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-card p-12 text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/15 flex items-center justify-center">
            <ShieldOff className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-xl font-bold text-surface-50 mb-2">Không có quyền truy cập</h2>
          <p className="text-sm text-surface-200/50">
            Bạn cần quyền Admin để truy cập khu vực này.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
