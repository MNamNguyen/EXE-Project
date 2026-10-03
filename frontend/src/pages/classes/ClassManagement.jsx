import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { classApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Button, { IconButton } from '../../components/ui/Button';
import Modal, { useConfirm } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Dropdown, { MenuGroup, MenuItem, MenuSeparator } from '../../components/ui/Dropdown';
import { TableCard, Th } from '../../components/ui/Card';
import { Field, Input, SearchInput, Textarea } from '../../components/ui/Input';
import { EmptyText, LoadError, SkeletonRows } from '../../components/ui/States';

// Form tạo/sửa lớp (một form cho cả hai việc), dùng chung với trang chi tiết lớp
export function ClassFormModal({ open, mode, form, setForm, saving, onClose, onSubmit }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo lớp mới' : 'Sửa lớp'}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" size="form" onClick={onClose}>Huỷ</Button>
          <Button type="submit" form="class-form" variant="primary" size="form" loading={saving}>
            {mode === 'create' ? 'Tạo lớp' : 'Lưu thay đổi'}
          </Button>
        </>
      )}
    >
      <form id="class-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Tên lớp" required>
          {(id) => <Input id={id} placeholder="VD: SE1701" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />}
        </Field>
        <Field label="Mô tả" optional>
          {(id) => (
            <Textarea id={id} className="resize-none" rows={2} placeholder="VD: Lập trình Web - Khoá 17"
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          )}
        </Field>
      </form>
    </Modal>
  );
}

export default function ClassManagement() {
  const confirm = useConfirm();
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
    if (!(await confirm({
      title: 'Xoá lớp?',
      body: <>Lớp <span className="font-medium text-foreground">{cls.name}</span> sẽ bị xoá.</>,
      confirmLabel: 'Xoá lớp',
    }))) return;
    try {
      await classApi.remove(cls.id);
      toast.success('Đã xoá lớp');
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
    }
  };

  const rowMenu = (cls) => (
    <Dropdown align="end" ariaLabel="Thao tác" trigger={<IconButton icon={Ellipsis} label="Thao tác" row />}>
      <MenuGroup><MenuItem icon={Pencil} onSelect={() => openEdit(cls)}>Sửa lớp</MenuItem></MenuGroup>
      <MenuSeparator />
      <MenuGroup><MenuItem icon={Trash2} danger onSelect={() => handleDelete(cls)}>Xoá lớp</MenuItem></MenuGroup>
    </Dropdown>
  );

  let body;
  if (loading) body = <SkeletonRows rows={5} avatar={false} />;
  else if (loadError) body = <LoadError title="Không tải được danh sách lớp" onRetry={() => load(search)} />;
  else if (classes.length === 0) {
    body = search ? (
      <p className="text-pretty py-10 text-center text-sm text-muted">
        Không có lớp nào khớp <span className="text-foreground">“{search}”</span>. Thử từ khoá khác.{' '}
        <button type="button" onClick={() => setSearch('')} className="font-medium text-foreground underline-offset-4 hover:underline">Xoá tìm kiếm</button>
      </p>
    ) : (
      <EmptyText className="py-10">Chưa có lớp nào. Tạo lớp để thêm cả lớp vào sự kiện hoặc tạo buổi điểm danh.</EmptyText>
    );
  } else {
    body = (
      <>
        <table className="hidden w-full text-sm sm:table">
          <thead className="border-b border-border">
            <tr>
              <Th className="w-full">Lớp</Th>
              <Th className="text-right">Thành viên</Th>
              <Th>Người tạo</Th>
              <th className="w-px px-2"><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                <td className="max-w-0 px-4 py-3">
                  <Link to={`/classes/${cls.id}`} className="block truncate font-medium text-foreground outline-none hover:underline">{cls.name}</Link>
                  <p className="mt-0.5 truncate text-xs text-muted" title={cls.description || ''}>{cls.description || '—'}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{cls.memberCount}</td>
                <td className={`whitespace-nowrap px-4 py-3 ${cls.createdBy?.name ? 'text-foreground' : 'text-muted'}`}>{cls.createdBy?.name || '—'}</td>
                <td className="px-2 py-3">{rowMenu(cls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-border sm:hidden">
          {classes.map((cls) => (
            <li key={cls.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link to={`/classes/${cls.id}`} className="text-sm font-medium text-foreground outline-none">{cls.name}</Link>
                {cls.description && <p className="mt-0.5 line-clamp-2 text-pretty text-xs text-muted">{cls.description}</p>}
                <p className="mt-1 text-xs tabular-nums text-muted">{cls.memberCount} thành viên</p>
              </div>
              {rowMenu(cls)}
            </li>
          ))}
        </ul>
        <Pagination page={1} pages={1} total={classes.length} pageSize={classes.length} noun="lớp" onPageChange={() => {}} />
      </>
    );
  }

  return (
    <Layout title="Lớp học" headerRight={<Button variant="primary" size="hdr" icon={Plus} onClick={openCreate}>Tạo lớp</Button>}>
      <div className="mb-4">
        <SearchInput className="w-full sm:w-72" placeholder="Tìm lớp theo tên" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <TableCard>{body}</TableCard>

      <ClassFormModal
        open={!!modal}
        mode={modal === 'create' ? 'create' : 'edit'}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={handleSubmit}
      />
    </Layout>
  );
}
