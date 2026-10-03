/**
 * Settings → Security & Privacy (04_mobile_specs §4.15 `security`; §6.3, §6.4):
 *
 * - Biometric sign-in `Switch` with the hardware and enrolment status, bound to the signed-in
 *   operator through the runtime auth (`useAuthSession().setBiometricEnabled`).
 * - Auto-lock 5 / 15 / 30 min: the simulator's idle timeout is a fixed 15-minute policy, so 15 is
 *   selected and the other values are shown disabled (SIM-GAP-M88-1).
 * - Core pairing → `/pair`, Operator audit → `/audit`.
 * - Lock console and Sign out (brief; also in the Profile sheet). Neither touches a recording.
 */
import { useRouter } from 'expo-router';
import { Button, useToast } from 'heroui-native';
import { Link2, Lock, LogOut, ScrollText } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim, type SimState } from '@dems/shared/sim';
import { palette, spacing } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { reportRuntimeIssue, useAuth } from '@/runtime';
import { AUTO_LOCK_CHOICES, AUTO_LOCK_POLICY_MINUTES, biometricSwitchView } from './settings-model';
import { GroupCard, NavRow, SectionStack, SegmentRow, SwitchRow, settingsStyles } from './settings-controls';

const selectPairingState = (s: SimState) => s.pairing.state;

export function SecuritySection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const session = useAuthSession();
  const pairingState = useSim(selectPairingState);
  const operator = auth.operator;
  const { refreshBiometricAvailability } = session;

  useEffect(() => {
    void refreshBiometricAvailability();
  }, [refreshBiometricAvailability]);

  const biometric = biometricSwitchView(session.biometric.availability, session.biometric.enabled, session.biometric.lastOperatorId, operator?.id ?? null);
  const status = biometric.boundToOther
    ? t('features.settings.security.biometricBoundOther', { name: session.biometric.lastOperator?.displayName ?? '' })
    : t(biometric.statusKey);

  const setBiometric = (on: boolean) => {
    session.setBiometricEnabled(on).catch((error: unknown) => {
      toast.show({ variant: 'danger', label: t('features.settings.saveFailed') });
      reportRuntimeIssue('error', 'settings.security.setBiometric', error, { enabled: on });
    });
  };

  return (
    <SectionStack testID="settings-security">
      <GroupCard title={t('features.settings.security.biometric')} index={0} testID="settings-security-signin">
        <SwitchRow
          key="biometric"
          testID="settings-biometric"
          label={t('features.settings.security.biometric')}
          description={`${status} ${t('mobile.biometric.identityNote')}.`}
          isSelected={biometric.selected}
          isDisabled={biometric.disabled}
          onChange={setBiometric}
        />
        <SegmentRow<string>
          key="auto-lock"
          testID="settings-auto-lock"
          label={t('features.settings.security.autoLock')}
          description={t('features.settings.security.autoLockHint')}
          value={String(AUTO_LOCK_POLICY_MINUTES)}
          options={AUTO_LOCK_CHOICES.map((minutes) => ({
            value: String(minutes),
            label: t('features.settings.security.autoLockMinutes', { count: minutes }),
            isDisabled: minutes !== AUTO_LOCK_POLICY_MINUTES,
          }))}
          onChange={() => undefined}
        />
      </GroupCard>

      <GroupCard title={t('features.settings.security.sessionGroup')} index={1} testID="settings-security-links">
        <NavRow
          key="pairing"
          testID="settings-security-pairing"
          prefix={<Link2 size={22} color={palette.gold} />}
          label={t('features.settings.security.pairing')}
          description={t(`mobile.pairing.state.${pairingState}`, { defaultValue: pairingState })}
          onPress={() => router.push('/pair')}
        />
        <NavRow
          key="audit"
          testID="settings-security-audit"
          prefix={<ScrollText size={22} color={palette.gold} />}
          label={t('features.settings.security.audit')}
          description={t('features.settings.security.auditHint')}
          onPress={() => router.push('/audit')}
        />
      </GroupCard>

      {operator ? (
        <View style={styles.actions}>
          <Button testID="settings-security-lock" variant="outline" size="lg" onPress={() => session.lockConsole()}>
            <Lock size={18} color={palette.gold} />
            <Button.Label>{t('shell.userMenu.lockConsole')}</Button.Label>
          </Button>
          <Button testID="settings-security-sign-out" variant="danger-soft" size="lg" onPress={() => auth.signOut('USER')}>
            <LogOut size={18} color={palette.danger} />
            <Button.Label>{t('shell.userMenu.signOut')}</Button.Label>
          </Button>
          <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
            {t('features.settings.security.signOutHint')}
          </Text>
        </View>
      ) : null}
    </SectionStack>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing[2] },
});
