/**
 * `createLiveSim`: the Live source (HB-14; backend task 04_client_integration_spec §2.3, §2.5,
 * §5.1, §5.2, §6.5; research ADQ-2, ADQ-3; plan row W44; fix round after checkpoint CP-C1,
 * decision D80).
 *
 * The client-side replica of the Core server's state, behind the contract the screens already
 * use: a store of `SimState` shape, the 42 actions of `SimActions` by name, a clock. It is placed
 * in the simulator's own `SimContext`, so `useSim(selector)` and every selector work unchanged.
 *
 * | Part | File | Rule |
 * |------|------|------|
 * | The store and what a snapshot or a delta changes in it | `./replica`, `./structural-sharing` | CL-13, CL-14 |
 * | The five slices the server never sends as a slice | `./neutral-state`, `./clock` | §2.3 |
 * | The 42 bindings | `./bindings` | §2.5, CL-19 |
 * | When an action settles | `./command-gate`, `./live-result` | CL-16 to CL-18, CL-24 to CL-26 |
 * | What a refused action rejects with | `./rebuild-error` | CL-20, CL-21 |
 * | `touchSession` | `./touch-throttle` | CL-27 |
 *
 * **Transports are injected.** Every request goes through the typed client that is passed in
 * (decision D69: no raw request to the Core origin); the one socket is the live socket client,
 * built from the URL, the factory and the header provider that are passed in. This file names no
 * platform object.
 *
 * **Secrets.** The source keeps no token and logs none. A device sign-in hands the session token
 * to the app's storage (`secrets.sessionIssued`) in the turn the answer arrived; the credential
 * providers of the client and of the socket belong to the app. Every wait for that storage is
 * bounded (`LIVE_SECRETS_TIMEOUT_MS`), except the one behind the biometric prompt.
 *
 * **Who is signed in** (the `auth` slice):
 *
 * | Event | `auth.status` | `session` |
 * |-------|---------------|-----------|
 * | The session is known (the start-up probe, or a sign-in answer) AND the snapshot of an OPERATOR socket is applied; both in ONE store update | SIGNED_IN | The `AuthSessionInfo` |
 * | `session.updated` | Stays SIGNED_IN | Replaced: new role and permissions |
 * | Own `signOut` answered; `session.ended` SIGNED_OUT, USER_DISABLED, TOKEN_REUSE; close 4401 alone; a `hello` that refuses the credential; 401 `NOT_SIGNED_IN` on a call | SIGNED_OUT | null |
 * | `session.ended` IDLE_EXPIRED, ABSOLUTE_EXPIRED | EXPIRED | null |
 * | `session.ended` ROTATED | Unchanged until `getAuthSession` answered: 200 keeps the client signed in as whoever owns the credential now, 401 signs it out | As answered |
 * | `device.revoked`, close 4403, 403 `DEVICE_REVOKED`, own `unpair` answered | SIGNED_OUT, and `pairing` becomes the neutral value | null |
 * | Own `signOut` (USER or LOCK) while the link is not ONLINE, or one that got no answer, or one the Core refused: a **local end** | SIGNED_OUT | null |
 * | The idle or the absolute expiry this client reckons with passes, the Core is asked, and it answers 401 | EXPIRED | null |
 * | The same, and the Core cannot be asked and would not tell either (the link is down, or the socket is not the session's OPERATOR socket): a **local end** | EXPIRED | null |
 *
 * `auth.status` has no value "LOCKED" (SIM-GAP-2, local adapter): a locked console is SIGNED_OUT,
 * and `lastSessionEnd.signOut` says `LOCK`. The shell reads its notice from there.
 *
 * Whenever a session or a pairing ends, the 28 replicated slices go back to the neutral value in
 * the same store update (a signed-out client holds no Core data), `lastSessionEnd` says why, and
 * the listeners of `onSessionEnd` are called. The source shows nothing, navigates nowhere and
 * deletes nothing: the app does, in those listeners and in its `secrets` port.
 *
 * **A local end** (decision D80) is never skipped because the Core cannot be reached. The replica
 * is cleared at once, `lastSessionEnd.source` is LOCAL, and the app's `sessionCleared` is called
 * then. What the Core has not heard is a **debt** (decision D90): a record of the session it is
 * for (its operator and the instant the Core issued it), the reason and the instant. It holds no
 * credential. The app may keep it across a reload (`options.owedSignOut`), so a Lock the Core
 * never heard of is not undone by loading the page again.
 *
 * **A debt is never paid blindly** (`settleDebt`). As soon as an OPERATOR socket appears, and at a
 * start that finds a stored debt, that socket is not taken (its state stays held back) and the
 * Core is asked which session the credential names now. Only the SAME session, still open, is
 * signed out, and only for USER or LOCK. Another session (a new sign-in, in this tab or another)
 * owes nothing and is taken. A session that is over owes nothing. For an EXPIRY this client
 * reckoned, no sign-out is ever sent: when the Core still holds the session the reckoning was
 * early and the session is taken again. A sign-out the Core refuses fails closed: the console
 * stays signed out here and the debt stays. A socket that is no OPERATOR socket means the
 * credential names no session: nothing is owed. A sign-in that succeeds ends the debt.
 *
 * **An expiry is never decided on a reckoning while the Core can be asked** (`checkExpiry`). The
 * instant this client reckons with can be early (activity in another tab, an answer that was
 * lost), so at that instant the Core is asked, and its answer decides. The session ends here by
 * itself only when the Core cannot be asked and would not tell.
 *
 * **One revocation is one end.** The first sign that the pairing is over (`device.revoked`, close
 * 4403, a 403 `DEVICE_REVOKED`) ends it; every later sign of the same revocation is dropped. When
 * the socket that was reopened afterwards is refused again, the stored credential is still being
 * presented: the app's `deviceUnpaired` is asked again after a growing delay, a bounded number of
 * times, and then the socket stays closed until the app calls `reconnect('CREDENTIAL')`.
 *
 * **Reports.** Every rejected action, every dropped frame of the socket and every exception of a
 * listener or a store subscriber is one structured report: kept in `errors()` (the last 50) and
 * handed to `onError`, where the app writes it to its persistent log. A report holds codes, the
 * operation ID, the status, the request ID and the error's own message. That message can name an
 * entity ID the caller passed (a 404), and a rebuilt error carries the state and permission names
 * of the envelope. A report never holds a credential, a header or a request body, and no state
 * content: a failing subscriber is reported by the names of the slices that changed.
 *
 * **Misuse** (finding F66-10). Under `asSim`, `useSimActions()` hands these actions out typed as
 * the simulator's, so a call site can read a Live result as a value. Two signs are reported, once
 * per action name each, under `live.misuse`:
 *
 * | Sign | Level | What it proves |
 * |------|-------|----------------|
 * | `READ_AS_VALUE`: the member `ok` was read on the result of an action that returns a value in the simulator | error | A certain misuse: a promise-shaped result has no such member |
 * | `NOT_OBSERVED`: such a result settled and `then`, `catch` and `finally` were never called on it | warn | The value was dropped, or it was read as a value by a member other than `ok`. The two cannot be told apart |
 *
 * Not detectable: an action that returns nothing in the simulator (a fire-and-forget call and a
 * `try` around it look the same here), and a handler that is attached only after the result
 * settled and a few promise jobs passed (then `NOT_OBSERVED` is reported although the value is used).
 *
 * **State** (one record, `state`; finding CPC1-15):
 *
 * | Member | Meaning | Set | Cleared |
 * |--------|---------|-----|---------|
 * | `run` | Counts `start()`. A continuation of an earlier run changes nothing | `start` | never |
 * | `era` | Counts session ends and sign-ins. A probe answer of an earlier era is not applied | `endSession`, a sign-in's snapshot | never |
 * | `probing` | `getAuthSession` of the bootstrap is out | `probeSession` | its answer, `endSession`, `stop` |
 * | `probeFailures`, `probeNotBefore` | Unanswered probes in a row (the back-off), and the end of the server's `retry-after` for `getAuthSession` (the probe and the confirmation of CPC1-35 both keep to it) | a probe or a confirmation without an answer | an answer, `endSession` (the count) |
 * | `sessionHold` | State messages are held because the session of the socket is not known, a sign-out is owed, or a known session is not yet confirmed for a new socket | `holdForSession` | the probe's answer, a sign-in, `endSession`, the owed answer, the confirmation, `stop` |
 * | `rotated` | `session.ended` said ROTATED: the probe decides whether this client is still signed in | `onControl` | the probe's answer, `endSession` |
 * | `signingIn` | Sign-ins between their request and their settlement | `runSignIn` | their settlement, `stop` |
 * | `statusInFlight`, `lockoutKnown`, `lockoutSeq` | The lock state of this console: a read is out; it was read; which credential it was read with | `refreshSignInStatus` | `endSession`, a sign-in, `pair`, `start` raise `lockoutSeq` and clear `lockoutKnown` |
 * | `pendingSignOut` | The reason of this client's own sign-out that is out | `runSignOut` | its answer, `stop` |
 * | `connection` | The connection of the newest `hello` or state message | the socket handlers | never |
 * | `endedConnection` | The socket whose end is dealt with: its close needs no second handling | `endSession`, ROTATED, the owed sign-out | overwritten; a session that is taken after a debt check (CPC1-33) |
 * | `refusedConnection` | The socket whose state the server named no session for: its state messages are dropped | the probe's refusal | a probe that finds a session, a sign-in |
 * | `socketAsked` | A socket that carries the known session was asked for, once (CPC1-9) | `ensureSessionSocket`, `onHello` | an OPERATOR `hello`, `endSession`, a new session |
 * | `owed`, `owedCall`, `owedFailures`, `owedRefused`, `owedRefusals` | The debt of a local end (the session, the reason, the instant); the question or payment that is out; unanswered ones in a row; the Core refused the payment (reported once); refusals in a row, after 5 the source stops asking by itself until a new OPERATOR socket appears (CPC1-36) | `endLocally`, `loadDebt`, `settleDebt` | `clearDebt`: paid, found not owed, the answer of a sign-in, a socket that is no OPERATOR socket |
 * | `debtKnown`, `debtPortFailed` | The app's storage of the debt was read (true at once without one); it failed once and is not asked again | `loadDebt`, `debtStorage` | never |
 * | `debtTail` | Settles when the storage has really finished its newest call that is still out; the next call waits for it, so the calls take effect in the order they were asked for (CPC1-34). Null for a storage that answers at once | `debtStorage` | when that call ends |
 * | `debtUnread`, `declined` | The storage could not be read at the start, so a debt may exist: the first session the Core names is not taken; and which session that was (CPC1-34) | `loadDebt`; `declines` | a probe answered 401, the answer of a sign-in (both); `declines` (`debtUnread`) |
 * | `validatedConnection`, `revalidating`, `revalidateFailures` | The connection that was current when the Core last named the known session to this client; the question that confirms it for a newer socket is out; such questions without a usable answer on the present socket (CPC1-35) | `adoptSession`, `ensureSessionSocket`; `revalidateSession` | its answer, `endSession`, a sign-in's snapshot, `stop` (the question); the `hello` of a new socket (the count) |
 * | `expiryAsked`, `expiryFailures` | The Core is being asked about a reckoned expiry; questions in a row without a later instant | `checkExpiry` | its answer, `endSession`, `stop` |
 * | `activityAt` | The last answered POST of the signed-in operator (an action's, or a page's through `live.client`), on the Live clock: it moves the idle expiry this client reckons with | `noteActivity` | a session answer, `endSession` |
 * | `retiredEnd`, `cleanupTries` | The end of the pairing that was dealt with, and how often the app's storage was asked again | `endSession` (DEVICE_REVOKED) | `pair`, `setPairing`, `reconnect('CREDENTIAL')` |
 * | `lastEnd` | Resolves when the newest end was passed to the app's storage and the socket was reopened | `endSession` | never |
 * | `timers` | One slot per one-shot timer: `boot`, `permission`, `probe`, `owed`, `expiry`, `cleanup`, `revalidate` | `arm` | when it fires, `cancel`, `stop` (all) |
 */
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore, type StateCreator, type StoreMutatorIdentifier } from 'zustand/vanilla';
import { ApiErrorCode, findCoreApiOperation } from '../../api/core-api';
import type { AuthSessionExpiry, AuthSessionInfo, SignInResponse, SignInStatus } from '../../api/identity';
import type { PairingRedeemed } from '../../api/pairing';
import {
  RealtimeHelloReason,
  RealtimePrincipal,
  SessionEndedReason,
  type DeltaMessage,
  type HelloMessage,
  type MetersMessage,
  type SnapshotMessage,
} from '../../api/realtime-messages';
import type { AuditChainStatus } from '../../api/security-audit';
import type { SimActionName } from '../../api/sim-actions';
import type { CoreCallFailure, CoreCallResult, CoreLooseCallInput } from '../../client/core-client';
import type { HeartbeatClient } from '../../realtime/heartbeat-client';
import {
  DEFAULT_TIMERS as LIVE_SOCKET_DEFAULT_TIMERS,
  createLiveSocketClient,
  type LiveSocketControlMessage,
  type LiveSocketEnd,
  type LiveSocketErrorReport,
  type LiveSocketResyncEvent,
} from '../../realtime/live-socket-client';
import { AUTH_IDLE_TIMEOUT_MS, CLOCK_TICK_MS } from '../../sim/constants';
import { describeError } from '../../sim/errors';
import type { Rng, RngStreams } from '../../sim/rng';
import type { AudioSlice, DetailValue, SimErrorReport, SimState } from '../../sim/types';
import { AuthStatus, PairingState, SignOutReason } from '../../sim/vocabulary';
import { CoreRefusalError, LiveTransportError, LiveTransportReason } from '../errors';
import { CoreMode, LiveLinkState } from '../mode';
import {
  LIVE_BINDINGS,
  LIVE_BINDING_NAMES,
  LIVE_RESULT_DISCRIMINANT,
  LIVE_VALUE_ACTION_NAMES,
  LiveActionFlow,
  NOT_AVAILABLE,
  type BindingExtras,
  type BindingPlan,
  type BindingView,
  type LiveBinding,
} from './bindings';
import { createLiveClock } from './clock';
import { createCommandGate, type GateOutcome, type GateTarget, type GateWaitOptions } from './command-gate';
import {
  LIVE_BOOT_TIMEOUT_MS,
  LIVE_DEVICE_CLEANUP_RETRIES,
  LIVE_DEVICE_CLEANUP_RETRY_MS,
  LIVE_ERROR_LOG_SIZE,
  LIVE_HELD_MESSAGES_MAX,
  LIVE_PERMISSION_REFRESH_MS,
  LIVE_SECRETS_TIMEOUT_MS,
  LIVE_SESSION_PROBE_RETRY_MAX_MS,
  LIVE_SESSION_PROBE_RETRY_MS,
  LIVE_SETTLE_TIMEOUT_MS,
  LIVE_SUBSCRIBER_REPORT_INTERVAL_MS,
  LIVE_TOUCH_INTERVAL_MS,
} from './constants';
import {
  createLiveResult,
  isThenable,
  rejectedLiveResult,
  resolvedLiveResult,
  type LiveResult,
  type LiveResultControl,
  type LiveResultHooks,
} from './live-result';
import {
  NEUTRAL_LOCKOUT,
  authSliceOf,
  clockSliceAt,
  createNeutralState,
  failedPairing,
  isSilentAudio,
  lastActivityOf,
  lockoutSliceOf,
  neutralPairing,
  pairedSlice,
  signedOutAuthSlice,
  silentAudio,
} from './neutral-state';
import { isRefusal, rebuildRefusal, transportErrorOf } from './rebuild-error';
import { foldStateMessages, replacementPatch, type ReplicaPosition } from './replica';
import { shareStructure, type StructuralSharing } from './structural-sharing';
import { createTouchThrottle } from './touch-throttle';
import type {
  CreateLiveSimOptions,
  LiveActions,
  LiveAuditChain,
  LiveClient,
  LiveOwedSignOut,
  LiveSessionEnd,
  LiveSessionEndSource,
  LiveSim,
  LiveStore,
} from './types';

/** The two reads the bootstrap makes (§5.1 steps 3 and 4). They stand for no action, so the action table does not name them. */
export const LIVE_SESSION_OPERATION = 'getAuthSession';
export const LIVE_SIGN_IN_STATUS_OPERATION = 'getSignInStatus';

/** `source` of every report of this folder starts with it. */
export const LIVE_ERROR_SOURCE = 'live';

/** `code` of the transport error of a sign-in whose snapshot did not arrive in time (§5.2 step 6). */
export const LIVE_SNAPSHOT_TIMEOUT_CODE = 'SNAPSHOT_TIMEOUT';

/** `code` of the transport error of an action that was still out when the source was stopped. */
export const LIVE_STOPPED_CODE = 'STOPPED';

/**
 * `context.code` of the one `live.secrets` report that says the device clean-up gave up: the
 * stored device credential is still presented after `LIVE_DEVICE_CLEANUP_RETRIES` repeats, and the
 * socket stays closed until the app deletes it and calls `reconnect('CREDENTIAL')`.
 */
export const LIVE_DEVICE_CLEANUP_GAVE_UP_CODE = 'DEVICE_CLEANUP_GAVE_UP';

/** The two signs of a Live result that is used as a value (`context.misuse` of a `live.misuse` report). */
export const LiveMisuse = {
  READ_AS_VALUE: 'READ_AS_VALUE',
  NOT_OBSERVED: 'NOT_OBSERVED',
} as const;
export type LiveMisuse = (typeof LiveMisuse)[keyof typeof LiveMisuse];

/** `rng` of a Live source: nothing is drawn on a client in Live mode, so every draw is its lowest value. */
const INERT_RNG: Rng = {
  next: () => 0,
  int: (min, max) => Math.ceil(Math.min(min, max)),
  float: (min, max) => Math.min(min, max),
  chance: () => false,
  pick: <T>(items: readonly T[]): T => items[0] as T,
  gauss: (mean = 0) => mean,
  poisson: () => 0,
  exponential: () => 0,
  hex: (length) => '0'.repeat(Math.max(0, length)),
  state: () => 0,
};

const VALUE_ACTIONS: ReadonlySet<string> = new Set<string>(LIVE_VALUE_ACTION_NAMES);

type LooseCall = (operationId: string, input?: CoreLooseCallInput) => Promise<CoreCallResult>;
type AnyBinding = LiveBinding<readonly unknown[], unknown>;
type CallPlan = Extract<BindingPlan<unknown>, { kind: 'call' }>;
type LocalPlan = Exclude<BindingPlan<unknown>, { kind: 'call' }>;
type ReportContext = Record<string, DetailValue>;
type ExpiryReason = typeof SessionEndedReason.IDLE_EXPIRED | typeof SessionEndedReason.ABSOLUTE_EXPIRED;
type LocalEndReason = typeof SessionEndedReason.SIGNED_OUT | ExpiryReason;

const TIMER_NAMES = ['boot', 'permission', 'probe', 'owed', 'expiry', 'cleanup', 'revalidate'] as const;
type TimerName = (typeof TIMER_NAMES)[number];
type TimerSlot = { readonly handle: unknown } | null;

interface EndInput {
  kind: LiveSessionEnd['kind'];
  reason: LiveSessionEnd['reason'];
  source: LiveSessionEndSource;
  signOut?: SignOutReason | null;
  helloReason?: LiveSessionEnd['helloReason'];
  principal?: LiveSessionEnd['principal'];
}

/** An action whose request is out: `stop()` settles it. */
interface Flight {
  readonly control: LiveResultControl<unknown>;
  readonly action: string;
  readonly operationId: string | null;
}

/** How a command leaves the gate: exactly once, whatever happens between its `begin` and its settlement. */
interface GateExit {
  end(settle: () => void): void;
  wait(target: GateTarget, options: GateWaitOptions): void;
}

/** How one call of the app's storage ended. A failure carries nothing of what the port threw (CPC1-26). */
type PortOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly stopped: boolean };

/**
 * CPC1-36: how often in a row the Core may refuse the payment of one debt before the source stops
 * asking by itself. The debt stays, and the console stays signed out; it is asked about again
 * when the next OPERATOR socket appears.
 */
const OWED_REFUSALS_MAX = 5;

const OWED_REASONS: readonly string[] = [
  SignOutReason.USER,
  SignOutReason.LOCK,
  SessionEndedReason.IDLE_EXPIRED,
  SessionEndedReason.ABSOLUTE_EXPIRED,
];

/** What the app's storage handed back as a debt: taken only when it has the record's exact shape. */
function owedSignOutOf(value: unknown): LiveOwedSignOut | null {
  if (typeof value !== 'object' || value === null) return null;
  const { operatorId, issuedAt, reason, at } = value as Record<string, unknown>;
  if (typeof operatorId !== 'string' || operatorId === '') return null;
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt) || typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (typeof reason !== 'string' || !OWED_REASONS.includes(reason)) return null;
  return { operatorId, issuedAt, reason: reason as LiveOwedSignOut['reason'], at };
}

/** Everything of a Live source that changes over time, in one record. The table in the header says what sets and clears each member. */
interface LiveSourceState {
  // ── The Live handle ──
  link: LiveLinkState;
  session: AuthSessionInfo | null;
  lastSessionEnd: LiveSessionEnd | null;
  auditChain: LiveAuditChain | null;
  // ── Life cycle ──
  running: boolean;
  run: number;
  ready: boolean;
  clockSampled: boolean;
  clockTimer: TimerSlot;
  timers: Record<TimerName, TimerSlot>;
  unsubscribeVisibility: (() => void) | null;
  // ── Finding the session ──
  era: number;
  probing: boolean;
  probeFailures: number;
  probeNotBefore: number;
  sessionHold: boolean;
  rotated: boolean;
  signingIn: number;
  statusInFlight: boolean;
  lockoutKnown: boolean;
  lockoutSeq: number;
  pendingSignOut: SignOutReason | null;
  connection: number;
  endedConnection: number | null;
  refusedConnection: number | null;
  socketAsked: boolean;
  // ── A local end (decisions D80, D90) ──
  owed: LiveOwedSignOut | null;
  owedCall: Promise<void> | null;
  owedFailures: number;
  owedRefused: boolean;
  owedRefusals: number;
  debtKnown: boolean;
  debtPortFailed: boolean;
  debtTail: Promise<void> | null;
  debtUnread: boolean;
  declined: { readonly operatorId: string; readonly issuedAt: number } | null;
  validatedConnection: number;
  revalidating: boolean;
  revalidateFailures: number;
  expiryAsked: boolean;
  expiryFailures: number;
  activityAt: number | null;
  // ── The end of the pairing ──
  retiredEnd: LiveSessionEnd | null;
  cleanupTries: number;
  lastEnd: Promise<void>;
  // ── Reports ──
  misuse: Set<string>;
  subscriberReports: Map<string, { at: number; skipped: number }>;
}

function initialState(): LiveSourceState {
  return {
    link: LiveLinkState.CONNECTING,
    session: null,
    lastSessionEnd: null,
    auditChain: null,
    running: false,
    run: 0,
    ready: false,
    clockSampled: false,
    clockTimer: null,
    timers: { boot: null, permission: null, probe: null, owed: null, expiry: null, cleanup: null, revalidate: null },
    unsubscribeVisibility: null,
    era: 0,
    probing: false,
    probeFailures: 0,
    probeNotBefore: 0,
    sessionHold: false,
    rotated: false,
    signingIn: 0,
    statusInFlight: false,
    lockoutKnown: false,
    lockoutSeq: 0,
    pendingSignOut: null,
    connection: 0,
    endedConnection: null,
    refusedConnection: null,
    socketAsked: false,
    owed: null,
    owedCall: null,
    owedFailures: 0,
    owedRefused: false,
    owedRefusals: 0,
    debtKnown: true,
    debtPortFailed: false,
    debtTail: null,
    debtUnread: false,
    declined: null,
    validatedConnection: 0,
    revalidating: false,
    revalidateFailures: 0,
    expiryAsked: false,
    expiryFailures: 0,
    activityAt: null,
    retiredEnd: null,
    cleanupTries: 0,
    lastEnd: Promise.resolve(),
    misuse: new Set(),
    subscriberReports: new Map(),
  };
}

function isPost(operationId: string): boolean {
  return findCoreApiOperation(operationId)?.method === 'post';
}

/** The wait before a question of the source's own is asked again: doubling, capped, and never inside the server's `retry-after`. */
function retryDelay(failures: number, retryAfterSeconds: number | null): number {
  const backoff = Math.min(LIVE_SESSION_PROBE_RETRY_MAX_MS, LIVE_SESSION_PROBE_RETRY_MS * 2 ** Math.min(failures, 8));
  return retryAfterSeconds !== null && retryAfterSeconds > 0 ? Math.max(backoff, retryAfterSeconds * 1_000) : backoff;
}

/**
 * Every subscriber of the store is called by itself (finding CPC1-2): the store library calls its
 * listeners in one loop with no guard, so one listener, or one selector, that throws would stop
 * the loop, keep the others from hearing of the update, and throw into the turn that committed it.
 */
function guardSubscribers<State, Mutators extends [StoreMutatorIdentifier, unknown][]>(
  initializer: StateCreator<State, [], Mutators>,
  report: (error: unknown) => void,
): StateCreator<State, [], Mutators> {
  return (set, get, api) => {
    const subscribe = api.subscribe;
    api.subscribe = (listener) =>
      subscribe((next, previous) => {
        try {
          listener(next, previous);
        } catch (error) {
          report(error);
        }
      });
    return initializer(set, get, api);
  };
}

export function createLiveSim<Client extends LiveClient>(options: CreateLiveSimOptions<Client>): LiveSim<Client> {
  const local = options.now ?? (() => Date.now());
  // The platform's timer functions exist once, in the live socket client (finding CPC1-16).
  const timers = options.timers ?? LIVE_SOCKET_DEFAULT_TIMERS;
  const settleTimeoutMs = options.settleTimeoutMs ?? LIVE_SETTLE_TIMEOUT_MS;
  const bootTimeoutMs = options.bootTimeoutMs ?? LIVE_BOOT_TIMEOUT_MS;
  const { secrets, visibility } = options;
  const call: LooseCall = (operationId, input) => (options.client as unknown as { call: LooseCall }).call(operationId, input ?? {});

  const state = initialState();
  const debtPort = options.owedSignOut;
  // With a place to keep a debt, nothing may be taken before that place was read (CPC1-24).
  state.debtKnown = debtPort === undefined;
  const clock = createLiveClock(local);
  /** The Live clock in the 100 ms steps the `clock` slice is published in, as the simulator publishes it. */
  const publishedNow = (): number => {
    const now = clock.now();
    return now - (now % CLOCK_TICK_MS);
  };
  const store: LiveStore = createStore<SimState>()(
    guardSubscribers(
      subscribeWithSelector(() => createNeutralState(publishedNow())),
      (error) => reportSubscriber(error),
    ),
  );

  const liveListeners = new Set<() => void>();
  const controlListeners = new Set<(message: LiveSocketControlMessage) => void>();
  const endListeners = new Set<(end: LiveSessionEnd) => void>();
  const resyncListeners = new Set<(event: LiveSocketResyncEvent) => void>();
  /** Actions whose request is out. */
  const flights = new Set<Flight>();
  /** Waits for the app's storage that are still running: each entry ends its wait. */
  const budgets = new Set<() => void>();

  let resolveReady: () => void = () => undefined;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  // ── Reports ──────────────────────────────────────────────────────────────────────────

  const errorLog: SimErrorReport[] = [];

  function record(entry: SimErrorReport): void {
    errorLog.push(entry);
    if (errorLog.length > LIVE_ERROR_LOG_SIZE) errorLog.shift();
    try {
      options.onError?.(entry);
    } catch {
      // A failing sink must never break the source; the entry stays in errors().
    }
  }

  /** Reports something that was thrown: an exception of a listener, of a port, or of this file. */
  function reportThrown(source: string, error: unknown, context?: ReportContext): void {
    const { message, stack } = describeError(error);
    record({
      level: 'error',
      source: `${LIVE_ERROR_SOURCE}.${source}`,
      message,
      at: clock.now(),
      ...(stack ? { stack } : {}),
      ...(context ? { context } : {}),
    });
  }

  /**
   * A store subscriber, or the selector of one, threw (CPC1-2). The update stands and every other
   * subscriber was told. One that keeps throwing is reported at most once in a second, with the
   * count of what was left out, so a subscriber of the clock slice cannot flood the log.
   */
  function reportSubscriber(error: unknown): void {
    const { message } = describeError(error);
    const now = local();
    const known = state.subscriberReports.get(message);
    if (known !== undefined && now - known.at < LIVE_SUBSCRIBER_REPORT_INTERVAL_MS) {
      known.skipped += 1;
      return;
    }
    if (state.subscriberReports.size >= 16) state.subscriberReports.clear();
    state.subscriberReports.set(message, { at: now, skipped: 0 });
    reportThrown('subscriber', error, {
      errorName: error instanceof Error ? error.name : typeof error,
      skipped: known?.skipped ?? 0,
    });
  }

  /** CL-24: one report per rejected action. Codes and IDs only; never a request body, never a header. */
  function reportRejection(action: string, error: unknown, operationId: string | null, failure: CoreCallFailure | null): void {
    const refusal = error instanceof CoreRefusalError || (error instanceof Error && error.name.startsWith('Sim'));
    const code = (error as { code?: unknown } | null)?.code;
    const reason = (error as { reason?: unknown } | null)?.reason;
    const { message, stack } = describeError(error);
    const expected = refusal || error instanceof LiveTransportError;
    record({
      // A refusal is an answer of the Core; no answer, and anything unexpected, is an error.
      level: refusal ? 'warn' : 'error',
      source: `${LIVE_ERROR_SOURCE}.action.${action}`,
      message,
      at: clock.now(),
      // The stack of an expected outcome says nothing; an unexpected error keeps it.
      ...(!expected && stack ? { stack } : {}),
      context: {
        action,
        errorName: error instanceof Error ? error.name : typeof error,
        operationId,
        status: failure?.status ?? null,
        code: typeof code === 'string' ? code : (failure?.error.code ?? null),
        reason: typeof reason === 'string' ? reason : null,
        requestId: failure?.requestId ?? null,
        link: state.link,
      },
    });
  }

  /** F66-10: a Live result that is used as a value. Once per action name and sign. */
  function reportMisuse(action: string, misuse: LiveMisuse, member: string | null): void {
    const key = `${misuse}:${action}`;
    if (state.misuse.has(key)) return;
    state.misuse.add(key);
    record({
      level: misuse === LiveMisuse.READ_AS_VALUE ? 'error' : 'warn',
      source: `${LIVE_ERROR_SOURCE}.misuse`,
      message:
        misuse === LiveMisuse.READ_AS_VALUE
          ? `The result of the Live action "${action}" was read as a value (member "${member ?? ''}"). It is a Live result: hand the call to settle(), or await it, and take the actions from useCoreActions().`
          : `The result of the Live action "${action}" was never observed: neither then, catch nor finally was called on it. In Live mode its value arrives later: hand the call to settle(), or await it.`,
      at: clock.now(),
      context: { action, misuse, member },
    });
  }

  const guarded = (source: string, run: () => void): void => {
    try {
      run();
    } catch (error) {
      reportThrown(source, error);
    }
  };

  function notifyLive(): void {
    for (const listener of Array.from(liveListeners)) guarded('listener.onLiveChange', listener);
  }

  function subscribeTo<Listener>(listeners: Set<Listener>, listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  // ── The store ────────────────────────────────────────────────────────────────────────

  /** CL-13, guarded: a sharing function of the caller that throws must not lose a state message. */
  const sharing = options.structuralSharing ?? shareStructure;
  const share: StructuralSharing = (previous, next) => {
    try {
      return sharing(previous, next);
    } catch (error) {
      reportThrown('structuralSharing', error);
      return next;
    }
  };

  /** One store update. An empty patch touches nothing, so no subscriber is told. It never throws (CPC1-2). */
  function commit(patch: Partial<SimState>): void {
    const slices = Object.keys(patch);
    if (slices.length === 0) return;
    try {
      store.setState(patch);
    } catch (error) {
      reportThrown('store', error, { slices: slices.length <= 6 ? slices.join(',') : `${slices.length} slices` });
    }
  }

  const viewNow = (): BindingView => ({ state: store.getState(), now: clock.now() });

  function sameAuth(a: SimState['auth'], b: SimState['auth']): boolean {
    return (
      a.status === b.status &&
      a.operatorId === b.operatorId &&
      a.method === b.method &&
      a.issuedAt === b.issuedAt &&
      a.lastActivityAt === b.lastActivityAt
    );
  }

  /** The `auth` slice of a signed-in client when it differs from the store's; nothing otherwise. */
  function authPatch(): Partial<SimState> {
    if (state.session === null) return {};
    const next = authSliceOf(state.session);
    return sameAuth(store.getState().auth, next) ? {} : { auth: next };
  }

  // ── Timers and the life cycle of one run ─────────────────────────────────────────────

  function cancel(name: TimerName): void {
    const slot = state.timers[name];
    if (slot === null) return;
    timers.clearTimeout(slot.handle);
    state.timers[name] = null;
  }

  /** One one-shot timer per name: arming it again replaces the one that is running. */
  function arm(name: TimerName, delayMs: number, run: () => void): void {
    cancel(name);
    state.timers[name] = {
      handle: timers.setTimeout(
        () => {
          state.timers[name] = null;
          guarded(name, run);
        },
        Math.max(0, delayMs),
      ),
    };
  }

  /** True while the run that asked a question is still the running one (CPC1-7). */
  const isCurrent = (run: number): boolean => state.running && state.run === run;

  function finishBoot(): void {
    cancel('boot');
    if (state.ready) return;
    state.ready = true;
    resolveReady();
  }

  /**
   * A call of the app's storage failed (CPC1-26). The report names the port, where it was called
   * and the NAME of what was thrown: never its message and never its stack, which are the app's
   * own text and can hold the very value the port failed to store.
   */
  function reportPort(port: string, error: unknown, context: ReportContext): void {
    record({
      level: 'error',
      source: `${LIVE_ERROR_SOURCE}.secrets`,
      message: `The storage of the app failed in "${port}".`,
      at: clock.now(),
      context: { ...context, port, errorName: error instanceof Error ? error.name : typeof error },
    });
  }

  /**
   * Waits for one call of the app's storage, at most `LIVE_SECRETS_TIMEOUT_MS` (CPC1-20). A port
   * that throws, rejects or does not answer in time is reported (`reportPort`) and answered as
   * failed; `stop()` ends the wait without a report. The outcome of a failure holds nothing of
   * what the port threw: a caller rejects its action with a fixed error.
   */
  function bounded<T>(port: string, context: ReportContext, work: () => T | PromiseLike<T>): Promise<PortOutcome<T>> {
    return new Promise<PortOutcome<T>>((resolve) => {
      let done = false;
      let timer: TimerSlot = null;
      const finish = (outcome: PortOutcome<T>): void => {
        if (done) return;
        done = true;
        budgets.delete(end);
        if (timer !== null) timers.clearTimeout(timer.handle);
        resolve(outcome);
      };
      const end = (): void => finish({ ok: false, stopped: true });
      const failed = (error: unknown): void => {
        if (done) return;
        reportPort(port, error, context);
        finish({ ok: false, stopped: false });
      };
      budgets.add(end);
      timer = {
        handle: timers.setTimeout(() => {
          if (done) return;
          record({
            level: 'error',
            source: `${LIVE_ERROR_SOURCE}.secrets`,
            message: `The storage of the app did not answer "${port}" within ${LIVE_SECRETS_TIMEOUT_MS} ms.`,
            at: clock.now(),
            context: { ...context, port, timedOut: true },
          });
          finish({ ok: false, stopped: false });
        }, LIVE_SECRETS_TIMEOUT_MS),
      };
      try {
        Promise.resolve(work()).then((value) => finish({ ok: true, value }), failed);
      } catch (error) {
        failed(error);
      }
    });
  }

  // ── The gate and the socket ──────────────────────────────────────────────────────────

  const gate = createCommandGate({
    timers,
    maxHeld: LIVE_HELD_MESSAGES_MAX,
    apply(messages, extra) {
      // `extra` was asked for before this call: a sign-in has set the session by now.
      const patch: Partial<SimState> =
        messages.length > 0 ? { ...foldStateMessages(store.getState(), messages, share), ...authPatch(), ...extra } : { ...extra };
      commit(patch);
      if (messages.length > 0 && state.session !== null) finishBoot();
    },
    requestResync() {
      socket.requestResync();
    },
    overflow(dropped) {
      record({
        level: 'warn',
        source: `${LIVE_ERROR_SOURCE}.gate`,
        message: 'More state messages were held back than the gate keeps; they were dropped and a new snapshot is asked for.',
        at: clock.now(),
        context: { dropped, limit: LIVE_HELD_MESSAGES_MAX },
      });
    },
    report: (error) => reportThrown('gate', error),
  });

  function holdForSession(): void {
    if (state.sessionHold) return;
    state.sessionHold = true;
    gate.hold();
  }

  function releaseSessionHold(): void {
    if (!state.sessionHold) return;
    state.sessionHold = false;
    gate.release();
  }

  const socket = (options.socket.create ?? createLiveSocketClient)({
    url: options.socket.url,
    ...(options.socket.factory ? { socketFactory: options.socket.factory } : {}),
    ...(options.socket.headers ? { headers: options.socket.headers } : {}),
    ...(options.random ? { random: options.random } : {}),
    now: local,
    timers,
    meters: !(visibility?.isHidden() ?? false),
    onHello: (hello, info) => guarded('socket.onHello', () => onHello(hello, info.connection)),
    onSnapshot: (snapshot, info) => guarded('socket.onSnapshot', () => onState(snapshot, info.connection)),
    onDelta: (delta) => guarded('socket.onDelta', () => onState(delta, state.connection)),
    onMeters: (meters) => guarded('socket.onMeters', () => onMeters(meters)),
    onControl: (message) => guarded('socket.onControl', () => onControl(message)),
    onServerTime: (sample) => {
      state.clockSampled = true;
      clock.sample(sample.serverTime, sample.receivedAt);
    },
    onLinkChange: (next) => guarded('socket.onLinkChange', () => onLinkChange(next)),
    onResync: (event) => {
      for (const listener of Array.from(resyncListeners)) guarded('listener.onResync', () => listener(event));
    },
    onEnd: (end) => guarded('socket.onEnd', () => onEnd(end)),
    onError: onSocketError,
  });

  function onSocketError(report: LiveSocketErrorReport): void {
    // `cause` exists only when one of this file's own handlers threw; the socket never hands on frame content.
    const cause = report.cause === undefined ? null : describeError(report.cause);
    record({
      level: report.level,
      source: `${LIVE_ERROR_SOURCE}.socket`,
      message: cause ? cause.message : `The live socket reported ${report.code}.`,
      at: clock.now(),
      ...(cause?.stack ? { stack: cause.stack } : {}),
      context: {
        code: report.code,
        connection: report.connection,
        connectionId: report.connectionId,
        messageType: report.messageType ?? null,
        issue: report.issue ?? null,
        path: report.path ?? null,
        waiting: report.waiting ?? null,
        handler: report.handler ?? null,
        errorName: report.errorName ?? null,
      },
    });
  }

  function onHello(hello: HelloMessage, opened: number): void {
    state.connection = opened;
    if (hello.principal === RealtimePrincipal.OPERATOR) {
      state.socketAsked = false;
      if (state.owed !== null) {
        // D80, D90: this socket may carry the session a local end is over with. It is not taken:
        // the debt is settled first, and what the socket sends stays held back.
        settleDebt();
        return;
      }
      // The socket carries a session this client does not know yet (a reload, or the link came
      // back after a sign-in that timed out): ask who it is before any state is shown (§5.1).
      if (state.session === null && state.signingIn === 0) probeSession();
      // CPC1-35: a session is known, and this is a socket opened after the one it was last confirmed on.
      else if (state.session !== null && state.signingIn === 0 && !state.probing && opened > state.validatedConnection) {
        // A new socket: the back-off of the question starts again.
        state.revalidateFailures = 0;
        revalidateSession();
      }
      return;
    }
    if (state.owed !== null && state.owedCall === null) {
      // The credential names no session any more: nothing is left to sign out of.
      clearDebt();
      // Whatever an earlier socket sent while the sign-out was owed is not shown.
      gate.reset();
      releaseSessionHold();
    }
    // The close that follows a revoked credential is the end; a read with that credential would only be refused too.
    if (hello.reason === RealtimeHelloReason.DEVICE_REVOKED) return;
    if (state.session !== null && state.signingIn === 0) {
      if (hello.reason === RealtimeHelloReason.SESSION_INVALID) {
        // The credential of the socket no longer resolves to a session.
        void endSession({ kind: 'SESSION_ENDED', reason: null, source: 'HELLO', helloReason: hello.reason, principal: hello.principal });
        return;
      }
      // CPC1-9: the session was found before this socket said who it is, and it is not the session's socket.
      ensureSessionSocket(false);
      return;
    }
    if (state.session === null) refreshSignInStatus();
  }

  function onState(message: SnapshotMessage | DeltaMessage, from: number): void {
    state.connection = from;
    if (state.session === null && state.signingIn === 0) {
      if (state.refusedConnection === from) return;
      if (state.owed !== null) holdForSession();
      else if (!state.sessionHold) probeSession();
    }
    gate.receive({ message, connection: from });
  }

  function onMeters(meters: MetersMessage): void {
    if (state.session === null) return;
    // Never held (CL-16): the latest frame wins, and no command waits behind a meter.
    commit({ audio: meters.audio as AudioSlice });
  }

  function onLinkChange(next: LiveLinkState): void {
    state.link = next;
    if (next === LiveLinkState.STALE || next === LiveLinkState.OFFLINE) {
      // A meter never freezes on a stale level (§2.3).
      if (!isSilentAudio(store.getState().audio)) commit({ audio: silentAudio(clock.now()) });
    }
    notifyLive();
    if (next === LiveLinkState.ONLINE) touch.flush();
    // D80: when the Core would no longer tell this client that its session expired, the client looks itself.
    else if (!coreWouldTell()) checkExpiry();
  }

  function onControl(message: LiveSocketControlMessage): void {
    if (message.type === 'session.updated') {
      if (state.session !== null && state.session.operator.id === message.operator.id) {
        // Replaced, never edited in place (F40-3 d). The `operators` slice arrives as a delta.
        state.session = {
          ...state.session,
          operator: { ...state.session.operator, role: message.operator.role },
          permissions: message.permissions,
        };
        notifyLive();
      }
    } else if (message.type === 'session.ended') {
      if (message.reason !== SessionEndedReason.ROTATED) {
        if (state.session !== null) {
          void endSession({ kind: 'SESSION_ENDED', reason: message.reason, source: 'CONTROL', signOut: state.pendingSignOut });
        }
      } else if (state.signingIn > 0) {
        // This client's own sign-in replaced its previous session; the sign-in reopens the socket.
        state.endedConnection = socket.getStatus().connection;
      } else if (state.session !== null) {
        // §6.5: unchanged until the check. Whoever owns the credential now stays signed in.
        state.endedConnection = socket.getStatus().connection;
        state.rotated = true;
        probeSession();
      }
      // With no session known here, the close that follows is handled as any other end (`onEnd`).
    } else if (message.type === 'device.revoked') {
      void endSession({ kind: 'DEVICE_REVOKED', reason: message.reason, source: 'CONTROL' });
    }
    for (const listener of Array.from(controlListeners)) guarded('listener.onControl', () => listener(message));
  }

  function onEnd(end: LiveSocketEnd): void {
    const current = socket.getStatus().connection;
    // A control message, a REST answer or this client's own sign-out already dealt with the end of this socket.
    if (state.endedConnection === current) return;
    const detail = { helloReason: end.helloReason, principal: end.principal };
    if (end.kind === 'DEVICE_REVOKED') {
      if (state.retiredEnd !== null) {
        // CPC1-1: the same revocation, refused again on a socket that was opened after it.
        state.endedConnection = current;
        retryDeviceCleanup();
        return;
      }
      void endSession({ kind: 'DEVICE_REVOKED', reason: end.deviceRevoked, source: 'CLOSE', ...detail });
    } else {
      void endSession({ kind: 'SESSION_ENDED', reason: end.sessionEnded, source: 'CLOSE', ...detail });
    }
  }

  // ── Session ──────────────────────────────────────────────────────────────────────────

  /**
   * A session, or the pairing, is over. In one store update the Core data goes and `auth` says
   * signed out; then the listeners are told; then the app's storage drops its secret and the
   * socket is reopened with whatever credential is left. Resolves when that is done.
   *
   * One revocation of the device is one end (CPC1-1): while the pairing is known to be over,
   * another sign of it changes nothing and tells nobody.
   */
  function endSession(input: EndInput): Promise<void> {
    if (input.kind === 'DEVICE_REVOKED' && state.retiredEnd !== null) return state.lastEnd;

    const current = store.getState();
    const wasSignedIn = state.session !== null;
    const hadState = gate.position !== null;
    const end: LiveSessionEnd = {
      kind: input.kind,
      reason: input.reason,
      source: input.source,
      signOut: input.signOut ?? null,
      wasSignedIn,
      sessionState: current.session?.state ?? null,
      helloReason: input.helloReason ?? null,
      principal: input.principal ?? null,
      at: clock.now(),
    };
    const expired = input.reason === SessionEndedReason.IDLE_EXPIRED || input.reason === SessionEndedReason.ABSOLUTE_EXPIRED;

    state.era += 1;
    state.session = null;
    state.auditChain = null;
    state.lastSessionEnd = end;
    state.activityAt = null;
    state.lockoutKnown = false;
    state.lockoutSeq += 1;
    state.rotated = false;
    state.probing = false;
    state.probeFailures = 0;
    state.socketAsked = false;
    state.expiryAsked = false;
    state.expiryFailures = 0;
    state.revalidating = false;
    cancel('revalidate');
    state.endedConnection = socket.getStatus().connection;
    if (input.kind === 'DEVICE_REVOKED') {
      state.retiredEnd = end;
      state.cleanupTries = 0;
    }
    touch.reset();
    cancel('permission');
    cancel('probe');
    cancel('expiry');
    gate.reset();
    releaseSessionHold();

    // One update: a signed-out client holds no Core data (§2.3). Through structural sharing, so a
    // slice that already is the neutral value keeps its reference.
    const patch: Partial<SimState> =
      wasSignedIn || hadState ? replacementPatch(current, createNeutralState(publishedNow()), share) : {};
    if (current.auth.status === AuthStatus.SIGNED_IN || (expired && current.auth.status !== AuthStatus.EXPIRED)) {
      patch.auth = signedOutAuthSlice(expired ? AuthStatus.EXPIRED : AuthStatus.SIGNED_OUT);
    }
    if (!isSilentAudio(current.audio)) patch.audio = silentAudio(clock.now());
    if (input.kind === 'DEVICE_REVOKED' && current.pairing.state !== PairingState.UNPAIRED) patch.pairing = neutralPairing();
    commit(patch);

    notifyLive();
    for (const listener of Array.from(endListeners)) guarded('listener.onSessionEnd', () => listener(end));

    // The socket is reopened only when there is something to reopen it with. A session that ended
    // (this client's, or the one an OPERATOR socket carried) leaves the cookie-less socket (web) or
    // the device credential (mobile); a pairing that ended leaves nothing once the app deleted the
    // credential. A refused credential with nobody signed in is the app's to replace (it then
    // calls `reconnect`): reopening by itself would only repeat the refusal.
    const reopen =
      input.kind === 'DEVICE_REVOKED'
        ? secrets?.deviceUnpaired !== undefined
        : wasSignedIn || input.principal === RealtimePrincipal.OPERATOR;
    state.lastEnd = afterEnd(end, reopen);
    return state.lastEnd;
  }

  async function afterEnd(end: LiveSessionEnd, reopen: boolean): Promise<void> {
    const run = state.run;
    const port = end.kind === 'DEVICE_REVOKED' ? 'deviceUnpaired' : 'sessionCleared';
    if (secrets?.[port] !== undefined) await bounded(port, { kind: end.kind }, () => secrets[port]?.(end));
    // Always one promise job later, also when the port threw at once: the socket is never
    // reopened from inside its own message callback, whatever the port does.
    await Promise.resolve();
    if (isCurrent(run) && reopen) socket.reconnect(end.kind === 'DEVICE_REVOKED' ? 'CREDENTIAL' : 'SIGN_OUT');
  }

  /**
   * CPC1-1: the socket that was reopened after the pairing ended was refused as revoked again, so
   * the stored device credential is still being presented. The app's storage is asked again,
   * later and a bounded number of times; then the socket stays closed until the app reconnects.
   */
  function retryDeviceCleanup(): void {
    const end = state.retiredEnd;
    if (end === null || secrets?.deviceUnpaired === undefined || !state.running) return;
    if (state.cleanupTries >= LIVE_DEVICE_CLEANUP_RETRIES) {
      record({
        level: 'error',
        source: `${LIVE_ERROR_SOURCE}.secrets`,
        message: 'The device credential of a pairing that is over is still presented; the socket stays closed until the app replaces it and reconnects.',
        at: clock.now(),
        context: { code: LIVE_DEVICE_CLEANUP_GAVE_UP_CODE, kind: end.kind, port: 'deviceUnpaired', tries: state.cleanupTries },
      });
      return;
    }
    const delayMs = LIVE_DEVICE_CLEANUP_RETRY_MS * 2 ** state.cleanupTries;
    state.cleanupTries += 1;
    arm('cleanup', delayMs, () => {
      if (state.retiredEnd === end) state.lastEnd = afterEnd(end, true);
    });
  }

  /** The app replaced the device credential (a new pairing, or it says so): the old revocation no longer stands. */
  function clearRetired(): void {
    state.retiredEnd = null;
    state.cleanupTries = 0;
    cancel('cleanup');
  }

  /**
   * D80: the session ends HERE, whatever the link says. The Core is told when it can be: the end
   * is a **debt** (decision D90). The debt names the session it is for (its operator and the
   * instant the Core issued it; no credential), why it ended, and when. It is written to the app's
   * storage, when the app gave one, BEFORE the end is reported: a storage that answers at once
   * (the web console's) holds the debt by then, so a reload cannot forget a Lock (CPC1-24).
   */
  function endLocally(reason: LocalEndReason, signOut: SignOutReason | null): Promise<void> {
    const session = state.session;
    if (session === null) return state.lastEnd;
    const debt: LiveOwedSignOut = {
      operatorId: session.operator.id,
      issuedAt: session.issuedAt,
      reason: signOut ?? (reason === SessionEndedReason.ABSOLUTE_EXPIRED ? SessionEndedReason.ABSOLUTE_EXPIRED : SessionEndedReason.IDLE_EXPIRED),
      at: clock.now(),
    };
    state.owed = debt;
    state.owedFailures = 0;
    state.owedRefused = false;
    state.owedRefusals = 0;
    cancel('owed');
    debtStorage('write', () => debtPort?.write(debt));
    return endSession({ kind: 'SESSION_ENDED', reason, source: 'LOCAL', signOut });
  }

  /**
   * One call of the storage the app gave for the debt (CPC1-24), bounded like every storage call.
   * A storage that fails once is not asked again: the debt then lives in memory only, as it does
   * without a storage, and that is reported once.
   *
   * **The calls take effect in the order they were asked for (CPC1-34).** A storage that answers
   * at once has done its work when this function returns, so nothing can overtake it. For one
   * that answers later, a call that is asked for while an earlier one is still out is made only
   * when the storage has really finished that one: a `clear` can never erase a debt that was
   * written after the `clear` was asked for, and of two writes the later one is the one that
   * stays. The budget of a call that waits runs from the moment it was asked for. `stop()` ends
   * the waiting and the reports, not the order: a call that waits is still made in its turn.
   */
  function debtStorage<T>(name: 'read' | 'write' | 'clear', work: () => T | PromiseLike<T>): Promise<PortOutcome<T | undefined>> | null {
    if (debtPort === undefined || state.debtPortFailed) return null;
    const earlier = state.debtTail;
    let finished: () => void = () => undefined;
    /** Settles when the storage has really finished this call, whatever became of its budget. */
    const ended = new Promise<void>((resolve) => {
      finished = resolve;
    });
    let atOnce = false;
    let skipped = false;
    const invoke = (): T | PromiseLike<T> => {
      let value: T | PromiseLike<T>;
      try {
        value = work();
      } catch (error) {
        atOnce = true;
        finished();
        throw error;
      }
      if (isThenable(value)) {
        void value.then(finished, finished);
      } else {
        atOnce = true;
        finished();
      }
      return value;
    };
    const inTurn = (): PromiseLike<T | undefined> | T =>
      earlier === null
        ? invoke()
        : earlier.then(() => {
            if (state.debtPortFailed) {
              // An earlier call failed meanwhile: the storage is not asked again.
              skipped = true;
              finished();
              return undefined;
            }
            return invoke();
          });
    const made = bounded<T | undefined>(`owedSignOut.${name}`, {}, inTurn).then((outcome): PortOutcome<T | undefined> => {
      if (skipped) return { ok: false, stopped: false };
      if (!outcome.ok && !outcome.stopped) {
        state.debtPortFailed = true;
        // Whoever waits behind this call goes on, and finds the storage failed.
        finished();
      }
      return outcome;
    });
    // Only a call that is still out has to be waited for by the next one.
    if (earlier !== null || !atOnce) {
      state.debtTail = ended;
      void ended.then(() => {
        if (state.debtTail === ended) state.debtTail = null;
      });
    }
    return made;
  }

  /** Nothing is owed any more: paid, or found not to be owed. */
  function clearDebt(): void {
    if (state.owed === null) return;
    state.owed = null;
    state.owedFailures = 0;
    state.owedRefused = false;
    state.owedRefusals = 0;
    cancel('owed');
    debtStorage('clear', () => debtPort?.clear());
  }

  /**
   * At a start: what an earlier source of this app left in the storage (a page that was loaded
   * again after a Lock the Core never heard of). Until it is read, no session is asked for and no
   * socket is taken; a debt that is found is settled first.
   */
  function loadDebt(): void {
    const run = state.run;
    const reading = debtStorage('read', () => debtPort?.read());
    if (reading === null) {
      state.debtKnown = true;
      probeSession();
      return;
    }
    holdForSession();
    void reading.then((outcome) => {
      if (!isCurrent(run)) return;
      state.debtKnown = true;
      if (!outcome.ok) {
        // CPC1-34: the storage could not be read (it threw, or it did not answer in time). A debt
        // MAY exist, so this start fails closed: the session the credential names is not taken.
        state.debtUnread = true;
      } else if (outcome.value !== null && outcome.value !== undefined) {
        const debt = owedSignOutOf(outcome.value);
        if (debt === null) {
          // Not a debt of this source's making: it is not trusted, and it is removed. It may have
          // been one all the same, so this start fails closed as for a storage that cannot be read.
          record({
            level: 'warn',
            source: `${LIVE_ERROR_SOURCE}.owed`,
            message: 'The storage of the app held a sign-out debt that cannot be read; it was dropped.',
            at: clock.now(),
          });
          debtStorage('clear', () => debtPort?.clear());
          state.debtUnread = true;
        } else if (state.owed === null) {
          state.owed = debt;
        }
      }
      if (state.owed !== null) settleDebt();
      else probeSession();
    });
  }

  /**
   * CPC1-34: is `info` a session this source must not take? After a start whose storage could not
   * be read, the FIRST session the Core names is declined: a Lock may be owed for it, and a
   * console that persisted a Lock must not come back signed in because its storage failed. The
   * client then shows the signed-out state and a fresh sign-in is required (the sign-in replaces
   * that session at the Core). A session issued later is another one and is taken as usual.
   */
  function declines(info: AuthSessionInfo): boolean {
    if (state.debtUnread) {
      state.debtUnread = false;
      state.declined = { operatorId: info.operator.id, issuedAt: info.issuedAt };
      record({
        level: 'error',
        source: `${LIVE_ERROR_SOURCE}.owed`,
        message: 'The storage of the sign-out debt could not be read, and the credential names a session: it is not taken, and a fresh sign-in is required.',
        at: clock.now(),
      });
    }
    return state.declined !== null && state.declined.operatorId === info.operator.id && state.declined.issuedAt === info.issuedAt;
  }

  /**
   * D90, CPC1-23: a debt is never paid blindly. The Core is asked which session the credential
   * names NOW, and the first matching row decides. The socket is not taken meanwhile.
   *
   * | What the Core answers to `getAuthSession` | The debt | Then |
   * |-------------------------------------------|----------|------|
   * | No answer; an answer that says nothing about the session | Stays | Asked again after 2 s, 4 s … 30 s, never inside a `retry-after` |
   * | 401: no session | Dropped: it is over already | Signed out; the socket is reopened |
   * | A session of another operator, or issued at another instant | Dropped: a new sign-in happened, in this tab or another, and the debt was never owed for it | That session is taken, as after any probe |
   * | The same session; the debt is an EXPIRY this client reckoned; by the Core's own clock the session has not expired | Dropped: the reckoning was early (activity this client did not see) | The session is taken again |
   * | The same session; an EXPIRY; by the Core's own clock its instant has passed | Stays | Asked again: the Core ends it itself, and no sign-out is ever sent for an expiry |
   * | The same session; USER or LOCK | Paid: `signOut` with that reason | 2xx or 401: dropped, signed out, the socket is reopened. No answer: asked again. **A refusal (CPC1-31): it fails closed.** The console stays signed out here, the debt stays, and it is asked again with the same back-off. After five refusals in a row (CPC1-36) the source stops asking by itself and says so once; the debt stays, and the next OPERATOR socket asks again |
   */
  function settleDebt(): void {
    const debt = state.owed;
    if (debt === null || state.owedCall !== null || !state.running || !state.debtKnown) return;
    if (state.signingIn > 0) {
      // A sign-in is out. A sign-out that arrived after it would end the NEW session: wait for its outcome.
      arm('owed', LIVE_SESSION_PROBE_RETRY_MS, settleDebt);
      return;
    }
    cancel('owed');
    holdForSession();
    // While the debt is settled the socket is not this client's: when the Core ends it (with the
    // session the debt is for), that is the end this client already told, and no second one.
    state.endedConnection = socket.getStatus().connection;
    const run = state.run;
    const live = (): boolean => isCurrent(run) && state.owed === debt;
    const later = (retryAfterSeconds: number | null): void => {
      const delayMs = retryDelay(state.owedFailures, retryAfterSeconds);
      state.owedFailures += 1;
      arm('owed', delayMs, settleDebt);
      // Signed out here, whatever the Core says later: nobody waits for the bootstrap.
      finishBoot();
    };
    /** The debt is gone and nobody is signed in: what the held socket sent is dropped, and a socket is opened for what the credential names now. */
    const signedOut = (): void => {
      clearDebt();
      gate.reset();
      releaseSessionHold();
      // The socket of the session that is over (an OPERATOR socket, or one the Core closed with it)
      // is replaced; a socket that already is nobody's stays.
      const status = socket.getStatus();
      if (status.principal === RealtimePrincipal.OPERATOR || status.end !== null) socket.reconnect('SIGN_OUT');
      else refreshSignInStatus();
      finishBoot();
    };
    /** The debt is gone and the credential names a session that was never owed: it is taken as after any probe. */
    const taken = (info: AuthSessionInfo): void => {
      clearDebt();
      state.refusedConnection = null;
      // CPC1-33: the socket is this client's again. Its end is an end, and must be told.
      state.endedConnection = null;
      adoptSession(info);
      ensureSessionSocket(false);
      if (gate.position !== null) finishBoot();
    };

    const settle = async (): Promise<void> => {
      const found = await guardedCall(LIVE_SESSION_OPERATION);
      if (!live()) return;
      if (found === null || (!found.ok && found.transport !== null)) return later(found === null ? null : found.retryAfterSeconds);
      if (!found.ok) {
        if (isRefusal(found, 401, ApiErrorCode.NOT_SIGNED_IN)) return signedOut();
        inspect(found);
        return live() ? later(null) : undefined;
      }
      const info = found.data as AuthSessionInfo;
      if (info.operator.id !== debt.operatorId || info.issuedAt !== debt.issuedAt) return taken(info);
      if (debt.reason === SessionEndedReason.IDLE_EXPIRED || debt.reason === SessionEndedReason.ABSOLUTE_EXPIRED) {
        const open = info.serverTime < info.idleExpiresAt && info.serverTime < info.absoluteExpiresAt;
        return open ? taken(info) : later(null);
      }
      // The same session, still open, and the operator asked for its end: the debt is paid.
      // CONTRACT-GAP-W44-2 (no adapter is possible here): the sign-out request names no session, so
      // between the question above and this payment (one round trip) another tab can sign in, and
      // the payment then ends that new session. Only a sign-out that names the session it is for
      // (its `issuedAt`) closes that; the contract has no such member.
      const plan = LIVE_BINDINGS.signOut.plan([debt.reason], viewNow(), {});
      if (plan.kind !== 'call') return later(null);
      state.endedConnection = socket.getStatus().connection;
      const paid = await guardedCall(plan.operationId, plan.input);
      if (!live()) return;
      if (paid === null || (!paid.ok && paid.transport !== null)) return later(paid === null ? null : paid.retryAfterSeconds);
      if (!paid.ok && !isRefusal(paid, 401, ApiErrorCode.NOT_SIGNED_IN)) {
        // CPC1-31: it fails closed. Reported once for this debt.
        if (!state.owedRefused) {
          state.owedRefused = true;
          record({
            level: 'error',
            source: `${LIVE_ERROR_SOURCE}.session`,
            message: 'The Core refused the sign-out this client owes; the console stays signed out here and the sign-out stays owed.',
            at: clock.now(),
            context: { operationId: plan.operationId, status: paid.status, code: paid.error.code, requestId: paid.requestId, reason: debt.reason },
          });
        }
        state.owedRefusals += 1;
        if (state.owedRefusals >= OWED_REFUSALS_MAX) {
          // CPC1-36: the Core keeps refusing. The source stops asking by itself (every refusal is
          // audited there); the debt stays, the console stays signed out, and the next OPERATOR
          // socket asks again.
          state.owedRefusals = 0;
          record({
            level: 'error',
            source: `${LIVE_ERROR_SOURCE}.session`,
            message: 'The Core refused the sign-out this client owes several times in a row; it is not asked again until a new socket appears. The sign-out stays owed.',
            at: clock.now(),
            context: { operationId: plan.operationId, refusals: OWED_REFUSALS_MAX, reason: debt.reason },
          });
          finishBoot();
          return undefined;
        }
        return later(null);
      }
      signedOut();
    };

    state.owedCall = settle()
      .catch((error: unknown) => reportThrown('owed', error))
      .then(() => {
        state.owedCall = null;
        // The question belonged to a run that was stopped. A run that is going now asks for itself.
        if (!isCurrent(run) && state.running && state.owed !== null) settleDebt();
      });
  }

  /**
   * Takes a session the server answered. `auth` follows at once when the store already holds
   * replicated state. `confirmsSocket` (CPC1-35) is false for an answer that only brings the
   * present values of a session that is in use (the expiry check, the permission refresh): such an
   * answer says nothing about a socket that is being opened meanwhile.
   */
  function adoptSession(info: AuthSessionInfo, confirmsSocket = true): void {
    if (state.session === null) state.socketAsked = false;
    state.session = info;
    state.activityAt = null;
    state.probeFailures = 0;
    cancel('probe');
    if (!state.clockSampled) {
      // No `hello` yet: the answer's own time is the first reading of the server clock.
      state.clockSampled = true;
      clock.sample(info.serverTime, local());
    }
    if (confirmsSocket) {
      // The Core just named this session: it is confirmed for the socket that is open now (CPC1-35),
      // and a question that waited to be asked again is not needed any more.
      state.validatedConnection = socket.getStatus().connection;
      cancel('revalidate');
    }
    // A held snapshot and `auth` go into the store in one update (the gate's `apply`).
    releaseSessionHold();
    if (gate.position !== null) commit(authPatch());
    armExpiry();
    notifyLive();
  }

  /**
   * CPC1-35: true while a known session waits to be confirmed for a socket that was opened after
   * a time without one. Until then this client does not know whose session its credential names:
   * no command and no read of an action is sent (CL-22, as with the link down), no touch is sent,
   * and a sign-out ends the session here and is owed (the debt is settled by asking first).
   */
  const unconfirmed = (): boolean => state.revalidating || state.timers.revalidate !== null;

  /**
   * CPC1-35: an answer of the Core names a session while one is known here. The same one (the
   * same operator and the same `issuedAt`) is taken with its present values. Another one means
   * the known session is over for this client, and this client never heard of it: it ends here
   * (`reason: ROTATED`, `source: 'REST'`), nothing is owed for it, the replica is cleared and the
   * socket is reopened; the session the credential names now is then taken as at a fresh start.
   * Returns true when the known session goes on.
   */
  function confirmSession(info: AuthSessionInfo, confirmsSocket: boolean): boolean {
    const known = state.session;
    if (known !== null && (info.operator.id !== known.operator.id || info.issuedAt !== known.issuedAt)) {
      void endSession({ kind: 'SESSION_ENDED', reason: SessionEndedReason.ROTATED, source: 'REST' });
      return false;
    }
    adoptSession(info, confirmsSocket);
    return true;
  }

  /**
   * CPC1-35: a session that is KNOWN is confirmed again when an OPERATOR socket appears that was
   * opened after the one the session was last confirmed on. While this client had no socket of the
   * session, a `session.ended` ROTATED (another operator signed in with the same browser) or a
   * `session.updated` can have passed unheard, and `hello` says OPERATOR for whoever the
   * credential names NOW. So before anything of the new socket is shown, the Core is asked once
   * (`confirmSession` decides):
   *
   * | The Core answers | Then |
   * |------------------|------|
   * | The same session (operator and `issuedAt`) | It goes on, with the Core's present role, permissions and instants; the held snapshot is applied |
   * | Another session | The earlier one is over for this client: it ends here (`reason: ROTATED`, `source: 'REST'`), nothing is owed, the replica is cleared; the socket is reopened and the new session is taken as at a fresh start |
   * | 401 | The session ends as after any 401 (`inspect`) |
   * | Nothing, or a refusal that says nothing about the session | Nothing of the new socket is shown and nothing is sent for the operator (`unconfirmed`); asked again after 2 s, 4 s … 30 s, never inside a `retry-after`, and at once by the `hello` of another new socket |
   * | The same session, and the socket was replaced while the question was out | Nothing is confirmed: the `hello` of the newer socket asks again |
   *
   * **The trigger, exactly:** an OPERATOR `hello` whose connection number is greater than
   * `validatedConnection`, while a session is known and neither a sign-in nor a probe is out.
   * `validatedConnection` is the connection that was current when the Core last named this
   * session in answer to the probe, the debt check or this question, or the connection this
   * source itself opened right after such an answer (`ensureSessionSocket`). A sign-in needs no
   * mark: its own socket says `hello` while the sign-in is out, and every later OPERATOR `hello`
   * is one of a later connection. A socket that was never lost says `hello` once, so it causes no
   * request; a socket that was lost causes exactly one per new connection.
   *
   * CONTRACT-GAP-W44-1 (local adapter): `hello` names a principal and no session. If it named the
   * operator and the instant the session was issued, the client could compare at once: this
   * request would not be needed, and the windows it cannot close would close too (an answer that
   * was asked before a sign-in elsewhere and arrives after the socket was reopened, and the socket
   * a sign-in or a probe opens right after its answer).
   */
  function revalidateSession(): void {
    if (state.session === null || state.revalidating || !state.running) return;
    holdForSession();
    const waitMs = state.probeNotBefore - local();
    if (waitMs > 0) {
      // CPC1-8: inside the server's `retry-after` for this operation nothing is asked, whatever
      // suggests it (here: another new socket). The session stays unconfirmed meanwhile.
      if (state.timers.revalidate === null) arm('revalidate', waitMs, revalidateSession);
      return;
    }
    state.revalidating = true;
    cancel('revalidate');
    const era = state.era;
    const asked = socket.getStatus().connection;
    const again = (retryAfterSeconds: number | null): void => {
      const delayMs = retryDelay(state.revalidateFailures, retryAfterSeconds);
      state.revalidateFailures += 1;
      state.probeNotBefore = retryAfterSeconds !== null && retryAfterSeconds > 0 ? local() + retryAfterSeconds * 1_000 : 0;
      arm('revalidate', delayMs, revalidateSession);
    };
    ask(
      'revalidate',
      LIVE_SESSION_OPERATION,
      (result) => {
        // The session ended meanwhile: its end released the hold, reopened the socket and ended this
        // question. The flag may belong to a question about the session that followed by now.
        if (state.era !== era || state.session === null) return;
        state.revalidating = false;
        if (result === null || (!result.ok && result.transport !== null)) {
          again(result === null ? null : result.retryAfterSeconds);
          return;
        }
        if (!result.ok) {
          inspect(result);
          if (state.era === era) again(null);
          return;
        }
        const info = result.data as AuthSessionInfo;
        const same = info.operator.id === state.session.operator.id && info.issuedAt === state.session.issuedAt;
        if (same && socket.getStatus().connection !== asked) {
          // The socket was replaced while the question was out. "The same session" was true for
          // the earlier socket and confirms nothing for this one: its `hello` asks again, or, when
          // that `hello` has passed already, the question is asked again now.
          if (state.connection > asked) revalidateSession();
          return;
        }
        // The same session: it goes on, and activity that waited for the confirmation is sent.
        if (confirmSession(info, true)) touch.flush();
      },
      () => {
        if (state.era === era) state.revalidating = false;
      },
    );
  }

  /**
   * A known session needs an OPERATOR socket (CPC1-9). When the socket that is open is another
   * one (it was opened before the credential existed, or the server ended it for a rotation), a
   * new one is asked for: once per session, and never from inside the socket's own callback. A
   * second socket that still does not carry the session is reported and left alone.
   */
  function ensureSessionSocket(force: boolean): void {
    const status = socket.getStatus();
    const other = status.principal !== null && status.principal !== RealtimePrincipal.OPERATOR;
    if (!force && status.end === null && !other) return;
    if (state.socketAsked && !force) {
      record({
        level: 'error',
        source: `${LIVE_ERROR_SOURCE}.socket`,
        message: 'The session is known, and the socket the app opens does not carry it: the header provider of the socket and the credential provider of the client disagree.',
        at: clock.now(),
        context: { principal: status.principal, connection: status.connection },
      });
      return;
    }
    state.socketAsked = true;
    const run = state.run;
    const era = state.era;
    void Promise.resolve().then(() => {
      if (!isCurrent(run) || state.era !== era || state.session === null) return;
      socket.reconnect('SIGN_IN');
      // The socket this source just asked for is the confirmed session's own (CPC1-35).
      state.validatedConnection = socket.getStatus().connection;
    });
  }

  /**
   * §5.1 step 3: asks the server who this client is. While the answer is out, state messages are
   * held, so no Core data is shown before the session is known.
   */
  function probeSession(): void {
    if (state.probing || !state.running) return;
    if (!state.debtKnown) {
      // CPC1-24: the storage of the debt is still being read. Nothing is taken before it is known.
      holdForSession();
      return;
    }
    if (state.owed !== null) {
      // Signed out here; the sign-out is owed. Nothing is asked until it is settled.
      finishBoot();
      return;
    }
    const waitMs = state.probeNotBefore - local();
    if (waitMs > 0) {
      // CPC1-8: inside the server's `retry-after` nothing is asked, whatever suggests it.
      holdForSession();
      if (state.timers.probe === null) arm('probe', waitMs, probeSession);
      return;
    }
    state.probing = true;
    cancel('probe');
    holdForSession();
    const era = state.era;
    ask(
      'probe',
      LIVE_SESSION_OPERATION,
      (result) => {
        // A session ended, or a sign-in set one, since the question: the answer is about another time.
        if (state.era !== era) {
          finishBoot();
          return;
        }
        state.probing = false;
        if (result === null || (!result.ok && result.transport !== null)) {
          // No answer. Nothing is shown without a session: the hold stays and the question is asked again.
          if ((state.session === null || state.rotated) && state.running) {
            const retryAfterSeconds = result === null ? null : result.retryAfterSeconds;
            const delayMs = retryDelay(state.probeFailures, retryAfterSeconds);
            state.probeFailures += 1;
            state.probeNotBefore = retryAfterSeconds !== null && retryAfterSeconds > 0 ? local() + retryAfterSeconds * 1_000 : 0;
            arm('probe', delayMs, probeSession);
          } else {
            releaseSessionHold();
          }
          finishBoot();
          return;
        }
        state.probeFailures = 0;
        state.probeNotBefore = 0;
        if (result.ok && declines(result.data as AuthSessionInfo)) {
          // Signed out here: what this socket sends is not shown, and nothing asks again for it.
          state.rotated = false;
          state.refusedConnection = socket.getStatus().connection;
          gate.reset();
          refreshSignInStatus();
          releaseSessionHold();
          finishBoot();
          return;
        }
        if (result.ok) {
          const wasRotated = state.rotated;
          state.rotated = false;
          state.refusedConnection = null;
          const info = result.data as AuthSessionInfo;
          // §6.5: after a ROTATED that was heard, whoever owns the credential now stays signed in.
          if (wasRotated) adoptSession(info);
          // CPC1-35: a start with a session in memory (`stop()`, then `start()`). When the Core
          // names another one, the known session ended unheard: its end reopens the socket, and
          // the probe of that socket takes the new session.
          else if (!confirmSession(info, true)) {
            finishBoot();
            return;
          }
          // A session whose socket is not an OPERATOR socket (the server ended it for a rotation, or
          // it was opened before the credential existed) gets a new one, and with it a snapshot.
          ensureSessionSocket(wasRotated);
          if (gate.position !== null) finishBoot();
          return;
        }
        // An answer, and it names no session: signed out (401), or refused.
        if (isRefusal(result, 401, ApiErrorCode.NOT_SIGNED_IN)) state.debtUnread = false;
        if (state.rotated && state.session !== null) {
          void endSession({ kind: 'SESSION_ENDED', reason: SessionEndedReason.ROTATED, source: 'CONTROL' });
        } else {
          inspect(result);
        }
        state.rotated = false;
        if (state.session === null) {
          // Whatever this socket still sends belongs to a session the server no longer names.
          state.refusedConnection = socket.getStatus().connection;
          gate.reset();
          refreshSignInStatus();
        }
        releaseSessionHold();
        finishBoot();
      },
      () => {
        state.probing = false;
        releaseSessionHold();
        finishBoot();
      },
    );
  }

  /** §5.1 step 4, signed out: the lock state of this console fills the lockout view (WS-3). */
  function refreshSignInStatus(): void {
    if (state.statusInFlight || state.lockoutKnown || !state.running) return;
    state.statusInFlight = true;
    const seq = state.lockoutSeq;
    ask(
      'status',
      LIVE_SIGN_IN_STATUS_OPERATION,
      (result) => {
        state.statusInFlight = false;
        if (seq !== state.lockoutSeq) {
          // CPC1-11: asked before the session or the credential changed. That answer is another
          // console's; the read is made again.
          if (state.session === null) refreshSignInStatus();
          return;
        }
        if (result === null) return;
        if (!result.ok) {
          inspect(result);
          return;
        }
        state.lockoutKnown = true;
        const status = result.data as SignInStatus;
        commit({ authLockout: lockoutSliceOf(status, status.serverTime) });
      },
      () => {
        state.statusInFlight = false;
      },
    );
  }

  /** CL-23: a 403 `NOT_PERMITTED` refreshes the permission hint once; refusals inside the delay share that one call. */
  function schedulePermissionRefresh(): void {
    if (state.timers.permission !== null || state.session === null) return;
    arm('permission', LIVE_PERMISSION_REFRESH_MS, () => {
      if (state.session === null || !state.running) return;
      const era = state.era;
      ask('permission', LIVE_SESSION_OPERATION, (result) => {
        if (result === null || state.era !== era) return;
        if (!result.ok) inspect(result);
        // While a confirmation is out, its own answer brings these values; this one was asked earlier.
        else if (state.session !== null && !unconfirmed()) confirmSession(result.data as AuthSessionInfo, false);
      });
    });
  }

  /** A call of the source's own (not of an action): what the client throws is reported and answered as null. */
  async function guardedCall(operationId: string, input?: CoreLooseCallInput): Promise<CoreCallResult | null> {
    try {
      return await call(operationId, input);
    } catch (error) {
      reportThrown('client', error, { operationId });
      return null;
    }
  }

  /**
   * A question of the source's own, and what it does with the answer. The answer of a run that was
   * stopped changes nothing (CPC1-7), and an exception of `then` is reported and never escapes
   * (CPC1-2); `recover` then puts back what the question had set.
   */
  function ask(name: string, operationId: string, then: (result: CoreCallResult | null) => void, recover?: () => void, input?: CoreLooseCallInput): void {
    const run = state.run;
    void guardedCall(operationId, input).then((result) => {
      if (!isCurrent(run)) return;
      try {
        then(result);
      } catch (error) {
        reportThrown(name, error, { operationId });
        if (recover) guarded(name, recover);
      }
    });
  }

  /**
   * Activity (ID-P9; decision D84). The answer to a POST that was sent as the signed-in operator,
   * through an action or through `live.client`, is what this client knows of the session's
   * activity at the Core:
   *
   * | Answer | The touch period (CL-27) | The idle instant this client reckons with |
   * |--------|--------------------------|-------------------------------------------|
   * | 2xx | Starts again: the Core counted the POST, so no touch is needed | Moves to now plus the idle time-out |
   * | Any other answer with a status, except 401 (a refusal, a state conflict, a 5xx) | Unchanged: the Core counts only a POST that reached its handler, so a touch may still be needed | Moves all the same. The operator was at the console, and the instant must never come EARLY: at worst it is later than the Core's, by less than the idle time-out, and only while the link is down |
   * | 401 | Unchanged | Unchanged: the Core named no session |
   * | No answer | Unchanged | Unchanged: nothing is known |
   *
   * A GET never counts, and nothing counts while nobody is signed in (a tablet then presents its
   * device credential, which is no operator).
   */
  function noteActivity(result: CoreCallResult): void {
    if (state.session === null || !isPost(result.operationId)) return;
    if (result.ok) touch.posted();
    if (result.status === null || result.status === 401) return;
    state.activityAt = clock.now();
    armExpiry();
  }

  /** CL-23 and CL-27: what an answer means for the session, whatever asked for it. */
  function inspect(result: CoreCallResult): void {
    noteActivity(result);
    if (result.ok) return;
    if (isRefusal(result, 403, ApiErrorCode.DEVICE_REVOKED)) {
      void endSession({ kind: 'DEVICE_REVOKED', reason: null, source: 'REST' });
    } else if (isRefusal(result, 401, ApiErrorCode.NOT_SIGNED_IN) && state.session !== null) {
      void endSession({ kind: 'SESSION_ENDED', reason: null, source: 'REST', signOut: state.pendingSignOut });
    } else if (isRefusal(result, 403, ApiErrorCode.NOT_PERMITTED) || isRefusal(result, 403, ApiErrorCode.FORBIDDEN)) {
      schedulePermissionRefresh();
    }
  }

  /**
   * CPC1-25: an action's answer means something for the session that SENT the request only. When
   * that session ended meanwhile (and another one may have signed in), the answer changes
   * nothing: a late 401 must not end the newer session, and a late POST is not its activity.
   */
  function inspectFor(era: number, result: CoreCallResult): void {
    if (state.era === era) inspect(result);
  }

  // ── The client the pages use (decisions D84, D90) ────────────────────────────────────

  /**
   * `live.client`: the typed client that was passed in, seen through the source. A page calls the
   * operations that are no simulator action (the administration lists and their commands) through
   * it, and its answers then mean for the session what an action's answers mean (CL-23, CL-27;
   * `inspect`): an answered POST of the signed-in operator is activity, a 401 `NOT_SIGNED_IN` ends
   * the session, a 403 `DEVICE_REVOKED` ends the pairing, and a 403 `NOT_PERMITTED` or `FORBIDDEN`
   * refreshes the permission hint with the one debounced `getAuthSession` the actions share.
   *
   * One rule of the actions does NOT hold here (CL-22): the view refuses nothing while the link is
   * down. The request goes to the typed client, and its own transport error is what the page gets.
   *
   * The view changes nothing of the call itself. `call` hands back the very promise the typed
   * client returned and sends nothing with it; the answer is looked at on a branch of that
   * promise. Only an answer to a request that was sent while an operator was signed in, and that
   * arrives while the same session is still the one of this client, is looked at. A promise the
   * typed client rejects (a usage error) is reported here as `live.client` and still rejects for
   * the caller.
   */
  function observedClient(client: Client): Client {
    const raw = client as unknown as { call: (...input: unknown[]) => Promise<unknown> };
    const view = Object.create(client) as Client;
    Object.defineProperty(view, 'call', {
      configurable: false,
      enumerable: true,
      writable: false,
      value: (...input: unknown[]): Promise<unknown> => {
        const answer = raw.call(...input);
        if (state.session !== null && state.running) {
          const era = state.era;
          const run = state.run;
          void answer.then(
            (result) => {
              if (isCurrent(run) && state.era === era) guarded('client', () => inspect(result as CoreCallResult));
            },
            (error: unknown) => reportThrown('client', error, { operationId: typeof input[0] === 'string' ? input[0] : null }),
          );
        }
        return answer;
      },
    });
    return view;
  }

  // ── The expiry this client reckons with (decision D80) ───────────────────────────────

  /**
   * When the session of this client ends by itself, on the server's clock, as far as this client
   * knows: the idle expiry the server last named, moved by every answered POST of the operator
   * (an action's, or a page's through `live.client`: `noteActivity`), or the absolute expiry,
   * whichever is first. A POST that goes around `live.client` (a client the page built by itself)
   * is not seen here.
   */
  function expiryOf(): { at: number; reason: ExpiryReason } | null {
    const session = state.session;
    if (session === null) return null;
    const idleAt = state.activityAt === null ? session.idleExpiresAt : Math.max(session.idleExpiresAt, state.activityAt + AUTH_IDLE_TIMEOUT_MS);
    return session.absoluteExpiresAt <= idleAt
      ? { at: session.absoluteExpiresAt, reason: SessionEndedReason.ABSOLUTE_EXPIRED }
      : { at: idleAt, reason: SessionEndedReason.IDLE_EXPIRED };
  }

  function armExpiry(): void {
    cancel('expiry');
    const expiry = expiryOf();
    if (expiry === null || !state.running) return;
    arm('expiry', expiry.at - clock.now(), checkExpiry);
  }

  /**
   * True while the Core would tell this client that its session ended: the socket is the
   * session's own, an OPERATOR socket, and it is open and heard: the link is ONLINE, or RESYNCING
   * (the socket is open and only waits for a snapshot; a `session.ended` still arrives on it). On
   * any other socket no `session.ended` arrives (finding F66-18).
   */
  const coreWouldTell = (): boolean =>
    (state.link === LiveLinkState.ONLINE || state.link === LiveLinkState.RESYNCING) && socket.getStatus().principal === RealtimePrincipal.OPERATOR;

  /**
   * The instant this client reckons with has passed (D80, amended by D90, CPC1-23). The reckoning
   * can be early: a POST of another tab of the same browser, or one whose answer was lost, is
   * activity this client never saw. So the session is not ended on a reckoning: **the Core is
   * asked** (`getAuthSession`, a GET, which moves no idle time).
   *
   * | The Core answers | Then |
   * |------------------|------|
   * | A session | Its instants are the truth and are taken. By the Core's own clock still open: the next look is at its instant. Already past it: the Core ends it itself; asked again after 2 s, 4 s … 30 s |
   * | 401 | The session is over at the Core: it ends here with the expiry as its reason (`source: 'REST'`). Nothing is owed |
   * | Nothing (no answer, a time-out, 429, 5xx) while the Core would tell | Nothing ends: the socket carries `session.ended` when it comes. Asked again later |
   * | Nothing, and the Core would NOT tell | **The local end**: this is the case DR-11 exists for. The end is a debt, and the Core is asked again before anything is done about it (`settleDebt`) |
   */
  function checkExpiry(): void {
    if (!state.running) return;
    const expiry = expiryOf();
    if (expiry === null) return;
    const now = clock.now();
    if (now < expiry.at) {
      if (state.timers.expiry === null) arm('expiry', expiry.at - now, checkExpiry);
      return;
    }
    if (state.expiryAsked) return;
    state.expiryAsked = true;
    const era = state.era;
    const again = (retryAfterSeconds: number | null): void => {
      const delayMs = retryDelay(state.expiryFailures, retryAfterSeconds);
      state.expiryFailures += 1;
      arm('expiry', delayMs, checkExpiry);
    };
    ask(
      'expiry',
      LIVE_SESSION_OPERATION,
      (result) => {
        state.expiryAsked = false;
        if (state.era !== era || state.session === null) return;
        if (result === null || (!result.ok && result.transport !== null)) {
          if (coreWouldTell()) again(result === null ? null : result.retryAfterSeconds);
          else void endLocally(expiry.reason, null);
          return;
        }
        if (!result.ok) {
          if (isRefusal(result, 401, ApiErrorCode.NOT_SIGNED_IN)) {
            void endSession({ kind: 'SESSION_ENDED', reason: expiry.reason, source: 'REST' });
            return;
          }
          inspect(result);
          if (state.era === era) again(null);
          return;
        }
        const info = result.data as AuthSessionInfo;
        if (unconfirmed()) {
          // CPC1-35: the session waits to be confirmed for a new socket; this answer was asked earlier.
          again(null);
          return;
        }
        // CPC1-35: another session than the known one is not taken over in silence.
        if (!confirmSession(info, false)) return;
        // By the Core's own clock: how long the session still has. The local clock is not asked (CPC1-27).
        const remaining = Math.min(info.idleExpiresAt, info.absoluteExpiresAt) - info.serverTime;
        if (remaining > 0) {
          state.expiryFailures = 0;
          arm('expiry', remaining, checkExpiry);
        } else {
          again(null);
        }
      },
      () => {
        state.expiryAsked = false;
      },
    );
  }

  // ── Touch ────────────────────────────────────────────────────────────────────────────

  const touch = createTouchThrottle({
    intervalMs: options.touchIntervalMs ?? LIVE_TOUCH_INTERVAL_MS,
    now: local,
    timers,
    signedIn: () => state.session !== null,
    online: () => state.link === LiveLinkState.ONLINE && !unconfirmed(),
    send() {
      const plan = LIVE_BINDINGS.touch.plan([], viewNow(), {});
      if (plan.kind !== 'call') return;
      const era = state.era;
      ask(
        'touch',
        plan.operationId,
        (result) => {
          if (result === null) return;
          if (!result.ok) {
            inspect(result);
            const error = rebuildRefusal(result, { action: 'touch', operationId: plan.operationId, entity: null, sessionState: null });
            reportRejection('touch', error, plan.operationId, result);
            return;
          }
          if (state.session === null || state.era !== era) return;
          const expiry = result.data as AuthSessionExpiry;
          state.session = {
            ...state.session,
            lastActivityAt: lastActivityOf(expiry.idleExpiresAt),
            idleExpiresAt: expiry.idleExpiresAt,
            absoluteExpiresAt: expiry.absoluteExpiresAt,
          };
          state.activityAt = null;
          if (gate.position !== null) commit(authPatch());
          armExpiry();
          notifyLive();
        },
        undefined,
        plan.input,
      );
    },
  });

  // ── Actions ──────────────────────────────────────────────────────────────────────────

  const reportContinuation = (error: unknown): void => reportThrown('continuation', error);

  /** CL-22: the command is not sent. No status and no code, because there was no request. */
  const offline = (): LiveTransportError => new LiveTransportError(LiveTransportReason.CORE_OFFLINE);

  /** F66-10: what the result of a value-returning action watches. Nothing for the other actions. */
  function misuseHooks(action: string): LiveResultHooks {
    if (!VALUE_ACTIONS.has(action)) return {};
    return {
      valueMembers: [LIVE_RESULT_DISCRIMINANT],
      valueRead: (member) => reportMisuse(action, LiveMisuse.READ_AS_VALUE, member),
    };
  }

  /** `await` and `Promise.resolve` attach their callbacks one promise job after they got the result: the question is asked later than that. */
  function watchObserved(action: string, observed: () => boolean): void {
    if (!VALUE_ACTIONS.has(action) || state.misuse.has(`${LiveMisuse.NOT_OBSERVED}:${action}`)) return;
    void Promise.resolve()
      .then(() => Promise.resolve())
      .then(() => Promise.resolve())
      .then(() => {
        if (!observed()) reportMisuse(action, LiveMisuse.NOT_OBSERVED, null);
      });
  }

  /** The result of an action whose request goes out: `stop()` settles it when it is still out then (CPC1-7). */
  function newResult(action: string, operationId: string | null): LiveResultControl<unknown> {
    const flight: Flight = {
      action,
      operationId,
      control: createLiveResult<unknown>(reportContinuation, {
        ...misuseHooks(action),
        settled: (observed) => {
          flights.delete(flight);
          watchObserved(action, observed);
        },
      }),
    };
    flights.add(flight);
    return flight.control;
  }

  /** Rejects an action: one report (CL-24), then the callbacks of the result. */
  function rejectAction(control: LiveResultControl<unknown>, action: string, error: unknown, operationId: string | null, failure: CoreCallFailure | null): void {
    if (control.settled) return;
    reportRejection(action, error, operationId, failure);
    control.reject(error);
  }

  /** The hooks of a result that is already settled when it is returned. */
  const localHooks = (action: string): LiveResultHooks => ({ ...misuseHooks(action), settled: (observed) => watchObserved(action, observed) });

  /** The answer of a plan that needs no request. */
  function settleLocally(action: string, plan: LocalPlan): LiveResult<unknown> {
    if (plan.kind === 'resolve') return resolvedLiveResult(plan.value, reportContinuation, localHooks(action));
    reportRejection(action, plan.error, null, null);
    return rejectedLiveResult(plan.error, reportContinuation, localHooks(action));
  }

  /** The error a refused action rejects with. It never throws: what the rebuilding itself threw is the rejection. */
  function refusalOf(action: string, binding: AnyBinding, plan: CallPlan, failure: CoreCallFailure): unknown {
    try {
      return rebuildRefusal(failure, {
        action,
        operationId: plan.operationId,
        entity: plan.entity,
        sessionState: store.getState().session?.state ?? null,
        ...(binding.invalidInputCode !== undefined ? { invalidInputCode: binding.invalidInputCode } : {}),
      });
    } catch (error) {
      return error;
    }
  }

  /** The member of the action's result union for a refusal (CL-19); never for a failure without a usable answer. */
  function unionOf(binding: AnyBinding, failure: CoreCallFailure): unknown {
    return transportErrorOf(failure) === null ? binding.refusal?.(failure, viewNow()) : undefined;
  }

  /** The lock state of this console after a failed sign-in, as the server's answer says it. */
  function applyAttempt(result: unknown): void {
    const attempt = result as { ok?: boolean; reason?: string; attemptsRemaining?: number; lockedUntil?: number };
    if (attempt.ok !== false) return;
    if (attempt.reason === 'LOCKED' && typeof attempt.lockedUntil === 'number') {
      commit({ authLockout: { failures: [], lockedUntil: attempt.lockedUntil } });
    } else if (attempt.reason === 'INVALID_CREDENTIALS' && typeof attempt.attemptsRemaining === 'number') {
      commit({ authLockout: lockoutSliceOf({ lockedUntil: null, attemptsRemaining: attempt.attemptsRemaining }, clock.now()) });
    }
  }

  /**
   * Runs one command between the gate's `begin` and its settlement (CPC1-2). Whatever `body` does
   * (it returns early, it throws, a subscriber of the store throws under it), the command leaves
   * the gate exactly once: a command that stayed "in flight" would hold every later state message.
   */
  function throughGate(control: LiveResultControl<unknown>, action: string, operationId: string, body: (exit: GateExit) => Promise<void>): void {
    gate.begin();
    let left = false;
    const exit: GateExit = {
      end(settle) {
        if (left) return;
        left = true;
        // `stop()` settled the action and emptied the gate: nothing of this run is counted any more.
        if (control.settled) return;
        gate.end(settle);
      },
      wait(target, waitOptions) {
        if (left) return;
        left = true;
        if (control.settled) return;
        gate.wait(target, waitOptions);
      },
    };
    void body(exit)
      .catch((error: unknown) => {
        if (left || control.settled) reportThrown(`action.${action}`, error, { operationId });
        else exit.end(() => rejectAction(control, action, error, operationId, null));
      })
      .then(() => {
        // A body that returned without leaving (it should not): the gate is freed all the same.
        if (!left && !control.settled) exit.end(() => rejectAction(control, action, new CoreRefusalError(NOT_AVAILABLE), operationId, null));
      });
  }

  /** A POST through the gate (CL-16 to CL-18). */
  function runCommand(action: SimActionName, binding: AnyBinding, args: readonly unknown[]): LiveResult<unknown> {
    const plan = binding.plan(args, viewNow(), {});
    if (plan.kind !== 'call') return settleLocally(action, plan);
    const control = newResult(action, plan.operationId);
    if (state.link !== LiveLinkState.ONLINE || unconfirmed()) {
      rejectAction(control, action, offline(), plan.operationId, null);
      return control.result;
    }
    const era = state.era;
    throughGate(control, action, plan.operationId, async (exit) => {
      const result = await call(plan.operationId, plan.input);
      // `stop()` settled this action while its request was out: the late answer changes nothing.
      if (control.settled) return;
      inspectFor(era, result);
      if (!result.ok) {
        const union = unionOf(binding, result);
        if (union !== undefined) {
          exit.end(() => control.resolve(union));
          return;
        }
        exit.end(() => rejectAction(control, action, refusalOf(action, binding, plan, result), plan.operationId, result));
        return;
      }
      const value = binding.result(result, viewNow());
      if (action === 'recordBiometricFailure') {
        const status = result.data as SignInStatus;
        commit({ authLockout: lockoutSliceOf(status, status.serverTime) });
      }
      const named: ReplicaPosition | null =
        binding.target?.(result) ?? (result.epoch !== null && result.revision !== null ? { epoch: result.epoch, revision: result.revision } : null);
      if (gate.position === null && gate.held === 0) {
        // This client holds no replicated state (nobody is signed in): nothing could show the effect.
        exit.end(() => control.resolve(value));
        return;
      }
      if (named === null) {
        // API-7 says every 2xx of a POST names its revision. Without one there is nothing to wait
        // for: the action settles now, and the gap is reported (decision D51 left this to this row).
        record({
          level: 'warn',
          source: `${LIVE_ERROR_SOURCE}.action.${action}`,
          message: 'A command was answered without its state revision; it settled without waiting for its effect.',
          at: clock.now(),
          context: { action, operationId: plan.operationId, status: result.status, requestId: result.requestId },
        });
        exit.end(() => control.resolve(value));
        return;
      }
      exit.wait({ kind: 'position', ...named }, { timeoutMs: settleTimeoutMs, settle: () => control.resolve(value) });
    });
    return control.result;
  }

  /** A GET: it settles with the answer; nothing is held (`verifyAuditChain`). */
  function runRead(action: SimActionName, binding: AnyBinding, args: readonly unknown[]): LiveResult<unknown> {
    const plan = binding.plan(args, viewNow(), {});
    if (plan.kind !== 'call') return settleLocally(action, plan);
    const control = newResult(action, plan.operationId);
    if (state.link !== LiveLinkState.ONLINE || unconfirmed()) {
      rejectAction(control, action, offline(), plan.operationId, null);
      return control.result;
    }
    const era = state.era;
    void (async () => {
      try {
        const result = await call(plan.operationId, plan.input);
        if (control.settled) return;
        inspectFor(era, result);
        if (!result.ok) {
          const union = unionOf(binding, result);
          if (union !== undefined) control.resolve(union);
          else rejectAction(control, action, refusalOf(action, binding, plan, result), plan.operationId, result);
          return;
        }
        const value = binding.result(result, viewNow());
        if (action === 'verifyAuditChain') {
          const status = result.data as AuditChainStatus;
          state.auditChain = { view: status.view, stored: status.stored, lineage: status.lineage, lineageTotal: status.lineageTotal, at: clock.now() };
          notifyLive();
        }
        control.resolve(value);
      } catch (error) {
        rejectAction(control, action, error, plan.operationId, null);
      }
    })();
    return control.result;
  }

  /** `signIn` and `signInWithBiometric`: the answer, a new socket, the snapshot of that socket (§5.2). */
  function runSignIn(action: SimActionName, binding: AnyBinding, args: readonly unknown[]): LiveResult<unknown> {
    const control = newResult(action, null);
    if (state.link !== LiveLinkState.ONLINE) {
      rejectAction(control, action, offline(), null, null);
      return control.result;
    }
    void (async () => {
      try {
        // D80: a sign-out this client still owes must not arrive after this sign-in, or it would end the new session.
        if (state.owedCall !== null) await state.owedCall;
        // The biometric token goes from the app's storage into the request and is not kept here.
        let extras: BindingExtras = {};
        if (action === 'signInWithBiometric') {
          let token: string | null = null;
          try {
            // Not bounded: it waits behind the prompt of the operating system, which has its own time-out.
            token = (await secrets?.biometricToken?.(String(args[0]))) ?? null;
          } catch (error) {
            // CPC1-26: what the port threw is the app's own text; neither the report nor the rejection carries it.
            reportPort('biometricToken', error, { action });
            throw new CoreRefusalError(NOT_AVAILABLE);
          }
          extras = { biometricToken: token };
        }
        if (control.settled) return;
        const plan = binding.plan(args, viewNow(), extras);
        if (plan.kind === 'resolve') control.resolve(plan.value);
        else if (plan.kind === 'reject') rejectAction(control, action, plan.error, null, null);
        else signInThroughGate(control, action, binding, plan);
      } catch (error) {
        rejectAction(control, action, error, null, null);
      }
    })();
    return control.result;
  }

  function signInThroughGate(control: LiveResultControl<unknown>, action: SimActionName, binding: AnyBinding, plan: CallPlan): void {
    const { operationId } = plan;
    const run = state.run;
    state.signingIn += 1;
    let left = false;
    const leave = (): void => {
      if (left) return;
      left = true;
      // A sign-in of a run that was stopped is not counted any more: `stop()` set the count to 0.
      if (state.run === run) state.signingIn = Math.max(0, state.signingIn - 1);
    };
    const era = state.era;
    throughGate(control, action, operationId, async (exit) => {
      try {
        const result = await call(operationId, plan.input);
        if (control.settled) {
          leave();
          return;
        }
        inspectFor(era, result);
        if (!result.ok) {
          const union = unionOf(binding, result);
          leave();
          if (union !== undefined) {
            exit.end(() => {
              applyAttempt(union);
              control.resolve(union);
            });
            return;
          }
          exit.end(() => rejectAction(control, action, refusalOf(action, binding, plan, result), operationId, result));
          return;
        }
        const data = result.data as SignInResponse;
        const info = data.session;
        const value = binding.result(result, viewNow());
        // D80: the Core replaced the session a local end was over with. Nothing is owed any more,
        // and the socket this sign-in opens next is taken, not signed out.
        clearDebt();
        // CPC1-34: so is a session that was not taken because the storage could not be read.
        state.debtUnread = false;
        state.declined = null;
        if (data.sessionToken !== undefined) {
          // A device session: its bearer value goes to the app now, before the socket is reopened.
          if (!secrets?.sessionIssued) throw new CoreRefusalError(NOT_AVAILABLE);
          const sessionToken = data.sessionToken;
          const stored = await bounded(
            'sessionIssued',
            { action },
            () => secrets.sessionIssued?.({ sessionToken, biometricToken: data.biometricToken ?? null, operatorId: info.operator.id }),
          );
          if (control.settled) {
            leave();
            return;
          }
          // CPC1-26: the action rejects with a fixed error, never with what the port threw.
          if (!stored.ok) throw new CoreRefusalError(NOT_AVAILABLE);
        }
        // From here on nothing that holds the answer is reachable: the wait keeps the session
        // information and the action's value, and no token.
        awaitSignInSnapshot(control, action, operationId, info, value, leave, exit);
      } catch (error) {
        leave();
        throw error;
      }
    });
  }

  /**
   * The second half of a sign-in. The principal is fixed at the upgrade, so the session needs a
   * new socket (CL-11a); the snapshot of that socket is the sign-in's effect. In the store update
   * of that snapshot the session, `auth` and a clean lockout view are set, and then the action
   * settles, in the same turn.
   */
  function awaitSignInSnapshot(
    control: LiveResultControl<unknown>,
    action: string,
    operationId: string,
    info: AuthSessionInfo,
    value: unknown,
    leave: () => void,
    exit: GateExit,
  ): void {
    const afterConnection = socket.getStatus().connection;
    socket.reconnect('SIGN_IN');
    exit.wait(
      { kind: 'snapshot', afterConnection },
      {
        timeoutMs: bootTimeoutMs,
        extra: () => {
          state.era += 1;
          state.session = info;
          state.activityAt = null;
          state.rotated = false;
          state.probing = false;
          state.probeFailures = 0;
          state.refusedConnection = null;
          state.socketAsked = false;
          state.lockoutKnown = false;
          state.lockoutSeq += 1;
          // CPC1-35: a question about the session this sign-in replaced is over with it.
          state.revalidating = false;
          cancel('revalidate');
          cancel('probe');
          releaseSessionHold();
          return { auth: authSliceOf(info), authLockout: NEUTRAL_LOCKOUT };
        },
        settle: (outcome: GateOutcome) => {
          leave();
          if (outcome === 'reached') {
            armExpiry();
            notifyLive();
            control.resolve(value);
            return;
          }
          // §5.2 step 6: the credential exists; the next start-up, or the link coming back, signs in without a password.
          const error = new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: LIVE_SNAPSHOT_TIMEOUT_CODE });
          rejectAction(control, action, error, operationId, null);
        },
      },
    );
  }

  /** `signOut` (WS-12; decision D80: it never does nothing). */
  function runSignOut(action: SimActionName, binding: AnyBinding, args: readonly unknown[]): LiveResult<unknown> {
    if (state.session === null) {
      // Nobody is signed in. The simulator's `signOut` then only turns EXPIRED into SIGNED_OUT.
      if (store.getState().auth.status !== AuthStatus.SIGNED_OUT) commit({ auth: signedOutAuthSlice() });
      return resolvedLiveResult(undefined, reportContinuation);
    }
    const plan = binding.plan(args, viewNow(), {});
    if (plan.kind !== 'call') return settleLocally(action, plan);
    const reason = args[0] === SignOutReason.LOCK ? SignOutReason.LOCK : SignOutReason.USER;
    if (state.link !== LiveLinkState.ONLINE || unconfirmed()) {
      // The Core cannot be told now (or, CPC1-35, it is not known whose session the credential
      // names now). The console is signed out, or locked, all the same.
      void endLocally(SessionEndedReason.SIGNED_OUT, reason);
      return resolvedLiveResult(undefined, reportContinuation);
    }
    const control = newResult(action, plan.operationId);
    state.pendingSignOut = reason;
    const era = state.era;
    throughGate(control, action, plan.operationId, async (exit) => {
      try {
        const result = await guardedCall(plan.operationId, plan.input);
        if (control.settled) return;
        // CPC1-25: the session this sign-out was sent for may be over by now, and another one signed in.
        const same = (): boolean => state.era === era && state.session !== null;
        if (result === null || (!result.ok && result.transport !== null)) {
          // No answer: the same local end as with the link down, and the sign-out is owed.
          state.pendingSignOut = null;
          if (same()) void endLocally(SessionEndedReason.SIGNED_OUT, reason);
          exit.end(() => control.resolve(undefined));
          return;
        }
        // A 401 says the session is already gone: `inspect` ends it, and the sign-out has what it wanted.
        inspectFor(era, result);
        if (!result.ok && !isRefusal(result, 401, ApiErrorCode.NOT_SIGNED_IN)) {
          // CPC1-31: a sign-out the Core refuses fails CLOSED, for USER as for LOCK. The console is
          // signed out, or locked, here; the sign-out stays owed and is asked again with back-off;
          // the refusal is reported. The action resolves: what the operator asked for happened here.
          state.pendingSignOut = null;
          record({
            level: 'error',
            source: `${LIVE_ERROR_SOURCE}.session`,
            message: 'The Core refused a sign-out; the console is signed out here and the sign-out stays owed.',
            at: clock.now(),
            context: { operationId: plan.operationId, status: result.status, code: result.error.code, requestId: result.requestId, reason },
          });
          if (same()) void endLocally(SessionEndedReason.SIGNED_OUT, reason);
          exit.end(() => control.resolve(undefined));
          return;
        }
        if (same()) {
          void endSession({ kind: 'SESSION_ENDED', reason: SessionEndedReason.SIGNED_OUT, source: 'SIGN_OUT', signOut: reason });
        }
        state.pendingSignOut = null;
        exit.end(() => control.resolve(undefined));
      } finally {
        state.pendingSignOut = null;
      }
    });
    return control.result;
  }

  /** `pair` (§9.4, MP-5, MP-6). */
  function runPair(action: SimActionName, binding: AnyBinding, args: readonly unknown[]): LiveResult<unknown> {
    // Without the app's storage the credential could not be kept: the code is then not sent at all.
    const plan = binding.plan(args, viewNow(), { device: secrets?.devicePaired ? (options.device?.() ?? null) : null });
    if (plan.kind !== 'call') return settleLocally(action, plan);
    const control = newResult(action, plan.operationId);
    if (state.link !== LiveLinkState.ONLINE) {
      rejectAction(control, action, offline(), plan.operationId, null);
      return control.result;
    }
    const era = state.era;
    void (async () => {
      try {
        const result = await call(plan.operationId, plan.input);
        if (control.settled) return;
        if (!result.ok) {
          inspectFor(era, result);
          const union = unionOf(binding, result) as { attemptsRemaining?: number; lockedUntil?: number } | undefined;
          if (union === undefined) {
            rejectAction(control, action, refusalOf(action, binding, plan, result), plan.operationId, result);
            return;
          }
          commit({
            pairing: failedPairing(store.getState().pairing, clock.now(), {
              attemptsRemaining: union.attemptsRemaining ?? null,
              lockedUntil: union.lockedUntil ?? null,
            }),
          });
          control.resolve(union);
          return;
        }
        const redeemed = result.data as PairingRedeemed;
        // MP-6: the app stores the credential before the action settles. It is not kept here.
        if (secrets?.devicePaired) {
          const stored = await bounded('devicePaired', { action }, () => secrets.devicePaired?.(redeemed));
          if (control.settled) return;
          // CPC1-26: the action rejects with a fixed error, never with what the port threw.
          if (!stored.ok) throw new CoreRefusalError(NOT_AVAILABLE);
        }
        clearRetired();
        commit({ pairing: pairedSlice(redeemed.core, redeemed.pairedAt) });
        // CPC1-11: the lock state that was read before was read without the device credential, so
        // it is another console's. It is read again, as this device.
        state.lockoutKnown = false;
        state.lockoutSeq += 1;
        // The socket was opened without a credential; the next one presents the device's.
        socket.reconnect('CREDENTIAL');
        if (state.session === null) refreshSignInStatus();
        control.resolve(binding.result(result, viewNow()));
      } catch (error) {
        rejectAction(control, action, error, plan.operationId, null);
      }
    })();
    return control.result;
  }

  /** `unpair` (MP-7). */
  function runUnpair(action: SimActionName, binding: AnyBinding, args: readonly unknown[]): LiveResult<unknown> {
    const plan = binding.plan(args, viewNow(), {});
    if (plan.kind !== 'call') return settleLocally(action, plan);
    const control = newResult(action, plan.operationId);
    if (state.link !== LiveLinkState.ONLINE) {
      // Nothing is deleted while the Core cannot be told, so the registry never keeps a device the tablet forgot.
      rejectAction(control, action, offline(), plan.operationId, null);
      return control.result;
    }
    const era = state.era;
    void (async () => {
      try {
        const result = await call(plan.operationId, plan.input);
        if (control.settled) return;
        if (!result.ok) {
          inspectFor(era, result);
          rejectAction(control, action, refusalOf(action, binding, plan, result), plan.operationId, result);
          return;
        }
        // The server's own `device.revoked` may have arrived first; then the end is already under way.
        if (store.getState().pairing.state === PairingState.PAIRED) {
          await endSession({ kind: 'DEVICE_REVOKED', reason: 'UNPAIRED', source: 'UNPAIR' });
        } else {
          await state.lastEnd;
        }
        control.resolve(undefined);
      } catch (error) {
        rejectAction(control, action, error, plan.operationId, null);
      }
    })();
    return control.result;
  }

  function run(action: SimActionName, args: readonly unknown[]): LiveResult<unknown> {
    const binding = LIVE_BINDINGS[action] as unknown as AnyBinding;
    try {
      switch (binding.flow) {
        case LiveActionFlow.SIGN_IN:
          return runSignIn(action, binding, args);
        case LiveActionFlow.SIGN_OUT:
          return runSignOut(action, binding, args);
        case LiveActionFlow.TOUCH:
          // Fire and forget, as the shells call it: a failed touch is reported, never thrown.
          touch.activity();
          return resolvedLiveResult(undefined, reportContinuation);
        case LiveActionFlow.PAIR:
          return runPair(action, binding, args);
        case LiveActionFlow.UNPAIR:
          return runUnpair(action, binding, args);
        case LiveActionFlow.READ:
          return runRead(action, binding, args);
        case LiveActionFlow.LOCAL:
          return settleLocally(action, binding.plan(args, viewNow(), {}) as LocalPlan);
        default:
          return runCommand(action, binding, args);
      }
    } catch (error) {
      // A binding threw while it mapped its input: a rejection like any other, never a synchronous throw.
      reportRejection(action, error, null, null);
      return rejectedLiveResult(error, reportContinuation, localHooks(action));
    }
  }

  const actions = Object.fromEntries(
    LIVE_BINDING_NAMES.map((name) => [name, (...args: unknown[]) => run(name, args)] as const),
  ) as unknown as LiveActions;

  // ── Life cycle ───────────────────────────────────────────────────────────────────────

  function publishClock(): void {
    const now = publishedNow();
    if (now !== store.getState().clock.now) commit({ clock: clockSliceAt(now) });
  }

  function start(): void {
    if (state.running) return;
    state.running = true;
    state.run += 1;
    state.lockoutKnown = false;
    state.lockoutSeq += 1;
    if (visibility) {
      try {
        socket.setMetersWanted(!visibility.isHidden());
        state.unsubscribeVisibility = visibility.subscribe(() => guarded('visibility', () => socket.setMetersWanted(!visibility.isHidden())));
      } catch (error) {
        reportThrown('visibility', error);
      }
    }
    state.clockTimer = { handle: timers.setInterval(() => guarded('clock', publishClock), CLOCK_TICK_MS) };
    if (!state.ready) arm('boot', bootTimeoutMs, finishBoot);
    socket.start();
    // CPC1-24: what an earlier source left in the storage is read before any session is asked for.
    if (state.debtKnown) probeSession();
    else loadDebt();
    armExpiry();
  }

  /**
   * CPC1-7: after `stop()` nothing of this run fires, and an answer that arrives later changes
   * nothing. A command the Core already accepted resolves here; an action without an answer
   * rejects here.
   */
  function stop(): void {
    if (!state.running) return;
    state.running = false;
    if (state.clockTimer !== null) timers.clearInterval(state.clockTimer.handle);
    state.clockTimer = null;
    for (const name of TIMER_NAMES) cancel(name);
    for (const endWait of Array.from(budgets)) endWait();
    touch.reset();
    state.unsubscribeVisibility?.();
    state.unsubscribeVisibility = null;
    state.probing = false;
    state.statusInFlight = false;
    state.expiryAsked = false;
    state.revalidating = false;
    state.signingIn = 0;
    state.pendingSignOut = null;
    state.sessionHold = false;
    gate.halt();
    for (const flight of Array.from(flights)) {
      const error = new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: LIVE_STOPPED_CODE });
      rejectAction(flight.control, flight.action, error, flight.operationId, null);
    }
    flights.clear();
    socket.stop();
    // A stopped source will not finish its bootstrap: whoever awaits `ready` goes on (it never rejects).
    finishBoot();
  }

  const rng: RngStreams = {
    get seed() {
      return store.getState().meta.seed;
    },
    epoch: 0,
    get: () => INERT_RNG,
    reseed: () => undefined,
  };

  const heartbeat: HeartbeatClient = {
    subscribe: socket.subscribe,
    getSnapshot: socket.getSnapshot,
    // The Live source owns the one socket: a heartbeat consumer can neither start nor stop it.
    start: () => undefined,
    stop: () => undefined,
  };

  const live: LiveSim<Client> = {
    coreMode: CoreMode.LIVE,
    store,
    actions,
    clock,
    rng,
    get seed() {
      return store.getState().meta.seed;
    },
    ready: readyPromise,
    isReady: () => state.ready,
    wasRestored: () => false,
    start,
    stop,
    isRunning: () => state.running,
    tick: () => undefined,
    flush: () => undefined,
    destroy: stop,
    errors: () => errorLog.slice(),
    request: () => ({
      status: 501,
      headers: {},
      body: { error: { code: ApiErrorCode.SIMULATOR_ERROR, message: 'The in-app simulator does not answer in Live mode. Call the Core server.' } },
    }),
    get link() {
      return state.link;
    },
    get session() {
      return state.session;
    },
    get lastSessionEnd() {
      return state.lastSessionEnd;
    },
    get auditChain() {
      return state.auditChain;
    },
    client: observedClient(options.client),
    heartbeat,
    onLiveChange: (listener) => subscribeTo(liveListeners, listener),
    onControl: (listener) => subscribeTo(controlListeners, listener),
    onSessionEnd: (listener) => subscribeTo(endListeners, listener),
    onResync: (listener) => subscribeTo(resyncListeners, listener),
    reconnect(reason) {
      // The app replaced a stored credential: an earlier revocation no longer stands in the way.
      if (reason === 'CREDENTIAL') clearRetired();
      return socket.reconnect(reason);
    },
    socketStatus: () => socket.getStatus(),
    setPairing(pairing) {
      if (pairing !== null) clearRetired();
      commit({ pairing: pairing === null ? neutralPairing() : pairedSlice(pairing.core, pairing.pairedAt) });
    },
  };

  if (options.autoStart ?? true) start();
  return live;
}
