import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, CircleCheck, Download, MapPin, RotateCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { publicInvitationApi } from '../../services/api';
import Button from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { Skeleton } from '../../components/ui/States';
import { longDate } from '../../utils/eventStatus';
import { downloadBlob } from '../certificates/certRender';

// Trang thiệp của khách (/thiep/:code) — mở từ link trong email hoặc khi khách tự quét
// QR trên thiệp. Không cần tài khoản. Mã QR to để đưa cho BTC quét ngay trên điện
// thoại, kèm nút tải thiệp PDF. Mã sai hoặc đã được cấp lại → báo không còn hiệu lực.
export default function InvitationView() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null); // 'NOT_FOUND' | 'UNKNOWN'
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    setError(null);
    publicInvitationApi.getInvitation(code)
      .then(({ data: res }) => setData(res.data))
      .catch((err) => setError(err.response?.status === 404 ? 'NOT_FOUND' : 'UNKNOWN'));
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data: blob } = await publicInvitationApi.invitationPdf(code);
      downloadBlob(blob, `thiep-moi-${data.event.name}.pdf`);
    } catch {
      toast.error('Không tải được thiệp, thử lại sau ít phút');
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    const gone = error === 'NOT_FOUND';
    return (
      <div className="min-h-screen bg-background px-4 pt-24 sm:pt-40">
        <div className="mx-auto max-w-md text-center">
          <div className="flex justify-center"><Logo className="size-10" /></div>
          <h1 className="mt-8 text-xl font-semibold text-foreground">{gone ? 'Thiệp mời không còn hiệu lực' : 'Không tải được thiệp mời'}</h1>
          <p className="mt-2 text-pretty text-sm/6 text-muted">
            {gone ? 'Ban tổ chức có thể đã cấp lại thiệp mới cho bạn. Vui lòng kiểm tra email mới nhất hoặc liên hệ Ban tổ chức.' : 'Vui lòng thử lại sau ít phút.'}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {!gone && <Button variant="primary" size="form" icon={RotateCw} onClick={load}>Thử lại</Button>}
            <Button as={Link} to="/" size="form">Về trang chủ</Button>
          </div>
        </div>
      </div>
    );
  }

  const { guest, event, qrText } = data || {};
  const starts = event?.startsAt ? new Date(event.startsAt) : null;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted">
          <Logo className="size-6" />
          <span>Thiệp mời · FPT Event</span>
        </div>

        <article className="overflow-hidden rounded-3xl border border-border bg-surface">
          {!data ? (
            <div className="space-y-4 p-6" aria-busy="true">
              <Skeleton className="mx-auto h-3 w-24" />
              <Skeleton className="mx-auto h-7 w-3/4" />
              <Skeleton className="mx-auto h-5 w-2/3" />
              <Skeleton className="mx-auto size-56 rounded-2xl" />
            </div>
          ) : (
            <>
              <div className="px-6 pb-5 pt-7 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Trân trọng kính mời</p>
                <h1 className="mt-3 text-balance text-2xl font-semibold text-foreground">{guest.name}</h1>
                <p className="mt-4 text-sm text-muted">tới dự</p>
                <p className="mt-1 text-balance text-lg font-semibold text-foreground">{event.name}</p>
                <dl className="mt-4 space-y-1.5 text-left text-sm">
                  {starts && (
                    <div className="flex items-start gap-2">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                      <dd className="text-foreground">{format(starts, 'HH:mm')} · {longDate(starts)}</dd>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    <dd className="text-pretty text-foreground">{event.location}</dd>
                  </div>
                </dl>
                {event.description && <p className="mt-4 whitespace-pre-line text-pretty text-left text-sm text-muted">{event.description}</p>}
              </div>

              <div className="border-t border-dashed border-border-strong px-6 py-6 text-center">
                {guest.checkedInAt ? (
                  <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-sm font-medium text-success">
                    <CircleCheck className="size-4" aria-hidden="true" /> Đã check-in lúc {format(new Date(guest.checkedInAt), 'HH:mm')}
                  </p>
                ) : (
                  <p className="mb-4 text-pretty text-sm text-muted">Đưa mã này cho Ban tổ chức quét khi tới nơi</p>
                )}
                <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                  <QRCodeSVG value={qrText} size={224} level="M" marginSize={1} title="Mã QR thiệp mời" />
                </div>
                <p className="mt-3 text-pretty text-xs text-muted">Tăng độ sáng màn hình để quét nhanh hơn.</p>
              </div>
            </>
          )}
        </article>

        {data && (
          <Button size="auth" icon={Download} loading={downloading} onClick={handleDownload} className="mt-4 w-full">
            Tải thiệp (PDF)
          </Button>
        )}
      </div>
    </div>
  );
}
