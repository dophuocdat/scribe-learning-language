import { ScanLine, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/features/auth/stores/authStore'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password, displayName)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary-500/10 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent-500/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/20">
            <ScanLine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Scribe</h1>
          <p className="text-surface-200/60 mt-2">
            AI Language Learning Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold text-center mb-6">
            {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </h2>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-surface-700 hover:border-surface-600 bg-surface-800/50 hover:bg-surface-800 transition-all text-sm font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Tiếp tục với Google
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-surface-700" />
            <span className="text-xs text-surface-200/40 uppercase tracking-wider">hoặc</span>
            <div className="flex-1 border-t border-surface-700" />
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
                <input
                  type="text"
                  placeholder="Tên hiển thị"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/50 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all text-sm placeholder:text-surface-200/30"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/50 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all text-sm placeholder:text-surface-200/30"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
              <input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/50 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all text-sm placeholder:text-surface-200/30"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl gradient-bg text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-sm text-surface-200/50 mt-6">
            {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
            >
              {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
