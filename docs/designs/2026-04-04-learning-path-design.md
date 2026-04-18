# 🗺️ Learning Path — Lộ trình học tập (v3 — Final)

> **Ngày:** 2026-04-04 (Updated: 2026-04-05)  
> **Tính năng:** User chọn trình độ + mục tiêu → hệ thống generate lộ trình khóa học cá nhân hóa  
> **Phương án:** C (Current Level + Target Level + Focus Area) + Review System + Checkpoint Quiz

---

## 1. TỔNG QUAN

### Vấn đề
Hệ thống có 74 khóa học A1→C2 + IELTS + TOEIC, nhưng **không có cơ chế hướng dẫn user nên học gì theo thứ tự nào**. Ngoài ra, lộ trình cần cơ chế **ôn tập vòng lặp** để chống Forgetting Curve.

### Giải pháp
1. **Wizard 3 bước** — Level hiện tại → Level mục tiêu → Focus area
2. **Roadmap timeline gamified** — Nodes dọc với 4 trạng thái (✅/🔵/🔄/⚫)
3. **Checkpoint milestones** — Trạm ôn tập xen kẽ mỗi 3-4 courses
4. **Review detection** — Tự phát hiện courses cần ôn (>30 ngày)
5. **Dashboard integration** — Banner CTA / Card compact
6. **Persistent storage** — Supabase, RPC cho performance

---

## 2. DATABASE

### 2.1 Bảng mới: `user_learning_paths`

```sql
CREATE TABLE user_learning_paths (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_level TEXT NOT NULL DEFAULT 'A1',
  target_level TEXT NOT NULL DEFAULT 'B2',
  focus_area TEXT NOT NULL DEFAULT 'general',
  path_courses JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own path" ON user_learning_paths
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own path" ON user_learning_paths
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own path" ON user_learning_paths
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own path" ON user_learning_paths
  FOR DELETE USING (auth.uid() = user_id);
```

### 2.2 Giải quyết vấn đề JSONB (Orphan IDs + Static Snapshot)

**Cách tiếp cận: Hybrid**
- Lưu `path_courses` JSONB vì cần giữ **vị trí Checkpoint nodes** (không thể compute thuần động)
- Khi LOAD: **FILTER bỏ course IDs không tồn tại** hoặc đã bị unpublish
- Frontend hiển thị nút "🔔 Có khóa học mới! Cập nhật lộ trình" nếu phát hiện courses mới phù hợp (so sánh path_courses vs courses hiện có trong DB)

### 2.3 RPC: Tính tiến độ batch (Giải quyết N+1)

```sql
CREATE OR REPLACE FUNCTION get_path_progress(p_user_id UUID, p_course_ids JSONB)
RETURNS TABLE(
  course_id UUID,
  total_lessons BIGINT,
  completed_lessons BIGINT,
  last_activity_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.course_id,
    COUNT(DISTINCT l.id) AS total_lessons,
    COUNT(DISTINCT CASE 
      WHEN uqa.score >= 70 THEN l.id 
      ELSE NULL 
    END) AS completed_lessons,
    MAX(uqa.completed_at) AS last_activity_date
  FROM lessons l
  LEFT JOIN quizzes q ON q.lesson_id = l.id
  LEFT JOIN user_quiz_attempts uqa 
    ON uqa.quiz_id = q.id AND uqa.user_id = p_user_id
  WHERE l.course_id::TEXT IN (
    SELECT jsonb_array_elements_text(p_course_ids)
  )
  GROUP BY l.course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**1 RPC call = tiến độ cho TẤT CẢ courses.** Không N+1.

---

## 3. PATH RECOMMENDATION LOGIC

### 3.1 Input
- `current_level`: A1-C2
- `target_level`: ≥ current_level (cho phép bằng khi focus = ielts/toeic)
- `focus_area`: general | communication | ielts | toeic

### 3.2 Quy tắc đặc biệt
- Focus = IELTS → target_level tối thiểu = B2 (auto-adjust nếu thấp hơn)
- Focus = TOEIC → target_level tối thiểu = B1
- **Current = C2 + focus ielts/toeic → cho phép** (target = C2, chỉ lấy IELTS/TOEIC courses)

### 3.3 Thuật toán sắp xếp

**Bước 1:** Query courses có difficulty_level từ current → target, PLUS courses thuộc focus category (IELTS/TOEIC courses nếu cần)

**Bước 2:** Nhóm theo level, trong mỗi level sắp theo focus_area:

| Focus | Ưu tiên (trong mỗi level) |
|---|---|
| general | Grammar → Vocabulary → Communication → R&W → Pronunciation |
| communication | Communication → Pronunciation → Vocabulary → Grammar |
| ielts | Grammar → Vocabulary → R&W → (hết CEFR levels) → IELTS 7 courses |
| toeic | Grammar → Vocabulary → (hết CEFR levels) → TOEIC courses |

**Bước 3:** Xử lý pre-existing progress
- Query `user_quiz_attempts` để tìm courses user đã hoàn thành
- Courses ĐÃ HOÀN THÀNH (**cùng level hoặc thấp hơn**) → đẩy lên đầu mỗi level group
- Courses chưa bắt đầu → theo thứ tự ưu tiên

**Bước 4:** Chèn Checkpoint nodes
- Cứ sau **mỗi 3 courses học mới** → chèn 1 Checkpoint node
- Checkpoint = special entry `{ type: 'checkpoint', label: 'Kiểm tra B1', review_courses: [...3 course IDs trước đó] }`
- Lưu trong `path_courses` JSONB: `["course_id_1", "course_id_2", "course_id_3", {"type":"checkpoint","label":"Checkpoint B1","courses":["id1","id2","id3"]}]`

### 3.4 Ví dụ output (A2 → B2, General)

```
─── Level A2 ───
1. ✅ Grammar A2 (đã xong trước)
2. Vocabulary A2
3. Communication A2
4. 🏁 CHECKPOINT: Kiểm tra A2-1
5. R&W A2
6. Pronunciation A2
7. 🏁 CHECKPOINT: Kiểm tra A2-2

─── Level B1 ───
8.  Grammar B1
9.  Vocabulary B1
10. Communication B1 Travel
11. 🏁 CHECKPOINT: Kiểm tra B1-1
12. Communication B1 Workplace
13. R&W B1 Reading
14. R&W B1 Email
15. 🏁 CHECKPOINT: Kiểm tra B1-2
16. Pronunciation B1

─── Level B2 ───
17. Grammar B2
18. Vocabulary B2
19. Communication B2
20. 🏁 CHECKPOINT: Kiểm tra B2-1
21. R&W B2 Critical
22. R&W B2 Essay
23. Pronunciation B2
24. 🏁 CHECKPOINT: Kiểm tra B2 Final
```

---

## 4. 4 TRẠNG THÁI + REVIEW SYSTEM

### 4.1 Trạng thái courses

| # | Trạng thái | Điều kiện | UI |
|---|---|---|---|
| 1 | ✅ **Hoàn thành** | completed = total AND last_activity ≤ 30 ngày | Green glow, ✓ |
| 2 | 🔄 **Cần ôn tập** | completed = total AND last_activity > 30 ngày | Amber glow, 🔄, nút "Ôn tập lại" |
| 3 | 🔵 **Đang học** | 0 < completed < total | Primary pulse, nút "Tiếp tục" |
| 4 | ⚫ **Chưa bắt đầu** | completed = 0 | Dimmed |

**NGOẠI LỆ cho course "Next Up":** Course chưa bắt đầu ĐẦU TIÊN → **KHÔNG bị dim**, hiện sáng + nút "Bắt đầu →" (CTA rõ ràng)

### 4.2 Checkpoint nodes

| Trạng thái | Điều kiện | UI |
|---|---|---|
| ✅ Đã pass | User đã pass checkpoint quiz ≥70% | Gold star badge |
| 🔓 Sẵn sàng | 3 courses trước đều ✅ hoặc 🔄 | Nút "Kiểm tra →" |
| 🔒 Chưa mở | Courses trước chưa xong | Locked, dimmed |

**Checkpoint KHÔNG áp dụng trạng thái "🔄 Cần ôn tập"** — đã pass là qua luôn.

### 4.3 Cap giới hạn "Cần ôn tập"

**Tối đa 3 courses hiển thị trạng thái 🔄 cùng lúc** (gần nhất trước).
- Tránh "Biển Đỏ/Vàng" khi user bỏ app lâu
- Khi ôn xong 1 → course cũ hơn tiếp theo hiện lên

### 4.4 Progress tính theo LESSONS (không theo courses)

```
Tiến độ = tổng lessons đã pass / tổng lessons trong lộ trình
Ví dụ: 47/156 lessons = 30%
```

Phản ánh chính xác công sức hơn vì khóa dễ (5 bài) ≠ khóa khó (10 bài).

---

## 5. CHECKPOINT QUIZ SYSTEM

### 5.1 Chiến lược: Dynamic Auto-Mix (MVP)

Khi user bấm "Kiểm tra →" trên checkpoint, **Backend** (Edge Function) tự động trộn câu hỏi từ ngân hàng đề có sẵn. **Frontend KHÔNG trực tiếp query quiz_questions** — tránh rò rỉ toàn bộ ngân hàng câu hỏi.

### 5.2 Edge Function: `checkpoint-quiz`

```
POST /functions/v1/checkpoint-quiz
Headers: Authorization: Bearer <user_jwt>
Body: { "course_ids": ["id1", "id2", "id3"] }
```

**Thuật toán bốc câu hỏi:**

```
1. Query tất cả quiz_questions thuộc 3 courses
   (JOIN lessons → quizzes → quiz_questions WHERE course_id IN [3 ids])

2. Query user_quiz_attempts để tìm câu user ĐÃ TRẢ LỜI SAI
   (WHERE user_id = auth.uid() AND score < 70)

3. Ưu tiên bốc câu:
   - Pool A (ưu tiên): Câu user đã sai → random pick 10 câu
   - Pool B (bổ sung): Câu chưa từng gặp hoặc đã đúng → random fill lên 15 câu
   - Đảm bảo: Mỗi course đóng góp TỐI THIỂU 3 câu (cân bằng)

4. Shuffle thứ tự → trả về 15 câu cho Frontend
```

**Response:**
```json
{
  "checkpoint_id": "auto-generated-uuid",
  "questions": [
    {
      "id": "q1",
      "question_text": "...",
      "question_type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "source_course": "Grammar B1"
    }
  ],
  "total_questions": 15,
  "passing_score": 70
}
```

> ⚠️ **correct_answer KHÔNG trả về trong response** — Frontend gửi answers về Backend để chấm điểm.

### 5.3 Edge Function: `checkpoint-quiz-submit`

```
POST /functions/v1/checkpoint-quiz-submit
Body: {
  "checkpoint_id": "...",
  "answers": { "q1": "A", "q2": "C", ... }
}
```

**Backend xử lý:**
1. So sánh answers với correct_answer → tính score
2. Lưu kết quả vào `user_quiz_attempts` (quiz_id = checkpoint_id đặc biệt)
3. Trả về: `{ score: 80, passed: true, results: [{...}] }`

### 5.4 Lưu kết quả Checkpoint

Thêm bảng nhẹ `user_checkpoint_results` (hoặc dùng JSONB column trong `user_learning_paths`):

```sql
CREATE TABLE user_checkpoint_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checkpoint_label TEXT NOT NULL,
  course_ids JSONB NOT NULL,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_checkpoint_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own results" ON user_checkpoint_results
  FOR ALL USING (auth.uid() = user_id);
```

### 5.5 UI: Checkpoint Quiz Modal

Khi user bấm "Kiểm tra →":
1. **Loading state** — "Đang tạo bài kiểm tra..." (gọi Edge Function)
2. **Quiz modal** — Overlay full-screen trên Roadmap page
   - Progress bar: "Câu 3/15"
   - Hiển thị 1 câu/lần, nút Next/Previous
   - Badge nhỏ "Từ: Grammar B1" cho mỗi câu (source course)
   - Timer (optional, không bắt buộc)
3. **Kết quả** — "🎉 Bạn đạt 80%! Checkpoint passed!" hoặc "❌ 50% — Cần đạt 70%. Thử lại?"
4. Pass → checkpoint chuyển ✅, roadmap cập nhật
5. Fail → nút "Thử lại" (generate bộ câu mới)

### 5.6 Tương lai: Dedicated Checkpoint Quizzes

Sau MVP, có thể upgrade lên Phương án 2:
- Tạo category ẩn `checkpoint_test` trong DB
- Admin soạn bài test tổng hợp chất lượng cao
- Thuật toán ưu tiên dedicated quiz nếu có, fallback sang auto-mix nếu chưa có
- Không ảnh hưởng UI — chỉ đổi nguồn data

---

## 6. DATA FLOW

### 6.1 Generate lộ trình (Wizard → Save)

```
Step 1-3 hoàn thành
  → Frontend query courses: SELECT * FROM courses WHERE is_published=true
  → Frontend query user progress: SELECT DISTINCT course_id FROM user_quiz_attempts WHERE user_id=...
  → Thuật toán generate path_courses[] (Mục 3) + chèn checkpoints
  → UPSERT vào user_learning_paths
  → Store update → render Roadmap
```

### 6.2 Load lộ trình (mở page / reload)

```
learningPathStore.fetchPath()
  → SELECT * FROM user_learning_paths WHERE user_id = auth.uid()
  → Nếu có path:
      → Lấy path_courses JSONB
      → gọi RPC get_path_progress(user_id, path_courses) ← 1 call duy nhất
      → SELECT * FROM user_checkpoint_results WHERE user_id = auth.uid()
      → Filter bỏ orphan IDs (courses đã bị xóa/unpublish)
      → Tính 4 trạng thái cho mỗi course (Mục 4.1)
      → Tính trạng thái checkpoints (Mục 4.2) từ checkpoint_results
      → Apply cap 3 cho "Cần ôn tập" (Mục 4.3)
      → Render Roadmap
  → Nếu chưa có → render Wizard
```

### 6.3 Checkpoint Quiz Flow

```
User bấm "Kiểm tra →" trên checkpoint node
  → Frontend gọi POST /functions/v1/checkpoint-quiz { course_ids }
  → Edge Function: query questions + user wrong answers → pick 15 câu
  → Frontend render quiz modal
  → User trả lời xong → POST /functions/v1/checkpoint-quiz-submit { answers }
  → Edge Function: chấm điểm → lưu user_checkpoint_results → trả về score
  → Frontend cập nhật checkpoint status trên roadmap
```

### 6.4 Đổi lộ trình

```
User bấm "Đổi lộ trình" → Wizard hiện lại
  → Generate path mới
  → UPSERT (thay thế row cũ)
  → Quiz history + checkpoint results KHÔNG mất (bảng riêng)
```

---

## 6. UI/UX COMPONENTS

### 7.1 File Structure

```
src/features/learning-path/
  ├── pages/
  │   └── LearningPathPage.tsx       ← Main: switch Wizard / Roadmap
  ├── components/
  │   ├── PathWizard.tsx              ← 3-step wizard
  │   ├── PathRoadmap.tsx             ← Timeline dọc + collapsible levels
  │   ├── PathDashboardCard.tsx       ← Dashboard integration
  │   └── CheckpointQuizModal.tsx     ← Inline quiz overlay
  └── stores/
      └── learningPathStore.ts        ← Zustand store + generate logic

supabase/functions/
  ├── checkpoint-quiz/index.ts        ← Generate quiz (bốc câu hỏi)
  └── checkpoint-quiz-submit/index.ts ← Chấm điểm + lưu kết quả
```

### 7.2 Wizard (PathWizard.tsx)

Progress bar gradient: Step 1/3 → 2/3 → 3/3

**Step 1 — "Trình độ hiện tại"**
- 6 glass-cards grid (2 col desktop, 1 col mobile)
- Mỗi card: level badge + mô tả ngắn
  - A1: "Mới bắt đầu — chào hỏi, tự giới thiệu"
  - A2: "Cơ bản — giao tiếp đơn giản hằng ngày"
  - B1: "Trung cấp — du lịch, công việc cơ bản"
  - B2: "Trung cao — thảo luận, viết luận"
  - C1: "Nâng cao — học thuật, chuyên nghiệp"
  - C2: "Thành thạo — gần như native speaker"
- Selected = primary glow border

**Step 2 — "Mục tiêu muốn đạt"**
- Chỉ hiện level ≥ current_level
- Nếu current = C2 → skip step này (chỉ focus area)

**Step 3 — "Tập trung vào gì?"**
- 4 glass-cards:
  - 📚 Tổng quát — "Phát triển đều 4 kỹ năng"
  - 🗣️ Giao tiếp — "Ưu tiên nói, nghe, phát âm"
  - 🎯 IELTS — "Luyện thi IELTS Academic/General"
  - 📋 TOEIC — "Luyện thi TOEIC Listening & Reading"

Nút "Tạo lộ trình →" → generate + save → transition Roadmap

### 7.3 Roadmap (PathRoadmap.tsx)

**Header:**
- Glass-card gradient: "A2 → B2 · Giao tiếp"
- Progress bar THEO LESSONS: "47/156 bài hoàn thành (30%)"
- Nút "Đổi lộ trình"

**Timeline:**
- Đường kẻ dọc gradient (primary → accent)
- **Level separators** với badge "LEVEL B1" nổi bật

**Collapsible levels (giải quyết path dài):**
- Levels đã HOÀN THÀNH 100% → auto-collapse thành 1 row:
  "✅ Level A1 & A2: Đã hoàn thành 15 khóa (48 bài)"
  - Click để mở rộng xem chi tiết
- Level ĐANG HỌC → mở rộng, hiện tất cả courses
- Level TIẾP THEO → mở rộng (lazy visible)
- Levels xa hơn → collapse "⚫ Level C1: 12 khóa · Chưa bắt đầu"

**Course nodes:**
- Circle trạng thái bên trái (✅ green / 🔄 amber / 🔵 primary pulse / ⚫ dim)
- Glass-card bên phải: title + level badge + category tag + lessons count
- Course đang học → nút "Tiếp tục →"
- Course "Next Up" → **sáng, không dim**, nút "Bắt đầu →" (CTA)
- Courses sau Next Up → dimmed

**Checkpoint nodes:**
- Icon 🏁 đặc biệt, viền gold
- Label "Kiểm tra tổng hợp B1"
- Khi sẵn sàng → nút "Kiểm tra →"
- Khi locked → 🔒 "Hoàn thành 3 khóa trước để mở"

**Click course node → navigate `/courses/:courseId`**

### 7.4 Dashboard (PathDashboardCard.tsx)

**Chưa có lộ trình:**
- Banner gradient full-width
- "🗺️ Thiết lập lộ trình học!"
- "Chọn mục tiêu và để Scribe hướng dẫn bạn từng bước"
- CTA "Chọn lộ trình →" → /learning-path

**Đã có lộ trình:**
- Glass-card compact:
  - "A2 → B2 · Giao tiếp"
  - Progress bar LESSONS: "47/156 bài (30%)"
  - Next up: "Tiếp: Grammar B1"
  - Nếu có 🔄: "⚠️ 2 khóa cần ôn tập"
  - Link "Xem lộ trình →"

### 7.5 Navigation

**Sidebar.tsx:** `{ path: '/learning-path', label: 'Lộ trình', icon: Map }` — vị trí #2 (sau Home, trước Courses)

**MobileNav.tsx:** Thêm Map icon

**App.tsx:** `<Route path="learning-path" element={<LearningPathPage />} />`

---

## 8. TYPES

```typescript
// Thêm vào database.ts
export interface UserLearningPath {
  id: string
  user_id: string
  current_level: string
  target_level: string
  focus_area: 'general' | 'communication' | 'ielts' | 'toeic'
  path_courses: (string | PathCheckpoint)[]
  created_at: string
  updated_at: string
}

export interface PathCheckpoint {
  type: 'checkpoint'
  label: string
  courses: string[]  // 3 course IDs để ôn
}

export interface UserCheckpointResult {
  id: string
  user_id: string
  checkpoint_label: string
  course_ids: string[]
  score: number
  passed: boolean
  completed_at: string
}

// Derived types (frontend only)
export interface CourseWithProgress {
  id: string
  title: string
  difficulty_level: string
  category_name: string
  total_lessons: number
  completed_lessons: number
  last_activity_date: string | null
  status: 'completed' | 'needs_review' | 'in_progress' | 'not_started'
  is_next: boolean  // true cho course "Next Up"
}

export interface CheckpointNode {
  type: 'checkpoint'
  label: string
  review_course_ids: string[]
  status: 'passed' | 'ready' | 'locked'
}

export type RoadmapNode = CourseWithProgress | CheckpointNode

// Checkpoint Quiz types
export interface CheckpointQuestion {
  id: string
  question_text: string
  question_type: string
  options: string[]
  source_course: string  // tên course nguồn
}

export interface CheckpointQuizResponse {
  checkpoint_id: string
  questions: CheckpointQuestion[]
  total_questions: number
  passing_score: number
}

export interface CheckpointSubmitResponse {
  score: number
  passed: boolean
  results: { question_id: string; correct: boolean; correct_answer: string }[]
}
```

---

## 9. STORE API

```typescript
// learningPathStore.ts (Zustand)
interface LearningPathState {
  // State
  path: UserLearningPath | null
  roadmap: RoadmapNode[]
  totalLessons: number
  completedLessons: number
  loading: boolean

  // Checkpoint quiz state
  checkpointQuiz: CheckpointQuizResponse | null
  checkpointLoading: boolean

  // Actions — Path
  fetchPath: () => Promise<void>              // Load from DB + compute progress
  savePath: (current, target, focus) => Promise<void>  // Generate + save
  resetPath: () => Promise<void>              // Delete path
  
  // Actions — Checkpoint Quiz
  startCheckpoint: (courseIds: string[]) => Promise<void>  // Call Edge Function
  submitCheckpoint: (answers: Record<string, string>) => Promise<CheckpointSubmitResponse>
  closeCheckpoint: () => void
  
  // Pure functions (no DB)
  generatePathCourses: (
    currentLevel: string,
    targetLevel: string,
    focusArea: string,
    allCourses: Course[],
    completedCourseIds: string[]
  ) => (string | PathCheckpoint)[]
}
```

---

## 10. ERROR HANDLING & EDGE CASES

| Case | Xử lý |
|---|---|
| Orphan course ID (deleted/unpublished) | Filter bỏ khi load, không crash |
| Courses mới được thêm vào DB | Frontend detect & hiện "🔔 Cập nhật lộ trình" |
| Current = C2, focus = ielts/toeic | Cho phép, target = C2, chỉ lấy IELTS/TOEIC |
| Current = C2, focus = general | Hiện message "Bạn đã ở level cao nhất!" |
| Path quá dài (30+ courses) | Collapse completed levels, lazy render |
| User bỏ app 2 tháng, 10 courses cần ôn | Cap 3 "Cần ôn tập" cùng lúc |
| Checkpoint bản thân bị đánh "Cần ôn" | KHÔNG áp dụng — checkpoint pass = qua luôn |
| Checkpoint Edge Function timeout | Toast lỗi, retry button |
| Course có ít quiz questions (<3 câu) | Bốc tất cả câu có, không enforce tối thiểu |
| User fail checkpoint | Cho làm lại, generate bộ câu MỚI (re-shuffle) |
| Supabase error | Toast thông báo lỗi |
| No courses matching criteria | Message "Chưa có khóa học phù hợp" |

---

## 11. DESIGN PRINCIPLES

- **Follow existing patterns:** glass-card, gradient-bg, Zustand store, Supabase queries
- **No new dependencies:** Chỉ thêm Lucide `Map` icon
- **Security first:** Quiz answers chấm ở Backend, không gửi correct_answer về Frontend
- **Mobile-first responsive:** Cards stack vertical, timeline adapts
- **1 RPC call = all progress data** (no N+1)
- **Adaptive learning:** Checkpoint ưu tiên câu user đã sai (Spaced Repetition)
- **Gamification:** Pulse animation, checkpoints kiểu "đấu boss", gold stars
- **Retention:** 4th status + checkpoints chống Forgetting Curve
- **Performance:** Collapse + lazy render cho paths dài
- **Future-proof:** Có thể upgrade checkpoint sang dedicated quizzes mà không đổi UI
