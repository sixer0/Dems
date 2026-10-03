/**
 * The MB 10 list (04_mobile_specs §4.15 G1–G4): header (back + "Settings"), the Account card
 * (avatar initials, role, name, chevron → Profile sheet), Application (App Preferences,
 * Notifications, Security & Privacy) and System (Device Settings, Storage Management, Network &
 * Time, System Maintenance, About DEMS). On medium and expanded it is the 320 dp categories pane and
 * marks the open section.
 */
import { useRouter } from 'expo-router';
import { Avatar, Button } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { useLayoutClass } from '@/layout';
import type { SettingsSection } from '@/navigation/params';
import type { AuthOperator } from '@/runtime';
import { rowsOf, type SettingsRowDef, type SettingsRouteHref } from './settings-model';
import { GroupCard, NavRow } from './settings-controls';

export interface SettingsListProps {
  operator: AuthOperator | null;
  /** The section shown in the pane (multi-pane only), for the selected row. */
  selected: SettingsSection | null;
  onOpenSection: (section: SettingsSection) => void;
  onOpenRoute: (href: SettingsRouteHref) => void;
  onOpenProfile: () => void;
}

export function SettingsList({ operator, selected, onOpenSection, onOpenRoute, onOpenProfile }: SettingsListProps) {
  const { t } = useTranslation();
  const { isMultiPane } = useLayoutClass();

  const renderRow = (row: SettingsRowDef) => {
    const label = t(row.labelKey);
    const target = row.target;
    return (
      <NavRow
        key={row.id}
        testID={`settings-row-${row.id}`}
        icon={row.icon}
        label={label}
        accessibilityHint={
          target.kind === 'section' ? t('features.settings.rows.sectionHint', { section: label }) : t('features.settings.rows.screenHint', { screen: label })
        }
        selected={isMultiPane && target.kind === 'section' && target.section === selected}
        onPress={() => (target.kind === 'section' ? onOpenSection(target.section) : onOpenRoute(target.href))}
      />
    );
  };

  return (
    <View style={styles.column} testID="settings-list">
      <SettingsHeader title={t('system.settings.title')} showBack={!isMultiPane} testID="settings-header" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GroupCard title={t('system.settings.account')} index={0} testID="settings-account">
          {operator ? (
            <NavRow
              key="account"
              testID="settings-account-row"
              prefix={
                <Avatar size="lg" color="accent" variant="soft" alt={operator.displayName}>
                  <Avatar.Fallback>{operator.initials}</Avatar.Fallback>
                </Avatar>
              }
              label={t(`common.roles.${operator.role}`)}
              description={operator.displayName}
              accessibilityLabel={t('features.settings.account.rowLabel', { role: t(`common.roles.${operator.role}`), name: operator.displayName })}
              accessibilityHint={t('features.settings.account.rowHint')}
              onPress={onOpenProfile}
            />
          ) : (
            <Text key="signed-out" style={styles.signedOut}>
              {t('features.settings.account.signedOut')}
            </Text>
          )}
        </GroupCard>
        <GroupCard title={t('system.settings.groupApplication')} index={1} testID="settings-group-application">
          {rowsOf('application').map(renderRow)}
        </GroupCard>
        <GroupCard title={t('system.settings.groupSystem')} index={2} testID="settings-group-system">
          {rowsOf('system').map(renderRow)}
        </GroupCard>
      </ScrollView>
    </View>
  );
}

export interface SettingsHeaderProps {
  title: string;
  showBack: boolean;
  testID: string;
  /** Default: back in history, or More when the screen was opened by a deep link. */
  onBack?: () => void;
}

/** G1: back arrow + title (56 dp; 48 dp on a landscape phone; 64 dp pane header on tablets, §2.3). */
export function SettingsHeader({ title, showBack, testID, onBack }: SettingsHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { layoutClass, isMultiPane } = useLayoutClass();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/more')));
  return (
    <View style={[styles.header, layoutClass === 'compact-landscape' ? styles.headerCondensed : null, isMultiPane ? styles.headerPane : null]} testID={testID}>
      {showBack ? (
        <Button testID={`${testID}-back`} isIconOnly size="lg" variant="ghost" onPress={back} accessibilityLabel={t('features.settings.back')}>
          <ArrowLeft size={24} color={palette.gold} />
        </Button>
      ) : null}
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1 },
  scroll: { flex: 1 },
  content: { gap: spacing[3], paddingHorizontal: spacing[3], paddingBottom: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[1] },
  headerCondensed: { minHeight: 48 },
  headerPane: { minHeight: 64, paddingHorizontal: spacing[3] },
  title: {
    flex: 1,
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  signedOut: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    color: palette.gray,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
});
