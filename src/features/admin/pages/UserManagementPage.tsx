import { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Loader2,
  RotateCcw,
  ScanLine,
  KeyRound,
  Ban,
  Shield,
  ChevronDown,
  ChevronUp,
  Mail,
  Zap,
  Clock,
  BookOpen,
} from 'lucide-react'
import { invokeAdminApi } from '@/shared/lib/edgeFunctions'
import { useToastStore } from '@/shared/stores/toastStore'

/* ===== Types ===== */

interface UserWithMeta {
  id: string
  display_name: string | null
  avatar_url: string | null
  total_xp: number
  current_level: number
  current_streak: number
  longest_streak: number
  max_daily_scans: number
  max_vocab_per_scan: number
  max_exercises_per_scan: number
  last_active_date: string | null
  created_at: string
  // from admin-api enrichment
  email: string
  banned: boolean
  last_sign_in: string | null
  scans_today: number
  // UI state
  expanded?: boolean
}

/* ===== Component ===== */

export function UserManagementPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [users, setUsers] = useState<UserWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null) // userId:action

  // Scan limit edit state
  const [editingLimit, setEditingLimit] = useState<string | null>(null)
  const [newLimit, setNewLimit] = useState('')

  // Generation limits edit state
  const [editingGenLimits, setEditingGenLimits] = useState<string | null>(null)
  const [newVocabLimit, setNewVocabLimit] = useState('')
  const [newExerciseLimit, setNewExerciseLimit] = useState('')

  /* ---- Fetch users ---- */
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await invokeAdminApi<UserWithMeta[]>('users', 'GET')
      if (error) throw new Error(error)
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

  /* ---- Actions ---- */
  const doAction = async (userId: string, action: string, body: Record<string, unknown> = {}) => {
    const key = `${userId}:${action}`
    setActionLoading(key)
    try {
      const { data, error } = await invokeAdminApi(
        'users', 'POST',
        { action },
        { userId, ...body }
      )
      if (error) throw new Error(error)
      addToast('success', data?.message || 'Thành công!')
      await fetchUsers()
    } catch (err) {
      console.error(`Action ${action} error:`, err)
      addToast('error', (err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetScans = (userId: string) => doAction(userId, 'reset-scans')
  const handleForcePasswordReset = (userId: string) => doAction(userId, 'force-password-reset')
  const handleToggleBan = (userId: string, ban: boolean) => doAction(userId, 'toggle-ban', { ban })

  const handleUpdateScanLimit = async (userId: string) => {
    const val = parseInt(newLimit)
    if (isNaN(val) || val < 1 || val > 100) {
      addToast('error', 'Giá trị phải từ 1 đến 100')
      return
    }
    await doAction(userId, 'update-scan-limit', { maxDailyScans: val })
    setEditingLimit(null)
    setNewLimit('')
  }

  const handleUpdateGenLimits = async (userId: string) => {
    const vocab = parseInt(newVocabLimit)
    const exercises = parseInt(newExerciseLimit)
    if (isNaN(vocab) || vocab < 1 || vocab > 50) {
      addToast('error', 'Từ vựng phải từ 1 đến 50')
      return
    }
    if (isNaN(exercises) || exercises < 1 || exercises > 30) {
      addToast('error', 'Bài tập phải từ 1 đến 30')
      return
    }
    await doAction(userId, 'update-generation-limits', {
      maxVocabPerScan: vocab,
      maxExercisesPerScan: exercises,
    })
    setEditingGenLimits(null)
    setNewVocabLimit('')
    setNewExerciseLimit('')
  }

  const toggleExpand = (userId: string) => {
    setUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, expanded: !u.expanded } : u)
    )
  }

  /* ---- Filtered ---- */
  const filteredUsers = searchQuery.trim()
    ? users.filter(u =>
        u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.includes(searchQuery)
      )
    : users

  const isActionLoading = (userId: string, action: string) =>
    actionLoading === `${userId}:${action}`

  /* ===== Render ===== */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-surface-50 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-400" />
          Quản lý người dùng
        </h2>
        <p className="text-sm text-surface-200/50 mt-1">
          Quản lý tài khoản, giới hạn scan và trạng thái người dùng
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 text-center">
          <Users className="w-5 h-5 mx-auto mb-1.5 text-primary-400" />
          <div className="text-xl font-bold text-surface-50">{users.length}</div>
          <div className="text-[10px] text-surface-200/50">Tổng người dùng</div>
        </div>
        <div className="glass-card p-4 text-center">
          <Zap className="w-5 h-5 mx-auto mb-1.5 text-amber-400" />
          <div className="text-xl font-bold text-surface-50">
            {users.reduce((sum, u) => sum + u.total_xp, 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-surface-200/50">Tổng XP</div>
        </div>
        <div className="glass-card p-4 text-center">
          <ScanLine className="w-5 h-5 mx-auto mb-1.5 text-emerald-400" />
          <div className="text-xl font-bold text-surface-50">
            {users.reduce((sum, u) => sum + u.scans_today, 0)}
          </div>
          <div className="text-[10px] text-surface-200/50">Scans hôm nay</div>
        </div>
        <div className="glass-card p-4 text-center">
          <Ban className="w-5 h-5 mx-auto mb-1.5 text-red-400" />
          <div className="text-xl font-bold text-surface-50">
            {users.filter(u => u.banned).length}
          </div>
          <div className="text-[10px] text-surface-200/50">Bị ban</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm theo tên, email hoặc ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
        />
      </div>

      {/* Users list */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-800 flex items-center justify-between">
          <span className="text-sm font-medium text-surface-200/70 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Danh sách ({filteredUsers.length})
          </span>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="text-xs text-surface-200/40 hover:text-surface-50 transition-colors flex items-center gap-1"
          >
            <RotateCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
            {filteredUsers.map((user) => (
              <div key={user.id}>
                {/* User row */}
                <div
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-800/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(user.id)}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                    user.banned ? 'bg-red-500/20 text-red-400' : 'bg-surface-700 text-surface-200/70'
                  }`}>
                    {user.banned ? <Ban className="w-4 h-4" /> : user.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-50 truncate flex items-center gap-2">
                      {user.display_name || 'Ẩn danh'}
                      {user.banned && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">BANNED</span>
                      )}
                    </p>
                    <p className="text-[11px] text-surface-200/40 truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {user.email || user.id}
                    </p>
                  </div>

                  {/* Level */}
                  <div className="text-center hidden sm:block">
                    <div className="text-sm font-bold text-primary-400">Lv.{user.current_level}</div>
                    <div className="text-[10px] text-surface-200/40">Level</div>
                  </div>

                  {/* Scan quota */}
                  <div className="text-center hidden sm:block">
                    <div className="text-sm font-bold text-emerald-400">
                      {user.scans_today}/{user.max_daily_scans}
                    </div>
                    <div className="text-[10px] text-surface-200/40">Scans</div>
                  </div>

                  {/* XP */}
                  <div className="text-center">
                    <div className="text-sm font-bold text-amber-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      {user.total_xp.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-surface-200/40">XP</div>
                  </div>

                  {/* Expand */}
                  <div className="w-6 flex items-center justify-center text-surface-200/40">
                    {user.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded actions panel */}
                {user.expanded && (
                  <div className="px-5 pb-4 pl-16 animate-fade-in space-y-3">
                    {/* Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-surface-200/50">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Tham gia: {new Date(user.created_at).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Đăng nhập: {user.last_sign_in
                          ? new Date(user.last_sign_in).toLocaleDateString('vi-VN')
                          : 'Chưa'}
                      </div>
                      <div className="font-mono text-[10px] text-surface-200/30 col-span-2 truncate">
                        ID: {user.id}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {/* Reset Scans */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResetScans(user.id) }}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                      >
                        {isActionLoading(user.id, 'reset-scans') ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Reset scan ({user.scans_today})
                      </button>

                      {/* Edit Scan Limit */}
                      {editingLimit === user.id ? (
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            value={newLimit}
                            onChange={(e) => setNewLimit(e.target.value)}
                            placeholder={String(user.max_daily_scans)}
                            min="1"
                            max="100"
                            className="w-16 px-2 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-50 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateScanLimit(user.id)}
                            disabled={!!actionLoading}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 transition-all"
                          >
                            {isActionLoading(user.id, 'update-scan-limit') ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : 'Lưu'}
                          </button>
                          <button
                            onClick={() => { setEditingLimit(null); setNewLimit('') }}
                            className="px-2 py-1.5 rounded-lg text-xs text-surface-200/40 hover:text-surface-50 transition-colors"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingLimit(user.id)
                            setNewLimit(String(user.max_daily_scans))
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                        >
                          <ScanLine className="w-3 h-3" />
                          Limit: {user.max_daily_scans}
                        </button>
                      )}

                      {/* Edit Generation Limits (Vocab/Exercises) */}
                      {editingGenLimits === user.id ? (
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-surface-200/40">Từ:</span>
                            <input
                              type="number"
                              value={newVocabLimit}
                              onChange={(e) => setNewVocabLimit(e.target.value)}
                              placeholder={String(user.max_vocab_per_scan)}
                              min="1"
                              max="50"
                              className="w-12 px-1.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-50 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                              autoFocus
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-surface-200/40">BT:</span>
                            <input
                              type="number"
                              value={newExerciseLimit}
                              onChange={(e) => setNewExerciseLimit(e.target.value)}
                              placeholder={String(user.max_exercises_per_scan)}
                              min="1"
                              max="30"
                              className="w-12 px-1.5 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-50 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                            />
                          </div>
                          <button
                            onClick={() => handleUpdateGenLimits(user.id)}
                            disabled={!!actionLoading}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 transition-all"
                          >
                            {isActionLoading(user.id, 'update-generation-limits') ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : 'Lưu'}
                          </button>
                          <button
                            onClick={() => { setEditingGenLimits(null); setNewVocabLimit(''); setNewExerciseLimit('') }}
                            className="px-2 py-1.5 rounded-lg text-xs text-surface-200/40 hover:text-surface-50 transition-colors"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingGenLimits(user.id)
                            setNewVocabLimit(String(user.max_vocab_per_scan))
                            setNewExerciseLimit(String(user.max_exercises_per_scan))
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
                        >
                          <BookOpen className="w-3 h-3" />
                          Từ: {user.max_vocab_per_scan} | BT: {user.max_exercises_per_scan}
                        </button>
                      )}

                      {/* Password Reset */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleForcePasswordReset(user.id) }}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-40"
                      >
                        {isActionLoading(user.id, 'force-password-reset') ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <KeyRound className="w-3 h-3" />
                        )}
                        Đổi mật khẩu
                      </button>

                      {/* Ban/Unban */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleBan(user.id, !user.banned) }}
                        disabled={!!actionLoading}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                          user.banned
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                        }`}
                      >
                        {isActionLoading(user.id, 'toggle-ban') ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : user.banned ? (
                          <Shield className="w-3 h-3" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        {user.banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>
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
