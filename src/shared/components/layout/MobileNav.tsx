import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  BookOpen,
  ScanLine,
  FolderOpen,
  Brain,
} from 'lucide-react'

const tabs = [
  { path: '/', label: 'Trang chủ', icon: Home },
  { path: '/courses', label: 'Khóa học', icon: BookOpen },
  { path: '/scan', label: 'Scan', icon: ScanLine, isCenter: true },
  { path: '/folders', label: 'Thư mục', icon: FolderOpen },
  { path: '/review', label: 'Ôn tập', icon: Brain },
]

export function MobileNav() {
  const location = useLocation()

  return (
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
      </div>
    </nav>
  )
}
