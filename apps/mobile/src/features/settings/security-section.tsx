/**
 * Settings → Security & Privacy (04_mobile_specs §4.15 `security`; §6.3, §6.4):
 *
 * - Biometric sign-in `Switch` with the hardware and enrolment status, bound to the signed-in
 *   operator through the runtime auth (`useAuthSession().setBiometricEnabled`).
 * - Auto-lock 5 / 15 / 30 min: the simulator's idle timeout is a fixed 15-minute policy, so 15 is
 *   selected and the other values are shown disabled (SIM-GAP-M88-1).
 * - Core pairing → `/pair`, Operator audit → `/audit`. LIVE: beside the pairing row, the Core server address in
 *   force, read-only (row 236, D263; it is set on the Pair screen before pairing).
 * - Lock console and Sign out (brief; also in the Profile sheet). Neither touches a recording.
 *
 * LIVE mode (backend task W82, finding CPM1-1; 04_client_integration_spec §9.3 MB-1, MB-6a; AC-C-68):
 * the switch is the Core's biometric sign-in. Its description never says "simulated" and never
 * claims hardware protection: it is worded on how the token is stored (`biometric.protected`). In a
 * session created with the fingerprint (`biometric.changeBlocked`) the switch is disabled with the
 * MB-1 sentence; the auth layer sends nothing there either. SIMULATED and HEARTBEAT: as before.
 */
import { useRouter } from 'expo-router';
import { Button, useToast } from 'heroui-native';
import { Link2, Lock, LogOut, ScrollText } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSim, type SimState } from '@dems/shared/sim';
import { fontFamily, palette, spacing } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { formatCoreAddress, reportRuntimeIssue, useAuth, useCoreAddress, useCoreLink } from '@/runtime';
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
  const live = useCoreLink().source === 'LIVE';
  const coreAddress = formatCoreAddress(useCoreAddress());
  const operator = auth.operator;
  const { refreshBiometricAvailability } = session;

  useEffect(() => {
    void refreshBiometricAvailability();
  }, [refreshBiometricAvailability]);

  const biometric = biometricSwitchView(
    session.biometric.availability,
    session.biometric.enabled,
    session.biometric.lastOperatorId,
    operator?.id ?? null,
    live ? { changeBlocked: session.biometric.changeBlocked, protected: session.biometric.protected } : undefined,
  );
  const status = biometric.boundToOther
    ? t('features.settings.security.biometricBoundOther', { name: session.biometric.lastOperator?.displayName ?? '' })
    : t(biometric.statusKey);
  // SIMULATED and HEARTBEAT: exactly the former line. LIVE: the note keys are whole sentences; in a
  // biometric session the MB-1 sentence stands alone.
  const description = !live ? `${status} ${t(biometric.noteKey)}.` : biometric.changeBlocked ? t(biometric.noteKey) : `${status} ${t(biometric.noteKey)}`;

  const setBiometric = (on: boolean) => {
    // MB-1: in a session created with the fingerprint biometric sign-in is not changed at all (the switch
    // is disabled; this also holds for a press that reaches the handler).
    if (biometric.changeBlocked) return;
    session.setBiometricEnabled(on).catch((error: unknown) => {
      // LIVE: the Core or the tablet's storage did not take the change, so nothing changed (MB-1, MB-2);
      // the SIMULATED sentence ("it applies until the app restarts") would not be true there.
      toast.show({ variant: 'danger', label: t(live ? 'features.settings.live.biometricFailed' : 'features.settings.saveFailed') });
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
          description={description}
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
        {live ? (
          // D263: read-only here; the address changes on the Pair screen, before pairing.
          <View key="coreAddress" style={styles.infoRow} testID="settings-security-core-address" accessible accessibilityLabel={`${t('features.settings.security.coreAddress')}, ${coreAddress}`}>
            <Text maxFontSizeMultiplier={1.2} style={settingsStyles.strong}>
              {t('features.settings.security.coreAddress')}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={[settingsStyles.muted, styles.mono]} testID="settings-security-core-address-value">
              {coreAddress}
            </Text>
          </View>
        ) : null}
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
  infoRow: { gap: 2, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  mono: { fontFamily: fontFamily.native.mono },
});
