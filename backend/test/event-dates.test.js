const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const token = jwt.sign({ userId: 'admin-1' }, process.env.JWT_SECRET);
const ADMIN_USER = { id: 'admin-1', mssv: null, email: 'admin@b.c', name: 'Admin', role: 'ADMIN', isActive: true, isFirstLogin: false };

const validPayload = {
  name: 'Event A', location: 'Hall', lat: '10.85', lng: '106.77', radius: '100', gpsEnabled: true,
  checkinOpen: new Date(Date.now() - 3600e3).toISOString(),
  checkinClose: new Date(Date.now() + 3600e3).toISOString(),
  checkoutOpen: new Date(Date.now() + 7200e3).toISOString(),
  checkoutClose: new Date(Date.now() + 10800e3).toISOString(),
  isWhitelisted: false,
};

afterEach(() => restoreStubs());

test('createEvent rejects unparseable dates with 400', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createStub = stubMethod(prisma.event, 'create', async () => ({}));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ ...validPayload, checkinOpen: 'not-a-date' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(createStub.calls.length, 0);
});

test('createEvent stores ISO-with-offset dates correctly (UTC round-trip)', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createStub = stubMethod(prisma.event, 'create', async () => ({ id: 'e1' }));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send(validPayload);
  assert.strictEqual(res.status, 201);
  const data = createStub.calls[0][0].data;
  assert.strictEqual(data.checkinOpen.toISOString(), validPayload.checkinOpen);
});

test('updateEvent rejects unparseable dates with 400', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  stubMethod(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'admin-1', gpsEnabled: false, lat: null, lng: null }));
  const updateStub = stubMethod(prisma.event, 'update', async () => ({}));

  const res = await request(app).put('/api/events/evt-1').set('Authorization', `Bearer ${token}`)
    .send({ checkinClose: 'bad-date' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(updateStub.calls.length, 0);
});

// ── Khung giờ tuỳ chọn + mở/đóng điểm danh thủ công ─────────────

test('createEvent không còn bắt buộc phải đặt khung giờ nào', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createStub = stubMethod(prisma.event, 'create', async ({ data }) => ({ id: 'e1', ...data }));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Buổi học tự do', location: 'Phòng A101', gpsEnabled: false });

  assert.strictEqual(res.status, 201);
  const data = createStub.calls[0][0].data;
  assert.strictEqual(data.checkinOpen, null);
  assert.strictEqual(data.checkinClose, null);
  assert.strictEqual(data.checkoutOpen, null);
  assert.strictEqual(data.checkoutClose, null);
  // Không truyền checkinState/checkoutState → mặc định AUTO (chờ mở tay).
  assert.strictEqual(data.checkinState, 'AUTO');
  assert.strictEqual(data.checkoutState, 'AUTO');
});

test('createEvent nhận checkinState/checkoutState để mở điểm danh thủ công ngay từ đầu', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createStub = stubMethod(prisma.event, 'create', async ({ data }) => ({ id: 'e1', ...data }));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Buổi học', location: 'Phòng A101', gpsEnabled: false, checkinState: 'OPEN' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(createStub.calls[0][0].data.checkinState, 'OPEN');
});

test('createEvent bỏ qua giá trị checkinState không hợp lệ, rơi về AUTO', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createStub = stubMethod(prisma.event, 'create', async ({ data }) => ({ id: 'e1', ...data }));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Buổi học', location: 'Phòng A101', gpsEnabled: false, checkinState: 'HACKED' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(createStub.calls[0][0].data.checkinState, 'AUTO');
});

test('nút "Mở điểm danh" gửi PUT chỉ checkinState mà không đụng trường khác', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  stubMethod(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'admin-1', gpsEnabled: false, lat: null, lng: null,
    checkinOpen: null, checkinClose: null, checkoutOpen: null, checkoutClose: null,
    checkinState: 'AUTO', checkoutState: 'AUTO',
  }));
  const updateStub = stubMethod(prisma.event, 'update', async ({ data }) => ({ id: 'evt-1', ...data }));

  const res = await request(app).put('/api/events/evt-1').set('Authorization', `Bearer ${token}`)
    .send({ checkinState: 'OPEN' });

  assert.strictEqual(res.status, 200);
  const data = updateStub.calls[0][0].data;
  assert.strictEqual(data.checkinState, 'OPEN');
  assert.ok(!('name' in data));
  assert.ok(!('checkinOpen' in data));
  assert.strictEqual(res.body.data.gate.checkin.open, true);
});

test('nút "Đóng điểm danh" đóng dù đang trong khung giờ hợp lệ', async () => {
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  const now = new Date();
  stubMethod(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'admin-1', gpsEnabled: false, lat: null, lng: null,
    checkinOpen: new Date(now.getTime() - 3600e3), checkinClose: new Date(now.getTime() + 3600e3),
    checkoutOpen: null, checkoutClose: null, checkinState: 'AUTO', checkoutState: 'AUTO',
  }));
  stubMethod(prisma.event, 'update', async ({ data }) => ({
    id: 'evt-1', checkinOpen: new Date(now.getTime() - 3600e3), checkinClose: new Date(now.getTime() + 3600e3),
    checkoutOpen: null, checkoutClose: null, checkoutState: 'AUTO', ...data,
  }));

  const res = await request(app).put('/api/events/evt-1').set('Authorization', `Bearer ${token}`)
    .send({ checkinState: 'CLOSED' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.gate.checkin.open, false);
  assert.strictEqual(res.body.data.gate.checkin.reason, 'MANUALLY_CLOSED');
});

test('getEvent trả kèm trạng thái cổng điểm danh đã tính sẵn', async () => {
  const token2 = jwt.sign({ userId: 'admin-1' }, process.env.JWT_SECRET);
  stubMethod(prisma.user, 'findUnique', async () => ADMIN_USER);
  stubMethod(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'admin-1', lat: 10.8, lng: 106.7, radius: 100,
    checkinOpen: null, checkinClose: null, checkoutOpen: null, checkoutClose: null,
    checkinState: 'AUTO', checkoutState: 'AUTO',
    createdBy: { name: 'Admin', email: 'admin@b.c' }, _count: { attendances: 0, eventMembers: 0 },
  }));

  const res = await request(app).get('/api/events/evt-1').set('Authorization', `Bearer ${token2}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.gate.checkin.open, false);
  assert.strictEqual(res.body.data.gate.checkin.reason, 'NOT_OPENED');
});
