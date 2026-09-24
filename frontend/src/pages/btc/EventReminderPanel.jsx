import { useState, useEffect, useCallback, useRef } from 'react';
import { BellRing, Send, RefreshCw, Users } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const STATUS_BADGE = {
  SENDING: { label: 'Đang gửi', variant: 'yellow' },
  SENT: { label: 'Đã gửi', variant: 'green' },
  FAILED: { label: 'Lỗi', variant: 'red' },
};

// Brevo gói free ~300 email/ngày cho CẢ hệ thống — cảnh báo trước khi gửi đông.
const QUOTA_WARN = 250;

// Khung "Nhắc lịch qua email" trong trang chi tiết sự kiện: BTC gửi nhắc thủ
// công tới người đã đăng ký và xem nhật ký. Chỉ ADMIN/người tạo — 403 thì ẩn.
export default function EventReminderPanel({ event }) {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(() => eventApi.getReminders(event.id)
    .then(({ data: res }) => { setData(res.data); return res.data; })
    .catch((err) => { if (err.response?.status === 403) setHidden(true); return null; }),
  [event.id]);

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
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
          <BellRing size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Nhắc lịch qua email</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Users size={11} /> {data ? `${recipientCount} người đã đăng ký chưa check-in` : 'Đang tải...'}
          </p>
        </div>
        <button
          onClick={() => setSendModal(true)}
          disabled={!data || !!cooldown || recipientCount === 0}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send size={14} /> Gửi nhắc ngay
        </button>
      </div>
      {cooldown && (
        <p className="text-[11px] text-gray-400 text-right -mt-1">Có thể gửi lại sau {format(cooldown, 'HH:mm')}</p>
      )}

      {data?.history?.length > 0 && (
        <details className="border-t border-border pt-3">
          <summary className="text-xs font-semibold text-gray-500 cursor-pointer select-none flex items-center gap-2">
            Nhật ký gửi ({data.history.length})
            <button type="button" onClick={(e) => { e.preventDefault(); load(); }}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Làm mới">
              <RefreshCw size={12} />
            </button>
          </summary>
          <div className="mt-2 space-y-2">
            {data.history.map((h) => {
              const badge = STATUS_BADGE[h.status] || { label: h.status, variant: 'gray' };
              return (
                <div key={h.id} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-700">{h.triggeredBy?.name || 'Không rõ người gửi'}</span>
                    <span className="text-gray-400">{format(new Date(h.createdAt), 'HH:mm dd/MM')}</span>
                    <span className="flex-1" />
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  {h.status !== 'SENDING' && (
                    <p className="text-gray-500 mt-0.5">
                      {h.recipientCount - h.failedCount}/{h.recipientCount} email gửi thành công
                    </p>
                  )}
                  {h.note && <p className="text-gray-500 mt-0.5 whitespace-pre-line">“{h.note}”</p>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      <Modal open={sendModal} onClose={() => setSendModal(false)} title="Gửi nhắc lịch ngay" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Email nhắc lịch sẽ gửi tới <b>{recipientCount}</b> người đã đăng ký nhưng chưa check-in.
          </p>
          {recipientCount > QUOTA_WARN && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Danh sách lớn: gói email miễn phí chỉ gửi được khoảng 300 email/ngày cho toàn hệ thống,
              một số người có thể không nhận được.
            </p>
          )}
          <div>
            <label className="label">Lời nhắn thêm (không bắt buộc)</label>
            <textarea className="input resize-none text-sm" rows={3} maxLength={500}
              placeholder="VD: Nhớ mang theo thẻ sinh viên và đến trước 15 phút."
              value={note} onChange={(e) => setNote(e.target.value)} />
            <p className="text-[11px] text-gray-400 text-right mt-1">{note.length}/500</p>
          </div>
          <p className="text-xs text-gray-400">Sau khi gửi, phải chờ 30 phút mới gửi lại được.</p>
          <div className="flex gap-3">
            <button onClick={() => setSendModal(false)} className="btn-secondary btn-md flex-1">Huỷ</button>
            <button onClick={handleSend} disabled={sending} className="btn-primary btn-md flex-1">
              {sending ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={15} />}
              Gửi
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
