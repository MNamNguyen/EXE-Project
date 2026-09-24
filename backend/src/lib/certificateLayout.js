const crypto = require('crypto');
const { fmtDate } = require('./datetime');

// Quy tắc bố cục chứng nhận — DÙNG CHUNG giữa PDF ở server
// (services/certificatePdf.js) và canvas ở trình duyệt
// (frontend/src/pages/certificates/certRender.js). Đổi quy tắc ở đây thì đổi
// bên kia y hệt, nếu không bản xem trên web sẽ lệch với file PDF tải về.
//
// Mọi toạ độ/kích thước là TỈ LỆ theo ảnh mẫu (0–1), để cùng một bố cục đúng
// với mọi độ phân giải và với khổ trang PDF:
//   x        — điểm neo ngang (theo align: mép trái / giữa / mép phải của chữ)
//   y        — ĐƯỜNG CƠ SỞ (baseline) của dòng chữ, tính từ mép trên
//   size     — cỡ chữ = size × chiều rộng ảnh
//   maxWidth — chữ dài hơn maxWidth × chiều rộng thì tự thu nhỏ cho vừa (tên dài)

const FONTS = {
  sans: 'BeVietnamPro-Regular.ttf',
  'sans-bold': 'BeVietnamPro-Bold.ttf',
  serif: 'NoticiaText-Bold.ttf',
  script: 'GreatVibes-Regular.ttf',
};

const FIELD_KEYS = ['name', 'event', 'date', 'code'];
const ALIGNS = ['left', 'center', 'right'];

// Bố cục mặc định khi vừa upload ảnh — BTC kéo lại cho khớp thiết kế của mình.
const DEFAULT_FIELDS = [
  { key: 'name', enabled: true, x: 0.5, y: 0.52, size: 0.055, maxWidth: 0.8, font: 'script', color: '#1F2A44', align: 'center' },
  { key: 'event', enabled: true, x: 0.5, y: 0.63, size: 0.026, maxWidth: 0.8, font: 'sans-bold', color: '#1F2A44', align: 'center' },
  { key: 'date', enabled: true, x: 0.5, y: 0.7, size: 0.018, maxWidth: 0.6, font: 'sans', color: '#4B5563', align: 'center' },
  { key: 'code', enabled: true, x: 0.92, y: 0.92, size: 0.011, maxWidth: 0.4, font: 'sans', color: '#6B7280', align: 'right' },
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Chuẩn hoá bố cục từ editor. Thiếu ô nào thì lấy mặc định; ô "name" luôn bật —
// chứng nhận không có tên người nhận thì vô nghĩa.
function normalizeFields(input) {
  if (!Array.isArray(input)) return { error: 'Bố cục chứng nhận không hợp lệ' };
  const byKey = new Map(input.filter((f) => f && FIELD_KEYS.includes(f.key)).map((f) => [f.key, f]));

  const value = DEFAULT_FIELDS.map((def) => {
    const f = byKey.get(def.key) || def;
    const num = (v, d, lo, hi) => (Number.isFinite(Number(v)) ? clamp(Number(v), lo, hi) : d);
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

// Nội dung điền vào từng ô. Server tính sẵn và gửi cho trình duyệt để hai nơi
// in ra đúng cùng một chuỗi (ngày theo giờ VN — xem lib/datetime.js).
function certificateValues({ recipientName, code, issuedAt }, event) {
  const when = event?.checkinOpen || issuedAt || new Date();
  return {
    name: recipientName,
    event: event?.name || '',
    date: `Ngày ${fmtDate(when, { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    code: `Mã chứng nhận: ${code}`,
  };
}

// Vị trí vẽ một ô chữ trên khung rộng W, cao H (đơn vị bất kỳ, gốc toạ độ ở
// góc TRÊN-trái). measure(text, fontSize) trả chiều rộng chữ theo đúng font.
function layoutField(field, text, W, H, measure) {
  let fontSize = field.size * W;
  let width = measure(text, fontSize);
  const maxW = field.maxWidth * W;
  if (width > maxW && width > 0) {
    fontSize *= maxW / width;
    width = maxW;
  }
  const anchor = field.x * W;
  const left = field.align === 'center' ? anchor - width / 2 : field.align === 'right' ? anchor - width : anchor;
  return { left, baseline: field.y * H, fontSize, width };
}

// Mã in trên chứng nhận: không có 0/O/1/I để đọc qua điện thoại không nhầm.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCertificateCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `CN-${s.slice(0, 4)}-${s.slice(4)}`;
}

module.exports = {
  FONTS,
  FIELD_KEYS,
  DEFAULT_FIELDS,
  normalizeFields,
  certificateValues,
  layoutField,
  generateCertificateCode,
};
