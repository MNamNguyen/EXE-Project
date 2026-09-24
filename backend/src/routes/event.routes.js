const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listEvents, createEvent, getEvent, updateEvent, deleteEvent,
  getQRToken, getLiveCheckins, getAttendance, manualCheckin,
  listMembers, addMembers, removeMember, searchUsersForEvent,
  listClasses, addMembersByClass,
} = require('../controllers/event.controller');
const { registerSelf } = require('../controllers/registration.controller');
const { getReminders, sendReminderNow } = require('../controllers/reminder.controller');
const multer = require('multer');
const {
  getCertificateSetup, getTemplateImage, uploadTemplateImage, saveTemplateFields, deleteTemplate,
  previewPdf, issueCertificates, listEventCertificates, revokeCertificate,
} = require('../controllers/certificate.controller');

// Ảnh mẫu chứng nhận: giữ trong RAM rồi ghi thẳng vào DB (Render không có ổ đĩa bền).
const certificateUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single('file');
function uploadCertificateImage(req, res, next) {
  certificateUpload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh mẫu tối đa 5MB' : 'Upload ảnh thất bại';
    return res.status(400).json({ success: false, message });
  });
}

router.use(authenticate);

router.get('/', listEvents);
router.post('/', authorize('ADMIN', 'BTC'), createEvent);
router.get('/:id', getEvent);
router.put('/:id', authorize('ADMIN', 'BTC'), updateEvent);
router.delete('/:id', authorize('ADMIN', 'BTC'), deleteEvent);
router.get('/:id/qr', authorize('ADMIN', 'BTC'), getQRToken);
// Màn hình trình chiếu: người vừa check-in (chỉ tên) để hiện lời chào.
router.get('/:id/live', authorize('ADMIN', 'BTC'), getLiveCheckins);
router.get('/:id/attendance', authorize('ADMIN', 'BTC', 'LECTURER'), getAttendance);
router.post('/:id/manual-checkin', authorize('ADMIN', 'BTC'), manualCheckin);

// Người dùng đã đăng nhập tự ghi tên vào danh sách tham gia.
router.post('/:id/register', registerSelf);

router.get('/:id/members', authorize('ADMIN', 'BTC', 'LECTURER'), listMembers);
router.get('/:id/members/search', authorize('ADMIN', 'BTC'), searchUsersForEvent);
router.get('/:id/classes', authorize('ADMIN', 'BTC'), listClasses);
router.post('/:id/members', authorize('ADMIN', 'BTC'), addMembers);
router.post('/:id/members/by-class', authorize('ADMIN', 'BTC'), addMembersByClass);
router.delete('/:id/members/:userId', authorize('ADMIN', 'BTC'), removeMember);

// Nhắc lịch qua email — BTC gửi thủ công, không có nhắc tự động.
router.get('/:id/reminders', authorize('ADMIN', 'BTC'), getReminders);
router.post('/:id/reminders/send', authorize('ADMIN', 'BTC'), sendReminderNow);

// Chứng nhận tham gia — tuỳ chọn: sự kiện không upload mẫu thì không có chứng nhận.
const certManager = authorize('ADMIN', 'BTC');
router.get('/:id/certificate', certManager, getCertificateSetup);
router.get('/:id/certificate/image', certManager, getTemplateImage);
router.put('/:id/certificate/image', certManager, uploadCertificateImage, uploadTemplateImage);
router.put('/:id/certificate/fields', certManager, saveTemplateFields);
router.delete('/:id/certificate', certManager, deleteTemplate);
router.get('/:id/certificate/preview', certManager, previewPdf);
router.post('/:id/certificates/issue', certManager, issueCertificates);
router.get('/:id/certificates', certManager, listEventCertificates);
router.delete('/:id/certificates/:certId', certManager, revokeCertificate);

module.exports = router;
