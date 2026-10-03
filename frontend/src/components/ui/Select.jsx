import { forwardRef, useCallback, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import Popover from './Popover';
import { cx } from '../../utils/cx';

const normalize = (options) => options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));

// Ô chọn tự dựng (không dùng <select> gốc của hệ điều hành): nút mở trông y như ô nhập, danh sách
// mở ra rộng bằng nút, mục đang chọn chữ đậm + dấu check. Trên 8 mục thì có ô tìm ở đầu danh sách.
// label: chữ xám đứng trước giá trị trong nút ("Trạng thái:"), dùng cho nút lọc ngoài form.
const Select = forwardRef(function Select(
  {
    value, onChange, options = [], placeholder = 'Chọn…', label, inline = false, size = 'md', className, triggerClassName,
    align = 'start', placement = 'bottom', disabled = false, invalid = false, id, searchPlaceholder = 'Tìm…',
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, renderValue,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef(null);
  const listId = useId();
  const items = useMemo(() => normalize(options), [options]);
  const selected = items.find((o) => o.value === value);
  const searchable = items.length > 8;
  const shown = searchable && query.trim()
    ? items.filter((o) => o.label.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
    : items;

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);
  const choose = (option) => {
    onChange?.(option.value);
    close();
    anchorRef.current?.focus({ preventScroll: true });
  };

  const setRefs = (node) => {
    anchorRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div className={cx('relative', inline ? 'inline-flex' : 'flex w-full', className)}>
      <button
        ref={setRefs}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'group flex cursor-pointer items-center justify-between gap-2 rounded-xl border bg-surface text-left outline-none transition-colors dark:bg-white/4',
          'focus-visible:border-focus aria-expanded:border-focus aria-expanded:ring-2 aria-expanded:ring-focus disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-error aria-expanded:ring-error/10' : 'border-border-strong',
          size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-base md:h-10 md:text-sm',
          inline ? 'w-fit' : 'w-full',
          triggerClassName,
        )}
      >
        {label && <span className="shrink-0 text-muted">{label}</span>}
        <span className={cx('truncate', !selected && 'text-muted')}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
        </span>
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted transition-[transform,rotate] group-aria-expanded:rotate-180" aria-hidden="true" />
      </button>
      <Popover
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        align={align}
        placement={placement}
        width={inline ? 'min-anchor' : 'anchor'}
        className={cx('min-w-40', !searchable && 'py-1')}
      >
        {searchable && (
          <div className="relative border-b border-border">
            <Search className="absolute inset-y-0 left-3.5 my-auto size-4 text-muted" aria-hidden="true" />
            <input
              data-autofocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-11 w-full rounded-t-2xl bg-transparent pl-10 pr-3 text-base text-foreground outline-none placeholder:text-muted md:h-10 md:text-sm"
            />
          </div>
        )}
        <div id={listId} role="listbox" className={cx('max-h-[304px] overflow-y-auto px-1', searchable && 'py-1')}>
          {shown.length === 0 ? (
            <p className="px-3 py-3 text-center text-sm text-muted">Không tìm thấy mục nào</p>
          ) : shown.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => choose(option)}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm text-foreground outline-none hover:bg-item-hover focus-visible:bg-item-hover',
                  option.description ? 'py-2.5' : 'h-10',
                )}
              >
                <span className="min-w-0 flex-1">
                  {option.description ? (
                    <>
                      <span className={cx('block', isSelected ? 'font-medium' : 'font-medium')}>{option.label}</span>
                      <span className="mt-0.5 block text-muted">{option.description}</span>
                    </>
                  ) : (
                    <span className={cx('block truncate', isSelected && 'font-medium')}>{option.label}</span>
                  )}
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-foreground" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
});

export default Select;
