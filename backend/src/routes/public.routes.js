const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const {
  listOpenEvents, getPublicEvent, registerPublic,
} = require('../controllers/registration.controller');
// Đổi token QR lấy vé quét phải gọi được khi chưa đăng nhập, nên đặt ở đây để
// giữ nguyên quy ước "/api/public/* là router duy nhất không cần auth".
const { issueScanTicket } = require('../controllers/checkin.controller');

// Endpoint đăng ký công khai có thể tạo tài khoản mới → siết chặt hơn rate limit
// chung của /api để chặn spam tạo user hàng loạt từ một IP.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_REGISTER_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã gửi quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau 15 phút.' },
});

// Quét mã là hành động một lần mỗi sự kiện nên trần đặt rộng tay: cả lớp dùng
// chung wifi trường sẽ ra cùng một IP. Khoá theo deviceId khi có (mỗi máy một
// UUID riêng), chỉ lùi về IP khi client không gửi.
const scanTicketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.SCAN_TICKET_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.deviceId || req.ip,
  message: { success: false, message: 'Bạn đã quét quá nhiều lần. Vui lòng thử lại sau.' },
});

router.post('/scan-ticket', scanTicketLimiter, issueScanTicket);

router.get('/events', listOpenEvents);
router.get('/events/:id', getPublicEvent);
router.post('/events/:id/register', registerLimiter, registerPublic);

module.exports = router;
