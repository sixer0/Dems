/**
 * The Live clock (HB-14; backend task 04_client_integration_spec §2.3, member `clock.now()`;
 * 01_specs ENG-15, Q15: in Live mode the Core server's clock is the clock).
 *
 * `now()` is the local clock plus the offset learned from the server: every `hello` and every
 * `heartbeat` carries the server's time, and the live socket client hands both on as one sample
 * (`serverTime` and the local instant it arrived at). The newest sample sets the offset.
 *
 * Two rules:
 * - **It never moves backwards.** A sample that would set the clock back does not: `now()` then
 *   holds its last value until the corrected time has caught up. A countdown therefore never
 *   counts up and an elapsed time never shrinks.
 * - **Before the first sample the offset is 0**: the local clock, which on the one computer of
 *   this demo is the server's clock.
 *
 * The local clock is injected (`Date.now` in the apps, the fake clock in a test). Pure otherwise.
 */
import { SIM_TZ, SIM_TZ_OFFSET_MINUTES } from '../../sim/constants';
import type { EpochMs, SimClock } from '../../sim/types';

export interface LiveClock extends SimClock {
  /** Takes one reading of the server clock: `serverTime` was true at the local instant `receivedAt`. */
  sample(serverTime: EpochMs, receivedAt: EpochMs): void;
  /** Server time minus local time, in milliseconds, as last learned. */
  offsetMs(): number;
}

export function createLiveClock(local: () => number): LiveClock {
  let offset = 0;
  let last = Number.NEGATIVE_INFINITY;
  return {
    now() {
      const value = local() + offset;
      if (value > last) last = value;
      return last;
    },
    sample(serverTime, receivedAt) {
      if (!Number.isFinite(serverTime) || !Number.isFinite(receivedAt)) return;
      offset = serverTime - receivedAt;
    },
    offsetMs: () => offset,
    tz: SIM_TZ,
    tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES,
  };
}
