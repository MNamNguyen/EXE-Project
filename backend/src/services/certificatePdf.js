const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { FONTS, layoutField } = require('../lib/certificateLayout');

const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const fontCache = new Map();

function fontBytes(key) {
  if (!fontCache.has(key)) fontCache.set(key, fs.readFileSync(path.join(FONT_DIR, FONTS[key])));
  return fontCache.get(key);
}

// Cạnh dài của trang = cạnh dài khổ A4 (842pt), giữ đúng tỉ lệ ảnh mẫu. Nếu lấy
// kích thước ảnh làm kích thước trang, ảnh 3508px thành trang rộng 1,2 mét và
// máy in/trình xem PDF thu nhỏ lung tung.
const LONG_SIDE_PT = 842;

function pageSize(width, height) {
  return width >= height
    ? [LONG_SIDE_PT, (LONG_SIDE_PT * height) / width]
    : [(LONG_SIDE_PT * width) / height, LONG_SIDE_PT];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Kiểm tra ảnh mẫu upload lên: đúng PNG/JPG (theo byte đầu file, không tin
// mimetype của trình duyệt) và đọc được — trả { mimeType, width, height }.
async function inspectTemplateImage(buffer) {
  const isPng = buffer.length > 8 && buffer.readUInt32BE(0) === 0x89504e47;
  const isJpg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!isPng && !isJpg) return { error: 'Chỉ nhận ảnh PNG hoặc JPG' };
  try {
    const doc = await PDFDocument.create();
    const img = isPng ? await doc.embedPng(buffer) : await doc.embedJpg(buffer);
    return { value: { mimeType: isPng ? 'image/png' : 'image/jpeg', width: img.width, height: img.height } };
  } catch {
    return { error: 'Không đọc được ảnh — hãy xuất lại file PNG/JPG' };
  }
}

// template: { image, mimeType, width, height, fields }; values: { name, event, date, code }.
async function renderCertificatePdf(template, values, { title } = {}) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  if (title) doc.setTitle(title);
  doc.setCreator('FPT Event System');

  const [W, H] = pageSize(template.width, template.height);
  const page = doc.addPage([W, H]);
  const bytes = Buffer.from(template.image);
  const img = template.mimeType === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  page.drawImage(img, { x: 0, y: 0, width: W, height: H });

  const embedded = new Map();
  for (const field of template.fields) {
    const text = values[field.key];
    if (!field.enabled || !text) continue;
    if (!embedded.has(field.font)) embedded.set(field.font, await doc.embedFont(fontBytes(field.font), { subset: true }));
    const font = embedded.get(field.font);

    const { left, baseline, fontSize } = layoutField(field, text, W, H, (t, s) => font.widthOfTextAtSize(t, s));
    // pdf-lib đặt gốc toạ độ ở góc DƯỚI-trái, layoutField tính từ góc trên.
    page.drawText(text, { x: left, y: H - baseline, size: fontSize, font, color: hexToRgb(field.color) });
  }

  return doc.save();
}

module.exports = { renderCertificatePdf, inspectTemplateImage, pageSize };
