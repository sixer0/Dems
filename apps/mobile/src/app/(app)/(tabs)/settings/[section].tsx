import { Redirect, useLocalSearchParams } from 'expo-router';
import { SettingsSectionScreen } from '@/features/settings/settings-section-screen';
import { parseSettingsSection, useDetailPaneHandover } from '@/navigation';

/**
 * Route `/settings/[section]` (04_mobile_specs §4.15 "Sections"). An unknown section returns to
 * the list. On medium and expanded windows the section opens in the list's pane, so this route
 * hands over to `/settings?selected=<section>` (§4.15, §2.5 rule 3).
 */
export default function SettingsSectionRoute() {
  const params = useLocalSearchParams<{ section: string }>();
  const section = parseSettingsSection(params.section);
  const handingOver = useDetailPaneHandover(section);
  if (section === null) return <Redirect href="/settings" />;
  if (handingOver) return null;
  return <SettingsSectionScreen section={section} />;
}
