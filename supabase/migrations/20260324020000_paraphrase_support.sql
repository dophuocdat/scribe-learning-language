-- Add paraphrase daily limits to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS max_daily_paraphrase_checks INT NOT NULL DEFAULT 15;

-- Update writing_checks check_type constraint to include 'paraphrase'
ALTER TABLE writing_checks DROP CONSTRAINT IF EXISTS writing_checks_check_type_check;
ALTER TABLE writing_checks ADD CONSTRAINT writing_checks_check_type_check
  CHECK (check_type IN ('grammar', 'plagiarism', 'paraphrase'));
