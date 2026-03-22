-- =============================================
-- SEED: Quiz Questions cho 12 Thì Tiếng Anh
-- Mỗi quiz có 5 câu hỏi trắc nghiệm
-- =============================================

-- Quiz 1: Present Simple (5 câu)
INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options, correct_answer, explanation, order_index) VALUES
('qq-t01-01', 'quiz-tense-01', 'She ___ to school every day.', 'multiple_choice', '["go","goes","going","gone"]', 'goes', 'Ngôi thứ 3 số ít (she) → thêm -es/-s: goes', 1),
('qq-t01-02', 'quiz-tense-01', 'They ___ not like coffee.', 'multiple_choice', '["does","do","are","is"]', 'do', 'They (số nhiều) → dùng do not', 2),
('qq-t01-03', 'quiz-tense-01', '___ your father work in a hospital?', 'multiple_choice', '["Do","Does","Is","Are"]', 'Does', 'Your father (ngôi 3 số ít) → Does', 3),
('qq-t01-04', 'quiz-tense-01', 'Water ___ at 100 degrees Celsius.', 'multiple_choice', '["boil","boils","is boiling","boiled"]', 'boils', 'Sự thật khoa học → Present Simple. Water (số ít) → boils', 4),
('qq-t01-05', 'quiz-tense-01', 'Dấu hiệu nào KHÔNG thuộc thì hiện tại đơn?', 'multiple_choice', '["always","every day","right now","usually"]', 'right now', 'right now → dấu hiệu của thì hiện tại tiếp diễn', 5),

-- Quiz 2: Present Continuous (5 câu)
('qq-t02-01', 'quiz-tense-02', 'Look! The children ___ in the garden.', 'multiple_choice', '["play","plays","are playing","played"]', 'are playing', 'Look! → hành động đang xảy ra → Present Continuous', 1),
('qq-t02-02', 'quiz-tense-02', 'She ___ (not/watch) TV right now.', 'multiple_choice', '["doesn''t watch","isn''t watching","hasn''t watched","didn''t watch"]', 'isn''t watching', 'right now → Present Continuous phủ định: isn''t watching', 2),
('qq-t02-03', 'quiz-tense-02', 'Động từ nào KHÔNG dùng ở thì tiếp diễn?', 'multiple_choice', '["run","eat","know","play"]', 'know', 'know là động từ trạng thái (stative verb), không dùng ở tiếp diễn', 3),
('qq-t02-04', 'quiz-tense-02', 'I ___ a book at the moment.', 'multiple_choice', '["read","reads","am reading","have read"]', 'am reading', 'at the moment → Present Continuous: am reading', 4),
('qq-t02-05', 'quiz-tense-02', 'We ___ to Paris next week. (kế hoạch đã sắp xếp)', 'multiple_choice', '["fly","are flying","will fly","flew"]', 'are flying', 'Kế hoạch đã sắp xếp trong tương lai gần → Present Continuous', 5),

-- Quiz 3: Present Perfect (5 câu)
('qq-t03-01', 'quiz-tense-03', 'I ___ never ___ to Japan.', 'multiple_choice', '["have/been","has/been","have/be","did/been"]', 'have/been', 'I + have + never + been (V3) → Present Perfect', 1),
('qq-t03-02', 'quiz-tense-03', 'She ___ just finished her homework.', 'multiple_choice', '["have","has","had","is"]', 'has', 'She (ngôi 3 số ít) + has + just + V3', 2),
('qq-t03-03', 'quiz-tense-03', 'They ___ here since 2020.', 'multiple_choice', '["live","lived","have lived","are living"]', 'have lived', 'since 2020 → Present Perfect: have lived', 3),
('qq-t03-04', 'quiz-tense-03', 'Câu nào đúng ngữ pháp?', 'multiple_choice', '["I have seen him yesterday.","I saw him yesterday.","I have saw him.","I seen him yesterday."]', 'I saw him yesterday.', 'yesterday = thời gian cụ thể → dùng Past Simple, không dùng Present Perfect', 4),
('qq-t03-05', 'quiz-tense-03', 'He ___ three books so far.', 'multiple_choice', '["reads","read","has read","is reading"]', 'has read', 'so far → Present Perfect: has read', 5),

-- Quiz 4: Present Perfect Continuous (5 câu)
('qq-t04-01', 'quiz-tense-04', 'I ___ for two hours.', 'multiple_choice', '["have been studying","have studied","am studying","studied"]', 'have been studying', 'for two hours + nhấn mạnh quá trình → Present Perfect Continuous', 1),
('qq-t04-02', 'quiz-tense-04', 'Cấu trúc đúng của thì HTHT tiếp diễn là gì?', 'multiple_choice', '["S + have/has + V3","S + have/has + been + V-ing","S + had + been + V-ing","S + will + have + been + V-ing"]', 'S + have/has + been + V-ing', 'HTHT tiếp diễn: S + have/has + been + V-ing', 2),
('qq-t04-03', 'quiz-tense-04', 'She is tired because she ___ all morning.', 'multiple_choice', '["runs","ran","has been running","is running"]', 'has been running', 'Hành động kéo dài gây ra kết quả hiện tại → Present Perfect Continuous', 3),
('qq-t04-04', 'quiz-tense-04', 'How long ___ you ___ here?', 'multiple_choice', '["have/been waiting","are/waiting","did/wait","do/wait"]', 'have/been waiting', 'How long + nhấn mạnh thời gian → have been waiting', 4),
('qq-t04-05', 'quiz-tense-04', 'It ___ since morning.', 'multiple_choice', '["rains","rained","has been raining","is raining"]', 'has been raining', 'since morning → hành động kéo dài từ quá khứ đến hiện tại → HTHT tiếp diễn', 5),

-- Quiz 5: Past Simple (5 câu)
('qq-t05-01', 'quiz-tense-05', 'She ___ to the store yesterday.', 'multiple_choice', '["go","goes","went","has gone"]', 'went', 'yesterday → Past Simple. go → went (bất quy tắc)', 1),
('qq-t05-02', 'quiz-tense-05', 'They ___ not enjoy the movie last night.', 'multiple_choice', '["do","did","have","are"]', 'did', 'last night → Past Simple phủ định: did not', 2),
('qq-t05-03', 'quiz-tense-05', '___ you see her at the party?', 'multiple_choice', '["Do","Did","Have","Are"]', 'Did', 'Nghi vấn Past Simple: Did + S + V?', 3),
('qq-t05-04', 'quiz-tense-05', 'I ___ my homework and then ___ to bed.', 'multiple_choice', '["finish/go","finished/went","have finished/went","finishing/going"]', 'finished/went', 'Chuỗi hành động liên tiếp trong quá khứ → Past Simple', 4),
('qq-t05-05', 'quiz-tense-05', 'Dạng quá khứ đơn của "buy" là gì?', 'multiple_choice', '["buyed","buied","bought","buyed"]', 'bought', 'buy → bought (động từ bất quy tắc)', 5),

-- Quiz 6: Past Continuous (5 câu)
('qq-t06-01', 'quiz-tense-06', 'I ___ when the phone rang.', 'multiple_choice', '["sleep","slept","was sleeping","have slept"]', 'was sleeping', 'Hành động đang diễn ra bị xen ngang → was sleeping (QKTD) + rang (QKĐ)', 1),
('qq-t06-02', 'quiz-tense-06', 'At 8 PM yesterday, they ___ dinner.', 'multiple_choice', '["have","had","were having","are having"]', 'were having', 'At 8 PM yesterday → thời điểm cụ thể trong quá khứ → Past Continuous', 2),
('qq-t06-03', 'quiz-tense-06', 'While she ___, he was reading.', 'multiple_choice', '["cooks","cooked","was cooking","has cooked"]', 'was cooking', 'While + Past Continuous → hai hành động đồng thời', 3),
('qq-t06-04', 'quiz-tense-06', 'Chọn câu đúng:', 'multiple_choice', '["I was study at 9 PM.","I was studying at 9 PM.","I studying at 9 PM.","I were studying at 9 PM."]', 'I was studying at 9 PM.', 'I + was + V-ing → I was studying', 4),
('qq-t06-05', 'quiz-tense-06', 'Dấu hiệu nào thuộc thì quá khứ tiếp diễn?', 'multiple_choice', '["yesterday","last week","while","ago"]', 'while', 'while → dấu hiệu của Past Continuous', 5),

-- Quiz 7: Past Perfect (5 câu)
('qq-t07-01', 'quiz-tense-07', 'When I arrived, the movie ___.', 'multiple_choice', '["starts","started","had started","has started"]', 'had started', 'Phim bắt đầu TRƯỚC khi tôi đến → Past Perfect', 1),
('qq-t07-02', 'quiz-tense-07', 'She ___ dinner before he came.', 'multiple_choice', '["cooked","had cooked","has cooked","was cooking"]', 'had cooked', 'before + Past Simple → hành động trước dùng Past Perfect', 2),
('qq-t07-03', 'quiz-tense-07', 'After they ___ the test, they left.', 'multiple_choice', '["finish","finished","had finished","have finished"]', 'had finished', 'After + hành động trước → Past Perfect: had finished', 3),
('qq-t07-04', 'quiz-tense-07', 'Cấu trúc Past Perfect:', 'multiple_choice', '["S + have + V3","S + had + V3","S + has + V3","S + was + V3"]', 'S + had + V3', 'Past Perfect: S + had + V3/ed', 4),
('qq-t07-05', 'quiz-tense-07', 'By the time we got there, the train ___.', 'multiple_choice', '["left","has left","had left","leaves"]', 'had left', 'By the time + Past Simple → hành động hoàn tất trước → Past Perfect', 5),

-- Quiz 8: Past Perfect Continuous (5 câu)
('qq-t08-01', 'quiz-tense-08', 'She ___ for 2 hours before he arrived.', 'multiple_choice', '["waited","was waiting","had been waiting","has been waiting"]', 'had been waiting', 'for 2 hours + before hành động quá khứ → Past Perfect Continuous', 1),
('qq-t08-02', 'quiz-tense-08', 'He was tired because he ___ all day.', 'multiple_choice', '["worked","was working","had been working","has worked"]', 'had been working', 'Nguyên nhân kéo dài trước kết quả quá khứ → Past Perfect Continuous', 2),
('qq-t08-03', 'quiz-tense-08', 'Cấu trúc: S + ___ + been + V-ing', 'multiple_choice', '["have","has","had","will"]', 'had', 'Past Perfect Continuous: S + had + been + V-ing', 3),
('qq-t08-04', 'quiz-tense-08', 'They ___ for hours before the bus came.', 'multiple_choice', '["have been driving","had been driving","were driving","drove"]', 'had been driving', 'for hours + before hành động quá khứ → had been driving', 4),
('qq-t08-05', 'quiz-tense-08', 'By the time she graduated, she ___ English for 10 years.', 'multiple_choice', '["studied","had been studying","has studied","was studying"]', 'had been studying', 'By the time + nhấn mạnh khoảng thời gian kéo dài → Past Perfect Continuous', 5),

-- Quiz 9: Future Simple (5 câu)
('qq-t09-01', 'quiz-tense-09', 'I think it ___ tomorrow.', 'multiple_choice', '["rains","rained","will rain","is raining"]', 'will rain', 'I think + dự đoán tương lai → will rain', 1),
('qq-t09-02', 'quiz-tense-09', 'Don''t worry, I ___ you.', 'multiple_choice', '["help","helped","will help","am helping"]', 'will help', 'Quyết định tức thời, lời hứa → will help', 2),
('qq-t09-03', 'quiz-tense-09', '___ you come to the party?', 'multiple_choice', '["Do","Did","Will","Are"]', 'Will', 'Nghi vấn Future Simple: Will + S + V?', 3),
('qq-t09-04', 'quiz-tense-09', 'She ___ not be here tomorrow.', 'multiple_choice', '["do","does","will","is"]', 'will', 'Phủ định Future Simple: S + will + not + V', 4),
('qq-t09-05', 'quiz-tense-09', 'Khi nào dùng "be going to" thay vì "will"?', 'multiple_choice', '["Quyết định tức thời","Kế hoạch đã có sẵn","Lời hứa","Đề nghị"]', 'Kế hoạch đã có sẵn', 'be going to → kế hoạch đã có. will → quyết định tức thời', 5),

-- Quiz 10: Future Continuous (5 câu)
('qq-t10-01', 'quiz-tense-10', 'At 8 PM tomorrow, I ___ TV.', 'multiple_choice', '["watch","will watch","will be watching","am watching"]', 'will be watching', 'At 8 PM tomorrow → thời điểm xác định trong tương lai → Future Continuous', 1),
('qq-t10-02', 'quiz-tense-10', 'This time next week, we ___ on the beach.', 'multiple_choice', '["lie","will lie","will be lying","are lying"]', 'will be lying', 'This time next week → Future Continuous: will be lying', 2),
('qq-t10-03', 'quiz-tense-10', 'Cấu trúc Future Continuous:', 'multiple_choice', '["S + will + V","S + will + be + V-ing","S + will + have + V3","S + will + have been + V-ing"]', 'S + will + be + V-ing', 'Future Continuous: S + will + be + V-ing', 3),
('qq-t10-04', 'quiz-tense-10', '___ you ___ the car tonight?', 'multiple_choice', '["Will/use","Will/be using","Do/use","Are/using"]', 'Will/be using', 'Hỏi lịch kế hoạch lịch sự → Future Continuous', 4),
('qq-t10-05', 'quiz-tense-10', 'Dấu hiệu nào thuộc thì tương lai tiếp diễn?', 'multiple_choice', '["yesterday","by next month","at this time tomorrow","last week"]', 'at this time tomorrow', 'at this time tomorrow → dấu hiệu Future Continuous', 5),

-- Quiz 11: Future Perfect (5 câu)
('qq-t11-01', 'quiz-tense-11', 'By next month, I ___ this project.', 'multiple_choice', '["finish","will finish","will have finished","am finishing"]', 'will have finished', 'By next month → hoàn thành trước thời điểm tương lai → Future Perfect', 1),
('qq-t11-02', 'quiz-tense-11', 'She ___ the book before the exam.', 'multiple_choice', '["reads","will read","will have read","is reading"]', 'will have read', 'before + sự kiện tương lai → hoàn thành trước → Future Perfect', 2),
('qq-t11-03', 'quiz-tense-11', 'Cấu trúc Future Perfect:', 'multiple_choice', '["S + will + V","S + will + be + V-ing","S + will + have + V3","S + had + V3"]', 'S + will + have + V3', 'Future Perfect: S + will + have + V3/ed', 3),
('qq-t11-04', 'quiz-tense-11', 'By the end of this year, they ___ married for 10 years.', 'multiple_choice', '["are","were","will be","will have been"]', 'will have been', 'By the end of + tương lai → Future Perfect: will have been', 4),
('qq-t11-05', 'quiz-tense-11', 'Dấu hiệu nào thuộc Future Perfect?', 'multiple_choice', '["right now","at this time tomorrow","by next week","while"]', 'by next week', 'by + thời gian tương lai → dấu hiệu Future Perfect', 5),

-- Quiz 12: Future Perfect Continuous (5 câu)
('qq-t12-01', 'quiz-tense-12', 'By 5 PM, I ___ for 8 hours.', 'multiple_choice', '["work","will work","will have worked","will have been working"]', 'will have been working', 'By 5 PM + for 8 hours + nhấn mạnh quá trình → Future Perfect Continuous', 1),
('qq-t12-02', 'quiz-tense-12', 'Cấu trúc Future Perfect Continuous:', 'multiple_choice', '["S + will + have + V3","S + will + have + been + V-ing","S + had + been + V-ing","S + will + be + V-ing"]', 'S + will + have + been + V-ing', 'Future Perfect Continuous: S + will + have + been + V-ing', 2),
('qq-t12-03', 'quiz-tense-12', 'By next year, she ___ English for 5 years.', 'multiple_choice', '["teaches","will teach","will have taught","will have been teaching"]', 'will have been teaching', 'By next year + for 5 years + nhấn mạnh kéo dài → Future Perfect Continuous', 3),
('qq-t12-04', 'quiz-tense-12', 'Thì nào ít được sử dụng nhất trong 12 thì?', 'multiple_choice', '["Present Simple","Past Perfect","Future Perfect Continuous","Present Continuous"]', 'Future Perfect Continuous', 'Future Perfect Continuous là thì ít dùng nhất', 4),
('qq-t12-05', 'quiz-tense-12', 'By the time he retires, he ___ here for 30 years.', 'multiple_choice', '["works","will work","will have worked","will have been working"]', 'will have been working', 'By the time + for 30 years + nhấn mạnh quá trình kéo dài → Future Perfect Continuous', 5)
ON CONFLICT (id) DO NOTHING;
