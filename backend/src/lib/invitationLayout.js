const crypto = require('crypto');
const QRCode = require('qrcode');
const { FONTS, layoutField } = require('./certificateLayout');
const { fmtDate, fmtTime } = require('./datetime');

// Quy tắc bố cục thiệp mời — DÙNG CHUNG giữa PDF ở server (services/invitationPdf.js)
// và canvas ở trình duyệt (frontend/src/pages/certificates/invitationRender.js).
// Đổi ở đây thì đổi bên kia y hệt, nếu không bản xem trên web lệch với PDF tải về.
//
// Ô chữ (name/event/time/location) theo đúng quy tắc của chứng nhận — xem
// certificateLayout.js: toạ độ tỉ lệ 0–1, y là baseline, tự thu nhỏ khi dài.
// Ô "qr" là hình vuông: x, y là TÂM ô; size = cạnh theo tỉ lệ chiều rộng ảnh.

const TEXT_KEYS = ['name', 'event', 'time', 'location'];
const FIELD_KEYS = [...TEXT_KEYS, 'qr'];
const ALIGNS = ['left', 'center', 'right'];

const DEFAULT_FIELDS = [
  { key: 'name', enabled: true, x: 0.5, y: 0.36, size: 0.07, maxWidth: 0.8, font: 'script', color: '#1F2A44', align: 'center' },
  { key: 'event', enabled: true, x: 0.5, y: 0.46, size: 0.04, maxWidth: 0.84, font: 'sans-bold', color: '#1F2A44', align: 'center' },
  { key: 'time', enabled: true, x: 0.5, y: 0.53, size: 0.026, maxWidth: 0.8, font: 'sans', color: '#4B5563', align: 'center' },
  { key: 'location', enabled: true, x: 0.5, y: 0.58, size: 0.026, maxWidth: 0.8, font: 'sans', color: '#4B5563', align: 'center' },
  { key: 'qr', enabled: true, x: 0.5, y: 0.77, size: 0.3 },
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (v, d, lo, hi) => (Number.isFinite(Number(v)) ? clamp(Number(v), lo, hi) : d);

// Chuẩn hoá bố cục từ editor. Ô tên và ô QR luôn bật — thiệp không có tên khách
// hay không có mã để quét thì vô dụng.
function normalizeFields(input) {
  if (!Array.isArray(input)) return { error: 'Bố cục thiệp mời không hợp lệ' };
  const byKey = new Map(input.filter((f) => f && FIELD_KEYS.includes(f.key)).map((f) => [f.key, f]));

  const value = DEFAULT_FIELDS.map((def) => {
    const f = byKey.get(def.key) || def;
    if (def.key === 'qr') {
      return { key: 'qr', enabled: true, x: num(f.x, def.x, 0, 1), y: num(f.y, def.y, 0, 1), size: num(f.size, def.size, 0.08, 0.6) };
    }
    return {
      key: def.key,
      enabled: def.key === 'name' ? true : f.enabled !== false,
      x: num(f.x, def.x, 0, 1),
      y: num(f.y, def.y, 0, 1),
      size: num(f.size, def.size, 0.004, 0.2),
      maxWidth: num(f.maxWidth, def.maxWidth, 0.05, 1),
      font: FONTS[f.font] ? f.font : def.font,
      color: /^#[0-9a-fA-F]{6}$/.test(f.color || '') ? f.color.toUpperCase() : def.color,
      align: ALIGNS.includes(f.align) ? f.align : def.align,
    };
  });
  return { value };
}

// "14:30 · Thứ Ba, 20/10/2026"
function invitationTime(date) {
  return `${fmtTime(date)} · ${fmtDate(date, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

// Chuỗi in trên thiệp. Server tính sẵn và gửi cho trình duyệt để hai nơi in đúng
// cùng một chuỗi (giờ theo giờ VN — xem lib/datetime.js).
function invitationValues(guest, event) {
  return {
    name: guest.name,
    event: event?.name || '',
    time: event?.startsAt ? invitationTime(event.startsAt) : '',
    location: event?.location || '',
  };
}

// Vị trí ô QR trên khung W×H (gốc toạ độ góc TRÊN-trái).
function layoutQr(field, W, H) {
  const side = field.size * W;
  return { left: field.x * W - side / 2, top: field.y * H - side / 2, side };
}

// Lề trắng quanh mã (tính theo số ô). Chuẩn khuyến nghị 4 ô, nhưng thiệp in trên
// nền màu nên chính lề trắng này tách mã khỏi nền — 2 ô là đủ cho camera điện thoại.
const QR_QUIET_MODULES = 2;

// Ma trận QR: { size, dark(row, col) }. Mức sửa lỗi M — thiệp in có thể bị gấp, bẩn.
function qrMatrix(text) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, dark: (r, c) => Boolean(modules.get(r, c)) };
}

// QR trên thiệp mang link trang xem thiệp — khách tự quét thì mở được thiệp của
// mình; trang quét của BTC tách lấy mã từ link (xem extractGuestCode).
function invitationUrl(code) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/thiep/${code}`;
}

const CODE_RE = /^[A-Za-z0-9_-]{16,64}$/;

// Nội dung camera đọc được → mã khách. Nhận cả link /thiep/<mã> (của bất kỳ tên
// miền nào — dev, preview, production) lẫn mã thô gõ tay.
function extractGuestCode(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const m = text.match(/\/thiep\/([A-Za-z0-9_-]+)/);
  const code = m ? m[1] : text;
  return CODE_RE.test(code) ? code : null;
}

// 15 byte ngẫu nhiên → 20 ký tự base64url: không đoán được, QR vẫn nhỏ gọn.
function generateGuestCode() {
  return crypto.randomBytes(15).toString('base64url');
}

module.exports = {
  TEXT_KEYS,
  FIELD_KEYS,
  DEFAULT_FIELDS,
  QR_QUIET_MODULES,
  normalizeFields,
  invitationValues,
  invitationTime,
  layoutField,
  layoutQr,
  qrMatrix,
  invitationUrl,
  extractGuestCode,
  generateGuestCode,
};
