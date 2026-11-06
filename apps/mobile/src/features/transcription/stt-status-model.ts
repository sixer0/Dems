/**
 * Pure view model of the Settings transcription status (blueprint row 118; R-8, D20; ux §8a, tablet
 * and phone columns; C3 §2.5 operation 90). No React: unit-tested in `stt-status-model.test.ts`.
 *
 * READ-ONLY by construction. This module takes the `SttConfig` of operation 90 and names what the
 * tablet and the phone may show: enabled, backend, model, speaker labelling, whether a credential
 * is set, the last connection test and the "pending for the next session" note. It has no member
 * for an endpoint, a credential kind or a revision, so no screen built on it can draw them; the
 * credential is a flag (`credentialSet`) and nothing else (§8a "Secrecy": "never received").
 */
import { AuditType, type SimState } from '@dems/shared/sim';
import type { SttConfig } from '@dems/shared/api';

/** The test result shown for `lastTest` (§8a: "last test result"). */
export type SttTestOutcome = 'NEVER' | 'READY' | 'MODEL_MISSING' | 'UNREACHABLE';

export interface SttStatusView {
  readonly enabled: boolean;
  readonly backend: SttConfig['backend'];
  /** The model identifier of the configuration (never a path; the contract forbids one). */
  readonly model: string;
  /** Speaker labelling (`diarization`). */
  readonly labelling: boolean;
  /** "Set" or "not set" is all the clients ever learn about the credential. */
  readonly credentialSet: boolean;
  readonly test: { readonly outcome: SttTestOutcome; readonly testedAt: number | null };
  /** A change was stored after the open session started; it applies to the next session. */
  readonly pendingForNextSession: boolean;
}

/** The result of the last connection test (op 92) as the words of §8a say it. */
export function testOutcomeOf(lastTest: SttConfig['lastTest']): { outcome: SttTestOutcome; testedAt: number | null } {
  if (lastTest === undefined) return { outcome: 'NEVER', testedAt: null };
  if (!lastTest.reachable) return { outcome: 'UNREACHABLE', testedAt: lastTest.testedAt };
  return { outcome: lastTest.modelAvailable ? 'READY' : 'MODEL_MISSING', testedAt: lastTest.testedAt };
}

/** Op 90's answer as the view the section draws. Copies five members and one flag; nothing else. */
export function sttStatusOf(config: SttConfig): SttStatusView {
  return {
    enabled: config.enabled,
    backend: config.backend,
    model: config.model,
    labelling: config.diarization,
    credentialSet: config.credentialSet,
    test: testOutcomeOf(config.lastTest),
    pendingForNextSession: config.pendingForNextSession,
  };
}

/**
 * The refresh signal: the sequence number of the newest `STT_CONFIG_CHANGED` audit row (0 when none
 * is in the replicated `audit` slice). A save made on the web console (op 91) appends exactly one
 * such row; the row reaches this device through the audit slice, so a change of this number is the
 * "a web edit happened" event (the existing realtime path, no second channel).
 */
export function selectSttAuditMark(state: SimState): number {
  const rows = state.audit.rows;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    if (row.type === AuditType.STT_CONFIG_CHANGED) return row.seq;
  }
  return 0;
}
