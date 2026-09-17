import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Printer, RefreshCw, FileWarning, Share2, Copy, Link2Off, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportApi } from '../../services/api';
import Spinner from '../../components/ui/Spinner';

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

  // Khoá scroll trang nền giống components/ui/Modal.jsx
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Tải về từ HTML đã có sẵn trong state — không gọi lại server lần hai.
  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `baocao-${eventName}.html`;
    a.click();
    URL.revokeObjectURL(url);
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

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard bị chặn (http, hoặc người dùng từ chối) — link vẫn hiện ra
      // trong ô bên dưới để copy tay, nên không báo lỗi ồn ào.
    }
  };

  const handleRevoke = () => {
    if (!confirm('Thu hồi link? Người đã nhận link sẽ không xem được báo cáo nữa.')) return;
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-full sm:h-[92vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 truncate">Báo cáo điểm danh</h2>
            <p className="text-xs text-gray-500 truncate">{eventName}</p>
          </div>
          <button onClick={load} disabled={loading} title="Làm mới số liệu"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setSharePanel((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              share?.shared ? 'text-primary-700 bg-primary-50 hover:bg-primary-100' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            <Share2 size={16} /> <span className="hidden sm:inline">{share?.shared ? 'Đang chia sẻ' : 'Chia sẻ'}</span>
          </button>
          <button onClick={handlePrint} disabled={loading || failed || !html}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
            <Printer size={16} /> In / PDF
          </button>
          <button onClick={handleDownload} disabled={loading || failed || !html}
            className="flex items-center gap-2 bg-primary-600 text-white font-medium px-3 py-2 rounded-xl text-sm hover:bg-primary-700 transition-colors disabled:opacity-50">
            <Download size={16} /> <span className="hidden sm:inline">Tải file</span>
          </button>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {sharePanel && (
          <div className="px-4 sm:px-6 py-3 bg-primary-50/60 border-b border-primary-100 flex-shrink-0 space-y-2">
            {share?.shared ? (
              <>
                <p className="text-xs text-gray-600">
                  Ai có link này đều xem được báo cáo, không cần đăng nhập. Số liệu luôn là mới nhất.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input readOnly value={share.url} onFocus={(e) => e.target.select()}
                    className="input flex-1 min-w-[220px] text-xs font-mono" />
                  <button onClick={() => { copyLink(share.url); toast.success('Đã copy link'); }}
                    className="flex items-center gap-1.5 bg-primary-600 text-white font-medium px-3 py-2 rounded-xl text-xs hover:bg-primary-700 transition-colors">
                    <Copy size={14} /> Copy
                  </button>
                  <button onClick={() => runShare(reportApi.createShare(eventId, { rotate: true }), 'Đã cấp link mới')} disabled={shareBusy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-white transition-colors disabled:opacity-50">
                    <RotateCw size={14} /> Link mới
                  </button>
                  <button onClick={handleRevoke} disabled={shareBusy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                    <Link2Off size={14} /> Thu hồi
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-600">
                  Tạo link công khai để gửi báo cáo cho người không có tài khoản.
                </p>
                <button onClick={() => runShare(reportApi.createShare(eventId), 'Đã tạo link, đã copy vào clipboard')} disabled={shareBusy}
                  className="flex items-center gap-1.5 bg-primary-600 text-white font-medium px-3 py-2 rounded-xl text-xs hover:bg-primary-700 transition-colors disabled:opacity-50">
                  {shareBusy ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Share2 size={14} />}
                  Tạo link chia sẻ
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 bg-[#F4F7FC] min-h-0">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Đang tạo báo cáo…</p>
            </div>
          ) : failed ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <FileWarning size={40} className="text-gray-300" />
              <p className="text-sm text-gray-500">Không tải được báo cáo.</p>
              <button onClick={load} className="text-sm font-medium text-primary-600 hover:text-primary-700">Thử lại</button>
            </div>
          ) : (
            <iframe
              ref={frameRef}
              title="Báo cáo điểm danh"
              srcDoc={html}
              sandbox={SANDBOX}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
