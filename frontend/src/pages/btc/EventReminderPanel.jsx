import { useState, useEffect, useCallback, useRef } from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Field, Textarea } from '../../components/ui/Input';
import { Banner, Skeleton } from '../../components/ui/States';

const STATUS_BADGE = {
  SENDING: { label: 'Đang gửi', tone: 'warning', icon: LoaderCircle },
  SENT: { label: 'Đã gửi', tone: 'success' },
  FAILED: { label: 'Lỗi', tone: 'error' },
};

// Brevo gói free ~300 email/ngày cho CẢ hệ thống — cảnh báo trước khi gửi đông.
const QUOTA_WARN = 250;

// Khung "Nhắc lịch qua email" trong trang chi tiết sự kiện: BTC gửi nhắc thủ
// công tới người đã đăng ký và xem nhật ký. Chỉ ADMIN/người tạo — 403 thì ẩn
// (onUnavailable báo cho trang cha để ẩn luôn tab).
export default function EventReminderPanel({ event, onUnavailable }) {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(() => eventApi.getReminders(event.id)
    .then(({ data: res }) => { setData(res.data); return res.data; })
    .catch((err) => {
      if (err.response?.status === 403) { setHidden(true); onUnavailable?.(); }
      return null;
    }),
  [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearTimeout(pollRef.current), []);

  if (hidden) return null;

  // Server gửi nền — hỏi lại vài lần cho tới khi lượt gửi xong.
  const pollUntilDone = (attempt = 0) => {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      const fresh = await load();
      const pending = fresh?.history?.some((h) => h.status === 'SENDING');
      if (pending && attempt < 10) pollUntilDone(attempt + 1);
    }, 3000);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data: res } = await eventApi.sendReminder(event.id, note.trim());
      toast.success(res.message);
      setSendModal(false);
      setNote('');
      await load();
      pollUntilDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi nhắc lịch thất bại');
      if (err.response?.data?.error === 'REMINDER_COOLDOWN') load();
    } finally {
      setSending(false);
    }
  };

  const cooldown = data?.cooldownUntil ? new Date(data.cooldownUntil) : null;
  const recipientCount = data?.recipientCount ?? 0;

  return (
    <Card
      title="Nhắc lịch qua email"
      action={(
        <Button icon={Send} onClick={() => setSendModal(true)} disabled={!data || !!cooldown || recipientCount === 0}>
          Gửi nhắc ngay
        </Button>
      )}
    >
      <div className="flex flex-col gap-1">
        {data ? (
          <p className="text-sm text-foreground">
            <span className="font-medium tabular-nums">{recipientCount} người</span> đã đăng ký mà chưa check-in sẽ nhận email nhắc.
          </p>
        ) : (
          <Skeleton className="h-4 w-3/5" />
        )}
        <p className="text-xs text-muted">
          {cooldown ? `Có thể gửi lại sau ${format(cooldown, 'HH:mm')}` : 'Gửi xong phải chờ 30 phút mới gửi lại được.'}
        </p>
      </div>

      {data?.history?.length > 0 && (
        <>
        <h3 className="mb-2 mt-6 text-sm font-semibold text-foreground">Nhật ký gửi</h3>
        <ul className="divide-y divide-border">
          {data.history.map((h) => {
            const badge = STATUS_BADGE[h.status] || { label: h.status, tone: 'neutral' };
            const by = h.triggeredBy?.name || 'Không rõ người gửi';
            return (
              <li key={h.id} className="flex items-start gap-3 py-3">
                <Avatar name={by} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium text-foreground">{by}</p>
                    <p className="text-xs tabular-nums text-muted">{format(new Date(h.createdAt), 'HH:mm dd/MM')}</p>
                  </div>
                  {h.status !== 'SENDING' && (
                    <p className="mt-0.5 text-sm text-muted">
                      <span className="tabular-nums">{h.recipientCount - h.failedCount} / {h.recipientCount}</span> email gửi thành công
                    </p>
                  )}
                  {h.note && <p className="mt-1 whitespace-pre-line text-pretty text-sm text-foreground/80">“{h.note}”</p>}
                </div>
                <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>
              </li>
            );
          })}
        </ul>
        </>
      )}

      <Modal
        open={sendModal}
        onClose={() => setSendModal(false)}
        title="Gửi nhắc lịch ngay"
        description={<>Email nhắc lịch sẽ gửi tới <span className="font-medium text-foreground">{recipientCount}</span> người đã đăng ký nhưng chưa check-in.</>}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" size="form" onClick={() => setSendModal(false)}>Huỷ</Button>
            <Button variant="primary" size="form" loading={sending} onClick={handleSend}>Gửi</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          {recipientCount > QUOTA_WARN && (
            <Banner tone="warning" compact>
              Danh sách lớn: gói email miễn phí chỉ gửi được khoảng 300 email/ngày cho toàn hệ thống,
              một số người có thể không nhận được.
            </Banner>
          )}
          <Field label="Lời nhắn thêm" optional hint="Sau khi gửi, phải chờ 30 phút mới gửi lại được.">
            {(id) => (
              <div>
                <Textarea
                  id={id}
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                  placeholder="VD: Nhớ mang theo thẻ sinh viên và đến trước 15 phút."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="mt-1 text-right text-xs tabular-nums text-muted">{note.length}/500</p>
              </div>
            )}
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
