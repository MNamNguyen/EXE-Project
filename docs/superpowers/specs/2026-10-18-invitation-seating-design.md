# Sự kiện thiệp mời: nhiều vé trên một thiệp + sơ đồ ghế — thiết kế

Ngày: 2026-10-18 · Trạng thái: đã chốt với product owner · Mở rộng của
`2026-10-16-invitation-event-design.md`

## Vấn đề

File bán vé thật của BTC (`THÔNG TIN VÉ .xlsx`: STT / HỌ VÀ TÊN / SỐ LƯỢNG VÉ / GHẾ, 48 người đặt,
87 vé, ghế dạng `E08, E09`, hàng A–K) cho thấy **một người đặt hộ nhiều vé cho người thân**. Trước đây
mỗi `EventGuest` = một người = một thiệp, không có ghế.

## Quyết định đã chốt

| Câu hỏi | Chốt |
|---|---|
| Nhiều vé | Một khách (người đặt) có `ticketCount` vé, **một thiệp/mã QR** |
| Quét ở cửa | **Quét một lần = cả nhóm vào** (không check-in từng phần) |
| Người đi kèm | Chỉ lưu số lượng, không lưu tên từng người |
| Quản lý ghế | **Sơ đồ ghế**: BTC khai báo hàng × số ghế, lối đi, ghế không dùng; bấm ghế để xếp/đổi/bỏ |
| Trùng ghế | Chặn ở DB (unique theo sự kiện), import Excel bỏ qua dòng trùng ghế |

## Mô hình dữ liệu

- `EventGuest.ticketCount Int @default(1)` (1–50). Khách cũ và khách check-in công khai giữ 1.
- `EventGuestSeat (eventId, guestId, seat)`, `@@unique([eventId, seat])` — cùng mẫu `EventGuestKey`: hai
  BTC xếp cùng ghế cùng lúc thì một bên nhận P2002 → `SEAT_TAKEN`.
- `Event.seatMap Json?` = `{ rows: [{ label, seats }], aisleAfter: [số ghế], disabled: [mã ghế] }`.
  NULL = sự kiện không xếp ghế (vẫn dùng được số vé).

Mã ghế = nhãn hàng 1–2 chữ cái + số đệm 2 chữ số (`E08`). Mọi chuẩn hoá/kiểm tra ở `lib/seatMap.js`
(`normalizeSeat`, `parseSeatList` nhận `E08, E09` và dải `F06-F10`, `normalizeSeatMap`, `seatLabel`).
`frontend/src/pages/btc/invitation/seats.js` là bản sao quy ước phía trình duyệt (chỉ để hiển thị).

## Luật

- Số ghế của khách ≤ số vé. Bỏ trống số vé khi có ghế = số ghế.
- Ghế phải có trên sơ đồ và không bị đánh dấu "không dùng" (`SEAT_NOT_IN_MAP`); chưa có sơ đồ thì không
  gán được ghế (`NO_SEAT_MAP`).
- Lưu sơ đồ mới làm mất ghế đang có khách → `409 SEAT_IN_USE` kèm danh sách ghế; xoá sơ đồ chỉ khi chưa
  gán ghế nào.
- Đổi số vé hoặc ghế của khách → thiệp đã gửi in số cũ → `inviteStatus` về `PENDING` để gửi lại.
- Khách tại chỗ nhập "số người", không xếp ghế ở cửa (tình nguyện viên không sửa sơ đồ).
- Số liệu "người" = tổng `ticketCount` (`guestStats.tickets/ticketsCheckedIn/invitedTickets`); các số
  đếm cũ (theo thiệp) giữ nguyên.

## API (BTC, `loadInvitationEvent`)

- `GET /api/events/:id/seats` → `{ seatMap, assignments: [{ seat, guestId, name, ticketCount, checkedIn }], guests }`
- `PUT /api/events/:id/seat-map { seatMap | null }`
- `PUT /api/events/:id/guests/:guestId/seats { seats }` — thay toàn bộ ghế của một khách
- `POST/PUT /guests` nhận thêm `ticketCount`, `seats`; import Excel nhận cột "Số lượng vé" và "Ghế"
  (cột lạ như STT bỏ qua, dòng tổng cuối bảng bỏ qua).

Mã lỗi mới: `SEAT_TAKEN`, `SEAT_NOT_IN_MAP`, `NO_SEAT_MAP`, `SEAT_IN_USE`, `SEATS_EXCEED_TICKETS`,
`INVALID_SEAT`, `INVALID_SEAT_MAP`, `IMPORT_CONFLICT`. Luồng quét không có mã lỗi mới.

## Hiển thị

- Thiệp: ô chữ mới `seat` ("Ghế E08, E09 · 2 vé") trong `lib/invitationLayout.js` ↔ `invitationRender.js`.
  Mẫu đã lưu trước đó đi qua `withAllFields` nên nhận ô mặc định (PDF và editor như nhau); thiệp mặc định
  in thêm một dòng ghế. Khách 1 vé không ghế: chuỗi rỗng, thiệp như cũ.
  *Cập nhật 2026-10-21:* tách thành hai ô `seat` ("Ghế E08, E09", `seatText`) và `tickets` ("2 vé",
  `ticketText`) để BTC đặt mỗi thứ một chỗ. Mẫu lưu trước đó chưa có ô `tickets` thì `withAllFields` đặt nó
  ngay dưới ô ghế, cùng kiểu chữ. Thiệp mặc định, email và báo cáo vẫn dùng chuỗi gộp `seatLabel`.
- Email thiệp, trang `/thiep/:code`, màn quét (thẻ kết quả to "5 người · Ghế …"), bảng khách (cột Vé · ghế,
  tìm theo mã ghế), báo cáo Excel (cột Số vé, Ghế, dòng tổng) và HTML (đếm theo người).
- Tab "Sơ đồ ghế": `SeatMapPanel` (xếp/đổi/bỏ ghế, ghế đổi màu "đã tới" khi khách check-in) +
  `SeatLayoutModal` (khai báo hàng, số ghế, lối đi, bấm ghế để đánh dấu không dùng).
