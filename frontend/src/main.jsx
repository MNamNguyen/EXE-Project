import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            },
            success: {
              style: { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' },
              iconTheme: { primary: '#16A34A', secondary: '#F0FDF4' },
            },
            error: {
              style: { background: '#FFF1F2', color: '#9F1239', border: '1px solid #FECDD3' },
              iconTheme: { primary: '#E11D48', secondary: '#FFF1F2' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
