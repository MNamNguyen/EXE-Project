// Mã ghế phía trình duyệt — cùng quy ước với backend/src/lib/seatMap.js: nhãn hàng
// 1–2 chữ cái + số ghế đệm 2 chữ số ("E08"). Server vẫn là nơi kiểm tra cuối.

export const seatCode = (row, n) => `${row}${String(n).padStart(2, '0')}`;

// A, B, …, Z, AA, AB, … — hàng đánh từ sân khấu ra.
export function rowLabel(i) {
  const A = 65;
  return i < 26 ? String.fromCharCode(A + i) : String.fromCharCode(A + Math.floor(i / 26) - 1) + String.fromCharCode(A + (i % 26));
}

export function compareSeats(a, b) {
  const [, ra = a, na = '0'] = a.match(/^([A-Z]+)(\d+)$/) || [];
  const [, rb = b, nb = '0'] = b.match(/^([A-Z]+)(\d+)$/) || [];
  if (ra !== rb) return ra.length - rb.length || ra.localeCompare(rb);
  return Number(na) - Number(nb);
}

export const sortSeats = (seats) => [...seats].sort(compareSeats);

// "Ghế E08, E09 · 2 vé" / "2 vé" / '' — cùng chuỗi seatLabel ở backend.
export function seatSummary({ seats = [], ticketCount = 1 } = {}) {
  const tickets = ticketCount > 1 ? `${ticketCount} vé` : '';
  if (!seats.length) return tickets;
  return [`Ghế ${seats.join(', ')}`, tickets].filter(Boolean).join(' · ');
}

// "4, 12" → [4, 12]
export const parseAisles = (text) => [...new Set(String(text).split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))]
  .sort((a, b) => a - b);
