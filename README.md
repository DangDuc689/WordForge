# Vocab Siege

Ứng dụng học từ vựng cá nhân theo phong cách typing tower-defense. Bản prototype gốc vẫn nằm ở [`vocab-siege.html`](./vocab-siege.html); app mới nằm trong `src/`.

## Chạy local

```sh
npm install
npm run dev
```

Không có biến môi trường Supabase, app tự chạy local-first bằng `localStorage` với bộ 72 từ mẫu. Tạo `.env.local` từ `.env.example` để bật Supabase Auth/Cloud:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Kiểm tra

```sh
npm run typecheck
npm test -- --run
npm run build
```

## Supabase và AI

1. Chạy `supabase/migrations/0001_vocab_siege.sql` trong SQL editor.
2. Bật email magic-link/OTP và chỉ invite email cá nhân.
3. Deploy hai Edge Functions trong `supabase/functions/`.
4. Đặt `GEMINI_API_KEY` và tùy chọn `GEMINI_MODEL` trong Supabase secrets; mặc định model là `gemini-3.1-flash-lite`.

Frontend chỉ dùng publishable key. Gemini key chỉ được đọc trong Edge Functions. Nếu AI không cấu hình hoặc hết quota, các luồng nhập thủ công, SRS và game vẫn hoạt động.

## Sinh catalog Oxford 3000 cá nhân

Tính năng nhập Oxford dùng catalog JSON đã sinh trước; AI không được gọi khi người dùng nhập hoặc học. Không đặt `GEMINI_API_KEY` trong biến `VITE_*` và không commit khóa.

```powershell
python -m pip install pypdf
npm run oxford:extract -- C:\duong-dan\American_Oxford_3000_by_CEFR_level.pdf C:\tmp\oxford-3000-us.txt
$env:GEMINI_API_KEY='YOUR_KEY'
npm run oxford:generate -- C:\tmp\oxford-3000-us.txt
npm run oxford:validate
```

Generator lưu checkpoint sau từng batch nên có thể chạy lại khi gặp giới hạn quota. Chỉ `manifest.json` có `ready: true` mới mở nút nhập trên giao diện. Headword/CEFR dựa trên Oxford 3000; nghĩa Việt, IPA và ví dụ được tạo riêng. Catalog này chỉ dành cho deployment cá nhân/riêng tư; nếu phát hành công khai hoặc thương mại, cần xác minh quyền sử dụng với OUP trước.

## Deploy Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Thêm hai biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` trong Pages settings.

PWA service worker và manifest được tạo tự động bởi `vite-plugin-pwa`.
