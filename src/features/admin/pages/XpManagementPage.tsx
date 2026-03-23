import { useState, useEffect } from 'react'
import {
  Zap,
  Search,
  Loader2,
  Users,
  TrendingUp,
  Send,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useToastStore } from '@/shared/stores/toastStore'
import type { UserProfile, UserXpHistory } from '@/shared/types/database'

/* ===== Types ===== */

interface UserWithXp extends UserProfile {
  expanded?: boolean
  xpHistory?: UserXpHistory[]
  loadingHistory?: boolean
}

const XP_SOURCES = [
  { value: 'quiz_complete', label: 'Quiz hoàn thành' },
  { value: 'srs_review', label: 'Ôn tập SRS' },
  { value: 'scan', label: 'Smart Scan' },
  { value: 'streak_bonus', label: 'Bonus streak' },
  { value: 'achievement', label: 'Thành tựu' },
  { value: 'admin_manual', label: 'Admin thêm thủ công' },
]

/* ===== Component ===== */

export function XpManagementPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [users, setUsers] = useState<UserWithXp[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Award XP form state
  const [awardUserId, setAwardUserId] = useState('')
  const [awardAmount, setAwardAmount] = useState('')
  const [awardSource, setAwardSource] = useState('admin_manual')
  const [awarding, setAwarding] = useState(false)

  /* ---- Fetch users ---- */
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('total_xp', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Fetch users error:', err)
      addToast('error', 'Không thể tải danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- Fetch XP history for a user ---- */
  const fetchXpHistory = async (userId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, loadingHistory: true } : u
      )
    )
    try {
      const { data, error } = await supabase
        .from('user_xp_history')
        .select('*')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })
        .limit(20)

      if (error) throw error

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, xpHistory: data || [], loadingHistory: false, expanded: true }
            : u
        )
      )
    } catch (err) {
      console.error('Fetch XP history error:', err)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, loadingHistory: false } : u
        )
      )
    }
  }

  const toggleExpand = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return

    if (user.expanded) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, expanded: false } : u
        )
      )
    } else {
      fetchXpHistory(userId)
    }
  }

  /* ---- Award XP ---- */
  const handleAwardXp = async () => {
    if (!awardUserId || !awardAmount) {
      addToast('error', 'Vui lòng chọn người dùng và nhập số XP')
      return
    }
    const amount = parseInt(awardAmount)
    if (isNaN(amount) || amount <= 0) {
      addToast('error', 'Số XP phải là số dương')
      return
    }

    setAwarding(true)
    try {
      const { error } = await supabase.rpc('award_xp_atomic', {
        p_user_id: awardUserId,
        p_amount: amount,
        p_source: awardSource,
        p_source_id: null,
      })

      if (error) throw error

      addToast('success', `Đã trao +${amount} XP thành công!`)
      setAwardAmount('')
      setAwardUserId('')

      // Refresh users list
      await fetchUsers()
    } catch (err) {
      console.error('Award XP error:', err)
      addToast('error', 'Không thể trao XP. Kiểm tra lại.')
    } finally {
      setAwarding(false)
    }
  }

  /* ---- Filtered users ---- */
  const filteredUsers = searchQuery.trim()
    ? users.filter((u) =>
        u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.includes(searchQuery)
      )
    : users

  const sourceLabel = (source: string) =>
    XP_SOURCES.find((s) => s.value === source)?.label || source

  /* ===== Render ===== */

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-surface-50 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Quản lý XP
        </h2>
        <p className="text-sm text-surface-200/50 mt-1">
          Xem, quản lý và trao XP thủ công cho người dùng
        </p>
      </div>

      {/* Award XP Card */}
      <div className="glass-card p-5">
        <h3 className="text-base font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Send className="w-4 h-4 text-amber-400" />
          Trao XP thủ công
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* User select */}
          <select
            value={awardUserId}
            onChange={(e) => setAwardUserId(e.target.value)}
            className="bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all appearance-none"
          >
            <option value="">Chọn người dùng...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name || 'Ẩn danh'} ({u.total_xp} XP)
              </option>
            ))}
          </select>

          {/* XP Amount */}
          <input
            type="number"
            value={awardAmount}
            onChange={(e) => setAwardAmount(e.target.value)}
            placeholder="Số XP"
            min="1"
            className="bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all"
          />

          {/* Source select */}
          <select
            value={awardSource}
            onChange={(e) => setAwardSource(e.target.value)}
            className="bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all appearance-none"
          >
            {XP_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Submit */}
          <button
            onClick={handleAwardXp}
            disabled={awarding || !awardUserId || !awardAmount}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {awarding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {awarding ? 'Đang trao...' : 'Trao XP'}
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 text-center">
          <Users className="w-5 h-5 mx-auto mb-1.5 text-primary-400" />
          <div className="text-xl font-bold text-surface-50">{users.length}</div>
          <div className="text-[10px] text-surface-200/50">Người dùng</div>
        </div>
        <div className="glass-card p-4 text-center">
          <Zap className="w-5 h-5 mx-auto mb-1.5 text-amber-400" />
          <div className="text-xl font-bold text-surface-50">
            {users.reduce((sum, u) => sum + u.total_xp, 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-surface-200/50">Tổng XP hệ thống</div>
        </div>
        <div className="glass-card p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-primary-400" />
          <div className="text-xl font-bold text-surface-50">
            {users.length > 0 ? Math.round(users.reduce((sum, u) => sum + u.total_xp, 0) / users.length) : 0}
          </div>
          <div className="text-[10px] text-surface-200/50">XP trung bình</div>
        </div>
        <div className="glass-card p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-success" />
          <div className="text-xl font-bold text-surface-50">
            {users.length > 0 ? Math.max(...users.map((u) => u.current_level)) : 0}
          </div>
          <div className="text-[10px] text-surface-200/50">Level cao nhất</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm theo tên hoặc ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
        />
      </div>

      {/* Users table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-800 flex items-center justify-between">
          <span className="text-sm font-medium text-surface-200/70 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Danh sách người dùng ({filteredUsers.length})
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-sm text-surface-200/50">
            {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có người dùng nào'}
          </div>
        ) : (
          <div className="divide-y divide-surface-800/60">
            {filteredUsers.map((user, idx) => (
              <div key={user.id}>
                {/* User row */}
                <div
                  className="flex items-center gap-4 px-5 py-3 hover:bg-surface-800/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(user.id)}
                >
                  {/* Rank */}
                  <div className="w-8 text-center">
                    <span className="text-sm font-bold text-surface-200/50">
                      {idx + 1}
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center text-sm font-bold text-surface-200/70 shrink-0">
                    {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Name + ID */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-50 truncate">
                      {user.display_name || 'Ẩn danh'}
                    </p>
                    <p className="text-[10px] text-surface-200/30 font-mono truncate">
                      {user.id}
                    </p>
                  </div>

                  {/* Level */}
                  <div className="text-center hidden sm:block">
                    <div className="text-sm font-bold text-primary-400">Lv.{user.current_level}</div>
                    <div className="text-[10px] text-surface-200/40">Level</div>
                  </div>

                  {/* Streak */}
                  <div className="text-center hidden sm:block">
                    <div className="text-sm font-bold text-orange-400">{user.current_streak}</div>
                    <div className="text-[10px] text-surface-200/40">Streak</div>
                  </div>

                  {/* XP */}
                  <div className="text-center">
                    <div className="text-sm font-bold text-amber-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      {user.total_xp.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-surface-200/40">XP</div>
                  </div>

                  {/* Expand icon */}
                  <div className="w-6 flex items-center justify-center text-surface-200/40">
                    {user.expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Expanded XP History */}
                {user.expanded && (
                  <div className="px-5 pb-4 pl-16 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="w-3.5 h-3.5 text-surface-200/40" />
                      <span className="text-xs font-medium text-surface-200/50">
                        Lịch sử XP gần đây
                      </span>
                    </div>
                    {user.loadingHistory ? (
                      <div className="flex items-center gap-2 py-4 text-xs text-surface-200/40">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Đang tải...
                      </div>
                    ) : user.xpHistory && user.xpHistory.length > 0 ? (
                      <div className="space-y-1.5">
                        {user.xpHistory.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-lg bg-surface-800/30"
                          >
                            <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="font-bold text-amber-400">+{h.xp_amount}</span>
                            <span className="text-surface-200/60">{sourceLabel(h.source)}</span>
                            <span className="ml-auto text-surface-200/30">
                              {new Date(h.earned_at).toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-surface-200/30 py-2">
                        Chưa có lịch sử XP
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
