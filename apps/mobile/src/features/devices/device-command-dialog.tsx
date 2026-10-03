/**
 * Confirmation for the simulated device commands (04_mobile_specs §4.12 V5: "Test signal" and
 * "Restart" (simulated) behind `Dialog`). The dialog is portalled above the simulator's provider,
 * so the command runs through the caller's `onConfirm`, which holds the simulator; a refusal shows
 * a friendly toast and goes to the persistent runtime log (no raw error reaches the operator).
 */
import type { DeviceCommand } from '@dems/shared/sim';
import { Button, Dialog, useToast } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@dems/shared/tokens';
import { reportRuntimeIssue } from '@/runtime';

export interface DeviceCommandDialogProps {
  /** The command to confirm, or null when closed. */
  command: DeviceCommand | null;
  deviceId: string;
  /** Short display name ("Camera 1", "MIC 2"). */
  deviceName: string;
  onClose: () => void;
  /** Runs the simulator command; throws on refusal. */
  onConfirm: (command: DeviceCommand) => void;
}

export function DeviceCommandDialog({ command, deviceId, deviceName, onClose, onConfirm }: DeviceCommandDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const restart = command === 'RESTART';
  const confirm = () => {
    if (command === null || busy) return;
    setBusy(true);
    try {
      onConfirm(command);
      toast.show({
        variant: 'success',
        label: restart ? t('devices.actions.restarted', { name: deviceName }) : t('devices.actions.testSignalSent', { name: deviceName }),
      });
    } catch (error) {
      reportRuntimeIssue('error', 'devices.command', error, { deviceId, command });
      toast.show({ variant: 'danger', label: t('devices.actions.failed') });
    } finally {
      setBusy(false);
      onClose();
    }
  };
  return (
    <Dialog isOpen={command !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="device-command-dialog">
          <Dialog.Title>
            {restart ? t('features.devices.actions.restartTitle', { name: deviceName }) : t('features.devices.actions.testSignalTitle', { name: deviceName })}
          </Dialog.Title>
          <Dialog.Description>
            {restart ? t('features.devices.actions.restartBody') : t('features.devices.actions.testSignalBody')}
          </Dialog.Description>
          <View style={styles.actions}>
            <Button variant="outline" onPress={onClose} testID="device-command-cancel">
              <Button.Label>{t('features.devices.actions.cancel')}</Button.Label>
            </Button>
            <Button variant={restart ? 'danger' : 'primary'} isDisabled={busy} onPress={confirm} testID="device-command-confirm">
              <Button.Label>{t('features.devices.actions.confirm')}</Button.Label>
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
