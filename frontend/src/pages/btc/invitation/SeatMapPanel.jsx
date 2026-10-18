import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Armchair, Check, LayoutGrid, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { guestApi } from '../../../services/api';
import Button, { IconButton } from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import { Card } from '../../../components/ui/Card';
import { SearchInput } from '../../../components/ui/Input';
import { EmptyText, LoadError, SkeletonRows } from '../../../components/ui/States';
import { cx } from '../../../utils/cx';
import SeatGrid, { SEAT_LEGEND, SeatSwatch } from './SeatGrid';
import SeatLayoutModal from './SeatLayoutModal';
import { sortSeats } from './seats';

const POLL_MS = 15000;

// Tab "Sơ đồ ghế" của sự kiện thiệp mời. Bấm ghế trống → chọn khách để xếp; bấm ghế đã
// đặt → chọn nhóm của ghế đó, rồi bấm tiếp ghế trống để xếp thêm hoặc "Đổi" để chuyển một
// ghế. Server chặn trùng ghế (hai BTC cùng xếp một ghế thì một người nhận lỗi).
export default function SeatMapPanel({ event, visible, onChanged }) {
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [active, setActive] = useState(null); // { guestId, moving: mã ghế đang chuyển | null }
  const [picker, setPicker] = useState(null); // mã ghế trống đang chọn khách
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => guestApi.seats(event.id)
    .then(({ data: res }) => { setData(res.data); setLoadState('ok'); })
    .catch(() => setLoadState((s) => (s === 'ok' ? 'ok' : 'error'))), [event.id]);

  // Chỉ tải và tự làm mới khi đang mở tab (khách check-in ở cửa thì ghế đổi màu "đã tới").
  useEffect(() => {
    if (!visible) return undefined;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [visible, load]);

  const { owners, guests, seatsOf } = useMemo(() => {
    const byGuest = new Map();
    const bySeat = new Map();
    for (const a of data?.assignments || []) {
      bySeat.set(a.seat, a);
      byGuest.set(a.guestId, [...(byGuest.get(a.guestId) || []), a.seat]);
    }
    return {
      owners: bySeat,
      guests: new Map((data?.guests || []).map((g) => [g.id, g])),
      seatsOf: (id) => sortSeats(byGuest.get(id) || []),
    };
  }, [data]);

  const seatMap = data?.seatMap;
  const disabled = useMemo(() => new Set(seatMap?.disabled || []), [seatMap]);
  const activeGuest = active ? guests.get(active.guestId) : null;

  // Nhóm đang chọn bị xoá ở tab khác → bỏ chọn.
  useEffect(() => { if (active && data && !activeGuest) setActive(null); }, [active, data, activeGuest]);

  const save = async (guest, seats, nextActive) => {
    if (saving) return;
    setSaving(true);
    try {
      const { data: res } = await guestApi.setGuestSeats(event.id, guest.id, seats);
      toast.success(res.message);
      setActive(nextActive);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không xếp được ghế');
      load();
    } finally {
      setSaving(false);
    }
  };

  const onSeatClick = (code, state) => {
    if (state === 'disabled' || saving) return;
    const owner = owners.get(code);
    if (owner) {
      if (active?.moving && owner.guestId !== active.guestId) toast.error(`Ghế ${code} đã có người — chọn một ghế trống`);
      setActive({ guestId: owner.guestId, moving: null });
      return;
    }
    if (activeGuest) {
      const seats = seatsOf(activeGuest.id);
      if (active.moving) {
        save(activeGuest, [...seats.filter((s) => s !== active.moving), code], { guestId: activeGuest.id, moving: null });
        return;
      }
      if (seats.length < activeGuest.ticketCount) {
        save(activeGuest, [...seats, code], { guestId: activeGuest.id, moving: null });
        return;
      }
    }
    setPicker(code);
  };

  const assignFromPicker = (guest) => {
    const seats = [...seatsOf(guest.id), picker];
    setPicker(null);
    // Nhóm còn vé chưa có ghế thì giữ chọn để bấm tiếp các ghế bên cạnh.
    save(guest, seats, { guestId: guest.id, moving: null });
  };

  const seatState = (code) => {
    if (disabled.has(code)) return 'disabled';
    const owner = owners.get(code);
    if (active?.moving === code) return 'moving';
    if (owner && owner.guestId === active?.guestId) return 'active';
    if (owner) return owner.checkedIn ? 'arrived' : 'assigned';
    return 'free';
  };
  const seatTitle = (code) => {
    if (disabled.has(code)) return `${code} · không dùng`;
    const owner = owners.get(code);
    if (!owner) return `${code} · trống`;
    return `${code} · ${owner.name}${owner.checkedIn ? ' · đã tới' : ''}`;
  };

  if (loadState === 'loading' && !data) return <SkeletonRows rows={5} avatar={false} />;
  if (loadState === 'error' && !data) return <LoadError title="Không tải được sơ đồ ghế" onRetry={load} />;

  const layoutModal = (
    <SeatLayoutModal
      open={layoutOpen}
      eventId={event.id}
      seatMap={seatMap}
      assignedSeats={[...owners.keys()]}
      onClose={() => setLayoutOpen(false)}
      onSaved={() => { load(); onChanged?.(); }}
    />
  );

  if (!seatMap) {
    return (
      <Card>
        <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted"><Armchair className="size-6" aria-hidden="true" /></span>
          <h2 className="mt-4 text-base font-semibold text-foreground">Sự kiện chưa có sơ đồ ghế</h2>
          <p className="mt-1.5 text-pretty text-sm/6 text-muted">
            Khai báo các hàng ghế của hội trường để xếp chỗ cho khách. Sau đó có thể import file Excel có cột
            {' '}<span className="font-medium text-foreground">Ghế</span> (vd. E08, E09) hoặc bấm từng ghế trên sơ đồ.
          </p>
          <Button variant="primary" size="form" icon={LayoutGrid} className="mt-5" onClick={() => setLayoutOpen(true)}>Khai báo sơ đồ ghế</Button>
        </div>
        {layoutModal}
      </Card>
    );
  }

  const usable = seatMap.rows.reduce((n, r) => n + r.seats, 0) - disabled.size;
  const assigned = owners.size;
  const arrived = [...owners.values()].filter((o) => o.checkedIn).length;
  const unseated = [...guests.values()]
    .filter((g) => !g.isWalkIn)
    .reduce((n, g) => n + Math.max(0, g.ticketCount - g.seatCount), 0);
  const activeSeats = activeGuest ? seatsOf(activeGuest.id) : [];
  const missing = activeGuest ? activeGuest.ticketCount - activeSeats.length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm tabular-nums text-muted">
          <span className="font-semibold text-foreground">{assigned}</span>/{usable} ghế đã đặt · {usable - assigned} trống · {arrived} đã tới
          {unseated > 0 && <span className="font-medium text-warning"> · {unseated} vé chưa xếp ghế</span>}
        </p>
        <Button icon={LayoutGrid} onClick={() => setLayoutOpen(true)}>Sửa sơ đồ</Button>
      </div>

      {activeGuest && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{activeGuest.name}</p>
              <span className="text-sm tabular-nums text-muted">{activeSeats.length}/{activeGuest.ticketCount} ghế</span>
              {activeGuest.checkedInAt && <Badge tone="success" icon={Check}>Đã tới</Badge>}
            </div>
            <p className="mt-1 text-pretty text-sm text-muted">
              {active.moving
                ? <>Bấm một ghế trống để chuyển <span className="font-medium text-foreground">{active.moving}</span> sang.</>
                : missing > 0
                  ? `Bấm ghế trống để xếp thêm ${missing} ghế cho nhóm này.`
                  : 'Nhóm đã đủ ghế. Bấm "Đổi" để chuyển một ghế, hoặc bỏ bớt ghế.'}
            </p>
            {activeSeats.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {activeSeats.map((s) => (
                  <li key={s} className={cx('flex items-center gap-1 rounded-lg border bg-surface py-0.5 pl-2.5 pr-0.5 text-sm font-medium tabular-nums', active.moving === s ? 'border-warning text-warning' : 'border-border-strong text-foreground')}>
                    {s}
                    <IconButton
                      icon={ArrowLeftRight}
                      label={`Đổi ghế ${s}`}
                      size="size-7"
                      disabled={saving}
                      onClick={() => setActive({ guestId: activeGuest.id, moving: active.moving === s ? null : s })}
                    />
                    <IconButton
                      icon={X}
                      label={`Bỏ ghế ${s}`}
                      size="size-7"
                      disabled={saving}
                      onClick={() => save(activeGuest, activeSeats.filter((x) => x !== s), { guestId: activeGuest.id, moving: null })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button size="sm" onClick={() => setActive(null)}>Xong</Button>
        </div>
      )}

      <Card>
        <SeatGrid seatMap={seatMap} seatState={seatState} seatTitle={seatTitle} onSeatClick={onSeatClick} />
        <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted">
          {SEAT_LEGEND.map((l) => (
            <li key={l.state} className="flex items-center gap-1.5"><SeatSwatch state={l.state} />{l.label}</li>
          ))}
        </ul>
      </Card>

      <GuestPicker
        seat={picker}
        guests={[...guests.values()]}
        onPick={assignFromPicker}
        onClose={() => setPicker(null)}
      />
      {layoutModal}
    </div>
  );
}

// Chọn khách cho một ghế trống. Nhóm còn vé chưa có ghế lên đầu; nhóm đã đủ ghế không
// chọn được (tăng số vé ở "Sửa thông tin" trước).
function GuestPicker({ seat, guests, onPick, onClose }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (seat) setQ(''); }, [seat]);

  const text = q.trim().toLowerCase();
  const list = guests
    .filter((g) => !text || g.name.toLowerCase().includes(text))
    .map((g) => ({ ...g, free: g.ticketCount - g.seatCount }))
    .sort((a, b) => (b.free > 0) - (a.free > 0) || a.name.localeCompare(b.name, 'vi'));

  return (
    <Modal open={Boolean(seat)} onClose={onClose} title={`Xếp ghế ${seat || ''}`} size="sm" closeOnOverlay>
      <div className="flex flex-col gap-3">
        <SearchInput placeholder="Tìm khách theo tên" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} autoFocus />
        {list.length === 0 ? (
          <EmptyText className="py-4">Không có khách nào khớp.</EmptyText>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {list.slice(0, 100).map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  disabled={g.free <= 0}
                  onClick={() => onPick(g)}
                  className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{g.name}</span>
                    <span className="block text-xs tabular-nums text-muted">
                      {g.ticketCount} vé · {g.free > 0 ? `còn ${g.free} vé chưa có ghế` : 'đã đủ ghế'}
                    </span>
                  </span>
                  {g.isWalkIn && <Badge tone="teal">Tại chỗ</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

