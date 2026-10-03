import { useEffect, useRef, useState } from 'react';
import { cx } from '../../utils/cx';

const LENGTH = 6;
const empty = () => Array(LENGTH).fill('');

// Sáu ô một số. Ô đầu nhận cả mã (autocomplete one-time-code, iOS tự điền sáu số vào ô đầu) rồi
// chia ra sáu ô; dán mã vào ô nào cũng được; gõ xong một số thì sang ô sau; Backspace ở ô trống
// thì lùi về ô trước. value/onChange là chuỗi số đã gõ.
export default function OtpInput({ value = '', onChange, invalid = false, disabled = false, autoFocus = true, idPrefix = 'otp' }) {
  const [cells, setCells] = useState(() => {
    const next = empty();
    value.slice(0, LENGTH).split('').forEach((ch, i) => { next[i] = ch; });
    return next;
  });
  const refs = useRef([]);

  // Cha xoá mã (sai mã, gửi lại) thì xoá sáu ô và đưa con trỏ về ô đầu
  useEffect(() => {
    if (value === cells.join('')) return;
    const next = empty();
    value.slice(0, LENGTH).split('').forEach((ch, i) => { next[i] = ch; });
    setCells(next);
    if (!value) refs.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const update = (next, focusIndex) => {
    setCells(next);
    onChange?.(next.join(''));
    if (focusIndex !== undefined) refs.current[Math.min(focusIndex, LENGTH - 1)]?.focus();
  };

  const fill = (start, digits) => {
    const next = [...cells];
    digits.split('').slice(0, LENGTH - start).forEach((d, k) => { next[start + k] = d; });
    update(next, start + digits.length);
  };

  const onInput = (i, raw) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      const next = [...cells];
      next[i] = '';
      update(next);
      return;
    }
    if (digits.length > 1) { fill(i, digits); return; }
    const next = [...cells];
    next[i] = digits;
    update(next, i + 1);
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !cells[i] && i > 0) {
      e.preventDefault();
      const next = [...cells];
      next[i - 1] = '';
      update(next, i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (i, e) => {
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (!digits) return;
    e.preventDefault();
    fill(digits.length >= LENGTH ? 0 : i, digits);
  };

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3">
      {cells.map((digit, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={i === 0 ? LENGTH : 1}
          aria-label={`Số thứ ${i + 1} trên ${LENGTH}`}
          value={digit}
          disabled={disabled}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
          className={cx(
            'aspect-square w-full min-w-0 rounded-xl border bg-surface text-center text-2xl font-semibold tabular-nums text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus disabled:opacity-50 dark:bg-white/4',
            invalid ? 'border-error focus:border-error focus:ring-error/10' : 'border-border-strong',
          )}
        />
      ))}
    </div>
  );
}
