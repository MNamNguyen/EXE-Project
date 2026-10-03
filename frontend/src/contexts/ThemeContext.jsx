import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Giao diện Sáng / Tối / Theo hệ thống. Lựa chọn lưu ở localStorage 'theme'; đoạn script nhỏ trong
// index.html đọc cùng khoá đó để gắn class `dark` trước khi vẽ trang (không nháy trắng).
const KEY = 'theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function readPref() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref) {
  const isDark = pref === 'dark' || (pref === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', isDark);
}

const ThemeContext = createContext({ theme: 'system', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readPref);

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return undefined;
    // Theo hệ thống: máy đổi sáng/tối giữa chừng thì trang đổi theo
    const mq = media();
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Trình duyệt chặn lưu trữ: vẫn đổi cho phiên này
    }
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
