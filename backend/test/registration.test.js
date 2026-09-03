const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const emailService = require('../src/services/email.service');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const HOUR = 3600e3;

function mockEvent(overrides = {}) {
  const base = {
    id: 'evt-1',
    name: 'Workshop AI',
    description: null,
    location: 'Hội trường A1',
    checkinOpen: new Date(Date.now() + HOUR),
    checkinClose: new Date(Date.now() + 3 * HOUR),
    checkoutOpen: new Date(Date.now() + 3 * HOUR),
    checkoutClose: new Date(Date.now() + 4 * HOUR),
    isWhitelisted: false,
    allowRegistration: true,
    lat: 10.8, lng: 106.7, radius: 100,
    createdBy: { name: 'Ban tổ chức' },
    _count: { eventMembers: 12 },
  };
  // Mô phỏng `select` của Prisma: chỉ trả về đúng các cột được yêu cầu, nhờ đó
  // test chứng minh được endpoint công khai thật sự không trả lat/lng ra ngoài.
  return stubMethod(prisma.event, 'findFirst', async (args = {}) => {
    const row = { ...base, ...overrides };
    if (!args.select) return row;
    return Object.fromEntries(
      Object.keys(args.select).filter((k) => k in row).map((k) => [k, row[k]])
    );
  });
}

// createMany.count = 0 → đã là thành viên từ trước.
function mockJoin({ memberCount = 1 } = {}) {
  const createMany = stubMethod(prisma.eventMember, 'createMany', async () => ({ count: memberCount }));
  const attendance = stubMethod(prisma.attendance, 'createMany', async () => ({ count: memberCount }));
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));
  return { createMany, attendance };
}

function mockEmailOk() {
  return stubMethod(emailService, 'sendEventRegistrationEmail', async () => {});
}

function form(overrides = {}) {
  return { name: 'Nguyễn Văn A', mssv: 'SE170001', email: 'a@fpt.edu.vn', ...overrides };
}

const post = (body) => request(app).post('/api/public/events/evt-1/register').send(form(body));

afterEach(() => restoreStubs());

// ── Tạo tài khoản mới ──────────────────────────────────────────

test('người chưa có trong hệ thống được tạo tài khoản mới và thêm vào danh sách', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => []);
  const createUser = stubMethod(prisma.user, 'create', async ({ data }) => ({
    id: 'u-new', email: data.email, mssv: data.mssv, name: data.name, isActive: true,
  }));
  const { createMany, attendance } = mockJoin();
  const sendMail = mockEmailOk();

  const res = await post();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.isNewAccount, true);
  assert.strictEqual(res.body.alreadyRegistered, false);
  assert.strictEqual(res.body.data.user.email, 'a@fpt.edu.vn');

  // Tài khoản mới: STUDENT, buộc đổi mật khẩu, có hash chứ không lưu mật khẩu thô.
  const created = createUser.calls[0][0].data;
  assert.strictEqual(created.role, 'STUDENT');
  assert.strictEqual(created.isFirstLogin, true);
  assert.ok(created.passwordHash && created.passwordHash.startsWith('$2'));
  assert.ok(!('password' in created));

  // Được ghi vào danh sách tham gia + có bản ghi điểm danh REGISTERED.
  assert.deepStrictEqual(createMany.calls[0][0].data, [{ eventId: 'evt-1', userId: 'u-new' }]);
  assert.strictEqual(createMany.calls[0][0].skipDuplicates, true);
  assert.deepStrictEqual(attendance.calls[0][0].data, [{ eventId: 'evt-1', userId: 'u-new', status: 'REGISTERED' }]);
  assert.strictEqual(attendance.calls[0][0].skipDuplicates, true);

  // Mật khẩu tạm chỉ đi qua email, không trả về response.
  assert.ok(sendMail.calls[0][3].tempPassword);
  assert.ok(!JSON.stringify(res.body).includes(sendMail.calls[0][3].tempPassword));
});

test('email/mssv được chuẩn hoá trước khi lưu', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => []);
  const createUser = stubMethod(prisma.user, 'create', async ({ data }) => ({
    id: 'u-new', email: data.email, mssv: data.mssv, name: data.name, isActive: true,
  }));
  mockJoin();
  mockEmailOk();

  await post({ email: '  A@FPT.EDU.VN ', mssv: ' se170001 ', name: '  Nguyễn   Văn A ' });

  const created = createUser.calls[0][0].data;
  assert.strictEqual(created.email, 'a@fpt.edu.vn');
  assert.strictEqual(created.mssv, 'SE170001');
  assert.strictEqual(created.name, 'Nguyễn Văn A');
});

test('gửi email lỗi vẫn giữ đăng ký, chỉ báo emailSent=false', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => []);
  stubMethod(prisma.user, 'create', async () => ({ id: 'u-new', email: 'a@fpt.edu.vn', mssv: 'SE170001', name: 'A', isActive: true }));
  const { createMany } = mockJoin();
  stubMethod(emailService, 'sendEventRegistrationEmail', async () => { throw new Error('brevo down'); });

  const res = await post();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.emailSent, false);
  assert.strictEqual(createMany.calls.length, 1);
});

// ── Tài khoản đã tồn tại ───────────────────────────────────────

test('người đã có tài khoản thì dùng lại, không tạo user mới', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', email: 'a@fpt.edu.vn', mssv: 'SE170001', name: 'Nguyễn Văn A', isActive: true },
  ]);
  stubMethod(prisma.user, 'create', async () => { throw new Error('user.create must not be called'); });
  const { createMany } = mockJoin();
  const sendMail = mockEmailOk();

  const res = await post();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.isNewAccount, false);
  assert.strictEqual(createMany.calls[0][0].data[0].userId, 'u-1');
  assert.strictEqual(sendMail.calls[0][3].tempPassword, null);
});

test('đăng ký lại sự kiện đã tham gia trả về alreadyRegistered', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', email: 'a@fpt.edu.vn', mssv: 'SE170001', name: 'A', isActive: true },
  ]);
  mockJoin({ memberCount: 0 });
  mockEmailOk();

  const res = await post();

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.alreadyRegistered, true);
});

test('tài khoản chưa có MSSV thì được bổ sung, không ghi đè tên sẵn có', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', email: 'a@fpt.edu.vn', mssv: null, name: 'Tên Cũ', isActive: true },
  ]);
  const update = stubMethod(prisma.user, 'update', async () => ({
    id: 'u-1', email: 'a@fpt.edu.vn', mssv: 'SE170001', name: 'Tên Cũ', isActive: true,
  }));
  mockJoin();
  mockEmailOk();

  const res = await post();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(update.calls[0][0].data.mssv, 'SE170001');
  assert.ok(!('name' in update.calls[0][0].data));
  assert.strictEqual(res.body.data.user.name, 'Tên Cũ');
});

test('email đã gắn với MSSV khác bị chặn 409', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', email: 'a@fpt.edu.vn', mssv: 'SE999999', name: 'A', isActive: true },
  ]);
  const { createMany } = mockJoin();

  const res = await post();

  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(createMany.calls.length, 0);
});

test('MSSV đã gắn với email khác bị chặn 409', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', email: 'khac@fpt.edu.vn', mssv: 'SE170001', name: 'A', isActive: true },
  ]);
  const { createMany } = mockJoin();

  const res = await post();

  assert.strictEqual(res.status, 409);
  assert.strictEqual(createMany.calls.length, 0);
});

test('email và MSSV trỏ về hai tài khoản khác nhau bị chặn 409', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', email: 'a@fpt.edu.vn', mssv: 'SE111111', name: 'A', isActive: true },
    { id: 'u-2', email: 'b@fpt.edu.vn', mssv: 'SE170001', name: 'B', isActive: true },
  ]);
  const { createMany } = mockJoin();

  const res = await post();

  assert.strictEqual(res.status, 409);
  assert.strictEqual(createMany.calls.length, 0);
});

test('tài khoản bị khoá không đăng ký được', async () => {
  mockEvent();
  stubMethod(prisma.user, 'findMany', async () => [
    { id: 'u-1', email: 'a@fpt.edu.vn', mssv: 'SE170001', name: 'A', isActive: false },
  ]);
  const { createMany } = mockJoin();

  const res = await post();

  assert.strictEqual(res.status, 403);
  assert.strictEqual(createMany.calls.length, 0);
});

// ── Validate đầu vào & trạng thái sự kiện ──────────────────────

test('thiếu hoặc sai thông tin bắt buộc trả 400 và không đụng tới DB', async () => {
  for (const body of [{ name: '' }, { name: 'A' }, { mssv: '' }, { email: 'khong-phai-email' }]) {
    mockEvent();
    stubMethod(prisma.user, 'findMany', async () => { throw new Error('không được truy vấn user'); });
    const { createMany } = mockJoin();

    const res = await post(body);

    assert.strictEqual(res.status, 400, `body=${JSON.stringify(body)}`);
    assert.strictEqual(createMany.calls.length, 0);
    restoreStubs();
  }
});

test('sự kiện tắt cho phép đăng ký trả 400', async () => {
  mockEvent({ allowRegistration: false });
  const { createMany } = mockJoin();

  const res = await post();

  assert.strictEqual(res.status, 400);
  assert.strictEqual(createMany.calls.length, 0);
});

test('sự kiện đã đóng cổng check-in không nhận đăng ký', async () => {
  mockEvent({
    checkinOpen: new Date(Date.now() - 3 * HOUR),
    checkinClose: new Date(Date.now() - HOUR),
  });
  const { createMany } = mockJoin();

  const res = await post();

  assert.strictEqual(res.status, 400);
  assert.strictEqual(createMany.calls.length, 0);
});

test('sự kiện không tồn tại trả 404', async () => {
  stubMethod(prisma.event, 'findFirst', async () => null);
  const { createMany } = mockJoin();

  const res = await post();

  assert.strictEqual(res.status, 404);
  assert.strictEqual(createMany.calls.length, 0);
});

// ── Endpoint công khai đọc sự kiện ─────────────────────────────

test('chi tiết sự kiện công khai không lộ toạ độ geofence', async () => {
  const findFirst = mockEvent();
  const res = await request(app).get('/api/public/events/evt-1');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.name, 'Workshop AI');
  assert.strictEqual(res.body.data.registrationClosed, false);
  // Toạ độ không nằm trong select nên không thể lọt ra ngoài.
  const selected = findFirst.calls[0][0].select;
  for (const field of ['lat', 'lng', 'radius']) {
    assert.ok(!(field in selected), `${field} không được select`);
  }
  assert.strictEqual(res.body.data.lat, undefined);
});

test('danh sách công khai chỉ lấy sự kiện đang mở đăng ký và chưa đóng cổng', async () => {
  const findMany = stubMethod(prisma.event, 'findMany', async () => []);
  const res = await request(app).get('/api/public/events');

  assert.strictEqual(res.status, 200);
  const where = findMany.calls[0][0].where;
  assert.strictEqual(where.isActive, true);
  assert.strictEqual(where.allowRegistration, true);
  // checkinClose là tuỳ chọn — sự kiện chưa đặt hạn (null) vẫn phải được liệt kê.
  assert.deepStrictEqual(where.OR[0], { checkinClose: null });
  assert.ok(where.OR[1].checkinClose.gte instanceof Date);
});

test('sự kiện không đặt hạn đăng ký (checkinClose null) vẫn coi là đang mở', async () => {
  mockEvent({ checkinClose: null, allowRegistration: true });
  stubMethod(prisma.user, 'findMany', async () => []);
  stubMethod(prisma.user, 'create', async () => ({ id: 'u-new', email: 'a@fpt.edu.vn', mssv: 'SE170001', name: 'A', isActive: true }));
  const { createMany } = mockJoin();
  mockEmailOk();

  const res = await post();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(createMany.calls.length, 1);
});

// ── Tự đăng ký khi đã đăng nhập ────────────────────────────────

test('người đã đăng nhập tự đăng ký bằng chính tài khoản của mình', async () => {
  const token = jwt.sign({ userId: 'student-1' }, process.env.JWT_SECRET);
  stubMethod(prisma.user, 'findUnique', async () => ({
    id: 'student-1', mssv: 'SE170001', email: 'a@fpt.edu.vn', name: 'A', role: 'STUDENT', isActive: true, isFirstLogin: false,
  }));
  mockEvent();
  const { createMany } = mockJoin();

  const res = await request(app)
    .post('/api/events/evt-1/register')
    .set('Authorization', `Bearer ${token}`)
    .send({});

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(createMany.calls[0][0].data[0].userId, 'student-1');
});

test('tự đăng ký khi chưa đăng nhập bị chặn 401', async () => {
  const res = await request(app).post('/api/events/evt-1/register').send({});
  assert.strictEqual(res.status, 401);
});
