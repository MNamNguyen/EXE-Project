const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { inlineHeader } = require('../lib/contentDisposition');
const {
  DEFAULT_FIELDS, normalizeFields, withAllFields, invitationValues, invitationUrl,
} = require('../lib/invitationLayout');
const { guestSeats } = require('../lib/seatMap');
const {
  GUEST_INCLUDE, maskedGuestView, checkInByCode, checkInById, addWalkIn, searchGuests,
} = require('../lib/guestCheckin');
const { inspectTemplateImage } = require('../services/certificatePdf');
const { renderInvitationsPdf } = require('../services/invitationPdf');
const {
  loadInvitationEvent, sendResult, scannerSummary, loadTemplate, pdfItem, sendPdf,
} = require('./guest.controller');

// Mẫu thiệp mời, link quét cho tình nguyện viên, và các endpoint công khai của
// sự kiện thiệp mời (trang xem thiệp của khách, trang quét qua link).

const MIN_IMAGE_SIDE = 500;
const TEMPLATE_META = { mimeType: true, width: true, height: true, fields: true, updatedAt: true };

function serverError(res, label, err) {
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, message: 'Lỗi server' });
}

// ── Mẫu thiệp (BTC) ──────────────────────────────────────────────────────

async function getInvitationTemplate(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const template = await prisma.eventInvitationTemplate.findUnique({ where: { eventId: event.id }, select: TEMPLATE_META });
    return res.json({ success: true, data: { template: withAllFields(template) } });
  } catch (err) {
    return serverError(res, 'Get invitation template', err);
  }
}

async function getInvitationTemplateImage(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const tpl = await prisma.eventInvitationTemplate.findUnique({
      where: { eventId: event.id },
      select: { image: true, mimeType: true },
    });
    if (!tpl) return res.status(404).json({ success: false, error: 'NO_TEMPLATE', message: 'Sự kiện chưa có mẫu thiệp' });
    res.set('Content-Type', tpl.mimeType);
    res.set('Cache-Control', 'private, no-cache');
    return res.send(Buffer.from(tpl.image));
  } catch (err) {
    return serverError(res, 'Get invitation image', err);
  }
}

// Upload/đổi ảnh nền. Đổi ảnh thì GIỮ bố cục đang có (thường chỉ sửa thiết kế nền).
async function uploadInvitationTemplateImage(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ success: false, message: 'Chưa chọn file ảnh' });
    }
    const info = await inspectTemplateImage(req.file.buffer);
    if (info.error) return res.status(400).json({ success: false, message: info.error });
    const { mimeType, width, height } = info.value;
    if (Math.min(width, height) < MIN_IMAGE_SIDE) {
      return res.status(400).json({
        success: false,
        message: `Ảnh quá nhỏ (${width}×${height}px) — cần tối thiểu ${MIN_IMAGE_SIDE}px mỗi chiều để in rõ`,
      });
    }
    const template = await prisma.eventInvitationTemplate.upsert({
      where: { eventId: event.id },
      create: { eventId: event.id, image: req.file.buffer, mimeType, width, height, fields: DEFAULT_FIELDS, updatedById: req.user.id },
      update: { image: req.file.buffer, mimeType, width, height, updatedById: req.user.id },
      select: TEMPLATE_META,
    });
    return res.json({ success: true, data: { template }, message: 'Đã lưu ảnh nền thiệp mời' });
  } catch (err) {
    return serverError(res, 'Upload invitation image', err);
  }
}

async function saveInvitationTemplateFields(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const exists = await prisma.eventInvitationTemplate.findUnique({ where: { eventId: event.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ success: false, error: 'NO_TEMPLATE', message: 'Hãy upload ảnh nền trước' });

    const fields = normalizeFields(req.body?.fields);
    if (fields.error) return res.status(400).json({ success: false, message: fields.error });

    const template = await prisma.eventInvitationTemplate.update({
      where: { eventId: event.id },
      data: { fields: fields.value, updatedById: req.user.id },
      select: TEMPLATE_META,
    });
    return res.json({ success: true, data: { template }, message: 'Đã lưu bố cục thiệp mời' });
  } catch (err) {
    return serverError(res, 'Save invitation fields', err);
  }
}

// Gỡ mẫu = quay về thiệp mặc định. Khác chứng nhận, gỡ lúc nào cũng được: thiệp
// vẽ lại mỗi lần tải nên thiệp đã gửi vẫn mở được (chỉ đổi sang mẫu mặc định).
async function deleteInvitationTemplate(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    await prisma.eventInvitationTemplate.deleteMany({ where: { eventId: event.id } });
    return res.json({ success: true, message: 'Đã gỡ mẫu — thiệp sẽ dùng mẫu mặc định' });
  } catch (err) {
    return serverError(res, 'Delete invitation template', err);
  }
}

// Xem thử với tên mẫu — kể cả khi chưa upload (xem thiệp mặc định).
async function previewInvitation(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const name = typeof req.query.name === 'string' && req.query.name.trim()
      ? req.query.name.trim().slice(0, 100)
      : 'Nguyễn Văn A';
    const sample = { name, code: 'XEM-THU-KHONG-DUNG-DUOC', ticketCount: 2, seats: ['E08', 'E09'] };
    const pdf = await renderInvitationsPdf(await loadTemplate(event.id), [pdfItem(sample, event)], {
      title: `Xem thử thiệp mời - ${event.name}`,
    });
    return sendPdf(res, pdf, `xem-thu-thiep-moi-${event.name}`, true);
  } catch (err) {
    return serverError(res, 'Preview invitation', err);
  }
}

// ── Link quét cho tình nguyện viên (BTC quản lý) ─────────────────────────
// Token ngẫu nhiên lưu ở cột Event.scannerToken (thu hồi = set NULL, link chết
// ngay) — cùng cách làm với link chia sẻ báo cáo.

function scannerUrl(token) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/quet/${token}`;
}

function scannerState(event) {
  return {
    shared: Boolean(event.scannerToken),
    url: event.scannerToken ? scannerUrl(event.scannerToken) : null,
    sharedAt: event.scannerSharedAt,
  };
}

async function getScannerLink(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    return res.json({ success: true, data: scannerState(event) });
  } catch (err) {
    return serverError(res, 'Get scanner link', err);
  }
}

// Tạo link, hoặc trả lại link đang có (bấm nhiều lần không làm chết link đã phát).
// `?rotate=1` mới cấp link mới.
async function createScannerLink(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const rotate = req.query.rotate === '1' || req.query.rotate === 'true';
    if (event.scannerToken && !rotate) return res.json({ success: true, data: scannerState(event) });

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { scannerToken: crypto.randomBytes(24).toString('base64url'), scannerSharedAt: new Date() },
      select: { scannerToken: true, scannerSharedAt: true },
    });
    return res.json({ success: true, data: scannerState(updated) });
  } catch (err) {
    return serverError(res, 'Create scanner link', err);
  }
}

async function revokeScannerLink(req, res) {
  try {
    const event = await loadInvitationEvent(req, res);
    if (!event) return;
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { scannerToken: null, scannerSharedAt: null },
      select: { scannerToken: true, scannerSharedAt: true },
    });
    return res.json({ success: true, data: scannerState(updated) });
  } catch (err) {
    return serverError(res, 'Revoke scanner link', err);
  }
}

// ── Công khai: tình nguyện viên quét qua link ────────────────────────────

// Token sai, đã thu hồi, hay sự kiện đã xoá đều trả cùng một 404 — không tiết lộ
// token nào từng tồn tại.
async function loadScannerEvent(req, res) {
  const token = String(req.params.token || '');
  const event = token.length >= 16
    ? await prisma.event.findUnique({ where: { scannerToken: token } })
    : null;
  if (!event || !event.isActive || event.kind !== 'INVITATION') {
    res.status(404).json({
      success: false,
      error: 'SCANNER_NOT_FOUND',
      message: 'Link quét không tồn tại hoặc đã bị Ban tổ chức thu hồi',
    });
    return null;
  }
  return event;
}

// Tình nguyện viên tự gõ tên (lưu ở máy họ) để BTC biết ai đã cho khách vào.
function volunteerActor(req) {
  const name = String(req.body?.scannerName || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return name ? `${name} (link quét)` : 'Link quét';
}

async function publicScannerSummary(req, res) {
  try {
    const event = await loadScannerEvent(req, res);
    if (!event) return;
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: await scannerSummary(event) });
  } catch (err) {
    return serverError(res, 'Public scanner summary', err);
  }
}

async function publicScan(req, res) {
  try {
    const event = await loadScannerEvent(req, res);
    if (!event) return;
    return sendResult(res, await checkInByCode(event, req.body?.code, volunteerActor(req)), maskedGuestView);
  } catch (err) {
    return serverError(res, 'Public scan', err);
  }
}

async function publicSearchGuests(req, res) {
  try {
    const event = await loadScannerEvent(req, res);
    if (!event) return;
    // Bắt buộc gõ ít nhất 2 ký tự: link quét không phải chỗ để xem cả danh sách.
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, data: [] });
    const guests = await searchGuests(event.id, q, 15);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: guests.map(maskedGuestView) });
  } catch (err) {
    return serverError(res, 'Public search guests', err);
  }
}

async function publicCheckInGuest(req, res) {
  try {
    const event = await loadScannerEvent(req, res);
    if (!event) return;
    return sendResult(res, await checkInById(event, req.params.guestId, volunteerActor(req)), maskedGuestView);
  } catch (err) {
    return serverError(res, 'Public guest check-in', err);
  }
}

async function publicWalkIn(req, res) {
  try {
    const event = await loadScannerEvent(req, res);
    if (!event) return;
    return sendResult(res, await addWalkIn(event, req.body, volunteerActor(req)), maskedGuestView);
  } catch (err) {
    return serverError(res, 'Public walk-in', err);
  }
}

// ── Công khai: khách xem thiệp của mình ──────────────────────────────────

async function loadGuestByCode(req, res) {
  const code = String(req.params.code || '');
  const guest = /^[A-Za-z0-9_-]{16,64}$/.test(code)
    ? await prisma.eventGuest.findUnique({ where: { code }, include: { event: true, ...GUEST_INCLUDE } })
    : null;
  if (!guest || !guest.event.isActive) {
    res.status(404).json({
      success: false,
      error: 'INVITATION_NOT_FOUND',
      message: 'Thiệp mời không tồn tại hoặc đã được Ban tổ chức cấp lại',
    });
    return null;
  }
  return guest;
}

async function getPublicInvitation(req, res) {
  try {
    const guest = await loadGuestByCode(req, res);
    if (!guest) return;
    const { event } = guest;
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        guest: { name: guest.name, checkedInAt: guest.checkedInAt, ticketCount: guest.ticketCount, seats: guestSeats(guest) },
        event: { name: event.name, description: event.description, location: event.location, startsAt: event.startsAt },
        values: invitationValues(guest, event),
        qrText: invitationUrl(guest.code),
      },
    });
  } catch (err) {
    return serverError(res, 'Get public invitation', err);
  }
}

async function getPublicInvitationPdf(req, res) {
  try {
    const guest = await loadGuestByCode(req, res);
    if (!guest) return;
    const pdf = await renderInvitationsPdf(await loadTemplate(guest.eventId), [pdfItem(guest, guest.event)], {
      title: `Thiệp mời - ${guest.name} - ${guest.event.name}`,
    });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', inlineHeader(`thiep-moi-${guest.event.name}`, 'pdf'));
    res.set('Cache-Control', 'no-store');
    return res.send(Buffer.from(pdf));
  } catch (err) {
    return serverError(res, 'Get public invitation pdf', err);
  }
}

module.exports = {
  getInvitationTemplate,
  getInvitationTemplateImage,
  uploadInvitationTemplateImage,
  saveInvitationTemplateFields,
  deleteInvitationTemplate,
  previewInvitation,
  getScannerLink,
  createScannerLink,
  revokeScannerLink,
  publicScannerSummary,
  publicScan,
  publicSearchGuests,
  publicCheckInGuest,
  publicWalkIn,
  getPublicInvitation,
  getPublicInvitationPdf,
};
