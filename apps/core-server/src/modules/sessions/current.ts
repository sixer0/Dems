/**
 * The answer of operation 27 `getCurrentSession` (plan row W34; spec §7.8; API-1: the design-book
 * operations keep their response schema, with ISO-8601 times in UTC+07:00).
 *
 * The open session is put on the wire by the simulator's OWN function, `toApiSession`, so the
 * Core server and the in-app simulator cannot answer the same session differently. That function
 * takes a whole simulator state and reads three members of it; the view below gives it exactly
 * those, built from the engine's committed state and the server clock:
 *
 *   `session`     the open session, by reference;
 *   `operators`   for the investigator's rank and name;
 *   `clock.now`   for the recording time so far. The engine's own `clock` slice is not replicated
 *                 and not read here: the instant is `app.clock`'s, as for `serverTime`.
 *
 * A unit test holds this answer against the simulator's own REST answer for a session in every
 * state, so a fourth member that `toApiSession` came to read would be found there.
 *
 * The simulator types its wire form loosely (a subject type is a `string` there). The contract's
 * schema turns it into the contract's type here; a value the schema refuses is a defect of the
 * shared code, thrown as it is and answered 500.
 */
import { CurrentSessionResponseSchema, type CurrentSessionResponse } from '@dems/shared/api';
import { SIM_TZ, SIM_TZ_OFFSET_MINUTES, toApiSession, toWibIso, type SimState } from '@dems/shared/sim';

/** What `toApiSession` reads of a state. */
type SessionView = Pick<SimState, 'session' | 'operators' | 'clock'>;

/** The members of the committed state the answer is built from. */
export type CurrentSessionSource = Pick<SimState, 'session' | 'operators'>;

/** `{ session, serverTime }` for the committed state at the instant `now` of the server clock. */
export function currentSessionResponse(state: CurrentSessionSource, now: number): CurrentSessionResponse {
  const serverTime = toWibIso(now);
  const { session } = state;
  if (session === null) return { session: null, serverTime };
  const view: SessionView = {
    session,
    operators: state.operators,
    clock: { now, tz: SIM_TZ, tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES },
  };
  return CurrentSessionResponseSchema.parse({ session: toApiSession(view as SimState, session), serverTime });
}
