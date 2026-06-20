import { Routes, Route, Navigate } from 'react-router-dom';
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

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
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

      {/* Events — BTC/ADMIN/LECTURER */}
      <Route path="/events" element={<RequireAuth roles={['ADMIN', 'BTC', 'LECTURER']}><EventList /></RequireAuth>} />
      <Route path="/events/new" element={<RequireAuth roles={['ADMIN', 'BTC']}><EventCreate /></RequireAuth>} />
      <Route path="/events/:id" element={<RequireAuth roles={['ADMIN', 'BTC', 'LECTURER']}><EventDetail /></RequireAuth>} />

      {/* Admin */}
      <Route path="/admin/users" element={<RequireAuth roles={['ADMIN']}><UserManagement /></RequireAuth>} />

      {/* Reports */}
      <Route path="/reports/fraud" element={<RequireAuth roles={['ADMIN', 'BTC']}><FraudLogs /></RequireAuth>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
