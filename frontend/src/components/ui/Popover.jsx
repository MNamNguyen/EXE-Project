import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../utils/cx';

// Giữ phần tử trong DOM suốt lúc đóng để chạy hết chuyển động ra, rồi mới gỡ.
// `visible` bật sau hai khung hình: trình duyệt vẽ trạng thái đóng trước, nhờ vậy có chuyển động vào.
export function usePresence(open, exitMs = 100) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setVisible(true)); });
      return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);
  return { mounted, visible };
}

const GAP = 8; // cách nút mở 8px (mt-2)
const EDGE = 8; // không sát mép màn
const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]),[role="menuitemradio"],[role="option"]:not([aria-disabled="true"])';

// Lớp nổi bám theo một nút: portal ra body, tự lật lên khi bên dưới không đủ chỗ, tự dịch vào khi
// sát mép phải. Bấm ra ngoài hoặc Esc thì đóng. Mũi tên lên/xuống đi qua các mục.
// width: 'anchor' = rộng bằng nút (select), 'min-anchor' = ít nhất bằng nút (menu).
export default function Popover({
  open, onClose, anchorRef, placement = 'bottom', align = 'start', width, className, style, children,
  role, id, ariaLabel, autoFocus = true,
}) {
  const panelRef = useRef(null);
  const { mounted, visible } = usePresence(open);
  const [pos, setPos] = useState({ top: -9999, left: -9999, side: placement });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    // Gán bề rộng TRƯỚC khi đo chiều cao: đo lúc chưa đủ rộng thì chữ xuống dòng, cao sai
    if (width === 'anchor') panel.style.width = `${rect.width}px`;
    if (width === 'min-anchor') panel.style.minWidth = `${rect.width}px`;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    let side = placement;
    if (side === 'bottom' && panelHeight > below && above > below) side = 'top';
    else if (side === 'top' && panelHeight > above && below > above) side = 'bottom';
    const top = side === 'bottom' ? rect.bottom + GAP : rect.top - GAP - panelHeight;
    const rawLeft = align === 'end' ? rect.right - panelWidth : rect.left;
    const left = Math.min(Math.max(EDGE, rawLeft), Math.max(EDGE, window.innerWidth - panelWidth - EDGE));
    setPos((prev) => (prev.top === top && prev.left === left && prev.side === side ? prev : { top, left, side }));
  }, [anchorRef, placement, align, width]);

  useLayoutEffect(() => { if (mounted) update(); }, [mounted, update]);

  useEffect(() => {
    if (!mounted) return undefined;
    const observer = new ResizeObserver(update);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [mounted, update]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose?.();
    };
    // Bắt ở pha capture: Esc đóng lớp nổi trên cùng trước, không đóng luôn modal phía sau
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose?.();
      anchorRef.current?.focus?.({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, onClose, anchorRef]);

  // Mở ra thì tiêu điểm vào ô tìm (nếu có) hoặc mục đang chọn, không thì mục đầu
  useEffect(() => {
    if (!open || !mounted || !autoFocus) return;
    const panel = panelRef.current;
    if (!panel) return;
    const target = panel.querySelector('[data-autofocus]')
      || panel.querySelector('[aria-selected="true"],[aria-checked="true"]')
      || panel.querySelector(ITEM_SELECTOR);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: 'nearest' });
  }, [open, mounted, autoFocus]);

  const onPanelKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...panelRef.current.querySelectorAll(ITEM_SELECTOR)];
    if (!items.length) return;
    e.preventDefault();
    const index = items.indexOf(document.activeElement);
    let next = 0;
    if (e.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
    if (e.key === 'ArrowUp') next = index <= 0 ? items.length - 1 : index - 1;
    if (e.key === 'End') next = items.length - 1;
    items[next].focus();
  };

  if (!mounted) return null;
  const fromBelow = pos.side === 'bottom';
  const origin = align === 'end'
    ? (fromBelow ? 'origin-top-right' : 'origin-bottom-right')
    : (fromBelow ? 'origin-top-left' : 'origin-bottom-left');

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      id={id}
      aria-label={ariaLabel}
      onKeyDown={onPanelKeyDown}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 70, ...style }}
      className={cx(
        'rounded-2xl border border-border bg-surface-overlay shadow-popover transition-[opacity,transform,scale,translate] motion-reduce:transform-none',
        origin,
        visible
          ? 'translate-y-0 scale-100 opacity-100 duration-150 ease-out'
          : cx('scale-95 opacity-0 duration-100 ease-in', open && (fromBelow ? '-translate-y-1' : 'translate-y-1')),
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

// Mép mờ cho hàng cuộn ngang (tab, chip): mờ phía còn nội dung, để biết là còn nữa
export function useScrollFade() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fade = () => {
      const left = el.scrollLeft > 0;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.style.maskImage = left || right
        ? `linear-gradient(to right, ${left ? 'transparent, #000 32px' : '#000'}, ${right ? '#000 calc(100% - 32px), transparent' : '#000'})`
        : '';
    };
    fade();
    el.addEventListener('scroll', fade, { passive: true });
    const observer = new ResizeObserver(fade);
    observer.observe(el);
    return () => { el.removeEventListener('scroll', fade); observer.disconnect(); };
  }, []);
  return ref;
}
