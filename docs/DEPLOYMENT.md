# Hướng dẫn triển khai — FPT Event Attendance

Tài liệu cho đội tiếp nhận dự án. Repo gồm hai project độc lập, không có `package.json` ở gốc:

| Thư mục | Công nghệ | Triển khai trên |
|---|---|---|
| `backend/` | Node ≥ 18, Express, Prisma 5 | **Render** (Web Service) |
| `frontend/` | React 18, Vite, Tailwind | **Vercel** |
| — | PostgreSQL | **Supabase** |
| — | Gửi email (OTP, chứng nhận, thiệp mời, nhắc lịch) | **Brevo** |
| — | Giữ backend không ngủ (tuỳ chọn) | **UptimeRobot** |

Cần tạo tài khoản và cài đặt theo đúng thứ tự dưới đây: Supabase → Brevo → Render → Vercel →
cập nhật lại `FRONTEND_URL` → UptimeRobot.

---

## 1. Supabase (cơ sở dữ liệu)

1. Tạo project mới (nên chọn region Singapore cho gần Việt Nam). Ghi lại mật khẩu database.
2. Vào **Project Settings → Database → Connection string**, lấy hai chuỗi:
   - `DATABASE_URL`: **Transaction pooler**, cổng **6543**.
   - `DIRECT_URL`: **Session pooler / direct**, cổng **5432**.

   Mẫu ở `backend/.env.example`. Backend tự thêm `pgbouncer=true&connection_limit=1` vào
   `DATABASE_URL` (`src/lib/prisma.js`), không cần tự gõ.
3. Tạo bảng: mở **SQL Editor**, dán và chạy toàn bộ `backend/prisma/supabase-setup.sql`. File chạy
   lại nhiều lần vẫn an toàn. Mọi bảng có tiền tố `attendance_`.

   Cách khác: chạy `npx prisma db push` trong `backend/` với hai biến trên.
4. File SQL tạo sẵn ba tài khoản mẫu với mật khẩu công khai:

   | Email | Mật khẩu |
   |---|---|
   | `admin@fpt.edu.vn` | `Admin@123` |
   | BTC mẫu | `Btc@123456` |
   | Sinh viên mẫu | `Student@123` |

   **Đổi ngay** mật khẩu admin và BTC sau lần đăng nhập đầu, và xoá tài khoản sinh viên mẫu. Người
   tham gia không có tài khoản: tài khoản STUDENT không đăng nhập được, đây là chủ ý thiết kế.

> **Dữ liệu cũ:** nếu muốn giữ dữ liệu đang chạy (sự kiện, 48 khách của "BTS World Tour", mẫu chứng
> nhận và thiệp — ảnh lưu thẳng trong DB), bên bàn giao cần **export trước khi bàn giao**: Supabase →
> Database → Backups, hoặc `pg_dump` các bảng `attendance_*`. Bên nhận import vào project mới thay vì
> chạy bước 3.

## 2. Brevo (gửi email)

1. Tạo tài khoản. Gói miễn phí khoảng **300 email/ngày**, kiểm tra lại gói thực tế.
2. **Senders, Domains & Dedicated IPs → Senders:** thêm và **xác minh** email gửi đi. Đây là giá trị
   của `BREVO_SENDER_EMAIL`. Nên xác minh cả tên miền (SPF/DKIM) để email không vào thư rác.
3. **SMTP & API → API Keys:** tạo key, dùng cho `BREVO_API_KEY` (dạng `xkeysib-...`).
4. **Security → Authorised IPs:** Brevo có thể chặn API từ IP lạ (lỗi `unrecognised IP address`).
   Có hai cách:
   - Tắt giới hạn IP.
   - Thêm **IP outbound của Render**, xem ở Render → service → **Connect → Outbound**.

   Không xử lý bước này thì backend chạy bình thường nhưng **mọi email đều lỗi**: OTP check-in,
   quên mật khẩu, chứng nhận, thiệp mời, nhắc lịch.

Hệ thống không gửi email tự động theo lịch. Mỗi lượt check-in bằng QR tốn 1 email OTP cho mỗi người
mỗi sự kiện; kiosk khuôn mặt không tốn email. Sự kiện đông người có thể vượt hạn mức gói miễn phí.

## 3. Render (backend)

Tạo **Web Service** từ repo GitHub (hoặc dùng Blueprint với `backend/render.yaml`):

| Mục | Giá trị |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install && npx prisma generate` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Biến môi trường:

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `DATABASE_URL` | ✅ | Chuỗi pooler cổng 6543 (bước 1) |
| `DIRECT_URL` | ✅ | Chuỗi cổng 5432 (bước 1) |
| `JWT_SECRET` | ✅ | Chuỗi ngẫu nhiên ≥ 32 ký tự (`render.yaml` tự sinh) |
| `QR_SECRET` | ✅ | Chuỗi ngẫu nhiên ≥ 32 ký tự, khác `JWT_SECRET` (xem lưu ý bên dưới) |
| `FRONTEND_URL` | ✅ | URL frontend **chính xác**, không có `/` cuối, vd `https://ten-app.vercel.app` |
| `BREVO_API_KEY` | ✅ | Bước 2 |
| `BREVO_SENDER_EMAIL` | ✅ | Email đã xác minh ở bước 2 |
| `BREVO_SENDER_NAME` | | Mặc định `FPT Event System` |
| `NODE_ENV` | | `production` |
| `JWT_EXPIRES_IN` | | Mặc định `1d`; `render.yaml` đang đặt `7d` |
| `PORT` | | Render tự cấp |

Có thêm các biến giới hạn tần suất tuỳ chọn (`CHECKIN_OTP_MAX`, `SCAN_TICKET_MAX`,
`PUBLIC_REGISTER_MAX`…), để trống là dùng giá trị mặc định trong code.

**`FRONTEND_URL` rất quan trọng.** Biến này dùng cho:
- CORS: backend chỉ nhận request từ đúng một origin này.
- Mọi link trong email và QR: link chứng nhận `/chung-nhan/...`, QR thiệp mời `/thiep/<mã>`, link
  báo cáo chia sẻ `/bao-cao/...`, link quét cho tình nguyện viên `/quet/...`.

Đổi tên miền thì phải sửa biến này. **Thiệp mời đã in hoặc đã gửi** mang tên miền cũ sẽ không mở
được nữa.

**`QR_SECRET`** ký mã QR điểm danh, vé quét, thẻ điểm danh OTP và **link chứng nhận**. Dùng secret
mới (khác secret đang chạy) thì các link chứng nhận đã gửi trước đó sẽ hỏng; chứng nhận cấp lại sẽ có
link mới.

Gói miễn phí của Render **ngủ sau ~15 phút không có request**, lần gọi đầu mất 30–60 giây.
Frontend đã tự thử lại (timeout 25 giây), nhưng nên dùng UptimeRobot (bước 5) hoặc gói trả phí cho
ngày diễn ra sự kiện.

## 4. Vercel (frontend)

Import repo, cấu hình:

| Mục | Giá trị |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Env `VITE_API_URL` | URL backend Render, vd `https://ten-backend.onrender.com` (không có `/` cuối) |

- `VITE_API_URL` được gắn vào **lúc build**: đổi giá trị thì phải **Redeploy**.
- `frontend/vercel.json` đã có rewrite SPA (mọi đường dẫn về `index.html`) và header bảo mật.
- Mô hình nhận diện khuôn mặt được chép từ `node_modules/@vladmandic/human` vào `dist/models/human`
  lúc build (plugin trong `vite.config.js`), không cần cài gì thêm.
- Font Inter tải từ Google Fonts; gợi ý địa chỉ khi đặt GPS dùng OpenStreetMap Nominatim. Cả hai
  miễn phí, không cần key.

Sau khi có URL Vercel, quay lại Render cập nhật `FRONTEND_URL` cho đúng. Render sẽ tự deploy lại.

## 5. UptimeRobot (tuỳ chọn, nên có)

Tạo monitor HTTP(s) gọi `https://<backend>.onrender.com/health` mỗi 5 phút. Endpoint này ping luôn
database nên giữ được cả backend lẫn kết nối Supabase.

## 6. Kiểm tra sau triển khai

1. Mở `https://<backend>/health`, phải trả OK.
2. Đăng nhập frontend bằng admin, **đổi mật khẩu**, tạo tài khoản BTC thật.
3. BTC tạo một sự kiện, vào **Danh sách tham gia** → **Thêm người** → dán `email, họ tên`.
4. Mở **Màn QR**, quét bằng điện thoại, nhập email và nhận mã. Đây là bước kiểm tra Brevo; không
   nhận được mã thì xem lại mục 2.4.
5. Kiểm tra email "quên mật khẩu" của tài khoản BTC.

## Chạy ở máy local

```bash
cd backend  && cp .env.example .env   # điền giá trị thật
npm install && npm run db:generate && npm run dev     # cổng 5000
cd frontend && npm install && npm run dev             # cổng 5173, proxy /api → 5000
npm test                                              # ở mỗi thư mục
```

Kiến trúc, quy ước code và các quyết định nghiệp vụ: xem `CLAUDE.md` và `docs/superpowers/specs/`.
