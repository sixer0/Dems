/**
 * The result of a Live action (HB-14; backend task 04_client_integration_spec §2.5 CL-16, CL-24,
 * CL-25, CL-26; implementation/18 O-1, O-3 and finding F40-3).
 *
 * A Live action returns a value that has the members of a promise (`then`, `catch`, `finally`), so
 * a call site may `await` it (CL-26) or hand it to `settle` (CL-25). It is NOT a native promise,
 * and the difference is the point of it:
 *
 * | | Native promise | Live result |
 * |---|---|---|
 * | When a callback of `then` runs | One microtask after the settlement | **Inside the turn of the settlement**: the Live source settles the result right after the store update that holds the command's effect, so the continuation runs before anything else can (CL-16) |
 * | `then` on a result that is already settled | One microtask later | At once, before `then` returns: an action that is refused locally behaves as a simulator action that throws |
 * | A rejection nobody handles | The platform's unhandled-rejection event | Nothing: the Live source reports every rejection of an action itself, once, through `onError` (CL-24) |
 * | A callback that throws | Rejects the derived promise | The same, and the exception is reported through `report`: it can never leave the turn in which the source applies a delta (F40-3 c) |
 *
 * `await result` works unchanged: the language calls `then` with its own two functions, and the
 * awaiting function continues one microtask after the settlement, as it does for any thenable.
 *
 * **Hooks** (for the misuse report of the Live source, `./live-sim`). A result can tell its maker
 * when it settled and whether `then`, `catch` or `finally` was ever called on it, and it can watch
 * named members that a promise does not have (the `ok` of a simulator result union): a read of
 * one answers `undefined`, as on any object without that member, and is told to the maker.
 *
 * Framework-free, no import, no global.
 */

type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: unknown };

/** Receives what a callback of `then` or `finally` threw. It must not throw. */
export type LiveResultReporter = (error: unknown) => void;

/** A Live action result: the members of `Promise<T>`, with the timing of the table above. */
export type LiveResult<T> = Promise<T>;

export interface LiveResultHooks {
  /** Called once, right after the callbacks of the settlement ran. `observed()` says whether `then`, `catch` or `finally` was called on the result, at any time up to the question. */
  settled?(observed: () => boolean): void;
  /** Member names that no promise has. A read of one is told to `valueRead` and answers `undefined`. */
  readonly valueMembers?: readonly string[];
  valueRead?(member: string): void;
}

export interface LiveResultControl<T> {
  readonly result: LiveResult<T>;
  /** Fulfils the result and runs its callbacks, in the order they were given, before it returns. The first settlement wins. */
  resolve(value: T): void;
  /** Rejects the result and runs its callbacks before it returns. The first settlement wins. */
  reject(reason: unknown): void;
  readonly settled: boolean;
}

/** True for a promise or anything else with a `then` method. Used inside this folder only (it is not part of the subpath's exports). */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

export function createLiveResult<T>(report: LiveResultReporter, hooks?: LiveResultHooks): LiveResultControl<T> {
  let outcome: Outcome<T> | null = null;
  let reactions: ((settled: Outcome<T>) => void)[] = [];
  let observed = false;

  const contain = (error: unknown): void => {
    try {
      report(error);
    } catch {
      // A failing sink must never break the turn that settles a result.
    }
  };

  const settleWith = (next: Outcome<T>): void => {
    if (outcome !== null) return;
    outcome = next;
    const queue = reactions;
    reactions = [];
    for (const reaction of queue) reaction(next);
    if (hooks?.settled) {
      try {
        hooks.settled(() => observed);
      } catch (error) {
        contain(error);
      }
    }
  };

  /** Runs `reaction` now when the result is settled, else when it settles. A reaction never throws. */
  const react = (reaction: (settled: Outcome<T>) => void): void => {
    if (outcome !== null) reaction(outcome);
    else reactions.push(reaction);
  };

  /** Hands what a callback returned to the derived result; a thenable is followed. */
  const pass = <R>(produced: R | PromiseLike<R>, derived: LiveResultControl<R>): void => {
    if (!isThenable(produced)) {
      derived.resolve(produced);
      return;
    }
    try {
      produced.then(
        (value) => derived.resolve(value as R),
        (reason: unknown) => derived.reject(reason),
      );
    } catch (error) {
      derived.reject(error);
    }
  };

  const then = <R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> => {
    observed = true;
    const derived = createLiveResult<R1 | R2>(report);
    react((settled) => {
      let produced: R1 | R2 | PromiseLike<R1 | R2>;
      try {
        if (settled.ok) {
          if (typeof onFulfilled !== 'function') {
            derived.resolve(settled.value as unknown as R1);
            return;
          }
          produced = onFulfilled(settled.value);
        } else {
          if (typeof onRejected !== 'function') {
            derived.reject(settled.reason);
            return;
          }
          produced = onRejected(settled.reason);
        }
      } catch (error) {
        // The callback's own exception (the light API's O-3): contained here, reported, and
        // carried by the derived result for whoever chained on it.
        contain(error);
        derived.reject(error);
        return;
      }
      pass(produced, derived);
    });
    return derived.result;
  };

  const result: LiveResult<T> = {
    // A thenable on purpose: `settle` and `await` both take the result through `then` (O-1).
    // oxlint-disable-next-line unicorn/no-thenable
    then,
    catch: <R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<T | R> => then(undefined, onRejected),
    finally: (onFinally?: (() => void) | null): Promise<T> => {
      observed = true;
      const derived = createLiveResult<T>(report);
      react((settled) => {
        if (typeof onFinally === 'function') {
          try {
            onFinally();
          } catch (error) {
            contain(error);
            derived.reject(error);
            return;
          }
        }
        if (settled.ok) derived.resolve(settled.value);
        else derived.reject(settled.reason);
      });
      return derived.result;
    },
    [Symbol.toStringTag]: 'LiveResult',
  };

  for (const member of hooks?.valueMembers ?? []) {
    // Not enumerable: a listing of the result (a log, a test matcher) reads nothing.
    Object.defineProperty(result, member, {
      configurable: false,
      enumerable: false,
      get: (): undefined => {
        try {
          hooks?.valueRead?.(member);
        } catch (error) {
          contain(error);
        }
        return undefined;
      },
    });
  }

  return {
    result,
    resolve: (value) => settleWith({ ok: true, value }),
    reject: (reason) => settleWith({ ok: false, reason }),
    get settled() {
      return outcome !== null;
    },
  };
}

/** A Live result that is already fulfilled: its callbacks run inside `then`. */
export function resolvedLiveResult<T>(value: T, report: LiveResultReporter, hooks?: LiveResultHooks): LiveResult<T> {
  const control = createLiveResult<T>(report, hooks);
  control.resolve(value);
  return control.result;
}

/** A Live result that is already rejected: its callbacks run inside `then`. */
export function rejectedLiveResult<T>(reason: unknown, report: LiveResultReporter, hooks?: LiveResultHooks): LiveResult<T> {
  const control = createLiveResult<T>(report, hooks);
  control.reject(reason);
  return control.result;
}
