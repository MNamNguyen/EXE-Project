const XLSX = require('xlsx');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { loadEventForWrite } = require('../lib/eventAccess');
const { attachmentHeader, inlineHeader, toAsciiFilename } = require('../lib/contentDisposition');
const {
  GUEST_INCLUDE, normalizeGuestInput, findDuplicate, guestView, checkInByCode, checkInById, addWalkIn,
  guestStats, recentCheckins, validateSeats, seatCreates, seatWrites, seatTaken, isUniqueViolation, replaceGuestSeats,
  guestSearchWhere,
} = require('../lib/guestCheckin');
const { normalizeSeatMap, usableSeats, sortSeats, seatLabel } = require('../lib/seatMap');
const crypto = require('crypto');
const {
  generateGuestCode, withAllFields, invitationValues, invitationTime, invitationUrl,
} = require('../lib/invitationLayout');
const { renderInvitationsPdf } = require('../services/invitationPdf');
const { TIME_ZONE } = require('../lib/datetime');
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
// gửi response lỗi. kinds: các kiểu được phép — danh sách/xoá khách dùng chung với
// check-in công khai (người check-in cũng nằm ở bảng khách).
async function loadInvitationEvent(req, res, kinds = ['INVITATION']) {
  const event = await loadEventForWrite(req, res);
  if (!event) return null;
  if (!event.isActive) {
    res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    return null;
  }
  if (!kinds.includes(event.kind)) {
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

const GUEST_KINDS = ['INVITATION', 'PUBLIC'];

// 0 giờ hôm nay theo giờ VN (server chạy UTC — xem lib/datetime.js).
function startOfTodayVN(now = new Date()) {
  const ymd = now.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
  return new Date(`${ymd}T00:00:00+07:00`);
}

async function listGuests(req, res) {
  try {
    const event = await loadInvitationEvent(req, res, GUEST_KINDS);
    if (!event) return;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const where = {
      eventId: event.id,
      ...(STATUS_FILTERS[req.query.status] || {}),
      ...guestSearchWhere(req.query.search),
    };

    const [guests, total, stats, withEmail, sent, failed, today, last] = await Promise.all([
      prisma.eventGuest.findMany({
        where,
        orderBy: [{ checkedInAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: GUEST_INCLUDE,
      }),
      prisma.eventGuest.count({ where }),
      guestStats(event.id),
      prisma.eventGuest.count({ where: { eventId: event.id, isWalkIn: false, email: { not: null } } }),
      prisma.eventGuest.count({ where: { eventId: event.id, isWalkIn: false, inviteStatus: 'SENT' } }),
      prisma.eventGuest.count({ where: { eventId: event.id, isWalkIn: false, inviteStatus: 'FAILED' } }),
      prisma.eventGuest.count({ where: { eventId: event.id, checkedInAt: { gte: startOfTodayVN() } } }),
      prisma.eventGuest.findFirst({
        where: { eventId: event.id, checkedInAt: { not: null } },
        orderBy: { checkedInAt: 'desc' },
        select: { checkedInAt: true },
      }),
    ]);

    return res.json({
      success: true,
      data: guests.map(guestView),
      total,
      page,
      limit,
      stats: { ...stats, withEmail, sent, failed, today, lastCheckedInAt: last?.checkedInAt || null },
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

    const seats = input.seats || [];
    const invalid = validateSeats(event, seats);
    if (invalid) return sendResult(res, invalid);

    // id sinh trước để tạo khách + ghế trong MỘT transaction — ghế trùng (P2002) thì
    // khách cũng không được tạo.
    const id = crypto.randomUUID();
    try {
      await prisma.$transaction([
        prisma.eventGuest.create({ data: { ...input.value, id, eventId: event.id, code: generateGuestCode() } }),
        ...seatCreates(event.id, id, seats),
      ]);
    } catch (err) {
      if (!isUniqueViolation(err, 'seat')) throw err;
      return sendResult(res, await seatTaken(event.id, seats));
    }
    const guest = await prisma.eventGuest.findUnique({ where: { id }, include: GUEST_INCLUDE });
    return res.status(201).json({ success: true, data: guestView(guest), message: `Đã thêm ${guest.name}` });
  } catch (err) {
    return serverError(res, 'Add guest', err);
  }
}

// Tên cột trong file Excel → trường. So khớp sau khi bỏ dấu, viết thường, bỏ ký tự
// lạ, nên "Họ và tên", "HỌ TÊN", "ho_ten" đều nhận. Cột lạ (STT, ghi chú...) bỏ qua.
const HEADER_ALIASES = {
  name: ['hoten', 'hovaten', 'ten', 'name', 'fullname', 'tenkhach', 'khachmoi'],
  phone: ['sdt', 'sodienthoai', 'dienthoai', 'phone', 'mobile', 'sodt', 'dt'],
  email: ['email', 'mail', 'diachiemail', 'thudientu'],
  ticketCount: ['soluongve', 'sove', 'soluong', 'sl', 've', 'tickets', 'quantity'],
  seats: ['ghe', 'vitrighe', 'seat', 'seats', 'chongoi'],
};

function headerKey(header) {
  const k = toAsciiFilename(header).toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.keys(HEADER_ALIASES).find((field) => HEADER_ALIASES[field].includes(k)) || null;
}

const cellText = (row, column) => (column ? String(row[column] ?? '').trim() : '');

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

    const [existing, takenSeats] = await Promise.all([
      prisma.eventGuest.findMany({ where: { eventId: event.id }, select: { email: true, phone: true } }),
      prisma.eventGuestSeat.findMany({
        where: { eventId: event.id },
        select: { seat: true, guest: { select: { name: true } } },
      }),
    ]);
    const seenEmail = new Set(existing.map((g) => g.email).filter(Boolean));
    const seenPhone = new Set(existing.map((g) => g.phone).filter(Boolean));
    // Ghế → tên người giữ: gồm ghế đã gán trong DB và ghế của các dòng phía trên.
    const seatOwner = new Map(takenSeats.map((s) => [s.seat, s.guest.name]));

    const toCreate = [];
    const seatRows = [];
    const skipped = [];
    rows.forEach((row, i) => {
      const line = i + 2; // dòng 1 là tiêu đề
      const raw = {
        name: cellText(row, columns.name),
        phone: cellText(row, columns.phone),
        email: cellText(row, columns.email),
        ...(columns.ticketCount && { ticketCount: cellText(row, columns.ticketCount) }),
        ...(columns.seats && { seats: cellText(row, columns.seats) }),
      };
      // Dòng trống — kể cả dòng tổng cuối bảng (chỉ có số ở cột "Số lượng vé").
      if (!raw.name && !raw.phone && !raw.email && !raw.seats) return;
      const input = normalizeGuestInput(raw);
      if (input.error) {
        skipped.push({ row: line, name: raw.name, reason: input.error });
        return;
      }
      const { email, phone, name } = input.value;
      if ((email && seenEmail.has(email)) || (phone && seenPhone.has(phone))) {
        skipped.push({ row: line, name, reason: 'Trùng email hoặc SĐT với khách đã có' });
        return;
      }
      const seats = input.seats || [];
      const invalid = validateSeats(event, seats);
      if (invalid) {
        skipped.push({ row: line, name, reason: invalid.message });
        return;
      }
      const clash = seats.find((s) => seatOwner.has(s));
      if (clash) {
        skipped.push({ row: line, name, reason: `Ghế ${clash} trùng với ${seatOwner.get(clash)}` });
        return;
      }
      if (email) seenEmail.add(email);
      if (phone) seenPhone.add(phone);
      const id = crypto.randomUUID();
      seats.forEach((seat) => {
        seatOwner.set(seat, name);
        seatRows.push({ eventId: event.id, guestId: id, seat });
      });
      toCreate.push({ ...input.value, id, eventId: event.id, code: generateGuestCode() });
    });

    // Khách + ghế trong MỘT transaction. Có người gán đúng ghế đó trên sơ đồ ngay lúc
    // import (P2002) thì không thêm gì — BTC import lại sẽ thấy dòng nào trùng ghế.
    let count = 0;
    if (toCreate.length) {
      try {
        const [created] = await prisma.$transaction([
          prisma.eventGuest.createMany({ data: toCreate }),
          ...(seatRows.length ? [prisma.eventGuestSeat.createMany({ data: seatRows })] : []),
        ]);
        count = created.count;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        return res.status(409).json({
          success: false,
          error: 'IMPORT_CONFLICT',
          message: 'Có ghế hoặc email vừa được thêm cùng lúc ở nơi khác — chưa nhập dòng nào, hãy import lại.',
        });
      }
    }

    const tickets = toCreate.reduce((n, g) => n + (g.ticketCount || 1), 0);
    return res.json({
      success: true,
      data: { added: count, tickets, seats: seatRows.length, skipped },
      message: `Đã thêm ${count} khách (${tickets} vé)${skipped.length ? `, bỏ qua ${skipped.length} dòng` : ''}`,
    });
  } catch (err) {
    return serverError(res, 'Import guests', err);
  }
}

async function findGuest(event, req, res) {
  const guest = await prisma.eventGuest.findFirst({ where: { id: req.params.guestId, eventId: event.id }, include: GUEST_INCLUDE });
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

    // Giảm số vé mà không gửi lại danh sách ghế: ghế đang giữ không được nhiều hơn số vé mới.
    if (input.seats === null && input.value.ticketCount !== undefined) {
      const held = await prisma.eventGuestSeat.count({ where: { guestId: guest.id } });
      if (held > input.value.ticketCount) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_GUEST',
          message: `Khách đang giữ ${held} ghế — bỏ bớt ghế trước khi giảm số vé xuống ${input.value.ticketCount}`,
        });
      }
    }
    const seats = input.seats;
    const invalid = validateSeats(event, seats);
    if (invalid) return sendResult(res, invalid);

    // Đổi email thì địa chỉ mới chưa nhận thiệp — đưa về chờ gửi. Đổi số vé/ghế thì
    // thiệp đã gửi in số cũ — cũng đưa về chờ gửi để BTC gửi lại.
    const emailChanged = input.value.email !== guest.email;
    const ticketsChanged = input.value.ticketCount !== undefined && input.value.ticketCount !== guest.ticketCount;
    let seatsChanged = false;
    if (seats !== null) {
      const current = await prisma.eventGuestSeat.findMany({ where: { guestId: guest.id }, select: { seat: true } });
      seatsChanged = sortSeats(current.map((s) => s.seat)).join() !== seats.join();
    }
    const resend = emailChanged || ticketsChanged || seatsChanged;
    try {
      await prisma.$transaction([
        prisma.eventGuest.update({
          where: { id: guest.id },
          data: { ...input.value, ...(resend && { inviteStatus: 'PENDING', inviteSentAt: null }) },
        }),
        ...(seatsChanged ? seatWrites(event.id, guest.id, seats) : []),
      ]);
    } catch (err) {
      if (!isUniqueViolation(err, 'seat')) throw err;
      return sendResult(res, await seatTaken(event.id, seats, guest.id));
    }
    const updated = await prisma.eventGuest.findUnique({ where: { id: guest.id }, include: GUEST_INCLUDE });
    return res.json({ success: true, data: guestView(updated), message: 'Đã cập nhật khách mời' });
  } catch (err) {
    return serverError(res, 'Update guest', err);
  }
}

async function deleteGuest(req, res) {
  try {
    const event = await loadInvitationEvent(req, res, GUEST_KINDS);
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
      include: GUEST_INCLUDE,
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
      include: GUEST_INCLUDE,
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

// ── Sơ đồ ghế ────────────────────────────────────────────────────────────

// Sơ đồ + ghế đã gán (kèm khách giữ ghế, đã tới chưa) để vẽ sơ đồ, và danh sách
// khách còn thiếu ghế để chọn khi bấm vào một ghế trống.
async function getSeats(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const [assigned, guests] = await Promise.all([
      prisma.eventGuestSeat.findMany({
        where: { eventId: event.id },
        select: { seat: true, guest: { select: { id: true, name: true, ticketCount: true, checkedInAt: true, isWalkIn: true } } },
      }),
      prisma.eventGuest.findMany({
        where: { eventId: event.id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, ticketCount: true, checkedInAt: true, isWalkIn: true, _count: { select: { seats: true } } },
      }),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        seatMap: event.seatMap || null,
        assignments: assigned.map((a) => ({
          seat: a.seat,
          guestId: a.guest.id,
          name: a.guest.name,
          ticketCount: a.guest.ticketCount,
          checkedIn: Boolean(a.guest.checkedInAt),
        })),
        guests: guests.map(({ _count, ...g }) => ({ ...g, seatCount: _count.seats })),
      },
    });
  } catch (err) {
    return serverError(res, 'Get seats', err);
  }
}

// Lưu sơ đồ. Sơ đồ mới phải còn chứa mọi ghế đang được gán (thu nhỏ hàng hay bỏ
// ghế đã bán sẽ làm khách mất chỗ mà không ai hay) — 409 SEAT_IN_USE kèm danh sách.
// Body { seatMap: null } = bỏ sơ đồ, chỉ khi chưa gán ghế nào.
async function saveSeatMap(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;

    let seatMap = null;
    if (req.body?.seatMap != null) {
      const parsed = normalizeSeatMap(req.body.seatMap);
      if (parsed.error) return res.status(400).json({ success: false, error: 'INVALID_SEAT_MAP', message: parsed.error });
      seatMap = parsed.value;
    }

    const assigned = await prisma.eventGuestSeat.findMany({ where: { eventId: event.id }, select: { seat: true } });
    const usable = seatMap ? usableSeats(seatMap) : new Set();
    const lost = sortSeats(assigned.map((a) => a.seat).filter((s) => !usable.has(s)));
    if (lost.length) {
      const list = lost.length > 12 ? `${lost.slice(0, 12).join(', ')}… (${lost.length} ghế)` : lost.join(', ');
      return res.status(409).json({
        success: false,
        error: 'SEAT_IN_USE',
        message: seatMap
          ? `Các ghế đang có khách sẽ mất khỏi sơ đồ: ${list}. Bỏ gán các ghế này trước.`
          : 'Còn khách đang được gán ghế — bỏ gán hết ghế trước khi xoá sơ đồ.',
        seats: lost,
      });
    }

    await prisma.event.update({ where: { id: event.id }, data: { seatMap: seatMap ?? Prisma.DbNull } });
    return res.json({ success: true, data: { seatMap }, message: seatMap ? 'Đã lưu sơ đồ ghế' : 'Đã xoá sơ đồ ghế' });
  } catch (err) {
    return serverError(res, 'Save seat map', err);
  }
}

// Gán/bỏ/đổi ghế của một khách từ sơ đồ: gửi danh sách ghế MỚI của khách đó.
async function setGuestSeats(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const result = await replaceGuestSeats(event, req.params.guestId, req.body?.seats ?? []);
    return res.status(result.status).json({
      success: result.ok,
      ...(result.error && { error: result.error }),
      message: result.message,
      ...(result.guest && { data: guestView(result.guest) }),
    });
  } catch (err) {
    return serverError(res, 'Set guest seats', err);
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

async function loadTemplate(eventId) {
  return withAllFields(await prisma.eventInvitationTemplate.findUnique({ where: { eventId } }));
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
      include: GUEST_INCLUDE,
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
    const guest = await prisma.eventGuest.findUnique({ where: { id }, include: GUEST_INCLUDE });
    if (!guest?.email) return;
    try {
      const pdf = await renderInvitationsPdf(template, [pdfItem(guest, event)], {
        title: `Thiệp mời - ${guest.name} - ${event.name}`,
      });
      await emailService.sendInvitationEmail(guest.email, guest.name, event, {
        whenText,
        seatText: seatLabel(guest),
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
  getSeats,
  saveSeatMap,
  setGuestSeats,
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
