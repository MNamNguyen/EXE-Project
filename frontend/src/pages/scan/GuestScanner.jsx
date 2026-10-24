import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  Camera, CameraOff, CircleCheck, CircleX, Clock, RotateCw, ScanLine, Search, TriangleAlert, UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import { Field, Input, SearchInput } from '../../components/ui/Input';
import { EmptyText, SkeletonRows } from '../../components/ui/States';
import { cx } from '../../utils/cx';
import useQrCamera from './useQrCamera';

// Màn quét thiệp mời ở cửa — dùng chung cho BTC (đăng nhập) và tình nguyện viên (link
// quét). Trang gọi truyền `api` (cùng hình dạng cho cả hai, xem GuestScanPage /
// VolunteerScan) nên hai nơi luôn cùng luật, cùng giao diện. Dữ liệu khách ở link
// quét đã được server che SĐT/email — màn này chỉ hiển thị đúng thứ nhận được.
//
// api: { summary(), scan(code), search(q), checkIn(guestId), walkIn({ name, phone, email, ticketCount }) }
//
// Một thiệp có thể mang nhiều vé (người đặt hộ người thân): quét một lần là cả nhóm vào,
// nên thẻ kết quả hiện to số người + ghế để người đứng cửa đếm và chỉ chỗ.

const RESULT_TTL = { success: 2500, warning: 5000, error: 5000 };
// Cùng một thiệp còn nằm trước camera thì khung hình nào cũng đọc ra. Cửa sổ TRƯỢT:
// mỗi lần còn thấy lại thiệp đó thì gia hạn, nên khách cầm thiệp đứng yên không bị
// báo "đã check-in" ngay sau "mời vào"; phải đưa thiệp ra khỏi khung một lúc rồi quét
// lại mới tính là lượt mới. Dài hơn thời gian hiện kết quả lâu nhất (thẻ cảnh báo/lỗi
// tạm ngừng giải mã nên không có lần "thấy lại" nào để gia hạn).
const SAME_CODE_MS = 6000;
const SUMMARY_POLL_MS = 10000;

const ERROR_TITLES = {
  ALREADY_CHECKED_IN: 'Đã check-in rồi',
  GUEST_NOT_FOUND: 'Không tìm thấy thiệp',
  WRONG_EVENT: 'Thiệp của sự kiện khác',
  INVALID_CODE: 'Không phải thiệp mời',
  GUEST_EXISTS: 'Khách đã có trong danh sách',
  INVALID_GUEST: 'Thông tin chưa hợp lệ',
};

const hhmm = (d) => (d ? format(new Date(d), 'HH:mm') : '');

// "5 người · F06, F07, …" — gọn cho danh sách; '' với khách 1 vé không ghế.
function groupText(g) {
  if (!g) return '';
  const people = g.ticketCount > 1 ? `${g.ticketCount} người` : '';
  return [people, g.seats?.length ? g.seats.join(', ') : ''].filter(Boolean).join(' · ');
}

// Tiếng bíp ngắn: người đứng cửa không phải nhìn màn hình mới biết quét được hay chưa.
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* trình duyệt không có Web Audio — bỏ qua tiếng */ }
}
function beep(kind) {
  navigator.vibrate?.(kind === 'success' ? 80 : [60, 60, 60]);
  if (!audioCtx) return;
  const tones = kind === 'success' ? [[880, 0, 0.12]] : [[330, 0, 0.12], [330, 0.18, 0.12]];
  for (const [freq, at, dur] of tones) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + at);
    osc.stop(audioCtx.currentTime + at + dur);
  }
}

// Kết quả từ API (thành công hoặc lỗi) → thẻ kết quả.
function toResult(res, err) {
  if (res) {
    const g = res.guest;
    return {
      tone: 'success',
      title: g?.isWalkIn ? 'Đã thêm và check-in' : 'Mời vào',
      guest: g,
      detail: g?.isWalkIn ? 'Khách tại chỗ' : 'Khách mời',
    };
  }
  const data = err?.response?.data;
  if (!data) return { tone: 'error', title: 'Lỗi kết nối', detail: 'Không gửi được lên máy chủ. Kiểm tra mạng rồi thử lại.' };
  const tone = data.error === 'ALREADY_CHECKED_IN' || data.error === 'GUEST_EXISTS' ? 'warning' : 'error';
  return { tone, title: ERROR_TITLES[data.error] || 'Không check-in được', detail: data.message, guest: data.guest, error: data.error };
}

const TONES = {
  success: { box: 'bg-success-bg', icon: CircleCheck, iconCls: 'text-success' },
  warning: { box: 'bg-warning-bg', icon: TriangleAlert, iconCls: 'text-warning' },
  error: { box: 'bg-error-bg', icon: CircleX, iconCls: 'text-error-strong' },
};

function ResultCard({ result, onDismiss, onCheckInExisting, className }) {
  const t = TONES[result.tone];
  const Icon = t.icon;
  const g = result.guest;
  const contact = [g?.phone, g?.email].filter(Boolean).join(' · ');
  return (
    <div role="status" aria-live="assertive" className={cx('rounded-2xl p-4 sm:p-5', t.box, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cx('mt-0.5 size-7 shrink-0', t.iconCls)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm font-semibold', t.iconCls)}>{result.title}</p>
          {g?.name && <p className="mt-1 text-balance text-2xl font-semibold text-foreground">{g.name}</p>}
          {g && (g.ticketCount > 1 || g.seats?.length > 0) && (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {g.ticketCount || 1} <span className="text-sm font-medium text-foreground/70">người</span>
              </p>
              {g.seats?.length > 0 && (
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  <span className="text-sm font-medium text-foreground/70">Ghế </span>{g.seats.join(', ')}
                </p>
              )}
            </div>
          )}
          {contact && <p className="mt-1 truncate text-sm tabular-nums text-foreground/70">{contact}</p>}
          {result.tone === 'success'
            ? <p className="mt-1 text-sm text-foreground/70">{result.detail}</p>
            : <p className="mt-1 text-pretty text-sm text-foreground/80">{result.detail}</p>}
          {g?.checkedInBy && result.tone === 'warning' && g.checkedInAt && (
            <p className="mt-1 text-xs text-foreground/60">Người check-in: {g.checkedInBy}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.error === 'GUEST_EXISTS' && g && !g.checkedInAt && (
          <Button variant="primary" size="form" onClick={() => onCheckInExisting(g)}>Check-in khách này</Button>
        )}
        <Button size="form" onClick={onDismiss}>{result.tone === 'success' ? 'Quét tiếp' : 'Đóng'}</Button>
      </div>
    </div>
  );
}

export default function GuestScanner({ api, onFatal }) {
  const [tab, setTab] = useState('scan');
  const [summary, setSummary] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const lastRef = useRef({ code: null, at: 0 });
  const resultTimer = useRef(null);
  const busyRef = useRef(false);

  const loadSummary = useCallback(() => api.summary()
    .then(({ data }) => setSummary(data.data))
    .catch((err) => onFatal?.(err)), [api, onFatal]);

  useEffect(() => {
    loadSummary();
    const t = setInterval(loadSummary, SUMMARY_POLL_MS);
    return () => clearInterval(t);
  }, [loadSummary]);

  const showResult = useCallback((r) => {
    clearTimeout(resultTimer.current);
    setResult(r);
    beep(r.tone === 'success' ? 'success' : 'error');
    // "Khách đã có trong danh sách" chờ người quét đối chiếu rồi tự bấm — không tự tắt.
    if (r.error !== 'GUEST_EXISTS') resultTimer.current = setTimeout(() => setResult(null), RESULT_TTL[r.tone]);
  }, []);
  const dismiss = () => { clearTimeout(resultTimer.current); setResult(null); };
  useEffect(() => () => clearTimeout(resultTimer.current), []);

  // Mọi thao tác ghi đi qua đây: chặn bấm/quét chồng, hiện kết quả, làm mới số liệu.
  const run = useCallback(async (call) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      const { data } = await call();
      showResult(toResult(data));
      return data;
    } catch (err) {
      if (err.response?.data?.error === 'SCANNER_NOT_FOUND') onFatal?.(err);
      showResult(toResult(null, err));
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
      loadSummary();
    }
  }, [showResult, loadSummary, onFatal]);

  const onDecode = useCallback((text) => {
    const now = Date.now();
    const same = text === lastRef.current.code && now - lastRef.current.at < SAME_CODE_MS;
    lastRef.current = { code: text, at: now };
    if (same) return;
    run(() => api.scan(text));
  }, [api, run]);

  // Thẻ "Mời vào" không chặn camera: khách sau đưa thiệp là quét luôn, thẻ mới thay thẻ
  // cũ — hàng người ở cửa không phải chờ thẻ tự tắt. Thẻ cảnh báo/lỗi thì vẫn dừng để
  // người đứng cửa kịp đọc.
  const holdCamera = Boolean(result) && result.tone !== 'success';
  const camera = useQrCamera({ onDecode, paused: busy || holdCamera || tab !== 'scan' });
  const { start: startCamera, stop: stopCamera, status: cameraStatus } = camera;

  // Bật camera khi ở tab quét, tắt khi rời đi (đỡ pin, tắt đèn camera).
  useEffect(() => {
    if (tab === 'scan') startCamera();
    else stopCamera();
  }, [tab, startCamera, stopCamera]);

  // Check-in từ thẻ "khách đã có" ở tab Tại chỗ xong thì làm trống form (key mới).
  const [walkInKey, setWalkInKey] = useState(0);
  const checkInGuest = async (g) => {
    const ok = await run(() => api.checkIn(g.id));
    if (ok && tab === 'walkin') setWalkInKey((k) => k + 1);
  };

  const stats = summary?.stats;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-balance text-lg font-semibold text-foreground">{summary?.event?.name || 'Quét thiệp mời'}</h1>
          {summary?.event?.startsAt && (
            <p className="mt-0.5 text-sm tabular-nums text-muted">
              {format(new Date(summary.event.startsAt), 'HH:mm · dd/MM/yyyy')} · {summary.event.location}
            </p>
          )}
        </div>
        {stats && (
          <p className="text-sm tabular-nums text-muted">
            Đã tới <span className="text-lg font-semibold text-foreground">{stats.ticketsCheckedIn ?? stats.checkedIn}</span>/{stats.tickets ?? stats.total} người
            {stats.walkIns > 0 && <span> · {stats.walkIns} tại chỗ</span>}
          </p>
        )}
      </div>

      <Tabs
        variant="segmented"
        layout="full"
        ariaLabel="Cách check-in"
        value={tab}
        onChange={(v) => { dismiss(); setTab(v); }}
        items={[
          { value: 'scan', label: 'Quét thiệp', icon: ScanLine, grow: true },
          { value: 'search', label: 'Tìm khách', icon: Search, grow: true },
          { value: 'walkin', label: 'Tại chỗ', icon: UserPlus, grow: true },
        ]}
      />

      {tab === 'scan' && (
        <div className="relative overflow-hidden rounded-2xl bg-black" onPointerDown={unlockAudio}>
          <video ref={camera.videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
          {cameraStatus === 'running' && !result && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-3/5 max-h-[70%] rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              <p className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                {busy ? 'Đang kiểm tra…' : 'Đưa mã QR trên thiệp vào khung'}
              </p>
            </div>
          )}
          {cameraStatus !== 'running' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              {cameraStatus === 'starting' && <><Camera className="size-8 animate-pulse" aria-hidden="true" /><p className="text-sm">Đang mở camera…</p></>}
              {cameraStatus === 'idle' && (
                <Button variant="primary" size="form" icon={Camera} onClick={() => { unlockAudio(); startCamera(); }}>Bật camera</Button>
              )}
              {['denied', 'unsupported', 'error'].includes(cameraStatus) && (
                <>
                  <CameraOff className="size-8" aria-hidden="true" />
                  <p className="text-pretty text-sm">
                    {cameraStatus === 'denied'
                      ? 'Trình duyệt chưa được phép dùng camera. Mở cài đặt trang (biểu tượng ổ khoá trên thanh địa chỉ) để cho phép, rồi thử lại.'
                      : cameraStatus === 'unsupported'
                        ? 'Trình duyệt này không mở được camera. Hãy dùng Chrome hoặc Safari, trên trang https.'
                        : 'Không mở được camera — có thể ứng dụng khác đang dùng.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="form" icon={RotateCw} onClick={() => { stopCamera(); startCamera(); }}>Thử lại</Button>
                    <Button size="form" icon={Search} onClick={() => setTab('search')}>Tìm theo tên</Button>
                  </div>
                </>
              )}
            </div>
          )}
          {result && (
            <div className="absolute inset-x-3 bottom-3">
              <ResultCard result={result} onDismiss={dismiss} onCheckInExisting={checkInGuest} className="shadow-modal" />
            </div>
          )}
        </div>
      )}

      {tab !== 'scan' && result && <ResultCard result={result} onDismiss={dismiss} onCheckInExisting={checkInGuest} />}

      {tab === 'search' && <SearchPanel api={api} busy={busy} onCheckIn={checkInGuest} refreshKey={summary?.stats?.checkedIn} />}
      {tab === 'walkin' && <WalkInPanel key={walkInKey} busy={busy} onSubmit={(data) => run(() => api.walkIn(data))} />}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Vừa check-in</h2>
        {!summary ? (
          <SkeletonRows rows={3} avatar={false} />
        ) : summary.recent.length === 0 ? (
          <EmptyText className="py-4">Chưa có khách nào check-in.</EmptyText>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {summary.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-xs tabular-nums text-muted">{[groupText(r), r.checkedInBy].filter(Boolean).join(' · ')}</p>
                </div>
                {r.isWalkIn && <Badge tone="teal">Tại chỗ</Badge>}
                <span className="text-sm tabular-nums text-muted">{hhmm(r.checkedInAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Khách quên thiệp / thiệp hỏng: tìm theo tên hoặc SĐT rồi check-in tay.
function SearchPanel({ api, busy, onCheckIn, refreshKey }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setItems(null); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      api.search(text)
        .then(({ data }) => setItems(data.data || []))
        .catch(() => toast.error('Không tìm được — thử lại'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, api, refreshKey]);

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        placeholder="Gõ tên, số điện thoại hoặc số ghế (ít nhất 2 ký tự)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onClear={() => setQ('')}
        autoFocus
      />
      {items === null ? (
        <p className="text-pretty text-sm text-muted">Dùng khi khách quên thiệp hoặc mã QR bị hỏng. Đối chiếu kỹ họ tên trước khi check-in.</p>
      ) : loading && !items.length ? (
        <SkeletonRows rows={3} avatar={false} />
      ) : items.length === 0 ? (
        <EmptyText className="py-4">Không có khách nào khớp. Khách không có trong danh sách thì dùng tab “Tại chỗ”.</EmptyText>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {items.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                <p className="truncate text-xs tabular-nums text-muted">{[groupText(g), g.phone, g.email].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              {g.checkedInAt ? (
                <Badge tone="success" icon={Clock}>{hhmm(g.checkedInAt)}</Badge>
              ) : (
                <Button size="sm" variant="primary" disabled={busy} onClick={() => onCheckIn(g)}>Check-in</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Khách không có trong danh sách: thêm và check-in luôn. Trùng email/SĐT với khách đã
// có thì server trả khách đó (GUEST_EXISTS) để check-in đúng người.
function WalkInPanel({ busy, onSubmit }) {
  const empty = { name: '', phone: '', email: '', ticketCount: '1' };
  const [form, setForm] = useState(empty);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error('Vui lòng nhập họ tên khách');
    const ok = await onSubmit(form);
    if (ok) setForm(empty);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <p className="text-pretty text-sm text-muted">Khách tới mà không có tên trong danh sách. Khách được thêm và check-in ngay, báo cáo ghi là “khách tại chỗ”.</p>
      <div className="grid grid-cols-[1fr_6rem] gap-4">
        <Field label="Họ tên" required>
          {(id) => <Input id={id} value={form.name} onChange={set('name')} autoComplete="off" />}
        </Field>
        <Field label="Số người" required>
          {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={50} value={form.ticketCount} onChange={set('ticketCount')} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Số điện thoại" optional>
          {(id) => <Input id={id} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="off" />}
        </Field>
        <Field label="Email" optional>
          {(id) => <Input id={id} type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="off" />}
        </Field>
      </div>
      <div>
        <Button type="submit" variant="primary" size="form" icon={UserPlus} loading={busy}>Thêm và check-in</Button>
      </div>
    </form>
  );
}
