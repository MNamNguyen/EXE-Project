import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, Ellipsis, Pencil, QrCode, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { classApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Button, { OutlineIconButton } from '../../components/ui/Button';
import { PhaseBadge } from '../../components/ui/Badge';
import Modal, { useConfirm } from '../../components/ui/Modal';
import Tabs from '../../components/ui/Tabs';
import Pagination from '../../components/ui/Pagination';
import Dropdown, { MenuGroup, MenuItem, MenuSeparator } from '../../components/ui/Dropdown';
import { Card, TableCard, Th } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/Input';
import { Checkbox, CheckCell } from '../../components/ui/Choice';
import { EmptyText, Skeleton, SkeletonRows } from '../../components/ui/States';
import { isGateOpen } from '../../utils/eventStatus';
import { cx } from '../../utils/cx';
import SessionCreateModal from './SessionCreateModal';
import { ClassFormModal } from './ClassManagement';

const PAGE_SIZE = 20;

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [cls, setCls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('members'); // 'members' | 'sessions'
  const [sessionCount, setSessionCount] = useState(undefined);
  const [createModal, setCreateModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadClass = useCallback(() => {
    classApi.get(id)
      .then(({ data }) => setCls(data.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadClass(); }, [loadClass]);

  const handleCreated = (event) => {
    setCreateModal(false);
    toast.success('Đã tạo buổi điểm danh, đang mở màn hình QR...');
    navigate(`/events/${event.id}/qr`);
  };

  const openEdit = () => { setForm({ name: cls.name, description: cls.description || '' }); setEditOpen(true); };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Vui lòng nhập tên lớp');
    setSaving(true);
    try {
      await classApi.update(cls.id, form);
      toast.success('Đã cập nhật lớp');
      setEditOpen(false);
      loadClass();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Xoá lớp?',
      body: <>Lớp <span className="font-medium text-foreground">{cls.name}</span> sẽ bị xoá.</>,
      confirmLabel: 'Xoá lớp',
    }))) return;
    try {
      await classApi.remove(cls.id);
      toast.success('Đã xoá lớp');
      navigate('/classes');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
    }
  };

  const shell = (content) => <Layout parent={{ label: 'Lớp học', to: '/classes' }} activeNav="/classes">{content}</Layout>;

  if (loading) {
    return shell(
      <div aria-busy="true">
        <div className="mb-6 space-y-3"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-64" /></div>
        <TableCard><SkeletonRows rows={6} /></TableCard>
      </div>,
    );
  }

  if (notFound || !cls) {
    return shell(
      <div className="mx-auto max-w-md pb-16 pt-16 text-center sm:pt-24">
        <p className="text-sm font-medium tabular-nums text-muted">404</p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Không tìm thấy lớp</h1>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button as={Link} to="/classes" variant="primary" size="form">Quay lại danh sách lớp</Button>
        </div>
      </div>,
    );
  }

  return shell(
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-lg font-semibold text-foreground">{cls.name}</h1>
          <p className="mt-2 max-w-[55ch] text-pretty text-sm/6 text-muted">
            {[cls.description, `${cls.memberCount} thành viên`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="primary" icon={CalendarPlus} onClick={() => setCreateModal(true)}>Tạo buổi điểm danh</Button>
          <Dropdown align="end" ariaLabel="Thêm thao tác" trigger={<OutlineIconButton icon={Ellipsis} label="Thêm thao tác" />}>
            <MenuGroup><MenuItem icon={Pencil} onSelect={openEdit}>Sửa lớp</MenuItem></MenuGroup>
            <MenuSeparator />
            <MenuGroup><MenuItem icon={Trash2} danger onSelect={handleDelete}>Xoá lớp</MenuItem></MenuGroup>
          </Dropdown>
        </div>
      </header>

      <div className="mb-4">
        <Tabs
          variant="underline"
          ariaLabel="Nội dung lớp"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'members', label: 'Thành viên', count: cls.memberCount },
            { value: 'sessions', label: 'Buổi điểm danh', count: sessionCount },
          ]}
        />
      </div>

      <div hidden={tab !== 'members'}>
        <MembersTab classId={id} className={cls.name} onChanged={loadClass} />
      </div>
      <div hidden={tab !== 'sessions'}>
        <SessionsTab classId={id} onCount={setSessionCount} />
      </div>

      <SessionCreateModal
        open={createModal}
        classId={id}
        className={cls.name}
        onClose={() => setCreateModal(false)}
        onCreated={handleCreated}
      />

      <ClassFormModal
        open={editOpen}
        mode="edit"
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
      />
    </>,
  );
}

/* ═══════════════════════════ Thành viên ═══════════════════════════ */

function MembersTab({ classId, className, onChanged }) {
  const confirm = useConfirm();
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [removing, setRemoving] = useState(false);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [resultSelected, setResultSelected] = useState({});
  const [searching, setSearching] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const searchTimer = useRef(null);

  const load = useCallback((p = 1, s = search) => {
    setLoading(true);
    classApi.listMembers(classId, { page: p, limit: PAGE_SIZE, search: s })
      .then(({ data }) => { setMembers(data.data || []); setTotal(data.total || 0); })
      .catch(() => toast.error('Tải danh sách thành viên thất bại'))
      .finally(() => setLoading(false));
  }, [classId, search]);

  useEffect(() => { load(1, ''); }, [classId]); // eslint-disable-line

  const goToPage = (p) => { setPage(p); load(p, search); };
  const handleSearch = (v) => { setSearch(v); setPage(1); load(1, v); };

  const toggleRow = (u) => setSelected((prev) => {
    const next = { ...prev };
    if (next[u.id]) delete next[u.id]; else next[u.id] = u;
    return next;
  });

  // Chọn tất cả: chỉ các dòng của trang đang xem
  const allOnPage = members.length > 0 && members.every((m) => selected[m.id]);
  const someOnPage = members.some((m) => selected[m.id]);
  const toggleAll = () => setSelected((prev) => {
    const next = { ...prev };
    if (allOnPage) members.forEach((m) => delete next[m.id]);
    else members.forEach((m) => { next[m.id] = m; });
    return next;
  });

  const handleBulkRemove = async () => {
    const ids = Object.keys(selected);
    if (ids.length === 0) return;
    if (!(await confirm({
      title: `Gỡ ${ids.length} người khỏi lớp?`,
      body: <>{ids.length} người sẽ bị gỡ khỏi lớp <span className="font-medium text-foreground">{className}</span>.</>,
      confirmLabel: `Gỡ ${ids.length} người`,
      icon: UserMinus,
    }))) return;
    setRemoving(true);
    try {
      const { data } = await classApi.removeMembers(classId, ids);
      toast.success(data.message || 'Đã gỡ khỏi lớp');
      setSelected({});
      setPage(1);
      load(1, search);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gỡ thất bại');
    } finally {
      setRemoving(false);
    }
  };

  // Hộp thêm thành viên — chạy lại tìm kiếm mỗi khi đổi từ khoá hoặc bật/tắt lọc.
  const runSearch = useCallback((q, unassigned) => {
    if (!unassigned && !q.trim()) { setResults([]); return; }
    setSearching(true);
    classApi.searchAssignable(classId, { q, ...(unassigned && { unassignedOnly: 1 }) })
      .then(({ data }) => setResults(data.data || []))
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [classId]);

  const handleQueryChange = (v) => {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(v, unassignedOnly), 350);
  };

  const toggleUnassignedOnly = () => {
    const next = !unassignedOnly;
    setUnassignedOnly(next);
    runSearch(query, next);
  };

  const openAddPanel = () => {
    setAdding(true);
    setQuery('');
    setUnassignedOnly(false);
    setResults([]);
    setResultSelected({});
  };

  const toggleResult = (u) => setResultSelected((prev) => {
    const next = { ...prev };
    if (next[u.id]) delete next[u.id]; else next[u.id] = u;
    return next;
  });

  const handleAddSelected = async () => {
    const ids = Object.keys(resultSelected);
    if (ids.length === 0) return toast.error('Chưa chọn ai để thêm');
    setSavingAdd(true);
    try {
      const { data } = await classApi.addMembers(classId, ids);
      toast.success(data.message || 'Đã thêm vào lớp');
      setAdding(false);
      setPage(1);
      load(1, search);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thêm thất bại');
    } finally {
      setSavingAdd(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectedCount = Object.keys(selected).length;
  const resultSelectedCount = Object.keys(resultSelected).length;

  return (
    <>
      {selectedCount > 0 ? (
        <div className="mb-4 flex min-h-10 flex-wrap items-center gap-2">
          <p className="mr-2 text-sm font-medium text-foreground">{selectedCount} đã chọn</p>
          <Button variant="ghost" size="sm" onClick={() => setSelected({})}>Bỏ chọn</Button>
          <div className="ml-auto">
            <Button variant="danger" icon={UserMinus} loading={removing} onClick={handleBulkRemove}>Gỡ khỏi lớp</Button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput className="w-full sm:w-64" placeholder="Tìm trong lớp" value={search} onChange={(e) => handleSearch(e.target.value)} />
          <Button icon={UserPlus} onClick={openAddPanel}>Thêm thành viên</Button>
        </div>
      )}

      <TableCard>
        {loading ? (
          <SkeletonRows rows={6} />
        ) : members.length === 0 ? (
          <EmptyText className="py-10">
            {search ? 'Không tìm thấy thành viên phù hợp' : 'Lớp chưa có thành viên nào — bấm "Thêm thành viên" để bắt đầu'}
          </EmptyText>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <CheckCell as="th" checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={toggleAll} ariaLabel="Chọn tất cả" />
                  <Th>Sinh viên</Th>
                  <Th>MSSV</Th>
                  <Th className="hidden w-full md:table-cell">Email</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isSel = !!selected[m.id];
                  return (
                    <tr key={m.id} className={cx('border-b border-border last:border-0 hover:bg-surface-hover', isSel && 'bg-surface-hover')}>
                      <CheckCell checked={isSel} onChange={() => toggleRow(m)} ariaLabel={`Chọn ${m.name}`} />
                      <td className="whitespace-nowrap px-4 py-3"><p className="font-medium text-foreground">{m.name}</p></td>
                      <td className={cx('whitespace-nowrap px-4 py-3 tabular-nums', m.mssv ? 'text-foreground' : 'text-muted')}>{m.mssv || '—'}</td>
                      <td className="hidden max-w-0 px-4 py-3 md:table-cell"><p className="truncate text-muted">{m.email}</p></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} pages={totalPages} total={total} pageSize={PAGE_SIZE} noun="thành viên" onPageChange={goToPage} />
          </>
        )}
      </TableCard>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={`Thêm thành viên vào lớp ${className}`}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" size="form" onClick={() => setAdding(false)}>Huỷ</Button>
            <Button variant="primary" size="form" loading={savingAdd} disabled={resultSelectedCount === 0} onClick={handleAddSelected}>
              Thêm{resultSelectedCount > 0 ? ` ${resultSelectedCount} người` : ''}
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          <Checkbox
            label="Chỉ hiện người chưa có lớp"
            desc="Đúng nhóm hay bị thiếu thông tin lớp — không cần gõ tên, hiện luôn danh sách"
            checked={unassignedOnly}
            onChange={toggleUnassignedOnly}
          />
          <SearchInput autoFocus placeholder="Tìm theo tên, MSSV, email…" value={query} onChange={(e) => handleQueryChange(e.target.value)} />
          <div className="max-h-80 overflow-y-auto">
            {searching ? (
              <SkeletonRows rows={3} avatar={false} right={false} />
            ) : results.length === 0 ? (
              <EmptyText>
                {unassignedOnly ? 'Không còn ai thiếu thông tin lớp' : query.trim() ? 'Không tìm thấy' : 'Nhập từ khoá hoặc bật lọc ở trên'}
              </EmptyText>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {results.map((u) => {
                  const isSel = !!resultSelected[u.id];
                  return (
                    <li key={u.id}>
                      <label className={cx('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', isSel ? 'bg-secondary' : 'hover:bg-item-hover')}>
                        <Checkbox small checked={isSel} onChange={() => toggleResult(u)} ariaLabel={`Chọn ${u.name}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {u.mssv || u.email}
                            {u.class ? <span className="font-medium text-warning"> · đang ở lớp {u.class}</span> : ' · chưa có lớp'}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ═══════════════════════════ Buổi điểm danh ═══════════════════════════ */

function SessionsTab({ classId, onCount }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    classApi.listSessions(classId)
      .then(({ data }) => { setSessions(data.data || []); onCount?.((data.data || []).length); })
      .catch(() => toast.error('Tải danh sách buổi điểm danh thất bại'))
      .finally(() => setLoading(false));
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return (
    <Card flush>
      {loading ? (
        <SkeletonRows rows={4} />
      ) : sessions.length === 0 ? (
        <EmptyText>Chưa có buổi điểm danh nào cho lớp này</EmptyText>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link to={`/events/${s.id}`} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none hover:bg-item-hover">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted group-hover:bg-surface">
                  <QrCode className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {s.checkinOpen ? format(new Date(s.checkinOpen), 'HH:mm dd/MM/yyyy') : 'Điểm danh thủ công'} · {s.location}
                  </p>
                </div>
                {isGateOpen(s) && <span className="hidden sm:inline-flex"><PhaseBadge phase="live" /></span>}
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {s._count?.attendances ?? 0} / {s._count?.eventMembers ?? 0}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
