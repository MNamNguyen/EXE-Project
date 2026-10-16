import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { guestApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import GuestScanner from '../scan/GuestScanner';

// Trang quét thiệp của BTC (ADMIN hoặc người tạo sự kiện) — mở trên điện thoại ở cửa.
// Không dùng Layout có sidebar: màn quét cần chỗ cho camera.
export default function GuestScanPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [fatal, setFatal] = useState(null);

  // api ổn định giữa các lần render — GuestScanner dùng nó trong effect.
  const api = useMemo(() => ({
    summary: () => guestApi.scannerSummary(id),
    scan: (code) => guestApi.scan(id, code),
    search: (q) => guestApi.list(id, { search: q, limit: 15 }),
    checkIn: (guestId) => guestApi.checkIn(id, guestId),
    walkIn: (data) => guestApi.walkIn(id, data),
  }), [id]);

  const onFatal = useCallback((err) => {
    const status = err?.response?.status;
    if (status === 403) setFatal('Bạn không có quyền quét thiệp cho sự kiện này. Chỉ người tạo sự kiện hoặc Admin được quét.');
    else if (status === 404) setFatal('Không tìm thấy sự kiện — có thể đã bị xoá.');
    else if (status === 400) setFatal('Sự kiện này không dùng thiệp mời.');
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Button as={Link} to={`/events/${id}`} variant="ghost" size="hdr" icon={ArrowLeft}>Sự kiện</Button>
          <span className="ml-auto flex items-center gap-2 truncate text-xs text-muted">
            <Logo className="size-5" /> {user?.name}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4">
        {fatal ? (
          <div className="pt-16 text-center">
            <h1 className="text-lg font-semibold text-foreground">Không mở được trang quét</h1>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-muted">{fatal}</p>
            <Button as={Link} to="/events" size="form" className="mt-6">Về danh sách sự kiện</Button>
          </div>
        ) : (
          <GuestScanner api={api} onFatal={onFatal} />
        )}
      </main>
    </div>
  );
}
