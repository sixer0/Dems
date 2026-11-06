/**
 * The settle helper (HB-15; backend task 04_client_integration_spec §2.5 CL-25;
 * research/03_analysis.md ADQ-3 rule 3).
 *
 * One call-site shape for both data modes. `run` calls the action; the continuation goes into
 * the handlers:
 *
 *   settle(() => actions.archiveEvidence(id), {
 *     ok: () => toastArchived(id),
 *     fail: (error) => present(error),   // `instanceof SimPermissionError` works as before
 *     done: () => setBusy(false),
 *   });
 *
 * | `run` ...                  | Handlers           | When                                         |
 * |----------------------------|--------------------|----------------------------------------------|
 * | returns a plain value      | `ok`, then `done`  | before `settle` returns (Simulated mode)     |
 * | throws                     | `fail`, then `done`| before `settle` returns (Simulated mode)     |
 * | returns a Live result that | `ok`, then `done`  | in the turn in which the result calls back   |
 * | later fulfils              |                    | (CL-16)                                      |
 * | returns a Live result that | `fail`, then `done`| in the turn in which the result calls back   |
 * | later rejects              |                    |                                              |
 *
 * Rules:
 * - Exactly one of `ok` and `fail` runs, once; `done` runs once after it, in every path. A result
 *   that calls back a second time is ignored.
 * - `fail` receives the thrown value or the rejection reason itself, never a wrapper.
 * - `settle` adds no turn of its own. A plain value costs no promise and no microtask. A Live
 *   result gets both callbacks through ONE call of its own `then`: a native promise runs them in
 *   the microtask of its settlement, a Live result that calls back synchronously runs them in
 *   that same turn.
 * - `settle` itself never throws: an error of the action always goes to `fail`. An exception
 *   thrown by a handler is the handler's own. It is not caught, and it is never passed to `fail`
 *   as if the action had failed: after `done` has run it leaves through the caller of the handler
 *   (the `settle` call for a plain value or a throw, the result's `then` otherwise).
 * - Sequences nest: the next `settle` is called inside `ok`.
 *
 * Framework-free, no import, no global.
 */

export interface SettleHandlers<T> {
  /** The action succeeded; `value` is its result (for a result union: also its refusals, CL-19). */
  ok?: (value: T) => void;
  /**
   * The action threw (Simulated mode) or rejected (Live mode). Required: `settle` reports
   * nothing by itself, so a site without `fail` would lose the error.
   */
  fail: (error: unknown) => void;
  /** Runs once after `ok` or `fail`, in every path (for example: clear the busy flag). */
  done?: () => void;
}

/** Anything with a callable `then`: a native promise, or a Live action result. */
function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/** Runs `run` and hands its outcome to `handlers`: at once for a plain value or a throw, on settlement for a Live result. */
export function settle<T>(run: () => T | PromiseLike<T>, handlers: SettleHandlers<T>): void {
  const succeed = (value: T): void => {
    try {
      handlers.ok?.(value);
    } finally {
      handlers.done?.();
    }
  };
  const refuse = (error: unknown): void => {
    try {
      handlers.fail(error);
    } finally {
      handlers.done?.();
    }
  };

  let result: T | PromiseLike<T>;
  try {
    result = run();
  } catch (error) {
    refuse(error);
    return;
  }
  if (!isThenable(result)) {
    succeed(result);
    return;
  }
  // The first callback wins, so a result that is not a native promise cannot settle a site twice.
  let pending = true;
  const once =
    <Argument>(handler: (argument: Argument) => void) =>
    (argument: Argument): void => {
      if (!pending) return;
      pending = false;
      handler(argument);
    };
  // The derived promise is not kept: it only carries an exception of a handler (see the rules).
  void result.then(once(succeed), once(refuse));
}
