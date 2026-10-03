import { useState, useEffect } from 'react';
import { EyeOff, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { feedbackApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import { IconButton } from '../../components/ui/Button';
import StarRating from '../../components/ui/StarRating';
import { EmptyText, LoadError, SkeletonRows } from '../../components/ui/States';

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
    <Modal open={open} onClose={onClose} title="Kết quả đánh giá" size="xl" closeOnOverlay>
      {error ? (
        <LoadError title="Không tải được kết quả" onRetry={load} />
      ) : !data ? (
        <SkeletonRows rows={4} avatar={false} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="font-semibold text-foreground">{data.form.title}</p>
            {data.form.isAnonymous && <Badge icon={EyeOff}>Ẩn danh</Badge>}
            <p className="text-sm text-muted">
              <span className="font-medium tabular-nums text-foreground">{data.responseCount}</span> phiếu / {data.eligibleCount} người đã check-out
            </p>
            <IconButton icon={RefreshCw} label="Làm mới" onClick={load} className="ml-auto" />
          </div>

          {!data.form.isAnonymous && (
            <Tabs
              variant="segmented"
              ariaLabel="Cách xem kết quả"
              value={tab}
              onChange={setTab}
              items={[{ value: 'summary', label: 'Tổng hợp' }, { value: 'responses', label: 'Từng phiếu' }]}
            />
          )}

          {data.responseCount === 0 ? (
            <EmptyText className="py-10">Chưa có ai gửi đánh giá</EmptyText>
          ) : tab === 'summary' ? (
            <div className="divide-y divide-border">
              {data.questions.map((q, i) => (
                <section key={q.id} className="py-5 first:pt-0 last:pb-0">
                  <p className="text-pretty text-sm font-medium text-foreground">{i + 1}. {q.label}</p>
                  {q.type === 'RATING' ? <RatingSummary q={q} /> : <TextSummary q={q} />}
                </section>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.responses.map((r, idx) => (
                <section key={idx} className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    {(r.mssv || r.class) && (
                      <p className="text-xs tabular-nums text-muted">{[r.mssv, r.class].filter(Boolean).join(' · ')}</p>
                    )}
                    <p className="ml-auto text-xs tabular-nums text-muted">{format(new Date(r.submittedAt), 'HH:mm dd/MM/yyyy')}</p>
                  </div>
                  {data.questions.map((q) => {
                    const v = r.answers[q.id];
                    return (
                      <div key={q.id}>
                        <p className="text-xs text-muted">{q.label}</p>
                        {v === undefined ? (
                          <p className="mt-0.5 text-sm text-muted">(bỏ trống)</p>
                        ) : q.type === 'RATING' ? (
                          <StarRating value={v} size={16} className="mt-1" />
                        ) : (
                          <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{v}</p>
                        )}
                      </div>
                    );
                  })}
                </section>
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
    <div className="mt-4 flex flex-col gap-5 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center justify-center sm:w-36">
        <p className="text-3xl font-semibold tabular-nums text-foreground">{q.average ?? '—'}</p>
        <StarRating value={q.average || 0} size={16} className="mt-1" />
        <p className="mt-1 text-xs tabular-nums text-muted">{q.count} lượt</p>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = q.distribution[star - 1];
          const pct = q.count ? Math.round((n / q.count) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-8 text-right tabular-nums text-muted">{star} ★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/5">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="w-16 tabular-nums text-muted">{n} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextSummary({ q }) {
  if (!q.answers.length) return <p className="mt-2 text-sm text-muted">Chưa có câu trả lời</p>;
  return (
    <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
      {q.answers.map((a, idx) => (
        <div key={idx} className="rounded-xl bg-background px-3 py-2.5">
          <p className="whitespace-pre-line text-sm text-foreground">{a.text}</p>
          {a.name && <p className="mt-1 text-xs text-muted">— {a.name}{a.mssv ? ` (${a.mssv})` : ''}</p>}
        </div>
      ))}
    </div>
  );
}
