import { useId } from 'react';
import { Field, Input } from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Choice';
import { cx } from '../../../utils/cx';

// Các ô của form check-in công khai — dùng chung cho trang người ghé thăm (/check-in/:id)
// và modal "Thêm người" của BTC, để hai nơi luôn cùng một form. Họ tên luôn có ở đầu.
// value = { name, answers: { [fieldId]: string | string[] } }. Server kiểm tra lại toàn bộ
// (lib/publicForm.js#validateSubmission) — ở đây chỉ để nhập cho dễ.

const INPUT_PROPS = {
  TEXT: { type: 'text', autoComplete: 'off' },
  PHONE: { type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
  EMAIL: { type: 'email', inputMode: 'email', autoComplete: 'email' },
};

// Ô chọn một: radio vẽ lại cùng kiểu Checkbox của app (tròn), cả dòng bấm được.
function ChoiceRow({ type, name, checked, onChange, children }) {
  return (
    <label
      className={cx(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
        checked ? 'border-primary bg-primary/5 text-foreground' : 'border-border-strong bg-surface text-foreground hover:bg-surface-hover',
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type={type}
          name={name}
          value={children}
          aria-label={children}
          checked={checked}
          onChange={onChange}
          className="peer size-5 cursor-pointer appearance-none rounded-full border-[1.5px] border-border-strong bg-surface outline-none transition-colors checked:border-primary focus-visible:ring-2 focus-visible:ring-focus"
        />
        <span className="pointer-events-none absolute inset-0 m-auto size-2.5 rounded-full bg-primary opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="min-w-0 text-pretty">{children}</span>
    </label>
  );
}

export function emptyFormValue() {
  return { name: '', answers: {} };
}

export default function PublicFormFields({ fields, value, onChange, disabled = false }) {
  const uid = useId();
  const setName = (name) => onChange({ ...value, name });
  const setAnswer = (id, v) => onChange({ ...value, answers: { ...value.answers, [id]: v } });

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5">
      <Field label="Họ và tên" required>
        {(id) => <Input id={id} value={value.name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />}
      </Field>

      {fields.map((f) => {
        const current = value.answers[f.id];
        if (f.type === 'SINGLE' || f.type === 'MULTI') {
          const picked = Array.isArray(current) ? current : [];
          return (
            <div key={f.id} role="group" aria-labelledby={`${uid}-${f.id}`} className="flex flex-col gap-1.5">
              <p id={`${uid}-${f.id}`} className="text-sm font-medium text-foreground">
                {f.label}
                {f.required
                  ? <span aria-hidden="true" className="text-error-text"> *</span>
                  : <span className="font-normal text-muted"> (không bắt buộc)</span>}
                {f.type === 'MULTI' && <span className="font-normal text-muted"> · chọn nhiều</span>}
              </p>
              <div className="flex flex-col gap-2">
                {f.options.map((opt) => (f.type === 'SINGLE' ? (
                  <ChoiceRow key={opt} type="radio" name={`${uid}-${f.id}`} checked={current === opt} onChange={() => setAnswer(f.id, opt)}>
                    {opt}
                  </ChoiceRow>
                ) : (
                  <label
                    key={opt}
                    className={cx(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
                      picked.includes(opt) ? 'border-primary bg-primary/5' : 'border-border-strong bg-surface hover:bg-surface-hover',
                    )}
                  >
                    <Checkbox
                      checked={picked.includes(opt)}
                      ariaLabel={opt}
                      onChange={(e) => setAnswer(f.id, e.target.checked ? [...picked, opt] : picked.filter((o) => o !== opt))}
                    />
                    <span className="min-w-0 text-pretty text-foreground">{opt}</span>
                  </label>
                )))}
              </div>
            </div>
          );
        }
        return (
          <Field key={f.id} label={f.label} required={f.required} optional={!f.required}>
            {(id) => (
              <Input
                id={id}
                {...INPUT_PROPS[f.type]}
                maxLength={f.type === 'TEXT' ? 500 : 200}
                value={typeof current === 'string' ? current : ''}
                onChange={(e) => setAnswer(f.id, e.target.value)}
              />
            )}
          </Field>
        );
      })}
    </fieldset>
  );
}

// Kiểm tra nhanh ở client để báo ngay (server vẫn kiểm tra lại đầy đủ).
export function formValueError(fields, value) {
  if (value.name.trim().length < 2) return 'Vui lòng nhập họ tên';
  for (const f of fields) {
    if (!f.required) continue;
    const v = value.answers[f.id];
    const empty = Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim();
    if (empty) return `Vui lòng điền "${f.label}"`;
  }
  return null;
}
