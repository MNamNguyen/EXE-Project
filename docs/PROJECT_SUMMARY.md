# FPT Event Attendance — Tóm tắt ý tưởng & tính năng

> Hệ thống điểm danh sự kiện và buổi học ở trường đại học bằng **QR động + GPS + ràng buộc thiết bị**,
> thay cho điểm danh giấy hoặc Google Form (dễ điểm danh hộ, khó tổng hợp).

## 1. Vấn đề giải quyết

| Vấn đề hiện tại | Cách hệ thống xử lý |
|---|---|
| Điểm danh hộ: chụp mã QR gửi bạn, ký tên hộ | QR xoay vòng mỗi 30 giây + kiểm tra GPS + khoá theo thiết bị |
| Tổng hợp danh sách thủ công, dễ sai | Báo cáo Excel/HTML tự động, chia sẻ bằng link |
| Người ngoài danh sách vẫn vào được | Whitelist: chỉ người đã đăng ký mới check-in được |
| Không biết ai đến, ai về sớm | Tách **check-in** và **check-out**, mỗi cổng có khung giờ riêng |
| Thu thập đánh giá và phát giấy chứng nhận tốn công | Form đánh giá sau sự kiện + chứng nhận PDF tự động |

## 2. Vai trò người dùng

- **ADMIN** — quản lý toàn bộ tài khoản, thao tác hàng loạt, import sinh viên từ Excel.
- **BTC (Ban tổ chức)** — tạo sự kiện, trình chiếu QR, quản lý người tham gia, báo cáo, chứng nhận.
- **LECTURER (Giảng viên)** — xem danh sách, điểm danh và báo cáo của sự kiện/buổi học.
- **STUDENT (Sinh viên)** — đăng ký, quét QR điểm danh, xem lịch sử, làm đánh giá, tải chứng nhận.

## 3. Tính năng chính

### 3.1. Điểm danh bằng QR động (tính năng lõi)
- Màn hình chiếu QR, mã **tự đổi mỗi 30 giây** (ký HMAC, không lưu DB); mã cũ còn hiệu lực 90–120 giây.
- Sinh viên quét bằng camera điện thoại → mở web, không cần cài app.
- **Vé quét 15 phút**: ngay khi quét, hệ thống đổi QR thành một vé tạm, nên dù sinh viên mất vài phút
  để đăng nhập/đọc OTP thì vẫn điểm danh được — trong khi QR vẫn giữ vòng đời ngắn để chống chụp gửi.
- Hai lượt **check-in** và **check-out** riêng biệt.

### 3.2. Chống gian lận nhiều lớp
Thứ tự kiểm tra mỗi lượt quét: mã QR → sự kiện → whitelist → cổng mở/đóng → GPS → thiết bị.
- **GPS**: phải ở trong bán kính (mặc định 100 m) quanh địa điểm; có thể tắt với sự kiện online.
- **Khoá thiết bị**: mỗi tài khoản gắn với một thiết bị; đăng nhập máy lạ phải xác thực OTP qua email.
- **Nhật ký gian lận (Fraud Log)**: ghi lại QR sai, GPS giả/ngoài vùng, thiết bị lạ… để BTC tra cứu.
- Khoá tài khoản 15 phút sau 5 lần sai mật khẩu; giới hạn tần suất (rate limit) các API nhạy cảm.

### 3.3. Quản lý sự kiện
- Tạo sự kiện với địa điểm, toạ độ, bán kính, banner, mô tả.
- **Cổng điểm danh linh hoạt**: tự động theo khung giờ, hoặc BTC bấm mở/đóng thủ công bất kỳ lúc nào.
- **Whitelist**: thêm từng người, thêm cả lớp, hoặc cho sinh viên tự đăng ký.
- **Đăng ký công khai** qua link `/dang-ky/:id`: người chưa có tài khoản điền họ tên/MSSV/email,
  hệ thống tự tạo tài khoản và gửi mật khẩu tạm qua email.
- **Điểm danh thủ công** cho trường hợp đặc biệt (hết pin, không có mạng…).

### 3.4. Quản lý lớp học & buổi học
- Tạo lớp, thêm/bớt sinh viên, đổi tên lớp (cập nhật đồng loạt cho mọi thành viên).
- Mỗi **buổi học** là một sự kiện gắn với lớp → tái sử dụng toàn bộ cơ chế QR + GPS để điểm danh đi học.

### 3.5. Màn hình chào mừng trên máy chiếu
- Khi sinh viên check-in, tên hiện lên màn chiếu theo thời gian thực kèm hiệu ứng và nhạc nền
  (nhạc tự sinh bằng Web Audio hoặc file nhạc của BTC, không tải lên server).
- Chỉ hiển thị **tên** — không lộ MSSV/email vì màn hình là công khai.

### 3.6. Nhắc lịch
- Nút **"Gửi nhắc ngay"**: gửi email cho người đã đăng ký nhưng chưa check-in.
- Có nhật ký gửi và thời gian chờ 30 phút giữa hai lần gửi để tránh spam.

### 3.7. Đánh giá sau sự kiện
- Mẫu câu hỏi dùng lại được (câu trả lời tự do hoặc chấm sao 1–5), hỗ trợ **ẩn danh**.
- Chỉ người đã **check-out** mới được đánh giá; form bật lên ngay sau khi quét QR check-out.
- BTC/giảng viên xem thống kê kết quả.

### 3.8. Giấy chứng nhận tham gia
- BTC tải ảnh mẫu chứng nhận và kéo-thả vị trí các trường (họ tên, MSSV, tên sự kiện, ngày…).
- Xem trước trên web giống hệt bản PDF tải về (dùng chung font và quy tắc bố cục).
- Chỉ người **check-out** mới được cấp; BTC có thể thu hồi; sinh viên tải PDF ở "Chứng nhận của tôi".

### 3.9. Báo cáo điểm danh
- Xuất **Excel (.xlsx)** và **báo cáo HTML** tự chứa (xem trong app, tải về, hay mở offline đều giống nhau).
- **Chia sẻ báo cáo bằng link công khai** cho người không có tài khoản; có thể tạo lại hoặc thu hồi link.

### 3.10. Quản trị tài khoản
- Import sinh viên hàng loạt từ file Excel.
- Thao tác **hàng loạt**: cập nhật, đặt lại mật khẩu, gỡ khoá thiết bị, xoá — có cơ chế không cho admin
  tự khoá/xoá chính mình, trả về kết quả từng phần (thành công/bỏ qua kèm lý do).
- Trang thống kê tổng quan.

### 3.11. Đăng nhập
- Mật khẩu + JWT, hoặc **đăng nhập không mật khẩu bằng OTP email** (chỉ dành cho sinh viên).
- Quên mật khẩu qua OTP; phản hồi giống nhau dù email có tồn tại hay không (chống dò tài khoản).

## 4. Kịch bản ứng dụng

| Kịch bản | Tính năng dùng |
|---|---|
| Hội thảo, workshop, talkshow của CLB/khoa | QR + GPS, đăng ký công khai, màn chào mừng, đánh giá, chứng nhận |
| Điểm danh buổi học hằng tuần | Lớp học + buổi học, whitelist theo lớp, báo cáo cho giảng viên |
| Sự kiện tính điểm rèn luyện / ngày CTXH | Check-in + check-out (xác nhận ở đủ thời gian), xuất Excel nộp phòng CTSV |
| Tuyển sinh, ngày hội việc làm, sự kiện mở cho người ngoài | Link đăng ký tự tạo tài khoản, nhắc lịch qua email |
| Báo cáo cho nhà tài trợ / ban giám hiệu | Link chia sẻ báo cáo công khai, thống kê đánh giá |

## 5. Công nghệ

- **Backend**: Node.js, Express, Prisma, PostgreSQL (Supabase) — triển khai trên Render.
- **Frontend**: React 18, Vite, Tailwind CSS — triển khai trên Vercel, chạy tốt trên trình duyệt điện thoại.
- **Email**: Brevo (OTP, mật khẩu tạm, nhắc lịch). **PDF**: pdf-lib. **Excel**: xuất .xlsx phía server.
- QR token và vé quét đều **stateless** (HMAC), không cần lưu trữ → nhẹ, phù hợp hạ tầng miễn phí.

## 6. Điểm khác biệt

1. **Chống điểm danh hộ thực sự hiệu quả** nhờ kết hợp 3 lớp: QR xoay vòng, GPS, khoá thiết bị.
2. **Không cần cài app** — chỉ cần camera và trình duyệt.
3. **Trọn vòng đời sự kiện** trong một nơi: đăng ký → nhắc lịch → điểm danh → đánh giá → chứng nhận → báo cáo.
4. **Dùng được cho cả sự kiện lẫn lớp học**, cùng một cơ chế.
5. **Chi phí vận hành gần như bằng 0** trên hạ tầng free tier.
