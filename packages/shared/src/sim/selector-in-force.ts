/**
 * The selector IN FORCE: the ONE place that decides whether a reader names the capture sources from
 * a session's own selector snapshot or from the Core's current selector (fix wave L: G70c-01, built
 * for the mobile app by L-M and moved here by the closing pass L-Z so that the simulator, the web
 * console and the mobile app hold ONE rule).
 *
 * | Rule | Why |
 * |---|---|
 * | a session's snapshot names the sources ONLY while that session is OPEN | the snapshot is "the selector as it was when recording started" (register SH-05): it is true of that session, and of nothing after it |
 * | OPEN = the `session` slice holds a session whose state is stated and is not `SEALED` | the slice keeps the LAST session after its seal (`isSessionActive`: not null, not SEALED). A sealed session is closed: the selector is unlocked and may have been edited since |
 * | otherwise: the Core's current selector (`captureConfig`, slice 29) | what the NEXT session will record |
 *
 * The defect this closes: readers spelled `state.session?.captureConfig ?? state.captureConfig`, so
 * the snapshot of the last SEALED session hid every later edit of the selector - meters, pre-check
 * rows, tiles and notices named the source a line had BEFORE the change.
 *
 * NOT under this rule: a reader that states a fact OF one session (its summary, its sealed evidence,
 * its audio intervals) reads that session's snapshot directly, with no fallback to the selector.
 *
 * THE AUDIO PAIR IS UNDER THE SAME RULE (fix 157): `session.audioSource` - which input is active
 * inside `AUDIO-01`, which is the hot standby - is a fact of THAT session. It names the pair only
 * while the session is OPEN; otherwise the pair is the one the current selector gives (the PRIMARY
 * line is the active input of the next recording, the STANDBY line its standby). The slice keeps the
 * pair of the last SEALED session, so a reader that spelled `state.session?.audioSource?.activeInputId`
 * named the OLD inputs after the selector's microphones were changed. `audioPairInForce` below.
 *
 * Pure, and imports nothing: `audio.ts` and the session machine both read it. No file of
 * `packages/shared/src` may spell the expression itself (`test/sim-wave-l-z-selector-in-force.test.ts`).
 */

/** The least a session must state for the rule. */
export interface SnapshotSession<S> {
  readonly state?: string | null;
  readonly captureConfig?: S | null;
}

/** The two slices the rule reads, as a simulator or a Live store holds them. */
export interface SelectorState<S, C> {
  readonly session?: SnapshotSession<S> | null;
  readonly captureConfig: C;
}

/** The state of a session that is closed. A literal: this file imports nothing (it equals `SessionState.SEALED`, held by the test). */
const SEALED = 'SEALED';

/** True while the slice holds a session that is still open (stated, and not sealed). */
export function sessionIsOpen(session: { readonly state?: string | null } | null | undefined): boolean {
  return session !== null && session !== undefined && typeof session.state === 'string' && session.state !== SEALED;
}

/** The OPEN session's selector snapshot, or null: no session, a sealed one, or a session without a snapshot. */
export function openSessionSnapshot<S>(session: SnapshotSession<S> | null | undefined): S | null {
  if (!sessionIsOpen(session)) return null;
  return session?.captureConfig ?? null;
}

/** The selector in force for ONE given session: its snapshot while it is open, else `current`. */
export function selectorOfSession<S, C>(session: SnapshotSession<S> | null | undefined, current: C): S | C {
  return openSessionSnapshot(session) ?? current;
}

/** The selector in force: the open session's snapshot, else the Core's current selector. */
export function selectorInForce<S, C>(state: SelectorState<S, C>): S | C {
  return selectorOfSession(state.session, state.captureConfig);
}

/** The microphone lines in force (input order as the holder gives them). */
export function micLinesInForce<M, N>(state: SelectorState<{ readonly mics: readonly M[] }, { readonly mics: readonly N[] }>): readonly (M | N)[] {
  return selectorInForce(state).mics;
}

/** The camera lines in force. */
export function cameraLinesInForce<M, N>(state: SelectorState<{ readonly cameras: readonly M[] }, { readonly cameras: readonly N[] }>): readonly (M | N)[] {
  return selectorInForce(state).cameras;
}

// ── The audio pair in force (fix 157) ────────────────────────────────────────────────────

/** The active / standby pair, by the ids the holder gives. */
export interface AudioPair<I extends string = string> {
  readonly activeInputId: I;
  readonly standbyInputId: I;
}

/** The pair in force. A member is `null` where neither the open session nor the selector names it (the reader's own last resort stands in). */
export interface AudioPairInForce<I extends string = string> {
  readonly activeInputId: I | null;
  readonly standbyInputId: I | null;
}

/** One microphone line of a selector, as far as the pair reads it. */
export interface PairMicLine<I extends string = string> {
  readonly inputId: I;
  readonly role?: string | null;
}

/** The two slices the pair is read from. `captureConfig` may be absent in a hand-built state: the selector then names nothing. */
export interface AudioPairState<A, I extends string = string> {
  readonly session?: { readonly state?: string | null; readonly audioSource?: A | null; readonly captureConfig?: { readonly mics?: readonly PairMicLine<I>[] } | null } | null;
  readonly captureConfig?: { readonly mics?: readonly PairMicLine<I>[] } | null;
}

const NO_PAIR: AudioPairInForce<never> = { activeInputId: null, standbyInputId: null };

/**
 * The OPEN session's own audio-source facts (its pair, its last switch), or null: no session, a
 * sealed one, or a session that states none. The whole object, so that a reader of `switchedAt` is
 * under the same rule as a reader of the pair.
 */
export function openSessionAudioSource<A>(session: { readonly state?: string | null; readonly audioSource?: A | null } | null | undefined): A | null {
  if (!sessionIsOpen(session)) return null;
  return session?.audioSource ?? null;
}

/**
 * The pair a selector gives: its PRIMARY line is the active input, its STANDBY line the standby.
 * Where a role is not assigned the line of that position stands in (the first line; the first line
 * that is not the active one) - the rule of the pair a recording starts with (`audioSourceAtStart`).
 */
export function audioPairOfSelector<I extends string>(mics: readonly PairMicLine<I>[] | null | undefined): AudioPairInForce<I> {
  const lines = mics ?? [];
  const active = lines.find((line) => line.role === 'PRIMARY')?.inputId ?? lines[0]?.inputId ?? null;
  const standby = lines.find((line) => line.role === 'STANDBY' && line.inputId !== active)?.inputId ?? lines.find((line) => line.inputId !== active)?.inputId ?? null;
  return { activeInputId: active, standbyInputId: standby };
}

/**
 * The audio pair in force.
 *
 * | The `session` slice | The pair |
 * |---|---|
 * | an OPEN session that states its pair | that pair (operation 81 moves it) |
 * | an OPEN session that states none (before the recording starts; a holder without the member) | not named here: both members `null`, and the reader keeps what it read before - the meters' active input, then the other line of the selector in force |
 * | no session, or a SEALED one | the pair of the CURRENT selector (`audioPairOfSelector`) |
 */
export function audioPairInForce<I extends string>(state: AudioPairState<AudioPair<I>, I>): AudioPairInForce<I> {
  const own = openSessionAudioSource(state.session);
  if (own !== null) return { activeInputId: own.activeInputId, standbyInputId: own.standbyInputId };
  if (sessionIsOpen(state.session)) return NO_PAIR;
  return audioPairOfSelector(state.captureConfig?.mics);
}
