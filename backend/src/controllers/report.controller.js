const crypto = require('crypto');
const ExcelJS = require('exceljs');
const prisma = require('../lib/prisma');
const { loadEventForWrite } = require('../lib/eventAccess');
const { attachmentHeader, inlineHeader } = require('../lib/contentDisposition');
const { buildAttendanceHtmlReport } = require('../services/htmlReport.service');
const { fmtDateTime } = require('../lib/datetime');

async function loadAttendanceRows(eventId) {
  return prisma.attendance.findMany({
    where: { eventId },
    include: { user: { select: { mssv: true, name: true, email: true, class: true, faculty: true } } },
    orderBy: { checkinTime: 'asc' },
  });
}

async function exportAttendance(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const attendances = await loadAttendanceRows(req.params.id);

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
        checkin: a.checkinTime ? fmtDateTime(a.checkinTime) : '',
        checkout: a.checkoutTime ? fmtDateTime(a.checkoutTime) : '',
        status: statusMap[a.status] || a.status,
      });
      if (idx % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FF' } };
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', attachmentHeader(`diemdanh-${event.name}`, 'xlsx'));

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xuất báo cáo' });
  }
}

// Báo cáo HTML tự chứa (biểu đồ SVG + danh sách tham gia + danh sách vắng) —
// xem services/htmlReport.service.js. Tải về như một file .html độc lập,
// mở được offline, không phụ thuộc server sau khi đã xuất.
//
// `?view=1` trả về CÙNG nội dung đó nhưng với Content-Disposition: inline để
// BTC xem ngay trên web (ReportViewerModal.jsx nhúng vào iframe) thay vì phải
// tải file xuống rồi mở bằng tay. Một nguồn HTML duy nhất cho cả hai chế độ —
// xem trên web và file tải về không bao giờ lệch nhau.
async function exportAttendanceHtml(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const attendances = await loadAttendanceRows(req.params.id);
    const html = buildAttendanceHtmlReport(event, attendances);
    const inline = req.query.view === '1' || req.query.view === 'true';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      (inline ? inlineHeader : attachmentHeader)(`baocao-${event.name}`, 'html')
    );
    return res.send(html);
  } catch (err) {
    console.error('Export HTML error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xuất báo cáo' });
  }
}

// ── Chia sẻ báo cáo qua link công khai ─────────────────────────────────────
// BTC muốn gửi báo cáo cho người không có tài khoản (khách mời, phòng CTSV,
// giảng viên phụ trách). Link mang một token ngẫu nhiên 32 byte thay cho
// eventId, nên biết id sự kiện KHÔNG suy ra được link, và thu hồi = set token
// về NULL để link cũ chết ngay (khác với token HMAC stateless kiểu scanTicket
// — thu hồi được là yêu cầu chính ở đây).
function newShareToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// Link người dùng nhận là trang frontend (có header, nút in/tải), không phải
// URL API thô — frontend tự gọi /api/public/reports/:token để lấy HTML.
function shareUrl(token) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/bao-cao/${token}`;
}

function shareState(event) {
  return {
    shared: Boolean(event.reportShareToken),
    url: event.reportShareToken ? shareUrl(event.reportShareToken) : null,
    sharedAt: event.reportSharedAt,
  };
}

async function getReportShare(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;
    return res.json({ success: true, data: shareState(event) });
  } catch (err) {
    console.error('Get report share error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Tạo link, hoặc trả lại link đang có để bấm nhiều lần không làm chết link đã
// phát đi. `?rotate=1` mới cấp token mới (dùng khi link cũ bị lộ).
async function createReportShare(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const rotate = req.query.rotate === '1' || req.query.rotate === 'true';
    if (event.reportShareToken && !rotate) {
      return res.json({ success: true, data: shareState(event) });
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { reportShareToken: newShareToken(), reportSharedAt: new Date() },
      select: { reportShareToken: true, reportSharedAt: true },
    });
    return res.json({ success: true, data: shareState(updated) });
  } catch (err) {
    console.error('Create report share error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi tạo link chia sẻ' });
  }
}

async function revokeReportShare(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { reportShareToken: null, reportSharedAt: null },
      select: { reportShareToken: true, reportSharedAt: true },
    });
    return res.json({ success: true, data: shareState(updated) });
  } catch (err) {
    console.error('Revoke report share error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi thu hồi link chia sẻ' });
  }
}

// Endpoint công khai (mount trong public.routes.js, không qua authenticate).
// Token sai/đã thu hồi → 404 SHARE_NOT_FOUND, không phân biệt hai trường hợp
// để không tiết lộ token nào từng tồn tại.
async function getSharedReport(req, res) {
  try {
    const event = await prisma.event.findUnique({
      where: { reportShareToken: req.params.token },
    });
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'SHARE_NOT_FOUND',
        message: 'Link báo cáo không tồn tại hoặc đã bị thu hồi',
      });
    }

    const attendances = await loadAttendanceRows(event.id);
    const html = buildAttendanceHtmlReport(event, attendances);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', inlineHeader(`baocao-${event.name}`, 'html'));
    // Link công khai có thể bị lan rộng: không cho proxy/CDN giữ lại bản cũ,
    // để báo cáo luôn là số liệu hiện tại và thu hồi có hiệu lực ngay.
    res.setHeader('Cache-Control', 'no-store');
    return res.send(html);
  } catch (err) {
    console.error('Shared report error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi tải báo cáo' });
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

module.exports = {
  exportAttendance,
  exportAttendanceHtml,
  getReportShare,
  createReportShare,
  revokeReportShare,
  getSharedReport,
  getFraudLogs,
};
