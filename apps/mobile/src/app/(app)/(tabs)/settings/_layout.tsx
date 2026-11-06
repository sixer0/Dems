import { DrillInStack } from '@/navigation';

/** A deep link to a section keeps the list underneath, so Back returns to it (04_mobile_specs §2.5). */
export const unstable_settings = { initialRouteName: 'index' };

/** `/settings` stack: Settings (MB 10; 04_mobile_specs §4.15); the list, and a section pushed over it on single-pane windows. */
export default function SettingsLayout() {
  return <DrillInStack />;
}
