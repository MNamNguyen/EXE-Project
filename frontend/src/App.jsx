import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Spinner from './components/ui/Spinner';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import StudentDashboard from './pages/student/StudentDashboard';
import EventList from './pages/btc/EventList';
import EventCreate from './pages/btc/EventCreate';
import EventDetail from './pages/btc/EventDetail';
import QRDisplay from './pages/btc/QRDisplay';
import ScanLanding from './pages/scan/ScanLanding';
import UserManagement from './pages/admin/UserManagement';
import FraudLogs from './pages/FraudLogs';
import MyAttendance from './pages/student/MyAttendance';
import PublicEventList from './pages/public/PublicEventList';
import EventRegister from './pages/public/EventRegister';
import SharedReport from './pages/public/SharedReport';
import ClassManagement from './pages/classes/ClassManagement';
import ClassDetail from './pages/classes/ClassDetail';
import FeedbackTemplates from './pages/feedback/FeedbackTemplates';
import EventFeedback from './pages/student/EventFeedback';
import MyCertificates from './pages/student/MyCertificates';

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>;
  if (user) {
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get('redirect') || '/dashboard';
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <Routes>
      {/* Landing */}
      <Route path="/" element={<RootRoute />} />

      {/* Auth */}
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

      {/* Đăng ký tham gia sự kiện — công khai, không cần đăng nhập */}
      <Route path="/dang-ky" element={<PublicEventList />} />
      <Route path="/dang-ky/:id" element={<EventRegister />} />

      {/* Báo cáo BTC chia sẻ — xem được không cần đăng nhập */}
      <Route path="/bao-cao/:token" element={<SharedReport />} />

      {/* QR Scan — accessible but requires login (redirects to login if needed) */}
      <Route path="/scan" element={<ScanLanding />} />

      {/* QR Display — requires BTC/ADMIN (opened in new tab) */}
      <Route path="/events/:id/qr" element={
        <RequireAuth roles={['ADMIN', 'BTC']}>
          <QRDisplay />
        </RequireAuth>
      } />

      {/* Student */}
      <Route path="/dashboard" element={<RequireAuth><StudentDashboard /></RequireAuth>} />
      <Route path="/my-attendance" element={<RequireAuth><MyAttendance /></RequireAuth>} />
      {/* Link BTC phát cho người tham dự — tự chuyển qua /login?redirect= nếu chưa đăng nhập */}
      <Route path="/feedback/:eventId" element={<EventFeedback />} />
      {/* Link trong email "đã có chứng nhận" trỏ về đây */}
      <Route path="/my-certificates" element={<RequireAuth><MyCertificates /></RequireAuth>} />

      {/* Events — BTC/ADMIN/LECTURER */}
      <Route path="/events" element={<RequireAuth roles={['ADMIN', 'BTC', 'LECTURER']}><EventList /></RequireAuth>} />
      <Route path="/events/new" element={<RequireAuth roles={['ADMIN', 'BTC']}><EventCreate /></RequireAuth>} />
      <Route path="/events/:id" element={<RequireAuth roles={['ADMIN', 'BTC', 'LECTURER']}><EventDetail /></RequireAuth>} />

      {/* Lớp học — BTC/Admin */}
      <Route path="/classes" element={<RequireAuth roles={['ADMIN', 'BTC']}><ClassManagement /></RequireAuth>} />
      <Route path="/classes/:id" element={<RequireAuth roles={['ADMIN', 'BTC']}><ClassDetail /></RequireAuth>} />

      {/* Thư viện mẫu đánh giá */}
      <Route path="/feedback-templates" element={<RequireAuth roles={['ADMIN', 'BTC']}><FeedbackTemplates /></RequireAuth>} />

      {/* Admin */}
      <Route path="/admin/users" element={<RequireAuth roles={['ADMIN']}><UserManagement /></RequireAuth>} />

      {/* Reports */}
      <Route path="/reports/fraud" element={<RequireAuth roles={['ADMIN', 'BTC']}><FraudLogs /></RequireAuth>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
