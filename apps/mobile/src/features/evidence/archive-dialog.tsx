/**
 * Archive confirmation (04_mobile_specs §4.10 E4 kebab, §4.11 D6 More → Archive; RBAC-gated). Kit
 * `Dialog`; the Core's `archiveEvidence` needs EVIDENCE_REVIEW (SUPERVISOR) and never archives a
 * RECORDED item, so the callers disable the entry otherwise and this dialog still handles a refusal
 * (toast + persistent log). The dialog is portalled above the simulator's provider, so the action is
 * a callback from the caller, which holds the simulator.
 *
 * **Site S3-1** (backend task W74; 04_client_integration_spec §8.7 S3-1, §8.1 LB-1, LB-3, LB-5,
 * LB-6; AC-C-48, AC-C-63). The `archive` callback may return a promise (the Live source answers
 * after the Core server did), so the confirmation goes through `settle`:
 *
 * | Path | What the dialog does |
 * |------|----------------------|
 * | `ok` (the Core's 2xx; Simulated: the action returned) | the success toast, AFTER the answer |
 * | `fail` | Live: the refusal presenter first (a 403 is the denied toast that names the role, an outage the "Core server unreachable" toast); what it leaves, and every Simulated refusal, gets today's danger toast. Logged in both modes |
 * | `done` | busy cleared, the dialog closes |
 *
 * While the request is out the confirm button ignores presses and carries `accessibilityState.busy`;
 * its look does not change for `LIVE_PENDING_REVEAL_MS` on the store's clock, then the kit's
 * `Spinner` shows inside it (LB-1). In Simulated mode the action settles before `confirm` returns:
 * the dialog behaves exactly as before (toast, then close, in one handler).
 */
import { Button, Dialog, Spinner, useToast } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { LIVE_PENDING_REVEAL_MS, settle, type CoreResult } from '@dems/shared/live';
import { useSim, useSimInstance, type EpochMs } from '@dems/shared/sim';
import { spacing } from '@dems/shared/tokens';
import { reportRuntimeIssue, useCoreErrorPresenter, useCoreLink } from '@/runtime';

export interface ArchiveDialogProps {
  evidenceId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Runs the Core action: Simulated mode returns or throws; Live mode returns a promise that settles with the Core's answer. */
  archive: (evidenceId: string) => CoreResult<void>;
}

export function ArchiveDialog({ evidenceId, onOpenChange, archive }: ArchiveDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const sim = useSimInstance();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const [busy, setBusy] = useState(false);
  /** Live: the store's clock at the press while the request is out (LB-1); null otherwise. */
  const [pressedAt, setPressedAt] = useState<EpochMs | null>(null);
  const pending = useSim((s) => pressedAt !== null && s.clock.now - pressedAt >= LIVE_PENDING_REVEAL_MS);

  const confirm = () => {
    if (evidenceId === null || busy) return;
    setBusy(true);
    let settled = false;
    settle(() => archive(evidenceId), {
      ok: () => {
        toast.show({ variant: 'success', label: t('features.evidence.actions.archived', { id: evidenceId }) });
      },
      fail: (error) => {
        reportRuntimeIssue('warn', 'evidence.archive', error, { evidenceId });
        if (live && presentCoreError(error)) return;
        toast.show({ variant: 'danger', label: t('features.evidence.actions.actionFailed') });
      },
      done: () => {
        settled = true;
        setBusy(false);
        setPressedAt(null);
        onOpenChange(false);
      },
    });
    // Still out (Live mode): the store's clock decides when the spinner shows.
    if (!settled) setPressedAt(sim.store.getState().clock.now);
  };
  return (
    <Dialog isOpen={evidenceId !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="evidence-archive-dialog">
          <Dialog.Title>{t('features.evidence.actions.archiveTitle', { id: evidenceId ?? '' })}</Dialog.Title>
          <Dialog.Description>{t('features.evidence.actions.archiveBody')}</Dialog.Description>
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => onOpenChange(false)} testID="evidence-archive-cancel">
              <Button.Label>{t('features.evidence.actions.archiveCancel')}</Button.Label>
            </Button>
            <Button
              variant="danger"
              isDisabled={busy && !live}
              onPress={confirm}
              // The kit sets `accessibilityState` from `isDisabled`; a prop given here replaces it, so Simulated mode passes none.
              {...(live ? { accessibilityState: { busy, disabled: false } } : {})}
              testID="evidence-archive-confirm"
            >
              {pending ? <Spinner size="sm" testID="evidence-archive-pending" /> : null}
              <Button.Label>{t('features.evidence.actions.archiveConfirm')}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[1], marginTop: spacing[3] },
});
