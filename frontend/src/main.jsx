import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConfirmProvider } from './components/ui/Modal';
import ErrorBoundary from './components/ErrorBoundary';
import useMediaQuery from './hooks/useMediaQuery';
import App from './App';
import './index.css';

// Toast: đáy giữa ở màn rộng; dưới sm lên đỉnh màn, để không che nút chính của form ở đáy.
// Khung theo token (tối theo giao diện tối), icon màu theo nghĩa.
function AppToaster() {
  const isSmall = useMediaQuery('(max-width: 639px)');
  return (
    <Toaster
      position={isSmall ? 'top-center' : 'bottom-center'}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--surface-overlay)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: 'var(--elevation-popover)',
          padding: '12px 12px 12px 16px',
          fontSize: '14px',
          lineHeight: '20px',
          minWidth: '18rem',
          maxWidth: '28rem',
        },
        success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--surface-overlay)' } },
        error: { iconTheme: { primary: 'var(--error-text)', secondary: 'var(--surface-overlay)' } },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <App />
              <AppToaster />
            </ConfirmProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
