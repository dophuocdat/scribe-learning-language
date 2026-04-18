# Quiz Gaps Template — Cần bổ sung câu hỏi

## Tổng quan
- **Tổng lessons cần bổ sung:** ~370
- **Tổng câu hỏi cần thêm:** ~850
- **Đã thêm (batch trước):** 12

## Hướng dẫn
Bạn generate nội dung JSON theo format sau, sau đó đưa lại tôi để chạy SQL INSERT.

### Format cho mỗi câu hỏi:
```json
{
  "quiz_id": "<uuid_từ_danh_sách_dưới>",
  "question_text": "Câu hỏi tiếng Việt hoặc Anh-Việt",
  "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
  "correct_answer": "Lựa chọn A",
  "explanation": "Giải thích ngắn"
}
```

**Lưu ý:**
- `correct_answer` PHẢI khớp chính xác 1 trong 4 `options`
- `question_type` luôn là `multiple_choice`
- Mỗi lesson cần thêm 1-3 câu (xem cột `need`)

---

## Danh sách Lessons cần bổ sung

### A1 — Đọc hiểu cơ bản (cần +3 mỗi lesson)
| quiz_id | Lesson | need |
|---------|--------|------|
| c930f593-ce64-4d26-9aba-0d8e38b0188d | Đọc biển báo & Bảng chỉ dẫn | 3 |
| 3f31631d-ba35-4aef-951e-c7c09cc18f87 | Đọc lịch trình & Thời gian biểu | 3 |
| 8351f80e-f9c9-44a1-86c9-233e1ed7f431 | Đọc menu & Danh sách | 3 |
| 9280ca36-c25a-4cdc-b6dd-2a97e8400341 | Đọc mô tả đơn giản | 3 |
| f2fdd54b-f837-4a46-958f-6410389d5b57 | Đọc thông tin cá nhân | 3 |
| 40655a5a-88dd-476c-8154-79f242bb8146 | Đọc tin nhắn ngắn | 3 |
| 26ba5a31-465d-4d43-89f0-d721b676e7e8 | Viết câu đơn giản | 3 |
| 0e525a55-671c-4157-963e-8a0a9dbe7234 | Viết tin nhắn & Ghi chú | 3 |

### A1 — Giao tiếp sinh tồn (cần +3 mỗi lesson)
| quiz_id | Lesson | need |
|---------|--------|------|
| ec984ef0-c130-4d14-92a9-9da4b7f75e84 | Chào hỏi & Tạm biệt | 3 |
| a7896af0-6023-4f51-a505-683fc444e51b | Đi phương tiện công cộng | 3 |
| e743f085-9e77-4bf6-9723-087d8e3ee6a1 | Giới thiệu bản thân | 3 |
| 9feac315-6479-4e15-8e5e-1bafd6936514 | Gọi điện đơn giản | 3 |
| ed37c1b3-8c54-4ac2-b417-08e80573ebf9 | Gọi đồ ăn | 3 |
| c9f711b8-bfb0-48cb-a174-ac94b060fd0a | Hỏi & Chỉ đường | 3 |
| 47949187-676f-4d4b-805f-109c51a9a410 | Khẩn cấp & Cần giúp đỡ | 3 |
| b24cb239-f543-4ac8-b97f-9974e5a2c828 | Mua sắm cơ bản | 3 |
| 2906aaef-e8a0-439d-beff-f3a40b013d4e | Nói về sở thích | 3 |
| cdd6835a-2cd0-4ac3-a781-2c0a52da01be | Ở khách sạn | 3 |

### A1 — Từ vựng A1 theo chủ đề (cần +1 mỗi lesson)
| quiz_id | Lesson | need |
|---------|--------|------|
| cccc0001-0001-0001-0001-000000000007 | Body & Health | 1 |
| cccc0001-0001-0001-0001-000000000010 | Clothes & Shopping | 1 |
| cccc0001-0001-0001-0001-000000000004 | Colors & Shapes | 1 |
| cccc0001-0001-0001-0001-000000000012 | Daily Routine | 1 |
| cccc0001-0001-0001-0001-000000000005 | Food & Drinks | 1 |
| cccc0001-0001-0001-0001-000000000009 | House & Furniture | 1 |
| cccc0001-0001-0001-0001-000000000006 | Jobs & Occupations | 1 |
| cccc0001-0001-0001-0001-000000000011 | Transport & Directions | 1 |
| cccc0001-0001-0001-0001-000000000008 | Weather & Seasons | 1 |

*(Danh sách A2, B1, B2, C1, C2, IELTS tương tự — xem file đầy đủ)*

---

## Script Import

Khi bạn có JSON, đưa lại cho tôi dưới dạng:

```json
[
  {
    "quiz_id": "c930f593-...",
    "question_text": "Biển báo 'EXIT' có nghĩa là gì?",
    "options": ["Lối ra", "Lối vào", "Cấm vào", "Khu vực nguy hiểm"],
    "correct_answer": "Lối ra",
    "explanation": "EXIT = lối ra, thường thấy ở trung tâm thương mại, tòa nhà"
  },
  ...
]
```

Tôi sẽ chạy SQL INSERT trực tiếp qua MCP.
