import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, UserPlus, UserMinus, Check, X, ChevronLeft, ChevronRight,
  CalendarPlus, QrCode, Users, Clock, MapPin, AlertCircle, GraduationCap,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { classApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import SessionCreateModal from './SessionCreateModal';

const PAGE_SIZE = 20;

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cls, setCls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('members'); // 'members' | 'sessions'

  const loadClass = useCallback(() => {
    classApi.get(id)
      .then(({ data }) => setCls(data.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadClass(); }, [loadClass]);

  if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size="xl" /></div></Layout>;

  if (notFound || !cls) {
    return (
      <Layout>
        <div className="p-8 max-w-lg mx-auto text-center">
          <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Không tìm thấy lớp</p>
          <Link to="/classes" className="btn-secondary btn-sm mt-4 inline-flex">
            <ArrowLeft size={14} /> Quay lại danh sách lớp
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => navigate('/classes')} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{cls.name}</h1>
              {cls.description && <p className="text-white/70 text-sm mt-0.5">{cls.description}</p>}
            </div>
          </div>
          <p className="text-white/70 text-sm mt-3 flex items-center gap-1.5">
            <Users size={13} /> {cls.memberCount} thành viên
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div className="inline-flex rounded-xl bg-surface border border-border p-1 gap-1">
          <TabButton active={tab === 'members'} onClick={() => setTab('members')} icon={Users}>Thành viên</TabButton>
          <TabButton active={tab === 'sessions'} onClick={() => setTab('sessions')} icon={QrCode}>Buổi điểm danh</TabButton>
        </div>

        {tab === 'members'
          ? <MembersTab classId={id} className={cls.name} onChanged={loadClass} />
          : <SessionsTab classId={id} className={cls.name} />}
      </div>
    </Layout>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} className={`
      flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
      ${active ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}
    `}>
      <Icon size={15} /> {children}
    </button>
  );
}

/* ═══════════════════════════ Thành viên ═══════════════════════════ */

function MembersTab({ classId, className, onChanged }) {
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

  const handleBulkRemove = async () => {
    const ids = Object.keys(selected);
    if (ids.length === 0) return;
    if (!confirm(`Gỡ ${ids.length} người khỏi lớp ${className}?`)) return;
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

  // Panel thêm thành viên — chạy lại tìm kiếm mỗi khi đổi từ khoá hoặc bật/tắt lọc.
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

  if (adding) {
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Thêm thành viên vào lớp {className}</p>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <X size={13} /> Đóng
          </button>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer bg-primary-50 rounded-xl p-3">
          <input type="checkbox" className="w-4 h-4 rounded accent-primary-600"
            checked={unassignedOnly} onChange={toggleUnassignedOnly} />
          <div>
            <p className="text-sm font-medium text-gray-700">Chỉ hiện người chưa có lớp</p>
            <p className="text-xs text-gray-400">Đúng nhóm hay bị thiếu thông tin lớp — không cần gõ tên, hiện luôn danh sách</p>
          </div>
        </label>

        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10 text-sm" placeholder="Tìm theo tên, MSSV, email..."
            value={query} onChange={(e) => handleQueryChange(e.target.value)} autoFocus />
        </div>

        <div className="border border-border rounded-xl max-h-80 overflow-y-auto">
          {searching ? (
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {unassignedOnly ? 'Không còn ai thiếu thông tin lớp' : query.trim() ? 'Không tìm thấy' : 'Nhập từ khoá hoặc bật lọc ở trên'}
            </div>
          ) : (
            results.map((u) => {
              const isSel = !!resultSelected[u.id];
              return (
                <button key={u.id} type="button" onClick={() => toggleResult(u)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-border last:border-0 transition-colors ${isSel ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                  <CheckBox checked={isSel} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {u.mssv || u.email} {u.class ? <span className="text-amber-600">· đang ở lớp {u.class}</span> : <span className="text-gray-300">· chưa có lớp</span>}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => setAdding(false)} className="btn-secondary btn-md flex-1">Huỷ</button>
          <button type="button" onClick={handleAddSelected} disabled={savingAdd || resultSelectedCount === 0} className="btn-primary btn-md flex-1">
            {savingAdd ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
            Thêm {resultSelectedCount > 0 ? `(${resultSelectedCount})` : ''}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10 text-sm" placeholder="Tìm trong lớp..."
            value={search} onChange={(e) => handleSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {selectedCount > 0 && (
            <button onClick={handleBulkRemove} disabled={removing} className="btn-danger btn-md flex-1 sm:flex-none">
              {removing ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <UserMinus size={16} />}
              Gỡ ({selectedCount})
            </button>
          )}
          <button onClick={openAddPanel} className="btn-primary btn-md flex-1 sm:flex-none">
            <UserPlus size={16} /> Thêm thành viên
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : members.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 text-sm">
          {search ? 'Không tìm thấy thành viên phù hợp' : 'Lớp chưa có thành viên nào — bấm "Thêm thành viên" để bắt đầu'}
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Sinh viên</th>
                <th>MSSV</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSel = !!selected[m.id];
                return (
                  <tr key={m.id} onClick={() => toggleRow(m)} className="cursor-pointer">
                    <td><CheckBox checked={isSel} /></td>
                    <td className="font-medium text-gray-900">{m.name}</td>
                    <td className="text-gray-600">{m.mssv || '—'}</td>
                    <td className="text-gray-400">{m.email}</td>
                  </tr>
                );
              })}
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
    </div>
  );
}

function CheckBox({ checked }) {
  return (
    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border ${checked ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
      {checked && <Check size={13} className="text-white" />}
    </div>
  );
}

/* ═══════════════════════════ Buổi điểm danh ═══════════════════════════ */

function SessionsTab({ classId, className }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    classApi.listSessions(classId)
      .then(({ data }) => setSessions(data.data || []))
      .catch(() => toast.error('Tải danh sách buổi điểm danh thất bại'))
      .finally(() => setLoading(false));
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (event) => {
    setCreateModal(false);
    toast.success('Đã tạo buổi điểm danh, đang mở màn hình QR...');
    navigate(`/events/${event.id}/qr`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreateModal(true)} className="btn-primary btn-md">
          <CalendarPlus size={16} /> Tạo buổi điểm danh mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : sessions.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 text-sm">
          Chưa có buổi điểm danh nào cho lớp này
        </div>
      ) : (
        <div className="space-y-2.5">
          {sessions.map((s) => (
            <Link key={s.id} to={`/events/${s.id}`}
              className="card p-4 flex items-center gap-4 hover:shadow-card-hover transition-all group">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <QrCode size={18} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm truncate">{s.name}</p>
                  {s.gate?.checkin?.open && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                      Đang mở
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} /> {s.location}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={11} /> {s.checkinOpen ? format(new Date(s.checkinOpen), 'HH:mm dd/MM/yyyy') : 'Điểm danh thủ công'}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Users size={11} /> {s._count?.attendances ?? 0} / {s._count?.eventMembers ?? 0} đã điểm danh
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <SessionCreateModal
        open={createModal}
        classId={classId}
        className={className}
        onClose={() => setCreateModal(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
