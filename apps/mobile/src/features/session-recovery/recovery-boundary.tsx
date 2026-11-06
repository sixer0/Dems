/**
 * Error boundary around each region of the Recovery Status screen. A render crash in one region never
 * blanks the screen and never touches the session or the evidence:
 *
 * 1. user feedback: a card with plain copy (`features.session-recovery.error.*`) in place of the region;
 * 2. persistent logging: the error goes to the runtime log (`dems.mobile.log.v1`, step 73) with the
 *    region name and the component stack (no evidence content, no operator data);
 * 3. graceful degradation: a rate-limited "Try again" (cooldown 3 s, then 6 s, then 12 s with a
 *    visible countdown; at most 3 retries, then a "reopen the app" line).
 *
 * The same pattern as the Finalization screen's boundary (step 80), kept in this folder (P6).
 */
import { Button, Card } from 'heroui-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text } from 'react-native';
import { i18n } from '@/i18n';
import { reportRuntimeIssue } from '@/runtime';

export const RECOVERY_RETRY_BASE_MS = 3_000;
export const RECOVERY_MAX_RETRIES = 3;

/** Cooldown after the n-th retry (1-based): 3 s, 6 s, 12 s, capped at 15 s. */
export function recoveryRetryCooldownMs(attempt: number): number {
  return Math.min(RECOVERY_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), 15_000);
}

interface RecoveryBoundaryProps {
  /** Region name for the log record and the fallback testID (`recovery-error-<name>`). */
  name: string;
  children: ReactNode;
}

interface RecoveryBoundaryState {
  failed: boolean;
  retries: number;
  cooldownS: number;
}

export class RecoveryBoundary extends Component<RecoveryBoundaryProps, RecoveryBoundaryState> {
  override state: RecoveryBoundaryState = { failed: false, retries: 0, cooldownS: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError(): Partial<RecoveryBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeIssue('error', `features.sessionRecovery.region.${this.props.name}`, error, {
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
    if (this.state.cooldownS > 0 || this.state.retries >= RECOVERY_MAX_RETRIES) return;
    const attempt = this.state.retries + 1;
    this.clearTimer();
    this.setState({ failed: false, retries: attempt, cooldownS: Math.ceil(recoveryRetryCooldownMs(attempt) / 1000) });
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
    const exhausted = retries >= RECOVERY_MAX_RETRIES;
    const label = exhausted
      ? t('features.session-recovery.error.maxRetries')
      : cooldownS > 0
        ? t('features.session-recovery.error.retryIn', { seconds: cooldownS })
        : t('features.session-recovery.error.retry');
    return (
      <Card className="rounded-xl" testID={`recovery-error-${this.props.name}`}>
        <Card.Body className="gap-2">
          <Text accessibilityRole="header" className="text-body font-semibold text-foreground">
            {t('features.session-recovery.error.title')}
          </Text>
          <Text className="text-body text-muted">{t('features.session-recovery.error.body')}</Text>
          <Button variant="outline" size="sm" isDisabled={exhausted || cooldownS > 0} onPress={this.retry}>
            <Button.Label>{label}</Button.Label>
          </Button>
        </Card.Body>
      </Card>
    );
  }
}
