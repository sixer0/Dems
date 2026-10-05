/**
 * The two global auth dialogs (04_mobile_specs §4.19, §6.3), rendered once by `AuthProvider` so they
 * survive the route change a sign-in or an expiry causes:
 * - `IdleLockDialog`: "Session expired" after 15 min without interaction (01S §14.8); recording
 *   is unaffected;
 * - `BiometricOfferDialog`: after a password sign-in, "Enable biometric sign-in on this tablet?".
 */
import { Button, Dialog } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@dems/shared/tokens';
import { AUTH_IDLE_TIMEOUT_MS } from '@dems/shared/sim';

export interface IdleLockDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  /**
   * Why the session expired, in one sentence. Default: the 15 minutes without activity. LIVE mode
   * passes the sentence of the 8-hour limit when that is what ended the session (WS-14).
   */
  reason?: string;
}

export function IdleLockDialog({ isOpen, onDismiss, reason }: IdleLockDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => (open ? undefined : onDismiss())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="idle-lock-dialog">
          <Dialog.Title>{t('mobile.idleLock.title')}</Dialog.Title>
          <Dialog.Description>
            {`${reason ?? t('login.notices.sessionExpired', { minutes: AUTH_IDLE_TIMEOUT_MS / 60_000 })} ${t('mobile.idleLock.recording')}`}
          </Dialog.Description>
          <View style={styles.actions}>
            <Button testID="idle-lock-confirm" variant="primary" onPress={onDismiss}>
              <Button.Label>{t('mobile.idleLock.confirm')}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

export interface BiometricOfferDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /**
   * What biometric sign-in is, in one sentence. Default: "Simulated identity binding", which is
   * what it is with the simulator. LIVE mode passes its own sentence: nothing there is simulated,
   * and the sentence must not claim hardware protection (04_client_integration_spec MB-6a).
   */
  note?: string;
}

export function BiometricOfferDialog({ isOpen, onAccept, onDecline, note }: BiometricOfferDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => (open ? undefined : onDecline())}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content testID="biometric-offer-dialog">
          <Dialog.Title>{t('mobile.biometric.enableOffer')}</Dialog.Title>
          <Dialog.Description>{note ?? t('mobile.biometric.identityNote')}</Dialog.Description>
          <View style={styles.actions}>
            <Button testID="biometric-offer-enable" variant="primary" onPress={onAccept}>
              <Button.Label>{t('mobile.biometric.enable')}</Button.Label>
            </Button>
            <Button testID="biometric-offer-decline" variant="outline" onPress={onDecline}>
              <Button.Label>{t('mobile.biometric.notNow')}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing[1], marginTop: spacing[3] } });
