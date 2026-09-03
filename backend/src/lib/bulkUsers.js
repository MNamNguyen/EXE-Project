// Chuẩn hoá phần "chọn nhiều người dùng" cho mọi thao tác hàng loạt của admin.
//
// Hai quy tắc ở đây là lý do file này tồn tại, đừng tự viết lại ở controller:
//  1. Có trần số bản ghi mỗi lần gọi. Một cú click "chọn tất cả" nhầm không
//     được phép quét cả bảng users (Supabase free tier + pooler 1 connection).
//  2. Tài khoản của chính admin đang thao tác LUÔN bị loại khỏi lô. Tự xoá,
//     tự khoá hay tự hạ quyền mình là cách nhanh nhất để mất quyền quản trị
//     và không có đường khôi phục trong app.

const MAX_BULK = 200;

// Reset mật khẩu phải bcrypt.hash từng tài khoản (~100ms/lần với bcryptjs)
// nên trần thấp hơn, tránh request treo quá lâu trên Render free tier.
const MAX_BULK_PASSWORD = 50;

const SELF_SKIP_REASON = 'Không thể thao tác hàng loạt trên tài khoản của chính bạn';
const NOT_FOUND_REASON = 'Không tìm thấy tài khoản';

// Trả về { error } khi input sai, hoặc { ids, selfSkipped }.
// ids có thể RỖNG dù không có lỗi (admin chỉ chọn đúng mình) — controller nên
// coi đó là thành công với 0 bản ghi, không phải lỗi 400.
function parseUserIds(body, { max = MAX_BULK, selfId } = {}) {
  if (!Array.isArray(body?.userIds)) {
    return { error: 'Danh sách người dùng không hợp lệ' };
  }

  const ids = [...new Set(body.userIds.filter((id) => typeof id === 'string' && id.trim()))];
  if (ids.length === 0) {
    return { error: 'Chưa chọn người dùng nào' };
  }
  if (ids.length > max) {
    return { error: `Chỉ xử lý tối đa ${max} tài khoản mỗi lần. Hãy chia nhỏ danh sách chọn.` };
  }

  const selfSkipped = Boolean(selfId) && ids.includes(selfId);
  return { ids: ids.filter((id) => id !== selfId), selfSkipped };
}

// Danh sách "đã bỏ qua" hiển thị nguyên văn trên UI nên luôn kèm tên người dùng.
function selfSkipEntry(user) {
  return { id: user.id, name: user.name, reason: SELF_SKIP_REASON };
}

// Id gửi lên nhưng không còn trong DB (người khác vừa xoá, tab cũ...).
function missingSkipEntries(requestedIds, foundUsers) {
  const found = new Set(foundUsers.map((u) => u.id));
  return requestedIds
    .filter((id) => !found.has(id))
    .map((id) => ({ id, name: id, reason: NOT_FOUND_REASON }));
}

module.exports = {
  MAX_BULK,
  MAX_BULK_PASSWORD,
  SELF_SKIP_REASON,
  NOT_FOUND_REASON,
  parseUserIds,
  selfSkipEntry,
  missingSkipEntries,
};
