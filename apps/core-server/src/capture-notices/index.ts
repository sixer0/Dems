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
 *   the session start (rows 71 / 139)     `notifier.notifyNoCameraConnected`, `notifyCameraNotConnected`, `cameraConnected`, `camerasAvailable`
 *   the capture-inputs module (op 97)     `captureNotices(app).probe()`, `notifier.devicePresence`
 *   the wiring of the adapters (71 / 136) `provideProbe(...)`; row 132: `provideDiscovery(...)`
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
import type { Principal } from '../plugins/authenticate';
import { describeError } from '../plugins/logger';
import { createNoDeviceNotifier, type NoDeviceNotifier, type NoticeEngine, type NoticeReport } from './notifier';
import { createPrecheckGate, type PrecheckGateOutcome, type PrecheckGateState, type PrecheckRun, type PrecheckSearchSeam } from './precheck';
import type { CaptureReachabilityProbe } from './probe';

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
  /** Called once by the discovery module. A second call throws. */
  provideDiscovery(discovery: PrecheckSearchSeam): void;
}

/** What `captureNotices` needs of the app: its seams, read at every call. */
export type CaptureNoticesApp = Pick<FastifyInstance, 'stages' | 'seams' | 'log' | 'errorLog'> & { readonly engine: NoticeEngine & { state(): PrecheckGateState } };

const FAILED = 'a no-device notice could not be written';
const GATE_FAILED = 'the pre-check gate could not finish';
const NOT_ASKED: PrecheckGateOutcome = Object.freeze({ asked: false, unreachable: Object.freeze([]), search: 'NOT_NEEDED', settled: Promise.resolve() });

// Keyed by the app's stage registry: one object per app, the same from every scope of it.
const instances = new WeakMap<object, CaptureNotices>();

export function captureNotices(app: CaptureNoticesApp): CaptureNotices {
  const known = instances.get(app.stages);
  if (known !== undefined) return known;

  let probe: CaptureReachabilityProbe | null = null;
  let discovery: PrecheckSearchSeam | null = null;
  const report = (failure: NoticeReport): void => {
    const context = { deviceId: failure.deviceId, sessionId: failure.sessionId, searchId: failure.searchId };
    app.log.error({ err: failure.err, code: failure.code, ...context }, FAILED);
    app.errorLog.append({ level: 'error', source: failure.source, message: FAILED, ...describeError(failure.err), code: failure.code, context });
  };
  const engine = (): (NoticeEngine & { state(): PrecheckGateState }) | null => (app.seams.has('engine') ? app.engine : null);
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
    probe: () => probe,
    discovery: () => discovery,
    report,
  });

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
    probe: () => probe,
    provideProbe(provided) {
      if (probe !== null) throw new Error('the capture reachability probe was provided twice');
      probe = provided;
    },
    provideDiscovery(provided) {
      if (discovery !== null) throw new Error('the pre-check search seam was provided twice');
      discovery = provided;
    },
  };
  instances.set(app.stages, created);
  return created;
}
