// Bọc @vladmandic/human: nạp mô hình MỘT lần, đọc khuôn mặt từ video/ảnh, kiểm tra chất
// lượng và cắt thumbnail. Mọi embedding của hệ thống (sinh viên tự chụp, admin import,
// kiosk) đều đi qua đây để cùng cấu hình — vector của hai cấu hình khác nhau không so
// được với nhau. Đổi cấu hình/phiên bản ảnh hưởng vector thì đổi FACE_MODEL ở
// backend/src/lib/faceProfile.js để mọi người đăng ký lại.
//
// Mô hình phục vụ tại /models/human/ (xem vite.config.js), không qua CDN.

import { EMBEDDING_DIM } from './faceMatch';

const CONFIG = {
  modelBasePath: '/models/human/',
  backend: 'webgl',
  debug: false,
  warmup: 'face',
  // 0 = tắt cache: kiosk cần vector và điểm liveness của đúng khung hình đang xét, không
  // phải kết quả của người đứng trước đó vài giây.
  cacheSensitivity: 0,
  filter: { enabled: true, flip: false },
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 3, minConfidence: 0.5, return: false },
    mesh: { enabled: true },
    attention: { enabled: false },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    gear: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
};

// Khuôn mặt nhỏ hơn thế này (px) thì vector kém tin cậy — người đứng quá xa camera.
const MIN_FACE_PX = 90;
// Nghiêng/quay đầu quá ~30° thì vector lệch nhiều so với ảnh chính diện đã đăng ký.
const MAX_ANGLE_RAD = 0.5;
// Ngưỡng antispoof/liveness của Human (0..1). Chỉ áp cho camera trực tiếp: ảnh thẻ
// admin import là ảnh chụp lại nên luôn "không sống".
const MIN_REAL = 0.5;
const MIN_LIVE = 0.5;

const THUMB_SIZE = 128;

let enginePromise = null;

export function loadFaceEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { Human } = await import('@vladmandic/human');
      const human = new Human(CONFIG);
      await human.load();
      await human.warmup();
      return human;
    })().catch((err) => {
      enginePromise = null; // lỗi mạng lúc tải mô hình → lần sau thử lại
      throw err;
    });
  }
  return enginePromise;
}

// Mọi khuôn mặt trong input, lớn nhất (gần camera nhất) trước.
export async function detectFaces(input) {
  const human = await loadFaceEngine();
  const result = await human.detect(input);
  return [...(result.face || [])].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
}

// null = dùng được; chuỗi = lý do (hiển thị nguyên văn cho người dùng).
export function faceProblem(face, { live = true } = {}) {
  if (!face) return 'Không thấy khuôn mặt';
  if (!face.embedding || face.embedding.length !== EMBEDDING_DIM) return 'Không đọc được khuôn mặt, thử lại';
  if (Math.min(face.box[2], face.box[3]) < MIN_FACE_PX) return 'Lại gần camera hơn';
  const angle = face.rotation?.angle;
  if (angle && (Math.abs(angle.yaw) > MAX_ANGLE_RAD || Math.abs(angle.pitch) > MAX_ANGLE_RAD)) {
    return 'Nhìn thẳng vào camera';
  }
  if (live) {
    if (typeof face.real === 'number' && face.real < MIN_REAL) return 'Nghi ảnh chụp/màn hình — cần mặt thật';
    if (typeof face.live === 'number' && face.live < MIN_LIVE) return 'Nghi ảnh chụp/màn hình — cần mặt thật';
  }
  return null;
}

// Thumbnail JPEG vuông quanh khuôn mặt, base64 không kèm tiền tố data: — gửi thẳng lên server.
export function cropThumbnail(source, face) {
  const [x, y, w, h] = face.box;
  const side = Math.max(w, h) * 1.4;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
  ctx.drawImage(source, cx - side / 2, cy - side / 2, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

// Đọc một file ảnh (admin import) → HTMLImageElement đã decode xong.
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')); };
    img.src = url;
  });
}
