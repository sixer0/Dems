/**
 * Archive confirmation (04_mobile_specs §4.10 E4 kebab, §4.11 D6 More → Archive; RBAC-gated). Kit
 * `Dialog`; the Core's `archiveEvidence` needs EVIDENCE_REVIEW (SUPERVISOR) and never archives a
 * RECORDED item, so the callers disable the entry otherwise and this dialog still handles a refusal
 * (toast + persistent log). The dialog is portalled above the simulator's provider, so the action is
 * a callback from the caller, which holds the simulator.
 */
import { Button, Dialog, useToast } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@dems/shared/tokens';
import { reportRuntimeIssue } from '@/runtime';

export interface ArchiveDialogProps {
  evidenceId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Runs the Core action; throws on refusal. */
  archive: (evidenceId: string) => void;
}

export function ArchiveDialog({ evidenceId, onOpenChange, archive }: ArchiveDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    if (evidenceId === null || busy) return;
    setBusy(true);
    try {
      archive(evidenceId);
      toast.show({ variant: 'success', label: t('features.evidence.actions.archived', { id: evidenceId }) });
    } catch (error) {
      reportRuntimeIssue('warn', 'evidence.archive', error, { evidenceId });
      toast.show({ variant: 'danger', label: t('features.evidence.actions.actionFailed') });
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
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
            <Button variant="danger" isDisabled={busy} onPress={confirm} testID="evidence-archive-confirm">
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
