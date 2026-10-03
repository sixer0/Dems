import { DrillInStack } from '@/navigation';

/** A deep link to a detail keeps the list underneath, so Back returns to it (04_mobile_specs §2.5). */
export const unstable_settings = { initialRouteName: 'index' };

/** `/sessions` stack: Sessions hub (04_mobile_specs §4.9); the list, and the detail pushed over it on single-pane windows. */
export default function SessionsLayout() {
  return <DrillInStack />;
}
