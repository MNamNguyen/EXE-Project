# Backend Critical Fixes Batch 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 7 highest-severity backend defects from the 2026-08-16 code review, each with regression tests (TDD), on branch `fix/backend-critical-batch-1`.

**Architecture:** Split the Express app from the listener so supertest can mount it; add `node:test`-based regression tests that stub the Prisma singleton with `mock.method` (no test DB). Each fix area is one task with its own test file and commit.

**Tech Stack:** Node 18+ (≥18.13 for `node:test` mock), Express 4, Prisma 5, bcryptjs, jsonwebtoken, supertest (new devDependency), React 18 + Vite (frontend touches).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-16-backend-critical-fixes-design.md` (committed to this branch).
- All user-facing messages stay Vietnamese, matching existing copy.
- Branch: `fix/backend-critical-batch-1`. Commit per task, push after each task (`git push`).
- Commit messages follow repo style (lowercase prefix `feat:`/`fix:`/`docs:`/`refactor:`/`test:`) and end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- No test database: stub `prisma` singleton methods via `node:test` `mock.method`; restore with `mock.restoreAll()` in `afterEach`.
- QR tokens in tests are REAL tokens: set `process.env.QR_SECRET` before requiring `app`, then use `qrService.generateToken(eventId, type)`.
- `process.env.JWT_SECRET` is set at the top of each test file BEFORE `require('../src/app')`; test requests sign JWTs with the same secret.
- Do not modify `package-lock.json` files by hand — use `npm i`.
- `git push` on each task commit (user explicitly requested continuous git updates).

---

### Task 0: Test infrastructure (app/server split + supertest harness)

**Files:**
- Create: `backend/src/app.js`
- Modify: `backend/src/index.js` (replace body)
- Modify: `backend/package.json` (add devDependency + test script)
- Test: `backend/test/app.test.js` (new)

**Interfaces:**
- Produces: `module.exports = app` from `backend/src/app.js`; `npm test` runs `node --test test/` in `backend/`.

- [ ] **Step 1: Create `backend/src/app.js`** — move everything except `app.listen` from `index.js`:

```js
require('dotenv').config();
const express = require('express');
const prisma = require('./lib/prisma');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security
app.use(helmet());
app.set('trust proxy', 1);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Rate limiting
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/events', require('./routes/event.routes'));
app.use('/api/checkin', require('./routes/checkin.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/reports', require('./routes/report.routes'));

// Health check — dùng cho UptimeRobot để giữ server khỏi ngủ (free tier).
// Ping nhẹ vào DB (SELECT 1) nên cũng giữ luôn DB connection sống.
app.get('/health', async (req, res) => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'ok',
      db: 'connected',
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      db: 'disconnected',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint không tồn tại' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Lỗi server' });
});

module.exports = app;
```

- [ ] **Step 2: Replace `backend/src/index.js` body:**

```js
const app = require('./app');
const prisma = require('./lib/prisma');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[OK] Server running on port ${PORT}`);
  // Pre-warm the DB connection so the first real request doesn't pay the cost.
  prisma.$connect()
    .then(() => console.log('[OK] DB connected'))
    .catch((err) => console.error('[WARN] DB pre-connect failed (will retry on first request):', err.message));
});
```

- [ ] **Step 3: Add supertest + test script** — run in `backend/`:

```bash
npm i -D supertest
```

Then edit `backend/package.json` `scripts` to add: `"test": "node --test test/"`

- [ ] **Step 4: Write the smoke test `backend/test/app.test.js`:**

```js
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
```

- [ ] **Step 5: Run the test harness**

```bash
cd backend && npm test
```

Expected: 2 tests PASS (harness proves the app is importable without listening). If `mock.method` is unavailable, Node is < 18.13 — upgrade Node or note it.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.js backend/src/index.js backend/package.json backend/package-lock.json backend/test/app.test.js
git commit -m "test: split app/server and add node:test + supertest harness

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 1: Whitelist enforcement at QR check-in/check-out

**Files:**
- Modify: `backend/src/controllers/checkin.controller.js` (insert membership check after event load)
- Modify: `frontend/src/pages/scan/ScanLanding.jsx` (error-title map)
- Test: `backend/test/whitelist.test.js` (new)

**Interfaces:**
- Consumes: `app` from Task 0; `qrService.generateToken(eventId, type)` from `backend/src/services/qr.service.js`.
- Produces: processCheckin returns 403 `{ success:false, error:'NOT_REGISTERED', message:'Bạn không có trong danh sách đăng ký tham gia sự kiện này.' }` for whitelisted events when `EventMember` row missing; no fraud log, no attendance mutation.

- [ ] **Step 1: Write the failing test `backend/test/whitelist.test.js`:**

```js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
process.env.QR_SECRET = process.env.QR_SECRET || 'test-secret-qr-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const qrService = require('../src/services/qr.service');
const app = require('../src/app');

const token = jwt.sign({ userId: 'student-1' }, process.env.JWT_SECRET);
const AUTH_USER = { id: 'student-1', mssv: 'SE1', email: 'a@b.c', name: 'An', role: 'STUDENT', isActive: true, isFirstLogin: false };

function mockEvent(overrides = {}) {
  const base = {
    id: 'evt-1', name: 'Event', isWhitelisted: true, isActive: true, gpsEnabled: false,
    checkinOpen: new Date(Date.now() - 3600e3), checkinClose: new Date(Date.now() + 3600e3),
    checkoutOpen: new Date(Date.now() - 3600e3), checkoutClose: new Date(Date.now() + 3600e3),
    lat: null, lng: null, radius: 100,
  };
  mock.method(prisma.event, 'findUnique', async () => ({ ...base, ...overrides }));
}

function mockAttendanceHappyPath() {
  mock.method(prisma.deviceBinding, 'findFirst', async () => ({ id: 'b1', userId: 'student-1', deviceId: 'dev-1', isTrusted: true }));
  mock.method(prisma.attendance, 'findUnique', async () => null);
  mock.method(prisma.attendance, 'upsert', async () => ({ id: 'a1' }));
}

function checkinBody(overrides = {}) {
  return {
    eventId: 'evt-1',
    token: qrService.generateToken('evt-1', 'checkin'),
    type: 'checkin',
    gps: null,
    deviceId: 'dev-1',
    ...overrides,
  };
}

afterEach(() => mock.restoreAll());

test('public event allows a non-member and never checks membership', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent({ isWhitelisted: false });
  mock.method(prisma.eventMember, 'findUnique', async () => { throw new Error('eventMember must not be queried'); });
  mockAttendanceHappyPath();

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`).send(checkinBody());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
});

test('whitelisted event allows a registered member', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent({ isWhitelisted: true });
  mock.method(prisma.eventMember, 'findUnique', async () => ({ id: 'm1' }));
  mockAttendanceHappyPath();

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`).send(checkinBody());
  assert.strictEqual(res.status, 200);
});

test('whitelisted event rejects a non-member with 403 NOT_REGISTERED and no attendance mutation', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent({ isWhitelisted: true });
  mock.method(prisma.eventMember, 'findUnique', async () => null);
  const upsertSpy = mock.method(prisma.attendance, 'upsert', async () => ({}));
  mock.method(prisma.fraudLog, 'create', async () => { throw new Error('fraudLog must not be called'); });

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`).send(checkinBody());
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.error, 'NOT_REGISTERED');
  assert.strictEqual(upsertSpy.mock.callCount(), 0);
});

test('whitelist rejection also applies to checkout', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent({ isWhitelisted: true });
  mock.method(prisma.eventMember, 'findUnique', async () => null);
  mock.method(prisma.attendance, 'upsert', async () => ({}));

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`).send(
    checkinBody({ token: qrService.generateToken('evt-1', 'checkout'), type: 'checkout' })
  );
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.error, 'NOT_REGISTERED');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx node --test test/whitelist.test.js
```

Expected: FAIL — non-member requests return 200 (whitelist not enforced).

- [ ] **Step 3: Implement the membership check** — in `backend/src/controllers/checkin.controller.js`, right after the event-not-found check (after `// 2. Get event` block) insert:

```js
    // 3. Whitelist: chỉ thành viên trong danh sách mới được điểm danh (design 2026-07-14).
    if (event.isWhitelisted) {
      const membership = await prisma.eventMember.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'NOT_REGISTERED',
          message: 'Bạn không có trong danh sách đăng ký tham gia sự kiện này.',
        });
      }
    }
```

Also renumber the following step comments `// 3.` → `// 4.` through `// 6.` → `// 7.` so numbering stays sequential.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx node --test test/whitelist.test.js
```

Expected: 4 tests PASS.

- [ ] **Step 5: Map the error on the scan page** — in `frontend/src/pages/scan/ScanLanding.jsx`, add one line to the `getErrorTitle` map (after `DEVICE_NOT_BOUND`):

```js
      NOT_REGISTERED: 'Chưa đăng ký tham gia',
```

- [ ] **Step 6: Run the full backend suite (no regressions)**

```bash
cd backend && npm test
```

Expected: all tests PASS (6 total: 2 health + 4 whitelist).

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/checkin.controller.js backend/test/whitelist.test.js frontend/src/pages/scan/ScanLanding.jsx
git commit -m "feat: enforce event whitelist at QR check-in/check-out

Non-members of whitelisted events now get 403 NOT_REGISTERED per the
2026-07-14 design doc; no fraud log and no attendance mutation.

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 2: GPS integrity (NaN bypass, null-coord geofence, radius semantics)

**Files:**
- Modify: `backend/src/controllers/checkin.controller.js` (step "Validate GPS")
- Modify: `backend/src/controllers/event.controller.js` (`createEvent`, `updateEvent` coord/radius handling)
- Test: `backend/test/gps.test.js` (new)

**Interfaces:**
- Consumes: Task 0 harness; checkin step numbering from Task 1 (GPS step is now `// 5.`).
- Produces: `processCheckin` returns 400 `GPS_REQUIRED` when coords absent, 400 `GPS_INVALID` (with fraud log reason `GPS_INVALID`) when present but not finite in-range numbers; geofence runs whenever `event.lat !== null && event.lng !== null`. `createEvent`/`updateEvent` reject with 400 `'Bật GPS thì phải nhập toạ độ hợp lệ'` when gpsEnabled but coords invalid, and `'Bán kính không hợp lệ'` for non-positive/non-finite radius.

- [ ] **Step 1: Write the failing test `backend/test/gps.test.js`:**

```js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
process.env.QR_SECRET = process.env.QR_SECRET || 'test-secret-qr-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const qrService = require('../src/services/qr.service');
const app = require('../src/app');

const token = jwt.sign({ userId: 'student-1' }, process.env.JWT_SECRET);
const AUTH_USER = { id: 'student-1', mssv: 'SE1', email: 'a@b.c', name: 'An', role: 'STUDENT', isActive: true, isFirstLogin: false };
const ADMIN_USER = { id: 'admin-1', mssv: null, email: 'admin@b.c', name: 'Admin', role: 'ADMIN', isActive: true, isFirstLogin: false };

function mockEvent(overrides = {}) {
  const base = {
    id: 'evt-1', name: 'Event', isWhitelisted: false, isActive: true, gpsEnabled: true,
    checkinOpen: new Date(Date.now() - 3600e3), checkinClose: new Date(Date.now() + 3600e3),
    checkoutOpen: new Date(Date.now() - 3600e3), checkoutClose: new Date(Date.now() + 3600e3),
    lat: 10.85, lng: 106.77, radius: 100,
  };
  mock.method(prisma.event, 'findUnique', async () => ({ ...base, ...overrides }));
}

function mockAttendanceHappyPath() {
  mock.method(prisma.deviceBinding, 'findFirst', async () => ({ id: 'b1', userId: 'student-1', deviceId: 'dev-1', isTrusted: true }));
  mock.method(prisma.attendance, 'findUnique', async () => null);
  mock.method(prisma.attendance, 'upsert', async () => ({ id: 'a1' }));
}

function checkinBody(gps) {
  return { eventId: 'evt-1', token: qrService.generateToken('evt-1', 'checkin'), type: 'checkin', gps, deviceId: 'dev-1' };
}

afterEach(() => mock.restoreAll());

test('non-numeric GPS strings are rejected with GPS_INVALID and a fraud log', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent();
  const fraudSpy = mock.method(prisma.fraudLog, 'create', async () => ({}));
  const upsertSpy = mock.method(prisma.attendance, 'upsert', async () => ({}));

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
    .send(checkinBody({ lat: 'abc', lng: 'abc' }));
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'GPS_INVALID');
  assert.strictEqual(fraudSpy.mock.callCount(), 1);
  assert.strictEqual(fraudSpy.mock.calls[0].arguments[0].reason, 'GPS_INVALID');
  assert.strictEqual(upsertSpy.mock.callCount(), 0);
});

test('valid numeric GPS within radius passes', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent();
  mockAttendanceHappyPath();

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
    .send(checkinBody({ lat: 10.85, lng: 106.77 }));
  assert.strictEqual(res.status, 200);
});

test('missing GPS still returns GPS_REQUIRED', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent();

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
    .send(checkinBody(null));
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'GPS_REQUIRED');
});

test('out-of-range numeric GPS returns OUT_OF_RANGE', async () => {
  mock.method(prisma.user, 'findUnique', async () => AUTH_USER);
  mockEvent();
  mock.method(prisma.fraudLog, 'create', async () => ({}));

  const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
    .send(checkinBody({ lat: 20, lng: 120 }));
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'OUT_OF_RANGE');
});

const validEventPayload = {
  name: 'Event A', location: 'Hall', lat: '10.85', lng: '106.77', radius: '100',
  gpsEnabled: true,
  checkinOpen: new Date(Date.now() - 3600e3).toISOString(),
  checkinClose: new Date(Date.now() + 3600e3).toISOString(),
  checkoutOpen: new Date(Date.now() + 7200e3).toISOString(),
  checkoutClose: new Date(Date.now() + 10800e3).toISOString(),
  isWhitelisted: false,
};

test('createEvent rejects gpsEnabled:true without valid coords', async () => {
  mock.method(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createSpy = mock.method(prisma.event, 'create', async () => ({}));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ ...validEventPayload, lat: '', lng: '' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(createSpy.mock.callCount(), 0);
});

test('createEvent rejects invalid radius values', async () => {
  mock.method(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createSpy = mock.method(prisma.event, 'create', async () => ({}));

  for (const radius of ['abc', 0, -50]) {
    const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
      .send({ ...validEventPayload, radius });
    assert.strictEqual(res.status, 400, `radius=${radius} should be rejected`);
  }
  assert.strictEqual(createSpy.mock.callCount(), 0);
});

test('createEvent accepts valid coords and numeric-string radius', async () => {
  mock.method(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createSpy = mock.method(prisma.event, 'create', async () => ({ id: 'e1' }));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send(validEventPayload);
  assert.strictEqual(res.status, 201);
  const dataArg = createSpy.mock.calls[0].arguments[0].data;
  assert.strictEqual(dataArg.lat, 10.85);
  assert.strictEqual(dataArg.lng, 106.77);
  assert.strictEqual(dataArg.radius, 100);
});

test('updateEvent rejects invalid coords when gpsEnabled stays on', async () => {
  mock.method(prisma.user, 'findUnique', async () => ADMIN_USER);
  mock.method(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', createdById: 'admin-1', gpsEnabled: true, lat: 10.85, lng: 106.77, radius: 100,
  }));
  const updateSpy = mock.method(prisma.event, 'update', async () => ({}));

  const res = await request(app).put('/api/events/evt-1').set('Authorization', `Bearer ${token}`)
    .send({ lat: 'abc' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(updateSpy.mock.callCount(), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx node --test test/gps.test.js
```

Expected: FAIL — the NaN-coords check-in currently succeeds (200), and createEvent/updateEvent accept bad radius/coords.

- [ ] **Step 3: Fix the GPS step in `checkin.controller.js`** — replace the whole `// 5. Validate GPS` block with:

```js
    // 5. Validate GPS
    if (event.gpsEnabled) {
      if (gps?.lat == null || gps?.lng == null) {
        return res.status(400).json({
          success: false,
          error: 'GPS_REQUIRED',
          message: 'Vui lòng bật GPS và cấp quyền vị trí để check-in',
        });
      }

      const isCoord = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
      if (!isCoord(gps.lat, -90, 90) || !isCoord(gps.lng, -180, 180)) {
        await logFraud(userId, eventId, 'GPS_INVALID', req, { gps });
        return res.status(400).json({
          success: false,
          error: 'GPS_INVALID',
          message: 'Dữ liệu GPS không hợp lệ. Vui lòng thử lại.',
        });
      }

      if (event.lat !== null && event.lng !== null) {
        const distance = haversineDistance(gps.lat, gps.lng, event.lat, event.lng);
        if (distance > event.radius) {
          await logFraud(userId, eventId, 'GPS_OUT_OF_RANGE', req, { gps, distance: Math.round(distance) });
          return res.status(400).json({
            success: false,
            error: 'OUT_OF_RANGE',
            message: `Bạn đang cách địa điểm sự kiện ${Math.round(distance)}m. Vui lòng đến gần hơn.`,
            distance: Math.round(distance),
            requiredRadius: event.radius,
          });
        }
      }
    }
```

- [ ] **Step 4: Fix `createEvent` in `event.controller.js`** — keep the existing `const { name, description, location, lat, lng, radius, gpsEnabled, ... } = req.body;` destructure unchanged; insert the validation block right after it, and replace the old `const event = await prisma.event.create({ data: {...` call with the version below:

```js
    const latVal = lat === undefined || lat === null || lat === '' ? null : Number(lat);
    const lngVal = lng === undefined || lng === null || lng === '' ? null : Number(lng);
    const gpsOn = gpsEnabled !== false;

    if (gpsOn) {
      const okLat = latVal !== null && Number.isFinite(latVal) && latVal >= -90 && latVal <= 90;
      const okLng = lngVal !== null && Number.isFinite(lngVal) && lngVal >= -180 && lngVal <= 180;
      if (!okLat || !okLng) {
        return res.status(400).json({ success: false, message: 'Bật GPS thì phải nhập toạ độ hợp lệ' });
      }
    }

    const radiusVal = radius === undefined || radius === null || radius === '' ? 100 : Number(radius);
    if (!Number.isFinite(radiusVal) || radiusVal <= 0) {
      return res.status(400).json({ success: false, message: 'Bán kính không hợp lệ' });
    }

    const event = await prisma.event.create({
      data: {
        name, description, location,
        lat: latVal,
        lng: lngVal,
        radius: radiusVal,
        gpsEnabled: gpsOn,
        checkinOpen: new Date(checkinOpen),
        checkinClose: new Date(checkinClose),
        checkoutOpen: new Date(checkoutOpen),
        checkoutClose: new Date(checkoutClose),
        isWhitelisted: isWhitelisted || false,
        createdById: req.user.id,
        ...(memberIds?.length && {
          eventMembers: {
            create: memberIds.map((uid) => ({ userId: uid })),
          },
        }),
      },
      include: { createdBy: { select: { name: true } } },
    });
```

- [ ] **Step 5: Fix `updateEvent` coord/radius handling** — after the ownership check and destructure, insert before `const updated = await prisma.event.update`:

```js
    const latVal = lat !== undefined ? (lat === null || lat === '' ? null : Number(lat)) : event.lat;
    const lngVal = lng !== undefined ? (lng === null || lng === '' ? null : Number(lng)) : event.lng;
    const gpsOn = gpsEnabled !== undefined ? gpsEnabled : event.gpsEnabled;

    if (gpsOn) {
      const okLat = latVal !== null && Number.isFinite(latVal) && latVal >= -90 && latVal <= 90;
      const okLng = lngVal !== null && Number.isFinite(lngVal) && lngVal >= -180 && lngVal <= 180;
      if (!okLat || !okLng) {
        return res.status(400).json({ success: false, message: 'Bật GPS thì phải nhập toạ độ hợp lệ' });
      }
    }

    const radiusVal = radius !== undefined && radius !== null && radius !== '' ? Number(radius) : undefined;
    if (radiusVal !== undefined && (!Number.isFinite(radiusVal) || radiusVal <= 0)) {
      return res.status(400).json({ success: false, message: 'Bán kính không hợp lệ' });
    }
```

Then replace the `lat`/`lng`/`radius` lines in the `data:` object:

```js
        ...(lat !== undefined && { lat: latVal }),
        ...(lng !== undefined && { lng: lngVal }),
        ...(radiusVal !== undefined && { radius: radiusVal }),
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && npx node --test test/gps.test.js
```

Expected: 7 tests PASS.

- [ ] **Step 7: Run the full backend suite (no regressions)**

```bash
cd backend && npm test
```

Expected: all PASS (6 prior + 7 new).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/checkin.controller.js backend/src/controllers/event.controller.js backend/test/gps.test.js
git commit -m "fix: validate GPS coords and event geofence inputs

Rejects non-numeric/out-of-range GPS with GPS_INVALID fraud log, stops
NaN from bypassing the radius check, runs the geofence whenever coords
exist, and validates event coords/radius server-side.

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 3: Timezone-correct event windows

**Files:**
- Create: `frontend/src/utils/date.js`
- Create: `frontend/src/utils/date.test.js`
- Modify: `frontend/src/pages/btc/EventCreate.jsx` (default + submit payload)
- Modify: `frontend/src/pages/btc/EventEditModal.jsx` (shared helper + submit payload)
- Modify: `backend/src/controllers/event.controller.js` (date validation in createEvent/updateEvent)
- Modify: `frontend/package.json` (test script)
- Test: `backend/test/event-dates.test.js` (new)

**Interfaces:**
- Produces: `frontend/src/utils/date.js` exports `toLocalInput(iso)` (ISO → datetime-local string in local tz, `''` for falsy input) and `localInputToISO(value)` (datetime-local → ISO with offset, `''` for empty/invalid). Backend returns 400 `'Thời gian không hợp lệ'` for unparseable dates.

- [ ] **Step 1: Create `frontend/src/utils/date.js`:**

```js
// ISO (UTC) → giá trị cho <input type="datetime-local"> theo giờ ĐỊA PHƯƠNG.
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Giá trị datetime-local (giờ địa phương) → ISO có timezone offset để gửi lên server.
export function localInputToISO(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
```

- [ ] **Step 2: Create `frontend/src/utils/date.test.js`:**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { toLocalInput, localInputToISO } from './date.js';

test('localInputToISO → toLocalInput round-trips the same wall-clock value', () => {
  assert.strictEqual(toLocalInput(localInputToISO('2026-08-16T08:00')), '2026-08-16T08:00');
});

test('toLocalInput returns empty string for falsy input', () => {
  assert.strictEqual(toLocalInput(null), '');
  assert.strictEqual(toLocalInput(''), '');
});

test('localInputToISO returns empty string for empty or invalid input', () => {
  assert.strictEqual(localInputToISO(''), '');
  assert.strictEqual(localInputToISO('not-a-date'), '');
});
```

Add to `frontend/package.json` scripts: `"test": "node --test src/utils/date.test.js"`.

- [ ] **Step 3: Run the frontend date tests**

```bash
cd frontend && npm test
```

Expected: 3 tests PASS (pure functions — this validates the helpers before wiring them).

- [ ] **Step 4: Wire `EventCreate.jsx`** — three edits:

(a) Remove line 13 (`const today = new Date().toISOString().slice(0, 16);`).

(b) Add import after the other imports:

```js
import { toLocalInput, localInputToISO } from '../../utils/date';
```

(c) Replace `checkinOpen: today,` in the `useState` initializer with:

```js
    checkinOpen: toLocalInput(new Date().toISOString()),
```

(d) In `handleSubmit`, replace `const { data } = await eventApi.create(form);` with:

```js
      const payload = {
        ...form,
        checkinOpen: localInputToISO(form.checkinOpen),
        checkinClose: localInputToISO(form.checkinClose),
        checkoutOpen: localInputToISO(form.checkoutOpen),
        checkoutClose: localInputToISO(form.checkoutClose),
      };
      const { data } = await eventApi.create(payload);
```

- [ ] **Step 5: Wire `EventEditModal.jsx`** — three edits:

(a) Remove the local helper (lines 8-14, `function toLocalInput(iso) {...}`).

(b) Add import:

```js
import { toLocalInput, localInputToISO } from '../../utils/date';
```

(c) In `handleSubmit`, replace `await eventApi.update(event.id, form);` with:

```js
      const payload = {
        ...form,
        checkinOpen: localInputToISO(form.checkinOpen),
        checkinClose: localInputToISO(form.checkinClose),
        checkoutOpen: localInputToISO(form.checkoutOpen),
        checkoutClose: localInputToISO(form.checkoutClose),
      };
      await eventApi.update(event.id, payload);
```

- [ ] **Step 6: Verify frontend still builds**

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Backend date validation — write the failing test `backend/test/event-dates.test.js`:**

```js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

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

afterEach(() => mock.restoreAll());

test('createEvent rejects unparseable dates with 400', async () => {
  mock.method(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createSpy = mock.method(prisma.event, 'create', async () => ({}));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send({ ...validPayload, checkinOpen: 'not-a-date' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(createSpy.mock.callCount(), 0);
});

test('createEvent stores ISO-with-offset dates correctly (UTC round-trip)', async () => {
  mock.method(prisma.user, 'findUnique', async () => ADMIN_USER);
  const createSpy = mock.method(prisma.event, 'create', async () => ({ id: 'e1' }));

  const res = await request(app).post('/api/events').set('Authorization', `Bearer ${token}`)
    .send(validPayload);
  assert.strictEqual(res.status, 201);
  const data = createSpy.mock.calls[0].arguments[0].data;
  assert.strictEqual(data.checkinOpen.toISOString(), validPayload.checkinOpen);
});

test('updateEvent rejects unparseable dates with 400', async () => {
  mock.method(prisma.user, 'findUnique', async () => ADMIN_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'admin-1', gpsEnabled: false, lat: null, lng: null }));
  const updateSpy = mock.method(prisma.event, 'update', async () => ({}));

  const res = await request(app).put('/api/events/evt-1').set('Authorization', `Bearer ${token}`)
    .send({ checkinClose: 'bad-date' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(updateSpy.mock.callCount(), 0);
});
```

- [ ] **Step 8: Run it to verify it fails**

```bash
cd backend && npx node --test test/event-dates.test.js
```

Expected: FAIL — `new Date('not-a-date')` produces Invalid Date, Prisma throws, response is 500 instead of 400.

- [ ] **Step 9: Implement date validation in `createEvent`** — insert after the destructure (before `const latVal =`):

```js
    const checkinOpenDate = new Date(checkinOpen);
    const checkinCloseDate = new Date(checkinClose);
    const checkoutOpenDate = new Date(checkoutOpen);
    const checkoutCloseDate = new Date(checkoutClose);
    if ([checkinOpenDate, checkinCloseDate, checkoutOpenDate, checkoutCloseDate]
      .some((d) => Number.isNaN(d.getTime()))) {
      return res.status(400).json({ success: false, message: 'Thời gian không hợp lệ' });
    }
```

And in the `data:` object replace the four `new Date(...)` expressions with the precomputed values:

```js
        checkinOpen: checkinOpenDate,
        checkinClose: checkinCloseDate,
        checkoutOpen: checkoutOpenDate,
        checkoutClose: checkoutCloseDate,
```

- [ ] **Step 10: Implement date validation in `updateEvent`** — insert after the destructure (before `const latVal =`):

```js
    const dateVals = {};
    for (const [key, value] of Object.entries({ checkinOpen, checkinClose, checkoutOpen, checkoutClose })) {
      if (value !== undefined && value !== null && value !== '') {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Thời gian không hợp lệ' });
        }
        dateVals[key] = d;
      }
    }
```

And in the `data:` object replace the four time lines with:

```js
        ...(dateVals.checkinOpen && { checkinOpen: dateVals.checkinOpen }),
        ...(dateVals.checkinClose && { checkinClose: dateVals.checkinClose }),
        ...(dateVals.checkoutOpen && { checkoutOpen: dateVals.checkoutOpen }),
        ...(dateVals.checkoutClose && { checkoutClose: dateVals.checkoutClose }),
```

- [ ] **Step 11: Run test to verify it passes**

```bash
cd backend && npx node --test test/event-dates.test.js
```

Expected: 3 tests PASS.

- [ ] **Step 12: Run both suites (no regressions)**

```bash
cd backend && npm test && cd ../frontend && npm test && npm run build
```

Expected: all PASS.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/utils/date.js frontend/src/utils/date.test.js frontend/src/pages/btc/EventCreate.jsx frontend/src/pages/btc/EventEditModal.jsx frontend/package.json backend/src/controllers/event.controller.js backend/test/event-dates.test.js
git commit -m "fix: send timezone-aware event times and validate dates server-side

datetime-local values are converted to ISO with offset before sending,
so windows are correct regardless of the server timezone; backend
rejects unparseable dates with 400.

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 4: Email config aligned with Brevo + resilient OTP send

**Files:**
- Modify: `backend/render.yaml` (env vars)
- Modify: `backend/.env.example` (env vars)
- Modify: `backend/src/services/email.service.js` (config guard)
- Modify: `backend/src/controllers/auth.controller.js` (module import + OTP send failure handling)
- Test: `backend/test/email.test.js` (new)

**Interfaces:**
- Consumes: Task 0 harness.
- Produces: login returns 500 `'Không gửi được email OTP. Vui lòng thử lại sau.'` and deletes the just-created OTP row when the email send fails; `email.service.js` throws `'Email chưa cấu hình: thiếu BREVO_API_KEY / BREVO_SENDER_EMAIL'` when config is missing.

- [ ] **Step 1: Fix `backend/render.yaml` envVars** — replace the five `SMTP_*` entries:

```yaml
      - key: SMTP_HOST
        sync: false
      - key: SMTP_PORT
        sync: false
      - key: SMTP_USER
        sync: false
      - key: SMTP_PASS
        sync: false
      - key: SMTP_FROM
        sync: false
```

with:

```yaml
      - key: BREVO_API_KEY
        sync: false
      - key: BREVO_SENDER_EMAIL
        sync: false
      - key: BREVO_SENDER_NAME
        value: FPT Event System
```

- [ ] **Step 2: Fix `backend/.env.example`** — replace the `# Email (SMTP)` block:

```bash
# Email (Brevo API)
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=no-reply@yourdomain.com
BREVO_SENDER_NAME="FPT Event System"
```

- [ ] **Step 3: Add a config guard to `backend/src/services/email.service.js`** — insert after the `sender` const:

```js
function assertConfigured() {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error('Email chưa cấu hình: thiếu BREVO_API_KEY / BREVO_SENDER_EMAIL');
  }
}
```

and call `assertConfigured();` as the first line of both `sendOtpEmail` and `sendWelcomeEmail`.

- [ ] **Step 4: Write the failing test `backend/test/email.test.js`:**

```js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const emailService = require('../src/services/email.service');
const app = require('../src/app');

const BASE_USER = {
  id: 'u1', mssv: 'SE1', email: 'a@b.c', name: 'An', role: 'STUDENT',
  isActive: true, isFirstLogin: false, passwordHash: 'hash',
  failedLoginAttempts: 0, lockedUntil: null,
};

function loginBody() {
  return { identifier: 'SE1', password: 'x', deviceId: 'dev-1', deviceInfo: null };
}

afterEach(() => mock.restoreAll());

test('login returns 500 and deletes the OTP when the email send fails', async () => {
  mock.method(prisma.user, 'findUnique', async () => BASE_USER);
  mock.method(prisma.user, 'findFirst', async () => BASE_USER);
  mock.method(bcrypt, 'compare', async () => true);
  mock.method(prisma.user, 'update', async () => ({}));
  // A trusted binding on a DIFFERENT device → login goes down the OTP path.
  mock.method(prisma.deviceBinding, 'findFirst', async () => ({ id: 'b1', userId: 'u1', deviceId: 'other-device', isTrusted: true }));
  mock.method(prisma.otpToken, 'deleteMany', async () => ({}));
  mock.method(prisma.otpToken, 'create', async () => ({}));
  const sendSpy = mock.method(emailService, 'sendOtpEmail', async () => { throw new Error('Brevo API error 401'); });
  const deleteSpy = mock.method(prisma.otpToken, 'deleteMany', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 500);
  assert.ok(res.body.message.includes('Không gửi được email OTP'));
  assert.strictEqual(sendSpy.mock.callCount(), 1);
  // deleteMany is called twice: once to purge old OTPs, once to clean up the failed send.
  assert.strictEqual(deleteSpy.mock.callCount(), 2);
});

test('login proceeds to OTP step when the email sends', async () => {
  mock.method(prisma.user, 'findUnique', async () => BASE_USER);
  mock.method(prisma.user, 'findFirst', async () => BASE_USER);
  mock.method(bcrypt, 'compare', async () => true);
  mock.method(prisma.user, 'update', async () => ({}));
  mock.method(prisma.deviceBinding, 'findFirst', async () => ({ id: 'b1', userId: 'u1', deviceId: 'other-device', isTrusted: true }));
  mock.method(prisma.otpToken, 'deleteMany', async () => ({}));
  mock.method(prisma.otpToken, 'create', async () => ({}));
  mock.method(emailService, 'sendOtpEmail', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.requireOtp, true);
});
```

- [ ] **Step 5: Run it to verify it fails**

```bash
cd backend && npx node --test test/email.test.js
```

Expected: FAIL — email-failure currently throws into the generic catch → 500 with message `'Lỗi server'` and no cleanup deleteMany (callCount 1, not 2).

- [ ] **Step 6: Update `auth.controller.js`** — two edits:

(a) Replace line 5 (`const { sendOtpEmail } = require('../services/email.service');`) with:

```js
const emailService = require('../services/email.service');
```

(b) Replace `await sendOtpEmail(user.email, user.name, otp);` with:

```js
      try {
        await emailService.sendOtpEmail(user.email, user.name, otp);
      } catch (emailErr) {
        console.error('Failed to send OTP email:', emailErr);
        await prisma.otpToken.deleteMany({
          where: { userId: user.id, token: otp, purpose: 'DEVICE_BIND' },
        });
        return res.status(500).json({
          success: false,
          message: 'Không gửi được email OTP. Vui lòng thử lại sau.',
        });
      }
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd backend && npx node --test test/email.test.js
```

Expected: 2 tests PASS.

- [ ] **Step 8: Run the full backend suite (no regressions)**

```bash
cd backend && npm test
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/render.yaml backend/.env.example backend/src/services/email.service.js backend/src/controllers/auth.controller.js backend/test/email.test.js
git commit -m "fix: align email config with Brevo API and fail OTP login gracefully

render.yaml/.env.example now declare BREVO_API_KEY/SENDER_EMAIL (the
SMTP_* vars were unused), the service fails fast when unconfigured, and
a failed OTP send cleans up the token and returns a clear 500.

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 5: Ownership checks for QR minting and manual check-in

**Files:**
- Modify: `backend/src/controllers/event.controller.js` (`getQRToken`, `manualCheckin`)
- Test: `backend/test/event-ownership.test.js` (new)

**Interfaces:**
- Produces: both endpoints return 403 `'Không có quyền lấy mã QR cho sự kiện này'` / `'Không có quyền thao tác sự kiện này'` for non-ADMIN users who are not the event creator; `manualCheckin` also 404s for inactive/missing events.

- [ ] **Step 1: Write the failing test `backend/test/event-ownership.test.js`:**

```js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
process.env.QR_SECRET = process.env.QR_SECRET || 'test-secret-qr-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const token = jwt.sign({ userId: 'btc-1' }, process.env.JWT_SECRET);
const BTC_USER = { id: 'btc-1', mssv: null, email: 'btc@b.c', name: 'BTC One', role: 'BTC', isActive: true, isFirstLogin: false };

afterEach(() => mock.restoreAll());

test('getQRToken: non-owner BTC gets 403', async () => {
  mock.method(prisma.user, 'findUnique', async () => BTC_USER);
  mock.method(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'btc-2',
    checkinOpen: new Date(), checkinClose: new Date(), checkoutOpen: new Date(), checkoutClose: new Date(),
  }));

  const res = await request(app).get('/api/events/evt-1/qr').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('getQRToken: event owner succeeds', async () => {
  mock.method(prisma.user, 'findUnique', async () => BTC_USER);
  mock.method(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'btc-1',
    checkinOpen: new Date(), checkinClose: new Date(), checkoutOpen: new Date(), checkoutClose: new Date(),
  }));

  const res = await request(app).get('/api/events/evt-1/qr').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.checkinToken);
  assert.ok(res.body.data.checkoutToken);
});

test('manualCheckin: non-owner BTC gets 403 and no attendance is written', async () => {
  mock.method(prisma.user, 'findUnique', async () => BTC_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-2', isActive: true }));
  const upsertSpy = mock.method(prisma.attendance, 'upsert', async () => ({}));

  const res = await request(app).post('/api/events/evt-1/manual-checkin')
    .set('Authorization', `Bearer ${token}`)
    .send({ identifier: 'SE1', type: 'checkin' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(upsertSpy.mock.callCount(), 0);
});

test('manualCheckin: inactive event returns 404', async () => {
  mock.method(prisma.user, 'findUnique', async () => BTC_USER);
  mock.method(prisma.event, 'findUnique', async () => null);

  const res = await request(app).post('/api/events/evt-1/manual-checkin')
    .set('Authorization', `Bearer ${token}`)
    .send({ identifier: 'SE1', type: 'checkin' });
  assert.strictEqual(res.status, 404);
});

test('manualCheckin: owner succeeds', async () => {
  mock.method(prisma.user, 'findUnique', async () => BTC_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-1', isActive: true }));
  mock.method(prisma.user, 'findFirst', async () => ({ id: 'u1', name: 'An', mssv: 'SE1' }));
  mock.method(prisma.attendance, 'findUnique', async () => null);
  mock.method(prisma.attendance, 'upsert', async () => ({ id: 'a1' }));

  const res = await request(app).post('/api/events/evt-1/manual-checkin')
    .set('Authorization', `Bearer ${token}`)
    .send({ identifier: 'SE1', type: 'checkin' });
  assert.strictEqual(res.status, 200);
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && npx node --test test/event-ownership.test.js
```

Expected: FAIL — non-owner BTC currently gets 200 from both endpoints.

- [ ] **Step 3: Fix `getQRToken`** — add `createdById: true` to the select:

```js
      select: { id: true, name: true, createdById: true, checkinOpen: true, checkinClose: true, checkoutOpen: true, checkoutClose: true },
```

and insert after the `if (!event)` 404 check:

```js
    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền lấy mã QR cho sự kiện này' });
    }
```

- [ ] **Step 4: Fix `manualCheckin`** — insert at the top of the try block (before the identifier resolve):

```js
    const event = await prisma.event.findUnique({
      where: { id: eventId, isActive: true },
      select: { id: true, createdById: true },
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }
    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền thao tác sự kiện này' });
    }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npx node --test test/event-ownership.test.js
```

Expected: 5 tests PASS.

- [ ] **Step 6: Run the full backend suite (no regressions)**

```bash
cd backend && npm test
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/event.controller.js backend/test/event-ownership.test.js
git commit -m "fix: restrict QR minting and manual check-in to event owner

Any BTC could previously mint QR tokens or fabricate attendance for
events they do not own; both endpoints now enforce the same ownership
check as updateEvent/deleteEvent.

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 6: Gate PII event endpoints by ownership

**Files:**
- Create: `backend/src/lib/eventAccess.js`
- Modify: `backend/src/controllers/event.controller.js` (use shared helper; gate `getAttendance`, `listMembers`, `searchUsersForEvent`; strip coords in `getEvent`)
- Modify: `backend/src/controllers/report.controller.js` (`exportAttendance` gate)
- Test: `backend/test/event-pii.test.js` (new)

**Interfaces:**
- Consumes: Task 0 harness; Task 5's ownership pattern.
- Produces: `backend/src/lib/eventAccess.js` exports `loadEventForWrite(req, res)` → returns the event row or `null` (after sending 404/403); `getEvent` responses strip `lat`/`lng`/`radius` to `null` for non-owner non-ADMIN requesters.

- [ ] **Step 1: Create `backend/src/lib/eventAccess.js`:**

```js
const prisma = require('./prisma');

// Kiểm tra quyền thao tác trên sự kiện (ADMIN hoặc người tạo).
// Trả về event nếu OK, hoặc null kèm gửi response lỗi.
async function loadEventForWrite(req, res) {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    return null;
  }
  if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
    res.status(403).json({ success: false, message: 'Không có quyền thao tác sự kiện này' });
    return null;
  }
  return event;
}

module.exports = { loadEventForWrite };
```

- [ ] **Step 2: Switch `event.controller.js` to the shared helper** — add import near the top:

```js
const { loadEventForWrite } = require('../lib/eventAccess');
```

and delete the local `loadEventForWrite` function (the block commented `// Kiểm tra quyền thao tác trên sự kiện (ADMIN hoặc người tạo).` through its closing brace).

- [ ] **Step 3: Write the failing test `backend/test/event-pii.test.js`:**

```js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const token = jwt.sign({ userId: 'lect-1' }, process.env.JWT_SECRET);
const LECTURER_USER = { id: 'lect-1', mssv: null, email: 'lect@b.c', name: 'Lecturer', role: 'LECTURER', isActive: true, isFirstLogin: false };

afterEach(() => mock.restoreAll());

test('getAttendance: non-owner LECTURER gets 403', async () => {
  mock.method(prisma.user, 'findUnique', async () => LECTURER_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-1' }));

  const res = await request(app).get('/api/events/evt-1/attendance').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('getAttendance: owner gets data', async () => {
  mock.method(prisma.user, 'findUnique', async () => LECTURER_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'lect-1' }));
  mock.method(prisma.attendance, 'findMany', async () => []);
  mock.method(prisma.attendance, 'count', async () => 0);
  mock.method(prisma.attendance, 'groupBy', async () => []);

  const res = await request(app).get('/api/events/evt-1/attendance').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
});

test('listMembers: non-owner gets 403', async () => {
  mock.method(prisma.user, 'findUnique', async () => LECTURER_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-1' }));

  const res = await request(app).get('/api/events/evt-1/members').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('searchUsersForEvent: non-owner gets 403', async () => {
  mock.method(prisma.user, 'findUnique', async () => LECTURER_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-1' }));

  const res = await request(app).get('/api/events/evt-1/members/search?q=a').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('exportAttendance: non-owner gets 403', async () => {
  mock.method(prisma.user, 'findUnique', async () => LECTURER_USER);
  mock.method(prisma.event, 'findUnique', async () => ({ id: 'evt-1', createdById: 'btc-1' }));

  const res = await request(app).get('/api/reports/events/evt-1/export').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('getEvent: non-owner response has lat/lng/radius stripped', async () => {
  mock.method(prisma.user, 'findUnique', async () => LECTURER_USER);
  mock.method(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'btc-1', lat: 10.85, lng: 106.77, radius: 100,
    createdBy: { name: 'BTC', email: 'btc@b.c' }, _count: { attendances: 1, eventMembers: 2 },
  }));

  const res = await request(app).get('/api/events/evt-1').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.lat, null);
  assert.strictEqual(res.body.data.lng, null);
  assert.strictEqual(res.body.data.radius, null);
});

test('getEvent: owner keeps coords', async () => {
  mock.method(prisma.user, 'findUnique', async () => LECTURER_USER);
  mock.method(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Event', createdById: 'lect-1', lat: 10.85, lng: 106.77, radius: 100,
    createdBy: { name: 'Lecturer', email: 'lect@b.c' }, _count: { attendances: 1, eventMembers: 2 },
  }));

  const res = await request(app).get('/api/events/evt-1').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.lat, 10.85);
  assert.strictEqual(res.body.data.radius, 100);
});
```

- [ ] **Step 4: Run it to verify it fails**

```bash
cd backend && npx node --test test/event-pii.test.js
```

Expected: FAIL — non-owners currently get 200 with data.

- [ ] **Step 5: Gate the three read endpoints in `event.controller.js`** — insert as the first statement of each try block:

`getAttendance`, `listMembers`, `searchUsersForEvent` each get:

```js
    const event = await loadEventForWrite(req, res);
    if (!event) return;
```

- [ ] **Step 6: Strip coords in `getEvent`** — after the `if (!event)` 404 check, insert:

```js
    // Toạ độ sự kiện chỉ dành cho ADMIN/người tạo (chống giả GPS từ xa).
    if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id) {
      event.lat = null;
      event.lng = null;
      event.radius = null;
    }
```

- [ ] **Step 7: Gate `exportAttendance` in `report.controller.js`** — add import:

```js
const { loadEventForWrite } = require('../lib/eventAccess');
```

and replace the `prisma.event.findUnique` block at the top of `exportAttendance` with:

```js
    const event = await loadEventForWrite(req, res);
    if (!event) return;
```

(delete the old `const event = await prisma.event.findUnique({...})` and its `if (!event)` 404 check — `loadEventForWrite` returns the full event row including `name`, `location`, `checkinOpen`).

- [ ] **Step 8: Run test to verify it passes**

```bash
cd backend && npx node --test test/event-pii.test.js
```

Expected: 7 tests PASS.

- [ ] **Step 9: Run the full backend suite (no regressions)**

```bash
cd backend && npm test
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/lib/eventAccess.js backend/src/controllers/event.controller.js backend/src/controllers/report.controller.js backend/test/event-pii.test.js
git commit -m "fix: gate PII event endpoints by ownership and hide coords

getAttendance/listMembers/searchUsersForEvent/exportAttendance now
require ADMIN or the event creator; getEvent strips lat/lng/radius for
everyone else. Shared loadEventForWrite moved to lib/eventAccess.

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 7: Crypto-grade temp passwords + login lockout

**Files:**
- Modify: `backend/prisma/schema.prisma` (two new `User` fields)
- Modify: `backend/src/controllers/admin.controller.js` (`generateTempPassword`)
- Modify: `backend/src/controllers/auth.controller.js` (`login` lockout logic)
- Test: `backend/test/lockout.test.js` (new)

**Interfaces:**
- Produces: `User.failedLoginAttempts Int @default(0)`, `User.lockedUntil DateTime?`; login returns 429 `{ error:'ACCOUNT_LOCKED' }` while locked, locks for 15 min after 5 consecutive failures, resets on success.

- [ ] **Step 1: Add fields to `backend/prisma/schema.prisma`** — in `model User`, after `isActive`:

```prisma
  failedLoginAttempts Int      @default(0)
  lockedUntil        DateTime?
```

- [ ] **Step 2: Write the failing test `backend/test/lockout.test.js`:**

```js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const BASE_USER = {
  id: 'u1', mssv: 'SE1', email: 'a@b.c', name: 'An', role: 'STUDENT',
  isActive: true, isFirstLogin: false, passwordHash: 'hash',
  failedLoginAttempts: 0, lockedUntil: null,
};

function loginBody() {
  return { identifier: 'SE1', password: 'x', deviceId: 'dev-1', deviceInfo: null };
}

function mockUser(overrides) {
  mock.method(prisma.user, 'findFirst', async () => ({ ...BASE_USER, ...overrides }));
}

function mockLoginSuccessFlow() {
  mock.method(bcrypt, 'compare', async () => true);
  mock.method(prisma.deviceBinding, 'findFirst', async () => null);
  mock.method(prisma.deviceBinding, 'upsert', async () => ({}));
  mock.method(prisma.user, 'update', async () => ({}));
}

afterEach(() => mock.restoreAll());

test('locked account gets 429 even with the correct password', async () => {
  mockUser({ lockedUntil: new Date(Date.now() + 60_000) });
  mock.method(bcrypt, 'compare', async () => { throw new Error('compare must not run while locked'); });

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 429);
  assert.strictEqual(res.body.error, 'ACCOUNT_LOCKED');
});

test('wrong password increments the failure counter', async () => {
  mockUser({ failedLoginAttempts: 3 });
  mock.method(bcrypt, 'compare', async () => false);
  const updateSpy = mock.method(prisma.user, 'update', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 401);
  assert.strictEqual(updateSpy.mock.callCount(), 1);
  assert.strictEqual(updateSpy.mock.calls[0].arguments[0].data.failedLoginAttempts, 4);
});

test('fifth failure locks the account for 15 minutes', async () => {
  mockUser({ failedLoginAttempts: 4 });
  mock.method(bcrypt, 'compare', async () => false);
  const updateSpy = mock.method(prisma.user, 'update', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 401);
  const data = updateSpy.mock.calls[0].arguments[0].data;
  assert.strictEqual(data.failedLoginAttempts, 0);
  assert.ok(data.lockedUntil instanceof Date);
  assert.ok(data.lockedUntil.getTime() > Date.now() + 14 * 60_000);
});

test('successful login resets the counter and lock', async () => {
  mockUser({ failedLoginAttempts: 2 });
  mockLoginSuccessFlow();
  const updateSpy = mock.method(prisma.user, 'update', async () => ({}));

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 200);
  const resetCall = updateSpy.mock.calls.find(
    (c) => c.arguments[0].data.failedLoginAttempts === 0 && c.arguments[0].data.lockedUntil === null
  );
  assert.ok(resetCall, 'expected a reset update with failedLoginAttempts:0 and lockedUntil:null');
});

test('expired lock allows login again', async () => {
  mockUser({ lockedUntil: new Date(Date.now() - 60_000) });
  mockLoginSuccessFlow();

  const res = await request(app).post('/api/auth/login').send(loginBody());
  assert.strictEqual(res.status, 200);
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd backend && npx node --test test/lockout.test.js
```

Expected: FAIL — locked accounts currently log in (no lock logic), and no counter updates happen.

- [ ] **Step 4: Fix `generateTempPassword` in `admin.controller.js`** — add at the top with the other requires:

```js
const crypto = require('crypto');
```

and replace the function body:

```js
function generateTempPassword() {
  return 'Fpt@' + crypto.randomInt(100000, 1000000).toString();
}
```

- [ ] **Step 5: Add lockout logic to `login` in `auth.controller.js`** — three edits:

(a) After the `const { identifier, password, deviceId, deviceInfo } = req.body;` line, add:

```js
    const now = new Date();
```

(b) After the `if (!user)` 401 check, insert the lock check:

```js
    if (user.lockedUntil && user.lockedUntil > now) {
      const mins = Math.max(1, Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000));
      return res.status(429).json({
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: `Tài khoản tạm khoá do đăng nhập sai nhiều lần. Thử lại sau ${mins} phút.`,
      });
    }
```

(c) Replace the wrong-password branch:

```js
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const failed = (user.failedLoginAttempts || 0) + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: failed >= 5
          ? { failedLoginAttempts: 0, lockedUntil: new Date(now.getTime() + 15 * 60 * 1000) }
          : { failedLoginAttempts: failed },
      });
      return res.status(401).json({ success: false, message: 'MSSV/Email hoặc mật khẩu không đúng' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && npx node --test test/lockout.test.js
```

Expected: 5 tests PASS.

- [ ] **Step 7: Regenerate the Prisma client so the new fields exist on the client type**

```bash
cd backend && npx prisma generate
```

Expected: success (schema change does not require a running DB for `generate`).

- [ ] **Step 8: Run the full backend suite (no regressions)**

```bash
cd backend && npm test
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/controllers/admin.controller.js backend/src/controllers/auth.controller.js backend/test/lockout.test.js
git commit -m "feat: crypto-grade temp passwords and login lockout

generateTempPassword now uses crypto.randomInt; login locks an account
for 15 minutes after 5 consecutive failures (429 ACCOUNT_LOCKED) and
resets the counter on success. Requires prisma db push on deploy.

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

---

### Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test
```

Expected: every test file passes (`app`, `whitelist`, `gps`, `event-dates`, `email`, `event-ownership`, `event-pii`, `lockout`).

- [ ] **Step 2: Run frontend tests + build**

```bash
cd frontend && npm test && npm run build
```

Expected: 3 date tests PASS, build succeeds.

- [ ] **Step 3: Smoke-run the backend locally (optional, needs DATABASE_URL)**

```bash
cd backend && npm run dev
```

Expected: server starts, `/health` returns ok. Skip if no local DB — CI of the test suite covers logic.

- [ ] **Step 4: Confirm branch is fully pushed**

```bash
git status && git log --oneline origin/fix/backend-critical-batch-1..HEAD
```

Expected: working tree clean, no unpushed commits.

---

## Post-merge deployment checklist (hand to the user, not executed here)

1. `npx prisma db push` on the production database (two new `User` columns).
2. In Render env: add `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`; remove stale `SMTP_*` vars.
3. Rebuild frontend (Vercel auto-deploys on merge).
4. After merge, consider a PR from `fix/backend-critical-batch-1` → `main` (GitHub PR link is available on the branch).
