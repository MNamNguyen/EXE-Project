import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, CalendarDays, Users,
  LogOut, ShieldCheck, X,
} from 'lucide-react';

const navItems = {
  STUDENT: [
    { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/my-attendance', icon: CalendarDays,    label: 'Lịch sử tham dự' },
  ],
  BTC: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/events',       icon: CalendarDays,    label: 'Quản lý sự kiện' },
    { to: '/reports/fraud', icon: ShieldCheck,    label: 'Log gian lận' },
  ],
  LECTURER: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/events',    icon: CalendarDays,    label: 'Sự kiện' },
  ],
  ADMIN: [
    { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/events',        icon: CalendarDays,    label: 'Quản lý sự kiện' },
    { to: '/admin/users',   icon: Users,           label: 'Quản lý người dùng' },
    { to: '/reports/fraud', icon: ShieldCheck,     label: 'Log gian lận' },
  ],
};

const roleBadge = {
  ADMIN: 'bg-red-100 text-red-700',
  BTC: 'bg-blue-100 text-blue-700',
  LECTURER: 'bg-violet-100 text-violet-700',
  STUDENT: 'bg-emerald-100 text-emerald-700',
};

const roleLabel = {
  ADMIN: 'Admin',
  BTC: 'BTC',
  LECTURER: 'Giảng viên',
  STUDENT: 'Sinh viên',
};

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-border z-40
        flex flex-col transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="FPT Event" className="w-9 h-9 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">FPT Event</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Attendance System</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* User card */}
        <div className="px-3 pt-3">
          <div className="px-3 py-3 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate leading-none">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{user?.mssv || user?.email}</p>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${roleBadge[user?.role] || 'bg-gray-100 text-gray-600'}`}>
                {roleLabel[user?.role] || user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Menu
          </p>
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-gradient-brand text-white shadow-sm'
                  : 'text-gray-600 hover:bg-surface hover:text-primary-700'
                }
              `}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}
