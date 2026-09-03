// Xác định một cổng điểm danh (check-in hoặc check-out) của sự kiện có đang
// mở hay không. Đây là nguồn sự thật DUY NHẤT cho quyết định này — cả
// checkin.controller (chặn quét QR) lẫn event.controller (hiển thị trạng thái
// cho BTC/sinh viên) đều gọi qua đây để không lệch nhau.
//
// AUTO   — dùng khung giờ nếu đã đặt ĐỦ cả hai mốc mở/đóng; chưa đặt đủ giờ
//          thì coi là CHƯA MỞ, chờ BTC bấm mở tay. Đây là điểm khác so với
//          hành vi cũ (khung giờ luôn bắt buộc) — mục đích của cờ thủ công là
//          để BTC không cần định trước lịch mới điểm danh được.
// OPEN   — BTC chủ động mở, bỏ qua khung giờ hoàn toàn.
// CLOSED — BTC chủ động đóng, bỏ qua khung giờ hoàn toàn.
function resolveGate(state, openAt, closeAt, now = new Date()) {
  if (state === 'OPEN') return { open: true, reason: 'MANUALLY_OPEN' };
  if (state === 'CLOSED') return { open: false, reason: 'MANUALLY_CLOSED' };

  if (openAt && closeAt) {
    if (now < openAt) return { open: false, reason: 'NOT_STARTED' };
    if (now > closeAt) return { open: false, reason: 'ENDED' };
    return { open: true, reason: 'SCHEDULED' };
  }

  return { open: false, reason: 'NOT_OPENED' };
}

// Tóm tắt trạng thái cả hai cổng của một event, để trả về cho frontend thay vì
// bắt frontend tự suy luận từ giờ (frontend không biết checkinState/checkoutState).
function gateSummary(event, now = new Date()) {
  return {
    checkin: resolveGate(event.checkinState, event.checkinOpen, event.checkinClose, now),
    checkout: resolveGate(event.checkoutState, event.checkoutOpen, event.checkoutClose, now),
  };
}

module.exports = { resolveGate, gateSummary };
