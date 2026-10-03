import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowDown, CircleCheck, CircleX, Clock, LoaderCircle, Lock, MapPin, MapPinOff, RotateCw, Wifi,
} from 'lucide-react';
import { format } from 'date-fns';
import { checkinApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentPosition } from '../../utils/gps';
import Button from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { cx } from '../../utils/cx';
import FeedbackResponseForm from '../feedback/FeedbackResponseForm';

// Vé quét được giữ qua vòng chuyển hướng sang trang đăng nhập, nên dùng
// sessionStorage (sống theo tab, tự mất khi đóng) chứ không phải state.
const TICKET_KEY = 'fpt_scan_ticket';

function readStoredTicket(eventId, type) {
  try {
    const raw = sessionStorage.getItem(TICKET_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const stillValid = saved.eventId === eventId && saved.type === type && saved.expiresAt > Date.now();
    return stillValid ? saved.ticket : null;
  } catch {
    return null;
  }
}

function storeTicket(eventId, type, ticket, expiresAt) {
  try {
    sessionStorage.setItem(TICKET_KEY, JSON.stringify({ eventId, type, ticket, expiresAt }));
  } catch {
    // Chế độ riêng tư chặn sessionStorage — vẫn còn token QR gốc để thử.
  }
}

function clearStoredTicket() {
  try {
    sessionStorage.removeItem(TICKET_KEY);
  } catch {
    // không sao
  }
}

const STAGES = {
  INIT: 'init',
  GPS: 'gps',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

// Icon và tông cho từng mã lỗi: thất bại thì đỏ, "đã làm rồi" thì xanh thông tin
function errorLook(code) {
  if (code?.includes('ALREADY')) return { icon: CircleCheck, tone: 'bg-info-bg text-info' };
  if (code === 'QR_EXPIRED') return { icon: Clock, tone: 'bg-error-bg text-error-text' };
  if (code === 'OUT_OF_RANGE') return { icon: MapPinOff, tone: 'bg-error-bg text-error-text' };
  if (code === 'GPS_REQUIRED') return { icon: MapPin, tone: 'bg-warning-bg text-warning' };
  return { icon: CircleX, tone: 'bg-error-bg text-error-text' };
}

// Khung kết quả: một icon tròn, một tiêu đề, một câu; phần thêm (giờ, khoảng cách, nút) bên dưới
function ResultCard({ icon: Icon, tone, title, sub, spin = false, children }) {
  return (
    <section className="rounded-2xl bg-surface p-6 text-center">
      <div className={cx('mx-auto flex size-16 items-center justify-center rounded-full', tone)}>
        <Icon className="size-8" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
      {sub && <p className="mt-1 text-pretty text-sm text-muted">{sub}</p>}
      {spin && (
        <div className="mt-6 flex justify-center text-muted">
          <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          <span className="sr-only" role="status">Đang xử lý</span>
        </div>
      )}
      {children}
    </section>
  );
}

export default function ScanLanding() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const eventId = params.get('e');
  const token = params.get('t');
  const type = params.get('type') || 'checkin';

  const [stage, setStage] = useState(STAGES.INIT);
  const [result, setResult] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [, setGpsStatus] = useState(null);

  useEffect(() => {
    // Wait until AuthContext has resolved token from localStorage.
    // Without this guard, user=null during the brief loading window causes a
    // premature redirect to /login even when the student is already logged in,
    // breaking the post-login redirect back to the scan page.
    if (authLoading) return;

    if (!eventId || !token) {
      setStage(STAGES.ERROR);
      setErrorInfo({ title: 'Mã QR không hợp lệ', message: 'Link không đúng định dạng. Vui lòng quét lại mã QR.' });
      return;
    }
    bootstrap();
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đổi token QR lấy vé quét TRƯỚC khi làm bất cứ việc gì tốn thời gian (đăng
  // nhập, xin quyền GPS). Mã QR chỉ sống ~90s tính từ lúc màn hình sinh ra nó;
  // đổi sang vé 15 phút làm đồng hồ chạy từ lúc quét, nên sinh viên đăng nhập
  // bằng OTP mất vài phút vẫn không phải quay ra quét lại.
  const bootstrap = async () => {
    let activeTicket = readStoredTicket(eventId, type);

    if (!activeTicket) {
      try {
        const { data } = await checkinApi.issueTicket({ eventId, token, type });
        activeTicket = data.ticket;
        storeTicket(eventId, type, data.ticket, data.expiresAt);
      } catch {
        // Không đổi được vé (mất mạng, mã đã hết hạn sẵn) → vẫn thử bằng chính
        // token QR như trước đây, backend chấp nhận cả hai.
      }
    }

    if (!user) {
      // Per BRD CK-02: not logged in → redirect to login, then redirect back here.
      // Vé đã nằm trong sessionStorage nên quay lại đây vẫn dùng được dù token
      // trên URL lúc đó đã hết hạn.
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    processCheckin(activeTicket);
  };

  const processCheckin = async (activeTicket) => {
    setStage(STAGES.GPS);
    let gps = null;

    try {
      setGpsStatus('getting');
      gps = await getCurrentPosition();
      setGpsStatus('ok');
    } catch (err) {
      setGpsStatus('error');
      // If GPS denied, still try to proceed (server will decide based on event settings)
      if (err.message !== 'GPS_DENIED') {
        gps = null;
      }
    }

    setStage(STAGES.PROCESSING);

    try {
      const { data } = await checkinApi.process({ eventId, token, ticket: activeTicket, type, gps });
      clearStoredTicket();
      setResult(data);
      setStage(STAGES.SUCCESS);
    } catch (err) {
      const errData = err.response?.data;
      // Vé hết hạn thì phải bỏ đi, nếu không lần quét mã mới vẫn lôi vé cũ ra dùng.
      if (errData?.error === 'QR_EXPIRED') clearStoredTicket();
      setErrorInfo({
        title: getErrorTitle(errData?.error),
        message: errData?.message || 'Có lỗi xảy ra. Vui lòng thử lại.',
        error: errData?.error,
        extra: errData,
      });
      setStage(STAGES.ERROR);
    }
  };

  // Thử lại dùng vé đang còn trong phiên (nếu có), như lần quét đầu
  const retry = () => processCheckin(readStoredTicket(eventId, type));

  const getErrorTitle = (code) => {
    const map = {
      QR_EXPIRED: 'Mã QR hết hạn',
      OUT_OF_RANGE: 'Ngoài phạm vi',
      GPS_REQUIRED: 'Cần bật GPS',
      ALREADY_CHECKED_IN: 'Đã check-in',
      ALREADY_CHECKED_OUT: 'Đã check-out',
      NOT_CHECKED_IN: 'Chưa check-in',
      OUTSIDE_TIME_WINDOW: 'Ngoài giờ',
      ATTENDANCE_NOT_OPEN: 'Chưa mở điểm danh',
      ATTENDANCE_CLOSED: 'Đã đóng điểm danh',
      DEVICE_NOT_BOUND: 'Thiết bị chưa xác thực',
      NOT_REGISTERED: 'Chưa đăng ký tham gia',
    };
    return map[code] || 'Không thể check-in';
  };

  // Check-out xong (hoặc quét lại khi đã check-out) mà sự kiện đang mở form đánh
  // giá và mình chưa gửi → hiện form ngay dưới kết quả, không bắt tìm link.
  const feedbackPrompt = stage === STAGES.SUCCESS
    ? result?.feedback
    : stage === STAGES.ERROR && errorInfo?.error === 'ALREADY_CHECKED_OUT'
      ? errorInfo.extra?.feedback
      : null;
  const showFeedback = !!feedbackPrompt && !feedbackPrompt.submitted;

  const feedbackRef = useRef(null);
  useEffect(() => {
    if (!showFeedback) return undefined;
    // Cho sinh viên kịp thấy dấu tích "thành công" rồi mới cuộn xuống form.
    const timer = setTimeout(() => {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1200);
    return () => clearTimeout(timer);
  }, [showFeedback]);

  const isCheckin = type === 'checkin';
  const look = errorLook(errorInfo?.error);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted">
          <Logo className="size-6" />
          <span>{isCheckin ? 'Điểm danh vào' : 'Điểm danh ra'} · FPT Event</span>
        </div>

        {stage === STAGES.GPS && (
          <ResultCard icon={MapPin} tone="bg-info-bg text-info" title="Đang lấy vị trí GPS" sub="Cho phép truy cập vị trí khi trình duyệt hỏi." spin />
        )}

        {stage === STAGES.PROCESSING && (
          <ResultCard icon={Wifi} tone="bg-info-bg text-info" title="Đang xử lý..." sub="Xác thực và ghi nhận điểm danh" spin />
        )}

        {stage === STAGES.SUCCESS && result && (
          <ResultCard
            icon={CircleCheck}
            tone="bg-success-bg text-success"
            title={isCheckin ? 'Check-in thành công' : 'Check-out thành công'}
            sub={[result.user?.name, result.user?.mssv].filter(Boolean).join(' · ')}
          >
            <div className="mt-5 rounded-xl bg-background p-4 text-left">
              <p className="text-pretty text-sm font-medium text-foreground">{result.event?.name}</p>
              <p className="mt-1 text-sm tabular-nums text-muted">
                {[result.timeDisplay, result.time && format(new Date(result.time), 'dd/MM/yyyy'), result.event?.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            {showFeedback ? (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
                <ArrowDown className="size-4" aria-hidden="true" /> Dành 1 phút đánh giá sự kiện bên dưới
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">Bạn có thể đóng trang này.</p>
            )}
          </ResultCard>
        )}

        {stage === STAGES.ERROR && errorInfo && (
          <ResultCard icon={look.icon} tone={look.tone} title={errorInfo.title} sub={errorInfo.message}>
            {errorInfo.error === 'OUT_OF_RANGE' && errorInfo.extra?.distance && (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-left">
                  <div className="bg-surface p-3">
                    <dt className="text-xs text-muted">Cách địa điểm</dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{errorInfo.extra.distance} m</dd>
                  </div>
                  <div className="bg-surface p-3">
                    <dt className="text-xs text-muted">Cho phép trong</dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{errorInfo.extra.requiredRadius} m</dd>
                  </div>
                </dl>
                <p className="mt-4 text-pretty text-sm text-muted">Đi lại gần cửa vào rồi bấm Thử lại. Mã QR đã quét còn dùng được 15 phút.</p>
              </>
            )}

            {errorInfo.error === 'QR_EXPIRED' && (
              <p className="mt-4 text-pretty text-sm text-muted">Quét lại mã QR mới trên màn hình sự kiện.</p>
            )}

            {errorInfo.error === 'GPS_REQUIRED' && (
              <div className="mt-5 rounded-xl bg-background p-4 text-left text-sm">
                <p className="font-medium text-foreground">Cách bật GPS</p>
                <ol className="mt-1 list-inside list-decimal space-y-0.5 text-muted">
                  <li>Vào Cài đặt → Quyền riêng tư → Vị trí</li>
                  <li>Cho phép trình duyệt truy cập vị trí</li>
                  <li>Quét lại mã QR</li>
                </ol>
              </div>
            )}

            {showFeedback && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
                <ArrowDown className="size-4" aria-hidden="true" /> Bạn chưa đánh giá sự kiện — form ở bên dưới
              </p>
            )}

            {!errorInfo.error?.includes('ALREADY') && (
              <div className="mt-5">
                <Button size="auth" icon={RotateCw} onClick={retry} className="w-full">Thử lại</Button>
              </div>
            )}
          </ResultCard>
        )}

        {/* Form đánh giá ngay sau check-out */}
        {showFeedback && (
          <div ref={feedbackRef} className="mt-4 scroll-mt-4">
            <FeedbackResponseForm eventId={eventId} showTitle />
          </div>
        )}

        {user && stage !== STAGES.SUCCESS && stage !== STAGES.ERROR && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" aria-hidden="true" />
            Đăng nhập với tài khoản <span className="font-medium text-foreground">{user.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
