const prisma = require('../lib/prisma');
const { generateToken, getExpiresIn } = require('../services/qr.service');
const { loadEventForWrite } = require('../lib/eventAccess');
const { addUsersToEvent, removeUserFromEvent } = require('../lib/eventMembership');
const { parseEventDates, parseGateState } = require('../lib/parseOptionalDate');
const { gateSummary } = require('../lib/attendanceGate');

async function listEvents(req, res) {
  try {
    const { role, id: userId } = req.user;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(role === 'STUDENT' && {
        OR: [
          { isWhitelisted: false },
          { eventMembers: { some: { userId } } },
        ],
      }),
      ...(['BTC', 'LECTURER'].includes(role) && role !== 'ADMIN' && {
        ...(role === 'BTC' && { createdById: userId }),
      }),
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { checkinOpen: { sort: 'desc', nulls: 'last' } },
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { attendances: true, eventMembers: true } },
          // STUDENT: kèm record điểm danh của chính mình để trang "Lịch sử tham dự"
          // (MyAttendance) hiển thị đúng trạng thái + giờ vào/ra, và kèm suất
          // đăng ký để dashboard biết có cần hiện nút "Đăng ký tham gia" không.
          ...(role === 'STUDENT' && {
            attendances: {
              where: { userId },
              select: { status: true, checkinTime: true, checkoutTime: true },
              take: 1,
            },
            eventMembers: {
              where: { userId },
              select: { id: true },
              take: 1,
            },
            // Trạng thái form đánh giá + đã gửi phiếu chưa, để "Lịch sử tham dự"
            // hiện nút "Đánh giá" mà không phải gọi thêm 1 request cho mỗi sự kiện.
            feedbackForm: {
              select: {
                isOpen: true,
                responses: { where: { userId }, select: { id: true }, take: 1 },
              },
            },
            certificates: { where: { userId }, select: { id: true }, take: 1 },
          }),
        },
      }),
      prisma.event.count({ where }),
    ]);

    // Phẳng hoá attendances[]/eventMembers[] → attendance + isRegistered cho frontend,
    // và đính kèm trạng thái cổng điểm danh đã tính sẵn (frontend không tự suy ra
    // được vì không biết checkinState/checkoutState theo hành vi mở/đóng thủ công).
    const withGate = (e) => ({ ...e, gate: gateSummary(e) });
    const data = role === 'STUDENT'
      ? events.map(({ attendances, eventMembers, feedbackForm, certificates, ...rest }) => ({
          ...withGate(rest),
          attendance: attendances?.[0] || null,
          isRegistered: (eventMembers?.length || 0) > 0,
          feedback: feedbackForm
            ? { isOpen: feedbackForm.isOpen, submitted: (feedbackForm.responses?.length || 0) > 0 }
            : null,
          certificateId: certificates?.[0]?.id || null,
        }))
      : events.map(withGate);

    return res.json({ success: true, data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('List events error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function createEvent(req, res) {
  try {
    const {
      name, description, location, lat, lng, radius,
      gpsEnabled, checkinOpen, checkinClose, checkoutOpen, checkoutClose,
      checkinState, checkoutState,
      isWhitelisted, allowRegistration, memberIds,
    } = req.body;

    // Khung giờ là TUỲ CHỌN — BTC có thể bỏ trống và chủ động mở/đóng điểm danh
    // bằng checkinState/checkoutState (nút "Mở điểm danh"/"Đóng điểm danh")
    // thay vì bắt buộc đặt lịch trước.
    const { value: dates, error: dateError } = parseEventDates({ checkinOpen, checkinClose, checkoutOpen, checkoutClose });
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    const latVal = lat === undefined || lat === null || lat === '' ? null : Number(lat);
    const lngVal = lng === undefined || lng === null || lng === '' ? null : Number(lng);
    const gpsOn = gpsEnabled !== false;

    if (gpsOn) {
      const okLat = latVal !== null && Number.isFinite(latVal) && latVal >= -90 && latVal <= 90;
      const okLng = lngVal !== null && Number.isFinite(lngVal) && lngVal >= -180 && lngVal <= 180;
      if (!okLat || !okLng) {
        return res.status(400).json({ success: false, message: 'Bật GPS thì phải nhập toạ độ hợp lệ' });
      }
    }

    const radiusVal = radius === undefined || radius === null || radius === '' ? 100 : Number(radius);
    if (!Number.isFinite(radiusVal) || radiusVal <= 0) {
      return res.status(400).json({ success: false, message: 'Bán kính không hợp lệ' });
    }

    const event = await prisma.event.create({
      data: {
        name, description, location,
        lat: latVal,
        lng: lngVal,
        radius: radiusVal,
        gpsEnabled: gpsOn,
        checkinOpen: dates.checkinOpen,
        checkinClose: dates.checkinClose,
        checkoutOpen: dates.checkoutOpen,
        checkoutClose: dates.checkoutClose,
        checkinState: parseGateState(checkinState),
        checkoutState: parseGateState(checkoutState),
        isWhitelisted: isWhitelisted || false,
        allowRegistration: allowRegistration !== false,
        createdById: req.user.id,
        ...(memberIds?.length && {
          eventMembers: {
            create: memberIds.map((uid) => ({ userId: uid })),
          },
        }),
      },
      include: { createdBy: { select: { name: true } } },
    });

    return res.status(201).json({ success: true, data: event });
  } catch (err) {
    console.error('Create event error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function getEvent(req, res) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { attendances: true, eventMembers: true } },
      },
    });

    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

    // Toạ độ sự kiện chỉ dành cho ADMIN/người tạo (chống giả GPS từ xa).
    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      event.lat = null;
      event.lng = null;
      event.radius = null;
    }

    return res.json({ success: true, data: { ...event, gate: gateSummary(event) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function updateEvent(req, res) {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền chỉnh sửa' });
    }

    const {
      name, description, location, lat, lng, radius,
      gpsEnabled, checkinOpen, checkinClose, checkoutOpen, checkoutClose,
      checkinState, checkoutState,
      isWhitelisted, allowRegistration,
    } = req.body;

    const dateVals = {};
    for (const [key, value] of Object.entries({ checkinOpen, checkinClose, checkoutOpen, checkoutClose })) {
      if (value !== undefined && value !== null && value !== '') {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Thời gian không hợp lệ' });
        }
        dateVals[key] = d;
      }
    }

    const latVal = lat !== undefined ? (lat === null || lat === '' ? null : Number(lat)) : event.lat;
    const lngVal = lng !== undefined ? (lng === null || lng === '' ? null : Number(lng)) : event.lng;
    const gpsOn = gpsEnabled !== undefined ? gpsEnabled : event.gpsEnabled;

    if (gpsOn) {
      const okLat = latVal !== null && Number.isFinite(latVal) && latVal >= -90 && latVal <= 90;
      const okLng = lngVal !== null && Number.isFinite(lngVal) && lngVal >= -180 && lngVal <= 180;
      if (!okLat || !okLng) {
        return res.status(400).json({ success: false, message: 'Bật GPS thì phải nhập toạ độ hợp lệ' });
      }
    }

    const radiusVal = radius !== undefined && radius !== null && radius !== '' ? Number(radius) : undefined;
    if (radiusVal !== undefined && (!Number.isFinite(radiusVal) || radiusVal <= 0)) {
      return res.status(400).json({ success: false, message: 'Bán kính không hợp lệ' });
    }

    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(location && { location }),
        ...(lat !== undefined && { lat: latVal }),
        ...(lng !== undefined && { lng: lngVal }),
        ...(radiusVal !== undefined && { radius: radiusVal }),
        ...(gpsEnabled !== undefined && { gpsEnabled }),
        ...(dateVals.checkinOpen && { checkinOpen: dateVals.checkinOpen }),
        ...(dateVals.checkinClose && { checkinClose: dateVals.checkinClose }),
        ...(dateVals.checkoutOpen && { checkoutOpen: dateVals.checkoutOpen }),
        ...(dateVals.checkoutClose && { checkoutClose: dateVals.checkoutClose }),
        ...(isWhitelisted !== undefined && { isWhitelisted }),
        ...(allowRegistration !== undefined && { allowRegistration }),
        // Đây là cách nút "Mở điểm danh" / "Đóng điểm danh" trên EventDetail
        // hoạt động — gửi PUT chỉ với checkinState (hoặc checkoutState) mà
        // không cần đụng tới các trường khác.
        ...(checkinState !== undefined && { checkinState: parseGateState(checkinState) }),
        ...(checkoutState !== undefined && { checkoutState: parseGateState(checkoutState) }),
      },
    });

    return res.json({ success: true, data: { ...updated, gate: gateSummary(updated) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function deleteEvent(req, res) {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền xoá' });
    }

    await prisma.event.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ success: true, message: 'Đã xoá sự kiện' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function getQRToken(req, res) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id, isActive: true },
      select: { id: true, name: true, createdById: true, checkinOpen: true, checkinClose: true, checkoutOpen: true, checkoutClose: true },
    });

    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền lấy mã QR cho sự kiện này' });
    }

    const checkinToken = generateToken(event.id, 'checkin');
    const checkoutToken = generateToken(event.id, 'checkout');
    const expiresIn = getExpiresIn();

    return res.json({
      success: true,
      data: {
        eventId: event.id,
        eventName: event.name,
        checkinToken,
        checkoutToken,
        expiresIn,
        frontendUrl: process.env.FRONTEND_URL,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Màn hình trình chiếu hỏi mỗi vài giây để chào người vừa check-in. Màn chiếu
// là nơi CÔNG KHAI nên chỉ trả tên — không MSSV/email/lớp. Luôn trả N lượt mới
// nhất (không dùng con trỏ thời gian): client tự so id để biết ai mới, nên
// chạy lại sau khi mất mạng hay server ngủ dậy cũng không lệch.
const LIVE_RECENT_LIMIT = 60;

async function getLiveCheckins(req, res) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id, isActive: true },
      select: { id: true, createdById: true },
    });
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem sự kiện này' });
    }

    const [recent, checkedIn, registered] = await Promise.all([
      prisma.attendance.findMany({
        where: { eventId: event.id, checkinTime: { not: null } },
        orderBy: { checkinTime: 'desc' },
        take: LIVE_RECENT_LIMIT,
        select: { id: true, checkinTime: true, user: { select: { name: true } } },
      }),
      prisma.attendance.count({ where: { eventId: event.id, checkinTime: { not: null } } }),
      prisma.attendance.count({ where: { eventId: event.id } }),
    ]);

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        checkedIn,
        registered,
        recent: recent.map((a) => ({ id: a.id, name: a.user?.name || 'Khách mời', checkinTime: a.checkinTime })),
      },
    });
  } catch (err) {
    console.error('Live checkins error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function getAttendance(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const { search, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filterWhere = {
      eventId: req.params.id,
      ...(status && { status }),
      ...(search && {
        user: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { mssv: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [attendances, total, statGroups] = await Promise.all([
      prisma.attendance.findMany({
        where: filterWhere,
        include: { user: { select: { id: true, mssv: true, name: true, email: true, class: true } } },
        orderBy: { checkinTime: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.attendance.count({ where: filterWhere }),
      // Stats always from full event scope, not filtered
      prisma.attendance.groupBy({
        by: ['status'],
        where: { eventId: req.params.id },
        _count: { status: true },
      }),
    ]);

    const statMap = {};
    statGroups.forEach(({ status: s, _count }) => { statMap[s] = _count.status; });

    const stats = {
      total: Object.values(statMap).reduce((a, b) => a + b, 0),
      registered: statMap['REGISTERED'] || 0,
      checkedIn: (statMap['CHECKED_IN'] || 0) + (statMap['CHECKED_OUT'] || 0),
      checkedOut: statMap['CHECKED_OUT'] || 0,
      absent: statMap['ABSENT'] || 0,
    };

    return res.json({ success: true, data: attendances, stats, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function manualCheckin(req, res) {
  try {
    const { identifier, type } = req.body; // identifier = MSSV, email, or userId
    const eventId = req.params.id;
    const now = new Date();

    const event = await prisma.event.findUnique({
      where: { id: eventId, isActive: true },
      select: { id: true, createdById: true },
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }
    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền thao tác sự kiện này' });
    }

    // Resolve identifier → userId (supports MSSV, email, or raw cuid)
    const userRecord = await prisma.user.findFirst({
      where: { OR: [{ id: identifier }, { mssv: identifier }, { email: identifier }] },
      select: { id: true, name: true, mssv: true },
    });
    if (!userRecord) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên với MSSV/email đã nhập' });
    }
    const userId = userRecord.id;

    let attendance = await prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (type === 'checkin') {
      if (attendance?.checkinTime) {
        return res.status(400).json({ success: false, message: 'Sinh viên đã check-in' });
      }
      attendance = await prisma.attendance.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId, checkinTime: now, status: 'CHECKED_IN', deviceId: 'MANUAL' },
        update: { checkinTime: now, status: 'CHECKED_IN' },
      });
    } else {
      if (!attendance?.checkinTime) {
        return res.status(400).json({ success: false, message: 'Sinh viên chưa check-in' });
      }
      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: { checkoutTime: now, status: 'CHECKED_OUT' },
      });
    }

    return res.json({ success: true, data: attendance });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// ───────────────────────────────────────────────────────────────
// Quản lý danh sách tham gia (whitelist) theo từng sự kiện
// ───────────────────────────────────────────────────────────────

async function listMembers(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      eventId: req.params.id,
      ...(search && {
        user: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { mssv: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [members, total] = await Promise.all([
      prisma.eventMember.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { user: { select: { id: true, mssv: true, name: true, email: true, class: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      prisma.eventMember.count({ where }),
    ]);

    return res.json({ success: true, data: members, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('List members error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function addMembers(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Chưa chọn người dùng để thêm' });
    }

    const { added } = await addUsersToEvent(req.params.id, userIds);

    return res.json({ success: true, message: `Đã thêm ${added} thành viên`, added });
  } catch (err) {
    console.error('Add members error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function removeMember(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    await removeUserFromEvent(req.params.id, req.params.userId);

    return res.json({ success: true, message: 'Đã xoá thành viên khỏi sự kiện' });
  } catch (err) {
    console.error('Remove member error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Danh sách lớp kèm sĩ số, để BTC thêm nhanh nguyên lớp vào sự kiện.
// `remaining` = số sinh viên của lớp chưa có trong danh sách tham gia.
async function listClasses(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const [groups, members] = await Promise.all([
      prisma.user.groupBy({
        by: ['class'],
        where: { isActive: true, role: 'STUDENT', class: { not: null } },
        _count: { _all: true },
        orderBy: { class: 'asc' },
      }),
      prisma.eventMember.findMany({
        where: { eventId: req.params.id },
        select: { user: { select: { class: true } } },
      }),
    ]);

    const inEventByClass = {};
    for (const { user } of members) {
      if (user?.class) inEventByClass[user.class] = (inEventByClass[user.class] || 0) + 1;
    }

    const data = groups
      .filter((g) => g.class && g.class.trim())
      .map((g) => {
        const total = g._count._all;
        const inEvent = inEventByClass[g.class] || 0;
        return { class: g.class, total, inEvent, remaining: Math.max(0, total - inEvent) };
      });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('List classes error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Thêm toàn bộ sinh viên đang hoạt động của một hoặc nhiều lớp vào danh sách tham gia.
async function addMembersByClass(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const raw = req.body?.classes ?? req.body?.class;
    const classes = [...new Set(
      (Array.isArray(raw) ? raw : [raw])
        .filter((c) => typeof c === 'string')
        .map((c) => c.trim())
        .filter(Boolean)
    )];

    if (classes.length === 0) {
      return res.status(400).json({ success: false, message: 'Chưa chọn lớp nào để thêm' });
    }

    const users = await prisma.user.findMany({
      where: { isActive: true, role: 'STUDENT', class: { in: classes } },
      select: { id: true },
    });

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sinh viên nào đang hoạt động trong lớp đã chọn',
      });
    }

    const { added } = await addUsersToEvent(req.params.id, users.map((u) => u.id));
    const skipped = users.length - added;

    return res.json({
      success: true,
      added,
      skipped,
      matched: users.length,
      classes,
      message: skipped > 0
        ? `Đã thêm ${added} sinh viên (${skipped} người đã có sẵn trong danh sách)`
        : `Đã thêm ${added} sinh viên vào danh sách tham gia`,
    });
  } catch (err) {
    console.error('Add members by class error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Tìm sinh viên CHƯA thuộc sự kiện để thêm vào danh sách tham gia.
async function searchUsersForEvent(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, data: [] });
    }

    const existing = await prisma.eventMember.findMany({
      where: { eventId: req.params.id },
      select: { userId: true },
    });
    const excludeIds = existing.map((m) => m.userId);

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { notIn: excludeIds },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { mssv: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, mssv: true, name: true, email: true, class: true },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('Search users for event error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

module.exports = {
  listEvents, createEvent, getEvent, updateEvent, deleteEvent,
  getQRToken, getLiveCheckins, getAttendance, manualCheckin,
  listMembers, addMembers, removeMember, searchUsersForEvent,
  listClasses, addMembersByClass,
};
