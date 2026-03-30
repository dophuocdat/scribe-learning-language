# Listening & Writing Practice — Design Spec

## Tổng quan

Chức năng luyện nghe và viết theo level, 2 mode chính:
- **Mode 1: Dictation** — Nghe → viết lại chính xác
- **Mode 2: Comprehension & Writing** — Nghe hiểu → viết câu trả lời/tóm tắt/response

**Tech Stack:**
- Audio: Browser Web Speech API (TTS) → upgradeable to Cloud TTS
- Content: Gemini 2.5 Flash generate on-the-fly → upgradeable to cached/pre-generated
- Backend: `writing-api` edge function (reuse + extend)

---

## Mode 1: Dictation (Nghe chép)

User nghe audio → gõ lại chính xác → AI chấm từng từ.

### Exercise Types

| Level | Type | Mô tả |
|-------|------|--------|
| A1 | **Từ vựng** | Nghe 1 từ → gõ lại (vd: "apple", "beautiful") |
| A1-A2 | **Cụm từ** | Nghe cụm 2-4 từ → gõ lại (vd: "in the morning") |
| A2-B1 | **Câu ngắn** | Nghe 1 câu đơn giản → gõ lại (5-10 từ) |
| B1-B2 | **Câu phức** | Nghe câu dài/phức → gõ lại (10-20 từ) |
| B2-C1 | **Đoạn ngắn** | Nghe 2-3 câu → gõ lại cả đoạn |
| C1-C2 | **Đoạn dài** | Nghe đoạn văn 4-6 câu → gõ lại toàn bộ |

### Scoring (Dictation)
- So sánh từng từ: đúng/sai/thiếu
- Highlight lỗi: spelling, missing words, wrong words
- Accuracy %: (đúng / tổng từ) × 100
- Cho phép nghe lại (tối đa 3 lần, trừ điểm mỗi lần replay)

### UX Flow
```
Chọn Level → Chọn Topic (optional) → AI generate nội dung
→ Nghe audio (auto-play) → Gõ vào textarea
→ [Nghe lại] [Nộp bài]
→ Kết quả: Accuracy %, highlight sai, bản đúng
→ [Tiếp tục] [Luyện lại]
```

---

## Mode 2: Comprehension & Writing (Nghe hiểu & Viết)

User nghe nội dung → hoàn thành bài tập viết dựa trên nội dung đã nghe.

### Exercise Types

| Level | Type | Mô tả |
|-------|------|--------|
| A1-A2 | **Nghe & điền từ** | Nghe câu → điền từ còn thiếu (fill-in-the-blank) |
| A2-B1 | **Nghe & trả lời** | Nghe đoạn → trả lời câu hỏi ngắn bằng tiếng Anh |
| B1-B2 | **Nghe & tóm tắt** | Nghe đoạn → viết tóm tắt 2-3 câu |
| B2-C1 | **Nghe & viết opinion** | Nghe topic/argument → viết opinion response |
| C1-C2 | **Nghe & viết essay** | Nghe bài giảng/debate → viết phân tích/essay ngắn |

### Scoring (Comprehension & Writing)
- AI đánh giá: relevance, accuracy, grammar, vocabulary usage
- Score tổng: 0-100
- Feedback tiếng Việt: gợi ý cải thiện
- Sample answer: bài mẫu để so sánh

### UX Flow
```
Chọn Level → Chọn Exercise Type → Chọn Topic (optional)
→ AI generate nội dung + câu hỏi
→ Nghe audio → Đọc câu hỏi/yêu cầu
→ Viết câu trả lời vào textarea
→ [Nghe lại] [Nộp bài]
→ Kết quả: Score, AI feedback, sample answer
→ [Tiếp tục] [Luyện lại]
```

---

## User Customization

| Setting | Options |
|---------|---------|
| **Level** | A1, A2, B1, B2, C1, C2 |
| **Topic** | Daily Life, Travel, Technology, Business, Science, Education, Culture... (hoặc custom) |
| **Playback Speed** | 0.5x, 0.75x, 1x, 1.25x, 1.5x |
| **Max Replays** | 1-5 lần (ảnh hưởng score) |
| **Accent** | US, UK, AU (browser TTS voices) |

---

## Kiến trúc kỹ thuật

### Frontend
```
src/features/listening-practice/
├── pages/
│   └── ListeningPracticePage.tsx      # Main page với tab 2 mode
├── components/
│   ├── DictationExercise.tsx          # Mode 1 UI
│   ├── ComprehensionExercise.tsx      # Mode 2 UI  
│   ├── AudioPlayer.tsx                # TTS wrapper (upgradeable)
│   ├── DictationResult.tsx            # Kết quả dictation
│   ├── ComprehensionResult.tsx        # Kết quả comprehension
│   └── ExerciseConfig.tsx             # Chọn level/topic/settings
├── stores/
│   └── listeningPracticeStore.ts      # Zustand store
└── lib/
    └── ttsService.ts                  # TTS abstraction layer
```

### TTS Service (Upgradeable)
```typescript
// lib/ttsService.ts — Abstraction layer
interface TTSProvider {
  speak(text: string, options: TTSOptions): Promise<void>
  stop(): void
  // ...
}

class BrowserTTSProvider implements TTSProvider { ... }  // V1: miễn phí
class CloudTTSProvider implements TTSProvider { ... }    // V2: upgrade
```

### Backend — Reuse `writing-api`
Thêm 2 endpoint mới:
- `generate-exercise` — Gemini tạo bài tập theo level/topic/type
- `evaluate-exercise` — Gemini chấm kết quả

### Database
Bảng `listening_exercises` log lịch sử + tích XP:
- `user_id`, `mode`, `exercise_type`, `level`
- `content` (JSONB), `user_answer`, `result` (JSONB)
- `score`, `accuracy`, `xp_earned`

Rate limit: `max_daily_listening_exercises` trên `user_profiles`

---

## Giới hạn & Rate Limiting

| Limit | Mặc định |
|-------|----------|
| Exercises/ngày | 20 |
| Max replays/exercise | 3 |
| Text length (Comprehension writing) | 2000 chars |

---

## XP Integration

| Action | XP |
|--------|-----|
| Dictation accuracy ≥ 90% | +15 XP |
| Dictation accuracy ≥ 70% | +10 XP |
| Dictation hoàn thành | +5 XP |
| Comprehension score ≥ 80 | +20 XP |
| Comprehension score ≥ 60 | +12 XP |
| Comprehension hoàn thành | +8 XP |

---

## Upgrade Path (Sau này)

1. **Cloud TTS**: Swap `BrowserTTSProvider` → `CloudTTSProvider` trong `ttsService.ts`
2. **Content caching**: Lưu generated exercises vào DB, tái sử dụng cho user cùng level
3. **Spaced repetition**: Lặp lại bài tập user làm sai theo SRS
4. **Voice input**: Thêm Speech-to-Text cho mode nói (pronunciation practice)
5. **Leaderboard**: Xếp hạng theo streak luyện tập
