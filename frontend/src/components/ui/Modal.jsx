import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import Button, { IconButton } from './Button';
import { usePresence } from './Popover';
import { cx } from '../../utils/cx';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Các hộp đang mở, hộp mở sau nằm trên: Esc và Tab chỉ áp cho hộp trên cùng (hộp xác nhận mở từ
// trong một modal thì Esc chỉ đóng hộp xác nhận)
const dialogStack = [];

// Khóa cuộn trang khi có modal; nhiều modal chồng nhau thì đếm, modal cuối đóng mới mở lại
let lockCount = 0;
export function lockScroll() {
  lockCount += 1;
  if (lockCount === 1) document.body.style.overflow = 'hidden';
}
export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = '';
}

// Khung chung cho modal và hộp xác nhận: lớp phủ đen mờ và khung là hai anh em, mỗi cái tự mờ
// (150ms vào, 100ms ra). Esc đóng; Tab vòng trong khung; đóng xong trả tiêu điểm về chỗ cũ.
export function Dialog({ open, onClose, closeOnOverlay, labelledBy, describedBy, role = 'dialog', panelClassName, initialFocusRef, children }) {
  const { mounted, visible } = usePresence(open, 100);
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  // onClose thường là hàm viết tại chỗ, đổi mỗi lần render: giữ qua ref để thứ tự chồng hộp không đổi
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!mounted) return undefined;
    lockScroll();
    // Mở khoá cuộn sau khi chạy xong chuyển động ra, không ngay lúc bấm đóng
    return () => unlockScroll();
  }, [mounted]);

  useLayoutEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return undefined;
    const panel = panelRef.current;
    const target = initialFocusRef?.current
      || panel?.querySelector('[data-autofocus]')
      || panel?.querySelector('input:not([type="hidden"]):not([disabled]),textarea:not([disabled])')
      || panel;
    target?.focus({ preventScroll: true });
    return () => {
      const back = restoreRef.current;
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [open, mounted, initialFocusRef]);

  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    dialogStack.push(token);
    const onKeyDown = (e) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = dialogStack.indexOf(token);
      if (index >= 0) dialogStack.splice(index, 1);
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={closeOnOverlay ? onClose : undefined}
        className={cx('absolute inset-0 bg-black/30 transition-opacity', visible ? 'opacity-100 duration-150 ease-out' : 'opacity-0 duration-100 ease-in')}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          tabIndex={-1}
          className={cx(
            'pointer-events-auto w-full rounded-2xl border border-border bg-surface shadow-modal outline-none transition-[opacity,transform,scale] motion-reduce:transform-none',
            visible ? 'scale-100 opacity-100 duration-150 ease-out' : 'scale-95 opacity-0 duration-100 ease-in',
            panelClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Modal có nội dung: header và footer đứng yên, chỉ thân cuộn. Đường kẻ dưới header và trên footer
// chỉ hiện khi thân thật sự cuộn. Có ô nhập thì bấm ra ngoài không đóng (mặc định).
export default function Modal({ open, onClose, title, description, footer, size = 'md', closeOnOverlay = false, bodyClassName, children }) {
  const titleId = useId();
  const descId = useId();
  const bodyRef = useRef(null);
  const [scrolls, setScrolls] = useState(false);

  const measure = useCallback(() => {
    const el = bodyRef.current;
    if (el) setScrolls(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const el = bodyRef.current;
    if (!el) return undefined;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeOnOverlay={closeOnOverlay}
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      panelClassName={cx('flex max-h-[calc(100dvh-2rem)] flex-col', SIZES[size])}
    >
      <header className={cx('relative shrink-0 px-6 pr-14 pt-5', scrolls ? 'border-b border-border pb-4' : 'pb-1')}>
        <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p id={descId} className="mt-2 text-pretty text-sm/6 text-muted">{description}</p>}
        <IconButton icon={X} label="Đóng" size="size-9" onClick={onClose} className="absolute right-3 top-4" />
      </header>
      <div ref={bodyRef} className={cx('min-h-0 flex-1 overflow-y-auto px-6', scrolls ? 'py-5' : 'pb-6 pt-4', !footer && scrolls && 'pb-6', bodyClassName)}>
        <div>{children}</div>
      </div>
      {footer && (
        <footer className={cx('flex shrink-0 flex-col-reverse gap-2 px-6 pb-6 sm:flex-row sm:justify-end', scrolls ? 'border-t border-border pt-4' : 'pt-0')}>
          {footer}
        </footer>
      )}
    </Dialog>
  );
}

// Hộp xác nhận: icon tròn cùng hàng tiêu đề (câu hỏi), thân nói hậu quả, tên đối tượng đậm.
// tone="danger" cho việc mất dữ liệu, kết thúc thứ đang chạy, cắt quyền; nút xác nhận chỉ có chữ.
// Huỷ nhận tiêu điểm khi mở để Enter không xác nhận nhầm.
export function ConfirmDialog({ open, title, body, confirmLabel = 'Xác nhận', cancelLabel = 'Huỷ', tone = 'danger', icon: Icon = Trash2, loading = false, onConfirm, onCancel }) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} labelledBy={titleId} describedBy={descId} role="alertdialog" panelClassName="max-w-md p-6" initialFocusRef={cancelRef}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4">
        <div className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', tone === 'danger' ? 'bg-danger-bg' : 'bg-background')}>
          <Icon className={cx('size-5', tone === 'danger' ? 'text-danger' : 'text-foreground')} aria-hidden="true" />
        </div>
        <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
        <div className="col-span-2 mt-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:mt-0.5">
          <div id={descId} className="text-pretty text-sm/6 text-muted">{body}</div>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} variant="secondary" size="form" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="form" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

// Hỏi xác nhận kiểu `await confirm({...})` thay cho window.confirm(): trả về true/false
const ConfirmContext = createContext(() => Promise.resolve(false));

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolveRef.current = resolve;
    setRequest(options);
    setOpen(true);
  }), []);

  const settle = (value) => {
    setOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <ConfirmDialog
          open={open}
          title={request.title}
          body={request.body}
          confirmLabel={request.confirmLabel}
          cancelLabel={request.cancelLabel}
          tone={request.tone}
          icon={request.icon}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
