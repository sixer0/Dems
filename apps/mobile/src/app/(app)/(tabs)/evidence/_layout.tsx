import { DrillInStack } from '@/navigation';

/** A deep link to a detail keeps the list underneath, so Back returns to it (04_mobile_specs §2.5). */
export const unstable_settings = { initialRouteName: 'index' };

/** `/evidence` stack: Evidence (MB 5, MB 6; 04_mobile_specs §4.10, §4.11); the list, and the detail pushed over it on single-pane windows. */
export default function EvidenceLayout() {
  return <DrillInStack />;
}
