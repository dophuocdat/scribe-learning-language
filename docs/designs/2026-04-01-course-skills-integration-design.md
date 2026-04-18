# Tích hợp 4 Skills vào hệ thống Courses — Design Document

> **Date:** 2026-04-01  
> **Status:** Draft → Awaiting Approval  
> **Scope:** Thêm luyện 4 kỹ năng (Nghe, Nói, Đọc, Viết) vào courses/lessons hiện tại  
> **Tận dụng:** Hệ thống courses, lessons, vocabulary, quizzes đã có

---

## 1. Vấn đề

Hiện tại 4 skills (Listening, Speaking, Reading, Writing) hoạt động **100% AI generate real-time**:
- Mỗi lần user luyện tập → AI phải generate bài mới → chi phí API cao, thời gian chờ
- Bài tập rời rạc, không gắn liền nội dung user đang học → **user không nhớ**
- Không có lộ trình rõ ràng → user luyện tập bị động

## 2. Giải pháp

Tận dụng hệ thống **courses → lessons** hiện tại (đã có nội dung, từ vựng, bài tập), thêm **luyện 4 kỹ năng** vào:
- **Mỗi lesson** có thêm tab "Luyện kỹ năng" → 4 bài tập (Nghe, Nói, Đọc, Viết) được tạo từ nội dung lesson
- **Mỗi course** có thêm section "Luyện tổng hợp" → bài tập dùng toàn bộ từ vựng/nội dung course
- Bài tập được **admin pre-generate** bằng AI → lưu DB → user mở ra làm ngay, không chờ
- Giữ nguyên 100% 4 skills trên sidebar cho free practice (AI generate tự do)

### So sánh

| | Free Practice (sidebar) | Course Skills (mới) |
|---|---|---|
| Nội dung | AI generate mới mỗi lần | Pre-saved trong DB, gắn liền lesson |
| Context | Ngẫu nhiên theo topic | Gắn chặt từ vựng + nội dung đang học |
| Tốc độ | Chậm (2-5s chờ AI) | Instant (load từ DB) |
| Chi phí API | Mỗi lần dùng | 1 lần generate (admin) |
| Nhớ bài | Thấp (rời rạc) | Cao (lặp lại trong context cụ thể) |

---

## 3. Decisions

| Quyết định | Chọn | Lý do |
|---|---|---|
| Cấp độ | Cả lesson-level VÀ course-level | Lesson = gắn chặt context, Course = ôn tổng hợp |
| Tạo nội dung | Admin pre-generate | Giải quyết triệt để AI overload + kiểm soát chất lượng |
| Số lượng mặc định | 1 bài/skill (admin có thể điều chỉnh) | Cân bằng nội dung/effort |
| UI trong lesson | Tab "Luyện kỹ năng" + grid 4 cards | Mobile-friendly, không phá layout |
| Components | Reuse 100% từ 4 skill modules | Không viết lại, chỉ truyền data khác |

---

## 4. Kiến trúc

```
┌──────────────────────────────────────────────────────────────┐
│                      HỆ THỐNG HIỆN TẠI                       │
│                                                               │
│  courses → lessons → vocabulary, quizzes                     │
│                                                               │
│  ┌─ THÊM MỚI ──────────────────────────────────────────┐    │
│  │                                                       │    │
│  │  lesson_skill_exercises (bảng mới)                    │    │
│  │  ├── lesson_id (FK → lessons)                         │    │
│  │  ├── skill: listening | speaking | reading | writing  │    │
│  │  ├── mode: dictation | pronunciation | ... (sub-mode) │    │
│  │  ├── content: JSONB (cùng format với stores hiện tại) │    │
│  │  └── AI generate từ lesson content + vocabulary       │    │
│  │                                                       │    │
│  │  lesson_skill_progress (bảng mới)                     │    │
│  │  ├── user_id, exercise_id                             │    │
│  │  └── score, is_completed, best_score, attempts        │    │
│  │                                                       │    │
│  └───────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
ADMIN FLOW:
Admin → Lesson Form (đã có) → Nút "🤖 Tạo bài 4 kỹ năng"
  → Chọn số lượng (mặc định 1/skill)
  → Edge Function đọc lesson content + vocabulary
  → AI generate 4 exercises (Listening, Speaking, Reading, Writing)
  → Lưu vào lesson_skill_exercises
  → Admin xem/xóa/regenerate từng bài

USER FLOW:
User → Lesson Study → Tab "Luyện kỹ năng"
  → Thấy grid 4 cards + progress ring mỗi skill
  → Click "🎧 Nghe" → Load exercise từ DB → Hiện DictationExercise
  → Hoàn thành → Evaluate bằng AI → Lưu progress
  → Quay lại grid → Thấy score cập nhật
```

---

## 5. Database Schema

### 5.1 Bảng `lesson_skill_exercises`

```sql
CREATE TABLE lesson_skill_exercises (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  skill           TEXT NOT NULL CHECK (skill IN ('listening','speaking','reading','writing')),
  mode            TEXT NOT NULL,
  title           TEXT NOT NULL,
  title_vi        TEXT,
  instruction_vi  TEXT,
  content         JSONB NOT NULL,          -- Cùng format với stores hiện tại
  order_index     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lesson_skill_exercises_lesson ON lesson_skill_exercises(lesson_id, skill);
```

### 5.2 Bảng `lesson_skill_progress`

```sql
CREATE TABLE lesson_skill_progress (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES lesson_skill_exercises(id) ON DELETE CASCADE,
  score           INT,
  is_completed    BOOLEAN DEFAULT false,
  attempts        INT DEFAULT 0,
  best_score      INT DEFAULT 0,
  xp_earned       INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

CREATE INDEX idx_lesson_skill_progress_user ON lesson_skill_progress(user_id);
```

### 5.3 JSONB `content` format (per skill)

Content field sử dụng **cùng format** với stores hiện tại để reuse components 100%:

**Listening** (mode: `dictation`):
```json
{
  "text": "The airplane will depart from gate 12.",
  "translation_vi": "Máy bay sẽ khởi hành từ cổng 12.",
  "word_count": 8,
  "difficulty_note_vi": "Chú ý phát âm 'depart'",
  "key_vocabulary": [{ "word": "depart", "meaning_vi": "khởi hành" }]
}
```

**Speaking** (mode: `pronunciation`):
```json
{
  "sentence": "I would like to check in, please.",
  "sentence_vi": "Tôi muốn làm thủ tục nhận phòng.",
  "phonetic_guide": "/aɪ wʊd laɪk tuː tʃɛk ɪn pliːz/",
  "key_sounds": [{ "sound": "ch", "tip_vi": "Đặt đầu lưỡi sau răng trên", "ipa": "/tʃ/" }],
  "difficulty_note_vi": "Câu lịch sự cơ bản"
}
```

**Reading** (mode: `level_reading`):
```json
{
  "title": "Hotel Check-in Guide",
  "content": "When you arrive at a hotel, you need to...",
  "word_count": 150,
  "questions": [
    { "question": "What do you need to show?", "type": "mcq", "options": [...], "correct_answer": "...", "explanation_vi": "..." }
  ],
  "vocabulary": [{ "word": "reception", "meaning_vi": "lễ tân", "ipa": "/rɪˈsɛpʃən/", "part_of_speech": "noun", "example": "..." }]
}
```

**Writing** (mode: `sentence_building`):
```json
{
  "correct_sentence": "I would like to book a room for two nights.",
  "words_shuffled": ["two", "I", "book", "would", "for", "room", "nights", "like", "a", "to"],
  "distractors": ["three"],
  "grammar_hint_vi": "Cấu trúc: would like to + V",
  "translation_vi": "Tôi muốn đặt phòng 2 đêm."
}
```

---

## 6. Frontend Changes

### 6.1 Modify: `LessonStudyPage.tsx`

Thêm tab thứ 4: **"Luyện kỹ năng"**

```
Tabs: [ Nội dung | Từ vựng | Bài tập | 🎯 Luyện kỹ năng ]
```

Khi chọn tab "Luyện kỹ năng":
- Hiển thị `SkillPracticeGrid` component
- Grid 2x2 với 4 skill cards
- Mỗi card hiển thị: icon + tên + progress ring + score
- Click card → mở `SkillExercisePlayer`

### 6.2 New Component: `SkillPracticeGrid.tsx`

```
src/features/learn/components/SkillPracticeGrid.tsx
```

Grid hiển thị 4 skill cards:
```
┌──────────┐  ┌──────────┐
│ 🎧 Nghe  │  │ 🎙️ Nói   │
│ ██████░░ │  │ Chưa làm │
│ 80%      │  │          │
└──────────┘  └──────────┘
┌──────────┐  ┌──────────┐
│ 📖 Đọc   │  │ ✍️ Viết  │
│ ████████ │  │ ██░░░░░░ │
│ 100% ✅  │  │ 30%      │
└──────────┘  └──────────┘
```

### 6.3 New Component: `SkillExercisePlayer.tsx`

```
src/features/learn/components/SkillExercisePlayer.tsx
```

Wrapper component:
- Nhận `exercise: LessonSkillExercise` prop
- Dựa vào `exercise.skill` + `exercise.mode` → render đúng component hiện tại
- Truyền `exercise.content` vào component dưới dạng props (không qua store)
- Sau khi user submit + evaluate → gọi `saveProgress()`

**Component mapping:**

```typescript
const EXERCISE_COMPONENTS = {
  listening: {
    dictation: DictationExercise,    // from features/listening/
    fill_blank: FillBlankExercise,
    dialogue: DialogueExercise,
  },
  speaking: {
    pronunciation: PronunciationExercise,  // from features/speaking/
    shadowing: ShadowingExercise,
  },
  reading: {
    level_reading: LevelReading,        // from features/reading/
    reading_aloud: ReadingAloud,
  },
  writing: {
    sentence_building: SentenceBuilding,  // from features/writing/
    paraphrase: ParaphraseExercise,
    essay: EssayWriting,
  },
}
```

> **Lưu ý quan trọng:** Hiện tại các components đọc data từ zustand stores (useListeningStore, etc.). Để reuse, cần refactor nhẹ: cho components nhận data qua **props** thay vì chỉ từ store. Hoặc tạo wrapper set data vào store trước khi render component.

### 6.4 Modify: `learnStore.ts`

Thêm actions:
- `fetchLessonSkillExercises(lessonId)` — load bài tập 4 skills cho lesson
- `fetchSkillProgress(exerciseIds)` — load progress user
- `saveSkillProgress(exerciseId, score, isCompleted)` — lưu kết quả

### 6.5 Modify: `CourseDetailPage.tsx`

Thêm section "Luyện tổng hợp" ở cuối trang:
- Grid 4 skill cards giống lesson-level
- Dùng bảng `lesson_skill_exercises` nhưng với `lesson_id = NULL` và thêm `course_id` field
- Hoặc đơn giản hơn: course-level exercises cũng lưu vào cùng bảng với 1 field `course_id` bổ sung

---

## 7. Admin Changes

### 7.1 Modify: `LessonFormPage.tsx`

Thêm section cuối trang:

```
┌─────────────────────────────────────────────────┐
│ 🎯 Bài luyện 4 kỹ năng                          │
│                                                  │
│ Số lượng mỗi skill:  [1] ▼                      │
│                                                  │
│ [🤖 Tạo bài 4 kỹ năng]                          │
│                                                  │
│ ─── Bài đã tạo ───                               │
│ 🎧 Listening: Dictation - "Airport announcement" │  [Xem] [Xóa]
│ 🎙️ Speaking: Pronunciation - "Check in phrase"   │  [Xem] [Xóa]
│ 📖 Reading: Level Reading - "Hotel Guide"         │  [Xem] [Xóa]
│ ✍️ Writing: Sentence Building - "Booking room"    │  [Xem] [Xóa]
│                                                  │
│ [🔄 Regenerate tất cả]                           │
└─────────────────────────────────────────────────┘
```

### 7.2 Edge Function: `generate-lesson-skills`

Endpoint mới trong `writing-api`:

```
POST /generate-lesson-skills
Body: {
  lesson_id: string,
  skills_count: { listening: 1, speaking: 1, reading: 1, writing: 1 }
}
```

AI flow:
1. Fetch lesson content + vocabulary từ DB
2. System prompt: "Dựa trên nội dung bài học sau, tạo bài tập cho từng kỹ năng..."
3. Generate 4 exercises, mỗi cái dùng vocabulary + context của lesson
4. Return exercises → admin review → save to `lesson_skill_exercises`

---

## 8. Chiến lược Reuse Components

**Approach đề xuất: "Store Injection"**

Thay vì refactor toàn bộ components để nhận props, tạo cơ chế inject data:

```typescript
// Trước khi render DictationExercise cho course skill:
// 1. Set content vào listeningStore
useListeningStore.setState({
  content: exercise.content,  // từ DB
  phase: 'exercise',
  mode: exercise.mode,
})
// 2. Render DictationExercise — nó đọc từ store như bình thường
// 3. Sau khi submit, intercept kết quả → saveSkillProgress()
```

**Ưu điểm:**
- ZERO refactor cho existing components
- Content format giống 100%
- Evaluate flow vẫn hoạt động (gọi edge function)

**Nhược điểm:**
- Store state bị shared giữa free practice và course skill
- Cần reset store trước/sau khi sử dụng

**Giải pháp:** Wrap trong `SkillExercisePlayer` component xử lý lifecycle:
- Mount: backup store state → inject exercise data
- Unmount: restore store state

---

## 9. Phạm vi triển khai (MVP)

### Phase 1 — Database + Admin Generate
- Migration 2 bảng mới
- Endpoint `generate-lesson-skills` trong writing-api
- UI generate trong LessonFormPage

### Phase 2 — User-facing UI
- Tab "Luyện kỹ năng" trong LessonStudyPage
- SkillPracticeGrid + SkillExercisePlayer
- Progress tracking

### Phase 3 — Course-level Practice
- Section "Luyện tổng hợp" trong CourseDetailPage
- Generate dựa trên toàn bộ course content

---

## 10. Files Changed Summary

| Action | File | Mô tả |
|--------|------|-------|
| NEW | `supabase/migrations/20260401_lesson_skills.sql` | 2 bảng + RLS |
| MODIFY | `supabase/functions/writing-api/index.ts` | Endpoint `generate-lesson-skills` |
| NEW | `src/features/learn/components/SkillPracticeGrid.tsx` | Grid 4 skill cards |
| NEW | `src/features/learn/components/SkillExercisePlayer.tsx` | Wrapper render exercise |
| NEW | `src/features/learn/components/ProgressRing.tsx` | Ring chart progress |
| MODIFY | `src/features/learn/pages/LessonStudyPage.tsx` | Thêm tab "Luyện kỹ năng" |
| MODIFY | `src/features/learn/stores/learnStore.ts` | Actions fetch/save skill exercises |
| MODIFY | `src/features/learn/pages/CourseDetailPage.tsx` | Section "Luyện tổng hợp" |
| MODIFY | `src/features/admin/pages/LessonFormPage.tsx` | UI generate 4 skills |
