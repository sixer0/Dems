/**
 * Region error boundary for the Audit view (the Network & Time card boundary's pattern, copied; P6:
 * another feature's files are not shared code). One failing region (chain strip, list, detail)
 * never blanks the screen:
 *
 * 1. user feedback: a card with the shared panel copy in place of the failed region;
 * 2. persistent logging: the error goes to the runtime log (`dems.mobile.log.v1`) with the region
 *    name and the component stack (no user data);
 * 3. graceful degradation: a rate-limited Retry (3 s, then 6 s, then 12 s cooldown with a
 *    countdown; at most 3 retries, then "Max retries reached").
 */
import { Button, Card } from 'heroui-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '@/i18n';
import { reportRuntimeIssue } from '@/runtime';

export const AUDIT_RETRY_BASE_MS = 3_000;
export const AUDIT_MAX_RETRIES = 3;

/** Cooldown after the n-th retry (1-based): 3 s, 6 s, 12 s, capped at 15 s. */
export function auditRetryCooldownMs(attempt: number): number {
  return Math.min(AUDIT_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), 15_000);
}

interface AuditBoundaryProps {
  /** Region name for the log record and the fallback testID (`audit-error-<name>`). */
  name: string;
  children: ReactNode;
}

interface AuditBoundaryState {
  failed: boolean;
  retries: number;
  cooldownS: number;
}

export class AuditBoundary extends Component<AuditBoundaryProps, AuditBoundaryState> {
  override state: AuditBoundaryState = { failed: false, retries: 0, cooldownS: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError(): Partial<AuditBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeIssue('error', `audit.region.${this.props.name}`, error, {
      region: this.props.name,
      componentStack: info.componentStack ?? null,
      retries: this.state.retries,
    });
  }

  override componentWillUnmount(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private readonly retry = () => {
    if (this.state.cooldownS > 0 || this.state.retries >= AUDIT_MAX_RETRIES) return;
    const attempt = this.state.retries + 1;
    const cooldownS = Math.ceil(auditRetryCooldownMs(attempt) / 1000);
    this.setState({ failed: false, retries: attempt, cooldownS });
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.setState((prev) => {
        const next = Math.max(0, prev.cooldownS - 1);
        if (next === 0 && this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        return { cooldownS: next };
      });
    }, 1000);
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const { retries, cooldownS } = this.state;
    const exhausted = retries >= AUDIT_MAX_RETRIES;
    const label = exhausted
      ? i18n.t('common.errors.maxRetries')
      : cooldownS > 0
        ? i18n.t('common.actions.retryIn', { seconds: cooldownS })
        : i18n.t('common.actions.retry');
    return (
      <Card testID={`audit-error-${this.props.name}`} className="rounded-xl">
        <Card.Header>
          <Card.Title>{i18n.t('common.errors.panelTitle')}</Card.Title>
          <Card.Description>{i18n.t('features.audit.errors.panel')}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button
            testID={`audit-retry-${this.props.name}`}
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
