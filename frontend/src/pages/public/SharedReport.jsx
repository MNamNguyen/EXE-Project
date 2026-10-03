import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, Printer, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportApi } from '../../services/api';
import Button from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { Skeleton } from '../../components/ui/States';

// Trang xem báo cáo qua link BTC chia sẻ — người xem KHÔNG cần tài khoản.
// Cùng một bản HTML mà BTC xem/tải về, lấy từ /api/public/reports/:token và
// nhúng trong iframe sandbox (cách ly CSS báo cáo khỏi Tailwind của app, khoá
// script) giống ReportViewerModal.jsx.
const SANDBOX = 'allow-same-origin allow-modals';

export default function SharedReport() {
  const { token } = useParams();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // 'SHARE_NOT_FOUND' | 'UNKNOWN'
  const frameRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    reportApi.getSharedReport(token)
      .then(({ data }) => setHtml(data))
      .catch((err) => setError(err.response?.status === 404 ? 'SHARE_NOT_FOUND' : 'UNKNOWN'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bao-cao-diem-danh.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    try {
      frameRef.current?.contentWindow?.print();
    } catch {
      toast.error('Trình duyệt chặn in trực tiếp, hãy tải file về rồi in');
    }
  };

  if (error) {
    const revoked = error === 'SHARE_NOT_FOUND';
    return (
      <div className="min-h-screen bg-background px-4 pt-24 sm:pt-40">
        <div className="mx-auto max-w-md text-center">
          <div className="flex justify-center"><Logo className="size-10" /></div>
          <h1 className="mt-8 text-xl font-semibold text-foreground">
            {revoked ? 'Link báo cáo không còn hiệu lực' : 'Không tải được báo cáo'}
          </h1>
          <p className="mt-2 text-pretty text-sm/6 text-muted">
            {revoked ? 'Ban tổ chức đã thu hồi link này. Liên hệ Ban tổ chức để nhận link mới.' : 'Vui lòng thử lại sau ít phút.'}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {!revoked && <Button variant="primary" size="form" icon={RotateCw} onClick={load}>Thử lại</Button>}
            <Button as={Link} to="/" size="form">Về trang chủ</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <Logo />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">Báo cáo điểm danh</h1>
          <p className="truncate text-xs text-muted">Ban tổ chức chia sẻ · chỉ xem</p>
        </div>
        <Button size="hdr" icon={Printer} aria-label="In hoặc lưu PDF" disabled={loading} onClick={handlePrint}>
          <span className="hidden sm:inline">In hoặc lưu PDF</span>
        </Button>
        <Button size="hdr" icon={Download} aria-label="Tải file" disabled={loading} onClick={handleDownload}>
          <span className="hidden sm:inline">Tải file</span>
        </Button>
      </header>

      {loading ? (
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl space-y-4 rounded-2xl bg-surface p-6 sm:p-10" aria-busy="true">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <span className="sr-only" role="status">Đang tải báo cáo</span>
          </div>
        </main>
      ) : (
        <iframe ref={frameRef} title="Báo cáo điểm danh" srcDoc={html} sandbox={SANDBOX} className="min-h-0 w-full flex-1 border-0" />
      )}
    </div>
  );
}
