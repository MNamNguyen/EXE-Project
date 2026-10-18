import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy, Ellipsis, FileCode2, FileDown, FileSpreadsheet, FileText, KeyRound, Link2, Mail, Pencil, Plus, ScanLine,
  Send, Trash2, Undo2, Upload, UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { guestApi, reportApi } from '../../../services/api';
import Button, { IconButton, OutlineIconButton } from '../../../components/ui/Button';
import Badge, { PhaseBadge } from '../../../components/ui/Badge';
import Tabs from '../../../components/ui/Tabs';
import Select from '../../../components/ui/Select';
import Pagination from '../../../components/ui/Pagination';
import Dropdown, { MenuGroup, MenuItem, MenuSeparator } from '../../../components/ui/Dropdown';
import { useConfirm } from '../../../components/ui/Modal';
import { StatGrid, TableCard, Th } from '../../../components/ui/Card';
import { SearchInput } from '../../../components/ui/Input';
import { EmptyText, LoadError, SkeletonRows } from '../../../components/ui/States';
import { eventPhase, longDate } from '../../../utils/eventStatus';
import { downloadBlob } from '../../certificates/certRender';
import EventEditModal from '../EventEditModal';
import ReportViewerModal from '../ReportViewerModal';
import GuestFormModal from './GuestFormModal';
import GuestImportModal from './GuestImportModal';
import ScannerLinkModal from './ScannerLinkModal';
import InvitationPanel from './InvitationPanel';
import SeatMapPanel from './SeatMapPanel';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'checked', label: 'Đã tới' },
  { value: 'pending', label: 'Chưa tới' },
  { value: 'walkin', label: 'Khách tại chỗ' },
  { value: 'invite-failed', label: 'Gửi thiệp lỗi' },
];

const INVITE_BADGE = {
  PENDING: { label: 'Chưa gửi', tone: 'neutral' },
  SENDING: { label: 'Đang gửi', tone: 'warning' },
  SENT: { label: 'Đã gửi', tone: 'success' },
  FAILED: { label: 'Gửi lỗi', tone: 'error' },
};

function InviteBadge({ guest }) {
  if (guest.isWalkIn) return <Badge tone="teal">Tại chỗ</Badge>;
  if (!guest.email) return <Badge>Không có email</Badge>;
  const b = INVITE_BADGE[guest.inviteStatus] || { label: guest.inviteStatus, tone: 'neutral' };
  return <Badge tone={b.tone} icon={Mail}>{b.label}</Badge>;
}

// "2 vé" + ghế bên dưới; khách 1 vé không ghế thì chỉ "1".
function TicketCell({ guest }) {
  return (
    <div className="tabular-nums">
      <p className="text-foreground">{guest.ticketCount}</p>
      {guest.seats?.length > 0 && <p className="mt-0.5 max-w-[16ch] truncate text-xs text-muted" title={guest.seats.join(', ')}>{guest.seats.join(', ')}</p>}
    </div>
  );
}

function CheckinCell({ guest }) {
  if (!guest.checkedInAt) return <span className="text-muted">—</span>;
  return (
    <span title={guest.checkedInBy ? `Người check-in: ${guest.checkedInBy}` : undefined} className="tabular-nums text-foreground">
      {format(new Date(guest.checkedInAt), 'HH:mm')}
    </span>
  );
}

// Trang chi tiết của sự kiện thiệp mời (EventDetail rẽ sang đây khi kind = INVITATION).
// Khách mời là khách ngoài — danh sách nằm ở EventGuest, không phải bảng điểm danh.
export default function InvitationEventDetail({ event, onEventChanged }) {
  const confirm = useConfirm();
  const [guests, setGuests] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loadState, setLoadState] = useState('loading'); // loading | ok | error | forbidden
  const [tab, setTab] = useState('guests');
  const [formGuest, setFormGuest] = useState(undefined); // undefined = đóng, null = thêm mới
  const [importOpen, setImportOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exporting, setExporting] = useState(null);

  const load = useCallback((p = page) => guestApi.list(event.id, { page: p, limit: PAGE_SIZE, search, status })
    .then(({ data }) => {
      setGuests(data.data || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
      setLoadState('ok');
    })
    .catch((err) => setLoadState(err.response?.status === 403 ? 'forbidden' : (s) => (s === 'ok' ? 'ok' : 'error'))),
  [event.id, page, search, status]);

  // Đổi bộ lọc → về trang 1 (debounce ô tìm kiếm).
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tự làm mới khi đang có khách check-in ở cửa.
  useEffect(() => {
    const t = setInterval(() => load(page), 15000);
    return () => clearInterval(t);
  }, [load, page]);

  const reload = () => load(page);

  const goToPage = (p) => { setPage(p); load(p); };

  const act = async (call, fallback = 'Thao tác thất bại') => {
    try {
      const { data } = await call();
      if (data?.message) toast.success(data.message);
      reload();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || fallback);
      return false;
    }
  };

  const copyText = async (text, ok) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ok);
    } catch {
      toast(text, { duration: 8000 });
    }
  };

  const handleDelete = async (g) => {
    if (!(await confirm({
      title: 'Xoá khách khỏi danh sách?',
      body: (
        <>
          <span className="font-medium text-foreground">{g.name}</span> sẽ bị xoá, thiệp đã gửi không quét được nữa.
          {g.checkedInAt && ' Khách này đã check-in — lượt check-in cũng bị xoá khỏi báo cáo.'}
        </>
      ),
      confirmLabel: 'Xoá khách',
    }))) return;
    act(() => guestApi.remove(event.id, g.id));
  };

  const handleRotate = async (g) => {
    if (!(await confirm({
      title: 'Cấp lại mã thiệp?',
      body: <>Thiệp cũ của <span className="font-medium text-foreground">{g.name}</span> sẽ không quét được nữa. Dùng khi thiệp bị lộ hoặc gửi nhầm người — nhớ gửi lại thiệp mới.</>,
      confirmLabel: 'Cấp mã mới',
      tone: 'neutral',
      icon: KeyRound,
    }))) return;
    act(() => guestApi.rotateCode(event.id, g.id));
  };

  const handleUndo = async (g) => {
    if (!(await confirm({
      title: 'Huỷ check-in?',
      body: <><span className="font-medium text-foreground">{g.name}</span> sẽ trở về trạng thái chưa tới. Dùng khi lỡ check-in nhầm người.</>,
      confirmLabel: 'Huỷ check-in',
      icon: Undo2,
    }))) return;
    act(() => guestApi.undoCheckIn(event.id, g.id));
  };

  const handleGuestPdf = async (g) => {
    try {
      const { data } = await guestApi.guestPdf(event.id, g.id);
      downloadBlob(data, `thiep-moi-${g.name}.pdf`);
    } catch {
      toast.error('Không tạo được thiệp');
    }
  };

  const handleExport = async (kind) => {
    setExporting(kind);
    try {
      if (kind === 'xlsx') {
        const { data } = await reportApi.exportAttendance(event.id);
        downloadBlob(data, `khachmoi-${event.name}.xlsx`);
      } else {
        const { data } = await reportApi.exportAttendanceHtml(event.id);
        downloadBlob(data, `baocao-${event.name}.html`);
      }
    } catch {
      toast.error('Xuất báo cáo thất bại');
    } finally {
      setExporting(null);
    }
  };

  const guestMenu = (g) => (
    <Dropdown align="end" ariaLabel={`Thao tác với ${g.name}`} trigger={<IconButton icon={Ellipsis} label="Thao tác" row />}>
      <MenuGroup>
        {g.checkedInAt
          ? <MenuItem icon={Undo2} onSelect={() => handleUndo(g)}>Huỷ check-in</MenuItem>
          : <MenuItem icon={UserCheck} onSelect={() => act(() => guestApi.checkIn(event.id, g.id))}>Check-in thủ công</MenuItem>}
        <MenuItem icon={Pencil} onSelect={() => setFormGuest(g)}>Sửa thông tin</MenuItem>
      </MenuGroup>
      {!g.isWalkIn && (
        <>
          <MenuSeparator />
          <MenuGroup>
            <MenuItem icon={FileDown} onSelect={() => handleGuestPdf(g)}>Tải thiệp (PDF)</MenuItem>
            <MenuItem icon={Copy} onSelect={() => copyText(g.inviteUrl, 'Đã copy link thiệp')}>Sao chép link thiệp</MenuItem>
            {g.email && (
              <MenuItem icon={Send} onSelect={() => act(() => guestApi.send(event.id, [g.id]), 'Gửi thiệp thất bại')}>
                {g.inviteStatus === 'SENT' ? 'Gửi lại thiệp' : 'Gửi thiệp'}
              </MenuItem>
            )}
            <MenuItem icon={KeyRound} onSelect={() => handleRotate(g)}>Cấp lại mã thiệp</MenuItem>
          </MenuGroup>
        </>
      )}
      <MenuSeparator />
      <MenuGroup>
        <MenuItem icon={Trash2} danger onSelect={() => handleDelete(g)}>Xoá khỏi danh sách</MenuItem>
      </MenuGroup>
    </Dropdown>
  );

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md pb-16 pt-16 text-center sm:pt-24">
        <h1 className="text-xl font-semibold text-foreground">{event.name}</h1>
        <p className="mt-2 text-pretty text-sm/6 text-muted">Chỉ người tạo sự kiện hoặc Admin quản lý được danh sách khách mời của sự kiện này.</p>
        <Button as={Link} to="/events" size="form" className="mt-6">Về danh sách sự kiện</Button>
      </div>
    );
  }

  const phase = eventPhase(event);
  // Một thiệp có thể mang nhiều vé → số liệu "người" là tổng số vé.
  const presentPct = stats?.tickets ? Math.round((stats.ticketsCheckedIn / stats.tickets) * 100) : 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const filtered = Boolean(search || status);

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-lg font-semibold text-foreground">{event.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted sm:gap-3">
            <PhaseBadge phase={phase} />
            <Badge tone="violet" icon={Mail}>Thiệp mời</Badge>
            {event.startsAt && <span className="tabular-nums">{format(new Date(event.startsAt), 'HH:mm')} · {longDate(event.startsAt)}</span>}
          </div>
          <p className="mt-2 max-w-[55ch] text-pretty text-sm/6 text-muted">{event.location}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button as={Link} to={`/events/${event.id}/quet-thiep`} variant="primary" icon={ScanLine}>Quét thiệp</Button>
          <Button icon={FileText} onClick={() => setReportOpen(true)}>Báo cáo</Button>
          <Dropdown align="end" ariaLabel="Thêm thao tác" trigger={<OutlineIconButton icon={Ellipsis} label="Thêm thao tác" />}>
            <MenuGroup>
              <MenuItem icon={Pencil} onSelect={() => setEditOpen(true)}>Sửa sự kiện</MenuItem>
              <MenuItem icon={Link2} onSelect={() => setScannerOpen(true)}>Link quét cho tình nguyện viên</MenuItem>
              <MenuItem icon={FileSpreadsheet} disabled={exporting === 'xlsx'} onSelect={() => handleExport('xlsx')}>Tải file Excel</MenuItem>
              <MenuItem icon={FileCode2} disabled={exporting === 'html'} onSelect={() => handleExport('html')}>Tải file HTML</MenuItem>
            </MenuGroup>
          </Dropdown>
        </div>
      </header>

      <StatGrid
        tiles={[
          { label: 'Vé đã mời', value: stats?.invitedTickets ?? '—', sub: stats ? `${stats.invited} thiệp · ${stats.seatsAssigned} ghế đã xếp` : undefined },
          { label: 'Đã tới', value: stats ? `${stats.ticketsCheckedIn}/${stats.tickets}` : '—', unit: 'người', sub: stats?.tickets ? `${presentPct}% · ${stats.checkedIn} thiệp đã quét` : undefined },
          { label: 'Khách tại chỗ', value: stats ? stats.tickets - stats.invitedTickets : '—', sub: stats?.walkIns ? `${stats.walkIns} lượt thêm` : undefined },
          {
            label: 'Thiệp đã gửi',
            value: stats ? `${stats.sent}/${stats.withEmail}` : '—',
            sub: stats?.failed ? `${stats.failed} email gửi lỗi` : undefined,
            subTone: 'warning',
          },
        ]}
      />

      <div className="mb-4 mt-6">
        <Tabs
          variant="underline"
          ariaLabel="Nội dung sự kiện"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'guests', label: 'Khách mời', count: stats?.total ?? 0 },
            { value: 'seats', label: 'Sơ đồ ghế' },
            { value: 'invitation', label: 'Thiệp mời' },
          ]}
        />
      </div>

      <div hidden={tab !== 'guests'}>
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput className="w-full sm:w-64" placeholder="Tìm theo tên, SĐT, email, ghế" value={search}
              onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} />
            <Select inline label="Trạng thái:" aria-label="Lọc theo trạng thái" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex xl:ml-auto">
            <Button icon={Upload} iconClassName="hidden size-4 shrink-0 sm:block" onClick={() => setImportOpen(true)}>Import Excel</Button>
            <Button icon={Plus} iconClassName="hidden size-4 shrink-0 sm:block" onClick={() => setFormGuest(null)}>Thêm khách</Button>
          </div>
        </div>

        <TableCard>
          {loadState === 'loading' ? (
            <SkeletonRows rows={6} avatar={false} />
          ) : loadState === 'error' ? (
            <LoadError title="Không tải được danh sách khách mời" onRetry={reload} />
          ) : guests.length === 0 ? (
            <EmptyText className="py-10">
              {filtered ? 'Không có khách nào khớp bộ lọc.' : 'Chưa có khách mời. Bấm “Import Excel” để nhập cả danh sách, hoặc “Thêm khách” để thêm từng người.'}
            </EmptyText>
          ) : (
            <>
              <table className="hidden w-full text-sm sm:table">
                <thead className="border-b border-border">
                  <tr>
                    <Th className="w-full">Khách</Th>
                    <Th>Vé · ghế</Th>
                    <Th>Thiệp</Th>
                    <Th>Check-in</Th>
                    <th className="w-px px-2"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="max-w-0 px-4 py-3">
                        <p className="truncate font-medium text-foreground" title={g.name}>{g.name}</p>
                        <p className="mt-0.5 truncate text-xs tabular-nums text-muted">{[g.phone, g.email].filter(Boolean).join(' · ') || '—'}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><TicketCell guest={g} /></td>
                      <td className="whitespace-nowrap px-4 py-3"><InviteBadge guest={g} /></td>
                      <td className="whitespace-nowrap px-4 py-3"><CheckinCell guest={g} /></td>
                      <td className="px-2 py-3">{guestMenu(g)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-border sm:hidden">
                {guests.map((g) => (
                  <li key={g.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                      <p className="mt-0.5 truncate text-xs tabular-nums text-muted">{[g.phone, g.email].filter(Boolean).join(' · ') || '—'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {(g.ticketCount > 1 || g.seats?.length > 0) && (
                          <Badge tone="info">{[g.ticketCount > 1 && `${g.ticketCount} vé`, g.seats?.join(', ')].filter(Boolean).join(' · ')}</Badge>
                        )}
                        <InviteBadge guest={g} />
                        {g.checkedInAt && <Badge tone="success" icon={UserCheck}>{format(new Date(g.checkedInAt), 'HH:mm')}</Badge>}
                      </div>
                    </div>
                    {guestMenu(g)}
                  </li>
                ))}
              </ul>
              <Pagination
                compact
                page={page}
                pages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                noun="khách"
                note="tự cập nhật mỗi 15 giây"
                onPageChange={goToPage}
              />
            </>
          )}
        </TableCard>
      </div>

      <div hidden={tab !== 'seats'}>
        <SeatMapPanel event={event} visible={tab === 'seats'} onChanged={reload} />
      </div>

      <div hidden={tab !== 'invitation'}>
        <InvitationPanel event={event} stats={stats} onChanged={reload} />
      </div>

      <GuestFormModal
        open={formGuest !== undefined}
        eventId={event.id}
        guest={formGuest}
        onClose={() => setFormGuest(undefined)}
        onSaved={reload}
      />
      <GuestImportModal open={importOpen} eventId={event.id} onClose={() => setImportOpen(false)} onImported={reload} />
      <ScannerLinkModal open={scannerOpen} eventId={event.id} onClose={() => setScannerOpen(false)} />
      <EventEditModal open={editOpen} event={event} onClose={() => setEditOpen(false)} onSaved={onEventChanged} />
      <ReportViewerModal open={reportOpen} eventId={event.id} eventName={event.name} onClose={() => setReportOpen(false)} />
    </>
  );
}
