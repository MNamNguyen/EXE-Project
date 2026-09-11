const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const qrService = require('../src/services/qr.service');

const PERIOD_MS = 30_000;
const realNow = Date.now;

// Cố định đồng hồ để test cửa sổ hiệu lực: token dùng slot = floor(now / 30s)
// nên kết quả phụ thuộc vào vị trí thời điểm sinh mã bên trong slot.
function freezeAt(ms) {
  Date.now = () => ms;
}

function slotStart(ms) {
  return Math.floor(ms / PERIOD_MS) * PERIOD_MS;
}

afterEach(() => { Date.now = realNow; });

test('a QR minted at the very end of a slot still works 90s later', async () => {
  // Trường hợp xấu nhất: mã sinh ra ngay sát lúc đổi slot → hiệu lực ngắn nhất.
  const mintedAt = slotStart(realNow()) + PERIOD_MS - 1;
  freezeAt(mintedAt);
  const token = qrService.generateToken('evt-1', 'checkin');

  freezeAt(mintedAt + 90_000);
  assert.strictEqual(qrService.validateToken(token, 'evt-1', 'checkin'), true);
});

test('a QR is refused once it is more than 120s old', async () => {
  const mintedAt = slotStart(realNow());
  freezeAt(mintedAt);
  const token = qrService.generateToken('evt-1', 'checkin');

  // Sinh đúng đầu slot → tối đa 120s, qua mốc đó là hết hiệu lực.
  freezeAt(mintedAt + 119_000);
  assert.strictEqual(qrService.validateToken(token, 'evt-1', 'checkin'), true);

  freezeAt(mintedAt + 120_000);
  assert.strictEqual(qrService.validateToken(token, 'evt-1', 'checkin'), false);
});

test('an old QR stays valid alongside the newer one the screen has rotated to', async () => {
  const mintedAt = slotStart(realNow());
  freezeAt(mintedAt);
  const oldToken = qrService.generateToken('evt-1', 'checkin');

  // Màn hình đã xoay sang mã mới sau 30s — mã cũ vẫn phải dùng được.
  freezeAt(mintedAt + PERIOD_MS);
  const newToken = qrService.generateToken('evt-1', 'checkin');
  assert.notStrictEqual(oldToken, newToken);
  assert.strictEqual(qrService.validateToken(oldToken, 'evt-1', 'checkin'), true);
  assert.strictEqual(qrService.validateToken(newToken, 'evt-1', 'checkin'), true);
});

test('a token from the future is refused', async () => {
  const mintedAt = slotStart(realNow()) + 10 * PERIOD_MS;
  freezeAt(mintedAt);
  const token = qrService.generateToken('evt-1', 'checkin');

  freezeAt(slotStart(realNow()));
  assert.strictEqual(qrService.validateToken(token, 'evt-1', 'checkin'), false);
});

test('a checkin token never passes as a checkout token, nor across events', async () => {
  const token = qrService.generateToken('evt-1', 'checkin');
  assert.strictEqual(qrService.validateToken(token, 'evt-1', 'checkout'), false);
  assert.strictEqual(qrService.validateToken(token, 'evt-2', 'checkin'), false);
});
