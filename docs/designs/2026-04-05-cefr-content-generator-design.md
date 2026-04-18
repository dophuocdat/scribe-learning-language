# Design: CEFR Content Generator

> **Ngày:** 2026-04-05
> **Mục tiêu:** Bổ sung quiz questions cho 35 khóa học hiện có + Tạo 3 khóa mới để đạt chuẩn CEFR

---

## 1. Bối Cảnh

### Vấn đề

Phân tích CEFR gap cho thấy:

1. **35/74 khóa** chỉ có **1 câu hỏi quiz/bài học** (tối thiểu cần 4). Điều này khiến Checkpoint Quiz trong Learning Path không có đủ ngân hàng câu hỏi để trộn.
2. **Pronunciation thiếu C2** — 5 level có nhưng C2 không có
3. **Communication A1-A2 quá mỏng** — mỗi level chỉ 1 khóa, cần 2

### Mục tiêu sau khi hoàn thành

| Metric | Trước | Sau |
|--------|-------|-----|
| Khóa có ratio ≥ 4 câu/lesson | 39/74 (53%) | **74/77 (96%)** |
| Tổng câu hỏi quiz | 1,446 | **~2,300+** |
| Khóa CEFR Communication | A1:1, A2:1 | A1:**2**, A2:**2** |
| Khóa CEFR Pronunciation | C2:0 | C2:**1** |
| Tổng khóa | 74 | **77** |

---

## 2. Giải Pháp

### Edge Function: `generate-cefr-content`

Một Edge Function duy nhất, admin-only, chạy 2 chế độ:

```
POST /generate-cefr-content
Headers: Authorization: Bearer <admin_jwt>
Body: { mode: "enrich" | "create", batch_index?: number }
```

### 2.1 Mode: `enrich` — Bổ sung quiz questions

**Input:** `batch_index` (0-6), mỗi batch xử lý 5 khóa

**Flow:**

```
1. Query 35 khóa có ratio < 3 câu/lesson
2. Chọn batch: courses[batch_index * 5 : (batch_index + 1) * 5]
3. Với mỗi course:
   a. Lấy tất cả lessons
   b. Với mỗi lesson:
      - Lấy quiz_id + existing questions
      - Tính cần thêm: target(4) - existing_count
      - Nếu cần thêm > 0:
        → Gọi Gemini sinh N câu mới
        → INSERT vào quiz_questions
4. Return { course_count, lesson_count, questions_inserted, errors }
```

**Gemini Prompt cho enrich:**

```
Bạn là chuyên gia Tiếng Anh CEFR level {level}.

Khóa học: "{course_title}"
Bài học: "{lesson_title}"
Nội dung bài: {lesson_content_snippet}

Câu hỏi đã có (KHÔNG ĐƯỢC trùng):
{existing_questions_json}

Hãy sinh thêm {N} câu hỏi trắc nghiệm (multiple_choice) mới.

Yêu cầu:
- Level {level}: {cefr_level_description}
- 4 lựa chọn, 1 đáp án đúng
- Đa dạng dạng câu: dịch nghĩa, điền khuyết, chọn đáp án đúng, tình huống
- Không trùng với câu đã có
- Tiếng Việt cho question_text, options có thể Anh hoặc Việt tùy ngữ cảnh

Trả về JSON array:
[{
  "question_text": "...",
  "options": ["A", "B", "C", "D"],
  "correct_answer": "A",
  "explanation": "..."
}]
```

**CEFR Level Descriptions (dùng trong prompt):**

| Level | Description cho prompt |
|-------|----------------------|
| A1 | Câu rất đơn giản, từ vựng cơ bản nhất, tình huống sinh tồn |
| A2 | Câu đơn giản, chủ đề quen thuộc, giao tiếp hằng ngày |
| B1 | Câu trung bình, diễn đạt ý kiến, tình huống du lịch/công việc |
| B2 | Câu phức tạp hơn, thảo luận chi tiết, đọc hiểu nâng cao |
| C1 | Câu phức tạp, học thuật, chuyên ngành, diễn đạt tinh tế |
| C2 | Câu rất phức tạp, văn chương, nghiên cứu, sắc thái ngôn ngữ |
| IELTS | Theo format IELTS Academic/General, strategies & techniques |

### 2.2 Mode: `create` — Tạo 3 khóa mới

**Không cần `batch_index`** — tạo cả 3 khóa trong 1 lần gọi.

**3 khóa cần tạo:**

#### Khóa 1: Chào hỏi & Giao tiếp xã hội (Social English Basics) — A1

| # | Lesson | Nội dung CEFR |
|---|--------|---------------|
| 1 | Giới thiệu bản thân mở rộng | Tên, tuổi, nghề, sở thích, quê quán |
| 2 | Chào hỏi & Tạm biệt trong nhiều tình huống | Formal vs informal greetings, time-of-day |
| 3 | Cảm ơn & Xin lỗi | Thank you variations, sorry vs excuse me |
| 4 | Hỏi thăm sức khỏe & Trả lời | How are you? / How's it going? Responses |
| 5 | Nói về gia đình | Family members, basic descriptions |
| 6 | Nói về thời tiết | Weather vocabulary, small talk |
| 7 | Hỏi & Chỉ đường đơn giản | Left, right, straight, near, far |
| 8 | Giao tiếp qua điện thoại cơ bản | Hello, who's calling, hold on please |

#### Khóa 2: Giao tiếp mua sắm & Dịch vụ (Shopping & Services English) — A2

| # | Lesson | Nội dung CEFR |
|---|--------|---------------|
| 1 | Mua sắm quần áo | Size, color, price, try on |
| 2 | Đi siêu thị & Chợ | Quantities, asking for items |
| 3 | Gọi đồ ăn & Uống | Restaurant ordering, menu vocabulary |
| 4 | Sử dụng phương tiện công cộng | Bus, taxi, train — buying tickets |
| 5 | Tại ngân hàng | Open account, exchange money, ATM |
| 6 | Tại bưu điện | Send package, buy stamps |
| 7 | Đặt phòng khách sạn | Check-in/out, room types, requests |
| 8 | Khám bệnh cơ bản | At the doctor, describing symptoms |

#### Khóa 3: Phương ngữ & Phong cách phát âm (Dialects & Stylistic Pronunciation) — C2

| # | Lesson | Nội dung CEFR |
|---|--------|---------------|
| 1 | British vs American Pronunciation | Key differences (r-dropping, t-flapping, vowel shifts) |
| 2 | Australian & South African English | Distinctive features, vowel changes |
| 3 | World Englishes: Indian, Singapore, Philippine | Non-native varieties as legitimate Englishes |
| 4 | Formal vs Informal Pronunciation | Connected speech in registers, careful vs casual speech |
| 5 | Pronunciation in Public Speaking | Emphasis, pausing, projection, rhetorical delivery |
| 6 | Code-Switching & Accent Adaptation | Adjusting pronunciation for audience, social context |

**Create Flow:**

```
Với mỗi khóa:
  1. INSERT course (title, slug, category_id, difficulty_level, description, is_published=true)
  2. Với mỗi lesson (từ spec trên):
     a. INSERT lesson (course_id, title, order_index)
     b. Gọi Gemini: sinh processed_content (nội dung bài giảng markdown) + ai_summary
     c. UPDATE lesson với content
     d. INSERT quiz (lesson_id, title, passing_score=70)
     e. Gọi Gemini: sinh 4 quiz questions
     f. INSERT quiz_questions
  3. Return created course_id
```

**Gemini Prompt cho create (content):**

```
Bạn là giáo viên Tiếng Anh CEFR level {level}.

Hãy soạn bài giảng cho bài học sau:
- Khóa: "{course_title}"
- Bài: "{lesson_title}"
- Mô tả: "{lesson_description}"

Yêu cầu:
- Viết bằng Tiếng Việt (giải thích) + Tiếng Anh (ví dụ, mẫu câu)
- Format Markdown
- Cấu trúc: Giới thiệu → Kiến thức chính → Ví dụ → Mẹo nhớ → Tóm tắt
- Phù hợp trình độ {level}
- Độ dài: 500-800 từ

Trả về JSON:
{
  "processed_content": "...markdown...",
  "ai_summary": "...1 câu tóm tắt..."
}
```

---

## 3. An Toàn & Rate Limits

| Concern | Giải pháp |
|---------|-----------|
| **Admin only** | Check user role = admin trước khi xử lý |
| **Gemini rate limit** | Batch 5 khóa/lần, delay 1s giữa mỗi Gemini call |
| **Timeout** | Edge Function timeout 150s, mỗi batch ~5 khóa × 8 lessons = ~40 calls |
| **Idempotent** | Kiểm tra existing question count trước khi thêm — không add nếu đã đủ |
| **Rollback** | Nếu Gemini fail giữa chừng, questions đã insert vẫn valid |
| **Duplicate** | Prompt chứa existing questions để Gemini không sinh trùng |

---

## 4. Kết Quả Kỳ Vọng

### Sau khi chạy enrich (7 batches):

| Category | Khóa | Lessons | Q trước | Q thêm | Q sau |
|----------|-------|---------|---------|--------|-------|
| Communication | 7 | 56 | 56 | **168** | **224** |
| R&W | 10 | 74 | 74 | **222** | **296** |
| Pronunciation | 4* | 30 | 30 | **90** | **120** |
| Vocabulary (C1-C2, B1-B2 mỏng) | 8 | 64 | 64 | **192** | **256** |
| IELTS | 7 | 58 | 58 | **174** | **232** |
| **Tổng** | **36** | **282** | **282** | **~846** | **~1,128** |

*Pronunciation có 5 khóa nhưng A1 (IPA) đã có 5 câu/lesson → chỉ enrich 4*

### Sau khi chạy create:

| Khóa mới | Lessons | Questions |
|----------|---------|-----------|
| Social English Basics (A1) | 8 | 32 |
| Shopping & Services (A2) | 8 | 32 |
| Dialects & Stylistic Pronunciation (C2) | 6 | 24 |
| **Tổng** | **22** | **88** |

### Grand Total:

| Metric | Trước | Sau |
|--------|-------|-----|
| Tổng câu hỏi | 1,446 | **~2,380** |
| Khóa có ≥ 4 câu/lesson | 39 | **74** |
| Tỷ lệ coverage | 53% | **96%** |
| Ma trận CEFR gaps | 3 | **0** |

---

## 5. Cách Sử Dụng

```bash
# Bước 1: Enrich quiz questions (chạy 7 lần)
curl -X POST https://euvxtwyiimeeiawtkztv.supabase.co/functions/v1/generate-cefr-content \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "enrich", "batch_index": 0}'
# ... lặp lại với batch_index 1, 2, 3, 4, 5, 6

# Bước 2: Tạo 3 khóa mới
curl -X POST https://euvxtwyiimeeiawtkztv.supabase.co/functions/v1/generate-cefr-content \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "create"}'
```

---

## 6. Files

| File | Action |
|------|--------|
| `supabase/functions/generate-cefr-content/index.ts` | **[NEW]** Edge Function |
