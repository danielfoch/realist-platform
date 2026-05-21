import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // Keep console output for local debugging and monitoring pipelines.
    console.error('UI error boundary caught exception', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm">Please refresh the page or try again later.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
