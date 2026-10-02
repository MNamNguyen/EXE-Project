// Các màn của wireframe. Mỗi màn: id, nhóm, các phương án, lý do từng phương án, và hàm render(v, tt).
(function () {
  const { cx, esc, I, btn, iconBtn, badge, evtBadge, attBadge, roleBadge, avatar, card, stats, pagination, empty, loadError, skel, skelRows, dateTile, field, textarea, search, selectBtn, dropdown, menuItem, menuGroups, menuBtn, tabs, viewAll, logo, checkbox } = WF;
  const D = WFD;
  const ev = (id) => D.events.find((e) => e.id === id);
  const fmt = (n) => n.toLocaleString("vi-VN");
  const href = (man) => `?${WF.link({ man })}`;

  // Đầu trang trong vùng nội dung (layouts/app.md): tên, dòng phụ, nút bên phải
  const pageHead = ({ title, sub = "", meta = "", actions = "", size = "xl", block = "3" }) => `
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" data-wf-block="${block}">
      <div class="min-w-0 flex-1">
        <h1 class="${size === "lg" ? "text-lg" : "text-xl"} font-semibold text-balance text-foreground">${title}</h1>
        ${meta ? `<div class="mt-2 flex flex-col items-start gap-2 text-sm text-muted sm:flex-row sm:items-center sm:gap-3">${meta}</div>` : ""}
        ${sub ? `<p class="mt-2 max-w-[55ch] text-sm/6 text-pretty text-muted">${sub}</p>` : ""}
      </div>
      ${actions ? `<div class="flex shrink-0 flex-wrap gap-2">${actions}</div>` : ""}
    </header>`;
  const sectionTitle = (t, extra = "") => `<div class="mb-3 flex items-center justify-between gap-3"><h2 class="text-lg font-semibold text-foreground">${t}</h2>${extra}</div>`;
  const outlineIconMenu = (items, label = "Thêm thao tác") => dropdown(
    `<button type="button" aria-label="${label}" title="${label}" class="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border-strong bg-surface text-muted outline-hidden transition-colors hover:bg-button-hover hover:text-foreground">${I("ellipsis")}</button>`,
    items,
  );
  const tableWrap = (inner, block = "4") => `<div class="min-w-0" data-wf-block="${block}"><div class="overflow-hidden rounded-2xl border border-border bg-surface">${inner}</div></div>`;
  const th = (label, cls = "") => `<th scope="col" class="${cx("px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted", cls)}">${label}</th>`;
  const checkCell = (label, attrs = "", tag = "td") => `<${tag} class="w-px p-0"><label class="flex min-h-11 w-11 cursor-pointer items-center justify-center pl-1">${checkbox(false, { small: true, bare: true, label, attrs })}</label></${tag}>`;
  const rowMenu = (groups) => dropdown(menuBtn("Thao tác", { row: true }), menuGroups(...groups));

  // ================================================================== TỔNG QUAN
  const liveCard = (e, { compact = false } = {}) => {
    const pct = Math.round((e.checkedIn / e.registered) * 100);
    return `<article class="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">${evtBadge("live")}<span class="text-xs text-muted">${e.manual ? "Cổng check-in mở thủ công" : "Cổng check-in đóng lúc 08:30"}</span></div>
      <h3 class="mt-3 text-base font-semibold text-pretty text-foreground"><a href="${href("chi-tiet-su-kien")}" class="outline-hidden hover:underline">${e.name}</a></h3>
      ${compact ? "" : `<p class="mt-1 text-sm text-pretty text-muted">${e.time} · ${e.location}</p>`}
      <div class="mt-4">
        <div class="flex items-baseline justify-between gap-3"><p class="text-sm font-medium tabular-nums text-foreground">${e.checkedIn} / ${e.registered} đã check-in</p><p class="text-sm tabular-nums text-muted">${pct}%</p></div>
        <div class="mt-2 h-2 rounded-full bg-foreground/5" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Đã check-in"><div class="h-2 rounded-full bg-primary" style="width:${pct}%"></div></div>
        <p class="mt-2 text-xs text-muted"><span class="font-medium text-warning">${e.notYet} người chưa check-in</span>${e.manual ? "" : " · cổng còn mở 10 phút"}</p>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">${btn("Mở màn QR", { v: "primary", icon: "qr-code" })}${btn("Xem điểm danh", { icon: "list-checks" })}</div>
    </article>`;
  };
  const eventRow = (e, { right = "", link = true, hideMeta = false } = {}) => `
    <li><a href="${link ? href("chi-tiet-su-kien") : "#"}" class="group flex items-center gap-3 rounded-xl px-3 py-2.5 outline-hidden hover:bg-item-hover">
      ${dateTile(e)}
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-foreground" title="${esc(e.name)}">${e.name}</p>
        ${hideMeta ? "" : `<p class="mt-1 truncate text-xs text-muted">${e.status === "manual" ? "Chưa đặt lịch" : e.time} · ${e.location}</p>`}
      </div>
      ${right}
    </a></li>`;
  const regCount = (e) => `<span class="hidden shrink-0 text-sm tabular-nums text-muted sm:inline">${e.registered ? `${fmt(e.registered)} đăng ký` : "Chưa có ai đăng ký"}</span>`;
  const systemStats = (block) => `<div data-wf-block="${block}"><p class="mb-2 text-xs text-muted">Toàn hệ thống</p>${stats([
    { label: "Người dùng", value: "2.418" }, { label: "Sinh viên", value: "2.305" },
    { label: "Sự kiện đang mở", value: "18" }, { label: "Lượt điểm danh", value: "12.940" },
  ], { cols: "grid-cols-2", small: true })}</div>`;

  WF.screen({
    id: "tong-quan", group: "Ban tổ chức · Admin", label: "Tổng quan", options: ["a", "b"], rec: "a",
    reasons: {
      a: {
        name: "Đang diễn ra trước", why: "BTC mở trang để lo sự kiện đang chạy, nên sự kiện đang diễn ra, tiến độ check-in và nút Mở màn QR đứng đầu.",
        pros: ["Vào là thấy sự kiện đang chạy, bao nhiêu người chưa tới, và nút Mở màn QR", "Số liệu toàn hệ thống lùi sang cột phải, không tranh với việc chính", "Sắp diễn ra gom một khung, liếc ngày, giờ, số đăng ký"],
        cons: ["Thanh tiến độ cần số đã check-in của từng sự kiện: dữ liệu có ở /events/:id/live, logic gọi do bạn nối", "Ngày không có sự kiện đang chạy thì khối đầu chỉ còn một dòng"],
        fit: "BTC dùng app nhiều nhất trong ngày diễn ra sự kiện.",
        tips: ["Bỏ khối số liệu toàn hệ thống", "Đưa sự kiện đã kết thúc sang cột trái", "Thoáng hơn giữa các khối"],
      },
      b: {
        name: "Lịch theo ngày", why: "Mọi sự kiện sắp tới xếp theo ngày như một cuốn lịch; sự kiện đang chạy là một dòng có nút QR.",
        pros: ["Thấy cả tuần tới trong một cột, không phải mở trang Sự kiện", "Không cần thêm dữ liệu: chỉ dùng danh sách sự kiện và số liệu đang có"],
        cons: ["Sự kiện đang chạy chỉ là một dòng, không thấy tiến độ check-in", "Hàng số liệu nằm trên cùng, đẩy lịch xuống dưới"],
        fit: "BTC lo nhiều sự kiện mỗi tuần, cần nhìn lịch hơn là theo dõi một sự kiện.",
        tips: ["Thêm tiến độ check-in vào dòng đang diễn ra", "Bỏ hàng số liệu", "Gộp ngày trống"],
      },
    },
    render(v, tt) {
      const live = D.events.filter((e) => e.status === "live");
      const upcoming = D.events.filter((e) => ["upcoming", "manual"].includes(e.status));
      const ended = D.events.filter((e) => e.status === "ended");
      const create = tt === "rong" ? "" : btn("Tạo sự kiện", { v: "primary", icon: "plus", size: "hdr" });
      let content;
      if (tt === "loi") content = `<div class="rounded-2xl border border-border bg-surface">${loadError("Không tải được tổng quan")}</div>`;
      else if (tt === "rong") content = `<section class="max-w-xl rounded-2xl border border-border bg-surface p-5" data-wf-block="3">
          <h2 class="text-base font-semibold text-foreground">Tạo sự kiện đầu tiên</h2>
          <p class="mt-2 text-sm/6 text-pretty text-muted">Sự kiện có mã QR đổi mỗi 30 giây, sinh viên quét bằng camera điện thoại để điểm danh. Tạo xong là chiếu được ngay.</p>
          <div class="mt-4">${btn("Tạo sự kiện", { v: "primary", icon: "plus" })}</div>
        </section>`;
      else if (v === "a") {
        const liveBlock = tt === "dang-tai"
          ? `<div class="rounded-2xl border border-border bg-surface p-5 space-y-3">${skel("w-24", "h-5")}${skel("w-3/5", "h-4")}${skel("w-2/5")}${skel("w-full", "h-2")}</div>`
          : `<div class="grid gap-3">${live.map((e) => liveCard(e)).join("")}</div>`;
        content = `<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div class="flex min-w-0 flex-col gap-6">
            <section data-wf-block="3">${sectionTitle("Đang diễn ra")}${liveBlock}</section>
            ${card(tt === "dang-tai" ? skelRows(4) : `<ul class="flex flex-col gap-0.5">${upcoming.map((e) => eventRow(e, { right: regCount(e) })).join("")}</ul>`, { title: "Sắp diễn ra", action: viewAll(), flush: true, block: "4" })}
          </div>
          <div class="flex min-w-0 flex-col gap-6">
            ${systemStats("5")}
            ${card(`<ul class="flex flex-col gap-0.5">${ended.map((e) => `<li><a href="${href("chi-tiet-su-kien")}" class="flex flex-col gap-1 rounded-xl px-3 py-2.5 outline-hidden hover:bg-item-hover"><span class="truncate text-sm font-medium text-foreground">${e.name}</span><span class="text-xs tabular-nums text-muted">${e.date} · ${e.checkedOut} / ${e.registered} đã check-out</span></a></li>`).join("")}</ul>`, { title: "Đã kết thúc gần đây", action: viewAll(), flush: true, block: "6" })}
          </div>
        </div>`;
      } else {
        const day = (label, list) => `<li class="px-3 pt-4 pb-1 text-xs font-medium tracking-wide text-muted uppercase first:pt-1">${label}</li>${list.map((e) => `
          <li><a href="${href("chi-tiet-su-kien")}" class="flex items-center gap-4 rounded-xl px-3 py-2.5 outline-hidden hover:bg-item-hover">
            <div class="w-14 shrink-0 text-sm tabular-nums"><p class="font-medium text-foreground">${e.status === "manual" ? "—" : e.manual ? "Thủ công" : e.time.split(" – ")[0]}</p>${e.manual || e.status === "manual" ? "" : `<p class="text-xs text-muted">${e.time.split(" – ")[1]}</p>`}</div>
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-foreground" title="${esc(e.name)}">${e.name}</p><p class="mt-1 truncate text-xs text-muted">${e.location}</p></div>
            ${e.status === "live" ? `<span class="hidden sm:inline-flex">${evtBadge("live")}</span>${iconBtn("qr-code", "Mở màn QR", { row: true })}` : regCount(e)}
          </a></li>`).join("")}`;
        content = `<div class="flex flex-col gap-6">
          ${stats([{ label: "Người dùng", value: "2.418" }, { label: "Sinh viên", value: "2.305" }, { label: "Sự kiện đang mở", value: "18" }, { label: "Lượt điểm danh", value: "12.940" }], { block: "3" })}
          ${card(tt === "dang-tai" ? skelRows(6, { avatar: false }) : `<ul class="flex flex-col gap-0.5">${day("Hôm nay · Thứ Sáu 02/10", D.events.filter((e) => e.date === "02/10"))}${day("Thứ Tư 07/10", [ev("e4")])}${day("Thứ Bảy 10/10", [ev("e5")])}${day("Chưa đặt lịch", [ev("e6")])}</ul>`, { title: "Lịch sự kiện", action: viewAll("Xem tất cả sự kiện"), flush: true, block: "4" })}
        </div>`;
      }
      return WF.shell({ role: "ADMIN", active: "tong-quan", title: "Tổng quan", headerRight: create, content });
    },
  });

  // ================================================================== SỰ KIỆN (DANH SÁCH)
  const eventMenu = (e) => rowMenu([
    [menuItem("link", "Sao chép link đăng ký"), menuItem("pencil", "Sửa sự kiện")],
    [menuItem("trash-2", "Xoá sự kiện", { danger: true })],
  ]);
  WF.screen({
    id: "su-kien", group: "Ban tổ chức · Admin", label: "Sự kiện", options: ["a", "b"], rec: "a",
    reasons: {
      a: {
        name: "Bảng có tab trạng thái", why: "BTC tìm sự kiện để vận hành hay xem báo cáo, nên mỗi sự kiện là một dòng để dò theo ngày, trạng thái, số đăng ký.",
        pros: ["12 sự kiện liếc hết trong một màn, thay cho lưới thẻ hai cột", "Tab lọc Đang diễn ra, Sắp diễn ra, Đã kết thúc", "Nút QR ngay trên dòng; sửa, sao chép link, xoá gom vào ⋯"],
        cons: ["Tab trạng thái cần API nhận tham số lọc theo trạng thái (logic do bạn nối)", "Danh sách không có số đã check-in, chỉ có số đăng ký"],
        fit: "Mỗi BTC có từ vài chục sự kiện trở lên.",
        tips: ["Thêm cột người tạo", "Bỏ tab, chỉ giữ ô tìm", "Dòng thoáng hơn"],
      },
      b: {
        name: "Danh sách nhóm theo trạng thái", why: "Không cần đổi API: sự kiện trên trang đang xem được gom thành Đang diễn ra, Sắp diễn ra, Đã kết thúc.",
        pros: ["Sự kiện đang chạy luôn ở nhóm đầu, có nút Mở màn QR", "Không thêm logic lọc ở máy chủ"],
        cons: ["Nhóm chỉ gom trong 12 sự kiện của trang đang xem; trang 2 lại có nhóm riêng", "Không lọc được riêng một trạng thái"],
        fit: "Mỗi BTC chỉ có vài sự kiện đang mở cùng lúc.",
        tips: ["Thêm số đăng ký vào dòng đang diễn ra", "Gộp Chưa đặt lịch vào Sắp diễn ra", "Bỏ ô ngày bên trái"],
      },
    },
    render(v, tt) {
      const list = D.events;
      const header = btn("Tạo sự kiện", { v: "primary", icon: "plus", size: "hdr" });
      const body = (inner) => WF.shell({ role: "ADMIN", active: "su-kien", title: "Sự kiện", headerRight: header, content: inner });
      if (v === "a") {
        const toolbar = `<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-wf-block="3">
          ${tabs("boxed", [{ label: "Tất cả" }, { label: "Đang diễn ra" }, { label: "Sắp diễn ra" }, { label: "Đã kết thúc" }], "Tất cả", { group: "evtab" })}
          ${search({ placeholder: "Tìm sự kiện theo tên", cls: "w-full sm:w-72", value: tt === "rong" ? "hackathon 2025" : "" })}
        </div>`;
        let table;
        if (tt === "dang-tai") table = tableWrap(skelRows(8, { avatar: false }));
        else if (tt === "loi") table = tableWrap(loadError("Không tải được danh sách sự kiện"));
        else if (tt === "rong") table = tableWrap(`<p class="py-10 text-center text-sm text-muted">Không có sự kiện nào khớp <span class="text-foreground">"hackathon 2025"</span>. Thử từ khoá khác. <a href="#" class="font-medium text-foreground underline-offset-4 hover:underline">Xoá tìm kiếm</a></p>`);
        else table = tableWrap(`
          <table class="hidden w-full text-sm sm:table">
            <thead class="border-b border-border"><tr>${th("Sự kiện", "w-full")}${th("Thời gian")}${th("Trạng thái")}${th("Đăng ký", "text-right")}<th class="w-px px-2"><span class="sr-only">Thao tác</span></th></tr></thead>
            <tbody>${list.map((e) => `<tr class="border-b border-border last:border-0 hover:bg-surface-hover">
              <td class="max-w-0 px-4 py-3"><a href="${href("chi-tiet-su-kien")}" title="${esc(e.name)}" class="block truncate font-medium text-foreground outline-hidden hover:underline">${e.name}</a><p class="mt-0.5 truncate text-xs text-muted">${e.location}</p></td>
              <td class="px-4 py-3 whitespace-nowrap tabular-nums">${e.date ? `<p class="text-foreground">${e.date}</p><p class="mt-0.5 text-xs text-muted">${e.time}</p>` : `<p class="text-muted">—</p>`}</td>
              <td class="px-4 py-3">${evtBadge(e.status)}</td>
              <td class="px-4 py-3 text-right tabular-nums text-foreground">${fmt(e.registered)}</td>
              <td class="px-2 py-3"><div class="flex justify-end gap-1">${iconBtn("qr-code", "Mở màn QR", { row: true })}${eventMenu(e)}</div></td>
            </tr>`).join("")}</tbody>
          </table>
          <ul class="divide-y divide-border sm:hidden">${list.map((e) => `<li class="relative flex items-start gap-3 px-4 py-3 hover:bg-surface-hover">
            <div class="min-w-0 flex-1"><a href="${href("chi-tiet-su-kien")}" class="line-clamp-2 text-sm font-medium text-pretty text-foreground outline-hidden before:absolute before:inset-0">${e.name}</a>
              <p class="mt-1 text-xs tabular-nums text-muted">${e.date ? `${e.date} · ${e.time}` : "Chưa đặt lịch"}</p>
              <div class="mt-2 flex items-center justify-between gap-3">${evtBadge(e.status)}<span class="text-sm tabular-nums text-muted">${fmt(e.registered)} đăng ký</span></div></div>
            <div class="relative">${eventMenu(e)}</div></li>`).join("")}</ul>
          ${pagination({ from: 1, to: 8, total: 48, noun: "sự kiện", page: 1, pages: 4 })}`);
        return body(toolbar + table);
      }
      const group = (label, items, live = false) => `<li class="px-3 pt-4 pb-1 text-xs font-medium tracking-wide text-muted uppercase first:pt-1">${label} <span class="tabular-nums">${items.length}</span></li>${items.map((e) => eventRow(e, {
        right: live ? `<span class="shrink-0">${btn("Mở màn QR", { icon: "qr-code", size: "sm" })}</span>` : `${regCount(e)}${I("chevron-right", "size-4 shrink-0 text-muted")}`,
      })).join("")}`;
      const listHtml = tt === "dang-tai" ? skelRows(8) : tt === "loi" ? loadError("Không tải được danh sách sự kiện") : tt === "rong" ? empty("Chưa có sự kiện nào. Bấm Tạo sự kiện để bắt đầu.") :
        `<ul class="flex flex-col gap-0.5">${group("Đang diễn ra", list.filter((e) => e.status === "live"), true)}${group("Sắp diễn ra", list.filter((e) => e.status === "upcoming"))}${group("Chưa đặt lịch", list.filter((e) => e.status === "manual"))}${group("Đã kết thúc", list.filter((e) => e.status === "ended"))}</ul>`;
      return body(`<div class="mb-4" data-wf-block="3">${search({ placeholder: "Tìm sự kiện theo tên", cls: "w-full sm:w-72" })}</div>
        <section class="rounded-2xl border border-border bg-surface py-2" data-wf-block="4"><div class="px-2">${listHtml}</div>${tt === "du-lieu" ? `<div class="mt-2">${pagination({ from: 1, to: 8, total: 48, noun: "sự kiện", page: 1, pages: 4 })}</div>` : ""}</section>`);
    },
  });

  // ================================================================== CHI TIẾT SỰ KIỆN
  const e1 = ev("e1");
  const gateRow = (label, g, value) => `
    <div class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2"><p class="text-sm font-medium text-foreground">${label}</p>${g.open ? badge("success", "Đang mở") : badge("neutral", "Đang đóng", { icon: "lock" })}</div>
        <p class="mt-1 text-sm text-muted">${g.window ? `${g.window} · ${g.open ? "tự đóng lúc 08:30" : "tự mở lúc 11:00"}` : "Không đặt lịch, BTC tự mở và đóng"}</p>
      </div>
      ${tabs("segmented", [{ label: "Theo lịch", value: "AUTO", grow: true }, { label: "Mở", value: "OPEN", grow: true }, { label: "Đóng", value: "CLOSED", grow: true }], value, { group: `gate-${label}`, layout: "fullMobile" })}
    </div>`;
  const gateCard = (block = "4") => card(`<div class="divide-y divide-border">${gateRow("Check-in", e1.gateIn, "AUTO")}${gateRow("Check-out", e1.gateOut, "AUTO")}</div>`, { title: "Cổng điểm danh", block });
  const eventStats = (block = "5", cols = "grid-cols-2 sm:grid-cols-4 xl:grid-cols-2", small = false) => stats([
    { label: "Đăng ký", value: "186" },
    { label: "Đã check-in", value: "124", sub: "67% số đăng ký" },
    { label: "Đã check-out", value: "0", sub: "Check-out mở lúc 11:00" },
    { label: "Chưa check-in", value: "62", sub: "Cổng vẫn đang mở", subTone: "warning" },
  ], { cols, block, small });
  const detailHead = (block = "3") => pageHead({
    title: e1.name, size: "lg", block,
    meta: `${evtBadge("live")}<span>${e1.dateLong} · ${e1.time}</span>`, sub: e1.location,
    actions: `${btn("Mở màn QR", { v: "primary", icon: "qr-code" })}${btn("Báo cáo", { icon: "file-text" })}${outlineIconMenu(menuGroups([menuItem("pencil", "Sửa sự kiện"), menuItem("link", "Sao chép link đăng ký"), menuItem("file-spreadsheet", "Tải file Excel"), menuItem("file-code-2", "Tải file HTML")]))}`,
  });
  const attToolbar = `<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">${search({ placeholder: "Tìm theo tên, MSSV", cls: "w-full sm:w-64" })}${selectBtn({ label: "Trạng thái:", value: "Tất cả", inline: true, options: ["Tất cả", "Đã đăng ký", "Đã check-in", "Đã check-out", "Vắng"] })}</div>
      <div class="grid grid-cols-2 gap-2 sm:flex lg:ml-auto">${btn("Check-in thủ công", { icon: "user-check", iconCls: "hidden size-4 shrink-0 sm:block" })}${btn("Danh sách tham gia", { icon: "users", iconCls: "hidden size-4 shrink-0 sm:block" })}</div>
    </div>`;
  const attTable = (tt, { block = "8", hideClass = false } = {}) => {
    if (tt === "dang-tai") return tableWrap(skelRows(8), block);
    if (tt === "rong") return tableWrap(`<p class="py-10 text-center text-sm text-muted">Chưa có ai trong danh sách tham gia.</p>`, block);
    return tableWrap(`
      <table class="hidden w-full text-sm sm:table">
        <thead class="border-b border-border"><tr>${th("Sinh viên", "w-full")}${hideClass ? "" : th("Lớp")}${th("Check-in")}${th("Check-out")}${th("Trạng thái")}</tr></thead>
        <tbody>${D.attendees.map(([n, m, c, i, o, s]) => `<tr class="border-b border-border last:border-0">
          <td class="max-w-0 px-4 py-3"><p class="truncate font-medium text-foreground" title="${esc(n)}">${n}</p><p class="mt-0.5 text-xs tabular-nums text-muted">${m}</p></td>
          ${hideClass ? "" : `<td class="px-4 py-3 whitespace-nowrap ${c ? "text-foreground" : "text-muted"}">${c || "—"}</td>`}
          <td class="px-4 py-3 whitespace-nowrap tabular-nums ${i ? "text-foreground" : "text-muted"}">${i || "—"}</td>
          <td class="px-4 py-3 whitespace-nowrap tabular-nums ${o ? "text-foreground" : "text-muted"}">${o || "—"}</td>
          <td class="px-4 py-3">${attBadge(s)}</td></tr>`).join("")}</tbody>
      </table>
      <ul class="divide-y divide-border sm:hidden">${D.attendees.map(([n, m, c, i, o, s]) => `<li class="px-4 py-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate text-sm font-medium text-foreground">${n}</p><p class="mt-0.5 text-xs tabular-nums text-muted">${m}${c ? ` · ${c}` : ""}</p></div>${attBadge(s)}</div>${i ? `<p class="mt-1 text-xs tabular-nums text-muted">Vào ${i}</p>` : ""}</li>`).join("")}</ul>
      <div class="flex items-center justify-between gap-4 border-t border-border px-4 py-3"><p class="text-sm tabular-nums text-muted"><span class="hidden sm:inline">1 tới 10 trong </span>186 người<span class="hidden sm:inline"> · tự cập nhật mỗi 15 giây</span></p>
        <nav aria-label="Phân trang" class="flex items-center gap-1">${iconBtn("chevron-left", "Trang trước", { size: "size-9", attrs: "disabled", cls: "disabled:opacity-40" })}<span class="px-1 text-sm whitespace-nowrap tabular-nums text-foreground">1 / 19</span>${iconBtn("chevron-right", "Trang sau", { size: "size-9" })}</nav></div>`, block);
  };
  const reminderPanel = (compact = false) => card(`
      <div class="flex flex-col gap-1">
        <p class="text-sm text-foreground"><span class="font-medium tabular-nums">62 người</span> đã đăng ký mà chưa check-in sẽ nhận email nhắc.</p>
        <p class="text-xs text-muted">Gửi xong phải chờ 30 phút mới gửi lại được.</p>
      </div>
      ${compact ? "" : `<h3 class="mt-6 mb-2 text-sm font-semibold text-foreground">Nhật ký gửi</h3>
      <ul class="divide-y divide-border">${D.reminders.map((r) => `<li class="flex items-start gap-3 py-3">
        ${avatar(r.by)}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1"><p class="text-sm font-medium text-foreground">${r.by}</p><p class="text-xs tabular-nums text-muted">${r.at}</p></div>
          <p class="mt-0.5 text-sm text-muted"><span class="tabular-nums">${r.ok} / ${r.total}</span> email gửi thành công</p>
          ${r.note ? `<p class="mt-1 text-sm text-pretty text-foreground/80">“${r.note}”</p>` : ""}
        </div>${badge("success", "Đã gửi")}</li>`).join("")}</ul>`}`,
    { title: "Nhắc lịch qua email", action: btn("Gửi nhắc ngay", { icon: "send" }), block: compact ? "" : "9" });
  const feedbackPanel = (compact = false) => card(`
      <div class="flex flex-wrap items-center gap-2">${badge("neutral", "Đang đóng", { icon: "lock" })}${badge("neutral", "Ẩn danh", { icon: "eye-off" })}</div>
      <p class="mt-3 text-sm font-medium text-pretty text-foreground">Đánh giá sự kiện: Hội thảo Trí tuệ nhân tạo trong giáo dục 2026</p>
      <p class="mt-1 text-sm text-pretty text-muted">5 câu hỏi · từ mẫu “Đánh giá hội thảo chuyên đề” · chưa có ai check-out để trả lời</p>
      ${compact ? `<div class="mt-4 flex flex-wrap gap-2">${btn("Mở form", { icon: "play" })}${btn("Xem kết quả", { icon: "chart-column" })}</div>` : `
      <div class="mt-4 flex flex-wrap gap-2">${btn("Mở form", { icon: "play" })}${btn("Xem kết quả", { icon: "chart-column" })}${btn("Sao chép link đánh giá", { icon: "link" })}${outlineIconMenu(menuGroups([menuItem("pencil", "Sửa câu hỏi")], [menuItem("trash-2", "Gỡ form", { danger: true })]))}</div>
      <div class="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4"><div class="min-w-0"><p id="anon" class="text-sm font-medium text-foreground">Ẩn danh</p><p class="mt-1 text-sm text-muted text-pretty">BTC không thấy ai đã trả lời gì. Có người trả lời rồi thì không tắt được.</p></div>${WF.switch(true, { id: "anon" })}</div>`}`,
    { title: "Đánh giá sau sự kiện", sub: compact ? "" : "Chỉ người đã check-out mới gửi được đánh giá", block: compact ? "" : "9" });
  const certPreview = `<div class="aspect-[1.414] w-full overflow-hidden rounded-xl border border-border bg-[#fdfbf6] p-3 dark:bg-[#1b1a17]">
      <div class="flex h-full flex-col items-center justify-center rounded-lg border-2 border-[#c9a54a]/60 text-center">
        <p class="text-[10px] font-semibold tracking-[0.2em] text-[#8a6d1f] uppercase">Giấy chứng nhận tham gia</p>
        <p class="mt-3 font-serif text-xl text-[#2b2b2b] dark:text-[#f1e9d2]">Nguyễn Văn A</p>
        <p class="mt-2 max-w-[80%] text-[10px] text-[#555] dark:text-[#bdb5a0]">Hội thảo Trí tuệ nhân tạo trong giáo dục 2026</p>
        <p class="mt-3 text-[9px] text-[#666]">Ngày 02/10/2026 · Mã chứng nhận: CN-XXXX-XXXX</p>
      </div></div>`;
  const certPanel = (compact = false) => card(compact
    ? `<p class="text-sm text-muted">Đã có mẫu · đã cấp 0 · chưa ai check-out</p><div class="mt-4">${btn("Mở chứng nhận", { icon: "award" })}</div>`
    : `<div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_14rem]">
      ${certPreview}
      <div class="flex flex-col gap-2">
        ${btn("Chỉnh bố cục", { icon: "sliders-horizontal", cls: "justify-start" })}${btn("Đổi ảnh mẫu", { icon: "upload", cls: "justify-start" })}${btn("Tải PDF xem thử", { icon: "file-down", cls: "justify-start" })}
        <p class="mt-2 text-xs text-muted text-pretty">Ảnh PNG, JPG tối đa 5 MB. Họ tên, tên sự kiện, ngày và mã được điền tự động.</p>
      </div></div>`,
    { title: "Chứng nhận tham gia", sub: compact ? "" : "Đã cấp 0 · chưa có ai check-out để cấp", action: compact ? "" : btn("Cấp chứng nhận", { icon: "send", attrs: "disabled" }), block: compact ? "" : "9" });

  WF.screen({
    id: "chi-tiet-su-kien", group: "Ban tổ chức · Admin", label: "Chi tiết sự kiện", options: ["a", "b", "c"], rec: "a",
    states: { "du-lieu": "Có dữ liệu", "dang-tai": "Đang tải", rong: "Chưa ai đăng ký", loi: "Không tìm thấy" },
    reasons: {
      a: {
        name: "Điều khiển trên, tab dưới", why: "Lúc sự kiện chạy, BTC cần chiếu QR, mở đóng cổng và biết ai chưa tới, nên ba thứ đó đứng trên cùng; việc sau sự kiện vào tab.",
        pros: ["Một nút chính Mở màn QR; 8 nút ngang hàng cũ gom thành Báo cáo và menu ⋯", "Cổng có 3 nấc Theo lịch, Mở, Đóng: thấy ngay đang theo lịch hay đang mở tay", "Nhắc lịch, Đánh giá, Chứng nhận thành tab, trang ngắn lại một nửa"],
        cons: ["Nấc Theo lịch là gửi 'AUTO' qua đúng hàm đổi cổng đang có (logic do bạn nối)", "Phải bấm tab mới thấy đánh giá và chứng nhận"],
        fit: "Mỗi sự kiện có một người BTC trực, theo dõi từ lúc mở cổng tới lúc cấp chứng nhận.",
        tips: ["Đưa số liệu lên trên cổng điểm danh", "Thêm cột Thiết bị vào bảng", "Thoáng hơn giữa các khối"],
      },
      b: {
        name: "Bảng giữa, thẻ bên phải", why: "Bảng điểm danh là nhân vật chính; cổng, số liệu và các việc phụ xếp thành cột phải, không phải bấm tab.",
        pros: ["Màn rộng thấy mọi thứ cùng lúc", "Bảng dài cuộn, cột phải vẫn đứng cạnh"],
        cons: ["Cột phải chỉ mở từ màn 1440px; ở 1280px các thẻ dồn lên trên bảng", "Bảng hẹp hơn nên ẩn cột Lớp"],
        fit: "BTC trực sự kiện trên màn lớn, mở trang suốt buổi.",
        tips: ["Thu gọn cột phải còn cổng và số liệu", "Đưa nhắc lịch lên đầu cột phải", "Bảng thêm cột Lớp"],
      },
      c: {
        name: "Tab theo giai đoạn", why: "Chia trang theo ba lúc BTC dùng: Chuẩn bị, Điểm danh, Sau sự kiện.",
        pros: ["Mỗi giai đoạn chỉ hiện việc của giai đoạn đó", "BTC mới làm lần đầu đi theo thứ tự dễ hiểu"],
        cons: ["Danh sách tham gia và nhắc lịch nằm ở tab khác bảng điểm danh", "Tự chọn tab theo giờ (trước, trong, sau sự kiện) cần logic do bạn nối"],
        fit: "Nhiều BTC luân phiên, mỗi người lo một giai đoạn.",
        tips: ["Gộp Chuẩn bị vào Điểm danh", "Đổi tên tab", "Bỏ tab Sau sự kiện, đưa báo cáo lên đầu trang"],
      },
    },
    render(v, tt) {
      const shell = (content) => WF.shell({ role: "ADMIN", active: "su-kien", parent: { label: "Sự kiện", man: "su-kien" }, content });
      if (tt === "loi") return shell(`<div class="mx-auto max-w-md pt-16 pb-16 text-center sm:pt-24" data-wf-block="3">
          <p class="text-sm font-medium tabular-nums text-muted">404</p>
          <h1 class="mt-1 text-xl font-semibold text-foreground">Không tìm thấy sự kiện</h1>
          <p class="mt-2 text-sm/6 text-pretty text-muted">Sự kiện có thể đã bị xoá, hoặc đường dẫn bị gõ sai.</p>
          <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">${btn("Về danh sách sự kiện", { v: "primary", size: "form" })}</div></div>`);
      const emptyEvent = tt === "rong";
      const head = emptyEvent ? pageHead({
        title: "Giao lưu CLB Guitar", size: "lg",
        meta: `${evtBadge("upcoming")}<span>Thứ Bảy 10/10/2026 · 18:30 – 20:30</span>`, sub: "Sảnh tầng trệt, toà Alpha",
        actions: `${btn("Mở màn QR", { v: "primary", icon: "qr-code" })}${btn("Báo cáo", { icon: "file-text" })}${outlineIconMenu(menuGroups([menuItem("pencil", "Sửa sự kiện")]))}`,
      }) : detailHead();
      const statsBlock = tt === "dang-tai"
        ? `<div class="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4 xl:grid-cols-2" data-wf-block="5">${Array.from({ length: 4 }, () => `<div class="bg-surface p-5 space-y-3">${skel("w-16")}${skel("w-12", "h-6")}</div>`).join("")}</div>`
        : emptyEvent ? "" : eventStats();
      const tabRow = (items, active, group, block = "6") => `<div class="mt-6 mb-4" data-wf-block="${block}">${tabs("underline", items, active, { group })}</div>`;
      const attendance = `<div data-tabpanel="evd:diem-danh">${attToolbar.replace('class="mb-4', 'data-wf-block="7" class="mb-4')}${attTable(tt)}</div>`;
      if (v === "a") {
        return shell(`${head}
          <div class="grid gap-4 xl:grid-cols-2">${gateCard()}${statsBlock}</div>
          ${tabRow([{ label: "Điểm danh", value: "diem-danh", count: emptyEvent ? 0 : 186 }, { label: "Nhắc lịch", value: "nhac-lich" }, { label: "Đánh giá", value: "danh-gia" }, { label: "Chứng nhận", value: "chung-nhan" }], "diem-danh", "evd")}
          ${attendance}
          <div data-tabpanel="evd:nhac-lich" hidden>${reminderPanel()}</div>
          <div data-tabpanel="evd:danh-gia" hidden>${feedbackPanel()}</div>
          <div data-tabpanel="evd:chung-nhan" hidden>${certPanel()}</div>`);
      }
      if (v === "b") {
        return shell(`${head}
          <div class="grid gap-6 min-[88rem]:grid-cols-[minmax(0,1fr)_22rem]">
            <div class="order-2 min-w-0 min-[88rem]:order-1">${attToolbar.replace('class="mb-4', 'data-wf-block="7" class="mb-4')}${attTable(tt, { hideClass: true })}</div>
            <div class="order-1 flex min-w-0 flex-col gap-4 min-[88rem]:order-2">
              <div class="grid items-start gap-4 md:grid-cols-2 min-[88rem]:grid-cols-1">
                ${card(`<div class="divide-y divide-border">${gateRow("Check-in", e1.gateIn, "AUTO").replaceAll("sm:flex-row sm:items-center sm:justify-between", "")}${gateRow("Check-out", e1.gateOut, "AUTO").replaceAll("sm:flex-row sm:items-center sm:justify-between", "")}</div>`, { title: "Cổng điểm danh", block: "4" })}
                ${emptyEvent ? "" : eventStats("5", "grid-cols-2", true)}
              </div>
              <div class="grid items-start gap-4 md:grid-cols-3 min-[88rem]:grid-cols-1">${reminderPanel(true)}${feedbackPanel(true)}${certPanel(true)}</div>
            </div>
          </div>`);
      }
      // C: tab theo giai đoạn
      const prep = `<div data-tabpanel="phase:chuan-bi" hidden class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          ${card(`<ul class="divide-y divide-border">${D.attendees.slice(0, 5).map(([n, m, c]) => `<li class="flex items-center gap-3 py-3 first:pt-0">${avatar(n)}<div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-foreground">${n}</p><p class="text-xs tabular-nums text-muted">${m}${c ? ` · ${c}` : ""}</p></div>${iconBtn("x", "Bỏ khỏi danh sách")}</li>`).join("")}</ul><div class="mt-3">${viewAll("Xem đủ 186 người")}</div>`,
            { title: "Danh sách tham gia", action: `${btn("Thêm cả lớp", { icon: "graduation-cap" })}${btn("Thêm", { icon: "user-plus" })}`, block: "7" })}
          <div class="flex flex-col gap-4">
            ${card(`<div class="flex gap-2"><input readonly value="event.fpt.edu.vn/dang-ky/e1" class="${WF.INPUT} font-mono text-sm" aria-label="Link đăng ký" />${btn("Sao chép", { icon: "copy" })}</div><p class="mt-2 text-xs text-muted">Ai có link đều tự đăng ký được.</p>`, { title: "Link đăng ký" })}
            ${reminderPanel(true)}
          </div></div>`;
      const live = `<div data-tabpanel="phase:diem-danh"><div class="grid gap-4 xl:grid-cols-2">${gateCard()}${statsBlock}</div><div class="mt-6">${attToolbar.replace('class="mb-4', 'data-wf-block="7" class="mb-4')}${attTable(tt)}</div></div>`;
      const after = `<div data-tabpanel="phase:sau" hidden class="grid gap-4 xl:grid-cols-2">
          ${card(`<p class="text-sm text-muted text-pretty">Báo cáo luôn là số liệu mới nhất. Link chia sẻ xem được không cần đăng nhập.</p><div class="mt-4 flex flex-wrap gap-2">${btn("Xem báo cáo", { icon: "file-text" })}${btn("Tải Excel", { icon: "file-spreadsheet" })}${btn("Chia sẻ link", { icon: "share-2" })}</div>`, { title: "Báo cáo điểm danh" })}
          ${feedbackPanel(true)}${certPanel(true)}</div>`;
      return shell(`${head}${tabRow([{ label: "Chuẩn bị", value: "chuan-bi" }, { label: "Điểm danh", value: "diem-danh" }, { label: "Sau sự kiện", value: "sau" }], "diem-danh", "phase", "4")}${prep}${live}${after}`);
    },
  });

  // ================================================================== TẠO SỰ KIỆN
  const dtBtn = (value) => `<button type="button" class="group flex h-11 w-full md:h-10 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border-strong bg-surface dark:bg-white/4 px-4 text-left text-base tabular-nums md:text-sm outline-hidden focus-visible:border-focus aria-expanded:border-focus aria-expanded:ring-2 aria-expanded:ring-focus"><span class="${value ? "text-foreground" : "text-muted"}">${value || "Chọn ngày giờ"}</span>${I("calendar-clock", "size-4 shrink-0 text-muted")}</button>`;
  const settingRow = (id, title, desc, on) => `<div class="flex items-start justify-between gap-4"><div class="min-w-0"><p id="${id}" class="text-sm font-medium text-foreground">${title}</p><p class="mt-1 text-sm text-pretty text-muted">${desc}</p></div><div class="pt-0.5">${WF.switch(on, { id })}</div></div>`;
  WF.screen({
    id: "tao-su-kien", group: "Ban tổ chức · Admin", label: "Tạo, sửa sự kiện", short: "Tạo sự kiện", options: ["a"], rec: "a",
    states: { "du-lieu": "Đang điền", "dang-tai": "Đang tạo", loi: "Có lỗi" },
    reasons: { a: {
      name: "Form chia mục", why: "Form 12 trường chia 4 mục có tiêu đề (từ 8 trường thì chia mục), mỗi mục một câu nói vì sao cần; sửa sự kiện dùng đúng form này trong modal.",
      pros: ["Thời gian và GPS có công tắc: tắt là ẩn hẳn các ô không cần", "Ô ngày giờ dựng riêng, không còn lịch của hệ điều hành", "Tạo và sửa cùng một form, không lệch nhau"],
      cons: ["Công tắc Đặt lịch tự động thay cho luật 'điền đủ 4 mốc hoặc để trống': tắt là xoá 4 mốc, cùng cách modal tạo buổi học đang làm", "Ô ngày giờ là component mới phải dựng"],
      fit: "Mọi lần tạo hay sửa sự kiện.", tips: ["Gộp Người tham dự vào mục đầu", "Bản đồ chọn vị trí", "Form hai cột ở màn rộng"],
    } },
    render(v, tt) {
      const err = tt === "loi";
      const content = `${pageHead({ title: "Tạo sự kiện mới", sub: "Sau khi tạo, bạn được đưa thẳng tới trang sự kiện để mở màn QR." })}
        <form class="flex max-w-3xl flex-col gap-4">
          ${err ? `<div role="alert" class="flex gap-3 rounded-2xl border border-error-border bg-error-bg p-4">${I("circle-alert", "mt-0.5 size-5 shrink-0 text-error-text")}<div><p class="text-sm font-medium text-error-strong">Chưa tạo được sự kiện</p><p class="mt-0.5 text-sm text-pretty text-foreground/80">Mất kết nối tới máy chủ. Dữ liệu đã điền vẫn còn, bấm Tạo sự kiện để thử lại.</p></div></div>` : ""}
          ${card(`<div class="flex flex-col gap-5">
            ${field({ label: "Tên sự kiện", required: true, placeholder: "VD: Workshop AI 2026", value: err ? "" : "Hội thảo Trí tuệ nhân tạo trong giáo dục 2026", error: err ? "Chưa nhập tên sự kiện" : "" })}
            ${textarea({ label: "Mô tả", optional: true, rows: 3 })}
            ${field({ label: "Địa điểm", required: true, placeholder: "VD: Hội trường A1, FPT University", value: "Hội trường A1, FPT University HCM" })}
          </div>`, { title: "Thông tin cơ bản", block: "4" })}
          ${card(`${settingRow("lich", "Đặt lịch tự động", "Cổng điểm danh tự mở, tự đóng theo bốn mốc dưới. Tắt thì BTC tự mở, đóng ở trang sự kiện.", true)}
            <div class="mt-5 grid gap-5 sm:grid-cols-2">
              ${field({ label: "Check-in mở", control: dtBtn("02/10/2026 07:45") })}${field({ label: "Check-in đóng", control: dtBtn("02/10/2026 08:30") })}
              ${field({ label: "Check-out mở", control: dtBtn("02/10/2026 11:00") })}${field({ label: "Check-out đóng", control: dtBtn("") })}
            </div>`, { title: "Thời gian điểm danh", block: "5" })}
          ${card(`${settingRow("gps", "Bắt buộc ở gần địa điểm", "Sinh viên phải đứng trong bán kính cho phép mới check-in được.", true)}
            <div class="mt-5 flex flex-col gap-4">
              <div>${btn("Lấy vị trí hiện tại của tôi", { icon: "locate-fixed" })}</div>
              <div class="rounded-xl bg-background p-3 text-sm"><p class="text-pretty text-foreground">Đường D1, Khu Công nghệ cao, Thủ Đức, TP. Hồ Chí Minh</p><p class="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted">10.841326, 106.809883 <a href="#" class="relative font-sans font-medium text-foreground underline-offset-4 before:absolute before:-inset-x-1.5 before:-inset-y-2 hover:underline">Xem bản đồ</a></p></div>
              <div class="grid gap-5 sm:grid-cols-3">${field({ label: "Vĩ độ", value: "10.841326" })}${field({ label: "Kinh độ", value: "106.809883" })}${field({ label: "Bán kính (m)", value: "100", hint: "Tối thiểu 50 m. Trong nhà nên đặt 150–200 m." })}</div>
            </div>`, { title: "Xác thực vị trí (GPS)", block: "6" })}
          ${card(`<div class="flex flex-col gap-4">
              ${checkbox(true, { label: "Cho phép tự đăng ký tham gia", desc: "Sinh viên tự đăng ký qua link công khai." })}
              ${checkbox(false, { label: "Chỉ cho phép danh sách đã đăng ký", desc: "Bật thì chỉ người trong danh sách tham gia mới check-in được." })}
            </div>`, { title: "Người tham dự", block: "7" })}
          <div class="flex flex-col-reverse gap-2 border-t border-border-strong pt-5 sm:flex-row sm:justify-end" data-wf-block="8">${btn("Huỷ", { size: "form" })}${btn(tt === "dang-tai" ? `<span class="invisible">Tạo sự kiện</span>${I("loader-circle", "absolute inset-0 m-auto size-4 animate-spin")}` : "Tạo sự kiện", { v: "primary", size: "form", cls: "relative", attrs: tt === "dang-tai" ? 'aria-busy="true"' : "" })}</div>
        </form>`;
      return WF.shell({ role: "ADMIN", active: "su-kien", parent: { label: "Sự kiện", man: "su-kien" }, content });
    },
  });

  // ================================================================== MÀN CHIẾU QR
  const fakeQr = () => {
    const n = 29; let rects = "";
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#0D1B5E"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#0D1B5E"/>`;
    let seed = 7;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 100 < 47) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="#0D1B5E"/>`;
    }
    return `<svg viewBox="0 0 ${n} ${n}" class="size-full" shape-rendering="crispEdges" role="img" aria-label="Mã QR check-in">${rects}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
  };
  WF.screen({
    id: "chieu-qr", group: "Ban tổ chức · Admin", label: "Màn chiếu QR", options: ["a"], rec: "a",
    states: { "du-lieu": "Đang có người vào", rong: "Chưa ai check-in" },
    reasons: { a: {
      name: "QR trái, màn chào phải", why: "Màn trình diễn chiếu lên máy chiếu nên giữ nền gradient thương hiệu; mã QR là thứ to và rõ nhất, tên người vừa vào hiện bên phải.",
      pros: ["Giữ chất 'sự kiện' của màn chiếu, đúng chỗ được dùng gradient", "Thanh điều khiển mờ ở góc, rê chuột mới rõ", "Đổi CHECK-IN, CHECK-OUT bằng một nút hai nấc"],
      cons: ["Bố cục gần như bản cũ, chủ yếu làm gọn chữ và khoảng cách"],
      fit: "Chiếu ở cửa vào trên TV hoặc máy chiếu.", tips: ["QR to hơn", "Bỏ màn chào mừng", "Chữ tên sự kiện nhỏ lại"],
    } },
    render(v, tt) {
      const names = ["Lê Hoàng Phúc", "Nguyễn Thị Minh Anh", "Trần Quốc Bảo", "Huỳnh Gia Khánh", "Võ Đức Thịnh", "Ngô Văn Tài", "Tôn Nữ Thị Phương Thảo Nguyên", "Đỗ Thành Đạt", "Ngô Thị Bích Ngọc", "Phan Minh Quân", "Trương Gia Hân", "Lý Thanh Tâm"];
      const emoji = ["🎉", "🌟", "🚀", "🎈", "🦊", "🐼", "🌈", "⚡", "🎸", "🏆", "💎", "🍀"];
      const grads = ["#BE185D,#C2410C", "#047857,#0369A1", "#6D28D9,#BE185D", "#0369A1,#4338CA", "#B45309,#C2410C", "#0F766E,#1D4ED8"];
      const tool = (icon, label, on = false) => `<button type="button" aria-label="${label}" title="${label}" class="${cx("inline-flex size-10 cursor-pointer items-center justify-center rounded-xl outline-hidden transition-colors", on ? "bg-white/25 text-white" : "text-white hover:bg-white/15 hover:text-white")}">${I(icon, "size-[18px]")}</button>`;
      return `<div class="wf-stage relative min-h-screen overflow-hidden bg-[#14307A] bg-[linear-gradient(135deg,#0D1B5E_0%,#1A3A8F_50%,#0052D4_100%)] text-white">
        <div class="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-2xl bg-black/20 p-1 opacity-60 transition-opacity hover:opacity-100" data-wf-block="4">
          ${tool("columns-2", "QR và màn chào", true)}${tool("party-popper", "Chỉ màn chào")}${tool("qr-code", "Chỉ mã QR")}<span class="mx-1 h-5 w-px bg-white/20"></span>${tool("music", "Bật nhạc nền")}${tool("file-audio", "Chọn file nhạc")}<span class="mx-1 h-5 w-px bg-white/20"></span>${tool("maximize", "Toàn màn hình")}
        </div>
        <div class="relative grid min-h-screen gap-6 p-6 pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pt-6">
          <section class="flex flex-col items-center justify-center gap-6 text-center" data-wf-block="1">
            <div class="inline-flex gap-1 rounded-2xl bg-white/10 p-1">${["CHECK-IN", "CHECK-OUT"].map((t, i) => `<button type="button" class="${cx("inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl px-6 text-sm font-semibold outline-hidden", i === 0 ? "bg-white text-[#0D1B5E]" : "text-white hover:text-white")}">${I(i === 0 ? "log-in" : "log-out")}${t}</button>`).join("")}</div>
            <h1 class="max-w-xl text-2xl font-bold text-balance sm:text-3xl">${e1.name}</h1>
            <div class="rounded-3xl bg-white p-5 shadow-[0_20px_60px_rgb(0_0_0/0.35)]"><div class="size-[min(70vw,300px)]">${fakeQr()}</div>
              <p class="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1A6BFF] px-5 py-2 text-sm font-semibold text-white">${I("scan-line")}Quét để CHECK-IN</p></div>
            <div class="flex items-center gap-3"><svg width="44" height="44" viewBox="0 0 44 44" class="-rotate-90"><circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / .2)" stroke-width="4"/><circle cx="22" cy="22" r="18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="68 113"/></svg>
              <p class="text-left text-sm text-white">Mã tự đổi sau <span class="font-semibold tabular-nums text-white">18</span> giây<br/><span class="text-white">Dùng camera điện thoại hoặc Zalo để quét</span></p></div>
          </section>
          <section class="flex min-h-[60vh] flex-col rounded-3xl border border-white/15 bg-white/10 p-6" data-wf-block="2">
            <div class="flex items-end justify-between gap-4"><div><p class="flex items-center gap-2 text-sm font-medium text-white">${I("users")}Đã tham gia</p><p class="mt-1 text-5xl font-bold tabular-nums">${tt === "rong" ? 0 : 124}<span class="text-2xl font-semibold text-white/70"> / 186</span></p></div></div>
            <div class="mt-4 h-2 rounded-full bg-white/15"><div class="h-2 rounded-full bg-[linear-gradient(90deg,#FFD166,#FF6B9D,#B388FF,#4CC9F0)]" style="width:${tt === "rong" ? 0 : 67}%"></div></div>
            ${tt === "rong" ? `<div class="flex flex-1 flex-col items-center justify-center text-center"><p class="text-5xl">🎈</p><p class="mt-4 text-xl font-semibold">Chưa có ai check-in</p><p class="mt-1 text-white">Quét mã QR để xuất hiện trên màn hình này!</p></div>`
              : `<div class="mt-6 flex flex-wrap content-start gap-3">${names.map((n, i) => `<span class="wf-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-semibold text-white shadow-lg" style="background:linear-gradient(135deg,${grads[i % grads.length]})"><span aria-hidden="true">${emoji[i]}</span>${n}</span>`).join("")}</div>`}
          </section>
        </div></div>`;
    },
  });

  // ================================================================== LỚP HỌC
  WF.screen({
    id: "lop-hoc", group: "Ban tổ chức · Admin", label: "Lớp học", options: ["a"], rec: "a",
    reasons: { a: {
      name: "Bảng lớp", why: "BTC vào để mở một lớp rồi tạo buổi điểm danh, nên mỗi lớp là một dòng: tên, sĩ số, người tạo.",
      pros: ["Tên lớp là link vào chi tiết", "Sửa, xoá gom vào ⋯ thay cho hai icon luôn hiện"],
      cons: ["Không có số buổi điểm danh trên dòng: API danh sách lớp chưa trả số này"],
      fit: "Trường có vài chục lớp.", tips: ["Thêm cột số buổi điểm danh", "Dòng thoáng hơn", "Sắp xếp theo sĩ số"],
    } },
    render(v, tt) {
      const rows = D.classes;
      const tbl = tt === "dang-tai" ? tableWrap(skelRows(5, { avatar: false })) : tt === "loi" ? tableWrap(loadError("Không tải được danh sách lớp")) : tt === "rong"
        ? tableWrap(empty("Chưa có lớp nào. Tạo lớp để thêm cả lớp vào sự kiện hoặc tạo buổi điểm danh."))
        : tableWrap(`<table class="hidden w-full text-sm sm:table"><thead class="border-b border-border"><tr>${th("Lớp", "w-full")}${th("Thành viên", "text-right")}${th("Người tạo")}<th class="w-px px-2"><span class="sr-only">Thao tác</span></th></tr></thead>
          <tbody>${rows.map((c) => `<tr class="border-b border-border last:border-0 hover:bg-surface-hover">
            <td class="max-w-0 px-4 py-3"><a href="${href("chi-tiet-lop")}" class="block truncate font-medium text-foreground outline-hidden hover:underline">${c.name}</a><p class="mt-0.5 truncate text-xs ${c.desc ? "text-muted" : "text-muted"}" title="${esc(c.desc || "")}">${c.desc || "—"}</p></td>
            <td class="px-4 py-3 text-right tabular-nums text-foreground">${c.members}</td>
            <td class="px-4 py-3 whitespace-nowrap text-foreground">${c.by}</td>
            <td class="px-2 py-3">${rowMenu([[menuItem("pencil", "Sửa lớp")], [menuItem("trash-2", "Xoá lớp", { danger: true })]])}</td></tr>`).join("")}</tbody></table>
          <ul class="divide-y divide-border sm:hidden">${rows.map((c) => `<li class="flex items-start gap-3 px-4 py-3"><div class="min-w-0 flex-1"><a href="${href("chi-tiet-lop")}" class="text-sm font-medium text-foreground">${c.name}</a><p class="mt-0.5 line-clamp-2 text-xs text-pretty text-muted">${c.desc || "Không có mô tả"}</p><p class="mt-1 text-xs tabular-nums text-muted">${c.members} thành viên</p></div>${rowMenu([[menuItem("pencil", "Sửa lớp")], [menuItem("trash-2", "Xoá lớp", { danger: true })]])}</li>`).join("")}</ul>
          ${pagination({ total: 5, noun: "lớp", pages: 1 })}`);
      return WF.shell({ role: "ADMIN", active: "lop-hoc", title: "Lớp học", headerRight: btn("Tạo lớp", { v: "primary", icon: "plus", size: "hdr" }),
        content: `<div class="mb-4" data-wf-block="3">${search({ placeholder: "Tìm lớp theo tên", cls: "w-full sm:w-72" })}</div>${tbl}` });
    },
  });

  WF.screen({
    id: "chi-tiet-lop", group: "Ban tổ chức · Admin", label: "Chi tiết lớp", options: ["a"], rec: "a",
    reasons: { a: {
      name: "Đầu trang + hai tab", why: "Việc chính ở lớp là tạo buổi điểm danh, nên đó là nút chính đầu trang; thành viên và các buổi đã tạo chia hai tab.",
      pros: ["Tạo buổi điểm danh luôn ở một chỗ, không phải vào tab", "Chọn nhiều thành viên thì thanh thao tác thay chỗ ô tìm"],
      cons: ["Hai tab không thấy cùng lúc"], fit: "Giảng viên, BTC quản lý lớp học kỳ.",
      tips: ["Hiện buổi điểm danh gần nhất ở đầu trang", "Thêm cột Lớp hiện tại ở kết quả tìm", "Bỏ cột Email"],
    } },
    render(v, tt) {
      const members = `<div data-tabpanel="cls:tv">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-wf-block="5">${search({ placeholder: "Tìm trong lớp", cls: "w-full sm:w-64" })}${btn("Thêm thành viên", { icon: "user-plus" })}</div>
        ${tt === "rong" ? tableWrap(empty("Lớp chưa có thành viên nào.")) : tableWrap(`<table class="w-full text-sm"><thead class="border-b border-border"><tr>${checkCell("Chọn tất cả", "", "th")}${th("Sinh viên")}${th("MSSV")}${th("Email", "hidden w-full md:table-cell")}</tr></thead>
          <tbody>${D.classMembers.map(([n, m, e]) => `<tr class="border-b border-border last:border-0 hover:bg-surface-hover">${checkCell(`Chọn ${n}`)}<td class="px-4 py-3 whitespace-nowrap"><p class="font-medium text-foreground">${n}</p></td><td class="px-4 py-3 whitespace-nowrap tabular-nums text-foreground">${m}</td><td class="hidden max-w-0 px-4 py-3 md:table-cell"><p class="truncate text-muted">${e}</p></td></tr>`).join("")}</tbody></table>
          ${pagination({ from: 1, to: 6, total: 42, noun: "thành viên", page: 1, pages: 3 })}`, "6")}</div>`;
      const sessions = `<div data-tabpanel="cls:buoi" hidden>${card(`<ul class="flex flex-col gap-0.5">${D.sessions.map((s) => `<li><a href="${href("chi-tiet-su-kien")}" class="group flex items-center gap-3 rounded-xl px-3 py-2.5 outline-hidden hover:bg-item-hover"><div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted group-hover:bg-surface">${I("qr-code")}</div><div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-foreground">${s.name}</p><p class="mt-1 truncate text-xs text-muted">${s.when} · ${s.place}</p></div>${s.live ? `<span class="hidden sm:inline-flex">${evtBadge("live")}</span>` : ""}<span class="shrink-0 text-sm tabular-nums text-muted">${s.done} / ${s.total}</span></a></li>`).join("")}</ul>`, { flush: true, block: "6" })}</div>`;
      return WF.shell({ role: "ADMIN", active: "lop-hoc", parent: { label: "Lớp học", man: "lop-hoc" }, content: `
        ${pageHead({ title: "SE1801", size: "lg", sub: "Lập trình Web – Khoá 18 · 42 thành viên", actions: `${btn("Tạo buổi điểm danh", { v: "primary", icon: "calendar-plus" })}${outlineIconMenu(menuGroups([menuItem("pencil", "Sửa lớp")], [menuItem("trash-2", "Xoá lớp", { danger: true })]))}` })}
        <div class="mb-4" data-wf-block="4">${tabs("underline", [{ label: "Thành viên", value: "tv", count: 42 }, { label: "Buổi điểm danh", value: "buoi", count: 12 }], "tv", { group: "cls" })}</div>
        ${members}${sessions}` });
    },
  });

  // ================================================================== MẪU ĐÁNH GIÁ
  WF.screen({
    id: "mau-danh-gia", group: "Ban tổ chức · Admin", label: "Mẫu đánh giá", options: ["a"], rec: "a",
    reasons: { a: {
      name: "Danh sách mẫu", why: "BTC vào để chọn một mẫu sửa hay nhân bản, nên mỗi mẫu là một dòng: tên, số câu, đang dùng ở mấy sự kiện.",
      pros: ["Mẫu của người khác có nút Xem và Nhân bản, không có Sửa", "Số câu sao và câu văn bản gom một dòng phụ"],
      cons: ["Không xem trước câu hỏi ngay trên danh sách"], fit: "Mỗi BTC có vài mẫu dùng lại.",
      tips: ["Thêm cột Cập nhật lần cuối", "Chia hai nhóm Của tôi và Của người khác", "Dòng thoáng hơn"],
    } },
    render(v, tt) {
      const list = tt === "dang-tai" ? skelRows(3) : tt === "loi" ? loadError("Không tải được danh sách mẫu") : tt === "rong" ? empty("Chưa có mẫu đánh giá nào. Mẫu gồm câu đánh giá sao (1–5) và câu trả lời văn bản.") :
        `<ul class="flex flex-col gap-0.5">${D.templates.map((t) => `<li class="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-item-hover">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted group-hover:bg-surface">${I("clipboard-list")}</div>
          <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-foreground" title="${esc(t.name)}">${t.name}</p>
            <p class="mt-1 truncate text-xs text-muted">${t.rating} câu sao · ${t.text} câu văn bản${t.used ? ` · dùng ở ${t.used} sự kiện` : ""} · ${t.mine ? "của bạn" : `của ${t.by}`}</p></div>
          <div class="flex shrink-0 items-center gap-1">${t.mine ? `${iconBtn("pencil", "Sửa mẫu", { row: true })}${rowMenu([[menuItem("copy", "Nhân bản")], [menuItem("trash-2", "Xoá mẫu", { danger: true })]])}` : `${iconBtn("eye", "Xem mẫu", { row: true })}${iconBtn("copy", "Nhân bản", { row: true })}`}</div></li>`).join("")}</ul>`;
      return WF.shell({ role: "ADMIN", active: "mau-danh-gia", title: "Mẫu đánh giá", headerRight: btn("Tạo mẫu", { v: "primary", icon: "plus", size: "hdr" }),
        content: `<div class="mb-4" data-wf-block="3">${search({ placeholder: "Tìm mẫu theo tên", cls: "w-full sm:w-72" })}</div><section class="rounded-2xl border border-border bg-surface p-2" data-wf-block="4">${list}</section>` });
    },
  });

  // ================================================================== NGƯỜI DÙNG
  WF.screen({
    id: "nguoi-dung", group: "Ban tổ chức · Admin", label: "Người dùng (Admin)", short: "Người dùng", options: ["a"], rec: "a",
    reasons: { a: {
      name: "Bảng quản lý, thao tác hàng loạt", why: "Admin vào để tìm một người hoặc xử lý cả nhóm, nên bảng có chọn nhiều dòng; tick một dòng là thanh thao tác thay chỗ hàng lọc (bấm thử).",
      pros: ["5 icon trên mỗi dòng gom vào ⋯, xoá tách xuống cuối", "Thanh thao tác hàng loạt nằm ngay trên bảng, không còn thanh tối nổi ở đáy", "Cột Trạng thái bỏ: chỉ tài khoản bị khoá mới có nhãn"],
      cons: ["Lọc vai trò là một ô chọn, không còn ba ô chọn cạnh nhau", "Thanh hàng loạt đè chỗ ô tìm khi đang chọn"],
      fit: "Trường có hàng nghìn tài khoản, admin xử lý theo lớp hoặc khoá.", tips: ["Thêm cột Ngày tạo", "Giữ cột Trạng thái", "Dòng gọn hơn"],
    } },
    render(v, tt) {
      const rows = D.users;
      const roleLabel = (r) => roleBadge(r);
      const actions = (u) => u.me ? rowMenu([[menuItem("pencil", "Sửa thông tin")]]) : rowMenu([
        [menuItem("pencil", "Sửa thông tin"), menuItem("key-round", "Đặt lại mật khẩu"), menuItem("smartphone", "Reset thiết bị"), menuItem(u.active ? "user-x" : "user-check", u.active ? "Khoá tài khoản" : "Mở khoá")],
        [menuItem("trash-2", "Xoá vĩnh viễn", { danger: true })],
      ]);
      const toolbar = `<div data-bulk-toolbar class="flex min-h-10 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          ${tabs("boxed", [{ label: "Tất cả" }, { label: "Hoạt động" }, { label: "Bị khoá" }], "Tất cả", { group: "ustat" })}
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">${search({ placeholder: "Tìm theo tên, MSSV, email", cls: "w-full sm:w-64" })}${selectBtn({ label: "Vai trò:", value: "Tất cả", inline: true, options: ["Tất cả", "Sinh viên", "Ban tổ chức", "Giảng viên", "Admin"] })}</div>
        </div>
        <div data-bulk-bar hidden class="flex min-h-10 flex-wrap items-center gap-2">
          <p class="mr-2 text-sm font-medium text-foreground"><span data-bulk-count>2</span> đã chọn</p>${btn("Bỏ chọn", { v: "ghost", size: "sm" })}
          <div class="ml-auto flex flex-wrap gap-2">${btn("Sửa thông tin", { icon: "pencil" })}${btn("Đặt lại mật khẩu", { icon: "key-round" })}${dropdown(btn("Khác", { icon: "ellipsis" }), menuGroups([menuItem("user-x", "Khoá"), menuItem("user-check", "Mở khoá"), menuItem("smartphone", "Reset thiết bị")]))}${btn("Xoá", { v: "danger", icon: "trash-2" })}</div>
        </div>`;
      const table = tt === "dang-tai" ? tableWrap(skelRows(8)) : tt === "loi" ? tableWrap(loadError("Không tải được danh sách người dùng")) : tt === "rong"
        ? tableWrap(`<p class="py-10 text-center text-sm text-muted">Không có tài khoản nào khớp <span class="text-foreground">"se1709"</span>. Thử từ khoá khác. <a href="#" class="font-medium text-foreground underline-offset-4 hover:underline">Xoá tìm kiếm</a></p>`)
        : tableWrap(`<table class="w-full text-sm"><thead class="border-b border-border"><tr>${checkCell("Chọn tất cả", "data-bulk-all", "th")}${th("Người dùng", "w-full")}${th("MSSV", "hidden md:table-cell")}${th("Lớp", "hidden lg:table-cell")}${th("Vai trò", "hidden sm:table-cell")}<th class="w-px px-2"><span class="sr-only">Thao tác</span></th></tr></thead>
          <tbody>${rows.map((u) => `<tr class="border-b border-border last:border-0 hover:bg-surface-hover">
            ${u.me ? `<td class="w-px p-0"></td>` : checkCell(`Chọn ${u.name}`, "data-bulk-row")}
            <td class="max-w-0 px-4 py-3"><div class="flex items-center gap-3">${avatar(u.name, { seed: u.email })}<div class="min-w-0"><div class="flex min-w-0 items-center gap-2"><p class="truncate font-medium text-foreground" title="${esc(u.name)}">${u.name}</p>${u.me ? `<span class="shrink-0 text-xs text-muted">Bạn</span>` : ""}${u.active ? "" : badge("error", "Bị khoá", { icon: "lock" })}</div><p class="truncate text-xs text-muted">${u.email}</p></div></div></td>
            <td class="hidden px-4 py-3 whitespace-nowrap tabular-nums md:table-cell ${u.mssv ? "text-foreground" : "text-muted"}">${u.mssv || "—"}</td>
            <td class="hidden px-4 py-3 whitespace-nowrap lg:table-cell ${u.cls ? "text-foreground" : "text-muted"}">${u.cls || "—"}</td>
            <td class="hidden px-4 py-3 sm:table-cell">${roleLabel(u.role)}</td>
            <td class="px-2 py-3">${actions(u)}</td></tr>`).join("")}</tbody></table>
          <div class="flex items-center justify-between gap-4 border-t border-border px-4 py-3"><p class="text-sm tabular-nums text-muted"><span class="hidden sm:inline">1 tới 20 trong </span>2.418 tài khoản</p>
            <div class="flex items-center gap-4"><div class="hidden items-center gap-2 sm:flex"><span class="text-sm text-muted">Mỗi trang</span>${selectBtn({ value: "20", inline: true, options: ["20", "50", "100"], align: "right", up: true, triggerCls: "h-9" }).replace("px-4", "px-3")}</div>
            <nav aria-label="Phân trang" class="flex items-center gap-1">${iconBtn("chevron-left", "Trang trước", { size: "size-9", attrs: "disabled", cls: "disabled:opacity-40" })}<span class="hidden items-center gap-1 sm:flex">${[1, 2, 3, 4, 5].map((p) => `<button type="button" ${p === 1 ? 'aria-current="page"' : ""} class="${cx("inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-medium tabular-nums outline-hidden", p === 1 ? "border-transparent bg-secondary text-foreground" : "border-transparent text-foreground/70 hover:bg-foreground/5")}">${p}</button>`).join("")}<span class="px-1 text-sm text-muted">…</span><button type="button" class="inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-transparent px-2 text-sm font-medium tabular-nums text-foreground/70 outline-hidden hover:bg-foreground/5">121</button></span><span class="text-sm tabular-nums sm:hidden">1 / 121</span>${iconBtn("chevron-right", "Trang sau", { size: "size-9" })}</nav></div></div>`);
      const head = `${btn(`<span class="hidden sm:inline">Import Excel</span>`, { icon: "upload", size: "hdr", attrs: 'aria-label="Import Excel"' })}${btn("Tạo tài khoản", { v: "primary", icon: "plus", size: "hdr" })}`;
      return WF.shell({ role: "ADMIN", active: "nguoi-dung", title: "Người dùng", headerRight: head,
        content: `<div class="mb-4" data-wf-block="3">${toolbar}</div>${table}` });
    },
  });

  // ================================================================== LOG GIAN LẬN
  const REASON = { INVALID_QR_TOKEN: ["warning", "QR hết hạn hoặc giả", "qr-code"], GPS_OUT_OF_RANGE: ["error", "Ngoài phạm vi GPS", "map-pin-off"], UNBOUND_DEVICE: ["error", "Thiết bị lạ", "smartphone"] };
  WF.screen({
    id: "gian-lan", group: "Ban tổ chức · Admin", label: "Log gian lận", options: ["a"], rec: "a",
    reasons: { a: {
      name: "Bảng nhật ký", why: "BTC vào để xem ai bị chặn và vì sao, nên mỗi lần chặn là một dòng: giờ, người, sự kiện, lý do.",
      pros: ["Lý do là nhãn màu: hổ phách cho mã QR, đỏ cho vị trí và thiết bị", "Giờ đứng đầu dòng, đọc theo thứ tự thời gian"],
      cons: ["Chỉ 100 lần chặn gần nhất, chưa lọc theo sự kiện (API đã hỗ trợ eventId, giao diện chưa có ô chọn)"],
      fit: "Kiểm tra sau mỗi sự kiện.", tips: ["Thêm ô lọc theo sự kiện", "Gom theo sinh viên", "Thêm cột IP"],
    } },
    render(v, tt) {
      const tbl = tt === "dang-tai" ? tableWrap(skelRows(6)) : tt === "loi" ? tableWrap(loadError("Không tải được log gian lận")) : tt === "rong" ? tableWrap(empty("Chưa có lần check-in nào bị chặn.")) :
        tableWrap(`<table class="hidden w-full text-sm md:table"><thead class="border-b border-border"><tr>${th("Thời gian")}${th("Sinh viên")}${th("Sự kiện", "w-full")}${th("Lý do")}${th("Chi tiết")}</tr></thead>
          <tbody>${D.fraud.map((f) => { const [t, l, i] = REASON[f.reason]; return `<tr class="border-b border-border last:border-0">
            <td class="px-4 py-3 whitespace-nowrap tabular-nums text-foreground">${f.at}</td>
            <td class="px-4 py-3 whitespace-nowrap">${f.name ? `<p class="font-medium text-foreground">${f.name}</p><p class="mt-0.5 text-xs tabular-nums text-muted">${f.mssv}</p>` : `<p class="text-muted">Không rõ</p>`}</td>
            <td class="max-w-0 px-4 py-3"><p class="truncate text-foreground" title="${esc(f.event)}">${f.event}</p></td>
            <td class="px-4 py-3">${badge(t, l, { icon: i })}</td>
            <td class="px-4 py-3 whitespace-nowrap tabular-nums ${f.detail ? "text-foreground" : "text-muted"}">${f.detail || "—"}</td></tr>`; }).join("")}</tbody></table>
          <ul class="divide-y divide-border md:hidden">${D.fraud.map((f) => { const [t, l, i] = REASON[f.reason]; return `<li class="px-4 py-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-sm font-medium text-foreground">${f.name || "Không rõ"}</p><p class="mt-0.5 text-xs tabular-nums text-muted">${f.at}</p></div>${badge(t, l, { icon: i })}</div><p class="mt-1 line-clamp-2 text-xs text-pretty text-muted">${f.event}${f.detail ? ` · ${f.detail}` : ""}</p></li>`; }).join("")}</ul>
          <div class="border-t border-border px-4 py-3"><p class="text-sm text-muted">100 lần chặn gần nhất</p></div>`);
      return WF.shell({ role: "ADMIN", active: "gian-lan", title: "Log gian lận", content: tbl });
    },
  });

  // ================================================================== SINH VIÊN: TRANG CHỦ
  const studentLive = (e, { mine, state, compact = false, noBadge = false }) => `
    <article class="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      ${noBadge ? `<p class="text-xs text-muted">${e.manual ? "Cổng check-in mở thủ công" : "Check-in đóng lúc 08:30"}</p>` : `<div class="flex flex-wrap items-center gap-x-2 gap-y-1">${evtBadge("live")}<span class="text-xs text-muted">${e.manual ? "Cổng check-in mở thủ công" : "Check-in đóng lúc 08:30"}</span></div>`}
      <h3 class="mt-3 text-base font-semibold text-pretty text-foreground">${e.name}</h3>
      ${compact ? "" : `<p class="mt-1 text-sm text-pretty text-muted">${e.manual ? "Buổi học" : e.time} · ${e.location}</p>`}
      ${state === "done"
        ? `<p class="mt-4 flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-sm font-medium text-success">${I("circle-check")}Bạn đã check-in lúc 07:52</p>`
        : `<div class="mt-4 flex gap-3 rounded-xl bg-warning-bg px-3 py-2.5">${I("scan-line", "mt-0.5 size-4 shrink-0 text-warning")}<div class="min-w-0"><p class="text-sm font-medium text-warning">Bạn chưa check-in</p><p class="mt-0.5 text-sm text-pretty text-foreground/80">Quét mã QR trên màn chiếu ở cửa vào bằng camera điện thoại.</p></div></div>`}
    </article>`;
  WF.screen({
    id: "trang-chu-sv", group: "Sinh viên", label: "Trang chủ sinh viên", short: "Trang chủ SV", options: ["a", "b", "d", "e"], rec: "a", nav: true, recNav: "duoi",
    reasons: {
      a: {
        name: "Việc của tôi trước", why: "Sinh viên mở app để biết lúc này có phải quét QR không và mình đã đăng ký gì, nên sự kiện đang mở điểm danh đứng đầu, kèm việc phải làm.",
        pros: ["Chưa check-in thì khung hổ phách nói rõ phải quét ở đâu", "Sắp tới của bạn tách khỏi sự kiện đang mở đăng ký", "Đã tham gia có nút Đánh giá ngay trên dòng"],
        cons: ["Trang dài khi có nhiều sự kiện mở đăng ký", "Bỏ dòng chào và MSSV ở đầu trang: tên đã có ở menu tài khoản"],
        fit: "Sinh viên mở app trên điện thoại vài phút trước sự kiện.",
        tips: ["Giữ dòng Xin chào ở đầu trang", "Ẩn nhóm Đang mở đăng ký khi trống", "Thanh dưới có 4 mục"],
      },
      b: {
        name: "Hai tab Của tôi / Đăng ký thêm", why: "Tách việc đi dự (của tôi) khỏi việc tìm sự kiện mới (đăng ký thêm) bằng hai tab ở đầu trang.",
        pros: ["Tab Của tôi ngắn, chỉ có sự kiện mình liên quan", "Đăng ký thêm thành một danh sách riêng, có ô tìm"],
        cons: ["Sự kiện mở đăng ký bị giấu sau một cú bấm", "Thêm một tầng chọn trên điện thoại"],
        fit: "Trường có nhiều sự kiện mở đăng ký mỗi tuần.", tips: ["Đổi tên tab", "Mặc định mở tab Đăng ký thêm", "Thêm số đếm trên tab"],
      },
      d: {
        name: "A gọn chữ", why: "Như A, mỗi mục chỉ giữ thứ dùng để chọn: tên và giờ; địa điểm, số đăng ký để trang chi tiết.",
        pros: ["Mỗi mục hai dòng, liếc nhanh hơn trên điện thoại"], cons: ["Không thấy địa điểm cho tới khi mở sự kiện"],
        fit: "Sinh viên quen chỗ tổ chức (hội trường, phòng học cố định).", tips: ["Giữ địa điểm ở sự kiện đang diễn ra", "Gọn thêm khối Đã tham gia"],
      },
      e: {
        name: "A bỏ lặp", why: "Như A, mỗi thông tin nói một lần: tên nhóm đã nói 'đang diễn ra' thì thẻ bỏ nhãn; tiêu đề nhóm đã nói 'của bạn' thì không ghi 'Đã đăng ký'.",
        pros: ["Ít nhãn, khối việc phải làm nổi hơn"], cons: ["Thẻ đứng riêng (chia sẻ, chụp màn hình) thiếu nhãn trạng thái"],
        fit: "Đi cùng A hoặc D.", tips: ["Kết hợp D và E", "Giữ nhãn Đang diễn ra"],
      },
    },
    render(v, tt, state) {
      const compact = v === "d";
      const noRep = v === "e";
      const studentRow = (e, right = "") => `<li><a href="#" class="group flex items-center gap-3 rounded-xl px-3 py-2.5 outline-hidden hover:bg-item-hover">${dateTile(e)}<div class="min-w-0 flex-1"><p class="line-clamp-2 text-sm font-medium text-pretty text-foreground">${e.name}</p><p class="mt-1 truncate text-xs text-muted">${e.status === "manual" ? "Chưa đặt lịch" : e.time}${compact ? "" : ` · ${e.location}`}</p></div>${right}</a></li>`;
      const regBtn = `<span class="shrink-0">${btn("Đăng ký", { size: "sm" })}</span>`;
      const liveBlock = tt === "dang-tai" ? `<div class="rounded-2xl border border-border bg-surface p-5 space-y-3">${skel("w-24", "h-5")}${skel("w-3/5", "h-4")}${skel("w-full", "h-10")}</div>`
        : tt === "rong" ? "" : `<section data-wf-block="3">${sectionTitle("Đang mở điểm danh")}<div class="grid gap-3">${studentLive(ev("e2"), { state: "todo", compact, noBadge: noRep })}${studentLive(ev("e1"), { state: "done", compact, noBadge: noRep })}</div></section>`;
      const upcomingCard = card(tt === "dang-tai" ? skelRows(2) : tt === "rong" ? empty("Bạn chưa đăng ký sự kiện nào sắp tới.") : `<ul class="flex flex-col gap-0.5">${studentRow(ev("e3"), noRep || compact ? "" : `<span class="hidden sm:inline-flex">${badge("info", "Đã đăng ký", { icon: "ticket-check" })}</span>`)}</ul>`, { title: "Sắp tới của bạn", flush: true, block: "4" });
      const openCard = card(tt === "dang-tai" ? skelRows(2) : `<ul class="flex flex-col gap-0.5">${studentRow(ev("e4"), regBtn)}${studentRow(ev("e5"), regBtn)}${studentRow(ev("e6"), regBtn)}</ul>`, { title: "Đang mở đăng ký", flush: true, block: "5" });
      const pastCard = card(`<ul class="flex flex-col gap-0.5">${D.myHistory.slice(1, 3).map((h) => `<li class="flex items-center gap-3 rounded-xl px-3 py-2.5"><div class="min-w-0 flex-1"><p class="line-clamp-2 text-sm font-medium text-pretty text-foreground">${h.name}</p><p class="mt-1 text-xs tabular-nums text-muted">${h.date}${compact ? "" : ` · Vào ${h.inAt} · Ra ${h.outAt}`}</p></div>${h.feedback === "open" ? btn("Đánh giá", { size: "sm", icon: "message-square-text" }) : `<span class="hidden sm:inline-flex">${attBadge(h.status)}</span>`}</li>`).join("")}</ul>`, { title: "Đã tham gia gần đây", action: viewAll(), flush: true, block: "6" });
      let content;
      if (tt === "loi") content = `<div class="rounded-2xl border border-border bg-surface">${loadError("Không tải được sự kiện")}</div>`;
      else if (v === "b") {
        content = `<div class="mb-4" data-wf-block="7">${tabs("segmented", [{ label: "Của tôi", value: "mine", grow: true }, { label: "Đăng ký thêm", value: "more", grow: true }], "mine", { group: "sv", layout: "fullMobile" })}</div>
          <div data-tabpanel="sv:mine" class="flex flex-col gap-6">${liveBlock}${upcomingCard}${pastCard}</div>
          <div data-tabpanel="sv:more" hidden class="flex flex-col gap-4">${search({ placeholder: "Tìm sự kiện theo tên" })}${openCard}</div>`;
      } else content = `<div class="flex flex-col gap-6">${liveBlock}${upcomingCard}${openCard}${pastCard}</div>`;
      return WF.shell({ role: "STUDENT", active: "trang-chu-sv", title: "Trang chủ", bottomNav: state.nav === "duoi", content: `<div class="max-w-3xl">${content}</div>` });
    },
  });

  // ================================================================== SINH VIÊN: LỊCH SỬ
  WF.screen({
    id: "lich-su", group: "Sinh viên", label: "Lịch sử tham dự", options: ["a"], rec: "a", nav: true, recNav: "duoi",
    reasons: { a: {
      name: "Danh sách một khung", why: "Sinh viên vào để xem mình đã điểm danh đủ chưa và làm việc còn lại (đánh giá, lấy chứng nhận), nên trạng thái đứng cạnh tên, việc còn lại là nút trên dòng.",
      pros: ["Giờ vào, giờ ra, thời lượng gom một dòng phụ", "Nút Đánh giá, Xem chứng nhận chỉ hiện ở sự kiện có việc đó"],
      cons: ["Không lọc theo học kỳ"], fit: "Sinh viên xem lại cuối kỳ.", tips: ["Thêm tổng số buổi đã tham gia", "Gom theo tháng", "Bỏ thời lượng"],
    } },
    render(v, tt, state) {
      const list = tt === "dang-tai" ? skelRows(4, { avatar: false }) : tt === "loi" ? loadError("Không tải được lịch sử tham dự") : tt === "rong" ? empty("Bạn chưa tham dự sự kiện nào.") :
        `<ul class="divide-y divide-border">${D.myHistory.map((h) => `<li class="px-4 py-4 sm:px-5">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="line-clamp-2 text-sm font-medium text-pretty text-foreground">${h.name}</p><p class="mt-1 text-xs tabular-nums text-muted">${h.date} · ${h.place}</p></div>${attBadge(h.status)}</div>
          ${h.inAt ? `<p class="mt-2 text-xs tabular-nums text-muted">Vào ${h.inAt}${h.outAt ? ` · Ra ${h.outAt} · ${h.minutes} phút` : ""}</p>` : ""}
          ${h.feedback || h.cert ? `<div class="mt-3 flex flex-wrap gap-2">${h.feedback === "open" ? btn("Đánh giá", { size: "sm", icon: "message-square-text" }) : h.feedback === "sent" ? btn("Xem đánh giá", { size: "sm", icon: "message-square-text" }) : ""}${h.cert ? btn("Xem chứng nhận", { size: "sm", icon: "award" }) : ""}</div>` : ""}
        </li>`).join("")}</ul>`;
      return WF.shell({ role: "STUDENT", active: "lich-su", title: "Lịch sử tham dự", bottomNav: state.nav === "duoi", content: `<div class="max-w-3xl" data-wf-block="3"><section class="overflow-hidden rounded-2xl border border-border bg-surface">${list}</section></div>` });
    },
  });

  // ================================================================== SINH VIÊN: CHỨNG NHẬN
  WF.screen({
    id: "chung-nhan", group: "Sinh viên", label: "Chứng nhận của tôi", short: "Chứng nhận", options: ["a"], rec: "a", nav: true, recNav: "duoi",
    reasons: { a: {
      name: "Danh sách chứng nhận", why: "Sinh viên vào để xem hoặc tải một chứng nhận, nên mỗi chứng nhận là một dòng có hai nút Xem và PDF.",
      pros: ["Mã chứng nhận in kiểu mã (font-mono) để chép chính xác", "Điện thoại: nút xuống dòng dưới tên, tên không bị ép"],
      cons: ["Không xem trước ảnh nhỏ trên danh sách"], fit: "Mỗi sinh viên có vài tới vài chục chứng nhận.",
      tips: ["Thêm ảnh nhỏ của chứng nhận", "Lưới thẻ thay cho danh sách"],
    } },
    render(v, tt, state) {
      const list = tt === "dang-tai" ? skelRows(2) : tt === "loi" ? loadError("Không tải được danh sách chứng nhận") : tt === "rong" ? empty("Bạn chưa có chứng nhận nào. Ban tổ chức cấp chứng nhận sau sự kiện cho người đã check-out.") :
        `<ul class="divide-y divide-border">${D.certs.map((c) => `<li class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <div class="flex min-w-0 flex-1 items-start gap-3"><div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted">${I("award")}</div><div class="min-w-0"><p class="line-clamp-2 text-sm font-medium text-pretty text-foreground">${c.event}</p><p class="mt-1 text-xs text-muted">Cấp ngày ${c.issued} · <span class="font-mono">${c.code}</span></p></div></div>
          <div class="flex shrink-0 gap-2 pl-13 sm:pl-0">${btn("Xem", { size: "sm", icon: "eye" })}${btn("PDF", { size: "sm", icon: "file-down" })}</div></li>`).join("")}</ul>`;
      return WF.shell({ role: "STUDENT", active: "chung-nhan", title: "Chứng nhận của tôi", bottomNav: state.nav === "duoi", content: `<div class="max-w-3xl" data-wf-block="3"><section class="overflow-hidden rounded-2xl border border-border bg-surface">${list}</section></div>` });
    },
  });

  // ================================================================== SINH VIÊN: GỬI ĐÁNH GIÁ
  const stars = (value) => `<div class="flex items-center gap-1" role="radiogroup" aria-label="Chọn số sao">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${n === value}" aria-label="${n} sao" class="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg outline-hidden hover:bg-foreground/5">${I("star", cx("size-7", n <= value ? "wf-star-on fill-amber-400 text-amber-400" : "fill-foreground/10 text-foreground/10"))}</button>`).join("")}${value ? `<span class="ml-2 text-sm text-muted">Tốt</span>` : ""}</div>`;
  WF.screen({
    id: "danh-gia-sv", group: "Sinh viên", label: "Gửi đánh giá", options: ["a"], rec: "a", nav: true, recNav: "duoi",
    reasons: { a: {
      name: "Form một cột", why: "Sinh viên đã check-out mở form từ lịch sử hoặc ngay sau khi quét check-out; mỗi câu một khối, sao to vừa ngón tay.",
      pros: ["Sao 40px bấm được trên điện thoại", "Ẩn danh nói ngay đầu form"], cons: ["Không lưu nháp khi rời trang"],
      fit: "Ngay sau sự kiện, trên điện thoại.", tips: ["Đưa nút Gửi dính đáy màn hình", "Nhãn chữ cho từng mức sao"],
    } },
    render(v, tt, state) {
      const q = (i, label, ctl, req = true) => `<fieldset class="flex flex-col gap-3 border-t border-border pt-5 first:border-0 first:pt-0"><legend class="text-sm font-medium text-pretty text-foreground">${i}. ${label}${req ? ` <span aria-hidden="true" class="text-error-text">*</span>` : ""}</legend>${ctl}</fieldset>`;
      const content = `${pageHead({ title: "Đánh giá sự kiện: Seminar Khởi nghiệp với dữ liệu mở", sub: "Phòng 102, toà Gamma · 29/09/2026" })}
        <form class="flex max-w-2xl flex-col gap-4">
          ${card(`<p class="mb-5 flex gap-2 text-sm text-pretty text-muted" data-wf-block="4">${I("eye-off", "mt-0.5 size-4 shrink-0")}Form ẩn danh: Ban tổ chức không biết ai đã trả lời gì.</p><div class="flex flex-col gap-5">${q(1, "Bạn đánh giá chất lượng diễn giả thế nào?", stars(4))}${q(2, "Nội dung có hữu ích cho việc học của bạn không?", stars(0))}${q(3, "Bạn muốn góp ý gì cho lần sau?", `<textarea rows="3" aria-label="Góp ý" class="w-full rounded-xl border border-border-strong bg-surface dark:bg-white/4 px-4 py-2.5 text-base md:text-sm text-foreground placeholder:text-muted outline-hidden focus:border-focus focus:ring-2 focus:ring-focus"></textarea>`, false)}</div>`, { block: "5" })}
          <div class="flex justify-end" data-wf-block="6">${btn("Gửi đánh giá", { v: "primary", size: "form", cls: "w-full sm:w-auto" })}</div>
        </form>`;
      return WF.shell({ role: "STUDENT", active: "lich-su", parent: { label: "Lịch sử tham dự", man: "lich-su" }, bottomNav: state.nav === "duoi", content });
    },
  });

  // ================================================================== ĐĂNG NHẬP
  const authForm = (tt) => `
    <h1 class="text-xl font-semibold text-foreground">Đăng nhập</h1>
    <p class="mt-2 text-sm/6 text-pretty text-muted">Nhập thông tin để truy cập hệ thống điểm danh.</p>
    <div class="mt-6">${tabs("segmented", [{ label: "Mật khẩu", value: "pw", icon: "lock", grow: true }, { label: "Mã qua email", value: "otp", icon: "mail", grow: true }], "pw", { group: "auth", layout: "full" })}</div>
    <form class="mt-6 flex flex-col gap-4">
      ${field({ label: "MSSV hoặc email", placeholder: "Nhập MSSV hoặc email", value: tt === "loi" ? "SE180452" : "", h: "h-12 md:h-12" })}
      <div class="relative flex flex-col gap-1.5">
        <label for="pw" class="w-fit cursor-pointer text-sm font-medium text-foreground">Mật khẩu</label>
        <div class="relative"><input id="pw" type="password" placeholder="Nhập mật khẩu" class="${WF.INPUT} h-12 md:h-12 pr-11" /><button type="button" aria-label="Hiện mật khẩu" class="absolute inset-y-0 right-1 my-auto flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted outline-hidden hover:text-foreground">${I("eye")}</button></div>
        <a href="#" class="absolute top-0 right-0 text-sm text-foreground outline-hidden before:absolute before:-inset-x-2 before:-inset-y-2.5 hover:underline">Quên mật khẩu?</a>
      </div>
      <div class="flex flex-col gap-2"><p role="alert" class="min-h-5 text-sm text-error-text">${tt === "loi" ? "MSSV, email hoặc mật khẩu chưa đúng" : ""}</p>
      ${btn(tt === "dang-tai" ? `<span class="invisible">Đăng nhập</span>${I("loader-circle", "absolute inset-0 m-auto size-4 animate-spin")}` : "Đăng nhập", { v: "primary", size: "auth", cls: "relative w-full" })}</div>
    </form>`;
  WF.screen({
    id: "dang-nhap", group: "Công khai · Đăng nhập", label: "Đăng nhập", options: ["a", "b"], rec: "b",
    states: { "du-lieu": "Mới mở", "dang-tai": "Đang đăng nhập", loi: "Sai mật khẩu" },
    reasons: {
      a: {
        name: "Một cột giữa màn", why: "Cả màn chỉ có việc đăng nhập: logo, form, không gì khác; trên điện thoại cũng y như vậy.",
        pros: ["Nhẹ nhất, tải nhanh trên 4G", "Không có khối nào kéo mắt khỏi ô nhập"], cons: ["Màn rộng trống hai bên, không nói gì về sản phẩm"],
        fit: "Phần lớn người đăng nhập là sinh viên trên điện thoại.", tips: ["Thêm một câu giới thiệu dưới logo", "Nền xám đậm hơn"],
      },
      b: {
        name: "Hai cột, giữ khối thương hiệu", why: "Màn trình diễn được giữ gradient: khối thương hiệu bên trái nói sản phẩm làm gì, form bên phải; điện thoại chỉ còn form như A.",
        pros: ["Giữ nhận diện xanh của FPT Event ở màn đầu tiên", "Bốn ý chính của sản phẩm gom thành bốn dòng, bỏ hiệu ứng kính và vệt sáng"],
        cons: ["Khối trái chỉ thấy từ màn 1024px"], fit: "Màn đăng nhập cũng là chỗ giới thiệu cho BTC, giảng viên mới.",
        tips: ["Bỏ bốn dòng tính năng", "Ảnh sự kiện thật thay cho gradient", "Khối trái hẹp lại"],
      },
    },
    render(v, tt) {
      const brand = `<div class="mb-8 flex items-center gap-2.5 ${v === "b" ? "lg:hidden" : ""}">${logo("size-10")}<span class="text-base font-semibold text-foreground">FPT Event</span></div>`;
      const formCol = `<div class="w-full max-w-md">${brand}<div class="${v === "a" ? "rounded-2xl bg-surface p-6 sm:p-8" : ""}" data-wf-block="2">${authForm(tt)}</div><p class="mt-6 text-center text-xs text-muted">© 2026 FPT University</p></div>`;
      if (v === "a") return `<div class="flex min-h-screen items-center justify-center bg-background px-4 py-10">${formCol}</div>`;
      const feats = [["qr-code", "QR đổi mỗi 30 giây", "Mã ký HMAC, chụp gửi bạn là hết hạn"], ["map-pin", "Xác thực GPS", "Chỉ check-in được trong bán kính cho phép"], ["activity", "Cập nhật tức thì", "Danh sách điểm danh và báo cáo theo thời gian thực"], ["users", "Bốn vai trò", "Admin · Ban tổ chức · Giảng viên · Sinh viên"]];
      return `<div class="flex min-h-screen bg-surface">
        <aside class="wf-brandpanel hidden w-[52%] flex-col justify-between bg-[#0B47C9] bg-[linear-gradient(135deg,#0A3BAA_0%,#1A63F0_100%)] p-10 text-white lg:flex" data-wf-block="1">
          <div class="flex items-center gap-2.5"><span class="rounded-[14px] bg-white/15 p-0.5">${logo("size-9")}</span><span class="text-base font-semibold">FPT Event</span></div>
          <div class="max-w-md"><h2 class="text-3xl font-bold tracking-tight text-balance">Quản lý sự kiện thông minh và hiện đại</h2><p class="mt-3 text-base/7 text-white">Điểm danh tức thì bằng QR · Chống gian lận GPS · Báo cáo theo thời gian thực</p>
            <ul class="mt-8 grid gap-4 sm:grid-cols-2">${feats.map(([i, t, d]) => `<li class="flex gap-3"><span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15">${I(i)}</span><span><span class="block text-sm font-semibold">${t}</span><span class="mt-0.5 block text-sm text-white">${d}</span></span></li>`).join("")}</ul></div>
          <p class="text-sm text-white">© 2026 FPT University</p>
        </aside>
        <main class="flex flex-1 items-center justify-center bg-background px-4 py-10 lg:bg-surface">${formCol.replace('<p class="mt-6 text-center text-xs text-muted">© 2026 FPT University</p>', '<p class="mt-6 text-center text-xs text-muted lg:hidden">© 2026 FPT University</p>')}</main>
      </div>`;
    },
  });

  WF.screen({
    id: "otp", group: "Công khai · Đăng nhập", label: "Mã OTP (thiết bị mới)", short: "Mã OTP", options: ["a"], rec: "a",
    states: { "du-lieu": "Đang nhập mã", loi: "Sai mã" },
    reasons: { a: {
      name: "Sáu ô một số", why: "Đăng nhập từ thiết bị lạ phải nhập mã gửi qua email; sáu ô tách số dễ đọc lại, dán cả mã vào ô nào cũng được.",
      pros: ["Email nhận mã in đủ, không cắt", "Sai mã thì xoá sáu ô, con trỏ về ô đầu"], cons: ["Ô sáu số là component mới"],
      fit: "Lần đầu đăng nhập trên điện thoại mới.", tips: ["Thêm đếm ngược gửi lại mã (cần API gửi lại)", "Một ô dài thay sáu ô"],
    } },
    render(v, tt) {
      const err = tt === "loi";
      const box = (d, i) => `<input inputmode="numeric" maxlength="${i === 0 ? 6 : 1}" ${i === 0 ? 'autocomplete="one-time-code"' : ""} aria-label="Số thứ ${i + 1} trên 6" value="${d}" class="${cx("aspect-square w-full min-w-0 rounded-xl border bg-surface dark:bg-white/4 text-center text-2xl font-semibold tabular-nums outline-hidden focus:border-focus focus:ring-2 focus:ring-focus", err ? "border-error" : "border-border-strong")}"/>`;
      return `<div class="flex min-h-screen items-center justify-center bg-background px-4 py-10"><div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-2.5">${logo("size-10")}<span class="text-base font-semibold text-foreground">FPT Event</span></div>
        <div class="rounded-2xl bg-surface p-6 sm:p-8" data-wf-block="1">
          <h1 class="text-xl font-semibold text-foreground">Xác thực thiết bị</h1>
          <p class="mt-2 text-sm/6 text-pretty text-muted">Thiết bị này chưa được tin cậy. Mã gồm 6 số vừa được gửi tới <span class="font-medium text-foreground">phuclhse180452@fpt.edu.vn</span></p>
          <fieldset class="mt-6"><legend class="mb-2 text-sm font-medium text-foreground">Mã xác thực</legend>
            <div class="grid grid-cols-6 gap-2 sm:gap-3">${(err ? ["", "", "", "", "", ""] : ["4", "8", "1", "", "", ""]).map(box).join("")}</div>
            <p aria-live="polite" class="mt-2 min-h-4 text-xs text-error-text">${err ? "Mã chưa đúng, kiểm tra lại email mới nhất" : ""}</p></fieldset>
          <div class="mt-4 flex flex-col gap-2">${btn("Xác thực", { v: "primary", size: "auth", cls: "w-full" })}${btn("Quay lại đăng nhập", { v: "ghost", icon: "arrow-left", size: "auth", cls: "w-full" })}</div>
        </div></div></div>`;
    },
  });

  // ================================================================== QUÉT QR (mobile)
  WF.screen({
    id: "quet-qr", group: "Công khai · Đăng nhập", label: "Kết quả quét QR", short: "Quét QR", options: ["a"], rec: "a",
    states: { "du-lieu": "Check-in thành công", "dang-tai": "Đang lấy GPS", rong: "Check-out + đánh giá", loi: "Ngoài phạm vi" },
    reasons: { a: {
      name: "Một cột, một kết quả", why: "Sinh viên vừa quét bằng camera; trang chỉ trả lời một câu: đã điểm danh chưa, nếu chưa thì vì sao và làm gì tiếp.",
      pros: ["Mỗi lỗi một tiêu đề riêng và một gợi ý cách sửa", "Check-out xong hiện form đánh giá ngay bên dưới"],
      cons: ["Bỏ nền gradient nhạt của bản cũ: trang này là trang làm việc, không phải trang trình diễn"],
      fit: "Mở trên điện thoại sau khi quét.", tips: ["Thêm nút Mở lại camera", "Hiện bản đồ khi ngoài phạm vi"],
    } },
    render(v, tt) {
      const top = `<div class="mb-6 flex items-center justify-center gap-2 text-sm text-muted">${logo("size-6")}<span>${tt === "rong" ? "Điểm danh ra" : "Điểm danh vào"} · FPT Event</span></div>`;
      const shellPage = (inner) => `<div class="min-h-screen bg-background px-4 py-8"><div class="mx-auto w-full max-w-sm">${top}${inner}</div></div>`;
      const resultCard = (iconName, toneBg, title, sub, extra = "") => `<section class="rounded-2xl bg-surface p-6 text-center" data-wf-block="1"><div class="mx-auto flex size-16 items-center justify-center rounded-full ${toneBg}">${I(iconName, "size-8")}</div><h1 class="mt-4 text-xl font-semibold text-foreground">${title}</h1><p class="mt-1 text-sm text-muted">${sub}</p>${extra}</section>`;
      if (tt === "dang-tai") return shellPage(`<section class="rounded-2xl bg-surface p-6 text-center" data-wf-block="1"><div class="mx-auto flex size-16 items-center justify-center rounded-full bg-info-bg text-info">${I("map-pin", "size-8")}</div><h1 class="mt-4 text-xl font-semibold text-foreground">Đang lấy vị trí GPS</h1><p class="mt-1 text-sm text-pretty text-muted">Cho phép truy cập vị trí khi trình duyệt hỏi.</p><div class="mt-6 flex justify-center text-muted">${I("loader-circle", "size-6 animate-spin")}</div></section><p class="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">${I("lock", "size-3.5")}Đăng nhập với tài khoản <span class="font-medium text-foreground">Lê Hoàng Phúc</span></p>`);
      if (tt === "loi") return shellPage(resultCard("map-pin-off", "bg-error-bg text-error-text", "Ngoài phạm vi", "Bạn đang ở ngoài khu vực tổ chức sự kiện.",
        `<dl class="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-left"><div class="bg-surface p-3"><dt class="text-xs text-muted">Cách địa điểm</dt><dd class="mt-0.5 text-base font-semibold tabular-nums text-foreground">312 m</dd></div><div class="bg-surface p-3"><dt class="text-xs text-muted">Cho phép trong</dt><dd class="mt-0.5 text-base font-semibold tabular-nums text-foreground">100 m</dd></div></dl>
         <p class="mt-4 text-sm text-pretty text-muted">Đi lại gần cửa vào rồi bấm Thử lại. Mã QR đã quét còn dùng được 15 phút.</p><div class="mt-5">${btn("Thử lại", { icon: "rotate-cw", size: "auth", cls: "w-full" })}</div>`));
      const eventBox = (title, time) => `<div class="mt-5 rounded-xl bg-background p-4 text-left"><p class="text-sm font-medium text-pretty text-foreground">${title}</p><p class="mt-1 text-sm tabular-nums text-muted">${time}</p></div>`;
      if (tt === "rong") return shellPage(`${resultCard("circle-check", "bg-success-bg text-success", "Check-out thành công", "Lê Hoàng Phúc · SE180452", `${eventBox("Seminar Khởi nghiệp với dữ liệu mở", "15:58:04 · 29/09/2026")}<p class="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">${I("arrow-down")}Dành 1 phút đánh giá sự kiện bên dưới</p>`)}
        <section class="mt-4 rounded-2xl bg-surface p-5" data-wf-block="2"><h2 class="text-base font-semibold text-foreground">Đánh giá sự kiện</h2><p class="mt-1 text-sm text-muted">Form ẩn danh</p><div class="mt-5 flex flex-col gap-3"><p class="text-sm font-medium text-foreground">1. Bạn đánh giá chất lượng diễn giả thế nào? <span class="text-error-text">*</span></p>${stars(0)}</div><div class="mt-5">${btn("Gửi đánh giá", { v: "primary", size: "auth", cls: "w-full" })}</div></section>`);
      return shellPage(resultCard("circle-check", "bg-success-bg text-success", "Check-in thành công", "Lê Hoàng Phúc · SE180452", `${eventBox(e1.name, "07:52:19 · 02/10/2026 · Hội trường A1")}<p class="mt-4 text-sm text-muted">Bạn có thể đóng trang này.</p>`));
    },
  });

  // ================================================================== CÔNG KHAI: ĐĂNG KÝ SỰ KIỆN
  const publicHeader = (right) => `<header class="sticky top-0 z-30 border-b border-border bg-surface" data-wf-block="1"><div class="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4"><a href="#" class="flex items-center gap-2.5">${logo()}<span class="text-sm font-semibold text-foreground">FPT Event</span></a>${right}</div></header>`;
  WF.screen({
    id: "dang-ky-list", group: "Công khai · Đăng nhập", label: "Đăng ký: danh sách sự kiện", short: "Đăng ký sự kiện", options: ["a"], rec: "a",
    reasons: { a: {
      name: "Danh sách lướt để chọn", why: "Người ngoài vào từ link để tìm sự kiện mình muốn dự; mỗi dòng nói ngày, giờ, chỗ và bao nhiêu người đã đăng ký.",
      pros: ["Cả dòng là link sang trang đăng ký", "Tên dài xuống hai dòng, không cắt"], cons: ["Không lọc theo ngày"],
      fit: "Sinh viên chưa có tài khoản, mở từ link BTC gửi.", tips: ["Thêm ảnh bìa sự kiện (cần dữ liệu ảnh)", "Nhóm theo tuần"],
    } },
    render(v, tt) {
      const rows = D.events.filter((e) => ["upcoming", "manual", "live"].includes(e.status) && !e.manual);
      const list = tt === "dang-tai" ? skelRows(4) : tt === "loi" ? loadError("Không tải được danh sách sự kiện") : tt === "rong" ? empty("Hiện chưa có sự kiện nào mở đăng ký. Hãy quay lại sau hoặc liên hệ Ban tổ chức.") :
        `<ul class="flex flex-col gap-0.5">${rows.map((e) => `<li><a href="${href("dang-ky-form")}" class="group flex items-center gap-3 rounded-xl px-3 py-3 outline-hidden hover:bg-item-hover">${dateTile(e)}<div class="min-w-0 flex-1"><p class="line-clamp-2 text-sm font-medium text-pretty text-foreground">${e.name}</p><p class="mt-1 truncate text-xs text-muted">${e.status === "manual" ? "Chưa đặt lịch" : e.time} · ${e.location}</p><p class="mt-0.5 text-xs tabular-nums text-muted">${e.registered ? `${fmt(e.registered)} người đã đăng ký` : "Chưa có ai đăng ký"}</p></div>${I("chevron-right", "size-4 shrink-0 text-muted")}</a></li>`).join("")}</ul>`;
      return `<div class="min-h-screen bg-background">${publicHeader(btn("Đăng nhập", { size: "hdr" }))}
        <main class="mx-auto max-w-3xl px-4 py-8">${pageHead({ title: "Đăng ký tham gia sự kiện", sub: "Chọn sự kiện và điền thông tin đăng ký. Chưa có tài khoản thì hệ thống gửi thông tin đăng nhập qua email.", block: "2" })}
          <div class="mb-4" data-wf-block="3">${search({ placeholder: "Tìm sự kiện theo tên" })}</div>
          <section class="rounded-2xl border border-border bg-surface p-2" data-wf-block="4">${list}</section></main></div>`;
    },
  });

  WF.screen({
    id: "dang-ky-form", group: "Công khai · Đăng nhập", label: "Đăng ký: form", short: "Form đăng ký", options: ["a"], rec: "a",
    states: { "du-lieu": "Đang điền", "dang-tai": "Đang tải", rong: "Đăng ký xong", loi: "Đã đóng đăng ký" },
    reasons: { a: {
      name: "Tóm tắt sự kiện + form", why: "Người đăng ký cần biết đúng sự kiện, giờ, chỗ trước khi điền; thông tin sự kiện là khối nhãn và giá trị ở trên, form ở dưới.",
      pros: ["Ba ô bắt buộc, hai ô ghi rõ không bắt buộc", "Xong thì nói rõ có tạo tài khoản mới không, mật khẩu gửi đi đâu"],
      cons: ["Bỏ icon trong từng ô nhập của bản cũ"], fit: "Đăng ký trên điện thoại từ link.", tips: ["Thêm icon trái trong ô", "Đưa nút Đăng nhập lên đầu form"],
    } },
    render(v, tt) {
      const e = ev("e4");
      const dl = (rows) => `<dl class="space-y-3 text-sm">${rows.map(([k, val]) => `<div class="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6"><dt class="text-muted">${k}</dt><dd class="min-w-0 font-medium text-pretty text-foreground">${val}</dd></div>`).join("")}</dl>`;
      const summary = card(`${dl([["Địa điểm", e.location], ["Ngày", e.dateLong], ["Check-in", "08:00 – 09:00"], ["Đã đăng ký", `${fmt(e.registered)} người`]])}`, { title: e.name, sub: "Tổ chức bởi Trần Nguyễn Anh Thư", block: "2", tag: "h1" });
      let body;
      if (tt === "dang-tai") body = `<div class="rounded-2xl border border-border bg-surface p-5 space-y-4">${skel("w-3/5", "h-5")}${skel("w-2/5")}${skel("w-1/2")}${skel("w-1/3")}</div>`;
      else if (tt === "loi") body = `${summary}<div class="rounded-2xl border border-border bg-surface p-6 text-center" data-wf-block="3"><h2 class="text-base font-semibold text-foreground">Sự kiện đã đóng đăng ký</h2><p class="mt-2 text-sm/6 text-pretty text-muted">Ban tổ chức không còn nhận đăng ký trực tuyến cho sự kiện này.</p><div class="mt-4">${btn("Xem sự kiện khác")}</div></div>`;
      else if (tt === "rong") body = `<section class="rounded-2xl border border-border bg-surface p-6" data-wf-block="2"><div class="flex size-12 items-center justify-center rounded-full bg-success-bg text-success">${I("circle-check", "size-6")}</div>
          <h1 class="mt-4 text-xl font-semibold text-foreground">Đăng ký thành công</h1><p class="mt-2 text-sm/6 text-pretty text-muted">Tên bạn đã được thêm vào danh sách tham gia sự kiện.</p>
          <div class="mt-5 rounded-xl bg-background p-4">${dl([["Sự kiện", e.name], ["Thời gian", "08:00 ngày 07/10/2026"], ["Người tham dự", "Lê Hoàng Phúc · phuclhse180452@fpt.edu.vn"]])}</div>
          <div class="mt-4 flex gap-3 rounded-xl border border-border bg-background p-4">${I("info", "mt-0.5 size-5 shrink-0 text-muted")}<p class="text-sm/6 text-pretty text-foreground">Đã tạo tài khoản mới cho bạn, mật khẩu tạm được gửi tới <span class="font-medium">phuclhse180452@fpt.edu.vn</span>.</p></div>
          <p class="mt-4 text-sm/6 text-pretty text-muted">Đến ngày sự kiện, đăng nhập rồi quét mã QR tại cửa vào để điểm danh.</p>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">${btn("Đăng ký sự kiện khác", { size: "form" })}${btn("Đăng nhập", { v: "primary", size: "form", icon: "log-in" })}</div></section>`;
      else body = `${summary}${card(`<form class="flex flex-col gap-5">${field({ label: "Họ và tên" })}${field({ label: "Mã số sinh viên", placeholder: "VD: SE170001" })}${field({ label: "Email", type: "email" })}
            <div class="grid gap-5 sm:grid-cols-2">${field({ label: "Lớp", optional: true, placeholder: "VD: SE1701" })}${field({ label: "Số điện thoại", optional: true, placeholder: "0901 234 567" })}</div>
            ${btn("Xác nhận đăng ký", { v: "primary", size: "form", cls: "w-full" })}
            <p class="text-center text-sm text-muted">Đã có tài khoản? <a href="#" class="font-medium whitespace-nowrap text-foreground underline-offset-4 hover:underline">Đăng nhập để đăng ký nhanh</a></p></form>`, { title: "Thông tin đăng ký", sub: "Chưa có tài khoản thì hệ thống tự tạo và gửi mật khẩu tạm qua email.", block: "3" })}`;
      return `<div class="min-h-screen bg-background">${publicHeader(`<a href="${href("dang-ky-list")}" class="inline-flex h-10 items-center gap-1 text-sm text-muted outline-hidden hover:text-foreground">${I("chevron-left")}Sự kiện khác</a>`)}
        <main class="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">${body}</main></div>`;
    },
  });

  // ================================================================== BÁO CÁO CHIA SẺ
  WF.screen({
    id: "bao-cao", group: "Công khai · Đăng nhập", label: "Báo cáo chia sẻ (công khai)", short: "Báo cáo chia sẻ", options: ["a"], rec: "a",
    states: { "du-lieu": "Có dữ liệu", "dang-tai": "Đang tải", loi: "Link đã thu hồi" },
    reasons: { a: {
      name: "Thanh trên + báo cáo", why: "Người nhận link chỉ cần đọc, in hoặc tải; thanh trên giữ hai nút đó, phần dưới là đúng file báo cáo.",
      pros: ["Cùng một file báo cáo cho xem trong app, tải về và link chia sẻ"], cons: ["Nội dung báo cáo do máy chủ tạo (htmlReport.service), lượt này không đổi"],
      fit: "Gửi cho người không có tài khoản.", tips: ["Thêm tên sự kiện lên thanh trên", "Ẩn nút In trên điện thoại"],
    } },
    render(v, tt) {
      if (tt === "loi") return `<div class="min-h-screen bg-background px-4 pt-24 sm:pt-40"><div class="mx-auto max-w-md text-center" data-wf-block="1"><div class="flex justify-center">${logo("size-10")}</div><h1 class="mt-8 text-xl font-semibold text-foreground">Link báo cáo không còn hiệu lực</h1><p class="mt-2 text-sm/6 text-pretty text-muted">Ban tổ chức đã thu hồi link này. Liên hệ Ban tổ chức để nhận link mới.</p><div class="mt-6">${btn("Về trang chủ", { size: "form" })}</div></div></div>`;
      const paper = tt === "dang-tai" ? `<div class="space-y-4">${skel("w-1/2", "h-6")}${skel("w-1/3")}${skel("w-full", "h-24")}${skel("w-full", "h-40")}</div>`
        : `<div class="text-[#222]"><p class="text-xs font-semibold tracking-wide text-[#1A6BFF] uppercase">Báo cáo điểm danh</p><h2 class="mt-2 text-xl font-bold">${e1.name}</h2><p class="mt-1 text-sm text-[#666]">${e1.dateLong} · ${e1.location}</p>
          <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">${[["Đăng ký", "186"], ["Đã check-in", "124"], ["Đã check-out", "0"], ["Vắng", "62"]].map(([k, n]) => `<div class="rounded-lg border border-[#eee] p-3"><p class="text-xs text-[#666]">${k}</p><p class="mt-1 text-lg font-semibold tabular-nums">${n}</p></div>`).join("")}</div>
          <table class="mt-6 w-full text-left text-sm"><thead><tr class="border-b border-[#eee] text-xs text-[#666]"><th class="py-2">#</th><th class="py-2">Họ tên</th><th class="py-2">MSSV</th><th class="py-2">Check-in</th></tr></thead><tbody>${D.attendees.slice(0, 6).map(([n, m, , i], k) => `<tr class="border-b border-[#f3f3f3]"><td class="py-2 tabular-nums text-[#666]">${k + 1}</td><td class="py-2">${n}</td><td class="py-2 tabular-nums">${m}</td><td class="py-2 tabular-nums">${i || "—"}</td></tr>`).join("")}</tbody></table></div>`;
      return `<div class="flex min-h-screen flex-col bg-background">
        <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6" data-wf-block="1">${logo()}<div class="min-w-0 flex-1"><h1 class="truncate text-base font-semibold text-foreground">Báo cáo điểm danh</h1><p class="truncate text-xs text-muted">Ban tổ chức chia sẻ · chỉ xem</p></div>
          ${btn(`<span class="hidden sm:inline">In hoặc lưu PDF</span>`, { icon: "printer", size: "hdr", attrs: 'aria-label="In hoặc lưu PDF"' })}${btn(`<span class="hidden sm:inline">Tải file</span>`, { icon: "download", size: "hdr", attrs: 'aria-label="Tải file"' })}</header>
        <main class="flex-1 p-4 sm:p-6"><div class="mx-auto max-w-4xl rounded-2xl bg-white p-6 sm:p-10" data-wf-block="2">${paper}</div></main></div>`;
    },
  });

  // ================================================================== LANDING
  WF.screen({
    id: "landing", group: "Công khai · Đăng nhập", label: "Trang giới thiệu (landing)", short: "Landing", options: ["a"], rec: "a",
    reasons: { a: {
      name: "Một trang, giữ đủ phần cũ", why: "Người lạ vào trang chủ cần biết đây là gì và bấm đi đâu: đăng ký sự kiện hay đăng nhập. Giữ đúng nội dung cũ, làm gọn nhịp và màu.",
      pros: ["Một nút chính Đăng ký tham gia sự kiện ở hero và cuối trang", "Màu từng tính năng giữ như bản cũ, bỏ vệt sáng, hiệu ứng kính", "Nhãn vai trò Admin đổi khỏi màu đỏ (đỏ để dành cho lỗi)"],
      cons: ["Skill chưa được dạy kỹ cho landing page, đây là bản làm gọn"], fit: "Khách lần đầu vào event.fpt.edu.vn.",
      tips: ["Thêm ảnh sự kiện thật ở hero", "Bỏ phần vai trò", "Hero chữ to hơn"],
    } },
    render() {
      const feats = [["qr-code", "QR động thông minh", "Mã tự đổi mỗi 30 giây, ký HMAC-SHA256. Chụp màn hình gửi bạn là hết hạn.", "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"], ["map-pin", "Xác thực GPS thời gian thực", "Chỉ check-in được trong bán kính đã cấu hình quanh địa điểm.", "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"], ["shield-check", "Chống gian lận nhiều lớp", "Khoá thiết bị qua OTP email, kiểm mã QR, GPS và khung giờ.", "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"], ["chart-column", "Báo cáo và xuất Excel", "Số liệu điểm danh theo thời gian thực, xuất Excel đủ thông tin sinh viên.", "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"], ["smartphone", "Quét bằng điện thoại", "Dùng camera hoặc Zalo, không phải cài ứng dụng.", "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300"], ["users", "Bốn vai trò", "Admin · Ban tổ chức · Giảng viên · Sinh viên. Import hàng loạt bằng Excel.", "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"]];
      const steps = [["BTC tạo sự kiện", "Nhập thông tin, vị trí GPS, khung giờ và danh sách tham dự."], ["Chiếu mã QR", "Mở màn QR toàn màn hình ở cổng vào, mã tự đổi mỗi 30 giây."], ["Sinh viên quét QR", "Đăng ký bằng họ tên, MSSV, email rồi quét để điểm danh."], ["Xem báo cáo", "Theo dõi điểm danh trực tiếp, xuất Excel khi kết thúc."]];
      return `<div class="min-h-screen bg-surface">
        <header class="sticky top-0 z-30 border-b border-border bg-surface" data-wf-block="1"><div class="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6"><a href="#" class="flex items-center gap-2.5">${logo()}<span class="text-sm font-semibold text-foreground">FPT Event</span></a>
          <nav class="hidden items-center gap-6 text-sm text-foreground/70 md:flex"><a href="#" class="hover:text-foreground">Tính năng</a><a href="#" class="hover:text-foreground">Cách hoạt động</a><a href="#" class="hover:text-foreground">Đăng ký sự kiện</a></nav>
          <div class="ml-auto">${btn("Đăng nhập", { size: "hdr" })}</div></div></header>
        <section class="wf-brandpanel bg-[#0B47C9] bg-[linear-gradient(135deg,#0A3BAA_0%,#1A63F0_100%)] text-white" data-wf-block="2"><div class="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div><h1 class="text-3xl font-bold tracking-tight text-balance sm:text-5xl">Điểm danh thông minh, không thể gian lận</h1><p class="mt-4 max-w-[55ch] text-base/7 text-white">Hệ thống quản lý sự kiện và điểm danh cho Đại học FPT. QR động · GPS xác thực · Báo cáo theo thời gian thực.</p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row"><a href="#" class="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#0052D4] hover:bg-white/90">Đăng ký tham gia sự kiện ${I("arrow-right")}</a><a href="#" class="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 px-6 text-sm font-semibold text-white hover:bg-white/10">Đăng nhập</a></div></div>
          <div class="hidden justify-center lg:flex"><div class="rounded-[40px] bg-white/10 p-6">${logo("size-48")}</div></div></div>
          <div class="border-t border-white/15"><div class="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-4">${[["30 giây", "QR đổi mới mỗi"], ["4 lớp", "Bảo mật chống gian lận"], ["100%", "Không cần cài ứng dụng"], ["Tức thì", "Cập nhật điểm danh"]].map(([n, l]) => `<div><p class="text-xl font-semibold">${n}</p><p class="mt-0.5 text-sm text-white">${l}</p></div>`).join("")}</div></div></section>
        <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6" data-wf-block="3"><h2 class="text-2xl font-semibold text-foreground sm:text-3xl">Mọi thứ bạn cần cho sự kiện</h2><p class="mt-3 max-w-[55ch] text-base/7 text-muted">Từ tạo sự kiện tới báo cáo sau sự kiện, trong một nền tảng.</p>
          <div class="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">${feats.map(([i, t, d, c]) => `<div><div class="flex size-10 items-center justify-center rounded-xl ${c} wf-av">${I(i, "size-5")}</div><h3 class="mt-4 text-base font-semibold text-foreground">${t}</h3><p class="mt-1 text-sm/6 text-pretty text-muted">${d}</p></div>`).join("")}</div></section>
        <section class="bg-background" data-wf-block="4"><div class="mx-auto max-w-6xl px-4 py-16 sm:px-6"><h2 class="text-2xl font-semibold text-foreground sm:text-3xl">Hoạt động như thế nào?</h2>
          <ol class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">${steps.map(([t, d], i) => `<li class="rounded-2xl border border-border bg-surface p-5"><span class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">${i + 1}</span><h3 class="mt-4 text-base font-semibold text-foreground">${t}</h3><p class="mt-1 text-sm/6 text-pretty text-muted">${d}</p></li>`).join("")}</ol></div></section>
        <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6" data-wf-block="5"><h2 class="text-2xl font-semibold text-foreground sm:text-3xl">Dành cho tất cả mọi người</h2>
          <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${[["ADMIN", ["Quản lý toàn bộ người dùng", "Import sinh viên từ Excel", "Xem log gian lận", "Reset thiết bị"]], ["BTC", ["Tạo và quản lý sự kiện", "Chiếu mã QR check-in", "Xem báo cáo theo thời gian thực", "Xuất Excel"]], ["LECTURER", ["Xem danh sách sự kiện", "Theo dõi điểm danh", "Xem thống kê lớp"]], ["STUDENT", ["Đăng ký tham gia sự kiện", "Quét QR check-in, check-out", "Xem sự kiện sắp tới", "Lịch sử tham dự"]]].map(([r, perms]) => `<div class="rounded-2xl border border-border bg-surface p-5">${roleBadge(r)}<ul class="mt-4 space-y-2">${perms.map((x) => `<li class="flex gap-2 text-sm text-foreground">${I("check", "mt-0.5 size-4 shrink-0 text-muted")}${x}</li>`).join("")}</ul></div>`).join("")}</div></section>
        <section class="wf-brandpanel bg-[#0B47C9] bg-[linear-gradient(135deg,#0A3BAA_0%,#1A63F0_100%)] text-white" data-wf-block="6"><div class="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6"><h2 class="text-2xl font-bold text-balance sm:text-3xl">Sẵn sàng triển khai?</h2><p class="mx-auto mt-3 max-w-[55ch] text-base/7 text-pretty text-white">Đăng ký tham gia sự kiện chỉ với họ tên, MSSV và email. Chưa có tài khoản thì hệ thống tự tạo và gửi thông tin đăng nhập cho bạn.</p>
          <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><a href="#" class="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#0052D4] hover:bg-white/90">Đăng ký tham gia sự kiện ${I("arrow-right")}</a><a href="#" class="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 px-6 text-sm font-semibold text-white hover:bg-white/10">Đăng nhập hệ thống</a></div></div></section>
        <footer class="border-t border-border" data-wf-block="7"><div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6"><div class="flex items-center gap-2">${logo("size-6")}<span>© 2026 FPT University</span></div><a href="#" class="inline-flex h-10 items-center hover:text-foreground">Đăng ký tham gia sự kiện</a></div></footer>
      </div>`;
    },
  });

  // Chọn nhiều dòng ở bảng người dùng: tick là thanh hàng loạt thay hàng lọc
  document.addEventListener("change", (e) => {
    if (!e.target.matches("[data-bulk-row], [data-bulk-all]")) return;
    const rows = [...document.querySelectorAll("[data-bulk-row]")];
    if (e.target.matches("[data-bulk-all]")) rows.forEach((r) => (r.checked = e.target.checked));
    const n = rows.filter((r) => r.checked).length;
    const all = document.querySelector("[data-bulk-all]");
    if (all) { all.checked = n === rows.length; all.indeterminate = n > 0 && n < rows.length; }
    document.querySelectorAll("[data-bulk-toolbar]").forEach((t) => (t.hidden = n > 0));
    document.querySelectorAll("[data-bulk-bar]").forEach((b) => { b.hidden = n === 0; b.querySelector("[data-bulk-count]").textContent = n; });
  });
})();
