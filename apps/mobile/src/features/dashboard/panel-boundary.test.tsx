// Home panel error boundary (step 77): fallback copy, a persisted log record and a rate-limited retry.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import { Text } from 'react-native';
import { i18n } from '@/i18n';
import { runtimeLog } from '@/runtime';
import { PanelBoundary } from './panel-boundary';

const failing = { on: true };
function Flaky() {
  if (failing.on) throw new Error('panel exploded');
  return <Text testID="panel-ok">ok</Text>;
}

describe('PanelBoundary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    failing.on = true;
  });
  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the shared panel copy, logs the error, and retries with a 3 s cooldown', () => {
    const write = jest.spyOn(runtimeLog, 'write');
    render(
      <HeroUINativeProvider>
        <PanelBoundary name="tiles">
          <Flaky />
        </PanelBoundary>
      </HeroUINativeProvider>,
    );
    expect(screen.getByTestId('home-panel-error-tiles')).toBeTruthy();
    expect(screen.getByText(i18n.t('common.errors.panelTitle'))).toBeTruthy();
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', source: 'dashboard.panel.tiles' }));

    // Retry while still failing: the fallback returns with a countdown and the button is disabled.
    fireEvent.press(screen.getByTestId('home-panel-retry-tiles'));
    expect(screen.getByText(i18n.t('common.actions.retryIn', { seconds: 3 }))).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(screen.getByText(i18n.t('common.actions.retry'))).toBeTruthy();

    // The panel recovers on the next retry.
    failing.on = false;
    fireEvent.press(screen.getByTestId('home-panel-retry-tiles'));
    expect(screen.getByTestId('panel-ok')).toBeTruthy();
  });
});
