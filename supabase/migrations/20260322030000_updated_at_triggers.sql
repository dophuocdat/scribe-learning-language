-- ============================================
-- Add updated_at triggers for courses and lessons
-- Automatically sets updated_at to NOW() on any UPDATE
-- (Task 17)
-- ============================================

-- Generic trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to courses
DROP TRIGGER IF EXISTS trigger_courses_updated_at ON courses;
CREATE TRIGGER trigger_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Apply to lessons
DROP TRIGGER IF EXISTS trigger_lessons_updated_at ON lessons;
CREATE TRIGGER trigger_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
