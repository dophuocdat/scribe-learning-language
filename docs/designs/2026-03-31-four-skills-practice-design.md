# Four Skills Practice System — Design Document

> **Date:** 2026-03-31  
> **Status:** Draft → Awaiting Approval  
> **Scope:** Redesign Listening/Writing → 4 kỹ năng: Nghe · Nói · Đọc · Viết  
> **Replaces:** `listening-practice/` (partial), `writing-tools/` (partial)

---

## 1. Executive Summary

Chuyển đổi hệ thống luyện tập từ **2 features rời rạc** (Listening Practice + Writing Tools) thành **4 feature modules** hoàn chỉnh theo chuẩn ngôn ngữ quốc tế CEFR:

| Module | Route | Icon | Trạng thái |
|--------|-------|------|-----------|
| 🎧 Listening | `/listening` | `Headphones` | Cải tiến từ code hiện tại |
| 🎙️ Speaking | `/speaking` | `Mic` | Mới hoàn toàn |
| 📖 Reading | `/reading` | `BookOpenText` | Mới hoàn toàn |
| ✍️ Writing | `/writing` | `PenTool` | Cải tiến từ code hiện tại |

### Decisions Made (from brainstorming)

| Quyết định | Chọn | Lý do |
|---|---|---|
| Kiến trúc | 4 feature modules riêng biệt | Clean architecture, build incremental |
| STT Engine | Web Speech API (MVP) + Whisper trên HF Space (production) | Free MVP, chất lượng cao production |
| STT Deployment | Gộp vào HF Space TTS hiện tại (`faster-whisper`) | Cùng pattern, tiết kiệm resource |
| Role-play latency | Streaming Gemini + Filler words + TTS partial | ~3.5s thay vì 7s |
| Role-play audio | Audio Queue System (pre-buffer) | Tránh ngắt quãng giữa các câu |
| Recording UX | Tap-to-Talk (không Hold) | Tương thích mobile, tránh OS gesture conflict |
| DB optimization | Reference ID thay vì duplicate JSONB | Tránh tràn RAM skill_attempts |
| TTS | Sử dụng hệ thống Coqui VITS/Piper hiện tại | Đã ổn định |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │  listening/ │ │  speaking/ │ │  reading/  │ │  writing/  │    │
│  │  - store    │ │  - store   │ │  - store   │ │  - store   │    │
│  │  - pages    │ │  - pages   │ │  - pages   │ │  - pages   │    │
│  │  - comps    │ │  - comps   │ │  - comps   │ │  - comps   │    │
│  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └──────┬─────┘    │
│         │              │              │              │            │
│  ┌──────┴──────────────┴──────────────┴──────────────┴──────┐    │
│  │                    shared/                                │    │
│  │  hooks/useTTS.ts  hooks/useSTT.ts  hooks/useSpeechScore  │    │
│  │  lib/edgeFunctions.ts                                     │    │
│  └──────────────────────────┬────────────────────────────────┘    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
  │  HF Space    │  │  Supabase    │  │  Supabase        │
  │  TTS + STT   │  │  Edge Func   │  │  Database        │
  │  Server      │  │  (writing-   │  │  (PostgreSQL)    │
  │              │  │   api)       │  │                  │
  │  /api/tts    │  │              │  │  skill_sessions  │
  │  /api/tts-   │  │  Gemini 2.5  │  │  skill_attempts  │
  │    piper     │  │  Flash AI    │  │  reading_articles│
  │  /api/stt    │  │              │  │  ...             │
  │  (NEW)       │  │              │  │                  │
  └──────────────┘  └──────────────┘  └──────────────────┘
```

---

## 3. HF Space — STT Integration (Mở rộng TTS Server)

### 3.1 Thêm endpoint `/api/stt` vào server hiện tại

```python
# Thêm vào server.py hiện tại

from faster_whisper import WhisperModel

stt_model = None

def get_stt_model():
    global stt_model
    if stt_model is None:
        logger.info("Loading faster-whisper (small)...")
        stt_model = WhisperModel("small", device="cpu", compute_type="int8")
        logger.info("STT model loaded!")
    return stt_model

@app.post("/api/stt")
async def speech_to_text(file: UploadFile = File(...), lang: str = "en"):
    """🎙️ Speech-to-Text — faster-whisper (small, int8)"""
    audio_bytes = await file.read()
    
    # Save temp file
    tmp = Path(f"/tmp/stt_{text_hash(str(len(audio_bytes)))}.wav")
    tmp.write_bytes(audio_bytes)
    
    model = get_stt_model()
    segments, info = model.transcribe(str(tmp), language=lang)
    text = " ".join(s.text.strip() for s in segments)
    
    tmp.unlink(missing_ok=True)
    
    return {"text": text, "language": info.language, "duration": info.duration}
```

### 3.2 Model Selection

| Model | Size | Speed (CPU) | Accuracy | RAM |
|-------|------|-------------|----------|-----|
| `tiny` | 39MB | ~1s | 70% | +200MB |
| `base` | 74MB | ~2s | 75% | +300MB |
| **`small`** | **244MB** | **~3s** | **82%** | **+500MB** |
| `medium` | 769MB | ~8s | 88% | +1.5GB |

**Chọn: `small` + `int8` quantization** — cân bằng accuracy/speed cho free CPU tier.

### 3.3 Dockerfile updates

```dockerfile
# Thêm vào Dockerfile hiện tại
RUN pip install faster-whisper python-multipart

# Pre-download model
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
```

### 3.4 Frontend STT Hook (`useSTT`)

```typescript
// shared/hooks/useSTT.ts
// Chiến lược: Web Speech API (primary) → HF Space Whisper (fallback/production)

export function useSTT() {
  // isSupported: check browser support
  // startListening(lang): Web Speech API real-time
  // transcribeAudio(blob, lang): POST to HF Space /api/stt
  // stopListening()
  // transcript: string (real-time)
  // isListening: boolean
}
```

---

## 4. KỸ NĂNG NGHE (LISTENING) — `/listening`

> **Module:** `src/features/listening/`  
> **Cải tiến từ:** `src/features/listening-practice/` hiện tại  
> **Giữ lại:** Store pattern, ExerciseConfig, batch system, writing-api endpoints

### 4.1 Feature Map

| # | Feature | Mô tả | Reuse |
|---|---------|-------|-------|
| L1 | **Dictation** (Nghe chép) | AI đọc → user gõ lại → AI bôi đỏ lỗi + giải thích nối âm | ✅ 80% reuse |
| L2 | **Fill-in-the-blanks** (Điền từ) | AI ẩn từ khóa → user nghe và điền | 🆕 Mới |
| L3 | **Comprehension** (Nghe hiểu hội thoại) | Hội thoại 2-3 người → MCQ/True-False | ⚡ Cải tiến lớn |

### 4.2 Cải tiến so với hiện tại

**L1 — Dictation (cải tiến):**
- ✅ Giữ nguyên: flow generate → exercise → evaluate → result
- 🆕 Thêm nút **"Nghe chậm"** (tốc độ 0.6x, sử dụng `playbackRate`)
- 🆕 Khi sai: AI giải thích **luật nối âm** (linking words). VD: "want to" → nghe như "wanna"
- 🆕 Prompt AI thêm field `linking_rules` trong evaluation response

**L2 — Fill-in-the-blanks (mới):**
- AI generate đoạn văn + ẩn N từ khóa (động từ, giới từ, từ mới)
- UI: đoạn text với `___` blanks, mỗi blank là 1 input
- User nghe audio toàn bộ đoạn → điền từng từ
- AI evaluate: đúng/sai từng blank + gợi ý

**L3 — Comprehension hội thoại (cải tiến lớn):**
- 🆕 **Multi-voice dialogue**: Dùng 2 giọng TTS khác nhau (amy + ryan) để tạo hội thoại 2 người
- AI generate: scenario (VD: "Đặt phòng khách sạn") + dialogue + 3-5 câu hỏi MCQ/True-False
- UI: Audio player với avatar 2 người + transcript toggle
- Sau khi nghe: trả lời câu hỏi → AI chấm

### 4.3 Data Flow

```
Config Screen                    Exercise Screen
┌─────────────┐                 ┌──────────────────────┐
│ Mode:       │                 │ [▶ Play] [🐌 Slow]   │
│ ○ Dictation │    Start        │                      │
│ ○ Fill-blank│ ──────────→     │ 📝 Input area        │
│ ○ Dialogue  │                 │                      │
│             │                 │ [Submit]              │
│ Level: B1   │                 └──────────┬───────────┘
│ Topic: ...  │                            │
└─────────────┘                            ▼
                                ┌──────────────────────┐
                                │ Result Screen        │
                                │ Score: 85% ✅        │
                                │ 🔴 Errors highlighted│
                                │ 📖 Linking rules     │
                                │ [Next] [Retry]       │
                                └──────────────────────┘
```

### 4.4 Component Structure

```
src/features/listening/
├── pages/
│   └── ListeningPage.tsx              # Main page (rename from ListeningPracticePage)
├── components/
│   ├── ListeningConfig.tsx            # Config (refactor from ExerciseConfig)
│   ├── DictationExercise.tsx          # ✅ Keep + enhance
│   ├── DictationResult.tsx            # ✅ Keep + enhance  
│   ├── FillBlankExercise.tsx          # 🆕 New
│   ├── FillBlankResult.tsx            # 🆕 New
│   ├── DialogueExercise.tsx           # 🆕 New (multi-voice)
│   ├── DialogueResult.tsx             # 🆕 New
│   ├── AudioPlayer.tsx                # ✅ Keep
│   └── LinkingRuleCard.tsx            # 🆕 Giải thích nối âm
├── stores/
│   └── listeningStore.ts             # Refactor from listeningPracticeStore
└── lib/
    └── dialogueBuilder.ts            # Build multi-voice audio sequence
```

### 4.5 Multi-Voice Dialogue Builder

```typescript
// lib/dialogueBuilder.ts
// Tạo audio sequence từ dialogue bằng 2 giọng TTS khác nhau

interface DialogueLine {
  speaker: 'A' | 'B'
  text: string
}

// Speaker A = amy (female), Speaker B = ryan (male)
// Build: fetch TTS cho từng line → concatenate → single audio blob
async function buildDialogueAudio(lines: DialogueLine[]): Promise<Blob> {
  const audioBuffers = await Promise.all(
    lines.map(line => {
      const voice = line.speaker === 'A' ? 'amy' : 'ryan'
      return fetchTTSAudio(line.text, voice)
    })
  )
  return concatenateAudio(audioBuffers, pauseBetween: 800) // 800ms pause
}
```

---

## 5. KỸ NĂNG NÓI (SPEAKING) — `/speaking`

> **Module:** `src/features/speaking/` — MỚI HOÀN TOÀN  
> **Phụ thuộc:** `useSTT` hook, `useTTS` hook, Gemini AI

### 5.1 Feature Map

| # | Feature | Mô tả | Độ phức tạp |
|---|---------|-------|------------|
| S1 | **Pronunciation Check** (Kiểm tra phát âm) | User đọc câu → STT → so sánh → bôi đỏ âm sai | Trung bình |
| S2 | **Shadowing** (Nhại giọng) | AI đọc mẫu → User đọc theo → chấm fluency | Trung bình |
| S3 | **AI Role-play** (Gọi điện với AI) | Hội thoại real-time User↔AI | Cao |

### 5.2 Feature Details

**S1 — Pronunciation Check:**

```
Flow: AI hiện câu → 🔊 Play mẫu → 🎙️ User đọc → STT bóc text
      → So sánh word-by-word → Bôi đỏ từ sai → Hiện hướng dẫn phát âm
```

- AI generate câu theo level + topic
- User bấm 🎙️ Record → Web Speech API / Whisper STT
- **So sánh algorithm:** Levenshtein + phonetic similarity
  - "Think" vs "Tink" → bôi đỏ "Th" → hiện: "Đặt lưỡi giữa 2 hàm răng"
- 🆕 **Pronunciation guide**: Mỗi âm sai → hiện IPA + mô tả cách phát âm bằng tiếng Việt
- Score: similarity ≥ 85% = Pass

**S2 — Shadowing (Nhại giọng):**

```
Flow: 🔊 AI đọc mẫu (với ngữ điệu) → User nghe → 🎙️ User đọc theo
      → STT bóc text → AI đánh giá fluency + accuracy
```

- AI generate câu + đánh dấu stress/intonation pattern
- User record → STT → gửi text cho Gemini đánh giá
- Gemini evaluate: 
  - **Accuracy** (đúng từ): word-level comparison
  - **Fluency** (trôi chảy): phân tích ngập ngừng, lặp từ
- Score hiển thị: Accuracy 85% | Fluency 70%

**S3 — AI Role-play (Gọi điện với AI) — ⭐ Feature "Sát thủ":**

```
┌──────────── ROLE-PLAY UI ────────────────┐
│                                          │
│  📞 Đang gọi: Barista tại Coffee Shop   │
│  ──────────────────────────────────       │
│                                          │
│  ☕ AI: "Hi! Welcome to Scribe Coffee.   │
│         What can I get for you today?"   │
│                                          │
│  👤 You: [Live transcript here...]       │
│                                          │
│  ┌───────────────────────────────────┐   │
│  │    🎙️  Tap to Talk               │   │
│  │    (Bấm 1 lần = bắt đầu thu)     │   │
│  │    (Bấm lần nữa = gửi)           │   │
│  └───────────────────────────────────┘   │
│                                          │
│  💡 Gợi ý: "I'd like a latte, please"   │
│                                          │
│  [Kết thúc cuộc gọi]                    │
└──────────────────────────────────────────┘

> ⚠️ **Tại sao Tap-to-Talk thay vì Hold-to-Talk?**
> Trên mobile browser (đặc biệt iOS Safari), giữ nút (touch/hold) xung đột với OS gestures (bôi đen text, context menu, vuốt màn hình). "Tap to Talk → Tap to Send" an toàn và dễ code hơn trên mọi nền tảng.
```

**Scenarios (AI generate theo level):**

| Level | Scenario | AI Role | User Role |
|-------|----------|---------|-----------|
| A1 | Mua café | Barista | Khách |
| A1 | Chào hỏi | Bạn mới | Bạn |
| A2 | Đặt phòng KS | Lễ tân | Khách |
| B1 | Phỏng vấn xin việc | HR Manager | Ứng viên |
| B2 | Thảo luận tin tức | Đồng nghiệp | Đồng nghiệp |

**Technical Flow (Streaming):**

```
1. User tap 🎙️ (nút chuyển đỏ + sóng âm animation)
   → Browser bắt đầu record (MediaRecorder)

2. User tap lần nữa (gửi)
   → Audio blob → POST /api/stt (HF Space)
   → Nhận transcript text (~2s)
   
3. Trong lúc chờ STT:
   → Phát filler audio: "Hmm..." / "Let me see..." (pre-cached)
   → Hiện "AI is thinking..."
   
4. Transcript → Gửi cho Gemini (streaming)
   → System prompt: role + scenario + conversation history
   → **QUAN TRỌNG**: Prompt phải ép AI trả lời ngắn (1-2 câu)
   → Gemini stream response

5. Khi nhận được câu (đến dấu chấm):
   → Push vào Audio Queue → Gọi TTS chạy ngầm → Lưu blob vào queue
   → AudioQueueManager lần lượt play
   → Nếu queue rỗng giữa chừng → chèn filler tự động

6. Sau mỗi lượt:
   → Hiện transcript cả 2 bên
   → AI gợi ý cách nói hay hơn (nếu user nói sai)
```

**Audio Queue System (Giải quyết Audio Queuing):**

> ⚠️ **Vấn đề:** Khi cắt câu LLM gửi TTS, nếu mạng/TTS phản hồi không đều → câu 1 xong, câu 2 chưa render → ngắt quãng "robot".

```typescript
// lib/audioQueueManager.ts
class AudioQueueManager {
  private queue: AudioBuffer[] = []
  private isPlaying = false
  private fillerAudios: AudioBuffer[] = [] // Pre-cached

  // LLM Stream → tách câu → push vào Array
  enqueue(audioBlob: Blob) {
    this.queue.push(audioBlob)
    if (!this.isPlaying) this.playNext()
  }

  private async playNext() {
    if (this.queue.length === 0) {
      // Queue rỗng → chèn filler (tiếng thở, "hmm")
      this.playFiller()
      return
    }
    this.isPlaying = true
    const audio = this.queue.shift()!
    await playAudioBlob(audio)
    this.isPlaying = false
    this.playNext() // Tiếp tục
  }

  private playFiller() {
    // Random pick filler → play → check queue lại
    const filler = this.fillerAudios[Math.random() * this.fillerAudios.length | 0]
    playAudioBlob(filler).then(() => {
      if (this.queue.length > 0) this.playNext()
    })
  }
}
```

**Flow hoàn chỉnh:**
```
LLM Stream → Tách câu (đến dấu chấm) → Push vào Array
  → Gọi TTS chạy ngầm cho câu đó → Lưu Audio Blob vào Queue
  → AudioQueueManager lần lượt play từ Queue
  → Nếu Queue rỗng → tự chèn filler (tiếng thở/"hmm") thay vì im lặng
```

**Filler Words System:**
```typescript
// Pre-cached audio files (generated 1 lần khi app load)
const FILLERS = [
  { text: "Hmm...", voice: "amy", duration: 1200 },
  { text: "Well, let me think...", voice: "amy", duration: 1800 },
  { text: "That's interesting...", voice: "ryan", duration: 1500 },
  { text: "Oh, I see...", voice: "amy", duration: 1200 },
]
```

**Post-conversation Analysis:**
- Sau khi kết thúc cuộc gọi, Gemini phân tích toàn bộ conversation:
  - Vocabulary used (đa dạng?)
  - Grammar accuracy
  - Response time trung bình
  - Gợi ý cải thiện
  - Highlight câu hay / câu cần sửa

### 5.3 Component Structure

```
src/features/speaking/
├── pages/
│   └── SpeakingPage.tsx
├── components/
│   ├── SpeakingConfig.tsx             # Chọn mode + level + topic
│   ├── PronunciationCheck.tsx         # S1: Đọc câu + check phát âm
│   ├── PronunciationResult.tsx        # Kết quả: bôi đỏ âm sai
│   ├── PronunciationGuide.tsx         # Hướng dẫn phát âm từng âm
│   ├── ShadowingExercise.tsx          # S2: Nghe + đọc theo
│   ├── ShadowingResult.tsx            # Score fluency + accuracy
│   ├── RolePlayChat.tsx               # S3: UI hội thoại (main)
│   ├── RolePlaySetup.tsx              # Chọn scenario
│   ├── PromptTunerChat.tsx            # DEV TOOL: Test/tune role-play prompts
│   ├── RolePlayAnalysis.tsx           # Phân tích sau cuộc gọi
│   ├── FillerPlayer.tsx               # Play filler words
│   └── TapToTalkButton.tsx            # Tap-to-talk button (pulse anim)
├── stores/
│   └── speakingStore.ts
└── lib/
    ├── pronunciationScorer.ts         # Word-level comparison + IPA
    ├── rolePlayManager.ts            # Conversation state + streaming
    └── audioQueueManager.ts          # Audio Queue System (buffer + filler)
```

---

## 6. KỸ NĂNG ĐỌC (READING) — `/reading`

> **Module:** `src/features/reading/` — MỚI HOÀN TOÀN  
> **Phụ thuộc:** Gemini AI, `useTTS` hook

### 6.1 Feature Map

| # | Feature | Mô tả | Độ phức tạp |
|---|---------|-------|------------|
| R1 | **Level-based Reading** (Đọc hiểu phân hóa) | AI tạo bài báo/truyện theo level + sở thích → câu hỏi | Trung bình |
| R2 | **Interactive Reading** (Đọc tương tác) | Chạm từ mới → hiện nghĩa + phát âm | Thấp-TB |
| R3 | **Reading Aloud** (Đọc thành tiếng) | Đọc theo kiểu karaoke → AI theo dõi tốc độ | Cao |

### 6.2 Feature Details

**R1 — Level-based Reading:**

```
Flow: Chọn level + topic/sở thích → AI tạo bài đọc → User đọc
      → Trả lời câu hỏi tóm tắt / MCQ → AI chấm
```

- **Sở thích user** (stored in profile): Thể thao, Công nghệ, Khoa học, Giải trí, etc.
- AI generate: bài báo/truyện ngắn (200-800 từ tùy level) + 3-5 câu hỏi
- Câu hỏi types: Main idea, Detail, Inference, Vocabulary in context
- Word count target by level:

| Level | Words | Sentence complexity |
|-------|-------|-------------------|
| A1 | 100-150 | Simple present, short sentences |
| A2 | 150-250 | Past tense, compound sentences |
| B1 | 250-400 | Multiple tenses, complex sentences |
| B2 | 400-600 | Advanced vocabulary, nuanced |
| C1 | 500-800 | Academic, subtle arguments |

**R2 — Interactive Reading:**

```
User đang đọc → Thấy từ lạ "ubiquitous" → Chạm/click vào
→ Popup: 
  ┌──────────────────────────────┐
  │ ubiquitous  /juːˈbɪk.wɪ.təs/ │
  │ 🔊 [Play]                     │
  │                               │
  │ adj. có mặt ở khắp nơi,      │
  │ phổ biến                      │
  │                               │
  │ VD: "Smartphones are          │
  │ ubiquitous in modern life."   │
  │                               │
  │ [📌 Lưu vào từ vựng]         │
  └──────────────────────────────┘
```

- **Kỹ thuật:** Wrap mỗi từ trong `<span>` clickable
- **Tra nghĩa:** Gọi Gemini (cache aggressively) hoặc dùng local dictionary data
- **Lưu từ:** Thêm vào `user_srs_cards` để ôn tập SRS
- Tích hợp `useTTS` để phát âm từ ngay

**R3 — Reading Aloud (Karaoke-style):**

```
Flow: AI hiện đoạn text → User bấm Start → Mic bật
      → STT real-time → Highlight từ đang đọc (karaoke)
      → Nếu ngập ngừng > 3s → Lưu từ đó vào "cần ôn"
      → Cuối bài: Stats tốc độ + từ khó
```

- **UI Karaoke:** Mỗi từ là 1 `<span>` → khi STT nhận được từ → đổi màu xanh
- **Tracking:**
  - Words per minute (WPM)
  - Hesitation points (ngập ngừng > 3s)
  - Mispronounced words (STT text ≠ original)
- **Kết quả:**
  - WPM chart (so với trung bình cho level)
  - Danh sách từ ngập ngừng → "Cần ôn tập"
  - Danh sách từ đọc sai → gợi ý phát âm

### 6.3 Component Structure

```
src/features/reading/
├── pages/
│   └── ReadingPage.tsx
├── components/
│   ├── ReadingConfig.tsx              # Chọn mode + level + topic
│   ├── LevelReading.tsx               # R1: Bài đọc + câu hỏi
│   ├── LevelReadingResult.tsx         # Kết quả trả lời
│   ├── InteractiveText.tsx            # R2: Text với từ clickable
│   ├── WordPopup.tsx                  # R2: Popup nghĩa từ
│   ├── ReadingAloud.tsx               # R3: Karaoke reading
│   ├── ReadingAloudResult.tsx         # R3: WPM + từ khó
│   ├── KaraokeHighlighter.tsx         # R3: Highlight từ real-time
│   └── ArticleRenderer.tsx            # Render bài đọc (shared)
├── stores/
│   └── readingStore.ts
└── lib/
    ├── wordTokenizer.ts               # Split text → clickable spans
    └── wpmCalculator.ts              # Tính Words Per Minute
```

---

## 7. KỸ NĂNG VIẾT (WRITING) — `/writing`

> **Module:** `src/features/writing/`  
> **Cải tiến từ:** `src/features/writing-tools/` hiện tại  
> **Giữ lại:** GrammarChecker, Paraphraser components, writingToolsStore, writing-api

### 7.1 Feature Map

| # | Feature | Mô tả | Reuse |
|---|---------|-------|-------|
| W1 | **Sentence Building** (Sắp xếp câu) | Kéo thả từ xáo trộn → tạo câu đúng | 🆕 Mới |
| W2 | **Paraphrasing** (Viết lại câu) | Viết lại câu dùng cấu trúc nâng cao hơn | ⚡ Cải tiến từ Paraphraser |
| W3 | **AI Writing Assistant** (Chấm bài luận) | Viết email/essay → AI chấm + gợi ý | ⚡ Cải tiến từ GrammarChecker |

### 7.2 Feature Details

**W1 — Sentence Building (Sắp xếp câu):**

```
┌─────────────────────────────────────────┐
│  Sắp xếp thành câu hoàn chỉnh:         │
│                                         │
│  ┌────┐ ┌──────┐ ┌───┐ ┌────────┐      │
│  │ to │ │ like │ │ I │ │ school │      │
│  └────┘ └──────┘ └───┘ └────────┘      │
│           ↕ drag & drop ↕               │
│  ┌───┐ ┌──────┐ ┌────┐ ┌──┐ ┌───────┐  │
│  │ I │ │ like │ │ to │ │go│ │school │  │
│  └───┘ └──────┘ └────┘ └──┘ └───────┘  │
│                                         │
│  ✅ "I like to go to school" — Đúng!    │
│  💡 Cấu trúc: S + V + to-infinitive    │
│                                         │
│  [Câu tiếp theo →]                      │
└─────────────────────────────────────────┘
```

- **Target level:** A1-A2 (cho beginners)
- AI generate: câu đúng → xáo trộn thứ tự từ (+ thêm 1-2 từ nhiễu tùy level)
- **Drag & Drop:** Sử dụng HTML5 Drag API hoặc touch events cho mobile
- AI evaluate: đúng/sai + giải thích cấu trúc ngữ pháp

**W2 — Paraphrasing (Viết lại câu) — Cải tiến:**

```
Flow: AI đưa câu gốc: "The weather is very hot"
      → User viết lại: "It's boiling hot outside"
      → AI đánh giá: giữ nguyên nghĩa? tự nhiên? nâng cao hơn?
```

**Khác với Paraphrase tool hiện tại:**
- Hiện tại: User paste text → AI paraphrase cho user (thụ động)
- **Mới:** AI đưa câu → User tự viết lại (chủ động luyện tập)
- AI chấm điểm: Meaning preservation + Naturalness + Level upgrade
- Gợi ý nhiều cách viết lại khác nhau (formal, casual, academic)

> **Note:** Giữ nguyên Paraphraser tool cũ (paste → auto-rewrite) vì vẫn hữu ích. W2 là mode luyện tập mới, bổ sung.

**W3 — AI Writing Assistant (Chấm bài luận) — Cải tiến:**

```
Flow: AI đưa đề bài: "Write an email requesting leave"
      → User viết đoạn văn/email
      → AI chấm: gạch dưới lỗi sai + giải thích + đề xuất "cụm từ hay hơn"
```

**Khác với GrammarChecker hiện tại:**
- Hiện tại: Chỉ check grammar/spelling
- **Mới:** 
  - AI đưa đề bài theo level (không chỉ check text user paste)
  - Đánh giá toàn diện: Grammar + Vocabulary + Structure + Coherence
  - **"Better vocabulary"**: AI gợi ý thay thế từ đơn giản bằng từ nâng cao
    - VD: "good" → "excellent/outstanding", "very big" → "enormous"
  - Score theo tiêu chí IELTS-like: Task Response, Coherence, Lexical, Grammar
  - Band estimation (A1-C2)

> **Note:** Giữ nguyên GrammarChecker + PlagiarismChecker tools cũ trong 1 tab riêng "Công cụ" bên cạnh 3 mode luyện tập.

### 7.3 Component Structure

```
src/features/writing/
├── pages/
│   └── WritingPage.tsx
├── components/
│   ├── WritingConfig.tsx              # Chọn mode
│   ├── SentenceBuilding.tsx           # W1: Drag-drop xắp xếp câu
│   ├── SentenceBuildingResult.tsx     # W1: Kết quả + giải thích
│   ├── DraggableWord.tsx              # W1: Từ kéo thả
│   ├── ParaphraseExercise.tsx         # W2: Viết lại câu (active)
│   ├── ParaphraseResult.tsx           # W2: Đánh giá AI
│   ├── EssayWriting.tsx               # W3: Viết bài theo đề
│   ├── EssayFeedback.tsx              # W3: Feedback chi tiết
│   ├── BetterVocabSuggestion.tsx      # W3: Gợi ý từ nâng cao
│   │
│   │── # Legacy tools (giữ nguyên, tab riêng)
│   ├── GrammarChecker.tsx             # ✅ Keep from writing-tools
│   ├── GrammarIssueCard.tsx           # ✅ Keep
│   ├── Paraphraser.tsx                # ✅ Keep (auto-rewrite tool)
│   ├── PlagiarismChecker.tsx          # ✅ Keep
│   └── PlagiarismReport.tsx           # ✅ Keep
├── stores/
│   └── writingStore.ts               # Merge writingToolsStore + new exercises
└── lib/
    └── dragDropUtils.ts              # Drag & Drop helpers
```

---

## 8. Database Schema

### 8.1 Bảng mới: `skill_sessions` (Thay thế bảng riêng từng skill)

```sql
-- Unified session table cho cả 4 kỹ năng
CREATE TABLE skill_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  skill           TEXT NOT NULL CHECK (skill IN ('listening','speaking','reading','writing')),
  mode            TEXT NOT NULL,           -- 'dictation','fill_blank','dialogue','pronunciation',...
  level           TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic           TEXT,
  config          JSONB,                   -- Extra config (scenario, interests, etc.)
  
  -- Progress
  total_exercises INT DEFAULT 0,
  completed_count INT DEFAULT 0,
  avg_score       NUMERIC(5,2) DEFAULT 0,
  total_time_sec  INT DEFAULT 0,
  
  -- AI Summary (cuối session)
  ai_summary      JSONB,
  
  -- XP
  xp_earned       INT DEFAULT 0,
  
  -- Timing
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skill_sessions_user ON skill_sessions(user_id, skill);
CREATE INDEX idx_skill_sessions_date ON skill_sessions(user_id, created_at DESC);
```

### 8.2 Bảng mới: `skill_attempts` (Từng câu/bài trong session)

> ⚠️ **DB Optimization:** Không lưu toàn bộ exercise data vào JSONB mỗi lần user làm bài. Thay vào đó, lưu `pool_item_id` tham chiếu đến `exercise_content_pool` (bảng đã có). Chỉ dùng `exercise_data_override` cho free practice (AI generate mới).

```sql
CREATE TABLE skill_attempts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES skill_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  
  -- Exercise reference (OPTIMIZED: tránh duplicate JSONB)
  exercise_index  INT DEFAULT 0,
  pool_item_id    UUID REFERENCES exercise_content_pool(id),  -- Tham chiếu câu hỏi gốc
  exercise_data_override JSONB,            -- Chỉ dùng khi AI generate mới (free practice)
  
  -- User input
  user_answer     TEXT,                    -- Câu trả lời user
  user_audio_url  TEXT,                    -- URL audio recording (nếu speaking)
  
  -- AI Evaluation (compact: chỉ lưu kết quả, không lưu lại đề)
  score           INT,                     -- 0-100
  is_correct      BOOLEAN,
  error_summary   TEXT,                    -- Tóm tắt lỗi ngắn gọn
  ai_feedback     JSONB,                   -- Chi tiết feedback (chỉ phần đánh giá)
  
  -- Timing
  time_spent_sec  INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skill_attempts_session ON skill_attempts(session_id);
```

### 8.3 Bảng mới: `reading_articles` (Bài đọc AI-generated, cached)

```sql
CREATE TABLE reading_articles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level           TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  topic           TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,            -- Full article text
  word_count      INT DEFAULT 0,
  questions       JSONB,                   -- [{question, type, options, answer}]
  vocabulary      JSONB,                   -- [{word, meaning_vi, ipa, part_of_speech}]
  times_served    INT DEFAULT 0,
  quality_score   FLOAT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reading_articles_level ON reading_articles(level, topic);
```

### 8.4 Bảng mới: `roleplay_scenarios` (Kịch bản Role-play)

```sql
CREATE TABLE roleplay_scenarios (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level           TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2')),
  title           TEXT NOT NULL,            -- "Ordering Coffee"
  title_vi        TEXT NOT NULL,            -- "Gọi cà phê"
  description     TEXT,
  ai_role         TEXT NOT NULL,            -- "Barista at a coffee shop"
  user_role       TEXT NOT NULL,            -- "Customer"  
  system_prompt   TEXT NOT NULL,            -- Full system prompt for AI
  starter_message TEXT NOT NULL,            -- First AI message
  suggested_phrases JSONB,                 -- Gợi ý cho user
  order_index     INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 8.5 Bảng mới: `roleplay_conversations` (Lịch sử Role-play)

```sql
CREATE TABLE roleplay_conversations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES skill_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  scenario_id     UUID REFERENCES roleplay_scenarios(id),
  
  messages        JSONB NOT NULL DEFAULT '[]',  -- [{role, text, timestamp}]
  total_turns     INT DEFAULT 0,
  
  -- AI Analysis (sau khi kết thúc)
  analysis        JSONB,                   -- {vocab_score, grammar_score, fluency, tips[]}
  
  duration_sec    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 8.6 Bảng mới: `user_word_bank` (Từ vựng user lưu khi đọc)

```sql
CREATE TABLE user_word_bank (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  word            TEXT NOT NULL,
  meaning_vi      TEXT,
  ipa             TEXT,
  part_of_speech  TEXT,
  example_sentence TEXT,
  source          TEXT,                    -- 'reading', 'listening', 'speaking'
  source_context  TEXT,                    -- Câu chứa từ đó
  mastered        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, word)
);

CREATE INDEX idx_user_word_bank ON user_word_bank(user_id, mastered);
```

### 8.7 Update `user_profiles`

```sql
ALTER TABLE user_profiles
ADD COLUMN max_daily_speaking_exercises INT DEFAULT 15,
ADD COLUMN max_daily_reading_exercises INT DEFAULT 20,
ADD COLUMN reading_interests TEXT[] DEFAULT '{"Technology","Daily Life"}',
ADD COLUMN preferred_reading_level TEXT DEFAULT 'B1';
```

### 8.8 Giữ nguyên bảng hiện tại

- `listening_exercises` — ✅ Giữ (cho backward compatibility + migration dần)
- `listening_batch_sessions` — ✅ Giữ
- `exercise_content_pool` — ✅ Giữ
- `writing_checks` — ✅ Giữ (Grammar/Plagiarism/Paraphrase tools)

---

## 9. Edge Function — API Endpoints

### 9.1 Extend `writing-api` (thêm endpoints mới)

Edge function `writing-api` đã có user-level auth + Gemini integration. Thêm endpoints:

| Endpoint | Skill | Mô tả |
|----------|-------|-------|
| `generate-fill-blank` | Listening | Generate đoạn văn + blanks |
| `generate-dialogue` | Listening | Generate hội thoại 2 người |
| `evaluate-fill-blank` | Listening | Chấm điểm fill-blank |
| `evaluate-dialogue` | Listening | Chấm câu hỏi comprehension |
| `generate-pronunciation` | Speaking | Generate câu cho pronunciation check |
| `evaluate-pronunciation` | Speaking | So sánh STT vs original, phân tích âm sai |
| `generate-shadowing` | Speaking | Generate câu + stress pattern |
| `evaluate-shadowing` | Speaking | Chấm fluency + accuracy |
| `roleplay-respond` | Speaking | Gemini respond in role (streaming) |
| `roleplay-analyze` | Speaking | Phân tích cuộc hội thoại |
| `generate-article` | Reading | Generate bài đọc + câu hỏi |
| `lookup-word` | Reading | Tra nghĩa từ + IPA + VD |
| `evaluate-reading` | Reading | Chấm câu trả lời reading |
| `generate-sentence-building` | Writing | Generate câu + xáo trộn |
| `generate-paraphrase-exercise` | Writing | Generate câu cần viết lại |
| `evaluate-paraphrase` | Writing | Đánh giá câu viết lại |
| `generate-essay-prompt` | Writing | Tạo đề bài viết |
| `evaluate-essay` | Writing | Chấm bài viết chi tiết |

### 9.2 Streaming endpoint cho Role-play

Role-play cần **streaming response** từ Gemini. `writing-api` hiện tại dùng non-streaming. Thêm:

```typescript
// Streaming handler cho role-play
async function handleRoleplayRespond(req: Request, userId: string) {
  const { scenario_system_prompt, messages, user_message } = await req.json()
  
  // Call Gemini với streaming
  const response = await fetch(geminiUrl, {
    method: 'POST',
    body: JSON.stringify({
      contents: buildConversationContents(messages, user_message),
      systemInstruction: { parts: [{ text: scenario_system_prompt }] },
      generationConfig: { temperature: 0.8, maxOutputTokens: 500 },
    }),
  })
  
  // Stream response back to client
  return new Response(response.body, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
  })
}
```

---

## 10. Navigation & Routing Updates

### 10.1 Sidebar — Grouped "Luyện tập" section

```typescript
const navItems = [
  { path: '/', label: 'Trang chủ', icon: Home },
  { path: '/courses', label: 'Khóa học', icon: BookOpen },
  { path: '/scan', label: 'Smart Scan', icon: ScanLine },
  
  // ─── Luyện tập (NEW GROUP) ───
  { path: '/listening', label: 'Luyện nghe', icon: Headphones },
  { path: '/speaking', label: 'Luyện nói', icon: Mic },
  { path: '/reading', label: 'Luyện đọc', icon: BookOpenText },
  { path: '/writing', label: 'Luyện viết', icon: PenTool },
  
  { path: '/daily-review', label: 'Ôn tập hàng ngày', icon: CalendarCheck },
  { path: '/review', label: 'Ôn tập SRS', icon: Brain },
  // ...
]
```

### 10.2 Routes (App.tsx)

```tsx
<Route path="listening" element={<ListeningPage />} />
<Route path="speaking" element={<SpeakingPage />} />
<Route path="reading" element={<ReadingPage />} />
<Route path="writing" element={<WritingPage />} />
```

### 10.3 Backward compatibility

- `/writing-tools` → redirect to `/writing`
- `/listening` → same URL, enhanced page

---

## 11. Shared Components & Hooks

### 11.1 New Shared Hooks

```typescript
// shared/hooks/useSTT.ts — Speech-to-Text
export function useSTT() {
  return { 
    startListening, stopListening, 
    transcribeAudio,  // POST to HF Space
    transcript, isListening, isSupported,
    error 
  }
}

// shared/hooks/useSpeechScore.ts — Pronunciation scoring
export function useSpeechScore() {
  return {
    compareTexts,     // Levenshtein + phonetic
    getPhoneticGuide, // IPA + Vietnamese guide
    highlightErrors,  // Word-level error markers
  }
}

// shared/hooks/useMediaRecorder.ts — Audio recording
export function useMediaRecorder() {
  return {
    startRecording, stopRecording,
    audioBlob, isRecording, duration,
  }
}
```

### 11.2 Shared UI Components

```
shared/components/
├── ExerciseLayout.tsx         # Common layout: header + progress + content
├── ScoreDisplay.tsx           # Score badge (0-100, color coded)
├── ExerciseTimer.tsx          # Timer component
├── AudioRecordButton.tsx      # Mic button with pulse animation
└── LevelBadge.tsx            # A1/A2/B1/... badge
```

---

## 12. XP System

| Skill | Action | XP |
|-------|--------|-----|
| Listening | Complete dictation (score ≥ 70) | +10 |
| Listening | Complete fill-blank (score ≥ 70) | +8 |
| Listening | Complete dialogue comprehension | +15 |
| Speaking | Pronunciation score ≥ 85% | +10 |
| Speaking | Shadowing score ≥ 80% | +12 |
| Speaking | Complete role-play conversation (5+ turns) | +25 |
| Reading | Complete reading comprehension (score ≥ 70) | +12 |
| Reading | Reading Aloud (WPM ≥ target) | +10 |
| Reading | Save 5+ words to word bank | +5 |
| Writing | Sentence Building correct | +8 |
| Writing | Paraphrase (meaning preserved + upgraded) | +12 |
| Writing | Essay score ≥ 70 | +20 |

---

## 13. Build Order (Phân chia sub-projects)

Theo brainstorming skill — mỗi sub-project gồm spec → plan → build riêng:

### Sub-project 1: Foundation + Listening Upgrade
1. DB migration (skill_sessions, skill_attempts)
2. Shared hooks (useSTT, useMediaRecorder, useSpeechScore)
3. Listening module refactor + 3 modes
4. Navigation update (sidebar group)

### Sub-project 2: Speaking
1. STT endpoint trên HF Space (faster-whisper)
2. Speaking module (Pronunciation + Shadowing)  
3. Role-play scenarios (DB + seed data)
4. Role-play chat (streaming)

### Sub-project 3: Reading  
1. Reading articles (DB + AI generation)
2. Reading module (Level-based + Interactive + Aloud)
3. Word bank integration with SRS

### Sub-project 4: Writing Upgrade
1. Writing module (Sentence Building + Paraphrase Exercise + Essay)
2. Merge old writing-tools into new Writing page
3. Better vocabulary suggestions

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|----------|
| Whisper slow on free CPU | Speaking latency | Use `whisper-small` + `int8`, fallback to Web Speech API |
| iOS no Speech Recognition | Speaking broken on iOS | Fallback: type text manually on iOS |
| Gemini rate limits | All AI features down | Batch requests, cache responses, fallback chain |
| Audio kẹt giữa Role-play | UX "robot", ngắt quãng | Audio Queue System + filler words tự động |
| Hold-to-Talk mobile conflict | OS gesture xung đột | Tap-to-Talk thay thế (tap start → tap send) |
| skill_attempts JSONB phình | DB RAM tràn | Reference pool_item_id thay vì duplicate data |
| Gemini trả lời quá dài | Role-play không tự nhiên | Tune prompt + Prompt Tuner tool + max_tokens=150 |
| HF Space cold start | 30-60s first load | Health check ping, keep-alive cron |
| Drag & Drop mobile | Writing Sentence Building | Touch events fallback, tested on mobile |
| Large store size | Performance | Separate stores per skill module |
