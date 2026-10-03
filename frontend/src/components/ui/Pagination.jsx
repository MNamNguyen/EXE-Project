import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './Button';
import Select from './Select';
import { cx } from '../../utils/cx';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

// Cửa sổ 7 ô (tính cả …) khi nhiều hơn 7 trang, để nav luôn rộng như nhau
function pageWindow(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '…', pages];
  if (page >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, '…', page - 1, page, page + 1, '…', pages];
}

// Chân bảng: số đếm bên trái, mọi control bên phải. Một trang thì ẩn nav. Không dòng nào thì
// đừng dựng chân bảng (bảng rỗng đã có câu riêng).
// compact = chỉ "‹ 3 / 19 ›" ở mọi bề rộng; note = câu phụ sau số đếm (ẩn ở điện thoại);
// bare = không viền trên, không lề (đặt trong modal).
export default function Pagination({
  page, pages, total, pageSize, noun = 'dòng', onPageChange, compact = false, note,
  pageSizeOptions, onPageSizeChange, bare = false, className,
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const showSize = pageSizeOptions && onPageSizeChange && total > Math.min(...pageSizeOptions);
  return (
    <div className={cx('flex items-center justify-between gap-4', !bare && 'border-t border-border px-4 py-3', className)}>
      <p className="text-sm tabular-nums text-muted">
        <span className="hidden sm:inline">{`${fmt(from)} tới ${fmt(to)} trong `}</span>
        {`${fmt(total)} ${noun}`}
        {note && <span className="hidden sm:inline">{` · ${note}`}</span>}
      </p>
      <div className="flex shrink-0 items-center gap-4">
        {showSize && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-muted">Mỗi trang</span>
            <Select
              inline
              size="sm"
              placement="top"
              align="end"
              aria-label="Số dòng mỗi trang"
              value={pageSize}
              onChange={onPageSizeChange}
              options={pageSizeOptions.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Phân trang" className="flex shrink-0 items-center gap-1">
            <IconButton icon={ChevronLeft} label="Trang trước" size="size-9" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
            {!compact && (
              <span className="hidden items-center gap-1 sm:flex">
                {pageWindow(page, pages).map((p, i) =>
                  p === '…' ? (
                    <span key={`gap-${i}`} className="inline-flex h-9 min-w-9 items-center justify-center text-sm text-muted">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      aria-current={p === page ? 'page' : undefined}
                      onClick={() => onPageChange(p)}
                      className={cx(
                        'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-medium tabular-nums outline-none',
                        p === page ? 'border-transparent bg-secondary text-foreground' : 'border-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}
              </span>
            )}
            <span className={cx('whitespace-nowrap px-1 text-sm tabular-nums text-foreground', !compact && 'sm:hidden')}>
              {page} / {pages}
            </span>
            <IconButton icon={ChevronRight} label="Trang sau" size="size-9" disabled={page >= pages} onClick={() => onPageChange(page + 1)} />
          </nav>
        )}
      </div>
    </div>
  );
}
