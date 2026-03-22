import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, duration = 3000) => {
    const id = crypto.randomUUID()
    const MAX_TOASTS = 5
    set((state) => {
      const updated = [...state.toasts, { id, type, message, duration }]
      // Evict oldest if exceeding max
      return { toasts: updated.length > MAX_TOASTS ? updated.slice(-MAX_TOASTS) : updated }
    })

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
