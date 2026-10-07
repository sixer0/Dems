// Post-review fix FXR-M, finding W93-13 (code review W93, decision D243; the mobile analogue of R12).
//
// The route error screen printed `console.error('[mobile] route error', { message, stack })` IN RENDER: once
// per render, so again every second of the retry countdown (3 s, then 6 s, then 12 s), each a red LogBox
// entry, and the crash never reached the persistent runtime log (`dems.mobile.log.v1`, S73-9). Now the screen
// writes ONE `app.routeError` record per error and prints nothing itself; the runtime log mirrors an `error`
// record to the console once (the app-wide DX-6 rule for app faults).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import { runtimeLog } from '@/runtime/log';
import { RouteErrorFallback } from '../route-error-fallback';

const routeErrors = (): number => runtimeLog.records().filter((record) => record.source === 'app.routeError').length;
const MARKER = 'FXR-M route error marker';

let consoleError: jest.SpiedFunction<typeof console.error>;
beforeEach(() => {
  jest.useFakeTimers();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  consoleError.mockRestore();
});

/** Console lines that carry the error's text, and which of them are not the runtime log's own mirror. */
function linesWithText(): { all: number; notMirror: number } {
  const calls = consoleError.mock.calls.filter((args: unknown[]) => JSON.stringify(args.map((a: unknown) => (a instanceof Error ? a.message : a))).includes(MARKER));
  return { all: calls.length, notMirror: calls.filter((args: unknown[]) => args[0] !== '[runtime]').length };
}

describe('W93-13: a route error is logged once, persistently, and never printed in render', () => {
  it('through two retries and their countdowns: ONE app.routeError record, the screen itself prints nothing', () => {
    const before = routeErrors();
    const error = new Error(MARKER);
    const retry = jest.fn(async () => undefined);
    render(
      <HeroUINativeProvider>
        <RouteErrorFallback error={error} retry={retry} />
      </HeroUINativeProvider>,
    );
    expect(screen.getByTestId('route-error-fallback')).toBeTruthy();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.press(screen.getByTestId('route-error-retry'));
      for (let s = 0; s < 13; s += 1) {
        act(() => {
          jest.advanceTimersByTime(1_000);
        });
      }
    }
    expect(retry).toHaveBeenCalledTimes(2);
    expect(routeErrors() - before).toBe(1);
    const lines = linesWithText();
    expect(lines.notMirror).toBe(0);
    expect(lines.all).toBeLessThanOrEqual(1);
  });
});
