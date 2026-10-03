import { useLocalSearchParams } from 'expo-router';
import { SessionsScreen } from '@/features/sessions/sessions-screen';
import { parseRecordId, useSelectionPush } from '@/navigation';

/**
 * Route `/sessions` (tab Sessions; 04_mobile_specs §4.9). `?selected=<id>` opens the detail pane on medium and expanded
 * windows; on single-pane windows it becomes the pushed detail route (§2.5 rule 3).
 */
export default function SessionsRoute() {
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const selectedId = parseRecordId(selected);
  useSelectionPush('/sessions', selectedId);
  return <SessionsScreen selectedId={selectedId} />;
}
