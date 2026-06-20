import { useState, useEffect } from 'react';
import { Info, Clock, Shield, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// ISO (UTC) → giá trị cho <input type="datetime-local"> theo giờ ĐỊA PHƯƠNG.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function EventEditModal({ open, event, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && event) {
      setForm({
        name: event.name || '',
        description: event.description || '',
        location: event.location || '',
        lat: event.lat ?? '',
        lng: event.lng ?? '',
        radius: event.radius ?? 100,
        gpsEnabled: event.gpsEnabled ?? true,
        checkinOpen: toLocalInput(event.checkinOpen),
        checkinClose: toLocalInput(event.checkinClose),
        checkoutOpen: toLocalInput(event.checkoutOpen),
        checkoutClose: toLocalInput(event.checkoutClose),
        isWhitelisted: event.isWhitelisted ?? false,
      });
    }
  }, [open, event]);

  if (!form) return <Modal open={open} onClose={onClose} title="Sửa sự kiện" size="lg"><div /></Modal>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.location || !form.checkinOpen || !form.checkinClose || !form.checkoutOpen || !form.checkoutClose) {
      return toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
    }
    if (form.gpsEnabled && (!form.lat || !form.lng)) {
      return toast.error('Vui lòng nhập toạ độ GPS hoặc tắt tính năng GPS');
    }
    setSaving(true);
    try {
      await eventApi.update(event.id, form);
      toast.success('Cập nhật sự kiện thành công');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Sửa sự kiện" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Thông tin cơ bản */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Info size={16} className="text-primary-600" /> Thông tin cơ bản
          </h3>
          <div className="space-y-3">
            <div>
              <label className="label">Tên sự kiện <span className="text-red-500">*</span></label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Mô tả</label>
              <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div>
              <label className="label">Địa điểm <span className="text-red-500">*</span></label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-10" value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Thời gian */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Clock size={16} className="text-primary-600" /> Thời gian check-in / check-out
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'checkinOpen', label: 'Check-in mở' },
              { key: 'checkinClose', label: 'Check-in đóng' },
              { key: 'checkoutOpen', label: 'Check-out mở' },
              { key: 'checkoutClose', label: 'Check-out đóng' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label} <span className="text-red-500">*</span></label>
                <input className="input text-sm" type="datetime-local" value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* GPS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <Shield size={16} className="text-primary-600" /> Xác thực GPS
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600">{form.gpsEnabled ? 'Bật' : 'Tắt'}</span>
              <div onClick={() => set('gpsEnabled', !form.gpsEnabled)}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${form.gpsEnabled ? 'bg-primary-600' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.gpsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>
          {form.gpsEnabled && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Vĩ độ <span className="text-red-500">*</span></label>
                <input className="input font-mono text-sm" type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} />
              </div>
              <div>
                <label className="label">Kinh độ <span className="text-red-500">*</span></label>
                <input className="input font-mono text-sm" type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} />
              </div>
              <div>
                <label className="label">Bán kính (m)</label>
                <input className="input" type="number" min="50" max="1000" value={form.radius} onChange={(e) => set('radius', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Whitelist */}
        <label className="flex items-center gap-3 cursor-pointer bg-surface rounded-lg p-3">
          <input type="checkbox" className="w-4 h-4 rounded accent-primary-600"
            checked={form.isWhitelisted} onChange={(e) => set('isWhitelisted', e.target.checked)} />
          <div>
            <p className="text-sm font-medium text-gray-700">Chỉ cho phép danh sách đã đăng ký</p>
            <p className="text-xs text-gray-400">Nếu bật, chỉ thành viên trong danh sách tham gia mới check-in được</p>
          </div>
        </label>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary btn-md flex-1">Huỷ</button>
          <button type="submit" disabled={saving} className="btn-primary btn-md flex-1">
            {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
            Lưu thay đổi
          </button>
        </div>
      </form>
    </Modal>
  );
}
