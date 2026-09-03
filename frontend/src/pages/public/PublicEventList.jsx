import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, MapPin, Clock, Users, Search,
  ArrowRight, ChevronLeft, AlertCircle, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { publicApi } from '../../services/api';
import Spinner from '../../components/ui/Spinner';

export default function PublicEventList() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = (q = '') => {
    setLoading(true);
    setLoadError(false);
    publicApi.listEvents(q ? { search: q } : undefined)
      .then(({ data }) => setEvents(data.data || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Tìm kiếm có debounce để không bắn request theo từng ký tự.
  useEffect(() => {
    const timer = setTimeout(() => load(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="logo" className="w-8 h-8" />
            <span className="font-bold text-gray-900">FPT Event</span>
          </Link>
          <Link to="/login" className="text-sm font-semibold text-primary-600 hover:underline">
            Đăng nhập
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-brand px-5 py-10">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ChevronLeft size={15} /> Trang chủ
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Đăng ký tham gia sự kiện</h1>
          <p className="text-white/75 text-sm mt-2 max-w-xl">
            Chọn sự kiện bạn muốn tham dự và điền thông tin đăng ký. Chưa có tài khoản?
            Hệ thống sẽ tự tạo và gửi thông tin đăng nhập qua email cho bạn.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-11"
            placeholder="Tìm sự kiện theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className="card flex flex-col items-center gap-3 py-16">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium text-gray-500">Không tải được danh sách sự kiện</p>
            <button onClick={() => load(search.trim())} className="btn-primary btn-sm mt-1">
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <CalendarDays size={28} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600 text-sm">
              {search ? 'Không tìm thấy sự kiện phù hợp' : 'Hiện chưa có sự kiện nào mở đăng ký'}
            </p>
            <p className="text-gray-400 text-xs mt-1">Hãy quay lại sau hoặc liên hệ Ban tổ chức.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const start = event.checkinOpen ? new Date(event.checkinOpen) : null;

  return (
    <Link
      to={`/dang-ky/${event.id}`}
      className="card p-5 flex items-start gap-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-700 flex flex-col items-center justify-center flex-shrink-0 gap-0.5">
        {start ? (
          <>
            <span className="text-lg font-extrabold leading-none">{format(start, 'dd')}</span>
            <span className="uppercase text-[10px] font-bold">{format(start, 'MMM', { locale: vi })}</span>
          </>
        ) : (
          <CalendarDays size={20} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">{event.name}</h3>
        {event.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{event.description}</p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <MapPin size={12} className="text-gray-400" /> {event.location}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Clock size={12} className="text-gray-400" />
            {start ? format(start, 'HH:mm, dd/MM/yyyy') : 'Điểm danh thủ công'}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Users size={12} className="text-gray-400" />
            {event._count?.eventMembers ?? 0} người đã đăng ký
          </span>
        </div>
      </div>

      <span className="btn-primary btn-sm flex-shrink-0 hidden sm:inline-flex">
        Đăng ký <ArrowRight size={14} />
      </span>
      <ArrowRight size={18} className="text-gray-300 group-hover:text-primary-600 transition-colors sm:hidden mt-1" />
    </Link>
  );
}
