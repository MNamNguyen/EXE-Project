const prisma = require('./prisma');

// Ghi người dùng vào danh sách tham gia sự kiện.
//
// Một "suất tham gia" luôn gồm 2 bản ghi: EventMember (quyền check-in khi sự kiện
// bật whitelist) và Attendance status REGISTERED (để BTC thấy người đó trong bảng
// điểm danh và trong file Excel xuất ra). Mọi đường vào danh sách — sinh viên tự
// đăng ký, BTC thêm tay, BTC thêm cả lớp — đều đi qua đây để hai bảng không lệch nhau.
//
// Idempotent: gọi lại không tạo trùng và KHÔNG ghi đè bản ghi điểm danh đã có,
// nên người đã check-in không bị đặt ngược về REGISTERED.
async function addUsersToEvent(eventId, userIds) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { added: 0 };

  const [memberResult] = await prisma.$transaction([
    prisma.eventMember.createMany({
      data: ids.map((userId) => ({ eventId, userId })),
      skipDuplicates: true,
    }),
    prisma.attendance.createMany({
      data: ids.map((userId) => ({ eventId, userId, status: 'REGISTERED' })),
      skipDuplicates: true,
    }),
  ]);

  // count = số suất MỚI thêm được; phần chênh so với ids.length là người đã có sẵn.
  return { added: memberResult.count };
}

// Gỡ khỏi danh sách tham gia. Chỉ xoá bản ghi điểm danh khi người đó chưa thực sự
// dự sự kiện — đã check-in/check-out thì giữ lại làm bằng chứng tham dự.
async function removeUserFromEvent(eventId, userId) {
  await prisma.$transaction([
    prisma.eventMember.deleteMany({ where: { eventId, userId } }),
    prisma.attendance.deleteMany({ where: { eventId, userId, status: 'REGISTERED' } }),
  ]);
}

module.exports = { addUsersToEvent, removeUserFromEvent };
