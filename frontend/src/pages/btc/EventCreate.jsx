import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, Shield, Users, Info,
  LocateFixed, Loader2, ExternalLink, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import { getCurrentPosition, GPS_ERROR_MESSAGES } from '../../utils/gps';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';

const today = new Date().toISOString().slice(0, 16);

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
      { headers: { 'Accept-Language': 'vi' } }
    );
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

export default function EventCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: '',
    lat: '',
    lng: '',
    radius: '100',
    gpsEnabled: true,
    checkinOpen: today,
    checkinClose: '',
    checkoutOpen: '',
    checkoutClose: '',
    isWhitelisted: false,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleDetectLocation = async () => {
    setGpsLoading(true);
    setDetectedAddress('');
    try {
      const pos = await getCurrentPosition();
      set('lat', pos.lat.toFixed(6));
      set('lng', pos.lng.toFixed(6));
      // Also update both fields atomically
      setForm((f) => ({ ...f, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
      toast.success('Đã lấy vị trí thành công!');
      // Reverse geocode in background
      const address = await reverseGeocode(pos.lat, pos.lng);
      if (address) setDetectedAddress(address);
    } catch (err) {
      const msg = GPS_ERROR_MESSAGES[err.message] || 'Không lấy được vị trí';
      toast.error(msg);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.location || !form.checkinOpen || !form.checkinClose || !form.checkoutOpen || !form.checkoutClose) {
      return toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
    }
    if (form.gpsEnabled && (!form.lat || !form.lng)) {
      return toast.error('Vui lòng lấy vị trí GPS hoặc tắt tính năng GPS');
    }
    setLoading(true);
    try {
      const { data } = await eventApi.create(form);
      toast.success('Tạo sự kiện thành công!');
      navigate(`/events/${data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tạo sự kiện thất bại');
    } finally {
      setLoading(false);
    }
  };

  const hasCoords = form.lat && form.lng;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${form.lat},${form.lng}`
    : null;

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/events')} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Quay lại
          </button>
          <h1 className="text-2xl font-bold text-white">Tạo sự kiện mới</h1>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Basic info */}
          <div className="card p-5">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Info size={18} className="text-primary-600" /> Thông tin cơ bản
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Tên sự kiện <span className="text-red-500">*</span></label>
                <input className="input" placeholder="VD: Workshop AI 2026" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className="label">Mô tả</label>
                <textarea className="input resize-none" rows={3} placeholder="Mô tả ngắn về sự kiện..." value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
              <div>
                <label className="label">Địa điểm <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-10" placeholder="VD: Hội trường A1, FPT University" value={form.location} onChange={(e) => set('location', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="card p-5">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary-600" /> Thời gian
            </h2>
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
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Shield size={18} className="text-primary-600" /> Xác thực GPS
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-600">{form.gpsEnabled ? 'Bật' : 'Tắt'}</span>
                <div
                  onClick={() => set('gpsEnabled', !form.gpsEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${form.gpsEnabled ? 'bg-primary-600' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.gpsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
            </div>

            {form.gpsEnabled ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 bg-primary-50 rounded-lg p-3">
                  Sinh viên phải đứng trong bán kính cho phép để check-in. Nên bật khi tổ chức ngoài trời hoặc GPS tốt. Tắt nếu sự kiện trong nhà tín hiệu yếu.
                </p>

                {/* Auto-detect button */}
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary-300 rounded-xl py-3 px-4 text-primary-700 font-medium text-sm hover:bg-primary-50 hover:border-primary-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {gpsLoading
                    ? <><Loader2 size={16} className="animate-spin" />Đang lấy vị trí...</>
                    : <><LocateFixed size={16} />Lấy vị trí hiện tại của tôi</>
                  }
                </button>

                {/* Detected address preview */}
                {(detectedAddress || hasCoords) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                    {detectedAddress && (
                      <p className="text-xs text-emerald-800 font-medium line-clamp-2">
                        <MapPin size={11} className="inline mr-1" />
                        {detectedAddress}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-emerald-600 font-mono">
                        {form.lat}, {form.lng}
                      </p>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary-600 hover:underline font-medium"
                        >
                          Xem bản đồ <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Manual override */}
                <div>
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <AlertCircle size={11} />
                    Hoặc nhập tọa độ thủ công (nếu biết chính xác)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Vĩ độ (Latitude) <span className="text-red-500">*</span></label>
                      <input
                        className="input font-mono text-sm"
                        placeholder="10.8495"
                        type="number"
                        step="any"
                        value={form.lat}
                        onChange={(e) => { set('lat', e.target.value); setDetectedAddress(''); }}
                      />
                    </div>
                    <div>
                      <label className="label">Kinh độ (Longitude) <span className="text-red-500">*</span></label>
                      <input
                        className="input font-mono text-sm"
                        placeholder="106.7740"
                        type="number"
                        step="any"
                        value={form.lng}
                        onChange={(e) => { set('lng', e.target.value); setDetectedAddress(''); }}
                      />
                    </div>
                  </div>
                </div>

                {/* Radius */}
                <div>
                  <label className="label">Bán kính cho phép (mét)</label>
                  <input className="input" type="number" min="50" max="1000" value={form.radius} onChange={(e) => set('radius', e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Tối thiểu 50m. Trong nhà nên đặt 150–200m.</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
                GPS tắt: hệ thống sẽ chỉ dùng Dynamic QR + Device Binding để chống gian lận. Phù hợp với sự kiện trong nhà tín hiệu GPS yếu.
              </p>
            )}
          </div>

          {/* Whitelist */}
          <div className="card p-5">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={18} className="text-primary-600" /> Danh sách tham dự
            </h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-primary-600"
                checked={form.isWhitelisted} onChange={(e) => set('isWhitelisted', e.target.checked)} />
              <div>
                <p className="text-sm font-medium text-gray-700">Chỉ cho phép danh sách đã đăng ký</p>
                <p className="text-xs text-gray-400">Nếu bật, chỉ sinh viên trong whitelist mới check-in được</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pb-6">
            <button type="button" onClick={() => navigate('/events')} className="btn-secondary btn-lg flex-1">
              Huỷ
            </button>
            <button type="submit" disabled={loading} className="btn-primary btn-lg flex-[2]">
              {loading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              {loading ? 'Đang tạo...' : 'Tạo sự kiện'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
