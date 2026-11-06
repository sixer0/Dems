/**
 * The selector IN FORCE: the ONE place the app decides whether a screen names its capture sources
 * from a session's own selector snapshot or from the Core's current selector (fix wave L, G70c-01).
 *
 * | Rule | Why |
 * |---|---|
 * | a session's snapshot names the sources ONLY while that session is OPEN | the snapshot is "the selector as it was when recording started" (register SH-05): it is true of that session, and of nothing after it |
 * | OPEN = the `session` slice holds a session whose state is stated and is not `SEALED` | the slice keeps the LAST session after its seal (`isSessionActive` of the simulator: not null, not SEALED). A sealed session is closed: the selector is unlocked and may have been edited since |
 * | otherwise: the Core's current selector (`captureConfig`, slice 29) | what the NEXT session will record |
 *
 * The defect this closes: every reader spelled `state.session?.captureConfig ?? state.captureConfig`,
 * so the snapshot of the last SEALED session hid every later edit of the selector - Home and Session
 * New named the camera a track had BEFORE the change, with that camera's badge.
 *
 * THE RULE ITSELF LIVES IN `@dems/shared/sim` (`packages/shared/src/sim/selector-in-force.ts`, closing
 * pass L-Z): the simulator's own readers (`captureMicLines`, the pre-check rows, the capture notices),
 * the web console and this app hold ONE function. This file is the app's one door to it.
 *
 * The AUDIO PAIR is under the same rule (fix 157): `audioPairInForce` - the pair of the OPEN session,
 * otherwise the pair the current selector gives. No reader spells `session?.audioSource` itself.
 *
 * No reader in `apps/mobile` may spell the expression itself: the static case of
 * `selector-in-force.test.ts` fails on a second one.
 */

export { audioPairInForce, audioPairOfSelector, openSessionAudioSource, cameraLinesInForce, micLinesInForce, openSessionSnapshot, selectorInForce, selectorOfSession, sessionIsOpen, type SelectorState, type SnapshotSession } from '@dems/shared/sim';
