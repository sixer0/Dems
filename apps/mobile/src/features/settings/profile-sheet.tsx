/**
 * Profile `BottomSheet` from the Account row (04_mobile_specs §4.15 G2): role, the role's demo
 * permissions (S20), Lock console and Sign out. Portalled content cannot read the runtime
 * contract, so the operator and the two actions come in as props (F-79-2 note).
 *
 * S5-7 (backend task W82; 04_client_integration_spec §8.7): the list is the role's row of the shared
 * table in both modes (the Core is seeded from it, [SP:AC-B-17], and W16 added three SUPERVISOR
 * grants); the role is the signed-in operator's, so in LIVE mode it follows the Core (a role change
 * pushed by the Core re-renders the list). A display hint only: the Core decides every call. In LIVE
 * the heading and the note say so instead of "demo" and "simulated" (`live` prop; portalled content
 * cannot read the runtime contract).
 */
import { Avatar, Button } from 'heroui-native';
import { Check, Lock, LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing } from '@dems/shared/tokens';
import type { AuthOperator } from '@/runtime';
import { permissionsOf } from './settings-model';
import { SheetFrame } from './sheet-frame';
import { settingsStyles } from './settings-controls';

export interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  operator: AuthOperator | null;
  onLockConsole: () => void;
  onSignOut: () => void;
  /** LIVE mode: the Core server is the Core (the heading and the note of the permission list). */
  live?: boolean;
}

export function ProfileSheet({ isOpen, onClose, operator, onLockConsole, onSignOut, live = false }: ProfileSheetProps) {
  const { t } = useTranslation();
  return (
    <SheetFrame isOpen={isOpen && operator !== null} onClose={onClose} title={t('shell.userMenu.profile')} testID="settings-profile-sheet">
      {operator ? (
        <>
          <View style={styles.identity}>
            <Avatar size="lg" color="accent" variant="soft" alt={operator.displayName}>
              <Avatar.Fallback>{operator.initials}</Avatar.Fallback>
            </Avatar>
            <View style={styles.identityText}>
              <Text maxFontSizeMultiplier={1.2} style={settingsStyles.strong} testID="settings-profile-name">
                {operator.displayName}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={settingsStyles.body} testID="settings-profile-role">
                {t('shell.userMenu.role', { role: t(`common.roles.${operator.role}`) })}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
                {t('features.settings.account.operatorId')}: {operator.id}
                {operator.username ? ` · ${t('features.settings.account.username')}: ${operator.username}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.permissions} testID="settings-profile-permissions">
            <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={settingsStyles.strong}>
              {t(live ? 'features.settings.live.permissions' : 'features.settings.account.permissions')}
            </Text>
            {permissionsOf(operator.role).map((permission) => (
              <View key={permission} style={settingsStyles.row} testID={`settings-profile-permission-${permission}`}>
                <Check size={16} color={palette.success} />
                <Text maxFontSizeMultiplier={1.2} style={settingsStyles.body}>
                  {t(`securityAudit.rbac.permissions.${permission}`)}
                </Text>
              </View>
            ))}
            <Text maxFontSizeMultiplier={1.2} style={settingsStyles.muted}>
              {t(live ? 'features.settings.live.permissionsNote' : 'features.settings.account.permissionsNote')}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button testID="settings-profile-lock" variant="outline" size="lg" onPress={onLockConsole} style={styles.action}>
              <Lock size={18} color={palette.gold} />
              <Button.Label>{t('shell.userMenu.lockConsole')}</Button.Label>
            </Button>
            <Button testID="settings-profile-sign-out" variant="danger-soft" size="lg" onPress={onSignOut} style={styles.action}>
              <LogOut size={18} color={palette.danger} />
              <Button.Label>{t('shell.userMenu.signOut')}</Button.Label>
            </Button>
          </View>
        </>
      ) : null}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  identityText: { flex: 1, gap: 2 },
  permissions: { gap: spacing[1] },
  actions: { flexDirection: 'row', gap: spacing[2] },
  action: { flex: 1 },
});
