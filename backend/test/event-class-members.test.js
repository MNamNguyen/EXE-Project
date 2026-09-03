const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { stubMethod, restoreStubs } = require('../testenv');

const btcToken = jwt.sign({ userId: 'btc-1' }, process.env.JWT_SECRET);
const otherBtcToken = jwt.sign({ userId: 'btc-2' }, process.env.JWT_SECRET);
const studentToken = jwt.sign({ userId: 'student-1' }, process.env.JWT_SECRET);

const USERS = {
  'btc-1': { id: 'btc-1', mssv: null, email: 'btc1@f.c', name: 'BTC Một', role: 'BTC', isActive: true, isFirstLogin: false },
  'btc-2': { id: 'btc-2', mssv: null, email: 'btc2@f.c', name: 'BTC Hai', role: 'BTC', isActive: true, isFirstLogin: false },
  'student-1': { id: 'student-1', mssv: 'SE1', email: 's@f.c', name: 'SV', role: 'STUDENT', isActive: true, isFirstLogin: false },
};

// Sự kiện thuộc về btc-1.
function mockAuthAndEvent() {
  stubMethod(prisma.user, 'findUnique', async ({ where }) => USERS[where.id] || null);
  stubMethod(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Buổi học', createdById: 'btc-1', isActive: true,
  }));
}

function mockJoin({ memberCount = 0 } = {}) {
  const members = stubMethod(prisma.eventMember, 'createMany', async () => ({ count: memberCount }));
  const attendance = stubMethod(prisma.attendance, 'createMany', async () => ({ count: memberCount }));
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));
  return { members, attendance };
}

const addByClass = (body, token = btcToken) =>
  request(app).post('/api/events/evt-1/members/by-class')
    .set('Authorization', `Bearer ${token}`).send(body);

afterEach(() => restoreStubs());

// ── Danh sách lớp ──────────────────────────────────────────────

test('danh sách lớp trả về sĩ số và số người còn thiếu trong sự kiện', async () => {
  mockAuthAndEvent();
  stubMethod(prisma.user, 'groupBy', async () => [
    { class: 'SE1701', _count: { _all: 30 } },
    { class: 'SE1702', _count: { _all: 25 } },
    { class: '  ', _count: { _all: 4 } },
  ]);
  stubMethod(prisma.eventMember, 'findMany', async () => [
    { user: { class: 'SE1701' } },
    { user: { class: 'SE1701' } },
    { user: { class: null } },
  ]);

  const res = await request(app).get('/api/events/evt-1/classes')
    .set('Authorization', `Bearer ${btcToken}`);

  assert.strictEqual(res.status, 200);
  // Lớp rỗng bị loại, không dựng thành một mục "lớp" giả.
  assert.deepStrictEqual(res.body.data, [
    { class: 'SE1701', total: 30, inEvent: 2, remaining: 28 },
    { class: 'SE1702', total: 25, inEvent: 0, remaining: 25 },
  ]);
});

test('danh sách lớp chỉ đếm sinh viên đang hoạt động', async () => {
  mockAuthAndEvent();
  const groupBy = stubMethod(prisma.user, 'groupBy', async () => []);
  stubMethod(prisma.eventMember, 'findMany', async () => []);

  await request(app).get('/api/events/evt-1/classes').set('Authorization', `Bearer ${btcToken}`);

  const where = groupBy.calls[0][0].where;
  assert.strictEqual(where.isActive, true);
  assert.strictEqual(where.role, 'STUDENT');
});

test('BTC khác không xem được danh sách lớp của sự kiện không phải của mình', async () => {
  mockAuthAndEvent();
  stubMethod(prisma.user, 'groupBy', async () => { throw new Error('không được truy vấn'); });

  const res = await request(app).get('/api/events/evt-1/classes')
    .set('Authorization', `Bearer ${otherBtcToken}`);

  assert.strictEqual(res.status, 403);
});

// ── Thêm cả lớp ────────────────────────────────────────────────

test('thêm cả lớp ghi cả EventMember lẫn bản ghi điểm danh REGISTERED', async () => {
  mockAuthAndEvent();
  stubMethod(prisma.user, 'findMany', async () => [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
  const { members, attendance } = mockJoin({ memberCount: 3 });

  const res = await addByClass({ classes: ['SE1701'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.added, 3);
  assert.strictEqual(res.body.skipped, 0);

  assert.deepStrictEqual(members.calls[0][0].data, [
    { eventId: 'evt-1', userId: 'u1' },
    { eventId: 'evt-1', userId: 'u2' },
    { eventId: 'evt-1', userId: 'u3' },
  ]);
  assert.strictEqual(members.calls[0][0].skipDuplicates, true);
  assert.deepStrictEqual(attendance.calls[0][0].data, [
    { eventId: 'evt-1', userId: 'u1', status: 'REGISTERED' },
    { eventId: 'evt-1', userId: 'u2', status: 'REGISTERED' },
    { eventId: 'evt-1', userId: 'u3', status: 'REGISTERED' },
  ]);
  assert.strictEqual(attendance.calls[0][0].skipDuplicates, true);
});

test('chỉ lấy sinh viên đang hoạt động của đúng các lớp đã chọn', async () => {
  mockAuthAndEvent();
  const findMany = stubMethod(prisma.user, 'findMany', async () => [{ id: 'u1' }]);
  mockJoin({ memberCount: 1 });

  await addByClass({ classes: ['SE1701', ' SE1702 ', 'SE1701', '', null] });

  const where = findMany.calls[0][0].where;
  assert.strictEqual(where.isActive, true);
  assert.strictEqual(where.role, 'STUDENT');
  // Trim, bỏ rỗng và loại trùng trước khi query.
  assert.deepStrictEqual(where.class.in, ['SE1701', 'SE1702']);
});

test('người đã có trong danh sách được báo là bỏ qua, không nhân bản', async () => {
  mockAuthAndEvent();
  stubMethod(prisma.user, 'findMany', async () => [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
  mockJoin({ memberCount: 1 }); // chỉ 1 suất mới, 2 người đã có sẵn

  const res = await addByClass({ classes: ['SE1701'] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.added, 1);
  assert.strictEqual(res.body.skipped, 2);
  assert.strictEqual(res.body.matched, 3);
  assert.match(res.body.message, /đã có sẵn/);
});

test('nhận cả dạng class đơn lẻ ngoài mảng classes', async () => {
  mockAuthAndEvent();
  const findMany = stubMethod(prisma.user, 'findMany', async () => [{ id: 'u1' }]);
  mockJoin({ memberCount: 1 });

  const res = await addByClass({ class: 'SE1701' });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(findMany.calls[0][0].where.class.in, ['SE1701']);
});

test('không chọn lớp nào trả 400 và không đụng tới DB', async () => {
  mockAuthAndEvent();
  stubMethod(prisma.user, 'findMany', async () => { throw new Error('không được truy vấn'); });
  const { members } = mockJoin();

  for (const body of [{}, { classes: [] }, { classes: ['', '   '] }]) {
    const res = await addByClass(body);
    assert.strictEqual(res.status, 400, `body=${JSON.stringify(body)}`);
    assert.strictEqual(members.calls.length, 0);
  }
});

test('lớp không có sinh viên nào trả 404', async () => {
  mockAuthAndEvent();
  stubMethod(prisma.user, 'findMany', async () => []);
  const { members } = mockJoin();

  const res = await addByClass({ classes: ['SE9999'] });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(members.calls.length, 0);
});

test('BTC khác không thêm được lớp vào sự kiện không phải của mình', async () => {
  mockAuthAndEvent();
  stubMethod(prisma.user, 'findMany', async () => { throw new Error('không được truy vấn'); });
  const { members } = mockJoin();

  const res = await addByClass({ classes: ['SE1701'] }, otherBtcToken);

  assert.strictEqual(res.status, 403);
  assert.strictEqual(members.calls.length, 0);
});

test('sinh viên không được phép thêm lớp vào sự kiện', async () => {
  mockAuthAndEvent();
  const { members } = mockJoin();

  const res = await addByClass({ classes: ['SE1701'] }, studentToken);

  assert.strictEqual(res.status, 403);
  assert.strictEqual(members.calls.length, 0);
});

// ── Gỡ khỏi danh sách ──────────────────────────────────────────

test('gỡ thành viên xoá luôn suất đăng ký nhưng giữ lại lượt đã check-in', async () => {
  mockAuthAndEvent();
  const memberDelete = stubMethod(prisma.eventMember, 'deleteMany', async () => ({ count: 1 }));
  const attendanceDelete = stubMethod(prisma.attendance, 'deleteMany', async () => ({ count: 1 }));
  stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));

  const res = await request(app).delete('/api/events/evt-1/members/u1')
    .set('Authorization', `Bearer ${btcToken}`);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(memberDelete.calls[0][0].where, { eventId: 'evt-1', userId: 'u1' });
  // Chỉ xoá bản ghi REGISTERED — người đã check-in/out vẫn còn bằng chứng tham dự.
  assert.deepStrictEqual(attendanceDelete.calls[0][0].where, {
    eventId: 'evt-1', userId: 'u1', status: 'REGISTERED',
  });
});
