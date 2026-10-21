import QRCode from 'qrcode';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { layoutField, fieldText, FONT_FILES } from './certRender';

// Vẽ thiệp mời lên <canvas> (editor bố cục, trang xem thiệp). Quy tắc là BẢN SAO của
// backend/src/lib/invitationLayout.js + services/invitationPdf.js — sửa một bên thì
// sửa cả bên kia, nếu không bản xem trên web lệch với file PDF tải về.
// Ô chữ dùng đúng quy tắc của chứng nhận (layoutField); ô "qr" là hình vuông có x, y
// là TÂM, size là cạnh theo tỉ lệ chiều rộng ảnh.

export const INVITATION_FIELD_LABELS = {
  name: 'Họ tên khách',
  event: 'Tên sự kiện',
  time: 'Thời gian',
  location: 'Địa điểm',
  seat: 'Vị trí ghế',
  tickets: 'Số vé',
  qr: 'Mã QR',
};

// Ô có thể bỏ nhãn: khoá giá trị trần + chữ nhãn hiện trong editor
// (cùng BARE_VALUES ở backend/src/lib/invitationLayout.js).
export const BARE_FIELDS = {
  seat: { value: 'seatCodes', word: 'Ghế' },
  tickets: { value: 'ticketNumber', word: 'vé' },
};

export function invitationFieldText(field, values) {
  const key = field.bare && BARE_FIELDS[field.key] ? BARE_FIELDS[field.key].value : field.key;
  return fieldText(field, values[key]);
}

export const INVITATION_DEFAULT_FIELDS = [
  { key: 'name', enabled: true, x: 0.5, y: 0.36, size: 0.07, maxWidth: 0.8, font: 'script', color: '#1F2A44', align: 'center' },
  { key: 'event', enabled: true, x: 0.5, y: 0.46, size: 0.04, maxWidth: 0.84, font: 'sans-bold', color: '#1F2A44', align: 'center' },
  { key: 'time', enabled: true, x: 0.5, y: 0.53, size: 0.026, maxWidth: 0.8, font: 'sans', color: '#4B5563', align: 'center' },
  { key: 'location', enabled: true, x: 0.5, y: 0.58, size: 0.026, maxWidth: 0.8, font: 'sans', color: '#4B5563', align: 'center' },
  { key: 'seat', enabled: true, x: 0.5, y: 0.63, size: 0.03, maxWidth: 0.8, font: 'sans-bold', color: '#C2410C', align: 'center' },
  { key: 'tickets', enabled: true, x: 0.5, y: 0.67, size: 0.026, maxWidth: 0.8, font: 'sans-bold', color: '#C2410C', align: 'center' },
  { key: 'qr', enabled: true, x: 0.5, y: 0.77, size: 0.3, background: true },
];

// "14:30 · Thứ Ba, 20/10/2026" — cùng dạng invitationTime ở backend.
export function invitationTime(iso) {
  const d = new Date(iso);
  const weekday = format(d, 'EEEE', { locale: vi });
  return `${format(d, 'HH:mm')} · ${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${format(d, 'dd/MM/yyyy')}`;
}

// Lề trắng quanh mã, tính theo số ô — giống QR_QUIET_MODULES ở backend.
const QR_QUIET_MODULES = 2;

export function layoutQr(field, W, H) {
  const side = field.size * W;
  return { left: field.x * W - side / 2, top: field.y * H - side / 2, side };
}

// Cùng thư viện, cùng mức sửa lỗi M với server → cùng một ma trận.
// background = false: bỏ nền trắng như drawQr ở services/invitationPdf.js.
export function drawQr(ctx, text, left, top, side, background = true) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const cell = side / (n + QR_QUIET_MODULES * 2);
  if (background) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(left, top, side, side);
  }
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!modules.get(r, c)) { c++; continue; }
      const start = c;
      while (c < n && modules.get(r, c)) c++;
      // +0.5px chồng mép để canvas khử răng cưa không để lộ vệt trắng giữa các hàng.
      ctx.fillRect(left + (QR_QUIET_MODULES + start) * cell, top + (QR_QUIET_MODULES + r) * cell, (c - start) * cell, cell + 0.5);
    }
  }
}

const family = (key) => `cert-${key}`;

// Vẽ toàn bộ thiệp; trả khung bao từng ô (tỉ lệ 0–1) cho editor kéo thả.
export function drawInvitation(ctx, img, fields, values, qrText) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const boxes = {};
  for (const field of fields) {
    if (field.key === 'qr') {
      const { left, top, side } = layoutQr(field, W, H);
      drawQr(ctx, qrText, left, top, side, field.background !== false);
      boxes.qr = { left: left / W, top: top / H, width: side / W, height: side / H };
      continue;
    }
    const text = invitationFieldText(field, values);
    if (!field.enabled || !text || !FONT_FILES[field.font]) continue;
    const measure = (t, size) => {
      ctx.font = `${size}px "${family(field.font)}"`;
      return ctx.measureText(t).width;
    };
    const { left, baseline, fontSize, width } = layoutField(field, text, W, H, measure);
    ctx.font = `${fontSize}px "${family(field.font)}"`;
    ctx.fillStyle = field.color;
    ctx.fillText(text, left, baseline);
    boxes[field.key] = {
      left: left / W,
      top: (baseline - fontSize * 0.95) / H,
      width: width / W,
      height: (fontSize * 1.25) / H,
    };
  }
  return boxes;
}
