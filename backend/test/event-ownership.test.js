const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const token = jwt.sign({ userId: 'btc-1' }, process.env.JWT_SECRET);
const BTC_USER = { id: 'btc-1', mssv: null, email: 'btc@b.c', name: 'BTC One', role: 'BTC', isActive: true, isFirstLogin: false };

afterEach(() => restoreStubs());

test('getQRToken: non-owner BTC gets 403', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  stubMethod(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'btc-2',
    checkinOpen: new Date(), checkinClose: new Date(), checkoutOpen: new Date(), checkoutClose: new Date(),
  }));

  const res = await request(app).get('/api/events/evt-1/qr').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('getQRToken: event owner succeeds', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  stubMethod(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'btc-1',
    checkinOpen: new Date(), checkinClose: new Date(), checkoutOpen: new Date(), checkoutClose: new Date(),
  }));

  const res = await request(app).get('/api/events/evt-1/qr').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.checkinToken);
  assert.ok(res.body.data.checkoutToken);
});

test('manualCheckin: non-owner BTC gets 403 and no attendance is written', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  stubMethod(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-2', isActive: true }));
  const upsertStub = stubMethod(prisma.attendance, 'upsert', async () => ({}));

  const res = await request(app).post('/api/events/evt-1/manual-checkin')
    .set('Authorization', `Bearer ${token}`)
    .send({ identifier: 'SE1', type: 'checkin' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(upsertStub.calls.length, 0);
});

test('manualCheckin: inactive event returns 404', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  stubMethod(prisma.event, 'findUnique', async () => null);

  const res = await request(app).post('/api/events/evt-1/manual-checkin')
    .set('Authorization', `Bearer ${token}`)
    .send({ identifier: 'SE1', type: 'checkin' });
  assert.strictEqual(res.status, 404);
});

test('manualCheckin: owner succeeds', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  stubMethod(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-1', isActive: true }));
  stubMethod(prisma.user, 'findFirst', async () => ({ id: 'u1', name: 'An', mssv: 'SE1' }));
  stubMethod(prisma.attendance, 'findUnique', async () => null);
  stubMethod(prisma.attendance, 'upsert', async () => ({ id: 'a1' }));

  const res = await request(app).post('/api/events/evt-1/manual-checkin')
    .set('Authorization', `Bearer ${token}`)
    .send({ identifier: 'SE1', type: 'checkin' });
  assert.strictEqual(res.status, 200);
});
