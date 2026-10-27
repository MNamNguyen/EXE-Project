// Bọc @vladmandic/human: nạp mô hình MỘT lần, đọc khuôn mặt từ video/ảnh, kiểm tra chất
// lượng và cắt thumbnail. Mọi embedding của hệ thống (sinh viên tự chụp, admin import,
// kiosk) đều đi qua đây để cùng cấu hình (faceConfig.js).
//
// Mô hình chạy trong Web Worker (faceWorker.js) để không chặn luồng giao diện. Trình duyệt
// thiếu OffscreenCanvas/module worker (Safari cũ) thì chạy trên luồng chính như trước —
// chậm tay hơn nhưng vẫn dùng được, và vector như nhau vì cùng cấu hình, cùng backend.

import { EMBEDDING_DIM } from './faceMatch';
import { HUMAN_CONFIG, slimFace } from './faceConfig';

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

function canUseWorker() {
  return typeof Worker !== 'undefined'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof createImageBitmap === 'function';
}

async function workerEngine() {
  const worker = new Worker(new URL('./faceWorker.js', import.meta.url), { type: 'module' });
  const pending = new Map();
  let seq = 0;
  const failAll = (message) => {
    pending.forEach(({ reject }) => reject(new Error(message)));
    pending.clear();
  };
  worker.onmessage = ({ data }) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.error) call.reject(new Error(data.error));
    else call.resolve(data.faces);
  };
  // Script worker không tải/khởi động được → mọi lệnh đang chờ phải trả lỗi, không treo.
  worker.onerror = (e) => { e.preventDefault?.(); failAll(e.message || 'Worker nhận diện bị lỗi'); };
  const call = (msg, transfer = []) => new Promise((resolve, reject) => {
    seq += 1;
    pending.set(seq, { resolve, reject });
    worker.postMessage({ ...msg, id: seq }, transfer);
  });

  try {
    await call({ type: 'load' });
  } catch (err) {
    worker.terminate();
    throw err;
  }
  return {
    async detect(input) {
      // ImageBitmap chuyển (transfer) sang worker, không copy điểm ảnh.
      const bitmap = await createImageBitmap(input);
      return call({ type: 'detect', bitmap }, [bitmap]);
    },
  };
}

async function mainThreadEngine() {
  const { Human } = await import('@vladmandic/human');
  const human = new Human(HUMAN_CONFIG);
  await human.load();
  await human.warmup();
  return {
    async detect(input) {
      const result = await human.detect(input);
      return (result.face || []).map(slimFace);
    },
  };
}

export function loadFaceEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (canUseWorker()) {
        try {
          return await workerEngine();
        } catch {
          // Có worker nhưng không có WebGL trong worker, v.v. → thử luồng chính. Lỗi mạng
          // khi tải mô hình thì luồng chính cũng lỗi và rơi xuống catch bên dưới.
        }
      }
      return mainThreadEngine();
    })().catch((err) => {
      enginePromise = null; // lỗi mạng lúc tải mô hình → lần sau thử lại
      throw err;
    });
  }
  return enginePromise;
}

// Mọi khuôn mặt trong input, lớn nhất (gần camera nhất) trước.
export async function detectFaces(input) {
  const engine = await loadFaceEngine();
  const faces = await engine.detect(input);
  return faces.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
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
