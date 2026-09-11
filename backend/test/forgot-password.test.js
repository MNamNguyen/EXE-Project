const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const emailService = require('../src/services/email.service');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const USER = {
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

// ── forgot-password ─────────────────────────────────────────────────────────

test('forgot-password sends a 6-digit PASSWORD_RESET OTP to the account email', async () => {
  mockUser(USER);
  const createStub = mockOtpWrites();
  const mailStub = stubMethod(emailService, 'sendPasswordResetOtpEmail', async () => {});

  const res = await request(app).post('/api/auth/forgot-password').send({ identifier: 'SE1' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(createStub.calls.length, 1);
  const { data } = createStub.calls[0][0];
  assert.strictEqual(data.userId, 'u1');
  assert.strictEqual(data.purpose, 'PASSWORD_RESET');
  assert.match(data.token, /^\d{6}$/);
  assert.ok(data.expiresAt.getTime() > Date.now() + 14 * 60_000);
  assert.deepStrictEqual(mailStub.calls[0].slice(0, 2), ['an@fpt.edu.vn', 'An']);
  assert.strictEqual(mailStub.calls[0][2], data.token);
});

test('forgot-password answers 200 for an unknown account and sends nothing', async () => {
  mockUser(null);
  const createStub = mockOtpWrites();
  const mailStub = stubMethod(emailService, 'sendPasswordResetOtpEmail', async () => {});

  const res = await request(app).post('/api/auth/forgot-password').send({ identifier: 'SE999' });

  // Trả về y hệt trường hợp có tài khoản → không dò được email/MSSV nào tồn tại.
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(createStub.calls.length, 0);
  assert.strictEqual(mailStub.calls.length, 0);
});

test('forgot-password drops the OTP again when the email fails', async () => {
  mockUser(USER);
  stubMethod(prisma.otpToken, 'create', async ({ data }) => ({ id: 'otp1', ...data }));
  const deleteStub = stubMethod(prisma.otpToken, 'deleteMany', async () => ({ count: 1 }));
  stubMethod(emailService, 'sendPasswordResetOtpEmail', async () => { throw new Error('brevo down'); });

  const res = await request(app).post('/api/auth/forgot-password').send({ identifier: 'SE1' });

  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.body.error, 'EMAIL_FAILED');
  // 1 lần dọn OTP cũ trước khi gửi + 1 lần thu hồi mã vừa tạo.
  assert.strictEqual(deleteStub.calls.length, 2);
});

test('forgot-password requires an identifier', async () => {
  const res = await request(app).post('/api/auth/forgot-password').send({});
  assert.strictEqual(res.status, 400);
});

// ── reset-password ──────────────────────────────────────────────────────────

function mockValidOtp(overrides) {
  stubMethod(prisma.otpToken, 'findFirst', async () => ({
    id: 'otp1', userId: 'u1', token: '123456', purpose: 'PASSWORD_RESET',
    used: false, expiresAt: new Date(Date.now() + 60_000), ...overrides,
  }));
}

test('reset-password sets the new hash, marks the OTP used and clears the lockout', async () => {
  mockUser({ ...USER, failedLoginAttempts: 4, lockedUntil: new Date(Date.now() + 60_000) });
  mockValidOtp();
  const otpUpdate = stubMethod(prisma.otpToken, 'update', async () => ({}));
  const userUpdate = stubMethod(prisma.user, 'update', async () => ({}));
  stubMethod(bcrypt, 'hash', async () => 'new-hash');

  const res = await request(app)
    .post('/api/auth/reset-password')
    .send({ identifier: 'SE1', otp: '123456', newPassword: 'matkhaumoi' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(otpUpdate.calls[0][0].data.used, true);
  const data = userUpdate.calls[0][0].data;
  assert.strictEqual(data.passwordHash, 'new-hash');
  assert.strictEqual(data.isFirstLogin, false);
  assert.strictEqual(data.failedLoginAttempts, 0);
  assert.strictEqual(data.lockedUntil, null);
});

test('reset-password rejects a wrong or expired OTP without touching the password', async () => {
  mockUser(USER);
  stubMethod(prisma.otpToken, 'findFirst', async () => null);
  const userUpdate = stubMethod(prisma.user, 'update', async () => ({}));

  const res = await request(app)
    .post('/api/auth/reset-password')
    .send({ identifier: 'SE1', otp: '000000', newPassword: 'matkhaumoi' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'INVALID_RESET_OTP');
  assert.strictEqual(userUpdate.calls.length, 0);
});

test('reset-password gives the same error for an unknown account as for a wrong OTP', async () => {
  mockUser(null);
  const userUpdate = stubMethod(prisma.user, 'update', async () => ({}));

  const res = await request(app)
    .post('/api/auth/reset-password')
    .send({ identifier: 'SE999', otp: '123456', newPassword: 'matkhaumoi' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'INVALID_RESET_OTP');
  assert.strictEqual(userUpdate.calls.length, 0);
});

test('reset-password refuses a password shorter than 6 characters', async () => {
  const findFirst = stubMethod(prisma.user, 'findFirst', async () => USER);

  const res = await request(app)
    .post('/api/auth/reset-password')
    .send({ identifier: 'SE1', otp: '123456', newPassword: '123' });

  assert.strictEqual(res.status, 400);
  // Chặn trước khi chạm DB.
  assert.strictEqual(findFirst.calls.length, 0);
});

test('the new password works on the next login', async () => {
  mockUser({ ...USER, passwordHash: 'new-hash' });
  stubMethod(bcrypt, 'compare', async (plain, hash) => plain === 'matkhaumoi' && hash === 'new-hash');
  stubMethod(prisma.user, 'update', async () => ({}));
  stubMethod(prisma.deviceBinding, 'findFirst', async () => null);
  stubMethod(prisma.deviceBinding, 'upsert', async () => ({}));

  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'SE1', password: 'matkhaumoi', deviceId: 'dev-1' });

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
});
