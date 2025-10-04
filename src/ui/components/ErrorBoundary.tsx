// Error Boundary - Prevents cascading failures
// Owner: George (Architecture)

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send error to monitoring service (e.g., Sentry)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="max-w-2xl bg-gray-800 border-2 border-red-500 rounded-lg p-8 m-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
              <div>
                <h1 className="text-2xl font-bold text-white">Something Went Wrong</h1>
                <p className="text-gray-400">
                  {this.props.fallbackMessage || 'An unexpected error occurred'}
                </p>
              </div>
            </div>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-700 overflow-auto max-h-64">
                <p className="text-red-400 font-mono text-sm font-bold mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold transition-colors"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white font-semibold transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* User Guidance */}
            <div className="mt-6 p-4 bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded">
              <p className="text-yellow-200 text-sm">
                <strong>What you can do:</strong>
              </p>
              <ul className="text-yellow-300 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>Click "Try Again" to continue without reloading</li>
                <li>Click "Reload Page" to start fresh</li>
                <li>If the problem persists, check the browser console for details</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
