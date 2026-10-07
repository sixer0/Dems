/**
 * Panel error boundary for Storage: a copy of step 77's `features/dashboard/panel-boundary.tsx` (P6;
 * web parity: `common.errors.panelTitle` "This panel could not be displayed"). One failing panel
 * never blanks the screen:
 *
 * 1. user feedback: a card with the shared panel copy in place of the panel;
 * 2. persistent logging: the error goes to the runtime log (`dems.mobile.log.v1`, S73-9) with the
 *    panel name and the component stack (no user data);
 * 3. graceful degradation: a rate-limited Retry (3 s, then 6 s, then 12 s cooldown with a
 *    countdown; at most 3 retries, then "Max retries reached").
 */
import { Button, Card } from 'heroui-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '@/i18n';
import { reportRuntimeIssue } from '@/runtime';

export const PANEL_RETRY_BASE_MS = 3_000;
export const PANEL_MAX_RETRIES = 3;

/** Cooldown after the n-th retry (1-based): 3 s, 6 s, 12 s, capped at 15 s. */
export function panelRetryCooldownMs(attempt: number): number {
  return Math.min(PANEL_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), 15_000);
}

interface PanelBoundaryProps {
  /** Panel name for the log record and the fallback testID (`storage-panel-error-<name>`). */
  name: string;
  children: ReactNode;
}

interface PanelBoundaryState {
  failed: boolean;
  retries: number;
  cooldownS: number;
}

export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
  override state: PanelBoundaryState = { failed: false, retries: 0, cooldownS: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError(): Partial<PanelBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeIssue('error', `storage.panel.${this.props.name}`, error, {
      panel: this.props.name,
      componentStack: info.componentStack ?? null,
      retries: this.state.retries,
    });
  }

  override componentDidUpdate(): void {
    if (this.state.cooldownS === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  override componentWillUnmount(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private readonly retry = () => {
    if (this.state.cooldownS > 0 || this.state.retries >= PANEL_MAX_RETRIES) return;
    const attempt = this.state.retries + 1;
    const cooldownS = Math.ceil(panelRetryCooldownMs(attempt) / 1000);
    this.setState({ failed: false, retries: attempt, cooldownS });
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      // W93-24 (FXR-M): the updater stays pure (StrictMode may run it twice); the interval is cleared in
      // `componentDidUpdate` once the countdown is over.
      this.setState((prev) => ({ cooldownS: Math.max(0, prev.cooldownS - 1) }));
    }, 1000);
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const { retries, cooldownS } = this.state;
    const exhausted = retries >= PANEL_MAX_RETRIES;
    const label = exhausted
      ? i18n.t('common.errors.maxRetries')
      : cooldownS > 0
        ? i18n.t('common.actions.retryIn', { seconds: cooldownS })
        : i18n.t('common.actions.retry');
    return (
      <Card testID={`storage-panel-error-${this.props.name}`} className="rounded-xl">
        <Card.Header>
          <Card.Title>{i18n.t('common.errors.panelTitle')}</Card.Title>
          <Card.Description>{i18n.t('common.errors.panelBody')}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button
            testID={`storage-panel-retry-${this.props.name}`}
            variant="outline"
            size="sm"
            isDisabled={exhausted || cooldownS > 0}
            onPress={this.retry}
          >
            <Button.Label>{label}</Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    );
  }
}
