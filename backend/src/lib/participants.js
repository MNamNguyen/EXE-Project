const XLSX = require('xlsx');
const prisma = require('./prisma');
const { addUsersToEvent } = require('./eventMembership');
const { toAsciiFilename } = require('./contentDisposition');

// ─────────────────────────────────────────────────────────────────────────────
// Người tham gia (spec 2026-11-07-participant-lists-design.md)
//
// Từ 2026-11-07 người tham gia KHÔNG có tài khoản đăng nhập: BTC nhập danh sách
// (email + họ tên, MSSV tuỳ chọn) vào từng sự kiện / lớp, họ check-in bằng QR +
// OTP email hoặc khuôn mặt. Phía sau mỗi email vẫn là MỘT bản ghi User dùng chung
// cho mọi sự kiện (role STUDENT — giữ tên enum cũ để khỏi đụng dữ liệu/báo cáo),
// nhờ vậy điểm danh, báo cáo, chứng nhận, đánh giá, khuôn mặt chạy nguyên như cũ.
//
// Hệ quả của "dùng chung theo email" (product owner chấp nhận): nhập lại một email
// đã có thì GIỮ tên/MSSV cũ — không cho một BTC âm thầm sửa dữ liệu mà sự kiện của
// BTC khác đang dùng; chỉ bổ sung trường còn trống.
// ─────────────────────────────────────────────────────────────────────────────

const PARTICIPANT_ROLE = 'STUDENT';
// Không phải chuỗi bcrypt nên bcrypt.compare luôn false — người tham gia không thể
// đăng nhập bằng mật khẩu dù ai đó gõ đúng email. Mọi đường đăng nhập còn chặn
// thêm theo role (auth.controller, middleware/auth.js).
const NO_PASSWORD = '!';
const MAX_ROWS = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());

function normalizeRow(raw = {}) {
  return {
    email: str(raw.email).toLowerCase(),
    name: str(raw.name).replace(/\s+/g, ' '),
    mssv: str(raw.mssv).toUpperCase(),
    phone: str(raw.phone),
  };
}

// Kiểm từng dòng và bỏ trùng email trong cùng một lần nhập.
// line = số thứ tự dòng (bắt đầu 1) để BTC dò lại trong file.
function validateRows(input, { firstLine = 1 } = {}) {
  const rows = [];
  const skipped = [];
  const seenEmail = new Set();
  const seenMssv = new Set();

  input.forEach((raw, i) => {
    // Dòng từ file mang sẵn số dòng thật (parseSheet) vì tiêu đề có thể không ở dòng 1.
    const line = raw?.line ?? firstLine + i;
    const row = normalizeRow(raw);
    const skip = (reason) => skipped.push({ line, email: row.email || null, name: row.name || null, reason });

    if (!row.email && !row.name && !row.mssv) return; // dòng trống trong Excel
    if (!EMAIL_RE.test(row.email)) return skip('Email không hợp lệ');
    if (!row.name) return skip('Thiếu họ tên');
    if (row.name.length < 2) return skip('Họ tên quá ngắn');
    if (row.name.length > 100) return skip('Họ tên quá dài');
    if (seenEmail.has(row.email)) return skip('Trùng email với dòng phía trên');
    if (row.mssv && seenMssv.has(row.mssv)) return skip('Trùng MSSV với dòng phía trên');

    seenEmail.add(row.email);
    if (row.mssv) seenMssv.add(row.mssv);
    rows.push({ ...row, line });
  });

  return { rows, skipped };
}

// Tên cột Excel → trường, so khớp sau khi bỏ dấu/viết thường như import khách mời.
// Danh sách lớp của trường hay tách "Họ đệm" + "Tên" thành hai cột: khi không có cột
// họ tên đầy đủ thì ghép hai cột đó lại, nếu không sẽ chỉ còn mỗi tên ("An").
const HEADER_ALIASES = {
  email: ['email', 'mail', 'diachiemail', 'thudientu', 'gmail'],
  name: ['hoten', 'hovaten', 'name', 'fullname', 'hotensinhvien', 'hovatensinhvien', 'tensinhvien'],
  givenName: ['ten', 'firstname'],
  familyName: ['ho', 'hodem', 'holot', 'hotendem', 'hovatendem', 'lastname'],
  mssv: ['mssv', 'masosinhvien', 'masv', 'studentid', 'ma', 'masinhvien'],
  phone: ['sdt', 'sodienthoai', 'dienthoai', 'phone', 'mobile', 'sodt', 'dt'],
};
// File danh sách thường có vài dòng tên trường/lớp phía trên tiêu đề cột.
const HEADER_SCAN_ROWS = 10;

function headerKey(header) {
  const k = toAsciiFilename(header).toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.keys(HEADER_ALIASES).find((field) => HEADER_ALIASES[field].includes(k)) || null;
}

// Một dòng là tiêu đề khi có cột email và cột họ tên (đầy đủ, hoặc cột "Tên").
function headerColumns(cells) {
  const columns = {};
  cells.forEach((cell, index) => {
    const field = str(cell) && headerKey(str(cell));
    if (field && columns[field] === undefined) columns[field] = index;
  });
  const hasName = columns.name !== undefined || columns.givenName !== undefined;
  return columns.email !== undefined && hasName ? columns : null;
}

// CSV xuất từ Google Sheets / Notepad là UTF-8 nhưng không có BOM — đưa thẳng buffer
// vào SheetJS thì nó đọc theo latin1, "Họ tên" thành ký tự rác và không khớp cột nào.
// File xlsx (zip "PK") và xls (OLE) giữ nguyên đường đọc buffer.
function readWorkbook(buffer) {
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf;
  if (!isZip && !isOle) {
    let text = null;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      // Không phải UTF-8 hợp lệ (vd. CSV ANSI) — để SheetJS tự đoán như trước.
    }
    // raw: giữ mọi ô CSV là chữ, để SĐT "0901..." không bị đổi thành số rồi mất số 0.
    if (text !== null) return XLSX.read(text.replace(/^﻿/, ''), { type: 'string', raw: true });
  }
  return XLSX.read(buffer, { type: 'buffer' });
}

// File Excel/CSV → { rows } hoặc { error }. Mỗi dòng mang `line` = số dòng thật trong
// file để BTC dò lại; tiêu đề được tìm trong HEADER_SCAN_ROWS dòng đầu.
function parseSheet(buffer) {
  let grid;
  let startRow;
  try {
    const workbook = readWorkbook(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet?.['!ref']) return { error: 'File trống hoặc không có dòng dữ liệu' };
    // header: 1 giữ cả dòng trống nên chỉ số mảng khớp số dòng trong file.
    grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: true });
    startRow = XLSX.utils.decode_range(sheet['!ref']).s.r + 1;
  } catch {
    return { error: 'Không đọc được file — hãy dùng file Excel (.xlsx) hoặc CSV' };
  }

  let headerIndex = -1;
  let columns = null;
  for (let i = 0; i < Math.min(grid.length, HEADER_SCAN_ROWS); i++) {
    columns = headerColumns(grid[i]);
    if (columns) { headerIndex = i; break; }
  }
  if (!columns) {
    return { error: 'File cần có dòng tiêu đề với cột "Email" và cột "Họ tên" (MSSV, SĐT không bắt buộc)' };
  }

  const cell = (cells, field) => (columns[field] === undefined ? '' : str(cells[columns[field]]));
  const rows = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i];
    const name = columns.name !== undefined
      ? cell(cells, 'name')
      : [cell(cells, 'familyName'), cell(cells, 'givenName')].filter(Boolean).join(' ');
    const row = { email: cell(cells, 'email'), name, mssv: cell(cells, 'mssv'), phone: cell(cells, 'phone') };
    if (!row.email && !row.name && !row.mssv && !row.phone) continue; // dòng trống
    rows.push({ ...row, line: startRow + i });
  }

  if (!rows.length) return { error: 'File trống hoặc không có dòng dữ liệu' };
  if (rows.length > MAX_ROWS) return { error: `Mỗi lần nhập tối đa ${MAX_ROWS} người` };
  return { rows };
}

// Tạo người tham gia còn thiếu, dùng lại người đã có theo email. Trả
// { userIds, created, skipped } — skipped gộp cả lỗi kiểm dòng lẫn xung đột MSSV.
async function upsertParticipants(input, opts) {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: 'Danh sách trống' };
  }
  if (input.length > MAX_ROWS) {
    return { error: `Mỗi lần nhập tối đa ${MAX_ROWS} người` };
  }

  const { rows, skipped } = validateRows(input, opts);
  if (rows.length === 0) return { userIds: [], created: 0, skipped };

  const emails = rows.map((r) => r.email);
  const mssvs = rows.map((r) => r.mssv).filter(Boolean);

  const existing = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: emails, mode: 'insensitive' } },
        ...(mssvs.length ? [{ mssv: { in: mssvs, mode: 'insensitive' } }] : []),
      ],
    },
    select: { id: true, email: true, mssv: true, phone: true, isActive: true },
  });
  const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u]));
  const mssvOwner = new Map(existing.filter((u) => u.mssv).map((u) => [u.mssv.toUpperCase(), u.email.toLowerCase()]));

  const userIds = [];
  const toCreate = [];
  const patches = [];

  for (const row of rows) {
    const owner = row.mssv ? mssvOwner.get(row.mssv) : null;
    const user = byEmail.get(row.email);

    if (user) {
      if (!user.isActive) {
        skipped.push({ line: row.line, email: row.email, name: row.name, reason: 'Người này đã bị khoá trong hệ thống' });
        continue;
      }
      userIds.push(user.id);
      // Chỉ bổ sung chỗ còn trống — không ghi đè dữ liệu người khác đang dùng.
      const patch = {
        ...(!user.mssv && row.mssv && !owner && { mssv: row.mssv }),
        ...(!user.phone && row.phone && { phone: row.phone }),
      };
      if (Object.keys(patch).length) patches.push({ id: user.id, data: patch });
      continue;
    }

    if (owner) {
      skipped.push({ line: row.line, email: row.email, name: row.name, reason: `MSSV ${row.mssv} đã gắn với một email khác` });
      continue;
    }
    toCreate.push(row);
  }

  if (toCreate.length) {
    // skipDuplicates: hai lần nhập chạy song song cùng một email thì lần sau bỏ qua
    // bản tạo trùng và lấy lại người đã tạo ở bước tìm bên dưới.
    await prisma.user.createMany({
      data: toCreate.map((r) => ({
        email: r.email,
        name: r.name,
        mssv: r.mssv || null,
        phone: r.phone || null,
        role: PARTICIPANT_ROLE,
        passwordHash: NO_PASSWORD,
        isFirstLogin: false,
      })),
      skipDuplicates: true,
    });
    const created = await prisma.user.findMany({
      where: { email: { in: toCreate.map((r) => r.email), mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    const createdIds = new Map(created.map((u) => [u.email.toLowerCase(), u.id]));
    for (const row of toCreate) {
      const id = createdIds.get(row.email);
      if (id) userIds.push(id);
      else skipped.push({ line: row.line, email: row.email, name: row.name, reason: 'Không tạo được (trùng dữ liệu)' });
    }
  }

  for (const p of patches) {
    // Bổ sung là phụ — lỗi (vd. MSSV vừa bị người khác chiếm) không được làm hỏng cả lần nhập.
    await prisma.user.update({ where: { id: p.id }, data: p.data }).catch(() => {});
  }

  return { userIds, created: toCreate.length, skipped };
}

// Nhập danh sách vào sự kiện: tạo/dùng lại người tham gia rồi thêm qua
// addUsersToEvent (EventMember + Attendance REGISTERED trong một transaction).
async function addParticipantsToEvent(eventId, input, opts) {
  const result = await upsertParticipants(input, opts);
  if (result.error) return result;
  const { added } = await addUsersToEvent(eventId, result.userIds);
  return {
    added,
    alreadyIn: result.userIds.length - added,
    created: result.created,
    skipped: result.skipped,
  };
}

async function addParticipantsToClass(classId, input, opts) {
  const result = await upsertParticipants(input, opts);
  if (result.error) return result;
  const { count } = result.userIds.length
    ? await prisma.classMember.createMany({
      data: result.userIds.map((userId) => ({ classId, userId })),
      skipDuplicates: true,
    })
    : { count: 0 };
  return {
    added: count,
    alreadyIn: result.userIds.length - count,
    created: result.created,
    skipped: result.skipped,
  };
}

// Câu tóm tắt cho toast của BTC.
function importSummary({ added, alreadyIn, skipped }) {
  const parts = [`Đã thêm ${added} người`];
  if (alreadyIn) parts.push(`${alreadyIn} người đã có sẵn`);
  if (skipped.length) parts.push(`bỏ qua ${skipped.length} dòng`);
  return parts.join(', ');
}

module.exports = {
  PARTICIPANT_ROLE,
  NO_PASSWORD,
  MAX_ROWS,
  validateRows,
  parseSheet,
  upsertParticipants,
  addParticipantsToEvent,
  addParticipantsToClass,
  importSummary,
};
