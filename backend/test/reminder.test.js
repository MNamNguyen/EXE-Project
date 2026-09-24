const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const emailService = require('../src/services/email.service');
const app = require('../src/app');
const { leadText } = require('../src/lib/eventReminder');
const { stubMethod, restoreStubs } = require('../testenv');

const USERS = {
  'btc-1': { id: 'btc-1', mssv: null, email: 'btc@f.c', name: 'BTC Một', role: 'BTC', isActive: true, isFirstLogin: false },
  'btc-2': { id: 'btc-2', mssv: null, email: 'btc2@f.c', name: 'BTC Hai', role: 'BTC', isActive: true, isFirstLogin: false },
};
const auth = (id) => `Bearer ${jwt.sign({ userId: id }, process.env.JWT_SECRET)}`;
const loginAs = () => stubMethod(prisma.user, 'findUnique', async ({ where }) => USERS[where.id] || null);

const HOUR = 3600e3;
const NOW = new Date('2026-10-01T03:00:00Z'); // 10:00 giờ VN
const RECIPIENTS = [
  { user: { id: 'u1', email: 'a@f.c', name: 'An' } },
  { user: { id: 'u2', email: 'b@f.c', name: 'Bình' } },
];

function scheduledEvent(overrides = {}) {
  return {
    id: 'evt-1', name: 'Hội thảo', location: 'A1', isActive: true, createdById: 'btc-1',
    checkinOpen: new Date(NOW.getTime() + 2 * HOUR),
    ...overrides,
  };
}

afterEach(() => restoreStubs());

// ── Nội dung email ──────────────────────────────────────────────

test('leadText: tính theo giờ thực tế và ngày theo lịch Việt Nam', () => {
  assert.strictEqual(leadText(new Date(NOW.getTime() + 45 * 60e3), NOW), 'sẽ bắt đầu sau 45 phút nữa');
  assert.strictEqual(leadText(new Date(NOW.getTime() + 3 * HOUR), NOW), 'sẽ bắt đầu sau 3 giờ nữa');
  // 10:00 VN hôm nay → 08:00 VN ngày mai (22 giờ nữa)
  assert.strictEqual(leadText(new Date(NOW.getTime() + 22 * HOUR), NOW), 'sẽ diễn ra vào ngày mai');
  assert.strictEqual(leadText(new Date(NOW.getTime() + 72 * HOUR), NOW), 'sẽ diễn ra sau 3 ngày nữa');
  assert.strictEqual(leadText(new Date(NOW.getTime() - HOUR), NOW), 'đang diễn ra');
  assert.strictEqual(leadText(null, NOW), null);
});

// ── Gửi nhắc ngay (BTC) ─────────────────────────────────────────

function manualStubs({ last = null, recipients = RECIPIENTS } = {}) {
  loginAs();
  stubMethod(prisma.event, 'findUnique', async () => scheduledEvent());
  stubMethod(prisma.eventReminder, 'findFirst', async () => last);
  stubMethod(prisma.eventMember, 'findMany', async () => recipients);
  const create = stubMethod(prisma.eventReminder, 'create', async ({ data }) => ({ id: 'rem-m', ...data }));
  const update = stubMethod(prisma.eventReminder, 'update', async () => ({}));
  const email = stubMethod(emailService, 'sendEventReminderEmail', async () => {});
  return { create, update, email };
}

test('gửi nhắc ngay: người không phải chủ sự kiện → 403', async () => {
  const { create } = manualStubs();
  const res = await request(app).post('/api/events/evt-1/reminders/send').set('Authorization', auth('btc-2')).send({});
  assert.strictEqual(res.status, 403);
  assert.strictEqual(create.calls.length, 0);
});

test('gửi nhắc ngay: trả 202 rồi gửi nền tới từng người kèm lời nhắn', async () => {
  const { create, update, email } = manualStubs();
  const res = await request(app).post('/api/events/evt-1/reminders/send').set('Authorization', auth('btc-1'))
    .send({ note: '  Nhớ mang thẻ sinh viên  ' });
  assert.strictEqual(res.status, 202);
  assert.strictEqual(res.body.data.recipientCount, 2);
  assert.deepStrictEqual(
    { note: create.calls[0][0].data.note, by: create.calls[0][0].data.triggeredById },
    { note: 'Nhớ mang thẻ sinh viên', by: 'btc-1' },
  );

  for (let i = 0; i < 20 && update.calls.length === 0; i++) await new Promise((r) => setImmediate(r));
  assert.strictEqual(email.calls.length, 2);
  assert.strictEqual(email.calls[0][3].note, 'Nhớ mang thẻ sinh viên');
  assert.strictEqual(update.calls[0][0].data.status, 'SENT');
});

test('gửi nhắc ngay: vừa gửi trong 30 phút → 429 REMINDER_COOLDOWN', async () => {
  const { create, email } = manualStubs({ last: { createdAt: new Date(Date.now() - 5 * 60e3) } });
  const res = await request(app).post('/api/events/evt-1/reminders/send').set('Authorization', auth('btc-1')).send({});
  assert.strictEqual(res.status, 429);
  assert.strictEqual(res.body.error, 'REMINDER_COOLDOWN');
  assert.strictEqual(create.calls.length, 0);
  assert.strictEqual(email.calls.length, 0);
});

test('gửi nhắc ngay: không còn ai để nhắc → 400 NO_RECIPIENTS', async () => {
  const { create } = manualStubs({ recipients: [] });
  const res = await request(app).post('/api/events/evt-1/reminders/send').set('Authorization', auth('btc-1')).send({});
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'NO_RECIPIENTS');
  assert.strictEqual(create.calls.length, 0);
});

test('người nhận: chỉ người đăng ký còn hoạt động và chưa check-in', async () => {
  const { update } = manualStubs();
  const findMany = prisma.eventMember.findMany;
  await request(app).post('/api/events/evt-1/reminders/send').set('Authorization', auth('btc-1')).send({});
  const where = findMany.calls[0][0].where;
  assert.strictEqual(where.eventId, 'evt-1');
  assert.strictEqual(where.user.isActive, true);
  assert.deepStrictEqual(where.user.attendances, { none: { eventId: 'evt-1', checkinTime: { not: null } } });
  // Đợi lượt gửi nền xong trước khi afterEach gỡ stub.
  for (let i = 0; i < 20 && update.calls.length === 0; i++) await new Promise((r) => setImmediate(r));
});

test('một email lỗi không chặn người khác, ghi lại số lỗi', async () => {
  const { update } = manualStubs();
  // Ghi đè stub email của manualStubs: người đầu tiên bị Brevo từ chối.
  const email = stubMethod(emailService, 'sendEventReminderEmail', async (to) => {
    if (to === 'a@f.c') throw new Error('Brevo 400');
  });
  await request(app).post('/api/events/evt-1/reminders/send').set('Authorization', auth('btc-1')).send({});
  for (let i = 0; i < 20 && update.calls.length === 0; i++) await new Promise((r) => setImmediate(r));
  assert.strictEqual(email.calls.length, 2);
  assert.strictEqual(update.calls[0][0].data.status, 'SENT');
  assert.strictEqual(update.calls[0][0].data.failedCount, 1);
});

test('GET nhắc lịch: số người nhận, nhật ký và thời gian chờ còn lại', async () => {
  loginAs();
  stubMethod(prisma.event, 'findUnique', async () => scheduledEvent());
  stubMethod(prisma.eventReminder, 'findMany', async () => [{ id: 'r1', status: 'SENT', recipientCount: 2, failedCount: 0 }]);
  stubMethod(prisma.eventMember, 'count', async () => 7);
  stubMethod(prisma.eventReminder, 'findFirst', async () => ({ createdAt: new Date(Date.now() - 10 * 60e3) }));
  const res = await request(app).get('/api/events/evt-1/reminders').set('Authorization', auth('btc-1'));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.recipientCount, 7);
  assert.strictEqual(res.body.data.history.length, 1);
  assert.ok(new Date(res.body.data.cooldownUntil) > new Date());
});
