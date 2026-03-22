-- =============================================
-- SEED: Khóa học 12 Thì trong Tiếng Anh (English Tenses)
-- =============================================

-- 1. Category
INSERT INTO categories (id, name, slug, description, icon_url, order_index)
VALUES (
  'cat-grammar-001',
  'Ngữ pháp (Grammar)',
  'grammar',
  'Các khóa học về ngữ pháp tiếng Anh từ cơ bản đến nâng cao',
  NULL,
  1
) ON CONFLICT (id) DO NOTHING;

-- 2. Course
INSERT INTO courses (id, category_id, title, slug, description, difficulty_level, source_type, is_published, is_personal, order_index, estimated_time_minutes, created_by)
VALUES (
  'course-tenses-001',
  'cat-grammar-001',
  '12 Thì trong Tiếng Anh (English Tenses)',
  '12-thi-tieng-anh',
  'Khóa học tổng hợp đầy đủ 12 thì trong tiếng Anh: cấu trúc, cách dùng, dấu hiệu nhận biết và bài tập thực hành. Phù hợp cho TOEIC, IELTS và giao tiếp hàng ngày.',
  'A2',
  'manual',
  true,
  false,
  1,
  360,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 3. LESSONS (12 bài - mỗi thì 1 bài)
-- =============================================

-- Lesson 1: Present Simple
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-01', 'course-tenses-001', 'Thì Hiện tại đơn (Present Simple)', 1,
'# Thì Hiện tại đơn (Present Simple Tense)

## Khái niệm
Diễn tả hành động xảy ra thường xuyên, lặp đi lặp lại, thói quen, sự thật hiển nhiên, hoặc các tình huống cố định.

## Cấu trúc
- Khẳng định: S + V(s/es)
- Phủ định: S + do/does + not + V(nguyên mẫu)
- Nghi vấn: Do/Does + S + V(nguyên mẫu)?

## Cách dùng
1. Diễn tả thói quen, hành động lặp lại: I go to school every day.
2. Sự thật hiển nhiên, chân lý: The Earth goes around the Sun.
3. Lịch trình cố định: The train leaves at 9 AM.
4. Sở thích, khả năng: She likes music.

## Dấu hiệu nhận biết
always, usually, often, sometimes, rarely, seldom, never, every day/week/month/year, once/twice a week

## Ví dụ
- I study English every day. (Tôi học tiếng Anh mỗi ngày.)
- She doesn''t like coffee. (Cô ấy không thích cà phê.)
- Do you play football? (Bạn có chơi bóng đá không?)

## Lưu ý
- Thêm -s/-es cho ngôi thứ 3 số ít (he/she/it): He works hard.
- Động từ kết thúc bằng -o, -s, -sh, -ch, -x, -z thêm -es: She watches TV.',
'<h1>Thì Hiện tại đơn (Present Simple)</h1><h2>Cấu trúc</h2><p><strong>Khẳng định:</strong> S + V(s/es)</p><p><strong>Phủ định:</strong> S + do/does + not + V</p><p><strong>Nghi vấn:</strong> Do/Does + S + V?</p>',
'Thì hiện tại đơn dùng để diễn tả thói quen, sự thật hiển nhiên và lịch trình cố định. Dấu hiệu: always, usually, every day.',
'A1');

-- Lesson 2: Present Continuous
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-02', 'course-tenses-001', 'Thì Hiện tại tiếp diễn (Present Continuous)', 2,
'# Thì Hiện tại tiếp diễn (Present Continuous Tense)

## Cấu trúc
- Khẳng định: S + am/is/are + V-ing
- Phủ định: S + am/is/are + not + V-ing
- Nghi vấn: Am/Is/Are + S + V-ing?

## Cách dùng
1. Hành động đang diễn ra tại thời điểm nói: I am reading a book now.
2. Hành động tạm thời: She is staying with her friend this week.
3. Kế hoạch tương lai gần đã sắp xếp: We are meeting tomorrow at 3 PM.
4. Phàn nàn (với always): He is always complaining!

## Dấu hiệu nhận biết
now, right now, at the moment, at present, currently, today, tonight, Look!, Listen!

## Lưu ý
- Các động từ trạng thái không dùng tiếp diễn: know, want, like, love, hate, need, believe, understand
- Bỏ -e trước khi thêm -ing: make → making
- Gấp đôi phụ âm cuối: run → running, sit → sitting',
'<h1>Thì Hiện tại tiếp diễn</h1><p>S + am/is/are + V-ing</p>',
'Thì hiện tại tiếp diễn diễn tả hành động đang xảy ra ngay lúc nói hoặc kế hoạch tương lai gần. Dấu hiệu: now, at the moment, currently.',
'A1');

-- Lesson 3: Present Perfect
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-03', 'course-tenses-001', 'Thì Hiện tại hoàn thành (Present Perfect)', 3,
'# Thì Hiện tại hoàn thành (Present Perfect Tense)

## Cấu trúc
- Khẳng định: S + have/has + V3/ed (past participle)
- Phủ định: S + have/has + not + V3/ed
- Nghi vấn: Have/Has + S + V3/ed?

## Cách dùng
1. Hành động bắt đầu trong quá khứ, kéo dài đến hiện tại: I have lived here for 5 years.
2. Hành động vừa mới xảy ra: She has just finished her homework.
3. Kinh nghiệm, trải nghiệm: He has traveled to Japan twice.
4. Hành động quá khứ không rõ thời gian: I have seen that movie.

## Dấu hiệu nhận biết
already, just, yet, ever, never, recently, lately, so far, up to now, since + mốc thời gian, for + khoảng thời gian

## So sánh với Past Simple
- Present Perfect: I have lost my key. (chưa tìm thấy - liên quan hiện tại)
- Past Simple: I lost my key yesterday. (thời gian cụ thể)',
'<h1>Thì Hiện tại hoàn thành</h1><p>S + have/has + V3/ed</p>',
'Thì HTHT diễn tả hành động bắt đầu trong quá khứ kéo dài đến hiện tại, hoặc kinh nghiệm. Dấu hiệu: already, just, yet, since, for.',
'A2');

-- Lesson 4: Present Perfect Continuous
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-04', 'course-tenses-001', 'Thì Hiện tại hoàn thành tiếp diễn (Present Perfect Continuous)', 4,
'# Thì Hiện tại hoàn thành tiếp diễn

## Cấu trúc
- Khẳng định: S + have/has + been + V-ing
- Phủ định: S + have/has + not + been + V-ing
- Nghi vấn: Have/Has + S + been + V-ing?

## Cách dùng
1. Nhấn mạnh tính liên tục của hành động từ quá khứ đến hiện tại: I have been studying English for 2 hours.
2. Hành động vừa kết thúc, để lại kết quả: She is tired because she has been running.

## Dấu hiệu nhận biết
for + khoảng thời gian, since + mốc thời gian, all day/morning/week, how long...?

## So sánh Present Perfect vs Present Perfect Continuous
- I have read 3 books. (nhấn mạnh kết quả: 3 cuốn)
- I have been reading all day. (nhấn mạnh quá trình: cả ngày)',
'<h1>Thì HTHT Tiếp diễn</h1><p>S + have/has + been + V-ing</p>',
'Nhấn mạnh tính liên tục và kéo dài của hành động từ quá khứ đến hiện tại. Dấu hiệu: for, since, all day, how long.',
'B1');

-- Lesson 5: Past Simple
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-05', 'course-tenses-001', 'Thì Quá khứ đơn (Past Simple)', 5,
'# Thì Quá khứ đơn (Past Simple Tense)

## Cấu trúc
- Khẳng định: S + V2/ed
- Phủ định: S + did + not + V(nguyên mẫu)
- Nghi vấn: Did + S + V(nguyên mẫu)?

## Cách dùng
1. Hành động đã xảy ra và kết thúc trong quá khứ: I visited Paris last year.
2. Chuỗi hành động liên tiếp trong quá khứ: I got up, brushed my teeth, and had breakfast.
3. Thói quen trong quá khứ (không còn): She walked to school when she was young.

## Dấu hiệu nhận biết
yesterday, last night/week/month/year, ago, in 2020, when I was young

## Lưu ý
- Động từ bất quy tắc (irregular verbs): go→went, eat→ate, see→saw, buy→bought, take→took
- Thêm -ed cho động từ có quy tắc: play→played, work→worked',
'<h1>Thì Quá khứ đơn</h1><p>S + V2/ed</p>',
'Diễn tả hành động đã xảy ra và kết thúc trong quá khứ với thời gian xác định. Dấu hiệu: yesterday, last, ago.',
'A1');

-- Lesson 6: Past Continuous
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-06', 'course-tenses-001', 'Thì Quá khứ tiếp diễn (Past Continuous)', 6,
'# Thì Quá khứ tiếp diễn (Past Continuous Tense)

## Cấu trúc
- Khẳng định: S + was/were + V-ing
- Phủ định: S + was/were + not + V-ing
- Nghi vấn: Was/Were + S + V-ing?

## Cách dùng
1. Hành động đang diễn ra tại thời điểm trong quá khứ: I was studying at 8 PM yesterday.
2. Hành động đang diễn ra thì bị xen ngang: I was cooking when the phone rang.
3. Hai hành động xảy ra đồng thời: While I was reading, she was watching TV.
4. Mô tả bối cảnh: The sun was shining and the birds were singing.

## Dấu hiệu nhận biết
at + giờ + thời gian quá khứ, at this time yesterday, while, when',
'<h1>Thì Quá khứ tiếp diễn</h1><p>S + was/were + V-ing</p>',
'Diễn tả hành động đang diễn ra tại một thời điểm trong quá khứ hoặc bị xen ngang. Dấu hiệu: while, when, at that time.',
'A2');

-- Lesson 7: Past Perfect
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-07', 'course-tenses-001', 'Thì Quá khứ hoàn thành (Past Perfect)', 7,
'# Thì Quá khứ hoàn thành (Past Perfect Tense)

## Cấu trúc
- Khẳng định: S + had + V3/ed
- Phủ định: S + had + not + V3/ed
- Nghi vấn: Had + S + V3/ed?

## Cách dùng
1. Hành động xảy ra TRƯỚC một hành động khác trong quá khứ: When I arrived, the train had left.
2. Hành động hoàn tất trước một thời điểm trong quá khứ: By 9 PM, I had finished my homework.

## Dấu hiệu nhận biết
before, after, by the time, when, until, as soon as, already (trong quá khứ)

## Lưu ý
- Dùng Past Perfect cho hành động xảy ra TRƯỚC, Past Simple cho hành động xảy ra SAU
- After she had eaten dinner, she went to bed. (ăn trước → đi ngủ sau)',
'<h1>Thì Quá khứ hoàn thành</h1><p>S + had + V3/ed</p>',
'Diễn tả hành động xảy ra và hoàn tất TRƯỚC một hành động/thời điểm khác trong quá khứ. Dấu hiệu: before, after, by the time.',
'B1');

-- Lesson 8: Past Perfect Continuous
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-08', 'course-tenses-001', 'Thì Quá khứ hoàn thành tiếp diễn (Past Perfect Continuous)', 8,
'# Thì Quá khứ hoàn thành tiếp diễn

## Cấu trúc
- Khẳng định: S + had + been + V-ing
- Phủ định: S + had + not + been + V-ing
- Nghi vấn: Had + S + been + V-ing?

## Cách dùng
1. Nhấn mạnh quá trình kéo dài trước một hành động quá khứ: She had been waiting for 2 hours before he arrived.
2. Nguyên nhân của sự việc trong quá khứ: He was tired because he had been working all day.

## Dấu hiệu nhận biết
for + khoảng thời gian, since + mốc thời gian, by the time + past simple, until then, all day/morning',
'<h1>Thì QKHT Tiếp diễn</h1><p>S + had + been + V-ing</p>',
'Nhấn mạnh tính liên tục, kéo dài của hành động trước một mốc quá khứ. Dấu hiệu: for, since, by the time.',
'B1');

-- Lesson 9: Future Simple
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-09', 'course-tenses-001', 'Thì Tương lai đơn (Future Simple)', 9,
'# Thì Tương lai đơn (Future Simple Tense)

## Cấu trúc
- Khẳng định: S + will + V(nguyên mẫu)
- Phủ định: S + will + not (won''t) + V
- Nghi vấn: Will + S + V?

## Cách dùng
1. Quyết định tức thời: I''ll help you. (vừa quyết định)
2. Dự đoán không có căn cứ: I think it will rain tomorrow.
3. Lời hứa: I will always love you.
4. Đề nghị, lời mời: Will you marry me?

## Dấu hiệu nhận biết
tomorrow, next week/month/year, in the future, soon, I think/believe/hope, probably

## So sánh will vs be going to
- Will: quyết định tức thời, dự đoán chung
- Be going to: kế hoạch đã có, dự đoán có căn cứ (Look at the clouds! It''s going to rain.)',
'<h1>Thì Tương lai đơn</h1><p>S + will + V</p>',
'Diễn tả quyết định tức thời, dự đoán, lời hứa về tương lai. Dấu hiệu: tomorrow, next, I think, probably.',
'A1');

-- Lesson 10: Future Continuous
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-10', 'course-tenses-001', 'Thì Tương lai tiếp diễn (Future Continuous)', 10,
'# Thì Tương lai tiếp diễn (Future Continuous Tense)

## Cấu trúc
- Khẳng định: S + will + be + V-ing
- Phủ định: S + will + not + be + V-ing
- Nghi vấn: Will + S + be + V-ing?

## Cách dùng
1. Hành động sẽ đang diễn ra tại thời điểm xác định trong tương lai: At 8 PM tomorrow, I will be watching a movie.
2. Hành động chắc chắn sẽ xảy ra theo kế hoạch: I will be traveling to Hanoi next Monday.
3. Hỏi lịch kế hoạch lịch sự: Will you be using the car tonight?

## Dấu hiệu nhận biết
at this time tomorrow, at + giờ + thời gian tương lai, when, while (tương lai)',
'<h1>Thì Tương lai tiếp diễn</h1><p>S + will + be + V-ing</p>',
'Diễn tả hành động sẽ đang diễn ra tại một thời điểm xác định trong tương lai. Dấu hiệu: at this time tomorrow.',
'B1');

-- Lesson 11: Future Perfect
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-11', 'course-tenses-001', 'Thì Tương lai hoàn thành (Future Perfect)', 11,
'# Thì Tương lai hoàn thành (Future Perfect Tense)

## Cấu trúc
- Khẳng định: S + will + have + V3/ed
- Phủ định: S + will + not + have + V3/ed
- Nghi vấn: Will + S + have + V3/ed?

## Cách dùng
1. Hành động sẽ hoàn thành trước một thời điểm tương lai: By next month, I will have finished this project.
2. Hành động hoàn thành trước một hành động khác trong tương lai: I will have eaten dinner before you arrive.

## Dấu hiệu nhận biết
by + thời gian tương lai, by the time, before + thời gian tương lai, by then, by the end of',
'<h1>Thì Tương lai hoàn thành</h1><p>S + will + have + V3/ed</p>',
'Diễn tả hành động sẽ hoàn thành trước một thời điểm/hành động trong tương lai. Dấu hiệu: by next month, by the time.',
'B2');

-- Lesson 12: Future Perfect Continuous
INSERT INTO lessons (id, course_id, title, order_index, raw_content, processed_content, ai_summary, difficulty_level) VALUES
('les-tense-12', 'course-tenses-001', 'Thì Tương lai hoàn thành tiếp diễn (Future Perfect Continuous)', 12,
'# Thì Tương lai hoàn thành tiếp diễn

## Cấu trúc
- Khẳng định: S + will + have + been + V-ing
- Phủ định: S + will + not + have + been + V-ing
- Nghi vấn: Will + S + have + been + V-ing?

## Cách dùng
1. Nhấn mạnh quá trình kéo dài đến một thời điểm tương lai: By 5 PM, I will have been working for 8 hours.
2. Nhấn mạnh khoảng thời gian liên tục: By next year, she will have been teaching for 20 years.

## Dấu hiệu nhận biết
for + khoảng thời gian + by + thời điểm tương lai, by the time, by the end of

## Lưu ý
Đây là thì ít dùng nhất trong 12 thì nhưng vẫn cần nắm cho TOEIC/IELTS.',
'<h1>Thì TL HT Tiếp diễn</h1><p>S + will + have + been + V-ing</p>',
'Nhấn mạnh quá trình liên tục kéo dài đến một thời điểm trong tương lai. Thì ít dùng nhất nhưng cần cho TOEIC/IELTS.',
'B2')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 4. QUIZZES (1 quiz cho mỗi lesson)
-- =============================================

INSERT INTO quizzes (id, lesson_id, title, quiz_type, time_limit_seconds, passing_score, order_index) VALUES
('quiz-tense-01', 'les-tense-01', 'Kiểm tra: Present Simple', 'multiple_choice', 300, 70, 1),
('quiz-tense-02', 'les-tense-02', 'Kiểm tra: Present Continuous', 'multiple_choice', 300, 70, 1),
('quiz-tense-03', 'les-tense-03', 'Kiểm tra: Present Perfect', 'multiple_choice', 300, 70, 1),
('quiz-tense-04', 'les-tense-04', 'Kiểm tra: Present Perfect Continuous', 'multiple_choice', 300, 70, 1),
('quiz-tense-05', 'les-tense-05', 'Kiểm tra: Past Simple', 'multiple_choice', 300, 70, 1),
('quiz-tense-06', 'les-tense-06', 'Kiểm tra: Past Continuous', 'multiple_choice', 300, 70, 1),
('quiz-tense-07', 'les-tense-07', 'Kiểm tra: Past Perfect', 'multiple_choice', 300, 70, 1),
('quiz-tense-08', 'les-tense-08', 'Kiểm tra: Past Perfect Continuous', 'multiple_choice', 300, 70, 1),
('quiz-tense-09', 'les-tense-09', 'Kiểm tra: Future Simple', 'multiple_choice', 300, 70, 1),
('quiz-tense-10', 'les-tense-10', 'Kiểm tra: Future Continuous', 'multiple_choice', 300, 70, 1),
('quiz-tense-11', 'les-tense-11', 'Kiểm tra: Future Perfect', 'multiple_choice', 300, 70, 1),
('quiz-tense-12', 'les-tense-12', 'Kiểm tra: Future Perfect Continuous', 'multiple_choice', 300, 70, 1)
ON CONFLICT (id) DO NOTHING;
