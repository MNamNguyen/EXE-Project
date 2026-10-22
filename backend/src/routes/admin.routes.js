const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const {
  listUsers, createUser, updateUser, deleteUser, resetPassword, resetDeviceBinding, importStudents, getStats,
  bulkUpdateUsers, bulkResetPasswords, bulkResetDevices, bulkDeleteUsers,
} = require('../controllers/admin.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate, authorize('ADMIN'));

router.get('/stats', getStats);
router.get('/users', listUsers);
router.post('/users', createUser);
router.post('/users/import', upload.single('file'), importStudents);

// PHẢI đứng trước các route '/users/:id/...': '/users/bulk/reset-password' khớp
// với '/users/:id/reset-password' (id = "bulk") nếu đăng ký sau.
router.post('/users/bulk/update', bulkUpdateUsers);
router.post('/users/bulk/reset-password', bulkResetPasswords);
router.post('/users/bulk/reset-device', bulkResetDevices);
router.post('/users/bulk/delete', bulkDeleteUsers);

router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/reset-password', resetPassword);
router.post('/users/:id/reset-device', resetDeviceBinding);

module.exports = router;
