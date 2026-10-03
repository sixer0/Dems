/**
 * Error boundary around each region of the Finalization and Session Summary screens. A render crash
 * in one region never blanks the screen and never touches the session or the evidence:
 *
 * 1. user feedback: a card with plain copy (`features.<scope>.error.*`) in place of the region;
 * 2. persistent logging: the error goes to the runtime log (`dems.mobile.log.v1`, step 73) with the
 *    region name and the component stack (no evidence content, no operator data);
 * 3. graceful degradation: a rate-limited "Try again" (cooldown 3 s, then 6 s, then 12 s with a
 *    visible countdown; at most 3 retries, then a "reopen the app" line).
 *
 * Start Session and Home keep the same pattern in their own folders (a shared component would sit
 * outside the screen folders, P6); this one serves step 80's two folders.
 */
import { Button, Card } from 'heroui-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text } from 'react-native';
import { i18n } from '@/i18n';
import { reportRuntimeIssue } from '@/runtime';

export const FLOW_RETRY_BASE_MS = 3_000;
export const FLOW_MAX_RETRIES = 3;

/** Cooldown after the n-th retry (1-based): 3 s, 6 s, 12 s, capped at 15 s. */
export function flowRetryCooldownMs(attempt: number): number {
  return Math.min(FLOW_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), 15_000);
}

export type FlowScope = 'session-finalizing' | 'session-summary';

interface FlowBoundaryProps {
  scope: FlowScope;
  /** Region name for the log record and the fallback testID (`<scope>-error-<name>`). */
  name: string;
  children: ReactNode;
}

interface FlowBoundaryState {
  failed: boolean;
  retries: number;
  cooldownS: number;
}

export class FlowBoundary extends Component<FlowBoundaryProps, FlowBoundaryState> {
  override state: FlowBoundaryState = { failed: false, retries: 0, cooldownS: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  static getDerivedStateFromError(): Partial<FlowBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeIssue('error', `features.${this.props.scope}.region.${this.props.name}`, error, {
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
    if (this.state.cooldownS > 0 || this.state.retries >= FLOW_MAX_RETRIES) return;
    const attempt = this.state.retries + 1;
    this.clearTimer();
    this.setState({ failed: false, retries: attempt, cooldownS: Math.ceil(flowRetryCooldownMs(attempt) / 1000) });
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
    const { scope, name } = this.props;
    const t = i18n.t.bind(i18n);
    const exhausted = retries >= FLOW_MAX_RETRIES;
    const label = exhausted
      ? t(`features.${scope}.error.maxRetries`)
      : cooldownS > 0
        ? t(`features.${scope}.error.retryIn`, { seconds: cooldownS })
        : t(`features.${scope}.error.retry`);
    return (
      <Card className="rounded-xl" testID={`${scope}-error-${name}`}>
        <Card.Body className="gap-2">
          <Text accessibilityRole="header" className="text-body font-semibold text-foreground">
            {t(`features.${scope}.error.title`)}
          </Text>
          <Text className="text-body text-muted">{t(`features.${scope}.error.body`)}</Text>
          <Button variant="outline" size="sm" isDisabled={exhausted || cooldownS > 0} onPress={this.retry}>
            <Button.Label>{label}</Button.Label>
          </Button>
        </Card.Body>
      </Card>
    );
  }
}
