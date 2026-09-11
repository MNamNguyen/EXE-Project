const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const {
  login, verifyOtp, requestLoginOtp, loginWithOtp,
  changePassword, forgotPassword, resetPassword, getMe,
} = require('../controllers/auth.controller');

// Quên mật khẩu gửi email thật và đoán được mã 6 số nếu thử đủ nhiều → siết
// chặt hơn rate limit chung của /api (500/15 phút).
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.FORGOT_PASSWORD_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RESET_PASSWORD_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

// Mã đăng nhập cũng gửi email thật và cũng đoán được nếu thử đủ nhiều → dùng
// chung mức siết với quên mật khẩu.
const loginOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_OTP_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

const loginOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_OTP_VERIFY_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/login-otp/request', loginOtpLimiter, requestLoginOtp);
router.post('/login-otp/verify', loginOtpVerifyLimiter, loginWithOtp);
router.post('/forgot-password', forgotLimiter, forgotPassword);
router.post('/reset-password', resetLimiter, resetPassword);
router.post('/change-password', authenticate, changePassword);
router.get('/me', authenticate, getMe);

module.exports = router;
