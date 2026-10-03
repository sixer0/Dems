/**
 * Unpair confirmation (04_mobile_specs §4.2 "Unpair behind a Dialog"). Kit `Dialog`, mounted on
 * demand by the screen (`useDialogPresence`). The kit portals dialog content above the simulator
 * provider, so this component gets callbacks and plain values only, never simulator hooks (step 79
 * finding).
 */
import { Button, Dialog } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@dems/shared/tokens';

export interface UnpairDialogProps {
  isOpen: boolean;
  device: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function UnpairDialog({ isOpen, device, onOpenChange, onConfirm }: UnpairDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="pairing-unpair-dialog" style={styles.dialog}>
          <Dialog.Title>{t('features.pairing.unpair.title')}</Dialog.Title>
          <Dialog.Description>{t('features.pairing.unpair.body', { device })}</Dialog.Description>
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => onOpenChange(false)} testID="pairing-unpair-cancel">
              <Button.Label>{t('features.pairing.unpair.cancel')}</Button.Label>
            </Button>
            <Button variant="danger" onPress={onConfirm} testID="pairing-unpair-confirm">
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
