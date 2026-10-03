import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, CircleCheck, Info, LogIn } from 'lucide-react';
import { format } from 'date-fns';
import { publicApi, eventApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Input';
import { Banner, Skeleton } from '../../components/ui/States';
import { formatNumber, longDate } from '../../utils/eventStatus';
import PublicHeader from './PublicHeader';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EventRegister() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({ name: '', mssv: '', email: '', phone: '', class: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    publicApi.getEvent(id)
      .then(({ data }) => setEvent(data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Đã đăng nhập → điền sẵn thông tin tài khoản, người dùng không phải gõ lại.
  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, name: user.name || '', mssv: user.mssv || '', email: user.email || '' }));
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      if (form.name.trim().length < 2) return setError('Vui lòng nhập họ tên hợp lệ');
      if (!form.mssv.trim()) return setError('Vui lòng nhập mã số sinh viên');
      if (!EMAIL_RE.test(form.email.trim())) return setError('Email không hợp lệ');
    }

    setSubmitting(true);
    try {
      // Đã đăng nhập thì đăng ký bằng chính tài khoản đó, tránh lệch email/MSSV.
      const { data } = user
        ? await eventApi.register(id)
        : await publicApi.register(id, form);
      setResult({
        alreadyRegistered: data.alreadyRegistered,
        isNewAccount: data.isNewAccount,
        emailSent: data.emailSent,
        name: data.data?.user?.name || user?.name || form.name,
        email: data.data?.user?.email || user?.email || form.email,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  let body;
  if (loading || authLoading) {
    body = (
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5" aria-busy="true">
        <Skeleton className="h-5 w-3/5" /><Skeleton className="h-3 w-2/5" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-1/3" />
      </div>
    );
  } else if (notFound || !event) {
    body = (
      <div className="mx-auto max-w-md pb-16 pt-12 text-center">
        <h1 className="text-xl font-semibold text-foreground">Không tìm thấy sự kiện</h1>
        <p className="mt-2 text-pretty text-sm/6 text-muted">Link có thể đã hết hạn hoặc sự kiện đã bị gỡ.</p>
        <div className="mt-6"><Button as={Link} to="/dang-ky" variant="primary" size="form">Xem sự kiện khác</Button></div>
      </div>
    );
  } else if (result) {
    body = <SuccessCard event={event} result={result} loggedIn={Boolean(user)} />;
  } else {
    body = (
      <>
        <EventSummary event={event} />
        {event.registrationClosed ? (
          <section className="rounded-2xl border border-border bg-surface p-6 text-center">
            <h2 className="text-base font-semibold text-foreground">Sự kiện đã đóng đăng ký</h2>
            <p className="mt-2 text-pretty text-sm/6 text-muted">Ban tổ chức không còn nhận đăng ký trực tuyến cho sự kiện này.</p>
            <div className="mt-4"><Button as={Link} to="/dang-ky">Xem sự kiện khác</Button></div>
          </section>
        ) : (
          <Card
            title="Thông tin đăng ký"
            sub={user
              ? 'Bạn đang đăng nhập — hệ thống dùng thông tin tài khoản của bạn.'
              : 'Chưa có tài khoản thì hệ thống tự tạo và gửi mật khẩu tạm qua email.'}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Field label="Họ và tên">
                {(fid) => <Input id={fid} autoComplete="name" value={form.name} disabled={Boolean(user)} onChange={(e) => set('name', e.target.value)} />}
              </Field>
              <Field label="Mã số sinh viên">
                {(fid) => <Input id={fid} placeholder="VD: SE170001" autoComplete="off" value={form.mssv} disabled={Boolean(user?.mssv)} onChange={(e) => set('mssv', e.target.value)} />}
              </Field>
              <Field label="Email">
                {(fid) => <Input id={fid} type="email" autoComplete="email" value={form.email} disabled={Boolean(user)} onChange={(e) => set('email', e.target.value)} />}
              </Field>
              {!user && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Lớp" optional>
                    {(fid) => <Input id={fid} placeholder="VD: SE1701" value={form.class} onChange={(e) => set('class', e.target.value)} />}
                  </Field>
                  <Field label="Số điện thoại" optional>
                    {(fid) => <Input id={fid} type="tel" placeholder="0901 234 567" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
                  </Field>
                </div>
              )}
              {error && <Banner tone="error" compact>{error}</Banner>}
              <Button type="submit" variant="primary" size="form" loading={submitting} className="w-full">Xác nhận đăng ký</Button>
              {!user && (
                <p className="text-center text-sm text-muted">
                  {'Đã có tài khoản? '}
                  <Link to={`/login?redirect=/dang-ky/${event.id}`} className="whitespace-nowrap font-medium text-foreground underline-offset-4 hover:underline">
                    Đăng nhập để đăng ký nhanh
                  </Link>
                </p>
              )}
            </form>
          </Card>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        right={(
          <Link to="/dang-ky" className="inline-flex h-10 items-center gap-1 text-sm text-muted outline-none hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden="true" /> Sự kiện khác
          </Link>
        )}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">{body}</main>
    </div>
  );
}

/* ─────────────────────────────────────── */

// Khối nhãn và giá trị: nhãn cột trái 7rem từ sm, dưới sm nhãn nằm trên giá trị
function InfoList({ rows }) {
  return (
    <dl className="space-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 text-pretty font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EventSummary({ event }) {
  const start = event.checkinOpen ? new Date(event.checkinOpen) : null;
  const end = event.checkinClose ? new Date(event.checkinClose) : null;
  const rows = [['Địa điểm', event.location]];
  if (start) {
    rows.push(['Ngày', longDate(event.checkinOpen)]);
    rows.push(['Check-in', end ? `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}` : format(start, 'HH:mm')]);
  } else {
    rows.push(['Thời gian', 'Ban tổ chức sẽ chủ động mở điểm danh']);
  }
  rows.push(['Đã đăng ký', `${formatNumber(event._count?.eventMembers ?? 0)} người`]);

  return (
    <Card title={event.name} titleAs="h1" sub={event.createdBy?.name ? `Tổ chức bởi ${event.createdBy.name}` : undefined}>
      {event.description && <p className="mb-4 whitespace-pre-line text-pretty text-sm text-muted">{event.description}</p>}
      <InfoList rows={rows} />
    </Card>
  );
}

function SuccessCard({ event, result, loggedIn }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success">
        <CircleCheck className="size-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-foreground">
        {result.alreadyRegistered ? 'Bạn đã đăng ký rồi' : 'Đăng ký thành công'}
      </h1>
      <p className="mt-2 text-pretty text-sm/6 text-muted">
        {result.alreadyRegistered
          ? 'Tên bạn đã có sẵn trong danh sách tham gia sự kiện này.'
          : 'Tên bạn đã được thêm vào danh sách tham gia sự kiện.'}
      </p>

      <div className="mt-5 rounded-xl bg-background p-4">
        <InfoList
          rows={[
            ['Sự kiện', event.name],
            ['Thời gian', event.checkinOpen ? format(new Date(event.checkinOpen), "HH:mm 'ngày' dd/MM/yyyy") : 'Ban tổ chức sẽ chủ động mở điểm danh'],
            ['Người tham dự', `${result.name} · ${result.email}`],
          ]}
        />
      </div>

      {result.isNewAccount && (
        <div className="mt-4 flex gap-3 rounded-xl border border-border bg-background p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-pretty text-sm/6 text-foreground">
            Đã tạo tài khoản mới cho bạn, mật khẩu tạm được gửi tới <span className="font-medium">{result.email}</span>.
          </p>
        </div>
      )}

      {result.emailSent === false && (
        <Banner tone="warning" compact className="mt-4">
          Đã ghi nhận đăng ký nhưng chưa gửi được email — liên hệ Ban tổ chức để nhận thông tin đăng nhập.
        </Banner>
      )}

      <p className="mt-4 text-pretty text-sm/6 text-muted">Đến ngày sự kiện, đăng nhập rồi quét mã QR tại cửa vào để điểm danh.</p>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button as={Link} to="/dang-ky" size="form">Đăng ký sự kiện khác</Button>
        <Button as={Link} to={loggedIn ? '/dashboard' : '/login'} variant="primary" size="form" icon={LogIn}>
          {loggedIn ? 'Về trang chính' : 'Đăng nhập'}
        </Button>
      </div>
    </section>
  );
}
