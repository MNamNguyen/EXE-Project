import { useState, useEffect } from 'react';
import { MessageSquareText, Lock, CheckCircle2, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { feedbackApi } from '../../services/api';
import Spinner from '../../components/ui/Spinner';
import StarRating, { RATING_LABELS } from '../../components/ui/StarRating';

// Form trả lời đánh giá, dùng ở 2 nơi: trang /feedback/:eventId và ngay dưới
// thẻ "Check-out thành công" của trang quét mã (showTitle — trang đó không có
// header riêng). onLoaded(data) cho trang cha lấy tiêu đề/tên sự kiện.
export default function FeedbackResponseForm({ eventId, showTitle = false, onLoaded }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    feedbackApi.getMyResponse(eventId)
      .then(({ data: res }) => {
        setData(res.data);
        setAnswers(res.data.myResponse?.answers || {});
        onLoaded?.(res.data);
      })
      .catch((err) => setLoadError(err.response?.data?.message || 'Không tải được form đánh giá'));
  }, [eventId]); // eslint-disable-line

  if (loadError) {
    return (
      <div className="card p-12 text-center">
        <MessageSquareText size={44} className="text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">{loadError}</p>
      </div>
    );
  }
  if (!data) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>;

  const setAnswer = (id, value) => setAnswers((a) => ({ ...a, [id]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = data.form.questions.findIndex((q) => q.required && (
      q.type === 'RATING' ? !answers[q.id] : !String(answers[q.id] || '').trim()
    ));
    if (missing >= 0) {
      document.getElementById(`q-${data.form.questions[missing].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return toast.error(`Câu ${missing + 1} là câu bắt buộc`);
    }

    setSubmitting(true);
    try {
      const { data: res } = await feedbackApi.submit(eventId, answers);
      toast.success(res.message);
      setData((d) => ({ ...d, myResponse: res.data }));
      setJustSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi đánh giá thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  // Vừa gửi xong: thu gọn thành lời cảm ơn thay vì để nguyên form dài.
  if (justSent) {
    return (
      <div className="card p-5 flex items-start gap-3 border-emerald-200 bg-emerald-50">
        <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-left">
          <p className="font-semibold text-emerald-800 text-sm">Cảm ơn bạn đã gửi đánh giá!</p>
          <p className="text-xs text-emerald-700 mt-0.5">Bạn vẫn có thể sửa câu trả lời khi form còn mở.</p>
          <button onClick={() => setJustSent(false)} className="text-xs font-semibold text-emerald-800 underline mt-2">
            Xem / sửa câu trả lời
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {showTitle && (
        <div className="flex items-center gap-2.5 pt-2">
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
            <MessageSquareText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Đánh giá sự kiện</p>
            <p className="text-sm font-bold text-gray-900">{data.form.title}</p>
          </div>
        </div>
      )}

      {data.myResponse && (
        <div className="card p-4 flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">
            Bạn đã gửi đánh giá lúc {format(new Date(data.myResponse.updatedAt), 'HH:mm dd/MM/yyyy')}.
            {data.canSubmit && ' Bạn có thể sửa và gửi lại.'}
          </p>
        </div>
      )}

      {!data.canSubmit && (
        <div className="card p-4 flex items-start gap-3 border-amber-200 bg-amber-50">
          <Lock size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{data.reasonMessage}</p>
        </div>
      )}

      {data.form.description && (
        <p className="text-sm text-gray-600 whitespace-pre-line">{data.form.description}</p>
      )}
      {data.form.isAnonymous && (
        <p className="flex items-center gap-1.5 text-xs text-violet-700">
          <EyeOff size={13} /> Form ẩn danh — Ban tổ chức không biết ai đã trả lời gì.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {data.form.questions.map((q, i) => (
          <div key={q.id} id={`q-${q.id}`} className="card p-4">
            <p className="text-sm font-medium text-gray-900">
              {i + 1}. {q.label}
              {q.required && <span className="text-red-500 ml-0.5">*</span>}
            </p>
            {q.type === 'RATING' ? (
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <StarRating
                  value={answers[q.id] || 0}
                  onChange={data.canSubmit ? (v) => setAnswer(q.id, v) : undefined}
                  size={30}
                />
                <span className="text-sm text-gray-500">{RATING_LABELS[answers[q.id]] || ''}</span>
              </div>
            ) : (
              <textarea
                className="input resize-y text-sm mt-3"
                rows={3}
                maxLength={2000}
                disabled={!data.canSubmit}
                placeholder="Nhập câu trả lời của bạn..."
                value={answers[q.id] || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}
          </div>
        ))}

        {data.canSubmit && (
          <button type="submit" disabled={submitting} className="btn-primary btn-lg btn-full">
            {submitting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
            {data.myResponse ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
          </button>
        )}
      </form>
    </div>
  );
}
