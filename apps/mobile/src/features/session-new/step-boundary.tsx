/**
 * Error boundary around each Start Session region (step content, previews, device column).
 * A render crash in one region never blanks the flow or touches the session:
 *
 * 1. user feedback: a card with plain copy (`features.session-new.error.*`) in place of the region;
 * 2. persistent logging: the error goes to the runtime log (`dems.mobile.log.v1`) with the region
 *    name and the component stack (no form values);
 * 3. graceful degradation: a rate-limited "Try again" (cooldown 3 s, then 6 s, then 12 s with a
 *    visible countdown; at most 3 retries, then "Still failing").
 *
 * The Home screen has the same pattern (`features/dashboard/panel-boundary.tsx`, step 77); a
 * shared component would live outside both feature folders (P6), so each keeps its own.
 */
import { Button, Card } from 'heroui-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text } from 'react-native';
import { i18n } from '@/i18n';
import { reportRuntimeIssue } from '@/runtime';

export const STEP_RETRY_BASE_MS = 3_000;
export const STEP_MAX_RETRIES = 3;

/** Cooldown after the n-th retry (1-based): 3 s, 6 s, 12 s, capped at 15 s. */
export function stepRetryCooldownMs(attempt: number): number {
  return Math.min(STEP_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), 15_000);
}

interface StepBoundaryProps {
  /** Region name for the log record and the fallback testID (`session-new-error-<name>`). */
  name: string;
  children: ReactNode;
}

interface StepBoundaryState {
  failed: boolean;
  retries: number;
  cooldownS: number;
}

export class StepBoundary extends Component<StepBoundaryProps, StepBoundaryState> {
  override state: StepBoundaryState = { failed: false, retries: 0, cooldownS: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError(): Partial<StepBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeIssue('error', `features.sessionNew.region.${this.props.name}`, error, {
      region: this.props.name,
      componentStack: info.componentStack ?? null,
      retries: this.state.retries,
    });
  }

  override componentWillUnmount(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private retry = (): void => {
    if (this.state.cooldownS > 0 || this.state.retries >= STEP_MAX_RETRIES) return;
    const attempt = this.state.retries + 1;
    this.clearTimer();
    this.setState({ failed: false, retries: attempt, cooldownS: Math.ceil(stepRetryCooldownMs(attempt) / 1000) });
    this.timer = setInterval(() => {
      this.setState((previous) => {
        const next = Math.max(0, previous.cooldownS - 1);
        if (next === 0) this.clearTimer();
        return { cooldownS: next };
      });
    }, 1000);
  };

  override render(): ReactNode {
    const { failed, retries, cooldownS } = this.state;
    if (!failed) return this.props.children;
    const t = i18n.t.bind(i18n);
    const exhausted = retries >= STEP_MAX_RETRIES;
    const label = exhausted
      ? t('features.session-new.error.maxRetries')
      : cooldownS > 0
        ? t('features.session-new.error.retryIn', { seconds: cooldownS })
        : t('features.session-new.error.retry');
    return (
      <Card className="rounded-xl" testID={`session-new-error-${this.props.name}`}>
        <Card.Body className="gap-2">
          <Text accessibilityRole="header" className="text-body font-semibold text-foreground">
            {t('features.session-new.error.title')}
          </Text>
          <Text className="text-body text-muted">{t('features.session-new.error.body')}</Text>
          <Button variant="outline" size="sm" isDisabled={exhausted || cooldownS > 0} onPress={this.retry}>
            <Button.Label>{label}</Button.Label>
          </Button>
        </Card.Body>
      </Card>
    );
  }
}
