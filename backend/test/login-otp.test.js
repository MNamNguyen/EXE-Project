const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
const emailService = require('../src/services/email.service');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const STUDENT = {
  id: 'u1', mssv: 'SE1', email: 'an@fpt.edu.vn', name: 'An', role: 'STUDENT',
  isActive: true, isFirstLogin: false, passwordHash: 'hash',
  failedLoginAttempts: 0, lockedUntil: null,
};

function mockUser(user) {
  stubMethod(prisma.user, 'findFirst', async () => user);
}

function mockOtpWrites() {
  stubMethod(prisma.otpToken, 'deleteMany', async () => ({ count: 0 }));
  return stubMethod(prisma.otpToken, 'create', async ({ data }) => ({ id: 'otp1', ...data }));
}

afterEach(() => restoreStubs());

// ── login-otp/request ───────────────────────────────────────────────────────

test('login-otp/request emails a 6-digit LOGIN code bound to the requesting device', async () => {
  mockUser(STUDENT);
  const createStub = mockOtpWrites();
  const mailStub = stubMethod(emailService, 'sendLoginOtpEmail', async () => {});

  const res = await request(app)
    .post('/api/auth/login-otp/request')
    .send({ identifier: 'SE1', deviceId: 'dev-1' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  const { data } = createStub.calls[0][0];
  assert.strictEqual(data.userId, 'u1');
  assert.strictEqual(data.purpose, 'LOGIN');
  assert.strictEqual(data.deviceId, 'dev-1');
  assert.match(data.token, /^\d{6}$/);
  assert.strictEqual(mailStub.calls[0][0], 'an@fpt.edu.vn');
  assert.strictEqual(mailStub.calls[0][2], data.token);
});

test('login-otp/request never emails a code to a non-student account', async () => {
  // Chiếm hộp thư admin không được phép thành chiếm quyền admin.
  mockUser({ ...STUDENT, role: 'ADMIN' });
  const createStub = mockOtpWrites();
  const mailStub = stubMethod(emailService, 'sendLoginOtpEmail', async () => {});

  const res = await request(app)
    .post('/api/auth/login-otp/request')
    .send({ identifier: 'admin@fpt.edu.vn', deviceId: 'dev-1' });

  // Vẫn 200 + cùng thông điệp → không phân biệt được đâu là tài khoản admin.
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(createStub.calls.length, 0);
  assert.strictEqual(mailStub.calls.length, 0);
});

test('login-otp/request answers the same way for an unknown account', async () => {
  mockUser(null);
  const createStub = mockOtpWrites();
  const mailStub = stubMethod(emailService, 'sendLoginOtpEmail', async () => {});

  const res = await request(app)
    .post('/api/auth/login-otp/request')
    .send({ identifier: 'SE999', deviceId: 'dev-1' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(createStub.calls.length, 0);
  assert.strictEqual(mailStub.calls.length, 0);
});

test('login-otp/request drops the code again when the email fails', async () => {
  mockUser(STUDENT);
  stubMethod(prisma.otpToken, 'create', async ({ data }) => ({ id: 'otp1', ...data }));
  const deleteStub = stubMethod(prisma.otpToken, 'deleteMany', async () => ({ count: 1 }));
  stubMethod(emailService, 'sendLoginOtpEmail', async () => { throw new Error('brevo down'); });

  const res = await request(app)
    .post('/api/auth/login-otp/request')
    .send({ identifier: 'SE1', deviceId: 'dev-1' });

  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.body.error, 'EMAIL_FAILED');
  assert.strictEqual(deleteStub.calls.length, 2);
});

// ── login-otp/verify ────────────────────────────────────────────────────────

function mockValidOtp() {
  return stubMethod(prisma.otpToken, 'findFirst', async () => ({
    id: 'otp1', userId: 'u1', token: '123456', deviceId: 'dev-1',
    purpose: 'LOGIN', used: false, expiresAt: new Date(Date.now() + 60_000),
  }));
}

test('login-otp/verify issues a JWT, burns the code and trusts the device', async () => {
  mockUser({ ...STUDENT, lockedUntil: new Date(Date.now() + 60_000) });
  const findStub = mockValidOtp();
  const otpUpdate = stubMethod(prisma.otpToken, 'update', async () => ({}));
  const bindUpsert = stubMethod(prisma.deviceBinding, 'upsert', async () => ({}));
  const userUpdate = stubMethod(prisma.user, 'update', async () => ({}));

  const res = await request(app)
    .post('/api/auth/login-otp/verify')
    .send({ identifier: 'SE1', otp: '123456', deviceId: 'dev-1', deviceInfo: 'Chrome' });

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.id, 'u1');
  assert.strictEqual(otpUpdate.calls[0][0].data.used, true);
  // Mã chỉ khớp khi đúng thiết bị đã yêu cầu.
  assert.strictEqual(findStub.calls[0][0].where.deviceId, 'dev-1');
  assert.strictEqual(findStub.calls[0][0].where.purpose, 'LOGIN');
  assert.strictEqual(bindUpsert.calls[0][0].create.isTrusted, true);
  assert.strictEqual(userUpdate.calls[0][0].data.lockedUntil, null);
});

test('login-otp/verify never sends the user back to the first-login password screen', async () => {
  // Người dùng vào bằng mã email, không biết mật khẩu tạm → không thể bắt họ
  // nhập "mật khẩu hiện tại" để đổi.
  mockUser({ ...STUDENT, isFirstLogin: true });
  mockValidOtp();
  stubMethod(prisma.otpToken, 'update', async () => ({}));
  stubMethod(prisma.deviceBinding, 'upsert', async () => ({}));
  stubMethod(prisma.user, 'update', async () => ({}));

  const res = await request(app)
    .post('/api/auth/login-otp/verify')
    .send({ identifier: 'SE1', otp: '123456', deviceId: 'dev-1' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.isFirstLogin, false);
});

test('login-otp/verify rejects a wrong or expired code without issuing a token', async () => {
  mockUser(STUDENT);
  stubMethod(prisma.otpToken, 'findFirst', async () => null);
  const bindUpsert = stubMethod(prisma.deviceBinding, 'upsert', async () => ({}));

  const res = await request(app)
    .post('/api/auth/login-otp/verify')
    .send({ identifier: 'SE1', otp: '000000', deviceId: 'dev-1' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'INVALID_LOGIN_OTP');
  assert.ok(!res.body.token);
  assert.strictEqual(bindUpsert.calls.length, 0);
});

test('login-otp/verify refuses a non-student even with a code in hand', async () => {
  mockUser({ ...STUDENT, role: 'BTC' });
  const findStub = stubMethod(prisma.otpToken, 'findFirst', async () => ({ id: 'otp1' }));

  const res = await request(app)
    .post('/api/auth/login-otp/verify')
    .send({ identifier: 'SE1', otp: '123456', deviceId: 'dev-1' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'INVALID_LOGIN_OTP');
  // Chặn trước khi tra OTP.
  assert.strictEqual(findStub.calls.length, 0);
});
