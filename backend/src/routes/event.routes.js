const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listEvents, createEvent, getEvent, updateEvent, deleteEvent,
  getQRToken, getAttendance, manualCheckin,
  listMembers, addMembers, removeMember, searchUsersForEvent,
  listClasses, addMembersByClass,
} = require('../controllers/event.controller');
const { registerSelf } = require('../controllers/registration.controller');

router.use(authenticate);

router.get('/', listEvents);
router.post('/', authorize('ADMIN', 'BTC'), createEvent);
router.get('/:id', getEvent);
router.put('/:id', authorize('ADMIN', 'BTC'), updateEvent);
router.delete('/:id', authorize('ADMIN', 'BTC'), deleteEvent);
router.get('/:id/qr', authorize('ADMIN', 'BTC'), getQRToken);
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

module.exports = router;
