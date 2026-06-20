const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { exportAttendance, getFraudLogs } = require('../controllers/report.controller');

router.use(authenticate);

router.get('/events/:id/export', authorize('ADMIN', 'BTC', 'LECTURER'), exportAttendance);
router.get('/fraud-logs', authorize('ADMIN', 'BTC'), getFraudLogs);

module.exports = router;
