const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { exportAttendance, exportAttendanceHtml, getFraudLogs } = require('../controllers/report.controller');

router.use(authenticate);

router.get('/events/:id/export', authorize('ADMIN', 'BTC', 'LECTURER'), exportAttendance);
router.get('/events/:id/export-html', authorize('ADMIN', 'BTC', 'LECTURER'), exportAttendanceHtml);
router.get('/fraud-logs', authorize('ADMIN', 'BTC'), getFraudLogs);

module.exports = router;
