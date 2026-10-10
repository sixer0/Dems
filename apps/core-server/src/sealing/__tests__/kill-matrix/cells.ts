/**
 * THE KILL MATRIX OF M7 (blueprint row 86 / M7-W5; test strategy §A.7, §F; evidence package spec
 * §E.1, §E.4; decisions D84, D89 (b), D122, D144, D147).
 *
 * ONE TABLE, DISTINCT CHECKS. Every entry of `KILL_MATRIX` is one named check with its own ID; it
 * is reported under that ID and runs alone (`run.sh --only <id>`). The table is GENERATED from the
 * two axes below, but nothing here runs a check more than once and nothing loops over a kill
 * (test strategy §F.3: repeated kill loops are parked for the pre-handover session).
 *
 * THE AXES.
 *   recording phase (test strategy §F.1)
 *     C   clean recording, ended by the operator's stop
 *     P1  killed during RECORDING before the first durable fragment        -> a FAILED START (D84)
 *     P2  killed mid-recording with durable fragments and a torn tail      -> interrupted seal
 *     P3  killed mid-recording after a microphone switch (an open interval) -> interrupted seal
 *     P4  killed after the stop (camera files closed), before the first sealing checkpoint
 *   sealing step (test strategy §F.1): S1 CLOSE_TRACKS .. S6 STORE_SEALED_PACKAGE; `0` = no seal kill.
 *
 * WHAT IS KILLED, AND HOW (stated per cell in `kills`):
 *   WORKER+CORE  SIGKILL from the harness to the capture worker, to every other descendant of the
 *                Core (the generated-source helpers) and to the Core's process: the whole capture
 *                side dies as at a power loss. A real signal to real processes, from outside.
 *   CORE@<point> the Core's process delivers SIGKILL to ITSELF at a write of the sealing journal
 *                (`core-child.ts`): the kernel ends the process at that statement - no `finally`
 *                block, no flush, no close of a handle, no report to the engine. A killed process,
 *                not an in-process stop. The point is exact, which a signal sent from outside
 *                while watching the table cannot be for steps that take milliseconds.
 * The three points per step are the pipeline's own hook points (`pipeline/contract.ts`):
 *   BEFORE            the step's RUNNING row is about to be written (not sent)
 *   AFTER_WORK        the step did its work, its DONE row is about to be written (not sent)
 *   AFTER_CHECKPOINT  the DONE row is committed, the next step has not started
 * A step cell kills at AFTER_WORK: the work is on the disk and the journal does not know it, so
 * the next process must run the step again over its own output. That is the hardest resume.
 */
import { SEALING_STEP_ORDER, type SealingHookPhase, type SealingStepId } from '../../pipeline/contract';

export const RECORDING_PHASES = ['C', 'P1', 'P2', 'P3', 'P4'] as const;
export type RecordingPhase = (typeof RECORDING_PHASES)[number];

export interface KillPoint {
  readonly step: SealingStepId;
  readonly phase: SealingHookPhase;
}

/** What the session must be when the last process has finished its work. */
export type Expectation =
  /** SEALED, `timeline.interrupted` false, verify PASS. */
  | 'SEALED'
  /** SEALED from the durable prefix, `timeline.interrupted` true on the manifest and on every fragment, verify PASS with the flag (V-12). */
  | 'SEALED_INTERRUPTED'
  /** D84 / D89 (b): no item, no row of `sealing_jobs`, no file under a final name, the four start records kept; no sealing step entered. */
  | 'FAILED_START';

export interface MatrixCell {
  readonly id: string;
  readonly recording: RecordingPhase;
  /** The sealing step killed in, or null (reference and baseline checks). */
  readonly sealKill: KillPoint | null;
  readonly expectation: Expectation;
  /** The kills of the cell, in order, each with its kind. */
  readonly kills: readonly string[];
  readonly asserts: string;
}

/** P4's own kill: the Core dies when the pipeline is about to write its first row. */
export const P4_POINT: KillPoint = { step: 'CLOSE_TRACKS', phase: 'BEFORE' };
/** The point of a step cell (see the header). */
export const STEP_CELL_PHASE: SealingHookPhase = 'AFTER_WORK';

const RECORDING_KILL: Readonly<Record<RecordingPhase, string | null>> = {
  C: null,
  P1: 'WORKER+CORE (SIGKILL from the harness) before the first durable fragment',
  P2: 'WORKER+CORE (SIGKILL from the harness) mid-recording; a torn fragment is then appended to VIDEO-01 (synthetic: a real kill never tore one, note 21)',
  P3: 'WORKER+CORE (SIGKILL from the harness) mid-recording, after a microphone switch left an open interval',
  P4: 'CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the stop, camera files closed',
};

const EXPECTED: Readonly<Record<RecordingPhase, Expectation>> = { C: 'SEALED', P1: 'FAILED_START', P2: 'SEALED_INTERRUPTED', P3: 'SEALED_INTERRUPTED', P4: 'SEALED' };

function cell(recording: RecordingPhase, stepIndex: number | null): MatrixCell {
  const step = stepIndex === null ? null : (SEALING_STEP_ORDER[stepIndex] as SealingStepId);
  const sealKill = step === null ? null : { step, phase: STEP_CELL_PHASE };
  const id = recording === 'C' ? (stepIndex === null ? 'M7-REF-1' : `M7-KM-C-S${stepIndex + 1}`) : `M7-KM-${recording}-${stepIndex === null ? '0' : `S${stepIndex + 1}`}`;
  const kills = [RECORDING_KILL[recording], sealKill === null ? null : `CORE@${sealKill.step}:${sealKill.phase} (SIGKILL of itself)`].filter((kill): kill is string => kill !== null);
  const expectation = EXPECTED[recording];
  const asserts =
    expectation === 'FAILED_START'
      ? `failed start: 0 evidence items, 0 rows of sealing_jobs, no sealed file, 4 start records${sealKill === null ? '' : `; the process armed at ${sealKill.step} is never killed (recovery does not reach the step)`}`
      : `${expectation === 'SEALED' ? 'SEALED, not interrupted' : 'SEALED from the durable prefix, interrupted'}; one item, one EVIDENCE_SEALED row; six steps DONE; no plaintext recording left; the sealed plaintext equals the recorded fragments; verify PASS (15 checks)${sealKill === null ? '' : `; resumed from ${sealKill.step}, manifest and signature the bytes of the killed run where it had written them`}`;
  return Object.freeze({ id, recording, sealKill, expectation, kills, asserts });
}

/** The 35 scheduled checks (test strategy §F.2): M7-REF-1, 4 baselines, 6 clean step cells, 24 phase x step cells. */
export const KILL_MATRIX: readonly MatrixCell[] = Object.freeze(RECORDING_PHASES.flatMap((recording) => [cell(recording, null), ...SEALING_STEP_ORDER.map((_, index) => cell(recording, index))]));

/** PARKED, NOT BUILT: the fallback steps exist only if OD-21's legal confirmation activates the fallback path (ev §E.3, §H.1). */
export const PARKED_CELLS: readonly { readonly id: string; readonly condition: string }[] = Object.freeze(
  RECORDING_PHASES.flatMap((recording) => ['S7', 'S8'].map((step) => ({ id: recording === 'C' ? `M7-KM-C-${step}` : `M7-KM-${recording}-${step}`, condition: 'OD-21 fallback path activated (CONCATENATE_SEGMENTS / ENCRYPT_PAYLOAD are not built)' }))),
);

export class UnknownCellError extends Error {}

/**
 * The cells a run names (`DEMS_KILL_MATRIX`, comma separated). Empty or absent: none - this file
 * never runs the whole matrix by default. `ALL` is refused: a run names its cells.
 */
export function selectCells(asked: string | undefined): readonly MatrixCell[] {
  const ids = (asked ?? '').split(',').map((id) => id.trim()).filter((id) => id !== '');
  return ids.map((id) => {
    const found = KILL_MATRIX.find((entry) => entry.id === id);
    if (found !== undefined) return found;
    const parked = PARKED_CELLS.find((entry) => entry.id === id);
    throw new UnknownCellError(parked !== undefined ? `${id} is parked: ${parked.condition}` : `${id} is no check of the kill matrix`);
  });
}
