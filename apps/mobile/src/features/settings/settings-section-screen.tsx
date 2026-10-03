/**
 * Settings section (04_mobile_specs §4.15 "Sections") at `/settings/[section]`; step 88. Replaces
 * step 70's stub; the export name, the props and the `SafeScreen id="settings-section"` root stay
 * (T-M02, MA-04). Single-pane windows push this route from the list; on medium and expanded the
 * route file hands the section over to the list's pane before this renders (§2.5 rule 3).
 */
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { spacing } from '@dems/shared/tokens';
import { SafeScreen } from '@/layout';
import type { SettingsSection } from '@/navigation/params';
import { SectionBody } from './section-body';
import { SECTION_TITLE_KEYS } from './settings-model';
import { SettingsHeader } from './settings-list';

export interface SettingsSectionScreenProps {
  /** Validated section (`settingsSectionSchema`: preferences, notifications, security, maintenance, about). */
  readonly section: SettingsSection;
}

export function SettingsSectionScreen({ section }: SettingsSectionScreenProps) {
  const { t } = useTranslation();
  return (
    <SafeScreen id="settings-section">
      <SettingsHeader title={t(SECTION_TITLE_KEYS[section])} showBack testID="settings-section-header" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID={`settings-section-${section}`}>
        <SectionBody section={section} />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[3], paddingBottom: spacing[4] },
});
