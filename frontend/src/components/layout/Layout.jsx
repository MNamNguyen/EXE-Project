import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden bg-white border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-gray-600 hover:bg-surface transition-colors"
          >
            <Menu size={22} />
          </button>

          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="FPT Event" className="w-7 h-7" />
            <span className="font-bold text-gray-900 text-sm">FPT Event</span>
          </Link>

          <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
