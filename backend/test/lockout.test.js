const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
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

function mockUser(overrides) {
  stubMethod(prisma.user, 'findFirst', async () => ({ ...BASE_USER, ...overrides }));
}

function mockLoginSuccessFlow() {
  stubMethod(bcrypt, 'compare', async () => true);
  stubMethod(prisma.deviceBinding, 'findFirst', async () => null);
  stubMethod(prisma.deviceBinding, 'upsert', async () => ({}));
  stubMethod(prisma.user, 'update', async () => ({}));
}

afterEach(() => restoreStubs());

test('locked account gets 429 even with the correct password', async () => {
  mockUser({ lockedUntil: new Date(Date.now() + 60_000) });
  stubMethod(bcrypt, 'compare', async () => { throw new Error('compare must not run while locked'); });

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 429);
  assert.strictEqual(res.body.error, 'ACCOUNT_LOCKED');
});

test('wrong password increments the failure counter', async () => {
  mockUser({ failedLoginAttempts: 3 });
  stubMethod(bcrypt, 'compare', async () => false);
  const updateStub = stubMethod(prisma.user, 'update', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 401);
  assert.strictEqual(updateStub.calls.length, 1);
  assert.strictEqual(updateStub.calls[0][0].data.failedLoginAttempts, 4);
});

test('fifth failure locks the account for 15 minutes', async () => {
  mockUser({ failedLoginAttempts: 4 });
  stubMethod(bcrypt, 'compare', async () => false);
  const updateStub = stubMethod(prisma.user, 'update', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 401);
  const data = updateStub.calls[0][0].data;
  assert.strictEqual(data.failedLoginAttempts, 0);
  assert.ok(data.lockedUntil instanceof Date);
  assert.ok(data.lockedUntil.getTime() > Date.now() + 14 * 60_000);
});

test('successful login resets the counter and lock', async () => {
  mockUser({ failedLoginAttempts: 2 });
  mockLoginSuccessFlow();
  const updateStub = stubMethod(prisma.user, 'update', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 200);
  const resetCall = updateStub.calls.find(
    (c) => c[0].data.failedLoginAttempts === 0 && c[0].data.lockedUntil === null
  );
  assert.ok(resetCall, 'expected a reset update with failedLoginAttempts:0 and lockedUntil:null');
});

test('expired lock allows login again', async () => {
  mockUser({ lockedUntil: new Date(Date.now() - 60_000) });
  mockLoginSuccessFlow();

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 200);
});
