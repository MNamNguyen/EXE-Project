import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Columns2, FileAudio, LogIn, LogOut, Maximize, Minimize, Music, PartyPopper, QrCode, ScanLine, Sparkles, VolumeX,
} from 'lucide-react';
import { eventApi } from '../../services/api';
import { RangeInput } from '../../components/ui/Input';
import { cx } from '../../utils/cx';
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

// Màn trình diễn chiếu lên máy chiếu: giữ nền gradient thương hiệu (check-out đổi sang nền xanh
// lá để BTC ở cửa nhìn là biết đang chiếu mã nào). Màu nền có mã đặc dự phòng phía dưới gradient.
const STAGE = {
  checkin: 'bg-[#14307A] bg-[linear-gradient(135deg,#0D1B5E_0%,#1A3A8F_50%,#0052D4_100%)]',
  checkout: 'bg-[#065F46] bg-[linear-gradient(135deg,#064E3B_0%,#065F46_50%,#047857_100%)]',
};

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
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer
  useEffect(() => {
    if (!data) return undefined;
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
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Vòng đếm ngược 44px: phần sáng là thời gian còn lại của mã đang chiếu
  const circumference = 2 * Math.PI * 18;
  const strokeDash = (countdown / 30) * circumference;

  if (loading) {
    return (
      <div className={cx('flex min-h-screen items-center justify-center text-white', STAGE.checkin)}>
        <div className="text-center">
          <span className="mx-auto mb-4 block size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="text-white">Đang tải...</p>
        </div>
      </div>
    );
  }

  const showQR = layout !== 'welcome';
  const showWall = layout !== 'qr';
  const qrSize = layout === 'split'
    ? Math.min(window.innerWidth - 80, Math.round(window.innerHeight * 0.42), 340)
    : Math.min(window.innerWidth - 80, 300);

  const qrPanel = (
    <section className="flex flex-col items-center justify-center gap-6 text-center">
      <div className="inline-flex gap-1 rounded-2xl bg-white/10 p-1">
        {[['checkin', 'CHECK-IN', LogIn], ['checkout', 'CHECK-OUT', LogOut]].map(([type, label, Icon]) => (
          <button
            key={type}
            type="button"
            aria-pressed={activeType === type}
            onClick={() => setActiveType(type)}
            className={cx(
              'inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl px-6 text-sm font-semibold outline-none transition-colors',
              activeType === type ? 'bg-white text-[#0D1B5E]' : 'text-white hover:bg-white/10',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <h1 className="max-w-xl text-balance text-2xl font-bold sm:text-3xl">{data?.eventName}</h1>

      <div className="rounded-3xl bg-white p-5 shadow-[0_20px_60px_rgb(0_0_0/0.35)]">
        {qrUrl ? (
          <QRCodeSVG value={qrUrl} size={qrSize} level="M" includeMargin={false} bgColor="#FFFFFF" fgColor="#0D1B5E" />
        ) : (
          <div className="flex items-center justify-center" style={{ width: qrSize, height: qrSize }}>
            <span className="size-8 animate-spin rounded-full border-4 border-[#0D1B5E]/15 border-t-[#1A6BFF]" />
          </div>
        )}
        <p
          className={cx(
            'mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white',
            isCheckin ? 'bg-[#1A6BFF]' : 'bg-[#047857]',
          )}
        >
          <ScanLine className="size-4" aria-hidden="true" />
          {isCheckin ? 'Quét để CHECK-IN' : 'Quét để CHECK-OUT'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90" aria-hidden="true">
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / .2)" strokeWidth="4" />
          <circle
            cx="22" cy="22" r="18" fill="none"
            stroke={countdown <= 5 ? '#FCD34D' : '#fff'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${strokeDash} ${circumference}`}
            className="transition-all duration-1000"
          />
        </svg>
        <p className="text-left text-sm text-white">
          Mã tự đổi sau <span className="font-semibold tabular-nums">{countdown}</span> giây
          <br />
          Dùng camera điện thoại hoặc Zalo để quét
        </p>
      </div>
    </section>
  );

  return (
    <div className={cx('relative min-h-screen overflow-hidden text-white transition-colors duration-700', STAGE[activeType])}>
      {/* Thanh điều khiển — mờ đi để không rối màn chiếu, rê chuột vào mới rõ */}
      <div className="fixed right-4 top-4 z-40 flex items-center gap-1 rounded-2xl bg-black/20 p-1 opacity-60 transition-opacity focus-within:opacity-100 hover:opacity-100">
        <ToolButton active={layout === 'split'} onClick={() => setLayout('split')} label="QR và màn chào" icon={Columns2} />
        <ToolButton active={layout === 'welcome'} onClick={() => setLayout('welcome')} label="Chỉ màn chào" icon={PartyPopper} />
        <ToolButton active={layout === 'qr'} onClick={() => setLayout('qr')} label="Chỉ mã QR" icon={QrCode} />
        <span className="mx-1 h-5 w-px bg-white/20" />
        <ToolButton
          active={music.mode === 'synth'}
          onClick={toggleSynth}
          label={music.mode === 'off' ? 'Bật nhạc nền' : 'Tắt nhạc'}
          icon={music.mode === 'off' ? Music : VolumeX}
        />
        <ToolButton
          active={music.mode === 'file'}
          onClick={() => fileInputRef.current?.click()}
          label={music.fileName ? `Đang phát: ${music.fileName}` : 'Chọn file nhạc'}
          icon={FileAudio}
        />
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={pickFile} />
        <RangeInput
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="w-20"
          title="Âm lượng"
          aria-label="Âm lượng"
        />
        <span className="mx-1 h-5 w-px bg-white/20" />
        <ToolButton onClick={toggleFullscreen} label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} icon={fullscreen ? Minimize : Maximize} />
      </div>

      {/* Chưa bấm bật nhạc thì trình duyệt chặn mọi âm thanh — nhắc BTC một lần */}
      {showWall && music.mode === 'off' && (
        <button
          type="button"
          onClick={toggleSynth}
          className="fixed bottom-4 right-4 z-40 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#0D1B5E] shadow-lg outline-none transition-colors hover:bg-white/90"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Bật nhạc & âm thanh
        </button>
      )}

      {/* pt-20 dưới lg: chừa chỗ cho thanh điều khiển cố định, không đè nút CHECK-IN */}
      <div
        className={cx(
          'relative grid min-h-screen gap-6 p-6 pt-20 lg:pt-6',
          layout === 'split' ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : 'content-center',
        )}
      >
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

function ToolButton({ active, onClick, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex size-10 cursor-pointer items-center justify-center rounded-xl text-white outline-none transition-colors',
        active ? 'bg-white/25' : 'hover:bg-white/15',
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  );
}
