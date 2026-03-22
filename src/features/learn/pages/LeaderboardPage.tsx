import { useState, useEffect } from 'react'
import {
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Crown,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/features/auth/stores/authStore'
import type { UserProfile } from '@/shared/types/database'

interface LeaderboardEntry extends UserProfile {
  rank: number
}

export function LeaderboardPage() {
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null)

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('total_xp', { ascending: false })
        .limit(50)

      if (error) throw error

      const ranked = (data || []).map((entry: UserProfile, index: number) => ({
        ...entry,
        rank: index + 1,
      }))

      setEntries(ranked)

      // Find current user's rank
      if (user) {
        const currentUserEntry = ranked.find((e: LeaderboardEntry) => e.id === user.id)
        setUserRank(currentUserEntry || null)
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400 mx-auto mb-3" />
          <p className="text-surface-200/50 text-sm">Đang tải bảng xếp hạng...</p>
        </div>
      </div>
    )
  }

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

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
            Top {entries.length} người học có XP cao nhất
          </p>
        </div>
        <button
          onClick={fetchLeaderboard}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800/60 border border-surface-700 text-surface-200/70 hover:text-surface-50 hover:bg-surface-800 transition-all text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </button>
      </div>

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
                <div className="text-lg font-bold text-amber-400">{userRank.total_xp.toLocaleString()}</div>
                <div className="text-[10px] text-surface-200/50">XP</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-primary-400">Lv.{userRank.current_level}</div>
                <div className="text-[10px] text-surface-200/50">Level</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Podium */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {/* 2nd place */}
          <PodiumCard entry={top3[1]} medal="🥈" color="text-gray-300" bgOpacity="0.04" />
          {/* 1st place */}
          <PodiumCard entry={top3[0]} medal="🥇" color="text-amber-400" bgOpacity="0.08" isFirst />
          {/* 3rd place */}
          <PodiumCard entry={top3[2]} medal="🥉" color="text-amber-700" bgOpacity="0.03" />
        </div>
      )}

      {/* Rankings Table */}
      {rest.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-surface-200/50" />
            <span className="text-sm font-medium text-surface-200/70">
              Xếp hạng #{4} – #{entries.length}
            </span>
          </div>
          <div className="divide-y divide-surface-800/60">
            {rest.map((entry) => (
              <RankRow
                key={entry.id}
                entry={entry}
                isCurrentUser={entry.id === user?.id}
              />
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && !loading && (
        <div className="glass-card p-12 text-center">
          <Trophy className="w-12 h-12 text-surface-200/20 mx-auto mb-3" />
          <p className="text-surface-200/50">Chưa có dữ liệu xếp hạng</p>
        </div>
      )}
    </div>
  )
}

/* === Sub-Components === */

function PodiumCard({
  entry,
  medal,
  color,
  bgOpacity,
  isFirst,
}: {
  entry: LeaderboardEntry
  medal: string
  color: string
  bgOpacity: string
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
            <span className="text-xs font-bold">{entry.total_xp.toLocaleString()}</span>
          </div>
          {entry.current_streak > 0 && (
            <div className="flex items-center gap-1 text-orange-400">
              <Flame className="w-3 h-3" />
              <span className="text-xs font-bold">{entry.current_streak}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RankRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry
  isCurrentUser: boolean
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
        <span className="text-sm font-bold">{entry.total_xp.toLocaleString()}</span>
      </div>

      {/* Crown for top ranks */}
      {entry.rank <= 3 && (
        <Crown className="w-4 h-4 text-amber-400/50" />
      )}
    </div>
  )
}
