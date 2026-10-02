// Lõi wireframe: trạng thái theo URL, thanh công cụ, khung lý do, component dựng bằng đúng class sẽ chép
// sang React ở bước dựng thật, khung app (sidebar, header, menu trượt, thanh dưới) và tương tác cơ bản.
(function () {
  const params = new URLSearchParams(location.search);
  const SCREENS = [];
  const WF = (window.WF = { params, SCREENS, state: {} });
  WF.screen = (def) => SCREENS.push(def);

  const cx = (...parts) => parts.flat().filter(Boolean).join(" ");
  const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const I = (name, cls = "size-4 shrink-0") => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
  Object.assign(WF, { cx, esc, I });

  // ---------- Nút (components/button.md) ----------
  const BTN_BASE = "inline-flex cursor-pointer items-center justify-center gap-2 text-sm font-medium leading-tight text-center outline-hidden transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const BTN_SIZE = {
    md: "min-h-10 rounded-xl px-4 py-2",
    form: "min-h-11 md:min-h-10 rounded-xl px-4 py-2",
    hdr: "h-9 rounded-lg px-3",
    sm: "h-8 rounded-lg px-3",
    auth: "h-12 rounded-xl px-4",
  };
  const BTN_VARIANT = {
    outline: "border border-border-strong bg-surface text-foreground hover:bg-button-hover",
    primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
    secondary: "bg-secondary text-foreground hover:bg-secondary-hover",
    ghost: "bg-transparent text-muted hover:bg-foreground/5 hover:text-foreground",
    danger: "bg-danger-bg text-danger hover:bg-danger-bg-hover",
  };
  WF.btn = (label, { v = "outline", icon = null, size = "md", cls = "", attrs = "", iconCls = "size-4 shrink-0" } = {}) =>
    `<button type="button" class="${cx(BTN_BASE, BTN_SIZE[size], BTN_VARIANT[v], cls)}" ${attrs}>${icon ? I(icon, iconCls) : ""}${label}</button>`;
  WF.linkBtn = (label, href = "#", opts = {}) =>
    WF.btn(label, opts).replace("<button type=\"button\"", `<a href="${href}"`).replace("</button>", "</a>");
  WF.iconBtn = (icon, label, { row = false, cls = "", size = "size-8", attrs = "" } = {}) =>
    `<button type="button" aria-label="${esc(label)}" title="${esc(label)}" class="${cx(
      "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted outline-hidden transition-colors hover:text-foreground",
      size,
      row ? "hover:bg-foreground/8 aria-expanded:bg-foreground/8" : "hover:bg-foreground/5 aria-expanded:bg-foreground/5",
      cls,
    )}" ${attrs}>${I(icon)}</button>`;
  // Link chữ "Xem tất cả" (I7)
  WF.viewAll = (label = "Xem tất cả", href = "#") =>
    `<a href="${href}" class="inline-flex h-8 items-center text-sm font-medium whitespace-nowrap text-foreground/70 underline-offset-4 outline-hidden transition-colors hover:text-foreground hover:underline">${label}</a>`;

  // ---------- Badge trạng thái (M7, D2): một bảng cho cả app ----------
  const TONE = {
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    error: "bg-error-bg text-error-strong",
    neutral: "bg-neutral-bg text-neutral",
    info: "bg-info-bg text-info",
    violet: "bg-cat-violet-bg text-cat-violet",
    teal: "bg-cat-teal-bg text-cat-teal",
    pink: "bg-cat-pink-bg text-cat-pink",
  };
  WF.badge = (tone, label, { icon = null } = {}) =>
    `<span class="${cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/5 dark:ring-white/10", TONE[tone])}">${
      icon ? I(icon, "size-3.5 shrink-0") : `<span class="size-1.5 rounded-full bg-current"></span>`
    }${label}</span>`;
  WF.ATT = {
    REGISTERED: ["neutral", "Đã đăng ký", "circle"],
    CHECKED_IN: ["info", "Đã check-in", "log-in"],
    CHECKED_OUT: ["success", "Đã check-out", "circle-check"],
    ABSENT: ["error", "Vắng", "circle-x"],
  };
  WF.EVT = {
    live: ["success", "Đang diễn ra", null],
    upcoming: ["neutral", "Sắp diễn ra", "clock"],
    manual: ["neutral", "Chưa đặt lịch", "circle-dashed"],
    ended: ["neutral", "Đã kết thúc", "check"],
  };
  WF.ROLE = { ADMIN: ["violet", "Admin"], BTC: ["teal", "Ban tổ chức"], LECTURER: ["pink", "Giảng viên"], STUDENT: ["neutral", "Sinh viên"] };
  WF.attBadge = (status) => { const [t, l, i] = WF.ATT[status]; return WF.badge(t, l, { icon: i }); };
  WF.evtBadge = (status) => { const [t, l, i] = WF.EVT[status]; return WF.badge(t, l, { icon: i }); };
  WF.roleBadge = (role) => { const [t, l] = WF.ROLE[role]; return WF.badge(t, l); };

  // ---------- Avatar chữ cái (components/avatar.md) ----------
  const AV = [
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
    "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30",
    "bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/30",
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-orange-400 dark:ring-amber-500/30",
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  ];
  const hash = (seed) => { let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  WF.avatar = (name, { size = "size-8", seed = name, ring = true } = {}) =>
    `<span class="${cx("wf-av inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold", ring && "ring-1", size, AV[hash(seed) % AV.length])}" aria-hidden="true">${esc(name.trim().charAt(0).toLocaleUpperCase("vi"))}</span>`;

  // ---------- Logo sản phẩm: dấu chữ F của dự án ----------
  let logoId = 0;
  WF.logo = (cls = "size-8") => { const gid = `wfl${++logoId}`; return `<svg viewBox="0 0 64 64" class="${cls} shrink-0" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A6BFF"/><stop offset="1" stop-color="#00A3FF"/></linearGradient></defs><rect class="wf-logo-bg" width="64" height="64" rx="14" fill="url(#${gid})"/><g transform="translate(16.42 14) scale(0.016822)" fill="#fff"><path d="M0 0H1852V378H0Z M1465 837H1852V1224H1465Z M1465 1744H1852V2131H1465Z M1299 840C493 840 0 1332 0 2140H387C387 1558 717 1228 1299 1228Z"/></g></svg>`; };

  // ---------- Ô nhập (components/input.md) ----------
  const INPUT = "w-full h-11 md:h-10 rounded-xl border border-border-strong bg-surface dark:bg-white/4 px-4 text-base md:text-sm text-foreground placeholder:text-muted outline-hidden transition-colors focus:border-focus focus:ring-2 focus:ring-focus";
  WF.INPUT = INPUT;
  let uid = 0;
  WF.field = ({ label, id = `f${++uid}`, placeholder = "", value = "", type = "text", hint = "", error = "", required = false, optional = false, control = null, cls = "", h = "" } = {}) => `
    <div class="${cx("flex flex-col gap-1.5", cls)}">
      <label for="${id}" class="w-fit cursor-pointer text-sm font-medium text-foreground">${label}${required ? ` <span aria-hidden="true" class="text-error-text">*</span>` : ""}${optional ? ` <span class="font-normal text-muted">(không bắt buộc)</span>` : ""}</label>
      ${control || `<input id="${id}" type="${type}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ""} value="${esc(value)}" class="${cx(INPUT, h, error && "border-error focus:border-error focus:ring-error/10")}" />`}
      ${error ? `<p class="min-h-4 text-xs text-error-text">${error}</p>` : hint ? `<p class="text-xs text-muted text-pretty">${hint}</p>` : ""}
    </div>`;
  WF.textarea = ({ label, id = `f${++uid}`, placeholder = "", value = "", rows = 3, hint = "", required = false, optional = false } = {}) =>
    WF.field({
      label, id, hint, required, optional,
      control: `<textarea id="${id}" rows="${rows}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ""} class="w-full rounded-xl border border-border-strong bg-surface dark:bg-white/4 px-4 py-2.5 text-base md:text-sm text-foreground placeholder:text-muted outline-hidden transition-colors focus:border-focus focus:ring-2 focus:ring-focus">${esc(value)}</textarea>`,
    });
  // Ô tìm: chữ trơn, không icon trái (mặc định của skill), có nút × tự dựng khi có chữ
  WF.search = ({ placeholder = "Tìm…", value = "", cls = "" } = {}) => `
    <div class="${cx("relative min-w-0", cls)}">
      <input type="search" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}" value="${esc(value)}" class="${cx(INPUT, "pr-10 [&::-webkit-search-cancel-button]:appearance-none")}" />
      ${value ? `<button type="button" aria-label="Xoá từ khoá" class="absolute inset-y-0 right-1 my-auto inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted outline-hidden hover:bg-foreground/5 hover:text-foreground">${I("x")}</button>` : ""}
    </div>`;

  // ---------- Lớp nổi: dropdown, select (layouts/overlay.md) ----------
  WF.menuItem = (icon, label, { danger = false, check = false, sub = "", href = "#" } = {}) =>
    danger
      ? `<a href="${href}" role="menuitem" class="group flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm text-foreground outline-hidden hover:bg-danger-bg hover:text-danger">${icon ? I(icon, "size-4 shrink-0 text-muted group-hover:text-danger") : ""}${label}</a>`
      : `<a href="${href}" role="menuitem" class="flex ${sub ? "py-2.5" : "h-10"} w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm text-foreground outline-hidden hover:bg-item-hover">${icon ? I(icon, "size-4 shrink-0 text-muted") : ""}<span class="min-w-0 flex-1 text-left">${sub ? `<span class="block font-medium">${label}</span><span class="mt-0.5 block text-muted">${sub}</span>` : label}</span>${check ? I("check", "size-4 shrink-0 text-foreground") : ""}</a>`;
  WF.menuGroups = (...groups) =>
    groups.map((g) => `<div class="px-1">${g.join("")}</div>`).join(`<hr class="my-1 border-border" />`);
  // trigger + panel, panel mở bằng JS (data-dd). align: right | left. up: mở lên trên.
  WF.dropdown = (triggerHtml, panelHtml, { align = "right", up = false, width = "min-w-56", open = false } = {}) => `
    <div class="relative inline-flex" data-dd>
      ${triggerHtml.replace(/^(\s*<(button|a))/, `$1 data-dd-trigger aria-haspopup="menu" aria-expanded="${open}"`)}
      <div role="menu" class="${cx("wf-pop absolute z-40 rounded-2xl border border-border bg-surface-overlay py-1 shadow-popover", width, align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left", up ? "bottom-full mb-2" : "top-full mt-2")}" ${up ? "data-up" : ""} ${open ? "data-open" : ""}>${panelHtml}</div>
    </div>`;
  WF.menuBtn = (label = "Thao tác", { row = false } = {}) => WF.iconBtn("ellipsis", label, { row });
  // Ô chọn dạng nút (Select), không control gốc
  WF.selectBtn = ({ value = "", placeholder = "Chọn…", options = [], cls = "", label = null, id = `s${++uid}`, inline = false, align = "left", up = false, triggerCls = "" } = {}) => {
    const trigger = `<button type="button" id="${id}" role="combobox" class="${cx(
      "group flex h-11 md:h-10 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border-strong bg-surface dark:bg-white/4 px-4 text-left text-base md:text-sm outline-hidden transition-colors focus-visible:border-focus aria-expanded:border-focus aria-expanded:ring-2 aria-expanded:ring-focus",
      inline ? "w-fit" : "w-full",
    )}">${label ? `<span class="shrink-0 text-muted">${label}</span>` : ""}<span class="${cx("truncate", !value && "text-muted")}">${value || placeholder}</span>${I("chevron-down", "ml-auto size-4 shrink-0 text-muted transition-transform group-aria-expanded:rotate-180")}</button>`;
    const panel = `<div class="px-1">${options.map((o) => typeof o === "string" ? WF.menuItem(null, o, { check: o === value }) : WF.menuItem(null, o.label, { check: o.label === value, sub: o.sub || "" })).join("")}</div>`;
    return `<div class="${cx("relative", inline ? "inline-flex" : "flex w-full", cls)}" data-dd>${trigger.replace("<button", `<button data-dd-trigger aria-haspopup="listbox" aria-expanded="false"`).replace('class="group flex h-11 md:h-10', `class="${triggerCls || "h-11 md:h-10"} group flex`).replace(" h-11 md:h-10 cursor-pointer", " cursor-pointer")}<div role="listbox" ${up ? "data-up" : ""} class="${cx("wf-pop absolute z-40 w-full min-w-40 rounded-2xl border border-border bg-surface-overlay py-1 shadow-popover", align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left", up ? "bottom-full mb-2" : "top-full mt-2")}">${panel}</div></div>`;
  };

  // ---------- Tab (components/small-controls.md) ----------
  WF.tabs = (kind, items, active, { group = "t", line = true, cls = "", layout = "fit" } = {}) => {
    const tab = (it) => {
      const value = it.value ?? it.label;
      const sel = value === active;
      const count = it.count !== undefined ? `<span class="text-xs font-normal tabular-nums text-foreground/70">${it.count}</span>` : "";
      if (kind === "underline")
        return `<button type="button" role="tab" aria-selected="${sel}" data-tab="${value}" class="${cx("relative box-content inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2 pb-px text-sm font-medium outline-hidden after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full", sel ? "text-foreground after:bg-foreground" : "text-foreground/70 after:bg-transparent hover:text-foreground")}">${it.label}${count}</button>`;
      if (kind === "segmented")
        return `<button type="button" role="tab" aria-selected="${sel}" data-tab="${value}" class="${cx("inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium outline-hidden transition-[color,background-color,box-shadow] duration-150", it.grow && "flex-1", sel ? "bg-surface text-foreground shadow-(--shadow-segment-thumb)" : "text-foreground/70 hover:text-foreground")}">${it.icon ? I(it.icon) : ""}${it.label}</button>`;
      return `<button type="button" role="tab" aria-selected="${sel}" data-tab="${value}" class="${cx("inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium outline-hidden transition-colors", sel ? "border-transparent bg-secondary text-foreground" : "border-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground")}">${it.label}${count}</button>`;
    };
    if (kind === "segmented")
      return `<div role="tablist" data-tabset="${group}" class="${cx({ fit: "inline-flex w-fit", full: "flex w-full", fullMobile: "flex w-full sm:inline-flex sm:w-fit" }[layout], "max-w-full gap-1 rounded-xl bg-background p-1 shadow-(--shadow-segment-track)", cls)}">${items.map(tab).join("")}</div>`;
    if (kind === "underline")
      return `<div class="scrollbar-clean overflow-x-auto ${cls}"><div role="tablist" data-tabset="${group}" class="${cx("flex min-w-full gap-2 px-2", line && "shadow-[inset_0_-1px_0_var(--border-strong)]")}">${items.map(tab).join("")}</div></div>`;
    return `<div class="scrollbar-clean overflow-x-auto py-0.5 ${cls}"><div role="tablist" data-tabset="${group}" class="flex gap-1 px-1">${items.map(tab).join("")}</div></div>`;
  };

  // ---------- Công tắc, checkbox (components/choice-controls.md) ----------
  WF.switch = (on, { label = "", id = "" } = {}) =>
    `<button type="button" role="switch" aria-checked="${on}" ${id ? `aria-labelledby="${id}"` : `aria-label="${esc(label)}"`} class="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-muted/40 p-0.5 outline-hidden transition-colors before:absolute before:-inset-2 hover:bg-muted/60 aria-checked:bg-primary aria-checked:hover:bg-primary-hover"><span class="size-5 rounded-full bg-surface shadow-sm transition-transform group-aria-checked:translate-x-5 group-aria-checked:bg-primary-foreground motion-reduce:transition-none"></span></button>`;
  WF.checkbox = (checked = false, { label = "", small = false, mixed = false, desc = "", attrs = "", bare = false } = {}) => {
    const box = `<span class="relative inline-flex shrink-0 ${desc ? "mt-0.5" : ""}"><input type="checkbox" ${checked ? "checked" : ""} ${attrs} aria-label="${esc(label || "Chọn")}" class="${cx("peer cursor-pointer appearance-none border-[1.5px] border-border-strong bg-surface outline-hidden transition-colors not-checked:not-indeterminate:hover:border-foreground checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary", small ? "size-4 rounded" : "size-5 rounded-md")}" ${mixed ? 'data-mixed' : ""}/>${I("check", cx("pointer-events-none absolute inset-0 m-auto stroke-[3] text-primary-foreground opacity-0 peer-checked:opacity-100", small ? "size-3" : "size-3.5"))}${I("minus", cx("pointer-events-none absolute inset-0 m-auto stroke-[3] text-primary-foreground opacity-0 peer-indeterminate:opacity-100", small ? "size-3" : "size-3.5"))}</span>`;
    if (bare || !label) return box;
    return `<label class="inline-flex w-fit cursor-pointer ${desc ? "items-start" : "items-center"} gap-3 text-sm">${box}${desc ? `<span class="min-w-0"><span class="block font-medium text-foreground">${label}</span><span class="mt-1 block text-muted text-pretty">${desc}</span></span>` : label}</label>`;
  };

  // ---------- Card (components/card.md) ----------
  WF.card = (body, { title = "", action = "", cls = "", flush = false, block = "", sub = "", tag = "h2" } = {}) => `
    <section class="${cx("flex min-w-0 flex-col rounded-2xl border border-border bg-surface", flush ? "py-4 sm:py-5" : "p-4 sm:p-5", cls)}" ${block ? `data-wf-block="${block}"` : ""}>
      ${title ? `<header class="${cx("flex items-start justify-between gap-3", flush ? "px-4 sm:px-5" : "mb-4", flush && !action && "mb-1.5")}">
        <div class="${cx("flex min-w-0 flex-col justify-center", action && "min-h-10")}"><${tag} class="${tag === "h1" ? "text-lg" : "text-base"} font-semibold text-balance text-foreground">${title}</${tag}>${sub ? `<p class="mt-0.5 text-sm text-muted text-pretty">${sub}</p>` : ""}</div>
        ${action ? `<div class="flex shrink-0 items-center gap-2">${action}</div>` : ""}
      </header>` : ""}
      <div class="${cx("min-h-0 flex-1", flush && "px-2 sm:px-2")}">${body}</div>
    </section>`;

  // Hàng ô số liệu: một khung chia khe 1px (components/charts.md)
  WF.stats = (tiles, { cols = "grid-cols-2 lg:grid-cols-4", small = false, block = "", cls = "" } = {}) => `
    <div class="min-w-0" ${block ? `data-wf-block="${block}"` : ""}><div class="${cx("grid gap-px overflow-hidden rounded-2xl bg-border", cols, cls)}">
      ${tiles.map((t) => `<div class="min-w-0 bg-surface ${small ? "p-4" : "p-4 sm:p-5"}">
        <p class="text-xs font-medium text-muted">${t.label}</p>
        <p class="mt-1 ${small ? "text-lg" : "text-xl sm:text-2xl"} font-semibold tracking-tight tabular-nums text-foreground">${t.value}${t.unit ? `<span class="ml-1 font-semibold text-muted">${t.unit}</span>` : ""}</p>
        ${t.sub ? `<p class="mt-1 truncate text-xs ${t.subTone === "warning" ? "font-medium text-warning" : "text-muted"}">${t.sub}</p>` : ""}
      </div>`).join("")}
    </div></div>`;

  // Phân trang (small-controls.md)
  WF.pagination = ({ from = 1, to = 10, total = 0, noun = "dòng", page = 1, pages = 1 } = {}) => {
    const fmt = (n) => n.toLocaleString("vi-VN");
    const pageBtn = (p) => p === "…"
      ? `<span class="inline-flex h-9 min-w-9 items-center justify-center text-sm text-muted">…</span>`
      : `<button type="button" ${p === page ? 'aria-current="page"' : ""} class="${cx("inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-medium tabular-nums outline-hidden", p === page ? "border-transparent bg-secondary text-foreground" : "border-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground")}">${p}</button>`;
    let win = [];
    if (pages <= 7) win = Array.from({ length: pages }, (_, i) => i + 1);
    else if (page <= 4) win = [1, 2, 3, 4, 5, "…", pages];
    else if (page >= pages - 3) win = [1, "…", pages - 4, pages - 3, pages - 2, pages - 1, pages];
    else win = [1, "…", page - 1, page, page + 1, "…", pages];
    return `<div class="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
      <p class="text-sm tabular-nums text-muted"><span class="hidden sm:inline">${fmt(from)} tới ${fmt(to)} trong </span>${fmt(total)} ${noun}</p>
      ${pages > 1 ? `<nav aria-label="Phân trang" class="flex shrink-0 items-center gap-1">
        ${WF.iconBtn("chevron-left", "Trang trước", { size: "size-9", attrs: page === 1 ? "disabled" : "", cls: "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" })}
        <span class="hidden items-center gap-1 sm:flex">${win.map(pageBtn).join("")}</span>
        <span class="text-sm tabular-nums text-foreground sm:hidden">${page} / ${pages}</span>
        ${WF.iconBtn("chevron-right", "Trang sau", { size: "size-9" })}
      </nav>` : ""}
    </div>`;
  };

  WF.empty = (text, extra = "") => `<p class="py-6 text-center text-sm text-muted text-pretty">${text}${extra}</p>`;
  WF.loadError = (title, reason = "Máy chủ có thể đang khởi động lại, thử lại sau vài giây.") => `
    <div role="alert" class="flex flex-col items-center gap-3 py-10 text-center">
      <div><p class="text-sm font-medium text-error-text">${title}</p><p class="mt-1 text-sm text-muted">${reason}</p></div>
      ${WF.btn("Thử lại", { icon: "rotate-cw" })}
    </div>`;
  WF.skel = (w = "w-2/5", h = "h-3") => `<div class="${cx(h, w, "animate-pulse rounded-full bg-foreground/5 motion-reduce:animate-none")}"></div>`;
  WF.skelRows = (n = 6, { avatar = true, right = true } = {}) =>
    `<ul aria-busy="true" class="divide-y divide-border">${Array.from({ length: n }, (_, i) => `<li class="flex items-center gap-3 px-4 py-3">
      ${avatar ? `<div class="size-8 shrink-0 animate-pulse rounded-full bg-foreground/5"></div>` : ""}
      <div class="min-w-0 flex-1 space-y-2">${WF.skel(["w-2/5", "w-1/2", "w-1/3", "w-3/5"][i % 4])}${WF.skel(["w-1/4", "w-1/5", "w-1/3", "w-1/4"][i % 4])}</div>
      ${right ? WF.skel("w-16") : ""}</li>`).join("")}</ul><span class="sr-only" role="status">Đang tải</span>`;

  // Ô ngày (tile ngày đầu dòng sự kiện): ngày to, tháng nhỏ
  WF.dateTile = (e, { live = false } = {}) =>
    e.day
      ? `<div class="${cx("flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none", live ? "bg-primary text-primary-foreground" : "bg-background text-foreground group-hover:bg-surface")}"><span class="text-base font-semibold tabular-nums">${e.day}</span><span class="${cx("mt-1 text-xs font-medium", live ? "text-primary-foreground/80" : "text-muted")}">${e.mon}</span></div>`
      : `<div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background text-muted group-hover:bg-surface">${I("calendar-clock", "size-5")}</div>`;

  // ---------- Khung app ----------
  const NAV = {
    ADMIN: [
      ["tong-quan", "layout-dashboard", "Tổng quan"], ["su-kien", "calendar-days", "Sự kiện"], ["lop-hoc", "graduation-cap", "Lớp học"],
      ["mau-danh-gia", "clipboard-list", "Mẫu đánh giá"], ["nguoi-dung", "users", "Người dùng"], ["gian-lan", "shield-alert", "Log gian lận"],
    ],
    STUDENT: [["trang-chu-sv", "house", "Trang chủ"], ["lich-su", "history", "Lịch sử tham dự"], ["chung-nhan", "award", "Chứng nhận"]],
  };
  const navLink = ([id, icon, label], active) =>
    `<a href="?${WF.link({ man: id })}" ${id === active ? 'aria-current="page"' : ""} class="${cx(
      "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-hidden transition-colors",
      id === active ? "bg-primary font-medium text-primary-foreground" : "text-foreground/70 hover:bg-item-hover hover:text-foreground",
    )}">${I(icon)}<span class="min-w-0 flex-1 truncate">${label}</span></a>`;
  const accountMenu = (user, roleLabel) => WF.menuGroups(
    [`<div class="px-3 py-2"><p class="text-xs text-muted">${roleLabel}</p><p class="flex min-w-0 text-xs text-muted" title="${user.email}"><span class="min-w-0 truncate">${user.email.split("@")[0]}</span><span class="shrink-0">@${user.email.split("@")[1]}</span></p></div>`],
    [`<p class="px-3 pt-1 pb-1 text-xs font-medium text-muted">Giao diện</p>`, WF.menuItem("sun", "Sáng"), WF.menuItem("moon", "Tối"), WF.menuItem("monitor", "Theo hệ thống", { check: true })],
    [WF.menuItem("log-out", "Đăng xuất", { danger: true })],
  );
  const profileRow = (user, roleLabel) => WF.dropdown(
    `<button type="button" class="flex h-10 w-full cursor-pointer items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-xl px-1 text-left outline-hidden hover:bg-item-hover aria-expanded:bg-item-hover">${WF.avatar(user.name, { ring: false })}<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">${user.name}</span>${I("chevrons-up-down", "size-4 shrink-0 text-muted")}</button>`,
    accountMenu(user, roleLabel),
    { align: "left", up: true, width: "w-full min-w-0" },
  ).replace('class="relative inline-flex"', 'class="relative flex w-full"');

  WF.sidebarInner = (role, active) => {
    const user = role === "STUDENT" ? WFD.student : WFD.admin;
    const roleLabel = role === "STUDENT" ? `Sinh viên · ${WFD.student.mssv}` : "Admin";
    return `
      <div class="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4">${WF.logo()}<span class="text-sm font-semibold text-foreground">FPT Event</span></div>
      <nav aria-label="Điều hướng chính" class="flex flex-1 flex-col gap-1 overflow-y-auto p-3">${NAV[role].map((n) => navLink(n, active)).join("")}</nav>
      <div class="shrink-0 p-3">${profileRow(user, roleLabel)}</div>`;
  };

  // shell: role ADMIN | STUDENT. title: tên trang (h1) hoặc parent: cấp cha (link) khi trang có đầu trang riêng.
  WF.shell = ({ role = "ADMIN", active, title = "", parent = null, headerRight = "", content = "", bottomNav = false }) => {
    const mobileLeft = bottomNav
      ? `<span class="flex items-center gap-2 lg:hidden">${WF.logo("size-7")}</span>`
      : `<button type="button" data-wf-menu aria-label="Mở menu" class="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-foreground/70 outline-hidden hover:bg-foreground/5 hover:text-foreground lg:hidden">${I("menu", "size-5")}</button>`;
    const headTitle = parent
      ? `<nav aria-label="Đường dẫn" class="min-w-0"><a href="?${WF.link({ man: parent.man })}" class="inline-flex h-10 max-w-48 items-center gap-1 text-sm text-muted outline-hidden hover:text-foreground sm:h-8">${I("chevron-left", "size-4 shrink-0 sm:hidden")}<span class="truncate">${parent.label}</span></a></nav>`
      : `<h1 class="min-w-0 truncate text-base font-semibold text-foreground">${title}</h1>`;
    const user = role === "STUDENT" ? WFD.student : WFD.admin;
    const mobileAccount = bottomNav ? `<span class="lg:hidden">${WF.dropdown(`<button type="button" aria-label="Tài khoản" class="inline-flex size-10 cursor-pointer items-center justify-center rounded-full outline-hidden">${WF.avatar(user.name, { ring: false })}</button>`, accountMenu(user, `Sinh viên · ${WFD.student.mssv}`), { width: "w-72" })}</span>` : "";
    return `
    <div class="flex min-h-screen w-full">
      <aside class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-surface dark:border-r dark:border-border lg:flex" data-wf-block="1">${WF.sidebarInner(role, active)}</aside>
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="${cx("sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface pr-4 sm:pr-6 lg:pl-6", bottomNav ? "pl-4 sm:pl-6" : "pl-2 sm:pl-4")}" data-wf-block="2">
          ${mobileLeft}${headTitle}
          <div class="ml-auto flex shrink-0 items-center gap-2">${headerRight}${mobileAccount}</div>
        </header>
        <main class="${cx("min-w-0 flex-1 p-4 sm:p-6", bottomNav && "pb-24 lg:pb-6")}">${content}</main>
      </div>
      ${bottomNav ? WF.bottomNav(active) : ""}
      <div class="wf-drawer-overlay fixed inset-0 z-40 bg-black/15 lg:hidden" data-wf-menu-close></div>
      <aside class="wf-drawer fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-56px)] flex-col bg-surface shadow-modal dark:border-r dark:border-border lg:hidden" aria-label="Menu">
        <button type="button" class="sr-only" data-wf-menu-close>Đóng menu</button>
        ${WF.sidebarInner(role, active)}
      </aside>
    </div>`;
  };
  WF.bottomNav = (active) => `
    <nav aria-label="Điều hướng chính" class="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" data-wf-block="9">
      ${NAV.STUDENT.map(([id, icon, label]) => `<a href="?${WF.link({ man: id })}" ${id === active ? 'aria-current="page"' : ""} class="${cx("flex flex-col items-center justify-center gap-1 text-xs outline-hidden", id === active ? "font-medium text-primary" : "text-muted")}">${I(icon, "size-5")}<span>${label === "Lịch sử tham dự" ? "Lịch sử" : label}</span></a>`).join("")}
    </nav>`;

  // ---------- Trạng thái URL, thanh công cụ, khung lý do ----------
  WF.link = (patch) => new URLSearchParams({ ...WF.state, ...patch, ...(patch.man ? { v: "" } : {}) }).toString().replace(/&v=(&|$)/, "$1");

  WF.boot = () => {
    const state = WF.state;
    const first = SCREENS[0];
    state.man = params.get("man") || first.id;
    const screen = SCREENS.find((s) => s.id === state.man) || first;
    state.man = screen.id;
    state.v = params.get("v") || screen.rec || screen.options[0];
    if (!screen.options.includes(state.v)) state.v = screen.rec || screen.options[0];
    state.mau = params.get("mau") || "xam";
    state.toi = params.get("toi") || "0";
    state.kho = params.get("kho") || "desktop";
    state.nav = params.get("nav") || screen.recNav || "menu";
    state.tt = params.get("tt") || "du-lieu";
    const isFrame = params.has("frame");

    document.documentElement.dataset.mau = state.mau;
    document.documentElement.classList.toggle("dark", state.toi === "1");
    Object.assign(document.body.dataset, { kho: state.kho, nav: state.nav, tt: state.tt });
    if (isFrame) document.body.dataset.frame = "1";
    if (!screen.nav) document.body.dataset.nonav = "1";

    buildToolbar(screen);
    buildReason(screen);

    const design = document.getElementById("wf-design");
    if (state.kho === "mobile" && !isFrame) {
      const src = `?${new URLSearchParams({ ...state, kho: "desktop", frame: "1" })}`;
      design.innerHTML = `<div style="display:grid;place-items:center;padding:24px"><iframe src="${src}" title="Mobile" style="width:375px;height:812px;border:1px solid #ddd;border-radius:24px;background:#fff"></iframe></div>`;
    } else {
      design.innerHTML = screen.render(state.v, state.tt, state);
    }
    wire();
    if (window.lucide) lucide.createIcons();
    new MutationObserver(() => { if (document.querySelector("i[data-lucide]")) lucide.createIcons(); }).observe(document.body, { childList: true, subtree: true });
    requestAnimationFrame(() => requestAnimationFrame(placeBlockNumbers));
    addEventListener("resize", placeBlockNumbers);
  };

  const svgChevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  function setLinks(container, param, values) {
    return values.map((v) => `<a data-value="${v.value}" href="?${WF.link({ [param]: v.value })}" ${WF.state[param] === v.value ? 'aria-current="page"' : ""} ${v.title ? `title="${esc(v.title)}"` : ""} ${v.rec ? "data-recommended" : ""} ${v.aria ? `aria-label="${v.aria}"` : ""}>${v.html ?? v.label}</a>`).join("");
  }
  function buildToolbar(screen) {
    const s = WF.state;
    const groups = {};
    SCREENS.forEach((sc) => { (groups[sc.group] ||= []).push(sc); });
    const manMenu = `<details class="wf-menu" data-menu="man"><summary><span>Màn:</span><b>${screen.short || screen.label}</b>${svgChevron}</summary>
      <div class="wf-popover">${Object.entries(groups).map(([g, list]) => `<p class="wf-pop-label">${g}</p>${list.map((sc) => `<a href="?${WF.link({ man: sc.id })}" ${sc.id === s.man ? 'aria-current="page"' : ""}>${sc.label}${sc.options.length > 1 ? ` <span style="margin-left:auto;padding-left:16px;color:#a3a3a3">${sc.options.length} phương án</span>` : ""}</a>`).join("")}`).join("")}</div></details>`;
    const opt = screen.options.length > 1 || true
      ? `<div class="wf-group"><span>Phương án</span><span class="wf-set" data-wf-param="v">${setLinks(null, "v", screen.options.map((o) => ({ value: o, label: o.toUpperCase(), title: screen.reasons[o]?.name, rec: o === screen.rec && screen.options.length > 1 })))}</span></div>`
      : "";
    const sw = (param, label, on, off) => `<a class="wf-switch" role="switch" aria-checked="${s[param] === on}" href="?${WF.link({ [param]: s[param] === on ? off : on })}">${label} <i></i></a>`;
    const kho = `<span class="wf-set" data-wf-param="kho">${setLinks(null, "kho", [
      { value: "desktop", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Desktop` },
      { value: "mobile", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>Mobile` },
    ])}</span>`;
    const nav = `<span class="wf-set" data-wf-param="nav">${setLinks(null, "nav", [{ value: "menu", label: "☰ Menu" }, { value: "duoi", label: "Thanh dưới" }])}</span>`;
    const ttLabels = { "du-lieu": "Có dữ liệu", "dang-tai": "Đang tải", rong: "Rỗng", loi: "Lỗi" };
    const ttNames = screen.states || ttLabels;
    const tt = `<details class="wf-menu" data-menu="tt"><summary><span>Trạng thái:</span><b>${ttNames[s.tt] || ttLabels[s.tt]}</b>${svgChevron}</summary>
      <div class="wf-popover">${Object.keys(ttLabels).filter((k) => ttNames[k]).map((k) => `<a href="?${WF.link({ tt: k })}" ${k === s.tt ? 'aria-current="page"' : ""}>${ttNames[k]}</a>`).join("")}</div></details>`;
    document.getElementById("wf-bar").innerHTML = [manMenu, opt, sw("mau", "Màu", "mau", "xam"), sw("toi", "Tối", "1", "0"), kho, nav, tt].join("");
    document.querySelectorAll(".wf-menu").forEach((menu) => {
      menu.addEventListener("toggle", () => {
        const r = menu.querySelector("summary").getBoundingClientRect();
        Object.assign(menu.querySelector(".wf-popover").style, { top: `${r.bottom + 6}px`, left: `${r.left}px` });
        if (menu.open) document.querySelectorAll(".wf-menu").forEach((m) => { if (m !== menu) m.open = false; });
      });
    });
    document.addEventListener("click", (e) => document.querySelectorAll(".wf-menu").forEach((m) => { if (!m.contains(e.target)) m.open = false; }));
  }
  function buildReason(screen) {
    const r = screen.reasons[WF.state.v];
    const copyIcon = `<svg data-icon="chep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><svg data-icon="da-chep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
    const isRec = WF.state.v === screen.rec && screen.options.length > 1;
    document.getElementById("wf-reason").innerHTML = `
      <summary><span class="wf-reason-name">${WF.state.v.toUpperCase()} · ${r.name}</span>${isRec ? `<span class="wf-reason-tag">Khuyên dùng</span>` : ""}<span class="wf-reason-why">${r.why}</span><span class="wf-reason-toggle"><span>Ưu, nhược</span>${svgChevron}</span></summary>
      <div class="wf-reason-body">
        <div class="wf-reason-cols">
          <section><h3><i data-tone="uu"></i>Ưu</h3><ul>${r.pros.map((p) => `<li>${p}</li>`).join("")}</ul></section>
          <section><h3><i data-tone="nhuoc"></i>Nhược</h3><ul>${r.cons.map((p) => `<li>${p}</li>`).join("")}</ul></section>
          <section><h3><i></i>Hợp khi</h3><p>${r.fit}</p></section>
        </div>
        <div class="wf-reason-tips"><h3>Gợi ý góp ý</h3>${r.tips.map((t) => `<button type="button" data-copy="${esc(t)}">${t}${copyIcon}</button>`).join("")}</div>
      </div>`;
    document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); } catch {}
      b.setAttribute("data-copied", ""); setTimeout(() => b.removeAttribute("data-copied"), 1500);
    }));
  }

  // ---------- Tương tác trong bản thiết kế ----------
  function closeAllPops(except) {
    document.querySelectorAll("[data-dd]").forEach((dd) => {
      if (dd === except) return;
      dd.querySelector(".wf-pop")?.removeAttribute("data-open");
      dd.querySelector("[data-dd-trigger]")?.setAttribute("aria-expanded", "false");
    });
  }
  function wire() {
    const root = document.getElementById("wf-design");
    root.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-dd-trigger]");
      if (trigger) {
        e.preventDefault();
        const dd = trigger.closest("[data-dd]");
        const pop = dd.querySelector(".wf-pop");
        const isOpen = pop.hasAttribute("data-open");
        closeAllPops(dd);
        pop.toggleAttribute("data-open", !isOpen);
        trigger.setAttribute("aria-expanded", String(!isOpen));
        return;
      }
      if (e.target.closest(".wf-pop a")) { e.preventDefault(); closeAllPops(); return; }
      if (!e.target.closest("[data-dd]")) closeAllPops();
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        const set = tab.closest("[data-tabset]");
        const group = set.dataset.tabset;
        set.querySelectorAll("[data-tab]").forEach((t) => {
          const sel = t === tab;
          t.setAttribute("aria-selected", String(sel));
          const swap = (a, b) => { a.split(" ").forEach((c) => t.classList.toggle(c, sel)); b.split(" ").forEach((c) => t.classList.toggle(c, !sel)); };
          if (t.className.includes("after:absolute")) swap("text-foreground after:bg-foreground", "text-foreground/70 after:bg-transparent");
          else if (t.className.includes("h-8")) swap("bg-surface text-foreground shadow-(--shadow-segment-thumb)", "text-foreground/70");
          else swap("bg-secondary text-foreground", "text-foreground/70");
        });
        document.querySelectorAll(`[data-tabpanel^="${group}:"]`).forEach((p) => { p.hidden = p.dataset.tabpanel !== `${group}:${tab.dataset.tab}`; });
        requestAnimationFrame(placeBlockNumbers);
      }
      const sw = e.target.closest('[role="switch"]');
      if (sw) sw.setAttribute("aria-checked", String(sw.getAttribute("aria-checked") !== "true"));
      if (e.target.closest("[data-wf-menu]")) document.body.toggleAttribute("data-menu-open", true);
      if (e.target.closest("[data-wf-menu-close]")) document.body.removeAttribute("data-menu-open");
      if (e.target.closest("a[href='#']")) e.preventDefault();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeAllPops();
      document.body.removeAttribute("data-menu-open");
      document.querySelectorAll(".wf-menu").forEach((m) => (m.open = false));
    });
    document.querySelectorAll("input[data-mixed]").forEach((i) => (i.indeterminate = true));
    const fade = (el) => {
      const left = el.scrollLeft > 0, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.style.maskImage = left || right ? `linear-gradient(to right, ${left ? "transparent, #000 32px" : "#000"}, ${right ? "#000 calc(100% - 32px), transparent" : "#000"})` : "";
    };
    document.querySelectorAll(".scrollbar-clean.overflow-x-auto").forEach((el) => {
      fade(el); el.addEventListener("scroll", () => fade(el), { passive: true }); new ResizeObserver(() => fade(el)).observe(el);
    });
  }

  function placeBlockNumbers() {
    const isOverlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const block of document.querySelectorAll("[data-wf-block]")) {
      const br = block.getBoundingClientRect();
      const nr = { left: br.left + 4, top: br.top + 4, right: br.left + 22, bottom: br.top + 22 };
      const rects = [...block.querySelectorAll("svg, img, input, textarea")].map((n) => n.getBoundingClientRect());
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...range.getClientRects());
      }
      block.toggleAttribute("data-wf-block-out", rects.some((r) => r.width > 0 && isOverlap(r, nr)));
    }
  }
  WF.placeBlockNumbers = placeBlockNumbers;
})();
