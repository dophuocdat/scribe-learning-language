import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, BookOpen, FolderTree, GraduationCap, LogOut, Zap, Users } from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/authStore'

const adminTabs = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/courses', label: 'Khóa học', icon: BookOpen, end: false },
  { path: '/admin/categories', label: 'Danh mục', icon: FolderTree, end: false },
  { path: '/admin/levels', label: 'Cấp độ', icon: GraduationCap, end: false },
  { path: '/admin/xp', label: 'Quản lý XP', icon: Zap, end: false },
  { path: '/admin/users', label: 'Người dùng', icon: Users, end: false },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const { signOut, user } = useAuthStore()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="animate-fade-in">
      {/* Admin Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text mb-1">Quản trị hệ thống</h1>
          <p className="text-sm text-surface-200/50">Quản lý khóa học, bài học và nội dung</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-200/50 hidden sm:inline">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-surface-900/50 border border-surface-800/50 overflow-x-auto">
        {adminTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                  : 'text-surface-200/60 hover:text-surface-50 hover:bg-surface-800/50'
              }`
            }
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Content */}
      <Outlet />
    </div>
  )
}
