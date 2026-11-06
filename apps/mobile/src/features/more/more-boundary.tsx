/**
 * Section error boundary for More. One failing section (operator card, console tiles, links,
 * footer) never blanks the screen:
 *
 * 1. user feedback: a card with the shared panel copy (`common.errors.panelTitle` / `panelBody`);
 * 2. persistent logging: the error goes to the runtime log (`dems.mobile.log.v1`, S73-9) with the
 *    section name and the component stack (no user data);
 * 3. graceful degradation: a rate-limited Retry (cooldown 3 s, then 6 s, then 12 s, shown as a
 *    countdown; at most 3 retries, then "Max retries reached").
 *
 * The cooldown runs on the simulator clock (`selectClockSecond`), not on a wall-clock timer, so it
 * follows the same time base as the rest of the app and the manual clock in tests.
 */
import { Button, Card } from 'heroui-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { selectClockSecond, useSim } from '@dems/shared/sim';
import { reportRuntimeIssue } from '@/runtime';

export const SECTION_RETRY_BASE_S = 3;
export const SECTION_MAX_RETRIES = 3;

/** Cooldown after the n-th retry (1-based), in seconds: 3, 6, 12 (capped at 15). */
export function sectionRetryCooldownS(attempt: number): number {
  return Math.min(SECTION_RETRY_BASE_S * 2 ** Math.max(0, attempt - 1), 15);
}

interface MoreBoundaryProps {
  /** Section name for the log record and the fallback testIDs (`more-error-<name>`). */
  name: string;
  children: ReactNode;
}

interface MoreBoundaryState {
  failed: boolean;
  retries: number;
  /** Simulator second from which Retry is allowed again. */
  retryAtS: number;
}

export class MoreBoundary extends Component<MoreBoundaryProps, MoreBoundaryState> {
  override state: MoreBoundaryState = { failed: false, retries: 0, retryAtS: 0 };

  static getDerivedStateFromError(): Partial<MoreBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeIssue('error', `more.section.${this.props.name}`, error, {
      section: this.props.name,
      componentStack: info.componentStack ?? null,
      retries: this.state.retries,
    });
  }

  private readonly retry = (nowS: number) => {
    if (nowS < this.state.retryAtS || this.state.retries >= SECTION_MAX_RETRIES) return;
    const attempt = this.state.retries + 1;
    this.setState({ failed: false, retries: attempt, retryAtS: nowS + sectionRetryCooldownS(attempt) });
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <SectionFallback
        name={this.props.name}
        retries={this.state.retries}
        retryAtS={this.state.retryAtS}
        onRetry={this.retry}
      />
    );
  }
}

function SectionFallback({ name, retries, retryAtS, onRetry }: { name: string; retries: number; retryAtS: number; onRetry(nowS: number): void }) {
  const { t } = useTranslation();
  const nowS = useSim(selectClockSecond);
  const exhausted = retries >= SECTION_MAX_RETRIES;
  const waitS = Math.max(0, retryAtS - nowS);
  const label = exhausted
    ? t('common.errors.maxRetries')
    : waitS > 0
      ? t('common.actions.retryIn', { seconds: waitS })
      : t('common.actions.retry');
  return (
    <Card testID={`more-error-${name}`} className="rounded-xl">
      <Card.Header>
        <Card.Title>{t('common.errors.panelTitle')}</Card.Title>
        <Card.Description>{t('common.errors.panelBody')}</Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button
          testID={`more-retry-${name}`}
          variant="outline"
          size="sm"
          isDisabled={exhausted || waitS > 0}
          accessibilityHint={t('features.more.boundary.retryHint')}
          onPress={() => onRetry(nowS)}
        >
          <Button.Label>{label}</Button.Label>
        </Button>
      </Card.Footer>
    </Card>
  );
}
