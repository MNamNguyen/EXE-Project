const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listClasses, createClass, getClass, updateClass, deleteClass,
  listMembers, searchAssignable, addMembers, removeMembers,
  createSession, listSessions,
} = require('../controllers/class.controller');

// Quản lý lớp là nghiệp vụ của BTC/Admin, giống hệt phạm vi quyền của
// /api/events — sinh viên/giảng viên không cần và không nên can thiệp vào đây.
router.use(authenticate, authorize('ADMIN', 'BTC'));

router.get('/', listClasses);
router.post('/', createClass);
router.get('/:id', getClass);
router.put('/:id', updateClass);
router.delete('/:id', deleteClass);

router.get('/:id/members', listMembers);
router.get('/:id/members/search', searchAssignable);
router.post('/:id/members', addMembers);
router.post('/:id/members/remove', removeMembers);

router.get('/:id/sessions', listSessions);
router.post('/:id/sessions', createSession);

module.exports = router;
