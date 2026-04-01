# Sub-Project 2: Speaking Module (Pronunciation + Shadowing) — COMPLETED ✅

> **Date:** 2026-04-01  
> **Status:** ✅ Completed (Phase 1: Pronunciation + Shadowing)  
> **Design Ref:** `docs/designs/2026-03-31-four-skills-practice-design.md` (Section 5)  
> **Depends on:** Sub-Project 1 (Listening — completed)

---

## 1. Scope & Objectives

Sub-project 2 Phase 1 bao gồm:
1. ✅ HF Space STT endpoint (faster-whisper small, int8)
2. ✅ DB migration (`speaking_batch_sessions`)
3. ✅ Speaking API endpoints (generate + evaluate cho Pronunciation & Shadowing)
4. ✅ Speaking module UI (Config → Exercise → Result)
5. ✅ Pronunciation Check mode (S1)
6. ✅ Shadowing mode với speed control (S2)
7. ✅ Session management (save/resume/delete)
8. ✅ Microphone permission fix (Permissions-Policy header)

**Chưa triển khai (Phase 2):**
- ❌ AI Role-play (S3) — sẽ làm trong sub-project khác

---

## 2. Components Built

### 2.1 Speaking Module (`src/features/speaking/`)

| File | Status | Description |
|------|--------|-------------|
| `pages/SpeakingPage.tsx` | ✅ | Main page router (config → exercise → result) |
| `components/SpeakingConfig.tsx` | ✅ | Mode/level/topic/batch-size selector + session list |
| `components/PronunciationExercise.tsx` | ✅ | Đọc câu → Ghi âm → STT → Nộp bài |
| `components/PronunciationResult.tsx` | ✅ | Kết quả phát âm — word-level diff + IPA + tips |
| `components/ShadowingExercise.tsx` | ✅ | Nghe mẫu → Lặp lại → STT → Nộp bài + Speed controls |
| `components/ShadowingResult.tsx` | ✅ | Kết quả shadowing — accuracy + fluency scores |
| `stores/speakingStore.ts` | ✅ | Zustand store — state, generate, evaluate, sessions |

### 2.2 Shared Hooks (from Sub-project 1, reused)

| File | Usage |
|------|-------|
| `useSTT.ts` | Web Speech API (real-time preview) + HF Whisper (fallback) |
| `useMediaRecorder.ts` | Audio recording (always active, reliable capture) |
| `useTTS.ts` | Play model sentence (with speed control) |

---

## 3. API Endpoints (Supabase Edge Function: `writing-api`)

### 3.1 Speaking Endpoints (NEW)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `generate-pronunciation` | POST | Generate sentence + IPA + key sounds (AI) |
| `evaluate-pronunciation` | POST | Word-level pronunciation scoring (AI) |
| `generate-shadowing` | POST | Generate sentence + stress pattern + speed (AI) |
| `evaluate-shadowing` | POST | Accuracy + fluency scoring (AI) |

### 3.2 AI Prompt Design

**Pronunciation:**
- Tạo câu tự nhiên 8-20 từ theo CEFR level
- Focus vào âm khó cho người Việt: `/θ/`, `/ð/`, `/ʃ/`, `/ʒ/`, `/r/`, `/l/`, consonant clusters
- Output: `sentence`, `sentence_vi`, `phonetic_guide` (IPA), `key_sounds[]`, `difficulty_note_vi`

**Shadowing:**
- Tạo câu 10-25 từ với stress pattern tự nhiên
- Mark stressed words bằng UPPERCASE
- Estimate WPM speed
- Output: `sentence`, `stress_pattern`, `speed_wpm`, `phonetic_guide`, `key_sounds[]`

**Evaluation:**
- So sánh word-by-word giữa original và user transcript
- Pronunciation: score 0-100, IPA + tip_vi cho từ sai
- Shadowing: accuracy_score (60%) + fluency_score (40%) = overall_score

### 3.3 Variation System (reused from Sub-project 1)

- `buildVariationSeed()` sử dụng scenario pools (28 settings × 12 character pairs)
- Temperature 0.9 cho variation calls (index > 1)
- Đảm bảo batch items khác nhau khi user chọn >1 bài

---

## 4. HF Space — STT Endpoint

### 4.1 Changes to `tts-server/hf-space/`

| File | Changes |
|------|---------|
| `server.py` | + `/api/stt` endpoint (faster-whisper, small, int8, CPU) |
| `Dockerfile` | + `faster-whisper`, `python-multipart`, pre-download whisper model |

### 4.2 STT Architecture

```
Client                          HF Space
  │                                │
  │  POST /api/stt                 │
  │  Content-Type: multipart       │
  │  file: audio.webm              │
  │  lang: en                      │
  │──────────────────────────────▶│
  │                                │  faster-whisper (small, int8, CPU)
  │                                │  beam_size=5, vad_filter=true
  │                                │  ~3-5s for 10s audio
  │  ◀────────────────────────────│
  │  { text, language,             │
  │    language_probability,       │
  │    duration, processing_time } │
```

### 4.3 STT Fallback Strategy

```
┌─────────────────────────────────────────┐
│  Web Speech API (real-time, free)       │  ← Chrome/Edge desktop
│    ↓ fail silently                      │
│  MediaRecorder + HF Whisper             │  ← iOS Safari, mobile, Edge issues
│    ↓ fail                               │
│  Manual text input (fallback UI)        │  ← Worst case
└─────────────────────────────────────────┘
```

**Key design decision:** Luôn dùng MediaRecorder để ghi âm (reliable). Web Speech API chạy song song như bonus cho real-time preview. Nếu Web Speech fail → bỏ qua, vẫn có recording gửi Whisper.

---

## 5. Database Schema

### 5.1 `speaking_batch_sessions` (NEW)

```sql
CREATE TABLE speaking_batch_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  mode          TEXT NOT NULL CHECK (mode IN ('pronunciation', 'shadowing', 'roleplay')),
  exercise_type TEXT NOT NULL DEFAULT 'sentence',
  level         TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic         TEXT DEFAULT 'General',
  batch_items   JSONB NOT NULL DEFAULT '[]',
  current_index INT DEFAULT 0,
  total_count   INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

- **RLS Policies:** Users can only CRUD their own sessions
- **Same pattern** as `listening_batch_sessions`

---

## 6. Key Features

### 6.1 Pronunciation Check (S1)
- Hiện câu tiếng Anh + IPA + Vietnamese translation
- Key sounds guide: hiển thị âm khó + tip phát âm bằng tiếng Việt
- Nút "Nghe mẫu" (TTS) để nghe cách phát âm chuẩn
- Ghi âm → STT → AI chấm word-by-word
- Kết quả: score, từng từ đúng/sai + IPA + tip sửa

### 6.2 Shadowing (S2)
- Flow 3 bước: Nghe mẫu → Lặp lại → Kiểm tra
- **Speed controls:**
  - Nút "Nghe mẫu" (phát ở tốc độ đã chọn)
  - Nút "Nghe chậm" (luôn 0.6x)
  - Speed presets: 0.5x, 0.75x, 1x, 1.25x
- Text ẩn khi đang nghe/ghi (true shadowing experience)
- Hiện stress pattern sau lần nghe đầu
- Kết quả: accuracy_score (60%) + fluency_score (40%)

### 6.3 Recording Strategy (Cross-browser)
- **MediaRecorder:** Luôn bật — ghi audio cho Whisper STT
- **Web Speech API:** Optional song song — real-time transcript preview
- **Fallback UI:** Manual text input nếu cả 2 fail
- **Error handling:** `not-allowed` error bị suppress (không hiện cho user)

### 6.4 Batch & Session (same as Listening)
- Chọn batch size 1-5
- Parallel generation với `Promise.allSettled`
- Session auto-save, resume, delete

---

## 7. Bug Fixes & Issues Resolved

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | `callEdgeFunction` not found | Wrong import name | Changed to `invokeWritingApi` |
| 2 | Double mic request → Permission denied | Both Web Speech + MediaRecorder request mic | Use MediaRecorder only, Web Speech optional |
| 3 | `Permissions policy violation: microphone not allowed` | `_headers` file: `microphone=()` blocked mic | Changed to `microphone=(self)` |
| 4 | `not-allowed` error shown to user | Edge Web Speech API silently fails | Added `not-allowed` to silent error list |
| 5 | `isRecording` from MediaRecorder unused | Phase state sufficient for UI | Removed unused destructuring |
| 6 | `void` expression tested for truthiness | `stopRecording()` returns void, not Blob | Used useEffect + audioBlob state instead |
| 7 | Shadowing missing slow playback | No speed controls in UI | Added speed presets + "Nghe chậm" button |

---

## 8. Files Changed (Summary)

### New Files
```
src/features/speaking/
├── pages/SpeakingPage.tsx
├── components/
│   ├── SpeakingConfig.tsx
│   ├── PronunciationExercise.tsx
│   ├── PronunciationResult.tsx
│   ├── ShadowingExercise.tsx
│   └── ShadowingResult.tsx
└── stores/speakingStore.ts

supabase/migrations/20260401_speaking_batch_sessions.sql
```

### Modified Files
| File | Changes |
|------|---------|
| `supabase/functions/writing-api/index.ts` | +4 speaking endpoints + prompts + handlers |
| `src/app/App.tsx` | Added SpeakingPage import + `/speaking` route |
| `src/shared/hooks/useSTT.ts` | Added `not-allowed` to silent error list |
| `public/_headers` | `microphone=(self)` to allow mic access |
| `tts-server/hf-space/server.py` | Added `/api/stt` endpoint (faster-whisper) |
| `tts-server/hf-space/Dockerfile` | Added faster-whisper + pre-download model |

---

## 9. Deployment Checklist

- [x] `supabase functions deploy writing-api`
- [x] `npm run build` (zero TypeScript errors)
- [x] `npm run deploy` (Cloudflare Pages)
- [x] Push HF Space (`git push` to huggingface.co)
- [ ] Run migration SQL on Supabase Dashboard
- [ ] Verify HF Space rebuild complete (check /health endpoint)
- [ ] End-to-end test: Generate → Record → Evaluate → Result

---

## 10. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    SPEAKING MODULE                            │
│                                                              │
│  SpeakingConfig ───▶ PronunciationExercise ───▶ PronResult   │
│       │                                                      │
│       └───────────▶ ShadowingExercise ────────▶ ShadowResult │
│                         │                                    │
│                    Speed Controls                            │
│                    (0.5x-1.25x)                              │
└──────────────┬───────────────────────────────────────────────┘
               │
    ┌──────────▼──────────┐     ┌────────────────────┐
    │   speakingStore.ts  │────▶│  writing-api (Edge) │
    │   (Zustand)         │     │  generate-*         │
    │                     │     │  evaluate-*          │
    └──────────┬──────────┘     └────────────────────┘
               │
    ┌──────────▼──────────┐     ┌────────────────────┐
    │   MediaRecorder     │────▶│  HF Space           │
    │   + Web Speech API  │     │  /api/stt (Whisper)  │
    │   (useSTT +         │     │  /api/tts (Piper)    │
    │    useMediaRecorder) │     └────────────────────┘
    └─────────────────────┘
```

---

## 11. Next: Sub-Project 3 (Reading) or Speaking Phase 2

**Option A — Reading Module (Sub-project 3):**
- Reading comprehension exercises
- Vocabulary in context
- Speed reading challenges

**Option B — Speaking Phase 2 (Role-play):**
- AI Role-play chat (streaming Gemini)
- Scenario database + seed data
- Multi-turn conversation with AI evaluation
