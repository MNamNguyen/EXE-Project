import { useState } from 'react';
import { Star } from 'lucide-react';
import { cx } from '../../utils/cx';

export const RATING_LABELS = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Rất tốt'];

// Chọn 1–5 sao: mỗi sao là một nút 40px (vừa ngón tay), kèm nhãn chữ của mức đang chọn.
// Không truyền onChange = chỉ hiển thị (điểm trung bình, cho phép số lẻ — sao tô theo phần trăm).
export default function StarRating({ value = 0, onChange, size = 28, showLabel = true, className = '' }) {
  const [hover, setHover] = useState(0);
  const readOnly = !onChange;
  const shown = readOnly ? value : hover || value;

  const star = (n) => {
    const fill = Math.max(0, Math.min(1, shown - (n - 1)));
    return (
      <span className="relative inline-block" style={{ width: size, height: size }}>
        <Star size={size} className="absolute inset-0 fill-foreground/10 text-foreground/10" aria-hidden="true" />
        {fill > 0 && (
          <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
            <Star size={size} className="fill-amber-400 text-amber-400" aria-hidden="true" />
          </span>
        )}
      </span>
    );
  };

  if (readOnly) {
    return (
      <span className={cx('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${value} trên 5 sao`}>
        {[1, 2, 3, 4, 5].map((n) => <span key={n}>{star(n)}</span>)}
      </span>
    );
  }

  return (
    <div className={cx('flex items-center gap-1', className)} role="radiogroup" aria-label="Chọn số sao" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sao, ${RATING_LABELS[n].toLowerCase()}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-foreground/5"
        >
          {star(n)}
        </button>
      ))}
      {showLabel && shown > 0 && <span className="ml-2 text-sm text-muted">{RATING_LABELS[shown]}</span>}
    </div>
  );
}
