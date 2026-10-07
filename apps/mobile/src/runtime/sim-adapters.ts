/**
 * Platform adapters that feed the shared simulator on React Native (04_mobile_specs §5.2; SCR-01).
 *
 * The simulator core (`@dems/shared/sim`, D19) is reused, not forked: this file only supplies the
 * adapters `createSim` accepts (12_sim_contract §2 "Mobile (step 73)" recipe):
 *
 * | Adapter | Mobile implementation |
 * |---|---|
 * | Snapshot storage | `createJSONStorage(() => AsyncStorage)`: key `dems.sim.v1`, the web key; throttled to 1 s by the engine; the audio, clock and auth slices are excluded by the engine |
 * | Auth record storage | `null` → memory: the operator signs in again after a cold start (§6.4) |
 * | Visibility | `AppState`: `background` / `inactive` pause the engine and flush the snapshot; `active` catches up and resumes |
 * | Hydration gate | the engine's own: `start()` waits for `sim.ready`; the UI waits via `useSimReady()` |
 * | Scheduler | the engine default `setInterval(tick, 50)` (Hermes has it) |
 *
 * **Live mode** (backend task W51; 04_client_integration_spec §2.3, §7.2, §9.1, §9.4; the Live
 * source's brief list, rows 8 to 15). The second half of this file supplies the adapters the
 * shared Live source (`@dems/shared/live/source`) takes on React Native: `createMobileLive`.
 *
 * | Adapter | Mobile implementation |
 * |---|---|
 * | Transport | The typed client (`@dems/shared/client`) on the app's global `fetch`, to `http://127.0.0.1:4420`; `credentials: 'omit'` is the client's own, so no cookie is sent or stored (D69). No other code of the app calls the Core server |
 * | Bearer value | The session token when signed in, else the device credential. The two operations of `DEVICE_CREDENTIAL_OPERATIONS` always carry the device credential (D118) |
 * | Socket | React Native's `WebSocket`, with the bearer header as its third argument (CL-8); no subprotocol |
 * | Credentials | Held IN MEMORY. The stored device credential is read once, at start, through the wrapper `./secure-credentials`; the client's credential provider and the socket's header provider read memory only (D81) |
 * | Secrets port | The session token: memory only. The device credential: memory first, then the wrapper. A value is gone from memory before the port resolves |
 * | Visibility | `AppState`, as for the simulator; coming back to the foreground with a STALE link reconnects at once |
 * | Reports | Every report of the Live source and every failure of the typed client goes to the persistent runtime log. A rejection without an answer of the Core is judged by the link first (R5, `probe-failure.ts`): never an `error` |
 * | Probes | A probe or the keep-alive that timed out is asked once more before its result is handed on (row FX-M1, E2E-T-1): a starved JS thread must not read as an unreachable Core |
 * | Pairing gate | Written to `pairing-gate-snapshot.ts` while the source runs, for `+native-intent` (row FX-M1, E2E-S-4) |
 *
 * **Release builds hold none of it.** The Live source, the typed client and the wrapper are loaded
 * inside a block under a literal `__DEV__` test (MD-6): Metro folds the block away in a release
 * build before it collects a module's dependencies, so `createMobileLive` is then `() => null`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { CORE_SERVER_HTTP_ORIGIN, CORE_SERVER_WS_URL, type PairingRedeemed } from '@dems/shared/api';
import type { CoreClient, CoreClientLogLine, CoreClientReport, CoreFetch } from '@dems/shared/client';
import type { LiveDeviceDescription, LiveSecretsPort, LiveSessionEnd, LiveSim } from '@dems/shared/live/source';
import type { LiveSocketFactory, LiveSocketLike, LiveSocketTimers } from '@dems/shared/realtime';
import {
  createSim,
  SIM_STORAGE_KEY,
  type CreateSimOptions,
  type Sim,
  type SimErrorReport,
  type SimPersistStorage,
  type SimSnapshot,
  type VisibilityAdapter,
} from '@dems/shared/sim';
import { PAIRING_CHECKING, type PairingInfo, type PairingNotice } from './contract';
import { reportRuntimeIssue } from './log';
import { notePairingGate, releasePairingGate } from './pairing-gate-snapshot';
import { PROBE_OPERATIONS, isRecheckable, isUnanswered, judgeLiveRejection, type JudgedReport } from './probe-failure';
import { createCoreClock, registerCoreClock } from './core-clock';
import { createStallTolerantTimers } from './stall-tolerant-timers';

/** The simulator snapshot key (same as the web, 04 §5.3). */
export const SIM_SNAPSHOT_KEY = SIM_STORAGE_KEY;

/** Snapshot storage over AsyncStorage (or any promise-based string store with the same methods). */
export function createAsyncStoragePersistStorage(storage: StateStorage = AsyncStorage): SimPersistStorage {
  const persist = createJSONStorage<SimSnapshot>(() => storage);
  if (!persist) throw new Error('createJSONStorage rejected the AsyncStorage adapter');
  return persist;
}

/** The part of React Native's `AppState` the visibility adapter uses. */
export interface AppStateLike {
  readonly currentState: string | null | undefined;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

/**
 * Hidden = the app is not in the foreground. `background` (Android and iOS) and `inactive` (iOS
 * transitions) count as hidden. `unknown` (a state some platforms report before the first event)
 * counts as visible, so the engine never stalls waiting for an event that already happened; the
 * next `change` event corrects it either way.
 */
export function isHiddenAppState(state: string | null | undefined): boolean {
  return state === 'background' || state === 'inactive';
}

/** The engine's visibility adapter over `AppState` (04 §5.2 "Visibility"). */
export function createAppStateVisibility(appState: AppStateLike = AppState as unknown as AppStateLike): VisibilityAdapter {
  return {
    isHidden: () => isHiddenAppState(appState.currentState),
    subscribe(onChange) {
      const subscription = appState.addEventListener('change', () => onChange());
      return () => subscription.remove();
    },
  };
}

/**
 * A snapshot storage that touches nothing until `allowed` has answered (MD-5). True: every call
 * goes to `inner`, as if this wrapper were not there. False: nothing is ever read or written; a
 * read then never answers, so the simulator that holds this storage never becomes ready, never
 * starts and never writes. `allowed` must not reject.
 *
 * Why it exists: at a cold start of a debug build the stored Core link source is not known yet
 * when the first frame needs a simulator object. If the source turns out to be LIVE, that object
 * is dropped again, and the simulator's stored snapshot must be exactly as it was.
 */
export function createDeferredPersistStorage(inner: SimPersistStorage, allowed: Promise<boolean>): SimPersistStorage {
  const never = new Promise<never>(() => undefined);
  return {
    getItem: (name) => allowed.then((yes) => (yes ? inner.getItem(name) : never)),
    setItem: (name, value) => allowed.then((yes) => (yes ? inner.setItem(name, value) : undefined)),
    removeItem: (name) => allowed.then((yes) => (yes ? inner.removeItem(name) : undefined)),
  };
}

export interface MobileSimOptions extends Omit<CreateSimOptions, 'storage' | 'authStorage' | 'visibility'> {
  /** Default: AsyncStorage. `null`: memory (tests). */
  storage?: SimPersistStorage | null;
  /** Default: `AppState`. */
  visibility?: VisibilityAdapter;
  /**
   * The snapshot storage waits for this answer before its first read (`createDeferredPersistStorage`).
   * Left out: the storage is used at once, as before. Ignored with `storage: null`.
   */
  storageAllowed?: Promise<boolean>;
}

/**
 * The mobile simulator: the shared `createSim` with the adapters above. The operator record is
 * never persisted (`authStorage: null`), so no identity survives a cold start (§6.4).
 */
export function createMobileSim(options: MobileSimOptions = {}): Sim {
  const { storage, visibility, storageAllowed, ...rest } = options;
  const snapshots = storage === undefined ? createAsyncStoragePersistStorage() : storage;
  return createSim({
    ...rest,
    storage: snapshots !== null && storageAllowed ? createDeferredPersistStorage(snapshots, storageAllowed) : snapshots,
    authStorage: null,
    visibility: visibility ?? createAppStateVisibility(),
  });
}

// ---------------------------------------------------------------------------------------------
// Live mode: the adapters of the shared Live source (backend task W51)
// ---------------------------------------------------------------------------------------------

/** The typed client as the app builds it: the contract's own operation table, so a call is type-checked. */
export type MobileCoreClient = CoreClient;
/** The Live source of the app. None of its members returns a credential or a token (MP-3). */
export type MobileLiveSim = LiveSim<MobileCoreClient>;

/**
 * How long a call of the app's secure storage may take inside the secrets port. Below the Live
 * source's own wait (`LIVE_SECRETS_TIMEOUT_MS`, 5,000 ms; a test holds the order), so the port
 * has decided "stored" or "not stored" before the source gives the wait up: a write that lands
 * after the source reported a failure would leave a credential the app says it does not hold.
 */
export const MOBILE_SECRETS_BUDGET_MS = 4_000;

/** Failures of the typed client that are no answer of the contract are logged once per operation and kind in this time. */
export const LIVE_CLIENT_REPORT_INTERVAL_MS = 30_000;

/**
 * Operations the Core server accepts ONLY with the device's own credential as the bearer value,
 * whatever session is open on the device (decision D118, finding F77): the biometric sign-in and
 * the rotation of the device credential. A session token there is answered 403 `DEVICE_NOT_PAIRED`
 * with `details.reason: 'DEVICE_CREDENTIAL_REQUIRED'`. The app calls these through a second typed
 * client whose credential provider knows the device credential only; it never relies on "no
 * session is in memory at the login screen".
 */
export const DEVICE_CREDENTIAL_OPERATIONS: readonly string[] = ['signInWithBiometric', 'rotateDeviceCredential'];

/** MP-5: the device name the registry shows when the platform gives none. */
export const FALLBACK_DEVICE_NAME = 'Android device';
const DEVICE_NAME_MAX = 60;
const APP_VERSION_MAX = 32;

/**
 * What the redeem request says about this device (MP-5): the model name, at most 60 characters,
 * the platform and the app's version. No hardware identifier is read or sent. Pure.
 */
export function liveDeviceDescription(modelName: string | null | undefined, appVersion: string | null | undefined): LiveDeviceDescription {
  const name = typeof modelName === 'string' ? modelName.trim().slice(0, DEVICE_NAME_MAX).trim() : '';
  const version = typeof appVersion === 'string' ? appVersion.trim().slice(0, APP_VERSION_MAX).trim() : '';
  return { deviceName: name === '' ? FALLBACK_DEVICE_NAME : name, platform: 'android', appVersion: version === '' ? 'unknown' : version };
}

type HeaderSocketConstructor = new (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers: Readonly<Record<string, string>> },
) => LiveSocketLike;

/**
 * The socket factory of the app (CL-8): React Native's `WebSocket` takes the headers of the
 * upgrade request as its third argument. No subprotocol is offered: the Core server negotiates
 * none, and a client that offers one cannot connect. The constructor is looked up at each call.
 */
export function createMobileSocketFactory(Socket?: HeaderSocketConstructor): LiveSocketFactory {
  return (url, headers) => {
    const Ctor = Socket ?? (globalThis as unknown as { WebSocket?: HeaderSocketConstructor }).WebSocket;
    if (!Ctor) throw new Error('This runtime has no WebSocket constructor');
    return headers === undefined ? new Ctor(url) : new Ctor(url, null, { headers });
  };
}

/** The pairing notice of an end of the pairing (§6.5): the device was unpaired, or the Core revoked it. */
export function pairingNoticeOf(end: Pick<LiveSessionEnd, 'reason'>): PairingNotice {
  return end.reason === 'UNPAIRED' ? 'unpaired' : 'revoked';
}

/**
 * The biometric token storage of the app, registered by the auth layer (the sign-in row). This
 * file stores no biometric token: it passes the Live source's two questions on.
 */
export interface LiveBiometricPort {
  /** `signInWithBiometric`: the stored token of this operator, released by the OS prompt; `null` when there is none. Not time-bounded. */
  token(operatorId: string): string | null | Promise<string | null>;
  /**
   * A sign-in of this device was answered; `biometricToken` is the rotated token (`null` after a
   * password sign-in). Called after the session token is in memory. What it returns is awaited by
   * the Live source for at most 5 s: no prompt of the operating system inside it.
   */
  sessionIssued?(issued: { readonly biometricToken: string | null; readonly operatorId: string }): void | Promise<void>;
}

export interface MobileLiveOptions {
  /** Tests: the fake transport's `fetch`. Default: the app's global `fetch`, looked up at each call (CL-3). */
  fetch?: CoreFetch;
  /** Tests: the fake transport's socket factory. Default: `createMobileSocketFactory()`. */
  socketFactory?: LiveSocketFactory;
  /** Default: `AppState`. */
  visibility?: VisibilityAdapter;
  /** Called with every report, after it was written to the persistent runtime log. */
  onError?: (report: SimErrorReport) => void;
  /** The local clock; default `Date.now`. A test passes the fake transport's (`fake.clock.now`). */
  now?: () => number;
  /** Default: the global timer functions. A test passes the fake transport's (`fake.clock.timers`). */
  timers?: LiveSocketTimers;
  /** Random source of the reconnect jitter. */
  random?: () => number;
}

/** The app's Live source with its adapters: what `SimRuntimeProvider` mounts in LIVE mode. */
export interface MobileLive {
  /** The Live source: the 30 members of the shared `LiveSim`. */
  readonly live: MobileLiveSim;
  /** The same object as the `Sim` of `SimContext` (the shared `asSim`, the one documented cast). */
  readonly sim: Sim;
  /**
   * MP-10: reads the stored device credential (once per object), then starts the source and asks
   * the Core for this device's registration. Resolves when the source is started; never rejects.
   */
  start(): Promise<void>;
  /** Stops the source: the socket is closed, every timer is cleared. `start()` may follow. */
  stop(): void;
  /** Resolves when the pairing state at start is known (step 1 of MP-10): the runtime's `ready`. Never rejects. */
  readonly ready: Promise<void>;
  isReady(): boolean;
  /** The pairing gate (MP-9). The same object until it changes. */
  getPairing(): PairingInfo;
  /** Calls `listener` after the pairing gate changed. Returns the function that ends the subscription. */
  subscribe(listener: () => void): () => void;
  /** The sign-in row registers the app's biometric token storage here; `null` removes it. */
  setBiometricPort(port: LiveBiometricPort | null): void;
}

const mobileLives = new WeakMap<Sim, MobileLive>();

/** CF-M1 (R-S-2): per Live source of `createMobileLive`, whether its socket client is between a socket it gave up itself and the next one. */
const clientRestarts = new WeakMap<object, () => boolean>();

/**
 * True while the app's own socket client has given a connection up by itself (SYNC_TIMEOUT, SEND_FAILED)
 * and has not opened the next socket yet, for the first restart of a series only. Its OFFLINE then says
 * nothing about the Core: the link is settling (DX-3's rule for an end the Core made, extended to a
 * restart the client made; `ended-link.ts`). `false` for anything else, a simulator or a missing source.
 */
export function isClientRestart(live: unknown): boolean {
  if (typeof live !== 'object' || live === null) return false;
  try {
    return clientRestarts.get(live)?.() ?? false;
  } catch {
    return false;
  }
}

/** Jest runs with `__DEV__`; the request lines stay out of test output. */
const IN_JEST = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

/** The app's Live source behind a `Sim` of `SimContext`, or `null`: a simulator, or a Live source built elsewhere. */
export function mobileLiveOf(sim: Sim): MobileLive | null {
  return mobileLives.get(sim) ?? null;
}

/**
 * Reports of the Live source → the persistent runtime log. An envelope code travels as `errorCode`:
 * the log drops a member named `code`. `judged` (R5, `judgeLiveRejection`) replaces the level and the
 * message of a rejection without an answer of the Core, and adds how the link read.
 */
export function logLiveReport(report: SimErrorReport, judged: JudgedReport | null = null): void {
  const code = report.context?.code;
  const base = typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? { ...report.context, errorCode: code } : report.context;
  const context = judged ? { ...base, ...judged.context } : base;
  const message = judged ? judged.message : report.message;
  reportRuntimeIssue(judged ? judged.level : report.level, report.source, Object.assign(new Error(message), report.stack ? { stack: report.stack } : {}), context);
}

const DEFAULT_LIVE_TIMERS: LiveSocketTimers = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** How a storage call that missed its budget ended, once it ended (W93-16): for the late-outcome log record. */
export interface LateOutcome<T> {
  readonly value: T | null;
  /** From the call to its settling, on the source's clock (ms). */
  readonly elapsedMs: number;
}

/**
 * What `task()` resolved with, or `null` when it threw, rejected or has not settled after
 * `budgetMs` (`late`). Never rejects. A throw or a rejection is logged under `source` by the name
 * of the error only: its text is the storage's own and is not passed on.
 *
 * Post-review fix FXR-M (finding W93-16; D203 risk 1): the budget is judged on the source's stall-tolerant
 * timers, and `elapsedAtBudgetMs` says how much clock time had really passed when it ran out (a starved JS
 * thread fires it late). A task that settles AFTER the budget is no longer forgotten: `onLate` hears how it
 * ended and after how long, so a slow keystore write can be told from a starved thread (W98 sizes the budget
 * from these records) and a write that landed after the failure was reported can be undone.
 */
function withinBudget<T>(
  task: () => T | Promise<T>,
  budgetMs: number,
  timers: LiveSocketTimers,
  source: string,
  now: () => number = Date.now,
  onLate?: (outcome: LateOutcome<T>) => void,
): Promise<{ value: T | null; late: boolean; elapsedAtBudgetMs: number | null }> {
  const startedAt = now();
  return new Promise((resolve) => {
    let open = true;
    const handle = timers.setTimeout(() => {
      if (!open) return;
      open = false;
      resolve({ value: null, late: true, elapsedAtBudgetMs: Math.max(0, now() - startedAt) });
    }, budgetMs);
    const settle = (value: T | null): void => {
      if (!open) {
        try {
          onLate?.({ value, elapsedMs: Math.max(0, now() - startedAt) });
        } catch (error) {
          reportRuntimeIssue('error', source, error, { phase: 'lateOutcome' });
        }
        return;
      }
      open = false;
      timers.clearTimeout(handle);
      resolve({ value, late: false, elapsedAtBudgetMs: null });
    };
    const failed = (error: unknown): void => {
      reportRuntimeIssue('error', source, 'A storage call of the Live source failed', { errorName: error instanceof Error ? error.name : typeof error });
      settle(null);
    };
    try {
      Promise.resolve(task()).then(settle, failed);
    } catch (error) {
      failed(error);
    }
  });
}

/** The budget ran out at `elapsedAtBudgetMs` of clock time: how far its timer fired late (a starved thread), ms. */
function budgetLateness(elapsedAtBudgetMs: number | null, budgetMs: number): number {
  return elapsedAtBudgetMs === null ? 0 : Math.max(0, elapsedAtBudgetMs - budgetMs);
}

/** A typed-client time-out whose timer fired this much later than its budget was the JS thread, not the network (ms). */
export const COMMAND_TIMEOUT_STARVED_MS = 1_000;

/**
 * The app's Live source (MD-5: created only when the Core link source is LIVE). Nothing is sent
 * and no socket is opened until `start()`. Returns `null` in a release build (MD-6): the block
 * below, with the three modules it loads, is not part of a release bundle.
 */
export function createMobileLive(options: MobileLiveOptions = {}): MobileLive | null {
  if (__DEV__) {
    /* eslint-disable @typescript-eslint/no-require-imports -- the three modules must stay inside the __DEV__ block (MD-6) */
    const { LIVE_DEVICE_CLEANUP_GAVE_UP_CODE, asSim, createLiveSim } = require('@dems/shared/live/source') as typeof import('@dems/shared/live/source');
    const { LIVE_COMMAND_TIMEOUT_MS, createCoreClient } = require('@dems/shared/client') as typeof import('@dems/shared/client');
    const store = require('./secure-credentials') as typeof import('./secure-credentials');
    const Device = require('expo-device') as typeof import('expo-device');
    const Constants = (require('expo-constants') as typeof import('expo-constants')).default;
    /* eslint-enable @typescript-eslint/no-require-imports */

    const now = options.now ?? (() => Date.now());
    // CF-M1 (R-P-2, R-S-2): every timer of the Live source (the socket client's housekeeping and
    // reconnects, the command gate, the source's own deadlines, the storage budgets) lets the JS queue go
    // first when it fires late after a stall, so a deadline is judged on what has really arrived
    // (`stall-tolerant-timers.ts`).
    const timers = createStallTolerantTimers(options.timers ?? DEFAULT_LIVE_TIMERS, now);
    const visibility = options.visibility ?? createAppStateVisibility();

    // ── Memory: the only place a request or a socket reads a credential from (D81). ──
    const memory: { device: PairingRedeemed | null; session: string | null } = { device: null, session: null };
    const bearer = (): string | null => memory.session ?? memory.device?.deviceCredential ?? null;
    /** The bearer of an operation of `DEVICE_CREDENTIAL_OPERATIONS`: never the session token. */
    const deviceBearer = (): string | null => memory.device?.deviceCredential ?? null;

    let pairing: PairingInfo = PAIRING_CHECKING;
    const listeners = new Set<() => void>();
    /** This source's entry in the gate snapshot of `+native-intent` (E2E-S-4). */
    const gateOwner = {};
    const setPairing = (state: 'UNPAIRED' | 'PAIRED', notice: PairingNotice | null, deviceId: string | null): void => {
      if (pairing.state === state && pairing.notice === notice && pairing.deviceId === deviceId) return;
      pairing = { required: true, state, notice, deviceId };
      if (wanted) notePairingGate(gateOwner, pairing);
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          reportRuntimeIssue('error', 'runtime.live.pairingListener', error);
        }
      }
    };

    /**
     * CF-M1 (R-S-2): the connection the socket client gave up BY ITSELF (SYNC_TIMEOUT: `hello` or a snapshot
     * did not come in time; SEND_FAILED), or `null`. Between that and the client's next socket the link reads
     * OFFLINE although nothing was heard from the Core about it; `isClientRestart` reads it as a transient.
     */
    let selfRestart: number | null = null;

    let biometric: LiveBiometricPort | null = null;
    /**
     * Operation 21 is still to be asked for the credential in memory: it was never asked, or the
     * question got no answer. An answer of any status ends it (the app does not ask again by itself).
     */
    let unconfirmed = true;
    let confirming = false;
    let wanted = false;
    let loaded = false;

    // ── The typed client's reports: one per operation and kind in LIVE_CLIENT_REPORT_INTERVAL_MS. ──
    const reported = new Map<string, { at: number; skipped: number }>();
    const reportClientFailure = (report: CoreClientReport): void => {
      // R5: a probe that timed out is asked again before anything is declared (`call` below); its
      // first time-out is a note, and the re-check's own outcome is what the log judges.
      const probeTimeout = report.kind === 'TIMEOUT' && PROBE_OPERATIONS.has(report.operationId);
      const key = `${report.operationId}|${report.kind}`;
      const at = now();
      const last = reported.get(key);
      if (last !== undefined && at >= last.at && at - last.at < LIVE_CLIENT_REPORT_INTERVAL_MS) {
        last.skipped += 1;
        return;
      }
      reported.set(key, { at, skipped: 0 });
      reportRuntimeIssue(probeTimeout ? 'info' : report.level, 'live.client', report.message, {
        ...(probeTimeout ? { probe: true } : {}),
        operationId: report.operationId,
        method: report.method,
        path: report.path,
        kind: report.kind,
        status: report.status,
        requestId: report.requestId,
        skippedBefore: last?.skipped ?? 0,
      });
    };

    const transport = {
      baseUrl: CORE_SERVER_HTTP_ORIGIN,
      ...(options.fetch ? { fetch: options.fetch } : {}),
      now,
      report: reportClientFailure,
      // CL-6a: method, path template, status and request ID. Development console only, never the persistent log.
      // The literal `__DEV__` makes "development only" true by construction (row PT, W100-5).
      log: (line: CoreClientLogLine): void => {
        if (__DEV__ && !IN_JEST) console.info(`[DEMS-LIVE] ${line.method} ${line.path} ${line.status ?? '-'} ${line.requestId ?? '-'}`);
      },
    };
    // The typed client has one credential provider per instance. Two instances, one choice per
    // operation: the session token when signed in, except where the Core wants the device itself.
    const sessionClient = createCoreClient({ ...transport, credentials: bearer });
    const deviceClient = createCoreClient({ ...transport, credentials: deviceBearer });
    type LooseResult = { readonly ok: boolean; readonly kind?: unknown; readonly status?: number | null };
    type LooseClient = { call(operationId: string, input?: unknown): Promise<LooseResult> };
    /** Probe attempts in a row without an answer, per operation (R5: the consecutive count of `judgeLiveRejection`). */
    const probeFailures = new Map<string, number>();
    const noteProbe = (operationId: string, result: LooseResult): void => {
      if (!PROBE_OPERATIONS.has(operationId)) return;
      probeFailures.set(operationId, isUnanswered(result) ? (probeFailures.get(operationId) ?? 0) + 1 : 0);
    };
    const client: MobileCoreClient = {
      operationIds: sessionClient.operationIds,
      describe: (operationId) => sessionClient.describe(operationId),
      // Same operations, same checks, same answers: only the instance, and with it the bearer value, is
      // chosen here. One addition (R5, row FX-M1): a probe whose attempt ran out of time is asked once
      // more, and the second answer is the one handed on. The client's budget is a wall-clock timer, so
      // a JS thread starved past it (E2E-T-1: the Core answered in 28 ms, the 8 s ran out) reads as "no
      // answer"; by the re-check the thread has caught up, so its answer measures the network.
      call: (async (operationId: string, input?: unknown) => {
        const chosen = (DEVICE_CREDENTIAL_OPERATIONS.includes(operationId) ? deviceClient : sessionClient) as unknown as LooseClient;
        const calledAt = now();
        const first = await chosen.call(operationId, input);
        if (!isRecheckable(operationId, first)) {
          noteProbe(operationId, first);
          // W93-15 (FXR-M; D203 risk 3): a COMMAND is never sent again (it may have been applied). Its
          // time-out is measured instead: the typed client's budget is a wall-clock timer, so when it fired
          // much later than LIVE_COMMAND_TIMEOUT_MS the JS thread was starved and the time-out says nothing
          // about the network. One info record per time-out (DX-5: an unanswered action is never an error).
          if (!first.ok && first.kind === 'TIMEOUT' && !PROBE_OPERATIONS.has(operationId)) {
            const elapsedMs = Math.max(0, now() - calledAt);
            const timerLateMs = Math.max(0, elapsedMs - LIVE_COMMAND_TIMEOUT_MS);
            reportRuntimeIssue('info', 'live.client.commandTimeout', 'A command got no answer within its budget; it is not sent again', {
              operationId,
              elapsedMs,
              budgetMs: LIVE_COMMAND_TIMEOUT_MS,
              timerLateMs,
              verdict: timerLateMs > COMMAND_TIMEOUT_STARVED_MS ? 'js-starved' : 'no-answer',
            });
          }
          return first;
        }
        const startedAt = now();
        const second = await chosen.call(operationId, input);
        noteProbe(operationId, second);
        reportRuntimeIssue(
          second.ok || !isUnanswered(second) ? 'info' : 'warn',
          'live.client.recheck',
          second.ok || !isUnanswered(second)
            ? 'A probe ran out of time and its re-check was answered: the time-out was not the network'
            : 'A probe got no answer, and its re-check none either',
          { operationId, recheckMs: Math.max(0, now() - startedAt), status: second.status ?? null, failuresInARow: probeFailures.get(operationId) ?? 0 },
        );
        return second;
      }) as MobileCoreClient['call'],
    };

    /** Deletes the three stored items within the budget. The wrapper logs its own failure by code. */
    const removeStored = async (): Promise<void> => {
      const removed = await withinBudget(() => store.deleteDeviceCredential(), MOBILE_SECRETS_BUDGET_MS, timers, 'runtime.live.credentials.delete', now);
      if (removed.late) {
        reportRuntimeIssue('error', 'runtime.live.credentials.delete', 'The stored device credential was not deleted in time', {
          budgetMs: MOBILE_SECRETS_BUDGET_MS,
          elapsedAtBudgetMs: removed.elapsedAtBudgetMs,
          budgetFiredLateMs: budgetLateness(removed.elapsedAtBudgetMs, MOBILE_SECRETS_BUDGET_MS),
        });
      }
    };

    /** The device is no longer paired: memory first, then the store, then a socket without the credential. */
    const forget = async (notice: PairingNotice): Promise<void> => {
      memory.session = null;
      memory.device = null;
      setPairing('UNPAIRED', notice, null);
      live.setPairing(null);
      await removeStored();
      live.reconnect('CREDENTIAL');
    };

    /**
     * §9.4, "failed, error form": the Core registered this device and the tablet could not keep
     * the credential. One unpair with it, so that no unusable registration is left behind; then
     * it is forgotten whatever the answer was.
     */
    const abandonRegistration = async (redeemed: PairingRedeemed): Promise<void> => {
      try {
        const answer = await live.client.call('unpairDevice');
        if (!answer.ok) {
          reportRuntimeIssue('error', 'runtime.live.credentials.abandon', 'The registration of a credential that could not be stored was not removed', {
            deviceId: redeemed.deviceId,
            status: answer.status,
            requestId: answer.requestId,
          });
        }
      } catch (error) {
        reportRuntimeIssue('error', 'runtime.live.credentials.abandon', error, { deviceId: redeemed.deviceId });
      } finally {
        if (memory.device === redeemed) memory.device = null;
        // A write that landed after the budget leaves nothing behind either.
        await removeStored();
      }
    };

    const secrets: LiveSecretsPort = {
      sessionIssued: async (issued) => {
        // In memory before anything is awaited: the socket that is reopened next presents it.
        memory.session = issued.sessionToken;
        const port = biometric;
        if (!port?.sessionIssued) return;
        // The sign-in succeeded whatever the biometric storage does (MB-6: a failed write of the
        // rotated token costs the enrolment, not the session). So this never rejects, and it is
        // over inside the Live source's own wait.
        const stored = await withinBudget(
          () => port.sessionIssued?.({ biometricToken: issued.biometricToken, operatorId: issued.operatorId }),
          MOBILE_SECRETS_BUDGET_MS,
          timers,
          'runtime.live.biometricPort',
          now,
        );
        if (stored.late) {
          reportRuntimeIssue('error', 'runtime.live.biometricPort', 'The biometric storage did not answer in time; the session is kept', {
            budgetMs: MOBILE_SECRETS_BUDGET_MS,
            elapsedAtBudgetMs: stored.elapsedAtBudgetMs,
            budgetFiredLateMs: budgetLateness(stored.elapsedAtBudgetMs, MOBILE_SECRETS_BUDGET_MS),
          });
        }
      },
      sessionCleared: () => {
        memory.session = null;
      },
      biometricToken: (operatorId) => biometric?.token(operatorId) ?? null,
      devicePaired: async (redeemed) => {
        const written = await withinBudget(
          () => store.writeDeviceCredential(redeemed),
          MOBILE_SECRETS_BUDGET_MS,
          timers,
          'runtime.live.credentials.write',
          now,
          // W93-16: the late write's own outcome. A write that landed after the failure was reported (the
          // registration is being abandoned) is removed again, so no credential stays that the app says it
          // does not hold. Never the value: the outcome, the time, and the device ID only.
          (late) => {
            const ok = late.value !== null && late.value.ok;
            reportRuntimeIssue(ok ? 'warn' : 'info', 'runtime.live.credentials.lateWrite', 'The device credential write finished after its budget', {
              late: true,
              ok,
              elapsedMs: late.elapsedMs,
              budgetMs: MOBILE_SECRETS_BUDGET_MS,
              deviceId: redeemed.deviceId,
            });
            if (ok && memory.device !== redeemed) void removeStored();
          },
        );
        if (written.late) {
          reportRuntimeIssue('error', 'runtime.live.credentials.write', 'The device credential was not stored in time', {
            budgetMs: MOBILE_SECRETS_BUDGET_MS,
            elapsedAtBudgetMs: written.elapsedAtBudgetMs,
            budgetFiredLateMs: budgetLateness(written.elapsedAtBudgetMs, MOBILE_SECRETS_BUDGET_MS),
          });
        }
        if (written.value === null || !written.value.ok) {
          // The one request of `abandonRegistration` presents the credential; nothing else does.
          memory.device = redeemed;
          void abandonRegistration(redeemed);
          // The Live source reports the port's name and this error's name only, and the action
          // rejects with `CoreRefusalError` (`NOT_AVAILABLE`).
          throw new Error('The device credential could not be stored');
        }
        memory.device = redeemed;
        // The redeem answer is the Core's own word about this credential: nothing more to ask.
        unconfirmed = false;
        setPairing('PAIRED', null, redeemed.deviceId);
      },
      deviceUnpaired: async (end) => {
        // Gone from memory before anything is awaited: the socket that is reopened presents nothing.
        memory.session = null;
        memory.device = null;
        setPairing('UNPAIRED', pairingNoticeOf(end), null);
        await removeStored();
      },
    };

    const live: MobileLiveSim = createLiveSim({
      client,
      socket: {
        url: CORE_SERVER_WS_URL,
        factory: options.socketFactory ?? createMobileSocketFactory(),
        // Synchronous, from memory, asked whenever a socket is opened.
        headers: () => {
          const value = bearer();
          return value === null ? null : { Authorization: `Bearer ${value}` };
        },
      },
      secrets,
      device: () => liveDeviceDescription(Device.modelName, Constants.expoConfig?.version),
      visibility,
      now,
      timers,
      ...(options.random ? { random: options.random } : {}),
      // Started by `start()`, after the stored credential is in memory (brief row 8).
      autoStart: false,
      onError: (report) => {
        // Before the socket client gives the connection up (it reports first, then abandons it).
        if (report.source === 'live.socket' && (report.context?.code === 'SYNC_TIMEOUT' || report.context?.code === 'SEND_FAILED')) {
          const connection = Number(report.context?.connection);
          selfRestart = Number.isInteger(connection) ? connection : null;
        }
        logLiveReport(report, judgeLiveRejection(report, (operationId) => probeFailures.get(operationId) ?? 0));
        try {
          options.onError?.(report);
        } catch (error) {
          reportRuntimeIssue('error', 'runtime.live.onError', error);
        }
        // Brief row 14: the source asked three times and the reopened socket still presented the
        // old credential. Forget it here, then say so: `reconnect('CREDENTIAL')`.
        if (report.source === 'live.secrets' && report.context?.code === LIVE_DEVICE_CLEANUP_GAVE_UP_CODE) void forget('revoked');
      },
    });

    /**
     * MP-10 step 2: asks the Core for this device's registration. 200: confirmed, the `pairing`
     * slice and the device ID are the server's. 401: the Core does not know the credential; it is
     * deleted (notice `unknown`). 403 `DEVICE_REVOKED`: the Live source has ended the pairing
     * through `live.client` and called `deviceUnpaired`. No answer: the device stays PAIRED.
     */
    const confirmRegistration = async (): Promise<void> => {
      const asked = memory.device;
      if (confirming || asked === null) return;
      confirming = true;
      try {
        const answer = await live.client.call('getDeviceRegistration');
        // Unpaired, revoked or paired anew while the question was out: the answer is about another credential.
        if (memory.device !== asked) return;
        // No answer at all: asked again when the link is up. Any answer: not asked again by itself.
        unconfirmed = answer.status === null;
        if (answer.ok) {
          live.setPairing({ core: answer.data.core, pairedAt: answer.data.pairedAt });
          setPairing('PAIRED', null, answer.data.deviceId);
        } else if (answer.status === 401) {
          reportRuntimeIssue('warn', 'runtime.live.registration', 'The Core does not know the stored device credential; it is deleted', {
            status: answer.status,
            errorCode: answer.error.code,
            requestId: answer.requestId,
          });
          await forget('unknown');
        } else if (answer.status !== null) {
          // Another refusal (a 403, a 429, a 5xx). A 403 `DEVICE_REVOKED` has ended the pairing
          // through the Live source by now; anything else leaves the device PAIRED.
          reportRuntimeIssue('warn', 'runtime.live.registration', 'The registration of this device was not confirmed', {
            status: answer.status,
            errorCode: answer.error.code,
            requestId: answer.requestId,
          });
        }
      } catch (error) {
        reportRuntimeIssue('error', 'runtime.live.registration', error);
      } finally {
        confirming = false;
      }
    };

    // Close 4401 with nobody signed in: the Core refused the device credential of the socket
    // (MP-10). The Live source does not retry by itself; operation 21 decides whether it is deleted.
    live.onSessionEnd((end) => {
      if (end.kind === 'SESSION_ENDED' && !end.wasSignedIn && memory.session === null && memory.device !== null) {
        unconfirmed = true;
        void confirmRegistration();
      }
    });
    // The link is up and the registration was never confirmed (the Core was unreachable at start).
    live.onLiveChange(() => {
      if (wanted && live.link === 'ONLINE' && unconfirmed && memory.device !== null) void confirmRegistration();
    });

    /**
     * MP-10 step 1: the stored device credential, read ONCE per object, at the first `start()`,
     * outside every request path. Afterwards memory is the only source of a credential.
     */
    let loading: Promise<void> | null = null;
    let markReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    const load = (): Promise<void> => {
      loading ??= (async () => {
        const read = await withinBudget(() => store.readDeviceCredential(), MOBILE_SECRETS_BUDGET_MS, timers, 'runtime.live.credentials.read');
        if (read.late) {
          reportRuntimeIssue('error', 'runtime.live.credentials.read', 'The stored device credential was not read in time; the device counts as unpaired');
        }
        // A failed or unreadable item counts as absent (MP-4); the wrapper has logged it by code.
        const stored = read.value !== null && read.value.ok ? read.value.value : null;
        if (memory.device === null && stored !== null) memory.device = stored;
        loaded = true;
        if (memory.device !== null) setPairing('PAIRED', null, memory.device.deviceId);
        else setPairing('UNPAIRED', null, null);
        markReady();
      })();
      return loading;
    };

    let unwatch: (() => void) | null = null;
    const mobile: MobileLive = {
      live,
      sim: asSim(live),
      async start() {
        wanted = true;
        notePairingGate(gateOwner, pairing);
        await load();
        if (!wanted) return;
        if (memory.device !== null) live.setPairing({ core: memory.device.core, pairedAt: memory.device.pairedAt });
        live.start();
        // Brief row 15: back in the foreground with a STALE link, reconnect at once.
        unwatch ??= visibility.subscribe(() => {
          if (wanted && !visibility.isHidden() && live.link === 'STALE') live.reconnect('RETRY');
        });
        if (memory.device !== null && unconfirmed) void confirmRegistration();
      },
      stop() {
        wanted = false;
        releasePairingGate(gateOwner);
        unwatch?.();
        unwatch = null;
        live.stop();
      },
      ready,
      isReady: () => loaded,
      getPairing: () => pairing,
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      setBiometricPort(port) {
        biometric = port;
      },
    };
    mobileLives.set(mobile.sim, mobile);
    // CF2-A (RF-PH-1): the clock a running display re-reads (the monitor timer), on the PLAIN timers: the
    // Live clock corrected for samples the busy JS thread handled late (`core-clock.ts`). It takes a
    // reading at every publication of the store's clock, so it knows the offset from before a stall.
    const coreClock = createCoreClock(() => live.clock.now(), now, options.timers ?? DEFAULT_LIVE_TIMERS);
    registerCoreClock(mobile.sim, coreClock);
    live.store.subscribe(
      (state) => state.clock.now,
      () => coreClock.sample(),
    );
    clientRestarts.set(live, () => {
      if (selfRestart === null || live.link !== 'OFFLINE') return false;
      // Only between the given-up socket and the next one, and only the first restart of a series: a Core
      // that keeps not answering (the next socket also times out) shows the notice as before.
      return live.socketStatus().connection === selfRestart && live.heartbeat.getSnapshot().reconnectAttempt <= 1;
    });
    return mobile;
  }
  return null;
}

