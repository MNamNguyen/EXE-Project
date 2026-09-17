// Mọi người dùng hệ thống đều ở Việt Nam, nhưng Render (và gần như mọi PaaS)
// chạy tiến trình Node với TZ=UTC. `toLocaleString('vi-VN')` KHÔNG kèm timeZone
// sẽ lấy múi giờ của máy chủ, nên giờ điểm danh in ra trong báo cáo, email và
// thông báo check-in lệch đúng 7 tiếng khi deploy — và chỉ hiện đúng khi dev
// chạy trên máy đặt ở VN, khiến bug này rất dễ lọt qua local.
//
// Vì vậy mọi chỗ format thời gian CHO NGƯỜI ĐỌC ở backend phải đi qua đây.
// (Frontend không cần: date-fns format theo múi giờ trình duyệt là đúng.)
const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const LOCALE = 'vi-VN';

function fmtDateTime(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Date(value).toLocaleString(LOCALE, { timeZone: TIME_ZONE, ...options });
}

function fmtDate(value, options = {}) {
  return new Date(value).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE, ...options });
}

function fmtTime(value, options = { hour: '2-digit', minute: '2-digit' }) {
  return new Date(value).toLocaleTimeString(LOCALE, { timeZone: TIME_ZONE, ...options });
}

module.exports = { fmtDateTime, fmtDate, fmtTime, TIME_ZONE };
