import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, MapPin, Clock, ChevronRight,
  Users, BarChart3, CheckCircle2, Layers,
  Sparkles, Circle, RefreshCw, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { eventApi, adminApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';

export default function StudentDashboard() {
  const { user } = useAuth();
  const isAdminOrBtc = ['ADMIN', 'BTC'].includes(user?.role);

  const [events,    setEvents]    = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchAll = async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const eventsRes = await eventApi.list({ limit: 20 });
      setEvents(eventsRes.data.data || []);

      if (isAdminOrBtc) {
        const statsRes = await adminApi.getStats();
        setStats(statsRes.data.data);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [isAdminOrBtc]);

  const upcoming = events.filter((e) => new Date(e.checkinOpen) >= new Date());
  const past     = events.filter((e) => new Date(e.checkinOpen) < new Date());

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="bg-gradient-brand px-6 py-8 md:py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
            <Sparkles size={14} className="text-yellow-300" />
            Xin chào,
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{user?.name}</h1>
          <p className="text-white/75 text-sm mt-1">
            {user?.mssv && <span>{user.mssv} · </span>}
            {user?.class || 'FPT University'}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className="card flex flex-col items-center gap-3 py-16">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium text-gray-500">Không thể tải dữ liệu</p>
            <p className="text-xs text-gray-400">Server có thể đang khởi động lại. Vui lòng thử lại sau vài giây.</p>
            <button onClick={fetchAll} className="flex items-center gap-2 btn-primary btn-sm mt-1">
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : (
          <>
            {/* ── Stats cards (Admin / BTC only) ── */}
            {isAdminOrBtc && stats && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Tổng quan hệ thống
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    icon={Users}
                    label="Tổng người dùng"
                    value={stats.totalUsers}
                    color="text-blue-600 bg-blue-50"
                  />
                  <StatCard
                    icon={CalendarDays}
                    label="Sự kiện đang mở"
                    value={stats.totalEvents}
                    color="text-violet-600 bg-violet-50"
                  />
                  <StatCard
                    icon={Layers}
                    label="Sinh viên"
                    value={stats.totalStudents}
                    color="text-emerald-600 bg-emerald-50"
                  />
                  <StatCard
                    icon={CheckCircle2}
                    label="Lượt điểm danh"
                    value={stats.totalCheckins}
                    color="text-orange-600 bg-orange-50"
                  />
                </div>
              </section>
            )}

            {/* ── Quick actions (Admin / BTC) ── */}
            {isAdminOrBtc && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Thao tác nhanh
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Link to="/events/new"
                    className="card p-4 flex items-center gap-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                      <CalendarDays size={18} className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">Tạo sự kiện</p>
                      <p className="text-xs text-gray-400 truncate">Tạo sự kiện mới với QR</p>
                    </div>
                    <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
                  </Link>

                  <Link to="/events"
                    className="card p-4 flex items-center gap-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                      <BarChart3 size={18} className="text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">Quản lý sự kiện</p>
                      <p className="text-xs text-gray-400 truncate">Xem báo cáo & điểm danh</p>
                    </div>
                    <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
                  </Link>

                  {user?.role === 'ADMIN' && (
                    <Link to="/admin/users"
                      className="card p-4 flex items-center gap-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                        <Users size={18} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">Quản lý người dùng</p>
                        <p className="text-xs text-gray-400 truncate">Import & cấu hình tài khoản</p>
                      </div>
                      <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* ── Upcoming events ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-gradient-brand" />
                  Sự kiện sắp diễn ra
                  <span className="text-xs font-semibold text-gray-400 normal-case tracking-normal">
                    ({upcoming.length})
                  </span>
                </h2>
                {isAdminOrBtc && (
                  <Link to="/events" className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1">
                    Xem tất cả <ChevronRight size={12} />
                  </Link>
                )}
              </div>

              {upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Không có sự kiện sắp tới"
                  desc={isAdminOrBtc ? 'Tạo sự kiện mới để bắt đầu.' : 'Hãy chờ thông báo từ Ban tổ chức.'}
                  action={isAdminOrBtc && (
                    <Link to="/events/new" className="btn-primary btn-sm mt-3 inline-flex items-center gap-1.5">
                      <CalendarDays size={14} /> Tạo sự kiện
                    </Link>
                  )}
                />
              ) : (
                <div className="space-y-3">
                  {upcoming.map((event) => (
                    <EventCard key={event.id} event={event} isAdminOrBtc={isAdminOrBtc} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Past events ── */}
            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-4 rounded-full bg-gray-200" />
                  Sự kiện đã qua
                </h2>
                <div className="space-y-2">
                  {past.slice(0, 5).map((event) => (
                    <EventCard key={event.id} event={event} past isAdminOrBtc={isAdminOrBtc} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

/* ─────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900 leading-none">
          {value?.toLocaleString() ?? '—'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="card p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
        <Icon size={28} className="text-gray-300" />
      </div>
      <p className="font-semibold text-gray-600 text-sm">{title}</p>
      <p className="text-gray-400 text-xs mt-1">{desc}</p>
      {action}
    </div>
  );
}

function EventCard({ event, past, isAdminOrBtc }) {
  const checkinOpen  = new Date(event.checkinOpen);
  const checkinClose = new Date(event.checkinClose);
  const now          = new Date();
  const isLive       = now >= checkinOpen && now <= checkinClose;

  return (
    <div className={`card p-4 transition-all ${past ? 'opacity-60' : 'hover:shadow-card-hover'}`}>
      <div className="flex items-start gap-3">
        {/* Date badge */}
        <div className={`
          w-12 h-12 rounded-xl flex-shrink-0 flex flex-col items-center justify-center
          text-xs font-bold leading-none gap-0.5
          ${isLive  ? 'bg-gradient-brand text-white shadow-glow'
          : past    ? 'bg-gray-100 text-gray-400'
                    : 'bg-primary-50 text-primary-700'}
        `}>
          <span className="text-[17px] font-extrabold">{format(checkinOpen, 'dd')}</span>
          <span className="uppercase text-[10px]">{format(checkinOpen, 'MMM', { locale: vi })}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1">
              {event.name}
            </h3>
            {isLive && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                <Circle size={6} className="fill-emerald-500 text-emerald-500" />
                LIVE
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin size={11} />
              {event.location}
            </p>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={11} />
              {format(checkinOpen, 'HH:mm')} – {format(checkinClose, 'HH:mm')}
            </p>
          </div>
        </div>

        {/* Arrow (admin/btc → link to detail) */}
        {isAdminOrBtc && (
          <Link to={`/events/${event.id}`} className="p-1.5 rounded-lg text-gray-300 hover:text-primary-600 hover:bg-primary-50 transition-colors flex-shrink-0">
            <ChevronRight size={16} />
          </Link>
        )}
      </div>

      {/* Live CTA for students */}
      {isLive && !isAdminOrBtc && (
        <div className="mt-3 bg-primary-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <p className="text-xs text-primary-700 font-medium">
            Đang mở check-in — quét mã QR tại cửa vào
          </p>
          <ChevronRight size={14} className="text-primary-400 flex-shrink-0" />
        </div>
      )}
    </div>
  );
}
