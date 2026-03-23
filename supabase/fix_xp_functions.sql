-- ============================================
-- MANUAL FIX: Run this in Supabase Dashboard → SQL Editor
-- This creates the missing RPC functions and fixes RLS
-- ============================================

-- =====================
-- 1. Award XP atomically
-- =====================
CREATE OR REPLACE FUNCTION public.award_xp_atomic(
  p_user_id UUID,
  p_amount INTEGER,
  p_source TEXT,
  p_source_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Atomic increment
  UPDATE user_profiles
  SET total_xp = total_xp + p_amount
  WHERE id = p_user_id
  RETURNING total_xp INTO v_new_xp;

  -- Compute level: floor(sqrt(total_xp / 100)) + 1
  v_new_level := FLOOR(SQRT(v_new_xp / 100.0)) + 1;

  UPDATE user_profiles
  SET current_level = v_new_level
  WHERE id = p_user_id;

  -- Insert XP history
  INSERT INTO user_xp_history (user_id, xp_amount, source, source_id)
  VALUES (p_user_id, p_amount, p_source, p_source_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 2. Update streak atomically
-- =====================
CREATE OR REPLACE FUNCTION public.update_streak_atomic(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_last_active DATE;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_new_streak INTEGER;
BEGIN
  SELECT last_active_date, current_streak, longest_streak
  INTO v_last_active, v_current_streak, v_longest_streak
  FROM user_profiles
  WHERE id = p_user_id;

  -- Already counted today
  IF v_last_active = v_today THEN
    RETURN;
  END IF;

  IF v_last_active = v_yesterday THEN
    -- Consecutive day
    v_new_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    -- Streak broken, start fresh
    v_new_streak := 1;
  END IF;

  UPDATE user_profiles
  SET
    current_streak = v_new_streak,
    longest_streak = GREATEST(v_new_streak, COALESCE(v_longest_streak, 0)),
    last_active_date = v_today
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 3. Fix RLS for leaderboard
-- =====================
DROP POLICY IF EXISTS "profiles_read_own" ON user_profiles;
DROP POLICY IF EXISTS "profiles_read_all_authenticated" ON user_profiles;

CREATE POLICY "profiles_read_all_authenticated" ON user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- =====================
-- Done! Verify by running:
-- SELECT * FROM pg_proc WHERE proname IN ('award_xp_atomic', 'update_streak_atomic');
-- =====================
