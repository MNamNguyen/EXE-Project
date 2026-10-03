import { Link } from 'react-router-dom';
import { ProductBrand } from '../../components/ui/Logo';
import { cx } from '../../utils/cx';

// Thanh trên của các trang công khai (đăng ký sự kiện): logo về trang chủ, một nút bên phải
export default function PublicHeader({ right, maxWidth = 'max-w-3xl' }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className={cx('mx-auto flex h-16 items-center justify-between gap-3 px-4', maxWidth)}>
        <Link to="/" className="outline-none"><ProductBrand /></Link>
        {right}
      </div>
    </header>
  );
}
