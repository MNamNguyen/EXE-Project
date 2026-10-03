import { useState, useEffect, useCallback, useRef } from 'react';
import { GraduationCap, Trash2, UserMinus, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Modal, { useConfirm } from '../../components/ui/Modal';
import Button, { IconButton } from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Choice';
import { Banner, EmptyText, SkeletonRows } from '../../components/ui/States';
import { cx } from '../../utils/cx';

const PAGE_SIZE = 20;

export default function EventMembersModal({ open, eventId, onClose, onChanged }) {
  const confirm = useConfirm();
  // 'list' = danh sách hiện có · 'search' = thêm từng người · 'class' = thêm cả lớp
  const [mode, setMode] = useState('list');

  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Thêm từng người
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({}); // id -> user
  const [searching, setSearching] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const searchTimer = useRef(null);

  // Thêm cả lớp
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [selectedClasses, setSelectedClasses] = useState({}); // class -> remaining
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [savingClasses, setSavingClasses] = useState(false);

  const load = useCallback((p = 1, s = search) => {
    if (!eventId) return;
    setLoading(true);
    eventApi.listMembers(eventId, { page: p, limit: PAGE_SIZE, search: s })
      .then(({ data }) => { setMembers(data.data || []); setTotal(data.total || 0); })
      .catch(() => toast.error('Tải danh sách tham gia thất bại'))
      .finally(() => setLoading(false));
  }, [eventId, search]);

  const resetPanels = () => {
    setSelected({});
    setQuery('');
    setResults([]);
    setSelectedClasses({});
    setClassFilter('');
  };

  useEffect(() => {
    if (open) {
      setPage(1);
      setSearch('');
      setMode('list');
      resetPanels();
      load(1, '');
    }
  }, [open]); // eslint-disable-line

  const goToPage = (p) => { setPage(p); load(p, search); };

  const handleSearchMembers = (v) => {
    setSearch(v);
    setPage(1);
    load(1, v);
  };

  // Debounced user search for adding
  const runUserSearch = (v) => {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!v.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(() => {
      setSearching(true);
      eventApi.searchMembers(eventId, v)
        .then(({ data }) => setResults(data.data || []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 350);
  };

  const toggleSelect = (u) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = u;
      return next;
    });
  };

  const handleAddSelected = async () => {
    const ids = Object.keys(selected);
    if (ids.length === 0) return toast.error('Chưa chọn ai để thêm');
    setSavingAdd(true);
    try {
      const { data } = await eventApi.addMembers(eventId, ids);
      toast.success(data.message || 'Đã thêm thành viên');
      resetPanels();
      setMode('list');
      load(page, search);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thêm thất bại');
    } finally {
      setSavingAdd(false);
    }
  };

  // ── Thêm cả lớp ──────────────────────────────────────────────

  const openClassPanel = () => {
    setMode('class');
    setLoadingClasses(true);
    eventApi.listClasses(eventId)
      .then(({ data }) => setClasses(data.data || []))
      .catch(() => toast.error('Tải danh sách lớp thất bại'))
      .finally(() => setLoadingClasses(false));
  };

  const toggleClass = (c) => {
    setSelectedClasses((prev) => {
      const next = { ...prev };
      if (next[c.class] !== undefined) delete next[c.class];
      else next[c.class] = c.remaining;
      return next;
    });
  };

  const handleAddClasses = async () => {
    const names = Object.keys(selectedClasses);
    if (names.length === 0) return toast.error('Chưa chọn lớp nào');
    setSavingClasses(true);
    try {
      const { data } = await eventApi.addMembersByClass(eventId, names);
      toast.success(data.message || 'Đã thêm lớp vào danh sách');
      resetPanels();
      setMode('list');
      setPage(1);
      load(1, search);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thêm lớp thất bại');
    } finally {
      setSavingClasses(false);
    }
  };

  const handleRemove = async (m) => {
    if (!(await confirm({
      title: 'Xoá khỏi danh sách tham gia?',
      body: <><span className="font-medium text-foreground">{m.user.name}</span> sẽ bị xoá khỏi danh sách tham gia sự kiện.</>,
      confirmLabel: 'Xoá khỏi danh sách',
      icon: UserMinus,
    }))) return;
    try {
      await eventApi.removeMember(eventId, m.user.id);
      toast.success('Đã xoá khỏi danh sách');
      const nextPage = members.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      load(nextPage, search);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectedCount = Object.keys(selected).length;

  const visibleClasses = classFilter.trim()
    ? classes.filter((c) => c.class.toLowerCase().includes(classFilter.trim().toLowerCase()))
    : classes;
  const selectedClassCount = Object.keys(selectedClasses).length;
  // Ước tính số suất sẽ thêm — chỉ đếm người của lớp chưa có trong danh sách.
  const willAddCount = Object.values(selectedClasses).reduce((a, b) => a + b, 0);

  const backToList = () => { setMode('list'); resetPanels(); };

  let footer = null;
  if (mode === 'search') {
    footer = (
      <>
        <Button variant="secondary" size="form" onClick={backToList}>Huỷ</Button>
        <Button variant="primary" size="form" loading={savingAdd} disabled={selectedCount === 0} onClick={handleAddSelected}>
          Thêm{selectedCount > 0 ? ` ${selectedCount} người` : ''}
        </Button>
      </>
    );
  } else if (mode === 'class') {
    footer = (
      <>
        <Button variant="secondary" size="form" onClick={backToList}>Huỷ</Button>
        <Button variant="primary" size="form" loading={savingClasses} disabled={selectedClassCount === 0} onClick={handleAddClasses}>
          {selectedClassCount === 0 ? 'Thêm cả lớp' : `Thêm ${willAddCount} sinh viên từ ${selectedClassCount} lớp`}
        </Button>
      </>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Danh sách tham gia sự kiện" size="lg" footer={footer}>
      {mode === 'list' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              className="flex-1"
              placeholder="Tìm trong danh sách…"
              value={search}
              onChange={(e) => handleSearchMembers(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button icon={GraduationCap} onClick={openClassPanel}>Thêm cả lớp</Button>
              <Button variant="primary" icon={UserPlus} onClick={() => setMode('search')}>Thêm</Button>
            </div>
          </div>

          {loading ? (
            <SkeletonRows rows={5} />
          ) : members.length === 0 ? (
            <EmptyText className="py-10">Chưa có thành viên nào trong danh sách tham gia</EmptyText>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.user.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[m.user.mssv, m.user.class, m.user.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <IconButton icon={Trash2} label="Xoá khỏi danh sách" danger onClick={() => handleRemove(m)} />
                </li>
              ))}
            </ul>
          )}

          {total > 0 && (
            <Pagination bare compact page={page} pages={totalPages} total={total} pageSize={PAGE_SIZE} noun="thành viên" onPageChange={goToPage} />
          )}
        </div>
      )}

      {mode === 'search' && (
        <div className="flex flex-col gap-4">
          <PanelHeader title="Thêm thành viên" onClose={backToList} />
          <SearchInput
            autoFocus
            placeholder="Tìm sinh viên theo tên, MSSV, email…"
            value={query}
            onChange={(e) => runUserSearch(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto">
            {searching ? (
              <SkeletonRows rows={3} avatar={false} right={false} />
            ) : results.length === 0 ? (
              <EmptyText>{query.trim() ? 'Không tìm thấy (hoặc đã có trong danh sách)' : 'Nhập từ khoá để tìm sinh viên'}</EmptyText>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {results.map((u) => {
                  const isSel = !!selected[u.id];
                  return (
                    <li key={u.id}>
                      <label className={cx('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', isSel ? 'bg-secondary' : 'hover:bg-item-hover')}>
                        <Checkbox small checked={isSel} onChange={() => toggleSelect(u)} ariaLabel={`Chọn ${u.name}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                          <span className="block truncate text-xs text-muted">{u.mssv || u.email}{u.class ? ` · ${u.class}` : ''}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {mode === 'class' && (
        <div className="flex flex-col gap-4">
          <PanelHeader title="Thêm cả lớp vào sự kiện" onClose={backToList} />
          <Banner tone="info" compact>
            Thêm toàn bộ sinh viên đang hoạt động của lớp. Người đã có trong danh sách được bỏ qua.
          </Banner>
          <SearchInput
            autoFocus
            placeholder="Lọc theo tên lớp…"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto">
            {loadingClasses ? (
              <SkeletonRows rows={3} avatar={false} />
            ) : visibleClasses.length === 0 ? (
              <EmptyText>
                {classes.length === 0 ? 'Chưa có sinh viên nào được gán lớp trong hệ thống' : 'Không có lớp nào khớp từ khoá'}
              </EmptyText>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {visibleClasses.map((c) => {
                  const isSel = selectedClasses[c.class] !== undefined;
                  const isFull = c.remaining === 0;
                  return (
                    <li key={c.class}>
                      <label
                        className={cx(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5',
                          isFull ? 'cursor-not-allowed opacity-50' : isSel ? 'cursor-pointer bg-secondary' : 'cursor-pointer hover:bg-item-hover',
                        )}
                      >
                        <Checkbox small checked={isSel} disabled={isFull} onChange={() => !isFull && toggleClass(c)} ariaLabel={`Chọn lớp ${c.class}`} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{c.class}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          {isFull
                            ? <span className="font-medium text-success">đã có đủ {c.total}</span>
                            : <><span className="font-medium text-foreground">{c.remaining}</span> / {c.total} chưa có</>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────────────────────── */

function PanelHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <Button variant="ghost" size="sm" icon={X} onClick={onClose}>Đóng</Button>
    </div>
  );
}
