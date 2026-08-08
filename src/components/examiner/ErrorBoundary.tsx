"use client";

import React from "react";
import { logger } from "@/lib/logger";

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

/** Error boundary that catches client-side errors and shows a friendly
 *  error message instead of crashing the entire page.
 *
 *  When wrapping individual views in AppShell's renderView(), a crash in
 *  one component (e.g., StudentDashboard) shows an error card IN PLACE
 *  of that component — the rest of the page (sidebar, header) stays
 *  functional. The user can click "Try Again" to re-render the component.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("[ErrorBoundary] Caught", { error: error?.message, errorInfo });
  }

  handleRetry = () => {
    this.setState(prev => ({ hasError: false, error: undefined, retryCount: prev.retryCount + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="max-w-lg w-full space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-2">
                <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-foreground">This section hit an error</h2>
              <p className="text-xs text-muted-foreground">
                The rest of the app is still working. Try again, or refresh the page if it persists.
              </p>
            </div>
            {this.state.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <p className="text-[10px] font-mono text-destructive break-all">
                  {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <details className="text-[9px] text-muted-foreground">
                    <summary className="cursor-pointer">Stack trace</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-md border border-border text-foreground text-xs font-medium hover:bg-muted"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
