import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleCheck, Clock, Lock, MapPin, RotateCw, TriangleAlert, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { publicCheckinApi } from '../../../services/api';
import Button from '../../../components/ui/Button';
import Logo from '../../../components/ui/Logo';
import { Banner, Skeleton } from '../../../components/ui/States';
import { getCurrentPosition, GPS_ERROR_MESSAGES } from '../../../utils/gps';
import { cx } from '../../../utils/cx';
import PublicFormFields, { emptyFormValue, formValueError } from './PublicFormFields';

// Trang người ghé thăm mở sau khi quét QR cố định của sự kiện check-in công khai
// (/check-in/:id) — không cần tài khoản. Điền form BTC dựng → màn cảm ơn.
// Máy vừa check-in thì lần sau mở lại thấy ngay kết quả (lưu ở máy), kèm nút
// "Check-in cho người khác" cho trường hợp nhiều người dùng chung một điện thoại.
// Spec: docs/superpowers/specs/2026-10-16-public-checkin-design.md

const doneKey = (id) => `public-checkin:${id}`;
function readDone(id) {
  try { return JSON.parse(localStorage.getItem(doneKey(id)) || 'null'); } catch { return null; }
}
function saveDone(id, done) {
  try { localStorage.setItem(doneKey(id), JSON.stringify(done)); } catch { /* chế độ riêng tư — bỏ qua */ }
}

function Card({ icon: Icon, tone, title, children }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 text-center">
      <span className={cx('mx-auto flex size-14 items-center justify-center rounded-full', tone)}>
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-balance text-xl font-semibold text-foreground">{title}</h1>
      {children}
    </div>
  );
}

export default function PublicCheckin() {
  const { id } = useParams();
  const [page, setPage] = useState(null);
  const [loadError, setLoadError] = useState(null); // NOT_FOUND | UNKNOWN
  const [form, setForm] = useState(emptyFormValue);
  const [stage, setStage] = useState('form'); // form | locating | sending | done | duplicate
  const [error, setError] = useState(null);
  const [done, setDone] = useState(() => readDone(id));
  const [showForm, setShowForm] = useState(() => !readDone(id));

  const load = useCallback(() => {
    setLoadError(null);
    publicCheckinApi.getPage(id)
      .then(({ data }) => setPage(data.data))
      .catch((err) => setLoadError(err.response?.status === 404 ? 'NOT_FOUND' : 'UNKNOWN'));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const invalid = formValueError(page.fields, form);
    if (invalid) { setError(invalid); return; }

    let gps = null;
    if (page.gpsEnabled) {
      setStage('locating');
      try {
        gps = await getCurrentPosition();
      } catch (err) {
        setStage('form');
        setError(GPS_ERROR_MESSAGES[err.message] || 'Không lấy được vị trí. Vui lòng bật GPS rồi thử lại.');
        return;
      }
    }

    setStage('sending');
    try {
      const { data } = await publicCheckinApi.submit(id, { ...form, gps });
      const result = { ...data.data, at: data.data.checkedInAt };
      saveDone(id, result);
      setDone(result);
      setShowForm(false);
      setForm(emptyFormValue());
      setStage('done');
    } catch (err) {
      const body = err.response?.data;
      if (body?.error === 'ALREADY_CHECKED_IN') {
        setStage('duplicate');
        setError(body.message);
        return;
      }
      setStage('form');
      if (['ATTENDANCE_CLOSED', 'OUTSIDE_TIME_WINDOW', 'ATTENDANCE_NOT_OPEN'].includes(body?.error)) load();
      setError(body?.message || 'Không gửi được. Kiểm tra kết nối mạng rồi thử lại.');
    }
  };

  const busy = stage === 'locating' || stage === 'sending';
  const anotherPerson = () => { setShowForm(true); setStage('form'); setError(null); };

  let content;
  if (loadError) {
    content = (
      <Card
        icon={TriangleAlert}
        tone="bg-error-bg text-error-strong"
        title={loadError === 'NOT_FOUND' ? 'Không tìm thấy sự kiện' : 'Không tải được trang check-in'}
      >
        <p className="mt-2 text-pretty text-sm text-muted">
          {loadError === 'NOT_FOUND' ? 'Sự kiện có thể đã kết thúc hoặc mã QR không đúng.' : 'Kiểm tra kết nối mạng rồi thử lại.'}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {loadError !== 'NOT_FOUND' && <Button variant="primary" size="auth" icon={RotateCw} onClick={load}>Thử lại</Button>}
          <Button as={Link} to="/" size="auth">Về trang chủ</Button>
        </div>
      </Card>
    );
  } else if (!page) {
    content = (
      <div className="space-y-4 rounded-3xl border border-border bg-surface p-6" aria-busy="true">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    );
  } else if (!showForm && done) {
    content = (
      <Card icon={CircleCheck} tone="bg-success-bg text-success" title={stage === 'done' ? 'Check-in thành công' : 'Bạn đã check-in'}>
        <p className="mt-1 text-lg font-semibold text-foreground">{done.name}</p>
        {done.at && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums text-muted">
            <Clock className="size-4" aria-hidden="true" /> {format(new Date(done.at), 'HH:mm · dd/MM/yyyy')}
          </p>
        )}
        {done.thankYou && <p className="mt-4 whitespace-pre-line text-pretty rounded-2xl bg-background p-4 text-sm text-foreground">{done.thankYou}</p>}
        <Button size="auth" icon={UserPlus} onClick={anotherPerson} className="mt-5 w-full">Check-in cho người khác</Button>
      </Card>
    );
  } else if (!page.gate.open) {
    content = (
      <Card icon={Lock} tone="bg-background text-muted" title="Check-in đang đóng">
        <p className="mt-2 text-pretty text-sm text-muted">{page.gate.message}</p>
        <Button size="auth" icon={RotateCw} onClick={load} className="mt-5 w-full">Thử lại</Button>
      </Card>
    );
  } else if (stage === 'duplicate') {
    content = (
      <Card icon={TriangleAlert} tone="bg-warning-bg text-warning" title="Thông tin này đã check-in">
        <p className="mt-2 text-pretty text-sm text-muted">{error}</p>
        <Button size="auth" onClick={() => { setStage('form'); setError(null); }} className="mt-5 w-full">Sửa thông tin</Button>
      </Card>
    );
  } else {
    content = (
      <form onSubmit={submit} className="rounded-3xl border border-border bg-surface p-6">
        <h1 className="text-balance text-xl font-semibold text-foreground">{page.event.name}</h1>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {page.event.location}
        </p>
        {page.event.description && <p className="mt-3 whitespace-pre-line text-pretty text-sm text-muted">{page.event.description}</p>}

        <div className="mt-6">
          <PublicFormFields fields={page.fields} value={form} onChange={setForm} disabled={busy} />
        </div>

        {(page.uniqueLabels.length > 0 || page.gpsEnabled) && (
          <ul className="mt-5 space-y-1 text-pretty text-xs text-muted">
            {page.uniqueLabels.length > 0 && <li>Mỗi người chỉ check-in một lần (không dùng trùng {page.uniqueLabels.join(', ')}).</li>}
            {page.gpsEnabled && <li>Cần cho phép truy cập vị trí — bạn phải đang ở địa điểm sự kiện.</li>}
          </ul>
        )}

        {error && <Banner tone="error" compact className="mt-4">{error}</Banner>}

        <Button type="submit" variant="primary" size="auth" loading={busy} className="mt-5 w-full">
          {stage === 'locating' ? 'Đang lấy vị trí…' : 'Check-in'}
        </Button>
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted">
          <Logo className="size-6" />
          <span>Check-in · FPT Event</span>
        </div>
        {content}
      </div>
    </div>
  );
}
