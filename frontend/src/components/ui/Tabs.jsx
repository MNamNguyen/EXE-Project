import { useRef } from 'react';
import Select from './Select';
import { useScrollFade } from './Popover';
import { cx } from '../../utils/cx';

// Thanh tab, ba kiểu theo chỗ đứng:
//   boxed     — tab trạng thái trên bảng (Tất cả / Đang diễn ra…), đang chọn là ô nền xám nhạt
//   underline — chia nội dung trang chi tiết, vạch 2px dưới tab đang chọn
//   segmented — 2–4 lựa chọn ngắn, rãnh chìm + ô nổi như phím bấm
// mobileSelectLabel (chỉ boxed): dưới sm hàng tab thành một nút chọn "Trạng thái: …"
export default function Tabs({
  variant = 'boxed', items, value, onChange, ariaLabel, layout = 'fit', line = true, className, mobileSelectLabel,
}) {
  const listRef = useRef(null);
  const fadeRef = useScrollFade();

  const onKeyDown = (e) => {
    const index = items.findIndex((it) => it.value === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].value);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  const tab = (it) => {
    const selected = it.value === value;
    const Icon = it.icon;
    const count = it.count !== undefined && (
      <span className="text-xs font-normal tabular-nums text-foreground/70">{it.count}</span>
    );
    let cls;
    if (variant === 'underline') {
      cls = cx(
        'relative box-content inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2 pb-px text-sm font-medium outline-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full',
        selected ? 'text-foreground after:bg-foreground' : 'text-foreground/70 after:bg-transparent hover:text-foreground',
      );
    } else if (variant === 'segmented') {
      cls = cx(
        'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium outline-none transition-[color,background-color,box-shadow] duration-150',
        it.grow && 'flex-1',
        selected ? 'bg-surface text-foreground shadow-segment-thumb' : 'text-foreground/70 hover:text-foreground',
      );
    } else {
      cls = cx(
        'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium outline-none transition-colors',
        selected ? 'border-transparent bg-secondary text-foreground' : 'border-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
      );
    }
    return (
      <button
        key={it.value}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls={it.panelId}
        id={it.tabId}
        tabIndex={selected ? 0 : -1}
        onClick={() => onChange(it.value)}
        className={cls}
      >
        {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
        {it.label}
        {count}
      </button>
    );
  };

  if (variant === 'segmented') {
    return (
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={cx(
          { fit: 'inline-flex w-fit', full: 'flex w-full', fullMobile: 'flex w-full sm:inline-flex sm:w-fit' }[layout],
          'max-w-full gap-1 rounded-xl bg-background p-1 shadow-segment-track',
          className,
        )}
      >
        {items.map(tab)}
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div ref={fadeRef} className={cx('scrollbar-clean overflow-x-auto', className)}>
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className={cx('flex min-w-full gap-2 px-2', line && 'shadow-[inset_0_-1px_0_var(--border-strong)]')}
        >
          {items.map(tab)}
        </div>
      </div>
    );
  }

  const boxed = (
    <div ref={fadeRef} className={cx('scrollbar-clean overflow-x-auto py-0.5', mobileSelectLabel && 'hidden sm:block', className)}>
      <div ref={listRef} role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className="flex gap-1 px-1">
        {items.map(tab)}
      </div>
    </div>
  );
  if (!mobileSelectLabel) return boxed;
  return (
    <>
      {boxed}
      <Select
        inline
        className="sm:hidden"
        label={mobileSelectLabel}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        options={items.map((it) => ({ value: it.value, label: it.count !== undefined ? `${it.label} · ${it.count}` : it.label }))}
      />
    </>
  );
}
