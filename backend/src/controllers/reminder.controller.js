const prisma = require('../lib/prisma');
const { loadEventForWrite } = require('../lib/eventAccess');
const {
  MANUAL_COOLDOWN_MS, MAX_NOTE, loadRecipients, countRecipients, runDelivery,
} = require('../lib/eventReminder');

function serverError(res, label, err) {
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, message: 'Lỗi server' });
}

function lastReminder(eventId) {
  return prisma.eventReminder.findFirst({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
}

async function getReminders(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const now = new Date();
    const [history, recipientCount, last] = await Promise.all([
      prisma.eventReminder.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { triggeredBy: { select: { name: true } } },
      }),
      countRecipients(event.id),
      lastReminder(event.id),
    ]);

    const cooldownUntil = last
      ? new Date(new Date(last.createdAt).getTime() + MANUAL_COOLDOWN_MS)
      : null;

    return res.json({
      success: true,
      data: {
        checkinOpen: event.checkinOpen,
        recipientCount,
        history,
        cooldownUntil: cooldownUntil && cooldownUntil > now ? cooldownUntil : null,
      },
    });
  } catch (err) {
    return serverError(res, 'Get reminders', err);
  }
}

// "Gửi nhắc ngay": trả 202 ngay khi đã ghi nhật ký rồi gửi nền — danh sách vài
// trăm người mất cả chục giây, vượt timeout của frontend và api.js sẽ tự gửi lại
// request (lượt thứ hai bị chặn bởi thời gian chờ, nhưng BTC lại thấy báo lỗi).
async function sendReminderNow(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;
    if (!event.isActive) {
      return res.status(400).json({ success: false, message: 'Sự kiện đã bị xoá' });
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (note.length > MAX_NOTE) {
      return res.status(400).json({ success: false, message: `Lời nhắn tối đa ${MAX_NOTE} ký tự` });
    }

    const now = new Date();
    const last = await lastReminder(event.id);
    const sinceLast = last ? now - new Date(last.createdAt) : Infinity;
    if (sinceLast < MANUAL_COOLDOWN_MS) {
      const waitMin = Math.ceil((MANUAL_COOLDOWN_MS - sinceLast) / 60_000);
      return res.status(429).json({
        success: false,
        error: 'REMINDER_COOLDOWN',
        message: `Vừa gửi nhắc lịch cho sự kiện này. Vui lòng chờ ${waitMin} phút nữa.`,
      });
    }

    const recipients = await loadRecipients(event.id);
    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_RECIPIENTS',
        message: 'Không có ai để nhắc: chưa có người đăng ký hoặc tất cả đã check-in.',
      });
    }

    const claim = await prisma.eventReminder.create({
      data: {
        eventId: event.id,
        note: note || null,
        triggeredById: req.user.id,
      },
    });

    res.status(202).json({
      success: true,
      data: { id: claim.id, recipientCount: recipients.length },
      message: `Đang gửi nhắc lịch tới ${recipients.length} người`,
    });

    // runDelivery tự bắt lỗi và ghi trạng thái FAILED — không có gì ném ra ở đây.
    runDelivery(claim.id, event, recipients, { now, note: note || null });
  } catch (err) {
    return serverError(res, 'Send reminder now', err);
  }
}

module.exports = { getReminders, sendReminderNow };
