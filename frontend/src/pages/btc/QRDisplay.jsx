import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ClipboardCheck, LogOut, CheckCircle2, QrCode, Columns2, PartyPopper,
  Music, VolumeX, FileAudio, Maximize, Minimize, Sparkles,
} from 'lucide-react';
import { eventApi } from '../../services/api';
import LiveWelcomeWall from './live/LiveWelcomeWall';
import PartyAudio from './live/partyAudio';

// Bố cục màn chiếu: 'split' = QR + bức tường chào mừng, 'welcome' = chỉ lời chào
// (máy chiếu thứ hai), 'qr' = chỉ QR như trước. Nhớ theo từng máy.
const LAYOUT_KEY = 'fpt_projector_layout';
function readLayout() {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return ['split', 'welcome', 'qr'].includes(v) ? v : 'split';
  } catch {
    return 'split';
  }
}

export default function QRDisplay() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [activeType, setActiveType] = useState('checkin');
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const [layout, setLayoutState] = useState(readLayout);
  const [music, setMusic] = useState({ mode: 'off', fileName: null }); // mode: off | synth | file
  const [volume, setVolume] = useState(0.6);
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = new PartyAudio();
  const fileInputRef = useRef(null);

  const setLayout = (v) => {
    setLayoutState(v);
    try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* chế độ riêng tư */ }
  };

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

  useEffect(() => () => audioRef.current?.dispose(), []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Các handler âm thanh chạy trong cú bấm của BTC — điều kiện để trình duyệt cho phát.
  const toggleSynth = () => {
    const audio = audioRef.current;
    if (music.mode !== 'off') {
      audio.stopMusic();
      setMusic({ mode: 'off', fileName: null });
      return;
    }
    if (audio.startSynth()) setMusic({ mode: 'synth', fileName: null });
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = await audioRef.current.playFile(file);
    setMusic(ok ? { mode: 'file', fileName: file.name } : { mode: 'off', fileName: null });
  };

  const changeVolume = (v) => {
    setVolume(v);
    audioRef.current.setVolume(v);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

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

  const showQR = layout !== 'welcome';
  const showWall = layout !== 'qr';
  const qrSize = layout === 'split'
    ? Math.min(window.innerWidth - 80, Math.round(window.innerHeight * 0.42), 340)
    : Math.min(window.innerWidth - 80, 280);

  const qrPanel = (
    <div className="flex flex-col items-center justify-center">
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
            size={qrSize}
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

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-700 ${
      isCheckin ? 'bg-gradient-to-br from-[#0D1B5E] via-[#1A3A8F] to-[#0052D4]' : 'bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#047857]'
    }`}>
      {/* Background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5" />
      </div>

      {/* Thanh điều khiển — mờ đi để không rối màn chiếu, rê chuột vào mới rõ */}
      <div className="fixed top-3 right-3 z-40 flex items-center gap-1 bg-black/30 backdrop-blur-md rounded-2xl p-1.5 opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <ToolButton active={layout === 'split'} onClick={() => setLayout('split')} title="QR + chào mừng"><Columns2 size={17} /></ToolButton>
        <ToolButton active={layout === 'welcome'} onClick={() => setLayout('welcome')} title="Chỉ màn chào mừng"><PartyPopper size={17} /></ToolButton>
        <ToolButton active={layout === 'qr'} onClick={() => setLayout('qr')} title="Chỉ mã QR"><QrCode size={17} /></ToolButton>
        <span className="w-px h-6 bg-white/20 mx-1" />
        <ToolButton active={music.mode === 'synth'} onClick={toggleSynth}
          title={music.mode === 'off' ? 'Bật nhạc nền vui nhộn' : 'Tắt nhạc'}>
          {music.mode === 'off' ? <Music size={17} /> : <VolumeX size={17} />}
        </ToolButton>
        <ToolButton active={music.mode === 'file'} onClick={() => fileInputRef.current?.click()}
          title={music.fileName ? `Đang phát: ${music.fileName}` : 'Chọn file nhạc từ máy'}>
          <FileAudio size={17} />
        </ToolButton>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={pickFile} />
        <input type="range" min="0" max="1" step="0.05" value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="w-20 accent-amber-300" title="Âm lượng" aria-label="Âm lượng" />
        <span className="w-px h-6 bg-white/20 mx-1" />
        <ToolButton onClick={toggleFullscreen} title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
          {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
        </ToolButton>
      </div>

      {/* Chưa bấm bật nhạc thì trình duyệt chặn mọi âm thanh — nhắc BTC một lần */}
      {showWall && music.mode === 'off' && (
        <button onClick={toggleSynth}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-amber-400 text-gray-900 font-bold text-sm px-4 py-2.5 rounded-full shadow-xl hover:bg-amber-300 transition-colors">
          <Sparkles size={16} /> Bật nhạc & âm thanh
        </button>
      )}

      {/* pt-20 dưới lg: chừa chỗ cho thanh điều khiển cố định, không đè nút CHECK-IN */}
      <div className={`relative z-10 min-h-screen px-6 pb-6 pt-20 lg:pt-6 ${
        layout === 'split' ? 'grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-stretch' : 'flex flex-col justify-center'
      }`}>
        {showQR && qrPanel}
        {showWall && (
          <div className={layout === 'welcome' ? 'h-[calc(100vh-3rem)]' : 'min-h-[60vh] lg:h-[calc(100vh-3rem)]'}>
            <LiveWelcomeWall eventId={id} audio={audioRef.current} fullWidth={layout === 'welcome'} />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={`p-2 rounded-xl transition-colors ${active ? 'bg-white text-gray-900' : 'text-white hover:bg-white/15'}`}>
      {children}
    </button>
  );
}
