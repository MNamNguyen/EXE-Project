import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapPin, Wifi, CheckCircle2, XCircle, Lock, QrCode, Clock, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { checkinApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentPosition, GPS_ERROR_MESSAGES } from '../../utils/gps';
import Spinner from '../../components/ui/Spinner';

const STAGES = {
  INIT: 'init',
  GPS: 'gps',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

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
  const [gpsStatus, setGpsStatus] = useState(null);

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
    if (!user) {
      // Per BRD CK-02: not logged in → redirect to login, then redirect back here
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    processCheckin();
  }, [user, authLoading]);

  const processCheckin = async () => {
    setStage(STAGES.GPS);
    let gps = null;

    try {
      setGpsStatus('getting');
      gps = await getCurrentPosition();
      setGpsStatus('ok');
    } catch (err) {
      setGpsStatus('error');
      const msg = GPS_ERROR_MESSAGES[err.message] || 'Không lấy được GPS';
      // If GPS denied, still try to proceed (server will decide based on event settings)
      if (err.message !== 'GPS_DENIED') {
        gps = null;
      }
    }

    setStage(STAGES.PROCESSING);

    try {
      const { data } = await checkinApi.process({ eventId, token, type, gps });
      setResult(data);
      setStage(STAGES.SUCCESS);
    } catch (err) {
      const errData = err.response?.data;
      setErrorInfo({
        title: getErrorTitle(errData?.error),
        message: errData?.message || 'Có lỗi xảy ra. Vui lòng thử lại.',
        error: errData?.error,
        extra: errData,
      });
      setStage(STAGES.ERROR);
    }
  };

  const getErrorTitle = (code) => {
    const map = {
      QR_EXPIRED: 'Mã QR hết hạn',
      OUT_OF_RANGE: 'Ngoài phạm vi',
      GPS_REQUIRED: 'Cần bật GPS',
      ALREADY_CHECKED_IN: 'Đã check-in',
      ALREADY_CHECKED_OUT: 'Đã check-out',
      NOT_CHECKED_IN: 'Chưa check-in',
      OUTSIDE_TIME_WINDOW: 'Ngoài giờ',
      DEVICE_NOT_BOUND: 'Thiết bị chưa xác thực',
    };
    return map[code] || 'Không thể check-in';
  };

  const isCheckin = type === 'checkin';
  const accentColor = isCheckin ? 'primary' : 'emerald';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${
      isCheckin ? 'bg-gradient-to-br from-primary-50 to-white' : 'bg-gradient-to-br from-emerald-50 to-white'
    }`}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
            isCheckin ? 'bg-gradient-brand' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
          } shadow-lg`}>
            <QrCode size={32} className="text-white" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {isCheckin ? 'Điểm danh vào' : 'Điểm danh ra'} · FPT Event
          </p>
        </div>

        {/* Stage: GPS */}
        {stage === STAGES.GPS && (
          <div className="card p-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <MapPin size={28} className="text-primary-600 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Đang lấy vị trí GPS</h2>
            <p className="text-sm text-gray-500">Vui lòng cho phép truy cập vị trí khi được hỏi</p>
            <div className="flex justify-center mt-4">
              <Spinner size="lg" />
            </div>
          </div>
        )}

        {/* Stage: Processing */}
        {stage === STAGES.PROCESSING && (
          <div className="card p-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <Wifi size={28} className="text-primary-600 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Đang xử lý...</h2>
            <p className="text-sm text-gray-500">Xác thực và ghi nhận điểm danh</p>
            <div className="flex justify-center mt-4">
              <Spinner size="lg" />
            </div>
          </div>
        )}

        {/* Stage: Success */}
        {stage === STAGES.SUCCESS && result && (
          <div className="card p-8 text-center animate-bounce-in">
            {/* Animated checkmark */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg ${
              isCheckin ? 'bg-gradient-brand' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
            }`}>
              <svg viewBox="0 0 60 60" className="w-12 h-12">
                <circle cx="30" cy="30" r="28" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                <path d="M16 30 L25 40 L44 20" stroke="white" strokeWidth="3.5" fill="none"
                  strokeLinecap="round" strokeLinejoin="round" className="check-path" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {isCheckin ? 'Check-in thành công!' : 'Check-out thành công!'}
            </h2>
            <p className="text-gray-500 text-sm mb-5">
              {result.user?.name} · {result.user?.mssv}
            </p>

            <div className={`rounded-2xl p-4 mb-5 ${isCheckin ? 'bg-primary-50' : 'bg-emerald-50'}`}>
              <p className="text-xs text-gray-500 mb-1">{result.event?.name}</p>
              <p className={`text-3xl font-bold ${isCheckin ? 'text-primary-700' : 'text-emerald-700'}`}>
                {result.timeDisplay}
              </p>
              <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                <Clock size={11} /> {format(new Date(result.time), 'dd/MM/yyyy')}
              </p>
            </div>

            <p className="text-xs text-gray-400">Bạn có thể đóng trang này</p>
          </div>
        )}

        {/* Stage: Error */}
        {stage === STAGES.ERROR && errorInfo && (
          <div className="card p-8 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              {errorInfo.error === 'QR_EXPIRED' ? (
                <Clock size={36} className="text-red-500" />
              ) : errorInfo.error === 'OUT_OF_RANGE' ? (
                <MapPin size={36} className="text-red-500" />
              ) : errorInfo.error?.includes('ALREADY') ? (
                <CheckCircle2 size={36} className="text-amber-500" />
              ) : (
                <XCircle size={36} className="text-red-500" />
              )}
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">{errorInfo.title}</h2>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">{errorInfo.message}</p>

            {errorInfo.error === 'QR_EXPIRED' && (
              <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                <Lightbulb size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">Quét lại mã QR mới trên màn hình sự kiện</p>
              </div>
            )}

            {errorInfo.error === 'OUT_OF_RANGE' && errorInfo.extra?.distance && (
              <div className="bg-red-50 rounded-xl p-3 mb-4">
                <p className="text-xs text-red-700">
                  Khoảng cách hiện tại: <strong>{errorInfo.extra.distance}m</strong>
                  <br />Yêu cầu trong vòng: <strong>{errorInfo.extra.requiredRadius}m</strong>
                </p>
              </div>
            )}

            {errorInfo.error === 'GPS_REQUIRED' && (
              <div className="bg-blue-50 rounded-xl p-3 mb-4 text-left">
                <p className="text-xs text-blue-700 font-medium mb-1">Cách bật GPS:</p>
                <p className="text-xs text-blue-600">1. Vào Cài đặt → Quyền riêng tư → Vị trí</p>
                <p className="text-xs text-blue-600">2. Cho phép trình duyệt truy cập vị trí</p>
                <p className="text-xs text-blue-600">3. Quét lại mã QR</p>
              </div>
            )}

            {!errorInfo.error?.includes('ALREADY') && (
              <button onClick={processCheckin} className="btn-primary btn-md btn-full">
                Thử lại
              </button>
            )}
          </div>
        )}

        {/* User info */}
        {user && stage !== STAGES.SUCCESS && stage !== STAGES.ERROR && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Lock size={11} />
            <span>Đăng nhập với tài khoản <strong>{user.name}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
