// Sinh báo cáo điểm danh dạng HTML tĩnh, tự chứa hoàn toàn (không gọi CDN/JS
// ngoài) vì đây là một file được TẢI VỀ — người nhận có thể mở offline hoặc
// gửi lại cho người khác, không phải trang web luôn có mạng để tải tài nguyên.
// Biểu đồ donut vẽ bằng SVG thuần (kỹ thuật stroke-dasharray giống vòng đếm
// ngược trên màn hình QR — QRDisplay.jsx — để nhất quán phong cách trong app).

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function fmtTime(d) {
  return d ? new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
}

// Vẽ donut chart nhiều lát từ mảng { label, value, color }. Trả về chuỗi SVG,
// tự bỏ qua các lát value=0 (tránh dash length 0 gây artefact viền mảnh).
function donutChart(segments, { size = 220, stroke = 34, centerTitle, centerSub } = {}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const arcs = total === 0
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="${stroke}" />`
    : segments.filter((s) => s.value > 0).map((s) => {
        const dash = (s.value / total) * c;
        const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
          stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
          transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />`;
        offset += dash;
        return el;
      }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Biểu đồ điểm danh">
      ${arcs}
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="30" font-weight="800" fill="#0D1B5E">${escapeHtml(centerTitle)}</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="#6B7B9A">${escapeHtml(centerSub)}</text>
    </svg>`;
}

const COLORS = { checkedOut: '#0D9488', checkedInOnly: '#059669', absent: '#EF4444' };

function buildAttendanceHtmlReport(event, attendances) {
  const rows = attendances.map((a) => ({
    mssv: a.user.mssv || '',
    name: a.user.name,
    email: a.user.email,
    class: a.user.class || '',
    checkinTime: a.checkinTime,
    checkoutTime: a.checkoutTime,
  }));

  const attended = rows.filter((r) => r.checkinTime);
  const absent = rows.filter((r) => !r.checkinTime);
  const checkedOut = attended.filter((r) => r.checkoutTime);
  const checkedInOnly = attended.filter((r) => !r.checkoutTime);
  const total = rows.length;
  const rate = total > 0 ? Math.round((attended.length / total) * 100) : 0;

  const chart = donutChart(
    [
      { label: 'Đã check-out', value: checkedOut.length, color: COLORS.checkedOut },
      { label: 'Chỉ check-in', value: checkedInOnly.length, color: COLORS.checkedInOnly },
      { label: 'Vắng', value: absent.length, color: COLORS.absent },
    ],
    { centerTitle: `${rate}%`, centerSub: 'tham dự' },
  );

  const attendedRows = attended
    .sort((a, b) => new Date(a.checkinTime) - new Date(b.checkinTime))
    .map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.mssv)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.class)}</td>
        <td>${fmtTime(r.checkinTime)}</td>
        <td>${r.checkoutTime ? fmtTime(r.checkoutTime) : '<span class="muted">—</span>'}</td>
      </tr>`).join('') || `<tr><td colspan="6" class="empty">Chưa có ai điểm danh</td></tr>`;

  const absentRows = absent
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.mssv)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.class)}</td>
        <td>${escapeHtml(r.email)}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">Không có ai vắng — mọi người đã điểm danh 🎉</td></tr>`;

  const schedule = event.checkinOpen
    ? `${fmtDateTime(event.checkinOpen)}${event.checkinClose ? ` – ${fmtTime(event.checkinClose)}` : ''}`
    : 'Điểm danh thủ công (không đặt lịch cố định)';

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Báo cáo điểm danh - ${escapeHtml(event.name)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0; background: #F4F7FC;
    font-family: 'Segoe UI', Arial, 'Helvetica Neue', sans-serif;
    color: #0D1B5E;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 60px; }
  .banner {
    background: linear-gradient(135deg, #0052D4, #1A6BFF, #00A3FF);
    border-radius: 20px; padding: 36px 32px; color: white;
  }
  .banner .eyebrow { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.75); font-weight: 700; margin: 0 0 8px; }
  .banner h1 { font-size: 26px; margin: 0 0 14px; line-height: 1.3; }
  .banner .meta { display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 13px; color: rgba(255,255,255,0.85); }
  .banner .meta b { color: white; font-weight: 600; }

  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 24px 0; }
  .stat { background: white; border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(13,27,94,0.08); text-align: center; }
  .stat .n { font-size: 26px; font-weight: 800; line-height: 1; }
  .stat .l { font-size: 12px; color: #6B7B9A; margin-top: 6px; }
  .stat.total .n { color: #1A6BFF; }
  .stat.checkedout .n { color: ${COLORS.checkedOut}; }
  .stat.checkedin .n { color: ${COLORS.checkedInOnly}; }
  .stat.absent .n { color: ${COLORS.absent}; }

  .chart-card {
    background: white; border-radius: 20px; padding: 28px; margin: 24px 0;
    display: flex; align-items: center; gap: 32px; flex-wrap: wrap;
    box-shadow: 0 1px 3px rgba(13,27,94,0.08);
  }
  .legend { display: flex; flex-direction: column; gap: 12px; flex: 1; min-width: 200px; }
  .legend-item { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .legend-item .dot { width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0; }
  .legend-item .val { margin-left: auto; font-weight: 700; }

  .section { background: white; border-radius: 20px; padding: 4px 0 8px; margin: 24px 0; box-shadow: 0 1px 3px rgba(13,27,94,0.08); overflow: hidden; }
  .section h2 { font-size: 15px; padding: 20px 24px 12px; margin: 0; display: flex; align-items: center; gap: 8px; }
  .section h2 .badge { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
  .badge.green { background: #ECFDF5; color: #059669; }
  .badge.red { background: #FEF2F2; color: #EF4444; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { text-align: left; padding: 10px 24px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6B7B9A; border-bottom: 1px solid #EEF1F8; }
  tbody td { padding: 10px 24px; border-bottom: 1px solid #F5F7FB; }
  tbody tr:last-child td { border-bottom: none; }
  .muted { color: #C7CEDD; }
  .empty { text-align: center; color: #9CA6BF; padding: 24px !important; font-style: italic; }

  footer { text-align: center; font-size: 11px; color: #9CA6BF; margin-top: 32px; }

  @media (max-width: 620px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
    .chart-card { flex-direction: column; }
  }
  @media print {
    body { background: white; }
    .section, .chart-card, .stat { box-shadow: none; border: 1px solid #EEF1F8; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="banner">
      <p class="eyebrow">Báo cáo điểm danh · FPT Event</p>
      <h1>${escapeHtml(event.name)}</h1>
      <div class="meta">
        <span>📍 <b>${escapeHtml(event.location)}</b></span>
        <span>🕐 <b>${escapeHtml(schedule)}</b></span>
        <span>📄 Xuất lúc <b>${fmtDateTime(new Date())}</b></span>
      </div>
    </div>

    <div class="stats">
      <div class="stat total"><div class="n">${total}</div><div class="l">Tổng đăng ký</div></div>
      <div class="stat checkedin"><div class="n">${attended.length}</div><div class="l">Đã điểm danh</div></div>
      <div class="stat checkedout"><div class="n">${checkedOut.length}</div><div class="l">Đã check-out</div></div>
      <div class="stat absent"><div class="n">${absent.length}</div><div class="l">Vắng mặt</div></div>
    </div>

    <div class="chart-card">
      ${chart}
      <div class="legend">
        <div class="legend-item"><span class="dot" style="background:${COLORS.checkedOut}"></span> Đã check-out <span class="val">${checkedOut.length}</span></div>
        <div class="legend-item"><span class="dot" style="background:${COLORS.checkedInOnly}"></span> Chỉ check-in (chưa check-out) <span class="val">${checkedInOnly.length}</span></div>
        <div class="legend-item"><span class="dot" style="background:${COLORS.absent}"></span> Vắng mặt <span class="val">${absent.length}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>✅ Danh sách tham gia <span class="badge green">${attended.length} người</span></h2>
      <table>
        <thead><tr><th>STT</th><th>MSSV</th><th>Họ và tên</th><th>Lớp</th><th>Check-in</th><th>Check-out</th></tr></thead>
        <tbody>${attendedRows}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>❌ Danh sách vắng <span class="badge red">${absent.length} người</span></h2>
      <table>
        <thead><tr><th>STT</th><th>MSSV</th><th>Họ và tên</th><th>Lớp</th><th>Email</th></tr></thead>
        <tbody>${absentRows}</tbody>
      </table>
    </div>

    <footer>Xuất tự động bởi Hệ thống Điểm danh FPT Event · ${fmtDateTime(new Date())}</footer>
  </div>
</body>
</html>`;
}

module.exports = { buildAttendanceHtmlReport };
