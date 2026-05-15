"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible in browser DevTools console — helps diagnose the exact crash
    console.error("[DashboardErrorBoundary] caught:", error.message);
    console.error("[DashboardErrorBoundary] component stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-100 space-y-3">
          <p className="font-serif text-body-lg font-semibold text-red-700">
            Something went wrong loading this section.
          </p>
          <p className="font-sans text-body-sm text-red-500">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="font-sans text-body-sm text-red-600 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
