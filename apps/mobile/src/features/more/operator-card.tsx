/**
 * Operator header card (04_mobile_specs §4.17 "an operator header card (Avatar, name, role)";
 * MB 10 Account row language). The signed-in operator from `useAuth()`, the role chip, the
 * operator id and the sign-in time (simulator clock, UTC+07:00), then Lock console and Sign out.
 *
 * Sign-out and Lock console never touch a recording (§3.3, §6.4): while a session is busy the
 * card says so. Both actions are logged persistently if they throw, with a toast for the operator.
 */
import { Avatar, Button, Separator, useToast } from 'heroui-native';
import { Lock, LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate } from '@dems/shared/realtime';
import { useSim } from '@dems/shared/sim';
import { fontFamily, palette, toneTextHex, typography } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { SectionCard, StatusChip } from '@/components/kit';
import { isSessionBusy } from '@/navigation/session-routes';
import { reportRuntimeIssue, useAuth } from '@/runtime';
import { selectSessionStateFlat, selectSignedInAt } from './more-model';

export function OperatorCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const auth = useAuth();
  const session = useAuthSession();
  const signedInAt = useSim(selectSignedInAt);
  const busy = isSessionBusy(useSim(selectSessionStateFlat));
  const operator = auth.operator;
  if (!operator) return null;

  const role = t(`common.roles.${operator.role}`);

  const lock = () => {
    try {
      session.lockConsole();
    } catch (error) {
      reportRuntimeIssue('error', 'more.operator.lockConsole', error, { operatorId: operator.id });
      toast.show({ variant: 'danger', label: t('common.errors.generic') });
    }
  };

  const signOut = () => {
    try {
      auth.signOut('USER');
    } catch (error) {
      reportRuntimeIssue('error', 'more.operator.signOut', error, { operatorId: operator.id });
      toast.show({ variant: 'danger', label: t('common.errors.generic') });
    }
  };

  return (
    <SectionCard testID="more-operator" accessibilityLabel={t('features.more.operator.label')}>
      <View
        style={styles.identity}
        accessible
        accessibilityLabel={t('features.more.operator.a11y', { name: operator.displayName, role, id: operator.id })}
      >
        <View style={styles.avatarRing}>
          <Avatar size="lg" color="accent" variant="soft" alt={operator.displayName}>
            <Avatar.Fallback testID="more-operator-initials">{operator.initials}</Avatar.Fallback>
          </Avatar>
        </View>
        <View style={styles.identityText}>
          <Text testID="more-operator-name" numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.name}>
            {operator.displayName}
          </Text>
          <View style={styles.metaRow}>
            <StatusChip testID="more-operator-role" tone="accent" label={role} icon="ShieldCheck" size="sm" />
            <Text testID="more-operator-id" maxFontSizeMultiplier={1.2} style={styles.mono}>
              {operator.id}
            </Text>
          </View>
          {signedInAt !== null ? (
            <Text testID="more-operator-since" maxFontSizeMultiplier={1.2} style={styles.caption}>
              {t('features.more.operator.signedInAt', { time: formatDate(signedInAt, 'HH:mm') })}
            </Text>
          ) : null}
        </View>
      </View>

      <Separator />

      <View style={styles.actions}>
        <Button
          testID="more-lock"
          variant="outline"
          size="md"
          className="flex-1"
          accessibilityHint={t('features.more.operator.lockHint')}
          onPress={lock}
        >
          <Lock size={16} color={palette.gold} />
          <Button.Label>{t('shell.userMenu.lockConsole')}</Button.Label>
        </Button>
        <Button
          testID="more-sign-out"
          variant="danger-soft"
          size="md"
          className="flex-1"
          accessibilityHint={t('features.more.operator.signOutHint')}
          onPress={signOut}
        >
          <LogOut size={16} color={toneTextHex.danger} />
          <Button.Label>{t('shell.userMenu.signOut')}</Button.Label>
        </Button>
      </View>
      {busy ? (
        <Text testID="more-operator-recording-note" maxFontSizeMultiplier={1.2} style={styles.note}>
          {t('mobile.idleLock.recording')}
        </Text>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: {
    borderRadius: 999,
    padding: 2,
    borderWidth: 1,
    borderColor: palette.gold,
  },
  identityText: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mono: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
  },
  caption: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  actions: { flexDirection: 'row', gap: 10 },
  note: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: toneTextHex.info,
  },
});
