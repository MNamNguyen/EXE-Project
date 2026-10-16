import { format } from 'date-fns';
import { Lock } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import { cx } from '../../utils/cx';

// Một hàng điều khiển cổng: trạng thái hiện tại (máy chủ tính sẵn, xem attendanceGate.js) và ba
// nấc Theo lịch / Mở / Đóng. Mở, Đóng ghi đè hoàn toàn khung giờ đã đặt.
export default function GateRow({ label, gate, state, openAt, closeAt, loading, onChange }) {
  const isOpen = Boolean(gate?.open);
  const hhmm = (d) => format(new Date(d), 'HH:mm');
  const sameDay = openAt && closeAt && new Date(openAt).toDateString() === new Date(closeAt).toDateString();
  const isToday = openAt && new Date(openAt).toDateString() === new Date().toDateString();
  const windowText = openAt && closeAt
    ? `${isToday ? '' : `${format(new Date(openAt), 'dd/MM')} `}${hhmm(openAt)} – ${sameDay ? '' : `${format(new Date(closeAt), 'dd/MM')} `}${hhmm(closeAt)}`
    : null;
  const detail = {
    SCHEDULED: closeAt && `tự đóng lúc ${hhmm(closeAt)}`,
    NOT_STARTED: openAt && `tự mở lúc ${hhmm(openAt)}`,
    ENDED: 'đã hết giờ',
    MANUALLY_OPEN: 'đang mở thủ công',
    MANUALLY_CLOSED: 'đang đóng thủ công',
  }[gate?.reason];
  const line = windowText ? [windowText, detail].filter(Boolean).join(' · ') : 'Không đặt lịch, BTC tự mở và đóng';

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {isOpen ? <Badge tone="success">Đang mở</Badge> : <Badge icon={Lock}>Đang đóng</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">{line}</p>
      </div>
      <div aria-busy={loading || undefined} className={cx(loading && 'pointer-events-none opacity-60')}>
        <Tabs
          variant="segmented"
          layout="fullMobile"
          ariaLabel={`Chế độ cổng ${label}`}
          value={state || 'AUTO'}
          onChange={(v) => { if (v !== (state || 'AUTO')) onChange(v); }}
          items={[
            { value: 'AUTO', label: 'Theo lịch', grow: true },
            { value: 'OPEN', label: 'Mở', grow: true },
            { value: 'CLOSED', label: 'Đóng', grow: true },
          ]}
        />
      </div>
    </div>
  );
}
