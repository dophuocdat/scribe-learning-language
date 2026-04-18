# CEFR Content Generator — Implementation Plan

**Goal:** Deploy 1 Edge Function that enriches 35 existing courses with quiz questions AND creates 3 new CEFR courses, bringing total quiz coverage from 53% to 96%.

**Architecture:** Single admin-only Edge Function `generate-cefr-content` with 2 modes (`enrich`/`create`). Uses existing Gemini 2.5 Flash pattern from `ai-api`. Batch processing with 5 courses per batch to stay under Edge Function timeout (150s).

**Tech Stack:** Deno Edge Function, Gemini 2.5 Flash API, Supabase service_role client

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/generate-cefr-content/index.ts` | **CREATE** | Main Edge Function |

---

## Task 1: Deploy Edge Function — Enrich Mode

**Files:**
- Create: `supabase/functions/generate-cefr-content/index.ts`

- [ ] **Step 1: Deploy the Edge Function with `enrich` mode**

Deploy `generate-cefr-content` Edge Function that:
1. Verifies admin JWT (reuse pattern from `ai-api/index.ts`)
2. Accepts `{ mode: "enrich", batch_index: 0 }`
3. Queries courses with quiz ratio < 3 questions/lesson
4. Selects batch of 5 courses based on `batch_index`
5. For each lesson in each course:
   - Gets `quiz_id` and existing questions
   - Calls Gemini to generate `(4 - existing_count)` new questions
   - INSERTs into `quiz_questions`
6. Returns `{ processed_courses, processed_lessons, questions_inserted, errors }`

Key implementation details:
- Use `GEMINI_API_KEY` from env (same as `ai-api`)
- Model: `gemini-2.5-flash`
- JSON mode: `responseMimeType: 'application/json'`
- 500ms delay between Gemini calls to avoid rate limits
- `extractJson()` function for parsing (copied from `ai-api`)
- CEFR level descriptions embedded in prompt for quality

- [ ] **Step 2: Verify deployment**

Check Edge Function appears in Supabase dashboard.

---

## Task 2: Run Enrich — Batch 0-6

- [ ] **Step 1: Run batch 0** (courses 1-5)

Invoke via Supabase SDK from frontend or curl:
```
POST /generate-cefr-content
Body: { "mode": "enrich", "batch_index": 0 }
```

Expected: `{ questions_inserted: ~60 }` (5 courses × ~8 lessons × ~3 new questions)

- [ ] **Step 2: Verify batch 0**

```sql
SELECT c.title, COUNT(qq.id) as q_count, COUNT(DISTINCT l.id) as l_count
FROM courses c
JOIN lessons l ON l.course_id = c.id
JOIN quizzes q ON q.lesson_id = l.id
JOIN quiz_questions qq ON qq.quiz_id = q.id
WHERE c.is_published = true
GROUP BY c.title
HAVING COUNT(qq.id) / COUNT(DISTINCT l.id) >= 3
ORDER BY c.title;
```

Expected: enriched courses now show ratio ≥ 4.

- [ ] **Step 3: Run batches 1-6**

Repeat for `batch_index` = 1, 2, 3, 4, 5, 6.
Wait for each to complete before starting next.

- [ ] **Step 4: Verify all enriched**

```sql
SELECT COUNT(*) as total_questions FROM quiz_questions;
```

Expected: ~2,200+ (was 1,446)

---

## Task 3: Add `create` Mode to Edge Function

- [ ] **Step 1: Redeploy with `create` mode added**

Add `create` mode that:
1. Defines 3 course specs (title, slug, category_id, difficulty_level, lessons[])
2. For each course:
   a. INSERT into `courses`
   b. For each lesson:
      - INSERT into `lessons`
      - Call Gemini for `processed_content` + `ai_summary`
      - UPDATE lesson with content
      - INSERT into `quizzes`
      - Call Gemini for 4 quiz questions
      - INSERT into `quiz_questions`
3. Returns `{ courses_created, lessons_created, questions_created }`

Course specs (hardcoded in function):

```typescript
const NEW_COURSES = [
  {
    title: 'Chào hỏi & Giao tiếp xã hội (Social English Basics)',
    slug: 'social-english-basics',
    category_id: '08b9ef46-e612-4822-8f94-39c28aff2798', // Communication
    difficulty_level: 'A1',
    description: 'Giao tiếp xã hội cơ bản: giới thiệu, chào hỏi, cảm ơn, xin lỗi, hỏi thăm trong nhiều tình huống.',
    estimated_time_minutes: 120,
    lessons: [
      { title: 'Giới thiệu bản thân mở rộng', desc: 'Tên, tuổi, nghề nghiệp, sở thích, quê quán' },
      { title: 'Chào hỏi & Tạm biệt trong nhiều tình huống', desc: 'Formal vs informal greetings, time-of-day' },
      { title: 'Cảm ơn & Xin lỗi', desc: 'Thank you variations, sorry vs excuse me' },
      { title: 'Hỏi thăm sức khỏe & Trả lời', desc: 'How are you? How is it going? Responses' },
      { title: 'Nói về gia đình', desc: 'Family members, basic descriptions' },
      { title: 'Nói về thời tiết', desc: 'Weather vocabulary, small talk' },
      { title: 'Hỏi & Chỉ đường đơn giản', desc: 'Left, right, straight, near, far' },
      { title: 'Giao tiếp qua điện thoại cơ bản', desc: 'Hello, who is calling, hold on please' },
    ]
  },
  {
    title: 'Giao tiếp mua sắm & Dịch vụ (Shopping & Services English)',
    slug: 'shopping-services-english',
    category_id: '08b9ef46-e612-4822-8f94-39c28aff2798', // Communication
    difficulty_level: 'A2',
    description: 'Giao tiếp trong mua sắm, nhà hàng, phương tiện, ngân hàng, bưu điện, khách sạn, bệnh viện.',
    estimated_time_minutes: 120,
    lessons: [
      { title: 'Mua sắm quần áo', desc: 'Size, color, price, try on, discount' },
      { title: 'Đi siêu thị & Chợ', desc: 'Quantities, asking for items, paying' },
      { title: 'Gọi đồ ăn & Uống', desc: 'Restaurant ordering, menu vocabulary' },
      { title: 'Sử dụng phương tiện công cộng', desc: 'Bus, taxi, train — buying tickets' },
      { title: 'Tại ngân hàng', desc: 'Open account, exchange money, ATM' },
      { title: 'Tại bưu điện', desc: 'Send package, buy stamps, track order' },
      { title: 'Đặt phòng khách sạn', desc: 'Check-in/out, room types, requests' },
      { title: 'Khám bệnh cơ bản', desc: 'At the doctor, describing symptoms' },
    ]
  },
  {
    title: 'Phương ngữ & Phong cách phát âm (Dialects & Stylistic Pronunciation)',
    slug: 'dialects-stylistic-pronunciation',
    category_id: '340ddb8b-77bf-46fc-8f8e-4799a9c90fb8', // Phát âm
    difficulty_level: 'C2',
    description: 'Nhận diện phương ngữ Anh-Mỹ-Úc, phong cách phát âm formal/informal, code-switching, và phát âm trong diễn thuyết.',
    estimated_time_minutes: 90,
    lessons: [
      { title: 'British vs American Pronunciation', desc: 'R-dropping, t-flapping, vowel shifts' },
      { title: 'Australian & South African English', desc: 'Distinctive features, vowel changes' },
      { title: 'World Englishes: Indian, Singapore, Philippine', desc: 'Non-native varieties as legitimate' },
      { title: 'Formal vs Informal Pronunciation', desc: 'Connected speech in registers' },
      { title: 'Pronunciation in Public Speaking', desc: 'Emphasis, pausing, projection' },
      { title: 'Code-Switching & Accent Adaptation', desc: 'Adjusting pronunciation for audience' },
    ]
  },
]
```

- [ ] **Step 2: Verify deployment**

---

## Task 4: Run Create Mode

- [ ] **Step 1: Invoke create**

```
POST /generate-cefr-content
Body: { "mode": "create" }
```

Expected: `{ courses_created: 3, lessons_created: 22, questions_created: 88 }`

- [ ] **Step 2: Verify in database**

```sql
SELECT c.title, c.difficulty_level, COUNT(l.id) as lessons
FROM courses c
JOIN lessons l ON l.course_id = c.id
WHERE c.slug IN ('social-english-basics', 'shopping-services-english', 'dialects-stylistic-pronunciation')
GROUP BY c.title, c.difficulty_level;
```

Expected: 3 rows with correct lesson counts.

- [ ] **Step 3: Verify quiz questions**

```sql
SELECT c.title, COUNT(qq.id) as questions
FROM courses c
JOIN lessons l ON l.course_id = c.id
JOIN quizzes q ON q.lesson_id = l.id
JOIN quiz_questions qq ON qq.quiz_id = q.id
WHERE c.slug IN ('social-english-basics', 'shopping-services-english', 'dialects-stylistic-pronunciation')
GROUP BY c.title;
```

Expected: 32, 32, 24 questions respectively.

---

## Task 5: Final Verification

- [ ] **Step 1: Total quiz question count**

```sql
SELECT COUNT(*) FROM quiz_questions;
```

Expected: ~2,380+

- [ ] **Step 2: No courses with ratio < 3**

```sql
SELECT c.title,
  COUNT(DISTINCT qq.id)::float / NULLIF(COUNT(DISTINCT l.id), 0) as ratio
FROM courses c
JOIN lessons l ON l.course_id = c.id
JOIN quizzes q ON q.lesson_id = l.id
JOIN quiz_questions qq ON qq.quiz_id = q.id
WHERE c.is_published = true AND c.is_personal = false
GROUP BY c.title
HAVING COUNT(DISTINCT qq.id)::float / NULLIF(COUNT(DISTINCT l.id), 0) < 3;
```

Expected: 0 rows (all courses have ≥ 3 questions/lesson)

- [ ] **Step 3: CEFR matrix complete**

```sql
SELECT c.difficulty_level, cat.name, COUNT(*) as course_count
FROM courses c
JOIN categories cat ON c.category_id = cat.id
WHERE c.is_published = true AND c.is_personal = false
  AND c.difficulty_level IN ('A1','A2','B1','B2','C1','C2')
GROUP BY c.difficulty_level, cat.name
ORDER BY c.difficulty_level, cat.name;
```

Expected: Communication has A1:2, A2:2. Pronunciation has C2:1.

- [ ] **Step 4: Build frontend**

```bash
cd e:\SystemTech\scribe && npm run build
```

Expected: Build success (no TS errors).
