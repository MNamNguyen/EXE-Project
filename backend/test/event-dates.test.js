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
