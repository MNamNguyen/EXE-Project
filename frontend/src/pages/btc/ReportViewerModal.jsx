import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Copy, Download, Link2Off, Printer, RefreshCw, RotateCw, Share2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportApi } from '../../services/api';
import { Dialog, useConfirm } from '../../components/ui/Modal';
import Button, { IconButton } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadError, Skeleton } from '../../components/ui/States';
import { cx } from '../../utils/cx';

// Xem báo cáo điểm danh ngay trên web thay vì phải tải file .html rồi mở tay.
// Nội dung là CHÍNH bản HTML mà endpoint export trả về (?view=1), nên bản xem
// và bản tải về không bao giờ lệch nhau.
//
// Nhúng bằng iframe srcDoc + sandbox: báo cáo mang CSS riêng (banner gradient,
// grid, bảng) sẽ đè lên Tailwind của app nếu chèn thẳng vào DOM — iframe cách
// ly hoàn toàn. `sandbox` khoá script trong báo cáo (báo cáo vốn không có
// script), còn `allow-same-origin` để component cha gọi được print() và
// `allow-modals` để hộp thoại in mở lên được trong iframe sandbox.
const SANDBOX = 'allow-same-origin allow-modals';

export default function ReportViewerModal({ open, eventId, eventName, onClose }) {
  const confirm = useConfirm();
  const titleId = useId();
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const frameRef = useRef(null);

  // Link chia sẻ công khai: null = chưa biết (chưa hỏi server), { shared, url }
  // sau khi hỏi. Panel chỉ mở khi BTC bấm "Chia sẻ".
  const [share, setShare] = useState(null);
  const [sharePanel, setSharePanel] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  const load = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setFailed(false);
    reportApi.viewAttendanceHtml(eventId)
      .then(({ data }) => setHtml(data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (open) {
      load();
      reportApi.getShare(eventId).then(({ data }) => setShare(data.data)).catch(() => {});
    } else {
      setHtml('');
      setSharePanel(false);
    }
  }, [open, eventId, load]);

  // Tải về từ HTML đã có sẵn trong state — không gọi lại server lần hai.
  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `baocao-${eventName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard bị chặn (http, hoặc người dùng từ chối) — link vẫn hiện ra
      // trong ô bên dưới để copy tay, nên không báo lỗi ồn ào.
    }
  };

  const runShare = (promise, successMsg) => {
    setShareBusy(true);
    promise
      .then(({ data }) => {
        setShare(data.data);
        if (data.data.url) copyLink(data.data.url);
        toast.success(successMsg);
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Thao tác thất bại'))
      .finally(() => setShareBusy(false));
  };

  const handleRevoke = async () => {
    if (!(await confirm({
      title: 'Thu hồi link chia sẻ?',
      body: 'Người đã nhận link sẽ không xem được báo cáo nữa.',
      confirmLabel: 'Thu hồi link',
      icon: Link2Off,
    }))) return;
    setShareBusy(true);
    reportApi.revokeShare(eventId)
      .then(({ data }) => { setShare(data.data); toast.success('Đã thu hồi link chia sẻ'); })
      .catch((err) => toast.error(err.response?.data?.message || 'Thu hồi thất bại'))
      .finally(() => setShareBusy(false));
  };

  // In nội dung iframe (không phải cả trang app) — cũng là đường "lưu thành PDF".
  const handlePrint = () => {
    try {
      frameRef.current?.contentWindow?.print();
    } catch {
      toast.error('Trình duyệt chặn in trực tiếp, hãy tải file về rồi in');
    }
  };

  const noReport = loading || failed || !html;

  return (
    <Dialog open={open} onClose={onClose} closeOnOverlay labelledBy={titleId} panelClassName="flex h-[calc(100dvh-2rem)] max-w-5xl flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-lg font-semibold text-foreground">Báo cáo điểm danh</h2>
          <p className="truncate text-xs text-muted">{eventName}</p>
        </div>
        <IconButton icon={RefreshCw} label="Làm mới số liệu" size="size-9" disabled={loading} onClick={load}
          iconClassName={cx('size-4 shrink-0', loading && 'animate-spin')} />
        <Button size="hdr" icon={Share2} aria-expanded={sharePanel} aria-label="Chia sẻ" onClick={() => setSharePanel((v) => !v)}
          className={cx(sharePanel && 'bg-button-hover')}>
          <span className="hidden sm:inline">{share?.shared ? 'Đang chia sẻ' : 'Chia sẻ'}</span>
        </Button>
        <Button size="hdr" icon={Printer} disabled={noReport} onClick={handlePrint} className="hidden sm:inline-flex">In hoặc lưu PDF</Button>
        <Button size="hdr" icon={Download} disabled={noReport} onClick={handleDownload} aria-label="Tải file">
          <span className="hidden sm:inline">Tải file</span>
        </Button>
        <IconButton icon={X} label="Đóng" size="size-9" onClick={onClose} />
      </header>

      {sharePanel && (
        <div className="shrink-0 border-b border-border bg-background px-4 py-3 sm:px-6">
          {share?.shared ? (
            <div className="flex flex-col gap-2">
              <p className="text-pretty text-sm text-muted">
                Ai có link này đều xem được báo cáo, không cần đăng nhập. Số liệu luôn là mới nhất.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input readOnly value={share.url} aria-label="Link chia sẻ" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 font-mono md:text-xs" />
                <div className="flex flex-wrap gap-2">
                  <Button icon={Copy} onClick={() => { copyLink(share.url); toast.success('Đã copy link'); }}>Sao chép</Button>
                  <Button icon={RotateCw} disabled={shareBusy} onClick={() => runShare(reportApi.createShare(eventId, { rotate: true }), 'Đã cấp link mới')}>Link mới</Button>
                  <Button variant="danger" icon={Link2Off} disabled={shareBusy} onClick={handleRevoke}>Thu hồi</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-pretty text-sm text-muted">Tạo link công khai để gửi báo cáo cho người không có tài khoản.</p>
              <Button variant="primary" icon={Share2} loading={shareBusy} onClick={() => runShare(reportApi.createShare(eventId), 'Đã tạo link, đã copy vào clipboard')} className="shrink-0">
                Tạo link chia sẻ
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 bg-background">
        {loading ? (
          <div className="mx-auto max-w-3xl space-y-4 p-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <span className="sr-only" role="status">Đang tạo báo cáo</span>
          </div>
        ) : failed ? (
          <LoadError title="Không tải được báo cáo." onRetry={load} className="h-full justify-center" />
        ) : (
          <iframe ref={frameRef} title="Báo cáo điểm danh" srcDoc={html} sandbox={SANDBOX} className="h-full w-full border-0" />
        )}
      </div>
    </Dialog>
  );
}
