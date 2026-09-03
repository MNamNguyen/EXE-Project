const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const emailService = require('../src/services/email.service');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const ADMIN = { id: 'admin-1', mssv: null, email: 'admin@fpt.edu.vn', name: 'Admin', role: 'ADMIN', isActive: true, isFirstLogin: false };

function tokenFor(id) {
  return jwt.sign({ userId: id }, process.env.JWT_SECRET);
}

// authenticate() nạp req.user bằng findUnique — các handler bulk chỉ dùng
// findMany/updateMany nên stub này không đụng vào dữ liệu của lô.
function mockAuth(caller = ADMIN) {
  stubMethod(prisma.user, 'findUnique', async ({ where }) => (where.id === caller.id ? caller : null));
}

function post(path, caller = ADMIN) {
  return request(app).post(`/api/admin/users/bulk/${path}`).set('Authorization', `Bearer ${tokenFor(caller.id)}`);
}

afterEach(() => restoreStubs());

// ── Quyền + validate ────────────────────────────────────────────

test('non-admin cannot use bulk endpoints', async () => {
  const btc = { ...ADMIN, id: 'btc-1', role: 'BTC' };
  mockAuth(btc);
  stubMethod(prisma.user, 'updateMany', async () => { throw new Error('must not update'); });

  const res = await post('update', btc).send({ userIds: ['u-1'], isActive: false });
  assert.strictEqual(res.status, 403);
});

test('empty selection is rejected', async () => {
  mockAuth();
  stubMethod(prisma.user, 'updateMany', async () => { throw new Error('must not update'); });

  const res = await post('update').send({ userIds: [], isActive: false });
  assert.strictEqual(res.status, 400);
});

test('selection above the cap is rejected', async () => {
  mockAuth();
  stubMethod(prisma.user, 'updateMany', async () => { throw new Error('must not update'); });

  const userIds = Array.from({ length: 201 }, (_, i) => `u-${i}`);
  const res = await post('update').send({ userIds, isActive: false });
  assert.strictEqual(res.status, 400);
});

test('bulk update with no changed field is rejected', async () => {
  mockAuth();
  stubMethod(prisma.user, 'updateMany', async () => { throw new Error('must not update'); });

  const res = await post('update').send({ userIds: ['u-1'] });
  assert.strictEqual(res.status, 400);
});

test('bulk update rejects an unknown role', async () => {
  mockAuth();
  stubMethod(prisma.user, 'updateMany', async () => { throw new Error('must not update'); });

  const res = await post('update').send({ userIds: ['u-1'], role: 'SUPERUSER' });
  assert.strictEqual(res.status, 400);
});

// ── Sửa hàng loạt ───────────────────────────────────────────────

test('bulk update applies only the safe fields and dedupes ids', async () => {
  mockAuth();
  const updateStub = stubMethod(prisma.user, 'updateMany', async () => ({ count: 2 }));

  const res = await post('update').send({
    userIds: ['u-1', 'u-2', 'u-1'],
    role: 'BTC',
    class: ' SE1701 ',
    faculty: '',
    isActive: false,
    email: 'hack@fpt.edu.vn',
    name: 'Ghi đè',
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 2);

  const arg = updateStub.calls[0][0];
  assert.deepStrictEqual(arg.where.id.in, ['u-1', 'u-2']);
  assert.deepStrictEqual(arg.data, { role: 'BTC', class: 'SE1701', faculty: null, isActive: false });
});

test('bulk update never touches the acting admin account', async () => {
  mockAuth();
  const updateStub = stubMethod(prisma.user, 'updateMany', async () => ({ count: 1 }));

  const res = await post('update').send({ userIds: ['u-1', ADMIN.id], isActive: false });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(updateStub.calls[0][0].where.id.in, ['u-1']);
  assert.strictEqual(res.body.skipped.length, 1);
  assert.strictEqual(res.body.skipped[0].id, ADMIN.id);
});

test('selecting only yourself succeeds with zero updates and no query', async () => {
  mockAuth();
  stubMethod(prisma.user, 'updateMany', async () => { throw new Error('must not update'); });

  const res = await post('update').send({ userIds: [ADMIN.id], isActive: false });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 0);
  assert.strictEqual(res.body.skipped.length, 1);
});

// ── Reset mật khẩu hàng loạt ────────────────────────────────────

test('bulk reset hashes a distinct password per user and emails each one', async () => {
  mockAuth();
  const targets = [
    { id: 'u-1', name: 'An', email: 'an@fpt.edu.vn' },
    { id: 'u-2', name: 'Bình', email: 'binh@fpt.edu.vn' },
  ];
  stubMethod(prisma.user, 'findMany', async () => targets);
  const updateStub = stubMethod(prisma.user, 'update', async () => ({}));
  const mailStub = stubMethod(emailService, 'sendPasswordResetEmail', async () => {});

  const res = await post('reset-password').send({ userIds: ['u-1', 'u-2'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 2);
  assert.strictEqual(res.body.emailFailed, 0);
  assert.strictEqual(updateStub.calls.length, 2);
  assert.strictEqual(mailStub.calls.length, 2);

  const [p1, p2] = res.body.results.map((r) => r.password);
  assert.notStrictEqual(p1, p2, 'mỗi tài khoản phải có mật khẩu tạm riêng');

  for (const [i, call] of updateStub.calls.entries()) {
    const data = call[0].data;
    assert.strictEqual(data.isFirstLogin, true);
    assert.strictEqual(data.failedLoginAttempts, 0);
    assert.strictEqual(data.lockedUntil, null);
    assert.ok(await bcrypt.compare(res.body.results[i].password, data.passwordHash));
  }
});

test('bulk reset reports email failures but still returns the passwords', async () => {
  mockAuth();
  stubMethod(prisma.user, 'findMany', async () => [{ id: 'u-1', name: 'An', email: 'an@fpt.edu.vn' }]);
  stubMethod(prisma.user, 'update', async () => ({}));
  stubMethod(emailService, 'sendPasswordResetEmail', async () => { throw new Error('brevo down'); });

  const res = await post('reset-password').send({ userIds: ['u-1'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 1);
  assert.strictEqual(res.body.emailFailed, 1);
  assert.strictEqual(res.body.results[0].emailSent, false);
  assert.ok(res.body.results[0].password.length >= 6);
});

test('bulk reset has a lower cap than other bulk actions', async () => {
  mockAuth();
  stubMethod(prisma.user, 'findMany', async () => { throw new Error('must not query'); });

  const userIds = Array.from({ length: 51 }, (_, i) => `u-${i}`);
  const res = await post('reset-password').send({ userIds });
  assert.strictEqual(res.status, 400);
});

test('bulk reset lists ids that no longer exist as skipped', async () => {
  mockAuth();
  stubMethod(prisma.user, 'findMany', async () => [{ id: 'u-1', name: 'An', email: 'an@fpt.edu.vn' }]);
  stubMethod(prisma.user, 'update', async () => ({}));
  stubMethod(emailService, 'sendPasswordResetEmail', async () => {});

  const res = await post('reset-password').send({ userIds: ['u-1', 'u-ghost'] });

  assert.strictEqual(res.body.updated, 1);
  assert.deepStrictEqual(res.body.skipped.map((s) => s.id), ['u-ghost']);
});

// ── Reset thiết bị hàng loạt ────────────────────────────────────

test('bulk reset device clears bindings for every selected user', async () => {
  mockAuth();
  const delStub = stubMethod(prisma.deviceBinding, 'deleteMany', async () => ({ count: 2 }));

  const res = await post('reset-device').send({ userIds: ['u-1', 'u-2'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 2);
  assert.deepStrictEqual(delStub.calls[0][0].where.userId.in, ['u-1', 'u-2']);
});

// ── Xoá hàng loạt ───────────────────────────────────────────────

test('bulk delete skips users who created events and deletes the rest', async () => {
  mockAuth();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', name: 'An', _count: { createdEvents: 0 } },
    { id: 'u-2', name: 'Bình', _count: { createdEvents: 3 } },
    { id: 'u-3', name: 'Chi', _count: { createdEvents: 0 } },
  ]);
  const deleteStub = stubMethod(prisma.user, 'deleteMany', async () => ({ count: 2 }));
  stubMethod(prisma.otpToken, 'deleteMany', async () => ({ count: 0 }));
  stubMethod(prisma.deviceBinding, 'deleteMany', async () => ({ count: 0 }));
  stubMethod(prisma.eventMember, 'deleteMany', async () => ({ count: 0 }));
  stubMethod(prisma.attendance, 'deleteMany', async () => ({ count: 0 }));
  stubMethod(prisma.fraudLog, 'updateMany', async () => ({ count: 0 }));
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));

  const res = await post('delete').send({ userIds: ['u-1', 'u-2', 'u-3'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 2);
  assert.deepStrictEqual(deleteStub.calls[0][0].where.id.in, ['u-1', 'u-3']);
  assert.deepStrictEqual(res.body.skipped.map((s) => s.id), ['u-2']);
});

test('bulk delete does not open a transaction when nothing is deletable', async () => {
  mockAuth();
  stubMethod(prisma.user, 'findMany', async () => [{ id: 'u-1', name: 'An', _count: { createdEvents: 1 } }]);
  stubMethod(prisma, '$transaction', async () => { throw new Error('must not delete'); });

  const res = await post('delete').send({ userIds: ['u-1'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 0);
  assert.strictEqual(res.body.skipped.length, 1);
});

test('bulk delete cannot remove the acting admin', async () => {
  mockAuth();
  stubMethod(prisma.user, 'findMany', async ({ where }) => {
    assert.ok(!where.id.in.includes(ADMIN.id), 'admin đang thao tác không được nằm trong lô xoá');
    return [];
  });
  stubMethod(prisma, '$transaction', async () => { throw new Error('must not delete'); });

  const res = await post('delete').send({ userIds: [ADMIN.id] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 0);
});
