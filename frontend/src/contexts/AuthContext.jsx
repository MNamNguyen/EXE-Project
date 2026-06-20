import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authApi } from '../services/api';
import { decodeToken, msUntilExpiry } from '../utils/token';

const AuthContext = createContext(null);

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutTimer = useRef(null);

  const logout = useCallback(() => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    logoutTimer.current = null;
    clearSession();
    setUser(null);
  }, []);

  // Schedule an automatic logout for the exact moment the JWT expires, so an
  // open tab never keeps showing a dead session (e.g. the user comes back the
  // next day). The 401 interceptor in api.js is the safety net for API calls;
  // this handles the "tab left open, no requests" case.
  const scheduleAutoLogout = useCallback((token) => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    const ms = msUntilExpiry(token);
    if (ms <= 0) { logout(); return; }
    // Our tokens live <= 1 day, well under setTimeout's ~24.8-day ceiling.
    logoutTimer.current = setTimeout(() => {
      logout();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }, ms);
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const payload = decodeToken(token);

    // No token, malformed token, or already expired → start completely clean.
    // This is what makes a stale session (and any profile cached with it)
    // disappear instead of resurrecting the old account.
    if (!token || !payload || msUntilExpiry(token) <= 0) {
      clearSession();
      setLoading(false);
      return;
    }

    scheduleAutoLogout(token);

    // Restore the cached profile ONLY if it belongs to THIS token's user.
    // A profile left over from a previous account (different id) is dropped,
    // so we never render someone else's identity for the current token.
    const cached = localStorage.getItem('user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.id === payload.userId) {
          setUser(parsed);
        } else {
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);

    // Verify the token and refresh the profile from the server (source of
    // truth). 401 → interceptor clears storage + redirects to /login.
    // 503 / network (cold start) → keep the cached session; data pages retry.
    authApi.getMe()
      .then(({ data }) => {
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {});

    // Keep tabs in sync: if another tab logs out or signs in as a different
    // account, reflect it here instead of showing a stale identity.
    const onStorage = (e) => {
      if (e.key !== 'token') return;
      if (!e.newValue) {
        logout();
      } else if (e.newValue !== token) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
  }, [scheduleAutoLogout, logout]);

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    scheduleAutoLogout(token);
  }, [scheduleAutoLogout]);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
