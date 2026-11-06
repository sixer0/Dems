import { useLocalSearchParams } from 'expo-router';
import { EvidenceListScreen } from '@/features/evidence/evidence-list-screen';
import { parseRecordId, useSelectionPush } from '@/navigation';

/**
 * Route `/evidence` (tab Evidence; MB 5, MB 6; 04_mobile_specs §4.10, §4.11). `?selected=<id>` opens the detail pane on medium and expanded
 * windows; on single-pane windows it becomes the pushed detail route (§2.5 rule 3).
 */
export default function EvidenceListRoute() {
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const selectedId = parseRecordId(selected);
  useSelectionPush('/evidence', selectedId);
  return <EvidenceListScreen selectedId={selectedId} />;
}
