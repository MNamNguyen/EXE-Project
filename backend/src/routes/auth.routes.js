const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { login, verifyOtp, changePassword, getMe } = require('../controllers/auth.controller');

router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/change-password', authenticate, changePassword);
router.get('/me', authenticate, getMe);

module.exports = router;
