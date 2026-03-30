# TTS Integration Design — Scribe Learning App (v3)

## 1. Bối cảnh & Phần cứng

### Phần cứng laptop local
| Spec | Value |
|------|-------|
| CPU | 3.81 GHz |
| RAM | 15.4 GB |
| GPU | AMD Radeon RX 5500M (4GB VRAM) |
| CUDA | ❌ Không hỗ trợ (AMD) |

### Hệ thống TTS hiện tại
- **Desktop**: Web Speech API — giọng robot
- **Mobile**: Google Translate TTS proxy — giới hạn 200 chars, phụ thuộc Google

---

## 2. Vấn đề GPU AMD & Giải pháp

> [!IMPORTANT]
> GPU AMD **không hỗ trợ CUDA**. Coqui TTS sẽ auto fallback sang CPU (`torch.cuda.is_available() → False → device="cpu"`).

### So sánh tốc độ Coqui models trên CPU

| Model | Loại | CPU Speed | Quality | Voice Clone | Ghi chú |
|-------|------|-----------|---------|-------------|---------|
| **XTTS v2** | Autoregressive | 🐌 30-60s/câu | ⭐⭐⭐⭐⭐ | ✅ | Quá chậm cho real-time, **tuyệt vời cho batch** |
| **VITS** (en/vctk) | Non-autoregressive | ⚡ 1-2s/câu | ⭐⭐⭐⭐ | ❌ | **Phù hợp real-time trên CPU** |
| **Tacotron2** | Autoregressive | 🐢 5-15s/câu | ⭐⭐⭐ | ❌ | Không khuyến nghị |

### Giải pháp: **Hybrid Coqui TTS**

```
┌─────────────────────────────────────────────────────┐
│              HYBRID COQUI TTS STRATEGY              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  OFFLINE (batch pre-generate):                      │
│  ┌─────────────────────────────────────┐            │
│  │ Coqui XTTS v2 (CPU, chậm nhưng     │            │
│  │ chất lượng cao nhất, voice cloning) │            │
│  │ → Generate WAV → Upload Supabase    │            │
│  └─────────────────────────────────────┘            │
│                                                     │
│  REAL-TIME (on-demand):                             │
│  ┌─────────────────────────────────────┐            │
│  │ Coqui VITS (CPU, 1-2s/câu,         │            │
│  │ chất lượng tốt, multi-speaker)     │            │
│  │ → FastAPI server trên localhost     │            │
│  └─────────────────────────────────────┘            │
│                                                     │
│  FALLBACK:                                          │
│  ┌─────────────────────────────────────┐            │
│  │ Google TTS proxy (existing)         │            │
│  │ → Web Speech API (emergency)        │            │
│  └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

---

## 3. Chi tiết triển khai

### 3.1 Coqui XTTS v2 — Batch Pre-generate (offline)

**Mục đích:** Generate audio chất lượng cao cho exercise library (dictation, vocabulary)

```python
# Chạy offline trên máy local — XTTS v2 trên CPU
from TTS.api import TTS

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")  # auto CPU

# Generate với voice cloning
tts.tts_to_file(
    text="The weather is beautiful today.",
    speaker_wav="voices/us_teacher.wav",   # reference audio 6-15s
    language="en",
    file_path="output/weather.wav"
)
```

- Mỗi câu mất ~30-60s trên CPU → chạy batch overnight
- Upload kết quả lên Supabase Storage
- Client check cache trước khi gọi real-time

### 3.2 Coqui VITS — Real-time Server (localhost)

**Mục đích:** Generate audio on-demand cho text người dùng mới gặp

```python
# FastAPI server chạy trên localhost:8100
# Model: tts_models/en/vctk/vits (multi-speaker, ~100 speakers)

from TTS.api import TTS

tts = TTS("tts_models/en/vctk/vits")  # auto CPU, ~1-2s/câu

# Multi-speaker: có ~100 giọng khác nhau
tts.tts_to_file(
    text="Hello world!",
    speaker="p225",    # female UK
    file_path="output.wav"
)
```

**VITS speakers phổ biến (en/vctk dataset):**
| Speaker ID | Giới tính | Accent | Ghi chú |
|-----------|-----------|--------|---------|
| p225 | Female | British | Rõ ràng, phù hợp learning |
| p226 | Male | British | Giọng nam ấm |
| p227 | Female | British | Phát âm chuẩn |
| p228 | Female | British | Trẻ trung |
| p230 | Female | British | Giọng trung tính |
| p232 | Male | British | Deep voice |
| p243 | Male | British | Rõ ràng |
| p245 | Male | Irish | Accent đa dạng |
| p248 | Female | British | Giọng ấm |

### 3.3 Fallback Chain

```
speak(text, accent, rate)
  │
  ├── ❶ Memory cache → HIT → play immediately
  │
  ├── ❷ Supabase Storage (pre-generated XTTS v2 audio)
  │     └── HIT → play + add to memory cache
  │
  ├── ❸ Local Coqui VITS server (localhost:8100)
  │     ├── SUCCESS → play + cache to memory
  │     └── TIMEOUT (>5s) / FAIL → continue
  │
  ├── ❹ Google TTS proxy (existing Supabase function)
  │     ├── SUCCESS → play
  │     └── FAIL → continue
  │
  └── ❺ Web Speech API (browser built-in, always works)
```

---

## 4. Voice Plan

### Mapping hệ thống

```typescript
export const VOICE_CONFIG = {
  // VITS speakers for real-time
  realtime: {
    'en-US': { model: 'vits', speaker: 'p243' },  // Male, clear
    'en-GB': { model: 'vits', speaker: 'p225' },  // Female, British
    'en-default': { model: 'vits', speaker: 'p225' },
  },
  // XTTS v2 pre-generated (từ Supabase Storage)
  pregenerated: {
    'en-US': { refVoice: 'us_teacher.wav' },
    'en-GB': { refVoice: 'uk_teacher.wav' },
  },
} as const
```

### Sử dụng theo feature

| Feature | Primary source | Fallback | Lý do |
|---------|---------------|----------|-------|
| Vocabulary cards | Pre-generated (XTTS v2) | VITS realtime | Từ cố định, pre-generate được |
| Dictation | Pre-generated (XTTS v2) | VITS realtime | Exercise library có sẵn |
| Comprehension | Pre-generated (XTTS v2) | VITS realtime | Passages cố định |
| Word Scramble | VITS realtime | Google TTS | Text ngắn, random |
| Flash Cards | Pre-generated (XTTS v2) | VITS realtime | Từ vựng cố định |
| User input text | VITS realtime | Google TTS | Text dynamic, cần nhanh |

---

## 5. Thay đổi cần thiết

### Backend — Local TTS Server [NEW]
| File | Mô tả |
|------|--------|
| `tts-server/server.py` | FastAPI server: VITS real-time (port 8100) |
| `tts-server/requirements.txt` | coqui-tts, fastapi, uvicorn |
| `tts-server/start.bat` | Script khởi động Windows |
| `tts-server/batch_generate.py` | Script batch generate bằng XTTS v2 |

### Backend — Supabase [MODIFY]
| File | Mô tả |
|------|--------|
| `supabase/functions/tts/index.ts` | Thêm check Coqui server trước Google TTS |

### Frontend [MODIFY]
| File | Mô tả |
|------|--------|
| `src/shared/hooks/useTTS.ts` | Thêm local VITS server + pre-generated cache vào fallback chain |
| `src/features/listening-practice/lib/ttsService.ts` | Thêm voice config mapping |

### Supabase Storage [NEW]
- Bucket `tts-cache`: audio pre-generated bằng XTTS v2
- Path: `tts-cache/{voice}/{text_hash}.wav`

---

## 6. Kế hoạch triển khai

### Phase 1: Cài đặt & Test Coqui TTS (ngày 1)
1. Cài Python venv + `coqui-tts` + PyTorch CPU
2. Test VITS model (`tts_models/en/vctk/vits`) → xác nhận tốc độ trên CPU
3. Test XTTS v2 trên CPU → xác nhận output quality
4. Chọn speakers phù hợp

### Phase 2: Local VITS Server (ngày 1-2)
1. Tạo FastAPI server wrapping VITS
2. API: `GET /api/tts?text=...&speaker=p225`
3. Test tốc độ response

### Phase 3: Frontend integration (ngày 2-3)
1. Update `useTTS.ts` fallback chain
2. Update `ttsService.ts` voice mapping
3. Test toàn bộ flow

### Phase 4: Batch pre-generate (ngày 3-4)
1. Tạo script batch generate bằng XTTS v2
2. Generate audio cho exercise library
3. Upload lên Supabase Storage
4. Frontend check cache trước

---

## Câu hỏi xác nhận

1. Bạn muốn bắt đầu **Phase 1** (cài Coqui TTS, test trên máy) ngay không?
2. Port `localhost:8100` cho VITS server ok không?
