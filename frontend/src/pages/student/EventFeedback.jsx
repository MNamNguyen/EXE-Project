import { useState } from 'react';
import { useParams, Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import FeedbackResponseForm from '../feedback/FeedbackResponseForm';

// Trang gửi đánh giá sau sự kiện (/feedback/:eventId). BTC phát link này cho
// người tham dự nên chưa đăng nhập thì đưa qua /login rồi quay lại đây.
export default function EventFeedback() {
  const { eventId } = useParams();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Link to="/my-attendance" className="inline-flex items-center gap-1 text-white/70 text-xs hover:text-white mb-2">
            <ChevronLeft size={14} /> Lịch sử tham dự
          </Link>
          <h1 className="text-2xl font-bold text-white line-clamp-2">{data?.form.title || 'Đánh giá sự kiện'}</h1>
          {data && <p className="text-white/60 text-sm mt-1">{data.event.name} · {data.event.location}</p>}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <FeedbackResponseForm eventId={eventId} onLoaded={setData} />
      </div>
    </Layout>
  );
}
