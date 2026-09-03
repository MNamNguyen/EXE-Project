const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const {
  listOpenEvents, getPublicEvent, registerPublic,
} = require('../controllers/registration.controller');

// Endpoint đăng ký công khai có thể tạo tài khoản mới → siết chặt hơn rate limit
// chung của /api để chặn spam tạo user hàng loạt từ một IP.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_REGISTER_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã gửi quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau 15 phút.' },
});

router.get('/events', listOpenEvents);
router.get('/events/:id', getPublicEvent);
router.post('/events/:id/register', registerLimiter, registerPublic);

module.exports = router;
