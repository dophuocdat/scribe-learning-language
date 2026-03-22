import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error text-2xl">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold text-surface-50">Đã xảy ra lỗi</h2>
          <p className="text-surface-200/50 text-sm max-w-md">
            {this.state.error?.message || 'Có lỗi không mong muốn xảy ra. Vui lòng thử tải lại trang.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 transition-colors"
          >
            Tải lại trang
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
