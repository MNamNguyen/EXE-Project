import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, UserPlus, Trash2, ChevronLeft, ChevronRight, X, Check,
  GraduationCap, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

const PAGE_SIZE = 20;

export default function EventMembersModal({ open, eventId, onClose, onChanged }) {
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
    if (!confirm(`Xoá ${m.user.name} khỏi danh sách tham gia?`)) return;
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

  return (
    <Modal open={open} onClose={onClose} title="Danh sách tham gia sự kiện" size="lg">
      <div className="space-y-4">
        {mode === 'list' && (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-10 text-sm" placeholder="Tìm trong danh sách..."
                  value={search} onChange={(e) => handleSearchMembers(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={openClassPanel} className="btn-secondary btn-md flex-1 sm:flex-none">
                  <GraduationCap size={16} /> Thêm cả lớp
                </button>
                <button onClick={() => setMode('search')} className="btn-primary btn-md flex-1 sm:flex-none">
                  <UserPlus size={16} /> Thêm
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Chưa có thành viên nào trong danh sách tham gia
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="table">
                  <thead>
                    <tr><th>Sinh viên</th><th>MSSV</th><th>Lớp</th><th></th></tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <p className="font-medium text-sm text-gray-900">{m.user.name}</p>
                          <p className="text-xs text-gray-400">{m.user.email}</p>
                        </td>
                        <td className="text-sm text-gray-600">{m.user.mssv || '—'}</td>
                        <td className="text-xs text-gray-500">{m.user.class || '—'}</td>
                        <td>
                          <button onClick={() => handleRemove(m)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xoá khỏi danh sách">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-400">{total} thành viên</p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-border text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs text-gray-500 px-2">{page} / {totalPages}</span>
                  <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-border text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {mode === 'search' && (
          <>
            <PanelHeader title="Thêm thành viên" onClose={backToList} />

            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-10 text-sm" placeholder="Tìm sinh viên theo tên, MSSV, email..."
                value={query} onChange={(e) => runUserSearch(e.target.value)} autoFocus />
            </div>

            <div className="border border-border rounded-xl max-h-64 overflow-y-auto">
              {searching ? (
                <div className="flex justify-center py-8"><Spinner size="md" /></div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {query.trim() ? 'Không tìm thấy (hoặc đã có trong danh sách)' : 'Nhập từ khoá để tìm sinh viên'}
                </div>
              ) : (
                results.map((u) => {
                  const isSel = !!selected[u.id];
                  return (
                    <button key={u.id} type="button" onClick={() => toggleSelect(u)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-border last:border-0 transition-colors ${isSel ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                      <CheckBox checked={isSel} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.mssv || u.email} {u.class ? `· ${u.class}` : ''}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={backToList} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="button" onClick={handleAddSelected} disabled={savingAdd || selectedCount === 0} className="btn-primary btn-md flex-1">
                {savingAdd ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Thêm {selectedCount > 0 ? `(${selectedCount})` : ''}
              </button>
            </div>
          </>
        )}

        {mode === 'class' && (
          <>
            <PanelHeader title="Thêm cả lớp vào sự kiện" onClose={backToList} />

            <p className="text-xs text-gray-500 bg-primary-50 rounded-lg p-3">
              Thêm toàn bộ sinh viên đang hoạt động của lớp. Người đã có trong danh sách được bỏ qua.
            </p>

            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-10 text-sm" placeholder="Lọc theo tên lớp..."
                value={classFilter} onChange={(e) => setClassFilter(e.target.value)} autoFocus />
            </div>

            <div className="border border-border rounded-xl max-h-64 overflow-y-auto">
              {loadingClasses ? (
                <div className="flex justify-center py-8"><Spinner size="md" /></div>
              ) : visibleClasses.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {classes.length === 0
                    ? 'Chưa có sinh viên nào được gán lớp trong hệ thống'
                    : 'Không có lớp nào khớp từ khoá'}
                </div>
              ) : (
                visibleClasses.map((c) => {
                  const isSel = selectedClasses[c.class] !== undefined;
                  const isFull = c.remaining === 0;
                  return (
                    <button
                      key={c.class} type="button"
                      onClick={() => !isFull && toggleClass(c)}
                      disabled={isFull}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-border last:border-0 transition-colors
                        ${isFull ? 'opacity-50 cursor-not-allowed' : isSel ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                    >
                      <CheckBox checked={isSel} disabled={isFull} />
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <GraduationCap size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">{c.class}</span>
                      </div>
                      <span className="text-xs flex-shrink-0 flex items-center gap-1 text-gray-400">
                        <Users size={12} />
                        {isFull
                          ? <span className="text-emerald-600 font-medium">đã có đủ {c.total}</span>
                          : <span><span className="font-semibold text-gray-600">{c.remaining}</span> / {c.total} chưa có</span>}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={backToList} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="button" onClick={handleAddClasses}
                disabled={savingClasses || selectedClassCount === 0} className="btn-primary btn-md flex-[2]">
                {savingClasses ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                {selectedClassCount === 0
                  ? 'Thêm cả lớp'
                  : `Thêm ${willAddCount} sinh viên từ ${selectedClassCount} lớp`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────── */

function PanelHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
        <X size={13} /> Đóng
      </button>
    </div>
  );
}

function CheckBox({ checked, disabled }) {
  return (
    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border
      ${checked ? 'bg-primary-600 border-primary-600' : disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300'}`}>
      {checked && <Check size={13} className="text-white" />}
    </div>
  );
}
