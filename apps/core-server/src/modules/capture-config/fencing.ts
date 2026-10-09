/**
 * The real-mode demo fencing of the capture-config module (blueprint row 52 / M2-W10; register
 * CS-23; OD-18; C3 §3 ops 71 to 75; C3 §4 `DEMO_DISABLED` and `RESET_BLOCKED_REAL_EVIDENCE`).
 *
 * THE MODE. The Core runs its demo controls only while the server was started with the demo flag
 * (`config.ts`: read once at start, never changeable through the API, DC-2). A Core without the
 * flag runs REAL-CAPTURE mode: hardware faults are never injected into a real capture and no
 * scenario load replaces the live state (OD-18). This module owns that reading of the flag - the
 * single place the two modes are named - so the demo module, the reset guard and the status read
 * all speak one vocabulary instead of each re-deriving "real mode" from a boolean.
 *
 * THE ENFORCEMENT STAYS WHERE IT IS. Stage 6 (`plugins/permission-guard`) refuses operations 71
 * to 75 with `403 DEMO_DISABLED` for a `DEMO_CONTROL` holder while the flag is off, before the
 * body is read and with no audit row (DC-1, DC-2); the reset's `409 RESET_BLOCKED_REAL_EVIDENCE`
 * refusal is the DB-and-disk guard of row 54. This file adds no second gate: it names the modes,
 * states what each refuses, and pins the two machine codes this row's checks assert end to end.
 *
 * THE RESET FENCE. A reset in SIMULATED mode stays the seed-state rebuild it is today; in
 * REAL-CAPTURE mode it additionally refuses while a REAL sealed package exists (OD-19, RK-16) and
 * the three capture tables are KEPT across every allowed reset (D-DB-08). `resetFenceOf` says so
 * in data; row 54's guard enforces it against the store and the disk.
 */
import { ApiErrorCode } from '@dems/shared/api';

/** The two capture modes of the Core (OD-18). */
export const CaptureMode = { SIMULATED: 'SIMULATED', REAL_CAPTURE: 'REAL_CAPTURE' } as const;
export type CaptureMode = (typeof CaptureMode)[keyof typeof CaptureMode];

/** What operation 71 reports for the demo controls in each mode (C3 §3 op 71). */
export const DemoState = { ENABLED: 'ENABLED', DISABLED: 'DISABLED' } as const;
export type DemoState = (typeof DemoState)[keyof typeof DemoState];

/** The fencing facts one mode decides. */
export interface DemoFencing {
  readonly mode: CaptureMode;
  /** The value op 71's schema-v2 `demo` member carries in this mode. */
  readonly demo: DemoState;
  /** Operations 72/73/74 (scenario load, fault inject, fault clear): refused `403 DEMO_DISABLED` in real capture. */
  readonly faultInjectionAllowed: boolean;
  readonly scenarioLoadAllowed: boolean;
  /** Operation 75: allowed in simulated mode; in real capture it further refuses `409 RESET_BLOCKED_REAL_EVIDENCE` while real sealed evidence exists (row 54's guard). */
  readonly resetAllowedUnconditionally: boolean;
  /** The machine codes of the two refusals this row fences with (pinned, not invented here). */
  readonly refusalCodes: {
    readonly demoDisabled: typeof ApiErrorCode.DEMO_DISABLED;
    readonly resetBlocked: typeof ApiErrorCode.RESET_BLOCKED_REAL_EVIDENCE;
  };
}

/**
 * The mode of a configuration: the demo flag ON is Simulated operation, OFF is real capture.
 * When the capture worker lands (M3), the CS-22 boot checks (row 61) decide readiness on top of
 * this same fact; nothing else gets to call a run "real".
 */
export function captureModeOf(config: { readonly demoControls: boolean }): CaptureMode {
  return config.demoControls ? CaptureMode.SIMULATED : CaptureMode.REAL_CAPTURE;
}

/** The fencing facts of a configuration. Pure: the caller's flag in, the mode's answers out. */
export function demoFencingOf(config: { readonly demoControls: boolean }): DemoFencing {
  const mode = captureModeOf(config);
  const simulated = mode === CaptureMode.SIMULATED;
  return {
    mode,
    demo: simulated ? DemoState.ENABLED : DemoState.DISABLED,
    faultInjectionAllowed: simulated,
    scenarioLoadAllowed: simulated,
    resetAllowedUnconditionally: simulated,
    refusalCodes: { demoDisabled: ApiErrorCode.DEMO_DISABLED, resetBlocked: ApiErrorCode.RESET_BLOCKED_REAL_EVIDENCE },
  };
}
