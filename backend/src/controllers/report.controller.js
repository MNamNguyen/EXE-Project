const ExcelJS = require('exceljs');
const prisma = require('../lib/prisma');

async function exportAttendance(req, res) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { name: true, location: true, checkinOpen: true },
    });
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

    const attendances = await prisma.attendance.findMany({
      where: { eventId: req.params.id },
      include: { user: { select: { mssv: true, name: true, email: true, class: true, faculty: true } } },
      orderBy: { checkinTime: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Điểm danh');

    // Style header
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Danh sách điểm danh: ${event.name}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A6BFF' } };
    titleCell.alignment = { horizontal: 'center' };

    sheet.getRow(2).values = ['STT', 'MSSV', 'Họ và tên', 'Lớp', 'Giờ Check-in', 'Giờ Check-out', 'Trạng thái'];
    sheet.getRow(2).font = { bold: true };
    sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' } };

    sheet.columns = [
      { key: 'stt', width: 6 },
      { key: 'mssv', width: 14 },
      { key: 'name', width: 28 },
      { key: 'class', width: 14 },
      { key: 'checkin', width: 20 },
      { key: 'checkout', width: 20 },
      { key: 'status', width: 16 },
    ];

    const statusMap = {
      REGISTERED: 'Đăng ký',
      CHECKED_IN: 'Đã check-in',
      CHECKED_OUT: 'Đã check-out',
      ABSENT: 'Vắng',
    };

    attendances.forEach((a, idx) => {
      const row = sheet.addRow({
        stt: idx + 1,
        mssv: a.user.mssv || '',
        name: a.user.name,
        class: a.user.class || '',
        checkin: a.checkinTime ? new Date(a.checkinTime).toLocaleString('vi-VN') : '',
        checkout: a.checkoutTime ? new Date(a.checkoutTime).toLocaleString('vi-VN') : '',
        status: statusMap[a.status] || a.status,
      });
      if (idx % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FF' } };
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="diemdanh-${event.name.replace(/\s/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xuất báo cáo' });
  }
}

async function getFraudLogs(req, res) {
  try {
    const { eventId } = req.query;
    const logs = await prisma.fraudLog.findMany({
      where: { ...(eventId && { eventId }) },
      include: {
        user: { select: { name: true, mssv: true } },
        event: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json({ success: true, data: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

module.exports = { exportAttendance, getFraudLogs };
