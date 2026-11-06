/**
 * The actor scope of one hosted command (plan row W26; spec ENG-2, SR-79; AC-B-53; SD-22).
 *
 * The shared actions take their actor from the store's `auth` slice (`requirePermission`,
 * `signedInOperatorId`). The host therefore sets that slice to the caller for exactly one
 * synchronous action and sets it back to signed-out in a `finally`:
 *
 *   - one synchronous turn: Node runs nothing in between, so no tick and no other command can
 *     see the identity (the action is a plain function call, never awaited);
 *   - the `finally`: a hosted action refuses by THROWING (ENG-7). Without it the caller's
 *     identity would stay in the engine: the next unchecked action would be attributed to that
 *     operator, and the idle subsystem would later write an expiry row for them (the negative
 *     control of the headless proof, d5);
 *   - between commands the slice is always signed out, so the simulator's own idle-expiry
 *     subsystem stays inert and a row the engine writes by itself has no actor from `auth`.
 *
 * `auth` is not a durable slice: the scope never reaches a table or a publication.
 */
import { AuthStatus, signedOutAuth, type AuthSlice, type SimStore } from '@dems/shared/sim';

/**
 * The `auth` slice of one command: signed in as `operatorId`, at the instant of the command.
 * `deviceId` (wave H driver B, finding G75-02): the paired device the command came from - the
 * device a bearer session is bound to - or null / absent for a web console session. A hosted
 * action that names the sending device in its row reads it there (`sendingDeviceOf`).
 */
export function actorAuth(operatorId: string, at: number, deviceId: string | null = null): AuthSlice {
  return { status: AuthStatus.SIGNED_IN, operatorId, method: null, issuedAt: at, lastActivityAt: at, ...(deviceId === null ? {} : { deviceId }) };
}

/** True when nobody is signed in on the engine: the state between two commands. */
export function isSignedOut(auth: AuthSlice): boolean {
  return auth.status === AuthStatus.SIGNED_OUT && auth.operatorId === null;
}

/**
 * Runs `action` with the engine's `auth` slice set to `operatorId`, and clears the slice in a
 * `finally`. `action` must be synchronous: what it returns is returned, what it throws is thrown.
 */
export function withActorScope<Result>(store: SimStore, operatorId: string, at: number, action: () => Result, deviceId: string | null = null): Result {
  store.setState({ auth: actorAuth(operatorId, at, deviceId) });
  try {
    return action();
  } finally {
    store.setState({ auth: signedOutAuth() });
  }
}
