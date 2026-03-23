-- ============================================
-- Fix RLS: Allow authenticated users to read all profiles
-- Required for the leaderboard to query other users' XP/level
-- ============================================

-- Drop the old "own profile only" read policy
DROP POLICY IF EXISTS "profiles_read_own" ON user_profiles;

-- Allow any authenticated user to SELECT all profiles
-- (user_profiles contains only display name, avatar, XP, level, streak — no sensitive data)
CREATE POLICY "profiles_read_all_authenticated" ON user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');
