# 🔊 Scribe TTS — Text-to-Speech System Documentation

> **Version:** 2.0 (Multi-Engine: Piper + VITS + XTTS v2)  
> **Updated:** 2026-03-30  
> **Author:** Scribe Team

---

## 📋 Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Hạ tầng & Deployment](#2-hạ-tầng--deployment)
3. [Server Backend (Python)](#3-server-backend-python)
4. [Frontend Integration (React)](#4-frontend-integration-react)
5. [User Settings & Database](#5-user-settings--database)
6. [Voice Catalog](#6-voice-catalog)
7. [API Reference](#7-api-reference)
8. [Caching Strategy](#8-caching-strategy)
9. [Voice Cloning (XTTS v2)](#9-voice-cloning-xtts-v2)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng quan kiến trúc

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)                                        │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │ ProfilePage │───▶│  ttsService  │───▶│     useTTS Hook   │   │
│  │ (Settings)  │    │  (constants) │    │  (audio playback) │   │
│  └─────────────┘    └──────────────┘    └────────┬──────────┘   │
│                                                  │              │
│  ┌─────────────┐    ┌──────────────┐             │              │
│  │ Vocabulary  │───▶│  speak(word) │─────────────┘              │
│  │ Listening   │    │  speakWord() │                            │
│  └─────────────┘    └──────────────┘                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP GET (audio/wav)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  TTS SERVER (FastAPI on HF Space / Local Docker)                │
│                                                                 │
│  ┌─────────────────────────────┐                                │
│  │ /api/tts-piper?voice=amy   │──▶ Piper Engine (ONNX)         │
│  │ /api/tts?speaker=p225      │──▶ Coqui VITS Engine           │
│  │ /api/tts-hq?voice=teacher  │──▶ XTTS v2 (local only)       │
│  └─────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

### Fallback Chain

Khi user click một từ vựng hoặc bài nghe, hệ thống thực hiện fallback 4 cấp:

```
❶ Primary TTS (Piper hoặc VITS tùy voice đã chọn)
    ↓ fail
❷ Google TTS Proxy (Supabase Edge Function)
    ↓ fail
❸ Web Speech API (browser built-in)
    ↓ fail
❹ Silent fail (log error)
```

---

## 2. Hạ tầng & Deployment

### 2.1 Cloud — Hugging Face Spaces

| Thuộc tính | Giá trị |
|-----------|---------|
| **URL** | `https://kiro-d-scribe-tts.hf.space` |
| **SDK** | Docker |
| **Tier** | Free (CPU only) |
| **Engines** | Piper + VITS |
| **Port** | 7860 |
| **Cold Start** | ~30s (khi Space ngủ) |

**Files:**
```
tts-server/hf-space/
├── Dockerfile          ← Docker build config
├── server.py           ← FastAPI server (Piper + VITS)
└── README.md           ← HF Space metadata
```

**Deploy workflow:**
```bash
# Clone HF repo
git clone https://huggingface.co/spaces/Kiro-D/scribe-tts hf-deploy-tmp

# Copy updated files
cp tts-server/hf-space/Dockerfile hf-deploy-tmp/
cp tts-server/hf-space/server.py hf-deploy-tmp/

# Push
cd hf-deploy-tmp
git add . && git commit -m "update" && git push origin main

# Cleanup
rm -rf hf-deploy-tmp
```

### 2.2 Local — Docker / Direct

| Thuộc tính | Giá trị |
|-----------|---------|
| **URL** | `http://localhost:8100` |
| **Engines** | Piper + VITS + **XTTS v2** |
| **GPU** | Có (nếu có CUDA) |
| **Port** | 8100 |

**Files:**
```
tts-server/
├── server.py           ← Full server (3 engines)
├── Dockerfile          ← Docker build
├── docker-compose.yml  ← Docker Compose config
├── start.bat           ← Windows start script
├── requirements.txt    ← Python dependencies
├── piper-voices/       ← Piper ONNX models
│   ├── en_US-amy-medium.onnx        (60 MB)
│   ├── en_US-amy-medium.onnx.json
│   ├── en_US-ryan-medium.onnx       (60 MB)
│   └── en_US-ryan-medium.onnx.json
├── voices/             ← XTTS v2 reference WAVs
│   ├── en_default.wav               (voice clone ref)
│   ├── fr_female.wav
│   └── ...
└── cache/              ← Generated audio cache
```

**Start:**
```bash
# Direct
cd tts-server
.\start.bat              # Windows
python server.py          # Any OS

# Docker
docker-compose up -d
```

---

## 3. Server Backend (Python)

### File: `tts-server/server.py` (Local) / `tts-server/hf-space/server.py` (Cloud)

### 3.1 Engine Loaders (Lazy-load)

Mỗi engine chỉ load model khi có request đầu tiên:

#### `get_piper_voice(name)` — Line 102
```python
def get_piper_voice(name: str):
    """Lazy-load a Piper ONNX voice model"""
```
- **Input:** `name` = "amy" hoặc "ryan"
- **Mapping:** `PIPER_VOICE_MAP` (line 97) map `"amy" → "en_US-amy-medium"`
- **Model path:** `piper-voices/en_US-amy-medium.onnx`
- **Caching:** Giữ instance trong dict `piper_voices` (line 91)
- **Load time:** ~1-3 giây

#### `get_vits_model()` — Line 124
```python
def get_vits_model():
    """Lazy-load VITS model (fast, multi-speaker English)"""
```
- **Model:** `tts_models/en/vctk/vits`
- **Load time:** ~5-10 giây
- **Speakers:** 109 giọng (p225...p376)

#### `get_xtts_model()` — Line 136 *(Local only)*
```python
def get_xtts_model():
    """Lazy-load XTTS v2 model (slow on CPU, best quality)"""
```
- **Model:** `tts_models/multilingual/multi-dataset/xtts_v2`  
- **Load time:** 30-60 giây
- **Size:** ~1.8 GB

### 3.2 Utility Functions

#### `text_hash(text, speaker)` — Line 148
```python
def text_hash(text: str, speaker: str = "") -> str:
    return hashlib.md5(f"{text}|{speaker}".encode()).hexdigest()[:12]
```
Tạo hash 12-char cho disk cache key.

#### `wav_to_streaming_response(wav_data, sample_rate)` — Line 153
Chuyển numpy array → WAV → `StreamingResponse`.

### 3.3 Endpoints

Chi tiết tại [Section 7 — API Reference](#7-api-reference).

---

## 4. Frontend Integration (React)

### 4.1 TTS Hook — `useTTS.ts`

**File:** `src/shared/hooks/useTTS.ts`

Đây là hook **trung tâm** xử lý toàn bộ audio playback trong app.

#### Constants (Line 17-33)

```typescript
const TTS_BASE = 'https://kiro-d-scribe-tts.hf.space'  // HF Space URL

const PIPER_VOICES = new Set(['amy', 'ryan'])  // Voices routed to /api/tts-piper

const VITS_SPEAKERS = {                        // Accent → VITS speaker fallback
  'en-US': 'p243',
  'en-GB': 'p225',
  'en-AU': 'p245',
  'en-default': 'p225',
}

const ttsUrlCache = new Map<string, string>()  // In-memory URL cache (max 200)
```

#### `getTTSUrl(text, accent, voice)` — Line 35

```typescript
function getTTSUrl(text: string, accent = 'en-US', voice?: string): string
```

**Routing logic:**
- Nếu `voice ∈ PIPER_VOICES` (amy, ryan) → `/api/tts-piper?text=...&voice=amy`
- Nếu `voice` khác (p225, p243...) → `/api/tts?text=...&speaker=p225`
- Nếu không có voice → dùng `VITS_SPEAKERS[accent]` fallback

#### `speak(text, rate?, accent?, voice?)` — Line 206

```typescript
const speak = useCallback(
  (text: string, rate?: number, accent?: string, voice?: string) => {
```

**Đây là function quan trọng nhất.** Flow:

1. **Auto-inject preferences:** Đọc `profile.tts_voice`, `profile.tts_accent`, `profile.tts_speed` từ Zustand store (`useAuthStore.getState()`)
2. **Cache check:** Kiểm tra `ttsUrlCache` (in-memory)
3. **Primary TTS:** Gọi `getTTSUrl()` → route đúng engine
4. **Fallback 1:** Google TTS Proxy (Supabase Edge Function)
5. **Fallback 2:** Web Speech API (browser)

**Cách hoạt động khi không truyền params:**
```typescript
// Vocabulary component chỉ gọi:
speak('hello')

// useTTS tự động:
// → profile.tts_voice = 'ryan'  → dùng ryan
// → profile.tts_accent = 'en-US' → dùng en-US
// → profile.tts_speed = 1.0 → speed 1x
// → getTTSUrl('hello', 'en-US', 'ryan')
// → /api/tts-piper?text=hello&voice=ryan ✅
```

#### `playUrl(url, rate, onFail?)` — Line 115

```typescript
const playUrl = useCallback(
  (url: string, rate: number = 1, onFail?: () => void) => {
```

Chơi audio từ URL. **CRITICAL:** `audio.play()` phải gọi đồng bộ từ user gesture (mobile browser policy).

#### `speakWithBrowserTTS(text, rate)` — Line 154

Fallback cuối cùng dùng `window.speechSynthesis`. Có iOS workaround (pause/resume mỗi 10s).

#### `speakWord(word, audioUrl, rate)` — Line 265

```typescript
const speakWord = useCallback(
  (word: string, audioUrl: string | null | undefined, rate: number = 1) => {
```

Smart speak cho từ vựng:
- Có `audioUrl` → play file audio (ưu tiên)
- Không có → gọi `speak(word)` (dùng TTS)
- **500ms cooldown** tránh spam click

#### Return values

```typescript
return { speak, playAudio, speakWord, isSpeaking, stop }
```

### 4.2 TTS Service — `ttsService.ts`

**File:** `src/features/listening-practice/lib/ttsService.ts`

Constants và types cho UI settings:

#### `VOICE_LIST` — Line 46

```typescript
export const VOICE_LIST: VoiceOption[] = [
  // Piper voices (natural, fastest ~0.3-0.5s)
  { id: 'amy',  engine: 'piper', label: 'Amy',  gender: 'F', accent: 'US',      desc: '...' },
  { id: 'ryan', engine: 'piper', label: 'Ryan', gender: 'M', accent: 'US',      desc: '...' },
  // VITS voices (109 voices, ~2-6s)
  { id: 'p225', engine: 'vits',  label: 'Emma',    gender: 'F', accent: 'British', desc: '...' },
  { id: 'p226', engine: 'vits',  label: 'Oliver',  gender: 'M', accent: 'British', desc: '...' },
  { id: 'p243', engine: 'vits',  label: 'James',   gender: 'M', accent: 'British', desc: '...' },
  { id: 'p232', engine: 'vits',  label: 'William', gender: 'M', accent: 'British', desc: '...' },
]
```

#### `VoiceOption` Interface — Line 36

```typescript
export interface VoiceOption {
  id: string        // Voice ID gửi lên server (amy, ryan, p225...)
  engine: TTSEngine  // 'piper' | 'vits'
  label: string      // Tên hiển thị (Amy, Ryan, Emma...)
  gender: 'M' | 'F'
  accent: string
  desc: string
}
```

#### `chunkText(text, maxLen)` — Line 65

Tách text dài thành chunks ≤ 450 ký tự, cắt tại ranh giới câu.

### 4.3 Profile Page — Voice Settings UI

**File:** `src/features/profile/pages/ProfilePage.tsx`

#### State (Line 44-60)

```typescript
// TTS Voice settings (persisted in database)
const [ttsVoice, setTtsVoice] = useState('p225')
const [ttsAccent, setTtsAccent] = useState('en-US')
const [ttsSpeed, setTtsSpeed] = useState(1)
```

Load từ profile khi mount (line 68-71):
```typescript
setTtsVoice(profile.tts_voice || 'p225')
setTtsAccent(profile.tts_accent || 'en-US')
setTtsSpeed(profile.tts_speed ?? 1)
```

#### Save (Line 93-110)

Gọi `updateProfile()` → save vào Supabase:
```typescript
await updateProfile({
  display_name: ...,
  tts_voice: ttsVoice,
  tts_accent: ttsAccent,
  tts_speed: ttsSpeed,
})
```

#### UI Components (Line 382-491)

- **Voice dropdown:** `VOICE_LIST.map()` — hiện 6 voices (2 Piper + 4 VITS)
- **Accent buttons:** 3 nút US/UK/AU
- **Speed slider:** 0.5x → 2.0x
- **Test button:** `speak('Hello!...', ttsSpeed, ttsAccent, ttsVoice)`
- **Engine badge:** Tự đổi "🎙️ Piper" / "🐸 VITS" tùy voice

---

## 5. User Settings & Database

### 5.1 Migration

```sql
-- Migration: add_tts_voice_settings
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tts_voice text DEFAULT 'p225',
  ADD COLUMN IF NOT EXISTS tts_accent text DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS tts_speed real DEFAULT 1.0;
```

### 5.2 TypeScript Type

**File:** `src/shared/types/database.ts` — `UserProfile` interface (Line 250)

```typescript
export interface UserProfile {
  // ... other fields
  tts_voice: string    // 'amy', 'ryan', 'p225', etc.
  tts_accent: string   // 'en-US', 'en-GB', 'en-AU'
  tts_speed: number    // 0.5 - 2.0
}
```

### 5.3 Auth Store

**File:** `src/features/auth/stores/authStore.ts` — Line 23

```typescript
updateProfile: (data: Partial<Pick<UserProfile,
  'display_name' | 'avatar_url' | 'target_exam' | 'target_score' |
  'daily_goal_minutes' | 'tts_voice' | 'tts_accent' | 'tts_speed'
>>) => Promise<boolean>
```

### 5.4 Data Flow

```
ProfilePage (UI)
    │ setTtsVoice('ryan')
    │ handleSave()
    ▼
authStore.updateProfile({ tts_voice: 'ryan' })
    │
    ▼
Supabase DB: user_profiles.tts_voice = 'ryan'
    │
    ▼
authStore.fetchProfile() → profile.tts_voice = 'ryan'
    │
    ▼
useTTS.speak('word') → reads useAuthStore.getState().profile.tts_voice
    │
    ▼
getTTSUrl('word', 'en-US', 'ryan') → /api/tts-piper?voice=ryan
```

---

## 6. Voice Catalog

### Curated Voices (hiển thị cho user)

| # | ID | Engine | Label | Gender | Accent | Speed (CPU) |
|---|-----|--------|-------|--------|--------|-------------|
| 1 | `amy` | ⚡ Piper | Amy | 👩 F | US | ~0.5s |
| 2 | `ryan` | ⚡ Piper | Ryan | 👨 M | US | ~0.3s |
| 3 | `p225` | 🐸 VITS | Emma | 👩 F | British | ~2-6s |
| 4 | `p226` | 🐸 VITS | Oliver | 👨 M | British | ~2-6s |
| 5 | `p243` | 🐸 VITS | James | 👨 M | British | ~2-6s |
| 6 | `p232` | 🐸 VITS | William | 👨 M | British | ~2-6s |

### All VITS Speakers (109 total)

p225 – p376 (xem `/api/voices` endpoint để liệt kê đầy đủ)

### Piper Model Files

```
piper-voices/
├── en_US-amy-medium.onnx        60 MB   (Piper ONNX model)
├── en_US-amy-medium.onnx.json   1 KB    (Config: sample_rate=22050)
├── en_US-ryan-medium.onnx       60 MB
└── en_US-ryan-medium.onnx.json  1 KB
```

**Source:** https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US

---

## 7. API Reference

### Base URLs

| Environment | URL |
|-------------|-----|
| Cloud | `https://kiro-d-scribe-tts.hf.space` |
| Local | `http://localhost:8100` |

### `GET /api/tts-piper` — Piper TTS

**Engine:** Piper (ONNX-based VITS)  
**Speed:** ⚡ 0.3-0.5s

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | string | *required* | Text to synthesize (max 1000 chars) |
| `voice` | string | `amy` | Voice name: `amy`, `ryan` |

**Example:**
```
GET /api/tts-piper?text=Hello%20world&voice=ryan
→ audio/wav (16-bit PCM mono, 22050 Hz)
```

### `GET /api/tts` — Coqui VITS

**Engine:** Coqui TTS (VITS)  
**Speed:** 2-6s

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | string | *required* | Text (max 500 chars) |
| `speaker` | string | `p225` | VITS speaker ID |
| `speed` | float | `1.0` | Speed (0.5-2.0) |

**Example:**
```
GET /api/tts?text=Hello&speaker=p243
→ audio/wav (float32, 22050 Hz)
```

### `GET /api/tts-hq` — XTTS v2 *(Local only)*

**Engine:** XTTS v2 (voice cloning)  
**Speed:** 🐌 30-60s (CPU)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `text` | string | *required* | Text (max 1000 chars) |
| `lang` | string | `en` | Language code |
| `voice` | string | *null* | Voice name from `voices/` folder |
| `speaker_wav` | string | *null* | Full path to reference WAV |
| `speaker` | string | *null* | Built-in XTTS speaker name |

**Voice priority:** `voice` → `speaker_wav` → `{lang}_default.wav` → built-in

### `GET /api/voices` — List All Voices

Returns Piper + VITS voice listing.

### `GET /api/clone-voices` — List Clone References *(Local only)*

Lists WAV files in `voices/` directory available for XTTS v2 cloning.

### `GET /health` — Health Check

Returns server status, loaded models, device info.

---

## 8. Caching Strategy

### 8.1 Server-side Disk Cache

**Location:** `tts-server/cache/`

| Engine | Cache File Pattern | Example |
|--------|-------------------|---------|
| Piper | `piper_{hash}.wav` | `piper_a1b2c3d4e5f6.wav` |
| VITS | `vits_{hash}.wav` | `vits_f6e5d4c3b2a1.wav` |
| XTTS | `xtts_{hash}.wav` | `xtts_1a2b3c4d5e6f.wav` |

Hash = `MD5(text + "|" + speaker)[:12]`

Cache hit → trả file trực tiếp, không cần inference.

### 8.2 Client-side In-Memory Cache

**Location:** `useTTS.ts` — `ttsUrlCache` (Map, max 200 entries)

- Key: `{accent}{voice}:{text[:100]}`
- Value: Full URL
- Giúp tránh tạo URL trùng lặp
- LRU eviction khi > 200 entries

### 8.3 HTTP Cache

Tất cả response có header: `Cache-Control: public, max-age=86400` (24h)

---

## 9. Voice Cloning (XTTS v2)

> ⚠️ **Chỉ chạy local** — quá chậm cho cloud free tier.

### Thêm giọng mới

1. Ghi âm 6-10 giây giọng rõ ràng
2. Save file `.wav` (mono, 22050/24000 Hz)
3. Đặt vào `tts-server/voices/`

### Naming Convention

| Filename | Ý nghĩa |
|----------|---------|
| `my_teacher.wav` | Gọi bằng `?voice=my_teacher` |
| `en_default.wav` | Auto-dùng cho `?lang=en` (không cần chỉ voice) |
| `vi_default.wav` | Auto-dùng cho `?lang=vi` |

### Usage

```bash
# Clone specific voice
curl "http://localhost:8100/api/tts-hq?text=Hello&lang=en&voice=my_teacher"

# Use language default
curl "http://localhost:8100/api/tts-hq?text=Hello&lang=en"
# → auto uses voices/en_default.wav

# List available voices
curl "http://localhost:8100/api/clone-voices"
```

---

## 10. Troubleshooting

### HF Space trả 503 / timeout

**Nguyên nhân:** Space đang ngủ (idle > 48h)  
**Fix:** Truy cập `https://kiro-d-scribe-tts.hf.space/health` → chờ ~30s warm up

### Giọng đọc không đổi sau khi save settings

**Nguyên nhân:** `useTTS` cache in-memory đang giữ URL cũ  
**Fix:** Reload trang (`Ctrl+F5`) để clear cache

### VITS lỗi "No espeak backend found"

**Nguyên nhân:** Thiếu `espeak-ng`  
**Fix (Windows):** Cài từ https://github.com/espeak-ng/espeak-ng/releases  
**Fix (Linux):** `apt install espeak-ng`

### Piper lỗi "model not found"

**Nguyên nhân:** File ONNX chưa tải  
**Fix:** Tải từ HuggingFace:
```bash
cd tts-server/piper-voices
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
```

### Mobile không phát audio

**Nguyên nhân:** Browser mobile chặn autoplay  
**Fix:** `audio.play()` phải được gọi đồng bộ từ user tap event. Xem `playUrl()` trong `useTTS.ts` line 115.

---

## File Index

| File | Mô tả |
|------|-------|
| `src/shared/hooks/useTTS.ts` | ⭐ Core TTS hook — fallback chain, audio playback |
| `src/features/listening-practice/lib/ttsService.ts` | Voice list, accent presets, text chunking |
| `src/features/profile/pages/ProfilePage.tsx` | Voice settings UI |
| `src/features/auth/stores/authStore.ts` | Profile update (includes TTS fields) |
| `src/shared/types/database.ts` | UserProfile type (tts_voice, tts_accent, tts_speed) |
| `tts-server/server.py` | Local TTS server (Piper + VITS + XTTS v2) |
| `tts-server/hf-space/server.py` | Cloud TTS server (Piper + VITS) |
| `tts-server/hf-space/Dockerfile` | Docker build for HF Space |
| `tts-server/docker-compose.yml` | Local Docker setup |
| `tts-server/piper-voices/` | Piper ONNX model files |
| `tts-server/voices/` | XTTS v2 voice reference WAVs |
| `tts-server/cache/` | Server-side audio cache |
