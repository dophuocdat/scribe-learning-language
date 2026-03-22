-- ============================================
-- Add missing difficulty_levels table + RLS policies
-- (Tasks 9 & 19)
-- ============================================

CREATE TABLE IF NOT EXISTS difficulty_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE difficulty_levels ENABLE ROW LEVEL SECURITY;

-- Everyone can read difficulty levels
CREATE POLICY "difficulty_levels_read" ON difficulty_levels FOR SELECT USING (true);

-- Only admins can manage
CREATE POLICY "difficulty_levels_admin" ON difficulty_levels FOR ALL USING (
  public.is_admin()
);
