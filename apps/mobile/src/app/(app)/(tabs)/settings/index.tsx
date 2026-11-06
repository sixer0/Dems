import { useLocalSearchParams } from 'expo-router';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { parseSettingsSection, useSelectionPush } from '@/navigation';

/**
 * Route `/settings` (under More on phones; MB 10; 04_mobile_specs §4.15). `?selected=<section>`
 * opens the section pane on medium and expanded windows; on single-pane windows it becomes the
 * pushed section route (§2.4, §2.5 rule 3).
 */
export default function SettingsRoute() {
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const selectedSection = parseSettingsSection(selected);
  useSelectionPush('/settings', selectedSection);
  return <SettingsScreen selectedSection={selectedSection} />;
}
