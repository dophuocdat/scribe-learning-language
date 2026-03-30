import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  BookOpen,
  ScanLine,
  Brain,
  MoreHorizontal,
  BarChart3,
  UserCircle,
  Settings,
  Trophy,
  Shield,
  LogOut,
  X,
  PenTool,
  Headphones,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/authStore'

const tabs = [
  { path: '/', label: 'Trang chủ', icon: Home },
  { path: '/courses', label: 'Khóa học', icon: BookOpen },
  { path: '/scan', label: 'Scan', icon: ScanLine, isCenter: true },
  { path: '/review', label: 'Ôn tập', icon: Brain },
]

const moreItems = [
  { path: '/writing-tools', label: 'Công cụ viết', icon: PenTool },
  { path: '/listening', label: 'Luyện nghe', icon: Headphones },
  { path: '/leaderboard', label: 'Bảng xếp hạng', icon: Trophy },
  { path: '/analytics', label: 'Thống kê', icon: BarChart3 },
  { path: '/profile', label: 'Hồ sơ', icon: UserCircle },
  { path: '/settings', label: 'Cài đặt', icon: Settings },
]

const adminItems = [
  { path: '/admin', label: 'Quản trị', icon: Shield },
]

export function MobileNav() {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()
  const { isAdmin, signOut } = useAuthStore()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close more menu on route change
  useEffect(() => {
    setShowMore(false)
  }, [location.pathname])

  // Close on click outside
  useEffect(() => {
    if (!showMore) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMore])

  const moreActivePaths = [...moreItems, ...adminItems].map(i => i.path)
  const isMoreActive = moreActivePaths.some(p =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
  )

  return (
    <>
      {/* Backdrop overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* Slide-up More menu */}
      <div
        ref={menuRef}
        className={`
          fixed bottom-[64px] left-0 right-0 z-50 lg:hidden
          transition-all duration-300 ease-out
          ${showMore
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-4 opacity-0 pointer-events-none'
          }
        `}
      >
        <div className="mx-3 mb-2 rounded-2xl glass border border-surface-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50">
            <span className="text-sm font-semibold text-surface-100">Thêm</span>
            <button
              onClick={() => setShowMore(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-700/50 text-surface-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Menu items */}
          <div className="p-2 space-y-0.5">
            {moreItems.map((item) => {
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl
                    transition-all duration-200
                    ${isActive
                      ? 'bg-primary-500/15 text-primary-400'
                      : 'text-surface-200/80 active:bg-surface-700/40'
                    }
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-400' : 'text-surface-200/50'}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              )
            })}

            {isAdmin && (
              <>
                <div className="my-1 mx-2 border-t border-surface-700/50" />
                {adminItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl
                        transition-all duration-200
                        ${isActive
                          ? 'bg-warning/15 text-warning'
                          : 'text-surface-200/80 active:bg-surface-700/40'
                        }
                      `}
                    >
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-warning' : 'text-surface-200/50'}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </>
            )}

            <div className="my-1 mx-2 border-t border-surface-700/50" />
            <button
              onClick={() => {
                setShowMore(false)
                signOut()
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-200/80 active:bg-error/10 active:text-error transition-all duration-200"
            >
              <LogOut className="w-5 h-5 text-surface-200/50" />
              <span className="text-sm font-medium">Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass border-t border-surface-800">
        <div className="flex items-center justify-around px-2 py-1">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path

            if (tab.isCenter) {
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className="relative -top-4"
                >
                  <div className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center
                    gradient-bg shadow-lg shadow-primary-500/30
                    transition-transform active:scale-90
                  `}>
                    <tab.icon className="w-6 h-6 text-white" />
                  </div>
                </Link>
              )
            }

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`
                  flex flex-col items-center gap-0.5 py-2 px-3
                  transition-colors duration-200
                  ${isActive ? 'text-primary-400' : 'text-surface-200/50'}
                `}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`
              flex flex-col items-center gap-0.5 py-2 px-3
              transition-colors duration-200
              ${showMore || isMoreActive ? 'text-primary-400' : 'text-surface-200/50'}
            `}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">Thêm</span>
          </button>
        </div>
      </nav>
    </>
  )
}
