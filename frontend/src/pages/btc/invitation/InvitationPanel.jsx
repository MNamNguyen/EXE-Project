import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, Printer, Send, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { guestApi } from '../../../services/api';
import Modal, { useConfirm } from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Banner, Skeleton } from '../../../components/ui/States';
import CertificateCanvas from '../../certificates/CertificateCanvas';
import LayoutEditorModal from '../../certificates/LayoutEditorModal';
import { downloadBlob } from '../../certificates/certRender';
import {
  INVITATION_DEFAULT_FIELDS, INVITATION_FIELD_LABELS, drawInvitation, invitationTime,
} from '../../certificates/invitationRender';

// Brevo gói free ~300 email/ngày cho CẢ hệ thống.
const QUOTA_WARN = 250;
const SAMPLE_QR = `${window.location.origin}/thiep/XEM-THU-KHONG-DUNG-DUOC`;

// Tab "Thiệp mời": mẫu thiệp (tuỳ chọn — không upload thì dùng thiệp mặc định), tải
// toàn bộ thiệp để in, gửi thiệp qua email. stats lấy từ danh sách khách (trang cha).
export default function InvitationPanel({ event, stats, onChanged }) {
  const confirm = useConfirm();
  const [template, setTemplate] = useState(undefined); // undefined = đang tải, null = chưa có
  const [imageUrl, setImageUrl] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  const loadTemplate = useCallback(() => guestApi.getTemplate(event.id)
    .then(({ data }) => setTemplate(data.data.template))
    .catch(() => setTemplate(null)), [event.id]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);

  useEffect(() => {
    if (!template) {
      setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      return;
    }
    guestApi.getTemplateImage(event.id)
      .then(({ data }) => setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(data); }))
      .catch(() => setImageUrl(null));
  }, [template?.updatedAt, event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearTimeout(pollRef.current);
    setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
  }, []);

  const makeValues = useCallback((name) => ({
    name,
    event: event.name,
    time: event.startsAt ? invitationTime(event.startsAt) : '',
    location: event.location,
    seat: 'Ghế E08, E09', // mẫu như invitation.controller#previewInvitation
    tickets: '2 vé',
    seatCodes: 'E08, E09',
    ticketNumber: '2',
  }), [event.name, event.startsAt, event.location]);
  const sampleValues = useMemo(() => makeValues('Nguyễn Văn A'), [makeValues]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Ảnh nền tối đa 5MB');
    setBusy('upload');
    try {
      const { data } = await guestApi.uploadTemplateImage(event.id, file);
      toast.success(data.message);
      const first = !template;
      setTemplate(data.data.template);
      if (first) setEditorOpen(true); // lần đầu: mở ngay editor để căn vị trí
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload thất bại');
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    setBusy('preview');
    try {
      const { data } = await guestApi.previewPdf(event.id);
      downloadBlob(data, `xem-thu-thiep-moi-${event.name}.pdf`);
    } catch {
      toast.error('Không tạo được PDF xem thử');
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!(await confirm({
      title: 'Gỡ mẫu thiệp?',
      body: 'Thiệp sẽ dùng mẫu mặc định của hệ thống. Thiệp đã gửi vẫn mở được, nhưng tải lại sẽ ra mẫu mặc định.',
      confirmLabel: 'Gỡ mẫu',
    }))) return;
    setBusy('remove');
    try {
      await guestApi.removeTemplate(event.id);
      toast.success('Đã gỡ mẫu — dùng thiệp mặc định');
      setTemplate(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gỡ mẫu thất bại');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadAll = async () => {
    setBusy('all');
    try {
      const { data } = await guestApi.allPdf(event.id);
      downloadBlob(data, `thiep-moi-${event.name}.pdf`);
    } catch (err) {
      const msg = err.response?.data instanceof Blob ? 'Chưa có khách mời nào để tạo thiệp' : 'Không tạo được file thiệp';
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  // Email gửi nền ở server — hỏi lại vài lần để cập nhật số đã gửi.
  const poll = (attempt = 0) => {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => {
      onChanged?.();
      if (attempt < 6) poll(attempt + 1);
    }, 4000);
  };

  const handleSend = async () => {
    setBusy('send');
    try {
      const { data } = await guestApi.send(event.id);
      toast.success(data.message);
      setSendOpen(false);
      onChanged?.();
      poll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi thiệp thất bại');
    } finally {
      setBusy(null);
    }
  };

  const withEmail = stats?.withEmail ?? 0;
  const sent = stats?.sent ?? 0;
  const failed = stats?.failed ?? 0;
  const toSend = Math.max(0, withEmail - sent);
  const noEmail = Math.max(0, (stats?.invited ?? 0) - withEmail);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card
        title="Mẫu thiệp"
        sub={template ? 'Ảnh nền của BTC — họ tên, sự kiện, thời gian, địa điểm và mã QR được điền tự động' : 'Đang dùng thiệp mặc định của hệ thống'}
      >
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleUpload} />
        {template === undefined ? (
          <div className="space-y-3"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-48 w-full rounded-xl" /></div>
        ) : !template ? (
          <div className="flex flex-col gap-4">
            <p className="text-pretty text-sm text-muted">
              Muốn thiệp theo thiết kế riêng? Thiết kế sẵn ảnh nền (ví dụ trên Canva, khổ A5 hoặc A6), chừa chỗ trống cho tên khách
              và mã QR, rồi upload — bạn kéo thả vị trí từng ô sau đó. Ảnh PNG/JPG tối đa 5 MB, mỗi chiều ≥ 500px.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button icon={FileDown} loading={busy === 'preview'} onClick={handlePreview}>Xem thử thiệp mặc định</Button>
              <Button icon={Upload} loading={busy === 'upload'} onClick={() => fileRef.current?.click()}>Upload ảnh nền</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem]">
            <button type="button" onClick={() => imageUrl && setEditorOpen(true)} className="block cursor-pointer text-left outline-none" title="Chỉnh bố cục">
              {imageUrl
                ? <CertificateCanvas imageUrl={imageUrl} template={template} values={sampleValues} draw={drawInvitation} qrText={SAMPLE_QR} />
                : <Skeleton className="aspect-[0.7] w-full rounded-xl" />}
            </button>
            <div className="flex flex-col gap-2">
              <Button icon={SlidersHorizontal} disabled={!imageUrl} onClick={() => setEditorOpen(true)} className="justify-start">Chỉnh bố cục</Button>
              <Button icon={Upload} loading={busy === 'upload'} onClick={() => fileRef.current?.click()} className="justify-start">Đổi ảnh nền</Button>
              <Button icon={FileDown} loading={busy === 'preview'} onClick={handlePreview} className="justify-start">Tải PDF xem thử</Button>
              <Button variant="danger" icon={Trash2} loading={busy === 'remove'} onClick={handleRemove} className="justify-start">Gỡ mẫu</Button>
              <p className="mt-2 text-pretty text-xs text-muted">Mã QR trong bản xem thử chỉ để căn vị trí, không quét được.</p>
            </div>
          </div>
        )}
      </Card>

      <Card title="Gửi thiệp" sub="Mỗi khách nhận email kèm thiệp PDF và link mở thiệp trên điện thoại">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm">
          {[
            ['Có email', withEmail],
            ['Đã gửi', sent],
            ['Gửi lỗi', failed],
            ['Không có email', noEmail],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${label === 'Gửi lỗi' && value > 0 ? 'text-error-text' : 'text-foreground'}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="primary" icon={Send} disabled={toSend === 0} onClick={() => setSendOpen(true)}>
            {toSend > 0 ? `Gửi thiệp cho ${toSend} khách chưa nhận` : 'Mọi khách có email đã nhận thiệp'}
          </Button>
          <Button icon={Printer} loading={busy === 'all'} disabled={!stats?.invited} onClick={handleDownloadAll}>Tải tất cả thiệp để in (PDF)</Button>
        </div>
        {noEmail > 0 && (
          <p className="mt-3 text-pretty text-xs text-muted">
            {noEmail} khách không có email: tải thiệp từng người ở tab Khách mời (hoặc sao chép link thiệp) để gửi qua Zalo, hoặc in thiệp.
          </p>
        )}
      </Card>

      {template && imageUrl && (
        <LayoutEditorModal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          title="Chỉnh bố cục thiệp mời"
          template={template}
          imageUrl={imageUrl}
          fieldLabels={INVITATION_FIELD_LABELS}
          defaultFields={INVITATION_DEFAULT_FIELDS}
          lockedKeys={['name', 'qr']}
          makeValues={makeValues}
          draw={drawInvitation}
          qrText={SAMPLE_QR}
          onSave={(fields) => guestApi.saveTemplateFields(event.id, fields)}
          onSaved={(data) => setTemplate(data.template)}
          onPreview={(name) => guestApi.previewPdf(event.id, name)}
          previewFilename={`xem-thu-thiep-moi-${event.name}.pdf`}
        />
      )}

      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Gửi thiệp mời"
        size="sm"
        description={<>Gửi email kèm thiệp cho <span className="font-medium text-foreground">{toSend}</span> khách có email chưa nhận thiệp (gồm cả những email gửi lỗi lần trước).</>}
        footer={(
          <>
            <Button variant="secondary" size="form" onClick={() => setSendOpen(false)}>Huỷ</Button>
            <Button variant="primary" size="form" loading={busy === 'send'} onClick={handleSend}>Gửi thiệp</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3 text-sm text-muted">
          {toSend > QUOTA_WARN && (
            <Banner tone="warning" compact>
              Danh sách lớn: gói email miễn phí chỉ gửi được khoảng 300 email/ngày cho toàn hệ thống. Thiệp gửi lỗi sẽ được đánh dấu —
              bấm gửi lại vào hôm sau.
            </Banner>
          )}
          <p className="text-pretty text-xs">Khách thêm sau này chưa có thiệp — bấm gửi lần nữa để gửi cho người mới.</p>
        </div>
      </Modal>
    </div>
  );
}
