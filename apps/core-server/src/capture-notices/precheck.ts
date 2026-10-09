/**
 * The pre-check gate: what a run of `beginPrecheck` / `retryPrecheck` does BEFORE the hosted
 * action (task 3 blueprint row 133; contract C3 §2.6 "Search trigger", §3.1; specs R-10 AC-2,
 * AC-5, R-9 AC-1(b); decisions D80(2), D80(6), D83, D86 C-8).
 *
 *   1. ASK. Every configured camera and microphone of the selector is asked through the
 *      reachability probe. No probe (no adapter is registered: `SIMULATED`): the gate does
 *      nothing at all and the run is the predecessor's.
 *   2. WRITE WHAT THE CHECKS READ, before the action. A device that answers reads online and its
 *      pre-check alert, if one is active, is resolved (no audit row). A device that does not
 *      answer reads not online. The session machine's start rule then decides each row
 *      (`captureReachabilityOf`): both cameras or the active microphone block, one camera or the
 *      standby microphone warn.
 *   3. RAISE. An unreachable MICROPHONE raises its alert and its `CAPTURE_DEVICE_UNREACHABLE` row
 *      at once (0 probes: a microphone is no network device). An unreachable CAMERA starts the
 *      ONE search of this run - under the pre-check's own allowance, owned by the operator session
 *      that started the pre-check, whether or not that operator holds CAPTURE_CONFIG - and raises
 *      when the search closed, so that the alert carries its count (`searchResponderCount`; an
 *      alert's `params` are written once). The request does not wait for the search: the gate
 *      resolves after step 2 and the mic alerts.
 *
 * THE PRE-CHECK IS NEVER FAILED BY ITS SEARCH. When no search can be started - no discovery
 * service, another search is running (single flight), this gate's earlier search is still open,
 * the service refuses or fails - the camera alerts are raised without a count and the run goes
 * on. A probe that fails is reported and that device counts as unreachable.
 *
 * THE ALLOWANCE. At most one search per run of the gate, and none while a search this gate
 * started is still open. It is counted here, apart from the per-minute and per-hour bounds of
 * operation 93 (which the discovery service keeps for `trigger: MANUAL`).
 *
 * This file names no socket, no process and no file; it logs nothing itself.
 */
import { SessionState } from '@dems/shared/domain';
import { CaptureUnreachableCause, CaptureUnreachablePhase, activeCaptureNotice, captureReachabilityOf, CaptureNoticeReason, type CaptureSourceReachability, type SimState } from '@dems/shared/sim';
import type { ClosedSearch, NoDeviceNotifier, NoticeReport } from './notifier';
import type { CaptureReachabilityProbe, DeviceReading } from './probe';

/** The operator session a pre-check search belongs to (C3 §2.6 "Candidate state: ownership"). IDs only. */
export interface PrecheckSearchOwner {
  readonly operatorId: string;
  /** The ID of the authenticated session, never its token. */
  readonly authSessionId: string;
  /** The paired device of a bearer session; null for a web console session. */
  readonly deviceId: string | null;
}

/**
 * What the gate needs of the discovery service (row 132): "run a search for this session".
 * Resolves with the closed search, or null when the search was NOT started (another search is
 * running, or no discovery adapter is provided). The service writes the search's one
 * `CAPTURE_DISCOVERY_SEARCHED` row itself (`trigger: PRECHECK`).
 */
export interface PrecheckSearchSeam {
  runPrecheckSearch(owner: PrecheckSearchOwner, recording: { readonly sessionId: string }): Promise<ClosedSearch | null>;
}

/** The slices the gate reads of the engine's committed state. */
export type PrecheckGateState = Pick<SimState, 'captureConfig' | 'captureDevices' | 'alerts' | 'session'>;

export interface PrecheckGateOptions {
  /** The committed state, or null when the engine is not running (the action then answers 503 itself). */
  readonly state: () => PrecheckGateState | null;
  readonly notifier: NoDeviceNotifier;
  /** Read at every run. Null: no adapter is registered. */
  readonly probe: () => CaptureReachabilityProbe | null;
  /** Read at every run. Null: no discovery service. */
  readonly discovery: () => PrecheckSearchSeam | null;
  readonly report: (report: NoticeReport) => void;
}

export interface PrecheckRun {
  /** The recording session the pre-check belongs to (`SES-…`). */
  readonly sessionId: string;
  /**
   * `BEGIN`: the run of `beginPrecheck` (the session is in CREATE). `RETRY`: the run of
   * `retryPrecheck` (the session is in PRECHECK and its checks have ended). The gate asks nothing
   * when the open session is not `sessionId` or is not in that state: the hosted action will
   * refuse the request (404 / 409), and a refused request must probe and search nothing.
   */
  readonly kind: 'BEGIN' | 'RETRY';
  readonly owner: PrecheckSearchOwner;
}

/** What one run of the gate did: for the caller's log line and for tests. IDs and counts only. */
export interface PrecheckGateOutcome {
  /** False when no probe is provided: nothing was asked and nothing was written. */
  readonly asked: boolean;
  readonly unreachable: readonly string[];
  /** `STARTED`: the one search of this run is open; `NOT_NEEDED`: every camera answers; else why none was started. */
  readonly search: 'STARTED' | 'NOT_NEEDED' | 'NO_SERVICE' | 'ALLOWANCE_USED';
  /** Settles when everything this run started has ended (the search and the camera alerts). The request does not wait for it. */
  readonly settled: Promise<void>;
}

export interface PrecheckGate {
  beforePrecheck(run: PrecheckRun): Promise<PrecheckGateOutcome>;
}

export const PrecheckReportCode = {
  PROBE_FAILED: 'CAPTURE_PRECHECK_PROBE_FAILED',
  SEARCH_FAILED: 'CAPTURE_PRECHECK_SEARCH_FAILED',
} as const;

const SOURCE = 'captureNotices.precheck';
const NOT_ASKED: PrecheckGateOutcome = Object.freeze({ asked: false, unreachable: Object.freeze([]), search: 'NOT_NEEDED', settled: Promise.resolve() });

export function createPrecheckGate(options: PrecheckGateOptions): PrecheckGate {
  const { notifier } = options;
  const report = (entry: NoticeReport): void => {
    try {
      options.report(entry);
    } catch {
      // Nowhere left to say it.
    }
  };
  /** True while a search this gate started is open: the allowance of the next run is used up. */
  let searching = false;
  /** Counts the runs: a search that closes after a later run began leaves the alerts to that run. */
  let runs = 0;

  return {
    async beforePrecheck(run) {
      const probe = options.probe();
      // No adapter is registered: the state is not even read.
      if (probe === null) return NOT_ASKED;
      const before = options.state();
      if (before === null) return NOT_ASKED;
      const open = before.session;
      if (open === null || open.id !== run.sessionId) return NOT_ASKED;
      if (run.kind === 'BEGIN' ? open.state !== SessionState.CREATE : open.state !== SessionState.PRECHECK || open.precheck.outcome === null) return NOT_ASKED;
      runs += 1;
      const mine = runs;
      const ids = { sessionId: run.sessionId, searchId: null } as const;

      // 1. Ask every configured source once (a camera on both tracks is one device). The selector
      // is the one the session was created under (it is locked while the session is open, OD-10).
      const selector = { cameras: open.captureConfig?.cameras ?? before.captureConfig.cameras, mics: open.captureConfig?.mics ?? before.captureConfig.mics };
      const cameraIds = [...new Set(selector.cameras.map((camera) => camera.deviceId))];
      const micIds = [...new Set(selector.mics.map((mic) => mic.deviceId))];
      const readings = new Map<string, DeviceReading>();
      const down = (cause: CaptureUnreachableCause = CaptureUnreachableCause.UNREACHABLE): DeviceReading => ({ reachable: false, cause });
      const asking = new AbortController();
      await Promise.all(
        cameraIds.map(async (deviceId) => {
          try {
            readings.set(deviceId, await probe.camera(deviceId, asking.signal));
          } catch (err) {
            report({ source: SOURCE, code: PrecheckReportCode.PROBE_FAILED, deviceId, ...ids, err });
            readings.set(deviceId, down());
          }
        }),
      );
      try {
        const inputs = await probe.microphones();
        for (const deviceId of micIds) {
          const found = inputs.microphones.find((entry) => entry.deviceId === deviceId);
          readings.set(deviceId, found?.present === true ? { reachable: true } : down(found?.errorCode ?? CaptureUnreachableCause.DEVICE_NOT_FOUND));
        }
      } catch (err) {
        report({ source: SOURCE, code: PrecheckReportCode.PROBE_FAILED, deviceId: null, ...ids, err });
        for (const deviceId of micIds) readings.set(deviceId, down(CaptureUnreachableCause.OPEN_FAILED));
      }

      // The start rule over what was read: `degraded` of each audit row is the rule's, not a second opinion.
      const read: PrecheckGateState = {
        ...before,
        captureDevices: { ...before.captureDevices, devices: before.captureDevices.devices.map((device) => (readings.has(device.id) ? { ...device, online: readings.get(device.id)?.reachable === true } : device)) },
      };
      const rule = new Map<string, CaptureSourceReachability>();
      // `captureReachabilityOf` reads the selector and `captureDevices` only.
      for (const row of captureReachabilityOf(read as SimState)) if (!row.reachable) rule.set(row.deviceId, row);

      // 2. Before the action: what the checks read.
      const unreachableCameras: string[] = [];
      const unreachable: string[] = [];
      for (const deviceId of [...cameraIds, ...micIds]) {
        const reading = readings.get(deviceId) ?? down();
        const stored = before.captureDevices.devices.find((device) => device.id === deviceId);
        if (reading.reachable) {
          const alerted = activeCaptureNotice(before, CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, deviceId) !== undefined;
          // Nothing to write for a device that reads online and has no alert: no unit is opened.
          if (stored?.online !== true || alerted) await notifier.deviceReachable(deviceId, CaptureUnreachablePhase.PRECHECK);
          continue;
        }
        unreachable.push(deviceId);
        if (cameraIds.includes(deviceId)) {
          unreachableCameras.push(deviceId);
          // The alert waits for the count of the search; the check must read "not online" now.
          if (stored?.online !== false) await notifier.devicePresence(deviceId, false);
        } else {
          // 3. A microphone: at once. 0 probes.
          await notifier.deviceUnreachable({ deviceId, phase: CaptureUnreachablePhase.PRECHECK, cause: reading.cause, degraded: rule.get(deviceId)?.degraded === true, sessionId: run.sessionId });
        }
      }

      const raiseCameras = async (count: number | undefined): Promise<void> => {
        for (const deviceId of unreachableCameras) {
          const reading = readings.get(deviceId);
          await notifier.deviceUnreachable({
            deviceId,
            phase: CaptureUnreachablePhase.PRECHECK,
            cause: reading !== undefined && !reading.reachable ? reading.cause : CaptureUnreachableCause.UNREACHABLE,
            degraded: rule.get(deviceId)?.degraded === true,
            sessionId: run.sessionId,
            searchResponderCount: count,
          });
        }
      };

      if (unreachableCameras.length === 0) return { asked: true, unreachable, search: 'NOT_NEEDED', settled: Promise.resolve() };

      // 3. A camera: the ONE search of this run, under the pre-check's own allowance.
      const service = options.discovery();
      if (service === null || searching) {
        await raiseCameras(undefined);
        return { asked: true, unreachable, search: service === null ? 'NO_SERVICE' : 'ALLOWANCE_USED', settled: Promise.resolve() };
      }
      searching = true;
      const settled = Promise.resolve()
        .then(() => service.runPrecheckSearch(run.owner, { sessionId: run.sessionId }))
        .then(
          async (closed) => {
            searching = false;
            // Situation A is decided on every closed camera search; telling it twice changes nothing.
            if (closed !== null) await notifier.searchClosed(closed);
            // A later run began while the search was open: it asked again and raises for itself.
            if (mine !== runs) return;
            await raiseCameras(closed !== null && closed.outcome === 'COMPLETE' ? closed.responderCount : undefined);
          },
          async (err: unknown) => {
            searching = false;
            report({ source: SOURCE, code: PrecheckReportCode.SEARCH_FAILED, deviceId: null, ...ids, err });
            if (mine !== runs) return;
            await raiseCameras(undefined);
          },
        )
        .catch((err: unknown) => {
          searching = false;
          report({ source: SOURCE, code: PrecheckReportCode.SEARCH_FAILED, deviceId: null, ...ids, err });
        });
      return { asked: true, unreachable, search: 'STARTED', settled };
    },
  };
}
