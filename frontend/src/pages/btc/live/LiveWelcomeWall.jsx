import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, WifiOff } from 'lucide-react';
import useLiveCheckins from './useLiveCheckins';

const EMOJIS = ['🎉', '🌟', '🚀', '🎈', '🦄', '🐯', '🐼', '🦊', '🐧', '🌈', '🍀', '⚡', '🎸', '🎨', '🏆', '💎', '🐳', '🍉', '🔥', '🎯'];
const GREETINGS = ['Chào mừng', 'Xin chào', 'Hoan nghênh', 'Rất vui được gặp'];
// Cặp màu đậm (mức 700) để chữ trắng trên bong bóng đủ tương phản trên máy chiếu
const GRADIENTS = [
  ['#BE185D', '#C2410C'], ['#047857', '#0369A1'], ['#6D28D9', '#BE185D'],
  ['#0369A1', '#4338CA'], ['#B45309', '#C2410C'], ['#0F766E', '#1D4ED8'],
];
const CONFETTI_COLORS = ['#FF6B9D', '#FFD166', '#06D6A0', '#4CC9F0', '#B388FF', '#FF9F1C', '#FFFFFF'];

// Chọn màu/emoji ổn định theo id: cùng một người luôn cùng một "bong bóng".
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const pick = (arr, seed) => arr[seed % arr.length];

// Hiện lần lượt từng lời chào; dồn nhiều người thì chạy nhanh hơn, dồn quá
// nhiều (cả lớp quét cùng lúc) thì gộp thành một lời chào nhóm.
const SINGLE_MS = 3200;
const FAST_MS = 1700;
const GROUP_THRESHOLD = 6;

export default function LiveWelcomeWall({ eventId, audio, enabled = true, fullWidth = false }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const confettiSeq = useRef(0);

  const onArrivals = useCallback((people) => setQueue((q) => [...q, ...people]), []);
  const { data, offline } = useLiveCheckins(eventId, { enabled, onArrivals });

  // Lấy lượt chào kế tiếp khi màn đang trống.
  useEffect(() => {
    if (current || queue.length === 0) return;
    let next;
    if (queue.length >= GROUP_THRESHOLD) {
      next = { key: `g-${queue[0].id}`, group: queue, seed: hash(queue[0].id) };
      setQueue([]);
    } else {
      next = { key: queue[0].id, person: queue[0], seed: hash(queue[0].id) };
      setQueue((q) => q.slice(1));
    }
    setCurrent({ ...next, duration: queue.length > 2 ? FAST_MS : SINGLE_MS });
    audio?.chime({ big: !!next.group });
    confettiSeq.current += 1;
    setConfetti({ id: confettiSeq.current, pieces: next.group ? 70 : 40 });
  }, [queue, current, audio]);

  useEffect(() => {
    if (!current) return undefined;
    const t = setTimeout(() => setCurrent(null), current.duration);
    return () => clearTimeout(t);
  }, [current]);

  const recent = data?.recent || [];
  const checkedIn = useCountUp(data?.checkedIn || 0);
  const registered = data?.registered || 0;
  const pct = registered ? Math.min(100, Math.round(((data?.checkedIn || 0) / registered) * 100)) : 0;

  return (
    <section className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/15 bg-white/10 ${
      fullWidth ? 'p-8' : 'p-6'
    }`}>
      {/* Bộ đếm */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <Users className="size-4" aria-hidden="true" /> Đã tham gia
          </p>
          <p className={`mt-1 font-bold tabular-nums leading-none text-white ${fullWidth ? 'text-7xl' : 'text-5xl'}`}>
            {checkedIn}
            {registered > 0 && <span className="text-2xl font-semibold text-white/70"> / {registered}</span>}
          </p>
        </div>
        {offline && (
          <span className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-xs font-medium text-white">
            <WifiOff className="size-3.5" aria-hidden="true" /> Mất kết nối, đang thử lại...
          </span>
        )}
      </div>
      {registered > 0 && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full live-progress transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Bức tường tên */}
      <div className="relative mt-6 min-h-[240px] flex-1 overflow-hidden">
        {recent.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="live-float text-5xl" aria-hidden="true">🎈</p>
            <p className="mt-4 text-xl font-semibold text-white">Chưa có ai check-in</p>
            <p className="mt-1 text-white">Quét mã QR để xuất hiện trên màn hình này!</p>
          </div>
        ) : (
          <div className="flex flex-wrap content-start gap-3">
            {recent.map((p, i) => {
              const seed = hash(p.id);
              const [a, b] = pick(GRADIENTS, seed);
              return (
                <span
                  key={p.id}
                  className="live-chip inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-white shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${a}, ${b})`,
                    fontSize: fullWidth ? '1.25rem' : '1rem',
                    animationDelay: `0s, ${(seed % 20) / 10}s`,
                    opacity: i > 40 ? 0.55 : 1,
                  }}
                >
                  <span aria-hidden="true">{pick(EMOJIS, seed)}</span>
                  {p.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Lời chào — nằm TRONG khung này để không che mã QR bên cạnh */}
      {current && <WelcomeCard key={current.key} item={current} fullWidth={fullWidth} />}
      {confetti && <Confetti key={confetti.id} pieces={confetti.pieces} />}
    </section>
  );
}

function WelcomeCard({ item, fullWidth }) {
  const { seed } = item;
  const emoji = pick(EMOJIS, seed);
  const nameSize = fullWidth ? 'text-[clamp(2.5rem,7vw,6.5rem)]' : 'text-[clamp(2rem,4.2vw,4.5rem)]';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#0B1240]/70 p-6">
      <div className="live-welcome text-center max-w-full">
        <p className={`live-wiggle ${fullWidth ? 'text-8xl' : 'text-7xl'}`}>{item.group ? '🥳' : emoji}</p>
        <p className="mt-2 text-lg font-bold uppercase tracking-[0.3em] text-white md:text-xl">
          {item.group ? 'Chào mừng cả nhóm' : pick(GREETINGS, seed)}
        </p>
        {item.group ? (
          <>
            <p className={`text-white drop-shadow-lg font-black leading-tight break-words ${fullWidth ? 'text-6xl' : 'text-4xl'}`}>
              {item.group.slice(0, 3).map((p) => p.name).join(', ')}
            </p>
            <p className="text-white text-2xl font-bold mt-2">và {item.group.length - 3} bạn khác đã tham gia sự kiện! 🎉</p>
          </>
        ) : (
          <>
            <p className={`text-white drop-shadow-lg font-black leading-tight break-words ${nameSize}`}>{item.person.name}</p>
            <p className="mt-2 text-xl font-semibold text-white md:text-2xl">đã tham gia sự kiện! 🎉</p>
          </>
        )}
      </div>
    </div>
  );
}

function Confetti({ pieces }) {
  // Tạo sẵn ngẫu nhiên một lần cho mỗi đợt — không đổi khi re-render.
  const [items] = useState(() => Array.from({ length: pieces }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.6,
    dx: `${(Math.random() - 0.5) * 240}px`,
    rot: `${(Math.random() - 0.5) * 1440}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: 6 + Math.random() * 8,
    round: Math.random() > 0.6,
  })));

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
      {items.map((c) => (
        <span
          key={c.id}
          className="live-confetti absolute top-0"
          style={{
            left: `${c.left}%`,
            width: c.w,
            height: c.round ? c.w : c.w * 0.45,
            borderRadius: c.round ? '50%' : 2,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            '--dx': c.dx,
            '--rot': c.rot,
          }}
        />
      ))}
    </div>
  );
}

// Số đếm chạy dần lên thay vì nhảy cóc.
function useCountUp(target) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;
    const start = performance.now();
    const dur = 800;
    let raf;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      const v = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      setValue(v);
      fromRef.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}
