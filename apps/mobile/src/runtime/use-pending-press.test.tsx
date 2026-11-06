// Row M1 (decision D157 DN-7): the ONE pending-press hook of the mobile app, in the runtime.
// LB-1, AC-C-57, AC-C-58 (04_client_integration_spec §8.1): busy at once, the spinner after
// `LIVE_PENDING_REVEAL_MS` on the store's clock, a second press ignored while the command is out.
//
// The hook is driven on a test simulator with a manual clock, so the reveal delay is measured on the
// store's clock to the millisecond. Start Session's screen tests (`features/session-new/live-session-new-handoff.test.tsx`)
// prove the same behaviour through a real control on the real Live source.
import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { LIVE_PENDING_REVEAL_MS } from '@dems/shared/live';
import { SimProvider } from '@dems/shared/sim';
import { usePendingPress as usePendingPressOfStartSession } from '@/features/session-new/use-pending-press';
import { usePendingPress as usePendingPressOfBarrel } from '@/runtime';
import { createTestSim } from './testing/test-sim';
import { usePendingPress, type PendingPress } from './use-pending-press';

/** The simulator publishes its clock in 100 ms steps (`packages/shared/src/sim/engine.ts`, the clock subsystem; §14.7). */
const CLOCK_STEP_MS = 100;
/** So the spinner is due at the first published step at or after the reveal delay: 500 ms after a press on a step. */
const REVEAL_AT_MS = Math.ceil(LIVE_PENDING_REVEAL_MS / CLOCK_STEP_MS) * CLOCK_STEP_MS;

function mountPress() {
  const test = createTestSim();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SimProvider sim={test.sim} autoStart={false}>
      {children}
    </SimProvider>
  );
  const startedAt = test.clock.now();
  const view = renderHook(() => usePendingPress(), { wrapper });
  return {
    current: (): PendingPress => view.result.current,
    /** The store's clock as published, relative to the start. */
    published: () => test.sim.store.getState().clock.now - startedAt,
    /** Moves the store's clock by `ms` (engine-sized steps, a tick after each) inside `act`. */
    elapse(ms: number, stepMs?: number) {
      act(() => test.advance(ms, stepMs));
    },
  };
}

/** Presses the control: the command is held until the returned `release` runs. */
function pressHeld(press: () => PendingPress) {
  const holder: { release: (() => void) | null; started: boolean } = { release: null, started: false };
  act(() => {
    holder.started = press().run((done) => {
      holder.release = done;
    });
  });
  return { started: holder.started, release: () => act(() => holder.release?.()) };
}

describe('the pending press hook (LB-1, AC-C-57, AC-C-58)', () => {
  it('a command that settles before `run` returns (Simulated mode) sets nothing: never busy, never pending, the next press starts again', () => {
    const press = mountPress();
    const start = jest.fn((release: () => void) => release());
    let started = false;
    act(() => {
      started = press.current().run(start);
    });
    expect(started).toBe(true);
    expect(press.current()).toMatchObject({ busy: false, pending: false });
    press.elapse(LIVE_PENDING_REVEAL_MS * 3);
    expect(press.current()).toMatchObject({ busy: false, pending: false });
    act(() => {
      started = press.current().run(start);
    });
    expect(started).toBe(true);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('a held command: busy at the press, the spinner at the first store-clock step at or after the reveal delay, not 1 ms before', () => {
    expect([LIVE_PENDING_REVEAL_MS, REVEAL_AT_MS]).toEqual([420, 500]);
    const press = mountPress();
    const held = pressHeld(press.current);
    expect(held.started).toBe(true);
    expect(press.current()).toMatchObject({ busy: true, pending: false });
    press.elapse(300);
    expect(press.current()).toMatchObject({ busy: true, pending: false });
    // 499 ms of wall time: the store still says 400 ms, below the delay.
    press.elapse(REVEAL_AT_MS - 300 - 1, 1);
    expect(press.published()).toBe(REVEAL_AT_MS - CLOCK_STEP_MS);
    expect(press.current()).toMatchObject({ busy: true, pending: false });
    press.elapse(1, 1);
    expect(press.published()).toBe(REVEAL_AT_MS);
    expect(press.current()).toMatchObject({ busy: true, pending: true });
    held.release();
    expect(press.current()).toMatchObject({ busy: false, pending: false });
  });

  it('a second and a third press while the command is out are ignored: one command per control', () => {
    const press = mountPress();
    const start = jest.fn();
    const first = pressHeld(press.current);
    let second = true;
    let third = true;
    act(() => {
      second = press.current().run(start);
    });
    press.elapse(500);
    act(() => {
      third = press.current().run(start);
    });
    expect([first.started, second, third]).toEqual([true, false, false]);
    expect(start).not.toHaveBeenCalled();
    first.release();
    // Released: the control takes a press again.
    let fourth = false;
    act(() => {
      fourth = press.current().run((release) => release());
    });
    expect(fourth).toBe(true);
  });

  it('an answer before the reveal delay never shows the spinner', () => {
    const press = mountPress();
    const held = pressHeld(press.current);
    for (let elapsed = 0; elapsed < 50; elapsed += 10) {
      press.elapse(10, 10);
      expect(press.current().pending).toBe(false);
    }
    held.release();
    press.elapse(LIVE_PENDING_REVEAL_MS * 2);
    expect(press.current()).toMatchObject({ busy: false, pending: false });
  });

  it('`release` twice is harmless; a `start` that throws releases the control and passes the error on', () => {
    const press = mountPress();
    let release: () => void = () => undefined;
    act(() => {
      press.current().run((done) => {
        release = done;
      });
    });
    act(() => {
      release();
      release();
    });
    expect(press.current().busy).toBe(false);
    expect(() =>
      act(() => {
        press.current().run(() => {
          throw new Error('refused before sending');
        });
      }),
    ).toThrow('refused before sending');
    expect(press.current().busy).toBe(false);
    let next = false;
    act(() => {
      next = press.current().run((done) => done());
    });
    expect(next).toBe(true);
  });

  it('a second press is ignored even before the busy state rendered (the in-flight flag is set in the handler)', () => {
    const press = mountPress();
    const start = jest.fn();
    let results: boolean[] = [];
    act(() => {
      const control = press.current();
      results = [control.run(() => undefined), control.run(start), control.run(start)];
    });
    expect(results).toEqual([true, false, false]);
    expect(start).not.toHaveBeenCalled();
  });
});

describe('one hook in the app (row M1)', () => {
  it("Start Session's file and the barrel hand out the runtime's hook itself, not a copy", () => {
    expect(usePendingPressOfStartSession).toBe(usePendingPress);
    expect(usePendingPressOfBarrel).toBe(usePendingPress);
  });

  it("Start Session's file is the one-line re-export; the hook's file reads no wall clock and starts no timer", () => {
    const reexport = readFileSync(join(__dirname, '..', 'features', 'session-new', 'use-pending-press.ts'), 'utf8');
    expect(reexport.trim().split('\n')).toHaveLength(1);
    expect(reexport).toMatch(/^export \{ usePendingPress, type PendingPress \} from '@\/runtime';/);
    const code = readFileSync(join(__dirname, 'use-pending-press.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(?<!:)\/\/.*$/gm, '');
    const clocks = /\b(?:setTimeout|setInterval|requestAnimationFrame|Date\.now|performance\.now)\b/;
    expect(clocks.test('const t = setTimeout(reveal, 420);')).toBe(true);
    expect(clocks.test(code)).toBe(false);
    expect(code).toMatch(/s\.clock\.now - pressedAt >= LIVE_PENDING_REVEAL_MS/);
  });
});
