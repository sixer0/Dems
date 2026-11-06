/**
 * The microphone pair of the Session Live monitor and its warnings (task 3 M5, blueprint row 73; ux
 * spec §3 flow 2). The pure reads are in `mic-source-model.ts`; the cards and the warnings draw what
 * these hooks return.
 *
 * | Hook | What it is |
 * |---|---|
 * | `useMicSource` | The pair as the store holds it and the input of an active `MIC_SILENT` / `MIC_NO_SIGNAL` warning; both data modes |
 *
 * Audit row 185 (M3-05 R1; D5, D134, D136, D138): operation 81 `switchAudioSource` is RETIRED - the
 * microphone of each pair is fixed by setup. `useMicSwitch` (the confirmation, the one call site of
 * `actions.switchAudioSource`, its pending state and its refusals) is removed: the tablet sends op 81
 * nowhere, and no hook here sends any command.
 *
 * Audit row 226 (D207, R211-3): `useMicSourceRole` is removed - since row 211 no card reads a role word
 * (the gold outline marks Pair 1), and its last readers were test probes.
 *
 * Every function that calls a hook is named `use*` (D66: the device build runs the React Compiler).
 */
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { useMemo } from 'react';
import { useSim } from '@dems/shared/sim';
import { noSignalInputOf, selectActiveInputId, selectStandbyInputId, silentInputOf } from './mic-source-model';

export interface MicSourceView {
  readonly sessionId: string | null;
  readonly recording: boolean;
  /**
   * The pair as the Core holds it. Task 4 row 170 (site M4): each member is `null` when it is ABSENT - the
   * selector in force holds no line for it and the session states none. Nothing stands in for it.
   */
  readonly activeInputId: string | null;
  readonly standbyInputId: string | null;
  /** The input of an active `MIC_SILENT` warning while recording, or `null`. */
  readonly silentInputId: string | null;
  /** JA2-06: the input of an active `MIC_NO_SIGNAL` fault while recording, or `null`. */
  readonly noSignalInputId: string | null;
}

/** The active/standby pair and the two microphone warnings, in both data modes. Sends nothing (row 185). */
export function useMicSource(): MicSourceView {
  const sessionId = useSim((s) => s.session?.id ?? null);
  const recording = useSim((s) => s.session?.state === 'RECORDING');
  const activeInputId = useSim(selectActiveInputId);
  const standbyInputId = useSim(selectStandbyInputId);
  const faults = useSim((s) => s.faults.active);
  const micLines = useSim((s) => micLinesInForce(s));
  const silentInputId = useMemo(() => (recording ? silentInputOf(faults, activeInputId, micLines) : null), [recording, faults, activeInputId, micLines]);

  const noSignalInputId = useMemo(() => (recording ? noSignalInputOf(faults, activeInputId, micLines) : null), [recording, faults, activeInputId, micLines]);

  return { sessionId, recording, activeInputId, standbyInputId, silentInputId, noSignalInputId };
}

