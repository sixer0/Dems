/**
 * Unpair confirmation (04_mobile_specs §4.2 "Unpair behind a Dialog"). Kit `Dialog`, mounted on
 * demand by the screen (`useDialogPresence`). The kit portals dialog content above the simulator
 * provider, so this component gets callbacks and plain values only, never simulator hooks (step 79
 * finding).
 *
 * LIVE mode (backend task W57; 04_client_integration_spec MP-7): the text says what an unpair costs
 * on a real Core (signed out, a new code from a supervisor), and while the request is out both
 * buttons wait for the answer. The simulator answers at once, so its dialog never shows that state.
 */
import { Button, Dialog, Spinner } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { palette, spacing } from '@dems/shared/tokens';

export interface UnpairDialogProps {
  isOpen: boolean;
  device: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** LIVE mode: the Core server is asked. */
  live?: boolean;
  /** LIVE mode: the request is out. */
  busy?: boolean;
}

export function UnpairDialog({ isOpen, device, onOpenChange, onConfirm, live = false, busy = false }: UnpairDialogProps) {
  const { t } = useTranslation();
  return (
    // While the request is out the dialog stays: the answer closes it.
    <Dialog isOpen={isOpen} onOpenChange={(open) => (busy ? undefined : onOpenChange(open))}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="pairing-unpair-dialog" style={styles.dialog}>
          <Dialog.Title>{t('features.pairing.unpair.title')}</Dialog.Title>
          <Dialog.Description>{live ? t('features.pairing.live.unpair.body') : t('features.pairing.unpair.body', { device })}</Dialog.Description>
          <View style={styles.actions}>
            <Button variant="outline" isDisabled={busy} onPress={() => onOpenChange(false)} testID="pairing-unpair-cancel">
              <Button.Label>{t('features.pairing.unpair.cancel')}</Button.Label>
            </Button>
            <Button variant="danger" isDisabled={busy} onPress={onConfirm} testID="pairing-unpair-confirm" {...(busy ? { accessibilityState: { busy: true, disabled: true } } : {})}>
              {busy ? <Spinner size="sm" color={palette.foreground} /> : null}
              <Button.Label>{t('features.pairing.unpair.confirm')}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  // Tablets: a readable column instead of a full-width dialog.
  dialog: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[3] },
});
