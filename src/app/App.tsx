import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { AppLayout } from '@/shared/components/layout/AppLayout'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ToastContainer } from '@/shared/components/ui/Toast'
import { XpToast } from '@/shared/components/ui/XpToast'
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary'

// Learn imports
import { CoursesCatalogPage } from '@/features/learn/pages/CoursesCatalogPage'
import { CourseDetailPage } from '@/features/learn/pages/CourseDetailPage'
import { LessonStudyPage } from '@/features/learn/pages/LessonStudyPage'
import { SrsReviewPage } from '@/features/learn/pages/SrsReviewPage'
import { LeaderboardPage } from '@/features/learn/pages/LeaderboardPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'
import { SmartScanPage } from '@/features/scan/pages/SmartScanPage'

// Admin imports
import { AdminGuard } from '@/features/admin/components/AdminGuard'
import { AdminLayout } from '@/features/admin/components/AdminLayout'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { CourseListPage } from '@/features/admin/pages/CourseListPage'
import { CourseFormPage } from '@/features/admin/pages/CourseFormPage'
import { LessonListPage } from '@/features/admin/pages/LessonListPage'
import { LessonFormPage } from '@/features/admin/pages/LessonFormPage'
import { CategoryManagerPage } from '@/features/admin/pages/CategoryManagerPage'
import { CategoryCoursesPage } from '@/features/admin/pages/CategoryCoursesPage'
import { DifficultyLevelPage } from '@/features/admin/pages/DifficultyLevelPage'
import { XpManagementPage } from '@/features/admin/pages/XpManagementPage'
import { UserManagementPage } from '@/features/admin/pages/UserManagementPage'

// Placeholder pages — will be implemented in later phases
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="glass-card p-12 text-center max-w-md">
        <h2 className="text-2xl font-bold gradient-text mb-3">{title}</h2>
        <p className="text-surface-200/50 text-sm">
          Tính năng này đang được phát triển. Hãy quay lại sau nhé! 🚀
        </p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function App() {
  const { initialize, user, isLoading } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-200/50 text-sm">Đang tải Scribe...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <LoginPage />}
          />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="courses" element={<CoursesCatalogPage />} />
          <Route path="courses/:courseId" element={<CourseDetailPage />} />
          <Route path="lessons/:lessonId" element={<LessonStudyPage />} />
          <Route path="scan" element={<SmartScanPage />} />
          <Route path="folders" element={<SmartScanPage />} />
          <Route path="review" element={<SrsReviewPage />} />
          <Route path="analytics" element={<PlaceholderPage title="Thống kê" />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<ProfilePage />} />

          {/* Admin Routes — protected by AdminGuard */}
          <Route path="admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="courses" element={<CourseListPage />} />
            <Route path="courses/new" element={<CourseFormPage />} />
            <Route path="courses/:courseId/edit" element={<CourseFormPage />} />
            <Route path="courses/:courseId/lessons" element={<LessonListPage />} />
            <Route path="courses/:courseId/lessons/new" element={<LessonFormPage />} />
            <Route path="courses/:courseId/lessons/:lessonId/edit" element={<LessonFormPage />} />
            <Route path="categories" element={<CategoryManagerPage />} />
            <Route path="categories/:categoryId/courses" element={<CategoryCoursesPage />} />
            <Route path="categories/:categoryId/courses/new" element={<CourseFormPage />} />
            <Route path="levels" element={<DifficultyLevelPage />} />
            <Route path="xp" element={<XpManagementPage />} />
            <Route path="users" element={<UserManagementPage />} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Toast Notifications */}
      <ToastContainer />
      <XpToast />
      </ErrorBoundary>
    </BrowserRouter>
  )
}
