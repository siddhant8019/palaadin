"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Error Boundary caught an error:", error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to error reporting service (e.g., Sentry)
    this.logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  logErrorToService(error: Error, errorInfo: React.ErrorInfo): void {
    // TODO: Integrate with error tracking service (Sentry, etc.)
    if (process.env.NODE_ENV === "production") {
      // Send to error tracking service
      console.error("Production error:", {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-lg shadow-lg p-8 border border-neutral-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-12 w-12 text-danger" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-800">
                    Oops! Something went wrong
                  </h1>
                  <p className="text-neutral-600 mt-1">
                    We apologize for the inconvenience. An unexpected error has occurred.
                  </p>
                </div>
              </div>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="mb-6 p-4 bg-danger-light rounded-lg border border-danger">
                  <h3 className="font-semibold text-danger mb-2">Error Details:</h3>
                  <p className="text-sm text-neutral-800 font-mono mb-2">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-neutral-600 hover:text-neutral-800">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 text-xs text-neutral-700 overflow-x-auto bg-white p-2 rounded">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-neutral-600 hover:text-neutral-800">
                        Component Stack
                      </summary>
                      <pre className="mt-2 text-xs text-neutral-700 overflow-x-auto bg-white p-2 rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={this.handleReset}
                  className="btn-primary flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="btn-outline flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </button>
              </div>

              <div className="mt-6 p-4 bg-neutral-100 rounded-lg">
                <h4 className="font-semibold text-neutral-800 mb-2">What you can do:</h4>
                <ul className="text-sm text-neutral-600 space-y-1 list-disc list-inside">
                  <li>Try refreshing the page</li>
                  <li>Clear your browser cache and cookies</li>
                  <li>Check your internet connection</li>
                  <li>Contact support if the problem persists</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Route-specific Error Boundary
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error("Route Error:", error);
        // Send to analytics
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Component-specific Error Boundary with custom fallback
 */
interface ComponentErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
}

export function ComponentErrorBoundary({
  children,
  componentName = "Component",
}: ComponentErrorBoundaryProps): JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-danger-light rounded-lg border border-danger">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-danger" />
            <p className="text-sm font-medium text-danger">
              {componentName} failed to load
            </p>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Please try refreshing the page
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Async Error Boundary for suspense boundaries
 */
export function AsyncErrorBoundary({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-[200px] flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-10 w-10 text-danger mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-800">
              Failed to load content
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-sm btn-outline mt-2"
            >
              Retry
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

