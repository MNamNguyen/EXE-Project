const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { addUsersToEvent } = require('../lib/eventMembership');
const emailService = require('../services/email.service');

// Các trường sự kiện an toàn để lộ ra endpoint công khai (KHÔNG kèm lat/lng/radius
// để tránh rò toạ độ geofence cho người chưa đăng nhập — xem event.controller#getEvent).
const PUBLIC_EVENT_FIELDS = {
  id: true,
  name: true,
  description: true,
  location: true,
  checkinOpen: true,
  checkinClose: true,
  checkoutOpen: true,
  checkoutClose: true,
  isWhitelisted: true,
  allowRegistration: true,
  createdBy: { select: { name: true } },
  _count: { select: { eventMembers: true } },
};

function generateTempPassword() {
  return 'Fpt@' + crypto.randomInt(100000, 1000000).toString();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeInput(body = {}) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    name: str(body.name).replace(/\s+/g, ' '),
    mssv: str(body.mssv).toUpperCase(),
    email: str(body.email).toLowerCase(),
    phone: str(body.phone),
    userClass: str(body.class),
  };
}

// Sự kiện còn nhận đăng ký khi: đang hoạt động, bật cho phép đăng ký và
// chưa đóng cổng check-in.
function registrationWindowError(event, now = new Date()) {
  if (!event.allowRegistration) {
    return 'Sự kiện này không mở đăng ký trực tuyến. Vui lòng liên hệ Ban tổ chức.';
  }
  if (now > event.checkinClose) {
    return 'Sự kiện đã đóng cổng đăng ký.';
  }
  return null;
}

async function joinEvent(eventId, userId) {
  const { added } = await addUsersToEvent(eventId, [userId]);
  return { alreadyRegistered: added === 0 };
}

// ───────────────────────────────────────────────────────────────
// Endpoint công khai (không cần đăng nhập)
// ───────────────────────────────────────────────────────────────

// Danh sách sự kiện đang mở đăng ký, để người ngoài chọn sự kiện muốn tham gia.
async function listOpenEvents(req, res) {
  try {
    const { search, limit = 30 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 30, 50);

    const events = await prisma.event.findMany({
      where: {
        isActive: true,
        allowRegistration: true,
        checkinClose: { gte: new Date() },
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      select: PUBLIC_EVENT_FIELDS,
      orderBy: { checkinOpen: 'asc' },
      take,
    });

    return res.json({ success: true, data: events });
  } catch (err) {
    console.error('List open events error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function getPublicEvent(req, res) {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, isActive: true },
      select: PUBLIC_EVENT_FIELDS,
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }

    return res.json({
      success: true,
      data: { ...event, registrationClosed: Boolean(registrationWindowError(event)) },
    });
  } catch (err) {
    console.error('Get public event error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Đăng ký tham gia sự kiện bằng form (họ tên / MSSV / email).
// Chưa có tài khoản → tạo mới kèm mật khẩu tạm gửi qua email.
async function registerPublic(req, res) {
  try {
    const { name, mssv, email, phone, userClass } = normalizeInput(req.body);

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập họ tên hợp lệ' });
    }
    if (!mssv) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã số sinh viên' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
    }

    const event = await prisma.event.findFirst({
      where: { id: req.params.id, isActive: true },
      select: { id: true, name: true, location: true, checkinOpen: true, checkinClose: true, allowRegistration: true },
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }

    const windowError = registrationWindowError(event);
    if (windowError) {
      return res.status(400).json({ success: false, message: windowError });
    }

    // Khớp tài khoản theo email HOẶC MSSV. Nếu hai định danh trỏ về hai tài khoản
    // khác nhau thì dữ liệu nhập bị lệch → yêu cầu người dùng kiểm tra lại.
    const matches = await prisma.user.findMany({
      where: { OR: [{ email }, { mssv }] },
      select: { id: true, email: true, mssv: true, name: true, isActive: true },
    });

    if (matches.length > 1) {
      return res.status(409).json({
        success: false,
        message: 'Email và MSSV đang thuộc hai tài khoản khác nhau. Vui lòng kiểm tra lại hoặc liên hệ Ban tổ chức.',
      });
    }

    let user = matches[0] || null;
    let isNewAccount = false;
    let tempPassword = null;

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đang bị khoá. Vui lòng liên hệ Ban tổ chức.',
        });
      }
      if (user.mssv && user.mssv !== mssv) {
        return res.status(409).json({
          success: false,
          message: 'Email này đã đăng ký với một MSSV khác. Vui lòng kiểm tra lại.',
        });
      }
      if (user.email !== email) {
        return res.status(409).json({
          success: false,
          message: 'MSSV này đã đăng ký với một email khác. Vui lòng kiểm tra lại.',
        });
      }
      // Bổ sung thông tin còn thiếu, KHÔNG ghi đè dữ liệu sẵn có của tài khoản.
      const patch = {
        ...(user.mssv ? {} : { mssv }),
        ...(phone ? { phone } : {}),
        ...(userClass ? { class: userClass } : {}),
      };
      if (Object.keys(patch).length) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: patch,
          select: { id: true, email: true, mssv: true, name: true, isActive: true },
        });
      }
    } else {
      isNewAccount = true;
      tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      user = await prisma.user.create({
        data: {
          name,
          mssv,
          email,
          phone: phone || null,
          class: userClass || null,
          role: 'STUDENT',
          passwordHash,
          isFirstLogin: true,
        },
        select: { id: true, email: true, mssv: true, name: true, isActive: true },
      });
    }

    const { alreadyRegistered } = await joinEvent(event.id, user.id);

    let emailSent = true;
    try {
      await emailService.sendEventRegistrationEmail(user.email, user.name, event, {
        mssv: user.mssv,
        tempPassword,
      });
    } catch (emailErr) {
      emailSent = false;
      console.error('Failed to send registration email:', emailErr);
    }

    return res.status(alreadyRegistered ? 200 : 201).json({
      success: true,
      alreadyRegistered,
      isNewAccount,
      emailSent,
      data: {
        event: { id: event.id, name: event.name, location: event.location, checkinOpen: event.checkinOpen },
        user: { id: user.id, name: user.name, mssv: user.mssv, email: user.email },
      },
      message: alreadyRegistered
        ? 'Bạn đã có tên trong danh sách tham gia sự kiện này.'
        : 'Đăng ký tham gia sự kiện thành công!',
    });
  } catch (err) {
    console.error('Public registration error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// ───────────────────────────────────────────────────────────────
// Người dùng đã đăng nhập tự đăng ký tham gia
// ───────────────────────────────────────────────────────────────

async function registerSelf(req, res) {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, isActive: true },
      select: { id: true, name: true, location: true, checkinOpen: true, checkinClose: true, allowRegistration: true },
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }

    const windowError = registrationWindowError(event);
    if (windowError) {
      return res.status(400).json({ success: false, message: windowError });
    }

    const { alreadyRegistered } = await joinEvent(event.id, req.user.id);

    return res.json({
      success: true,
      alreadyRegistered,
      message: alreadyRegistered
        ? 'Bạn đã có tên trong danh sách tham gia sự kiện này.'
        : 'Đăng ký tham gia sự kiện thành công!',
    });
  } catch (err) {
    console.error('Self registration error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

module.exports = { listOpenEvents, getPublicEvent, registerPublic, registerSelf };
