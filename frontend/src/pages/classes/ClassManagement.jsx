import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, AlertCircle, GraduationCap,
  Users, Pencil, Trash2, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { classApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [modal, setModal] = useState(null); // null | 'create' | class-object (edit)
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback((s = search) => {
    setLoadError(false);
    setLoading(true);
    classApi.list(s ? { search: s } : undefined)
      .then(({ data }) => setClasses(data.data || []))
      .catch(() => { setLoadError(true); toast.error('Tải danh sách lớp thất bại'); })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(''); }, []); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(() => load(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  const openCreate = () => { setForm({ name: '', description: '' }); setModal('create'); };
  const openEdit = (cls) => { setForm({ name: cls.name, description: cls.description || '' }); setModal(cls); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Vui lòng nhập tên lớp');
    setSaving(true);
    try {
      if (modal === 'create') {
        await classApi.create(form);
        toast.success('Đã tạo lớp mới');
      } else {
        await classApi.update(modal.id, form);
        toast.success('Đã cập nhật lớp');
      }
      setModal(null);
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cls) => {
    if (!confirm(`Xoá lớp "${cls.name}"?`)) return;
    try {
      await classApi.remove(cls.id);
      toast.success('Đã xoá lớp');
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
    }
  };

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Quản lý lớp học</h1>
            <p className="text-white/70 text-sm mt-1">Tạo lớp, gom sinh viên và tạo nhanh buổi điểm danh theo lớp</p>
          </div>
          <button onClick={openCreate} className="btn-primary btn-md bg-white text-primary-700 hover:bg-blue-50">
            <Plus size={16} /> Tạo lớp mới
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10 text-sm" placeholder="Tìm lớp theo tên..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className="card flex flex-col items-center gap-3 py-16">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium text-gray-500">Không tải được danh sách lớp</p>
            <button onClick={() => load(search)} className="btn-primary btn-sm mt-1">
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : classes.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <GraduationCap size={28} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600 text-sm">
              {search ? 'Không tìm thấy lớp phù hợp' : 'Chưa có lớp nào'}
            </p>
            <p className="text-gray-400 text-xs mt-1 mb-4">
              Tạo lớp để nhóm sinh viên lại, thêm nhanh cả lớp vào sự kiện hoặc tạo buổi điểm danh.
            </p>
            {!search && (
              <button onClick={openCreate} className="btn-primary btn-sm inline-flex">
                <Plus size={14} /> Tạo lớp đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {classes.map((cls) => (
              <div key={cls.id} className="card p-4 flex items-start gap-3 hover:shadow-card-hover transition-all group">
                <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={20} className="text-primary-600" />
                </div>
                <Link to={`/classes/${cls.id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{cls.name}</p>
                  {cls.description && <p className="text-xs text-gray-400 truncate mt-0.5">{cls.description}</p>}
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1.5">
                    <Users size={11} /> {cls.memberCount} thành viên
                  </p>
                </Link>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => openEdit(cls)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Sửa">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(cls)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xoá">
                    <Trash2 size={14} />
                  </button>
                </div>
                <Link to={`/classes/${cls.id}`} className="p-1.5 text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0 self-center">
                  <ChevronRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Tạo lớp mới' : 'Sửa lớp'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Tên lớp <span className="text-red-500">*</span></label>
            <input className="input" placeholder="VD: SE1701" autoFocus
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Mô tả</label>
            <textarea className="input resize-none" rows={2} placeholder="VD: Lập trình Web - Khoá 17"
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary btn-md flex-1">Huỷ</button>
            <button type="submit" disabled={saving} className="btn-primary btn-md flex-1">
              {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              {modal === 'create' ? 'Tạo lớp' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
