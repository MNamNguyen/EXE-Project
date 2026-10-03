import { Component } from 'react';
import { RefreshCw } from 'lucide-react';

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

    // Trang lỗi đứng riêng: không dùng component nào có thể chính là chỗ vừa hỏng
    return (
      <div className="min-h-screen bg-background px-4 pt-24 sm:pt-40">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">Đã xảy ra lỗi hiển thị</h1>
          <p className="mt-2 text-pretty text-sm/6 text-muted">
            Trang gặp sự cố không mong muốn. Vui lòng tải lại trang để tiếp tục.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary-hover md:min-h-10"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
