import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { reportApi } from '../services/api';
import Layout from '../components/layout/Layout';
import { FraudBadge } from '../components/ui/Badge';
import { TableCard, Th } from '../components/ui/Card';
import { EmptyText, LoadError, SkeletonRows } from '../components/ui/States';
import { cx } from '../utils/cx';

// Chi tiết của một lần chặn: khoảng cách GPS hoặc thiết bị lạ
function detailOf(log) {
  if (log.metadata?.distance) return `${log.metadata.distance} m`;
  if (log.deviceId) return 'Thiết bị lạ';
  return '';
}

export default function FraudLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    reportApi.getFraudLogs()
      .then(({ data }) => setLogs(data.data || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  let body;
  if (loading) body = <SkeletonRows rows={6} />;
  else if (loadError) body = <LoadError title="Không tải được log gian lận" onRetry={load} />;
  else if (logs.length === 0) body = <EmptyText className="py-10">Chưa có lần check-in nào bị chặn.</EmptyText>;
  else {
    body = (
      <>
        <table className="hidden w-full text-sm md:table">
          <thead className="border-b border-border">
            <tr>
              <Th>Thời gian</Th>
              <Th>Sinh viên</Th>
              <Th className="w-full">Sự kiện</Th>
              <Th>Lý do</Th>
              <Th>Chi tiết</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const detail = detailOf(log);
              return (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground">{format(new Date(log.createdAt), 'HH:mm:ss · dd/MM')}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {log.user?.name ? (
                      <>
                        <p className="font-medium text-foreground">{log.user.name}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted">{log.user.mssv || '—'}</p>
                      </>
                    ) : <p className="text-muted">Không rõ</p>}
                  </td>
                  <td className="max-w-0 px-4 py-3">
                    <p className="truncate text-foreground" title={log.event?.name || ''}>{log.event?.name || '—'}</p>
                  </td>
                  <td className="px-4 py-3"><FraudBadge reason={log.reason} /></td>
                  <td className={cx('whitespace-nowrap px-4 py-3 tabular-nums', detail ? 'text-foreground' : 'text-muted')}>{detail || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ul className="divide-y divide-border md:hidden">
          {logs.map((log) => {
            const detail = detailOf(log);
            return (
              <li key={log.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{log.user?.name || 'Không rõ'}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">{format(new Date(log.createdAt), 'HH:mm:ss · dd/MM')}</p>
                  </div>
                  <FraudBadge reason={log.reason} />
                </div>
                <p className="mt-1 line-clamp-2 text-pretty text-xs text-muted">
                  {log.event?.name || '—'}{detail ? ` · ${detail}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-4 py-3">
          <p className="text-sm text-muted">{logs.length} lần chặn gần nhất</p>
        </div>
      </>
    );
  }

  return (
    <Layout title="Log gian lận">
      <TableCard>{body}</TableCard>
    </Layout>
  );
}
