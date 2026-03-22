import { useState, useEffect } from 'react'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { supabase } from '@/shared/lib/supabase'
import {
  User,
  Flame,
  Trophy,
  Zap,
  Target,
  Clock,
  Save,
  Loader2,
  Star,
  TrendingUp,
  Calendar,
  Award,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useToastStore } from '@/shared/stores/toastStore'

export function ProfilePage() {
  const { user, profile, updateProfile } = useAuthStore()
  const addToast = useToastStore((s) => s.addToast)

  const [displayName, setDisplayName] = useState('')
  const [targetExam, setTargetExam] = useState<'TOEIC' | 'IELTS' | ''>('')
  const [targetScore, setTargetScore] = useState('')
  const [dailyGoal, setDailyGoal] = useState('30')
  const [saving, setSaving] = useState(false)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setTargetExam(profile.target_exam || '')
      setTargetScore(profile.target_score?.toString() || '')
      setDailyGoal(profile.daily_goal_minutes?.toString() || '30')
    }
  }, [profile])

  const level = profile?.current_level ?? 1
  const totalXp = profile?.total_xp ?? 0
  const currentStreak = profile?.current_streak ?? 0
  const longestStreak = profile?.longest_streak ?? 0

  // XP for current level and next level
  const xpForCurrentLevel = ((level - 1) * (level - 1)) * 100
  const xpForNextLevel = (level * level) * 100
  const xpProgress = totalXp - xpForCurrentLevel
  const xpNeeded = xpForNextLevel - xpForCurrentLevel
  const progressPercent = xpNeeded > 0 ? Math.min((xpProgress / xpNeeded) * 100, 100) : 0

  const handleSave = async () => {
    setSaving(true)
    try {
      const success = await updateProfile({
        display_name: displayName || null,
        target_exam: (targetExam as 'TOEIC' | 'IELTS') || null,
        target_score: targetScore ? parseInt(targetScore) : null,
        daily_goal_minutes: parseInt(dailyGoal) || 30,
      })
      if (success) {
        addToast('success', 'Đã lưu thông tin cá nhân!')
      } else {
        addToast('error', 'Lỗi khi lưu dữ liệu')
      }
    } catch {
      addToast('error', 'Lỗi không xác định')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    // Validate
    if (!newPassword) {
      addToast('error', 'Vui lòng nhập mật khẩu mới')
      return
    }
    if (newPassword.length < 6) {
      addToast('error', 'Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      addToast('error', 'Mật khẩu xác nhận không khớp')
      return
    }

    setChangingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) {
        addToast('error', error.message || 'Lỗi khi đổi mật khẩu')
      } else {
        addToast('success', 'Đã đổi mật khẩu thành công!')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      addToast('error', 'Lỗi không xác định')
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Hồ sơ & Cài đặt</h1>
        <p className="text-surface-200/60 text-sm mt-1">Quản lý thông tin cá nhân và mục tiêu học tập</p>
      </div>

      {/* Level & XP Hero Card */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-[0.08]" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-primary-500/30">
              {displayName ? displayName.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface-900 border-2 border-primary-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-400">{level}</span>
            </div>
          </div>

          {/* Level info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-surface-50">{displayName || user?.email || 'Người dùng'}</h2>
            <p className="text-surface-200/60 text-sm">{user?.email}</p>

            {/* XP Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-primary-400 font-medium flex items-center gap-1">
                  <Star className="w-3 h-3" /> Level {level}
                </span>
                <span className="text-xs text-surface-200/50">
                  {xpProgress.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                </span>
              </div>
              <div className="h-2.5 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full gradient-bg transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stat badges row */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <StatBadge icon={Zap} label="Tổng XP" value={totalXp.toLocaleString()} color="text-amber-400" />
          <StatBadge icon={TrendingUp} label="Level" value={level.toString()} color="text-primary-400" />
          <StatBadge icon={Flame} label="Streak hiện tại" value={`${currentStreak} ngày`} color="text-orange-400" />
          <StatBadge icon={Trophy} label="Streak cao nhất" value={`${longestStreak} ngày`} color="text-emerald-400" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info Card */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold text-surface-50 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary-400" /> Thông tin cá nhân
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-surface-200/60 mb-1.5 font-medium">Tên hiển thị</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên của bạn"
                className="w-full bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-200/60 mb-1.5 font-medium">Email</label>
              <div className="w-full bg-surface-800/30 border border-surface-700/50 rounded-xl px-4 py-2.5 text-sm text-surface-200/50 cursor-not-allowed">
                {user?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Goals Card */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold text-surface-50 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-400" /> Mục tiêu học tập
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-surface-200/60 mb-1.5 font-medium">Kỳ thi mục tiêu</label>
              <select
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value as 'TOEIC' | 'IELTS' | '')}
                className="w-full bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition-all appearance-none"
              >
                <option value="">Chưa chọn</option>
                <option value="TOEIC">TOEIC</option>
                <option value="IELTS">IELTS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-200/60 mb-1.5 font-medium">Điểm mục tiêu</label>
              <input
                type="number"
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
                placeholder={targetExam === 'IELTS' ? '0.0 - 9.0' : '10 - 990'}
                className="w-full bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-200/60 mb-1.5 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Mục tiêu học mỗi ngày (phút)
              </label>
              <input
                type="number"
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
                min="5"
                max="240"
                className="w-full bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Learning Activity Summary */}
      <div className="glass-card p-5">
        <h3 className="text-base font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-primary-400" /> Tóm tắt hoạt động
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ActivityCard icon={Calendar} label="Ngày hoạt động cuối" value={profile?.last_active_date ? new Date(profile.last_active_date).toLocaleDateString('vi-VN') : 'Chưa có'} />
          <ActivityCard icon={Target} label="Kỳ thi" value={profile?.target_exam || 'Chưa chọn'} />
          <ActivityCard icon={TrendingUp} label="Điểm mục tiêu" value={profile?.target_score?.toString() || '—'} />
          <ActivityCard icon={Clock} label="Mục tiêu/ngày" value={`${profile?.daily_goal_minutes || 30} phút`} />
        </div>
      </div>

      {/* Change Password Card */}
      <div className="glass-card p-5">
        <h3 className="text-base font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary-400" /> Đổi mật khẩu
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-surface-200/60 mb-1.5 font-medium">Mật khẩu mới</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/40 hover:text-surface-200/70 transition-colors"
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-surface-200/60 mb-1.5 font-medium">Xác nhận mật khẩu</label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/40 hover:text-surface-200/70 transition-colors"
              >
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        {/* Password strength hint */}
        {newPassword && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    newPassword.length >= i * 3
                      ? newPassword.length >= 12
                        ? 'bg-emerald-400'
                        : newPassword.length >= 8
                        ? 'bg-amber-400'
                        : 'bg-orange-400'
                      : 'bg-surface-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-surface-200/50">
              {newPassword.length < 6 ? 'Quá yếu' : newPassword.length < 8 ? 'Yếu' : newPassword.length < 12 ? 'Trung bình' : 'Mạnh'}
            </span>
          </div>
        )}
        {/* Confirm mismatch warning */}
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="text-xs text-red-400 mt-2">⚠ Mật khẩu xác nhận không khớp</p>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={handleChangePassword}
            disabled={changingPw || !newPassword || newPassword !== confirmPassword}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-50 text-sm font-medium hover:bg-surface-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {changingPw ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {changingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </div>

      {/* Save profile button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-primary-500/20"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  )
}

/* === Sub-Components === */

function StatBadge({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string
}) {
  return (
    <div className="bg-surface-800/40 rounded-xl p-3 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
      <div className="text-base font-bold text-surface-50">{value}</div>
      <div className="text-[10px] text-surface-200/50 mt-0.5">{label}</div>
    </div>
  )
}

function ActivityCard({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string
}) {
  return (
    <div className="bg-surface-800/30 rounded-xl p-3">
      <Icon className="w-4 h-4 text-surface-200/40 mb-1.5" />
      <div className="text-sm font-semibold text-surface-50">{value}</div>
      <div className="text-[10px] text-surface-200/50 mt-0.5">{label}</div>
    </div>
  )
}

