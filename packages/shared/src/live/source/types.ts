/**
 * The public types of the Live source (HB-14; backend task 04_client_integration_spec §2.3, CL-15).
 *
 * `LiveSim` has every member of the simulator's `Sim` (`../../sim/engine`), so it can stand in the
 * existing `SimContext`, with two differences: its actions are asynchronous (`CoreActions`), and
 * its store has no `persist` member (in Live mode nothing is read from or written to the
 * simulator's stored snapshot, MD-5). `asSim` (`./index`) is the one documented cast.
 *
 * Type-only: this file loads nothing at run time.
 */
import type {} from 'zustand/middleware';
import type { Mutate, StoreApi } from 'zustand/vanilla';
import type { AuthSessionInfo } from '../../api/identity';
import type { CoreIdentity, PairingRedeemed } from '../../api/pairing';
import type { DeviceRevokedReason, RealtimeHelloReason, RealtimePrincipal, SessionEndedReason } from '../../api/realtime-messages';
import type { AuditChainStatus } from '../../api/security-audit';
import type { HeartbeatClient } from '../../realtime/heartbeat-client';
import type {
  LiveSocketClient,
  LiveSocketClientOptions,
  LiveSocketControlMessage,
  LiveSocketFactory,
  LiveSocketHeadersProvider,
  LiveSocketReconnectReason,
  LiveSocketResyncEvent,
  LiveSocketStatus,
  LiveSocketTimers,
} from '../../realtime/live-socket-client';
import type { RngStreams } from '../../sim/rng';
import type {
  ChainVerifyResult,
  EpochMs,
  SimActions,
  SimApiRequest,
  SimApiResponse,
  SimClock,
  SimErrorReport,
  SimState,
  VisibilityAdapter,
} from '../../sim/types';
import type { SessionState } from '../../domain/enums';
import type { SignOutReason } from '../../sim/vocabulary';
import type { LiveHandle, LiveLinkState } from '../mode';
import type { LiveDeviceDescription } from './bindings';
import type { LiveResult } from './live-result';
import type { StructuralSharing } from './structural-sharing';

/**
 * The typed client as the Live source takes it: whatever `createCoreClient` returns, with the
 * literal table or the widened one. The source calls operations by the IDs of the contract's
 * action table and reads the answers the client already validated (CL-4).
 */
export interface LiveClient {
  readonly call: (...input: never[]) => Promise<unknown>;
}

/**
 * The actions of a Live source: every member of `SimActions`, by name and with its parameters, each
 * returning a Live result of the simulator's return value (`./live-result`). Assignable to the
 * light API's `CoreActions`, which is what a call site reads in both modes.
 */
export type LiveActions = {
  readonly [Name in keyof SimActions]: SimActions[Name] extends (...args: infer Args) => infer Result
    ? (...args: Args) => LiveResult<Result>
    : SimActions[Name];
};

/** The store of a Live source: zustand vanilla with `subscribeWithSelector`, as the simulator's, without `persist`. */
export type LiveStore = Mutate<StoreApi<SimState>, [['zustand/subscribeWithSelector', never]]>;

/** How the Live source learned that a session or a pairing is over. */
export type LiveSessionEndSource =
  /** A `session.ended` or `device.revoked` message of the socket. */
  | 'CONTROL'
  /** Close 4401 or 4403 with no such message before it. */
  | 'CLOSE'
  /** `hello` refused the credential of the socket (`SESSION_INVALID`). */
  | 'HELLO'
  /** A REST answer: 401 `NOT_SIGNED_IN` while signed in, or 403 `DEVICE_REVOKED` (CL-23). */
  | 'REST'
  /** This client's own `signOut` was answered. */
  | 'SIGN_OUT'
  /**
   * Decided on this client while the Core could not be told (decision D80): `signOut` (USER or
   * LOCK) while the link was not ONLINE or the request got no answer, or the idle or absolute
   * expiry of the session passed while the Core could not be asked. What the Core has not heard
   * is a debt (`LiveOwedSignOut`); it is settled, after the Core was asked which session the
   * credential names now, before an OPERATOR socket is taken again (decision D90).
   */
  | 'LOCAL'
  /** This client's own `unpair` was answered. */
  | 'UNPAIR';

/**
 * Why the client is no longer signed in, or no longer paired (CL-15 `lastSessionEnd`; §6.5). The
 * app decides what to show and what to delete; the Live source only reports. It is kept in memory
 * and is null after a reload.
 */
export interface LiveSessionEnd {
  /** `SESSION_ENDED`: back to the login screen. `DEVICE_REVOKED`: the pairing is over too; back to the pairing screen. */
  readonly kind: 'SESSION_ENDED' | 'DEVICE_REVOKED';
  /**
   * The server's reason: one of the six of `session.ended` (`TOKEN_REUSE` among them), or one of
   * the two of `device.revoked`. Null when the server gave none: an invalid cookie or bearer value.
   */
  readonly reason: SessionEndedReason | DeviceRevokedReason | null;
  readonly source: LiveSessionEndSource;
  /** The reason this client sent with its own sign-out, `USER` or `LOCK`; null when the end was not this client's sign-out. */
  readonly signOut: SignOutReason | null;
  /** Whether an operator was signed in on this client when it ended. False: only the credential of the socket was refused. */
  readonly wasSignedIn: boolean;
  /** The state of the Core's session as the replica last held it ("The recording continues on the Core"); null when idle or unknown. */
  readonly sessionState: SessionState | null;
  /** `hello.reason` of the socket that was closed, when the server gave one. */
  readonly helloReason: RealtimeHelloReason | null;
  /** Who the server had taken that socket for; null when it closed before `hello`. */
  readonly principal: RealtimePrincipal | null;
  /** On the Live clock. */
  readonly at: EpochMs;
}

/** What the last `verifyAuditChain` answered besides its `view` (§2.5; section 8.2, A9). */
export interface LiveAuditChain {
  readonly view: ChainVerifyResult;
  readonly stored: AuditChainStatus['stored'];
  readonly lineage: AuditChainStatus['lineage'];
  readonly lineageTotal: number;
  /** On the Live clock. */
  readonly at: EpochMs;
}

/**
 * The app's own storage of secrets, as the Live source needs it (mobile only; the web console has
 * none: its session is an `HttpOnly` cookie). The Live source **keeps no secret**: it hands a value
 * to the app in the turn the server returned it, and asks the app for one when a request needs it.
 * Every member may return a promise; the Live source waits for it before it goes on.
 *
 * Three rules for the app that writes this port:
 * - **Bounded.** The wait for `sessionIssued`, `sessionCleared`, `devicePaired` and `deviceUnpaired`
 *   ends after `LIVE_SECRETS_TIMEOUT_MS`. A port that did not answer by then is reported
 *   (`live.secrets`) and treated as one that failed. `biometricToken` is not bounded: it waits
 *   behind the prompt of the operating system, which has its own time-out. So `sessionIssued` and
 *   `devicePaired` must not wait for a prompt: keep the value in memory, resolve, and persist it
 *   without one.
 * - **Nothing of a failure travels.** What a port throws is reported by the name of the port and
 *   the name of the error only, never by its message or stack (they are the app's own text and
 *   can hold the value). An action whose port failed rejects with `CoreRefusalError`
 *   (`NOT_AVAILABLE`), not with the port's own error.
 * - **Removed before it resolves.** When `sessionCleared` or `deviceUnpaired` resolves, the
 *   credential providers of the typed client and of the socket must no longer return the value:
 *   the socket is reopened right after.
 * - **Idempotent.** `deviceUnpaired` can be called again with the same end when the reopened
 *   socket still presents the old device credential (at most `LIVE_DEVICE_CLEANUP_RETRIES` times).
 */
export interface LiveSecretsPort {
  /**
   * A device sign-in was answered (operations 2 and 8): the bearer value of the new session, and
   * for a biometric sign-in the rotated biometric token. Called before the socket is reopened, so
   * the credential provider of the client and of the socket already returns the new value.
   */
  sessionIssued?(issued: { readonly sessionToken: string; readonly biometricToken: string | null; readonly operatorId: string }): void | Promise<void>;
  /**
   * The session is over: drop the session token. Called before the socket is reopened. For an end
   * that was decided on this client (`end.source` LOCAL) it is called at that moment, not when
   * the Core is told later.
   */
  sessionCleared?(end: LiveSessionEnd): void | Promise<void>;
  /** `signInWithBiometric`: the stored token of this operator, released by the OS prompt; null when there is none. */
  biometricToken?(operatorId: string): string | null | Promise<string | null>;
  /**
   * `redeemPairingCode` was answered 201: store the device credential. Awaited BEFORE the action
   * settles (MP-6); when it rejects, the action rejects with the same error.
   */
  devicePaired?(redeemed: PairingRedeemed): void | Promise<void>;
  /**
   * The device is no longer paired (its own unpair, a revocation): delete the stored items. Called
   * before the socket is reopened, once for one revocation, and again only as described above.
   */
  deviceUnpaired?(end: LiveSessionEnd): void | Promise<void>;
}

/**
 * What a local end owes the Core (decisions D80, D90): the record the Live source keeps while the
 * Core has not heard that a session ended on this client, and the record an app may keep across a
 * reload. **It holds no credential**: no token, no cookie value. The session is named by what the
 * Core itself says about it in `getAuthSession`.
 */
export interface LiveOwedSignOut {
  /** The operator of the session the debt is for (`AuthSessionInfo.operator.id`). */
  readonly operatorId: string;
  /** When the Core issued that session (`AuthSessionInfo.issuedAt`). With the operator it names one session. */
  readonly issuedAt: EpochMs;
  /**
   * Why the session ended here. `USER`, `LOCK`: the operator asked for it; the same session, when
   * the Core still holds it, is signed out with that reason. `IDLE_EXPIRED`, `ABSOLUTE_EXPIRED`:
   * this client reckoned it while the Core could not be asked; no sign-out is ever sent for it.
   */
  readonly reason: SignOutReason | typeof SessionEndedReason.IDLE_EXPIRED | typeof SessionEndedReason.ABSOLUTE_EXPIRED;
  /** When the session ended here, on the Live clock. */
  readonly at: EpochMs;
}

/**
 * Where an app keeps the debt of a local end across a reload (finding CPC1-24). Optional: without
 * it the debt lives in the source's memory, which is enough where the credential itself is
 * dropped at the local end (a tablet's session token). The web console needs it: its credential
 * stays in the browser, so a page that is loaded again would be signed in again.
 *
 * The source calls `write` at the local end, BEFORE it reports the end. It calls `read` at every
 * first start, before it asks for its session, and settles a debt it finds before it takes any
 * socket. It calls `clear` when the debt is paid or found not to be owed.
 *
 * **What the guarantee costs (finding CPC1-34).** "A reload cannot forget a local Lock" holds
 * only when ALL THREE calls are synchronous: each has done its work when it returns, as with the
 * synchronous key-value storage of a browser. The type allows a promise so that a storage which
 * cannot be synchronous still works, with less:
 *
 * | The storage | A reload right after a Lock | The order of the calls |
 * |-------------|-----------------------------|------------------------|
 * | `read`, `write` and `clear` all return at once | The debt is stored before the end is reported: it cannot be forgotten | The order they were asked in, by construction |
 * | Any of them returns a promise | A reload while `write` is still out FORGETS the debt: the page comes back signed in | The source makes them one after another: a call that was asked for later is made only when the storage has really finished the earlier one. A late `clear` never erases a newer debt, and of two writes the later one stays |
 *
 * **A `read` that fails does not mean "nothing is owed".** `read` returns `null` when nothing is
 * stored, and only then. When the stored value cannot be read (the storage is not available, its
 * text cannot be parsed), `read` must THROW or reject, and must not return `null`. The source
 * then starts closed:
 *
 * | `read` at a start | The session the credential names |
 * |-------------------|----------------------------------|
 * | Returns `null` | Taken, as without a storage |
 * | Returns a debt | Not taken; the debt is settled first (the Core is asked which session the credential names now) |
 * | Throws, rejects, or does not answer in `LIVE_SECRETS_TIMEOUT_MS` | A debt may exist. The Core is asked, and the session it names is NOT taken: the client is signed out, one `error` report (`live.owed`) says why, and a fresh sign-in is required. No sign-out is sent (nothing is known to be owed). When the Core names no session, the client is signed out as usual |
 * | Returns something that is not a `LiveOwedSignOut` | The same as a failed `read`; the value is cleared |
 *
 * Every call is given `LIVE_SECRETS_TIMEOUT_MS`, counted from the moment it was asked for. A
 * storage that throws, rejects or does not answer is reported once (`live.secrets`, by the name
 * of the call and of the error; never its text) and is not asked again: the debt then lives in
 * memory only. What `read` returns is taken only when it has the exact shape of `LiveOwedSignOut`.
 *
 * Not covered by the port: a tab that is already open does not learn of a debt another tab
 * wrote. An app that wants that listens to its storage itself and calls `actions.signOut('LOCK')`.
 */
export interface LiveOwedSignOutPort {
  /** `null` when nothing is stored. Throws or rejects when the stored value cannot be read. */
  read(): LiveOwedSignOut | null | Promise<LiveOwedSignOut | null>;
  /** Stores the debt, replacing an earlier one. Synchronous wherever the storage allows it. */
  write(debt: LiveOwedSignOut): void | Promise<void>;
  /** Removes the stored debt. Synchronous wherever the storage allows it. */
  clear(): void | Promise<void>;
}

export interface CreateLiveSimOptions<Client extends LiveClient = LiveClient> {
  /**
   * The typed client (`createCoreClient`), built by the caller with its base URL, its transport
   * and its credential provider. Every request of the Live source goes through it (D69).
   */
  readonly client: Client;
  /** The one socket of this client (CL-7, CL-8). */
  readonly socket: {
    /** The socket address: the socket scheme, the Core server's host, and the contract's path `/ws`. No query and no credential. */
    readonly url: string;
    /** Defaults to the platform's socket constructor. */
    readonly factory?: LiveSocketFactory;
    /**
     * Mobile: the bearer header of the upgrade. The web console leaves it out.
     *
     * **Synchronous**, and asked whenever a socket is opened: the first time when the source starts
     * (at creation, unless `autoStart` is false). An app that reads its stored values
     * asynchronously loads them BEFORE it creates the source, or passes `autoStart: false` and
     * calls `start()` when they are loaded. If a socket was opened without the session's value all
     * the same, the source asks for a new socket once as soon as it knows the session.
     */
    readonly headers?: LiveSocketHeadersProvider;
    /** Builds the socket client. Defaults to `createLiveSocketClient`. */
    readonly create?: (options: LiveSocketClientOptions) => LiveSocketClient;
  };
  /** Mobile: the app's storage of secrets. */
  readonly secrets?: LiveSecretsPort;
  /** Web: where the debt of a local end is kept across a reload (CPC1-24). Shared by the tabs of one origin. */
  readonly owedSignOut?: LiveOwedSignOutPort;
  /** Mobile: what the redeem request says about the device (MP-5). */
  readonly device?: () => LiveDeviceDescription;
  /** Page or app visibility: the `meters` topic is subscribed only while visible (CL-11b). Default: always visible. */
  readonly visibility?: VisibilityAdapter;
  /** CL-13. Defaults to `shareStructure`; a client may pass the function of its query library (CA-04). */
  readonly structuralSharing?: StructuralSharing;
  /** Receives every report: a rejected action (CL-24), a dropped socket frame, a failed handler. The app writes it to its persistent log. */
  readonly onError?: (report: SimErrorReport) => void;
  /** The local clock. Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Defaults to the global timer functions. */
  readonly timers?: LiveSocketTimers;
  /** Random source of the reconnect jitter. */
  readonly random?: () => number;
  /** True (the default): the bootstrap of §5.1 starts when the source is created. False: it starts with `start()`. */
  readonly autoStart?: boolean;
  /** Default `LIVE_SETTLE_TIMEOUT_MS`. */
  readonly settleTimeoutMs?: number;
  /** Default `LIVE_BOOT_TIMEOUT_MS`. */
  readonly bootTimeoutMs?: number;
  /** Default `LIVE_TOUCH_INTERVAL_MS`. */
  readonly touchIntervalMs?: number;
}

export interface LiveSim<Client extends LiveClient = LiveClient> extends LiveHandle {
  // ── The members of `Sim` ──
  readonly store: LiveStore;
  /** The 47 actions: the names and parameters of the simulator's, each returning a Live result. One stable object. */
  readonly actions: LiveActions;
  /** The server's clock as this client knows it; it never moves backwards. */
  readonly clock: SimClock;
  /** An inert stub: nothing is drawn on a client in Live mode. */
  readonly rng: RngStreams;
  /** `meta.seed` of the replica. */
  readonly seed: number;
  /** Resolves when the bootstrap is over (§5.1), at the latest after the boot time-out. It never rejects. */
  readonly ready: Promise<void>;
  isReady(): boolean;
  /** Always false: nothing is restored from storage in Live mode. */
  wasRestored(): boolean;
  /** Opens the socket, asks for the session and starts the timers. Idempotent. */
  start(): void;
  /**
   * Closes the socket and stops every timer. The store keeps what it holds. Idempotent. An action
   * that is still out is settled inside this call: one the Core already accepted resolves, one
   * without an answer rejects with `LiveTransportError` (`CORE_OFFLINE`, code `STOPPED`). An
   * answer that arrives afterwards changes nothing.
   */
  stop(): void;
  isRunning(): boolean;
  /** No-op: the server runs the engine. */
  tick(): void;
  /** No-op: nothing is persisted. */
  flush(): void;
  /** Alias of `stop()`. */
  destroy(): void;
  /** The last 50 reports. */
  errors(): readonly SimErrorReport[];
  /** Answers 501: the API Reference page calls the Core server itself in Live mode (§11). */
  request(request: SimApiRequest): SimApiResponse;

  // ── `LiveHandle` (the light API) and CL-15 ──
  readonly link: LiveLinkState;
  /** The caller's own session, or null while signed out. Replaced on every change, never edited in place. */
  readonly session: AuthSessionInfo | null;
  /** Why the last session or pairing ended; null when none ended since the source was created. */
  readonly lastSessionEnd: LiveSessionEnd | null;
  /**
   * The typed client that was passed in, seen through the source (decision D84): **the one way a
   * page calls an operation that is no simulator action** (the administration lists and their
   * commands). Its results, errors and timing are the typed client's own; an answered POST of
   * the signed-in operator counts as activity, as an action's does. A page never builds a typed
   * client of its own: a POST sent around this one is not seen by the source.
   */
  readonly client: Client;
  /** The heartbeat view of the one socket (CL-7), for the existing `HeartbeatContext`. Its `start` and `stop` do nothing: the Live source owns the socket. */
  readonly heartbeat: HeartbeatClient;
  /** `stored` and `lineage` of the last `verifyAuditChain`; null before the first one and after a session end. */
  readonly auditChain: LiveAuditChain | null;
  /** The four control messages of the socket, as they arrive (01_specs §9.4). */
  onControl(listener: (message: LiveSocketControlMessage) => void): () => void;
  /**
   * Called once for every end of a session or of the pairing, after the store dropped the Core
   * data. One revocation of the device is one end, however many answers and close codes say so.
   */
  onSessionEnd(listener: (end: LiveSessionEnd) => void): () => void;
  /** RESYNCING and RESYNCED of the socket: for the "Reconnected to the Core" notice (§3.5). */
  onResync(listener: (event: LiveSocketResyncEvent) => void): () => void;
  /**
   * CL-11a: closes the socket and opens a new one at once ("Retry now"; after the app changed a
   * stored credential). `'CREDENTIAL'` also tells the source that the device credential was
   * replaced: an earlier revocation no longer stands in the way of the socket.
   */
  reconnect(reason: LiveSocketReconnectReason): boolean;
  /** The state of the one socket, for a diagnostics view. A new object at every call. */
  socketStatus(): LiveSocketStatus;
  /**
   * Sets the client-built `pairing` slice: the Core identity and the pairing time of this device
   * as the server returned them (`DeviceRegistration`, MP-10), or null for "not paired".
   */
  setPairing(pairing: { readonly core: CoreIdentity; readonly pairedAt: EpochMs } | null): void;
}
