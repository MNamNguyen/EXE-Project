import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, Printer, FileWarning, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportApi } from '../../services/api';
import Spinner from '../../components/ui/Spinner';

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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F4F7FC]">
        <Spinner size="xl" />
        <p className="text-sm text-gray-500">Đang tải báo cáo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#F4F7FC]">
        <FileWarning size={44} className="text-gray-300" />
        <h1 className="text-lg font-bold text-gray-900">
          {error === 'SHARE_NOT_FOUND' ? 'Link báo cáo không còn hiệu lực' : 'Không tải được báo cáo'}
        </h1>
        <p className="text-sm text-gray-500 max-w-sm">
          {error === 'SHARE_NOT_FOUND'
            ? 'Ban tổ chức đã thu hồi link này. Hãy liên hệ để nhận link mới.'
            : 'Vui lòng thử lại sau ít phút.'}
        </p>
        {error !== 'SHARE_NOT_FOUND' && (
          <button onClick={load} className="text-sm font-medium text-primary-600 hover:text-primary-700">Thử lại</button>
        )}
        <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 mt-2 inline-flex items-center gap-1">
          Về trang chủ <ExternalLink size={12} />
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F4F7FC]">
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-gray-900">Báo cáo điểm danh</h1>
          <p className="text-xs text-gray-400">Ban tổ chức chia sẻ · chỉ xem</p>
        </div>
        <button onClick={handlePrint}
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
          <Printer size={16} /> In / PDF
        </button>
        <button onClick={handleDownload}
          className="flex items-center gap-2 bg-primary-600 text-white font-medium px-3 py-2 rounded-xl text-sm hover:bg-primary-700 transition-colors">
          <Download size={16} /> <span className="hidden sm:inline">Tải file</span>
        </button>
      </div>

      <iframe
        ref={frameRef}
        title="Báo cáo điểm danh"
        srcDoc={html}
        sandbox={SANDBOX}
        className="flex-1 w-full border-0 min-h-0"
      />
    </div>
  );
}
