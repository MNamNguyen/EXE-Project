import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, LogOut, Clock, Calendar, MessageSquareText, Award } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { eventApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Badge, { attendanceStatusBadge } from '../../components/ui/Badge';

export default function MyAttendance() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventApi.list({ limit: 50 }).then(({ data }) => {
      setEvents(data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <h1 className="text-2xl font-bold text-white">Lịch sử tham dự</h1>
        <p className="text-white/60 text-sm mt-1">{user?.name}</p>
      </div>

      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : events.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Bạn chưa tham dự sự kiện nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const att = event.attendance;
              const { label, variant } = attendanceStatusBadge(att?.status || 'REGISTERED');
              return (
                <div key={event.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm">{event.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{event.location}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {event.checkinOpen ? format(new Date(event.checkinOpen), 'dd/MM/yyyy', { locale: vi }) : 'Điểm danh thủ công'}
                      </p>
                    </div>
                    <Badge variant={variant}>{label}</Badge>
                  </div>
                  {att && (att.checkinTime || att.checkoutTime) && (
                    <div className="mt-3 pt-3 border-t border-gray-50 flex gap-4">
                      {att.checkinTime && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <CheckCircle2 size={13} />
                          Vào: {format(new Date(att.checkinTime), 'HH:mm')}
                        </div>
                      )}
                      {att.checkoutTime && (
                        <div className="flex items-center gap-1.5 text-xs text-teal-600">
                          <LogOut size={13} />
                          Ra: {format(new Date(att.checkoutTime), 'HH:mm')}
                        </div>
                      )}
                      {att.checkinTime && att.checkoutTime && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={13} />
                          {Math.round((new Date(att.checkoutTime) - new Date(att.checkinTime)) / 60000)} phút
                        </div>
                      )}
                    </div>
                  )}
                  <FeedbackAction event={event} />
                  {event.certificateId && (
                    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between gap-3">
                      <p className="text-xs text-gray-500">Bạn đã được cấp chứng nhận tham gia</p>
                      <Link to={`/my-certificates?open=${event.certificateId}`}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                        <Award size={14} /> Xem chứng nhận
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

// Nút đánh giá: chỉ người đã check-out mới gửi được (backend cũng chặn), nên
// không hiện nút cho người chưa check-out để khỏi bấm vào rồi bị từ chối.
function FeedbackAction({ event }) {
  const fb = event.feedback;
  if (!fb || event.attendance?.status !== 'CHECKED_OUT') return null;
  if (!fb.isOpen && !fb.submitted) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between gap-3">
      <p className="text-xs text-gray-500">
        {fb.submitted ? 'Bạn đã gửi đánh giá' : 'Sự kiện đang nhận đánh giá'}
      </p>
      <Link
        to={`/feedback/${event.id}`}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
          fb.submitted ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        <MessageSquareText size={14} />
        {!fb.submitted ? 'Đánh giá' : fb.isOpen ? 'Sửa đánh giá' : 'Xem đánh giá'}
      </Link>
    </div>
  );
}
