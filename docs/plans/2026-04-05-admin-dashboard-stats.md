# Admin Dashboard Statistics Redesign — Implementation Plan

**Goal:** Rewrite the admin dashboard from 4 basic stat cards into a comprehensive single-page statistics dashboard with content quality metrics, user activity data, and pure CSS visualizations.

**Architecture:** Expand the backend `handleStats` endpoint to return ~20 metrics via parallel queries, then rewrite the frontend `AdminDashboardPage.tsx` as a single scrollable page with 3 sections (Overview, Content Quality, User Activity). All charts use pure CSS — no external chart libraries.

**Tech Stack:** React + TypeScript, Zustand store, Supabase Edge Functions (Deno), TailwindCSS + custom CSS (conic-gradient, linear-gradient for charts)

---

## Task 1: Expand Backend `handleStats` Endpoint

**Files:**
- Modify: `supabase/functions/admin-api/index.ts`

- [ ] **Step 1: Replace the `handleStats` function with expanded queries**

Replace the existing `handleStats` function (lines 167-184) with the following expanded version that runs ~15 parallel queries:

```typescript
async function handleStats(_req: Request, _params: URLSearchParams) {
  const db = createAdminClient()
  console.log('[admin-api] GET /stats (detailed)')

  // Date boundaries
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1)

  const [
    courses, lessons, vocabulary, users,
    quizQuestions, skillExercises,
    coursesData, difficultyLevels, categoriesData,
    quizzesLessons, skillExLessons,
    activeToday, activeWeek, activeMonth,
    xpHistory, quizAttempts, masteredCards,
    scansToday, topUsersData,
  ] = await Promise.all([
    // Basic counts
    db.from('courses').select('*', { count: 'exact', head: true }).eq('is_personal', false),
    db.from('lessons').select('*', { count: 'exact', head: true }),
    db.from('vocabulary').select('*', { count: 'exact', head: true }),
    db.from('user_profiles').select('*', { count: 'exact', head: true }),
    db.from('quiz_questions').select('*', { count: 'exact', head: true }),
    db.from('lesson_skill_exercises').select('*', { count: 'exact', head: true }),

    // Course details for category/difficulty breakdown
    db.from('courses').select('category_id, difficulty_level, is_published').eq('is_personal', false),
    db.from('difficulty_levels').select('code, label, color').order('order_index'),
    db.from('categories').select('id, name').order('order_index'),

    // Coverage: distinct lessons with quizzes / skill exercises
    db.from('quizzes').select('lesson_id'),
    db.from('lesson_skill_exercises').select('lesson_id'),

    // Active users
    db.from('user_profiles').select('*', { count: 'exact', head: true })
      .gte('last_active_date', todayStart.toISOString().split('T')[0]),
    db.from('user_profiles').select('*', { count: 'exact', head: true })
      .gte('last_active_date', weekAgo.toISOString().split('T')[0]),
    db.from('user_profiles').select('*', { count: 'exact', head: true })
      .gte('last_active_date', monthAgo.toISOString().split('T')[0]),

    // XP & quiz stats
    db.from('user_xp_history').select('xp_amount'),
    db.from('user_quiz_attempts').select('score, total_questions'),
    db.from('user_srs_cards').select('*', { count: 'exact', head: true }).eq('is_mastered', true),

    // Scans today
    db.from('user_scan_logs').select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),

    // Top 5 users
    db.from('user_profiles').select('display_name, total_xp, current_streak, current_level')
      .order('total_xp', { ascending: false }).limit(5),
  ])

  // --- Compute derived stats ---
  const totalLessons = lessons.count ?? 0
  const totalVocab = vocabulary.count ?? 0

  // Courses by category
  const catMap: Record<string, number> = {}
  for (const c of (coursesData.data || []) as { category_id: string | null }[]) {
    const key = c.category_id || '_uncategorized'
    catMap[key] = (catMap[key] || 0) + 1
  }
  const catNames: Record<string, string> = { _uncategorized: 'Chưa phân loại' }
  for (const cat of (categoriesData.data || []) as { id: string; name: string }[]) {
    catNames[cat.id] = cat.name
  }
  const coursesByCategory = Object.entries(catMap)
    .map(([id, count]) => ({ name: catNames[id] || id, count }))
    .sort((a, b) => b.count - a.count)

  // Courses by difficulty
  const diffMap: Record<string, number> = {}
  for (const c of (coursesData.data || []) as { difficulty_level: string | null }[]) {
    const key = c.difficulty_level || '_none'
    diffMap[key] = (diffMap[key] || 0) + 1
  }
  const diffLevels = (difficultyLevels.data || []) as { code: string; label: string; color: string }[]
  const coursesByDifficulty = diffLevels
    .map(d => ({ code: d.code, label: d.label, color: d.color, count: diffMap[d.code] || 0 }))
    .filter(d => d.count > 0)
  // Add uncategorized if exists
  if (diffMap['_none']) {
    coursesByDifficulty.push({ code: '_none', label: 'Chưa gán', color: '#64748b', count: diffMap['_none'] })
  }

  // Published vs Draft
  const publishedCourses = ((coursesData.data || []) as { is_published: boolean }[])
    .filter(c => c.is_published).length
  const totalCoursesCount = courses.count ?? 0
  const draftCourses = totalCoursesCount - publishedCourses

  // Quiz coverage
  const quizLessonIds = new Set(
    ((quizzesLessons.data || []) as { lesson_id: string }[]).map(q => q.lesson_id)
  )
  const lessonsWithQuiz = quizLessonIds.size

  // Skill exercise coverage
  const skillExLessonIds = new Set(
    ((skillExLessons.data || []) as { lesson_id: string }[]).map(s => s.lesson_id)
  )
  const lessonsWithSkillExercises = skillExLessonIds.size

  // Avg vocab per lesson
  const avgVocabPerLesson = totalLessons > 0 ? Math.round((totalVocab / totalLessons) * 10) / 10 : 0

  // Total XP
  const totalXpEarned = ((xpHistory.data || []) as { xp_amount: number }[])
    .reduce((sum, x) => sum + (x.xp_amount || 0), 0)

  // Quiz attempt stats
  const attempts = (quizAttempts.data || []) as { score: number; total_questions: number }[]
  const totalQuizAttempts = attempts.length
  const avgQuizScore = totalQuizAttempts > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.total_questions > 0 ? (a.score / a.total_questions) * 100 : 0), 0) / totalQuizAttempts)
    : 0

  return jsonResponse({
    // Overview
    totalCourses: totalCoursesCount,
    totalLessons,
    totalVocabulary: totalVocab,
    totalQuizQuestions: quizQuestions.count ?? 0,
    totalSkillExercises: skillExercises.count ?? 0,
    totalUsers: users.count ?? 0,

    // Content quality
    coursesByCategory,
    coursesByDifficulty,
    publishedCourses,
    draftCourses,
    lessonsWithQuiz,
    lessonsWithSkillExercises,
    avgVocabPerLesson,

    // User activity
    activeUsersToday: activeToday.count ?? 0,
    activeUsersWeek: activeWeek.count ?? 0,
    activeUsersMonth: activeMonth.count ?? 0,
    totalXpEarned,
    totalQuizAttempts,
    avgQuizScore,
    masteredCards: masteredCards.count ?? 0,
    scansToday: scansToday.count ?? 0,
    topUsers: (topUsersData.data || []),
  })
}
```

- [ ] **Step 2: Deploy the updated edge function**

```bash
npx supabase functions deploy admin-api --project-ref jmvquvkfxbezjuuiksns
```

Expected: Function deployed successfully.

- [ ] **Step 3: Verify by testing the endpoint**

Open browser to the live site, login as admin, check browser DevTools Network tab for the `admin-api` call with `_resource: stats`. Response should contain all new fields.

---

## Task 2: Update AdminStats TypeScript Interface

**Files:**
- Modify: `src/features/admin/stores/adminStore.ts`

- [ ] **Step 1: Replace `AdminStats` interface**

Replace lines 5-10 with:

```typescript
interface AdminStats {
  // Overview
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
  topUsers: { display_name: string | null; total_xp: number; current_streak: number; current_level: number }[]
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors (the dashboard page will have errors until Task 3).

---

## Task 3: Rewrite AdminDashboardPage — Overview Section

**Files:**
- Modify: `src/features/admin/pages/AdminDashboardPage.tsx`

- [ ] **Step 1: Rewrite the component with Section 1 (Overview Stats)**

Complete rewrite of the file with 6 animated stat cards, plus placeholder sections for content quality and user activity (implemented in Tasks 4-5).

The 6 stat cards grid: Courses, Lessons, Vocabulary, Quiz Questions, Skill Exercises, Users.

- [ ] **Step 2: Verify in browser**

Run dev server, navigate to `/admin`. Should see 6 stat cards with real data loading.

---

## Task 4: Add Content Quality Section

**Files:**
- Modify: `src/features/admin/pages/AdminDashboardPage.tsx`

- [ ] **Step 1: Add Content Quality section below overview**

Contains:
- Courses by Category (horizontal CSS bars)
- Courses by Difficulty (colored pills)
- Published/Draft ratio (CSS donut ring via conic-gradient)
- Quiz Coverage progress bar
- Skill Exercise Coverage progress bar
- Avg Vocab per Lesson metric

- [ ] **Step 2: Verify in browser**

All bars animate on load, percentages calculate correctly, colors match difficulty level colors from DB.

---

## Task 5: Add User Activity Section

**Files:**
- Modify: `src/features/admin/pages/AdminDashboardPage.tsx`

- [ ] **Step 1: Add User Activity section below content quality**

Contains:
- Active Users mini cards (Today/Week/Month)
- Learning Progress stats grid (XP, Quiz Attempts, Avg Score, Mastered Cards)
- Top 5 Users mini leaderboard
- Scan Usage today

- [ ] **Step 2: Verify in browser**

All user activity metrics show real data. Top users table shows names, XP, streaks.

---

## Task 6: Final Polish & Visual Verification

**Files:**
- All files from Tasks 1-5

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: PASS, no errors.

- [ ] **Step 2: Run dev server and visually verify**

```bash
npm run dev
```

Open browser to `/admin`. Verify:
- All 6 stat cards load with real numbers
- Content quality section shows correct breakdowns
- User activity section shows correct metrics
- Responsive layout works on mobile
- Loading skeletons display properly
- Animations are smooth

- [ ] **Step 3: Test on deployed site**

Build and deploy, verify on live site at `https://kheochi.online/admin`.
