import { CircleAlert, Info, RotateCw, TriangleAlert } from 'lucide-react';
import Button from './Button';
import { cx } from '../../utils/cx';

// Thanh thông báo trong trang: một tình trạng còn kéo dài (khác toast). Chỉ icon và tiêu đề mang
// màu, mô tả chữ thường. tone: info | warning | error.
const BANNER = {
  info: { box: 'border-border bg-background', icon: Info, iconCls: 'text-muted', title: 'text-foreground', role: 'status' },
  warning: { box: 'border-transparent bg-warning-bg', icon: TriangleAlert, iconCls: 'text-warning', title: 'text-warning', role: 'status' },
  error: { box: 'border-error-border bg-error-bg', icon: CircleAlert, iconCls: 'text-error-text', title: 'text-error-strong', role: 'alert' },
};

export function Banner({ tone = 'info', title, children, action, compact = false, className }) {
  const t = BANNER[tone];
  const Icon = t.icon;
  return (
    <div role={t.role} className={cx('flex gap-3 border', compact ? 'rounded-xl p-3' : 'rounded-2xl p-4', t.box, className)}>
      <Icon className={cx('mt-0.5 size-5 shrink-0', t.iconCls)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className={cx('text-sm font-medium', t.title)}>{title}</p>}
        {children && <div className={cx('text-pretty text-sm text-foreground/80', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1 self-center">{action}</div>}
    </div>
  );
}

// Danh sách rỗng: một câu nói chuyện gì và làm gì tiếp, không icon to, không khung riêng
export function EmptyText({ className, children }) {
  return <p className={cx('text-pretty py-6 text-center text-sm text-muted', className)}>{children}</p>;
}

// Lỗi tải: câu đỏ nói cái gì hỏng, câu xám nói vì sao, nút Thử lại
export function LoadError({ title, reason = 'Máy chủ có thể đang khởi động lại, thử lại sau vài giây.', onRetry, className }) {
  return (
    <div role="alert" className={cx('flex flex-col items-center gap-3 py-10 text-center', className)}>
      <div>
        <p className="text-sm font-medium text-error-text">{title}</p>
        {reason && <p className="mt-1 text-sm text-muted">{reason}</p>}
      </div>
      {onRetry && <Button icon={RotateCw} onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function Skeleton({ className = 'h-3 w-2/5' }) {
  return <div className={cx('animate-pulse rounded-full bg-foreground/5 motion-reduce:animate-none', className)} />;
}

const W1 = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5'];
const W2 = ['w-1/4', 'w-1/5', 'w-1/3', 'w-1/4'];

// Khung chờ dạng dòng danh sách (lần tải đầu)
export function SkeletonRows({ rows = 6, avatar = true, right = true, className }) {
  return (
    <>
      <ul aria-busy="true" className={cx('divide-y divide-border', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            {avatar && <div className="size-8 shrink-0 animate-pulse rounded-full bg-foreground/5 motion-reduce:animate-none" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cx('h-3', W1[i % 4])} />
              <Skeleton className={cx('h-3', W2[i % 4])} />
            </div>
            {right && <Skeleton className="h-3 w-16" />}
          </li>
        ))}
      </ul>
      <span className="sr-only" role="status">Đang tải</span>
    </>
  );
}

// Spinner nhỏ cho chỗ chờ ngắn (cả trang đang xác thực phiên)
export function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span className="size-6 animate-spin rounded-full border-2 border-foreground/10 border-t-primary" role="status" aria-label="Đang tải" />
    </div>
  );
}
