/**
 * The mic switch of the Session Live monitor, its data and its one command (task 3 M5, blueprint
 * row 73; ux spec §3 flow 2, register MB-03; operation 81 `switchAudioSource`; specs R-3). The pure
 * rules are in `mic-source-model.ts`; the cards and the controls draw what these hooks return.
 *
 * | Hook | What it is |
 * |---|---|
 * | `useMicSource` | The active/standby pair as the store holds it, the gate of the toggle (G4 / G5) and the input of an active `MIC_SILENT` warning; both data modes |
 * | `useMicSwitch` | The confirmed switch: the confirmation's state, the ONE call site of `actions.switchAudioSource`, the pending state and the refusal that stays on the cards |
 *
 * **No optimistic flip.** `useMicSwitch` writes nothing about the pair: it sends operation 81 and
 * the cards move when the store does (in LIVE: when the Core's delta arrives; `settle` runs `ok`
 * only once the store holds the command's revision, CL-16).
 *
 * **Never by itself.** `actions.switchAudioSource` is called from `confirm()` only, and `confirm()`
 * is the handler of the confirmation's button. A `MIC_SILENT` warning opens the same confirmation;
 * it never sends (OD-11).
 *
 * **The late stop (B11, row 62).** The gate reads the session's state from the store, so the commit
 * that shows the stop (row 62's wait point 3) is the commit that takes the toggle away, and a
 * confirmation left open closes with it: the monitor cannot send a switch for a recording the Core
 * has already stopped while the in-place hand-over is still on screen. Nothing here subscribes to
 * the store on its own or delays that commit; row 62's records are untouched.
 *
 * Errors: every refusal or failure is shown (the sentence on the cards for the three refusals ux
 * §3.5 names, else the Live presenter's toast, else this hook's toast) and written to the persistent runtime log (`dems.mobile.log.v1`) with
 * the refusal class, code and status only.
 *
 * Every function that calls a hook is named `use*` (D66: the device build runs the React Compiler).
 */
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { useToast } from 'heroui-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioTrackId } from '@dems/shared/domain';
import { settle, useCoreActions } from '@dems/shared/live';
import { Permission, selectOperator, selectRole, useSim, useSimInstance, type OperatorRole } from '@dems/shared/sim';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { triggerHaptic } from '@/motion';
import { reportRuntimeIssue, useCoreErrorPresenter, useCoreLink, useCoreLinkReadOnly, usePendingPress } from '@/runtime';
import { useMicInputName } from '@/features/capture-selector/development-source-badge';
import {
  inputOfChannel,
  isSessionHolder,
  micSourceRole,
  micSwitchGate,
  selectActiveInputId,
  selectStandbyInputId,
  silentInputOf,
  switchFailureFacts,
  switchRefusal,
  type MicSourceRole,
  type MicSwitchBlock,
  type SwitchRefusal, noSignalInputOf } from './mic-source-model';

export interface MicSourceView {
  readonly sessionId: string | null;
  readonly recording: boolean;
  /**
   * The pair as the Core holds it. Task 4 row 170 (site M4): each member is `null` when it is ABSENT - the
   * selector in force holds no line for it and the session states none. Nothing stands in for it.
   */
  readonly activeInputId: string | null;
  readonly standbyInputId: string | null;
  /** G4 / G5: why the toggle is not offered; `null` when it is. */
  readonly block: MicSwitchBlock | null;
  /** The input of an active `MIC_SILENT` warning while recording, or `null`. */
  readonly silentInputId: string | null;
  /** JA2-06: the input of an active `MIC_NO_SIGNAL` fault while recording, or `null`. */
  readonly noSignalInputId: string | null;
}

/** The active/standby pair, the gate of the toggle and the silence warning, in both data modes. */
export function useMicSource(): MicSourceView {
  const sessionId = useSim((s) => s.session?.id ?? null);
  const recording = useSim((s) => s.session?.state === 'RECORDING');
  const createdBy = useSim((s) => s.session?.createdBy ?? null);
  const activeInputId = useSim(selectActiveInputId);
  const standbyInputId = useSim(selectStandbyInputId);
  const operatorId = useSim((s) => selectOperator(s)?.id ?? null);
  const role: OperatorRole | null = useSim(selectRole);
  const faults = useSim((s) => s.faults.active);
  // The mobile role gate (FX-M2, W93-11): the store's role, which in LIVE follows `session.updated`.
  const gate = useRoleGate(Permission.SESSION_START);
  // S7: session actions are read-only while the Core link is down (the runtime's one rule, row M2).
  const linkDown = useCoreLinkReadOnly();

  const block = micSwitchGate({
    roleKnown: gate.known && operatorId !== null,
    linkDown,
    recording,
    canStart: gate.allowed,
    holder: isSessionHolder({ operatorId, role, createdBy }),
  });
  const micLines = useSim((s) => micLinesInForce(s));
  const silentInputId = useMemo(() => (recording ? silentInputOf(faults, activeInputId, micLines) : null), [recording, faults, activeInputId, micLines]);

  const noSignalInputId = useMemo(() => (recording ? noSignalInputOf(faults, activeInputId, micLines) : null), [recording, faults, activeInputId, micLines]);

  return { sessionId, recording, activeInputId, standbyInputId, block, silentInputId, noSignalInputId };
}

/**
 * What one MIC card says about its input: "Active" or "Standby" while a session records, `null`
 * otherwise. A primitive selector, so a card renders again only when its own word changes.
 */
export function useMicSourceRole(channel: AudioTrackId): MicSourceRole | null {
  return useSim((s) => (s.session?.state === 'RECORDING' ? micSourceRole(inputOfChannel(channel, micLinesInForce(s)), selectActiveInputId(s)) : null));
}

export interface MicSwitchControl {
  /** The confirmation is open. */
  readonly confirmOpen: boolean;
  /** Opens the confirmation; does nothing while the gate blocks the toggle or a command is out. */
  readonly ask: () => void;
  /** Closes the confirmation; ignored while the command is out (the answer decides). */
  readonly cancel: () => void;
  /** The operator confirmed: sends operation 81 for the standby input. One command at a time. */
  readonly confirm: () => void;
  /** LB-1: the command is out. */
  readonly busy: boolean;
  /** LB-1: out for `LIVE_PENDING_REVEAL_MS` or longer. */
  readonly pending: boolean;
  /** A refusal that stays on the cards (ux §3.5) until the next press. */
  readonly refusal: Exclude<SwitchRefusal, 'OTHER'> | null;
}

const SOURCE = 'sessionLive.switchAudioSource';

/**
 * The explicit, confirmed switch (ux §3.2 steps 2-7). The ONLY place of the app that calls
 * `actions.switchAudioSource`, and only from the operator's confirm.
 */
export function useMicSwitch(view: MicSourceView): MicSwitchControl {
  const { t } = useTranslation();
  const { toast } = useToast();
  const actions = useCoreActions();
  const sim = useSimInstance();
  const micName = useMicInputName();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const press = usePendingPress();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refusal, setRefusal] = useState<Exclude<SwitchRefusal, 'OTHER'> | null>(null);
  const { block, activeInputId, standbyInputId } = view;

  // The gate closed under an open confirmation (the recording stopped, the role changed, the link
  // dropped): the confirmation goes with it, unless the command is already out (the answer decides).
  // Render-time "adjust state when an input changed": no effect, no ref (React Compiler).
  if (confirmOpen && block !== null && !press.busy) setConfirmOpen(false);

  // Task 4 row 170: a switch needs BOTH members of the pair. With one absent there is nothing to switch from or
  // to: the confirmation is not opened and no command is sent (the panel does not draw the toggle then).
  const pairComplete = activeInputId !== null && standbyInputId !== null;

  const ask = () => {
    if (block !== null || press.busy || !pairComplete) return;
    setRefusal(null);
    setConfirmOpen(true);
  };
  const cancel = () => {
    if (!press.busy) setConfirmOpen(false);
  };
  const confirm = () => {
    if (block !== null || activeInputId === null || standbyInputId === null) return;
    const from = activeInputId;
    const to = standbyInputId;
    const started = press.run((release) => {
      // The id is the Core's own text (`MIC-NN`); the cast holds before and after the contract's id is widened.
      settle(() => actions.switchAudioSource(to as Parameters<typeof actions.switchAudioSource>[0]), {
        ok: () => {
          setConfirmOpen(false);
          // Read on the settle: the input the store holds, not the one that was asked for.
          // (Should the store state none at that moment, the input that was asked for is named.)
          const active = selectActiveInputId(sim.store.getState()) ?? to;
          toast.show({
            variant: 'success',
            label: t('session.audioSource.switched', { mic: micName(active) }),
            // Round two (JT-09): never over End Session - the confirmation is at the top, like the monitor's other two.
            placement: 'top',
            duration: 2500,
          });
          reportRuntimeIssue('info', SOURCE, 'Active microphone switched', { from, to, active });
        },
        fail: (error) => {
          setConfirmOpen(false);
          const facts = { from, to, ...switchFailureFacts(error) };
          // The three refusals ux §3.5 gives a fixed sentence are the cards' own, in both modes: the
          // mobile presenter would word a 409 of the Core as its generic "refused".
          const kind = switchRefusal(error);
          if (kind !== 'OTHER') {
            setRefusal(kind);
            reportRuntimeIssue('warn', SOURCE, error, facts);
            return;
          }
          // Live mode: a denial, an outage or a limit is the presenter's (one wording on every screen).
          if (live && presentCoreError(error)) {
            reportRuntimeIssue('warn', SOURCE, error, facts);
            return;
          }
          toast.show({ variant: 'danger', label: t('session.audioSource.failed') });
          reportRuntimeIssue('error', SOURCE, error, facts);
        },
        done: release,
      });
    });
    // ux §3.6: confirm + haptic + pending. One light impact for the press that sent the command.
    if (started) triggerHaptic('primaryPress');
  };

  return { confirmOpen, ask, cancel, confirm, busy: press.busy, pending: press.pending, refusal };
}
