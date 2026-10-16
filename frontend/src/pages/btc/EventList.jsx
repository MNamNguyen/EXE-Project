import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ellipsis, Globe, Link2, Mail, Pencil, Plus, QrCode, ScanLine, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import Button, { IconButton } from '../../components/ui/Button';
import Badge, { PhaseBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Pagination from '../../components/ui/Pagination';
import Dropdown, { MenuGroup, MenuItem, MenuSeparator } from '../../components/ui/Dropdown';
import { useConfirm } from '../../components/ui/Modal';
import { TableCard, Th } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/Input';
import { EmptyText, LoadError, SkeletonRows } from '../../components/ui/States';
import { eventDate, eventPhase, formatNumber, fullDate, isInvitationEvent, timeRange } from '../../utils/eventStatus';

const PAGE_SIZE = 12;

// Tab trạng thái gửi kèm tham số `status` (live | upcoming | ended) khi gọi danh sách.
const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'live', label: 'Đang diễn ra' },
  { value: 'upcoming', label: 'Sắp diễn ra' },
  { value: 'ended', label: 'Đã kết thúc' },
];

// Thiệp mời đếm khách trong danh sách mời, check-in công khai đếm người đã check-in
// (cùng nằm ở bảng khách), sự kiện thường đếm người đăng ký.
const usesGuests = (e) => isInvitationEvent(e) || e.kind === 'PUBLIC';
const registeredCount = (e) => (usesGuests(e)
  ? e._count?.guests ?? 0
  : e._count?.eventMembers ?? e._count?.attendances ?? 0);
const countNoun = (e) => ({ INVITATION: 'khách mời', PUBLIC: 'check-in' }[e.kind] || 'đăng ký');

function KindTag({ event }) {
  if (isInvitationEvent(event)) return <Badge tone="violet" icon={Mail} className="ml-2 align-middle">Thiệp mời</Badge>;
  if (event.kind === 'PUBLIC') return <Badge tone="teal" icon={Globe} className="ml-2 align-middle">Công khai</Badge>;
  return null;
}

// Nút nhanh trên mỗi dòng: màn QR (sự kiện thường) hoặc trang quét thiệp (thiệp mời).
function QuickAction({ event }) {
  return isInvitationEvent(event)
    ? <IconButton as={Link} to={`/events/${event.id}/quet-thiep`} icon={ScanLine} label="Quét thiệp" row />
    : <IconButton as="a" href={`/events/${event.id}/qr`} target="_blank" rel="noopener noreferrer" icon={QrCode} label="Mở màn QR" row />;
}

export default function EventList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const canManage = ['ADMIN', 'BTC'].includes(user?.role);
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search,    setSearch]    = useState('');
  const [query,     setQuery]     = useState(''); // từ khoá đã gửi đi (để câu "không khớp" nói đúng)
  const [status,    setStatus]    = useState('');
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);

  const load = (p = 1, s = search, st = status) => {
    setLoadError(false);
    setLoading(true);
    eventApi.list({ search: s, page: p, limit: PAGE_SIZE, ...(st && { status: st }) })
      .then(({ data }) => { setEvents(data.data || []); setTotal(data.total || 0); setQuery(s); })
      .catch(() => { setLoadError(true); toast.error('Không tải được danh sách'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    load(1, '');
  };

  const changeStatus = (st) => {
    setStatus(st);
    setPage(1);
    load(1, search, st);
  };

  const goToPage = (p) => { setPage(p); load(p, search); };

  const handleDelete = async (id, name) => {
    if (!(await confirm({
      title: 'Xoá sự kiện?',
      body: <>Sự kiện <span className="font-medium text-foreground">{name}</span> sẽ bị xoá khỏi danh sách.</>,
      confirmLabel: 'Xoá sự kiện',
    }))) return;
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

  const copyRegistrationLink = async (id) => {
    const url = `${window.location.origin}/dang-ky/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Đã copy link đăng ký');
    } catch {
      toast(url, { duration: 8000 });
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const eventMenu = (event) => (
    <Dropdown align="end" ariaLabel="Thao tác" trigger={<IconButton icon={Ellipsis} label="Thao tác" row />}>
      <MenuGroup>
        {event.allowRegistration !== false && (
          <MenuItem icon={Link2} onSelect={() => copyRegistrationLink(event.id)}>Sao chép link đăng ký</MenuItem>
        )}
        <MenuItem icon={Pencil} onSelect={() => navigate(`/events/${event.id}?edit=1`)}>Sửa sự kiện</MenuItem>
      </MenuGroup>
      <MenuSeparator />
      <MenuGroup>
        <MenuItem icon={Trash2} danger onSelect={() => handleDelete(event.id, event.name)}>Xoá sự kiện</MenuItem>
      </MenuGroup>
    </Dropdown>
  );

  let body;
  if (loading) body = <SkeletonRows rows={8} avatar={false} />;
  else if (loadError) body = <LoadError title="Không tải được danh sách sự kiện" onRetry={() => load(page, search)} />;
  else if (events.length === 0) {
    body = query ? (
      <p className="text-pretty py-10 text-center text-sm text-muted">
        Không có sự kiện nào khớp <span className="text-foreground">“{query}”</span>. Thử từ khoá khác.{' '}
        <button type="button" onClick={clearSearch} className="font-medium text-foreground underline-offset-4 hover:underline">Xoá tìm kiếm</button>
      </p>
    ) : (
      <EmptyText className="py-10">{canManage ? 'Chưa có sự kiện nào. Bấm Tạo sự kiện để bắt đầu.' : 'Chưa có sự kiện nào.'}</EmptyText>
    );
  } else {
    body = (
      <>
        <table className="hidden w-full text-sm sm:table">
          <thead className="border-b border-border">
            <tr>
              <Th className="w-full">Sự kiện</Th>
              <Th>Thời gian</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Đăng ký</Th>
              {canManage && <th className="w-px px-2"><span className="sr-only">Thao tác</span></th>}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                <td className="max-w-0 px-4 py-3">
                  <div className="flex min-w-0 items-center">
                    <Link to={`/events/${event.id}`} title={event.name} className="block truncate font-medium text-foreground outline-none hover:underline">
                      {event.name}
                    </Link>
                    <KindTag event={event} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{event.location}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {eventDate(event) ? (
                    <>
                      <p className="text-foreground">{fullDate(eventDate(event))}</p>
                      <p className="mt-0.5 text-xs text-muted">{timeRange(event)}</p>
                    </>
                  ) : <p className="text-muted">—</p>}
                </td>
                <td className="px-4 py-3"><PhaseBadge phase={eventPhase(event)} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatNumber(registeredCount(event))}</td>
                {canManage && (
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-1">
                      <QuickAction event={event} />
                      {eventMenu(event)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-border sm:hidden">
          {events.map((event) => (
            <li key={event.id} className="relative flex items-start gap-3 px-4 py-3 hover:bg-surface-hover">
              <div className="min-w-0 flex-1">
                <Link to={`/events/${event.id}`} className="line-clamp-2 text-pretty text-sm font-medium text-foreground outline-none before:absolute before:inset-0">
                  {event.name}
                </Link>
                <p className="mt-1 text-xs tabular-nums text-muted">
                  {eventDate(event) ? `${fullDate(eventDate(event))} · ${timeRange(event)}` : 'Chưa đặt lịch'}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <PhaseBadge phase={eventPhase(event)} />
                  <span className="text-sm tabular-nums text-muted">
                    {formatNumber(registeredCount(event))} {countNoun(event)}
                  </span>
                </div>
              </div>
              {canManage && <div className="relative">{eventMenu(event)}</div>}
            </li>
          ))}
        </ul>
        <Pagination page={page} pages={totalPages} total={total} pageSize={PAGE_SIZE} noun="sự kiện" onPageChange={goToPage} />
      </>
    );
  }

  return (
    <Layout
      title="Sự kiện"
      headerRight={canManage && <Button as={Link} to="/events/new" variant="primary" size="hdr" icon={Plus}>Tạo sự kiện</Button>}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs variant="boxed" ariaLabel="Lọc theo trạng thái" mobileSelectLabel="Trạng thái:" items={STATUS_TABS} value={status} onChange={changeStatus} />
        <form onSubmit={handleSearch} className="w-full sm:w-72">
          <SearchInput placeholder="Tìm sự kiện theo tên" value={search} onChange={(e) => setSearch(e.target.value)} onClear={clearSearch} />
        </form>
      </div>
      <TableCard>{body}</TableCard>
    </Layout>
  );
}
