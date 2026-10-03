import { Star, AlignLeft, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import Button, { IconButton } from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Choice';

export const QUESTION_TYPE_META = {
  RATING: { label: 'Đánh giá sao (1–5)', icon: Star },
  TEXT: { label: 'Trả lời văn bản', icon: AlignLeft },
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
    <div className="flex flex-col gap-3">
      {questions.length === 0 && (
        <p className="rounded-xl border border-dashed border-border-strong py-6 text-center text-sm text-muted">
          Chưa có câu hỏi nào — thêm câu hỏi bên dưới.
        </p>
      )}

      {questions.map((q, idx) => (
        <div key={q.id} className="flex flex-col gap-3 rounded-xl bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-sm font-medium tabular-nums text-muted">{idx + 1}.</span>
            <Select
              inline
              size="sm"
              aria-label={`Loại câu hỏi ${idx + 1}`}
              value={q.type}
              disabled={disabled}
              onChange={(type) => update(idx, { type })}
              options={Object.entries(QUESTION_TYPE_META).map(([value, m]) => ({ value, label: m.label }))}
            />
            <div className="flex-1" />
            <IconButton icon={ArrowUp} label="Lên trên" disabled={disabled || idx === 0} onClick={() => move(idx, -1)} />
            <IconButton icon={ArrowDown} label="Xuống dưới" disabled={disabled || idx === questions.length - 1} onClick={() => move(idx, 1)} />
            <IconButton icon={Trash2} label="Xoá câu hỏi" danger disabled={disabled} onClick={() => remove(idx)} />
          </div>
          <Textarea
            aria-label={`Nội dung câu hỏi ${idx + 1}`}
            className="resize-none"
            rows={2}
            maxLength={500}
            disabled={disabled}
            placeholder={q.type === 'RATING' ? 'VD: Bạn đánh giá chất lượng diễn giả thế nào?' : 'VD: Bạn muốn góp ý gì cho lần sau?'}
            value={q.label}
            onChange={(e) => update(idx, { label: e.target.value })}
          />
          <Checkbox
            small
            label="Bắt buộc trả lời"
            disabled={disabled}
            checked={q.required}
            onChange={(e) => update(idx, { required: e.target.checked })}
          />
        </div>
      ))}

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={Plus} onClick={() => onChange([...questions, newQuestion('RATING')])}>Câu đánh giá sao</Button>
          <Button size="sm" icon={Plus} onClick={() => onChange([...questions, newQuestion('TEXT')])}>Câu trả lời văn bản</Button>
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
