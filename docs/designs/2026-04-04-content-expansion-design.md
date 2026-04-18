# 📘 Scribe Content Expansion — Master Design Document

> **Ngày:** 2026-04-04  
> **Phạm vi:** Mở rộng nội dung CEFR A1→C2 + IELTS  
> **Tiêu chuẩn tham chiếu:** CEFR (Council of Europe), English Grammar Profile (Cambridge), EAQUALS Core Inventory, British Council Guidelines

---

## 1. MỤC TIÊU

Xây dựng hệ thống nội dung học tiếng Anh **đầy đủ từ A1 đến C2** theo chuẩn CEFR quốc tế, bao phủ tất cả kỹ năng ngôn ngữ và luyện thi IELTS. Đảm bảo:

- ✅ Mỗi level CEFR có đủ nội dung Grammar, Vocabulary, Pronunciation, Communication, Reading & Writing
- ✅ Lộ trình học rõ ràng, tiến dần từ cơ bản đến thành thạo
- ✅ Nội dung chuẩn học thuật theo English Grammar Profile & EAQUALS Core Inventory
- ✅ Mỗi bài học có đủ 4 skill exercises (Listening, Reading, Speaking, Writing)

---

## 2. TÁI CẤU TRÚC DANH MỤC (Categories)

### 2.1 Danh mục mới

| # | Category | Slug | Mô tả | Trạng thái |
|---|----------|------|--------|------------|
| 1 | Ngữ pháp (Grammar) | `grammar` | Cấu trúc ngữ pháp từ cơ bản đến nâng cao | ✅ Giữ nguyên |
| 2 | Từ vựng (Vocabulary) | `vocabulary` | Mở rộng vốn từ theo chủ đề và cấp độ | ✅ Giữ nguyên |
| 3 | Phát âm (Pronunciation) | `pronunciation` | Phát âm, ngữ điệu, trọng âm | ✅ Giữ nguyên |
| 4 | Giao tiếp (Communication) | `communication` | Tình huống giao tiếp thực tế | 🆕 Tạo mới |
| 5 | Đọc & Viết (Reading & Writing) | `reading-writing` | Kỹ năng đọc hiểu và viết | 🆕 Tạo mới |
| 6 | TOEIC | `toeic` | Luyện thi TOEIC đầy đủ 7 Part | ✅ Giữ nguyên |
| 7 | IELTS | `ielts` | Luyện thi IELTS 4 kỹ năng | 🆕 Tạo mới |

### 2.2 Thao tác cần thực hiện

- **Di chuyển 3 khóa** từ category `Grammar` sang `TOEIC`:
  - TOEIC Part 6: Text Completion
  - TOEIC Part 7: Reading Comprehension
  - TOEIC Vocab: Business & Office
- **Xóa** category `Testing for Developer` và khóa `Test create Course`
- **Tạo** 3 category mới: `communication`, `reading-writing`, `ielts`

---

## 3. QUY MÔ NỘI DUNG THEO CEFR

### 3.1 Thông số kỹ thuật

| Thông số | A1 | A2 | B1 | B2 | C1 | C2 |
|----------|-----|-----|-----|-----|-----|-----|
| Lessons/khóa | 8-10 | 10-12 | 8-10 | 8-10 | 6-8 | 6-8 |
| Vocab/lesson | 8-10 | 7-8 | 6-8 | 5-7 | 5-6 | 4-6 |
| Quiz questions/lesson | 5 | 5-6 | 5-6 | 6-8 | 6-8 | 8-10 |
| Skill exercises/lesson | 4 | 4 | 4 | 4 | 4 | 4 |

### 3.2 Triết lý thiết kế theo level

| Level | Đặc điểm nội dung | Loại từ vựng | Độ phức tạp quiz |
|-------|-------------------|-------------|-----------------|
| **A1** | Concrete, survival, high-frequency | Danh từ cụ thể, động từ cơ bản, tính từ đơn giản | Nhận diện, nối nghĩa, chọn đáp án đơn |
| **A2** | Routine, familiar topics, expanded | Mở rộng theo chủ đề quen thuộc, phrasal verbs cơ bản | Fill-in-the-blank đơn, sắp xếp câu |
| **B1** | Semi-abstract, opinions, experiences | Từ chủ đề xã hội, collocations, idioms | Đọc đoạn văn ngắn + trả lời, viết lại câu |
| **B2** | Abstract, professional, academic | Từ học thuật, phrasal verbs nâng cao, từ đa nghĩa | Inference, error correction, paraphrase |
| **C1** | Nuanced, sophisticated, implicit | Từ tinh tế, low-frequency, chuyên ngành | Phân tích ngữ cảnh, cloze test nâng cao |
| **C2** | Near-native, literary, specialized | Từ văn chương, báo chí, register variation | Phân biệt sắc thái, viết lại nâng cao |

---

## 4. TỔNG QUAN KHÓA HỌC

### 4.1 Bảng tổng hợp theo Category × Level

| Category | A1 | A2 | B1 | B2 | C1 | C2 | TOEIC | IELTS | Tổng |
|----------|----|----|----|----|----|----|-------|-------|------|
| **Grammar** | 2 (1✅1🆕) | 4 ✅ | 5 ✅ | 4 ✅ | 3 🆕 | 2 🆕 | — | — | **20** |
| **Vocabulary** | 2 (1✅1🆕) | 3 (2✅1🆕) | 3 (1✅2🆕) | 3 (2✅1🆕) | 2 🆕 | 2 🆕 | — | — | **15** |
| **Pronunciation** | 1 ✅ | 1 🆕 | 1 🆕 | 1 🆕 | 1 🆕 | — | — | — | **5** |
| **Communication** | 1 🆕 | 1 🆕 | 2 🆕 | 1 🆕 | 1 🆕 | 1 🆕 | — | — | **7** |
| **Reading & Writing** | 1 🆕 | 1 🆕 | 2 🆕 | 2 🆕 | 2 🆕 | 2 🆕 | — | — | **10** |
| **TOEIC** | — | — | — | — | — | — | 10 ✅ | — | **10** |
| **IELTS** | — | — | — | — | — | — | — | 7 🆕 | **7** |
| **Tổng/level** | **7** | **10** | **13** | **11** | **9** | **7** | **10** | **7** | **74** |

- ✅ = Đã có (31 khóa, sau khi xóa Test)
- 🆕 = Cần tạo mới (**43 khóa**)

### 4.2 Ước tính tổng nội dung sau mở rộng

| Metric | Hiện tại | Sau mở rộng | Tăng |
|--------|----------|-------------|------|
| Khóa học | 31 | **74** | +43 |
| Bài học | ~227 | ~**570** | +343 |
| Từ vựng | ~1,438 | ~**3,600** | +2,162 |
| Câu hỏi quiz | ~870 | ~**2,400** | +1,530 |
| Skill exercises | 26 | ~**2,280** | +2,254 |

---

## 5. PHÂN CHIA PHASE

### Phase 1: Nền tảng & Mở rộng Core (Grammar + Vocabulary)
**File:** `2026-04-04-content-phase1-core.md`

| Hạng mục | Số lượng |
|----------|----------|
| Tái cấu trúc database | 1 migration |
| Grammar mới | 6 khóa (1 A1, 3 C1, 2 C2) |
| Vocabulary mới | 9 khóa (bổ sung đều A1→C2) |
| **Tổng Phase 1** | **15 khóa mới** |

**Ưu tiên cao nhất** — lấp đầy khoảng trống C1-C2 và bổ sung vocabulary gaps.

---

### Phase 2: Kỹ năng Giao tiếp & Phát âm
**File:** `2026-04-04-content-phase2-communication.md`

| Hạng mục | Số lượng |
|----------|----------|
| Communication mới | 7 khóa (A1→C2) |
| Pronunciation mới | 4 khóa (A2→C1) |
| **Tổng Phase 2** | **11 khóa mới** |

---

### Phase 3: Đọc & Viết
**File:** `2026-04-04-content-phase3-reading-writing.md`

| Hạng mục | Số lượng |
|----------|----------|
| Reading & Writing mới | 10 khóa (A1→C2) |
| **Tổng Phase 3** | **10 khóa mới** |

---

### Phase 4: Luyện thi IELTS
**File:** `2026-04-04-content-phase4-ielts.md`

| Hạng mục | Số lượng |
|----------|----------|
| IELTS mới | 7 khóa |
| **Tổng Phase 4** | **7 khóa mới** |

---

## 6. GHI CHÚ KỸ THUẬT

### 6.1 Quy tắc đặt tên khóa học
- Tiếng Việt đầu tiên, tiếng Anh trong ngoặc: `Câu bị động (Passive Voice)`
- Khóa IELTS/TOEIC: Tiếng Anh, format chuẩn: `IELTS Writing Task 2`

### 6.2 Cấu trúc mỗi Lesson
```
1. Nội dung bài (processed_content) — lý thuyết + ví dụ
2. Từ vựng (vocabulary) — words/phrases liên quan
3. Quiz (quiz_questions) — câu hỏi trắc nghiệm
4. Skill Exercises (lesson_skill_exercises):
   - 1x Listening (dictation/comprehension)
   - 1x Reading (level_reading)
   - 1x Speaking (pronunciation/shadowing)
   - 1x Writing (sentence_building/essay)
```

### 6.3 Nguồn tham chiếu nội dung
- **Grammar:** English Grammar Profile (Cambridge), Murphy's English Grammar in Use
- **Vocabulary:** English Vocabulary Profile (Cambridge), Oxford Word Lists
- **TOEIC:** ETS Official Guide
- **IELTS:** Cambridge IELTS Practice Tests, British Council
- **Pronunciation:** Cambridge English Pronunciation in Use
- **Communication:** Headway, Interchange series topics
