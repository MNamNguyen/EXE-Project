const prisma = require('./prisma');

// Kiểm tra quyền thao tác trên sự kiện (ADMIN hoặc người tạo).
// Trả về event nếu OK, hoặc null kèm gửi response lỗi.
async function loadEventForWrite(req, res) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    return null;
  }
  if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
    res.status(403).json({ success: false, message: 'Không có quyền thao tác sự kiện này' });
    return null;
  }
  return event;
}

module.exports = { loadEventForWrite };
