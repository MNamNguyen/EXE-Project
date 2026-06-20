const variants = {
  blue: 'bg-primary-100 text-primary-700',
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
  indigo: 'bg-indigo-100 text-indigo-700',
  teal: 'bg-teal-100 text-teal-700',
};

export default function Badge({ children, variant = 'blue', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export const attendanceStatusBadge = (status) => {
  const map = {
    REGISTERED: { label: 'Đã đăng ký', variant: 'blue' },
    CHECKED_IN: { label: 'Đã check-in', variant: 'green' },
    CHECKED_OUT: { label: 'Đã check-out', variant: 'teal' },
    ABSENT: { label: 'Vắng', variant: 'red' },
  };
  return map[status] || { label: status, variant: 'gray' };
};

export const roleBadge = (role) => {
  const map = {
    ADMIN: { label: 'Admin', variant: 'red' },
    BTC: { label: 'Ban TC', variant: 'indigo' },
    LECTURER: { label: 'Giảng viên', variant: 'yellow' },
    STUDENT: { label: 'Sinh viên', variant: 'blue' },
  };
  return map[role] || { label: role, variant: 'gray' };
};
