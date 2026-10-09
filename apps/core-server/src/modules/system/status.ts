/**
 * Operation 64 `getSystemStatus`: the five slices of the system page (plan row W40; spec §7.14;
 * contract `SystemStatus` in `packages/shared/src/api/system.ts`).
 *
 * The answer holds `device`, `services`, `update`, `diagnostics` and `settings` in their wire
 * form (API-6), each under its slice name, all five from ONE committed state. Nothing is
 * computed: the uptime of a service, the progress of an update and the result of a diagnostics
 * check are in the slices as the engine wrote them (`startedAt`, `steps`, `checks`).
 *
 * No live meter value is needed for any member: a diagnostics check holds the verdict the
 * engine reached from the committed hardware state when the check resolved.
 *
 * TWO SERVICES ARE REAL PROCESSES (blueprint row 62; register CS-10; API contract row 64). The
 * engine's `services` slice is the simulator's: seventeen entries whose status follows the
 * active faults. Two of them stand for programs this server supervises, and the read says what
 * those programs do, laid over the slice at the moment of the read:
 *
 *   `Recording Engine`       the capture worker. From the capture supervisor's status
 *                            (`app.capture.status().phase`): RESTARTING is DEGRADED; FAULTED and
 *                            CLOSED (not booted, or shut down: every start is refused) are
 *                            STOPPED; every other phase leaves the entry as the engine has it.
 *                            An idle supervisor has no worker process BY DESIGN (one process per
 *                            session), so IDLE is not "stopped". The worse of the two verdicts
 *                            wins: a simulator fault on the entry is never hidden.
 *   `Transcription Service`  the transcriber. It is NOT MOUNTED in this server yet (blueprint
 *                            row 115). Until a source is handed in, the entry is not configured:
 *                            on the wire `STOPPED` with no start instant, because the contract's
 *                            status set (RUNNING, DEGRADED, STOPPED) has no fourth member. The
 *                            reason is in `serviceReportsOf`, not on the wire.
 *
 * THE SEAM for row 115 is `TranscriberServiceSource`: a function that answers the transcriber's
 * state. `systemModule` takes it as the plugin option `transcriber`; without it the source is
 * `TRANSCRIBER_NOT_MOUNTED`. Nothing else has to change when the transcriber is mounted.
 *
 * WHAT THIS IS NOT. It is laid over the ANSWER OF THIS READ only. The replicated `services`
 * slice (the one the consoles draw) stays the engine's; bringing the two processes into that
 * slice needs an engine action, which is not this module's to add.
 *
 * Pure: it reads what it is given and changes none of it. A STOPPED entry shows no start instant.
 */
import type { SystemStatus } from '@dems/shared/api';
import type { SimState } from '@dems/shared/sim';
import type { CaptureStatus } from '../../capture';

/** The five slices of the answer: all from ONE committed state. */
export type SystemStatusSource = Pick<SimState, 'device' | 'services' | 'update' | 'diagnostics' | 'settings'>;

type Services = SystemStatusSource['services'];
type ServiceVerdict = Services[number]['status'];

/** The entry of the dataset's service list that stands for the capture worker (book §6.1, verbatim). */
export const CAPTURE_WORKER_SERVICE = 'Recording Engine';
/** The entry that stands for the transcriber (register SH-09; the dataset's seventeenth service). */
export const TRANSCRIBER_SERVICE = 'Transcription Service';

/** What the transcriber says of itself. `NOT_CONFIGURED`: no transcriber is mounted in this server. */
export const TranscriberServiceState = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  RUNNING: 'RUNNING',
  DEGRADED: 'DEGRADED',
  STOPPED: 'STOPPED',
} as const;
export type TranscriberServiceState = (typeof TranscriberServiceState)[keyof typeof TranscriberServiceState];

export interface TranscriberServiceReport {
  readonly state: TranscriberServiceState;
  /** When the transcriber last started (epoch ms on the server's time), or null. */
  readonly startedAt: number | null;
}

/** THE SEAM (row 115): how the system module learns the transcriber's state. */
export type TranscriberServiceSource = () => TranscriberServiceReport;

/** The source while no transcriber is mounted: not configured, never started. */
export const TRANSCRIBER_NOT_MOUNTED: TranscriberServiceSource = () => ({ state: TranscriberServiceState.NOT_CONFIGURED, startedAt: null });

/** What the two processes say at the moment of the read. */
export interface ServiceProbes {
  readonly capture: Pick<CaptureStatus, 'phase'>;
  readonly transcriber: TranscriberServiceReport;
}

/** The capture worker's verdict per supervisor phase. Every phase is named: a new phase does not compile unnamed. */
export const CAPTURE_PHASE_VERDICT = {
  CLOSED: 'STOPPED',
  IDLE: 'RUNNING',
  STARTING: 'RUNNING',
  RECORDING: 'RUNNING',
  STOPPING: 'RUNNING',
  RESTARTING: 'DEGRADED',
  FAULTED: 'STOPPED',
} as const satisfies Record<CaptureStatus['phase'], ServiceVerdict>;

/** The transcriber's verdict on the wire. `NOT_CONFIGURED` has no member of its own there: it reads STOPPED. */
export const TRANSCRIBER_STATE_VERDICT = {
  NOT_CONFIGURED: 'STOPPED',
  RUNNING: 'RUNNING',
  DEGRADED: 'DEGRADED',
  STOPPED: 'STOPPED',
} as const satisfies Record<TranscriberServiceState, ServiceVerdict>;

const RANK = { RUNNING: 0, DEGRADED: 1, STOPPED: 2 } as const satisfies Record<ServiceVerdict, number>;
const worse = (a: ServiceVerdict, b: ServiceVerdict): ServiceVerdict => (RANK[b] > RANK[a] ? b : a);

/** One process as this module reports it: the verdict on the wire and what it follows from. */
export interface ServiceReport {
  readonly service: string;
  readonly status: ServiceVerdict;
  /** The capture phase, or the transcriber's own state. */
  readonly because: string;
}

/** The two processes with their reasons (the wire carries the verdict only). Pure. */
export function serviceReportsOf(probes: ServiceProbes): readonly ServiceReport[] {
  return [
    { service: CAPTURE_WORKER_SERVICE, status: CAPTURE_PHASE_VERDICT[probes.capture.phase], because: probes.capture.phase },
    { service: TRANSCRIBER_SERVICE, status: TRANSCRIBER_STATE_VERDICT[probes.transcriber.state], because: probes.transcriber.state },
  ];
}

/**
 * The `services` slice with the two processes laid over it. An entry that is not one of the two
 * is returned as it is (by reference). The capture worker can only make its entry worse; the
 * transcriber's entry is the transcriber's own verdict and start instant, made no better than
 * the engine has it. A STOPPED entry shows no start instant.
 */
export function servicesWithProcesses(services: Services, probes: ServiceProbes): Services {
  const [capture, transcriber] = serviceReportsOf(probes);
  return services.map((entry) => {
    const report = entry.name === capture?.service ? capture : entry.name === transcriber?.service ? transcriber : undefined;
    const status = report === undefined ? entry.status : worse(entry.status, report.status);
    const startedAt = report === transcriber && transcriber !== undefined ? probes.transcriber.startedAt : entry.startedAt;
    return report === undefined ? entry : { ...entry, status, startedAt: status === 'STOPPED' ? null : (startedAt ?? null) };
  });
}

export function systemStatusOf(state: SystemStatusSource, probes?: ServiceProbes): SystemStatus {
  return {
    device: state.device,
    services: probes === undefined ? state.services : servicesWithProcesses(state.services, probes),
    update: state.update,
    diagnostics: state.diagnostics,
    settings: state.settings,
  };
}
