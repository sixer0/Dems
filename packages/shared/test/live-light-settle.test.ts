// Plan row W18, HB-15: the settle helper (04_client_integration_spec §2.5 CL-25; AC-C-09;
// research/03_analysis.md ADQ-3 rule 3). One call-site shape for both data modes: at once for a
// plain value or a throw (Simulated mode, timing unchanged), on settlement for a Live result.
//
// The type assertions are checked by `npm run typecheck` (tsc includes this folder).
/* oxlint-disable unicorn/no-thenable -- the test doubles of this file are thenables on purpose: they stand for the Live action results that settle consumes */
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { coreActionsOf, settle, type CoreActions, type SettleHandlers } from '../src/live';
import {
  createManualClock,
  createSim,
  DEMO_OPERATOR_PASSWORD,
  selectNextCaseNumber,
  SimPermissionError,
  SimTransitionError,
  type ScenarioName,
  type SignInResult,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

/** Records every callback by name, in call order. */
function recorder<T>() {
  const calls: string[] = [];
  const values: T[] = [];
  const errors: unknown[] = [];
  const handlers: Required<SettleHandlers<T>> = {
    ok: (value) => {
      calls.push('ok');
      values.push(value);
    },
    fail: (error) => {
      calls.push('fail');
      errors.push(error);
    },
    done: () => {
      calls.push('done');
    },
  };
  return { calls, values, errors, handlers };
}

/** A native promise with its two triggers. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A result that calls back in the turn in which it settles (the Live action result of CL-16),
 * and that may misbehave on request: it keeps calling back when told to.
 */
function turnResult<T>() {
  let onOk: ((value: T) => void) | null = null;
  let onFail: ((reason: unknown) => void) | null = null;
  let thenCalls = 0;
  const result: PromiseLike<T> = {
    then(onfulfilled, onrejected) {
      thenCalls += 1;
      onOk = onfulfilled as (value: T) => void;
      onFail = onrejected as (reason: unknown) => void;
      return result as never;
    },
  };
  return {
    result,
    thenCalls: () => thenCalls,
    fulfil: (value: T) => onOk?.(value),
    reject: (reason: unknown) => onFail?.(reason),
  };
}

function simulator(scenario: ScenarioName = 'idle', signedIn = true) {
  const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario });
  if (signedIn) sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
  return sim;
}

describe('settle: a plain value (Simulated mode), AC-C-09', () => {
  it('runs the action, then ok, then done, all before settle returns', () => {
    const { calls, values, handlers } = recorder<number>();
    const returned = settle(() => {
      calls.push('run');
      return 7;
    }, handlers);
    expect(calls).toEqual(['run', 'ok', 'done']);
    expect(values).toEqual([7]);
    expect(returned).toBeUndefined();
  });

  it('treats undefined, null and every falsy value as a plain value: a void action succeeds', () => {
    for (const value of [undefined, null, 0, '', false]) {
      const { calls, values, handlers } = recorder<unknown>();
      settle(() => value, handlers);
      expect(calls).toEqual(['ok', 'done']);
      expect(values).toEqual([value]);
    }
  });

  it('hands an object result over as it is: same reference, not a copy and not a promise', () => {
    const result: SignInResult = { ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: 4 };
    const { values, handlers } = recorder<SignInResult>();
    settle(() => result, handlers);
    expect(values[0]).toBe(result);
  });

  it('queues no microtask of its own: a microtask queued before the call still runs after ok and done', async () => {
    const order: string[] = [];
    const earlier = Promise.resolve().then(() => order.push('microtask'));
    settle(() => 1, { ok: () => order.push('ok'), fail: () => order.push('fail'), done: () => order.push('done') });
    order.push('after settle');
    await earlier;
    expect(order).toEqual(['ok', 'done', 'after settle', 'microtask']);
  });

  it('needs only fail: ok and done may be left out', () => {
    const fail = vi.fn();
    expect(() => settle(() => 1, { fail })).not.toThrow();
    expect(() =>
      settle(() => {
        throw new Error('refused');
      }, { fail }),
    ).not.toThrow();
    expect(fail).toHaveBeenCalledTimes(1);
  });
});

describe('settle: a synchronous throw (Simulated mode), AC-C-09', () => {
  it('runs fail, then done, before settle returns; ok does not run; settle does not throw', () => {
    const boom = new Error('refused');
    const { calls, errors, handlers } = recorder<number>();
    expect(() =>
      settle((): number => {
        calls.push('run');
        throw boom;
      }, handlers),
    ).not.toThrow();
    expect(calls).toEqual(['run', 'fail', 'done']);
    expect(errors[0]).toBe(boom);
  });

  it('passes any thrown value through unchanged, an Error or not', () => {
    for (const thrown of ['text', 42, null, undefined, { code: 'X' }]) {
      const { calls, errors, handlers } = recorder<void>();
      settle(() => {
        throw thrown;
      }, handlers);
      expect(calls).toEqual(['fail', 'done']);
      expect(errors[0]).toBe(thrown);
    }
  });
});

describe('settle: a native promise (Live mode)', () => {
  it('fulfilment: no handler runs before settle returns; then ok and done, once, in that order', async () => {
    const live = deferred<number>();
    const { calls, values, handlers } = recorder<number>();
    settle(() => live.promise, handlers);
    expect(calls).toEqual([]);
    await Promise.resolve();
    expect(calls).toEqual([]); // still pending: nothing runs on time alone
    live.resolve(11);
    expect(calls).toEqual([]); // a native promise calls back in a microtask, never inside resolve()
    await live.promise;
    expect(calls).toEqual(['ok', 'done']);
    expect(values).toEqual([11]);
  });

  it('rejection: fail and done, once, in that order; ok does not run; the reason is the same object', async () => {
    const live = deferred<number>();
    const boom = new SimTransitionError('RECORDING', 'stopRecording', undefined, 'REASON_TOO_SHORT');
    const { calls, errors, handlers } = recorder<number>();
    settle(() => live.promise, handlers);
    live.reject(boom);
    await live.promise.catch(() => undefined);
    expect(calls).toEqual(['fail', 'done']);
    expect(errors[0]).toBe(boom);
  });

  it('marks a rejected result as handled: no unhandled rejection reaches the runner', async () => {
    // Vitest fails the run on an unhandled rejection, so this test passing is the proof. The
    // listener makes the claim explicit for this one promise.
    const seen: unknown[] = [];
    const listener = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', listener);
    try {
      const fail = vi.fn();
      settle(() => Promise.reject(new Error('offline')), { fail });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fail).toHaveBeenCalledTimes(1);
      expect(seen).toEqual([]);
    } finally {
      process.off('unhandledRejection', listener);
    }
  });

  it('adds no turn: the handlers run in the first microtask after the settlement', async () => {
    const order: string[] = [];
    const settled = Promise.resolve(5);
    settle(() => settled, { ok: () => order.push('ok'), fail: () => order.push('fail'), done: () => order.push('done') });
    // Queued after settle's own reaction on the same promise, so it runs right behind it.
    const next = settled.then(() => order.push('next reaction'));
    await next;
    expect(order).toEqual(['ok', 'done', 'next reaction']);
  });

  it('calls then exactly once, with both callbacks, and never wraps the result in another promise', () => {
    const live = deferred<number>();
    const then = vi.spyOn(live.promise, 'then');
    settle(() => live.promise, { fail: () => undefined });
    expect(then).toHaveBeenCalledTimes(1);
    expect(then.mock.calls[0]).toHaveLength(2);
    expect(typeof then.mock.calls[0]?.[0]).toBe('function');
    expect(typeof then.mock.calls[0]?.[1]).toBe('function');
    live.resolve(1);
  });
});

describe('settle: a Live result that calls back in its own turn (CL-16)', () => {
  it('runs ok and done inside the turn of the settlement: read right after it, no await', () => {
    const live = turnResult<string>();
    const { calls, values, handlers } = recorder<string>();
    settle(() => live.result, handlers);
    expect(live.thenCalls()).toBe(1);
    expect(calls).toEqual([]);
    live.fulfil('RECORDING');
    expect(calls).toEqual(['ok', 'done']);
    expect(values).toEqual(['RECORDING']);
  });

  it('runs fail and done inside the turn of a rejection', () => {
    const live = turnResult<string>();
    const { calls, errors, handlers } = recorder<string>();
    const refusal = new SimPermissionError('startRecording', 'SESSION_START');
    settle(() => live.result, handlers);
    live.reject(refusal);
    expect(calls).toEqual(['fail', 'done']);
    expect(errors[0]).toBe(refusal);
  });

  it('settles a site once: a second fulfilment and a late rejection are ignored (never both ok and fail)', () => {
    const live = turnResult<number>();
    const { calls, values, handlers } = recorder<number>();
    settle(() => live.result, handlers);
    live.fulfil(1);
    live.fulfil(2);
    live.reject(new Error('late'));
    expect(calls).toEqual(['ok', 'done']);
    expect(values).toEqual([1]);
  });

  it('settles a site once: a fulfilment after a rejection is ignored', () => {
    const live = turnResult<number>();
    const { calls, handlers } = recorder<number>();
    settle(() => live.result, handlers);
    live.reject(new Error('first'));
    live.fulfil(1);
    live.reject(new Error('second'));
    expect(calls).toEqual(['fail', 'done']);
  });

  it('takes a callable with a then method as a Live result too', () => {
    const live = turnResult<number>();
    const callable = Object.assign(() => undefined, { then: live.result.then }) as unknown as PromiseLike<number>;
    const { calls, handlers } = recorder<number>();
    settle(() => callable, handlers);
    expect(calls).toEqual([]);
    live.fulfil(3);
    expect(calls).toEqual(['ok', 'done']);
  });

  it('takes an object whose then is not a function as a plain value', () => {
    const plain = { then: 'not a function' };
    const { calls, values, handlers } = recorder<unknown>();
    settle(() => plain, handlers);
    expect(calls).toEqual(['ok', 'done']);
    expect(values[0]).toBe(plain);
  });
});

describe('settle: an exception of a handler is the handler\'s own', () => {
  const bug = new Error('bug in the continuation');

  it('plain value: an error thrown by ok leaves through settle, is not passed to fail, and done still runs once', () => {
    const fail = vi.fn();
    const done = vi.fn();
    expect(() =>
      settle(() => 1, {
        ok: () => {
          throw bug;
        },
        fail,
        done,
      }),
    ).toThrow(bug);
    expect(fail).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('synchronous throw: an error thrown by fail leaves through settle after done ran once', () => {
    const ok = vi.fn();
    const done = vi.fn();
    expect(() =>
      settle(
        (): number => {
          throw new Error('refused');
        },
        {
          ok,
          fail: () => {
            throw bug;
          },
          done,
        },
      ),
    ).toThrow(bug);
    expect(ok).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('native promise: an error thrown by ok rejects the derived promise only; fail does not run; done runs once', async () => {
    const live = deferred<number>();
    const then = vi.spyOn(live.promise, 'then');
    const fail = vi.fn();
    const done = vi.fn();
    settle(() => live.promise, {
      ok: () => {
        throw bug;
      },
      fail,
      done,
    });
    // The derived promise is what the platform reports as unhandled. Observing it here keeps the
    // report out of this run and shows where the error went.
    const derived = then.mock.results[0]?.value as Promise<unknown>;
    live.resolve(1);
    await expect(derived).rejects.toBe(bug);
    expect(fail).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('turn result: an error thrown by ok leaves through the callback, is not passed to fail, and done runs once', () => {
    const live = turnResult<number>();
    const fail = vi.fn();
    const done = vi.fn();
    settle(() => live.result, {
      ok: () => {
        throw bug;
      },
      fail,
      done,
    });
    expect(() => live.fulfil(1)).toThrow(bug);
    expect(fail).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('an error thrown by done leaves the same way and is not passed to fail', () => {
    const fail = vi.fn();
    expect(() =>
      settle(() => 1, {
        fail,
        done: () => {
          throw bug;
        },
      }),
    ).toThrow(bug);
    expect(fail).not.toHaveBeenCalled();
  });
});

describe('settle: sequences nest (the next settle is called inside ok)', () => {
  it('plain values: the whole sequence runs before the outer settle returns', () => {
    const order: string[] = [];
    settle(
      () => {
        order.push('run 1');
        return 'a';
      },
      {
        ok: (first) => {
          order.push(`ok 1 ${first}`);
          settle(
            () => {
              order.push('run 2');
              return 'b';
            },
            { ok: (second) => order.push(`ok 2 ${second}`), fail: () => order.push('fail 2'), done: () => order.push('done 2') },
          );
        },
        fail: () => order.push('fail 1'),
        done: () => order.push('done 1'),
      },
    );
    expect(order).toEqual(['run 1', 'ok 1 a', 'run 2', 'ok 2 b', 'done 2', 'done 1']);
  });

  it('a throw of the second action goes to the inner fail only', () => {
    const order: string[] = [];
    settle(() => 'a', {
      ok: () => {
        settle(
          (): string => {
            throw new Error('second refused');
          },
          { ok: () => order.push('ok 2'), fail: () => order.push('fail 2'), done: () => order.push('done 2') },
        );
      },
      fail: () => order.push('fail 1'),
      done: () => order.push('done 1'),
    });
    expect(order).toEqual(['fail 2', 'done 2', 'done 1']);
  });

  it('Live results: the second request starts only when the first has settled', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const order: string[] = [];
    settle(
      () => {
        order.push('run 1');
        return first.promise;
      },
      {
        ok: () => {
          settle(
            () => {
              order.push('run 2');
              return second.promise;
            },
            { ok: () => order.push('ok 2'), fail: () => order.push('fail 2'), done: () => order.push('done 2') },
          );
        },
        fail: () => order.push('fail 1'),
        done: () => order.push('done 1'),
      },
    );
    expect(order).toEqual(['run 1']);
    first.resolve('a');
    await first.promise;
    expect(order).toEqual(['run 1', 'run 2', 'done 1']);
    second.resolve('b');
    await second.promise;
    expect(order).toEqual(['run 1', 'run 2', 'done 1', 'ok 2', 'done 2']);
  });
});

describe('settle on a real simulator: the three site kinds of §8', () => {
  it('return-value site: the result of a result-union action arrives in ok, synchronously', () => {
    const sim = simulator('idle', false);
    const actions = coreActionsOf(sim);
    const { calls, values, handlers } = recorder<SignInResult>();
    settle(() => actions.signIn('budi.santoso', 'wrong password'), handlers);
    expect(calls).toEqual(['ok', 'done']);
    expect(values[0]).toMatchObject({ ok: false, reason: 'INVALID_CREDENTIALS' });
    settle(() => actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD), handlers);
    expect(values[1]).toMatchObject({ ok: true, role: 'INVESTIGATOR', method: 'PASSWORD' });
  });

  it('throw site: a refused void action reaches fail as the simulator class, so instanceof branches hold', () => {
    const signedOut = coreActionsOf(simulator('idle', false));
    const denied = recorder<void>();
    settle(() => signedOut.beginPrecheck(), denied.handlers);
    expect(denied.calls).toEqual(['fail', 'done']);
    expect(denied.errors[0]).toBeInstanceOf(SimPermissionError);
    expect((denied.errors[0] as SimPermissionError).code).toBe('NOT_SIGNED_IN');

    const recording = coreActionsOf(simulator('recording'));
    const refused = recorder<void>();
    settle(() => recording.stopRecording('no'), refused.handlers);
    expect(refused.calls).toEqual(['fail', 'done']);
    expect(refused.errors[0]).toBeInstanceOf(SimTransitionError);
    expect((refused.errors[0] as SimTransitionError).code).toBe('REASON_TOO_SHORT');
  });

  it('read-after-write site: the store already holds the effect when ok runs', () => {
    const sim = simulator();
    const actions = coreActionsOf(sim);
    const before = selectNextCaseNumber(sim.store.getState());
    let seenInOk: string | null = null;
    let scanned: string | null = null;
    settle(() => actions.scanCaseNumber(), {
      ok: (caseNumber) => {
        scanned = caseNumber;
        seenInOk = selectNextCaseNumber(sim.store.getState());
      },
      fail: (error) => {
        throw error;
      },
    });
    expect(scanned).toBe(before);
    expect(seenInOk).not.toBe(before);
    expect(seenInOk).toBe(selectNextCaseNumber(sim.store.getState()));
  });
});

describe('settle: types', () => {
  it('gives ok the awaited result type of a Core action, for a value and for a promise alike', () => {
    const actions = null as unknown as CoreActions;
    const check = (): void => {
      settle(() => actions.signIn('u', 'p'), {
        ok: (result) => expectTypeOf(result).toEqualTypeOf<SignInResult>(),
        fail: (error) => expectTypeOf(error).toBeUnknown(),
      });
      settle(() => actions.scanCaseNumber(), { ok: (text) => expectTypeOf(text).toBeString(), fail: () => undefined });
      settle(() => actions.restartServices(), { ok: (count) => expectTypeOf(count).toBeNumber(), fail: () => undefined });
      settle(() => actions.snapshot(), { ok: (nothing) => expectTypeOf(nothing).toBeVoid(), fail: () => undefined });
      settle(() => Promise.resolve(1), { ok: (value) => expectTypeOf(value).toBeNumber(), fail: () => undefined });
      settle(() => 1, { ok: (value) => expectTypeOf(value).toBeNumber(), fail: () => undefined });
    };
    expectTypeOf(check).toBeFunction();
    expectTypeOf(settle).returns.toBeVoid();
  });

  it('fits a generic call-site wrapper with a callback form (the web command wrapper, B-10; the mobile wrappers, S2)', () => {
    /** The shape §8.3 B-10 describes: `run(command, onDone)`, the result in `onDone`. */
    function runCommand<T>(command: () => T | Promise<T>, onDone: (result: T) => void, onRefused: (error: unknown) => void): void {
      settle(command, { ok: onDone, fail: onRefused });
    }
    const seen: number[] = [];
    runCommand(() => 4, (value) => seen.push(value), () => undefined);
    expect(seen).toEqual([4]);
    expectTypeOf(runCommand<string>).parameter(1).toEqualTypeOf<(result: string) => void>();
  });

  it('requires fail', () => {
    // @ts-expect-error fail is required: settle reports nothing by itself
    const withoutFail: SettleHandlers<number> = { ok: () => undefined };
    expect(withoutFail).toBeDefined();
  });
});
