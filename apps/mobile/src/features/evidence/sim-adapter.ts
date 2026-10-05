/**
 * Local simulator adapters for the Evidence screens (P6: screen steps never write
 * `packages/shared/src/sim/**`; gaps are logged as SIM-GAP-<n> for the simulator owners, steps 54
 * and 91, per the Parallel Execution Protocol).
 *
 * - **SIM-GAP-M83-1: the simulator's evidence 0005 is not tampered, the DEMO package is.** The
 *   dataset seals every item with `tampered: false` (sim `dataset.ts`), while step 93's package for
 *   evidence 0005 fails exactly `track:AUDIO-02` (D67). Mobile shows the package's precomputed
 *   result, labelled "verified by the Core" (D51). The Core's `verify(id)` writes the audit row and
 *   the custody entry, but for 0005 it would write EVIDENCE_VERIFIED ("every hash matches") next to
 *   a screen that says FAIL. So `recordCoreVerification` computes the simulator's verdict first
 *   (pure `verifyEvidenceItem`, no state change) and calls `verify(id)` only when it agrees with the
 *   package; otherwise it writes nothing to the simulator and logs this gap. Once the dataset marks
 *   0005 as tampered on AUDIO-02 (the simulator's own `DEFAULT_TAMPER_TRACK`), the verdicts agree
 *   and the audit row is written with no change here. The same guard covers the reverse case: a
 *   live demo tamper (Demo controls) on an item whose package passes.
 * - **SIM-GAP-M83-2: no per-evidence snapshots or markers.** `EvidenceItem` carries tracks, custody
 *   and integrity only; the snapshots and markers of a session live in the active session's
 *   timeline and are dropped when it seals. MB 6's Media strip therefore shows the two camera
 *   posters and the two MIC tracks; no adapter invents snapshots.
 * - The simulator's certificate is "ECDSA P-256 (simulated)" while the packages use Ed25519: the
 *   screens show the package certificate (D67 (c); the alignment itself is SIM-GAP-W1, step 54).
 *
 * Backend task W74 (client gate CLG item (c), AC-C-53): the action comes from `useCoreActions()`
 * and goes through `settle`; the clock reading is passed in. Simulated mode only: in Live mode the
 * Core server's verdict is the record and this guard is not used (04_client_integration_spec §14
 * point 7; `use-core-verify.ts`).
 */
import { settle, type CoreActions } from '@dems/shared/live';
import { verifyEvidenceItem, type EpochMs, type EvidenceItem } from '@dems/shared/sim';
import { reportRuntimeIssue } from '@/runtime';
import type { IntegrityModel } from './evidence-model';

export type CoreVerificationOutcome =
  /** `verify(id)` ran: audit row and custody entry written. */
  | 'recorded'
  /** SIM-GAP-M83-1: the simulator disagrees with the package; nothing written. */
  | 'skipped-mismatch'
  /** The action threw (logged); the screen still shows the package result. */
  | 'failed';

/**
 * Records a Verify on the Core (the simulator) when that cannot contradict the result on screen.
 * Never throws; every non-recorded outcome is logged to the persistent runtime log.
 */
export function recordCoreVerification(
  actions: Pick<CoreActions, 'verify'>,
  now: EpochMs,
  item: EvidenceItem,
  integrity: IntegrityModel,
  correlationId?: string,
): CoreVerificationOutcome {
  try {
    if (integrity.source === 'package') {
      const simVerdict = verifyEvidenceItem(item, now).ok ? 'PASS' : 'FAIL';
      if (simVerdict !== integrity.verdict) {
        // `info`, not `warn`: a documented, expected condition (debug builds mirror warnings to LogBox).
        reportRuntimeIssue(
          'info',
          'evidence.verify.simGap',
          'SIM-GAP-M83-1: simulator verdict differs from the DEMO package; no audit row written',
          { evidenceId: item.id, packageVerdict: integrity.verdict, simulatorVerdict: simVerdict, failed: integrity.failed.join(',') },
          correlationId,
        );
        return 'skipped-mismatch';
      }
    }
  } catch (error) {
    reportRuntimeIssue('error', 'evidence.verify.record', error, { evidenceId: item.id }, correlationId);
    return 'failed';
  }
  let outcome: CoreVerificationOutcome = 'recorded';
  // The simulator answers before `settle` returns, so `outcome` is final when it is returned.
  settle(() => actions.verify(item.id), {
    fail: (error) => {
      reportRuntimeIssue('error', 'evidence.verify.record', error, { evidenceId: item.id }, correlationId);
      outcome = 'failed';
    },
  });
  return outcome;
}
