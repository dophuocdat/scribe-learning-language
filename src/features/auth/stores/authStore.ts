import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase'
import type { UserProfile } from '@/shared/types/database'
import type { User, Session, Subscription } from '@supabase/supabase-js'

// Module-level variable — not part of the public store interface
let _authSubscription: Subscription | null = null

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean

  // Actions
  initialize: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
  updateProfile: (data: Partial<Pick<UserProfile, 'display_name' | 'avatar_url' | 'target_exam' | 'target_score' | 'daily_goal_minutes' | 'tts_voice' | 'tts_accent' | 'tts_speed'>>) => Promise<boolean>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAdmin: false,

  initialize: async () => {
    try {
      // Clean up any previous subscription to avoid duplicates
      _authSubscription?.unsubscribe()

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        set({ user: session.user, session })
        await get().fetchProfile(session.user.id)
      }

      // Listen for auth changes (store subscription for cleanup)
      // IMPORTANT: callback must NOT be async — Supabase warns async callbacks cause deadlocks
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null, session })
        if (session?.user) {
          // Fire profile fetch in background without blocking the auth lock
          get().fetchProfile(session.user.id).catch(console.error)
        } else {
          set({ profile: null, isAdmin: false })
        }
      })
      _authSubscription = subscription
    } catch (error) {
      console.error('Auth initialization error:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  },

  signInWithEmail: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  signUpWithEmail: async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })
    if (error) throw error
  },

  signOut: async () => {
    // Always clear local state first so the UI responds immediately
    set({ user: null, session: null, profile: null, isAdmin: false })
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      // State is already cleared, user is logged out locally
    }
  },

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error)
      return
    }

    // Check if user is admin via user metadata or RLS
    const isAdmin = get().user?.app_metadata?.role === 'admin'

    set({
      profile: data as UserProfile | null,
      isAdmin,
    })
  },

  updateProfile: async (data) => {
    const userId = get().user?.id
    if (!userId) return false

    const { error } = await supabase
      .from('user_profiles')
      .update(data)
      .eq('id', userId)

    if (error) {
      console.error('Error updating profile:', error)
      return false
    }

    // Refresh the local profile
    await get().fetchProfile(userId)
    return true
  },
}))
