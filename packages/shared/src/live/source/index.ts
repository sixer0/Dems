/**
 * `@dems/shared/live/source`: the Live source (HB-14; backend task 04_client_integration_spec §2.3,
 * §2.5; plan row W44). The heavy half of the Live API: it reaches the typed client and the live
 * socket client, so a client loads it only by a dynamic import behind its build gate (MD-2, MD-6).
 * The light half (`@dems/shared/live`: `settle`, `useCoreActions`, the error classes, the mode
 * helpers) is what feature files import statically.
 *
 * Loading this module starts nothing: it holds declarations only. A request is made and a socket
 * is opened only by a source that `createLiveSim` built, and no Simulated build calls it.
 *
 * ```ts
 * const { createLiveSim, asSim } = await import('@dems/shared/live/source');
 * const live = createLiveSim({
 *   client: createCoreClient({ baseUrl, credentials }),   // every request goes through it
 *   socket: { url: socketUrl, headers },                  // the one socket of this client
 *   onError: writeToPersistentLog,
 * });
 * await live.ready;                                       // the bootstrap of §5.1 is over
 * <SimProvider sim={asSim(live)} autoStart>…</SimProvider>
 * ```
 *
 * | File | Holds |
 * |------|-------|
 * | `live-sim.ts` | `createLiveSim`: the store, the socket handlers, the session, the action runners |
 * | `types.ts` | `LiveSim`, `CreateLiveSimOptions`, `LiveSecretsPort`, `LiveSessionEnd` |
 * | `bindings.ts` | The 42 action bindings, as data |
 * | `command-gate.ts` | Own-command atomicity (CL-16 to CL-18) |
 * | `live-result.ts` | The result of a Live action: a thenable that calls back in the turn of its settlement |
 * | `replica.ts`, `structural-sharing.ts` | What a snapshot and a delta change in the store (CL-13, CL-14) |
 * | `neutral-state.ts`, `clock.ts` | The slices the server never sends, and the Live clock |
 * | `rebuild-error.ts` | The simulator's error classes, rebuilt from an error envelope (CL-20, CL-21) |
 * | `touch-throttle.ts` | `touchSession`, at most once a minute (CL-27) |
 * | `constants.ts` | The timings of §2.4 that belong to the source |
 */
import type { Sim } from '../../sim/engine';
import type { LiveClient, LiveSim } from './types';

export * from './constants';
export * from './types';
export {
  DEVICE_COMMAND_OPERATION_INDEX,
  LIVE_BINDINGS,
  LIVE_BINDING_NAMES,
  LIVE_RESULT_DISCRIMINANT,
  LIVE_VALUE_ACTION_NAMES,
  LiveActionFlow,
  NOT_AVAILABLE,
  attemptResult,
  operationOf,
  type BindingEntity,
  type BindingExtras,
  type BindingPlan,
  type BindingView,
  type LiveBinding,
  type LiveBindings,
  type LiveDeviceDescription,
} from './bindings';
export { createLiveClock, type LiveClock } from './clock';
export {
  createCommandGate,
  type CommandGate,
  type CommandGateOptions,
  type GateOutcome,
  type GateTarget,
  type GateTimers,
  type GateWaitOptions,
} from './command-gate';
export {
  createLiveResult,
  rejectedLiveResult,
  resolvedLiveResult,
  type LiveResult,
  type LiveResultControl,
  type LiveResultHooks,
  type LiveResultReporter,
} from './live-result';
export {
  LIVE_DEVICE_CLEANUP_GAVE_UP_CODE,
  LIVE_ERROR_SOURCE,
  LIVE_SESSION_OPERATION,
  LIVE_SIGN_IN_STATUS_OPERATION,
  LIVE_SNAPSHOT_TIMEOUT_CODE,
  LIVE_STOPPED_CODE,
  LiveMisuse,
  createLiveSim,
} from './live-sim';
export {
  NEUTRAL_LOCKOUT,
  attemptsRemainingOf,
  authSliceOf,
  createNeutralState,
  failedPairing,
  lockoutSliceOf,
  neutralPairing,
  noSignalFrame,
  pairedSlice,
  signedOutAuthSlice,
  silentAudio,
} from './neutral-state';
export {
  ENVELOPE_SIM_CODE,
  envelopeSimCodeOf,
  isRefusal,
  permissionLabelOf,
  rebuildRefusal,
  transportErrorOf,
  type RefusalContext,
} from './rebuild-error';
export {
  foldStateMessages,
  hasReached,
  replacementPatch,
  type ReplicaPatch,
  type ReplicaPosition,
  type ReplicatedSlices,
  type StateMessage,
} from './replica';
export { shareStructure, type StructuralSharing } from './structural-sharing';
export { createTouchThrottle, type TouchThrottle, type TouchThrottleOptions } from './touch-throttle';

/**
 * The two members of `Sim` a Live source holds in another type. Every other member of `Sim` is
 * assignable from a Live source as it is, and the compiler checks that in `asSim`.
 * - `actions` return a Live result where the simulator returns a value. A call site reads its
 *   actions through `useCoreActions()` (`@dems/shared/live`), whose type says so, and never
 *   through `useSimActions()` (a static test of the client folders enforces it, AC-C-53; the Live
 *   source reports a result that is read as a value all the same, see `./live-sim`, "Misuse").
 * - `store` has no `persist` member: nothing is read from or written to the simulator's stored
 *   snapshot in Live mode (MD-5). No production file of the two clients reads `store.persist`.
 */
type SimMemberOfAnotherType = 'actions' | 'store';

/** Compile-time proof that a Live source has EVERY member of `Sim` by name: a member added to `Sim` does not compile until the Live source has it. */
type MissingSimMember = Exclude<keyof Sim, keyof LiveSim>;
const EVERY_SIM_MEMBER_IS_PRESENT: [MissingSimMember] extends [never] ? true : never = true;

/**
 * A Live source as the `Sim` of the existing `SimContext` (ADQ-2): **the one documented cast**.
 *
 * It is checked, not blind (finding CPC1-14). The assignment below holds every member of `Sim`
 * but `actions` and `store` to the simulator's own type, and `MissingSimMember` holds the names.
 * Only the narrowing of those two members is taken on trust, for the reasons given above.
 */
export function asSim(live: LiveSim<LiveClient>): Sim {
  const checked: Omit<Sim, SimMemberOfAnotherType> = live;
  return EVERY_SIM_MEMBER_IS_PRESENT && (checked as Sim);
}
