const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listEvents, createEvent, getEvent, updateEvent, deleteEvent,
  getQRToken, getAttendance, manualCheckin,
  listMembers, addMembers, removeMember, searchUsersForEvent,
} = require('../controllers/event.controller');

router.use(authenticate);

router.get('/', listEvents);
router.post('/', authorize('ADMIN', 'BTC'), createEvent);
router.get('/:id', getEvent);
router.put('/:id', authorize('ADMIN', 'BTC'), updateEvent);
router.delete('/:id', authorize('ADMIN', 'BTC'), deleteEvent);
router.get('/:id/qr', authorize('ADMIN', 'BTC'), getQRToken);
router.get('/:id/attendance', authorize('ADMIN', 'BTC', 'LECTURER'), getAttendance);
router.post('/:id/manual-checkin', authorize('ADMIN', 'BTC'), manualCheckin);

router.get('/:id/members', authorize('ADMIN', 'BTC', 'LECTURER'), listMembers);
router.get('/:id/members/search', authorize('ADMIN', 'BTC'), searchUsersForEvent);
router.post('/:id/members', authorize('ADMIN', 'BTC'), addMembers);
router.delete('/:id/members/:userId', authorize('ADMIN', 'BTC'), removeMember);

module.exports = router;
