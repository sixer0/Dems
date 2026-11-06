/**
 * The timer that drives the engine host's scheduler (plan row W26; spec ENG-16).
 *
 * The host never calls a global timer itself: it asks an `EngineTimer` for a repeating call and
 * cancels it at stop. Production uses the system timer below; a test passes a manual one and
 * fires it by hand beside a manual clock, so no test waits in real time.
 *
 * This is the only file under `src/engine/` that names a global timer; a static test keeps it so.
 * The timer says WHEN the host looks at the clock. It stamps nothing: every instant of a row
 * comes from the server clock (`app.clock`).
 */
export interface EngineTimer {
  /** Calls `callback` every `intervalMs` until the returned function is called. */
  every(intervalMs: number, callback: () => void): () => void;
}

/**
 * The system timer: one interval per call, cleared by the returned function. The interval is
 * not kept from the event loop's view (`unref`): a process whose listener is gone ends even if
 * a caller forgot to stop the host. The host stops it in its close hook all the same.
 */
export function createSystemTimer(): EngineTimer {
  return {
    every(intervalMs, callback) {
      const handle = setInterval(callback, intervalMs);
      handle.unref();
      let cancelled = false;
      return () => {
        if (cancelled) return;
        cancelled = true;
        clearInterval(handle);
      };
    },
  };
}
