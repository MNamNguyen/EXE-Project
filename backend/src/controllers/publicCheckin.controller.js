const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { loadEventForWrite } = require('../lib/eventAccess');
const { gateRejection, gateSummary } = require('../lib/attendanceGate');
const { gpsRejection } = require('../lib/geo');
const { fmtTime } = require('../lib/datetime');
const { generateGuestCode } = require('../lib/invitationLayout');
const { guestView } = require('../lib/guestCheckin');
const {
  readPublicForm, normalizeFields, normalizeThankYou, sameFields, validateSubmission, uniqueLabels,
} = require('../lib/publicForm');

// Check-in công khai: QR cố định → người ghé thăm tự điền form BTC dựng.
// Spec: docs/superpowers/specs/2026-10-16-public-checkin-design.md

function serverError(res, label, err) {
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, message: 'Lỗi server' });
}

// Ghi log gian lận best-effort (không có tài khoản nên không có userId) — không bao giờ ném.
async function logFraud(eventId, reason, req, extra = {}) {
  try {
    await prisma.fraudLog.create({
      data: {
        eventId, reason, ip: req.ip, deviceId: req.headers['x-device-id'], gps: extra.gps || null, metadata: { ...extra, source: 'PUBLIC_CHECKIN' },
      },
    });
  } catch { /* best-effort */ }
}

// Tạo một lượt check-in. Chống trùng hai lớp: dò khoá trước để trả lời đẹp, và ràng
// buộc unique (eventId, key) trong transaction để hai lượt gửi cùng lúc với cùng SĐT
// thì một lượt chắc chắn bị chặn (P2002) — không cần khoá ở tầng ứng dụng.
async function createCheckin(event, value, actor) {
  const { name, answers, phone, email, keys } = value;

  const findExisting = async () => {
    if (keys.length) {
      const hit = await prisma.eventGuestKey.findFirst({ where: { eventId: event.id, key: { in: keys } }, include: { guest: true } });
      if (hit?.guest) return hit.guest;
    }
    return email ? prisma.eventGuest.findFirst({ where: { eventId: event.id, email } }) : null;
  };

  const existing = await findExisting();
  if (existing) return { ok: false, existing };

  const id = crypto.randomUUID();
  try {
    await prisma.$transaction([
      prisma.eventGuest.create({
        data: { id, eventId: event.id, name, phone, email, answers, code: generateGuestCode(), checkedInAt: new Date(), checkedInBy: actor },
      }),
      ...(keys.length ? [prisma.eventGuestKey.createMany({ data: keys.map((key) => ({ eventId: event.id, guestId: id, key })) })] : []),
    ]);
  } catch (err) {
    if (err?.code !== 'P2002') throw err;
    return { ok: false, existing: await findExisting() };
  }
  return { ok: true, guest: await prisma.eventGuest.findUnique({ where: { id } }) };
}

// Câu báo trùng cho người điền: KHÔNG nêu tên người đã check-in — ai gõ thử SĐT của
// người khác cũng không biết được tên chủ số.
function duplicateBody(form, existing) {
  const fields = uniqueLabels(form).join(' / ') || 'Thông tin này';
  return {
    success: false,
    error: 'ALREADY_CHECKED_IN',
    message: existing?.checkedInAt
      ? `${fields} đã được dùng để check-in lúc ${fmtTime(existing.checkedInAt)}. Mỗi người chỉ check-in một lần.`
      : `${fields} đã được dùng để check-in. Mỗi người chỉ check-in một lần.`,
    checkedInAt: existing?.checkedInAt || null,
  };
}

// ── BTC ─────────────────────────────────────────────────────────────────

async function loadPublicEventForWrite(req, res) {
  const event = await loadEventForWrite(req, res);
  if (!event) return null;
  if (!event.isActive) {
    res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    return null;
  }
  if (event.kind !== 'PUBLIC') {
    res.status(400).json({ success: false, error: 'NOT_PUBLIC_EVENT', message: 'Sự kiện này không dùng check-in công khai' });
    return null;
  }
  return event;
}

async function getPublicFormSetup(req, res) {
  try {
    const event = await loadPublicEventForWrite(req, res);
    if (!event) return;
    const count = await prisma.eventGuest.count({ where: { eventId: event.id } });
    return res.json({ success: true, data: { form: readPublicForm(event), locked: count > 0, count } });
  } catch (err) {
    return serverError(res, 'Get public form', err);
  }
}

// Lưu form. Đã có người check-in thì danh sách trường bị khoá (đổi trường làm cột báo
// cáo và khoá chống trùng lệch với dữ liệu đã có) — chỉ còn sửa được lời cảm ơn.
async function savePublicForm(req, res) {
  try {
    const event = await loadPublicEventForWrite(req, res);
    if (!event) return;
    const fields = normalizeFields(req.body?.fields);
    if (fields.error) return res.status(400).json({ success: false, error: 'INVALID_FORM', message: fields.error });
    const thankYou = normalizeThankYou(req.body?.thankYou);
    if (thankYou.error) return res.status(400).json({ success: false, error: 'INVALID_FORM', message: thankYou.error });

    const current = readPublicForm(event);
    const count = await prisma.eventGuest.count({ where: { eventId: event.id } });
    if (count > 0 && !sameFields(current.fields, fields.value)) {
      return res.status(409).json({
        success: false,
        error: 'FORM_LOCKED',
        message: `Đã có ${count} người check-in nên không đổi được các trường của form (vẫn sửa được lời cảm ơn).`,
      });
    }

    const form = { fields: fields.value, thankYou: thankYou.value };
    await prisma.event.update({ where: { id: event.id }, data: { publicForm: form } });
    return res.json({ success: true, data: { form, locked: count > 0, count }, message: 'Đã lưu form check-in' });
  } catch (err) {
    return serverError(res, 'Save public form', err);
  }
}

// BTC thêm tay (GPS trong nhà kém, khách không dùng điện thoại…): bỏ qua cổng và GPS,
// vẫn đúng form và vẫn chống trùng.
async function addCheckinByStaff(req, res) {
  try {
    const event = await loadPublicEventForWrite(req, res);
    if (!event) return;
    const form = readPublicForm(event);
    const input = validateSubmission(form, req.body);
    if (input.error) return res.status(400).json({ success: false, error: 'INVALID_ANSWERS', message: input.error });

    const result = await createCheckin(event, input.value, req.user.name);
    if (!result.ok) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_CHECKED_IN',
        message: `Trùng với ${result.existing?.name || 'một người'} đã check-in${result.existing?.checkedInAt ? ` lúc ${fmtTime(result.existing.checkedInAt)}` : ''}.`,
      });
    }
    return res.status(201).json({ success: true, data: guestView(result.guest), message: `Đã check-in: ${result.guest.name}` });
  } catch (err) {
    return serverError(res, 'Staff public check-in', err);
  }
}

// ── Công khai ───────────────────────────────────────────────────────────

async function loadOpenPublicEvent(req, res) {
  const event = await prisma.event.findUnique({ where: { id: String(req.params.eventId || '') } });
  if (!event || !event.isActive || event.kind !== 'PUBLIC') {
    res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Không tìm thấy sự kiện hoặc sự kiện đã kết thúc' });
    return null;
  }
  return event;
}

// Trang người ghé thăm mở sau khi quét QR. Không trả toạ độ/bán kính (chống giả GPS).
async function getPublicCheckinPage(req, res) {
  try {
    const event = await loadOpenPublicEvent(req, res);
    if (!event) return;
    const form = readPublicForm(event);
    const closed = gateRejection(event, 'checkin');
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        event: { id: event.id, name: event.name, location: event.location, description: event.description },
        fields: form.fields,
        uniqueLabels: uniqueLabels(form),
        gpsEnabled: event.gpsEnabled,
        gate: closed ? { open: false, error: closed.error, message: closed.message } : { open: true },
      },
    });
  } catch (err) {
    return serverError(res, 'Public check-in page', err);
  }
}

// Thứ tự kiểm tra: sự kiện → cổng → GPS → form → chống trùng → ghi.
async function submitPublicCheckin(req, res) {
  try {
    const event = await loadOpenPublicEvent(req, res);
    if (!event) return;

    const closed = gateRejection(event, 'checkin');
    if (closed) return res.status(400).json(closed);

    const gpsError = gpsRejection(event, req.body?.gps);
    if (gpsError) {
      if (gpsError.fraud) await logFraud(event.id, gpsError.fraud.reason, req, gpsError.fraud.extra);
      return res.status(gpsError.status).json(gpsError.body);
    }

    const form = readPublicForm(event);
    const input = validateSubmission(form, req.body);
    if (input.error) return res.status(400).json({ success: false, error: 'INVALID_ANSWERS', message: input.error });

    const result = await createCheckin(event, input.value, 'Tự check-in');
    if (!result.ok) return res.status(409).json(duplicateBody(form, result.existing));

    return res.status(201).json({
      success: true,
      data: {
        name: result.guest.name,
        checkedInAt: result.guest.checkedInAt,
        thankYou: form.thankYou,
        event: { name: event.name, location: event.location },
      },
    });
  } catch (err) {
    return serverError(res, 'Public check-in', err);
  }
}

// Trạng thái cổng cho màn chiếu (QRDisplay) — kèm link cố định của QR.
function publicQrPayload(event) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return {
    eventId: event.id,
    eventName: event.name,
    kind: 'PUBLIC',
    publicUrl: `${base}/check-in/${event.id}`,
    gate: gateSummary(event).checkin,
  };
}

module.exports = {
  createCheckin,
  getPublicFormSetup,
  savePublicForm,
  addCheckinByStaff,
  getPublicCheckinPage,
  submitPublicCheckin,
  publicQrPayload,
};
