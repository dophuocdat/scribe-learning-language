-- Add custom scan limit per user
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS max_daily_scans integer NOT NULL DEFAULT 2;
