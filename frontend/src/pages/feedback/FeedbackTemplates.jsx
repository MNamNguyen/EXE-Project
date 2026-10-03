import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Copy, Ellipsis, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { feedbackApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import Button, { IconButton } from '../../components/ui/Button';
import Modal, { useConfirm } from '../../components/ui/Modal';
import Dropdown, { MenuGroup, MenuItem, MenuSeparator } from '../../components/ui/Dropdown';
import { Field, Input, SearchInput, Textarea } from '../../components/ui/Input';
import { Banner, EmptyText, LoadError, SkeletonRows } from '../../components/ui/States';
import QuestionListEditor, { newQuestion, questionListError } from './QuestionListEditor';

const EMPTY_FORM = () => ({ name: '', description: '', questions: [newQuestion('RATING'), { ...newQuestion('TEXT'), required: false }] });

export default function FeedbackTemplates() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // null | { mode: 'create' | 'edit' | 'view', template? }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback((s = search) => {
    setLoadError(false);
    setLoading(true);
    feedbackApi.listTemplates(s ? { search: s } : undefined)
      .then(({ data }) => setTemplates(data.data || []))
      .catch(() => { setLoadError(true); toast.error('Tải danh sách mẫu thất bại'); })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(''); }, []); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(() => load(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  const openCreate = () => { setForm(EMPTY_FORM()); setModal({ mode: 'create' }); };
  const openExisting = (tpl, mode) => {
    setForm({ name: tpl.name, description: tpl.description || '', questions: tpl.questions });
    setModal({ mode, template: tpl });
  };
  // Nhân bản mẫu của người khác để chỉnh theo ý mình mà không đụng vào bản gốc.
  const duplicate = (tpl) => {
    setForm({ name: `${tpl.name} (bản sao)`, description: tpl.description || '', questions: tpl.questions.map((q) => ({ ...q })) });
    setModal({ mode: 'create' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Vui lòng nhập tên mẫu');
    const qErr = questionListError(form.questions);
    if (qErr) return toast.error(qErr);

    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await feedbackApi.createTemplate(form);
        toast.success('Đã tạo mẫu đánh giá');
      } else {
        await feedbackApi.updateTemplate(modal.template.id, form);
        toast.success('Đã cập nhật mẫu');
      }
      setModal(null);
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tpl) => {
    if (!(await confirm({
      title: 'Xoá mẫu đánh giá?',
      body: (
        <>
          Mẫu <span className="font-medium text-foreground">{tpl.name}</span> sẽ bị xoá.
          {tpl._count?.forms ? ` Mẫu đang được ${tpl._count.forms} sự kiện dùng — form của các sự kiện đó vẫn giữ nguyên.` : ''}
        </>
      ),
      confirmLabel: 'Xoá mẫu',
    }))) return;
    try {
      await feedbackApi.deleteTemplate(tpl.id);
      toast.success('Đã xoá mẫu');
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
    }
  };

  const readOnly = modal?.mode === 'view';
  const modalTitle = { create: 'Tạo mẫu đánh giá', edit: 'Sửa mẫu đánh giá', view: 'Xem mẫu đánh giá' }[modal?.mode];

  let list;
  if (loading) list = <SkeletonRows rows={3} />;
  else if (loadError) list = <LoadError title="Không tải được danh sách mẫu" onRetry={() => load(search)} />;
  else if (templates.length === 0) {
    list = search ? (
      <p className="text-pretty py-6 text-center text-sm text-muted">
        Không có mẫu nào khớp <span className="text-foreground">“{search}”</span>.{' '}
        <button type="button" onClick={() => setSearch('')} className="font-medium text-foreground underline-offset-4 hover:underline">Xoá tìm kiếm</button>
      </p>
    ) : (
      <EmptyText>Chưa có mẫu đánh giá nào. Mẫu gồm câu đánh giá sao (1–5) và câu trả lời văn bản.</EmptyText>
    );
  } else {
    list = (
      <ul className="flex flex-col gap-0.5">
        {templates.map((tpl) => {
          const ratings = tpl.questions.filter((q) => q.type === 'RATING').length;
          const texts = tpl.questions.length - ratings;
          const mine = tpl.createdBy?.id ? tpl.createdBy.id === user?.id : false;
          const owner = mine ? 'của bạn' : tpl.createdBy?.name ? `của ${tpl.createdBy.name}` : '';
          const meta = [
            `${ratings} câu sao`,
            `${texts} câu văn bản`,
            tpl._count?.forms > 0 && `dùng ở ${tpl._count.forms} sự kiện`,
            owner,
          ].filter(Boolean).join(' · ');
          return (
            <li key={tpl.id} className="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-item-hover">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted group-hover:bg-surface">
                <ClipboardList className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={tpl.name}>{tpl.name}</p>
                <p className="mt-1 truncate text-xs text-muted">{meta}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {tpl.canEdit ? (
                  <>
                    <IconButton icon={Pencil} label="Sửa mẫu" row onClick={() => openExisting(tpl, 'edit')} />
                    <Dropdown align="end" ariaLabel="Thao tác" trigger={<IconButton icon={Ellipsis} label="Thao tác" row />}>
                      <MenuGroup><MenuItem icon={Copy} onSelect={() => duplicate(tpl)}>Nhân bản</MenuItem></MenuGroup>
                      <MenuSeparator />
                      <MenuGroup><MenuItem icon={Trash2} danger onSelect={() => handleDelete(tpl)}>Xoá mẫu</MenuItem></MenuGroup>
                    </Dropdown>
                  </>
                ) : (
                  <>
                    <IconButton icon={Eye} label="Xem mẫu" row onClick={() => openExisting(tpl, 'view')} />
                    <IconButton icon={Copy} label="Nhân bản" row onClick={() => duplicate(tpl)} />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Layout title="Mẫu đánh giá" headerRight={<Button variant="primary" size="hdr" icon={Plus} onClick={openCreate}>Tạo mẫu</Button>}>
      <div className="mb-4">
        <SearchInput className="w-full sm:w-72" placeholder="Tìm mẫu theo tên" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <section className="rounded-2xl border border-border bg-surface p-2">{list}</section>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modalTitle}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" size="form" onClick={() => setModal(null)}>{readOnly ? 'Đóng' : 'Huỷ'}</Button>
            {!readOnly && (
              <Button type="submit" form="template-form" variant="primary" size="form" loading={saving}>
                {modal?.mode === 'create' ? 'Tạo mẫu' : 'Lưu thay đổi'}
              </Button>
            )}
          </>
        )}
      >
        <form id="template-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          {readOnly && (
            <Banner tone="info" compact>Mẫu của người khác chỉ xem được. Bấm “Nhân bản” ở danh sách để tạo bản của riêng bạn.</Banner>
          )}
          <Field label="Tên mẫu" required>
            {(id) => (
              <Input id={id} placeholder="VD: Đánh giá hội thảo chuyên đề" disabled={readOnly} maxLength={200}
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            )}
          </Field>
          <Field label="Lời dẫn" optional>
            {(id) => (
              <Textarea id={id} className="resize-none" rows={2} disabled={readOnly} maxLength={2000}
                placeholder="VD: Cảm ơn bạn đã tham dự! Hãy dành 1 phút để góp ý cho BTC."
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">Câu hỏi</p>
            <QuestionListEditor questions={form.questions} disabled={readOnly} onChange={(questions) => setForm((f) => ({ ...f, questions }))} />
          </div>
          {modal?.mode === 'edit' && modal.template?._count?.forms > 0 && (
            <Banner tone="warning" compact>
              Sửa mẫu không làm thay đổi form của {modal.template._count.forms} sự kiện đã gắn mẫu này.
            </Banner>
          )}
        </form>
      </Modal>
    </Layout>
  );
}
