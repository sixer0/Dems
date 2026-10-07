/**
 * Card error boundary for the Network & Time screen (same pattern as the Home panel boundary; P6:
 * another feature's files are not shared code, so this feature keeps its own copy). One failing
 * card never blanks the screen:
 *
 * 1. user feedback: a card with the shared panel copy in place of the failed card;
 * 2. persistent logging: the error goes to the runtime log (`dems.mobile.log.v1`) with the card
 *    name and the component stack (no user data);
 * 3. graceful degradation: a rate-limited Retry (3 s, then 6 s, then 12 s cooldown with a
 *    countdown; at most 3 retries, then "Max retries reached").
 */
import { Button, Card } from 'heroui-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '@/i18n';
import { reportRuntimeIssue } from '@/runtime';

export const CARD_RETRY_BASE_MS = 3_000;
export const CARD_MAX_RETRIES = 3;

/** Cooldown after the n-th retry (1-based): 3 s, 6 s, 12 s, capped at 15 s. */
export function cardRetryCooldownMs(attempt: number): number {
  return Math.min(CARD_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), 15_000);
}

interface CardBoundaryProps {
  /** Card name for the log record and the fallback testID (`network-time-error-<name>`). */
  name: string;
  children: ReactNode;
}

interface CardBoundaryState {
  failed: boolean;
  retries: number;
  cooldownS: number;
}

export class CardBoundary extends Component<CardBoundaryProps, CardBoundaryState> {
  override state: CardBoundaryState = { failed: false, retries: 0, cooldownS: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError(): Partial<CardBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeIssue('error', `network-time.card.${this.props.name}`, error, {
      card: this.props.name,
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
    if (this.state.cooldownS > 0 || this.state.retries >= CARD_MAX_RETRIES) return;
    const attempt = this.state.retries + 1;
    const cooldownS = Math.ceil(cardRetryCooldownMs(attempt) / 1000);
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
    const exhausted = retries >= CARD_MAX_RETRIES;
    const label = exhausted
      ? i18n.t('common.errors.maxRetries')
      : cooldownS > 0
        ? i18n.t('common.actions.retryIn', { seconds: cooldownS })
        : i18n.t('common.actions.retry');
    return (
      <Card testID={`network-time-error-${this.props.name}`} className="rounded-xl">
        <Card.Header>
          <Card.Title>{i18n.t('common.errors.panelTitle')}</Card.Title>
          <Card.Description>{i18n.t('features.network-time.errors.panel')}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button
            testID={`network-time-retry-${this.props.name}`}
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
