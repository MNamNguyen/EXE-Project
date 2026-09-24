import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { AlignLeft, AlignCenter, AlignRight, RotateCcw, Save, FileDown, Move } from 'lucide-react';
import toast from 'react-hot-toast';
import { certificateApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import CertificateCanvas from '../certificates/CertificateCanvas';
import { FIELD_LABELS, FONT_LABELS, DEFAULT_FIELDS, downloadBlob } from '../certificates/certRender';

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const round4 = (n) => Math.round(n * 10000) / 10000;

// Chỉnh vị trí các ô thông tin trên ảnh mẫu: kéo thả trực tiếp trên chứng nhận,
// chỉnh font/cỡ/màu/căn lề ở bảng bên dưới. Toạ độ lưu dạng tỉ lệ (0–1).
export default function CertificateEditorModal({ open, onClose, event, template, imageUrl, onSaved }) {
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

  const values = useMemo(() => ({
    name: sampleName.trim() || 'Nguyễn Văn A',
    event: event.name,
    date: `Ngày ${format(event.checkinOpen ? new Date(event.checkinOpen) : new Date(), 'dd/MM/yyyy')}`,
    code: 'Mã chứng nhận: CN-XXXX-XXXX',
  }), [sampleName, event.name, event.checkinOpen]);

  const update = (key, patch) => setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const current = fields.find((f) => f.key === selected);

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
      const { data } = await certificateApi.saveFields(event.id, fields);
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
      const { data } = await certificateApi.previewPdf(event.id, values.name);
      downloadBlob(data, `xem-thu-chung-nhan-${event.name}.pdf`);
    } catch {
      toast.error('Không tạo được PDF xem thử');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Chỉnh bố cục chứng nhận" size="xl">
      <div className="space-y-4">
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Move size={13} /> Kéo các ô chữ trên ảnh để đặt vị trí. Chọn một ô rồi dùng phím mũi tên để nhích (giữ Shift để nhích nhanh).
        </p>

        <div
          ref={stageRef}
          className="relative select-none touch-none"
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <CertificateCanvas imageUrl={imageUrl} template={template} fields={fields} values={values} onLayout={setBoxes} />
          {Object.entries(boxes).map(([key, b]) => (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-label={FIELD_LABELS[key]}
              onPointerDown={(e) => startDrag(key, e)}
              onKeyDown={(e) => nudge(key, e)}
              onFocus={() => setSelected(key)}
              className={`absolute cursor-move rounded border-2 border-dashed transition-colors outline-none ${
                selected === key ? 'border-primary-500 bg-primary-500/10' : 'border-transparent hover:border-primary-300'
              }`}
              style={{
                left: `${b.left * 100}%`, top: `${b.top * 100}%`,
                width: `${Math.max(b.width * 100, 2)}%`, height: `${b.height * 100}%`,
              }}
              title={FIELD_LABELS[key]}
            />
          ))}
        </div>

        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
          <div className="space-y-2">
            <label className="label">Tên mẫu để xem thử</label>
            <input className="input text-sm" value={sampleName} maxLength={100}
              onChange={(e) => setSampleName(e.target.value)} placeholder="Thử một tên dài để kiểm tra" />
            <p className="label pt-2">Các ô thông tin</p>
            <div className="space-y-1.5">
              {fields.map((f) => (
                <div key={f.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                    selected === f.key ? 'border-primary-300 bg-primary-50' : 'border-border hover:bg-gray-50'
                  }`}
                  onClick={() => setSelected(f.key)}>
                  <input type="checkbox" className="rounded" checked={f.enabled} disabled={f.key === 'name'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => update(f.key, { enabled: e.target.checked })}
                    title={f.key === 'name' ? 'Họ tên luôn hiển thị' : 'Hiện/ẩn ô này'} />
                  <span className={f.enabled ? 'text-gray-800' : 'text-gray-400 line-through'}>{FIELD_LABELS[f.key]}</span>
                </div>
              ))}
            </div>
          </div>

          {current && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-900">{FIELD_LABELS[current.key]}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Font</label>
                  <select className="input text-sm py-2" value={current.font} onChange={(e) => update(current.key, { font: e.target.value })}>
                    {Object.entries(FONT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Màu chữ</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-10 h-9 rounded border border-border cursor-pointer" value={current.color}
                      onChange={(e) => update(current.key, { color: e.target.value.toUpperCase() })} />
                    <span className="text-xs text-gray-500 font-mono">{current.color}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Cỡ chữ ({(current.size * 100).toFixed(1)}% chiều rộng)</label>
                <input type="range" className="w-full accent-primary-600" min="0.005" max="0.12" step="0.0005"
                  value={current.size} onChange={(e) => update(current.key, { size: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Độ rộng tối đa ({Math.round(current.maxWidth * 100)}%) — chữ dài hơn sẽ tự thu nhỏ</label>
                <input type="range" className="w-full accent-primary-600" min="0.1" max="1" step="0.01"
                  value={current.maxWidth} onChange={(e) => update(current.key, { maxWidth: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="label mb-0">Căn lề</span>
                {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
                  <button key={a} type="button" onClick={() => update(current.key, { align: a })}
                    className={`p-2 rounded-lg border ${current.align === a ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-border text-gray-500 hover:bg-gray-50'}`}>
                    <Icon size={15} />
                  </button>
                ))}
                <button type="button" onClick={() => update(current.key, { x: 0.5, align: 'center' })}
                  className="text-xs font-semibold px-3 py-2 rounded-lg border border-border text-gray-600 hover:bg-gray-50">
                  Đưa ra giữa
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-end pt-2 border-t border-border">
          <button type="button" onClick={() => setFields(DEFAULT_FIELDS)} className="btn-secondary btn-sm mr-auto">
            <RotateCcw size={14} /> Bố cục mặc định
          </button>
          <button type="button" onClick={handlePreview} disabled={previewing || dirty} className="btn-secondary btn-sm"
            title={dirty ? 'Lưu bố cục trước để tải PDF xem thử' : 'Tải PDF do server tạo để kiểm tra bản in'}>
            {previewing ? <Spinner size="sm" /> : <FileDown size={14} />} Tải PDF xem thử
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
            {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Save size={14} />} Lưu bố cục
          </button>
        </div>
      </div>
    </Modal>
  );
}
