const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument } = require('pdf-lib');
const { FONTS } = require('../src/lib/certificateLayout');

// Chứng nhận/thiệp mời vẽ ở hai nơi: PDF (backend/assets/fonts) và canvas trình duyệt
// (frontend/public/fonts/cert, bảng FONT_FILES trong certRender.js). Lệch một bên là
// bản xem trên web khác file PDF tải về — test này chốt hai bên trùng nhau.
const ROOT = path.join(__dirname, '..', '..');
const BACKEND_DIR = path.join(ROOT, 'backend', 'assets', 'fonts');
const FRONTEND_DIR = path.join(ROOT, 'frontend', 'public', 'fonts', 'cert');
const VI = 'aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵđ';

test('font: bảng FONT_FILES ở frontend trùng FONTS ở backend', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'pages', 'certificates', 'certRender.js'), 'utf8');
  const block = src.match(/export const FONT_FILES = \{([\s\S]*?)\};/)[1];
  const frontend = Object.fromEntries([...block.matchAll(/'?([\w-]+)'?:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  assert.deepStrictEqual(frontend, FONTS);

  const labels = src.match(/export const FONT_LABELS = \{([\s\S]*?)\};/)[1];
  const labelKeys = [...labels.matchAll(/^\s*'?([\w-]+)'?:/gm)].map((m) => m[1]);
  assert.deepStrictEqual(labelKeys.sort(), Object.keys(FONTS).sort());
});

test('font: mỗi font có ở cả hai thư mục, cùng một file, đủ dấu tiếng Việt', () => {
  for (const [key, file] of Object.entries(FONTS)) {
    const bytes = fs.readFileSync(path.join(BACKEND_DIR, file));
    assert.ok(bytes.equals(fs.readFileSync(path.join(FRONTEND_DIR, file))), `${file} lệch giữa backend và frontend`);
    const font = fontkit.create(bytes);
    const missing = [...VI + VI.toUpperCase()].filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)));
    assert.deepStrictEqual(missing, [], `font "${key}" thiếu chữ ${missing.join('')}`);
  }
});

test('font: pdf-lib nhúng được mọi font (subset) với chữ có dấu', async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([400, 100]);
  for (const file of Object.values(FONTS)) {
    const f = await doc.embedFont(fs.readFileSync(path.join(BACKEND_DIR, file)), { subset: true });
    page.drawText('Nguyễn Thị Phương Thảo — Đặng Ỷ', { x: 10, y: 50, size: 20, font: f });
  }
  assert.ok((await doc.save()).length > 0);
});
