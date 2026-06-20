import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Upload, Smartphone, UserX, UserCheck, RefreshCw, AlertCircle,
  Pencil, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Badge, { roleBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ImportStudents from './ImportStudents';

const PAGE_SIZE = 20;
const EMPTY_FORM = { name: '', email: '', mssv: '', role: 'STUDENT', class: '', faculty: '', phone: '' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [createModal, setCreateModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback((p = 1, s = search, r = roleFilter) => {
    setLoadError(false);
    setLoading(true);
    adminApi.listUsers({ search: s, role: r, page: p, limit: PAGE_SIZE })
      .then(({ data }) => { setUsers(data.data || []); setTotal(data.total || 0); })
      .catch(() => { setLoadError(true); toast.error('Tải danh sách thất bại'); })
      .finally(() => setLoading(false));
  }, [search, roleFilter]);

  useEffect(() => { load(1); }, []); // eslint-disable-line

  const applyFilters = (s, r) => {
    setPage(1);
    load(1, s, r);
  };

  const goToPage = (p) => {
    setPage(p);
    load(p, search, roleFilter);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Nhập đầy đủ tên và email');
    setCreating(true);
    try {
      await adminApi.createUser(form);
      toast.success('Tạo tài khoản thành công. Email đã gửi.');
      setCreateModal(false);
      setForm(EMPTY_FORM);
      load(1, search, roleFilter);
      setPage(1);
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
      load(page, search, roleFilter);
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
      // Nếu xoá bản ghi cuối của trang, lùi 1 trang
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      load(nextPage, search, roleFilter);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
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
      load(page, search, roleFilter);
    } catch {
      toast.error('Thao tác thất bại');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, total);

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
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
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

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-10 text-sm" placeholder="Tìm theo tên, MSSV, email..."
              value={search} onChange={(e) => { setSearch(e.target.value); applyFilters(e.target.value, roleFilter); }} />
          </div>
          <select className="input text-sm w-36" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); applyFilters(search, e.target.value); }}>
            <option value="">Tất cả vai trò</option>
            <option value="STUDENT">Sinh viên</option>
            <option value="BTC">Ban TC</option>
            <option value="LECTURER">Giảng viên</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className="card flex flex-col items-center gap-3 py-16 text-gray-400">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium text-gray-500">Không thể tải danh sách người dùng</p>
            <p className="text-xs text-gray-400">Server có thể đang khởi động lại. Vui lòng thử lại.</p>
            <button
              onClick={() => load(page, search, roleFilter)}
              className="flex items-center gap-2 btn-primary btn-sm mt-1"
            >
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
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
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
                  ) : users.map((u) => {
                    const { label: roleLabel, variant: roleVariant } = roleBadge(u.role);
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900">{u.name}</p>
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

      {/* Import modal */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Import sinh viên từ Excel" size="sm">
        <ImportStudents onSuccess={() => { setImportModal(false); load(1, search, roleFilter); setPage(1); }} />
      </Modal>
    </Layout>
  );
}
