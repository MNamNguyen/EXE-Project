// Vẽ chứng nhận lên <canvas> để xem ngay trên web (điện thoại không xem được PDF
// nhúng trong trang). Quy tắc bố cục là BẢN SAO của backend/src/lib/certificateLayout.js
// và font là cùng bộ file với backend/assets/fonts — sửa một bên thì sửa cả bên
// kia, nếu không bản xem trên web sẽ lệch với file PDF tải về.

export const FONT_FILES = {
  sans: 'BeVietnamPro-Regular.ttf',
  'sans-bold': 'BeVietnamPro-Bold.ttf',
  serif: 'NoticiaText-Bold.ttf',
  script: 'GreatVibes-Regular.ttf',
};

export const FONT_LABELS = {
  sans: 'Không chân',
  'sans-bold': 'Không chân (đậm)',
  serif: 'Có chân (đậm)',
  script: 'Viết tay',
};

export const FIELD_LABELS = {
  name: 'Họ tên người nhận',
  event: 'Tên sự kiện',
  date: 'Ngày',
  code: 'Mã chứng nhận',
};

export const DEFAULT_FIELDS = [
  { key: 'name', enabled: true, x: 0.5, y: 0.52, size: 0.055, maxWidth: 0.8, font: 'script', color: '#1F2A44', align: 'center' },
  { key: 'event', enabled: true, x: 0.5, y: 0.63, size: 0.026, maxWidth: 0.8, font: 'sans-bold', color: '#1F2A44', align: 'center' },
  { key: 'date', enabled: true, x: 0.5, y: 0.7, size: 0.018, maxWidth: 0.6, font: 'sans', color: '#4B5563', align: 'center' },
  { key: 'code', enabled: true, x: 0.92, y: 0.92, size: 0.011, maxWidth: 0.4, font: 'sans', color: '#6B7280', align: 'right' },
];

const family = (key) => `cert-${key}`;
let fontsPromise = null;

// Nạp font một lần cho cả phiên. Canvas vẽ bằng font chưa tải xong sẽ lặng lẽ
// dùng font hệ thống — nên luôn await hàm này trước khi vẽ.
export function loadCertFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all(Object.entries(FONT_FILES).map(async ([key, file]) => {
      const face = new FontFace(family(key), `url(/fonts/cert/${file})`);
      await face.load();
      document.fonts.add(face);
    })).catch((err) => {
      fontsPromise = null;
      throw err;
    });
  }
  return fontsPromise;
}

// Giống hệt layoutField ở backend: x theo align, y là baseline, tự thu nhỏ khi dài.
export function layoutField(field, text, W, H, measure) {
  let fontSize = field.size * W;
  let width = measure(text, fontSize);
  const maxW = field.maxWidth * W;
  if (width > maxW && width > 0) {
    fontSize *= maxW / width;
    width = maxW;
  }
  const anchor = field.x * W;
  const left = field.align === 'center' ? anchor - width / 2 : field.align === 'right' ? anchor - width : anchor;
  return { left, baseline: field.y * H, fontSize, width };
}

// Vẽ toàn bộ chứng nhận; trả khung bao từng ô (tỉ lệ 0–1) cho editor kéo thả.
export function drawCertificate(ctx, img, fields, values) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const boxes = {};
  for (const field of fields) {
    const text = values[field.key];
    if (!field.enabled || !text) continue;
    const measure = (t, size) => {
      ctx.font = `${size}px "${family(field.font)}"`;
      return ctx.measureText(t).width;
    };
    const { left, baseline, fontSize, width } = layoutField(field, text, W, H, measure);
    ctx.font = `${fontSize}px "${family(field.font)}"`;
    ctx.fillStyle = field.color;
    ctx.fillText(text, left, baseline);
    // Khung bao gần đúng (chữ viết tay có nét vươn cao) — chỉ để chọn/kéo trong editor.
    boxes[field.key] = {
      left: left / W,
      top: (baseline - fontSize * 0.95) / H,
      width: width / W,
      height: (fontSize * 1.25) / H,
    };
  }
  return boxes;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không tải được ảnh mẫu'));
    img.src = url;
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
