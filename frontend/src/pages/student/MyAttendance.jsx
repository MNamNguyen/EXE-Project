import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, MessageSquareText } from 'lucide-react';
import { format } from 'date-fns';
import { eventApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Button from '../../components/ui/Button';
import { AttendanceBadge } from '../../components/ui/Badge';
import { EmptyText, LoadError, SkeletonRows } from '../../components/ui/States';

export default function MyAttendance() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    eventApi.list({ limit: 50 })
      .then(({ data }) => setEvents((data.data || []).filter((e) => e.attendance)))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  let list;
  if (loading) list = <SkeletonRows rows={4} avatar={false} />;
  else if (loadError) list = <LoadError title="Không tải được lịch sử tham dự" onRetry={load} />;
  else if (events.length === 0) list = <EmptyText>Bạn chưa tham dự sự kiện nào.</EmptyText>;
  else {
    list = (
      <ul className="divide-y divide-border">
        {events.map((event) => {
          const att = event.attendance;
          const minutes = att?.checkinTime && att?.checkoutTime
            ? Math.round((new Date(att.checkoutTime) - new Date(att.checkinTime)) / 60000) : null;
          const feedback = feedbackAction(event);
          return (
            <li key={event.id} className="px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-pretty text-sm font-medium text-foreground">{event.name}</p>
                  <p className="mt-1 text-xs tabular-nums text-muted">
                    {event.checkinOpen ? format(new Date(event.checkinOpen), 'dd/MM/yyyy') : 'Điểm danh thủ công'} · {event.location}
                  </p>
                </div>
                <AttendanceBadge status={att?.status || 'REGISTERED'} />
              </div>
              {att?.checkinTime && (
                <p className="mt-2 text-xs tabular-nums text-muted">
                  Vào {format(new Date(att.checkinTime), 'HH:mm')}
                  {att.checkoutTime && ` · Ra ${format(new Date(att.checkoutTime), 'HH:mm')}`}
                  {minutes !== null && ` · ${minutes} phút`}
                </p>
              )}
              {(feedback || event.certificateId) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {feedback && (
                    <Button as={Link} to={`/feedback/${event.id}`} size="sm" icon={MessageSquareText}>{feedback}</Button>
                  )}
                  {event.certificateId && (
                    <Button as={Link} to={`/my-certificates?open=${event.certificateId}`} size="sm" icon={Award}>Xem chứng nhận</Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Layout title="Lịch sử tham dự">
      <div className="max-w-3xl">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">{list}</section>
      </div>
    </Layout>
  );
}

// Nút đánh giá: chỉ người đã check-out mới gửi được (backend cũng chặn), nên
// không hiện nút cho người chưa check-out để khỏi bấm vào rồi bị từ chối.
function feedbackAction(event) {
  const fb = event.feedback;
  if (!fb || event.attendance?.status !== 'CHECKED_OUT') return null;
  if (!fb.isOpen && !fb.submitted) return null;
  if (!fb.submitted) return 'Đánh giá';
  return fb.isOpen ? 'Sửa đánh giá' : 'Xem đánh giá';
}
