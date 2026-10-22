const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { FONTS } = require('../lib/certificateLayout');
const { layoutField, layoutQr, qrMatrix, QR_QUIET_MODULES, invitationFieldText } = require('../lib/invitationLayout');
const { pageSize } = require('./certificatePdf');

const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const fontCache = new Map();

function fontBytes(key) {
  if (!fontCache.has(key)) fontCache.set(key, fs.readFileSync(path.join(FONT_DIR, FONTS[key])));
  return fontCache.get(key);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const WHITE = rgb(1, 1, 1);
const INK = rgb(0, 0, 0);

// Vẽ QR (kèm lề trắng) vào ô vuông có góc trên-trái (left, top), toạ độ tính từ
// góc TRÊN như layoutQr; pdf-lib đặt gốc ở góc DƯỚI nên lật trục y khi vẽ. Gộp
// các ô đen liền nhau trên một hàng thành một hình chữ nhật — ít lệnh vẽ hơn
// nhiều và không lộ đường kẻ mảnh giữa các ô khi phóng to.
// background = false: bỏ nền trắng, mã vẽ thẳng lên ảnh mẫu (vị trí/cỡ ô giữ nguyên).
// Thiệp mặc định luôn có nền (giấy kem, khung riêng); thiệp theo mẫu thì theo ô qr.
function drawQr(page, text, left, top, side, H, background = true) {
  const qr = qrMatrix(text);
  const cell = side / (qr.size + QR_QUIET_MODULES * 2);
  if (background) page.drawRectangle({ x: left, y: H - top - side, width: side, height: side, color: WHITE });
  for (let r = 0; r < qr.size; r++) {
    let c = 0;
    while (c < qr.size) {
      if (!qr.dark(r, c)) { c++; continue; }
      const start = c;
      while (c < qr.size && qr.dark(r, c)) c++;
      page.drawRectangle({
        x: left + (QR_QUIET_MODULES + start) * cell,
        y: H - top - (QR_QUIET_MODULES + r + 1) * cell,
        width: (c - start) * cell,
        height: cell,
        color: INK,
      });
    }
  }
}

async function newDoc(title) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  if (title) doc.setTitle(title);
  doc.setCreator('FPT Event System');
  const embedded = new Map();
  const font = async (key) => {
    if (!embedded.has(key)) embedded.set(key, await doc.embedFont(fontBytes(key), { subset: true }));
    return embedded.get(key);
  };
  return { doc, font };
}

// ── Thiệp theo mẫu BTC upload ─────────────────────────────────────────────

async function renderTemplatePages(doc, font, template, items) {
  const [W, H] = pageSize(template.width, template.height);
  const bytes = Buffer.from(template.image);
  // Nhúng ảnh nền MỘT lần cho cả file — in 300 thiệp không nhân 300 lần dung lượng ảnh.
  const img = template.mimeType === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

  for (const { values, qrText } of items) {
    const page = doc.addPage([W, H]);
    page.drawImage(img, { x: 0, y: 0, width: W, height: H });
    for (const field of template.fields) {
      if (field.key === 'qr') {
        const { left, top, side } = layoutQr(field, W, H);
        drawQr(page, qrText, left, top, side, H, field.background === true);
        continue;
      }
      const text = invitationFieldText(field, values);
      if (!field.enabled || !text) continue;
      const f = await font(field.font);
      const { left, baseline, fontSize } = layoutField(field, text, W, H, (t, s) => f.widthOfTextAtSize(t, s));
      page.drawText(text, { x: left, y: H - baseline, size: fontSize, font: f, color: hexToRgb(field.color) });
    }
  }
}

// ── Thiệp mặc định (sự kiện chưa upload mẫu) ──────────────────────────────

// Ngắt dòng theo từ cho vừa maxWidth, tối đa maxLines dòng; dư thì cắt "…".
function wrapText(text, f, size, maxWidth, maxLines) {
  const width = (t) => f.widthOfTextAtSize(t, size);
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (width(next) <= maxWidth) { line = next; continue; }
    if (line) lines.push(line);
    line = word;
    // Một "từ" dài hơn cả dòng (link, chuỗi liền) — cắt theo ký tự.
    while (width(line) > maxWidth && line.length > 1) {
      let i = line.length - 1;
      while (i > 1 && width(line.slice(0, i)) > maxWidth) i--;
      lines.push(line.slice(0, i));
      line = line.slice(i);
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && width(`${last}…`) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

const A5 = [420, 595];
const C = {
  paper: rgb(1, 0.984, 0.961),
  frame: rgb(0.91, 0.863, 0.784),
  accent: rgb(0.761, 0.255, 0.047),
  ink: rgb(0.122, 0.165, 0.267),
  muted: rgb(0.294, 0.333, 0.388),
};

async function renderDefaultPages(doc, font, items) {
  const [W, H] = A5;
  const [sans, bold, script] = [await font('sans'), await font('sans-bold'), await font('script')];

  // Chữ căn giữa; y là baseline tính từ mép TRÊN. Tự thu nhỏ nếu dài hơn maxWidth.
  const center = (page, text, y, f, size, color, maxWidth = W - 72) => {
    let s = size;
    const w = f.widthOfTextAtSize(text, s);
    if (w > maxWidth) s *= maxWidth / w;
    page.drawText(text, { x: (W - f.widthOfTextAtSize(text, s)) / 2, y: H - y, size: s, font: f, color });
  };

  const QR_SIDE = 150;
  const QR_TOP = H - 52 - QR_SIDE;

  for (const { values, qrText } of items) {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });
    page.drawRectangle({ x: 14, y: 14, width: W - 28, height: H - 28, borderColor: C.frame, borderWidth: 1 });

    center(page, 'THIỆP MỜI', 62, bold, 13, C.accent);
    page.drawRectangle({ x: W / 2 - 20, y: H - 74, width: 40, height: 1.5, color: C.accent });
    center(page, 'Trân trọng kính mời', 108, sans, 12, C.muted);
    center(page, values.name, 152, script, 34, C.ink);
    center(page, 'tới dự', 188, sans, 12, C.muted);

    let y = 222;
    for (const line of wrapText(values.event, bold, 18, W - 72, 3)) {
      center(page, line, y, bold, 18, C.ink);
      y += 24;
    }
    y += 4;
    if (values.time) {
      center(page, values.time, y, sans, 11.5, C.muted);
      y += 18;
    }
    for (const line of wrapText(values.location, sans, 11.5, W - 96, 2)) {
      center(page, line, y, sans, 11.5, C.muted);
      y += 16;
    }
    // Thiệp mặc định gộp ghế + số vé một dòng "Ghế E08, E09 · 2 vé" — dòng dài nhất
    // (event 3 dòng + địa điểm 2 dòng) vẫn nằm trên mép QR (QR_TOP = 393).
    const seatLine = [values.seat, values.tickets].filter(Boolean).join(' · ');
    if (seatLine) center(page, seatLine, y + 12, bold, 13, C.accent);

    drawQr(page, qrText, (W - QR_SIDE) / 2, QR_TOP, QR_SIDE, H);
    center(page, 'Vui lòng xuất trình mã QR này khi tới sự kiện', H - 30, sans, 9.5, C.muted);
  }
}

// items: [{ values: { name, event, time, location, seat }, qrText }] — mỗi khách một trang.
// template null = thiệp mặc định.
async function renderInvitationsPdf(template, items, { title } = {}) {
  const { doc, font } = await newDoc(title);
  if (template) await renderTemplatePages(doc, font, template, items);
  else await renderDefaultPages(doc, font, items);
  return doc.save();
}

// Mỗi khách một file PDF riêng (xuất ZIP). Vẽ chung một lần rồi chép từng trang ra
// file con: ảnh mẫu PNG chỉ giải nén một lần thay vì một lần mỗi khách (Render free
// CPU yếu), font đã subset sẵn. Trả từng file lần lượt để nơi gọi ghi ZIP dạng luồng —
// 300 thiệp × ảnh mẫu vài MB không được dồn hết vào RAM.
async function* renderInvitationsSeparately(template, items, { titles = [] } = {}) {
  const merged = await PDFDocument.load(await renderInvitationsPdf(template, items));
  for (let i = 0; i < items.length; i++) {
    const doc = await PDFDocument.create();
    if (titles[i]) doc.setTitle(titles[i]);
    doc.setCreator('FPT Event System');
    const [page] = await doc.copyPages(merged, [i]);
    doc.addPage(page);
    yield doc.save();
  }
}

module.exports = { renderInvitationsPdf, renderInvitationsSeparately, wrapText };
