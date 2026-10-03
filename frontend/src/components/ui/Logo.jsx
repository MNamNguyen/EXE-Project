import { useId } from 'react';
import { cx } from '../../utils/cx';

// Dấu chữ F của FPT Event (cùng hình với public/favicon.svg). Vẽ inline để đổi cỡ không vỡ nét;
// mỗi lần vẽ một id gradient riêng, kẻo hai logo trên cùng trang tranh nhau một id.
export default function Logo({ className = 'size-8' }) {
  const gid = `logo-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={cx(className, 'shrink-0')} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1A6BFF" />
          <stop offset="1" stopColor="#00A3FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gid})`} />
      <g transform="translate(16.42 14) scale(0.016822)" fill="#fff">
        <path d="M0 0H1852V378H0Z M1465 837H1852V1224H1465Z M1465 1744H1852V2131H1465Z M1299 840C493 840 0 1332 0 2140H387C387 1558 717 1228 1299 1228Z" />
      </g>
    </svg>
  );
}

// Logo + tên sản phẩm, dùng ở đầu sidebar, header trang công khai, màn đăng nhập
export function ProductBrand({ logoClassName = 'size-8', textClassName = 'text-sm font-semibold text-foreground', className }) {
  return (
    <span className={cx('flex items-center gap-2.5', className)}>
      <Logo className={logoClassName} />
      <span className={textClassName}>FPT Event</span>
    </span>
  );
}
