import { useEffect, useState } from 'react';
import { Copy, Link2, Link2Off, RotateCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { guestApi } from '../../../services/api';
import Modal, { useConfirm } from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/States';

// Link quét cho tình nguyện viên không có tài khoản: ai có link đều quét thiệp, tìm
// khách (SĐT/email bị che) và thêm khách tại chỗ được. BTC đổi link mới hoặc thu hồi
// bất cứ lúc nào — link cũ chết ngay. Kèm mã QR để tình nguyện viên quét mở link.
export default function ScannerLinkModal({ open, eventId, onClose }) {
  const confirm = useConfirm();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState(null);
    guestApi.getScannerLink(eventId).then(({ data }) => setState(data.data)).catch(() => setState({ shared: false }));
  }, [open, eventId]);

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Đã copy link');
    } catch {
      // Clipboard bị chặn — link vẫn nằm trong ô bên dưới để copy tay.
    }
  };

  const run = async (call, message) => {
    setBusy(true);
    try {
      const { data } = await call();
      setState(data.data);
      if (message) toast.success(message);
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    if (!(await confirm({
      title: 'Đổi sang link mới?',
      body: 'Link cũ sẽ không dùng được nữa — tình nguyện viên đang dùng link cũ cần mở link mới.',
      confirmLabel: 'Đổi link',
      tone: 'neutral',
      icon: RotateCw,
    }))) return;
    run(() => guestApi.createScannerLink(eventId, { rotate: true }), 'Đã cấp link mới');
  };

  const revoke = async () => {
    if (!(await confirm({
      title: 'Thu hồi link quét?',
      body: 'Không ai dùng link này quét thiệp được nữa. BTC đăng nhập vẫn quét bình thường.',
      confirmLabel: 'Thu hồi link',
      icon: Link2Off,
    }))) return;
    run(() => guestApi.revokeScannerLink(eventId), 'Đã thu hồi link quét');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link quét cho tình nguyện viên"
      description="Người không có tài khoản mở link này trên điện thoại để quét thiệp ở cửa."
      footer={<Button variant="secondary" size="form" onClick={onClose}>Đóng</Button>}
    >
      {!state ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="mx-auto size-40 rounded-xl" /></div>
      ) : state.shared ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={state.url} aria-label="Link quét" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 font-mono md:text-xs" />
            <Button icon={Copy} onClick={() => copy(state.url)}>Sao chép</Button>
          </div>
          <div className="mx-auto w-fit rounded-2xl bg-white p-3">
            <QRCodeSVG value={state.url} size={176} level="M" marginSize={1} title="Mã QR mở link quét" />
          </div>
          <p className="text-pretty text-center text-xs text-muted">Tình nguyện viên quét mã này bằng camera điện thoại để mở trang quét.</p>
          <ul className="list-inside list-disc space-y-1 text-pretty text-sm text-muted">
            <li>Quét thiệp, tìm khách theo tên/SĐT và thêm khách tại chỗ.</li>
            <li>SĐT, email của khách luôn bị che một phần.</li>
            <li>Không sửa, xoá khách, không gửi thiệp, không huỷ check-in.</li>
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button icon={RotateCw} disabled={busy} onClick={rotate}>Đổi link mới</Button>
            <Button variant="danger" icon={Link2Off} disabled={busy} onClick={revoke}>Thu hồi</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4">
          <p className="text-pretty text-sm text-muted">
            Chưa có link quét. Tạo link rồi gửi cho tình nguyện viên (Zalo, Messenger…). Ai có link đều quét được, nên chỉ gửi cho người
            đứng cửa và thu hồi khi sự kiện kết thúc.
          </p>
          <Button
            variant="primary"
            icon={Link2}
            loading={busy}
            onClick={async () => {
              const s = await run(() => guestApi.createScannerLink(eventId), 'Đã tạo link quét');
              if (s?.url) copy(s.url);
            }}
          >
            Tạo link quét
          </Button>
        </div>
      )}
    </Modal>
  );
}
