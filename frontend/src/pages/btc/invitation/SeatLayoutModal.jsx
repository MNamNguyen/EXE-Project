import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { guestApi } from '../../../services/api';
import Modal, { useConfirm } from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Field, Input } from '../../../components/ui/Input';
import { Banner } from '../../../components/ui/States';
import SeatGrid from './SeatGrid';
import { parseAisles, rowLabel, seatCode } from './seats';

const MAX_ROWS = 52;
const MAX_SEATS = 99;
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));

const makeRows = (count, seats) => Array.from({ length: count }, (_, i) => ({ label: rowLabel(i), seats }));

// Khai báo / sửa sơ đồ hội trường: số hàng (A, B, … từ sân khấu ra), số ghế mỗi hàng
// (chung, rồi chỉnh riêng từng hàng nếu hội trường không vuông), lối đi, và bấm ghế
// trên bản xem trước để đánh dấu "không dùng" (cột, chỗ đặt máy quay…). Server từ chối
// nếu sơ đồ mới làm mất ghế đang có khách (SEAT_IN_USE).
export default function SeatLayoutModal({ open, eventId, seatMap, assignedSeats, onClose, onSaved }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState('10');
  const [perRow, setPerRow] = useState('16');
  const [aisles, setAisles] = useState('');
  const [disabled, setDisabled] = useState(() => new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = seatMap?.rows?.length ? seatMap.rows : makeRows(10, 16);
    setRows(initial.map((r) => ({ ...r })));
    setRowCount(String(initial.length));
    setPerRow(String(Math.max(...initial.map((r) => r.seats))));
    setAisles((seatMap?.aisleAfter || []).join(', '));
    setDisabled(new Set(seatMap?.disabled || []));
    setError('');
  }, [open, seatMap]);

  const assigned = useMemo(() => new Set(assignedSeats), [assignedSeats]);

  const changeRowCount = (value) => {
    setRowCount(value);
    if (value === '') return;
    const n = clampInt(value, 1, MAX_ROWS);
    setRows((rs) => (n <= rs.length
      ? rs.slice(0, n)
      : [...rs, ...makeRows(n, clampInt(perRow, 1, MAX_SEATS)).slice(rs.length)]));
  };

  const changePerRow = (value) => {
    setPerRow(value);
    if (value === '') return;
    const n = clampInt(value, 1, MAX_SEATS);
    setRows((rs) => rs.map((r) => ({ ...r, seats: n })));
  };

  const changeRow = (label, value) => {
    setRows((rs) => rs.map((r) => (r.label === label ? { ...r, seats: value === '' ? '' : clampInt(value, 1, MAX_SEATS) } : r)));
  };

  // Bản xem trước luôn vẽ được: ô số ghế đang để trống tạm coi là 1.
  const preview = useMemo(() => ({
    rows: rows.map((r) => ({ label: r.label, seats: Number(r.seats) || 1 })),
    aisleAfter: parseAisles(aisles),
  }), [rows, aisles]);

  const toggleSeat = (code) => {
    if (assigned.has(code)) {
      toast.error(`Ghế ${code} đang có khách — bỏ gán ghế trước khi đánh dấu không dùng`);
      return;
    }
    setDisabled((set) => {
      const next = new Set(set);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const submit = async (map) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await guestApi.saveSeatMap(eventId, map);
      toast.success(data.message);
      onSaved?.(data.data?.seatMap);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Lưu sơ đồ thất bại');
    } finally {
      setSaving(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    const existing = new Set(preview.rows.flatMap((r) => Array.from({ length: r.seats }, (_, i) => seatCode(r.label, i + 1))));
    submit({ ...preview, disabled: [...disabled].filter((s) => existing.has(s)) });
  };

  const remove = async () => {
    if (!(await confirm({
      title: 'Xoá sơ đồ ghế?',
      body: 'Sự kiện sẽ không còn xếp ghế. Số vé của khách vẫn giữ nguyên.',
      confirmLabel: 'Xoá sơ đồ',
      icon: Trash2,
    }))) return;
    submit(null);
  };

  const total = preview.rows.reduce((n, r) => n + r.seats, 0) - [...disabled].length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={seatMap ? 'Sửa sơ đồ ghế' : 'Khai báo sơ đồ ghế'}
      size="xl"
      footer={(
        <>
          {seatMap && assigned.size === 0 && (
            <Button variant="ghost" size="form" icon={Trash2} onClick={remove} className="sm:mr-auto">Xoá sơ đồ</Button>
          )}
          <Button variant="secondary" size="form" onClick={onClose}>Huỷ</Button>
          <Button type="submit" form="seat-layout-form" variant="primary" size="form" loading={saving}>Lưu sơ đồ</Button>
        </>
      )}
    >
      <form id="seat-layout-form" onSubmit={save} className="flex flex-col gap-5">
        {error && <Banner tone="error" compact title="Chưa lưu được">{error}</Banner>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Số hàng ghế" hint={`Hàng ${rows[0]?.label || 'A'}–${rows.at(-1)?.label || 'A'}, hàng A sát sân khấu`}>
            {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={MAX_ROWS} value={rowCount} onChange={(e) => changeRowCount(e.target.value)} />}
          </Field>
          <Field label="Số ghế mỗi hàng" hint="Áp dụng cho mọi hàng; chỉnh riêng bên dưới">
            {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={MAX_SEATS} value={perRow} onChange={(e) => changePerRow(e.target.value)} />}
          </Field>
          <Field label="Lối đi sau ghế số" optional hint="Vd. 4, 12 — chỉ để vẽ sơ đồ">
            {(id) => <Input id={id} value={aisles} onChange={(e) => setAisles(e.target.value)} placeholder="4, 12" autoComplete="off" />}
          </Field>
        </div>

        <details className="group rounded-xl border border-border-strong">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground">Số ghế từng hàng</summary>
          <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-4 sm:grid-cols-4 lg:grid-cols-6">
            {rows.map((r) => (
              <label key={r.label} className="flex items-center gap-2 text-sm">
                <span className="w-6 font-semibold tabular-nums text-muted">{r.label}</span>
                <Input type="number" inputMode="numeric" min={1} max={MAX_SEATS} value={r.seats} onChange={(e) => changeRow(r.label, e.target.value)} aria-label={`Số ghế hàng ${r.label}`} />
              </label>
            ))}
          </div>
        </details>

        <div>
          <p className="mb-3 text-pretty text-sm text-muted">
            Bấm vào ghế để đánh dấu <span className="font-medium text-foreground">không dùng</span> (cột, lối đi lệch, chỗ đặt thiết bị). Tổng
            {' '}<span className="font-semibold tabular-nums text-foreground">{total}</span> ghế dùng được.
          </p>
          <SeatGrid
            seatMap={preview}
            seatState={(code) => (disabled.has(code) ? 'disabled' : assigned.has(code) ? 'assigned' : 'free')}
            seatTitle={(code) => `${code}${disabled.has(code) ? ' · không dùng' : assigned.has(code) ? ' · đang có khách' : ''}`}
            onSeatClick={toggleSeat}
          />
        </div>
      </form>
    </Modal>
  );
}
