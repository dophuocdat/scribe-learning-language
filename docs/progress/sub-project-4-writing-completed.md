# Sub-Project 4: Writing Upgrade — COMPLETED ✅

> **Date:** 2026-04-01  
> **Status:** ✅ Completed  
> **Design Ref:** `docs/designs/2026-03-31-four-skills-practice-design.md` (Section 7)

---

## 1. Scope & Objectives

Sub-project 4 bao gồm:
1. ✅ Writing module mới — 3 modes luyện tập: Sắp xếp câu, Viết lại câu, Viết bài
2. ✅ Merge legacy tools (Grammar Checker + Paraphraser) vào tab "Công cụ"
3. ✅ 6 API endpoints mới (generate + evaluate cho 3 modes)
4. ✅ Session management (save/resume/delete)
5. ✅ DB migration (`writing_batch_sessions`)
6. ✅ Route update: `/writing` → WritingPage mới

---

## 2. Components Built

### 2.1 Writing Module (`src/features/writing/`)

| File | Status | Description |
|------|--------|-------------|
| `pages/WritingPage.tsx` | ✅ | Main page — 2 tabs: "Luyện viết" + "Công cụ" |
| `components/WritingConfig.tsx` | ✅ | Mode/level/topic/batch/essay-type selector + sessions |
| `components/SentenceBuilding.tsx` | ✅ | W1: Tap-to-add word tiles → sắp xếp câu |
| `components/SentenceBuildingResult.tsx` | ✅ | W1: Đúng/sai + grammar hint + XP |
| `components/ParaphraseExercise.tsx` | ✅ | W2: Câu gốc + hint + textarea viết lại |
| `components/ParaphraseResult.tsx` | ✅ | W2: 3 score bars + corrections + alternatives |
| `components/EssayWriting.tsx` | ✅ | W3: Đề bài + textarea + word counter + timer |
| `components/EssayFeedback.tsx` | ✅ | W3: 4 rubric scores + corrections + better vocab |
| `stores/writingStore.ts` | ✅ | Zustand store — phases, batch, sessions, 3 modes |

### 2.2 Legacy Tools (Giữ nguyên, tab "Công cụ")

| File | Status | Description |
|------|--------|-------------|
| `writing-tools/GrammarChecker.tsx` | ✅ Keep | Grammar checking tool |
| `writing-tools/Paraphraser.tsx` | ✅ Keep | Auto-rewrite tool |
| `writing-tools/writingToolsStore.ts` | ✅ Keep | Legacy store (unchanged) |

---

## 3. API Endpoints (Supabase Edge Function: `writing-api`)

### 3.1 Writing Practice Endpoints (6 NEW)

| Endpoint | Method | AI? | Description |
|----------|--------|-----|-------------|
| `generate-sentence-building` | POST | ✅ | Generate câu + shuffled words + distractors |
| `evaluate-sentence` | POST | ❌ | Server-side: normalize + compare (no AI cost) |
| `generate-paraphrase-exercise` | POST | ✅ | Generate câu gốc + hint + example rewrites |
| `evaluate-paraphrase` | POST | ✅ | AI chấm: meaning/naturalness/level upgrade |
| `generate-essay-prompt` | POST | ✅ | Generate đề bài + word limit + hints + phrases |
| `evaluate-essay` | POST | ✅ | AI chấm IELTS-like: 4 rubrics + corrections + better vocab |

### 3.2 Evaluate-sentence: Server-side (Không tốn AI token)

```
normalize(sentence) = toLowerCase → remove punctuation → collapse spaces → trim
isCorrect = normalize(correct) === normalize(user_answer)
```

Đây là optimization quan trọng: **Sentence Building evaluate không cần AI** — chỉ so sánh chuỗi
→ Tiết kiệm token + response nhanh (< 100ms)

### 3.3 Essay Evaluation: IELTS-like Rubric

```
4 tiêu chí (0-100 mỗi tiêu chí):
├── Task Response: Trả lời đề bài? Đủ dài?
├── Grammar Score: Ngữ pháp + đa dạng cấu trúc câu
├── Vocabulary Score: Phạm vi + chính xác + phù hợp
└── Coherence Score: Tổ chức + logic + linking words

+ Band estimate (A1-C2)
+ Inline corrections (original → corrected + explanation)
+ Better vocabulary suggestions (good → excellent)
```

---

## 4. Database Schema

### 4.1 `writing_batch_sessions` (NEW)

```sql
CREATE TABLE writing_batch_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  mode          TEXT NOT NULL CHECK (mode IN ('sentence_building', 'paraphrase', 'essay')),
  exercise_type TEXT NOT NULL DEFAULT 'sentence_building',
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
- **Pattern**: Giống `listening_batch_sessions`, `speaking_batch_sessions`, `reading_batch_sessions`

---

## 5. Key Features

### 5.1 W1 — Sentence Building (Sắp xếp câu)
- **Click-to-add pattern** (không phải drag & drop):
  - Click word tile → thêm vào answer zone
  - Click word trong answer → bỏ ra
- Auto-evaluate khi submit
- Distractors: B1+ thêm 1-2 từ nhiễu, A1-A2 không có
- Grammar hint tiếng Việt sau khi chấm
- Translation tiếng Việt cho câu gốc
- Batch progress bar

### 5.2 W2 — Paraphrase Exercise (Viết lại câu)
- AI generate câu gốc + hint (formal/simple/academic)
- User viết lại câu vào textarea
- Show/hide example rewrites (toggle)
- AI chấm 3 tiêu chí:
  - **Meaning preservation** (giữ nghĩa)
  - **Naturalness** (tự nhiên)
  - **Level upgrade** (nâng cao hơn)
- Score bars + corrections + better alternatives

### 5.3 W3 — Essay Writing (Viết bài)
- 3 loại bài: **Email** (80-150W), **Paragraph** (100-200W), **Essay** (150-300W)
- AI generate đề bài + hints + useful phrases
- Live word counter + timer
- Word count progress bar (green/yellow/red)
- Show/hide writing hints toggle
- AI chấm IELTS-like:
  - 4 rubric score bars (animated)
  - Band estimate (A1-C2)
  - Inline grammar corrections
  - Better vocabulary suggestions (with context)
  - Structure feedback

### 5.4 Page Architecture: 2 Tabs
```
WritingPage
├── Tab "Luyện viết" (default)
│   ├── WritingConfig → SentenceBuilding / ParaphraseExercise / EssayWriting
│   └── Results: SentenceBuildingResult / ParaphraseResult / EssayFeedback
│
└── Tab "Công cụ"
    ├── Grammar Checker (from writing-tools/)
    └── Paraphraser (from writing-tools/)
```

### 5.5 Session Management
- Same pattern across all 4 modules (listening/speaking/reading/writing)
- Sessions auto-saved to DB on generation
- Resume / Delete saved sessions
- Batch progress tracking

---

## 6. Files Changed (Summary)

### New Files
```
src/features/writing/
├── pages/WritingPage.tsx
├── components/
│   ├── WritingConfig.tsx
│   ├── SentenceBuilding.tsx
│   ├── SentenceBuildingResult.tsx
│   ├── ParaphraseExercise.tsx
│   ├── ParaphraseResult.tsx
│   ├── EssayWriting.tsx
│   └── EssayFeedback.tsx
└── stores/writingStore.ts

supabase/migrations/20260401_writing_batch_sessions.sql
```

### Modified Files
- `supabase/functions/writing-api/index.ts` — Added 6 writing endpoints + 6 prompts + router cases
- `src/app/App.tsx` — Import WritingPage + route `/writing` → WritingPage

### Unchanged (Legacy)
- `src/features/writing-tools/` — Entire module kept intact, imported from WritingPage "Công cụ" tab
- `/writing-tools` route — Still works (backward compat)

---

## 7. Deployment Checklist

- [x] `npm run build` — zero TypeScript errors
- [x] `npm run deploy` — Cloudflare Pages
- [x] `npx supabase functions deploy writing-api`
- [ ] Run migration SQL: `writing_batch_sessions` on Supabase Dashboard
- [ ] (Also pending from SP3): `reading_batch_sessions`, `vocabulary_cache`

---

## 8. Architecture Decisions

### 8.1 Click-to-Add thay vì Drag & Drop
- Drag & Drop phức tạp trên mobile (touch events, OS gesture conflicts)
- Click-to-add UX đơn giản hơn, hoạt động cả desktop + mobile
- Tap word → add, tap answer word → remove

### 8.2 Evaluate-sentence: Server-side (No AI)
- Sentence Building chỉ cần so sánh chuỗi → không cần AI
- Tiết kiệm token, response instant (< 100ms)
- Normalize: lowercase + strip punctuation + collapse spaces

### 8.3 Tab Architecture
- **"Luyện viết"**: 3 modes active practice (gen → exercise → eval)
- **"Công cụ"**: Legacy tools (paste text → AI process)
- Giữ legacy tools vì vẫn hữu ích, chỉ reorganize vào tab riêng

### 8.4 Separate Store
- `writingStore.ts` (new) cho 3 modes luyện tập
- `writingToolsStore.ts` (legacy) cho Grammar/Paraphrase tools
- Tách riêng vì logic khác nhau hoàn toàn

---

## 9. Four Skills Practice System — COMPLETE 🎉

Tất cả 4 sub-projects đã hoàn thành:

| # | Sub-project | Status | Modules |
|---|-------------|--------|---------|
| 1 | Listening Upgrade | ✅ | Dictation, Fill-blank, Dialogue |
| 2 | Speaking | ✅ | Pronunciation, Shadowing |
| 3 | Reading | ✅ | Level Reading, Reading Aloud, Vocabulary Cache |
| 4 | Writing Upgrade | ✅ | Sentence Building, Paraphrase, Essay |

### Shared Infrastructure Built
- ✅ AI model fallback chain (5 models)
- ✅ Vocabulary cache system
- ✅ useSTT / useMediaRecorder / useTTS / useSpeechScore hooks
- ✅ Session management (save/resume/delete) cho tất cả 4 kỹ năng
- ✅ Batch generation (1-5 bài/session)
- ✅ WordPopup with portal rendering
- ✅ Real-time karaoke (Web Speech API)

### Pending Database Migrations
Cần chạy trên Supabase Dashboard (SQL Editor):
1. `supabase/migrations/20260401_listening_batch_sessions.sql`
2. `supabase/migrations/20260401_speaking_batch_sessions.sql`
3. `supabase/migrations/20260401_reading_batch_sessions.sql`
4. `supabase/migrations/20260401_vocabulary_cache.sql`
5. `supabase/migrations/20260401_writing_batch_sessions.sql`
