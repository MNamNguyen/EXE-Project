// Phần thuần (không DOM, không mô hình) của nhận diện khuôn mặt: so vector, xếp hạng,
// quyết định tự check-in hay hỏi BTC. Có test riêng (faceMatch.test.js).
//
// similarity và DUPLICATE_THRESHOLD PHẢI trùng với backend/src/lib/faceProfile.js —
// server dùng cùng công thức để chặn hai tài khoản đăng ký cùng một khuôn mặt.

export const EMBEDDING_DIM = 1024;

// Cùng công thức human.match.similarity (order 2, multiplier 20): 0..1, trên ~0.5 là
// cùng một người. Không làm tròn để khớp tuyệt đối với server.
export function similarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  if (sum === 0) return 1;
  return Math.max(0, Math.min(1, 1 - Math.sqrt(20 * sum) / 100));
}

export const DUPLICATE_THRESHOLD = 0.6;

// Ngưỡng kiosk. Tự check-in phải chắc: đủ giống, bỏ xa người giống thứ hai, và cùng một
// người trong vài khung hình liên tiếp (một khung nhoè không được quyết định thay).
// Hiệu chỉnh với vài người thật trước sự kiện lớn — xem spec face-checkin. 0.7 vì khi thử
// trên DB thật, hai người KHÁC nhau trong cùng một ảnh (cùng ánh sáng, như ở kiosk) đã đạt
// 0.596: ngưỡng thấp hơn thì kiosk có thể tự check-in nhầm người; thà để BTC xác nhận.
export const AUTO_THRESHOLD = 0.7;
export const CONFIRM_THRESHOLD = 0.5;
export const MARGIN = 0.06;
export const STREAK_FRAMES = 3;

// Hai người giống nhất trong danh sách. gallery: [{ userId, vector, ... }].
export function rankMatches(embedding, gallery) {
  let best = null;
  let second = null;
  for (const person of gallery) {
    const score = similarity(embedding, person.vector);
    if (!best || score > best.score) {
      second = best;
      best = { person, score };
    } else if (!second || score > second.score) {
      second = { person, score };
    }
  }
  return { best, second };
}

// AUTO    — tự check-in
// WAIT    — đủ chắc nhưng chưa đủ số khung liên tiếp, chờ khung sau
// CONFIRM — hiện ứng viên cho BTC bấm (giống vừa phải, hoặc hai người sát nhau)
// UNKNOWN — không đủ giống ai
// streak = số khung liên tiếp mà best là cùng một người (tính cả khung này).
export function decide({ best, second }, streak) {
  if (!best || best.score < CONFIRM_THRESHOLD) return 'UNKNOWN';
  const clearWinner = !second || best.score - second.score >= MARGIN;
  if (best.score >= AUTO_THRESHOLD && clearWinner) {
    return streak >= STREAK_FRAMES ? 'AUTO' : 'WAIT';
  }
  return 'CONFIRM';
}

// Trung bình vài khung hình lúc đăng ký → vector ổn định hơn một tấm chụp đơn lẻ.
export function averageEmbeddings(list) {
  if (!list.length) return null;
  const out = new Array(list[0].length).fill(0);
  for (const e of list) for (let i = 0; i < out.length; i++) out[i] += e[i];
  return out.map((v) => v / list.length);
}

// Vector ↔ base64 của Float32 little-endian — định dạng server lưu thẳng vào BYTEA.
export function encodeEmbedding(vector) {
  const f32 = Float32Array.from(vector);
  const view = new DataView(f32.buffer);
  for (let i = 0; i < f32.length; i++) view.setFloat32(i * 4, f32[i], true);
  return bytesToBase64(new Uint8Array(f32.buffer));
}

export function decodeEmbedding(b64) {
  const bytes = base64ToBytes(b64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Array(bytes.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
