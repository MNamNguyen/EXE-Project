import { cloneElement, createContext, useCallback, useContext, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import Popover from './Popover';
import { cx } from '../../utils/cx';

const MenuContext = createContext({ close: () => {} });

// Menu thả xuống: trigger là một phần tử nhận ref (Button, IconButton). Mục nguy hiểm tách xuống
// nhóm cuối, ngăn bằng MenuSeparator, lúc thường y như mục khác, rê vào mới đỏ.
export default function Dropdown({ trigger, align = 'end', placement = 'bottom', width = 'min-w-56', matchWidth = false, ariaLabel, children }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  const closeAndFocus = useCallback(() => {
    setOpen(false);
    anchorRef.current?.focus?.({ preventScroll: true });
  }, []);

  const triggerEl = cloneElement(trigger, {
    ref: anchorRef,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (e) => {
      trigger.props.onClick?.(e);
      setOpen((v) => !v);
    },
  });

  return (
    <>
      {triggerEl}
      <Popover
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        align={align}
        placement={placement}
        width={matchWidth ? 'anchor' : 'min-anchor'}
        role="menu"
        id={menuId}
        ariaLabel={ariaLabel}
        className={cx('py-1', width)}
      >
        <MenuContext.Provider value={{ close: closeAndFocus }}>
          {typeof children === 'function' ? children({ close: closeAndFocus }) : children}
        </MenuContext.Provider>
      </Popover>
    </>
  );
}

export function MenuGroup({ children, className }) {
  return <div className={cx('px-1', className)}>{children}</div>;
}

export function MenuSeparator() {
  return <hr className="my-1 border-border" />;
}

export function MenuLabel({ children }) {
  return <p className="px-3 pb-1 pt-1 text-xs font-medium text-muted">{children}</p>;
}

// Một mục: <button>, hoặc <Link> khi có `to`, hoặc <a> khi có `href`. onSelect chạy rồi đóng menu.
export function MenuItem({ icon: Icon, children, description, danger = false, checked, to, href, target, rel, onSelect, disabled = false, keepOpen = false }) {
  const { close } = useContext(MenuContext);
  const handle = (e) => {
    if (disabled) { e.preventDefault(); return; }
    onSelect?.(e);
    if (!keepOpen) close();
  };
  const role = checked === undefined ? 'menuitem' : 'menuitemradio';
  const className = danger
    ? 'group flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm text-foreground outline-none hover:bg-danger-bg hover:text-danger focus-visible:bg-danger-bg focus-visible:text-danger aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
    : cx(
      'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm text-foreground outline-none hover:bg-item-hover focus-visible:bg-item-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
      description ? 'py-2.5' : 'h-10',
    );
  const content = (
    <>
      {Icon && (
        <Icon
          className={cx('size-4 shrink-0 text-muted', danger && 'group-hover:text-danger group-focus-visible:text-danger', description && 'mt-0.5 self-start')}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 text-left">
        {description ? (
          <>
            <span className="block font-medium">{children}</span>
            <span className="mt-0.5 block text-muted">{description}</span>
          </>
        ) : children}
      </span>
      {checked && <Check className="size-4 shrink-0 text-foreground" aria-hidden="true" />}
    </>
  );
  const common = { role, tabIndex: -1, className, onClick: handle, 'aria-disabled': disabled || undefined, ...(checked !== undefined && { 'aria-checked': checked }) };
  if (to) return <Link to={to} {...common}>{content}</Link>;
  if (href) return <a href={href} target={target} rel={rel} {...common}>{content}</a>;
  return <button type="button" {...common}>{content}</button>;
}
