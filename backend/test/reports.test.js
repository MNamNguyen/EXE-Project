const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { attachmentHeader, toAsciiFilename } = require('../src/lib/contentDisposition');
const { buildAttendanceHtmlReport } = require('../src/services/htmlReport.service');
const { fmtDateTime, fmtTime } = require('../src/lib/datetime');
const { stubMethod, restoreStubs } = require('../testenv');

const token = jwt.sign({ userId: 'btc-1' }, process.env.JWT_SECRET);
const BTC_USER = { id: 'btc-1', mssv: null, email: 'btc@b.c', name: 'BTC', role: 'BTC', isActive: true, isFirstLogin: false };

function mockOwnedEvent(overrides = {}) {
  stubMethod(prisma.event, 'findUnique', async () => ({
    id: 'evt-1', name: 'Hội thảo Công nghệ', location: 'Hội trường A1', createdById: 'btc-1',
    checkinOpen: new Date(), checkinClose: new Date(), ...overrides,
  }));
}

function attendanceRow(overrides = {}) {
  return {
    id: 'a1', checkinTime: null, checkoutTime: null,
    user: { mssv: 'SE1', name: 'Nguyễn Văn A', email: 'a@f.c', class: 'SE1701', faculty: null },
    ...overrides,
  };
}

afterEach(() => restoreStubs());

// ── Content-Disposition tiếng Việt (bug thật đã tìm thấy) ──────

test('header setHeader không ném lỗi với filename tiếng Việt có dấu', () => {
  // Trước khi vá: res.setHeader ném "Invalid character in header content" ngay
  // khi filename chứa ký tự có dấu — mọi lượt xuất báo cáo cho sự kiện tiếng
  // Việt (gần như 100% sự kiện thật) đều sập ở bước này.
  const header = attachmentHeader('diemdanh-Hội thảo Công nghệ', 'xlsx');
  assert.doesNotThrow(() => {
    const http = require('http');
    const srv = http.createServer((req, res) => { res.setHeader('Content-Disposition', header); res.end(); });
    srv.close();
  });
  assert.ok(/^[\x00-\x7F]*$/.test(header), 'toàn bộ header phải là ASCII thuần');
});

test('attachmentHeader giữ nguyên tên trong phần filename* mã hoá UTF-8', () => {
  const header = attachmentHeader('diemdanh-Hội thảo', 'xlsx');
  assert.match(header, /filename\*=UTF-8''diemdanh-H%E1%BB%99i%20th%E1%BA%A3o\.xlsx/);
});

test('toAsciiFilename bỏ dấu tiếng Việt bao gồm đ/ơ/ư', () => {
  assert.strictEqual(toAsciiFilename('Đăng ký Ươm mầm Sáng tạo'), 'Dang_ky_Uom_mam_Sang_tao');
});

test('exportAttendance: tên sự kiện có dấu không làm export sập (regression)', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent({ name: 'Hội thảo Công nghệ Đổi mới Sáng tạo' });
  stubMethod(prisma.attendance, 'findMany', async () => []);

  const res = await request(app).get('/api/reports/events/evt-1/export').set('Authorization', `Bearer ${token}`);

  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /spreadsheetml/);
  assert.ok(/^[\x00-\x7F]*$/.test(res.headers['content-disposition']));
});

// ── Xuất Excel: quyền truy cập ──────────────────────────────────

test('exportAttendance: không phải chủ sự kiện bị chặn 403', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent({ createdById: 'btc-khac' });

  const res = await request(app).get('/api/reports/events/evt-1/export').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

// ── Xuất HTML ────────────────────────────────────────────────────

test('exportAttendanceHtml: trả về file .html tự chứa, không phải JSON', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent();
  stubMethod(prisma.attendance, 'findMany', async () => []);

  const res = await request(app).get('/api/reports/events/evt-1/export-html').set('Authorization', `Bearer ${token}`);

  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(/^[\x00-\x7F]*$/.test(res.headers['content-disposition']));
  assert.match(res.text, /<!doctype html>/i);
  // Không tải CDN/script ngoài — file phải mở được offline.
  assert.ok(!/<script/i.test(res.text));
  assert.ok(!/https?:\/\//i.test(res.text.replace(/UTF-8/g, '')));
});

// `?view=1` là chế độ xem trực tiếp trên web: cùng HTML, chỉ khác disposition
// inline để trình duyệt/iframe hiển thị luôn thay vì tải file xuống.
test('exportAttendanceHtml?view=1: disposition inline, nội dung y như bản tải về', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent();
  stubMethod(prisma.attendance, 'findMany', async () => [attendanceRow({ checkinTime: new Date() })]);

  const view = await request(app).get('/api/reports/events/evt-1/export-html?view=1').set('Authorization', `Bearer ${token}`);

  assert.strictEqual(view.status, 200);
  assert.match(view.headers['content-type'], /text\/html/);
  assert.match(view.headers['content-disposition'], /^inline;/);
  assert.match(view.headers['content-disposition'], /filename="baocao-Hoi_thao_Cong_nghe\.html"/);
  assert.ok(/^[\x00-\x7F]*$/.test(view.headers['content-disposition']));
  assert.match(view.text, /Nguyễn Văn A/);
});

test('exportAttendanceHtml: không có ?view vẫn tải về (attachment)', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent();
  stubMethod(prisma.attendance, 'findMany', async () => []);

  const res = await request(app).get('/api/reports/events/evt-1/export-html').set('Authorization', `Bearer ${token}`);
  assert.match(res.headers['content-disposition'], /^attachment;/);
});

test('exportAttendanceHtml: không phải chủ sự kiện bị chặn 403', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent({ createdById: 'btc-khac' });

  const res = await request(app).get('/api/reports/events/evt-1/export-html').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

// ── Chia sẻ báo cáo qua link công khai ──────────────────────────

test('createReportShare: cấp link, bấm lần hai giữ nguyên token đã phát đi', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent();
  let updates = 0;
  stubMethod(prisma.event, 'update', async ({ data }) => { updates += 1; return { ...data }; });

  const first = await request(app).post('/api/reports/events/evt-1/share').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.data.shared, true);
  assert.match(first.body.data.url, /\/bao-cao\/[\w-]{20,}$/);
  assert.strictEqual(updates, 1);

  // Sự kiện đã có token → không ghi DB nữa, trả lại đúng link cũ.
  mockOwnedEvent({ reportShareToken: 'token-cu', reportSharedAt: new Date() });
  const second = await request(app).post('/api/reports/events/evt-1/share').set('Authorization', `Bearer ${token}`);
  assert.match(second.body.data.url, /\/bao-cao\/token-cu$/);
  assert.strictEqual(updates, 1, 'không cấp token mới khi đã chia sẻ');
});

test('createReportShare?rotate=1: cấp token mới cho link cũ bị lộ', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent({ reportShareToken: 'token-cu' });
  stubMethod(prisma.event, 'update', async ({ data }) => ({ ...data }));

  const res = await request(app).post('/api/reports/events/evt-1/share?rotate=1').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(!res.body.data.url.endsWith('/token-cu'));
});

test('revokeReportShare: xoá token, link cũ hết hiệu lực', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent({ reportShareToken: 'token-cu' });
  let written = null;
  stubMethod(prisma.event, 'update', async ({ data }) => { written = data; return { ...data }; });

  const res = await request(app).delete('/api/reports/events/evt-1/share').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(written.reportShareToken, null);
  assert.strictEqual(res.body.data.shared, false);
  assert.strictEqual(res.body.data.url, null);
});

test('share: không phải chủ sự kiện bị chặn 403', async () => {
  stubMethod(prisma.user, 'findUnique', async () => BTC_USER);
  mockOwnedEvent({ createdById: 'btc-khac' });

  const create = await request(app).post('/api/reports/events/evt-1/share').set('Authorization', `Bearer ${token}`);
  const revoke = await request(app).delete('/api/reports/events/evt-1/share').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(create.status, 403);
  assert.strictEqual(revoke.status, 403);
});

test('báo cáo chia sẻ xem được KHÔNG cần đăng nhập', async () => {
  stubMethod(prisma.event, 'findUnique', async ({ where }) => (
    where.reportShareToken === 'token-hop-le'
      ? { id: 'evt-1', name: 'Hội thảo Công nghệ', location: 'Hội trường A1', checkinOpen: new Date(), checkinClose: new Date() }
      : null
  ));
  stubMethod(prisma.attendance, 'findMany', async () => [attendanceRow({ checkinTime: new Date() })]);

  const res = await request(app).get('/api/public/reports/token-hop-le');

  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.headers['content-disposition'], /^inline;/);
  // Link lan rộng: proxy/CDN không được giữ bản cũ, thu hồi phải có hiệu lực ngay.
  assert.match(res.headers['cache-control'], /no-store/);
  assert.match(res.text, /Nguyễn Văn A/);
});

test('token sai hoặc đã thu hồi trả 404 SHARE_NOT_FOUND', async () => {
  stubMethod(prisma.event, 'findUnique', async () => null);

  const res = await request(app).get('/api/public/reports/token-da-thu-hoi');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error, 'SHARE_NOT_FOUND');
});

// ── Múi giờ (bug thật: Render chạy UTC) ─────────────────────────

test('giờ trong báo cáo in theo giờ VN, không theo TZ của máy chủ', () => {
  // Render (và mọi PaaS mặc định) chạy Node với TZ=UTC. Trước khi vá, một lượt
  // check-in 08:00 giờ VN hiện thành 01:00 trong báo cáo/email/Excel.
  const at = new Date('2026-09-18T01:00:00Z'); // = 08:00 giờ VN
  assert.strictEqual(fmtTime(at), '08:00');
  assert.match(fmtDateTime(at), /08:00/);

  const html = buildAttendanceHtmlReport(
    { name: 'Sự kiện', location: 'Hall', checkinOpen: at, checkinClose: at },
    [attendanceRow({ checkinTime: at })],
  );
  assert.match(html, /08:00/);
  assert.ok(!html.includes('01:00'), 'không được in giờ UTC');
});

// ── buildAttendanceHtmlReport: nội dung báo cáo ─────────────────

test('người có checkinTime vào danh sách tham gia, không có thì vào danh sách vắng', () => {
  const event = { name: 'Sự kiện', location: 'Hall', checkinOpen: new Date(), checkinClose: new Date() };
  const attendances = [
    attendanceRow({ checkinTime: new Date(), checkoutTime: new Date(), user: { mssv: 'SE1', name: 'An', email: 'an@f.c', class: 'A1' } }),
    attendanceRow({ checkinTime: new Date(), checkoutTime: null, user: { mssv: 'SE2', name: 'Bình', email: 'binh@f.c', class: 'A1' } }),
    attendanceRow({ checkinTime: null, checkoutTime: null, user: { mssv: 'SE3', name: 'Chi', email: 'chi@f.c', class: 'A1' } }),
  ];

  const html = buildAttendanceHtmlReport(event, attendances);

  assert.match(html, /Danh sách tham gia/);
  assert.match(html, /Danh sách vắng/);
  assert.match(html, /An/);
  assert.match(html, /Bình/);
  assert.match(html, /Chi/);
  // Thống kê đúng: 2 tham gia (1 đã check-out, 1 chưa), 1 vắng.
  const statMatches = [...html.matchAll(/<div class="n">(\d+)<\/div>/g)].map((m) => Number(m[1]));
  assert.deepStrictEqual(statMatches, [3, 2, 1, 1]); // total, đã điểm danh, đã check-out, vắng
});

test('event chưa đặt lịch hiển thị ghi chú điểm danh thủ công thay vì ngày giờ', () => {
  const event = { name: 'Buổi học tự do', location: 'Phòng A101', checkinOpen: null, checkinClose: null };
  const html = buildAttendanceHtmlReport(event, []);
  assert.match(html, /Điểm danh thủ công/);
});

test('tên/lớp/email sinh viên được escape để chống XSS trong báo cáo', () => {
  const event = { name: 'Sự kiện', location: 'Hall', checkinOpen: null, checkinClose: null };
  const attendances = [
    attendanceRow({ checkinTime: new Date(), user: { mssv: 'SE1', name: '<script>alert(1)</script>', email: 'a@f.c', class: 'A1' } }),
  ];
  const html = buildAttendanceHtmlReport(event, attendances);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('danh sách rỗng vẫn render báo cáo hợp lệ, không lỗi chia cho 0', () => {
  const event = { name: 'Sự kiện trống', location: 'Hall', checkinOpen: null, checkinClose: null };
  assert.doesNotThrow(() => buildAttendanceHtmlReport(event, []));
});
