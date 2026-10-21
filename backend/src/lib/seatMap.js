// Sơ đồ ghế của sự kiện thiệp mời và mã ghế — mọi đọc/ghi ghế đi qua đây để bảng
// khách, import Excel, sơ đồ và thiệp cùng hiểu một kiểu mã.
//
// Mã ghế = nhãn hàng (1–2 chữ cái in hoa) + số ghế đệm 2 chữ số: "E08". BTC gõ
// "e8", "E 08", "e-8" đều ra "E08" — file Excel thật ghi ghế kiểu "E08, E09".
//
// seatMap lưu ở Event.seatMap:
//   { rows: [{ label: 'A', seats: 16 }], aisleAfter: [4, 12], disabled: ['A01'] }
// aisleAfter = lối đi nằm sau ghế số mấy (chỉ để vẽ); disabled = ghế không bán (cột,
// chỗ đặt máy quay...). Hàng xếp theo thứ tự từ sân khấu ra.

const MAX_ROWS = 52;
const MAX_SEATS_PER_ROW = 99;
const MAX_TOTAL_SEATS = 3000;
const MAX_TICKETS = 50;

const ROW_RE = /^[A-Z]{1,2}$/;
const SEAT_RE = /^([A-Z]{1,2})[\s-]*0*(\d{1,2})$/;

const seatCode = (row, n) => `${row}${String(n).padStart(2, '0')}`;

// "e 8" → "E08"; không phải mã ghế → null.
function normalizeSeat(raw) {
  const m = String(raw ?? '').trim().toUpperCase().match(SEAT_RE);
  if (!m || Number(m[2]) < 1) return null;
  return seatCode(m[1], Number(m[2]));
}

// Sắp theo hàng rồi theo số ghế — "E08, E09, F01" chứ không phải thứ tự gõ.
function compareSeats(a, b) {
  const [, ra, na] = a.match(/^([A-Z]+)(\d+)$/) || [null, a, '0'];
  const [, rb, nb] = b.match(/^([A-Z]+)(\d+)$/) || [null, b, '0'];
  if (ra !== rb) return ra.length - rb.length || ra.localeCompare(rb);
  return Number(na) - Number(nb);
}

const sortSeats = (seats) => [...seats].sort(compareSeats);

// "E08, E09; F06-F10" → ['E08', 'E09', 'F06', ..., 'F10']. Ngăn cách bằng dấu phẩy,
// chấm phẩy hoặc xuống dòng; dải ghế chỉ trong cùng một hàng. Nhận cả mảng.
function parseSeatList(input) {
  if (input == null || input === '') return { value: [] };
  const parts = Array.isArray(input)
    ? input.map((s) => String(s ?? ''))
    : String(input).split(/[,;\n]+/);

  const out = new Set();
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    const range = part.split(/\s*(?:–|—|-|đến)\s*(?=[A-Za-z])/);
    if (range.length === 2) {
      const from = normalizeSeat(range[0]);
      const to = normalizeSeat(range[1]);
      if (!from || !to) return { error: `Ghế "${part}" không hợp lệ` };
      const [, rowA, nA] = from.match(/^([A-Z]+)(\d+)$/);
      const [, rowB, nB] = to.match(/^([A-Z]+)(\d+)$/);
      if (rowA !== rowB) return { error: `Dải ghế "${part}" phải cùng một hàng` };
      const lo = Math.min(Number(nA), Number(nB));
      const hi = Math.max(Number(nA), Number(nB));
      if (hi - lo >= MAX_TICKETS) return { error: `Dải ghế "${part}" quá dài` };
      for (let n = lo; n <= hi; n++) out.add(seatCode(rowA, n));
      continue;
    }
    const seat = normalizeSeat(part);
    if (!seat) return { error: `Ghế "${part}" không hợp lệ — ghi theo dạng E08, E09 hoặc F06-F10` };
    out.add(seat);
  }
  if (out.size > MAX_TICKETS) return { error: `Mỗi khách tối đa ${MAX_TICKETS} ghế` };
  return { value: sortSeats(out) };
}

// Chuẩn hoá sơ đồ từ editor. Lỗi trả { error } để BTC sửa — không âm thầm cắt bớt
// hàng vì như thế ghế đã bán có thể biến mất.
function normalizeSeatMap(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.rows)) {
    return { error: 'Sơ đồ ghế không hợp lệ' };
  }
  if (!input.rows.length) return { error: 'Sơ đồ cần ít nhất một hàng ghế' };
  if (input.rows.length > MAX_ROWS) return { error: `Tối đa ${MAX_ROWS} hàng ghế` };

  const labels = new Set();
  const rows = [];
  for (const r of input.rows) {
    const label = String(r?.label ?? '').trim().toUpperCase();
    const seats = Number(r?.seats);
    if (!ROW_RE.test(label)) return { error: `Tên hàng "${r?.label ?? ''}" không hợp lệ — dùng 1–2 chữ cái (A, B, …, AA)` };
    if (labels.has(label)) return { error: `Hàng ${label} bị trùng` };
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS_PER_ROW) {
      return { error: `Hàng ${label}: số ghế phải từ 1 tới ${MAX_SEATS_PER_ROW}` };
    }
    labels.add(label);
    rows.push({ label, seats });
  }
  const total = rows.reduce((n, r) => n + r.seats, 0);
  if (total > MAX_TOTAL_SEATS) return { error: `Sơ đồ tối đa ${MAX_TOTAL_SEATS} ghế` };

  const widest = Math.max(...rows.map((r) => r.seats));
  const aisleAfter = [...new Set((Array.isArray(input.aisleAfter) ? input.aisleAfter : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n < widest))].sort((a, b) => a - b);

  const all = allSeats({ rows });
  const disabled = sortSeats(new Set((Array.isArray(input.disabled) ? input.disabled : [])
    .map(normalizeSeat)
    .filter((s) => s && all.has(s))));

  return { value: { rows, aisleAfter, disabled } };
}

function allSeats(map) {
  const set = new Set();
  for (const r of map?.rows || []) {
    for (let n = 1; n <= r.seats; n++) set.add(seatCode(r.label, n));
  }
  return set;
}

// Ghế gán được = có trong sơ đồ và không bị bỏ.
function usableSeats(map) {
  const set = allSeats(map);
  for (const s of map?.disabled || []) set.delete(s);
  return set;
}

// Ghế không gán được trên sơ đồ này (không có hoặc bị bỏ).
function invalidSeats(map, seats) {
  const usable = usableSeats(map);
  return seats.filter((s) => !usable.has(s));
}

// Số vé: số nguyên 1–50. Bỏ trống = theo số ghế (ít nhất 1).
function parseTicketCount(raw, seatCount = 0) {
  if (raw == null || String(raw).trim() === '') return { value: Math.max(1, seatCount) };
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_TICKETS) return { error: `Số vé phải từ 1 tới ${MAX_TICKETS}` };
  return { value: n };
}

// Danh sách mã ghế của một khách đã include seats.
const guestSeats = (guest) => sortSeats((guest?.seats || []).map((s) => (typeof s === 'string' ? s : s.seat)));

// Hai ô riêng trên thiệp: "Ghế E08, E09" (rỗng khi chưa xếp ghế) và "2 vé" (rỗng khi
// 1 vé — thiệp 1 người như cũ).
function seatText(guest) {
  const seats = guestSeats(guest);
  return seats.length ? `Ghế ${seats.join(', ')}` : '';
}

function ticketText(guest) {
  const count = guest?.ticketCount || 1;
  return count > 1 ? `${count} vé` : '';
}

// Chuỗi gộp cho email / báo cáo / thiệp mặc định: "Ghế E08, E09 · 2 vé", "2 vé", hoặc ''.
function seatLabel(guest) {
  return [seatText(guest), ticketText(guest)].filter(Boolean).join(' · ');
}

module.exports = {
  MAX_TICKETS,
  seatCode,
  normalizeSeat,
  sortSeats,
  parseSeatList,
  normalizeSeatMap,
  allSeats,
  usableSeats,
  invalidSeats,
  parseTicketCount,
  guestSeats,
  seatText,
  ticketText,
  seatLabel,
};
