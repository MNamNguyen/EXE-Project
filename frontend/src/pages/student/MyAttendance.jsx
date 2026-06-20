import { useState, useEffect } from 'react';
import { CheckCircle2, LogOut, Clock, Calendar } from 'lucide-react';
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
                        {format(new Date(event.checkinOpen), 'dd/MM/yyyy', { locale: vi })}
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
