import { useState } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import { PageSpinner, Skeleton } from '../../components/ui/States';
import FeedbackResponseForm from '../feedback/FeedbackResponseForm';

// Trang gửi đánh giá sau sự kiện (/feedback/:eventId). BTC phát link này cho
// người tham dự nên chưa đăng nhập thì đưa qua /login rồi quay lại đây.
export default function EventFeedback() {
  const { eventId } = useParams();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);

  if (authLoading) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;

  const title = data?.form.title || 'Đánh giá sự kiện';
  // Tiêu đề form thường đã có tên sự kiện; khi đó dòng phụ chỉ còn địa điểm
  const sub = data
    ? [title.includes(data.event.name) ? null : data.event.name, data.event.location].filter(Boolean).join(' · ')
    : '';

  return (
    <Layout parent={{ label: 'Lịch sử tham dự', to: '/my-attendance' }} activeNav="/my-attendance">
      <header className="mb-6">
        <h1 className="text-balance text-xl font-semibold text-foreground">{title}</h1>
        {data ? (
          sub && <p className="mt-2 max-w-[55ch] text-pretty text-sm/6 text-muted">{sub}</p>
        ) : (
          <Skeleton className="mt-3 h-3 w-48" />
        )}
      </header>
      <div className="max-w-2xl">
        <FeedbackResponseForm eventId={eventId} onLoaded={setData} />
      </div>
    </Layout>
  );
}
