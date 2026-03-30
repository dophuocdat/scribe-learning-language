# Translation Practice — Design Document

> **Date:** 2026-03-30
> **Status:** Draft → Awaiting Approval
> **Feature:** Dịch thuật En↔Vi với AI đánh giá + luyện nói

---

## 1. Overview

Thêm chức năng **Luyện dịch thuật** vào Scribe — cho phép user luyện dịch câu từ Anh sang Việt và Việt sang Anh, với AI đánh giá chi tiết từng câu (tô lỗi, gợi ý sửa, câu nâng cao) + tổng kết cuối bài + luyện nói (speech recognition).

### Decisions Made (from brainstorming)

| Quyết định | Chọn | Lý do |
|---|---|---|
| Chiều dịch | User chọn (C) | Linh hoạt, reuse pattern Listening Practice |
| Nguồn nội dung | Hybrid (C) | Khóa học cố định + luyện tập tự do AI |
| Luyện nói | Web Speech Recognition + fallback (A) | Free, đủ tốt cho learning |
| Đánh giá AI | Từng câu + tổng kết cuối bài (C) | Chi tiết nhất |

---

## 2. User Flow

```
┌─────────────────────────────────────────────────┐
│           TRANSLATION PRACTICE PAGE             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Tab: Khóa học │  │ Tab: Luyện tập tự do    │ │
│  └──────┬───────┘  └──────────┬───────────────┘ │
│         │                     │                 │
│         ▼                     ▼                 │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Chọn khóa &  │  │ Chọn Level + Direction   │ │
│  │ bài học       │  │ + Topic                  │ │
│  └──────┬───────┘  └──────────┬───────────────┘ │
│         │                     │                 │
│         └─────────┬───────────┘                 │
│                   ▼                             │
│  ┌─────────────────────────────────────────┐    │
│  │        EXERCISE SCREEN                  │    │
│  │                                         │    │
│  │  📖 Câu gốc: "I want to go to school"  │    │
│  │  🔊 [Play Audio]                        │    │
│  │                                         │    │
│  │  ✍️  [Input: User types translation]    │    │
│  │                                         │    │
│  │  [Kiểm tra] ← gửi AI đánh giá          │    │
│  └──────────┬──────────────────────────────┘    │
│             ▼                                   │
│  ┌─────────────────────────────────────────┐    │
│  │        AI FEEDBACK                      │    │
│  │                                         │    │
│  │  Score: 75/100 ⭐                       │    │
│  │                                         │    │
│  │  🔴 Lỗi: "tôi muốn đi đến trường"     │    │
│  │     "đến" → nên dùng "tới" tự nhiên hơn│    │
│  │                                         │    │
│  │  ✅ Gợi ý: "Tôi muốn đi học"           │    │
│  │  🚀 Nâng cao: "Tôi rất muốn tới trường"│    │
│  │                                         │    │
│  │  🎙️ [Luyện nói câu này]                │    │
│  │  [Câu tiếp theo →]                     │    │
│  └──────────┬──────────────────────────────┘    │
│             ▼ (sau câu cuối)                    │
│  ┌─────────────────────────────────────────┐    │
│  │        SUMMARY SCREEN                   │    │
│  │                                         │    │
│  │  📊 Kết quả: 8/10 câu đúng             │    │
│  │  ⏱️ Thời gian: 12 phút                 │    │
│  │  📈 Điểm trung bình: 82/100            │    │
│  │                                         │    │
│  │  ❌ Lỗi thường gặp:                    │    │
│  │    • Dùng sai giới từ (3 lần)           │    │
│  │    • Thiếu mạo từ (2 lần)              │    │
│  │                                         │    │
│  │  💡 Gợi ý cải thiện:                   │    │
│  │    • Ôn lại cách dùng giới từ in/on/at  │    │
│  │                                         │    │
│  │  [Làm lại] [Bài tiếp theo]             │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 `translation_courses` — Khóa học dịch thuật (admin-seeded)

```sql
CREATE TABLE translation_courses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,             -- "A1 Translation Practice"
  description   TEXT,
  level         TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  direction     TEXT NOT NULL CHECK (direction IN ('en_to_vi','vi_to_en','mixed')),
  cover_image   TEXT,
  total_lessons INT DEFAULT 10,
  is_published  BOOLEAN DEFAULT false,
  order_index   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 `translation_lessons` — Bài dịch trong khóa

```sql
CREATE TABLE translation_lessons (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id       UUID NOT NULL REFERENCES translation_courses(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,           -- "Bài 1: Daily Routines"
  description     TEXT,
  order_index     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 `translation_sentences` — Câu trong mỗi bài

```sql
CREATE TABLE translation_sentences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id       UUID NOT NULL REFERENCES translation_lessons(id) ON DELETE CASCADE,
  source_text     TEXT NOT NULL,           -- Câu gốc
  reference_translation TEXT NOT NULL,     -- Bản dịch chuẩn (tham khảo)
  direction       TEXT NOT NULL CHECK (direction IN ('en_to_vi','vi_to_en')),
  hint            TEXT,                    -- Gợi ý nhẹ (optional)
  difficulty_rank INT DEFAULT 1,           -- 1-5 difficulty within lesson
  order_index     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 `translation_attempts` — Kết quả từng câu của user

```sql
CREATE TABLE translation_attempts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  sentence_id     UUID REFERENCES translation_sentences(id),  -- NULL nếu free practice
  session_id      UUID NOT NULL,           -- Group các câu trong 1 session
  source_text     TEXT NOT NULL,           -- Câu gốc
  direction       TEXT NOT NULL,
  user_translation TEXT NOT NULL,          -- Bản dịch của user
  ai_feedback     JSONB,                  -- Chi tiết feedback từ AI
  score           INT,                    -- 0-100
  errors          JSONB,                  -- [{type, position, original, suggestion}]
  suggested_translation  TEXT,            -- Câu hoàn chỉnh AI gợi ý
  advanced_translation   TEXT,            -- Phiên bản nâng cao
  speech_score    INT,                    -- Điểm luyện nói (0-100, nullable)
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 `translation_sessions` — Session tổng kết

```sql
CREATE TABLE translation_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  lesson_id       UUID REFERENCES translation_lessons(id),  -- NULL nếu free practice
  mode            TEXT NOT NULL CHECK (mode IN ('course','free')),
  level           TEXT NOT NULL,
  direction       TEXT NOT NULL,
  topic           TEXT,                    -- Cho free practice
  total_sentences INT DEFAULT 0,
  completed_count INT DEFAULT 0,
  avg_score       NUMERIC(5,2) DEFAULT 0,
  total_time_sec  INT DEFAULT 0,
  ai_summary      JSONB,                  -- Tổng kết AI cuối bài
  xp_earned       INT DEFAULT 0,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 Update `user_profiles` — Thêm limit

```sql
ALTER TABLE user_profiles
ADD COLUMN max_daily_translations INT DEFAULT 20;
```

---

## 4. AI Evaluation Design

### 4.1 Per-Sentence Evaluation Prompt

Gemini nhận: câu gốc + chiều dịch + bản dịch user → Trả về JSON:

```json
{
  "score": 78,
  "is_correct": false,
  "errors": [
    {
      "type": "word_choice",
      "original": "đến",
      "suggestion": "tới",
      "explanation": "'tới' tự nhiên hơn trong ngữ cảnh này",
      "position": { "start": 15, "end": 18 }
    },
    {
      "type": "grammar",
      "original": "đi đến trường",
      "suggestion": "đi học",
      "explanation": "Tiếng Việt thường nói 'đi học' thay vì 'đi đến trường'",
      "position": { "start": 12, "end": 25 }
    }
  ],
  "suggested_translation": "Tôi muốn đi học",
  "advanced_translation": "Tôi rất háo hức được tới trường hôm nay",
  "naturalness_note": "Bản dịch hiểu được nhưng chưa tự nhiên với người Việt"
}
```

**Error types**: `grammar`, `word_choice`, `word_order`, `missing_word`, `extra_word`, `tense`, `spelling`, `naturalness`

### 4.2 End-of-Session Summary Prompt

Gemini nhận: tất cả attempts trong session → Trả về:

```json
{
  "overall_score": 82,
  "total_correct": 8,
  "total_sentences": 10,
  "error_patterns": [
    {
      "type": "preposition",
      "count": 3,
      "examples": ["in → at", "on → in"],
      "tip": "Ôn lại giới từ thời gian: at + giờ, on + ngày, in + tháng/năm"
    }
  ],
  "strengths": ["Từ vựng phong phú", "Cấu trúc câu tốt"],
  "improvements": ["Cần cải thiện giới từ", "Chú ý mạo từ a/an/the"],
  "recommended_practice": "Nên luyện thêm 5 câu về giới từ ở level A1"
}
```

### 4.3 Free Practice — Sentence Generation Prompt

Gemini generate N câu theo level + direction + topic:

```json
{
  "sentences": [
    {
      "source_text": "I go to school every day.",
      "reference_translation": "Tôi đi học mỗi ngày.",
      "hint": "every day = mỗi ngày",
      "difficulty_rank": 1
    }
  ]
}
```

---

## 5. Component Architecture

```
src/features/translation/
├── pages/
│   └── TranslationPracticePage.tsx     # Main page with tab switching
├── components/
│   ├── TranslationConfig.tsx           # Tab: chọn khóa hoặc free practice config
│   ├── CourseSelector.tsx              # Chọn khóa + bài trong tab khóa học
│   ├── TranslationExercise.tsx         # Exercise screen: câu gốc + input + check
│   ├── SentenceCard.tsx                # 1 câu: hiển thị source + audio + input
│   ├── AiFeedback.tsx                  # Hiển thị feedback AI: lỗi, gợi ý, nâng cao
│   ├── ErrorHighlight.tsx              # Component tô đỏ lỗi trong text
│   ├── SpeechPractice.tsx              # Luyện nói 1 câu (mic + recognition)
│   └── TranslationSummary.tsx          # Tổng kết cuối bài
├── stores/
│   └── translationStore.ts            # Zustand store: state management
└── lib/
    └── speechRecognition.ts           # Web Speech Recognition wrapper
```

### 5.1 State Machine (Zustand Store)

```
config → loading → exercise → [per sentence: input → checking → feedback → (speech)] → summary
```

```typescript
interface TranslationState {
  // Config
  phase: 'config' | 'loading' | 'exercise' | 'summary'
  mode: 'course' | 'free'
  direction: 'en_to_vi' | 'vi_to_en'
  level: string
  topic: string

  // Exercise data
  sessionId: string | null
  sentences: TranslationSentence[]
  currentIndex: number
  attempts: TranslationAttempt[]

  // Current sentence state
  userInput: string
  isChecking: boolean
  currentFeedback: AiFeedback | null
  showSpeechPractice: boolean

  // Summary
  sessionSummary: SessionSummary | null

  // Timing
  sessionStartTime: number
  sentenceStartTime: number
}
```

---

## 6. Speech Practice Design

### 6.1 Web Speech Recognition (Primary)

```typescript
// Sử dụng SpeechRecognition API
const recognition = new webkitSpeechRecognition()
recognition.lang = direction === 'en_to_vi' ? 'vi-VN' : 'en-US'
recognition.continuous = false
recognition.interimResults = true

// So sánh transcript với target sentence
function calculateSimilarity(spoken: string, target: string): number {
  // Levenshtein distance-based similarity
  // Normalize: lowercase, remove punctuation
  // Score ≥ 70% = PASS
}
```

### 6.2 Fallback: Self-Assessment

Khi browser không hỗ trợ SpeechRecognition:
- User bấm Record → MediaRecorder ghi âm
- Phát lại audio → User tự đánh giá
- 2 nút: "Đạt ✅" / "Thử lại 🔄"

---

## 7. Edge Function — `translation-api`

Thêm edge function mới hoặc extend `ai-api`:

### Endpoints:

| Endpoint | Mô tả | Auth |
|---|---|---|
| `evaluate-translation` | AI đánh giá 1 câu dịch | User |
| `summarize-session` | AI tổng kết cuối bài | User |
| `generate-sentences` | AI tạo câu cho free practice | User |

**Quan trọng:** Endpoint này cần **user auth** (không phải admin-only như `ai-api` hiện tại). Sẽ tạo edge function riêng `translation-api` hoặc thêm user-level auth vào `ai-api`.

---

## 8. XP System Integration

| Action | XP |
|---|---|
| Hoàn thành 1 câu dịch (score ≥ 70) | +5 XP |
| Hoàn thành 1 câu dịch (score ≥ 90) | +10 XP |
| Pass speech practice cho 1 câu | +3 XP |
| Hoàn thành 1 bài (10 câu) | +20 XP bonus |
| Perfect score (avg ≥ 95) | +30 XP bonus |

---

## 9. Admin Seed Data Structure

Tạo sẵn 2 khóa ban đầu:

### Khóa 1: "A1 Translation — English to Vietnamese" (10 bài)
- Bài 1: Daily Routines (10 câu đơn giản về thói quen hàng ngày)
- Bài 2: My Family (10 câu về gia đình)
- Bài 3: Food & Drinks (10 câu về đồ ăn)
- ... (7 bài nữa)

### Khóa 2: "A1 Translation — Vietnamese to English" (10 bài)
- Cùng chủ đề nhưng ngược chiều

### Seed data format (SQL hoặc AI-generated):
- Mỗi bài: 10 câu, độ khó tăng dần trong bài
- Mỗi câu: source_text + reference_translation + hint

---

## 10. UI/UX Notes

### Colors & Design
- Reuse theme hiện có (`gradient-bg`, `glass-card`, `surface-*`)
- Icon: `Languages` (lucide-react) cho trang chính
- Màu accent cho translation: **teal/cyan** để phân biệt với Listening (purple) và Writing (blue)

### Responsive
- Mobile-first layout
- Input dịch: textarea full-width, auto-resize
- Feedback: collapsible sections
- Speech: floating mic button

### Animations
- Slide-in cho feedback panel
- Pulse animation cho mic recording
- Progress bar cho session
- Confetti cho perfect score

---

## 11. Route

```
/translation → TranslationPracticePage
```

Thêm vào sidebar navigation, giữa "Luyện nghe" và "Công cụ viết".
