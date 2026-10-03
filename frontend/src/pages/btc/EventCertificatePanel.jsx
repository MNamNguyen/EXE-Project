import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown, CircleX, FileDown, RefreshCw, Send, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { certificateApi } from '../../services/api';
import Modal, { useConfirm } from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Button, { IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Banner, Skeleton, SkeletonRows } from '../../components/ui/States';
import CertificateCanvas from '../certificates/CertificateCanvas';
import CertificateEditorModal from './CertificateEditorModal';
import { downloadBlob } from '../certificates/certRender';

const EMAIL_BADGE = {
  PENDING: { label: 'Chờ gửi email', tone: 'neutral' },
  SENDING: { label: 'Đang gửi', tone: 'warning' },
  SENT: { label: 'Đã gửi email', tone: 'success' },
  FAILED: { label: 'Email lỗi', tone: 'error' },
};
// Brevo gói free ~300 email/ngày cho CẢ hệ thống.
const QUOTA_WARN = 250;

// Khung "Chứng nhận tham gia" trong trang chi tiết sự kiện. Tuỳ chọn: không
// upload mẫu thì sự kiện không có chứng nhận. Chỉ ADMIN/người tạo — 403 thì ẩn
// (onUnavailable để trang cha ẩn tab).
export default function EventCertificatePanel({ event, onUnavailable }) {
  const confirm = useConfirm();
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
    .catch((err) => {
      if (err.response?.status === 403) { setHidden(true); onUnavailable?.(); }
      return null;
    }), [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  if (!setup) {
    return (
      <Card title="Chứng nhận tham gia">
        <div className="space-y-3"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-32 w-full rounded-xl" /></div>
      </Card>
    );
  }

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
    if (!(await confirm({
      title: 'Gỡ mẫu chứng nhận?',
      body: 'Mẫu chứng nhận sẽ bị gỡ khỏi sự kiện này.',
      confirmLabel: 'Gỡ mẫu',
    }))) return;
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
    if (!(await confirm({
      title: 'Thu hồi chứng nhận?',
      body: <><span className="font-medium text-foreground">{cert.recipientName}</span> sẽ không xem, tải được chứng nhận này nữa.</>,
      confirmLabel: 'Thu hồi chứng nhận',
      icon: CircleX,
    }))) return;
    try {
      await certificateApi.revoke(event.id, cert.id);
      toast.success('Đã thu hồi chứng nhận');
      await Promise.all([loadSetup(), loadIssued()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thu hồi thất bại');
    }
  };

  const canIssue = pendingCount > 0 || emailFailed > 0;
  let sub = 'Không bắt buộc — upload mẫu nếu sự kiện này có cấp chứng nhận';
  if (template) {
    const waiting = pendingCount > 0
      ? `${pendingCount} người đã check-out đang chờ cấp`
      : issuedCount > 0 ? 'đã cấp cho mọi người đã check-out' : 'chưa có ai check-out để cấp';
    sub = `Đã cấp ${issuedCount} · ${waiting}`;
  }

  return (
    <Card
      title="Chứng nhận tham gia"
      sub={sub}
      action={template && (
        <Button icon={Send} disabled={!canIssue || busy === 'issue'} onClick={() => setIssueOpen(true)}>Cấp chứng nhận</Button>
      )}
    >
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleUpload} />

      {!template ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button icon={Upload} loading={busy === 'upload'} onClick={() => fileRef.current?.click()} className="shrink-0">Upload ảnh mẫu</Button>
          <p className="text-pretty text-xs text-muted">
            Ảnh PNG/JPG tối đa 5MB, mỗi chiều ≥ 500px. Nên thiết kế sẵn khung (ví dụ trên Canva, khổ A4 ngang) và
            để trống chỗ ghi tên — hệ thống tự điền họ tên, tên sự kiện, ngày và mã chứng nhận.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_14rem]">
            <button type="button" onClick={() => imageUrl && setEditorOpen(true)} className="block cursor-pointer text-left outline-none" title="Chỉnh bố cục">
              {imageUrl
                ? <CertificateCanvas imageUrl={imageUrl} template={template} values={sampleValues} />
                : <Skeleton className="aspect-[1.414] w-full rounded-xl" />}
            </button>
            <div className="flex flex-col gap-2">
              <Button icon={SlidersHorizontal} disabled={!imageUrl} onClick={() => setEditorOpen(true)} className="justify-start">Chỉnh bố cục</Button>
              <Button icon={Upload} loading={busy === 'upload'} onClick={() => fileRef.current?.click()} className="justify-start">Đổi ảnh mẫu</Button>
              <Button icon={FileDown} loading={busy === 'preview'} onClick={handlePreview} className="justify-start">Tải PDF xem thử</Button>
              {issuedCount === 0 && (
                <Button variant="danger" icon={Trash2} loading={busy === 'remove'} onClick={handleRemove} className="justify-start">Gỡ mẫu</Button>
              )}
              <p className="mt-2 text-pretty text-xs text-muted">Ảnh PNG, JPG tối đa 5 MB. Họ tên, tên sự kiện, ngày và mã được điền tự động.</p>
              {issuedCount > 0 && (
                <p className="text-pretty text-xs font-medium text-warning">
                  Đã cấp {issuedCount} chứng nhận — đổi ảnh hoặc bố cục sẽ áp dụng cho cả chứng nhận đã cấp.
                </p>
              )}
              {emailFailed > 0 && (
                <p className="text-pretty text-xs text-error-text">
                  {emailFailed} email thông báo gửi lỗi — bấm “Cấp chứng nhận” để gửi lại.
                </p>
              )}
            </div>
          </div>

          {issuedCount > 0 && (
            <details
              className="group mt-6 border-t border-border pt-4"
              onToggle={(e) => { if (e.currentTarget.open && issued === null) loadIssued(); }}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground outline-none [&::-webkit-details-marker]:hidden">
                Danh sách đã cấp
                <span className="text-xs font-normal tabular-nums text-muted">{issuedCount}</span>
                <ChevronDown className="size-4 text-muted transition-[transform,rotate] group-open:rotate-180" aria-hidden="true" />
                <IconButton
                  icon={RefreshCw}
                  label="Làm mới"
                  className="ml-auto"
                  onClick={(e) => { e.preventDefault(); loadIssued(); loadSetup(); }}
                />
              </summary>
              {issued === null ? (
                <SkeletonRows rows={3} avatar={false} />
              ) : (
                <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto">
                  {issued.map((c) => {
                    const badge = EMAIL_BADGE[c.emailStatus] || { label: c.emailStatus, tone: 'neutral' };
                    return (
                      <li key={c.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{c.recipientName}</p>
                          <p className="truncate text-xs text-muted">
                            {c.user?.mssv || c.user?.email} · <span className="font-mono">{c.code}</span>
                          </p>
                        </div>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        <IconButton icon={CircleX} label="Thu hồi" danger onClick={() => handleRevoke(c)} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>
          )}
        </>
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

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Cấp chứng nhận tham gia"
        size="sm"
        description={pendingCount > 0 ? (
          <>Cấp chứng nhận cho <span className="font-medium text-foreground">{pendingCount}</span> người đã check-out chưa có chứng nhận, và gửi email báo cho từng người.</>
        ) : (
          <>Không có ai mới đủ điều kiện. Hệ thống sẽ gửi lại <span className="font-medium text-foreground">{emailFailed}</span> email thông báo bị lỗi lần trước.</>
        )}
        footer={(
          <>
            <Button variant="secondary" size="form" onClick={() => setIssueOpen(false)}>Huỷ</Button>
            <Button variant="primary" size="form" loading={busy === 'issue'} onClick={handleIssue}>Cấp chứng nhận</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3 text-sm text-muted">
          {emailFailed > 0 && pendingCount > 0 && <p className="text-foreground">Kèm gửi lại {emailFailed} email bị lỗi lần trước.</p>}
          {pendingCount + emailFailed > QUOTA_WARN && (
            <Banner tone="warning" compact>
              Danh sách lớn: gói email miễn phí chỉ gửi được khoảng 300 email/ngày cho toàn hệ thống. Chứng nhận vẫn được cấp đủ,
              chỉ một số email thông báo có thể lỗi — bấm cấp lại vào hôm sau để gửi lại.
            </Banner>
          )}
          <p className="text-pretty text-xs">Người check-out sau này sẽ chưa có chứng nhận — bấm “Cấp chứng nhận” lần nữa để cấp thêm.</p>
        </div>
      </Modal>
    </Card>
  );
}
