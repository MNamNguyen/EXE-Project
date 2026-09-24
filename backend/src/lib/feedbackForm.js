const crypto = require('crypto');
const prisma = require('./prisma');

// Câu hỏi của mẫu và của form sự kiện có cùng một hình dạng:
//   { id, type: 'TEXT' | 'RATING', label, required }
// Được lưu dạng JSON nên DB không ràng buộc gì — mọi đường ghi (tạo/sửa mẫu,
// gắn form, gửi phiếu) PHẢI đi qua các hàm ở đây.

const QUESTION_TYPES = ['TEXT', 'RATING'];
const MAX_QUESTIONS = 30;
const MAX_LABEL = 500;
const MAX_TEXT_ANSWER = 2000;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function newQuestionId() {
  return 'q_' + crypto.randomBytes(4).toString('hex');
}

// Chuẩn hoá danh sách câu hỏi từ client. Giữ nguyên id hợp lệ (để frontend
// sửa lại đúng câu), sinh id mới cho câu thiếu/trùng. Trả { value } hoặc { error }.
function normalizeQuestions(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: 'Form phải có ít nhất 1 câu hỏi' };
  }
  if (input.length > MAX_QUESTIONS) {
    return { error: `Form tối đa ${MAX_QUESTIONS} câu hỏi` };
  }

  const seen = new Set();
  const value = [];
  for (let i = 0; i < input.length; i++) {
    const q = input[i] || {};
    const type = typeof q.type === 'string' ? q.type.toUpperCase() : '';
    if (!QUESTION_TYPES.includes(type)) {
      return { error: `Câu ${i + 1}: loại câu hỏi không hợp lệ` };
    }
    const label = typeof q.label === 'string' ? q.label.trim() : '';
    if (!label) {
      return { error: `Câu ${i + 1}: chưa nhập nội dung câu hỏi` };
    }
    if (label.length > MAX_LABEL) {
      return { error: `Câu ${i + 1}: nội dung tối đa ${MAX_LABEL} ký tự` };
    }

    let id = typeof q.id === 'string' && ID_RE.test(q.id) && !seen.has(q.id) ? q.id : null;
    while (!id || seen.has(id)) id = newQuestionId();
    seen.add(id);

    value.push({ id, type, label, required: q.required !== false });
  }
  return { value };
}

// Tiêu đề + mô tả dùng chung cho mẫu (name) và form (title).
function normalizeHeader(title, description, { titleLabel = 'tiêu đề' } = {}) {
  const t = typeof title === 'string' ? title.trim() : '';
  if (!t) return { error: `Vui lòng nhập ${titleLabel}` };
  if (t.length > MAX_TITLE) return { error: `${titleLabel[0].toUpperCase()}${titleLabel.slice(1)} tối đa ${MAX_TITLE} ký tự` };

  const d = typeof description === 'string' ? description.trim() : '';
  if (d.length > MAX_DESCRIPTION) return { error: `Mô tả tối đa ${MAX_DESCRIPTION} ký tự` };

  return { value: { title: t, description: d || null } };
}

// Kiểm tra phiếu trả lời theo đúng bộ câu hỏi của form. Khoá lạ bị bỏ qua,
// câu không bắt buộc bỏ trống thì không lưu. Trả { value } hoặc { error }.
function validateAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { error: 'Dữ liệu trả lời không hợp lệ' };
  }

  const value = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const raw = answers[q.id];
    const n = i + 1;

    if (q.type === 'RATING') {
      if (raw === undefined || raw === null || raw === '') {
        if (q.required) return { error: `Câu ${n}: vui lòng chọn số sao` };
        continue;
      }
      const num = Number(raw);
      if (!Number.isInteger(num) || num < 1 || num > 5) {
        return { error: `Câu ${n}: số sao phải từ 1 đến 5` };
      }
      value[q.id] = num;
    } else {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) {
        if (q.required) return { error: `Câu ${n}: vui lòng nhập câu trả lời` };
        continue;
      }
      if (text.length > MAX_TEXT_ANSWER) {
        return { error: `Câu ${n}: câu trả lời tối đa ${MAX_TEXT_ANSWER} ký tự` };
      }
      value[q.id] = text;
    }
  }
  return { value };
}

// Tổng hợp kết quả cho BTC. responses: [{ answers, updatedAt, user? }].
// Form ẩn danh thì KHÔNG kèm thông tin người gửi ở bất kỳ đâu — kể cả thứ tự
// câu trả lời văn bản cũng không theo thời gian gửi, tránh đoán ra ai viết gì
// khi đối chiếu với giờ check-out.
function summarizeResponses(questions, responses, { anonymous }) {
  const summary = questions.map((q) => {
    if (q.type === 'RATING') {
      const distribution = [0, 0, 0, 0, 0];
      let sum = 0;
      let count = 0;
      for (const r of responses) {
        const v = r.answers?.[q.id];
        if (Number.isInteger(v) && v >= 1 && v <= 5) {
          distribution[v - 1] += 1;
          sum += v;
          count += 1;
        }
      }
      return {
        ...q,
        count,
        average: count ? Math.round((sum / count) * 100) / 100 : null,
        distribution,
      };
    }

    const answers = [];
    for (const r of responses) {
      const v = r.answers?.[q.id];
      if (typeof v !== 'string' || !v) continue;
      answers.push(anonymous
        ? { text: v }
        : {
            text: v,
            name: r.user?.name || '(Tài khoản đã xoá)',
            mssv: r.user?.mssv || null,
            submittedAt: r.updatedAt,
          });
    }
    if (anonymous) answers.sort((a, b) => a.text.localeCompare(b.text, 'vi'));
    return { ...q, count: answers.length, answers };
  });

  const result = { responseCount: responses.length, questions: summary };
  // Form có tên: BTC xem được nguyên phiếu của từng người.
  if (!anonymous) {
    result.responses = responses.map((r) => ({
      name: r.user?.name || '(Tài khoản đã xoá)',
      mssv: r.user?.mssv || null,
      class: r.user?.class || null,
      submittedAt: r.updatedAt,
      answers: r.answers || {},
    }));
  }
  return result;
}

// Gắn vào response check-out để trang quét mã hiện form đánh giá ngay lập tức.
// null = không có gì để hỏi (chưa có form hoặc form đang đóng). Best-effort:
// lượt check-out đã ghi xong, lỗi tra cứu ở đây không được làm hỏng response.
async function feedbackPromptFor(eventId, userId) {
  try {
    const form = await prisma.eventFeedbackForm.findUnique({
      where: { eventId },
      select: { id: true, isOpen: true },
    });
    if (!form?.isOpen) return null;
    const mine = await prisma.feedbackResponse.findUnique({
      where: { formId_userId: { formId: form.id, userId } },
      select: { id: true },
    });
    return { isOpen: true, submitted: !!mine };
  } catch (err) {
    console.error('Feedback prompt lookup failed:', err.message);
    return null;
  }
}

module.exports = {
  feedbackPromptFor,
  QUESTION_TYPES,
  MAX_QUESTIONS,
  normalizeQuestions,
  normalizeHeader,
  validateAnswers,
  summarizeResponses,
};
