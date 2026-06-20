import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ClipboardCheck, LogOut, CheckCircle2 } from 'lucide-react';
import { eventApi } from '../../services/api';

export default function QRDisplay() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [activeType, setActiveType] = useState('checkin');
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const fetchQR = async () => {
    try {
      const { data: res } = await eventApi.getQR(id);
      setData(res.data);
      setCountdown(res.data.expiresIn);
    } catch {}
  };

  useEffect(() => {
    fetchQR().finally(() => setLoading(false));
    // Refetch every 30s to get fresh token
    const refetchTimer = setInterval(fetchQR, 30000);
    return () => clearInterval(refetchTimer);
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!data) return;
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          fetchQR();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [data]);

  // Keep screen awake
  useEffect(() => {
    let wakeLock = null;
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then((wl) => { wakeLock = wl; }).catch(() => {});
    }
    return () => { if (wakeLock) wakeLock.release(); };
  }, []);

  const isCheckin = activeType === 'checkin';
  const token = isCheckin ? data?.checkinToken : data?.checkoutToken;
  const qrUrl = token ? `${data?.frontendUrl}/scan?e=${data?.eventId}&t=${token}&type=${activeType}` : '';

  const progress = (countdown / 30) * 100;
  const circumference = 2 * Math.PI * 28;
  const strokeDash = (progress / 100) * circumference;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-brand flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-700 ${
      isCheckin ? 'bg-gradient-to-br from-[#0D1B5E] via-[#1A3A8F] to-[#0052D4]' : 'bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#047857]'
    }`}>
      {/* Background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5" />
      </div>

      {/* Tab switcher */}
      <div className="relative z-10 flex bg-white/10 backdrop-blur-sm p-1 rounded-2xl mb-8 gap-1">
        {['checkin', 'checkout'].map((type) => (
          <button key={type} onClick={() => setActiveType(type)}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeType === type ? 'bg-white text-gray-900 shadow-lg' : 'text-white/70 hover:text-white'
            }`}>
            {type === 'checkin'
              ? <span className="flex items-center gap-1.5"><ClipboardCheck size={15} />CHECK-IN</span>
              : <span className="flex items-center gap-1.5"><LogOut size={15} />CHECK-OUT</span>
            }
          </button>
        ))}
      </div>

      {/* Event name */}
      <h1 className="text-white text-xl md:text-2xl font-bold text-center mb-8 relative z-10 max-w-lg">
        {data?.eventName}
      </h1>

      {/* QR Card */}
      <div className="relative z-10 bg-white rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center qr-pulse">
        {qrUrl ? (
          <QRCodeSVG
            value={qrUrl}
            size={Math.min(window.innerWidth - 80, 280)}
            level="M"
            includeMargin={false}
            bgColor="#FFFFFF"
            fgColor="#0D1B5E"
          />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Type label */}
        <div className={`mt-4 px-6 py-2 rounded-full font-bold text-sm flex items-center gap-1.5 ${
          isCheckin ? 'bg-primary-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {isCheckin
            ? <><CheckCircle2 size={15} />Quét để CHECK-IN</>
            : <><LogOut size={15} />Quét để CHECK-OUT</>
          }
        </div>
      </div>

      {/* Countdown */}
      <div className="relative z-10 flex items-center gap-4 mt-8">
        <svg width="72" height="72" className="transform">
          <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
          <circle cx="36" cy="36" r="28" fill="none"
            stroke={countdown <= 5 ? '#FCD34D' : 'white'}
            strokeWidth="5"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            className="countdown-ring transition-all duration-1000"
          />
          <text x="36" y="40" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
            {countdown}
          </text>
        </svg>
        <div className="text-white/70 text-sm">
          <p className="font-medium text-white">Mã tự động đổi</p>
          <p>sau {countdown} giây</p>
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-white/30 text-xs mt-8">
        Dùng camera điện thoại / Zalo để quét
      </p>
    </div>
  );
}
