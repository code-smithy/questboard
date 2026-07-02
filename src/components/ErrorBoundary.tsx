import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Questboard failed to render', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell" role="alert">
          <section className="panel hero-panel">
            <p className="eyebrow">Something went wrong</p>
            <h1>Questboard could not finish loading.</h1>
            <p>
              Refresh the page and check that the GitHub Pages deployment has Supabase environment variables configured.
            </p>
            <pre className="error-message">{this.state.error.message}</pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
