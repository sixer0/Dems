/**
 * The no-device notices of the Core (task 3 blueprint row 133; specs R-10; contract C3 §2.6
 * "Search trigger", §3.1, §5.4; capture spec §A.1.1). A CLOSED UNIT: other units import this index
 * and nothing deeper (`test/static/imports.test.ts`).
 *
 * WHAT IT OWNS
 *   - the NOTIFIER (`notifier.ts`): the one place that raises and resolves the alerts of the three
 *     no-device situations, through the engine's INTERNAL warning actions;
 *   - the REACHABILITY PROBE seam and its adapter form (`probe.ts`);
 *   - the PRE-CHECK GATE (`precheck.ts`): what a pre-check run asks and writes before the hosted
 *     action, and the one search of a run under its own allowance.
 *
 * HOW THE REST OF THE SERVER REACHES IT: `captureNotices(app)`, one object per app (the
 * `captureConfigControl(app)` idiom, keyed by the app's stage registry). It is built on first use
 * from the app's seams and needs no plugin of its own, so `app.ts` is not touched:
 *
 *   who                                   calls
 *   the sessions routes (28, 29, 25)      `captureNotices(app).beforePrecheck(...)` before the hosted pre-check
 *   the discovery module (row 132)        `captureNotices(app).notifier.searchClosed(...)` when a camera search closed
 *   the session start (row 139)           nobody calls: this unit LISTENS to `sessionCapture(app).on(...)` (`session-start.ts`).
 *                                         The listener is attached AT BOOT by this unit's own registration,
 *                                         `registerCaptureNotices(app)` (an `onReady` hook; integration pass D8) - never at a
 *                                         first use; `watchSessionStarts` attaches it by hand (a test, another source)
 *   the capture-inputs module             `registerCaptureNotices(app)` in its plugin function: the module of this unit's
 *                                         own operation is where this unit is registered (`app.ts` is frozen, P25)
 *   the capture-inputs module (op 97)     `captureNotices(app).probe()`, `notifier.devicePresence`
 *   the wiring of the adapters            `provideProbeSource(...)`, made by `registerCaptureNotices` from the
 *                                         capture fence's `probeAdapters()` (pass D9); a test: `provideProbe(...)`;
 *                                         row 132: `provideDiscovery(...)`
 *
 * UNTIL A PROBE IS PROVIDED nothing is asked: a pre-check run is exactly the predecessor's (the
 * `SIMULATED` operation registers no adapter). Until a discovery service is provided a pre-check
 * raises its camera alerts without a search count.
 *
 * ERRORS. Nothing here throws into a search, a pre-check or a session start. A failure is written
 * to the log and to the persistent error log with its code and the IDs it concerns (a device ID, a
 * session ID, a search ID): never a label, an address or anything a caller sent.
 */
import type { FastifyInstance } from 'fastify';
import { sessionCapture } from '../capture-session';
import { captureFenceControl } from '../capture/fence';
import type { Principal } from '../plugins/authenticate';
import { describeError } from '../plugins/logger';
import { createNoDeviceNotifier, type NoDeviceNotifier, type NoticeEngine, type NoticeReport } from './notifier';
import { createPrecheckGate, type PrecheckGateOutcome, type PrecheckGateState, type PrecheckRun, type PrecheckSearchSeam } from './precheck';
import { probeOfAdapters, type CaptureReachabilityProbe } from './probe';
import { createSessionStartWatch, type SessionStartSource, type SessionStartState } from './session-start';

export { NoticeReportCode, createNoDeviceNotifier, type ClosedSearch, type NoDeviceNotifier, type NoDeviceNotifierOptions, type NoticeEngine, type NoticeReport, type UnreachableDevice } from './notifier';
export {
  PrecheckReportCode,
  createPrecheckGate,
  type PrecheckGate,
  type PrecheckGateOptions,
  type PrecheckGateOutcome,
  type PrecheckGateState,
  type PrecheckRun,
  type PrecheckSearchOwner,
  type PrecheckSearchSeam,
} from './precheck';
export {
  CAPTURE_PRECHECK_PROBE_TIMEOUT_MS,
  causeOfProbeError,
  probeOfAdapters,
  type AdapterProbeOptions,
  type CaptureReachabilityProbe,
  type DeviceReading,
  type InputReading,
  type MicrophoneReading,
} from './probe';

export {
  NO_CAMERA_CONNECTED,
  SessionStartReportCode,
  createSessionStartWatch,
  type SessionStartEvent,
  type SessionStartSource,
  type SessionStartState,
  type SessionStartWatch,
  type SessionStartWatchOptions,
} from './session-start';

/** The no-device notices of one app. */
export interface CaptureNotices {
  readonly notifier: NoDeviceNotifier;
  /** The gate of a pre-check run. Never rejects: a run is not failed by what the gate could not do. */
  beforePrecheck(run: PrecheckRun): Promise<PrecheckGateOutcome>;
  /**
   * The same for a route: the operator session that started the pre-check is read HERE from the
   * request's principal (its IDs, never a credential), so the calling module hands the request on
   * as it is. A request of no operator asks nothing.
   */
  beforePrecheckOf(request: { readonly principal: Principal }, sessionId: string, kind: PrecheckRun['kind']): Promise<PrecheckGateOutcome>;
  /** The probe of the adapters, or null while none is provided. */
  probe(): CaptureReachabilityProbe | null;
  /** Called once by the wiring that builds the adapters of the running capture operation. A second call throws. */
  provideProbe(probe: CaptureReachabilityProbe): void;
  /**
   * Where the probe comes from when nobody PROVIDES one (integration pass D9, item 5): asked at
   * each use until it answers a probe - the adapters of the running operation exist only after
   * the boot step of the capture fence - and the answer is then kept. A provided probe wins.
   */
  provideProbeSource(source: () => CaptureReachabilityProbe | null): void;
  /** Called once by the discovery module. A second call throws. */
  provideDiscovery(discovery: PrecheckSearchSeam): void;
  /**
   * Situation C (row 139): listens to the capture of sessions (`sessionCapture(app)`), read-only.
   * Attached once per source; a second call with the same source changes nothing. Returns the
   * function that removes the listener.
   */
  watchSessionStarts(source: SessionStartSource): () => void;
  /** Resolves when no session-start event is being handled. For a test and for a shutdown. */
  idle(): Promise<void>;
}

/** What `captureNotices` needs of the app: its seams, read at every call. */
export type CaptureNoticesApp = Pick<FastifyInstance, 'stages' | 'seams' | 'log' | 'errorLog'> & { readonly engine: NoticeEngine & { state(): PrecheckGateState & SessionStartState } };

const FAILED = 'a no-device notice could not be written';
const GATE_FAILED = 'the pre-check gate could not finish';
const WATCH_FAILED = 'the session-start notices could not be attached to the capture session';
const WATCH_NOT_ATTACHED = 'CAPTURE_SESSION_START_WATCH_NOT_ATTACHED';
const NOT_ASKED: PrecheckGateOutcome = Object.freeze({ asked: false, unreachable: Object.freeze([]), search: 'NOT_NEEDED', settled: Promise.resolve() });

// Keyed by the app's stage registry: one object per app, the same from every scope of it.
const instances = new WeakMap<object, CaptureNotices>();
/** Apps whose capture-session unit this unit listens to already (or could not be listened to: said once). */
const listening = new WeakSet<object>();

/**
 * Situation C (row 139). An app that holds the capture seam is the Core's own (a test's stand-in
 * app has none): its capture-session unit is the source of the session-start events. Called by
 * the boot registration below, once the app is ready. Reading `sessionCapture(app)` builds that
 * unit's object and starts nothing.
 */
function listenToSessionStarts(app: CaptureNoticesApp, notices: CaptureNotices): void {
  if (listening.has(app.stages) || !app.seams.has('capture')) return;
  listening.add(app.stages);
  try {
    notices.watchSessionStarts(sessionCapture(app as unknown as FastifyInstance));
  } catch (err) {
    app.log.error({ err, code: WATCH_NOT_ATTACHED }, WATCH_FAILED);
    app.errorLog.append({ level: 'error', source: 'captureNotices.watchSessionStarts', message: WATCH_FAILED, ...describeError(err), code: WATCH_NOT_ATTACHED, context: {} });
  }
}

export function captureNotices(app: CaptureNoticesApp): CaptureNotices {
  const known = instances.get(app.stages);
  if (known !== undefined) return known;

  let probe: CaptureReachabilityProbe | null = null;
  /** Where the probe of the running operation comes from while none was provided (`provideProbeSource`). */
  let probeSource: (() => CaptureReachabilityProbe | null) | null = null;
  /** The probe the source answered: asked until it answers one, then kept (one adapter set per boot). */
  let adopted: CaptureReachabilityProbe | null = null;
  const probeNow = (): CaptureReachabilityProbe | null => {
    if (probe !== null) return probe;
    if (adopted === null && probeSource !== null) {
      try {
        adopted = probeSource();
      } catch (err) {
        // A source that fails is no probe: the pre-check asks nothing and operation 97 answers 503 by name.
        report({ source: 'captureNotices.probe', code: 'CAPTURE_PROBE_SOURCE_FAILED', deviceId: null, sessionId: null, searchId: null, err });
      }
    }
    return adopted;
  };
  let discovery: PrecheckSearchSeam | null = null;
  const report = (failure: NoticeReport): void => {
    const context = { deviceId: failure.deviceId, sessionId: failure.sessionId, searchId: failure.searchId };
    app.log.error({ err: failure.err, code: failure.code, ...context }, FAILED);
    app.errorLog.append({ level: 'error', source: failure.source, message: FAILED, ...describeError(failure.err), code: failure.code, context });
  };
  const engine = (): (NoticeEngine & { state(): PrecheckGateState & SessionStartState }) | null => (app.seams.has('engine') ? app.engine : null);
  const notifier = createNoDeviceNotifier({ engine, report });
  const gate = createPrecheckGate({
    state: () => {
      try {
        return engine()?.state() ?? null;
      } catch {
        // The engine is not running: the hosted action answers 503 itself.
        return null;
      }
    },
    notifier,
    probe: probeNow,
    discovery: () => discovery,
    report,
  });

  // The engine throws while it is not running: the watch reports that itself.
  const sessionStarts = createSessionStartWatch({ notifier, state: () => engine()?.state() ?? null, report });
  const watched = new WeakMap<object, () => void>();
  /** Events being handled: `idle()` waits for them. `handle` never rejects. */
  const handling = new Set<Promise<void>>();

  const created: CaptureNotices = {
    notifier,
    async beforePrecheck(run) {
      try {
        return await gate.beforePrecheck(run);
      } catch (err) {
        app.log.error({ err, code: 'CAPTURE_PRECHECK_GATE_FAILED', sessionId: run.sessionId }, GATE_FAILED);
        app.errorLog.append({ level: 'error', source: 'captureNotices.beforePrecheck', message: GATE_FAILED, ...describeError(err), code: 'CAPTURE_PRECHECK_GATE_FAILED', context: { sessionId: run.sessionId } });
        return NOT_ASKED;
      }
    },
    beforePrecheckOf(request, sessionId, kind) {
      const principal = request.principal;
      if (principal.kind !== 'OPERATOR') return Promise.resolve(NOT_ASKED);
      return created.beforePrecheck({ sessionId, kind, owner: { operatorId: principal.operatorId, authSessionId: principal.sessionId, deviceId: principal.deviceId } });
    },
    probe: probeNow,
    provideProbe(provided) {
      if (probe !== null) throw new Error('the capture reachability probe was provided twice');
      probe = provided;
    },
    provideProbeSource(source) {
      if (probeSource !== null) throw new Error('the source of the capture reachability probe was provided twice');
      probeSource = source;
    },
    provideDiscovery(provided) {
      if (discovery !== null) throw new Error('the pre-check search seam was provided twice');
      discovery = provided;
    },
    watchSessionStarts(source) {
      const known = watched.get(source);
      if (known !== undefined) return known;
      const off = source.on((event) => {
        const work = sessionStarts.handle(event);
        handling.add(work);
        void work.finally(() => handling.delete(work));
        return work;
      });
      const remove = (): void => {
        off();
        watched.delete(source);
      };
      watched.set(source, remove);
      return remove;
    },
    async idle() {
      // An event may arrive while another is handled: wait until none is left.
      while (handling.size > 0) await Promise.all(handling);
    },
  };
  instances.set(app.stages, created);
  return created;
}

/** Apps on which the boot registration was made: a second call adds no second hook. */
const registered = new WeakSet<object>();

/**
 * THE BOOT REGISTRATION OF THIS UNIT (integration pass D8; row 139's request, decision D156).
 * Called in a plugin function while the app registers its units. It adds ONE `onReady` hook: when
 * every unit is registered (so the capture seam and the capture-session unit can be read) the
 * session-start listener is attached to `sessionCapture(app)`. A Core that never ran a pre-check
 * and never searched for a camera therefore raises the notices of a degraded or failed session
 * start from its first session on. The hook starts nothing, asks no device and opens no
 * connection; what it cannot do is written to the log and the persistent error log
 * (`CAPTURE_SESSION_START_WATCH_NOT_ATTACHED`) and never stops the boot.
 */
export function registerCaptureNotices(app: Pick<FastifyInstance, 'addHook'> & CaptureNoticesApp): void {
  if (registered.has(app.stages)) return;
  registered.add(app.stages);
  app.addHook('onReady', async () => {
    listenToSessionStarts(app, captureNotices(app));
  });
  // THE ONE CALL THAT WIRES THE REACHABILITY PROBE (integration pass D9, item 5; row 140's finding
  // F-3): the adapters of the running capture operation, as the capture fence offers them after
  // its boot step (`probeAdapters()`: null in SIMULATED and before that step - asked again at the
  // next use). The fence cannot import this unit (a cycle); this unit reads the fence. Nothing is
  // opened or listed here: a microphone is read by `enumerate()` only when operation 97 or a
  // pre-check asks, and a camera by its adapter's read (the LOCAL camera: its short open).
  captureNotices(app).provideProbeSource(() => {
    let input: ReturnType<ReturnType<typeof captureFenceControl>['probeAdapters']>;
    try {
      input = captureFenceControl(app).probeAdapters();
    } catch {
      // An app without the capture unit has no fence: no probe.
      return null;
    }
    return input === null ? null : probeOfAdapters(input);
  });
}
