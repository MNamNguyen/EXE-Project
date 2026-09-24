import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, WifiOff } from 'lucide-react';
import useLiveCheckins from './useLiveCheckins';

const EMOJIS = ['🎉', '🌟', '🚀', '🎈', '🦄', '🐯', '🐼', '🦊', '🐧', '🌈', '🍀', '⚡', '🎸', '🎨', '🏆', '💎', '🐳', '🍉', '🔥', '🎯'];
const GREETINGS = ['Chào mừng', 'Xin chào', 'Hoan nghênh', 'Rất vui được gặp'];
const GRADIENTS = [
  ['#FF6B9D', '#FF9A5A'], ['#FFB020', '#FF6B6B'], ['#22D3A6', '#0EA5E9'], ['#8B5CF6', '#EC4899'],
  ['#38BDF8', '#6366F1'], ['#F472B6', '#FB7185'], ['#A3E635', '#22C55E'], ['#FACC15', '#F97316'],
  ['#2DD4BF', '#3B82F6'], ['#C084FC', '#6366F1'],
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
    <div className={`relative flex flex-col min-h-0 h-full rounded-3xl bg-white/10 backdrop-blur-sm border border-white/15 overflow-hidden ${
      fullWidth ? 'p-8' : 'p-5 md:p-6'
    }`}>
      {/* Bộ đếm */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-white/70 text-sm font-semibold uppercase tracking-widest flex items-center gap-2">
            <Users size={16} /> Đã tham gia
          </p>
          <p className={`font-black text-white leading-none mt-1 tabular-nums ${fullWidth ? 'text-8xl' : 'text-6xl'}`}>
            {checkedIn}
            {registered > 0 && <span className="text-white/40 text-3xl font-bold"> / {registered}</span>}
          </p>
        </div>
        {offline && (
          <span className="flex items-center gap-1.5 text-xs text-amber-200 bg-amber-500/20 px-3 py-1.5 rounded-full">
            <WifiOff size={13} /> Mất kết nối, đang thử lại...
          </span>
        )}
      </div>
      {registered > 0 && (
        <div className="mt-3 h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full live-progress transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Bức tường tên */}
      <div className="relative flex-1 min-h-[240px] mt-5 overflow-hidden">
        {recent.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/60">
            <p className="text-6xl live-float">🎈</p>
            <p className="mt-3 text-lg font-semibold">Chưa có ai check-in</p>
            <p className="text-sm">Quét mã QR để xuất hiện trên màn hình này!</p>
          </div>
        ) : (
          <div className="flex flex-wrap content-start gap-2.5">
            {recent.map((p, i) => {
              const seed = hash(p.id);
              const [a, b] = pick(GRADIENTS, seed);
              return (
                <span
                  key={p.id}
                  className="live-chip inline-flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 text-white font-bold shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${a}, ${b})`,
                    fontSize: fullWidth ? '1.25rem' : '1rem',
                    animationDelay: `0s, ${(seed % 20) / 10}s`,
                    opacity: i > 40 ? 0.55 : 1,
                  }}
                >
                  <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-lg">{pick(EMOJIS, seed)}</span>
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
    </div>
  );
}

function WelcomeCard({ item, fullWidth }) {
  const { seed } = item;
  const emoji = pick(EMOJIS, seed);
  const nameSize = fullWidth ? 'text-[clamp(2.5rem,7vw,6.5rem)]' : 'text-[clamp(2rem,4.2vw,4.5rem)]';

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[#0B1240]/55 backdrop-blur-[2px] pointer-events-none">
      <div className="live-welcome text-center max-w-full">
        <p className={`live-wiggle ${fullWidth ? 'text-8xl' : 'text-7xl'}`}>{item.group ? '🥳' : emoji}</p>
        <p className="mt-2 text-white/80 font-extrabold uppercase tracking-[0.3em] text-lg md:text-xl">
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
            <p className="text-white/90 text-xl md:text-2xl font-semibold mt-2">đã tham gia sự kiện! 🎉</p>
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
