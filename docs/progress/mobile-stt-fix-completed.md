# Mobile STT Fix — COMPLETED ✅

> **Date:** 2026-04-01  
> **Status:** ✅ Completed  
> **Scope:** Fix Speech-to-Text (STT) not working on Android mobile browsers

---

## 1. Problem Statement

STT (Speech-to-Text) không hoạt động trên Android mobile:
- Microphone không ghi âm được
- Không có transcript sau khi đọc
- Karaoke (Reading Aloud) đánh dấu toàn bộ "skipped" ngay khi bấm Stop
- Không có phản hồi lỗi cho user

---

## 2. Root Cause Analysis

### 2.1 Android Microphone Exclusive Access
> **Android OS chỉ cho phép 1 API truy cập microphone tại 1 thời điểm.**

Trong code cũ, 3 components đều gọi **đồng thời**:
```javascript
startRecording()    // MediaRecorder API (getUserMedia)
startListening()    // Web Speech API (SpeechRecognition)
```

Trên desktop: cả 2 API chia sẻ mic được → hoạt động bình thường.  
Trên Android: API thứ 2 bị từ chối mic → **cả 2 đều fail**.

### 2.2 getUserMedia Pre-request
Phiên bản fix đầu tiên thêm `getUserMedia()` trước `SpeechRecognition.start()` để trigger permission prompt. Nhưng điều này **gây thêm conflict** — Android không release mic kịp cho SpeechRecognition.

### 2.3 Karaoke Timing Issue
Khi user bấm Stop, code ngay lập tức đánh dấu tất cả từ chưa đọc là "skipped". Trên mobile (dùng Whisper), transcript chưa có (cần 2-3s) → tất cả bị "skipped" trước khi có kết quả.

### 2.4 Web Speech API Reliability on Mobile
Theo research trên nhiều nguồn:
- **Samsung Internet**: partial/no support
- **iOS Safari**: NOT supported
- **Chrome Android**: hoạt động nhưng bị conflict với MediaRecorder
- **PWA standalone mode**: thường bị lỗi permission

---

## 3. Solution Architecture

### 3.1 Platform-Specific STT Strategy

```
Desktop (Chrome/Edge/Firefox):
  ├── Web Speech API (real-time, free) ← cho karaoke live
  └── MediaRecorder (backup) → Whisper fallback

Mobile (Android/iOS):
  └── MediaRecorder ONLY → Stop → Whisper (HF Space) → Transcript
      ↑ Không dùng Web Speech API trên mobile
```

### 3.2 Key Design Decision
`useSTT.isSupported` = `isSpeechRecognitionSupported() && !isMobileDevice()`

→ Trên mobile, `isSupported = false` → **tất cả components tự động** chuyển sang MediaRecorder + Whisper path mà không cần sửa logic riêng.

### 3.3 Processing Phase (ReadingAloud)

```
TRƯỚC: reading → done (mark all skipped immediately)
SAU:   reading → processing (spinner, chờ Whisper) → done (karaoke matching)
```

---

## 4. Files Changed

### 4.1 Core Hook

#### `src/shared/hooks/useSTT.ts` — Rewritten
- Removed `getUserMedia` pre-request (gây conflict trên Android)
- `isSupported` = `false` on mobile → forces MediaRecorder path
- Export `isMobileDevice()` helper
- Removed async from `startListening` (không cần await getUserMedia)
- Auto-restart on `onend` for desktop continuous mode
- Clear Vietnamese error messages

### 4.2 Speaking Components

#### `src/features/speaking/components/PronunciationExercise.tsx`
- Simplified: always `startRecording()`, additionally `startListening()` only if `isSupported` (desktop)
- Removed `isMobileDevice` local check (handled by hook)

#### `src/features/speaking/components/ShadowingExercise.tsx`
- Same simplification as PronunciationExercise

### 4.3 Reading Component

#### `src/features/reading/components/ReadingAloud.tsx`
- Added `'processing'` phase between `'reading'` and `'done'`
- `handleStop`: 
  - Desktop (has transcript): mark skipped → done immediately
  - Mobile (no transcript): go to `'processing'` → wait for Whisper
- New `useEffect`: when Whisper returns in `'processing'` phase:
  - Run full karaoke matching on entire transcript
  - Mark correct/wrong/skipped
  - THEN transition to `'done'`
- Processing UI: large spinner + "Đang nhận dạng giọng nói..."

### 4.4 Headers

#### `public/_headers`
- `Permissions-Policy: microphone=(self)` → `microphone=(*)`
- More permissive for mobile browsers that interpret `(self)` strictly

---

## 5. Platform Behavior Matrix

| Feature | Desktop | Android Mobile | iOS |
|---------|---------|----------------|-----|
| STT Engine | Web Speech API | MediaRecorder → Whisper | MediaRecorder → Whisper |
| Real-time transcript | ✅ Yes | ❌ After stop | ❌ After stop |
| Real-time karaoke | ✅ Live | ❌ After processing | ❌ After processing |
| Latency | ~0ms | ~2-3s (Whisper) | ~2-3s (Whisper) |
| Mic permission | Auto-prompt | Auto-prompt | Auto-prompt |
| Cost | Free (browser) | Free (HF Space) | Free (HF Space) |

---

## 6. Mobile UX Flow (ReadingAloud)

```
┌──────────────────────────────────────────┐
│ 1. [⚫ Mic Button] "Nhấn để bắt đầu đọc" │
│                                          │
│ 2. [🔴 Recording] "Đang ghi âm — 0:15"  │
│    User đọc bài...                       │
│                                          │
│ 3. [⏳ Processing] "Đang nhận dạng..."   │
│    Spinner lớn, chờ Whisper (2-3s)       │
│    Karaoke text vẫn ở trạng thái "unread"│
│                                          │
│ 4. [✅ Done] Karaoke matching hoàn tất   │
│    ■ Xanh = đọc đúng                    │
│    ■ Đỏ = đọc sai                       │
│    ■ Vàng gạch = bỏ qua                 │
│    [Ghi âm lại] [Nộp bài]              │
└──────────────────────────────────────────┘
```

---

## 7. Dependencies

- **HF Space Whisper** (`https://kiro-d-scribe-tts.hf.space/api/stt`): Must be running (not sleeping)
- **MediaRecorder API**: Supported on all modern mobile browsers
- **HTTPS**: Required for mic access on all platforms

---

## 8. Known Limitations

1. **No real-time karaoke on mobile**: Android OS limitation — cannot use Web Speech API and MediaRecorder simultaneously
2. **2-3s delay after stop**: Whisper processing time on HF Space
3. **HF Space cold start**: If HF Space is sleeping, first request takes ~30s to wake up
4. **Samsung Internet**: May have issues with MediaRecorder — Chrome recommended

---

## 9. Research Sources

Key findings from web research:
- Android enforces exclusive microphone access (1 API at a time)
- `getUserMedia` and `SpeechRecognition` cannot coexist on mobile
- Industry standard: **MediaRecorder → Cloud STT** (most reliable)
- Web Speech API is considered "not production-ready" on mobile
- PWA standalone mode has additional permission limitations

Sources consulted:
- Chromium bug tracker (microphone sharing limitations)
- Stack Overflow (SpeechRecognition Android issues)
- MDN Web Docs (MediaRecorder API compatibility)
- AssemblyAI blog (mobile STT best practices)
- Reddit r/webdev (developer experience reports)
