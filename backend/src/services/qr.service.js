const crypto = require('crypto');

const QR_PERIOD = 30; // seconds per token slot
const QR_WINDOW = 2;  // accept N slots before current (handles network lag ~60s)

function getTimeSlot() {
  return Math.floor(Date.now() / 1000 / QR_PERIOD);
}

function buildToken(eventId, type, slot, secret) {
  const message = `${eventId}:${type}:${slot}`;
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
    .substring(0, 24);
}

function generateToken(eventId, type) {
  const secret = process.env.QR_SECRET;
  const slot = getTimeSlot();
  return buildToken(eventId, type, slot, secret);
}

function validateToken(token, eventId, type) {
  const secret = process.env.QR_SECRET;
  const currentSlot = getTimeSlot();

  for (let i = 0; i <= QR_WINDOW; i++) {
    const expected = buildToken(eventId, type, currentSlot - i, secret);
    if (expected === token) return true;
  }
  return false;
}

function getExpiresIn() {
  const slot = getTimeSlot();
  const nextSlotAt = (slot + 1) * QR_PERIOD;
  return nextSlotAt - Math.floor(Date.now() / 1000);
}

module.exports = { generateToken, validateToken, getExpiresIn };
