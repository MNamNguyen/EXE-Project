const XLSX = require('xlsx');
const prisma = require('../lib/prisma');
const { loadEventForWrite } = require('../lib/eventAccess');
const { attachmentHeader, inlineHeader, toAsciiFilename } = require('../lib/contentDisposition');
const {
  normalizeGuestInput, findDuplicate, guestView, checkInByCode, checkInById, addWalkIn,
  guestStats, recentCheckins,
} = require('../lib/guestCheckin');
const {
  generateGuestCode, invitationValues, invitationTime, invitationUrl,
} = require('../lib/invitationLayout');
const { renderInvitationsPdf } = require('../services/invitationPdf');
const emailService = require('../services/email.service');

// Khách mời của sự kiện thiệp mời — phía BTC (ADMIN hoặc người tạo sự kiện).
// Thiết kế: docs/superpowers/specs/2026-10-16-invitation-event-design.md

const MAX_PAGE_SIZE = 100;
const MAX_IMPORT_ROWS = 2000;
const SEND_CONCURRENCY = 4; // mỗi email kèm một PDF vẽ tại chỗ — giữ CPU Render free không nghẹt

function serverError(res, label, err) {
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, message: 'Lỗi server' });
}

// loadEventForWrite + phải là sự kiện thiệp mời còn hoạt động. Trả null sau khi đã
// gửi response lỗi.
async function loadInvitationEvent(req, res) {
  const event = await loadEventForWrite(req, res);
  if (!event) return null;
  if (!event.isActive) {
    res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    return null;
  }
  if (event.kind !== 'INVITATION') {
    res.status(400).json({ success: false, error: 'NOT_INVITATION_EVENT', message: 'Sự kiện này không dùng thiệp mời' });
    return null;
  }
  return event;
}

function sendResult(res, result, view = guestView) {
  return res.status(result.status).json({
    success: result.ok,
    ...(result.error && { error: result.error }),
    message: result.message,
    ...(result.guest && { guest: view(result.guest) }),
  });
}

// Tên người quét lưu kèm lượt check-in để BTC tra lại ai đã cho khách vào.
const actorOf = (req) => req.user.name;

// ── Danh sách khách ──────────────────────────────────────────────────────

const STATUS_FILTERS = {
  checked: { checkedInAt: { not: null } },
  pending: { checkedInAt: null },
  walkin: { isWalkIn: true },
  'invite-failed': { inviteStatus: 'FAILED', isWalkIn: false },
};

async function listGuests(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || '').trim().slice(0, 100);
    const digits = search.replace(/[\s.\-()]/g, '');

    const where = {
      eventId: event.id,
      ...(STATUS_FILTERS[req.query.status] || {}),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search.toLowerCase() } },
          ...(/^\+?\d{3,}$/.test(digits) ? [{ phone: { contains: digits } }] : []),
        ],
      }),
    };

    const [guests, total, stats, withEmail, sent, failed] = await Promise.all([
      prisma.eventGuest.findMany({
        where,
        orderBy: [{ checkedInAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.eventGuest.count({ where }),
      guestStats(event.id),
      prisma.eventGuest.count({ where: { eventId: event.id, isWalkIn: false, email: { not: null } } }),
      prisma.eventGuest.count({ where: { eventId: event.id, isWalkIn: false, inviteStatus: 'SENT' } }),
      prisma.eventGuest.count({ where: { eventId: event.id, isWalkIn: false, inviteStatus: 'FAILED' } }),
    ]);

    return res.json({
      success: true,
      data: guests.map(guestView),
      total,
      page,
      limit,
      stats: { ...stats, withEmail, sent, failed },
    });
  } catch (err) {
    return serverError(res, 'List guests', err);
  }
}

async function addGuest(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const input = normalizeGuestInput(req.body);
    if (input.error) return res.status(400).json({ success: false, error: 'INVALID_GUEST', message: input.error });

    const dup = await findDuplicate(event.id, input.value);
    if (dup) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_GUEST',
        message: `Email hoặc SĐT này đã có trong danh sách (${dup.name}).`,
      });
    }

    const guest = await prisma.eventGuest.create({
      data: { ...input.value, eventId: event.id, code: generateGuestCode() },
    });
    return res.status(201).json({ success: true, data: guestView(guest), message: `Đã thêm ${guest.name}` });
  } catch (err) {
    return serverError(res, 'Add guest', err);
  }
}

// Tên cột trong file Excel → trường. So khớp sau khi bỏ dấu, viết thường, bỏ ký tự
// lạ, nên "Họ và tên", "HỌ TÊN", "ho_ten" đều nhận.
const HEADER_ALIASES = {
  name: ['hoten', 'hovaten', 'ten', 'name', 'fullname', 'tenkhach', 'khachmoi'],
  phone: ['sdt', 'sodienthoai', 'dienthoai', 'phone', 'mobile', 'sodt', 'dt'],
  email: ['email', 'mail', 'diachiemail', 'thudientu'],
};

function headerKey(header) {
  const k = toAsciiFilename(header).toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.keys(HEADER_ALIASES).find((field) => HEADER_ALIASES[field].includes(k)) || null;
}

async function importGuests(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, message: 'Chưa chọn file' });
    }

    let rows;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    } catch {
      return res.status(400).json({ success: false, message: 'Không đọc được file — hãy dùng file Excel (.xlsx) hoặc CSV' });
    }
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'File trống hoặc không có dòng dữ liệu' });
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ success: false, message: `Mỗi lần import tối đa ${MAX_IMPORT_ROWS} khách` });
    }

    const columns = {};
    for (const header of Object.keys(rows[0])) {
      const field = headerKey(header);
      if (field && !columns[field]) columns[field] = header;
    }
    if (!columns.name) {
      return res.status(400).json({
        success: false,
        message: 'Không thấy cột "Họ tên" — dòng đầu file cần có các cột Họ tên, SĐT, Email',
      });
    }

    const existing = await prisma.eventGuest.findMany({
      where: { eventId: event.id },
      select: { email: true, phone: true },
    });
    const seenEmail = new Set(existing.map((g) => g.email).filter(Boolean));
    const seenPhone = new Set(existing.map((g) => g.phone).filter(Boolean));

    const toCreate = [];
    const skipped = [];
    rows.forEach((row, i) => {
      const line = i + 2; // dòng 1 là tiêu đề
      const raw = {
        name: row[columns.name],
        phone: columns.phone ? row[columns.phone] : '',
        email: columns.email ? row[columns.email] : '',
      };
      if (!String(raw.name).trim() && !String(raw.phone).trim() && !String(raw.email).trim()) return; // dòng trống
      const input = normalizeGuestInput(raw);
      if (input.error) {
        skipped.push({ row: line, name: String(raw.name || '').trim(), reason: input.error });
        return;
      }
      const { email, phone } = input.value;
      if ((email && seenEmail.has(email)) || (phone && seenPhone.has(phone))) {
        skipped.push({ row: line, name: input.value.name, reason: 'Trùng email hoặc SĐT với khách đã có' });
        return;
      }
      if (email) seenEmail.add(email);
      if (phone) seenPhone.add(phone);
      toCreate.push({ ...input.value, eventId: event.id, code: generateGuestCode() });
    });

    // skipDuplicates: hai lượt import chạy chồng nhau cũng không tạo trùng email.
    const { count } = toCreate.length
      ? await prisma.eventGuest.createMany({ data: toCreate, skipDuplicates: true })
      : { count: 0 };

    return res.json({
      success: true,
      data: { added: count, skipped },
      message: `Đã thêm ${count} khách${skipped.length ? `, bỏ qua ${skipped.length} dòng` : ''}`,
    });
  } catch (err) {
    return serverError(res, 'Import guests', err);
  }
}

async function findGuest(event, req, res) {
  const guest = await prisma.eventGuest.findFirst({ where: { id: req.params.guestId, eventId: event.id } });
  if (!guest) res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND', message: 'Không tìm thấy khách' });
  return guest;
}

async function updateGuest(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const guest = await findGuest(event, req, res);
    if (!guest) return;

    const input = normalizeGuestInput(req.body);
    if (input.error) return res.status(400).json({ success: false, error: 'INVALID_GUEST', message: input.error });
    const dup = await findDuplicate(event.id, input.value, guest.id);
    if (dup) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_GUEST',
        message: `Email hoặc SĐT này đã có trong danh sách (${dup.name}).`,
      });
    }

    // Đổi email thì địa chỉ mới chưa nhận thiệp — đưa về chờ gửi.
    const emailChanged = input.value.email !== guest.email;
    const updated = await prisma.eventGuest.update({
      where: { id: guest.id },
      data: { ...input.value, ...(emailChanged && { inviteStatus: 'PENDING', inviteSentAt: null }) },
    });
    return res.json({ success: true, data: guestView(updated), message: 'Đã cập nhật khách mời' });
  } catch (err) {
    return serverError(res, 'Update guest', err);
  }
}

async function deleteGuest(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const { count } = await prisma.eventGuest.deleteMany({ where: { id: req.params.guestId, eventId: event.id } });
    if (!count) return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND', message: 'Không tìm thấy khách' });
    return res.json({ success: true, message: 'Đã xoá khách khỏi danh sách' });
  } catch (err) {
    return serverError(res, 'Delete guest', err);
  }
}

// Thiệp bị lộ/chuyển nhầm người: cấp mã mới, thiệp cũ quét ra "không tìm thấy".
// Thiệp mới chưa ai nhận nên trạng thái gửi về chờ gửi.
async function rotateGuestCode(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const guest = await findGuest(event, req, res);
    if (!guest) return;
    const updated = await prisma.eventGuest.update({
      where: { id: guest.id },
      data: { code: generateGuestCode(), inviteStatus: 'PENDING', inviteSentAt: null },
    });
    return res.json({ success: true, data: guestView(updated), message: 'Đã cấp mã mới — thiệp cũ không dùng được nữa' });
  } catch (err) {
    return serverError(res, 'Rotate guest code', err);
  }
}

// ── Check-in ─────────────────────────────────────────────────────────────

async function scanGuest(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    return sendResult(res, await checkInByCode(event, req.body?.code, actorOf(req)));
  } catch (err) {
    return serverError(res, 'Scan guest', err);
  }
}

async function checkInGuestManually(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    return sendResult(res, await checkInById(event, req.params.guestId, actorOf(req)));
  } catch (err) {
    return serverError(res, 'Manual guest check-in', err);
  }
}

// Chỉ BTC (không phải link quét) được huỷ — sửa lượt quét nhầm người.
async function undoGuestCheckIn(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const guest = await findGuest(event, req, res);
    if (!guest) return;
    const updated = await prisma.eventGuest.update({
      where: { id: guest.id },
      data: { checkedInAt: null, checkedInBy: null },
    });
    return res.json({ success: true, data: guestView(updated), message: `Đã huỷ check-in của ${guest.name}` });
  } catch (err) {
    return serverError(res, 'Undo guest check-in', err);
  }
}

async function addWalkInGuest(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    return sendResult(res, await addWalkIn(event, req.body, actorOf(req)));
  } catch (err) {
    return serverError(res, 'Add walk-in guest', err);
  }
}

// Đầu trang quét: thông tin sự kiện + số liệu + vài lượt check-in mới nhất.
async function scannerSummary(event) {
  const [stats, recent] = await Promise.all([guestStats(event.id), recentCheckins(event.id)]);
  return {
    event: { id: event.id, name: event.name, location: event.location, startsAt: event.startsAt },
    stats,
    recent,
  };
}

async function getScannerSummary(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: await scannerSummary(event) });
  } catch (err) {
    return serverError(res, 'Scanner summary', err);
  }
}

// ── Thiệp PDF ────────────────────────────────────────────────────────────

function loadTemplate(eventId) {
  return prisma.eventInvitationTemplate.findUnique({ where: { eventId } });
}

const pdfItem = (guest, event) => ({ values: invitationValues(guest, event), qrText: invitationUrl(guest.code) });

function sendPdf(res, pdf, baseName, inline) {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', (inline ? inlineHeader : attachmentHeader)(baseName, 'pdf'));
  res.set('Cache-Control', 'private, no-store');
  return res.send(Buffer.from(pdf));
}

async function downloadGuestInvitation(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const guest = await findGuest(event, req, res);
    if (!guest) return;
    const pdf = await renderInvitationsPdf(await loadTemplate(event.id), [pdfItem(guest, event)], {
      title: `Thiệp mời - ${guest.name} - ${event.name}`,
    });
    return sendPdf(res, pdf, `thiep-moi-${guest.name}`, req.query.view === '1');
  } catch (err) {
    return serverError(res, 'Download guest invitation', err);
  }
}

// Mọi thiệp trong MỘT file (mỗi khách một trang) để BTC in hàng loạt. Khách tại
// chỗ không có thiệp.
async function downloadAllInvitations(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const guests = await prisma.eventGuest.findMany({
      where: { eventId: event.id, isWalkIn: false },
      orderBy: { name: 'asc' },
    });
    if (!guests.length) {
      return res.status(400).json({ success: false, error: 'NO_GUESTS', message: 'Chưa có khách mời nào' });
    }
    const pdf = await renderInvitationsPdf(await loadTemplate(event.id), guests.map((g) => pdfItem(g, event)), {
      title: `Thiệp mời - ${event.name}`,
    });
    return sendPdf(res, pdf, `thiep-moi-${event.name}`, false);
  } catch (err) {
    return serverError(res, 'Download all invitations', err);
  }
}

// ── Gửi thiệp qua email ──────────────────────────────────────────────────

// Mỗi khách được "giành" (→ SENDING) trước khi gửi, nên BTC bấm gửi hai lần liền
// cũng không ai nhận hai email. Vẽ PDF từng người ngay lúc gửi (không lưu sẵn).
async function deliverInvitations(event, guestIds) {
  const template = await loadTemplate(event.id);
  const whenText = event.startsAt ? invitationTime(event.startsAt) : null;

  const sendOne = async (id) => {
    const claimed = await prisma.eventGuest.updateMany({
      where: { id, inviteStatus: { not: 'SENDING' } },
      data: { inviteStatus: 'SENDING' },
    });
    if (!claimed.count) return;
    const guest = await prisma.eventGuest.findUnique({ where: { id } });
    if (!guest?.email) return;
    try {
      const pdf = await renderInvitationsPdf(template, [pdfItem(guest, event)], {
        title: `Thiệp mời - ${guest.name} - ${event.name}`,
      });
      await emailService.sendInvitationEmail(guest.email, guest.name, event, {
        whenText,
        viewUrl: invitationUrl(guest.code),
        pdf,
        filename: `${toAsciiFilename(`Thiep moi ${event.name}`).slice(0, 80)}.pdf`,
      });
      await prisma.eventGuest.update({ where: { id }, data: { inviteStatus: 'SENT', inviteSentAt: new Date() } });
    } catch (err) {
      console.error('Invitation email failed:', err.message);
      await prisma.eventGuest.update({ where: { id }, data: { inviteStatus: 'FAILED' } }).catch(() => {});
    }
  };

  for (let i = 0; i < guestIds.length; i += SEND_CONCURRENCY) {
    await Promise.allSettled(guestIds.slice(i, i + SEND_CONCURRENCY).map(sendOne));
  }
}

// Không truyền guestIds = gửi cho mọi khách có email chưa nhận (chờ gửi + lỗi lần
// trước). Truyền guestIds = gửi (lại) đúng những người đó. Trả 202 rồi gửi nền —
// danh sách dài vượt timeout của frontend và api.js sẽ tự gửi lại request.
async function sendInvitations(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;

    const ids = Array.isArray(req.body?.guestIds) ? req.body.guestIds.filter((x) => typeof x === 'string').slice(0, 2000) : null;
    const targets = await prisma.eventGuest.findMany({
      where: {
        eventId: event.id,
        isWalkIn: false,
        email: { not: null },
        ...(ids ? { id: { in: ids }, inviteStatus: { not: 'SENDING' } } : { inviteStatus: { in: ['PENDING', 'FAILED'] } }),
      },
      select: { id: true },
    });

    if (!targets.length) {
      return res.status(400).json({
        success: false,
        error: 'NOTHING_TO_SEND',
        message: ids ? 'Khách đã chọn không có email để gửi' : 'Mọi khách có email đều đã được gửi thiệp',
      });
    }

    res.status(202).json({
      success: true,
      data: { queued: targets.length },
      message: `Đang gửi thiệp cho ${targets.length} khách`,
    });

    deliverInvitations(event, targets.map((t) => t.id)).catch((err) => console.error('Invitation batch error:', err));
  } catch (err) {
    return serverError(res, 'Send invitations', err);
  }
}

module.exports = {
  loadInvitationEvent,
  sendResult,
  scannerSummary,
  loadTemplate,
  pdfItem,
  sendPdf,
  listGuests,
  addGuest,
  importGuests,
  updateGuest,
  deleteGuest,
  rotateGuestCode,
  scanGuest,
  checkInGuestManually,
  undoGuestCheckIn,
  addWalkInGuest,
  getScannerSummary,
  downloadGuestInvitation,
  downloadAllInvitations,
  sendInvitations,
  deliverInvitations,
};
