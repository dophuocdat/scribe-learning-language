# Sub-Project 3: Reading Practice Module — COMPLETED ✅

> **Date:** 2026-04-01  
> **Status:** ✅ Completed  
> **Design Ref:** `docs/designs/2026-03-31-four-skills-practice-design.md` (Section 6)

---

## 1. Scope & Objectives

Sub-project 3 bao gồm:
1. ✅ DB migration (`reading_batch_sessions` + `vocabulary_cache`)
2. ✅ Reading module — 2 modes: Đọc hiểu (Level Reading) + Đọc thành tiếng (Reading Aloud)
3. ✅ Interactive Text — click-to-translate với AI fallback + DB cache
4. ✅ Real-time Karaoke — STT highlighting (correct/wrong/skipped)
5. ✅ Session management (save/resume/delete, max 3 per mode)
6. ✅ Batch generation (1–5 bài/session)

---

## 2. Components Built

### 2.1 Reading Module (`src/features/reading/`)

| File | Status | Description |
|------|--------|-------------|
| `pages/ReadingPage.tsx` | ✅ | Main page router (config → exercise → questions → result) |
| `components/ReadingConfig.tsx` | ✅ | Mode/level/topic/batch selector + session list |
| `components/LevelReading.tsx` | ✅ | Bài đọc hiểu — timer + interactive text + navigate to questions |
| `components/InteractiveText.tsx` | ✅ | Clickable words — vocab highlighting + popup trigger |
| `components/WordPopup.tsx` | ✅ | Popup tra nghĩa — portal rendering + AI fallback + DB cache |
| `components/ReadingQuestions.tsx` | ✅ | MCQ questions — type badges (main_idea/detail/inference/vocab) |
| `components/ReadingResult.tsx` | ✅ | Kết quả đọc hiểu — score, per-question feedback, clicked words |
| `components/ReadingAloud.tsx` | ✅ | Đọc thành tiếng — real-time karaoke + mic recording + translate |
| `components/ReadingAloudResult.tsx` | ✅ | Kết quả đọc thành tiếng — accuracy, WPM, word-level results |
| `stores/readingStore.ts` | ✅ | Zustand store — state, generate, evaluate, sessions |

---

## 3. API Endpoints (Supabase Edge Function: `writing-api`)

### 3.1 Reading Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `generate-reading` | POST | Generate article + MCQ questions + vocabulary list (AI) |
| `evaluate-reading` | POST | Chấm điểm MCQ comprehension (server-side) |
| `lookup-word` | POST | Tra nghĩa từ: DB cache → AI fallback → save cache |
| `evaluate-reading-aloud` | POST | Chấm đọc thành tiếng: fuzzy matching + WPM + accuracy |

### 3.2 Vocabulary Cache System

```
User click từ → API lookup-word
  ├── 1) Check vocabulary_cache DB → HIT → Return ngay (< 100ms) ⚡
  └── 2) MISS → Call AI → Return + Save to DB (fire-and-forget)
       └── Next time → HIT → Instant!
```

- Tiết kiệm token AI: mỗi từ chỉ call AI **1 lần duy nhất**
- Bảng `vocabulary_cache` với `UNIQUE(word)` constraint
- Edge function dùng service role client để insert (bypass RLS)

### 3.3 AI Model Fallback Chain (Shared)

```
gemini-2.5-flash → gemma-3-27b-it → gemma-3-12b-it → gemini-2.0-flash → gemini-1.5-flash
```

---

## 4. Database Schema

### 4.1 `reading_batch_sessions` (NEW)

```sql
CREATE TABLE reading_batch_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  mode          TEXT NOT NULL CHECK (mode IN ('level_reading', 'reading_aloud')),
  exercise_type TEXT NOT NULL DEFAULT 'article',
  level         TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic         TEXT DEFAULT 'General',
  batch_items   JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_index INT DEFAULT 0,
  total_count   INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

- **RLS Policies**: Users CRUD only their own sessions
- **Key**: `user_id DEFAULT auth.uid()` — auto-set on insert

### 4.2 `vocabulary_cache` (NEW)

```sql
CREATE TABLE vocabulary_cache (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word           TEXT NOT NULL UNIQUE,
  meaning_vi     TEXT NOT NULL,
  ipa            TEXT DEFAULT '',
  part_of_speech TEXT DEFAULT '',
  example        TEXT DEFAULT '',
  context        TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

- **RLS**: All authenticated users can read; only service role can insert
- **Purpose**: Cache AI-translated words to avoid repeated API calls

---

## 5. Key Features

### 5.1 Interactive Text (R2: Đọc hiểu)
- Mọi từ trong bài đọc đều **clickable**
- Từ có trong pre-generated vocab list → highlighted với dotted underline
- Click → popup hiện: IPA, loại từ, nghĩa tiếng Việt, ví dụ, nút TTS
- Vocab lookup: pre-generated list → DB cache → AI fallback
- Nút "Lưu vào từ vựng" trong popup

### 5.2 WordPopup — Portal Rendering
- Sử dụng `ReactDOM.createPortal(popup, document.body)` để render popup
- **Lý do**: Thoát khỏi mọi **stacking context** (glass-card, overflow hidden)
- Position: `fixed` + clamp within viewport
- Nền `bg-surface-900` (opaque) không bị ảnh hưởng bởi backdrop-blur

### 5.3 Real-time Karaoke (R3: Đọc thành tiếng)
- Web Speech API với `interimResults: true` cho real-time feedback
- Thuật toán **incremental matching**:
  - Chỉ xử lý từ MỚI từ STT (so với `lastProcessedCountRef`)
  - So sánh tuần tự với passage words
  - Strict matching: exact hoặc Levenshtein ≤ 1 (cho từ > 3 ký tự)
- **4 trạng thái từ**: unread (dim) → current (pulse) → correct (xanh) / wrong (đỏ) / skipped (vàng gạch ngang)
- Live stats: ✓ đúng / ✗ sai / ↷ bỏ qua
- Progress bar gradient real-time
- Nút "Ghi âm lại" sau khi dừng
- Click-to-translate cũng hoạt động ở mode này (khi idle/done)

### 5.4 MCQ Questions
- 4 loại câu hỏi: `main_idea`, `detail`, `inference`, `vocabulary_in_context`
- Mỗi loại có badge màu khác nhau
- Chấm điểm server-side (không cần AI)
- Feedback tiếng Việt cho từng câu

### 5.5 Session Management
- Sessions auto-saved to DB on generation
- Resume: click "Tiếp tục" trên saved session card
- Delete: click trash icon (with confirm)
- Progress: `current_index / total_count` với progress bar
- Max 3 sessions per mode

---

## 6. Bug Fixes & Issues Resolved

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | WordPopup vị trí lệch phải, ra ngoài màn hình | Dùng `clientX` raw, không clamp | Đổi sang center offset + clamp viewport |
| 2 | WordPopup quá trong suốt, đọc không rõ | Dùng `glass-card` (backdrop-blur) | Đổi sang `bg-surface-900` opaque |
| 3 | Karaoke highlight nhảy tất cả khi đọc 1-2 từ | STT `transcript` bị duplicate (append vào prev) | Fix `useSTT.ts`: `setTranscript(final)` thay vì append |
| 4 | WordPopup bị mic controls đè (z-index) | `position: absolute` bị trapped trong stacking context | `createPortal(popup, document.body)` + `position: fixed` |
| 5 | Karaoke không phân biệt đúng/sai | Chỉ có 1 trạng thái (matched/unmatched) | 4 trạng thái: correct/wrong/skipped/current |
| 6 | Không có nút ghi âm lại | Thiếu state transition `done → idle` | Thêm `handleRetry` + nút "Ghi âm lại" |
| 7 | Mỗi lần tra từ → call AI (tốn token, chậm) | Không cache kết quả | Thêm `vocabulary_cache` table + DB-first lookup |

---

## 7. Files Changed (Summary)

### New Files
- `src/features/reading/` — Full module (8 components + store + page)
- `supabase/migrations/20260401_reading_batch_sessions.sql`
- `supabase/migrations/20260401_vocabulary_cache.sql`

### Modified Files
- `supabase/functions/writing-api/index.ts` — Added 4 reading endpoints + vocabulary cache logic
- `src/app/App.tsx` — Added `/reading` route (replaced placeholder)
- `src/shared/hooks/useSTT.ts` — Fixed transcript duplication bug (line 89)

---

## 8. Deployment Checklist

- [x] `supabase functions deploy writing-api`
- [x] `npm run deploy` (Cloudflare Pages)
- [x] Run migration SQL: `reading_batch_sessions`
- [x] Run migration SQL: `vocabulary_cache`
- [x] `GEMINI_API_KEY` configured in Supabase secrets

---

## 9. Architecture Decisions

### 9.1 Vocabulary Strategy: Pre-generated → Cache → AI
```
1. AI generate bài đọc → kèm vocabulary list (pre-generated)
2. User click từ trong list → instant popup (no API call)
3. User click từ KHÔNG trong list → check vocabulary_cache DB
4. Cache HIT → instant popup
5. Cache MISS → call AI → return + save DB → next time instant
```

### 9.2 Karaoke Algorithm: Incremental Matching
```
- Track lastProcessedCount (số từ STT đã xử lý)
- Mỗi lần STT update → chỉ xử lý từ MỚI
- So sánh tuần tự: spoken vs expected
  - Match → correct (xanh)
  - Mismatch nhưng next word match → skipped (vàng)
  - Mismatch → wrong (đỏ)
```

### 9.3 Portal Pattern cho Popup
```
WordPopup → createPortal → document.body
- position: fixed (viewport coords)
- z-index: 99999
- Thoát mọi stacking context
- Không bị đè bởi sibling elements
```

---

## 10. Next: Sub-Project 4 (Writing)

According to design doc Section 7, Sub-project 4 includes:
1. Writing module — Essay/Paragraph/Email exercises
2. AI-powered grammar checking + suggestions
3. Scoring rubric (content, grammar, vocabulary, coherence)
4. Revision cycle (write → grade → improve → re-grade)

**Dependencies from previous sub-projects (done):**
- ✅ `writing-api` Edge Function with AI fallback chain
- ✅ `vocabulary_cache` for word lookups
- ✅ Session management pattern (Zustand + DB)
- ✅ Responsive UI patterns (glass-card, gradient-bg, etc.)
