-- Add per-user max vocab/exercise limits for scan generation
-- These are MAXIMUM limits — AI generates up to this many based on content
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS max_vocab_per_scan integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_exercises_per_scan integer NOT NULL DEFAULT 8;
