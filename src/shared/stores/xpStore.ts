import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/features/auth/stores/authStore'

/* ===== Types ===== */

export interface XpEvent {
  amount: number
  source: string
  label: string
  timestamp: number
}

const SOURCE_LABELS: Record<string, string> = {
  quiz_complete: 'Quiz hoàn thành',
  srs_review: 'Ôn tập SRS',
  scan: 'Smart Scan',
  streak_bonus: 'Bonus streak',
  achievement: 'Thành tựu',
}

interface XpState {
  /** Latest XP event to show in the toast */
  latestEvent: XpEvent | null

  /** Dismiss the current notification */
  dismissEvent: () => void

  /** Award XP, refresh profile, and trigger notification */
  awardXp: (amount: number, source: string, sourceId?: string) => Promise<void>

  /** Update streak and refresh profile */
  updateStreak: () => Promise<void>
}

export const useXpStore = create<XpState>((set) => ({
  latestEvent: null,

  dismissEvent: () => set({ latestEvent: null }),

  awardXp: async (amount: number, source: string, sourceId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.rpc('award_xp_atomic', {
        p_user_id: user.id,
        p_amount: amount,
        p_source: source,
        p_source_id: sourceId || null,
      })

      if (error) {
        console.error('[xpStore] awardXp RPC error:', error)
        return
      }

      // Trigger XP notification
      set({
        latestEvent: {
          amount,
          source,
          label: SOURCE_LABELS[source] || source,
          timestamp: Date.now(),
        },
      })

      // Refresh the auth profile so dashboard/profile show updated values
      useAuthStore.getState().fetchProfile(user.id)
    } catch (err) {
      console.error('[xpStore] awardXp:', err)
    }
  },

  updateStreak: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.rpc('update_streak_atomic', {
        p_user_id: user.id,
      })

      if (error) {
        console.error('[xpStore] updateStreak RPC error:', error)
        return
      }

      // Refresh the auth profile so streak values update
      useAuthStore.getState().fetchProfile(user.id)
    } catch (err) {
      console.error('[xpStore] updateStreak:', err)
    }
  },
}))
