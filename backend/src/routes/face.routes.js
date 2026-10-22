const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMyFaceProfile, saveMyFaceProfile, consentMyFaceProfile, deleteMyFaceProfile,
} = require('../controllers/face.controller');

router.use(authenticate, authorize('STUDENT'));

router.get('/', getMyFaceProfile);
router.post('/', saveMyFaceProfile);
router.post('/consent', consentMyFaceProfile);
router.delete('/', deleteMyFaceProfile);

module.exports = router;
