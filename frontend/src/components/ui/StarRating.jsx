import { useState } from 'react';
import { Star } from 'lucide-react';

// Chọn 1–5 sao. Không truyền onChange = chỉ hiển thị (vd. điểm trung bình, cho
// phép số lẻ — sao được tô theo phần trăm).
export default function StarRating({ value = 0, onChange, size = 28, className = '' }) {
  const [hover, setHover] = useState(0);
  const readOnly = !onChange;
  const shown = readOnly ? value : hover || value;

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={readOnly ? `${value} trên 5 sao` : 'Chọn số sao'}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, shown - (n - 1)));
        const star = (
          <span className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-gray-200 fill-gray-200" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className="text-amber-400 fill-amber-400" />
              </span>
            )}
          </span>
        );
        if (readOnly) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sao`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="p-0.5 rounded-md transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

export const RATING_LABELS = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Rất tốt'];
