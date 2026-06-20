const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { processCheckin, getCheckinStatus } = require('../controllers/checkin.controller');

const checkinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
});

router.post('/', checkinLimiter, authenticate, processCheckin);
router.get('/status/:eventId', authenticate, getCheckinStatus);

module.exports = router;
