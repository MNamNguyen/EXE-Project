const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const prisma = require('../lib/prisma');
const { sendWelcomeEmail } = require('../services/email.service');

function generateTempPassword() {
  return 'Fpt@' + Math.floor(100000 + Math.random() * 900000);
}

async function listUsers(req, res) {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { mssv: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(role && { role }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: { id: true, mssv: true, email: true, name: true, role: true, class: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({ success: true, data: users, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function createUser(req, res) {
  try {
    const { mssv, email, name, role, class: userClass, faculty, phone } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, ...(mssv ? [{ mssv }] : [])] },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email hoặc MSSV đã tồn tại' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: { mssv, email, name, role: role || 'STUDENT', class: userClass, faculty, phone, passwordHash, isFirstLogin: true },
      select: { id: true, mssv: true, email: true, name: true, role: true },
    });

    try {
      await sendWelcomeEmail(email, name, mssv, tempPassword);
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
    }

    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function updateUser(req, res) {
  try {
    const { mssv, email, name, role, class: userClass, faculty, phone, isActive } = req.body;

    // Khi đổi email/mssv: kiểm tra trùng với user KHÁC
    if (email !== undefined || mssv !== undefined) {
      const conflict = await prisma.user.findFirst({
        where: {
          id: { not: req.params.id },
          OR: [
            ...(email ? [{ email }] : []),
            ...(mssv ? [{ mssv }] : []),
          ],
        },
        select: { id: true },
      });
      if (conflict) {
        return res.status(400).json({ success: false, message: 'Email hoặc MSSV đã tồn tại ở tài khoản khác' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(mssv !== undefined && { mssv: mssv || null }),
        ...(email && { email }),
        ...(name && { name }),
        ...(role && { role }),
        ...(userClass !== undefined && { class: userClass || null }),
        ...(faculty !== undefined && { faculty: faculty || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(isActive !== undefined && { isActive }),
      },
      select: { id: true, mssv: true, email: true, name: true, role: true, class: true, faculty: true, phone: true, isActive: true },
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

// Xoá CỨNG user. Vì Attendance/Event ràng buộc onDelete RESTRICT về User,
// phải dọn dependent records trong 1 transaction. Sự kiện do user tạo thì
// KHÔNG xoá theo (dữ liệu sự kiện quan trọng) → chặn và yêu cầu khoá thay vì xoá.
async function deleteUser(req, res) {
  try {
    const targetId = req.params.id;

    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Không thể tự xoá tài khoản của chính mình' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, _count: { select: { createdEvents: true } } },
    });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    if (target._count.createdEvents > 0) {
      return res.status(400).json({
        success: false,
        message: 'Người dùng này đã tạo sự kiện nên không thể xoá. Hãy khoá tài khoản thay vì xoá.',
      });
    }

    await prisma.$transaction([
      prisma.otpToken.deleteMany({ where: { userId: targetId } }),
      prisma.deviceBinding.deleteMany({ where: { userId: targetId } }),
      prisma.eventMember.deleteMany({ where: { userId: targetId } }),
      prisma.attendance.deleteMany({ where: { userId: targetId } }),
      prisma.fraudLog.updateMany({ where: { userId: targetId }, data: { userId: null } }),
      prisma.user.delete({ where: { id: targetId } }),
    ]);

    return res.json({ success: true, message: 'Đã xoá người dùng' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function resetDeviceBinding(req, res) {
  try {
    await prisma.deviceBinding.deleteMany({ where: { userId: req.params.id } });
    return res.json({ success: true, message: 'Đã reset thiết bị. Sinh viên có thể đăng nhập trên thiết bị mới.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function importStudents(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Chưa upload file' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'File trống hoặc không đúng định dạng' });
    }

    const results = { success: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mssv = String(row['MSSV'] || row['mssv'] || '').trim();
      const name = String(row['Họ tên'] || row['ho_ten'] || row['name'] || '').trim();
      const email = String(row['Email'] || row['email'] || '').trim().toLowerCase();
      const userClass = String(row['Lớp'] || row['lop'] || row['class'] || '').trim();
      const faculty = String(row['Khoa'] || row['faculty'] || '').trim();

      if (!mssv || !name || !email) {
        results.errors.push({ row: i + 2, message: 'Thiếu MSSV, Họ tên hoặc Email' });
        continue;
      }

      try {
        const existing = await prisma.user.findFirst({
          where: { OR: [{ mssv }, { email }] },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        await prisma.user.create({
          data: { mssv, email, name, class: userClass || null, faculty: faculty || null, role: 'STUDENT', passwordHash, isFirstLogin: true },
        });

        try {
          await sendWelcomeEmail(email, name, mssv, tempPassword);
        } catch {}

        results.success++;
      } catch (rowErr) {
        results.errors.push({ row: i + 2, message: 'Lỗi khi tạo tài khoản' });
      }
    }

    return res.json({
      success: true,
      message: `Import hoàn tất: ${results.success} thành công, ${results.skipped} bỏ qua, ${results.errors.length} lỗi`,
      results,
    });
  } catch (err) {
    console.error('Import error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi đọc file' });
  }
}

async function getStats(req, res) {
  try {
    const [totalUsers, totalEvents, totalStudents, totalCheckins] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.event.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.attendance.count({ where: { checkinTime: { not: null } } }),
    ]);
    return res.json({ success: true, data: { totalUsers, totalEvents, totalStudents, totalCheckins } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

module.exports = { listUsers, createUser, updateUser, deleteUser, resetDeviceBinding, importStudents, getStats };
