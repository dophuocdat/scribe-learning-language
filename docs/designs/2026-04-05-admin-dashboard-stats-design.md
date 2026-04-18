# Admin Dashboard Statistics Redesign

## Goal
Rewrite the admin dashboard from a basic 4-stat overview into a comprehensive single-page statistics dashboard showing content quality, user activity, and system health — all using Pure CSS visualizations (no chart libraries).

## Current State
- 4 stat cards: Courses, Lessons, Vocabulary, Users
- Quick Actions + Recent Courses
- Backend: `handleStats` does 4 simple count queries

## Proposed Design

### Section 1: Overview Stats (Top Row)
6 animated stat cards in a responsive grid:

| Stat | Icon | Color | Source |
|------|------|-------|--------|
| Khóa học | BookOpen | primary | `courses` count |
| Bài học | GraduationCap | accent | `lessons` count |
| Từ vựng | Languages | success | `vocabulary` count |
| Câu hỏi quiz | HelpCircle | warning | `quiz_questions` count |
| Bài tập kỹ năng | Dumbbell | pink/rose | `lesson_skill_exercises` count |
| Người dùng | Users | purple | `user_profiles` count |

Each card shows the number with a subtle animated count-up effect.

### Section 2: Content Quality (Chất lượng nội dung)
Two-column layout:

**Left column:**
- **Courses by Category** — Horizontal bar chart (CSS gradient bars)
  - Each category shows: name, count, percentage bar
  - Source: `courses` grouped by `category_id` joined with `categories`

- **Courses by Difficulty** — Colored pills/bars
  - Each difficulty level shows count with its assigned color
  - Source: `courses` grouped by `difficulty_level` joined with `difficulty_levels`

**Right column:**
- **Published / Draft Ratio** — Donut-style progress ring (CSS)
  - Shows X published / Y total
  - Source: `courses` where `is_published = true` vs total

- **Quiz Coverage** — Progress bar
  - "X/Y bài học có quiz" with percentage
  - Source: distinct `lesson_id` in `quizzes` vs total lessons

- **Skill Exercise Coverage** — Progress bar
  - "X/Y bài học có bài tập kỹ năng"
  - Source: distinct `lesson_id` in `lesson_skill_exercises` vs total lessons

- **Avg Vocab per Lesson** — Large number with indicator
  - Source: `vocabulary` count / `lessons` count

### Section 3: User Activity (Hoạt động người dùng)
Two-column layout:

**Left column:**
- **Active Users** — 3 mini cards
  - Hôm nay / Tuần này / Tháng này
  - Source: `user_profiles` where `last_active_date` is within range

- **Learning Progress** — Stats grid
  - Total XP earned (sum of `user_xp_history.xp_amount`)
  - Total quiz attempts (`user_quiz_attempts` count)
  - Avg quiz score (`user_quiz_attempts` average score)
  - Cards mastered (`user_srs_cards` where `is_mastered = true`)

**Right column:**
- **Top 5 Users** — Mini leaderboard table
  - Display name, XP, streak, level
  - Source: `user_profiles` order by `total_xp` desc limit 5

- **Scan Usage Today** — Progress bar
  - Total scans today across all users
  - Source: `user_scan_logs` where `created_at >= today`

### Section 4: Quick Actions (Keep existing)
- Create new course
- Manage categories

## Backend Changes

### Expand `handleStats` in `admin-api/index.ts`

New response shape:
```typescript
interface AdminStatsDetailed {
  // Overview counts
  totalCourses: number
  totalLessons: number
  totalVocabulary: number
  totalQuizQuestions: number
  totalSkillExercises: number
  totalUsers: number

  // Content quality
  coursesByCategory: { name: string; count: number }[]
  coursesByDifficulty: { code: string; label: string; color: string; count: number }[]
  publishedCourses: number
  draftCourses: number
  lessonsWithQuiz: number
  lessonsWithSkillExercises: number
  avgVocabPerLesson: number

  // User activity
  activeUsersToday: number
  activeUsersWeek: number
  activeUsersMonth: number
  totalXpEarned: number
  totalQuizAttempts: number
  avgQuizScore: number
  masteredCards: number
  scansToday: number
  topUsers: { display_name: string; total_xp: number; current_streak: number; current_level: number }[]
}
```

### Query strategy
Use `Promise.all` with ~12 parallel queries for performance.
All queries use `head: true` with `count: 'exact'` where possible to minimize data transfer.

## Frontend Changes

### Files modified:
1. `src/features/admin/stores/adminStore.ts` — Expand `AdminStats` interface
2. `src/features/admin/pages/AdminDashboardPage.tsx` — Complete rewrite

### No new dependencies needed
All visualizations use:
- CSS `background: linear-gradient()` for horizontal bars
- CSS `conic-gradient()` for donut/ring charts
- CSS `width` transitions for animated progress bars
- Tailwind utilities for layouting
