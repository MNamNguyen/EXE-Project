import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { publicApi } from '../../services/api';
import Button from '../../components/ui/Button';
import { DateTile } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/Input';
import { EmptyText, LoadError, SkeletonRows } from '../../components/ui/States';
import { formatNumber, timeRange } from '../../utils/eventStatus';
import PublicHeader from './PublicHeader';

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

  let list;
  if (loading) list = <SkeletonRows rows={4} />;
  else if (loadError) list = <LoadError title="Không tải được danh sách sự kiện" onRetry={() => load(search.trim())} />;
  else if (events.length === 0) {
    list = search ? (
      <p className="text-pretty py-6 text-center text-sm text-muted">
        Không có sự kiện nào khớp <span className="text-foreground">“{search}”</span>.{' '}
        <button type="button" onClick={() => setSearch('')} className="font-medium text-foreground underline-offset-4 hover:underline">Xoá tìm kiếm</button>
      </p>
    ) : (
      <EmptyText>Hiện chưa có sự kiện nào mở đăng ký. Hãy quay lại sau hoặc liên hệ Ban tổ chức.</EmptyText>
    );
  } else {
    list = (
      <ul className="flex flex-col gap-0.5">
        {events.map((event) => {
          const registered = event._count?.eventMembers ?? 0;
          return (
            <li key={event.id}>
              <Link to={`/dang-ky/${event.id}`} className="group flex items-center gap-3 rounded-xl px-3 py-3 outline-none hover:bg-item-hover">
                <DateTile date={event.checkinOpen} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-pretty text-sm font-medium text-foreground">{event.name}</p>
                  <p className="mt-1 truncate text-xs text-muted">{event.checkinOpen ? timeRange(event) : 'Chưa đặt lịch'} · {event.location}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted">
                    {registered ? `${formatNumber(registered)} người đã đăng ký` : 'Chưa có ai đăng ký'}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader right={<Button as={Link} to="/login" size="hdr">Đăng nhập</Button>} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-balance text-xl font-semibold text-foreground">Đăng ký tham gia sự kiện</h1>
          <p className="mt-2 max-w-[55ch] text-pretty text-sm/6 text-muted">
            Chọn sự kiện và điền thông tin đăng ký. Chưa có tài khoản thì hệ thống gửi thông tin đăng nhập qua email.
          </p>
        </header>
        <div className="mb-4">
          <SearchInput placeholder="Tìm sự kiện theo tên" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <section className="rounded-2xl border border-border bg-surface p-2">{list}</section>
      </main>
    </div>
  );
}
