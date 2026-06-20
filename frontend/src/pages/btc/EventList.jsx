import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, CalendarDays, MapPin, Clock, QrCode, Users, ChevronLeft, ChevronRight, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';

export default function EventList() {
  const navigate = useNavigate();
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search,    setSearch]    = useState('');
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);

  const PAGE_SIZE = 12;

  const load = (p = 1, s = search) => {
    setLoadError(false);
    setLoading(true);
    eventApi.list({ search: s, page: p, limit: PAGE_SIZE })
      .then(({ data }) => { setEvents(data.data || []); setTotal(data.total || 0); })
      .catch(() => { setLoadError(true); toast.error('Không tải được danh sách'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const goToPage = (p) => { setPage(p); load(p, search); };

  const handleDelete = async (id, name) => {
    if (!confirm(`Xoá sự kiện "${name}"?`)) return;
    try {
      await eventApi.delete(id);
      toast.success('Đã xoá sự kiện');
      const nextPage = events.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      load(nextPage, search);
    } catch {
      toast.error('Xoá thất bại');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const now = new Date();

  const getStatus = (event) => {
    const open = new Date(event.checkinOpen);
    const close = new Date(event.checkoutClose);
    if (now < open) return { label: 'Sắp diễn ra', variant: 'blue' };
    if (now >= open && now <= close) return { label: 'Đang diễn ra', variant: 'green' };
    return { label: 'Đã kết thúc', variant: 'gray' };
  };

  return (
    <Layout>
      {/* Header */}
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Quản lý sự kiện</h1>
            <p className="text-white/60 text-sm mt-1">{total} sự kiện</p>
          </div>
          <button onClick={() => navigate('/events/new')} className="flex items-center gap-2 bg-white text-primary-700 font-semibold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 text-sm">
            <Plus size={18} />
            Tạo sự kiện
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-11 pr-4 bg-white"
            placeholder="Tìm kiếm sự kiện..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className="card p-16 flex flex-col items-center gap-3 text-center">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium text-gray-500">Không thể tải danh sách sự kiện</p>
            <p className="text-xs text-gray-400">Server có thể đang khởi động lại. Vui lòng thử lại.</p>
            <button onClick={() => load(page, search)} className="flex items-center gap-2 btn-primary btn-sm mt-1">
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="card p-16 text-center">
            <CalendarDays size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Chưa có sự kiện nào</p>
            <button onClick={() => navigate('/events/new')} className="btn-primary btn-md mt-4">
              <Plus size={16} /> Tạo sự kiện đầu tiên
            </button>
          </div>
        ) : (
          <>
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((event) => {
              const status = getStatus(event);
              const checkinOpen = new Date(event.checkinOpen);
              return (
                <div key={event.id} className="card-hover group overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <Badge variant={status.variant} className="mb-2">{status.label}</Badge>
                        <h3 className="font-bold text-gray-900 leading-snug line-clamp-2">{event.name}</h3>
                      </div>
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-50 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold text-primary-700 leading-none">{format(checkinOpen, 'dd')}</span>
                        <span className="text-xs text-primary-500 uppercase">{format(checkinOpen, 'MMM', { locale: vi })}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-gray-400 flex-shrink-0" />
                        <span>Check-in {format(checkinOpen, 'HH:mm')} — Checkout {format(new Date(event.checkoutClose), 'HH:mm')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={13} className="text-gray-400 flex-shrink-0" />
                        <span>{event._count?.attendances || 0} điểm danh</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-surface/50">
                    <div className="flex gap-2">
                      <Link to={`/events/${event.id}/qr`} target="_blank"
                        className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                        onClick={(e) => e.stopPropagation()}>
                        <QrCode size={13} /> QR Code
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDelete(event.id, event.name)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={15} />
                      </button>
                      <Link to={`/events/${event.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary-600 transition-colors">
                        Chi tiết <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-1">
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                className="p-1.5 rounded-lg border border-border text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`e-${idx}`} className="px-1 text-gray-400 text-xs">…</span>
                  ) : (
                    <button key={p} onClick={() => goToPage(p)}
                      className={`min-w-[30px] h-[30px] rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'border border-border text-gray-600 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                  )
                )}
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-border text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </Layout>
  );
}
