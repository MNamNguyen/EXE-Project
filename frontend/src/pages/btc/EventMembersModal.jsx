import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, UserPlus, Trash2, ChevronLeft, ChevronRight, X, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

const PAGE_SIZE = 20;

export default function EventMembersModal({ open, eventId, onClose, onChanged }) {
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add-members sub-panel
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({}); // id -> user
  const [searching, setSearching] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const searchTimer = useRef(null);

  const load = useCallback((p = 1, s = search) => {
    if (!eventId) return;
    setLoading(true);
    eventApi.listMembers(eventId, { page: p, limit: PAGE_SIZE, search: s })
      .then(({ data }) => { setMembers(data.data || []); setTotal(data.total || 0); })
      .catch(() => toast.error('Tải danh sách tham gia thất bại'))
      .finally(() => setLoading(false));
  }, [eventId, search]);

  useEffect(() => {
    if (open) {
      setPage(1);
      setSearch('');
      setAdding(false);
      setSelected({});
      setQuery('');
      setResults([]);
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
      setSelected({});
      setQuery('');
      setResults([]);
      setAdding(false);
      load(page, search);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thêm thất bại');
    } finally {
      setSavingAdd(false);
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

  return (
    <Modal open={open} onClose={onClose} title="Danh sách tham gia sự kiện" size="lg">
      <div className="space-y-4">
        {!adding ? (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-10 text-sm" placeholder="Tìm trong danh sách..."
                  value={search} onChange={(e) => handleSearchMembers(e.target.value)} />
              </div>
              <button onClick={() => setAdding(true)} className="btn-primary btn-md flex-shrink-0">
                <UserPlus size={16} /> Thêm
              </button>
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
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Thêm thành viên</p>
              <button onClick={() => { setAdding(false); setSelected({}); setQuery(''); setResults([]); }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <X size={13} /> Đóng
              </button>
            </div>

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
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border ${isSel ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                        {isSel && <Check size={13} className="text-white" />}
                      </div>
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
              <button type="button" onClick={() => { setAdding(false); setSelected({}); }} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="button" onClick={handleAddSelected} disabled={savingAdd || selectedCount === 0} className="btn-primary btn-md flex-1">
                {savingAdd ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Thêm {selectedCount > 0 ? `(${selectedCount})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
