import { useState, useEffect, useMemo } from 'react'
import {
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Crown,
  Loader2,
  RefreshCw,
  Users,
  Search,
  Calendar,
  Star,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/features/auth/stores/authStore'
import type { UserProfile } from '@/shared/types/database'

/* ===== Types ===== */

interface LeaderboardEntry extends UserProfile {
  rank: number
  weekly_xp?: number
}

type TimeFilter = 'all' | 'week'

/* ===== Component ===== */

export function LeaderboardPage() {
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  /* ---- Fetch ---- */

  const fetchAllTime = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('total_xp', { ascending: false })
      .limit(100)

    if (error) throw error
    return (data || []).map((entry: UserProfile, index: number) => ({
      ...entry,
      rank: index + 1,
    }))
  }

  const fetchWeekly = async () => {
    // Get start of current week (Monday)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    monday.setHours(0, 0, 0, 0)

    // Aggregate XP earned this week
    const { data: xpData, error: xpError } = await supabase
      .from('user_xp_history')
      .select('user_id, xp_amount')
      .gte('earned_at', monday.toISOString())

    if (xpError) throw xpError

    // Sum XP per user
    const weeklyMap = new Map<string, number>()
    for (const row of xpData || []) {
      weeklyMap.set(row.user_id, (weeklyMap.get(row.user_id) || 0) + row.xp_amount)
    }

    if (weeklyMap.size === 0) return []

    // Fetch profiles for those users
    const userIds = [...weeklyMap.keys()]
    const { data: profiles, error: profError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds)

    if (profError) throw profError

    // Combine and sort by weekly XP
    const combined = (profiles || [])
      .map((p: UserProfile) => ({
        ...p,
        weekly_xp: weeklyMap.get(p.id) || 0,
        rank: 0,
      }))
      .sort((a: LeaderboardEntry, b: LeaderboardEntry) =>
        (b.weekly_xp || 0) - (a.weekly_xp || 0)
      )
      .map((entry: LeaderboardEntry, index: number) => ({
        ...entry,
        rank: index + 1,
      }))

    return combined
  }

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const data = timeFilter === 'week' ? await fetchWeekly() : await fetchAllTime()
      setEntries(data)
    } catch (err) {
      console.error('Leaderboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeFilter])

  /* ---- Derived ---- */

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter(
      (e) => e.display_name?.toLowerCase().includes(q)
    )
  }, [entries, searchQuery])

  const userRank = useMemo(() => {
    if (!user) return null
    return entries.find((e) => e.id === user.id) || null
  }, [entries, user])

  const top3 = filteredEntries.slice(0, 3)
  const rest = filteredEntries.slice(3)
  const isWeekly = timeFilter === 'week'

  const getXpValue = (entry: LeaderboardEntry) =>
    isWeekly ? (entry.weekly_xp || 0) : entry.total_xp

  /* ---- Render ---- */

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            Bảng xếp hạng
          </h1>
          <p className="text-surface-200/60 text-sm mt-1">
            {isWeekly ? 'XP kiếm được tuần này' : `Top ${entries.length} người học`}
          </p>
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800/60 border border-surface-700 text-surface-200/70 hover:text-surface-50 hover:bg-surface-800 transition-all text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Time filter tabs */}
        <div className="flex bg-surface-800/50 rounded-xl p-1 border border-surface-700/50">
          <TabButton
            active={timeFilter === 'all'}
            onClick={() => setTimeFilter('all')}
            icon={<Star className="w-3.5 h-3.5" />}
            label="Tất cả"
          />
          <TabButton
            active={timeFilter === 'week'}
            onClick={() => setTimeFilter('week')}
            icon={<Calendar className="w-3.5 h-3.5" />}
            label="Tuần này"
          />
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-sm text-surface-50 placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 transition-all"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400 mx-auto mb-3" />
            <p className="text-surface-200/50 text-sm">Đang tải bảng xếp hạng...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Your Rank Banner */}
          {userRank && (
            <div className="glass-card p-4 relative overflow-hidden border-primary-500/30">
              <div className="absolute inset-0 gradient-bg opacity-[0.06]" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-primary-500/20">
                  #{userRank.rank}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-surface-200/60">Thứ hạng của bạn</p>
                  <p className="text-lg font-bold text-surface-50">
                    {userRank.display_name || user?.email || 'Bạn'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-amber-400">
                      {getXpValue(userRank).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-surface-200/50">
                      {isWeekly ? 'XP tuần' : 'XP'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary-400">Lv.{userRank.current_level}</div>
                    <div className="text-[10px] text-surface-200/50">Level</div>
                  </div>
                  {userRank.current_streak > 0 && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-400">{userRank.current_streak}</div>
                      <div className="text-[10px] text-surface-200/50">Streak</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top 3 Podium */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-3">
              <PodiumCard entry={top3[1]} medal="🥈" color="text-gray-300" bgOpacity="0.04" xpValue={getXpValue(top3[1])} isWeekly={isWeekly} />
              <PodiumCard entry={top3[0]} medal="🥇" color="text-amber-400" bgOpacity="0.08" xpValue={getXpValue(top3[0])} isWeekly={isWeekly} isFirst />
              <PodiumCard entry={top3[2]} medal="🥉" color="text-amber-700" bgOpacity="0.03" xpValue={getXpValue(top3[2])} isWeekly={isWeekly} />
            </div>
          )}

          {/* Partial podium (1-2 users) */}
          {top3.length > 0 && top3.length < 3 && (
            <div className={`grid gap-3 ${top3.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-2 max-w-lg mx-auto'}`}>
              {top3.map((entry, idx) => (
                <PodiumCard
                  key={entry.id}
                  entry={entry}
                  medal={idx === 0 ? '🥇' : '🥈'}
                  color={idx === 0 ? 'text-amber-400' : 'text-gray-300'}
                  bgOpacity={idx === 0 ? '0.08' : '0.04'}
                  xpValue={getXpValue(entry)}
                  isWeekly={isWeekly}
                  isFirst={idx === 0}
                />
              ))}
            </div>
          )}

          {/* Rankings Table */}
          {rest.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-surface-200/50" />
                <span className="text-sm font-medium text-surface-200/70">
                  Xếp hạng #{4} – #{filteredEntries.length}
                </span>
              </div>
              <div className="divide-y divide-surface-800/60">
                {rest.map((entry) => (
                  <RankRow
                    key={entry.id}
                    entry={entry}
                    isCurrentUser={entry.id === user?.id}
                    xpValue={getXpValue(entry)}
                    isWeekly={isWeekly}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredEntries.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Trophy className="w-12 h-12 text-surface-200/20 mx-auto mb-3" />
              <p className="text-surface-200/50">
                {searchQuery
                  ? 'Không tìm thấy kết quả phù hợp'
                  : isWeekly
                    ? 'Chưa có ai kiếm XP tuần này. Hãy là người đầu tiên!'
                    : 'Chưa có dữ liệu xếp hạng'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* === Sub-Components === */

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${active
          ? 'bg-primary-500/15 text-primary-400 shadow-sm'
          : 'text-surface-200/50 hover:text-surface-200/80 hover:bg-surface-700/30'
        }
      `}
    >
      {icon}
      {label}
    </button>
  )
}

function PodiumCard({
  entry,
  medal,
  color,
  bgOpacity,
  xpValue,
  isWeekly,
  isFirst,
}: {
  entry: LeaderboardEntry
  medal: string
  color: string
  bgOpacity: string
  xpValue: number
  isWeekly: boolean
  isFirst?: boolean
}) {
  return (
    <div
      className={`glass-card p-4 text-center relative overflow-hidden ${
        isFirst ? 'ring-1 ring-amber-400/30 -mt-2 mb-0' : 'mt-2'
      }`}
    >
      <div className="absolute inset-0 gradient-bg" style={{ opacity: bgOpacity }} />
      <div className="relative">
        {/* Crown for first place */}
        {isFirst && (
          <div className="absolute -top-1 -right-1">
            <Crown className="w-5 h-5 text-amber-400 animate-pulse-glow" />
          </div>
        )}

        {/* Medal */}
        <div className="text-3xl mb-2">{medal}</div>

        {/* Avatar */}
        <div
          className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-xl font-bold text-white mb-2 ${
            isFirst
              ? 'gradient-bg shadow-lg shadow-primary-500/30'
              : 'bg-surface-700'
          }`}
        >
          {entry.display_name?.charAt(0)?.toUpperCase() || '?'}
        </div>

        {/* Info */}
        <p className="text-sm font-semibold text-surface-50 truncate">
          {entry.display_name || 'Ẩn danh'}
        </p>
        <p className={`text-xs font-medium mt-1 ${color}`}>
          Lv.{entry.current_level}
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="flex items-center gap-1 text-amber-400">
            <Zap className="w-3 h-3" />
            <span className="text-xs font-bold">{xpValue.toLocaleString()}</span>
          </div>
          {entry.current_streak > 0 && (
            <div className="flex items-center gap-1 text-orange-400">
              <Flame className="w-3 h-3" />
              <span className="text-xs font-bold">{entry.current_streak}</span>
            </div>
          )}
        </div>

        {/* Weekly label */}
        {isWeekly && (
          <div className="text-[10px] text-surface-200/40 mt-1">XP tuần</div>
        )}
      </div>
    </div>
  )
}

function RankRow({
  entry,
  isCurrentUser,
  xpValue,
  isWeekly,
}: {
  entry: LeaderboardEntry
  isCurrentUser: boolean
  xpValue: number
  isWeekly: boolean
}) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3 transition-colors ${
        isCurrentUser
          ? 'bg-primary-500/10 border-l-2 border-primary-500'
          : 'hover:bg-surface-800/30'
      }`}
    >
      {/* Rank */}
      <div className="w-8 text-center">
        <span
          className={`text-sm font-bold ${
            isCurrentUser ? 'text-primary-400' : 'text-surface-200/50'
          }`}
        >
          {entry.rank}
        </span>
      </div>

      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center text-sm font-bold text-surface-200/70 shrink-0">
        {entry.display_name?.charAt(0)?.toUpperCase() || '?'}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-primary-400' : 'text-surface-50'}`}>
          {entry.display_name || 'Ẩn danh'}
          {isCurrentUser && (
            <span className="ml-2 text-[10px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded-full">
              Bạn
            </span>
          )}
        </p>
      </div>

      {/* Level */}
      <div className="flex items-center gap-1 text-primary-400">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs font-bold">Lv.{entry.current_level}</span>
      </div>

      {/* Streak */}
      {entry.current_streak > 0 && (
        <div className="flex items-center gap-1 text-orange-400">
          <Flame className="w-3 h-3" />
          <span className="text-xs font-bold">{entry.current_streak}</span>
        </div>
      )}

      {/* XP */}
      <div className="flex items-center gap-1 text-amber-400 min-w-[72px] justify-end">
        <Zap className="w-3.5 h-3.5" />
        <span className="text-sm font-bold">{xpValue.toLocaleString()}</span>
        {isWeekly && (
          <span className="text-[10px] text-surface-200/40 ml-0.5">/w</span>
        )}
      </div>
    </div>
  )
}
