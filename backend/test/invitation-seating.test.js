const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const {
  normalizeSeat, parseSeatList, normalizeSeatMap, invalidSeats, parseTicketCount, seatLabel,
} = require('../src/lib/seatMap');
const { normalizeGuestInput, guestStats } = require('../src/lib/guestCheckin');
const { generateGuestCode, invitationValues } = require('../src/lib/invitationLayout');
const { buildGuestHtmlReport } = require('../src/services/htmlReport.service');
const { stubMethod, restoreStubs } = require('../testenv');

// Nhiều vé trên một thiệp + sơ đồ ghế — docs/superpowers/specs/2026-10-18-invitation-seating-design.md

const BTC = { id: 'btc-1', mssv: null, email: 'btc@f.c', name: 'Trần BTC', role: 'BTC', isActive: true, isFirstLogin: false };
const auth = () => `Bearer ${jwt.sign({ userId: BTC.id }, process.env.JWT_SECRET)}`;
const loginAs = () => stubMethod(prisma.user, 'findUnique', async ({ where }) => (where.id === BTC.id ? BTC : null));

// Hội trường như file bán vé thật: hàng A–K, 16 ghế mỗi hàng.
const HALL = normalizeSeatMap({ rows: 'ABCDEFGHIJK'.split('').map((label) => ({ label, seats: 16 })) }).value;
const EVENT = {
  id: 'evt-1', name: 'Đêm nhạc', location: 'Nhà hát', kind: 'INVITATION', isActive: true,
  createdById: 'btc-1', startsAt: new Date('2026-10-20T12:00:00Z'), seatMap: HALL,
};
const stubEvent = (overrides = {}) => stubMethod(prisma.event, 'findUnique', async ({ where }) =>
  (where.id === EVENT.id ? { ...EVENT, ...overrides } : null));
const transactionRunsAll = () => stubMethod(prisma, '$transaction', async (ops) => Promise.all(ops));

const CODE = generateGuestCode();
const guest = (overrides = {}) => ({
  id: 'g-1', eventId: 'evt-1', name: 'Nguyễn Huỳnh Như', phone: null, email: null, code: CODE,
  isWalkIn: false, inviteStatus: 'PENDING', inviteSentAt: null, checkedInAt: null, checkedInBy: null,
  ticketCount: 1, seats: [], createdAt: new Date(), ...overrides,
});
const p2002 = () => Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['eventId', 'seat'] } });

afterEach(() => restoreStubs());

// ── Mã ghế / sơ đồ ──────────────────────────────────────────────

test('normalizeSeat / parseSeatList: chuẩn hoá, sắp xếp, bỏ trùng, nhận dải cùng hàng', () => {
  assert.strictEqual(normalizeSeat('e8'), 'E08');
  assert.strictEqual(normalizeSeat(' E 08 '), 'E08');
  assert.strictEqual(normalizeSeat('aa-3'), 'AA03');
  assert.strictEqual(normalizeSeat('E0'), null);
  assert.strictEqual(normalizeSeat('08'), null);

  assert.deepStrictEqual(parseSeatList('E09, e8; E08').value, ['E08', 'E09']);
  assert.deepStrictEqual(parseSeatList('F06-F10').value, ['F06', 'F07', 'F08', 'F09', 'F10']);
  assert.deepStrictEqual(parseSeatList('C06, C07, D05, D06, D07').value, ['C06', 'C07', 'D05', 'D06', 'D07']);
  assert.deepStrictEqual(parseSeatList(['B16', 'B15']).value, ['B15', 'B16']);
  assert.deepStrictEqual(parseSeatList('').value, []);
  assert.ok(parseSeatList('E08-F02').error);
  assert.ok(parseSeatList('ghế đầu').error);
});

test('normalizeSeatMap: kiểm hàng/số ghế, lọc lối đi và ghế bỏ về giá trị hợp lệ', () => {
  const { value } = normalizeSeatMap({
    rows: [{ label: 'a', seats: 10 }, { label: 'B', seats: 8 }],
    aisleAfter: [5, 5, 0, 10, 'x'],
    disabled: ['b8', 'B09', 'Z01'],
  });
  assert.deepStrictEqual(value, { rows: [{ label: 'A', seats: 10 }, { label: 'B', seats: 8 }], aisleAfter: [5], disabled: ['B08'] });
  assert.deepStrictEqual(invalidSeats(value, ['A10', 'B08', 'B09']), ['B08', 'B09']);

  assert.ok(normalizeSeatMap({ rows: [] }).error);
  assert.ok(normalizeSeatMap({ rows: [{ label: 'A', seats: 3 }, { label: 'a', seats: 3 }] }).error);
  assert.ok(normalizeSeatMap({ rows: [{ label: 'A1', seats: 3 }] }).error);
  assert.ok(normalizeSeatMap({ rows: [{ label: 'A', seats: 100 }] }).error);
  assert.ok(normalizeSeatMap(null).error);
});

test('số vé + ghế của khách: mặc định theo số ghế, không cho ít vé hơn ghế; chuỗi in trên thiệp', () => {
  assert.strictEqual(normalizeGuestInput({ name: 'An', seats: 'E08, E09' }).value.ticketCount, 2);
  assert.strictEqual(normalizeGuestInput({ name: 'An' }).value.ticketCount, undefined);
  assert.strictEqual(normalizeGuestInput({ name: 'An', ticketCount: '4', seats: 'E01' }).value.ticketCount, 4);
  assert.match(normalizeGuestInput({ name: 'An', ticketCount: 1, seats: 'E08, E09' }).error, /nhiều hơn số vé/);
  assert.ok(parseTicketCount('0').error);
  assert.ok(parseTicketCount('2.5').error);
  assert.ok(parseTicketCount('51').error);

  assert.strictEqual(seatLabel(guest({ ticketCount: 2, seats: [{ seat: 'E09' }, { seat: 'E08' }] })), 'Ghế E08, E09 · 2 vé');
  assert.strictEqual(seatLabel(guest({ ticketCount: 3 })), '3 vé');
  assert.strictEqual(seatLabel(guest()), '');
  assert.strictEqual(invitationValues(guest({ ticketCount: 1, seats: [{ seat: 'F15' }] }), EVENT).seat, 'Ghế F15');
});

// ── Thêm / sửa khách có ghế ─────────────────────────────────────

test('thêm khách nhiều vé có ghế: tạo khách + ghế trong một transaction', async () => {
  loginAs();
  stubEvent();
  stubMethod(prisma.eventGuest, 'findFirst', async () => null);
  transactionRunsAll();
  const create = stubMethod(prisma.eventGuest, 'create', async ({ data }) => data);
  const seats = stubMethod(prisma.eventGuestSeat, 'createMany', async ({ data }) => ({ count: data.length }));
  stubMethod(prisma.eventGuest, 'findUnique', async ({ where }) => guest({
    ...create.calls[0][0].data, id: where.id, seats: seats.calls[0][0].data.map(({ seat }) => ({ seat })),
  }));

  const res = await request(app).post('/api/events/evt-1/guests').set('Authorization', auth())
    .send({ name: 'Nguyễn Huỳnh Như ', ticketCount: 5, seats: 'F06-F10' });
  assert.strictEqual(res.status, 201);
  const id = create.calls[0][0].data.id;
  assert.strictEqual(create.calls[0][0].data.ticketCount, 5);
  assert.deepStrictEqual(seats.calls[0][0].data, ['F06', 'F07', 'F08', 'F09', 'F10'].map((seat) => ({ eventId: 'evt-1', guestId: id, seat })));
  assert.strictEqual(res.body.data.ticketCount, 5);
  assert.deepStrictEqual(res.body.data.seats, ['F06', 'F07', 'F08', 'F09', 'F10']);
});

test('gán trùng ghế → 409 SEAT_TAKEN nêu người đang giữ ghế; ghế ngoài sơ đồ / chưa có sơ đồ → 400', async () => {
  loginAs();
  stubEvent();
  stubMethod(prisma.eventGuest, 'findFirst', async () => null);
  stubMethod(prisma.eventGuest, 'create', async ({ data }) => data);
  stubMethod(prisma.eventGuestSeat, 'createMany', async () => ({ count: 1 }));
  stubMethod(prisma, '$transaction', async () => { throw p2002(); });
  stubMethod(prisma.eventGuestSeat, 'findMany', async () => [{ seat: 'E08', guest: { name: 'Nguyễn Ngọc Trúc Linh' } }]);

  const taken = await request(app).post('/api/events/evt-1/guests').set('Authorization', auth())
    .send({ name: 'Người khác', seats: 'E08' });
  assert.strictEqual(taken.status, 409);
  assert.strictEqual(taken.body.error, 'SEAT_TAKEN');
  assert.match(taken.body.message, /E08 đã thuộc Nguyễn Ngọc Trúc Linh/);

  const outside = await request(app).post('/api/events/evt-1/guests').set('Authorization', auth())
    .send({ name: 'Người khác', seats: 'L01' });
  assert.strictEqual(outside.status, 400);
  assert.strictEqual(outside.body.error, 'SEAT_NOT_IN_MAP');

  restoreStubs();
  loginAs();
  stubEvent({ seatMap: null });
  stubMethod(prisma.eventGuest, 'findFirst', async () => null);
  const noMap = await request(app).post('/api/events/evt-1/guests').set('Authorization', auth())
    .send({ name: 'Người khác', seats: 'E08' });
  assert.strictEqual(noMap.status, 400);
  assert.strictEqual(noMap.body.error, 'NO_SEAT_MAP');
});

test('gán ghế từ sơ đồ: thay danh sách ghế, không vượt số vé', async () => {
  loginAs();
  stubEvent();
  stubMethod(prisma.eventGuest, 'findFirst', async () => guest({ ticketCount: 2 }));
  transactionRunsAll();
  const del = stubMethod(prisma.eventGuestSeat, 'deleteMany', async () => ({ count: 1 }));
  const add = stubMethod(prisma.eventGuestSeat, 'createMany', async ({ data }) => ({ count: data.length }));
  stubMethod(prisma.eventGuest, 'findUnique', async () => guest({ ticketCount: 2, seats: [{ seat: 'G08' }, { seat: 'G09' }] }));

  const ok = await request(app).put('/api/events/evt-1/guests/g-1/seats').set('Authorization', auth())
    .send({ seats: ['g9', 'G08'] });
  assert.strictEqual(ok.status, 200);
  assert.deepStrictEqual(del.calls[0][0], { where: { guestId: 'g-1' } });
  assert.deepStrictEqual(add.calls[0][0].data.map((s) => s.seat), ['G08', 'G09']);
  assert.deepStrictEqual(ok.body.data.seats, ['G08', 'G09']);

  const tooMany = await request(app).put('/api/events/evt-1/guests/g-1/seats').set('Authorization', auth())
    .send({ seats: 'G08-G10' });
  assert.strictEqual(tooMany.status, 400);
  assert.strictEqual(tooMany.body.error, 'SEATS_EXCEED_TICKETS');
});

test('giảm số vé xuống dưới số ghế đang giữ → 400; đổi ghế → thiệp về chờ gửi lại', async () => {
  loginAs();
  stubEvent();
  stubMethod(prisma.eventGuest, 'findFirst', async ({ where }) => (where.id === 'g-1'
    ? guest({ ticketCount: 3, inviteStatus: 'SENT', seats: [{ seat: 'H07' }, { seat: 'H08' }, { seat: 'H09' }] })
    : null));
  stubMethod(prisma.eventGuestSeat, 'count', async () => 3);
  const shrink = await request(app).put('/api/events/evt-1/guests/g-1').set('Authorization', auth())
    .send({ name: 'Hà Ngọc Nhi', ticketCount: 2 });
  assert.strictEqual(shrink.status, 400);

  transactionRunsAll();
  stubMethod(prisma.eventGuestSeat, 'findMany', async () => [{ seat: 'H07' }, { seat: 'H08' }, { seat: 'H09' }]);
  stubMethod(prisma.eventGuestSeat, 'deleteMany', async () => ({ count: 3 }));
  stubMethod(prisma.eventGuestSeat, 'createMany', async () => ({ count: 2 }));
  const update = stubMethod(prisma.eventGuest, 'update', async ({ data }) => data);
  stubMethod(prisma.eventGuest, 'findUnique', async () => guest());
  const moved = await request(app).put('/api/events/evt-1/guests/g-1').set('Authorization', auth())
    .send({ name: 'Hà Ngọc Nhi', ticketCount: 2, seats: 'H08, H09' });
  assert.strictEqual(moved.status, 200);
  assert.strictEqual(update.calls[0][0].data.ticketCount, 2);
  assert.strictEqual(update.calls[0][0].data.inviteStatus, 'PENDING');
});

test('lưu sơ đồ: thu nhỏ làm mất ghế đang có khách → 409 SEAT_IN_USE; hợp lệ thì lưu bản đã chuẩn hoá', async () => {
  loginAs();
  stubEvent();
  stubMethod(prisma.eventGuestSeat, 'findMany', async () => [{ seat: 'K06' }, { seat: 'B16' }]);
  const save = stubMethod(prisma.event, 'update', async ({ data }) => data);

  const shrink = await request(app).put('/api/events/evt-1/seat-map').set('Authorization', auth())
    .send({ seatMap: { rows: 'ABCDEFGHIJ'.split('').map((label) => ({ label, seats: 15 })) } });
  assert.strictEqual(shrink.status, 409);
  assert.strictEqual(shrink.body.error, 'SEAT_IN_USE');
  assert.deepStrictEqual(shrink.body.seats, ['B16', 'K06']);

  const disable = await request(app).put('/api/events/evt-1/seat-map').set('Authorization', auth())
    .send({ seatMap: { ...HALL, disabled: ['K06'] } });
  assert.strictEqual(disable.status, 409);

  const removeAll = await request(app).put('/api/events/evt-1/seat-map').set('Authorization', auth()).send({ seatMap: null });
  assert.strictEqual(removeAll.status, 409);

  const ok = await request(app).put('/api/events/evt-1/seat-map').set('Authorization', auth())
    .send({ seatMap: { rows: [...HALL.rows, { label: 'l', seats: 20 }], aisleAfter: [8] } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(save.calls[0][0].data.seatMap.rows.at(-1).label, 'L');
  assert.deepStrictEqual(save.calls[0][0].data.seatMap.aisleAfter, [8]);
});

// ── Import file bán vé ──────────────────────────────────────────

test('import file bán vé: cột STT/SỐ LƯỢNG VÉ/GHẾ, dòng tổng, ghế trùng (trong file và đã gán) bị bỏ qua', async () => {
  loginAs();
  stubEvent();
  stubMethod(prisma.eventGuest, 'findMany', async () => []);
  stubMethod(prisma.eventGuestSeat, 'findMany', async () => [{ seat: 'J03', guest: { name: 'Phan Thị Thu An' } }]);
  transactionRunsAll();
  const guests = stubMethod(prisma.eventGuest, 'createMany', async ({ data }) => ({ count: data.length }));
  const seats = stubMethod(prisma.eventGuestSeat, 'createMany', async ({ data }) => ({ count: data.length }));

  const sheet = XLSX.utils.aoa_to_sheet([
    ['STT', 'HỌ VÀ TÊN', 'SỐ LƯỢNG VÉ', 'GHẾ'],
    [1, 'Nguyễn Ngọc Trúc Linh', 2, 'E08, E09'],
    [2, 'Nguyễn Huỳnh Như ', 5, 'F06, F07, F08, F09, F10'],
    [3, 'Trương Ngọc Khánh Linh', 1, 'F15'],
    [4, 'Người trùng ghế', 1, 'E09'],
    [5, 'Người trùng ghế cũ', 2, 'J03, J04'],
    [6, 'Ghế ngoài sơ đồ', 1, 'Z01'],
    [7, 'Ít vé hơn ghế', 1, 'K01, K02'],
    [8, 'Chưa xếp ghế', 3, ''],
    ['', '', 15, ''],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Trang tính1');

  const res = await request(app).post('/api/events/evt-1/guests/import').set('Authorization', auth())
    .attach('file', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), 've.xlsx');
  assert.strictEqual(res.status, 200);
  const created = guests.calls[0][0].data;
  assert.deepStrictEqual(created.map((g) => [g.name, g.ticketCount]), [
    ['Nguyễn Ngọc Trúc Linh', 2], ['Nguyễn Huỳnh Như', 5], ['Trương Ngọc Khánh Linh', 1], ['Chưa xếp ghế', 3],
  ]);
  const byGuest = (name) => seats.calls[0][0].data.filter((s) => s.guestId === created.find((g) => g.name === name).id).map((s) => s.seat);
  assert.deepStrictEqual(byGuest('Nguyễn Huỳnh Như'), ['F06', 'F07', 'F08', 'F09', 'F10']);
  assert.deepStrictEqual(byGuest('Chưa xếp ghế'), []);
  assert.deepStrictEqual(res.body.data.skipped.map((s) => s.row), [5, 6, 7, 8]);
  assert.match(res.body.data.skipped[0].reason, /E09 trùng với Nguyễn Ngọc Trúc Linh/);
  assert.match(res.body.data.skipped[1].reason, /J03 trùng với Phan Thị Thu An/);
  assert.strictEqual(res.body.data.tickets, 11);
});

// ── Quét / số liệu / báo cáo ────────────────────────────────────

test('quét thiệp nhiều vé: một lần cho cả nhóm, trả số vé + ghế để chỉ chỗ', async () => {
  loginAs();
  stubEvent();
  stubMethod(prisma.eventGuest, 'findUnique', async ({ where }) => (where.code === CODE
    ? guest({ ticketCount: 5, seats: [{ seat: 'F07' }, { seat: 'F06' }] })
    : null));
  const upd = stubMethod(prisma.eventGuest, 'updateMany', async () => ({ count: 1 }));

  const res = await request(app).post('/api/events/evt-1/guests/scan').set('Authorization', auth())
    .send({ code: `https://x.vn/thiep/${CODE}` });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(upd.calls.length, 1);
  assert.strictEqual(res.body.guest.ticketCount, 5);
  assert.deepStrictEqual(res.body.guest.seats, ['F06', 'F07']);
  assert.match(res.body.message, /Ghế F06, F07 · 5 vé/);
});

test('guestStats cộng số người theo vé; báo cáo HTML đếm theo người', async () => {
  stubMethod(prisma.eventGuest, 'count', async () => 2);
  stubMethod(prisma.eventGuestSeat, 'count', async () => 7);
  stubMethod(prisma.eventGuest, 'aggregate', async ({ where }) => ({
    _sum: { ticketCount: where.isWalkIn ? 2 : where.checkedInAt ? 5 : 9 },
  }));
  const stats = await guestStats('evt-1');
  assert.strictEqual(stats.tickets, 9);
  assert.strictEqual(stats.ticketsCheckedIn, 5);
  assert.strictEqual(stats.invitedTickets, 7);
  assert.strictEqual(stats.seatsAssigned, 7);

  const html = buildGuestHtmlReport(EVENT, [
    guest({ id: 'a', name: 'Nhóm Như', ticketCount: 5, seats: [{ seat: 'F06' }], checkedInAt: new Date() }),
    guest({ id: 'b', name: 'Nhóm Linh', ticketCount: 2 }),
  ]);
  assert.match(html, /<div class="n">7<\/div><div class="l">Khách được mời \(2 thiệp\)/);
  assert.match(html, /Đã có mặt <span class="badge green">5 người/);
  assert.match(html, /F06/);
});
