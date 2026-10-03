import { format } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { cx } from '../../utils/cx';

// Card: nền trắng, viền mảnh, bo 16px, không bóng. flush = danh sách bên trong tự lo lề ngang
// (dòng có nền rê chạm gần mép card).
export function Card({ title, sub, action, flush = false, as: Tag = 'section', titleAs: TitleTag = 'h2', className, bodyClassName, children, ...props }) {
  return (
    <Tag className={cx('flex min-w-0 flex-col rounded-2xl border border-border bg-surface', flush ? 'py-4 sm:py-5' : 'p-4 sm:p-5', className)} {...props}>
      {title && (
        <header className={cx('flex items-start justify-between gap-3', flush ? 'px-4 sm:px-5' : 'mb-4', flush && !action && 'mb-1.5')}>
          <div className={cx('flex min-w-0 flex-col justify-center', action && 'min-h-10')}>
            <TitleTag className={cx(TitleTag === 'h1' ? 'text-lg' : 'text-base', 'text-balance font-semibold text-foreground')}>{title}</TitleTag>
            {sub && <p className="mt-0.5 text-pretty text-sm text-muted">{sub}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cx('min-h-0 flex-1', flush && 'px-2', bodyClassName)}>{children}</div>
    </Tag>
  );
}

// Hàng ô số liệu: một khung chia khe 1px, không bốn card rời
export function StatGrid({ tiles, cols = 'grid-cols-2 lg:grid-cols-4', small = false, className }) {
  return (
    <div className="min-w-0">
      <div className={cx('grid gap-px overflow-hidden rounded-2xl bg-border', cols, className)}>
        {tiles.map((t) => (
          <div key={t.label} className={cx('min-w-0 bg-surface', small ? 'p-4' : 'p-4 sm:p-5')}>
            <p className="text-xs font-medium text-muted">{t.label}</p>
            <p className={cx('mt-1 font-semibold tracking-tight tabular-nums text-foreground', small ? 'text-lg' : 'text-xl sm:text-2xl')}>
              {t.value}
              {t.unit && <span className="ml-1 font-semibold text-muted">{t.unit}</span>}
            </p>
            {t.sub && (
              <p className={cx('mt-1 truncate text-xs', t.subTone === 'warning' ? 'font-medium text-warning' : 'text-muted')}>{t.sub}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Khung bảng: bo 16px, viền mảnh, nền trắng
export function TableCard({ className, children }) {
  return (
    <div className="min-w-0">
      <div className={cx('overflow-hidden rounded-2xl border border-border bg-surface', className)}>{children}</div>
    </div>
  );
}

export function Th({ className, children, ...props }) {
  return (
    <th scope="col" className={cx('whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted', className)} {...props}>
      {children}
    </th>
  );
}

// Ô ngày đầu dòng sự kiện: ngày to, tháng nhỏ. Sự kiện đang diễn ra tô màu nhấn.
// Không đặt lịch thì icon lịch-giờ.
export function DateTile({ date, live = false }) {
  if (!date) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background text-muted group-hover:bg-surface">
        <CalendarClock className="size-5" aria-hidden="true" />
      </div>
    );
  }
  const d = new Date(date);
  return (
    <div
      className={cx(
        'flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none',
        live ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground group-hover:bg-surface',
      )}
    >
      <span className="text-base font-semibold tabular-nums">{format(d, 'dd')}</span>
      <span className={cx('mt-1 text-xs font-medium', live ? 'text-primary-foreground/80' : 'text-muted')}>{`TH${d.getMonth() + 1}`}</span>
    </div>
  );
}
