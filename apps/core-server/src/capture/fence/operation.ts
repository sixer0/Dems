/**
 * THE ONE DEFINITION OF THE CAPTURE OPERATION (blueprint row 136; capture spec §A.1.2; decisions
 * D72(l), D82(e), D108(c); static rule G-R15; check `M4-SEC-FENCE-1`).
 *
 * `captureOperationDecisionOf` is the ONLY function of the server that reads the development flag
 * (`captureDevSources`), and the only one that reads the three flags together. Every other
 * reader - the adapter registry, the boot fence, the M2 demo fencing, the forwarder, the session
 * wiring - asks it, or is handed its result. Row 61 (static rules and boot checks) adopts it.
 *
 * WHAT THE FLAGS DECIDE (spec §A.1.2, rows 1 to 6 and 10 of the table; rows 7 to 9 need the
 * stored sources and the helper program and are the boot fence's, `boot.ts`):
 *
 *   mode       demo  dev   listener        operation           refusal
 *   simulated  any   0     loopback        SIMULATED           -                        rows 1, 5
 *   real       0     0     loopback        REAL_PRODUCTION     -                        row 2
 *   real       0     1     loopback        REAL_DEVELOPMENT    -                        row 3
 *   real       1     any   any             SIMULATED           REAL_CAPTURE_WITH_DEMO_CONTROLS   row 4
 *   simulated  any   1     any             SIMULATED           DEV_SOURCES_NEED_REAL_CAPTURE     row 6
 *   any        any   1     not loopback    SIMULATED           DEV_FLAG_WITH_LAN_LISTENER        row 10
 *
 * A REFUSED COMBINATION ANSWERS `SIMULATED`, never a development or a production operation: a
 * reader that forgot to look at `refusal` registers no adapter, starts no worker and records
 * nothing. The boot fence stops the start for every refusal before a listener opens.
 *
 * Row 4 is row 61's refusal (blueprint row 61 verification text); its code is named here so that
 * the table has no hole between the demo flag and the development flag, and row 61 may rename it.
 * Row 5 (`simulated` without demo controls) boots as `SIMULATED`: row 61 decides whether it is
 * refused or labelled, and only that row of the table changes then.
 *
 * Pure: a configuration in, a decision out. No file, no clock, no environment.
 */
import { CaptureOperation } from '../adapters/kinds';

/** The members of the configuration the decision reads. `CoreServerConfig` satisfies it. */
export interface CaptureOperationInput {
  readonly captureMode: 'simulated' | 'real';
  readonly demoControls: boolean;
  readonly captureDevSources: boolean;
  /** The listen host of the server. A listener outside loopback is a production configuration (spec §A.1.2). */
  readonly host: string;
}

/** The refusals the flags alone decide. */
export const CaptureFlagRefusal = {
  /** Row 6: the flag promises sources that no worker would ever record. */
  DEV_SOURCES_NEED_REAL_CAPTURE: 'DEV_SOURCES_NEED_REAL_CAPTURE',
  /** Row 10: development sources beside a listener outside loopback. Cannot occur today (OD-13); the fence exists before the listener does. */
  DEV_FLAG_WITH_LAN_LISTENER: 'DEV_FLAG_WITH_LAN_LISTENER',
  /** Row 4 (row 61's): two owners of faults in one run. */
  REAL_CAPTURE_WITH_DEMO_CONTROLS: 'REAL_CAPTURE_WITH_DEMO_CONTROLS',
} as const;
export type CaptureFlagRefusal = (typeof CaptureFlagRefusal)[keyof typeof CaptureFlagRefusal];

export interface CaptureOperationDecision {
  readonly operation: CaptureOperation;
  /** Null when the three flags may stand together; else why the boot must stop. */
  readonly refusal: CaptureFlagRefusal | null;
  /**
   * True when the demo controls (fault injection, scenario load, reset) belong to this run: the
   * demo flag is on AND nothing real is recorded. What the M2 fencing (`modules/capture-config/
   * fencing.ts`) names `SIMULATED`.
   */
  readonly demoControls: boolean;
}

const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', '::1', 'localhost'];

const decision = (operation: CaptureOperation, refusal: CaptureFlagRefusal | null, demoControls: boolean): CaptureOperationDecision => Object.freeze({ operation, refusal, demoControls });

/** THE one reader of the development flag. See the table in the header. */
export function captureOperationDecisionOf(config: CaptureOperationInput): CaptureOperationDecision {
  const real = config.captureMode === 'real';
  // Anything but the literal `true` is "off": a configuration object built by hand cannot turn the flag on by accident.
  const development = config.captureDevSources === true;
  const demo = config.demoControls === true;
  if (development && !LOOPBACK_HOSTS.includes(config.host)) return decision(CaptureOperation.SIMULATED, CaptureFlagRefusal.DEV_FLAG_WITH_LAN_LISTENER, false);
  if (real && demo) return decision(CaptureOperation.SIMULATED, CaptureFlagRefusal.REAL_CAPTURE_WITH_DEMO_CONTROLS, false);
  if (!real && development) return decision(CaptureOperation.SIMULATED, CaptureFlagRefusal.DEV_SOURCES_NEED_REAL_CAPTURE, false);
  if (!real) return decision(CaptureOperation.SIMULATED, null, demo);
  return decision(development ? CaptureOperation.REAL_DEVELOPMENT : CaptureOperation.REAL_PRODUCTION, null, false);
}

/** The capture operation of a configuration (spec §A.1.2 `captureOperationOf`). Reads no flag itself: it asks the one function. */
export function captureOperationOf(config: CaptureOperationInput): CaptureOperation {
  return captureOperationDecisionOf(config).operation;
}
