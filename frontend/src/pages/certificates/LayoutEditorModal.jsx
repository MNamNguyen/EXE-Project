import { useState, useEffect, useMemo, useRef } from 'react';
import { AlignLeft, AlignCenter, AlignRight, RotateCcw, FileDown, Move } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Field, Input, RangeInput } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Choice';
import CertificateCanvas from './CertificateCanvas';
import { FONT_LABELS, downloadBlob } from './certRender';
import { BARE_FIELDS } from './invitationRender';
import { cx } from '../../utils/cx';

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const round4 = (n) => Math.round(n * 10000) / 10000;

const ALIGNS = [['left', AlignLeft, 'Căn trái'], ['center', AlignCenter, 'Căn giữa'], ['right', AlignRight, 'Căn phải']];

// Chỉnh vị trí các ô thông tin trên ảnh mẫu — dùng chung cho chứng nhận và thiệp mời:
// kéo thả trực tiếp trên ảnh, chỉnh font/cỡ/màu/căn lề ở bảng bên dưới. Toạ độ lưu
// dạng tỉ lệ (0–1). Ô "qr" (chỉ thiệp mời) là hình vuông: chỉ có vị trí và cỡ.
//   lockedKeys        — ô luôn hiện, không tắt được (vd. họ tên, mã QR)
//   makeValues(name)  — chuỗi điền vào từng ô theo tên mẫu đang thử
//   onSave(fields)    — trả { data } từ API ({ message, data })
//   onPreview(name)   — trả { data: Blob } PDF do server vẽ theo bố cục ĐÃ LƯU
export default function LayoutEditorModal({
  open, onClose, title, template, imageUrl, fieldLabels, defaultFields, lockedKeys = ['name'],
  makeValues, draw, qrText, onSave, onSaved, onPreview, previewFilename,
}) {
  const [fields, setFields] = useState(template.fields);
  const [selected, setSelected] = useState('name');
  const [sampleName, setSampleName] = useState('Nguyễn Thị Phương Thảo');
  const [boxes, setBoxes] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (open) setFields(template.fields);
  }, [open, template]);

  const values = useMemo(() => makeValues(sampleName.trim() || 'Nguyễn Văn A'), [sampleName, makeValues]);

  const update = (key, patch) => setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const current = fields.find((f) => f.key === selected);
  const isQr = current?.key === 'qr';

  const startDrag = (key, e) => {
    e.preventDefault();
    setSelected(key);
    const rect = stageRef.current.getBoundingClientRect();
    const f = fields.find((x) => x.key === key);
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, x: f.x, y: f.y, w: rect.width, h: rect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    update(d.key, {
      x: round4(clamp01(d.x + (e.clientX - d.startX) / d.w)),
      y: round4(clamp01(d.y + (e.clientY - d.startY) / d.h)),
    });
  };
  const endDrag = () => { dragRef.current = null; };

  // Phím mũi tên nhích từng chút — kéo chuột khó căn chính xác từng pixel.
  const nudge = (key, e) => {
    const step = e.shiftKey ? 0.01 : 0.002;
    const dirs = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    const f = fields.find((x) => x.key === key);
    update(key, { x: round4(clamp01(f.x + d[0])), y: round4(clamp01(f.y + d[1])) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await onSave(fields);
      toast.success(data.message);
      onSaved?.(data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lưu bố cục thất bại');
    } finally {
      setSaving(false);
    }
  };

  // PDF xem thử được vẽ ở server theo bố cục ĐÃ LƯU — nhắc lưu trước nếu đang sửa dở.
  const dirty = JSON.stringify(fields) !== JSON.stringify(template.fields);
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { data } = await onPreview(values.name);
      downloadBlob(data, previewFilename);
    } catch {
      toast.error('Không tạo được PDF xem thử');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={(
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="ghost" size="form" icon={RotateCcw} onClick={() => setFields(defaultFields)} className="sm:mr-auto">
            Bố cục mặc định
          </Button>
          <Button
            size="form"
            icon={FileDown}
            loading={previewing}
            disabled={dirty}
            onClick={handlePreview}
            title={dirty ? 'Lưu bố cục trước để tải PDF xem thử' : 'Tải PDF do server tạo để kiểm tra bản in'}
          >
            Tải PDF xem thử
          </Button>
          <Button variant="primary" size="form" loading={saving} onClick={handleSave}>Lưu bố cục</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-5">
        <p className="flex items-start gap-2 text-pretty text-sm text-muted">
          <Move className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Kéo các ô trên ảnh để đặt vị trí. Chọn một ô rồi dùng phím mũi tên để nhích (giữ Shift để nhích nhanh).
        </p>

        <div
          ref={stageRef}
          className="relative touch-none select-none"
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <CertificateCanvas
            imageUrl={imageUrl}
            template={template}
            fields={fields}
            values={values}
            draw={draw}
            qrText={qrText}
            onLayout={setBoxes}
          />
          {Object.entries(boxes).map(([key, b]) => (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-label={fieldLabels[key]}
              onPointerDown={(e) => startDrag(key, e)}
              onKeyDown={(e) => nudge(key, e)}
              onFocus={() => setSelected(key)}
              className={cx(
                'absolute cursor-move rounded border-2 border-dashed outline-none transition-colors',
                selected === key ? 'border-primary bg-primary/10' : 'border-transparent hover:border-primary/50',
              )}
              style={{
                left: `${b.left * 100}%`, top: `${b.top * 100}%`,
                width: `${Math.max(b.width * 100, 2)}%`, height: `${b.height * 100}%`,
              }}
              title={fieldLabels[key]}
            />
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-5">
            <Field label="Tên mẫu để xem thử">
              {(id) => (
                <Input id={id} value={sampleName} maxLength={100} onChange={(e) => setSampleName(e.target.value)} placeholder="Thử một tên dài để kiểm tra" />
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">Các ô thông tin</p>
              <div className="flex flex-col gap-0.5">
                {fields.map((f) => {
                  const locked = lockedKeys.includes(f.key);
                  return (
                    <div
                      key={f.key}
                      onClick={() => setSelected(f.key)}
                      className={cx(
                        'flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm',
                        selected === f.key ? 'bg-secondary font-medium text-foreground' : 'text-foreground hover:bg-item-hover',
                      )}
                    >
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <Checkbox
                          small
                          checked={f.enabled}
                          disabled={locked}
                          ariaLabel={locked ? `${fieldLabels[f.key]} luôn hiển thị` : `Hiện ô ${fieldLabels[f.key]}`}
                          title={locked ? 'Ô này luôn hiển thị' : 'Hiện/ẩn ô này'}
                          onChange={(e) => update(f.key, { enabled: e.target.checked })}
                        />
                      </span>
                      <span className={f.enabled ? '' : 'text-muted line-through'}>{fieldLabels[f.key]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {current && isQr && (
            <div className="flex flex-col gap-4 rounded-xl bg-background p-4">
              <p className="text-sm font-semibold text-foreground">{fieldLabels.qr}</p>
              <Field label={`Cỡ mã (${Math.round(current.size * 100)}% chiều rộng)`} hint="Mã in ra nên rộng tối thiểu 2,5 cm để điện thoại quét nhanh.">
                {(id) => (
                  <RangeInput id={id} min="0.08" max="0.6" step="0.005" value={current.size}
                    onChange={(e) => update('qr', { size: Number(e.target.value) })} />
                )}
              </Field>
              <Checkbox
                label="Nền trắng sau mã QR"
                desc={current.background === false
                  ? 'Mã vẽ thẳng lên ảnh mẫu — chỗ đặt mã phải đủ sáng và trơn, nhớ in thử rồi quét bằng điện thoại.'
                  : 'Nên giữ: nền trắng tách mã khỏi ảnh nên camera quét nhanh hơn.'}
                checked={current.background !== false}
                onChange={(e) => update('qr', { background: e.target.checked })}
              />
              <div>
                <Button size="sm" onClick={() => update('qr', { x: 0.5 })}>Đưa ra giữa</Button>
              </div>
            </div>
          )}

          {current && !isQr && (
            <div className="flex flex-col gap-4 rounded-xl bg-background p-4">
              <p className="text-sm font-semibold text-foreground">{fieldLabels[current.key]}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Font">
                  {(id) => (
                    <Select
                      id={id}
                      value={current.font}
                      onChange={(font) => update(current.key, { font })}
                      options={Object.entries(FONT_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                  )}
                </Field>
                <Field label="Màu chữ">
                  {(id) => (
                    <div className="flex items-center gap-2">
                      <input
                        id={id}
                        type="color"
                        value={current.color}
                        onChange={(e) => update(current.key, { color: e.target.value.toUpperCase() })}
                        className="size-11 cursor-pointer rounded-xl border border-border-strong bg-surface p-1 md:size-10 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0"
                      />
                      <span className="font-mono text-xs text-muted">{current.color}</span>
                    </div>
                  )}
                </Field>
              </div>
              <Field label={`Cỡ chữ (${(current.size * 100).toFixed(1)}% chiều rộng)`}>
                {(id) => (
                  <RangeInput id={id} min="0.005" max="0.12" step="0.0005" value={current.size}
                    onChange={(e) => update(current.key, { size: Number(e.target.value) })} />
                )}
              </Field>
              <Field label={`Độ rộng tối đa (${Math.round(current.maxWidth * 100)}%) — chữ dài hơn sẽ tự thu nhỏ`}>
                {(id) => (
                  <RangeInput id={id} min="0.1" max="1" step="0.01" value={current.maxWidth}
                    onChange={(e) => update(current.key, { maxWidth: Number(e.target.value) })} />
                )}
              </Field>
              <div className="flex flex-col gap-3">
                <Checkbox
                  label="In hoa"
                  desc="Hợp với mẫu thiết kế toàn chữ in hoa."
                  checked={current.uppercase === true}
                  onChange={(e) => update(current.key, { uppercase: e.target.checked })}
                />
                {BARE_FIELDS[current.key] && (
                  <Checkbox
                    label={`Kèm chữ “${BARE_FIELDS[current.key].word}”`}
                    desc={current.bare
                      ? `Chỉ in giá trị (vd. ${current.key === 'seat' ? '“E08, E09”' : '“2”'}) — dùng khi ảnh mẫu đã in sẵn nhãn.`
                      : `Bỏ tick nếu ảnh mẫu đã in sẵn nhãn ${current.key === 'seat' ? '“VỊ TRÍ GHẾ”' : '“SỐ VÉ”'}.`}
                    checked={!current.bare}
                    onChange={(e) => update(current.key, { bare: !e.target.checked })}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">Căn lề</span>
                <div role="radiogroup" aria-label="Căn lề" className="inline-flex gap-1 rounded-xl bg-foreground/5 p-1 shadow-segment-track">
                  {ALIGNS.map(([a, Icon, label]) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={current.align === a}
                      aria-label={label}
                      title={label}
                      onClick={() => update(current.key, { align: a })}
                      className={cx(
                        'inline-flex size-8 cursor-pointer items-center justify-center rounded-lg outline-none transition-[color,background-color,box-shadow]',
                        current.align === a ? 'bg-surface text-foreground shadow-segment-thumb' : 'text-foreground/70 hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <Button size="sm" onClick={() => update(current.key, { x: 0.5, align: 'center' })}>Đưa ra giữa</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
