const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const btcToken = jwt.sign({ userId: 'btc-1' }, process.env.JWT_SECRET);
const studentToken = jwt.sign({ userId: 'student-1' }, process.env.JWT_SECRET);

const USERS = {
  'btc-1': { id: 'btc-1', mssv: null, email: 'btc1@f.c', name: 'BTC Một', role: 'BTC', isActive: true, isFirstLogin: false },
  'student-1': { id: 'student-1', mssv: 'SE1', email: 's@f.c', name: 'SV', role: 'STUDENT', isActive: true, isFirstLogin: false },
};

function mockAuth() {
  stubMethod(prisma.user, 'findUnique', async ({ where }) => USERS[where.id] || null);
}

const CLASS = { id: 'cls-1', name: 'SE1701', description: null, isActive: true, createdById: 'btc-1' };

function mockClass(overrides = {}) {
  return stubMethod(prisma.class, 'findUnique', async () => ({ ...CLASS, ...overrides }));
}

afterEach(() => restoreStubs());

// ── Quyền truy cập ─────────────────────────────────────────────

test('sinh viên không truy cập được API quản lý lớp', async () => {
  mockAuth();
  const res = await request(app).get('/api/classes').set('Authorization', `Bearer ${studentToken}`);
  assert.strictEqual(res.status, 403);
});

test('chưa đăng nhập bị chặn 401', async () => {
  const res = await request(app).get('/api/classes');
  assert.strictEqual(res.status, 401);
});

// ── CRUD lớp ───────────────────────────────────────────────────

test('danh sách lớp kèm sĩ số hiện tại', async () => {
  mockAuth();
  stubMethod(prisma.class, 'findMany', async () => [
    { id: 'cls-1', name: 'SE1701', description: null, isActive: true, createdBy: { name: 'BTC Một' } },
    { id: 'cls-2', name: 'SE1702', description: null, isActive: true, createdBy: { name: 'BTC Một' } },
  ]);
  stubMethod(prisma.user, 'groupBy', async () => [
    { class: 'SE1701', _count: { _all: 30 } },
  ]);

  const res = await request(app).get('/api/classes').set('Authorization', `Bearer ${btcToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.find((c) => c.name === 'SE1701').memberCount, 30);
  assert.strictEqual(res.body.data.find((c) => c.name === 'SE1702').memberCount, 0);
});

test('tạo lớp thành công', async () => {
  mockAuth();
  stubMethod(prisma.class, 'findUnique', async () => null);
  const create = stubMethod(prisma.class, 'create', async ({ data }) => ({ id: 'cls-new', ...data, isActive: true }));

  const res = await request(app).post('/api/classes')
    .set('Authorization', `Bearer ${btcToken}`)
    .send({ name: '  SE1703  ', description: ' Khoá 17 ' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(create.calls[0][0].data.name, 'SE1703');
  assert.strictEqual(create.calls[0][0].data.description, 'Khoá 17');
  assert.strictEqual(create.calls[0][0].data.createdById, 'btc-1');
  assert.strictEqual(res.body.data.memberCount, 0);
});

test('tạo lớp thiếu tên trả 400', async () => {
  mockAuth();
  const create = stubMethod(prisma.class, 'create', async () => { throw new Error('không được gọi'); });

  const res = await request(app).post('/api/classes').set('Authorization', `Bearer ${btcToken}`).send({ name: '  ' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(create.calls.length, 0);
});

test('tạo lớp trùng tên trả 400', async () => {
  mockAuth();
  stubMethod(prisma.class, 'findUnique', async () => CLASS);
  const create = stubMethod(prisma.class, 'create', async () => { throw new Error('không được gọi'); });

  const res = await request(app).post('/api/classes').set('Authorization', `Bearer ${btcToken}`).send({ name: 'SE1701' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(create.calls.length, 0);
});

test('đổi tên lớp lan sang mọi User.class đang mang tên cũ', async () => {
  mockAuth();
  mockClass();
  stubMethod(prisma.class, 'findFirst', async () => null);
  const update = stubMethod(prisma.class, 'update', async ({ data }) => ({ ...CLASS, ...data }));
  const userUpdateMany = stubMethod(prisma.user, 'updateMany', async () => ({ count: 30 }));
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));
  stubMethod(prisma.user, 'count', async () => 30);

  const res = await request(app).put('/api/classes/cls-1')
    .set('Authorization', `Bearer ${btcToken}`)
    .send({ name: 'SE1701-Renamed' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(update.calls[0][0].data.name, 'SE1701-Renamed');
  assert.deepStrictEqual(userUpdateMany.calls[0][0], {
    where: { class: 'SE1701' },
    data: { class: 'SE1701-Renamed' },
  });
});

test('đổi tên lớp trùng với lớp khác bị chặn, không đổi gì', async () => {
  mockAuth();
  mockClass();
  stubMethod(prisma.class, 'findFirst', async () => ({ id: 'cls-2', name: 'SE1702' }));
  const update = stubMethod(prisma.class, 'update', async () => { throw new Error('không được gọi'); });

  const res = await request(app).put('/api/classes/cls-1')
    .set('Authorization', `Bearer ${btcToken}`)
    .send({ name: 'SE1702' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(update.calls.length, 0);
});

test('không đổi tên thì không đụng tới User.class', async () => {
  mockAuth();
  mockClass();
  const update = stubMethod(prisma.class, 'update', async ({ data }) => ({ ...CLASS, ...data }));
  const userUpdateMany = stubMethod(prisma.user, 'updateMany', async () => { throw new Error('không được gọi'); });
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));
  stubMethod(prisma.user, 'count', async () => 10);

  const res = await request(app).put('/api/classes/cls-1')
    .set('Authorization', `Bearer ${btcToken}`)
    .send({ description: 'Mô tả mới' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(update.calls[0][0].data.description, 'Mô tả mới');
  assert.strictEqual(userUpdateMany.calls.length, 0);
});

test('xoá lớp còn thành viên bị chặn 400', async () => {
  mockAuth();
  mockClass();
  stubMethod(prisma.user, 'count', async () => 5);
  const del = stubMethod(prisma.class, 'delete', async () => { throw new Error('không được gọi'); });

  const res = await request(app).delete('/api/classes/cls-1').set('Authorization', `Bearer ${btcToken}`);

  assert.strictEqual(res.status, 400);
  assert.strictEqual(del.calls.length, 0);
});

test('xoá lớp rỗng thành công', async () => {
  mockAuth();
  mockClass();
  stubMethod(prisma.user, 'count', async () => 0);
  const del = stubMethod(prisma.class, 'delete', async () => ({}));

  const res = await request(app).delete('/api/classes/cls-1').set('Authorization', `Bearer ${btcToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(del.calls.length, 1);
});

test('thao tác trên lớp không tồn tại trả 404', async () => {
  mockAuth();
  stubMethod(prisma.class, 'findUnique', async () => null);

  for (const req of [
    () => request(app).get('/api/classes/nope').set('Authorization', `Bearer ${btcToken}`),
    () => request(app).put('/api/classes/nope').set('Authorization', `Bearer ${btcToken}`).send({ description: 'x' }),
    () => request(app).delete('/api/classes/nope').set('Authorization', `Bearer ${btcToken}`),
  ]) {
    const res = await req();
    assert.strictEqual(res.status, 404);
  }
});

// ── Bulk thành viên ────────────────────────────────────────────

test('gán nhiều người vào lớp cùng lúc (thêm mới hoặc chuyển từ lớp khác)', async () => {
  mockAuth();
  mockClass();
  const updateMany = stubMethod(prisma.user, 'updateMany', async () => ({ count: 3 }));

  const res = await request(app).post('/api/classes/cls-1/members')
    .set('Authorization', `Bearer ${btcToken}`)
    .send({ userIds: ['u1', 'u2', 'u3', 'u1'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.updated, 3);
  assert.deepStrictEqual(updateMany.calls[0][0], {
    where: { id: { in: ['u1', 'u2', 'u3'] } },
    data: { class: 'SE1701' },
  });
});

test('gán thành viên không chọn ai trả 400', async () => {
  mockAuth();
  mockClass();
  const updateMany = stubMethod(prisma.user, 'updateMany', async () => { throw new Error('không được gọi'); });

  const res = await request(app).post('/api/classes/cls-1/members')
    .set('Authorization', `Bearer ${btcToken}`).send({ userIds: [] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(updateMany.calls.length, 0);
});

test('gỡ thành viên chỉ tác động người đang đúng lớp này', async () => {
  mockAuth();
  mockClass();
  const updateMany = stubMethod(prisma.user, 'updateMany', async () => ({ count: 2 }));

  const res = await request(app).post('/api/classes/cls-1/members/remove')
    .set('Authorization', `Bearer ${btcToken}`)
    .send({ userIds: ['u1', 'u2'] });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(updateMany.calls[0][0], {
    where: { id: { in: ['u1', 'u2'] }, class: 'SE1701' },
    data: { class: null },
  });
});

test('tìm người để thêm loại trừ người đã ở đúng lớp này', async () => {
  mockAuth();
  mockClass();
  const findMany = stubMethod(prisma.user, 'findMany', async () => []);

  await request(app).get('/api/classes/cls-1/members/search?q=an')
    .set('Authorization', `Bearer ${btcToken}`);

  assert.deepStrictEqual(findMany.calls[0][0].where.class, { not: 'SE1701' });
});

test('tìm không kèm từ khoá trả rỗng, trừ khi bật unassignedOnly', async () => {
  mockAuth();
  mockClass();
  const findMany = stubMethod(prisma.user, 'findMany', async () => { throw new Error('không được gọi'); });

  const res = await request(app).get('/api/classes/cls-1/members/search')
    .set('Authorization', `Bearer ${btcToken}`);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.data, []);
  assert.strictEqual(findMany.calls.length, 0);
});

test('unassignedOnly liệt kê người chưa có lớp, kể cả không gõ từ khoá', async () => {
  mockAuth();
  mockClass();
  const findMany = stubMethod(prisma.user, 'findMany', async () => [{ id: 'u1' }]);

  const res = await request(app).get('/api/classes/cls-1/members/search?unassignedOnly=1')
    .set('Authorization', `Bearer ${btcToken}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1);
  const where = findMany.calls[0][0].where;
  assert.strictEqual(where.class, null);
  assert.strictEqual(where.role, 'STUDENT');
  assert.ok(!('OR' in where));
});

// ── Buổi điểm danh ─────────────────────────────────────────────

const HOUR = 3600e3;
function sessionBody(overrides = {}) {
  return {
    location: 'Phòng A101',
    checkinOpen: new Date(Date.now() - HOUR).toISOString(),
    checkinClose: new Date(Date.now() + HOUR).toISOString(),
    checkoutOpen: new Date(Date.now() + HOUR).toISOString(),
    checkoutClose: new Date(Date.now() + 2 * HOUR).toISOString(),
    gpsEnabled: false,
    ...overrides,
  };
}

test('tạo buổi điểm danh: whitelist bắt buộc bật, không mở đăng ký công khai, tự thêm cả lớp', async () => {
  mockAuth();
  mockClass();
  const create = stubMethod(prisma.event, 'create', async ({ data }) => ({ id: 'evt-1', ...data }));
  stubMethod(prisma.user, 'findMany', async () => [{ id: 'u1' }, { id: 'u2' }]);
  const members = stubMethod(prisma.eventMember, 'createMany', async () => ({ count: 2 }));
  const attendance = stubMethod(prisma.attendance, 'createMany', async () => ({ count: 2 }));
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));

  const res = await request(app).post('/api/classes/cls-1/sessions')
    .set('Authorization', `Bearer ${btcToken}`)
    .send(sessionBody());

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.enrolled, 2);

  const created = create.calls[0][0].data;
  assert.strictEqual(created.isWhitelisted, true);
  assert.strictEqual(created.allowRegistration, false);
  assert.strictEqual(created.classId, 'cls-1');
  assert.strictEqual(created.createdById, 'btc-1');
  assert.match(created.name, /SE1701/);

  assert.deepStrictEqual(members.calls[0][0].data, [
    { eventId: 'evt-1', userId: 'u1' },
    { eventId: 'evt-1', userId: 'u2' },
  ]);
  assert.deepStrictEqual(attendance.calls[0][0].data, [
    { eventId: 'evt-1', userId: 'u1', status: 'REGISTERED' },
    { eventId: 'evt-1', userId: 'u2', status: 'REGISTERED' },
  ]);
});

test('tạo buổi điểm danh dùng tên tuỳ chỉnh nếu có', async () => {
  mockAuth();
  mockClass();
  const create = stubMethod(prisma.event, 'create', async ({ data }) => ({ id: 'evt-1', ...data }));
  stubMethod(prisma.user, 'findMany', async () => []);
  stubMethod(prisma.eventMember, 'createMany', async () => ({ count: 0 }));
  stubMethod(prisma.attendance, 'createMany', async () => ({ count: 0 }));
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));

  const res = await request(app).post('/api/classes/cls-1/sessions')
    .set('Authorization', `Bearer ${btcToken}`)
    .send(sessionBody({ name: 'Buổi 5 - Lập trình Web' }));

  assert.strictEqual(res.status, 201);
  assert.strictEqual(create.calls[0][0].data.name, 'Buổi 5 - Lập trình Web');
});

test('tạo buổi điểm danh bật GPS mà thiếu toạ độ bị chặn 400', async () => {
  mockAuth();
  mockClass();
  const create = stubMethod(prisma.event, 'create', async () => { throw new Error('không được gọi'); });

  const res = await request(app).post('/api/classes/cls-1/sessions')
    .set('Authorization', `Bearer ${btcToken}`)
    .send(sessionBody({ gpsEnabled: true }));

  assert.strictEqual(res.status, 400);
  assert.strictEqual(create.calls.length, 0);
});

test('tạo buổi điểm danh thiếu địa điểm hoặc sai giờ trả 400', async () => {
  mockAuth();
  mockClass();
  const create = stubMethod(prisma.event, 'create', async () => { throw new Error('không được gọi'); });

  for (const overrides of [{ location: '' }, { checkinOpen: 'not-a-date' }]) {
    const res = await request(app).post('/api/classes/cls-1/sessions')
      .set('Authorization', `Bearer ${btcToken}`).send(sessionBody(overrides));
    assert.strictEqual(res.status, 400, JSON.stringify(overrides));
  }
  assert.strictEqual(create.calls.length, 0);
});

test('danh sách buổi điểm danh chỉ lấy sự kiện thuộc lớp này', async () => {
  mockAuth();
  mockClass();
  const findMany = stubMethod(prisma.event, 'findMany', async () => []);

  await request(app).get('/api/classes/cls-1/sessions').set('Authorization', `Bearer ${btcToken}`);

  assert.deepStrictEqual(findMany.calls[0][0].where, { classId: 'cls-1' });
});
