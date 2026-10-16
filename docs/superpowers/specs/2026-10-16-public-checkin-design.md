# Check-in công khai (QR cố định + form tự điền) — thiết kế

Ngày: 2026-10-16 · Trạng thái: đã chốt với product owner

## Vấn đề

Sự kiện mở bên ngoài (triển lãm, ngày hội, gian hàng): người ghé thăm không có tài khoản và
không có trong danh sách nào. Màn chiếu hiện một QR **cố định**, người ghé thăm tự quét bằng điện
thoại, điền vài thông tin là check-in xong.

## Quyết định đã chốt

| Câu hỏi | Chốt |
|---|---|
| Kiểu sự kiện | Kiểu riêng `PUBLIC` ("Check-in công khai"), chọn lúc tạo, không đổi được |
| Thông tin điền | BTC tự dựng form. Họ tên luôn có, bắt buộc. Trường có sẵn (SĐT, Email, MSSV, Trường/Đơn vị, Chức vụ) + câu hỏi riêng dạng chữ / chọn một / chọn nhiều; mỗi trường bắt buộc hay không |
| Chống trùng | BTC tick "chống trùng" trên trường chữ/SĐT/email (một hoặc nhiều). Trùng **bất kỳ** trường đã tick = người đã check-in → báo giờ check-in cũ, không tạo lượt mới |
| Chống check-in từ xa | Hai công tắc độc lập: **khung giờ** (bật = cổng check-in như sự kiện thường: theo lịch, BTC vẫn mở/đóng tay; tắt = nhận mọi lúc) và **GPS** (bán kính như sự kiện thường) |
| Hiển thị QR | Màn chiếu toàn màn hình (QR + màn chào mừng hiện có) |
| Sau check-in | Màn cảm ơn, lời nhắn BTC sửa được. Không email, không ô đồng ý |
| Báo cáo | Excel (đủ cột của form), HTML, link chia sẻ |

## Mô hình dữ liệu

- `EventKind` thêm `PUBLIC`. `Event.publicForm` (JSON): `{ fields: [...], thankYou }`.
  Field: `{ id, type: TEXT|PHONE|EMAIL|SINGLE|MULTI, label, required, unique, options? }`.
  Họ tên không nằm trong `fields` — luôn có. Kiểm tra/chuẩn hoá ở `lib/publicForm.js`.
- Người check-in là `EventGuest` (dùng lại bảng khách của thiệp mời): `name`, `phone` (trường SĐT
  đầu tiên), `answers` (JSON `{ fieldId: string | string[] }`), `checkedInAt` = lúc gửi form.
  `email` chỉ ghi vào cột khi trường email được tick chống trùng — cột này có unique theo sự kiện.
- `EventGuestKey(eventId, key)` unique, `key = fieldId:giá-trị-chuẩn-hoá` (SĐT về dạng `0…`, email và
  chữ viết thường, gộp khoảng trắng). Tạo khách + khoá trong một transaction: hai người gửi cùng lúc
  với cùng SĐT thì một bên dính P2002 → trả "đã check-in". Xoá khách thì khoá xoá theo (cascade).
- Form bị **khoá** khi sự kiện đã có người check-in (đổi trường sau khi có dữ liệu làm cột báo cáo
  và khoá chống trùng lệch nhau). Lời cảm ơn sửa được lúc nào cũng được. Xoá hết lượt thì mở khoá.
- Khung giờ dùng lại `checkinOpen/checkinClose/checkinState` + `lib/attendanceGate.js`. Tắt giới hạn
  = `checkinState OPEN`. Không có check-out. GPS dùng lại `gpsEnabled/lat/lng/radius`.

## API

Công khai (`/api/public/checkin/:eventId`, rate limit theo `X-Device-ID`):
- `GET` → tên/địa điểm/mô tả sự kiện, form, cổng đang mở hay không, có cần GPS không (không lộ toạ độ).
- `POST { name, answers, gps }` → kiểm tra theo thứ tự: sự kiện → cổng → GPS → form → chống trùng → ghi.
  Lỗi: `EVENT_NOT_FOUND`, `OUTSIDE_TIME_WINDOW`/`ATTENDANCE_CLOSED`/`ATTENDANCE_NOT_OPEN`,
  `GPS_REQUIRED`, `GPS_INVALID`, `OUT_OF_RANGE`, `INVALID_ANSWERS`, `ALREADY_CHECKED_IN` (409, kèm tên + giờ).

BTC (ADMIN hoặc người tạo):
- `PUT /api/events/:id/public-form { fields, thankYou }` (409 `FORM_LOCKED` nếu đổi trường khi đã có dữ liệu).
- `POST /api/events/:id/public-checkins` — BTC thêm tay, bỏ qua cổng và GPS, vẫn chống trùng.
- Danh sách/xoá dùng lại `/api/events/:id/guests`. Màn chiếu: `GET /:id/qr` trả link cố định,
  `GET /:id/live` đọc từ bảng khách.

## Frontend

- Form tạo/sửa: kiểu thứ ba; hiện công tắc khung giờ (2 mốc check-in) và GPS.
- `PublicEventDetail`: cổng check-in, số liệu, danh sách người check-in (xem đủ câu trả lời), tab soạn form.
- `/check-in/:id` (không đăng nhập): form → màn cảm ơn. Máy đã check-in mở lại thấy ngay kết quả, có
  nút "Check-in cho người khác" (máy dùng chung).
- `QRDisplay` với kiểu `PUBLIC`: QR cố định, không đếm ngược, báo khi cổng đóng.
