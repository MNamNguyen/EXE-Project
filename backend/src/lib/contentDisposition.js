// Giá trị header HTTP chỉ được chứa ký tự ASCII — Node ném
// "TypeError: Invalid character in header content" ngay khi res.setHeader()
// nhận một filename tiếng Việt có dấu (vd. tên sự kiện). Toàn bộ tên sự kiện
// trong hệ thống này là tiếng Việt nên lỗi này chặn đứng MỌI lượt xuất báo cáo
// có dấu — không phải trường hợp hiếm.
//
// Cung cấp cả tên ASCII rút gọn (bỏ dấu, làm fallback cho trình duyệt cũ) và
// filename* mã hoá UTF-8 theo RFC 5987 để trình duyệt hiện đại hiển thị đúng
// tên có dấu khi tải về.
function toAsciiFilename(name) {
  const stripped = String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/ơ/g, 'o').replace(/Ơ/g, 'O')
    .replace(/ư/g, 'u').replace(/Ư/g, 'U')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return stripped || 'export';
}

function dispositionHeader(type, baseName, ext) {
  const asciiName = `${toAsciiFilename(baseName)}.${ext}`;
  const utf8Name = `${baseName}.${ext}`;
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}

function attachmentHeader(baseName, ext) {
  return dispositionHeader('attachment', baseName, ext);
}

// "inline" = trình duyệt HIỂN THỊ luôn thay vì tải về, dùng cho chế độ xem báo
// cáo trực tiếp trên web. Vẫn giữ filename để nếu người xem bấm Lưu thì tên
// file ra đúng như khi tải về.
function inlineHeader(baseName, ext) {
  return dispositionHeader('inline', baseName, ext);
}

module.exports = { attachmentHeader, inlineHeader, toAsciiFilename };
