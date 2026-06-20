import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Lock, User, ShieldCheck,
  QrCode, MapPin, Clock, Users, ChevronRight, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/ui/Spinner';

const features = [
  { icon: QrCode, title: 'QR Thông minh',  desc: 'Mã QR động mỗi 30 giây, mã hóa HMAC-SHA256' },
  { icon: MapPin,  title: 'GPS Xác thực',   desc: 'Định vị thời gian thực trong bán kính cho phép' },
  { icon: Clock,   title: 'Real-time',       desc: 'Cập nhật điểm danh tức thì, báo cáo ngay' },
  { icon: Users,   title: 'Đa vai trò',      desc: 'Admin · BTC · Giảng viên · Sinh viên' },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [step, setStep]       = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [otpData,  setOtpData]  = useState(null);

  const [form,    setForm]    = useState({ identifier: '', password: '' });
  const [otp,     setOtp]     = useState('');
  const [newPass, setNewPass] = useState({ current: '', new: '', confirm: '' });

  const redirectTo = new URLSearchParams(location.search).get('redirect') || '/dashboard';

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.password) return toast.error('Vui lòng nhập đầy đủ thông tin');
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      if (data.requireOtp) {
        setOtpData({ userId: data.userId });
        setStep('otp');
        toast.success(data.message);
      } else if (data.success) {
        login(data.token, data.user);
        data.user.isFirstLogin ? setStep('change-password') : navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('Mã OTP gồm 6 chữ số');
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp({ userId: otpData.userId, otp });
      if (data.success) { login(data.token, data.user); navigate(redirectTo, { replace: true }); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mã OTP không đúng');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass.new !== newPass.confirm) return toast.error('Mật khẩu xác nhận không khớp');
    if (newPass.new.length < 6) return toast.error('Mật khẩu mới phải ít nhất 6 ký tự');
    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: newPass.current, newPassword: newPass.new });
      toast.success('Đổi mật khẩu thành công!');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ════════════════════════════════════════
          LEFT PANEL — brand + features
          Hiện trên lg (≥1024px)
      ════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[56%] relative overflow-hidden flex-col
                      bg-gradient-to-br from-[#003EB3] via-[#1A6BFF] to-[#0EA5E9]">

        {/* Decorative blobs — subtle, không che text */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/[0.06]" />
          <div className="absolute bottom-0 -left-16 w-64 h-64 rounded-full bg-white/[0.06]" />
          <div className="absolute top-1/2 right-12 -translate-y-1/2 w-40 h-40 rounded-full bg-white/[0.04]" />
        </div>

        {/* ── Top brand — chỉ text, KHÔNG badge EventPass (logo.svg đã có) ── */}
        <div className="relative z-10 pt-9 px-10">
          <Link to="/" className="inline-flex flex-col group">
            <span className="font-extrabold text-white text-xl tracking-tight leading-none">
              FPT Event
            </span>
            <span className="text-white/75 text-xs mt-0.5 font-medium">
              Hệ thống điểm danh sự kiện
            </span>
          </Link>
        </div>

        {/* ── Logo SVG — hero visual ── */}
        <div className="relative z-10 px-10 pt-6 pb-2 flex items-center justify-start">
          <img
            src="/logo.svg"
            alt="FPT Event System"
            className="w-full max-w-[340px] drop-shadow-xl rounded-2xl"
          />
        </div>

        {/* ── Headline ── */}
        <div className="relative z-10 px-10 pb-4">
          <h2 className="text-[26px] font-extrabold text-white leading-tight mb-2 drop-shadow-sm">
            Quản lý sự kiện<br />
            thông minh &amp; hiện đại
          </h2>
          <p className="text-white text-sm leading-relaxed max-w-sm opacity-90">
            Điểm danh tức thì bằng QR &nbsp;·&nbsp; Chống gian lận GPS &nbsp;·&nbsp; Báo cáo real-time
          </p>
        </div>

        {/* ── Feature cards ── */}
        <div className="relative z-10 px-10 pb-6">
          <div className="grid grid-cols-2 gap-2.5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white/20 backdrop-blur-sm rounded-xl p-3.5
                           border border-white/30 hover:bg-white/25 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-white/30 flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className="text-white" />
                  </div>
                  <span className="text-white font-bold text-xs">{title}</span>
                </div>
                <p className="text-white text-[11px] leading-relaxed opacity-85">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="relative z-10 px-10 pb-7 mt-auto">
          <div className="h-px bg-white/25 mb-4" />
          <div className="flex items-center justify-between">
            <p className="text-white/80 text-[11px] font-medium">© 2026 FPT University</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-white/80 text-[11px]">Hệ thống đang hoạt động</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          RIGHT PANEL — form
      ════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">

        {/* Mobile header (chỉ hiện dưới lg) */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="logo" className="w-8 h-8" />
            <span className="font-bold text-gray-900 text-sm">FPT Event</span>
          </Link>
          <Link to="/" className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors">
            <ArrowLeft size={13} />
            Trang chủ
          </Link>
        </div>

        {/* Form area — căn giữa tuyệt đối */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-10">
          <div className="w-full max-w-[400px]">

            {/* ── Step: Login ── */}
            {step === 'login' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  {/* Desktop: back to home link */}
                  <Link
                    to="/"
                    className="hidden lg:inline-flex items-center gap-1.5 text-xs text-gray-400
                               hover:text-primary-600 transition-colors mb-6"
                  >
                    <ArrowLeft size={12} />
                    Quay về trang chủ
                  </Link>
                  <h1 className="text-2xl font-bold text-gray-900 mt-1">Đăng nhập</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    Nhập thông tin để truy cập hệ thống điểm danh
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="label">MSSV hoặc Email</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-10"
                        placeholder="SE123456 hoặc email@fpt.edu.vn"
                        value={form.identifier}
                        onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Mật khẩu</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-10 pr-11"
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400
                                   hover:text-gray-600 transition-colors"
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary btn-lg btn-full flex items-center justify-center gap-2 mt-1"
                  >
                    {loading
                      ? <Spinner size="sm" className="border-white/30 border-t-white" />
                      : <ChevronRight size={16} />
                    }
                    {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Step: OTP ── */}
            {step === 'otp' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                    <ShieldCheck size={24} className="text-primary-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Xác thực thiết bị</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    Mã OTP 6 chữ số đã được gửi đến email của bạn. Kiểm tra hộp thư đến (và thư rác).
                  </p>
                </div>

                <form onSubmit={handleOtp} className="space-y-5">
                  <div>
                    <label className="label text-center block">Nhập mã OTP</label>
                    <input
                      className="input text-center text-2xl font-bold tracking-[0.5em]"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="······"
                      inputMode="numeric"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="btn-primary btn-lg btn-full"
                  >
                    {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    Xác thực
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('login'); setOtp(''); }}
                    className="btn-ghost btn-md btn-full text-gray-500 flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft size={14} />
                    Quay lại đăng nhập
                  </button>
                </form>
              </div>
            )}

            {/* ── Step: Change Password ── */}
            {step === 'change-password' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                    <Lock size={24} className="text-amber-500" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Đặt mật khẩu mới</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    Đây là lần đăng nhập đầu tiên. Vui lòng đặt mật khẩu cá nhân để tiếp tục.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="label">Mật khẩu tạm thời</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-10"
                        type="password"
                        placeholder="••••••••"
                        value={newPass.current}
                        onChange={(e) => setNewPass({ ...newPass, current: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Mật khẩu mới</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-10 pr-11"
                        type={showNew ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPass.new}
                        onChange={(e) => setNewPass({ ...newPass, new: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Xác nhận mật khẩu mới</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-10"
                        type="password"
                        placeholder="••••••••"
                        value={newPass.confirm}
                        onChange={(e) => setNewPass({ ...newPass, confirm: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary btn-lg btn-full mt-2">
                    {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    Lưu &amp; Vào hệ thống
                  </button>
                </form>
              </div>
            )}

            <p className="text-gray-400 text-xs text-center mt-10">
              © 2026 FPT University · Hệ thống điểm danh sự kiện
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
