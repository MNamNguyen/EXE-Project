// Web Worker chạy mô hình nhận diện khuôn mặt. Mỗi khung mất 180–330 ms trên webgl; chạy
// trên luồng chính thì trang kiosk/chụp mặt gần như bị chặn liên tục (bấm nút, gõ MSSV,
// cuộn đều giật) — đó là lý do tính năng từng bị gỡ (commit f06e1d7). Trong worker, luồng
// chính chỉ còn cắt ImageBitmap từ video (~1–2 ms).
//
// Giao thức: { id, type: 'load' } → { id }; { id, type: 'detect', bitmap } → { id, faces }
// (đã slimFace); lỗi → { id, error }.

import { Human } from '@vladmandic/human';
import { HUMAN_CONFIG, slimFace } from './faceConfig';

let humanPromise = null;

function loadHuman() {
  if (!humanPromise) {
    humanPromise = (async () => {
      const human = new Human(HUMAN_CONFIG);
      await human.load();
      await human.warmup();
      return human;
    })().catch((err) => {
      humanPromise = null; // lỗi mạng lúc tải mô hình → lần sau thử lại
      throw err;
    });
  }
  return humanPromise;
}

self.onmessage = async ({ data }) => {
  const { id, type, bitmap } = data;
  try {
    const human = await loadHuman();
    if (type === 'load') {
      self.postMessage({ id });
      return;
    }
    const result = await human.detect(bitmap);
    self.postMessage({ id, faces: (result.face || []).map(slimFace) });
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  } finally {
    bitmap?.close?.();
  }
};
