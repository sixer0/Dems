/**
 * Confirmation for the device commands (04_mobile_specs §4.12 V5: "Test signal" and "Restart"
 * behind `Dialog`). The dialog is portalled above the simulator's provider, so the command runs
 * through the caller's `onConfirm`, which holds the actions; a refusal shows a friendly toast and
 * goes to the persistent runtime log (no raw error reaches the operator).
 *
 * Settle site S3-2 (backend task W78; 04_client_integration_spec §8.7, AC-C-63): `onConfirm` may
 * return a promise (Live mode). The dialog keeps its busy state until the command settles, shows the
 * success toast in `ok` and the danger toast in `fail`, and closes in `done`: the success toast never
 * shows before the Core's 2xx. LB-1: from the press the confirm button ignores further presses
 * (marked busy, its look unchanged); after `LIVE_PENDING_REVEAL_MS` the kit's `Spinner` shows in it.
 * While the command is out the dialog does not close by itself.
 *
 * | The command rejected with (Live mode) | What the operator sees |
 * |---|---|
 * | a denial, an outage, a limit, a refused action (`useCoreErrorPresenter`, LB-5 to LB-10) | the presenter's one toast (the denied toast names the role, AC-C-48) |
 * | 409 `RECORDING_ACTIVE` (a recording started on the Core, D89) | danger: "Not available while recording" |
 * | 409 `COMMAND_UNSUPPORTED` | danger: "{{name}} does not accept this command." |
 * | 404 (a device the Core does not have) | danger: "This device is not part of this room." |
 * | anything else | danger: "The action could not be completed. Please try again." |
 *
 * In Simulated mode every branch is as before: the command settles at once, a throw shows the
 * generic danger toast, and the copy says "simulated".
 */
import { settle, type CoreResult } from '@dems/shared/live';
import { SimErrorCode, SimNotFoundError, SimTransitionError, type DeviceCommand } from '@dems/shared/sim';
import { Button, Dialog, useToast } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { palette, spacing } from '@dems/shared/tokens';
import { PendingSpinner, busyState, reportRuntimeIssue, useCoreErrorPresenter } from '@/runtime';
import { usePendingPress } from './use-pending-press';

export interface DeviceCommandDialogProps {
  /** The command to confirm, or null when closed. */
  command: DeviceCommand | null;
  deviceId: string;
  /** Short display name ("Camera 1", "MIC 2"). */
  deviceName: string;
  /** The Core link source is LIVE (`useCoreLink().source === 'LIVE'`): the Core's words, its refusals. */
  live?: boolean;
  onClose: () => void;
  /** Runs the command; throws (Simulated mode) or rejects (Live mode) on refusal. */
  onConfirm: (command: DeviceCommand) => CoreResult<void>;
}

/** The danger toast of a refusal the presenter left to this dialog (Live mode). */
function liveRefusalLabel(error: unknown, deviceName: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (error instanceof SimTransitionError && error.code === SimErrorCode.RECORDING_ACTIVE) return t('devices.actions.restartWhileRecording');
  if (error instanceof SimTransitionError && error.code === SimErrorCode.COMMAND_UNSUPPORTED) return t('features.devices.live.unsupported', { name: deviceName });
  if (error instanceof SimNotFoundError) return t('features.devices.detail.notFound');
  return t('devices.actions.failed');
}

/** A 409 is an answer the Core expects to give (D89): a warning in the log, not an error. */
function isExpectedRefusal(error: unknown): boolean {
  return error instanceof SimTransitionError && (error.code === SimErrorCode.RECORDING_ACTIVE || error.code === SimErrorCode.COMMAND_UNSUPPORTED);
}

export function DeviceCommandDialog({ command, deviceId, deviceName, live = false, onClose, onConfirm }: DeviceCommandDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const presentCoreError = useCoreErrorPresenter();
  const press = usePendingPress();
  const restart = command === 'RESTART';
  const confirm = () => {
    if (command === null) return;
    press.run((release) => {
      settle(() => onConfirm(command), {
        ok: () => {
          toast.show({
            variant: 'success',
            label: live
              ? restart
                ? t('features.devices.live.restarted', { name: deviceName })
                : t('features.devices.live.testSignalSent', { name: deviceName })
              : restart
                ? t('devices.actions.restarted', { name: deviceName })
                : t('devices.actions.testSignalSent', { name: deviceName }),
          });
        },
        fail: (error) => {
          // Live mode: a denial, an outage or a limit is the presenter's (one wording on every screen).
          if (live && presentCoreError(error)) {
            reportRuntimeIssue('warn', 'devices.command', error, { deviceId, command });
            return;
          }
          reportRuntimeIssue(live && isExpectedRefusal(error) ? 'warn' : 'error', 'devices.command', error, { deviceId, command });
          toast.show({ variant: 'danger', label: live ? liveRefusalLabel(error, deviceName, t) : t('devices.actions.failed') });
        },
        done: () => {
          release();
          onClose();
        },
      });
    });
  };
  const cancel = () => {
    // The answer closes the dialog while the command is out.
    if (press.busy) return;
    onClose();
  };
  return (
    <Dialog isOpen={command !== null} onOpenChange={(open) => (open ? undefined : cancel())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="device-command-dialog">
          <Dialog.Title>
            {restart ? t('features.devices.actions.restartTitle', { name: deviceName }) : t('features.devices.actions.testSignalTitle', { name: deviceName })}
          </Dialog.Title>
          <Dialog.Description>
            {live
              ? restart
                ? t('features.devices.live.restartBody')
                : t('features.devices.live.testSignalBody')
              : restart
                ? t('features.devices.actions.restartBody')
                : t('features.devices.actions.testSignalBody')}
          </Dialog.Description>
          <View style={styles.actions}>
            <Button variant="outline" isDisabled={press.pending} onPress={cancel} testID="device-command-cancel">
              <Button.Label>{t('features.devices.actions.cancel')}</Button.Label>
            </Button>
            <Button variant={restart ? 'danger' : 'primary'} onPress={confirm} testID="device-command-confirm" accessibilityLabel={t('features.devices.actions.confirm')} {...busyState(press.busy)}>
              {press.pending ? <PendingSpinner color={palette.foreground} testID="device-command-spinner" /> : null}
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
