import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Award, Upload, SlidersHorizontal, Send, Trash2, FileDown, RefreshCw, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { certificateApi } from '../../services/api';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import CertificateCanvas from '../certificates/CertificateCanvas';
import CertificateEditorModal from './CertificateEditorModal';
import { downloadBlob } from '../certificates/certRender';

const EMAIL_BADGE = {
  PENDING: { label: 'Chờ gửi email', variant: 'gray' },
  SENDING: { label: 'Đang gửi', variant: 'yellow' },
  SENT: { label: 'Đã gửi email', variant: 'green' },
  FAILED: { label: 'Email lỗi', variant: 'red' },
};
// Brevo gói free ~300 email/ngày cho CẢ hệ thống.
const QUOTA_WARN = 250;

// Khung "Chứng nhận tham gia" trong trang chi tiết sự kiện. Tuỳ chọn: không
// upload mẫu thì sự kiện không có chứng nhận. Chỉ ADMIN/người tạo — 403 thì ẩn.
export default function EventCertificatePanel({ event }) {
  const [setup, setSetup] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [busy, setBusy] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issued, setIssued] = useState(null); // danh sách đã cấp, nạp khi mở
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  const loadSetup = useCallback(() => certificateApi.getSetup(event.id)
    .then(({ data }) => { setSetup(data.data); return data.data; })
    .catch((err) => { if (err.response?.status === 403) setHidden(true); return null; }), [event.id]);

  const loadImage = useCallback(async () => {
    try {
      const { data } = await certificateApi.getTemplateImage(event.id);
      setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(data); });
    } catch {
      setImageUrl(null);
    }
  }, [event.id]);

  const loadIssued = useCallback(() => certificateApi.listIssued(event.id)
    .then(({ data }) => setIssued(data.data)).catch(() => {}), [event.id]);

  useEffect(() => { loadSetup(); }, [loadSetup]);
  useEffect(() => { if (setup?.template) loadImage(); }, [setup?.template?.updatedAt, loadImage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    clearTimeout(pollRef.current);
    setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
  }, []);

  const sampleValues = useMemo(() => ({
    name: 'Nguyễn Văn A',
    event: event.name,
    date: `Ngày ${format(event.checkinOpen ? new Date(event.checkinOpen) : new Date(), 'dd/MM/yyyy')}`,
    code: 'Mã chứng nhận: CN-XXXX-XXXX',
  }), [event.name, event.checkinOpen]);

  if (hidden) return null;
  if (!setup) return <div className="card p-4 flex justify-center"><Spinner size="md" /></div>;

  const { template, issuedCount, pendingCount, emailFailed } = setup;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Ảnh mẫu tối đa 5MB');
    setBusy('upload');
    try {
      const { data } = await certificateApi.uploadImage(event.id, file);
      toast.success(data.message);
      setSetup(data.data);
      if (!template) setEditorOpen(true); // lần đầu: mở ngay editor để căn vị trí
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload thất bại');
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    setBusy('preview');
    try {
      const { data } = await certificateApi.previewPdf(event.id);
      downloadBlob(data, `xem-thu-chung-nhan-${event.name}.pdf`);
    } catch {
      toast.error('Không tạo được PDF xem thử');
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Gỡ mẫu chứng nhận khỏi sự kiện này?')) return;
    setBusy('remove');
    try {
      await certificateApi.removeTemplate(event.id);
      toast.success('Đã gỡ mẫu chứng nhận');
      setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      await loadSetup();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gỡ mẫu thất bại');
    } finally {
      setBusy(null);
    }
  };

  // Email gửi nền ở server — hỏi lại vài lần để cập nhật trạng thái.
  const poll = (attempt = 0) => {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      await Promise.all([loadSetup(), loadIssued()]);
      if (attempt < 5) poll(attempt + 1);
    }, 3000);
  };

  const handleIssue = async () => {
    setBusy('issue');
    try {
      const { data } = await certificateApi.issue(event.id);
      toast.success(data.message);
      setIssueOpen(false);
      await Promise.all([loadSetup(), loadIssued()]);
      poll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cấp chứng nhận thất bại');
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (cert) => {
    if (!confirm(`Thu hồi chứng nhận của ${cert.recipientName}? Người này sẽ không xem/tải được nữa.`)) return;
    try {
      await certificateApi.revoke(event.id, cert.id);
      toast.success('Đã thu hồi chứng nhận');
      await Promise.all([loadSetup(), loadIssued()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thu hồi thất bại');
    }
  };

  const canIssue = pendingCount > 0 || emailFailed > 0;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <Award size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Chứng nhận tham gia</p>
          <p className="text-xs text-gray-400">
            {template
              ? `Đã cấp ${issuedCount} · ${pendingCount} người đã check-out đang chờ cấp`
              : 'Không bắt buộc — upload mẫu nếu sự kiện này có cấp chứng nhận'}
          </p>
        </div>
        {template && (
          <button onClick={() => setIssueOpen(true)} disabled={!canIssue || busy === 'issue'}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
            <Send size={14} /> Cấp chứng nhận{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleUpload} />

      {!template ? (
        <div className="border-t border-border pt-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <button onClick={() => fileRef.current?.click()} disabled={busy === 'upload'} className="btn-secondary btn-sm justify-center">
            {busy === 'upload' ? <Spinner size="sm" /> : <Upload size={14} />} Upload ảnh mẫu
          </button>
          <p className="text-xs text-gray-400">
            Ảnh PNG/JPG tối đa 5MB, mỗi chiều ≥ 500px. Nên thiết kế sẵn khung (ví dụ trên Canva, khổ A4 ngang) và
            để trống chỗ ghi tên — hệ thống tự điền họ tên, tên sự kiện, ngày và mã chứng nhận.
          </p>
        </div>
      ) : (
        <div className="border-t border-border pt-3 grid sm:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <button onClick={() => setEditorOpen(true)} className="block text-left" title="Chỉnh bố cục">
            {imageUrl
              ? <CertificateCanvas imageUrl={imageUrl} template={template} values={sampleValues} />
              : <div className="aspect-[1.41] rounded-lg bg-gray-50 flex items-center justify-center"><Spinner size="md" /></div>}
          </button>
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setEditorOpen(true)} disabled={!imageUrl}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50">
                <SlidersHorizontal size={14} /> Chỉnh bố cục
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50">
                {busy === 'upload' ? <Spinner size="sm" /> : <Upload size={14} />} Đổi ảnh mẫu
              </button>
              <button onClick={handlePreview} disabled={busy === 'preview'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50">
                {busy === 'preview' ? <Spinner size="sm" /> : <FileDown size={14} />} Tải PDF xem thử
              </button>
              {issuedCount === 0 && (
                <button onClick={handleRemove} disabled={busy === 'remove'}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                  <Trash2 size={14} /> Gỡ mẫu
                </button>
              )}
            </div>
            {issuedCount > 0 && (
              <p className="text-[11px] text-amber-700">
                Đã cấp {issuedCount} chứng nhận — đổi ảnh hoặc bố cục sẽ áp dụng cho cả chứng nhận đã cấp.
              </p>
            )}
            {emailFailed > 0 && (
              <p className="text-[11px] text-red-600">
                {emailFailed} email thông báo gửi lỗi — bấm "Cấp chứng nhận" để gửi lại.
              </p>
            )}

            {issuedCount > 0 && (
              <details className="pt-1" onToggle={(e) => { if (e.currentTarget.open && issued === null) loadIssued(); }}>
                <summary className="text-xs font-semibold text-gray-500 cursor-pointer select-none flex items-center gap-2">
                  Danh sách đã cấp ({issuedCount})
                  <button type="button" onClick={(e) => { e.preventDefault(); loadIssued(); loadSetup(); }}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Làm mới">
                    <RefreshCw size={12} />
                  </button>
                </summary>
                {issued === null ? (
                  <div className="py-3 flex justify-center"><Spinner size="sm" /></div>
                ) : (
                  <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-gray-100 border border-border rounded-lg">
                    {issued.map((c) => {
                      const badge = EMAIL_BADGE[c.emailStatus] || { label: c.emailStatus, variant: 'gray' };
                      return (
                        <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-800 truncate">{c.recipientName}</p>
                            <p className="text-gray-400 font-mono">{c.user?.mssv || c.user?.email} · {c.code}</p>
                          </div>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <button onClick={() => handleRevoke(c)} className="p-1 rounded text-gray-300 hover:text-red-600 hover:bg-red-50" title="Thu hồi">
                            <XCircle size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </details>
            )}
          </div>
        </div>
      )}

      {template && imageUrl && (
        <CertificateEditorModal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          event={event}
          template={template}
          imageUrl={imageUrl}
          onSaved={setSetup}
        />
      )}

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Cấp chứng nhận tham gia" size="sm">
        <div className="space-y-4 text-sm text-gray-600">
          {pendingCount > 0 ? (
            <p>Cấp chứng nhận cho <b>{pendingCount}</b> người đã check-out chưa có chứng nhận, và gửi email báo cho từng người.</p>
          ) : (
            <p>Không có ai mới đủ điều kiện. Hệ thống sẽ gửi lại <b>{emailFailed}</b> email thông báo bị lỗi lần trước.</p>
          )}
          {emailFailed > 0 && pendingCount > 0 && <p>Kèm gửi lại {emailFailed} email bị lỗi lần trước.</p>}
          {pendingCount + emailFailed > QUOTA_WARN && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Danh sách lớn: gói email miễn phí chỉ gửi được khoảng 300 email/ngày cho toàn hệ thống. Chứng nhận vẫn được cấp đủ,
              chỉ một số email thông báo có thể lỗi — bấm cấp lại vào hôm sau để gửi lại.
            </p>
          )}
          <p className="text-xs text-gray-400">Người check-out sau này sẽ chưa có chứng nhận — bấm "Cấp chứng nhận" lần nữa để cấp thêm.</p>
          <div className="flex gap-3">
            <button onClick={() => setIssueOpen(false)} className="btn-secondary btn-md flex-1">Huỷ</button>
            <button onClick={handleIssue} disabled={busy === 'issue'} className="btn-primary btn-md flex-1">
              {busy === 'issue' ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={15} />}
              Cấp chứng nhận
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
