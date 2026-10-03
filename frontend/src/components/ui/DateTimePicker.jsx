import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Popover from './Popover';
import Modal from './Modal';
import Button, { IconButton } from './Button';
import useMediaQuery from '../../hooks/useMediaQuery';
import { cx } from '../../utils/cx';

// Giá trị cùng dạng <input type="datetime-local">: 'YYYY-MM-DDTHH:mm' theo giờ địa phương, '' là trống.
const pad = (n) => String(n).padStart(2, '0');
function parse(value) {
  if (!value) return null;
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d, hh: hh || 0, mm: mm || 0 };
}
const serialize = ({ y, m, d, hh, mm }) => `${y}-${pad(m + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;
const show = (p) => `${pad(p.d)}/${pad(p.m + 1)}/${p.y} ${pad(p.hh)}:${pad(p.mm)}`;
export const formatDateTimeValue = (value) => { const p = parse(value); return p ? show(p) : ''; };

// Mốc gợi ý khi ô còn trống: bây giờ, phút làm tròn lên bội số 5
function suggestion() {
  const now = new Date();
  const mm = Math.ceil(now.getMinutes() / 5) * 5;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), mm);
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate(), hh: date.getHours(), mm: date.getMinutes() };
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Lịch tháng: tiêu đề "Tháng 10, 2026" là nút mở lưới 12 tháng, rồi lưới 12 năm. Lưới ngày luôn
// nằm trong luồng (6 hàng) nên khung không co giãn khi đổi tầng hay đổi tháng.
function Calendar({ draft, onPick }) {
  const [view, setView] = useState({ y: draft.y, m: draft.m });
  const [layer, setLayer] = useState('days');
  const today = new Date();
  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.y, view.m, 1 - offset + i));
  const selected = new Date(draft.y, draft.m, draft.d);
  const yearStart = view.y - (view.y % 12);

  const step = (dir) => {
    if (layer === 'days') {
      const next = new Date(view.y, view.m + dir, 1);
      setView({ y: next.getFullYear(), m: next.getMonth() });
    } else if (layer === 'months') setView((v) => ({ ...v, y: v.y + dir }));
    else setView((v) => ({ ...v, y: v.y + dir * 12 }));
  };
  const title = layer === 'days' ? `Tháng ${view.m + 1}, ${view.y}` : layer === 'months' ? `${view.y}` : `${yearStart} – ${yearStart + 11}`;
  const prevLabel = layer === 'days' ? 'Tháng trước' : layer === 'months' ? 'Năm trước' : '12 năm trước';
  const nextLabel = layer === 'days' ? 'Tháng sau' : layer === 'months' ? 'Năm sau' : '12 năm sau';

  const gridCell = (active, current) => cx(
    'flex h-10 cursor-pointer items-center justify-center rounded-xl text-sm tabular-nums outline-none',
    active ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : 'text-foreground hover:bg-item-hover focus-visible:bg-item-hover',
    current && 'font-semibold',
  );

  return (
    <div className="w-[280px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setLayer(layer === 'days' ? 'months' : 'years')}
          disabled={layer === 'years'}
          className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-xl px-2 text-sm font-semibold text-foreground outline-none hover:bg-item-hover disabled:cursor-default disabled:hover:bg-transparent"
        >
          {title}
          {layer !== 'years' && <ChevronDown className="size-4 text-muted" aria-hidden="true" />}
        </button>
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label={prevLabel} onClick={() => step(-1)} />
          <IconButton icon={ChevronRight} label={nextLabel} onClick={() => step(1)} />
        </div>
      </div>
      <div className="relative">
        <div className={cx(layer !== 'days' && 'invisible')} aria-hidden={layer !== 'days' || undefined}>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w) => <span key={w} className="flex h-8 items-center justify-center text-xs font-medium text-muted">{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((date) => {
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);
              const outside = date.getMonth() !== view.m;
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  tabIndex={layer === 'days' ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={`${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`}
                  onClick={() => {
                    onPick({ y: date.getFullYear(), m: date.getMonth(), d: date.getDate() });
                    if (outside) setView({ y: date.getFullYear(), m: date.getMonth() });
                  }}
                  className={cx(
                    'relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-sm tabular-nums outline-none',
                    isSelected ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : cx('hover:bg-item-hover focus-visible:bg-item-hover', outside ? 'text-muted' : 'text-foreground'),
                    isToday && 'font-semibold',
                  )}
                >
                  {date.getDate()}
                  {isToday && <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
        {layer === 'months' && (
          <div className="absolute inset-0 grid grid-cols-4 content-start gap-1">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setView((v) => ({ ...v, m: i })); setLayer('days'); }}
                className={gridCell(draft.y === view.y && draft.m === i, today.getFullYear() === view.y && today.getMonth() === i)}
              >
                {`Th${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {layer === 'years' && (
          <div className="absolute inset-0 grid grid-cols-4 content-start gap-1">
            {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => { setView((v) => ({ ...v, y })); setLayer('months'); }}
                className={gridCell(draft.y === y, today.getFullYear() === y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ITEM = 40;
const LOOPS = 11;

// Một cột bánh xe cuộn vòng: lặp danh sách 11 vòng, mở ra đứng ở vòng giữa, chỉ kéo về vòng giữa
// khi đã dừng cuộn (không cắt đà cuộn). Số nằm trong dải giữa là số được chọn; bấm vào một số
// thì nó trượt vào dải; mũi tên lên/xuống đổi từng nấc.
function WheelColumn({ count, value, onChange, label, visible }) {
  const ref = useRef(null);
  const timer = useRef(0);
  const center = Math.floor(visible / 2);
  const mid = Math.floor(LOOPS / 2);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = (mid * count + value - center) * ITEM;
    // Chỉ đặt vị trí lúc mở; sau đó vị trí do người dùng cuộn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = () => {
    const el = ref.current;
    if (!el) return;
    let index = Math.round(el.scrollTop / ITEM) + center;
    if (index < count * 2 || index > count * (LOOPS - 2)) {
      const shift = (mid * count + (index % count)) - index;
      el.scrollTop += shift * ITEM;
      index += shift;
    }
    onChange(((index % count) + count) % count);
  };

  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(settle, 110);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const scrollToIndex = (index) => ref.current?.scrollTo({ top: (index - center) * ITEM, behavior: 'smooth' });

  return (
    <div className="flex w-14 flex-col items-center">
      <span className="flex h-8 items-center text-xs font-medium text-muted">{label}</span>
      <div
        ref={ref}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuetext={pad(value)}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          ref.current?.scrollBy({ top: e.key === 'ArrowDown' ? ITEM : -ITEM, behavior: 'smooth' });
        }}
        style={{ height: visible * ITEM, maskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)' }}
        className="scrollbar-clean relative w-full snap-y snap-mandatory overflow-y-auto outline-none"
      >
        {Array.from({ length: count * LOOPS }, (_, index) => {
          const v = index % count;
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              onClick={() => scrollToIndex(index)}
              className={cx(
                'flex h-10 w-full cursor-pointer snap-center items-center justify-center text-sm tabular-nums outline-none hover:text-foreground',
                v === value ? 'font-semibold text-foreground' : 'text-muted',
              )}
            >
              {pad(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Picker({ draft, setDraft, narrow }) {
  const visible = narrow ? 5 : 7;
  return (
    <div className={cx('flex', narrow ? 'flex-col items-center gap-4' : 'flex-row')}>
      <div className={narrow ? '' : 'p-3'}>
        <Calendar draft={draft} onPick={(day) => setDraft((d) => ({ ...d, ...day }))} />
      </div>
      <div className={cx('flex items-center justify-center', narrow ? 'w-full border-t border-border pt-2' : 'border-l border-border px-3')}>
        <div className="relative flex gap-2">
          {/* Một dải nền chạy ngang cả hai cột, đứng yên ở giữa */}
          <div className="pointer-events-none absolute inset-x-0 h-10 rounded-xl bg-item-hover" style={{ top: 32 + Math.floor(visible / 2) * ITEM }} aria-hidden="true" />
          <WheelColumn label="Giờ" count={24} value={draft.hh} visible={visible} onChange={(hh) => setDraft((d) => ({ ...d, hh }))} />
          <WheelColumn label="Phút" count={60} value={draft.mm} visible={visible} onChange={(mm) => setDraft((d) => ({ ...d, mm }))} />
        </div>
      </div>
    </div>
  );
}

// Ô chọn ngày giờ: nút trông như ô nhập; lịch bên trái, bánh xe giờ phút bên phải. Có nút Xong
// nên giá trị chỉ ghi vào ô khi bấm Xong; Esc hay bấm ra ngoài là bỏ. Điện thoại mở thành hộp giữa
// màn (lịch trên, bánh xe dưới) vì lớp nổi bám ô không đủ chỗ.
export default function DateTimePicker({ id, value, onChange, placeholder = 'Chọn ngày giờ', label = 'Chọn ngày giờ', invalid = false, disabled = false, clearable = true }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const anchorRef = useRef(null);
  const narrow = useMediaQuery('(max-width: 639px)');
  const current = parse(value);

  const openPicker = () => {
    setDraft(current || suggestion());
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);
  const commit = () => {
    if (draft) onChange?.(serialize(draft));
    setOpen(false);
    anchorRef.current?.focus({ preventScroll: true });
  };
  const clear = () => {
    onChange?.('');
    setOpen(false);
  };

  const footer = draft && (
    <div className="flex w-full items-center justify-between gap-3">
      <p className="text-sm tabular-nums text-muted">{show(draft)}</p>
      <div className="flex items-center gap-3">
        {clearable && current && (
          <button type="button" onClick={clear} className="text-sm text-muted underline-offset-4 outline-none hover:text-foreground hover:underline">
            Xoá
          </button>
        )}
        <Button variant="primary" size="sm" onClick={commit}>Xong</Button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? close() : openPicker())}
        className={cx(
          'group flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-surface px-4 text-left text-base tabular-nums outline-none dark:bg-white/4 md:h-10 md:text-sm',
          'focus-visible:border-focus aria-expanded:border-focus aria-expanded:ring-2 aria-expanded:ring-focus disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-error' : 'border-border-strong',
        )}
      >
        <span className={current ? 'text-foreground' : 'text-muted'}>{current ? show(current) : placeholder}</span>
        <CalendarClock className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {narrow ? (
        <Modal open={open} onClose={close} title={label} size="sm" footer={footer}>
          {draft && <Picker draft={draft} setDraft={setDraft} narrow />}
        </Modal>
      ) : (
        <Popover open={open} onClose={close} anchorRef={anchorRef} role="dialog" ariaLabel={label} autoFocus={false}>
          {draft && (
            <div
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target.getAttribute('role') === 'spinbutton') commit(); }}
            >
              <Picker draft={draft} setDraft={setDraft} narrow={false} />
              <div className="border-t border-border px-4 py-3">{footer}</div>
            </div>
          )}
        </Popover>
      )}
    </>
  );
}
