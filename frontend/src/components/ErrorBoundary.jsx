import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Catches render-time crashes anywhere in the tree so the user sees a
// recoverable message instead of a silent blank white page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Surface in the console for debugging; replace with a logging service later.
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-6">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Đã xảy ra lỗi hiển thị</h1>
          <p className="text-sm text-gray-500 mt-1.5">
            Trang gặp sự cố không mong muốn. Vui lòng tải lại trang để tiếp tục.
          </p>
          <button
            onClick={this.handleReload}
            className="btn-primary btn-md mt-5 inline-flex items-center gap-2"
          >
            <RefreshCw size={15} /> Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
