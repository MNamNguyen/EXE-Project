import { Zip, ZipPassThrough } from 'fflate';
import { guestApi } from '../../../services/api';
import { downloadBlob, fontKeysOf, loadCertFonts, loadImage } from '../../certificates/certRender';
import { drawInvitation } from '../../certificates/invitationRender';

// Xuất thiệp PNG. Server không có canvas nên trình duyệt tự vẽ, bằng đúng drawInvitation
// của bản xem trước — vốn là bản sao quy tắc PDF, nên ảnh khớp file PDF. Chuỗi in trên
// thiệp và tên file vẫn do server tính (GET /invitations/cards) như PDF.
// Thiệp mặc định (chưa upload mẫu) chỉ có bản PDF: không có canvas vẽ mẫu đó.

export class NoTemplateError extends Error {}

const toPng = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không vẽ được thiệp'))), 'image/png');
});

// guestId: tải PNG một khách. Không có: mọi khách, gói ZIP. onProgress(done, total).
export async function exportInvitationPngs(event, { guestId, onProgress } = {}) {
  const { data } = await guestApi.cards(event.id, guestId);
  const { template, items } = data.data;
  if (!template) throw new NoTemplateError();

  const [{ data: image }] = await Promise.all([
    guestApi.getTemplateImage(event.id),
    loadCertFonts(fontKeysOf(template.fields)),
  ]);
  const url = URL.createObjectURL(image);
  try {
    const img = await loadImage(url);
    // Đúng cỡ ảnh mẫu BTC upload — cỡ họ thiết kế để in.
    const canvas = document.createElement('canvas');
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext('2d');
    const render = (item) => {
      drawInvitation(ctx, img, template.fields, item.values, item.qrText);
      return toPng(canvas);
    };

    if (guestId) {
      downloadBlob(await render(items[0]), `${items[0].fileName}.png`);
      return;
    }

    // ZIP dạng luồng, mỗi mảnh gói ngay thành Blob: vài trăm ảnh vài MB không phải giữ
    // thành một mảng byte khổng lồ (trình duyệt được phép đẩy Blob lớn xuống đĩa).
    // Không nén: PNG đã nén sẵn.
    const parts = [];
    let zipError = null;
    const zip = new Zip((err, chunk) => {
      if (err) zipError = err;
      else parts.push(new Blob([chunk]));
    });
    for (let i = 0; i < items.length; i++) {
      const png = new Uint8Array(await (await render(items[i])).arrayBuffer());
      const entry = new ZipPassThrough(`${items[i].fileName}.png`);
      zip.add(entry);
      entry.push(png, true);
      onProgress?.(i + 1, items.length);
    }
    zip.end();
    if (zipError) throw zipError;
    downloadBlob(new Blob(parts, { type: 'application/zip' }), `thiep-moi-${event.name}.zip`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportErrorMessage(err) {
  if (err instanceof NoTemplateError) return 'Thiệp mặc định chỉ tải được PDF — upload mẫu thiệp để xuất ảnh PNG';
  // responseType blob: lỗi 400 trả về Blob chứ không phải JSON đã parse.
  if (err.response?.status === 400) return 'Chưa có khách mời nào để tạo thiệp';
  return err.response?.data?.message || 'Không tạo được file thiệp';
}
