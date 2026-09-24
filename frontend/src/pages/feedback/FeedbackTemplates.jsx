import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, RefreshCw, AlertCircle, ClipboardList,
  Pencil, Trash2, Eye, Star, AlignLeft, Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { feedbackApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import QuestionListEditor, { newQuestion, questionListError } from './QuestionListEditor';

const EMPTY_FORM = () => ({ name: '', description: '', questions: [newQuestion('RATING'), { ...newQuestion('TEXT'), required: false }] });

export default function FeedbackTemplates() {
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
    const note = tpl._count?.forms ? `\n\nMẫu đang được ${tpl._count.forms} sự kiện dùng — form của các sự kiện đó vẫn giữ nguyên.` : '';
    if (!confirm(`Xoá mẫu "${tpl.name}"?${note}`)) return;
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

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Mẫu đánh giá</h1>
            <p className="text-white/70 text-sm mt-1">Soạn sẵn bộ câu hỏi để gắn vào form đánh giá sau sự kiện</p>
          </div>
          <button onClick={openCreate} className="btn-primary btn-md bg-white text-primary-700 hover:bg-blue-50">
            <Plus size={16} /> Tạo mẫu mới
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10 text-sm" placeholder="Tìm mẫu theo tên..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className="card flex flex-col items-center gap-3 py-16">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm font-medium text-gray-500">Không tải được danh sách mẫu</p>
            <button onClick={() => load(search)} className="btn-primary btn-sm mt-1">
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : templates.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <ClipboardList size={28} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600 text-sm">
              {search ? 'Không tìm thấy mẫu phù hợp' : 'Chưa có mẫu đánh giá nào'}
            </p>
            <p className="text-gray-400 text-xs mt-1 mb-4">
              Mẫu gồm các câu đánh giá sao (1–5) và câu trả lời văn bản.
            </p>
            {!search && (
              <button onClick={openCreate} className="btn-primary btn-sm inline-flex">
                <Plus size={14} /> Tạo mẫu đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((tpl) => {
              const ratings = tpl.questions.filter((q) => q.type === 'RATING').length;
              const texts = tpl.questions.length - ratings;
              return (
                <div key={tpl.id} className="card p-4 flex items-start gap-3 hover:shadow-card-hover transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <ClipboardList size={20} className="text-primary-600" />
                  </div>
                  <button onClick={() => openExisting(tpl, tpl.canEdit ? 'edit' : 'view')} className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-gray-900 text-sm truncate">{tpl.name}</p>
                    {tpl.description && <p className="text-xs text-gray-400 truncate mt-0.5">{tpl.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Star size={11} /> {ratings} câu sao</span>
                      <span className="flex items-center gap-1"><AlignLeft size={11} /> {texts} câu văn bản</span>
                      {tpl._count?.forms > 0 && <span>· Dùng ở {tpl._count.forms} sự kiện</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Tạo bởi {tpl.createdBy?.name || '—'}</p>
                  </button>
                  <div className="flex flex-col gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {tpl.canEdit ? (
                      <>
                        <button onClick={() => openExisting(tpl, 'edit')} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Sửa">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(tpl)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xoá">
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => openExisting(tpl, 'view')} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Xem">
                        <Eye size={14} />
                      </button>
                    )}
                    <button onClick={() => duplicate(tpl)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Nhân bản">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modalTitle} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {readOnly && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Mẫu của người khác chỉ xem được. Bấm "Nhân bản" ở danh sách để tạo bản của riêng bạn.
            </p>
          )}
          <div>
            <label className="label">Tên mẫu <span className="text-red-500">*</span></label>
            <input className="input" placeholder="VD: Đánh giá hội thảo chuyên đề" autoFocus={!readOnly}
              disabled={readOnly} maxLength={200}
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Lời dẫn</label>
            <textarea className="input resize-none" rows={2} disabled={readOnly} maxLength={2000}
              placeholder="VD: Cảm ơn bạn đã tham dự! Hãy dành 1 phút để góp ý cho BTC."
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Câu hỏi</label>
            <QuestionListEditor
              questions={form.questions}
              disabled={readOnly}
              onChange={(questions) => setForm((f) => ({ ...f, questions }))}
            />
          </div>
          {modal?.mode === 'edit' && modal.template?._count?.forms > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Sửa mẫu không làm thay đổi form của {modal.template._count.forms} sự kiện đã gắn mẫu này.
            </p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary btn-md flex-1">
              {readOnly ? 'Đóng' : 'Huỷ'}
            </button>
            {!readOnly && (
              <button type="submit" disabled={saving} className="btn-primary btn-md flex-1">
                {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                {modal?.mode === 'create' ? 'Tạo mẫu' : 'Lưu thay đổi'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
