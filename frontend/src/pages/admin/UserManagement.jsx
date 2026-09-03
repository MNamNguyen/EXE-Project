import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Upload, Smartphone, UserX, UserCheck, RefreshCw, AlertCircle,
  Pencil, Trash2, ChevronLeft, ChevronRight, KeyRound, Copy, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Badge, { roleBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ImportStudents from './ImportStudents';
import BulkUserActions, { MAX_BULK } from './BulkUserActions';

const PAGE_SIZES = [20, 50, 100];
const EMPTY_FORM = { name: '', email: '', mssv: '', role: 'STUDENT', class: '', faculty: '', phone: '' };

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Lựa chọn giữ theo id → user (không chỉ id) để thanh thao tác hiển thị được
  // tên, và để lựa chọn SỐNG QUA phân trang: admin có thể gom người từ nhiều trang.
  const [selected, setSelected] = useState(new Map());
  const lastClickedIndex = useRef(null);
  const [selectingAll, setSelectingAll] = useState(false);

  const [createModal, setCreateModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Đặt lại mật khẩu (admin)
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdUser, setPwdUser] = useState(null);
  const [pwdMode, setPwdMode] = useState('auto');
  const [pwdValue, setPwdValue] = useState('');
  const [pwdResult, setPwdResult] = useState(null);
  const [resetting, setResetting] = useState(false);

  const filtersRef = useRef({ search: '', role: '', status: '', pageSize: PAGE_SIZES[0] });
  filtersRef.current = { search, role: roleFilter, status: statusFilter, pageSize };

  const load = useCallback((p = 1, override = {}) => {
    const f = { ...filtersRef.current, ...override };
    setLoadError(false);
    setLoading(true);
    lastClickedIndex.current = null;
    return adminApi.listUsers({ search: f.search, role: f.role, status: f.status, page: p, limit: f.pageSize })
      .then(({ data }) => { setUsers(data.data || []); setTotal(data.total || 0); })
      .catch(() => { setLoadError(true); toast.error('Tải danh sách thất bại'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1); }, []); // eslint-disable-line

  // Gõ tìm kiếm bắn 1 request/ký tự là quá tốn với Render free tier → chờ 350ms.
  const searchTimer = useRef(null);
  const onSearchChange = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(1, { search: value }); }, 350);
  };
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const applyFilter = (patch) => {
    if ('role' in patch) setRoleFilter(patch.role);
    if ('status' in patch) setStatusFilter(patch.status);
    if ('pageSize' in patch) setPageSize(patch.pageSize);
    setPage(1);
    load(1, patch);
  };

  const goToPage = (p) => {
    setPage(p);
    load(p);
  };

  // ── Lựa chọn ──────────────────────────────────────────────────

  const isSelected = (id) => selected.has(id);
  const pageAllSelected = users.length > 0 && users.every((u) => selected.has(u.id));
  const pageSomeSelected = users.some((u) => selected.has(u.id));

  const setMany = (list, on) => {
    setSelected((prev) => {
      const next = new Map(prev);
      list.forEach((u) => (on ? next.set(u.id, u) : next.delete(u.id)));
      return next;
    });
  };

  // Shift-click chọn cả dải giữa hai lần click — thao tác quen tay khi cần
  // chọn vài chục dòng liên tiếp.
  const toggleRow = (index, event) => {
    const target = users[index];
    const on = !selected.has(target.id);

    if (event.shiftKey && lastClickedIndex.current !== null) {
      const [from, to] = [lastClickedIndex.current, index].sort((a, b) => a - b);
      setMany(users.slice(from, to + 1), on);
    } else {
      setMany([target], on);
    }
    lastClickedIndex.current = index;
  };

  const togglePage = () => {
    setMany(users, !pageAllSelected);
    lastClickedIndex.current = null;
  };

  const clearSelection = () => { setSelected(new Map()); lastClickedIndex.current = null; };

  // Chọn toàn bộ kết quả khớp bộ lọc, không chỉ trang hiện tại. Backend chặn
  // limit ở MAX_BULK nên đây cũng là trần của một lô thao tác.
  const selectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const { data } = await adminApi.listUsers({
        search, role: roleFilter, status: statusFilter, page: 1, limit: MAX_BULK,
      });
      const list = data.data || [];
      setSelected(new Map(list.map((u) => [u.id, u])));
      toast.success(
        list.length < total
          ? `Đã chọn ${list.length} tài khoản đầu tiên (tối đa ${MAX_BULK} mỗi lô)`
          : `Đã chọn tất cả ${list.length} tài khoản`
      );
    } catch {
      toast.error('Không chọn được toàn bộ kết quả');
    } finally {
      setSelectingAll(false);
    }
  };

  // ── Thao tác từng người ───────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Nhập đầy đủ tên và email');
    setCreating(true);
    try {
      await adminApi.createUser(form);
      toast.success('Tạo tài khoản thành công. Email đã gửi.');
      setCreateModal(false);
      setForm(EMPTY_FORM);
      setPage(1);
      load(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tạo thất bại');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      mssv: u.mssv || '',
      role: u.role || 'STUDENT',
      class: u.class || '',
      faculty: u.faculty || '',
      phone: u.phone || '',
    });
    setEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) return toast.error('Nhập đầy đủ tên và email');
    setSaving(true);
    try {
      await adminApi.updateUser(editUser.id, editForm);
      toast.success('Cập nhật thành công');
      setEditModal(false);
      setEditUser(null);
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Xoá vĩnh viễn tài khoản "${u.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await adminApi.deleteUser(u.id);
      toast.success('Đã xoá người dùng');
      setMany([u], false);
      // Nếu xoá bản ghi cuối của trang, lùi 1 trang
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      load(nextPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
    }
  };

  const openResetPassword = (u) => {
    setPwdUser(u);
    setPwdMode('auto');
    setPwdValue('');
    setPwdResult(null);
    setPwdModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (pwdMode === 'manual' && pwdValue.length < 6) {
      return toast.error('Mật khẩu mới phải ít nhất 6 ký tự');
    }
    setResetting(true);
    try {
      const { data } = await adminApi.resetPassword(
        pwdUser.id,
        pwdMode === 'manual' ? { newPassword: pwdValue } : {}
      );
      setPwdResult(data);
      toast[data.emailSent ? 'success' : 'error'](data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đặt lại mật khẩu thất bại');
    } finally {
      setResetting(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(pwdResult.password);
      toast.success('Đã sao chép mật khẩu');
    } catch {
      toast.error('Trình duyệt không cho phép sao chép. Hãy chọn và copy thủ công.');
    }
  };

  const handleResetDevice = async (id, name) => {
    if (!confirm(`Reset thiết bị cho ${name}?`)) return;
    try {
      await adminApi.resetDevice(id);
      toast.success('Đã reset thiết bị');
    } catch {
      toast.error('Reset thất bại');
    }
  };

  const handleToggleActive = async (id, isActive, name) => {
    if (!confirm(`${isActive ? 'Khoá' : 'Mở khoá'} tài khoản ${name}?`)) return;
    try {
      await adminApi.updateUser(id, { isActive: !isActive });
      toast.success(`Đã ${isActive ? 'khoá' : 'mở khoá'} tài khoản`);
      load(page);
    } catch {
      toast.error('Thao tác thất bại');
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);
  const hasFilters = Boolean(search || roleFilter || statusFilter);

  const userFormFields = (state, setState) => (
    <>
      {[
        { key: 'name', label: 'Họ và tên', required: true, placeholder: 'Nguyễn Văn An' },
        { key: 'email', label: 'Email', required: true, type: 'email', placeholder: 'sv@fpt.edu.vn' },
        { key: 'mssv', label: 'MSSV (không bắt buộc với BTC/GV)', placeholder: 'SE123456' },
        { key: 'class', label: 'Lớp', placeholder: 'SE1701' },
        { key: 'faculty', label: 'Khoa', placeholder: 'Software Engineering' },
        { key: 'phone', label: 'Số điện thoại', placeholder: '09xxxxxxxx' },
      ].map(({ key, label, required, type = 'text', placeholder }) => (
        <div key={key}>
          <label className="label">{label} {required && <span className="text-red-500">*</span>}</label>
          <input className="input" type={type} placeholder={placeholder}
            value={state[key]} onChange={(e) => setState({ ...state, [key]: e.target.value })} />
        </div>
      ))}
      <div>
        <label className="label">Vai trò</label>
        <select className="input" value={state.role} onChange={(e) => setState({ ...state, role: e.target.value })}>
          <option value="STUDENT">Sinh viên</option>
          <option value="BTC">Ban tổ chức</option>
          <option value="LECTURER">Giảng viên</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
    </>
  );

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Quản lý người dùng</h1>
            <p className="text-white/60 text-sm mt-1">{total} tài khoản</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setImportModal(true)}
              className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2.5 rounded-xl text-sm hover:bg-white/30 transition-colors">
              <Upload size={16} /> Import Excel
            </button>
            <button onClick={() => { setForm(EMPTY_FORM); setCreateModal(true); }}
              className="flex items-center gap-2 bg-white text-primary-700 font-semibold px-4 py-2.5 rounded-xl text-sm shadow hover:shadow-md transition-all">
              <Plus size={16} /> Tạo tài khoản
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-10 pr-9 text-sm" placeholder="Tìm theo tên, MSSV, email..."
              value={search} onChange={(e) => onSearchChange(e.target.value)} />
            {search && (
              <button onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500" title="Xoá tìm kiếm">
                <X size={15} />
              </button>
            )}
          </div>
          <select className="input text-sm w-36" value={roleFilter} onChange={(e) => applyFilter({ role: e.target.value })}>
            <option value="">Tất cả vai trò</option>
            <option value="STUDENT">Sinh viên</option>
            <option value="BTC">Ban TC</option>
            <option value="LECTURER">Giảng viên</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select className="input text-sm w-36" value={statusFilter} onChange={(e) => applyFilter({ status: e.target.value })}>
            <option value="">Mọi trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khoá</option>
          </select>
          <select className="input text-sm w-28" value={pageSize} onChange={(e) => applyFilter({ pageSize: Number(e.target.value) })}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / trang</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className="card flex flex-col items-center gap-3 py-16 text-gray-400">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium text-gray-500">Không thể tải danh sách người dùng</p>
            <p className="text-xs text-gray-400">Server có thể đang khởi động lại. Vui lòng thử lại.</p>
            <button onClick={() => load(page)} className="flex items-center gap-2 btn-primary btn-sm mt-1">
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Chọn cả trang rồi thì mời chọn luôn toàn bộ kết quả khớp bộ lọc */}
            {pageAllSelected && total > users.length && (
              <div className="px-4 py-2.5 bg-primary-50 border-b border-primary-100 text-xs text-primary-800 flex items-center justify-center gap-2 flex-wrap">
                <span>Đã chọn {selected.size} tài khoản.</span>
                {selected.size < total && (
                  <button onClick={selectAllMatching} disabled={selectingAll}
                    className="font-semibold underline underline-offset-2 hover:text-primary-900 disabled:opacity-50">
                    {selectingAll ? 'Đang chọn…' : `Chọn tất cả ${total} kết quả${hasFilters ? ' khớp bộ lọc' : ''}`}
                  </button>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input type="checkbox" className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                        checked={pageAllSelected}
                        ref={(el) => { if (el) el.indeterminate = !pageAllSelected && pageSomeSelected; }}
                        onChange={togglePage}
                        title="Chọn tất cả trên trang này" />
                    </th>
                    <th>Người dùng</th>
                    <th>MSSV</th>
                    <th>Lớp</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
                  ) : users.map((u, index) => {
                    const { label: roleLabel, variant: roleVariant } = roleBadge(u.role);
                    const checked = isSelected(u.id);
                    return (
                      <tr key={u.id} className={checked ? 'bg-primary-50/60' : undefined}>
                        <td>
                          <input type="checkbox" className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                            checked={checked}
                            onChange={() => {}}
                            onClick={(e) => toggleRow(index, e)}
                            title="Giữ Shift để chọn cả dải" />
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900">
                                {u.name}
                                {u.id === currentUser?.id && (
                                  <span className="ml-1.5 text-xs font-normal text-gray-400">(bạn)</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm text-gray-600">{u.mssv || '—'}</td>
                        <td className="text-xs text-gray-500">{u.class || '—'}</td>
                        <td><Badge variant={roleVariant}>{roleLabel}</Badge></td>
                        <td>
                          <Badge variant={u.isActive ? 'green' : 'red'}>
                            {u.isActive ? 'Hoạt động' : 'Bị khoá'}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Sửa thông tin">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => openResetPassword(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Đặt lại mật khẩu">
                              <KeyRound size={15} />
                            </button>
                            <button onClick={() => handleResetDevice(u.id, u.name)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Reset thiết bị">
                              <Smartphone size={15} />
                            </button>
                            <button onClick={() => handleToggleActive(u.id, u.isActive, u.name)}
                              className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                              title={u.isActive ? 'Khoá tài khoản' : 'Mở khoá'}>
                              {u.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                            </button>
                            <button onClick={() => handleDelete(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xoá vĩnh viễn">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-400">
                {total === 0 ? 'Không có bản ghi' : `Hiển thị ${startRow}–${endRow} / ${total} tài khoản`}
                {selected.size > 0 && ` · đang chọn ${selected.size}`}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
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
            </div>
          </div>
        )}

        <BulkUserActions
          selected={[...selected.values()]}
          currentUserId={currentUser?.id}
          onClear={clearSelection}
          onDone={() => load(page)}
        />
      </div>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Tạo tài khoản mới" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          {userFormFields(form, setForm)}
          <p className="text-xs text-gray-400 bg-surface rounded-lg p-3">
            Hệ thống sẽ gửi email chào mừng kèm mật khẩu tạm thời đến địa chỉ email trên.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary btn-md flex-1">Huỷ</button>
            <button type="submit" disabled={creating} className="btn-primary btn-md flex-1">
              {creating ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              Tạo tài khoản
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Sửa thông tin người dùng" size="sm">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {userFormFields(editForm, setEditForm)}
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditModal(false)} className="btn-secondary btn-md flex-1">Huỷ</button>
            <button type="submit" disabled={saving} className="btn-primary btn-md flex-1">
              {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset password modal */}
      <Modal open={pwdModal} onClose={() => setPwdModal(false)} title="Đặt lại mật khẩu" size="sm">
        {pwdResult ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Mật khẩu mới của <strong>{pwdUser?.name}</strong> đã được đặt lại. Người dùng sẽ buộc phải
              đổi mật khẩu ngay sau lần đăng nhập kế tiếp.
            </p>
            <div className="bg-surface rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Mật khẩu mới</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-base text-primary-700 break-all select-all">{pwdResult.password}</code>
                <button type="button" onClick={copyPassword}
                  className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Sao chép">
                  <Copy size={15} />
                </button>
              </div>
            </div>
            <p className={`text-xs rounded-lg p-3 ${pwdResult.emailSent ? 'text-gray-400 bg-surface' : 'text-red-600 bg-red-50'}`}>
              {pwdResult.emailSent
                ? `Email kèm mật khẩu mới đã được gửi đến ${pwdUser?.email}.`
                : 'Không gửi được email. Hãy sao chép mật khẩu và bàn giao cho người dùng theo cách khác.'}
            </p>
            <button type="button" onClick={() => setPwdModal(false)} className="btn-primary btn-md w-full">Đóng</button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="bg-surface rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">{pwdUser?.name}</p>
              <p className="text-xs text-gray-400">{pwdUser?.email}</p>
            </div>

            <div className="space-y-2">
              {[
                { value: 'auto', label: 'Sinh mật khẩu tạm ngẫu nhiên', hint: 'Hệ thống tự tạo và gửi email cho người dùng' },
                { value: 'manual', label: 'Tự nhập mật khẩu', hint: 'Tối thiểu 6 ký tự' },
              ].map((opt) => (
                <label key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${pwdMode === opt.value ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-gray-50'}`}>
                  <input type="radio" name="pwdMode" className="mt-1" value={opt.value}
                    checked={pwdMode === opt.value} onChange={() => setPwdMode(opt.value)} />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                    <span className="block text-xs text-gray-400">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {pwdMode === 'manual' && (
              <div>
                <label className="label">Mật khẩu mới <span className="text-red-500">*</span></label>
                <input className="input" type="text" autoComplete="new-password" placeholder="Ít nhất 6 ký tự"
                  value={pwdValue} onChange={(e) => setPwdValue(e.target.value)} />
              </div>
            )}

            <p className="text-xs text-gray-400 bg-surface rounded-lg p-3">
              Người dùng sẽ nhận email kèm mật khẩu mới và buộc phải đổi mật khẩu ở lần đăng nhập kế tiếp.
              Tài khoản đang bị tạm khoá do đăng nhập sai nhiều lần cũng được mở khoá.
            </p>

            <div className="flex gap-3">
              <button type="button" onClick={() => setPwdModal(false)} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="submit" disabled={resetting} className="btn-primary btn-md flex-1">
                {resetting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Đặt lại mật khẩu
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Import modal */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Import sinh viên từ Excel" size="sm">
        <ImportStudents onSuccess={() => { setImportModal(false); setPage(1); load(1); }} />
      </Modal>
    </Layout>
  );
}
