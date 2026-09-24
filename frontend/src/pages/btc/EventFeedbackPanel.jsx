import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareText, PlayCircle, StopCircle, BarChart3, Pencil,
  Trash2, Link2, Circle, EyeOff, ListPlus, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { feedbackApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import QuestionListEditor, { newQuestion, questionListError } from '../feedback/QuestionListEditor';
import FeedbackResultsModal from './FeedbackResultsModal';

// Khung "Đánh giá sau sự kiện" trong trang chi tiết sự kiện: gắn form (từ mẫu
// hoặc tự soạn), mở/đóng, bật ẩn danh và xem kết quả. Quyền do backend quyết
// (loadEventForWrite) — 403 thì ẩn cả khung.
export default function EventFeedbackPanel({ eventId, eventName }) {
  const { user } = useAuth();
  const canWrite = ['ADMIN', 'BTC'].includes(user?.role);

  const [state, setState] = useState(null); // { form, responseCount, eligibleCount }
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(null); // tên thao tác đang chạy

  const [templates, setTemplates] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const [editor, setEditor] = useState(null); // null | { title, description, questions }
  const [resultsOpen, setResultsOpen] = useState(false);

  const load = useCallback(() => {
    feedbackApi.getEventForm(eventId)
      .then(({ data }) => setState(data.data))
      .catch((err) => {
        if (err.response?.status === 403) setHidden(true);
        else setState({ error: true });
      });
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // Danh sách mẫu chỉ cần khi chưa có form hoặc đang soạn.
  useEffect(() => {
    if (!canWrite || templates !== null) return;
    if (state && (!state.form || editor)) {
      feedbackApi.listTemplates()
        .then(({ data }) => setTemplates(data.data || []))
        .catch(() => setTemplates([]));
    }
  }, [state, editor, canWrite, templates]);

  if (hidden) return null;
  if (!state) {
    return <div className="card p-4 flex justify-center"><Spinner size="md" /></div>;
  }

  // Lỗi mạng: KHÔNG rơi xuống giao diện "chưa có form" — BTC có thể bấm gắn mẫu
  // và ghi đè form đang có.
  if (state.error) {
    return (
      <div className="card p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Không tải được form đánh giá</p>
        <button onClick={() => { setState(null); load(); }} className="btn-secondary btn-sm">Thử lại</button>
      </div>
    );
  }

  const { form, responseCount, eligibleCount } = state;
  const locked = responseCount > 0;

  const run = async (name, fn, success) => {
    setBusy(name);
    try {
      await fn();
      if (success) toast.success(success);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setBusy(null);
    }
  };

  const attachTemplate = () => {
    if (!templateId) return toast.error('Chọn một mẫu đánh giá');
    run('attach', () => feedbackApi.saveEventForm(eventId, { templateId, isAnonymous: anonymous }), 'Đã gắn form đánh giá');
  };

  const openEditor = () => {
    setEditor(form
      ? { title: form.title, description: form.description || '', questions: form.questions }
      : { title: `Đánh giá sự kiện: ${eventName}`, description: '', questions: [newQuestion('RATING'), { ...newQuestion('TEXT'), required: false }] });
  };

  const loadTemplateIntoEditor = (id) => {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    setEditor((ed) => ({ ...ed, questions: tpl.questions.map((q) => ({ ...q })), description: ed.description || tpl.description || '' }));
  };

  const saveEditor = async (e) => {
    e.preventDefault();
    if (!editor.title.trim()) return toast.error('Vui lòng nhập tiêu đề form');
    const qErr = questionListError(editor.questions);
    if (qErr) return toast.error(qErr);
    await run('save', async () => {
      await feedbackApi.saveEventForm(eventId, {
        ...editor,
        ...(!form && { isAnonymous: anonymous }),
      });
      setEditor(null);
    }, form ? 'Đã lưu câu hỏi' : 'Đã tạo form đánh giá');
  };

  const setOpen = (isOpen) => run('open', () => feedbackApi.setEventFormState(eventId, { isOpen }),
    isOpen ? 'Đã mở form đánh giá' : 'Đã đóng form đánh giá');

  const toggleAnonymous = (isAnonymous) => {
    if (isAnonymous && locked && !confirm('Bật ẩn danh? Sau khi bật, bạn sẽ không thể tắt lại vì đã có người trả lời.')) return;
    run('anon', () => feedbackApi.setEventFormState(eventId, { isAnonymous }));
  };

  const removeForm = () => {
    if (!confirm('Gỡ form đánh giá khỏi sự kiện này?')) return;
    run('remove', () => feedbackApi.removeEventForm(eventId), 'Đã gỡ form đánh giá');
  };

  const feedbackUrl = `${window.location.origin}/feedback/${eventId}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedbackUrl);
      toast.success('Đã copy link đánh giá');
    } catch {
      toast(feedbackUrl, { duration: 8000 });
    }
  };

  const pct = eligibleCount ? Math.round((responseCount / eligibleCount) * 100) : 0;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
          <MessageSquareText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Đánh giá sau sự kiện</p>
          <p className="text-xs text-gray-400">Chỉ người đã check-out mới gửi được đánh giá</p>
        </div>
      </div>

      {!form ? (
        canWrite ? (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <select className="input text-sm py-2 flex-1" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">{templates === null ? 'Đang tải mẫu...' : templates.length ? '— Chọn mẫu đánh giá —' : 'Chưa có mẫu nào'}</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.questions.length} câu)</option>
                ))}
              </select>
              <button onClick={attachTemplate} disabled={busy === 'attach' || !templateId} className="btn-primary btn-sm justify-center">
                {busy === 'attach' ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <FileText size={14} />}
                Gắn mẫu
              </button>
              <button onClick={openEditor} className="btn-secondary btn-sm justify-center">
                <ListPlus size={14} /> Tự soạn
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
              <input type="checkbox" className="rounded" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              Ẩn danh — BTC không thấy ai đã trả lời gì
            </label>
          </div>
        ) : (
          <p className="text-sm text-gray-400 border-t border-border pt-3">Sự kiện này chưa có form đánh giá.</p>
        )
      ) : (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              form.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <Circle size={7} className={form.isOpen ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-400 text-gray-400'} />
              {form.isOpen ? 'Đang mở' : 'Đang đóng'}
            </span>
            {form.isAnonymous && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                <EyeOff size={11} /> Ẩn danh
              </span>
            )}
            <p className="text-sm font-medium text-gray-800 truncate min-w-0">{form.title}</p>
          </div>
          <p className="text-xs text-gray-500">
            {form.questions.length} câu hỏi
            {form.template && <> · từ mẫu “{form.template.name}”</>}
            {' · '}<b className="text-gray-800">{responseCount}</b>/{eligibleCount} người đã check-out đã trả lời
            {eligibleCount > 0 && <> ({pct}%)</>}
          </p>

          <div className="flex gap-2 flex-wrap">
            {canWrite && (form.isOpen ? (
              <button onClick={() => setOpen(false)} disabled={busy === 'open'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">
                {busy === 'open' ? <Spinner size="sm" /> : <StopCircle size={14} />} Đóng form
              </button>
            ) : (
              <button onClick={() => setOpen(true)} disabled={busy === 'open'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                {busy === 'open' ? <Spinner size="sm" /> : <PlayCircle size={14} />} Mở form
              </button>
            ))}
            <button onClick={() => setResultsOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors">
              <BarChart3 size={14} /> Xem kết quả
            </button>
            <button onClick={copyLink}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              <Link2 size={14} /> Copy link đánh giá
            </button>
            {canWrite && !locked && (
              <>
                <button onClick={openEditor}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                  <Pencil size={14} /> Sửa câu hỏi
                </button>
                <button onClick={removeForm} disabled={busy === 'remove'}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                  <Trash2 size={14} /> Gỡ form
                </button>
              </>
            )}
          </div>

          {canWrite && (
            <label className={`flex items-center gap-2 text-xs select-none ${locked && form.isAnonymous ? 'text-gray-400' : 'text-gray-600'}`}>
              <input type="checkbox" className="rounded"
                checked={form.isAnonymous}
                disabled={busy === 'anon' || (locked && form.isAnonymous)}
                onChange={(e) => toggleAnonymous(e.target.checked)} />
              Ẩn danh
              {locked && form.isAnonymous && <span>— đã có người trả lời nên không thể tắt</span>}
            </label>
          )}
          {canWrite && locked && (
            <p className="text-[11px] text-gray-400">Đã có người trả lời nên câu hỏi được khoá để không làm sai lệch kết quả.</p>
          )}
        </div>
      )}

      {/* Soạn / sửa câu hỏi của form sự kiện */}
      <Modal open={!!editor} onClose={() => setEditor(null)} title={form ? 'Sửa form đánh giá' : 'Soạn form đánh giá'} size="lg">
        {editor && (
          <form onSubmit={saveEditor} className="space-y-4">
            {templates?.length > 0 && (
              <div>
                <label className="label">Nạp câu hỏi từ mẫu</label>
                <select className="input text-sm" value="" onChange={(e) => loadTemplateIntoEditor(e.target.value)}>
                  <option value="">— Chọn mẫu để thay toàn bộ câu hỏi bên dưới —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Tiêu đề <span className="text-red-500">*</span></label>
              <input className="input" maxLength={200} value={editor.title}
                onChange={(e) => setEditor((ed) => ({ ...ed, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Lời dẫn</label>
              <textarea className="input resize-none" rows={2} maxLength={2000} value={editor.description}
                onChange={(e) => setEditor((ed) => ({ ...ed, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Câu hỏi</label>
              <QuestionListEditor questions={editor.questions}
                onChange={(questions) => setEditor((ed) => ({ ...ed, questions }))} />
            </div>
            {!form && (
              <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                <input type="checkbox" className="rounded" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                Ẩn danh — BTC không thấy ai đã trả lời gì
              </label>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditor(null)} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="submit" disabled={busy === 'save'} className="btn-primary btn-md flex-1">
                {busy === 'save' ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Lưu form
              </button>
            </div>
          </form>
        )}
      </Modal>

      <FeedbackResultsModal open={resultsOpen} eventId={eventId} onClose={() => setResultsOpen(false)} />
    </div>
  );
}
