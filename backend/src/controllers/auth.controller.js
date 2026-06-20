const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { sendOtpEmail } = require('../services/email.service');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    // 1 day → sessions auto-expire daily. The frontend reads this `exp` claim
    // to auto-logout an idle tab and to refuse a stale cached session on load.
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

async function login(req, res) {
  try {
    const { identifier, password, deviceId, deviceInfo } = req.body;

    if (!identifier || !password || !deviceId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng nhập' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ mssv: identifier }, { email: identifier }],
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'MSSV/Email hoặc mật khẩu không đúng' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'MSSV/Email hoặc mật khẩu không đúng' });
    }

    // Check device binding
    const existingBinding = await prisma.deviceBinding.findFirst({
      where: { userId: user.id, isTrusted: true },
    });

    if (existingBinding && existingBinding.deviceId !== deviceId) {
      // New device → send OTP
      await prisma.otpToken.deleteMany({
        where: { userId: user.id, purpose: 'DEVICE_BIND', used: false },
      });

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await prisma.otpToken.create({
        data: { userId: user.id, token: otp, deviceId, purpose: 'DEVICE_BIND', expiresAt },
      });

      await sendOtpEmail(user.email, user.name, otp);

      return res.json({
        success: false,
        requireOtp: true,
        userId: user.id,
        message: `Thiết bị mới được phát hiện. Mã OTP đã gửi đến ${user.email}`,
      });
    }

    // Bind device if first login or same device
    await prisma.deviceBinding.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId } },
      create: { userId: user.id, deviceId, deviceInfo, isTrusted: true },
      update: { isTrusted: true, deviceInfo },
    });

    const token = signToken(user.id);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        mssv: user.mssv,
        email: user.email,
        name: user.name,
        role: user.role,
        isFirstLogin: user.isFirstLogin,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function verifyOtp(req, res) {
  try {
    const { userId, otp, deviceId, deviceInfo } = req.body;

    const otpRecord = await prisma.otpToken.findFirst({
      where: {
        userId,
        token: otp,
        deviceId,
        purpose: 'DEVICE_BIND',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Mã OTP không đúng hoặc đã hết hạn' });
    }

    await prisma.otpToken.update({ where: { id: otpRecord.id }, data: { used: true } });

    await prisma.deviceBinding.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, deviceInfo, isTrusted: true },
      update: { isTrusted: true, deviceInfo },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, mssv: true, email: true, name: true, role: true, isFirstLogin: true },
    });

    const token = signToken(userId);

    return res.json({ success: true, token, user });
  } catch (err) {
    console.error('OTP verify error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải ít nhất 6 ký tự' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, isFirstLogin: false },
    });

    return res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}

async function getMe(req, res) {
  return res.json({ success: true, user: req.user });
}

module.exports = { login, verifyOtp, changePassword, getMe };
