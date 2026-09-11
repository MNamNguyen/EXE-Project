import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Lock, User, ShieldCheck,
  QrCode, MapPin, Clock, Users, ChevronRight, ArrowLeft, KeyRound, Mail, MailCheck,
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
  // Quên mật khẩu: identifier được giữ lại qua bước nhập mã vì API reset cần
  // gửi kèm (backend không trả về userId để tránh dò tài khoản tồn tại).
  // 'password' = MSSV + mật khẩu như cũ; 'otp' = sinh viên nhận mã qua email,
  // không cần nhớ mật khẩu (tiện khi vừa quét QR ở cửa hội trường).
  const [loginMode, setLoginMode] = useState('password');
  const [loginOtp,  setLoginOtp]  = useState('');
  const [forgotId,  setForgotId]  = useState('');
  const [resetForm, setResetForm] = useState({ otp: '', new: '', confirm: '' });
  const [showResetPass, setShowResetPass] = useState(false);

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

  const handleRequestLoginOtp = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim()) return toast.error('Vui lòng nhập MSSV hoặc email');
    setLoading(true);
    try {
      const { data } = await authApi.requestLoginOtp({ identifier: form.identifier.trim() });
      toast.success(data.message);
      setStep('login-otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không gửi được mã đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithOtp = async (e) => {
    e.preventDefault();
    if (loginOtp.length !== 6) return toast.error('Mã đăng nhập gồm 6 chữ số');
    setLoading(true);
    try {
      const { data } = await authApi.loginWithOtp({
        identifier: form.identifier.trim(),
        otp: loginOtp,
      });
      if (data.success) {
        login(data.token, data.user);
        // Không đẩy sang bước đổi mật khẩu: người dùng vào bằng mã email nên
        // không có "mật khẩu hiện tại" để nhập.
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mã đăng nhập không đúng');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotId.trim()) return toast.error('Vui lòng nhập MSSV hoặc email');
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword({ identifier: forgotId.trim() });
      toast.success(data.message);
      setStep('reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không gửi được mã đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (resetForm.otp.length !== 6) return toast.error('Mã xác thực gồm 6 chữ số');
    if (resetForm.new.length < 6) return toast.error('Mật khẩu mới phải ít nhất 6 ký tự');
    if (resetForm.new !== resetForm.confirm) return toast.error('Mật khẩu xác nhận không khớp');
    setLoading(true);
    try {
      await authApi.resetPassword({
        identifier: forgotId.trim(),
        otp: resetForm.otp,
        newPassword: resetForm.new,
      });
      toast.success('Đặt lại mật khẩu thành công! Hãy đăng nhập lại.');
      setForm({ identifier: forgotId.trim(), password: '' });
      setResetForm({ otp: '', new: '', confirm: '' });
      setStep('login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mã xác thực không đúng hoặc đã hết hạn');
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

                {/* Chọn cách đăng nhập */}
                <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-gray-100 rounded-xl">
                  {[
                    { key: 'password', icon: Lock, label: 'Mật khẩu' },
                    { key: 'otp',      icon: Mail, label: 'Mã OTP qua email' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setLoginMode(key)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
                                  transition-colors ${
                        loginMode === key
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={loginMode === 'otp' ? handleRequestLoginOtp : handleLogin}
                  className="space-y-5"
                >
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

                  {loginMode === 'password' && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="label">Mật khẩu</label>
                      <button
                        type="button"
                        onClick={() => { setForgotId(form.identifier); setStep('forgot'); }}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700
                                   transition-colors mb-1.5"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
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
                  )}

                  {loginMode === 'otp' && (
                    <p className="text-xs text-gray-500 bg-primary-50/60 border border-primary-100
                                  rounded-xl px-3.5 py-3 leading-relaxed">
                      Hệ thống sẽ gửi mã 6 chữ số tới email đã đăng ký của bạn — không cần nhớ
                      mật khẩu. Chỉ áp dụng cho tài khoản sinh viên.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary btn-lg btn-full flex items-center justify-center gap-2 mt-1"
                  >
                    {loading
                      ? <Spinner size="sm" className="border-white/30 border-t-white" />
                      : <ChevronRight size={16} />
                    }
                    {loading
                      ? (loginMode === 'otp' ? 'Đang gửi mã...' : 'Đang đăng nhập...')
                      : (loginMode === 'otp' ? 'Gửi mã đăng nhập' : 'Đăng nhập')
                    }
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

            {/* ── Step: Login OTP — nhập mã 6 số nhận qua email ── */}
            {step === 'login-otp' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                    <MailCheck size={24} className="text-primary-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Đăng nhập bằng OTP</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    Mã 6 chữ số đã được gửi tới email đăng ký của <strong>{form.identifier}</strong>.
                    Kiểm tra cả thư rác. Mã có hiệu lực 10 phút.
                  </p>
                </div>

                <form onSubmit={handleLoginWithOtp} className="space-y-5">
                  <div>
                    <label className="label text-center block">Nhập mã đăng nhập</label>
                    <input
                      className="input text-center text-2xl font-bold tracking-[0.5em]"
                      maxLength={6}
                      value={loginOtp}
                      onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="······"
                      inputMode="numeric"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || loginOtp.length !== 6}
                    className="btn-primary btn-lg btn-full"
                  >
                    {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('login'); setLoginOtp(''); }}
                    className="btn-ghost btn-md btn-full text-gray-500 flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft size={14} />
                    Quay lại
                  </button>
                </form>
              </div>
            )}

            {/* ── Step: Forgot password — nhập MSSV/email để nhận mã ── */}
            {step === 'forgot' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                    <Mail size={24} className="text-primary-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Quên mật khẩu</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    Nhập MSSV hoặc email của bạn. Chúng tôi sẽ gửi mã xác thực 6 chữ số
                    đến email đã đăng ký.
                  </p>
                </div>

                <form onSubmit={handleForgot} className="space-y-5">
                  <div>
                    <label className="label">MSSV hoặc Email</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-10"
                        placeholder="SE123456 hoặc email@fpt.edu.vn"
                        value={forgotId}
                        onChange={(e) => setForgotId(e.target.value)}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary btn-lg btn-full">
                    {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
                  </button>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('login')}
                      className="btn-ghost btn-md text-gray-500 flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} />
                      Quay lại đăng nhập
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('reset')}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      Đã có mã?
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Step: Reset password — nhập mã + mật khẩu mới ── */}
            {step === 'reset' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                    <KeyRound size={24} className="text-primary-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Đặt lại mật khẩu</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    Nhập mã 6 chữ số vừa gửi tới email của bạn (kiểm tra cả thư rác) và
                    chọn mật khẩu mới. Mã có hiệu lực trong 15 phút.
                  </p>
                </div>

                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="label text-center block">Mã xác thực</label>
                    <input
                      className="input text-center text-2xl font-bold tracking-[0.5em]"
                      maxLength={6}
                      value={resetForm.otp}
                      onChange={(e) =>
                        setResetForm({ ...resetForm, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })
                      }
                      placeholder="······"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="label">Mật khẩu mới</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-10 pr-11"
                        type={showResetPass ? 'text' : 'password'}
                        placeholder="Ít nhất 6 ký tự"
                        value={resetForm.new}
                        onChange={(e) => setResetForm({ ...resetForm, new: e.target.value })}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPass(!showResetPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showResetPass ? <EyeOff size={16} /> : <Eye size={16} />}
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
                        value={resetForm.confirm}
                        onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || resetForm.otp.length !== 6}
                    className="btn-primary btn-lg btn-full mt-2"
                  >
                    {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    Đặt lại mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('forgot')}
                    className="btn-ghost btn-md btn-full text-gray-500 flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft size={14} />
                    Gửi lại mã
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
