const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { listUsers, createUser, updateUser, deleteUser, resetDeviceBinding, importStudents, getStats } = require('../controllers/admin.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate, authorize('ADMIN'));

router.get('/stats', getStats);
router.get('/users', listUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/reset-device', resetDeviceBinding);
router.post('/users/import', upload.single('file'), importStudents);

module.exports = router;
