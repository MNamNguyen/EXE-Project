import { cx } from '../../../utils/cx';
import { seatCode } from './seats';

// Lưới ghế dùng chung cho sơ đồ (gán ghế) và hộp sửa sơ đồ (bấm để bỏ/khôi phục ghế).
// Hàng A sát sân khấu ở trên cùng; hàng ngắn hơn được căn giữa như rạp thật. Lưới rộng
// hơn màn hình thì cuộn ngang TRONG khung, trang không bị cuộn ngang.
//
// seatState(code) → 'free' | 'assigned' | 'arrived' | 'disabled' | 'active' | 'moving'
// seatTitle(code) → chú thích khi rê chuột / trình đọc màn hình

export const SEAT_STYLES = {
  free: 'border border-border-strong bg-surface text-muted hover:border-primary hover:text-primary',
  assigned: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25 hover:ring-primary/60',
  arrived: 'bg-success text-white hover:opacity-90 dark:text-primary-foreground',
  active: 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-surface',
  moving: 'bg-warning-bg text-warning ring-2 ring-warning ring-offset-2 ring-offset-surface',
  disabled: 'border border-dashed border-border-strong bg-transparent text-transparent',
};

export const SEAT_LEGEND = [
  { state: 'free', label: 'Trống' },
  { state: 'assigned', label: 'Đã đặt' },
  { state: 'arrived', label: 'Đã tới' },
  { state: 'disabled', label: 'Không dùng' },
];

export function SeatSwatch({ state }) {
  return <span className={cx('inline-block size-3.5 rounded', SEAT_STYLES[state])} aria-hidden="true" />;
}

export default function SeatGrid({ seatMap, seatState, seatTitle, onSeatClick, className }) {
  const aisles = new Set(seatMap.aisleAfter || []);
  return (
    <div className={cx('min-w-0', className)}>
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto flex w-max flex-col items-center gap-1.5 px-1">
          <div className="mb-4 w-full min-w-48 rounded-lg bg-secondary py-1.5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Sân khấu
          </div>
          {seatMap.rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">{row.label}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: row.seats }, (_, i) => {
                  const n = i + 1;
                  const code = seatCode(row.label, n);
                  const state = seatState(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onSeatClick(code, state)}
                      title={seatTitle?.(code)}
                      aria-label={seatTitle?.(code) || code}
                      aria-pressed={state === 'active' || state === 'moving' || undefined}
                      className={cx(
                        'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[10px] font-semibold tabular-nums outline-none transition-[background-color,border-color,box-shadow,color] focus-visible:ring-2 focus-visible:ring-primary',
                        SEAT_STYLES[state],
                        aisles.has(n) && n < row.seats && 'mr-4',
                      )}
                    >
                      {state === 'disabled' ? '' : String(n).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
              <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-muted">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
