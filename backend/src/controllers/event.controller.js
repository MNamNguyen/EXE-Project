const prisma = require('../lib/prisma');
const { generateToken, getExpiresIn } = require('../services/qr.service');

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
        orderBy: { checkinOpen: 'desc' },
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { attendances: true, eventMembers: true } },
          // STUDENT: kèm record điểm danh của chính mình để trang "Lịch sử tham dự"
          // (MyAttendance) hiển thị đúng trạng thái + giờ vào/ra.
          ...(role === 'STUDENT' && {
            attendances: {
              where: { userId },
              select: { status: true, checkinTime: true, checkoutTime: true },
              take: 1,
            },
          }),
        },
      }),
      prisma.event.count({ where }),
    ]);

    // Phẳng hoá attendances[] → attendance (1 record của sinh viên) cho frontend.
    const data = role === 'STUDENT'
      ? events.map(({ attendances, ...rest }) => ({ ...rest, attendance: attendances?.[0] || null }))
      : events;

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
      isWhitelisted, memberIds,
    } = req.body;

    const event = await prisma.event.create({
      data: {
        name, description, location,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        radius: parseFloat(radius || 100),
        gpsEnabled: gpsEnabled !== false,
        checkinOpen: new Date(checkinOpen),
        checkinClose: new Date(checkinClose),
        checkoutOpen: new Date(checkoutOpen),
        checkoutClose: new Date(checkoutClose),
        isWhitelisted: isWhitelisted || false,
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

    return res.json({ success: true, data: event });
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
      gpsEnabled, checkinOpen, checkinClose, checkoutOpen, checkoutClose, isWhitelisted,
    } = req.body;

    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(location && { location }),
        ...(lat !== undefined && { lat: lat ? parseFloat(lat) : null }),
        ...(lng !== undefined && { lng: lng ? parseFloat(lng) : null }),
        ...(radius && { radius: parseFloat(radius) }),
        ...(gpsEnabled !== undefined && { gpsEnabled }),
        ...(checkinOpen && { checkinOpen: new Date(checkinOpen) }),
        ...(checkinClose && { checkinClose: new Date(checkinClose) }),
        ...(checkoutOpen && { checkoutOpen: new Date(checkoutOpen) }),
        ...(checkoutClose && { checkoutClose: new Date(checkoutClose) }),
        ...(isWhitelisted !== undefined && { isWhitelisted }),
      },
    });

    return res.json({ success: true, data: updated });
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
      select: { id: true, name: true, checkinOpen: true, checkinClose: true, checkoutOpen: true, checkoutClose: true },
    });

    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

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

async function getAttendance(req, res) {
  try {
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

async function listMembers(req, res) {
  try {
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

    const result = await prisma.eventMember.createMany({
      data: userIds.map((userId) => ({ eventId: req.params.id, userId })),
      skipDuplicates: true,
    });

    return res.json({ success: true, message: `Đã thêm ${result.count} thành viên`, added: result.count });
  } catch (err) {
    console.error('Add members error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function removeMember(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    await prisma.eventMember.deleteMany({
      where: { eventId: req.params.id, userId: req.params.userId },
    });

    return res.json({ success: true, message: 'Đã xoá thành viên khỏi sự kiện' });
  } catch (err) {
    console.error('Remove member error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Tìm sinh viên CHƯA thuộc sự kiện để thêm vào danh sách tham gia.
async function searchUsersForEvent(req, res) {
  try {
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
  getQRToken, getAttendance, manualCheckin,
  listMembers, addMembers, removeMember, searchUsersForEvent,
};
