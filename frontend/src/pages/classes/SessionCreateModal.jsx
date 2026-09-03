import { useState, useEffect } from 'react';
import { MapPin, Clock, Shield, LocateFixed, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { classApi } from '../../services/api';
import { getCurrentPosition, GPS_ERROR_MESSAGES } from '../../utils/gps';
import { toLocalInput, localInputToISO } from '../../utils/date';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

function defaultForm() {
  return {
    name: '',
    location: '',
    lat: '', lng: '', radius: '100', gpsEnabled: false,
    // Mặc định để trống — buổi học không cần đặt lịch, tạo xong là mở điểm
    // danh ngay (xem backend: không có giờ nào thì checkinState tự thành OPEN).
    checkinOpen: '', checkinClose: '', checkoutOpen: '', checkoutClose: '',
  };
}

function scheduleDefaults() {
  const now = new Date();
  const plus = (mins) => toLocalInput(new Date(now.getTime() + mins * 60000).toISOString());
  return {
    checkinOpen: toLocalInput(now.toISOString()),
    checkinClose: plus(15),
    checkoutOpen: plus(15),
    checkoutClose: plus(120),
  };
}

export default function SessionCreateModal({ open, classId, className, onClose, onCreated }) {
  const [form, setForm] = useState(defaultForm());
  const [useSchedule, setUseSchedule] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Modal không unmount khi đóng — reset lại form mỗi lần mở để không giữ dữ
  // liệu buổi trước (địa điểm, giờ, GPS...) sang buổi mới.
  useEffect(() => {
    if (open) { setForm(defaultForm()); setUseSchedule(false); }
  }, [open]);

  // Bật "Đặt lịch cố định" thì gợi ý sẵn khung giờ hợp lý; tắt thì xoá sạch để
  // không lỡ gửi giờ cũ lên server.
  const toggleSchedule = () => {
    const next = !useSchedule;
    setUseSchedule(next);
    setForm((f) => ({
      ...f,
      ...(next ? scheduleDefaults() : { checkinOpen: '', checkinClose: '', checkoutOpen: '', checkoutClose: '' }),
    }));
  };

  const handleDetectLocation = async () => {
    setGpsLoading(true);
    try {
      const pos = await getCurrentPosition();
      setForm((f) => ({ ...f, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
      toast.success('Đã lấy vị trí thành công!');
    } catch (err) {
      toast.error(GPS_ERROR_MESSAGES[err.message] || 'Không lấy được vị trí');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.location.trim()) return toast.error('Vui lòng nhập địa điểm');
    if (useSchedule && (!form.checkinOpen || !form.checkinClose || !form.checkoutOpen || !form.checkoutClose)) {
      return toast.error('Đã bật đặt lịch cố định thì cần điền đầy đủ cả 4 mốc giờ');
    }
    if (form.gpsEnabled && (!form.lat || !form.lng)) {
      return toast.error('Vui lòng lấy vị trí GPS hoặc tắt tính năng GPS');
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim() || undefined,
        checkinOpen: useSchedule ? localInputToISO(form.checkinOpen) : null,
        checkinClose: useSchedule ? localInputToISO(form.checkinClose) : null,
        checkoutOpen: useSchedule ? localInputToISO(form.checkoutOpen) : null,
        checkoutClose: useSchedule ? localInputToISO(form.checkoutClose) : null,
      };
      const { data } = await classApi.createSession(classId, payload);
      onCreated?.(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tạo buổi điểm danh thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Tạo buổi điểm danh — ${className}`}
      size="lg"
    >
      {open && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start gap-2.5 bg-primary-50 border border-primary-200 rounded-xl p-3">
            <Info size={15} className="text-primary-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary-800 leading-relaxed">
              Toàn bộ sinh viên đang hoạt động của lớp <strong>{className}</strong> sẽ tự động được thêm vào danh sách
              tham gia. {useSchedule
                ? 'Điểm danh sẽ mở/đóng đúng theo khung giờ bên dưới.'
                : 'Không đặt lịch, điểm danh sẽ MỞ NGAY sau khi tạo — bạn có thể bấm đóng thủ công bất cứ lúc nào ở trang chi tiết.'}
            </p>
          </div>

          <div>
            <label className="label">Tên buổi học</label>
            <input className="input" placeholder={`VD: ${className} - Buổi 12`} value={form.name} onChange={(e) => set('name', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Để trống sẽ tự đặt tên theo ngày giờ check-in mở</p>
          </div>

          <div>
            <label className="label">Địa điểm <span className="text-red-500">*</span></label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-10" placeholder="VD: Phòng A101" value={form.location} onChange={(e) => set('location', e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Clock size={16} className="text-primary-600" /> Đặt lịch cố định
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-600">{useSchedule ? 'Bật' : 'Tắt'}</span>
                <div onClick={toggleSchedule}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${useSchedule ? 'bg-primary-600' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${useSchedule ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
            </div>
            {useSchedule ? (
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
            ) : (
              <p className="text-xs text-gray-400 bg-surface rounded-lg p-3">
                Điểm danh mở ngay khi tạo, không giới hạn giờ. Bật lên nếu buổi học có giờ bắt đầu/kết thúc cố định.
              </p>
            )}
          </div>

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
              <div className="space-y-3">
                <button type="button" onClick={handleDetectLocation} disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary-300 rounded-xl py-2.5 px-4 text-primary-700 font-medium text-sm hover:bg-primary-50 transition-all disabled:opacity-60">
                  {gpsLoading
                    ? <><Loader2 size={16} className="animate-spin" />Đang lấy vị trí...</>
                    : <><LocateFixed size={16} />Lấy vị trí hiện tại</>}
                </button>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Vĩ độ</label>
                    <input className="input font-mono text-sm" type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Kinh độ</label>
                    <input className="input font-mono text-sm" type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Bán kính (m)</label>
                    <input className="input" type="number" min="50" max="1000" value={form.radius} onChange={(e) => set('radius', e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary btn-md flex-1">Huỷ</button>
            <button type="submit" disabled={saving} className="btn-primary btn-md flex-[2]">
              {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              {saving ? 'Đang tạo...' : 'Tạo buổi điểm danh & mở QR'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
