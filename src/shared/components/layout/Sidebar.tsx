import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  BookOpen,
  ScanLine,
  FolderOpen,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  Brain,
  UserCircle,
  Trophy,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/authStore'

const navItems = [
  { path: '/', label: 'Trang chủ', icon: Home },
  { path: '/courses', label: 'Khóa học', icon: BookOpen },
  { path: '/scan', label: 'Smart Scan', icon: ScanLine },
  { path: '/folders', label: 'Thư mục', icon: FolderOpen },
  { path: '/review', label: 'Ôn tập SRS', icon: Brain },
  { path: '/leaderboard', label: 'Bảng xếp hạng', icon: Trophy },
  { path: '/analytics', label: 'Thống kê', icon: BarChart3 },
  { path: '/profile', label: 'Hồ sơ', icon: UserCircle },
]

const adminItems = [
  { path: '/admin', label: 'Quản trị', icon: Shield },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { isAdmin, signOut } = useAuthStore()

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen z-40
        glass border-r border-surface-800
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        hidden lg:flex flex-col
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-surface-800">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shrink-0">
          <ScanLine className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-lg font-bold gradient-text">Scribe</h1>
            <p className="text-[11px] text-surface-200/60">AI Language Learning</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group
                ${isActive
                  ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                  : 'text-surface-200/70 hover:bg-surface-800/60 hover:text-surface-50'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary-400' : 'text-surface-200/50 group-hover:text-primary-400'} transition-colors`} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className={`my-3 border-t border-surface-800 ${collapsed ? 'mx-2' : 'mx-1'}`} />
            {adminItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl
                    transition-all duration-200 group
                    ${isActive
                      ? 'bg-warning/15 text-warning'
                      : 'text-surface-200/70 hover:bg-surface-800/60 hover:text-warning'
                    }
                  `}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-warning' : 'text-surface-200/50 group-hover:text-warning'} transition-colors`} />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User & Settings */}
      <div className="p-3 border-t border-surface-800 space-y-1">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-200/70 hover:bg-surface-800/60 hover:text-surface-50 transition-all"
          title={collapsed ? 'Cài đặt' : undefined}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm">Cài đặt</span>}
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-200/70 hover:bg-error/10 hover:text-error transition-all"
          title={collapsed ? 'Đăng xuất' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm">Đăng xuất</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center hover:bg-primary-500 hover:border-primary-500 transition-all"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  )
}
