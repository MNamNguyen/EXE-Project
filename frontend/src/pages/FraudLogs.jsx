import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, MapPin, Smartphone, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { reportApi } from '../services/api';
import Layout from '../components/layout/Layout';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';

const REASON_MAP = {
  INVALID_QR_TOKEN: { label: 'QR hết hạn / giả', variant: 'yellow' },
  GPS_OUT_OF_RANGE: { label: 'Ngoài phạm vi GPS', variant: 'red' },
  UNBOUND_DEVICE: { label: 'Thiết bị lạ', variant: 'red' },
};

export default function FraudLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportApi.getFraudLogs()
      .then(({ data }) => setLogs(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert size={24} /> Log gian lận
          </h1>
          <p className="text-white/60 text-sm mt-1">Các lần check-in bị hệ thống chặn</p>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : logs.length === 0 ? (
          <div className="card p-16 text-center">
            <ShieldAlert size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Chưa có log gian lận</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Sinh viên</th>
                    <th>Sự kiện</th>
                    <th>Lý do</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const reason = REASON_MAP[log.reason] || { label: log.reason, variant: 'gray' };
                    return (
                      <tr key={log.id}>
                        <td className="text-xs text-gray-500 whitespace-nowrap">
                          <Clock size={11} className="inline mr-1" />
                          {format(new Date(log.createdAt), 'dd/MM HH:mm:ss')}
                        </td>
                        <td>
                          <p className="text-sm font-medium text-gray-900">{log.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{log.user?.mssv || '—'}</p>
                        </td>
                        <td className="text-sm text-gray-600 max-w-xs truncate">
                          {log.event?.name || '—'}
                        </td>
                        <td><Badge variant={reason.variant}>{reason.label}</Badge></td>
                        <td className="text-xs text-gray-400">
                          {log.metadata?.distance && (
                            <span className="flex items-center gap-1"><MapPin size={11} />{log.metadata.distance}m</span>
                          )}
                          {log.deviceId && (
                            <span className="flex items-center gap-1"><Smartphone size={11} />Device ID</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
