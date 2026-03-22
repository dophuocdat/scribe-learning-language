import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="lg:ml-[260px] min-h-screen pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  )
}
