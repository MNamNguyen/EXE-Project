import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from '../../utils/cx';

// Bốn dạng nút của cả app (cộng `danger` cho việc nguy hiểm). `outline` là mặc định; `primary`
// chỉ cho hành động chính của màn. Cỡ: md (40px), form (44px ở điện thoại để vừa ngón tay),
// hdr (36px, hàng nút trên header), sm (32px, nút trong dòng), auth (48px, màn đăng nhập).
const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 text-center text-sm font-medium leading-tight outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const SIZE = {
  md: 'min-h-10 rounded-xl px-4 py-2',
  form: 'min-h-11 rounded-xl px-4 py-2 md:min-h-10',
  hdr: 'h-9 rounded-lg px-3',
  sm: 'h-8 rounded-lg px-3',
  auth: 'h-12 rounded-xl px-4',
};

const VARIANT = {
  outline: 'border border-border-strong bg-surface text-foreground hover:bg-button-hover',
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-secondary text-foreground hover:bg-secondary-hover',
  ghost: 'bg-transparent text-muted hover:bg-foreground/5 hover:text-foreground',
  danger: 'bg-danger-bg text-danger hover:bg-danger-bg-hover',
};

export const buttonClass = ({ variant = 'outline', size = 'md', className } = {}) =>
  cx(BASE, SIZE[size], VARIANT[variant], className);

// Đang gửi: spinner đè giữa nút, chữ `invisible` vẫn giữ chỗ (nút không đổi bề rộng). Nút vẫn
// nhận tiêu điểm (aria-disabled), chỉ chặn bấm thêm lần nữa.
const Button = forwardRef(function Button(
  { as: Comp = 'button', variant, size, icon: Icon, iconClassName = 'size-4 shrink-0', loading = false, className, children, type, onClick, ...props },
  ref,
) {
  const content = (
    <>
      {Icon && <Icon className={iconClassName} aria-hidden="true" />}
      {children}
    </>
  );
  const handleClick = loading ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClick;
  return (
    <Comp
      ref={ref}
      type={Comp === 'button' ? type || 'button' : type}
      className={buttonClass({ variant, size, className: cx(loading && 'relative', className) })}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{content}</span>
          <LoaderCircle className="absolute inset-0 m-auto size-4 animate-spin" aria-hidden="true" />
        </>
      ) : content}
    </Comp>
  );
});

export default Button;

// Nút chỉ có icon: luôn có aria-label + title. `row` cho nút nằm trong dòng bảng (nền rê đậm hơn
// một bậc để vẫn thấy trên dòng đang rê).
// danger: việc nguy hiểm (xoá) — lúc thường xám như mọi nút, rê vào mới đỏ
export const IconButton = forwardRef(function IconButton(
  { as: Comp = 'button', icon: Icon, label, row = false, danger = false, size = 'size-8', iconClassName = 'size-4 shrink-0', className, type, ...props },
  ref,
) {
  return (
    <Comp
      ref={ref}
      type={Comp === 'button' ? type || 'button' : type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted outline-none transition-colors',
        size,
        danger
          ? 'hover:bg-danger-bg hover:text-danger'
          : cx('hover:text-foreground', row ? 'hover:bg-foreground/8 aria-expanded:bg-foreground/8' : 'hover:bg-foreground/5 aria-expanded:bg-foreground/5'),
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      <Icon className={iconClassName} aria-hidden="true" />
    </Comp>
  );
});

// Nút viền chỉ có icon, cao bằng nút md (40px): nút ⋯ "Thêm thao tác" đứng cạnh hàng nút viền
export const OutlineIconButton = forwardRef(function OutlineIconButton({ icon: Icon, label, className, type, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type || 'button'}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border-strong bg-surface text-muted outline-none transition-colors hover:bg-button-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
    </button>
  );
});

// Link chữ "Xem tất cả" đặt ở góc phải đầu card
export function viewAllClass(className) {
  return cx(
    'inline-flex h-8 items-center whitespace-nowrap text-sm font-medium text-foreground/70 underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline',
    className,
  );
}
