import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  /** Region name shown to the user, e.g. "Document viewer". */
  region: string;
  /** Changing this value resets the boundary (e.g. when the user opens another document). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
  resetKey: unknown;
}

/**
 * Per-region error isolation: a crash in the comments panel must not take down the viewer or grid.
 * (Class component — React still has no hook equivalent of componentDidCatch.)
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Production: report to the observability backend (Sentry / App Insights) with the component stack.
    console.error(`[${this.props.region}]`, error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorFallback
        region={this.props.region}
        error={this.state.error}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

interface ErrorFallbackProps {
  region: string;
  error: Error;
  onRetry?: () => void;
}

export function ErrorFallback({ region, error, onRetry }: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <AlertTriangle className="text-danger-500 size-8" aria-hidden="true" />
      <div>
        <p className="font-medium">{region} could not be displayed</p>
        <p className="text-muted mt-1 max-w-sm text-sm">{error.message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
