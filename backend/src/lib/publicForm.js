const crypto = require('crypto');
const { normalizePhone } = require('./guestCheckin');

// Form check-in của sự kiện công khai (Event.publicForm) — BTC tự dựng, lưu dạng JSON
// nên DB không ràng buộc gì: mọi đường ghi form và mọi lượt gửi form PHẢI đi qua đây.
//   publicForm = { fields: [Field], thankYou: string }
//   Field = { id, type, label, required, unique, options? }
// Họ tên KHÔNG nằm trong fields — luôn có và bắt buộc (danh sách, báo cáo, màn chào cần tên).
// Spec: docs/superpowers/specs/2026-10-16-public-checkin-design.md

const FIELD_TYPES = ['TEXT', 'PHONE', 'EMAIL', 'SINGLE', 'MULTI'];
const CHOICE_TYPES = ['SINGLE', 'MULTI'];
// Chống trùng chỉ có nghĩa với giá trị định danh được một người — không phải lựa chọn.
const UNIQUE_TYPES = ['TEXT', 'PHONE', 'EMAIL'];
const MAX_FIELDS = 20;
const MAX_LABEL = 200;
const MAX_OPTIONS = 30;
const MAX_OPTION = 100;
const MAX_TEXT = 500;
const MAX_NAME = 120;
const MAX_THANK_YOU = 500;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_THANK_YOU = 'Cảm ơn bạn đã ghé thăm! Chúc bạn có trải nghiệm vui vẻ.';

// Form mặc định khi tạo sự kiện: chỉ thêm SĐT (bắt buộc, chống trùng) cạnh Họ tên.
function defaultPublicForm() {
  return {
    fields: [{ id: 'f_phone', type: 'PHONE', label: 'Số điện thoại', required: true, unique: true }],
    thankYou: DEFAULT_THANK_YOU,
  };
}

const newFieldId = () => `f_${crypto.randomBytes(4).toString('hex')}`;

function normalizeFields(input) {
  if (!Array.isArray(input)) return { error: 'Danh sách trường không hợp lệ' };
  if (input.length > MAX_FIELDS) return { error: `Form tối đa ${MAX_FIELDS} trường (không tính Họ tên)` };

  const seen = new Set();
  const value = [];
  for (let i = 0; i < input.length; i++) {
    const f = input[i] || {};
    const n = i + 1;
    const type = typeof f.type === 'string' ? f.type.toUpperCase() : '';
    if (!FIELD_TYPES.includes(type)) return { error: `Trường ${n}: loại trường không hợp lệ` };
    const label = typeof f.label === 'string' ? f.label.trim().replace(/\s+/g, ' ') : '';
    if (!label) return { error: `Trường ${n}: chưa nhập tên trường` };
    if (label.length > MAX_LABEL) return { error: `Trường ${n}: tên tối đa ${MAX_LABEL} ký tự` };

    let id = typeof f.id === 'string' && ID_RE.test(f.id) && !seen.has(f.id) ? f.id : null;
    while (!id || seen.has(id)) id = newFieldId();
    seen.add(id);

    const field = { id, type, label, required: f.required !== false, unique: UNIQUE_TYPES.includes(type) && f.unique === true };

    if (CHOICE_TYPES.includes(type)) {
      const raw = Array.isArray(f.options) ? f.options : [];
      const options = [...new Set(raw.map((o) => (typeof o === 'string' ? o.trim().replace(/\s+/g, ' ') : '')).filter(Boolean))];
      if (options.length < 2) return { error: `Trường ${n} (${label}): cần ít nhất 2 lựa chọn` };
      if (options.length > MAX_OPTIONS) return { error: `Trường ${n} (${label}): tối đa ${MAX_OPTIONS} lựa chọn` };
      if (options.some((o) => o.length > MAX_OPTION)) return { error: `Trường ${n} (${label}): mỗi lựa chọn tối đa ${MAX_OPTION} ký tự` };
      field.options = options;
    }
    value.push(field);
  }
  return { value };
}

function normalizeThankYou(input) {
  const t = typeof input === 'string' ? input.trim() : '';
  if (t.length > MAX_THANK_YOU) return { error: `Lời cảm ơn tối đa ${MAX_THANK_YOU} ký tự` };
  return { value: t || DEFAULT_THANK_YOU };
}

// So sánh hai bộ trường khi form đã có dữ liệu: chỉ coi là "không đổi" nếu y hệt.
const sameFields = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// SĐT về một dạng để "+84 912…" và "0912…" là cùng một người.
function canonicalPhone(phone) {
  const p = normalizePhone(phone);
  if (!p) return null;
  return p.startsWith('+84') ? `0${p.slice(3)}` : p;
}

// Giá trị dùng làm khoá chống trùng — không phân biệt hoa thường, khoảng trắng thừa.
function dedupeValue(field, value) {
  if (field.type === 'PHONE') return canonicalPhone(value);
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

// Kiểm tra một lượt gửi form theo đúng bộ trường. Khoá lạ bị bỏ qua, trường không
// bắt buộc bỏ trống thì không lưu. Trả { value: { name, answers, phone, email, keys } }
// hoặc { error } (câu báo lỗi nhắc đúng tên trường để người điền sửa).
function validateSubmission(form, body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2) return { error: 'Vui lòng nhập họ tên' };
  if (name.length > MAX_NAME) return { error: `Họ tên tối đa ${MAX_NAME} ký tự` };

  const input = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {};
  const answers = {};
  const keys = [];
  let phone = null;
  let email = null;

  for (const f of form.fields) {
    const raw = input[f.id];
    const missing = () => (f.required ? { error: `Vui lòng điền "${f.label}"` } : null);

    if (f.type === 'MULTI') {
      const picked = Array.isArray(raw) ? [...new Set(raw.filter((o) => f.options.includes(o)))] : [];
      if (Array.isArray(raw) && raw.some((o) => !f.options.includes(o))) return { error: `"${f.label}": lựa chọn không hợp lệ` };
      if (!picked.length) { const e = missing(); if (e) return e; continue; }
      answers[f.id] = f.options.filter((o) => picked.includes(o)); // giữ thứ tự của form
      continue;
    }

    const text = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (!text) { const e = missing(); if (e) return e; continue; }
    if (text.length > MAX_TEXT) return { error: `"${f.label}" tối đa ${MAX_TEXT} ký tự` };

    let stored = text;
    if (f.type === 'SINGLE' && !f.options.includes(text)) return { error: `"${f.label}": lựa chọn không hợp lệ` };
    if (f.type === 'PHONE') {
      stored = canonicalPhone(text);
      if (!/^\+?\d{8,15}$/.test(stored)) return { error: `"${f.label}" không phải số điện thoại hợp lệ` };
      phone = phone || stored;
    }
    if (f.type === 'EMAIL') {
      stored = text.toLowerCase();
      if (!EMAIL_RE.test(stored) || stored.length > 200) return { error: `"${f.label}" không phải email hợp lệ` };
      // Cột email có unique theo sự kiện — chỉ ghi vào cột khi chính trường này chống trùng,
      // nếu không hai người dùng chung email (gia đình, công ty) sẽ bị chặn nhầm.
      if (f.unique) email = email || stored;
    }
    answers[f.id] = stored;
    if (f.unique) keys.push(`${f.id}:${dedupeValue(f, stored)}`);
  }

  return { value: { name, answers, phone, email, keys } };
}

// Trường "chống trùng" chuỗi để hiện cho người điền ("Mỗi SĐT chỉ check-in một lần").
const uniqueLabels = (form) => form.fields.filter((f) => f.unique).map((f) => f.label);

// Form đọc từ DB có thể null (sự kiện tạo trước khi có cột) — luôn trả form hợp lệ.
function readPublicForm(event) {
  const pf = event.publicForm;
  if (!pf || !Array.isArray(pf.fields)) return defaultPublicForm();
  return { fields: pf.fields, thankYou: pf.thankYou || DEFAULT_THANK_YOU };
}

module.exports = {
  FIELD_TYPES,
  DEFAULT_THANK_YOU,
  defaultPublicForm,
  normalizeFields,
  normalizeThankYou,
  sameFields,
  canonicalPhone,
  validateSubmission,
  uniqueLabels,
  readPublicForm,
};
