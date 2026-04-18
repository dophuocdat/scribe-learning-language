-- Add is_published column to lesson_skill_exercises
-- Default false = draft, admin must publish after preview
ALTER TABLE lesson_skill_exercises
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
