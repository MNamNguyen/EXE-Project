const prisma = require('../lib/prisma');
const { addUsersToEvent } = require('../lib/eventMembership');

const CLASS_NOT_FOUND = { success: false, message: 'Không tìm thấy lớp' };

async function loadClass(id) {
  return prisma.class.findUnique({ where: { id } });
}

// ───────────────────────────────────────────────────────────────
// CRUD lớp học
// ───────────────────────────────────────────────────────────────

async function listClasses(req, res) {
  try {
    const { search } = req.query;
    const where = search ? { name: { contains: search, mode: 'insensitive' } } : {};

    const classes = await prisma.class.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { createdBy: { select: { name: true } } },
    });

    if (classes.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Sĩ số hiện tại — đếm theo User.class (chuỗi) trùng tên lớp, không phải
    // FK, nên gộp 1 lượt groupBy thay vì N truy vấn cho N lớp.
    const counts = await prisma.user.groupBy({
      by: ['class'],
      where: { isActive: true, class: { in: classes.map((c) => c.name) } },
      _count: { _all: true },
    });
    const countByName = Object.fromEntries(counts.map((c) => [c.class, c._count._all]));

    const data = classes.map((c) => ({ ...c, memberCount: countByName[c.name] || 0 }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('List classes error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function createClass(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    const description = req.body?.description ? String(req.body.description).trim() : null;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên lớp' });
    }

    const existing = await prisma.class.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Tên lớp đã tồn tại' });
    }

    const cls = await prisma.class.create({
      data: { name, description, createdById: req.user.id },
    });

    return res.status(201).json({ success: true, data: { ...cls, memberCount: 0 } });
  } catch (err) {
    console.error('Create class error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function getClass(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const memberCount = await prisma.user.count({ where: { isActive: true, class: cls.name } });

    return res.json({ success: true, data: { ...cls, memberCount } });
  } catch (err) {
    console.error('Get class error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Đổi tên lớp phải lan sang mọi User.class đang mang tên cũ, nếu không danh sách
// lớp và dữ liệu thành viên thật sẽ lệch nhau ngay lập tức.
async function updateClass(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const { description, isActive } = req.body;
    const nameRaw = req.body.name;
    const name = nameRaw !== undefined ? String(nameRaw).trim() : undefined;

    if (name !== undefined && !name) {
      return res.status(400).json({ success: false, message: 'Tên lớp không được để trống' });
    }

    if (name && name !== cls.name) {
      const conflict = await prisma.class.findFirst({ where: { name, id: { not: cls.id } } });
      if (conflict) {
        return res.status(400).json({ success: false, message: 'Tên lớp đã tồn tại' });
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.class.update({
        where: { id: cls.id },
        data: {
          ...(name && name !== cls.name && { name }),
          ...(description !== undefined && { description: description ? String(description).trim() : null }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
      }),
      ...(name && name !== cls.name
        ? [prisma.user.updateMany({ where: { class: cls.name }, data: { class: name } })]
        : []),
    ]);

    const memberCount = await prisma.user.count({ where: { isActive: true, class: updated.name } });

    return res.json({ success: true, data: { ...updated, memberCount } });
  } catch (err) {
    console.error('Update class error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Xoá lớp chỉ khi không còn thành viên nào mang tên lớp đó — tránh âm thầm để
// lại một nhóm sinh viên "lớp ma" không còn xuất hiện trong trang quản lý lớp.
async function deleteClass(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const memberCount = await prisma.user.count({ where: { class: cls.name } });
    if (memberCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Lớp còn ${memberCount} thành viên. Hãy chuyển hoặc xoá khỏi lớp trước khi xoá.`,
      });
    }

    await prisma.class.delete({ where: { id: cls.id } });
    return res.json({ success: true, message: 'Đã xoá lớp' });
  } catch (err) {
    console.error('Delete class error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// ───────────────────────────────────────────────────────────────
// Quản lý thành viên trong lớp (bulk)
// ───────────────────────────────────────────────────────────────

async function listMembers(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      class: cls.name,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { mssv: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: { id: true, mssv: true, name: true, email: true, isActive: true, role: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({ success: true, data: members, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('List class members error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Tìm người CHƯA thuộc lớp này để thêm vào — gồm cả người đang ở lớp khác,
// vì thêm vào lớp mới sẽ chuyển họ sang (một người chỉ thuộc một lớp).
//
// `unassignedOnly=1` chỉ liệt kê người CHƯA có lớp nào — đúng nhóm mà BTC hay
// phải sửa tay từng người (import Excel thiếu cột Lớp, đăng ký công khai không
// điền lớp...). Bật cờ này thì được liệt kê cả khi chưa gõ từ khoá tìm kiếm,
// vì mục đích là "cho tôi thấy hết những người còn thiếu" chứ không phải tra
// một cái tên cụ thể.
async function searchAssignable(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const { q } = req.query;
    const unassignedOnly = req.query.unassignedOnly === '1' || req.query.unassignedOnly === 'true';

    if (!unassignedOnly && (!q || !q.trim())) {
      return res.json({ success: true, data: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: 'STUDENT',
        class: unassignedOnly ? null : { not: cls.name },
        ...(q && q.trim() && {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { mssv: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      select: { id: true, mssv: true, name: true, email: true, class: true },
      take: 50,
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('Search assignable users error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Gán nhiều người vào lớp cùng lúc — vừa dùng để thêm thành viên mới, vừa dùng
// để "sửa" hàng loạt cho người thiếu/sai lớp (chuyển từ lớp cũ hoặc từ trống
// sang lớp này), vì mỗi người chỉ có đúng một giá trị class tại một thời điểm.
async function addMembers(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const userIds = Array.isArray(req.body?.userIds) ? [...new Set(req.body.userIds)] : [];
    if (userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Chưa chọn người dùng để thêm' });
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { class: cls.name },
    });

    return res.json({
      success: true,
      updated: result.count,
      message: `Đã gán ${result.count} người vào lớp ${cls.name}`,
    });
  } catch (err) {
    console.error('Add class members error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Gỡ khỏi lớp = xoá giá trị class (không xoá tài khoản). Chỉ tác động người
// ĐANG thuộc đúng lớp này, tránh vô tình gỡ nhầm nếu id đã bị chuyển lớp khác.
async function removeMembers(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const userIds = Array.isArray(req.body?.userIds) ? [...new Set(req.body.userIds)] : [];
    if (userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Chưa chọn người dùng để gỡ' });
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds }, class: cls.name },
      data: { class: null },
    });

    return res.json({
      success: true,
      updated: result.count,
      message: `Đã gỡ ${result.count} người khỏi lớp`,
    });
  } catch (err) {
    console.error('Remove class members error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// ───────────────────────────────────────────────────────────────
// Buổi điểm danh (Event gắn classId) — "mã điểm danh theo buổi học"
// ───────────────────────────────────────────────────────────────

function parseSessionInput(body) {
  const { name, location, checkinOpen, checkinClose, checkoutOpen, checkoutClose } = body;

  if (!location || !String(location).trim()) {
    return { error: 'Vui lòng nhập địa điểm buổi học' };
  }

  const dates = { checkinOpen, checkinClose, checkoutOpen, checkoutClose };
  const parsed = {};
  for (const [key, value] of Object.entries(dates)) {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) return { error: 'Thời gian không hợp lệ' };
    parsed[key] = d;
  }

  const { lat, lng, radius, gpsEnabled } = body;
  const latVal = lat === undefined || lat === null || lat === '' ? null : Number(lat);
  const lngVal = lng === undefined || lng === null || lng === '' ? null : Number(lng);
  const gpsOn = gpsEnabled !== false;

  if (gpsOn) {
    const okLat = latVal !== null && Number.isFinite(latVal) && latVal >= -90 && latVal <= 90;
    const okLng = lngVal !== null && Number.isFinite(lngVal) && lngVal >= -180 && lngVal <= 180;
    if (!okLat || !okLng) return { error: 'Bật GPS thì phải nhập toạ độ hợp lệ' };
  }

  const radiusVal = radius === undefined || radius === null || radius === '' ? 100 : Number(radius);
  if (!Number.isFinite(radiusVal) || radiusVal <= 0) return { error: 'Bán kính không hợp lệ' };

  return {
    value: {
      name: name && String(name).trim() ? String(name).trim() : null,
      location: String(location).trim(),
      ...parsed,
      lat: latVal, lng: lngVal, radius: radiusVal, gpsEnabled: gpsOn,
    },
  };
}

// Tạo một buổi điểm danh cho lớp: sinh Event whitelist riêng cho lớp (không mở
// đăng ký công khai), rồi tự động đưa toàn bộ sinh viên đang hoạt động của lớp
// vào danh sách tham gia — BTC mở màn hình QR ngay sau khi tạo là điểm danh được.
async function createSession(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const { value, error } = parseSessionInput(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    const sessionName = value.name || `${cls.name} - Buổi điểm danh ${value.checkinOpen.toLocaleDateString('vi-VN')}`;

    const event = await prisma.event.create({
      data: {
        name: sessionName,
        location: value.location,
        lat: value.lat, lng: value.lng, radius: value.radius, gpsEnabled: value.gpsEnabled,
        checkinOpen: value.checkinOpen, checkinClose: value.checkinClose,
        checkoutOpen: value.checkoutOpen, checkoutClose: value.checkoutClose,
        isWhitelisted: true,
        allowRegistration: false,
        createdById: req.user.id,
        classId: cls.id,
      },
    });

    const students = await prisma.user.findMany({
      where: { isActive: true, role: 'STUDENT', class: cls.name },
      select: { id: true },
    });
    const { added } = await addUsersToEvent(event.id, students.map((s) => s.id));

    return res.status(201).json({
      success: true,
      data: event,
      enrolled: added,
      message: `Đã tạo buổi điểm danh và thêm ${added} sinh viên của lớp ${cls.name}`,
    });
  } catch (err) {
    console.error('Create class session error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function listSessions(req, res) {
  try {
    const cls = await loadClass(req.params.id);
    if (!cls) return res.status(404).json(CLASS_NOT_FOUND);

    const sessions = await prisma.event.findMany({
      where: { classId: cls.id },
      orderBy: { checkinOpen: 'desc' },
      include: { _count: { select: { attendances: true, eventMembers: true } } },
    });

    return res.json({ success: true, data: sessions });
  } catch (err) {
    console.error('List class sessions error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

module.exports = {
  listClasses, createClass, getClass, updateClass, deleteClass,
  listMembers, searchAssignable, addMembers, removeMembers,
  createSession, listSessions,
};
