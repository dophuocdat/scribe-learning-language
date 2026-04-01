# Sub-Project 1: Foundation + Listening Upgrade — COMPLETED ✅

> **Date:** 2026-03-31 → 2026-04-01  
> **Status:** ✅ Completed  
> **Design Ref:** `docs/designs/2026-03-31-four-skills-practice-design.md` (Section 4)

---

## 1. Scope & Objectives

Sub-project 1 bao gồm:
1. ✅ DB migration (listening_batch_sessions)
2. ✅ Shared hooks (useSTT, useMediaRecorder, useSpeechScore)
3. ✅ Listening module refactor + 3 modes (Dictation, Fill-blank, Dialogue)
4. ✅ Navigation update (sidebar "Luyện nghe")
5. ✅ Session management (save/resume/delete, max 3 per mode)
6. ✅ Batch generation (user selects 1-5 exercises per session)

---

## 2. Components Built

### 2.1 Listening Module (`src/features/listening/`)

| File | Status | Description |
|------|--------|-------------|
| `pages/ListeningPage.tsx` | ✅ | Main page router (config → exercise → result) |
| `components/ListeningConfig.tsx` | ✅ | Mode/level/topic/batch-size selector + session list |
| `components/DictationExercise.tsx` | ✅ | Nghe chép — user gõ lại câu nghe được |
| `components/DictationResult.tsx` | ✅ | Kết quả dictation — highlight lỗi + linking rules |
| `components/FillBlankExercise.tsx` | ✅ | Điền từ — nghe full text, điền blanks |
| `components/FillBlankResult.tsx` | ✅ | Kết quả fill-blank — đúng/sai từng blank |
| `components/DialogueExercise.tsx` | ✅ | Hội thoại 2 người — MCQ/True-False questions |
| `components/DialogueResult.tsx` | ✅ | Kết quả dialogue comprehension |
| `components/AudioPlayer.tsx` | ✅ | TTS player với nút slow (0.7x) |
| `stores/listeningStore.ts` | ✅ | Zustand store — state, generate, evaluate, sessions |

### 2.2 Shared Hooks (`src/shared/hooks/`)

| File | Status | Description |
|------|--------|-------------|
| `useSTT.ts` | ✅ | Speech-to-Text (Web Speech API + HF Space fallback) |
| `useMediaRecorder.ts` | ✅ | Audio recording (MediaRecorder API) |
| `useSpeechScore.ts` | ✅ | Pronunciation scoring (Levenshtein + phonetic) |
| `useTTS.ts` | ✅ | Text-to-Speech (existing, enhanced) |

---

## 3. API Endpoints (Supabase Edge Function: `writing-api`)

### 3.1 Listening Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `generate-exercise` | POST | Generate dictation exercise (AI) |
| `evaluate-exercise` | POST | Chấm điểm dictation (AI + word-diff) |
| `generate-fill-blank` | POST | Generate fill-blank passage + blanks (AI) |
| `evaluate-fill-blank` | POST | Chấm điểm fill-blank (server-side, no AI) |
| `generate-dialogue` | POST | Generate 2-person dialogue + questions (AI) |
| `evaluate-dialogue` | POST | Chấm điểm dialogue comprehension (server-side) |
| `list-exercises` | POST | List user's saved exercises |
| `delete-exercise` | POST | Delete a saved exercise |

### 3.2 AI Model Fallback Chain

```
gemini-2.5-flash → gemma-3-27b-it → gemma-3-12b-it → gemini-2.0-flash → gemini-1.5-flash
```

- Auto-retry on 429 (rate limit) and 503 (overloaded)
- Supports multiple API keys (`GEMINI_API_KEY`, `GEMINI_API_KEY_2`)
- Gemma models: `responseMimeType` disabled (not supported)

### 3.3 JSON Robustness

`extractJson()` handles common Gemini/Gemma truncation issues:
- Unterminated strings
- Trailing commas
- Unmatched brackets/braces
- Wrapped in ` ```json ... ``` `

---

## 4. Database Schema

### 4.1 `listening_batch_sessions` (NEW)

```sql
CREATE TABLE listening_batch_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  mode          TEXT NOT NULL,           -- 'dictation' | 'fill_blank' | 'dialogue'
  exercise_type TEXT NOT NULL,
  level         TEXT NOT NULL,
  topic         TEXT DEFAULT 'General',
  batch_items   JSONB NOT NULL,          -- Array of exercises
  current_index INT DEFAULT 0,
  total_count   INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

- **RLS Policies**: Users can only CRUD their own sessions
- **Key**: `user_id DEFAULT auth.uid()` — auto-set on insert (no client-side user_id needed)
- **Limit**: Max 3 sessions per mode (enforced client-side)

### 4.2 Existing Tables (Unchanged)

- `listening_exercises` — Individual exercise history
- `user_profiles` — `max_daily_listening_exercises` column

---

## 5. Key Features

### 5.1 Batch Generation System
- User selects batch size (1-5) via UI buttons
- Frontend calls API N times in **parallel** (`Promise.allSettled`)
- Each call gets a unique `variation_index` + random scenario seed
- Variation system uses concrete scenario pools (28 settings × 12 character pairs)
- Higher temperature (0.9) for variation calls

### 5.2 Session Management
- Sessions auto-saved to DB on generation
- Resume: click "Tiếp tục" on saved session card
- Delete: click trash icon (with confirm dialog)
- Progress tracking: shows `current_index / total_count` with progress bar
- Max 3 sessions per mode — warning badge when limit reached

### 5.3 Fill-blank TTS Fix
- AI generates `full_text` field (complete passage without blanks)
- TTS reads `full_text` so user hears all words
- Fallback: reconstructs full text from `passage` + `blanks[].answer`

### 5.4 CORS Safety
- Entire `Deno.serve` handler wrapped in top-level try/catch
- All error responses include CORS headers
- Prevents browser CORS errors on function crashes

---

## 6. Bug Fixes & Issues Resolved

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | `generate-fill-blank-batch` unknown | Wrong endpoint name | Renamed to `generate-fill-blank` |
| 2 | `exercise_library` table not found | Non-existent table reference | Removed, use `listening_exercises` |
| 3 | JSON parse error on evaluate | Gemini truncated output | Enhanced `extractJson()` with repair logic |
| 4 | 42501 RLS policy violation on insert | Missing `user_id DEFAULT auth.uid()` | Added DEFAULT to column |
| 5 | Duplicate exercises in batch | Same prompt → same output | Added variation seeds + scenario pools |
| 6 | TTS skips blank words in fill-blank | Reading blanked passage | Added `full_text` field for TTS |
| 7 | CORS error on evaluate | Unhandled exception without CORS headers | Wrapped entire handler in try/catch |
| 8 | Delete session not working | Button hidden (`sm:opacity-0`) + no error checking | Made always visible + error handling |
| 9 | Dialogue not natural | No pause between speakers | Prompt tuned for natural speech |
| 10 | 429 rate limit no fallback | Single model only | Added 5-model fallback chain |

---

## 7. Files Changed (Summary)

### New Files
- `src/features/listening/` — Full module (8 components + store + page)
- `src/shared/hooks/useSTT.ts`
- `src/shared/hooks/useMediaRecorder.ts`
- `src/shared/hooks/useSpeechScore.ts`
- `supabase/migrations/20260401_listening_batch_sessions.sql`

### Modified Files
- `supabase/functions/writing-api/index.ts` — Added 6 listening endpoints + model fallback
- `src/App.tsx` — Added `/listening` route
- Sidebar navigation — Added "Luyện nghe" item

---

## 8. Deployment Checklist

- [x] `supabase functions deploy writing-api`
- [x] `npm run deploy` (Cloudflare Pages)
- [x] Run migration SQL on Supabase Dashboard
- [x] Set `GEMINI_API_KEY` in Supabase Edge Function secrets
- [ ] Optional: Set `GEMINI_API_KEY_2` for backup

---

## 9. Next: Sub-Project 2 (Speaking)

According to design doc Section 5, Sub-project 2 includes:
1. STT endpoint on HF Space (faster-whisper)
2. Speaking module (Pronunciation Check + Shadowing)
3. Role-play scenarios (DB + seed data)
4. Role-play chat (streaming Gemini)

**Dependencies from Sub-project 1 (already done):**
- ✅ `useSTT.ts` — Speech-to-Text hook
- ✅ `useMediaRecorder.ts` — Audio recording
- ✅ `useSpeechScore.ts` — Pronunciation scoring
- ✅ `useTTS.ts` — Text-to-Speech
- ✅ AI model fallback chain in `writing-api`
