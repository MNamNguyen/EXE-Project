import { Link } from 'react-router-dom';
import {
  QrCode, MapPin, Clock, Users, ShieldCheck,
  BarChart3, ArrowRight, CheckCircle, ChevronRight,
  Smartphone, Zap, Globe,
} from 'lucide-react';

const features = [
  {
    icon: QrCode,
    color: 'bg-blue-50 text-blue-600',
    title: 'QR Động thông minh',
    desc: 'Mã QR tự động đổi mới mỗi 30 giây, được mã hóa HMAC-SHA256. Không thể chụp màn hình để gian lận.',
  },
  {
    icon: MapPin,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Xác thực GPS thời gian thực',
    desc: 'Chỉ cho phép check-in trong bán kính địa lý được cấu hình. Phát hiện ngay sinh viên đứng bên ngoài.',
  },
  {
    icon: ShieldCheck,
    color: 'bg-violet-50 text-violet-600',
    title: 'Chống gian lận đa lớp',
    desc: 'Binding thiết bị qua OTP email, kiểm tra QR token, GPS và thời gian – 4 lớp bảo mật song song.',
  },
  {
    icon: BarChart3,
    color: 'bg-orange-50 text-orange-600',
    title: 'Báo cáo & Export Excel',
    desc: 'Xem thống kê điểm danh real-time, export Excel đẹp mắt với đầy đủ thông tin sinh viên theo sự kiện.',
  },
  {
    icon: Smartphone,
    color: 'bg-pink-50 text-pink-600',
    title: 'Quét QR bằng điện thoại',
    desc: 'Sinh viên chỉ cần camera điện thoại hoặc Zalo quét QR – không cần cài thêm ứng dụng nào.',
  },
  {
    icon: Users,
    color: 'bg-sky-50 text-sky-600',
    title: 'Quản lý đa vai trò',
    desc: 'Hệ thống phân quyền 4 cấp: Admin · BTC · Giảng viên · Sinh viên. Import hàng loạt bằng Excel.',
  },
];

const steps = [
  {
    num: '01',
    title: 'BTC tạo sự kiện',
    desc: 'Nhập thông tin sự kiện, vị trí GPS, khung giờ check-in/out và danh sách whitelist sinh viên.',
    icon: Globe,
  },
  {
    num: '02',
    title: 'Hiển thị mã QR',
    desc: 'Mở màn hình QR fullscreen trên laptop hoặc TV tại cổng vào. QR tự động đổi mới mỗi 30 giây.',
    icon: QrCode,
  },
  {
    num: '03',
    title: 'Sinh viên quét & điểm danh',
    desc: 'Quét QR bằng camera → đăng nhập nhanh → hệ thống xác thực GPS + thiết bị → ghi nhận tức thì.',
    icon: Smartphone,
  },
  {
    num: '04',
    title: 'Xem báo cáo real-time',
    desc: 'BTC theo dõi danh sách điểm danh cập nhật liên tục, export Excel khi kết thúc sự kiện.',
    icon: BarChart3,
  },
];

const stats = [
  { value: '30s', label: 'QR đổi mới mỗi', icon: Zap },
  { value: '4 lớp', label: 'Bảo mật chống gian lận', icon: ShieldCheck },
  { value: '100%', label: 'Không cần cài app', icon: Smartphone },
  { value: 'Real-time', label: 'Cập nhật điểm danh', icon: Clock },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="logo" className="w-8 h-8" />
            <span className="font-bold text-gray-900 text-base">FPT Event</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-primary-600 transition-colors">Tính năng</a>
            <a href="#how-it-works" className="hover:text-primary-600 transition-colors">Cách hoạt động</a>
          </nav>
          <Link
            to="/login"
            className="btn-primary btn-md flex items-center gap-1.5"
          >
            Đăng nhập
            <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0052D4] via-[#1A6BFF] to-[#00A3FF] text-white">
        {/* Decorative bg */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-white/5" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/3 w-96 h-96 rounded-full bg-white/3" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 lg:py-28 flex flex-col lg:flex-row items-center gap-12">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Zap size={13} className="text-yellow-300" />
              Hệ thống điểm danh thế hệ mới
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-5">
              Điểm danh thông minh<br />
              <span className="text-blue-200">không thể gian lận</span>
            </h1>
            <p className="text-white/75 text-lg leading-relaxed mb-8 max-w-xl">
              Hệ thống quản lý sự kiện &amp; điểm danh toàn diện cho Đại học FPT.
              QR động · GPS xác thực · Báo cáo real-time.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-white text-primary-700 font-bold px-7 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg text-sm"
              >
                Bắt đầu ngay
                <ArrowRight size={15} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-white/80 font-medium text-sm hover:text-white transition-colors"
              >
                Xem cách hoạt động
                <ChevronRight size={14} />
              </a>
            </div>
          </div>

          {/* Logo banner */}
          <div className="flex-shrink-0 w-full max-w-sm lg:max-w-[380px]">
            <img
              src="/logo.svg"
              alt="FPT Event System"
              className="w-full drop-shadow-2xl rounded-2xl"
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 border-t border-white/15">
          <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-blue-200" />
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-none">{value}</p>
                  <p className="text-white/60 text-xs mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 bg-surface">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-primary-600 text-sm font-semibold uppercase tracking-wider">Tính năng</span>
            <h2 className="text-3xl font-bold text-gray-900 mt-2">Mọi thứ bạn cần cho sự kiện</h2>
            <p className="text-gray-500 mt-3 text-base max-w-xl mx-auto">
              Từ tạo sự kiện đến báo cáo sau sự kiện – tất cả trong một nền tảng duy nhất.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-border/60 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-primary-600 text-sm font-semibold uppercase tracking-wider">Quy trình</span>
            <h2 className="text-3xl font-bold text-gray-900 mt-2">Hoạt động như thế nào?</h2>
            <p className="text-gray-500 mt-3 text-base max-w-lg mx-auto">
              Từ setup đến check-in hoàn tất chỉ trong 4 bước đơn giản.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ num, title, desc, icon: Icon }, i) => (
              <div key={num} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-border z-0 -translate-y-1/2" style={{ width: 'calc(100% - 2rem)', left: 'calc(50% + 2rem)' }} />
                )}
                <div className="relative z-10 text-center">
                  <div className="relative inline-block mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto">
                      <Icon size={24} className="text-primary-600" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-brand text-white text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="py-16 bg-surface">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Dành cho tất cả mọi người</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: 'Admin', color: 'border-red-200 bg-red-50', badge: 'bg-red-100 text-red-700', perms: ['Quản lý toàn bộ người dùng', 'Import sinh viên Excel', 'Xem log gian lận', 'Reset thiết bị'] },
              { role: 'BTC', color: 'border-blue-200 bg-blue-50', badge: 'bg-blue-100 text-blue-700', perms: ['Tạo & quản lý sự kiện', 'Hiển thị QR check-in', 'Xem báo cáo real-time', 'Export Excel'] },
              { role: 'Giảng viên', color: 'border-violet-200 bg-violet-50', badge: 'bg-violet-100 text-violet-700', perms: ['Xem danh sách sự kiện', 'Theo dõi điểm danh', 'Xem thống kê lớp', ''] },
              { role: 'Sinh viên', color: 'border-emerald-200 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', perms: ['Quét QR check-in/out', 'Xem sự kiện sắp tới', 'Lịch sử tham dự', ''] },
            ].map(({ role, color, badge, perms }) => (
              <div key={role} className={`rounded-2xl border p-5 ${color}`}>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold mb-4 ${badge}`}>{role}</span>
                <ul className="space-y-2">
                  {perms.filter(Boolean).map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-br from-[#0052D4] via-[#1A6BFF] to-[#00A3FF]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Sẵn sàng triển khai?
          </h2>
          <p className="text-white/75 text-base mb-8">
            Đăng nhập và tạo sự kiện đầu tiên của bạn ngay hôm nay.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-xl text-sm"
          >
            Đăng nhập hệ thống
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-surface border-t border-border">
        {/* Top accent line */}
        <div className="h-1 bg-gradient-brand" />

        {/* Main content */}
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Col 1: Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/favicon.svg" alt="FPT Event" className="w-9 h-9" />
                <div>
                  <p className="font-extrabold text-gray-900 text-base leading-none">FPT Event</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">EventPass System</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                Hệ thống quản lý sự kiện &amp; điểm danh thông minh — QR động, GPS xác thực, báo cáo real-time.
              </p>
              {/* Tech stack badges */}
              <div className="flex flex-wrap gap-2">
                {['React', 'Node.js', 'Prisma', 'Supabase'].map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-lg bg-white border border-border text-xs font-medium text-gray-500">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Col 2: Tính năng */}
            <div>
              <p className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Tính năng</p>
              <ul className="space-y-2.5">
                {[
                  { label: 'QR Check-in động',      href: '#features' },
                  { label: 'Xác thực GPS',           href: '#features' },
                  { label: 'Chống gian lận đa lớp',  href: '#features' },
                  { label: 'Báo cáo & Export Excel', href: '#features' },
                  { label: 'Import sinh viên Excel', href: '#features' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-sm text-gray-500 hover:text-primary-600 transition-colors flex items-center gap-1.5 group">
                      <ChevronRight size={12} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Vai trò */}
            <div>
              <p className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Dành cho</p>
              <ul className="space-y-2.5">
                {[
                  { label: 'Admin',       desc: 'Quản trị toàn hệ thống',     color: 'bg-red-100 text-red-600' },
                  { label: 'BTC',         desc: 'Ban tổ chức sự kiện',         color: 'bg-blue-100 text-blue-600' },
                  { label: 'Giảng viên',  desc: 'Theo dõi điểm danh lớp',     color: 'bg-violet-100 text-violet-600' },
                  { label: 'Sinh viên',   desc: 'Quét QR, xem lịch sử',        color: 'bg-emerald-100 text-emerald-600' },
                ].map(({ label, desc, color }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${color}`}>{label}</span>
                    <span className="text-sm text-gray-500">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: Liên hệ & Bảo mật */}
            <div>
              <p className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Bảo mật & Hỗ trợ</p>
              <ul className="space-y-3 mb-6">
                {[
                  { icon: ShieldCheck, label: 'JWT Authentication',   color: 'text-blue-500' },
                  { icon: MapPin,      label: 'GPS Geofencing',        color: 'text-emerald-500' },
                  { icon: Clock,       label: 'HMAC-SHA256 QR Token',  color: 'text-violet-500' },
                  { icon: Zap,         label: 'Rate Limiting & Helmet', color: 'text-orange-500' },
                ].map(({ icon: Icon, label, color }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <Icon size={14} className={`flex-shrink-0 ${color}`} />
                    <span className="text-sm text-gray-500">{label}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                Đăng nhập hệ thống
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              © 2026 <span className="font-semibold text-gray-600">FPT University</span>. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Hệ thống đang hoạt động
              </span>
              <span className="text-gray-200">|</span>
              <span className="text-xs text-gray-400">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
