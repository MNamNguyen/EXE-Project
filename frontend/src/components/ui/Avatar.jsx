import { cx } from '../../utils/cx';

// Avatar chữ cái: màu chọn theo hash của seed (email hoặc tên) để một người luôn cùng một màu
const TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
  'bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/30',
  'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-orange-400 dark:ring-amber-500/30',
  'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
];

const hash = (seed) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
};

export default function Avatar({ name = '', seed, size = 'size-8', ring = true, className }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase('vi') || '?';
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold',
        ring && 'ring-1',
        size,
        TONES[hash(seed || name || '?') % TONES.length],
        className,
      )}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
