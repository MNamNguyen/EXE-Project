const prisma = require('./prisma');
const { fmtTime } = require('./datetime');
const { extractGuestCode, generateGuestCode, invitationUrl } = require('./invitationLayout');
const {
  parseSeatList, parseTicketCount, invalidSeats, normalizeSeat, guestSeats, seatLabel,
} = require('./seatMap');

// Mọi thao tác trên danh sách khách mời mà cả BTC (đăng nhập) lẫn tình nguyện viên
// (link quét, không đăng nhập) cùng làm — quét thiệp, check-in tay, thêm khách tại
// chỗ — đi qua đây để hai trang quét không lệch luật nhau. Hàm trả kết quả dạng
// { ok, status, error, message, guest } để controller tự chọn cách hiển thị khách
// (bản đầy đủ cho BTC, bản che SĐT/email cho tình nguyện viên).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mọi truy vấn khách trả ra cho giao diện đều kèm ghế (guestView đọc từ đây).
const GUEST_INCLUDE = { seats: { select: { seat: true } } };

// SĐT: bỏ khoảng trắng, chấm, gạch, ngoặc; giữ dấu + đầu số quốc tế.
function normalizePhone(raw) {
  const s = String(raw ?? '').trim().replace(/[\s.\-()]/g, '');
  return s || null;
}

// value = các cột của EventGuest (ghi thẳng vào Prisma); seats tách riêng vì nằm ở
// bảng EventGuestSeat. Body không gửi số vé/ghế thì kết quả không có — sửa khách mà
// không gửi thì giữ nguyên. seats = null nghĩa là "không đụng tới ghế".
function normalizeGuestInput(body = {}) {
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const phone = normalizePhone(body.phone);
  const email = String(body.email ?? '').trim().toLowerCase() || null;

  if (name.length < 2) return { error: 'Vui lòng nhập họ tên' };
  if (name.length > 120) return { error: 'Họ tên quá dài (tối đa 120 ký tự)' };
  if (phone && !/^\+?\d{8,15}$/.test(phone)) return { error: 'Số điện thoại không hợp lệ' };
  if (email && (!EMAIL_RE.test(email) || email.length > 200)) return { error: 'Email không hợp lệ' };

  let seats = null;
  if (body.seats !== undefined) {
    const parsed = parseSeatList(body.seats);
    if (parsed.error) return { error: parsed.error };
    seats = parsed.value;
  }
  const value = { name, phone, email };
  if (body.ticketCount !== undefined || seats?.length) {
    const tickets = parseTicketCount(body.ticketCount, seats?.length || 0);
    if (tickets.error) return { error: tickets.error };
    value.ticketCount = tickets.value;
  }
  if (seats && value.ticketCount !== undefined && value.ticketCount < seats.length) {
    return { error: `Số ghế (${seats.length}) nhiều hơn số vé (${value.ticketCount})` };
  }
  return { value, seats };
}

// Khách trùng trong cùng sự kiện = cùng email hoặc cùng SĐT.
function findDuplicate(eventId, { email, phone }, excludeId) {
  const or = [email && { email }, phone && { phone }].filter(Boolean);
  if (!or.length) return null;
  return prisma.eventGuest.findFirst({
    where: { eventId, OR: or, ...(excludeId && { id: { not: excludeId } }) },
    include: GUEST_INCLUDE,
  });
}

function maskPhone(phone) {
  if (!phone) return null;
  if (phone.length <= 5) return '•'.repeat(phone.length);
  return `${phone.slice(0, 3)}${'•'.repeat(phone.length - 6)}${phone.slice(-3)}`;
}

function maskEmail(email) {
  if (!email) return null;
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}•••@${domain}`;
}

// Bản cho BTC: đủ thông tin, kèm link thiệp để gửi tay (Zalo...) cho khách không có email.
function guestView(g) {
  return {
    id: g.id,
    name: g.name,
    phone: g.phone,
    email: g.email,
    isWalkIn: g.isWalkIn,
    ticketCount: g.ticketCount ?? 1,
    seats: guestSeats(g),
    inviteStatus: g.inviteStatus,
    inviteSentAt: g.inviteSentAt,
    checkedInAt: g.checkedInAt,
    checkedInBy: g.checkedInBy,
    createdAt: g.createdAt,
    inviteUrl: invitationUrl(g.code),
    ...(g.answers && { answers: g.answers }),
  };
}

// Bản cho tình nguyện viên (link quét công khai): đủ để đối chiếu người đứng
// trước mặt và chỉ chỗ ngồi, không đủ để chép danh bạ khách mời.
function maskedGuestView(g) {
  return {
    id: g.id,
    name: g.name,
    phone: maskPhone(g.phone),
    email: maskEmail(g.email),
    isWalkIn: g.isWalkIn,
    ticketCount: g.ticketCount ?? 1,
    seats: guestSeats(g),
    checkedInAt: g.checkedInAt,
    checkedInBy: g.checkedInBy,
  };
}

const fail = (status, error, message, guest) => ({ ok: false, status, error, message, guest });

// ── Ghế ────────────────────────────────────────────────────────────────────

// Ghế có gán được trên sơ đồ của sự kiện không. Trả null nếu được, ngược lại là kết
// quả lỗi dạng fail(). Danh sách rỗng (bỏ hết ghế) luôn được.
function validateSeats(event, seats) {
  if (!seats?.length) return null;
  if (!event.seatMap) {
    return fail(400, 'NO_SEAT_MAP', 'Sự kiện chưa có sơ đồ ghế — vào tab "Sơ đồ ghế" để khai báo trước khi gán ghế.');
  }
  const bad = invalidSeats(event.seatMap, seats);
  if (bad.length) {
    return fail(400, 'SEAT_NOT_IN_MAP', `Ghế ${bad.join(', ')} không có trên sơ đồ (hoặc đã bị bỏ).`);
  }
  return null;
}

// Lệnh ghi ghế — đặt chung $transaction với lệnh tạo/sửa khách để không bao giờ có
// khách mà ghế mới ghi được một nửa. seatCreates cho khách mới; seatWrites thay toàn bộ.
function seatCreates(eventId, guestId, seats) {
  return seats.length ? [prisma.eventGuestSeat.createMany({ data: seats.map((seat) => ({ eventId, guestId, seat })) })] : [];
}

function seatWrites(eventId, guestId, seats) {
  return [prisma.eventGuestSeat.deleteMany({ where: { guestId } }), ...seatCreates(eventId, guestId, seats)];
}

// field: chỉ tính khi vi phạm đúng ràng buộc có cột đó (P2002 của email trùng không phải lỗi ghế).
const isUniqueViolation = (err, field) => err?.code === 'P2002'
  && (!field || String(err.meta?.target ?? '').includes(field));

// Sau P2002 trên (eventId, seat): ghế nào đang thuộc ai — để báo đúng người.
async function seatTaken(eventId, seats, guestId) {
  const held = await prisma.eventGuestSeat.findMany({
    where: { eventId, seat: { in: seats }, ...(guestId && { guestId: { not: guestId } }) },
    include: { guest: { select: { name: true } } },
  });
  const message = held.length
    ? held.map((h) => `Ghế ${h.seat} đã thuộc ${h.guest.name}`).join('; ')
    : 'Ghế vừa được gán cho người khác — tải lại sơ đồ rồi thử lại.';
  return fail(409, 'SEAT_TAKEN', message);
}

// Thay ghế của một khách (sơ đồ ghế bấm gán/bỏ/đổi). Không vượt số vé của khách.
async function replaceGuestSeats(event, guestId, rawSeats) {
  const parsed = parseSeatList(rawSeats);
  if (parsed.error) return fail(400, 'INVALID_SEAT', parsed.error);
  const seats = parsed.value;
  const guest = await prisma.eventGuest.findFirst({ where: { id: guestId, eventId: event.id } });
  if (!guest) return fail(404, 'GUEST_NOT_FOUND', 'Không tìm thấy khách');
  if (seats.length > guest.ticketCount) {
    return fail(400, 'SEATS_EXCEED_TICKETS',
      `${guest.name} chỉ có ${guest.ticketCount} vé — tăng số vé ở "Sửa thông tin" trước khi gán thêm ghế.`);
  }
  const invalid = validateSeats(event, seats);
  if (invalid) return invalid;
  try {
    await prisma.$transaction(seatWrites(event.id, guest.id, seats));
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return seatTaken(event.id, seats, guest.id);
  }
  const updated = await prisma.eventGuest.findUnique({ where: { id: guest.id }, include: GUEST_INCLUDE });
  const message = seats.length ? `Ghế của ${guest.name}: ${seats.join(', ')}` : `Đã bỏ gán ghế của ${guest.name}`;
  return { ok: true, status: 200, message, guest: updated };
}

// ── Check-in ───────────────────────────────────────────────────────────────

// Một thiệp nhiều vé: một lần quét cho cả nhóm vào, nên câu báo nêu luôn số người
// và ghế để người đứng cửa chỉ chỗ.
function checkedInMessage(guest) {
  const extra = seatLabel(guest);
  return `Đã check-in: ${guest.name}${extra ? ` · ${extra}` : ''}`;
}

function alreadyCheckedIn(guest) {
  return fail(409, 'ALREADY_CHECKED_IN', `${guest.name} đã check-in lúc ${fmtTime(guest.checkedInAt)}`, guest);
}

// Check-in một khách đã xác định. updateMany có điều kiện checkedInAt = null: hai
// cửa quét cùng một thiệp cùng lúc thì chỉ một bên ghi được, bên kia nhận "đã
// check-in" — giờ check-in không bị ghi đè.
async function checkInGuest(event, guest, actor) {
  if (guest.eventId !== event.id) {
    return fail(409, 'WRONG_EVENT', 'Thiệp này thuộc một sự kiện khác.');
  }
  if (guest.checkedInAt) return alreadyCheckedIn(guest);

  const now = new Date();
  const { count } = await prisma.eventGuest.updateMany({
    where: { id: guest.id, checkedInAt: null },
    data: { checkedInAt: now, checkedInBy: actor },
  });
  if (!count) {
    const fresh = await prisma.eventGuest.findUnique({ where: { id: guest.id }, include: GUEST_INCLUDE });
    return fresh?.checkedInAt ? alreadyCheckedIn(fresh) : fail(404, 'GUEST_NOT_FOUND', 'Khách không còn trong danh sách.');
  }
  const updated = { ...guest, checkedInAt: now, checkedInBy: actor };
  return { ok: true, status: 200, message: checkedInMessage(guest), guest: updated };
}

async function checkInByCode(event, raw, actor) {
  const code = extractGuestCode(raw);
  if (!code) return fail(400, 'INVALID_CODE', 'Đây không phải mã QR trên thiệp mời của hệ thống.');
  const guest = await prisma.eventGuest.findUnique({ where: { code }, include: GUEST_INCLUDE });
  if (!guest) {
    return fail(404, 'GUEST_NOT_FOUND',
      'Không tìm thấy thiệp mời này. Thiệp có thể đã được cấp lại mã, hoặc khách đã bị xoá khỏi danh sách.');
  }
  return checkInGuest(event, guest, actor);
}

async function checkInById(event, guestId, actor) {
  const guest = await prisma.eventGuest.findFirst({ where: { id: guestId, eventId: event.id }, include: GUEST_INCLUDE });
  if (!guest) return fail(404, 'GUEST_NOT_FOUND', 'Khách không còn trong danh sách.');
  return checkInGuest(event, guest, actor);
}

// Khách không có trong danh sách tới cửa: thêm và check-in luôn. Trùng email/SĐT
// với khách đã có thì KHÔNG tạo bản mới — trả khách đó để người quét check-in đúng
// người (thường là khách quên mang thiệp). ticketCount = số người đi cùng nhóm; ghế
// không gán ở cửa (tình nguyện viên không được sửa sơ đồ).
async function addWalkIn(event, body, actor) {
  const input = normalizeGuestInput({ ...body, seats: undefined });
  if (input.error) return fail(400, 'INVALID_GUEST', input.error);
  const dup = await findDuplicate(event.id, input.value);
  if (dup) {
    return fail(409, 'GUEST_EXISTS', `${dup.name} đã có trong danh sách khách mời (trùng email hoặc SĐT).`, dup);
  }
  const guest = await prisma.eventGuest.create({
    data: {
      ...input.value,
      eventId: event.id,
      code: generateGuestCode(),
      isWalkIn: true,
      checkedInAt: new Date(),
      checkedInBy: actor,
    },
    include: GUEST_INCLUDE,
  });
  const people = guest.ticketCount > 1 ? ` · ${guest.ticketCount} người` : '';
  return { ok: true, status: 201, message: `Đã thêm và check-in: ${guest.name}${people}`, guest };
}

// Điều kiện tìm khách theo tên / email / SĐT / mã ghế ("E08" → ai ngồi ghế đó).
function guestSearchWhere(q) {
  const text = String(q ?? '').trim().slice(0, 100);
  if (!text) return {};
  const digits = text.replace(/[\s.\-()]/g, '');
  const seat = normalizeSeat(text);
  return {
    OR: [
      { name: { contains: text, mode: 'insensitive' } },
      { email: { contains: text.toLowerCase() } },
      ...(/^\+?\d{3,}$/.test(digits) ? [{ phone: { contains: digits } }] : []),
      ...(seat ? [{ seats: { some: { seat } } }] : []),
    ],
  };
}

function searchGuests(eventId, q, take = 20) {
  return prisma.eventGuest.findMany({
    where: { eventId, ...guestSearchWhere(q) },
    orderBy: { name: 'asc' },
    take,
    include: GUEST_INCLUDE,
  });
}

// Số liệu cho trang quét và trang sự kiện. Các số đếm theo khách (= theo thiệp/mã QR);
// tickets* đếm theo người (một thiệp nhiều vé) — trang hiển thị "đã tới x/87 người".
// MỘT câu SQL thay vì 8 lệnh count/aggregate: Prisma chỉ giữ 1 kết nối (lib/prisma.js)
// nên 8 lệnh chạy nối đuôi nhau, mỗi lệnh một vòng tới DB — trang quét gọi hàm này
// sau mỗi lượt quét và 10 giây/lần trên mỗi máy, lượt quét kế tiếp phải xếp hàng sau.
async function guestStats(eventId) {
  const [row] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE "checkedInAt" IS NOT NULL)::int AS "checkedIn",
      COUNT(*) FILTER (WHERE "isWalkIn")::int AS "walkIns",
      COUNT(*) FILTER (WHERE NOT "isWalkIn" AND "checkedInAt" IS NOT NULL)::int AS "invitedCheckedIn",
      COALESCE(SUM("ticketCount"), 0)::int AS "tickets",
      COALESCE(SUM("ticketCount") FILTER (WHERE "checkedInAt" IS NOT NULL), 0)::int AS "ticketsCheckedIn",
      COALESCE(SUM("ticketCount") FILTER (WHERE "isWalkIn"), 0)::int AS "walkInTickets",
      (SELECT COUNT(*)::int FROM "attendance_event_guest_seats" WHERE "eventId" = ${eventId}) AS "seatsAssigned"
    FROM "attendance_event_guests"
    WHERE "eventId" = ${eventId}`;
  const {
    total, checkedIn, walkIns, invitedCheckedIn, tickets, ticketsCheckedIn, walkInTickets, seatsAssigned,
  } = row;
  return {
    total,
    checkedIn,
    walkIns,
    invited: total - walkIns,
    invitedCheckedIn,
    tickets,
    ticketsCheckedIn,
    invitedTickets: tickets - walkInTickets,
    seatsAssigned,
  };
}

// Vài lượt check-in mới nhất — để người đứng cửa thấy máy vừa nhận ai.
async function recentCheckins(eventId, take = 8) {
  const rows = await prisma.eventGuest.findMany({
    where: { eventId, checkedInAt: { not: null } },
    orderBy: { checkedInAt: 'desc' },
    take,
    select: { id: true, name: true, isWalkIn: true, ticketCount: true, checkedInAt: true, checkedInBy: true, ...GUEST_INCLUDE },
  });
  return rows.map(({ seats, ...r }) => ({ ...r, seats: guestSeats({ seats }) }));
}

module.exports = {
  GUEST_INCLUDE,
  normalizeGuestInput,
  normalizePhone,
  findDuplicate,
  maskPhone,
  maskEmail,
  guestView,
  maskedGuestView,
  validateSeats,
  seatCreates,
  seatWrites,
  seatTaken,
  isUniqueViolation,
  replaceGuestSeats,
  checkInGuest,
  checkInByCode,
  checkInById,
  addWalkIn,
  guestSearchWhere,
  searchGuests,
  guestStats,
  recentCheckins,
};
