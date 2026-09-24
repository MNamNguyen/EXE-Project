const prisma = require('../lib/prisma');
const { loadEventForWrite } = require('../lib/eventAccess');
const {
  normalizeQuestions, normalizeHeader, validateAnswers, summarizeResponses,
} = require('../lib/feedbackForm');

const TEMPLATE_NOT_FOUND = { success: false, error: 'TEMPLATE_NOT_FOUND', message: 'Không tìm thấy mẫu đánh giá' };
const FEEDBACK_NOT_FOUND = { success: false, error: 'FEEDBACK_NOT_FOUND', message: 'Sự kiện này chưa có form đánh giá' };

function serverError(res, label, err) {
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, message: 'Lỗi server' });
}

// ───────────────────────────────────────────────────────────────
// Thư viện mẫu (ADMIN + BTC dùng chung)
// ───────────────────────────────────────────────────────────────

// Ai cũng dùng được mọi mẫu, nhưng chỉ ADMIN hoặc người tạo mới sửa/xoá —
// cùng quy tắc với sự kiện. Mẫu mồ côi (người tạo đã bị xoá) thì chỉ ADMIN.
function canEditTemplate(user, tpl) {
  return user.role === 'ADMIN' || (!!tpl.createdById && tpl.createdById === user.id);
}

const TEMPLATE_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  _count: { select: { forms: true } },
};

const withCanEdit = (user) => (tpl) => ({ ...tpl, canEdit: canEditTemplate(user, tpl) });

async function listTemplates(req, res) {
  try {
    const { search } = req.query;
    const templates = await prisma.feedbackTemplate.findMany({
      where: search ? { name: { contains: String(search), mode: 'insensitive' } } : {},
      orderBy: { updatedAt: 'desc' },
      include: TEMPLATE_INCLUDE,
    });
    return res.json({ success: true, data: templates.map(withCanEdit(req.user)) });
  } catch (err) {
    return serverError(res, 'List feedback templates', err);
  }
}

async function getTemplate(req, res) {
  try {
    const tpl = await prisma.feedbackTemplate.findUnique({ where: { id: req.params.id }, include: TEMPLATE_INCLUDE });
    if (!tpl) return res.status(404).json(TEMPLATE_NOT_FOUND);
    return res.json({ success: true, data: withCanEdit(req.user)(tpl) });
  } catch (err) {
    return serverError(res, 'Get feedback template', err);
  }
}

async function createTemplate(req, res) {
  try {
    const { name, description, questions } = req.body || {};
    const header = normalizeHeader(name, description, { titleLabel: 'tên mẫu' });
    if (header.error) return res.status(400).json({ success: false, message: header.error });
    const qs = normalizeQuestions(questions);
    if (qs.error) return res.status(400).json({ success: false, message: qs.error });

    const tpl = await prisma.feedbackTemplate.create({
      data: {
        name: header.value.title,
        description: header.value.description,
        questions: qs.value,
        createdById: req.user.id,
      },
      include: TEMPLATE_INCLUDE,
    });
    return res.status(201).json({ success: true, data: withCanEdit(req.user)(tpl) });
  } catch (err) {
    return serverError(res, 'Create feedback template', err);
  }
}

// Sửa mẫu KHÔNG ảnh hưởng form đã gắn vào sự kiện (form giữ bản sao riêng).
async function updateTemplate(req, res) {
  try {
    const tpl = await prisma.feedbackTemplate.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json(TEMPLATE_NOT_FOUND);
    if (!canEditTemplate(req.user, tpl)) {
      return res.status(403).json({ success: false, message: 'Chỉ người tạo mẫu hoặc Admin mới được sửa' });
    }

    const { name, description, questions } = req.body || {};
    const data = {};
    if (name !== undefined || description !== undefined) {
      const header = normalizeHeader(
        name !== undefined ? name : tpl.name,
        description !== undefined ? description : tpl.description,
        { titleLabel: 'tên mẫu' },
      );
      if (header.error) return res.status(400).json({ success: false, message: header.error });
      data.name = header.value.title;
      data.description = header.value.description;
    }
    if (questions !== undefined) {
      const qs = normalizeQuestions(questions);
      if (qs.error) return res.status(400).json({ success: false, message: qs.error });
      data.questions = qs.value;
    }

    const updated = await prisma.feedbackTemplate.update({
      where: { id: tpl.id },
      data,
      include: TEMPLATE_INCLUDE,
    });
    return res.json({ success: true, data: withCanEdit(req.user)(updated) });
  } catch (err) {
    return serverError(res, 'Update feedback template', err);
  }
}

async function deleteTemplate(req, res) {
  try {
    const tpl = await prisma.feedbackTemplate.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json(TEMPLATE_NOT_FOUND);
    if (!canEditTemplate(req.user, tpl)) {
      return res.status(403).json({ success: false, message: 'Chỉ người tạo mẫu hoặc Admin mới được xoá' });
    }
    // Form đã gắn từ mẫu này vẫn giữ nguyên câu hỏi (templateId → NULL).
    await prisma.feedbackTemplate.delete({ where: { id: tpl.id } });
    return res.json({ success: true, message: 'Đã xoá mẫu đánh giá' });
  } catch (err) {
    return serverError(res, 'Delete feedback template', err);
  }
}

// ───────────────────────────────────────────────────────────────
// Form đánh giá của sự kiện (ADMIN hoặc người tạo sự kiện)
// ───────────────────────────────────────────────────────────────

const FORM_INCLUDE = { template: { select: { id: true, name: true } } };

function loadForm(eventId) {
  return prisma.eventFeedbackForm.findUnique({ where: { eventId }, include: FORM_INCLUDE });
}

function countResponses(formId) {
  return prisma.feedbackResponse.count({ where: { formId } });
}

// Chỉ người đã check-out mới được đánh giá (xem spec), nên đây cũng là mẫu số
// của tỉ lệ phản hồi hiển thị cho BTC.
function countEligible(eventId) {
  return prisma.attendance.count({ where: { eventId, status: 'CHECKED_OUT' } });
}

async function getEventForm(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const form = await loadForm(event.id);
    const [responseCount, eligibleCount] = await Promise.all([
      form ? countResponses(form.id) : 0,
      countEligible(event.id),
    ]);
    return res.json({ success: true, data: { form, responseCount, eligibleCount } });
  } catch (err) {
    return serverError(res, 'Get event feedback form', err);
  }
}

// Gắn form (từ mẫu hoặc tự soạn) hoặc thay bộ câu hỏi của form đang có.
// Đã có phiếu trả lời thì khoá câu hỏi: đổi câu hỏi dưới câu trả lời có sẵn sẽ
// làm sai nghĩa dữ liệu (câu "chất lượng diễn giả" thành "chất lượng đồ ăn").
async function upsertEventForm(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const { templateId, title, description, questions, isAnonymous } = req.body || {};

    let source = { title, description, questions };
    let linkedTemplateId = null;
    if (templateId) {
      const tpl = await prisma.feedbackTemplate.findUnique({ where: { id: String(templateId) } });
      if (!tpl) return res.status(404).json(TEMPLATE_NOT_FOUND);
      source = {
        title: title || tpl.name,
        description: description !== undefined ? description : tpl.description,
        questions: tpl.questions,
      };
      linkedTemplateId = tpl.id;
    }

    const header = normalizeHeader(source.title, source.description);
    if (header.error) return res.status(400).json({ success: false, message: header.error });
    const qs = normalizeQuestions(source.questions);
    if (qs.error) return res.status(400).json({ success: false, message: qs.error });

    const existing = await prisma.eventFeedbackForm.findUnique({ where: { eventId: event.id } });
    if (existing && (await countResponses(existing.id)) > 0) {
      return res.status(409).json({
        success: false,
        error: 'FEEDBACK_HAS_RESPONSES',
        message: 'Form đã có người trả lời nên không thể đổi câu hỏi. Bạn vẫn có thể đóng/mở form.',
      });
    }

    const data = {
      templateId: linkedTemplateId,
      title: header.value.title,
      description: header.value.description,
      questions: qs.value,
      ...(isAnonymous !== undefined && { isAnonymous: Boolean(isAnonymous) }),
    };

    const form = existing
      ? await prisma.eventFeedbackForm.update({ where: { id: existing.id }, data, include: FORM_INCLUDE })
      : await prisma.eventFeedbackForm.create({ data: { ...data, eventId: event.id }, include: FORM_INCLUDE });

    return res.status(existing ? 200 : 201).json({ success: true, data: form });
  } catch (err) {
    return serverError(res, 'Upsert event feedback form', err);
  }
}

// Đóng/mở form và bật/tắt ẩn danh — được phép cả khi đã có phiếu, trừ việc TẮT
// ẩn danh: người ta đã trả lời với lời hứa ẩn danh, BTC không được lật lại.
async function updateEventFormState(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const form = await loadForm(event.id);
    if (!form) return res.status(404).json(FEEDBACK_NOT_FOUND);

    const { isOpen, isAnonymous } = req.body || {};
    if ((isOpen !== undefined && typeof isOpen !== 'boolean')
      || (isAnonymous !== undefined && typeof isAnonymous !== 'boolean')) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }

    if (isAnonymous === false && form.isAnonymous && (await countResponses(form.id)) > 0) {
      return res.status(409).json({
        success: false,
        error: 'FEEDBACK_ANONYMITY_LOCKED',
        message: 'Form ẩn danh đã có người trả lời nên không thể tắt ẩn danh.',
      });
    }

    const updated = await prisma.eventFeedbackForm.update({
      where: { id: form.id },
      data: {
        ...(isOpen !== undefined && { isOpen }),
        ...(isAnonymous !== undefined && { isAnonymous }),
      },
      include: FORM_INCLUDE,
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return serverError(res, 'Update event feedback state', err);
  }
}

async function deleteEventForm(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const form = await loadForm(event.id);
    if (!form) return res.status(404).json(FEEDBACK_NOT_FOUND);

    if ((await countResponses(form.id)) > 0) {
      return res.status(409).json({
        success: false,
        error: 'FEEDBACK_HAS_RESPONSES',
        message: 'Form đã có người trả lời nên không thể gỡ. Hãy đóng form thay vì gỡ.',
      });
    }

    await prisma.eventFeedbackForm.delete({ where: { id: form.id } });
    return res.json({ success: true, message: 'Đã gỡ form đánh giá' });
  } catch (err) {
    return serverError(res, 'Delete event feedback form', err);
  }
}

async function getEventResults(req, res) {
  try {
    const event = await loadEventForWrite(req, res);
    if (!event) return;

    const form = await loadForm(event.id);
    if (!form) return res.status(404).json(FEEDBACK_NOT_FOUND);

    // Form ẩn danh: không select user ngay từ query, để dữ liệu định danh không
    // bao giờ đi qua tầng này dù sau này có ai sửa hàm tổng hợp.
    const [responses, eligibleCount] = await Promise.all([
      prisma.feedbackResponse.findMany({
        where: { formId: form.id },
        orderBy: { updatedAt: 'asc' },
        select: {
          answers: true,
          updatedAt: true,
          ...(!form.isAnonymous && { user: { select: { name: true, mssv: true, class: true } } }),
        },
      }),
      countEligible(event.id),
    ]);

    const summary = summarizeResponses(form.questions, responses, { anonymous: form.isAnonymous });
    return res.json({
      success: true,
      data: {
        form: { id: form.id, title: form.title, description: form.description, isAnonymous: form.isAnonymous, isOpen: form.isOpen },
        eligibleCount,
        ...summary,
      },
    });
  } catch (err) {
    return serverError(res, 'Get event feedback results', err);
  }
}

// ───────────────────────────────────────────────────────────────
// Người tham dự gửi đánh giá
// ───────────────────────────────────────────────────────────────

async function loadRespondentContext(eventId, userId) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, isActive: true },
    select: { id: true, name: true, location: true, checkinOpen: true },
  });
  if (!event) return { event: null };

  const [form, attendance] = await Promise.all([
    prisma.eventFeedbackForm.findUnique({ where: { eventId } }),
    prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: { status: true },
    }),
  ]);
  return { event, form, attendance };
}

// Lý do không được gửi, theo đúng thứ tự kiểm tra của submitResponse.
function ineligibleReason(form, attendance) {
  if (!form.isOpen) return 'FEEDBACK_CLOSED';
  if (attendance?.status !== 'CHECKED_OUT') return 'FEEDBACK_NOT_ELIGIBLE';
  return null;
}

const REJECTIONS = {
  FEEDBACK_CLOSED: 'Form đánh giá đang đóng.',
  FEEDBACK_NOT_ELIGIBLE: 'Chỉ người đã check-out khỏi sự kiện mới được gửi đánh giá.',
};

async function getMyResponse(req, res) {
  try {
    const { event, form, attendance } = await loadRespondentContext(req.params.id, req.user.id);
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    if (!form) return res.status(404).json(FEEDBACK_NOT_FOUND);

    const mine = await prisma.feedbackResponse.findUnique({
      where: { formId_userId: { formId: form.id, userId: req.user.id } },
      select: { answers: true, updatedAt: true },
    });
    const reason = ineligibleReason(form, attendance);

    return res.json({
      success: true,
      data: {
        event,
        form: {
          id: form.id,
          title: form.title,
          description: form.description,
          questions: form.questions,
          isAnonymous: form.isAnonymous,
          isOpen: form.isOpen,
        },
        myResponse: mine,
        canSubmit: !reason,
        reason,
        reasonMessage: reason ? REJECTIONS[reason] : null,
      },
    });
  } catch (err) {
    return serverError(res, 'Get my feedback', err);
  }
}

// Gửi hoặc sửa phiếu của chính mình (mỗi người một phiếu, sửa được khi form còn mở).
async function submitResponse(req, res) {
  try {
    const userId = req.user.id;
    const { event, form, attendance } = await loadRespondentContext(req.params.id, userId);
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    if (!form) return res.status(404).json(FEEDBACK_NOT_FOUND);

    const reason = ineligibleReason(form, attendance);
    if (reason) {
      return res.status(403).json({ success: false, error: reason, message: REJECTIONS[reason] });
    }

    const checked = validateAnswers(form.questions, req.body?.answers);
    if (checked.error) {
      return res.status(400).json({ success: false, error: 'INVALID_ANSWERS', message: checked.error });
    }

    const key = { formId_userId: { formId: form.id, userId } };
    const existing = await prisma.feedbackResponse.findUnique({ where: key, select: { id: true } });
    const saved = await prisma.feedbackResponse.upsert({
      where: key,
      create: { formId: form.id, userId, answers: checked.value },
      update: { answers: checked.value },
      select: { answers: true, updatedAt: true },
    });

    return res.status(existing ? 200 : 201).json({
      success: true,
      updated: !!existing,
      data: saved,
      message: existing ? 'Đã cập nhật đánh giá của bạn' : 'Cảm ơn bạn đã gửi đánh giá!',
    });
  } catch (err) {
    return serverError(res, 'Submit feedback', err);
  }
}

module.exports = {
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  getEventForm, upsertEventForm, updateEventFormState, deleteEventForm, getEventResults,
  getMyResponse, submitResponse,
};
