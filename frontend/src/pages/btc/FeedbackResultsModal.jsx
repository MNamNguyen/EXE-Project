import { useState, useEffect } from 'react';
import { EyeOff, MessageSquare, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { feedbackApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import StarRating from '../../components/ui/StarRating';

// Kết quả đánh giá của một sự kiện. Form ẩn danh: backend không trả thông tin
// người gửi nên tab "Từng phiếu" cũng không tồn tại.
export default function FeedbackResultsModal({ open, eventId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('summary');

  const load = () => {
    setError(false);
    setData(null);
    feedbackApi.getResults(eventId)
      .then(({ data: res }) => setData(res.data))
      .catch(() => setError(true));
  };

  useEffect(() => {
    if (open) { setTab('summary'); load(); }
  }, [open, eventId]); // eslint-disable-line

  return (
    <Modal open={open} onClose={onClose} title="Kết quả đánh giá" size="xl">
      {error ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-sm text-gray-500">Không tải được kết quả</p>
          <button onClick={load} className="btn-primary btn-sm inline-flex"><RefreshCw size={14} /> Thử lại</button>
        </div>
      ) : !data ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="font-semibold text-gray-900">{data.form.title}</p>
            {data.form.isAnonymous && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                <EyeOff size={11} /> Ẩn danh
              </span>
            )}
            <p className="text-sm text-gray-500">
              <b className="text-gray-900">{data.responseCount}</b> phiếu / {data.eligibleCount} người đã check-out
            </p>
            <div className="flex-1" />
            <button onClick={load} className="btn-secondary btn-sm"><RefreshCw size={14} /></button>
          </div>

          {!data.form.isAnonymous && (
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              {[['summary', 'Tổng hợp'], ['responses', 'Từng phiếu']].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {data.responseCount === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <MessageSquare size={36} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm">Chưa có ai gửi đánh giá</p>
            </div>
          ) : tab === 'summary' ? (
            <div className="space-y-4">
              {data.questions.map((q, i) => (
                <div key={q.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium text-gray-800">{i + 1}. {q.label}</p>
                  {q.type === 'RATING' ? <RatingSummary q={q} /> : <TextSummary q={q} />}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data.responses.map((r, idx) => (
                <div key={idx} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                    {r.mssv && <p className="text-xs text-gray-400">{r.mssv}</p>}
                    {r.class && <p className="text-xs text-gray-400">· {r.class}</p>}
                    <p className="text-xs text-gray-400 ml-auto">{format(new Date(r.submittedAt), 'HH:mm dd/MM/yyyy')}</p>
                  </div>
                  {data.questions.map((q) => {
                    const v = r.answers[q.id];
                    return (
                      <div key={q.id} className="text-sm">
                        <p className="text-xs text-gray-500">{q.label}</p>
                        {v === undefined ? (
                          <p className="text-gray-300 text-xs">(bỏ trống)</p>
                        ) : q.type === 'RATING' ? (
                          <StarRating value={v} size={16} />
                        ) : (
                          <p className="text-gray-800 whitespace-pre-line">{v}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function RatingSummary({ q }) {
  const max = Math.max(1, ...q.distribution);
  return (
    <div className="mt-3 flex flex-col sm:flex-row gap-5">
      <div className="flex flex-col items-center justify-center sm:w-36 flex-shrink-0">
        <p className="text-3xl font-bold text-gray-900">{q.average ?? '—'}</p>
        <StarRating value={q.average || 0} size={16} />
        <p className="text-xs text-gray-400 mt-1">{q.count} lượt</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = q.distribution[star - 1];
          const pct = q.count ? Math.round((n / q.count) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-8 text-gray-500 text-right">{star} ★</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="w-16 text-gray-500">{n} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextSummary({ q }) {
  if (!q.answers.length) return <p className="text-xs text-gray-400 mt-2">Chưa có câu trả lời</p>;
  return (
    <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
      {q.answers.map((a, idx) => (
        <div key={idx} className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-sm text-gray-800 whitespace-pre-line">{a.text}</p>
          {a.name && (
            <p className="text-[11px] text-gray-400 mt-1">— {a.name}{a.mssv ? ` (${a.mssv})` : ''}</p>
          )}
        </div>
      ))}
    </div>
  );
}
