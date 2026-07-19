const prisma = require('../lib/prisma');
const { validateToken } = require('../services/qr.service');

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

async function processCheckin(req, res) {
  try {
    const { eventId, token, type, gps, deviceId } = req.body;
    const userId = req.user.id;
    const now = new Date();

    if (!eventId || !token || !type || !deviceId) {
      return res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'Thiếu thông tin' });
    }

    // 1. Validate QR token
    const isValidToken = validateToken(token, eventId, type);
    if (!isValidToken) {
      await logFraud(userId, eventId, 'INVALID_QR_TOKEN', req, { token });
      return res.status(400).json({
        success: false,
        error: 'QR_EXPIRED',
        message: 'Mã QR đã hết hạn. Vui lòng quét lại mã mới.',
      });
    }

    // 2. Get event
    const event = await prisma.event.findUnique({ where: { id: eventId, isActive: true } });
    if (!event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Không tìm thấy sự kiện' });
    }

    // 3. Validate time window
    if (type === 'checkin') {
      if (now < event.checkinOpen || now > event.checkinClose) {
        return res.status(400).json({
          success: false,
          error: 'OUTSIDE_TIME_WINDOW',
          message: `Check-in chỉ mở từ ${event.checkinOpen.toLocaleTimeString('vi-VN')} đến ${event.checkinClose.toLocaleTimeString('vi-VN')}`,
        });
      }
    } else {
      if (now < event.checkoutOpen || now > event.checkoutClose) {
        return res.status(400).json({
          success: false,
          error: 'OUTSIDE_TIME_WINDOW',
          message: `Check-out chỉ mở từ ${event.checkoutOpen.toLocaleTimeString('vi-VN')} đến ${event.checkoutClose.toLocaleTimeString('vi-VN')}`,
        });
      }
    }

    // 4. Validate GPS
    if (event.gpsEnabled) {
      if (!gps?.lat || !gps?.lng) {
        return res.status(400).json({
          success: false,
          error: 'GPS_REQUIRED',
          message: 'Vui lòng bật GPS và cấp quyền vị trí để check-in',
        });
      }
      if (event.lat && event.lng) {
        const distance = haversineDistance(gps.lat, gps.lng, event.lat, event.lng);
        if (distance > event.radius) {
          await logFraud(userId, eventId, 'GPS_OUT_OF_RANGE', req, { gps, distance: Math.round(distance) });
          return res.status(400).json({
            success: false,
            error: 'OUT_OF_RANGE',
            message: `Bạn đang cách địa điểm sự kiện ${Math.round(distance)}m. Vui lòng đến gần hơn.`,
            distance: Math.round(distance),
            requiredRadius: event.radius,
          });
        }
      }
    }

    // 5. Validate device binding
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

    // 6. Process attendance
    let attendance = await prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (type === 'checkin') {
      if (attendance?.checkinTime) {
        const time = attendance.checkinTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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
        const time = attendance.checkoutTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return res.status(400).json({
          success: false,
          error: 'ALREADY_CHECKED_OUT',
          message: `Bạn đã check-out lúc ${time} rồi.`,
        });
      }

      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: { checkoutTime: now, checkoutGps: gps, status: 'CHECKED_OUT' },
      });
    }

    return res.json({
      success: true,
      type,
      time: now.toISOString(),
      timeDisplay: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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

module.exports = { processCheckin, getCheckinStatus };
