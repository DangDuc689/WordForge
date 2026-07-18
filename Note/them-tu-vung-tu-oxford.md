# Thêm Oxford 3000 phục vụ TOEIC

## Tóm tắt

- Dùng bản Oxford 3000 Anh–Mỹ, chia thành bốn bộ: `Oxford 3000 · A1`, `A2`, `B1`, `B2`.
- Người dùng chọn cấp độ cần nhập; mặc định học “Tất cả bộ từ” nên các từ mới tự tham gia luồng học hiện tại.
- Mỗi từ loại trở thành một thẻ riêng; vì vậy tổng số thẻ sẽ lớn hơn 3.000.
- Chỉ lấy headword, từ loại và CEFR từ [danh sách Oxford chính thức](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000). Nghĩa Việt, IPA và ví dụ được tạo riêng, không sao chép nội dung từ điển Oxford.
- Dùng Anh–Mỹ làm chính, thêm chính tả Anh–Anh vào đáp án được chấp nhận. TOEIC vẫn cần luyện nhiều giọng Anh, Mỹ, Canada và Úc theo [tài liệu ETS](https://www.cn.ets.org/content/dam/ets-org/pdfs/toeic/toeic-listening-reading-can-do-guide.pdf).

## Dữ liệu và mô hình

- Viết pipeline một lần để:
  - Đọc PDF Oxford 3000 American, giữ lại CEFR và gợi ý phân biệt nghĩa như `bank (money)`.
  - Tách `answer n., v.` thành hai thẻ noun/verb với `sourceKey` riêng.
  - Dùng Gemini ngoài runtime để tạo nghĩa Việt ngắn, IPA Mỹ, ví dụ tự nhiên theo ngữ cảnh TOEIC/công sở và bản dịch.
  - Kiểm tra schema, mục trùng, trường trống, CEFR sai và lập báo cáo riêng cho homograph hoặc mục cần duyệt thủ công.
- Xuất JSON có phiên bản, tách theo A1–B2 để tải theo nhu cầu. API key chỉ dùng khi sinh dữ liệu, không đưa vào frontend.
- Ánh xạ tier: A1 → T1, A2 → T2, B1/B2 → T3.
- Mở rộng `PartOfSpeech` cho pronoun, determiner, preposition, conjunction, interjection, numeral, modal và auxiliary.
- Thêm `source` và `sourceKey` vào `Deck` và `VocabularyItem`; dữ liệu cũ mặc định là `manual` hoặc `starter`.
- Migration Supabase thêm các cột metadata và unique index theo người dùng/source key, giúp nhập lại cùng cấp độ không sinh bản sao.
- Cho phép cùng headword tồn tại trong Starter, bộ cá nhân và Oxford; chỉ ngăn nhập lại đúng thẻ Oxford. Không ghi đè nội dung đã sửa hoặc tiến độ cũ.

## Luồng nhập và khả năng mở rộng

- Thêm nút “Nhập Oxford 3000” trong Kho từ vựng, mở modal hiển thị A1–B2, số thẻ, trạng thái đã nhập và nguồn dữ liệu.
- Khi nhập:
  - Tạo hoặc tìm lại đúng deck CEFR bằng `sourceKey`.
  - Ghi dữ liệu theo batch và hiển thị tiến độ.
  - Trả kết quả `{created, skipped, failed}`; lỗi giữa chừng được phép nhập lại để bổ sung phần còn thiếu.
- Bổ sung `saveWords()` ở repository và `importOxfordLevels()` ở AppContext:
  - localStorage chỉ ghi snapshot một lần cho mỗi batch.
  - Supabase upsert theo lô nhỏ, tránh hàng nghìn request riêng lẻ.
- Sửa CloudRepository tải dữ liệu theo trang cho vocabulary, cards và các collection liên quan. Supabase mặc định giới hạn 1.000 dòng nên query hiện tại sẽ thiếu dữ liệu sau khi nhập Oxford 3000; dùng `range()` với thứ tự ổn định để đọc hết. [Supabase pagination](https://supabase.com/docs/reference/javascript/using-modifiers-range)
- Phân trang bảng từ vựng khoảng 100 dòng/trang và dùng Set/Map cho tra cứu thẻ học nhằm tránh render hoặc quét lặp toàn bộ vài nghìn mục.
- Khi xóa deck ở local mode, xóa đồng bộ vocabulary, SRS cards và review liên quan để khớp cascade của Supabase.
- Ghi nguồn và tuyên bố không liên kết với OUP trong modal/deck. Vì phạm vi là cá nhân, triển khai phải nằm sau lớp truy cập riêng tư; nếu chuyển sang công khai hoặc thương mại thì dừng phát hành catalog cho tới khi xác minh quyền OUP.

## Kiểm thử

- Parser xử lý đúng nhiều từ loại, cụm từ, homograph, sense hint và biến thể Anh–Mỹ/Anh–Anh.
- Validator bảo đảm mọi thẻ có nghĩa Việt, IPA, ví dụ, CEFR, tier và `sourceKey` duy nhất.
- Nhập A1 tạo đúng deck và số thẻ; nhập lại không nhân đôi; nhập A2 không ảnh hưởng A1.
- Từ trùng với Starter vẫn tồn tại ở cả hai deck như yêu cầu.
- Import lỗi một phần có thể chạy lại mà không mất tiến độ hoặc ghi đè thẻ đã sửa.
- Cloud load trả đủ hơn 1.000 vocabulary/cards; localStorage và backup cũ vẫn tương thích.
- Bộ lọc, học tất cả deck, học riêng từng deck, game, AI enrichment và xóa deck tiếp tục hoạt động.
- Chạy `typecheck`, toàn bộ Vitest và production build.

## Giả định

- Dùng Oxford 3000 A1–B2, không thêm Oxford 5000 trong đợt này.
- Dữ liệu sinh sẵn bằng Gemini hiện có, sau đó kiểm tra tự động và duyệt các mục mơ hồ; không gọi AI khi người dùng nhập bộ từ.
- Ví dụ ưu tiên ngữ cảnh TOEIC/công việc khi tự nhiên, không ép mọi từ vào câu công sở.
- Chưa xử lý việc một headword xuất hiện ở nhiều deck trong hàng đợi học; hành vi hiện tại là học tất cả các thẻ đó.
