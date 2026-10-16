const prisma = require('./prisma');
const { fmtTime } = require('./datetime');
const { extractGuestCode, generateGuestCode, invitationUrl } = require('./invitationLayout');

// Mọi thao tác trên danh sách khách mời mà cả BTC (đăng nhập) lẫn tình nguyện viên
// (link quét, không đăng nhập) cùng làm — quét thiệp, check-in tay, thêm khách tại
// chỗ — đi qua đây để hai trang quét không lệch luật nhau. Hàm trả kết quả dạng
// { ok, status, error, message, guest } để controller tự chọn cách hiển thị khách
// (bản đầy đủ cho BTC, bản che SĐT/email cho tình nguyện viên).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SĐT: bỏ khoảng trắng, chấm, gạch, ngoặc; giữ dấu + đầu số quốc tế.
function normalizePhone(raw) {
  const s = String(raw ?? '').trim().replace(/[\s.\-()]/g, '');
  return s || null;
}

function normalizeGuestInput(body = {}) {
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const phone = normalizePhone(body.phone);
  const email = String(body.email ?? '').trim().toLowerCase() || null;

  if (name.length < 2) return { error: 'Vui lòng nhập họ tên' };
  if (name.length > 120) return { error: 'Họ tên quá dài (tối đa 120 ký tự)' };
  if (phone && !/^\+?\d{8,15}$/.test(phone)) return { error: 'Số điện thoại không hợp lệ' };
  if (email && (!EMAIL_RE.test(email) || email.length > 200)) return { error: 'Email không hợp lệ' };
  return { value: { name, phone, email } };
}

// Khách trùng trong cùng sự kiện = cùng email hoặc cùng SĐT.
function findDuplicate(eventId, { email, phone }, excludeId) {
  const or = [email && { email }, phone && { phone }].filter(Boolean);
  if (!or.length) return null;
  return prisma.eventGuest.findFirst({
    where: { eventId, OR: or, ...(excludeId && { id: { not: excludeId } }) },
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
// trước mặt, không đủ để chép danh bạ khách mời.
function maskedGuestView(g) {
  return {
    id: g.id,
    name: g.name,
    phone: maskPhone(g.phone),
    email: maskEmail(g.email),
    isWalkIn: g.isWalkIn,
    checkedInAt: g.checkedInAt,
    checkedInBy: g.checkedInBy,
  };
}

const fail = (status, error, message, guest) => ({ ok: false, status, error, message, guest });

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
    const fresh = await prisma.eventGuest.findUnique({ where: { id: guest.id } });
    return fresh?.checkedInAt ? alreadyCheckedIn(fresh) : fail(404, 'GUEST_NOT_FOUND', 'Khách không còn trong danh sách.');
  }
  const updated = { ...guest, checkedInAt: now, checkedInBy: actor };
  return { ok: true, status: 200, message: `Đã check-in: ${guest.name}`, guest: updated };
}

async function checkInByCode(event, raw, actor) {
  const code = extractGuestCode(raw);
  if (!code) return fail(400, 'INVALID_CODE', 'Đây không phải mã QR trên thiệp mời của hệ thống.');
  const guest = await prisma.eventGuest.findUnique({ where: { code } });
  if (!guest) {
    return fail(404, 'GUEST_NOT_FOUND',
      'Không tìm thấy thiệp mời này. Thiệp có thể đã được cấp lại mã, hoặc khách đã bị xoá khỏi danh sách.');
  }
  return checkInGuest(event, guest, actor);
}

async function checkInById(event, guestId, actor) {
  const guest = await prisma.eventGuest.findFirst({ where: { id: guestId, eventId: event.id } });
  if (!guest) return fail(404, 'GUEST_NOT_FOUND', 'Khách không còn trong danh sách.');
  return checkInGuest(event, guest, actor);
}

// Khách không có trong danh sách tới cửa: thêm và check-in luôn. Trùng email/SĐT
// với khách đã có thì KHÔNG tạo bản mới — trả khách đó để người quét check-in đúng
// người (thường là khách quên mang thiệp).
async function addWalkIn(event, body, actor) {
  const input = normalizeGuestInput(body);
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
  });
  return { ok: true, status: 201, message: `Đã thêm và check-in: ${guest.name}`, guest };
}

function searchGuests(eventId, q, take = 20) {
  const text = String(q ?? '').trim().slice(0, 100);
  const digits = text.replace(/[\s.\-()]/g, '');
  return prisma.eventGuest.findMany({
    where: {
      eventId,
      ...(text && {
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { email: { contains: text.toLowerCase() } },
          ...(/^\+?\d{3,}$/.test(digits) ? [{ phone: { contains: digits } }] : []),
        ],
      }),
    },
    orderBy: { name: 'asc' },
    take,
  });
}

// Số liệu cho trang quét và trang sự kiện.
async function guestStats(eventId) {
  const [total, checkedIn, walkIns, invitedCheckedIn] = await Promise.all([
    prisma.eventGuest.count({ where: { eventId } }),
    prisma.eventGuest.count({ where: { eventId, checkedInAt: { not: null } } }),
    prisma.eventGuest.count({ where: { eventId, isWalkIn: true } }),
    prisma.eventGuest.count({ where: { eventId, isWalkIn: false, checkedInAt: { not: null } } }),
  ]);
  return { total, checkedIn, walkIns, invited: total - walkIns, invitedCheckedIn };
}

// Vài lượt check-in mới nhất — để người đứng cửa thấy máy vừa nhận ai.
async function recentCheckins(eventId, take = 8) {
  const rows = await prisma.eventGuest.findMany({
    where: { eventId, checkedInAt: { not: null } },
    orderBy: { checkedInAt: 'desc' },
    take,
    select: { id: true, name: true, isWalkIn: true, checkedInAt: true, checkedInBy: true },
  });
  return rows;
}

module.exports = {
  normalizeGuestInput,
  normalizePhone,
  findDuplicate,
  maskPhone,
  maskEmail,
  guestView,
  maskedGuestView,
  checkInGuest,
  checkInByCode,
  checkInById,
  addWalkIn,
  searchGuests,
  guestStats,
  recentCheckins,
};
