import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Giai đoạn của một sự kiện để hiện nhãn trạng thái. Cổng đang mở (event.gate, máy chủ tính
// sẵn) luôn thắng; còn lại suy từ lịch:
//   live     — cổng check-in/check-out đang mở, hoặc đang nằm trong khung giờ đã đặt
//   manual   — không đặt lịch, BTC tự mở và đóng cổng
//   upcoming — chưa tới giờ mở check-in
//   ended    — đã qua mốc đóng cuối cùng
export function eventPhase(event, now = new Date()) {
  if (isGateOpen(event)) return 'live';
  const open = event?.checkinOpen ? new Date(event.checkinOpen) : null;
  if (!open) return 'manual';
  if (now < open) return 'upcoming';
  const closes = [event.checkinClose, event.checkoutClose].filter(Boolean).map((d) => new Date(d).getTime());
  if (closes.length && now.getTime() < Math.max(...closes)) return 'live';
  return 'ended';
}

export const isGateOpen = (event) => Boolean(event?.gate?.checkin?.open || event?.gate?.checkout?.open);

// "08:00 – 10:00" từ mốc mở và đóng check-in; không đặt lịch thì rỗng
export function timeRange(event) {
  if (!event?.checkinOpen) return '';
  const start = format(new Date(event.checkinOpen), 'HH:mm');
  const end = event.checkoutClose || event.checkinClose;
  return end ? `${start} – ${format(new Date(end), 'HH:mm')}` : start;
}

// Ngày ngắn "02/10" và dài "Thứ Sáu 02/10/2026"
export const shortDate = (iso) => (iso ? format(new Date(iso), 'dd/MM') : '');
export const fullDate = (iso) => (iso ? format(new Date(iso), 'dd/MM/yyyy') : '');
export function longDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const weekday = format(d, 'EEEE', { locale: vi });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${format(d, 'dd/MM/yyyy')}`;
}

// Câu nói cổng nào đang mở và tới khi nào: "Cổng check-in đóng lúc 08:30" / "…mở thủ công"
export function gateNote(event) {
  const gate = event?.gate;
  const describe = (g, label, closeAt) => {
    if (!g?.open) return '';
    if (g.reason === 'MANUALLY_OPEN') return `Cổng ${label} mở thủ công`;
    return closeAt ? `Cổng ${label} đóng lúc ${format(new Date(closeAt), 'HH:mm')}` : `Cổng ${label} đang mở`;
  };
  return describe(gate?.checkin, 'check-in', event?.checkinClose)
    || describe(gate?.checkout, 'check-out', event?.checkoutClose);
}

export const formatNumber = (n) => (typeof n === 'number' ? n.toLocaleString('vi-VN') : n ?? '');
