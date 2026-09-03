import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarDays, MapPin, Clock, Users, User, Mail, IdCard, Phone,
  ChevronLeft, CheckCircle2, AlertCircle, Info, LogIn, GraduationCap,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { publicApi, eventApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';

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

  if (loading || authLoading) {
    return <Shell><div className="flex justify-center py-20"><Spinner size="xl" /></div></Shell>;
  }

  if (notFound || !event) {
    return (
      <Shell>
        <div className="card p-12 text-center max-w-lg mx-auto">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Không tìm thấy sự kiện</p>
          <p className="text-sm text-gray-400 mt-1">Link có thể đã hết hạn hoặc sự kiện đã bị gỡ.</p>
          <Link to="/dang-ky" className="btn-primary btn-md mt-5 inline-flex">Xem sự kiện khác</Link>
        </div>
      </Shell>
    );
  }

  if (result) {
    return <Shell><SuccessCard event={event} result={result} loggedIn={Boolean(user)} /></Shell>;
  }

  return (
    <Shell>
      <div className="max-w-lg mx-auto space-y-5">
        <EventSummary event={event} />

        {event.registrationClosed ? (
          <div className="card p-8 text-center">
            <AlertCircle size={36} className="text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Sự kiện đã đóng đăng ký</p>
            <p className="text-sm text-gray-400 mt-1">
              Ban tổ chức không còn nhận đăng ký trực tuyến cho sự kiện này.
            </p>
            <Link to="/dang-ky" className="btn-secondary btn-md mt-5 inline-flex">Xem sự kiện khác</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <h2 className="font-bold text-gray-900">Thông tin đăng ký</h2>
              <p className="text-xs text-gray-400 mt-1">
                {user
                  ? 'Bạn đang đăng nhập — hệ thống dùng thông tin tài khoản của bạn.'
                  : 'Chưa có tài khoản? Hệ thống sẽ tự tạo và gửi mật khẩu tạm qua email.'}
              </p>
            </div>

            <Field icon={User} label="Họ và tên" required>
              <input
                className="input pl-11" placeholder="VD: Nguyễn Văn A" autoComplete="name"
                value={form.name} disabled={Boolean(user)}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>

            <Field icon={IdCard} label="Mã số sinh viên" required>
              <input
                className="input pl-11" placeholder="VD: SE170001" autoComplete="off"
                value={form.mssv} disabled={Boolean(user?.mssv)}
                onChange={(e) => set('mssv', e.target.value)}
              />
            </Field>

            <Field icon={Mail} label="Email" required>
              <input
                className="input pl-11" type="email" placeholder="VD: an@fpt.edu.vn" autoComplete="email"
                value={form.email} disabled={Boolean(user)}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>

            {!user && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field icon={GraduationCap} label="Lớp">
                  <input
                    className="input pl-11" placeholder="VD: SE1701"
                    value={form.class} onChange={(e) => set('class', e.target.value)}
                  />
                </Field>
                <Field icon={Phone} label="Số điện thoại">
                  <input
                    className="input pl-11" placeholder="VD: 0901234567" autoComplete="tel"
                    value={form.phone} onChange={(e) => set('phone', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary btn-lg btn-full">
              {submitting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              {submitting ? 'Đang đăng ký...' : 'Xác nhận đăng ký'}
            </button>

            {!user && (
              <p className="text-xs text-center text-gray-400">
                Đã có tài khoản?{' '}
                <Link to={`/login?redirect=/dang-ky/${event.id}`} className="text-primary-600 font-medium hover:underline">
                  Đăng nhập để đăng ký nhanh
                </Link>
              </p>
            )}
          </form>
        )}
      </div>
    </Shell>
  );
}

/* ─────────────────────────────────────── */

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="logo" className="w-8 h-8" />
            <span className="font-bold text-gray-900">FPT Event</span>
          </Link>
          <Link to="/dang-ky" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
            <ChevronLeft size={14} /> Sự kiện khác
          </Link>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-5 py-8">{children}</div>
    </div>
  );
}

function Field({ icon: Icon, label, required, children }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

function EventSummary({ event }) {
  const start = new Date(event.checkinOpen);
  const end = new Date(event.checkinClose);

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-brand px-6 py-5">
        <h1 className="text-xl font-bold text-white leading-snug">{event.name}</h1>
        {event.createdBy?.name && (
          <p className="text-white/70 text-xs mt-1">Tổ chức bởi {event.createdBy.name}</p>
        )}
      </div>
      <div className="p-6 space-y-3">
        {event.description && (
          <p className="text-sm text-gray-500 leading-relaxed">{event.description}</p>
        )}
        <InfoRow icon={MapPin} label="Địa điểm" value={event.location} />
        <InfoRow icon={CalendarDays} label="Ngày" value={format(start, 'EEEE, dd/MM/yyyy', { locale: vi })} />
        <InfoRow icon={Clock} label="Check-in" value={`${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`} />
        <InfoRow icon={Users} label="Đã đăng ký" value={`${event._count?.eventMembers ?? 0} người`} />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-primary-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-sm text-gray-700 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function SuccessCard({ event, result, loggedIn }) {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={34} className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {result.alreadyRegistered ? 'Bạn đã đăng ký rồi' : 'Đăng ký thành công!'}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {result.alreadyRegistered
            ? 'Tên bạn đã có sẵn trong danh sách tham gia sự kiện này.'
            : 'Tên bạn đã được thêm vào danh sách tham gia sự kiện.'}
        </p>

        <div className="bg-surface rounded-xl p-4 mt-5 text-left space-y-1">
          <p className="text-sm font-semibold text-gray-900">{event.name}</p>
          <p className="text-xs text-gray-500">{event.location}</p>
          <p className="text-xs text-gray-500">
            {format(new Date(event.checkinOpen), "HH:mm 'ngày' dd/MM/yyyy")}
          </p>
          <p className="text-xs text-gray-400 pt-1">Người tham dự: {result.name} · {result.email}</p>
        </div>

        {result.isNewAccount && (
          <div className="flex items-start gap-2.5 bg-primary-50 border border-primary-200 rounded-xl p-4 mt-4 text-left">
            <Info size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary-800 leading-relaxed">
              Hệ thống đã tạo tài khoản mới cho bạn. Mật khẩu tạm đã được gửi tới{' '}
              <strong>{result.email}</strong> — hãy đăng nhập và đổi mật khẩu trước ngày sự kiện.
            </p>
          </div>
        )}

        {result.emailSent === false && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 text-left">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Đăng ký đã được ghi nhận nhưng hệ thống chưa gửi được email xác nhận.
              Vui lòng liên hệ Ban tổ chức để nhận thông tin đăng nhập.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-5">
          Đến ngày sự kiện, đăng nhập và quét mã QR tại cửa vào để điểm danh.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link to="/dang-ky" className="btn-secondary btn-md flex-1">Đăng ký sự kiện khác</Link>
          <Link to={loggedIn ? '/dashboard' : '/login'} className="btn-primary btn-md flex-1">
            <LogIn size={15} /> {loggedIn ? 'Về trang chính' : 'Đăng nhập'}
          </Link>
        </div>
      </div>
    </div>
  );
}
