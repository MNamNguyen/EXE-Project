// Parse một giá trị ngày giờ TUỲ CHỌN từ request body.
// undefined/null/'' → null (không đặt lịch — hợp lệ, xem GateState.AUTO).
// Chuỗi không parse được → lỗi, để phân biệt với "cố tình để trống".
function parseOptionalDate(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: true };
  return { value: d };
}

// Parse cả bốn mốc giờ điểm danh (checkinOpen/Close, checkoutOpen/Close) cùng lúc.
// Trả về { error: 'Thời gian không hợp lệ' } nếu bất kỳ mốc nào không parse được,
// hoặc { value: { checkinOpen, checkinClose, checkoutOpen, checkoutClose } }.
function parseEventDates(body) {
  const result = {};
  for (const key of ['checkinOpen', 'checkinClose', 'checkoutOpen', 'checkoutClose']) {
    const parsed = parseOptionalDate(body[key]);
    if (parsed.error) return { error: 'Thời gian không hợp lệ' };
    result[key] = parsed.value;
  }
  return { value: result };
}

const GATE_STATES = ['AUTO', 'OPEN', 'CLOSED'];
function parseGateState(value) {
  return GATE_STATES.includes(value) ? value : 'AUTO';
}

module.exports = { parseOptionalDate, parseEventDates, parseGateState, GATE_STATES };
