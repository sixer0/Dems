/**
 * The server clock (plan row W21; spec §8.4 ENG-13 to ENG-16; SR-65, AC-B-55).
 *
 * One clock per server process, reached through the seam `app.clock`. Every `at` of a row,
 * every identifier date and every domain deadline comes from it. In production it is the wall
 * clock, held so that it never moves backwards (ENG-14). A test replaces it with the shared
 * manual clock: `app.seams.replace('clock', createManualClock(start))` (`@dems/shared/sim`),
 * which satisfies this interface (ENG-16).
 *
 * This is the only file under `src/core/` that reads the system time; a static test of this
 * folder keeps it so. The pipeline's watchdog is a timer in real time, not a reading of this
 * clock: it stamps nothing (see `limits.ts`).
 *
 * ONE TIME BASE PER PROCESS, WITH A FLOOR (decision D110; security finding CPS1-1, guarantees G1,
 * G3, G4). The engine's start raises the floor of this clock to the newest instant a stored row
 * was written with, so a process that starts with the system time set BACK never reads a time
 * before a row that is already stored. From the floor the clock RUNS ON at the real rate, measured
 * with a monotonic timer; it does not stand still until the system time has caught up. So a lock,
 * a window, a session and a pairing code end when their time has passed, whatever the system time
 * shows. The rule, for a floor and for a system time that is set back while the process runs:
 *
 *     while the system time is behind the clock    the clock is where it was plus the time that
 *                                                  passed on the timer;
 *     as soon as the system time is at or past it  the clock is the system time again, exactly.
 *
 * The clock is therefore never below the system time, never moves backwards, never stands still
 * while time passes, and carries no offset once the system time has caught up or was corrected.
 */
import { CoreError } from './errors';

/** Epoch milliseconds that never move backwards (ENG-13, ENG-14). */
export interface Clock {
  now(): number;
}

/** A clock with a floor (decision D110). */
export interface FloorClock extends Clock {
  /**
   * From now on `now()` is never below `instant` (whole, non-negative epoch milliseconds), and
   * time runs on from there. A floor only rises: an instant at or below what the clock reads
   * changes nothing.
   */
  raiseFloor(instant: number): void;
}

/** The floor a caller asks for, refused unless it is an instant a row could be stamped with. */
function floorOf(instant: number): number {
  if (!Number.isSafeInteger(instant) || instant < 0) {
    throw new CoreError('CLOCK_VALUE_INVALID', 'the floor of the server clock must be a whole, non-negative number of milliseconds');
  }
  return instant;
}

/**
 * The server clock: the system time, held so that it never returns a smaller value than before
 * (ENG-14) nor one below its floor (decision D110), and running on at the real rate while the
 * system time is behind it.
 *
 * `source` is the system time and `timer` a monotonic count of real milliseconds; a duration is
 * a difference of two of its readings. Without arguments both are the runtime's. A test of the
 * rules passes its own: a source that steps back and a timer it advances. With a source and NO
 * timer, no time passes by itself: the clock then moves only when the source does. With ONE
 * manual clock as both, the time that passes is that clock's own movement: the clock reads its
 * floor plus how far the manual clock moved since, and keeps that distance, because one source
 * cannot tell a correction of the system time from time that passed.
 */
export function createSystemClock(source?: () => number, timer?: () => number): FloorClock {
  const systemTime = source ?? (() => Date.now());
  const elapsed = timer ?? (source === undefined ? () => performance.now() : () => 0);
  /** The greatest value read so far, and the timer's reading when it was read. */
  let last = 0;
  let lastTimer = 0;
  /** Set while the system time is behind the clock: a value of the clock and the timer's reading that goes with it. */
  let origin: { readonly value: number; readonly timer: number } | null = null;

  function now(): number {
    const system = systemTime();
    const at = elapsed();
    if (origin === null && system < last) {
      // The system time was set back since the last reading: the clock runs on from that reading.
      origin = { value: last, timer: lastTimer };
    }
    if (origin !== null) {
      // Whole milliseconds that passed on the timer since the origin.
      const running = origin.value + Math.floor(at - origin.timer);
      if (system < running) {
        // `max`: a timer that is not monotonic must not move the clock backwards either.
        last = Math.max(last, running);
        return last;
      }
      // The system time has caught up, or was corrected: it is the clock again. No offset is kept.
      origin = null;
    }
    last = Math.max(last, system);
    lastTimer = at;
    return last;
  }

  return {
    now,
    raiseFloor(instant) {
      const floor = floorOf(instant);
      if (floor <= now()) return;
      last = floor;
      origin = { value: floor, timer: elapsed() };
    },
  };
}

const hasFloor = (clock: Clock): clock is FloorClock => typeof (clock as Partial<FloorClock>).raiseFloor === 'function';

/**
 * Raises the floor of `clock` to `instant`, if the clock has a floor (decision D110). Returns
 * whether the clock now reads at or past `instant`:
 *
 *   a clock with a floor (the server clock)              takes it in place: true;
 *   a clock without one that is at or past `instant`     needs none: true;
 *   a clock without one that is BEHIND `instant`         false. Nothing can hold it there, and
 *                                                        the caller must not go on with it.
 *
 * The third case is a manual clock that a test put behind the seam `clock`; the server's own
 * clock always takes the first. No production code replaces a seam (decision D82), so the floor
 * is never put there in a clock of its own. A test that starts a server BEHIND the stored state
 * puts a server clock on its manual one behind the seam before the boot:
 * `createSystemClock(() => manual.now(), () => manual.now())`.
 */
export function raiseClockFloor(clock: Clock, instant: number): boolean {
  const floor = floorOf(instant);
  if (hasFloor(clock)) {
    clock.raiseFloor(floor);
    return true;
  }
  return clock.now() >= floor;
}

/**
 * A clock that reads another one each time it is asked. The core services hold this over the
 * seam, so a clock that a test puts in place after `ready()` is the one they stamp with.
 */
export function followClock(current: () => Clock): Clock {
  return { now: () => current().now() };
}

/**
 * The instant a writer stamps a row with: the clock's value, which must be a whole, safe number
 * of milliseconds (the column is a `bigint`; database contract MR-9). A clock that gives
 * anything else is a defect, refused before a statement is sent.
 */
export function stampOf(clock: Clock): number {
  const at = clock.now();
  if (!Number.isSafeInteger(at) || at < 0) {
    throw new CoreError('CLOCK_VALUE_INVALID', 'the server clock gave a value that is not a whole, non-negative number of milliseconds');
  }
  return at;
}
