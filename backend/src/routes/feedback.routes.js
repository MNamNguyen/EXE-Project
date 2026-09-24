const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  getEventForm, upsertEventForm, updateEventFormState, deleteEventForm, getEventResults,
  getMyResponse, submitResponse,
} = require('../controllers/feedback.controller');

router.use(authenticate);

// Thư viện mẫu dùng chung — sửa/xoá: ADMIN hoặc người tạo (kiểm tra trong controller).
const manager = authorize('ADMIN', 'BTC');
router.get('/templates', manager, listTemplates);
router.post('/templates', manager, createTemplate);
router.get('/templates/:id', manager, getTemplate);
router.put('/templates/:id', manager, updateTemplate);
router.delete('/templates/:id', manager, deleteTemplate);

// Form của sự kiện — mọi handler đi qua loadEventForWrite (ADMIN hoặc người tạo
// sự kiện). LECTURER chỉ được xem, giống báo cáo điểm danh.
router.get('/events/:id/form', authorize('ADMIN', 'BTC', 'LECTURER'), getEventForm);
router.put('/events/:id/form', manager, upsertEventForm);
router.patch('/events/:id/form', manager, updateEventFormState);
router.delete('/events/:id/form', manager, deleteEventForm);
router.get('/events/:id/results', authorize('ADMIN', 'BTC', 'LECTURER'), getEventResults);

// Người tham dự (mọi vai trò) — điều kiện gửi kiểm tra trong controller.
router.get('/events/:id/response', getMyResponse);
router.post('/events/:id/response', submitResponse);

module.exports = router;
