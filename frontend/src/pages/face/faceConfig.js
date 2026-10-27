// Cấu hình @vladmandic/human dùng chung cho faceWorker.js (đường chính) và faceEngine.js
// (dự phòng khi trình duyệt không chạy được mô hình trong worker). Vector của hai cấu hình
// khác nhau không so được với nhau → đổi gì ở đây ảnh hưởng vector thì đổi FACE_MODEL ở
// backend/src/lib/faceProfile.js để mọi người đăng ký lại.
//
// Mô hình phục vụ tại /models/human/ (xem vite.config.js), không qua CDN.

export const HUMAN_CONFIG = {
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

// Chỉ những trường faceEngine/kiosk dùng. Kết quả gốc của Human kèm mesh 478 điểm,
// annotations… — gửi qua postMessage mỗi khung là phí, và hai đường (worker / luồng chính)
// phải trả cùng một hình dạng.
export function slimFace(face) {
  return {
    box: face.box,
    score: face.score,
    embedding: face.embedding,
    rotation: face.rotation ? { angle: face.rotation.angle } : null,
    real: face.real,
    live: face.live,
  };
}
