const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  exportAttendance, exportAttendanceHtml,
  getReportShare, createReportShare, revokeReportShare,
  getFraudLogs,
} = require('../controllers/report.controller');

router.use(authenticate);

router.get('/events/:id/export', authorize('ADMIN', 'BTC', 'LECTURER'), exportAttendance);
router.get('/events/:id/export-html', authorize('ADMIN', 'BTC', 'LECTURER'), exportAttendanceHtml);
// Link chia sẻ báo cáo công khai — chỉ ADMIN/người tạo sự kiện được cấp và thu
// hồi (loadEventForWrite kiểm tra bên trong controller).
router.get('/events/:id/share', authorize('ADMIN', 'BTC', 'LECTURER'), getReportShare);
router.post('/events/:id/share', authorize('ADMIN', 'BTC', 'LECTURER'), createReportShare);
router.delete('/events/:id/share', authorize('ADMIN', 'BTC', 'LECTURER'), revokeReportShare);

router.get('/fraud-logs', authorize('ADMIN', 'BTC'), getFraudLogs);

module.exports = router;
