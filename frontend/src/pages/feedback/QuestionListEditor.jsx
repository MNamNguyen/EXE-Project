import { Star, AlignLeft, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';

export const QUESTION_TYPE_META = {
  RATING: { label: 'Đánh giá sao (1–5)', icon: Star, color: 'text-amber-600 bg-amber-50' },
  TEXT: { label: 'Trả lời văn bản', icon: AlignLeft, color: 'text-primary-600 bg-primary-50' },
};

// id sinh ở client để key React ổn định khi sắp xếp; backend giữ nguyên id hợp lệ
// (lib/feedbackForm.js#normalizeQuestions) nên không bị đổi sau khi lưu.
export function newQuestion(type) {
  return { id: `q_${Math.random().toString(16).slice(2, 10)}`, type, label: '', required: true };
}

// Trình soạn danh sách câu hỏi dùng chung cho mẫu đánh giá và form tự soạn của sự kiện.
export default function QuestionListEditor({ questions, onChange, disabled = false }) {
  const update = (idx, patch) => onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  const remove = (idx) => onChange(questions.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
          Chưa có câu hỏi nào — thêm câu hỏi bên dưới.
        </p>
      )}

      {questions.map((q, idx) => {
        const meta = QUESTION_TYPE_META[q.type];
        const Icon = meta.icon;
        return (
          <div key={q.id} className="rounded-xl border border-border p-3 space-y-2.5 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-6">{idx + 1}.</span>
              <select
                className="input py-1.5 text-xs w-auto"
                value={q.type}
                disabled={disabled}
                onChange={(e) => update(idx, { type: e.target.value })}
              >
                {Object.entries(QUESTION_TYPE_META).map(([value, m]) => (
                  <option key={value} value={value}>{m.label}</option>
                ))}
              </select>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                <Icon size={14} />
              </span>
              <div className="flex-1" />
              <button type="button" disabled={disabled || idx === 0} onClick={() => move(idx, -1)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30" title="Lên trên">
                <ArrowUp size={14} />
              </button>
              <button type="button" disabled={disabled || idx === questions.length - 1} onClick={() => move(idx, 1)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30" title="Xuống dưới">
                <ArrowDown size={14} />
              </button>
              <button type="button" disabled={disabled} onClick={() => remove(idx)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30" title="Xoá câu hỏi">
                <Trash2 size={14} />
              </button>
            </div>
            <textarea
              className="input resize-none text-sm"
              rows={2}
              maxLength={500}
              disabled={disabled}
              placeholder={q.type === 'RATING' ? 'VD: Bạn đánh giá chất lượng diễn giả thế nào?' : 'VD: Bạn muốn góp ý gì cho lần sau?'}
              value={q.label}
              onChange={(e) => update(idx, { label: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
              <input type="checkbox" className="rounded" disabled={disabled}
                checked={q.required} onChange={(e) => update(idx, { required: e.target.checked })} />
              Bắt buộc trả lời
            </label>
          </div>
        );
      })}

      {!disabled && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => onChange([...questions, newQuestion('RATING')])} className="btn-secondary btn-sm">
            <Plus size={14} /> <Star size={14} /> Câu đánh giá sao
          </button>
          <button type="button" onClick={() => onChange([...questions, newQuestion('TEXT')])} className="btn-secondary btn-sm">
            <Plus size={14} /> <AlignLeft size={14} /> Câu trả lời văn bản
          </button>
        </div>
      )}
    </div>
  );
}

// Kiểm tra nhanh ở client trước khi gửi — backend vẫn kiểm tra lại đầy đủ.
export function questionListError(questions) {
  if (!questions.length) return 'Form phải có ít nhất 1 câu hỏi';
  const empty = questions.findIndex((q) => !q.label.trim());
  if (empty >= 0) return `Câu ${empty + 1}: chưa nhập nội dung câu hỏi`;
  return null;
}
