import { forwardRef, useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';
import { cx } from '../../utils/cx';

// Công tắc: track xám mờ, bật thì màu nhấn. Vùng bấm nới ra 8px mỗi phía (before:-inset-2).
export function Switch({ checked, onChange, disabled = false, label, labelledBy, className, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cx(
        'group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-muted/40 p-0.5 outline-none transition-colors before:absolute before:-inset-2 hover:bg-muted/60 aria-checked:bg-primary aria-checked:hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="size-5 rounded-full bg-surface shadow-sm transition-[transform,translate] group-aria-checked:translate-x-5 group-aria-checked:bg-primary-foreground motion-reduce:transition-none" />
    </button>
  );
}

// Checkbox vẽ lại (không accent-color của trình duyệt). small = ô 16px dùng trong bảng.
// Có label thì cả nhãn bấm được; desc là dòng giải thích dưới nhãn.
export const Checkbox = forwardRef(function Checkbox(
  { checked, onChange, indeterminate = false, small = false, label, desc, ariaLabel, disabled = false, className, labelClassName, ...props },
  ref,
) {
  const inner = useRef(null);
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  const setRefs = (node) => {
    inner.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const box = (
    <span className={cx('relative inline-flex shrink-0', desc && 'mt-0.5', className)}>
      <input
        ref={setRefs}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        className={cx(
          'peer cursor-pointer appearance-none border-[1.5px] border-border-strong bg-surface outline-none transition-colors [&:not(:checked):not(:indeterminate):hover]:border-foreground checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
          small ? 'size-4 rounded' : 'size-5 rounded-md',
        )}
        {...props}
      />
      <Check strokeWidth={3} className={cx('pointer-events-none absolute inset-0 m-auto text-primary-foreground opacity-0 peer-checked:opacity-100', small ? 'size-3' : 'size-3.5')} aria-hidden="true" />
      <Minus strokeWidth={3} className={cx('pointer-events-none absolute inset-0 m-auto text-primary-foreground opacity-0 peer-indeterminate:opacity-100', small ? 'size-3' : 'size-3.5')} aria-hidden="true" />
    </span>
  );
  if (!label) return box;
  return (
    <label
      className={cx(
        'inline-flex w-fit cursor-pointer gap-3 text-sm text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
        desc ? 'items-start' : 'items-center',
        labelClassName,
      )}
    >
      {box}
      {desc ? (
        <span className="min-w-0">
          <span className="block font-medium text-foreground">{label}</span>
          <span className="mt-1 block text-pretty text-muted">{desc}</span>
        </span>
      ) : label}
    </label>
  );
});

// Ô checkbox trong bảng: vùng bấm 44×44 bọc quanh ô vẽ 16px
export function CheckCell({ as: Tag = 'td', ...props }) {
  return (
    <Tag className="w-px p-0">
      <label className="flex min-h-11 w-11 cursor-pointer items-center justify-center pl-1">
        <Checkbox small {...props} />
      </label>
    </Tag>
  );
}
