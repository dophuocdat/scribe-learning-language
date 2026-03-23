# Smart Scan — Chức năng quét tài liệu cá nhân

## Tổng quan

Cho phép user thường (không cần admin) quét tài liệu (ảnh, PDF, file) bằng Google Vision OCR, sau đó AI tự động tạo bài tập, từ vựng, luyện tập cá nhân. Nội dung được tổ chức theo thư mục do user tự tạo. Không tính XP, SRS vẫn hoạt động.

## User Flow

```
Nhấn "Smart Scan" → Thấy danh sách thư mục
  ├─ Chưa có thư mục → Bắt buộc tạo thư mục mới
  └─ Có thư mục → Chọn thư mục
        └─ Thấy danh sách tài liệu đã scan trong thư mục
             ├─ Nhấn "Thêm tài liệu" → Upload ảnh/PDF/file
             │     └─ Gọi scan-api-user → Vision OCR
             │           └─ Hiển thị nội dung đã trích xuất
             │                 └─ Nhấn "AI Tạo bài tập" → Gemini generate
             │                       └─ Tạo course/lesson/vocab/quiz cá nhân
             │                             └─ Chuyển sang trang học (layout như LessonStudyPage)
             └─ Nhấn vào tài liệu cũ → Xem lại bài tập đã tạo
```

## Kiến trúc

### Database — Bảng mới: `user_scan_logs`

```sql
CREATE TABLE user_scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES user_folders(id) ON DELETE CASCADE NOT NULL,
  content_hash TEXT NOT NULL,          -- SHA-256 hash nội dung đã scan
  extracted_text TEXT,                  -- Nội dung Vision trả về
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,  -- Course cá nhân đã tạo
  scan_status TEXT DEFAULT 'scanned',   -- scanned | generating | completed | failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: user chỉ thấy data của mình
ALTER TABLE user_scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_logs_own" ON user_scan_logs FOR ALL USING (user_id = auth.uid());

-- Index cho rate limit check
CREATE INDEX idx_scan_logs_user_date ON user_scan_logs(user_id, created_at);
CREATE UNIQUE INDEX idx_scan_logs_content ON user_scan_logs(user_id, content_hash);
```

### Edge Function: `scan-api-user`

- **Auth**: Xác thực user đã đăng nhập (KHÔNG yêu cầu admin)
- **Rate limit**: Check DB — max 2 scans/ngày/user
- **Dedup**: Hash nội dung base64 → kiểm tra `user_scan_logs.content_hash`
- **Endpoints**:
  - `user-scan-image` — Nhận base64 image → Vision OCR → trả text
  - `user-scan-status` — Check số lần scan còn lại hôm nay
  - `user-generate-lesson` — Gọi Gemini format-content → tạo course/lesson/vocab/quiz vào DB

### Frontend: `src/features/scan/`

```
src/features/scan/
  ├─ pages/
  │   └─ SmartScanPage.tsx        -- Trang chính (thư mục + scan + kết quả)
  ├─ components/
  │   ├─ FolderList.tsx           -- Danh sách thư mục + tạo mới
  │   ├─ FolderDocuments.tsx      -- Danh sách tài liệu trong thư mục
  │   ├─ DocumentUploader.tsx     -- Upload ảnh/PDF + camera
  │   ├─ ScanResultView.tsx       -- Hiển thị OCR text + nút AI generate
  │   └─ GeneratingOverlay.tsx    -- Loading overlay khi AI đang tạo
  └─ stores/
      └─ scanStore.ts            -- Zustand store
```

### Reuse LessonStudyPage

Bài tập cá nhân sẽ được lưu dưới dạng `courses(is_personal=true)` + `lessons` + `vocabulary` + `quizzes`. User xem bài tập qua chính `LessonStudyPage` hiện tại — cần sửa nhỏ để bỏ XP cho `is_personal` courses.

## Anti-spam

| Cơ chế | Chi tiết |
|--------|----------|
| **Rate limit** | Max 2 scans/ngày/user — check `user_scan_logs` WHERE `created_at >= today` |
| **Content dedup** | SHA-256 hash base64 content → UNIQUE index `(user_id, content_hash)` |
| **Server-side enforce** | Cả 2 check ở `scan-api-user`, không tin client |

## XP & SRS

- **XP**: Bài tập từ scan **KHÔNG** tính XP (check `course.is_personal` trước khi award)
- **SRS**: User vẫn thêm vocabulary vào SRS deck cá nhân, SM-2 hoạt động bình thường

## Điểm cần lưu ý

> [!IMPORTANT]
> `scan-api-user` cần xác thực user thường (không phải admin). Tách biệt hoàn toàn với `scan-api` admin.

> [!WARNING]
> Cần hash content phía server (edge function) để tránh client gửi hash giả.
