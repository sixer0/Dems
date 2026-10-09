/**
 * The timers of the capture supervisor (blueprint row 57 / M3-W1; static rule G-R8).
 *
 * The supervisor never calls a global timer itself: it asks a `CaptureTimers` for one call after
 * a delay and cancels it when the thing it waited for happened. Production uses the system timers
 * below; a test passes manual ones and fires them by hand beside a manual clock.
 *
 * This is the only file under `src/capture/` that names a global timer; a static test keeps it so.
 * A timer says WHEN the supervisor acts. It stamps nothing: every instant comes from the server
 * clock (`app.clock`).
 */
import type { CaptureTimers } from './types';

/**
 * One timeout per call, cleared by the returned function. The timeout is not kept from the event
 * loop's view (`unref`): a process whose listener is gone ends even if a session was left open.
 */
export function createSystemTimers(): CaptureTimers {
  return {
    after(delayMs, callback) {
      let done = false;
      const handle = setTimeout(() => {
        done = true;
        callback();
      }, delayMs);
      handle.unref();
      return () => {
        if (done) return;
        done = true;
        clearTimeout(handle);
      };
    },
  };
}
