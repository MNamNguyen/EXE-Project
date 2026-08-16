const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const emailService = require('../src/services/email.service');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const BASE_USER = {
  id: 'u1', mssv: 'SE1', email: 'a@b.c', name: 'An', role: 'STUDENT',
  isActive: true, isFirstLogin: false, passwordHash: 'hash',
  failedLoginAttempts: 0, lockedUntil: null,
};

function loginBody() {
  return { identifier: 'SE1', password: 'x', deviceId: 'dev-1', deviceInfo: null };
}

afterEach(() => restoreStubs());

test('login returns 500 and deletes the OTP when the email send fails', async () => {
  stubMethod(prisma.user, 'findFirst', async () => BASE_USER);
  stubMethod(bcrypt, 'compare', async () => true);
  stubMethod(prisma.user, 'update', async () => ({}));
  // A trusted binding on a DIFFERENT device → login goes down the OTP path.
  stubMethod(prisma.deviceBinding, 'findFirst', async () => ({ id: 'b1', userId: 'u1', deviceId: 'other-device', isTrusted: true }));
  stubMethod(prisma.otpToken, 'deleteMany', async () => ({}));
  stubMethod(prisma.otpToken, 'create', async () => ({}));
  const sendStub = stubMethod(emailService, 'sendOtpEmail', async () => { throw new Error('Brevo API error 401'); });
  const deleteStub = stubMethod(prisma.otpToken, 'deleteMany', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 500);
  assert.ok(res.body.message.includes('Không gửi được email OTP'));
  assert.strictEqual(sendStub.calls.length, 1);
  // deleteMany is called twice: once to purge old OTPs, once to clean up the failed send.
  assert.strictEqual(deleteStub.calls.length, 2);
});

test('login proceeds to OTP step when the email sends', async () => {
  stubMethod(prisma.user, 'findFirst', async () => BASE_USER);
  stubMethod(bcrypt, 'compare', async () => true);
  stubMethod(prisma.user, 'update', async () => ({}));
  stubMethod(prisma.deviceBinding, 'findFirst', async () => ({ id: 'b1', userId: 'u1', deviceId: 'other-device', isTrusted: true }));
  stubMethod(prisma.otpToken, 'deleteMany', async () => ({}));
  stubMethod(prisma.otpToken, 'create', async () => ({}));
  stubMethod(emailService, 'sendOtpEmail', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.requireOtp, true);
});
