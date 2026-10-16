const prisma = require('../lib/prisma');
const { validateToken } = require('../services/qr.service');
const { issueTicket, validateTicket } = require('../lib/scanTicket');
const { gateRejection } = require('../lib/attendanceGate');
const { gpsRejection } = require('../lib/geo');
const { fmtTime } = require('../lib/datetime');
const { feedbackPromptFor } = require('../lib/feedbackForm');

async function logFraud(userId, eventId, reason, req, extra = {}) {
  try {
    await prisma.fraudLog.create({
      data: {
        userId,
        eventId,
        reason,
        ip: req.ip,
        deviceId: req.headers['x-device-id'],
        token: extra.token,
        gps: extra.gps || null,
        metadata: extra,
      },
    });
  } catch {}
}

// Đổi token QR lấy vé quét. Gọi được khi CHƯA đăng nhập — đó chính là mục đích:
// chạy ngay lúc vừa quét, trước khi người dùng mất vài phút đăng nhập.
// Cố tình không đụng vào DB: token QR đã được ký HMAC theo eventId nên không thể
// bịa ra eventId lạ, còn sự kiện có tồn tại / có mở cổng hay không thì bước điểm
// danh thật vẫn kiểm tra đầy đủ.
async function issueScanTicket(req, res) {
  try {
    const { eventId, token, type, deviceId } = req.body || {};

    if (!eventId || !token || !type || !deviceId) {
      return res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'Thiếu thông tin' });
    }
    if (type !== 'checkin' && type !== 'checkout') {
      return res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'Loại điểm danh không hợp lệ' });
    }

    if (!validateToken(token, eventId, type)) {
      return res.status(400).json({
        success: false,
        error: 'QR_EXPIRED',
        message: 'Mã QR đã hết hạn. Vui lòng quét lại mã mới.',
      });
    }

    const { ticket, expiresAt } = issueTicket(eventId, type, deviceId);
    return res.json({ success: true, ticket, expiresAt });
  } catch (err) {
    console.error('Issue scan ticket error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function processCheckin(req, res) {
  try {
    const { eventId, token, ticket, type, gps, deviceId } = req.body;
    const userId = req.user.id;
    const now = new Date();

    if (!eventId || !type || !deviceId || (!token && !ticket)) {
      return res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'Thiếu thông tin' });
    }

    // 1. Validate bằng chứng đã quét mã: vé quét (đổi từ token lúc vừa quét) hoặc
    //    chính token QR nếu client chưa kịp/không đổi được vé.
    const isValidToken = ticket
      ? validateTicket(ticket, eventId, type, deviceId)
      : validateToken(token, eventId, type);
    if (!isValidToken) {
      await logFraud(userId, eventId, ticket ? 'INVALID_SCAN_TICKET' : 'INVALID_QR_TOKEN', req, {
        token: ticket || token,
      });
      return res.status(400).json({
        success: false,
        error: 'QR_EXPIRED',
        message: ticket
          ? 'Phiên quét mã đã hết hạn. Vui lòng quét lại mã QR.'
          : 'Mã QR đã hết hạn. Vui lòng quét lại mã mới.',
      });
    }

    // 2. Get event
    const event = await prisma.event.findUnique({ where: { id: eventId, isActive: true } });
    if (!event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Không tìm thấy sự kiện' });
    }
    // Sự kiện thiệp mời / công khai không có QR động tự quét — chặn cả khi ai đó tự ghép request.
    if (event.kind === 'INVITATION') {
      return res.status(400).json({
        success: false,
        error: 'INVITATION_EVENT',
        message: 'Sự kiện này check-in bằng thiệp mời. Vui lòng đưa thiệp cho Ban tổ chức quét.',
      });
    }
    if (event.kind === 'PUBLIC') {
      return res.status(400).json({
        success: false,
        error: 'PUBLIC_EVENT',
        message: 'Sự kiện này check-in bằng cách quét mã QR tại chỗ và điền thông tin.',
      });
    }

    // 3. Whitelist: chỉ thành viên trong danh sách mới được điểm danh (design 2026-07-14).
    if (event.isWhitelisted) {
      const membership = await prisma.eventMember.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'NOT_REGISTERED',
          message: 'Bạn không có trong danh sách đăng ký tham gia sự kiện này.',
        });
      }
    }

    // 4. Validate cổng điểm danh — theo lịch (AUTO) hoặc BTC mở/đóng thủ công.
    const closed = gateRejection(event, type, now);
    if (closed) return res.status(400).json(closed);

    // 5. Validate GPS
    const gpsError = gpsRejection(event, gps);
    if (gpsError) {
      if (gpsError.fraud) await logFraud(userId, eventId, gpsError.fraud.reason, req, gpsError.fraud.extra);
      return res.status(gpsError.status).json(gpsError.body);
    }

    // 6. Validate device binding
    const deviceBinding = await prisma.deviceBinding.findFirst({
      where: { userId, deviceId, isTrusted: true },
    });
    if (!deviceBinding) {
      await logFraud(userId, eventId, 'UNBOUND_DEVICE', req);
      return res.status(403).json({
        success: false,
        error: 'DEVICE_NOT_BOUND',
        message: 'Thiết bị chưa được xác thực. Vui lòng đăng xuất và đăng nhập lại.',
      });
    }

    // 7. Process attendance
    let attendance = await prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (type === 'checkin') {
      if (attendance?.checkinTime) {
        const time = fmtTime(attendance.checkinTime);
        return res.status(400).json({
          success: false,
          error: 'ALREADY_CHECKED_IN',
          message: `Bạn đã check-in lúc ${time} rồi.`,
        });
      }

      attendance = await prisma.attendance.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId, checkinTime: now, checkinGps: gps, deviceId, ip: req.ip, status: 'CHECKED_IN' },
        update: { checkinTime: now, checkinGps: gps, deviceId, status: 'CHECKED_IN' },
      });
    } else {
      if (!attendance?.checkinTime) {
        return res.status(400).json({
          success: false,
          error: 'NOT_CHECKED_IN',
          message: 'Bạn chưa check-in cho sự kiện này.',
        });
      }
      if (attendance?.checkoutTime) {
        const time = fmtTime(attendance.checkoutTime);
        // Quét lại mã check-out (vd. lỡ đóng tab trước khi đánh giá) vẫn nhận
        // được form đánh giá nếu chưa gửi.
        const feedback = await feedbackPromptFor(eventId, userId);
        return res.status(400).json({
          success: false,
          error: 'ALREADY_CHECKED_OUT',
          message: `Bạn đã check-out lúc ${time} rồi.`,
          ...(feedback && { feedback }),
        });
      }

      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: { checkoutTime: now, checkoutGps: gps, status: 'CHECKED_OUT' },
      });
    }

    // Check-out xong là lúc hỏi đánh giá — trang quét mã hiện form ngay nếu có.
    const feedback = type === 'checkout' ? await feedbackPromptFor(eventId, userId) : null;

    return res.json({
      success: true,
      type,
      ...(feedback && { feedback }),
      time: now.toISOString(),
      timeDisplay: fmtTime(now, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      user: { name: req.user.name, mssv: req.user.mssv },
      event: { id: event.id, name: event.name, location: event.location },
    });
  } catch (err) {
    console.error('Checkin error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Lỗi server. Vui lòng thử lại.' });
  }
}

async function getCheckinStatus(req, res) {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const attendance = await prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, location: true, gpsEnabled: true, checkinOpen: true, checkinClose: true, checkoutOpen: true, checkoutClose: true },
    });

    return res.json({ success: true, attendance, event });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

module.exports = { issueScanTicket, processCheckin, getCheckinStatus };
