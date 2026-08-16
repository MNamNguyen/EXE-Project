process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

afterEach(() => mock.restoreAll());

test('GET /health returns ok when DB reachable', async () => {
  mock.method(prisma, '$queryRaw', async () => [{ ok: 1 }]);
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.strictEqual(res.body.db, 'connected');
});

test('GET /health returns 503 when DB down', async () => {
  mock.method(prisma, '$queryRaw', async () => { throw new Error('db down'); });
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.body.db, 'disconnected');
});
