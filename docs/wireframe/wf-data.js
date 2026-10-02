// Dữ liệu giả cho wireframe. "Bây giờ" là 08:20 Thứ Sáu 02/10/2026: cổng check-in của hội thảo AI
// đang mở theo lịch (đóng 08:30) mà còn 62 người chưa tới, đó là trạng thái suy từ giờ cần nổi.
window.WFD = {
  now: "08:20 · Thứ Sáu 02/10/2026",
  admin: { id: "u-admin", name: "Trần Nguyễn Anh Thư", email: "thu.tna@fe.edu.vn", role: "ADMIN" },
  student: { id: "u-st", name: "Lê Hoàng Phúc", email: "phuclhse180452@fpt.edu.vn", mssv: "SE180452", cls: "SE1801" },

  events: [
    {
      id: "e1", name: "Hội thảo Trí tuệ nhân tạo trong giáo dục 2026", location: "Hội trường A1, FPT University HCM",
      day: "02", mon: "TH10", dateLong: "Thứ Sáu 02/10/2026", date: "02/10", time: "07:45 – 11:30", status: "live",
      registered: 186, checkedIn: 124, checkedOut: 0, notYet: 62,
      gateIn: { state: "AUTO", open: true, window: "07:45 – 08:30", line: "Đang mở theo lịch · đóng lúc 08:30" },
      gateOut: { state: "AUTO", open: false, window: "11:00 – 11:30", line: "Chưa tới giờ mở · mở lúc 11:00" },
    },
    {
      id: "e2", name: "SE1801 · Buổi 12 – Lập trình Web", location: "Phòng 305, toà Alpha",
      day: "02", mon: "TH10", dateLong: "Thứ Sáu 02/10/2026", date: "02/10", time: "Mở thủ công", status: "live", manual: true,
      registered: 42, checkedIn: 38, checkedOut: 0, notYet: 4, cls: "SE1801",
      gateIn: { state: "OPEN", open: true, window: null, line: "Đang mở thủ công" },
      gateOut: { state: "CLOSED", open: false, window: null, line: "Đang đóng thủ công" },
    },
    {
      id: "e3", name: "Workshop React nâng cao cho sinh viên năm 3", location: "Phòng 201, toà Beta",
      day: "02", mon: "TH10", dateLong: "Thứ Sáu 02/10/2026", date: "02/10", time: "14:00 – 16:30", status: "upcoming", registered: 64,
    },
    {
      id: "e4", name: "Ngày hội việc làm FPT University mùa thu 2026 – Kết nối doanh nghiệp và sinh viên công nghệ thông tin",
      location: "Sân trung tâm, FPT University HCM", day: "07", mon: "TH10", dateLong: "Thứ Tư 07/10/2026", date: "07/10",
      time: "08:00 – 16:00", status: "upcoming", registered: 1284,
    },
    {
      id: "e5", name: "Giao lưu CLB Guitar", location: "Sảnh tầng trệt, toà Alpha",
      day: "10", mon: "TH10", dateLong: "Thứ Bảy 10/10/2026", date: "10/10", time: "18:30 – 20:30", status: "upcoming", registered: 0,
    },
    {
      id: "e6", name: "Tập huấn an toàn PCCC cho cán bộ lớp", location: "Hội trường B2",
      day: null, mon: null, dateLong: null, date: null, time: "Chưa đặt lịch", status: "manual", registered: 35,
    },
    {
      id: "e7", name: "Seminar Khởi nghiệp với dữ liệu mở", location: "Phòng 102, toà Gamma",
      day: "29", mon: "TH9", dateLong: "Thứ Ba 29/09/2026", date: "29/09", time: "13:30 – 16:00", status: "ended", registered: 142, checkedOut: 131,
    },
    {
      id: "e8", name: "Cuộc thi Hackathon FPTU 2026 – Vòng chung kết", location: "Thư viện tầng 3",
      day: "26", mon: "TH9", dateLong: "Thứ Bảy 26/09/2026", date: "26/09", time: "08:00 – 17:00", status: "ended", registered: 96, checkedOut: 88,
    },
  ],

  // [tên, MSSV, lớp, giờ vào, giờ ra, trạng thái] của hội thảo AI (20 / 186 dòng)
  attendees: [
    ["Nguyễn Thị Minh Anh", "SE180123", "SE1801", "07:46:12", null, "CHECKED_IN"],
    ["Trần Quốc Bảo", "SE180245", "SE1801", "07:47:03", null, "CHECKED_IN"],
    ["Tôn Nữ Thị Phương Thảo Nguyên", "AI170318", "AI1702", "07:48:40", null, "CHECKED_IN"],
    ["Lê Hoàng Phúc", "SE180452", "SE1801", "07:52:19", null, "CHECKED_IN"],
    ["Phạm Ngọc Hân", "GD180077", "GD1803", null, null, "REGISTERED"],
    ["Võ Đức Thịnh", "SE170961", "SE1705", "07:55:31", null, "CHECKED_IN"],
    ["Đặng Thị Thu Trang", "MC180014", null, null, null, "REGISTERED"],
    ["Huỳnh Gia Khánh", "SE181102", "SE1802", "08:01:57", null, "CHECKED_IN"],
    ["Bùi Minh Khôi", "IA180230", "IA1801", null, null, "REGISTERED"],
    ["Ngô Văn Tài", "SE160778", "SE1608", "08:04:10", null, "CHECKED_IN"],
  ],

  reminders: [
    { by: "Trần Nguyễn Anh Thư", at: "07:30 · 02/10", status: "SENT", ok: 58, total: 62, note: "Nhớ mang theo thẻ sinh viên và đến trước 15 phút." },
    { by: "Lê Văn Minh", at: "18:05 · 01/10", status: "SENT", ok: 186, total: 186, note: null },
  ],

  users: [
    { name: "Trần Nguyễn Anh Thư", email: "thu.tna@fe.edu.vn", mssv: null, cls: null, role: "ADMIN", active: true, me: true },
    { name: "Lê Văn Minh", email: "minhlv@fe.edu.vn", mssv: null, cls: null, role: "BTC", active: true },
    { name: "Phạm Thị Hồng Nhung", email: "nhungpth@fe.edu.vn", mssv: null, cls: null, role: "LECTURER", active: true },
    { name: "Lê Hoàng Phúc", email: "phuclhse180452@fpt.edu.vn", mssv: "SE180452", cls: "SE1801", role: "STUDENT", active: true },
    { name: "Tôn Nữ Thị Phương Thảo Nguyên", email: "nguyentntpt.ai170318@fpt.edu.vn", mssv: "AI170318", cls: "AI1702", role: "STUDENT", active: true },
    { name: "Bùi Minh Khôi", email: "khoibm180230@fpt.edu.vn", mssv: "IA180230", cls: "IA1801", role: "STUDENT", active: false },
    { name: "Đặng Thị Thu Trang", email: "trangdtt180014@fpt.edu.vn", mssv: "MC180014", cls: null, role: "STUDENT", active: true },
    { name: "Ngô Văn Tài", email: "taingo160778@fpt.edu.vn", mssv: "SE160778", cls: "SE1608", role: "STUDENT", active: true },
  ],

  classes: [
    { name: "SE1801", desc: "Lập trình Web – Khoá 18", members: 42, by: "Trần Nguyễn Anh Thư", sessions: 12 },
    { name: "SE1802", desc: "Lập trình Web – Khoá 18", members: 40, by: "Trần Nguyễn Anh Thư", sessions: 11 },
    { name: "AI1702", desc: "Học máy cơ bản", members: 38, by: "Lê Văn Minh", sessions: 9 },
    { name: "KNM-K18-T7", desc: "Lớp kỹ năng mềm cho sinh viên khoá 18, nhóm học sáng thứ Bảy tại cơ sở Alpha", members: 126, by: "Lê Văn Minh", sessions: 4 },
    { name: "GD1803", desc: null, members: 0, by: "Trần Nguyễn Anh Thư", sessions: 0 },
  ],

  classMembers: [
    ["Nguyễn Thị Minh Anh", "SE180123", "anhntm180123@fpt.edu.vn"],
    ["Trần Quốc Bảo", "SE180245", "baotq180245@fpt.edu.vn"],
    ["Lê Hoàng Phúc", "SE180452", "phuclhse180452@fpt.edu.vn"],
    ["Huỳnh Gia Khánh", "SE181102", "khanhhg181102@fpt.edu.vn"],
    ["Ngô Thị Bích Ngọc", "SE180587", "ngocntb180587@fpt.edu.vn"],
    ["Đỗ Thành Đạt", "SE180611", "datdt180611@fpt.edu.vn"],
  ],

  sessions: [
    { name: "SE1801 · Buổi 12 – Lập trình Web", when: "Mở thủ công · 02/10", place: "Phòng 305, toà Alpha", done: 38, total: 42, live: true },
    { name: "SE1801 · Buổi 11 – Lập trình Web", when: "13:00 · 30/09", place: "Phòng 305, toà Alpha", done: 41, total: 42 },
    { name: "SE1801 · Buổi 10 – Lập trình Web", when: "13:00 · 28/09", place: "Phòng 305, toà Alpha", done: 39, total: 42 },
    { name: "SE1801 · Buổi 9 – Lập trình Web", when: "13:00 · 25/09", place: "Phòng 204, toà Beta", done: 42, total: 42 },
  ],

  templates: [
    { name: "Đánh giá hội thảo chuyên đề", desc: "Dùng cho hội thảo, seminar có diễn giả khách mời", rating: 3, text: 2, used: 4, by: "Trần Nguyễn Anh Thư", mine: true },
    { name: "Khảo sát workshop kỹ thuật", desc: null, rating: 5, text: 1, used: 0, by: "Trần Nguyễn Anh Thư", mine: true },
    { name: "Đánh giá buổi học thực hành phòng máy và mức độ hỗ trợ của trợ giảng trong học kỳ Thu 2026", desc: "Mẫu chung của bộ môn Kỹ thuật phần mềm", rating: 4, text: 2, used: 12, by: "Phạm Thị Hồng Nhung", mine: false },
  ],

  fraud: [
    { at: "08:14:52 · 02/10", name: "Phạm Ngọc Hân", mssv: "GD180077", event: "Hội thảo Trí tuệ nhân tạo trong giáo dục 2026", reason: "GPS_OUT_OF_RANGE", detail: "312 m" },
    { at: "08:09:07 · 02/10", name: "Bùi Minh Khôi", mssv: "IA180230", event: "Hội thảo Trí tuệ nhân tạo trong giáo dục 2026", reason: "UNBOUND_DEVICE", detail: "Thiết bị lạ" },
    { at: "07:58:31 · 02/10", name: "Đặng Thị Thu Trang", mssv: "MC180014", event: "SE1801 · Buổi 12 – Lập trình Web", reason: "INVALID_QR_TOKEN", detail: null },
    { at: "13:41:10 · 29/09", name: null, mssv: null, event: "Seminar Khởi nghiệp với dữ liệu mở", reason: "INVALID_QR_TOKEN", detail: null },
  ],

  certs: [
    { event: "Seminar Khởi nghiệp với dữ liệu mở", issued: "30/09/2026", code: "CN-7K2P-91QD" },
    { event: "Cuộc thi Hackathon FPTU 2026 – Vòng chung kết", issued: "27/09/2026", code: "CN-3MX8-L0TE" },
  ],

  // Sự kiện của sinh viên: trạng thái của chính mình, đánh giá, chứng nhận
  myHistory: [
    { name: "Hội thảo Trí tuệ nhân tạo trong giáo dục 2026", date: "02/10", place: "Hội trường A1", status: "CHECKED_IN", inAt: "07:52", outAt: null },
    { name: "Seminar Khởi nghiệp với dữ liệu mở", date: "29/09", place: "Phòng 102, toà Gamma", status: "CHECKED_OUT", inAt: "13:32", outAt: "15:58", minutes: 146, feedback: "open", cert: true },
    { name: "Cuộc thi Hackathon FPTU 2026 – Vòng chung kết", date: "26/09", place: "Thư viện tầng 3", status: "CHECKED_OUT", inAt: "07:55", outAt: "17:02", minutes: 547, feedback: "sent", cert: true },
    { name: "Talkshow Kỹ năng phỏng vấn cùng doanh nghiệp", date: "19/09", place: "Hội trường B2", status: "ABSENT", inAt: null, outAt: null },
  ],
};
