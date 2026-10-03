import { cx } from '../../utils/cx';

// Vòng quay cho chỗ chờ ngắn. Danh sách tải lần đầu thì dùng SkeletonRows (States.jsx).
export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'size-4 border-2', md: 'size-6 border-2', lg: 'size-8 border-[3px]', xl: 'size-10 border-[3px]' };
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={cx('inline-block animate-spin rounded-full border-foreground/10 border-t-primary', sizes[size], className)}
    />
  );
}
