import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container flex flex-col items-center justify-center text-center" style={{ minHeight: "calc(100vh - 72px)" }}>
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold gradient-text mb-2">Something Went Wrong</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <p className="text-xs text-red-400/60 mb-6 glass-subtle p-3 rounded-lg max-w-lg break-all">
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
