# Sự kiện thiệp mời (check-in bằng thiệp QR) — thiết kế

Ngày: 2026-10-16 · Trạng thái: đã chốt với product owner

## Vấn đề

Kiểu sự kiện hiện có: màn chiếu hiện QR động, **người tham dự tự quét** (đăng nhập + GPS + thiết bị).
Có loại sự kiện khác hẳn: BTC mời một danh sách **khách ngoài không có tài khoản** (họ tên, SĐT, email),
gửi thiệp mời có in sẵn QR; tới nơi khách **đưa thiệp ra** và **BTC/tình nguyện viên quét** để check-in.
Mục đích chính: đối chiếu ai trong danh sách đã tới.

## Quyết định đã chốt

| Câu hỏi | Chốt |
|---|---|
| Người được mời | Khách ngoài, không cần tài khoản. Họ tên bắt buộc; SĐT, email tuỳ chọn |
| Nhập danh sách | Thêm tay + import Excel (cột Họ tên / SĐT / Email) |
| Thiệp | PDF. BTC upload ảnh nền + kéo vị trí ô như chứng nhận; **chưa upload thì dùng thiệp mặc định** |
| Gửi thiệp | BTC bấm gửi (không tự gửi) — email kèm PDF + link xem thiệp. Khách không email: BTC tải PDF tự gửi/in |
| Check-out | Không có. Chỉ check-in |
| Quan hệ với kiểu cũ | Kiểu riêng, chọn lúc tạo, **không đổi được sau đó** |
| Ai quét | ADMIN + người tạo sự kiện (đăng nhập) **và** tình nguyện viên qua link quét bí mật, thu hồi được |
| Quyền tình nguyện viên | Quét, tìm theo tên/SĐT để check-in tay, thêm khách tại chỗ. SĐT/email bị che. Không sửa/xoá, không gửi thiệp, không huỷ check-in |
| Khách không có trong danh sách | Thêm tại chỗ và check-in luôn, đánh dấu "khách tại chỗ" |
| Giờ quét | Thêm trường **Thời gian bắt đầu** (bắt buộc, in lên thiệp). Quét lúc nào cũng được, không dùng cổng điểm danh |
| Báo cáo | Excel + HTML + link chia sẻ (như sự kiện thường) |

## Mô hình dữ liệu

- `Event.kind` (`STANDARD` | `INVITATION`, mặc định `STANDARD`), `Event.startsAt`,
  `Event.scannerToken` (+ `scannerSharedAt`) cho link quét của tình nguyện viên — cột DB như
  `reportShareToken` vì phải thu hồi được.
- `EventGuest`: `name`, `phone?`, `email?`, `code` (unique, ngẫu nhiên 15 byte base64url — QR mang mã
  này), `isWalkIn`, `inviteStatus` (`PENDING|SENDING|SENT|FAILED`) + `inviteSentAt`, `checkedInAt`,
  `checkedInBy` (tên hiển thị người quét). `@@unique([eventId, email])` — Postgres cho nhiều NULL.
- `EventInvitationTemplate`: giống `EventCertificateTemplate` (ảnh `BYTEA` + `fields` JSON).

Khách mời **không** đi qua `User`/`EventMember`/`Attendance`: họ không có tài khoản. Vì vậy đánh giá,
chứng nhận, nhắc lịch (đều gắn với tài khoản) không áp dụng cho kiểu sự kiện này — frontend ẩn các tab đó.

Sự kiện thiệp mời luôn lưu `gpsEnabled=false`, `allowRegistration=false`, `isWhitelisted=true`, không
có khung giờ điểm danh — để mọi đường cũ (danh sách sinh viên, đăng ký công khai) tự loại nó ra.

## QR trên thiệp

Nội dung QR = `FRONTEND_URL/thiep/<code>`. Trang quét chấp nhận cả URL đó lẫn mã thô. Lợi ích: khách tự
quét thiệp của mình (hoặc bấm link trong email) thì mở được trang xem thiệp `/thiep/:code` — có QR lớn
để đưa ra ở cửa và nút tải PDF. Mã là bí mật duy nhất: "Cấp lại mã" đổi mã, thiệp cũ chết ngay
(trạng thái gửi về `PENDING` để gửi lại).

Thiệp in ra là tĩnh nên không chống được chuyện chụp lại thiệp của người khác; trang quét luôn hiện
**họ tên** (và SĐT che một phần) để người đứng cửa đối chiếu, và quét lần hai báo "đã check-in lúc …".

## Bố cục thiệp

`lib/invitationLayout.js` dùng lại `layoutField` + bộ font của chứng nhận cho các ô chữ
(`name`, `event`, `time`, `location`) và thêm ô `qr` hình vuông: `x`,`y` là **tâm**, `size` = cạnh theo tỉ lệ
chiều rộng ảnh. QR vẽ bằng ma trận từ thư viện `qrcode` (cùng thư viện ở backend và frontend) với lề
trắng 2 ô — `frontend/src/pages/certificates/invitationRender.js` là bản sao quy tắc ở trình duyệt, đổi
một bên phải đổi bên kia (cùng quy ước với `certificateLayout`).

Thiệp mặc định (chưa có mẫu): A5 dọc vẽ thẳng bằng pdf-lib trong `services/invitationPdf.js`.

## API

BTC (đăng nhập, ADMIN hoặc người tạo — `loadInvitationEvent` = `loadEventForWrite` + kiểm `kind`):

- `GET/POST /api/events/:id/guests`, `POST /guests/import`, `PUT/DELETE /guests/:guestId`
- `POST /guests/:guestId/rotate-code`, `POST|DELETE /guests/:guestId/checkin`
- `POST /guests/scan { code }`, `POST /guests/walk-in`
- `GET /guests/:guestId/invitation.pdf`, `GET /invitations/pdf` (gộp mọi thiệp, để in)
- `POST /invitations/send { guestIds? }` → `202`, gửi nền (giống chứng nhận: "giành" từng khách
  `PENDING|FAILED → SENDING` để bấm hai lần không gửi trùng)
- `GET|PUT|DELETE /invitation-template…` (ảnh, bố cục, xem thử)
- `GET|POST|DELETE /scanner-link` (`?rotate=1` cấp link mới)

Công khai (`/api/public`, có rate limit riêng):

- `GET /invitations/:code`, `GET /invitations/:code/pdf` — trang xem thiệp của khách
- `GET /scanner/:token`, `POST /scanner/:token/scan`, `GET /scanner/:token/guests`,
  `POST /scanner/:token/guests/:guestId/checkin`, `POST /scanner/:token/walk-in` — tình nguyện viên.
  Token sai/đã thu hồi → `404 SCANNER_NOT_FOUND`. Dữ liệu khách trả ra luôn ở dạng che.

Logic check-in dùng chung cho cả hai nhóm ở `lib/guestCheckin.js`. Check-in là
`updateMany where checkedInAt = null` nên hai cửa quét cùng một thiệp cùng lúc chỉ một bên thành công.

Mã lỗi: `GUEST_NOT_FOUND`, `WRONG_EVENT`, `ALREADY_CHECKED_IN`, `NOT_INVITATION_EVENT`,
`INVITATION_EVENT` (gọi API của kiểu cũ — QR màn chiếu, quét tự điểm danh — trên sự kiện thiệp mời).

## Frontend

- Tạo sự kiện: chọn kiểu ở đầu form; kiểu thiệp mời ẩn GPS/khung giờ/đăng ký, hiện "Thời gian bắt đầu".
- `EventDetail` rẽ sang `InvitationEventDetail` khi `kind === 'INVITATION'`: số liệu, bảng khách mời
  (thêm/sửa/xoá/import/check-in tay/huỷ check-in/cấp lại mã/tải thiệp), panel thiệp mời (mẫu + gửi),
  link quét cho tình nguyện viên, báo cáo.
- Trang quét `/events/:id/quet-thiep` (BTC) và `/quet/:token` (tình nguyện viên) dùng chung
  `GuestScanner`: camera (`getUserMedia` + `jsqr`), kết quả to rõ (xanh/vàng/đỏ), tìm tay, thêm tại chỗ.
- Trang khách `/thiep/:code`.
