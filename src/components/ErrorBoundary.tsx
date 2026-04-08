import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] w-full flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-2xl border border-red-500/20 backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Oops, something went wrong</h2>
          <p className="text-slate-400 text-center max-w-md mb-8">
            The application encountered an unexpected error. We've logged the issue and you can try refreshing the page.
          </p>
          
          {this.state.error && (
            <div className="w-full max-w-lg bg-black/40 rounded-lg p-4 mb-8 overflow-auto max-h-40 border border-white/5">
              <code className="text-xs text-red-400 font-mono">
                {this.state.error.toString()}
              </code>
            </div>
          )}

          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all active:scale-95 shadow-lg shadow-blue-600/20"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh Page
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all active:scale-95"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
