import { forwardRef, useId, useRef, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { cx } from '../../utils/cx';

// Ô nhập: nền surface (không bao giờ trong suốt), viền border-strong như nút viền, focus là viền
// --border-focus + quầng mờ 2px. 44px ở điện thoại cho vừa ngón tay, 40px từ md; chữ 16px ở điện
// thoại để iOS không tự phóng to khi chạm vào ô.
export const INPUT_CLASS =
  'w-full h-11 md:h-10 rounded-xl border border-border-strong bg-surface dark:bg-white/4 px-4 text-base md:text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50';
export const INPUT_ERROR_CLASS = 'border-error focus:border-error focus:ring-error/10';
export const TEXTAREA_CLASS =
  'w-full rounded-xl border border-border-strong bg-surface dark:bg-white/4 px-4 py-2.5 text-base md:text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef(function Input({ invalid = false, className, ...props }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cx(INPUT_CLASS, invalid && INPUT_ERROR_CLASS, className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ invalid = false, className, ...props }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cx(TEXTAREA_CLASS, invalid && INPUT_ERROR_CLASS, className)} {...props} />;
});

// Nhãn + ô + dòng gợi ý hoặc lỗi. children là hàm nhận id (để nhãn gắn đúng ô) hoặc một node.
export function Field({ label, id: idProp, required = false, optional = false, hint, error, className, labelClassName, children }) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className={cx('w-fit cursor-pointer text-sm font-medium text-foreground', labelClassName)}>
          {label}
          {required && <span aria-hidden="true" className="text-error-text"> *</span>}
          {optional && <span className="font-normal text-muted"> (không bắt buộc)</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <p className="min-h-4 text-xs text-error-text">{error}</p>
      ) : hint ? (
        <p className="text-pretty text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// Ô tìm: chữ trơn, không icon trái; nút × tự dựng (không dùng nút xanh của trình duyệt), chỉ hiện
// khi có chữ, bấm xong trả tiêu điểm về ô.
export function SearchInput({ value, onChange, onClear, placeholder = 'Tìm…', className, inputClassName, ...props }) {
  const ref = useRef(null);
  const clear = () => {
    if (onClear) onClear();
    else onChange?.({ target: { value: '' } });
    ref.current?.focus();
  };
  return (
    <div className={cx('relative min-w-0', className)}>
      <input
        ref={ref}
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={cx(INPUT_CLASS, 'pr-10 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none', inputClassName)}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label="Xoá từ khoá"
          onClick={clear}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted outline-none hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

// Thanh trượt một giá trị (cỡ chữ, độ rộng): phần đã kéo tô màu nhấn, ô cao 44px dễ bấm trúng
export function RangeInput({ value, min, max, className, style, ...props }) {
  const pct = ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      className={cx('range-input h-11 w-full touch-none outline-none', className)}
      style={{ '--range-pct': `${Math.min(100, Math.max(0, pct))}%`, ...style }}
      {...props}
    />
  );
}

// Ô mật khẩu có nút mắt bên trong (size-10 sát phải, ô chừa pr-11)
export const PasswordInput = forwardRef(function PasswordInput({ className, invalid = false, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={cx(INPUT_CLASS, invalid && INPUT_ERROR_CLASS, 'pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute inset-y-0 right-1 my-auto flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted outline-none hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
});
