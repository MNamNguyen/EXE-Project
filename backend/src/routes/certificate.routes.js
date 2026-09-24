const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  listMyCertificates, getCertificate, getCertificateBackground, downloadCertificatePdf,
} = require('../controllers/certificate.controller');

// Người nhận xem/tải chứng nhận của mình (quyền kiểm tra trong controller).
router.use(authenticate);

router.get('/mine', listMyCertificates);
router.get('/:id', getCertificate);
router.get('/:id/background', getCertificateBackground);
router.get('/:id/pdf', downloadCertificatePdf);

module.exports = router;
