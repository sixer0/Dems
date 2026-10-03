import { Redirect, useLocalSearchParams } from 'expo-router';
import { EvidenceDetailScreen } from '@/features/evidence/evidence-detail-screen';
import { parseRecordId, useDetailPaneHandover } from '@/navigation';

/**
 * Route `/evidence/[evidenceId]` (MB 6; 04_mobile_specs §4.11). A malformed id returns to the list. On medium and
 * expanded windows the detail lives in the list's pane, so this route hands over to
 * `/evidence?selected=<id>` (§2.5 rule 3).
 */
export default function EvidenceDetailRoute() {
  const params = useLocalSearchParams<{ evidenceId: string }>();
  const id = parseRecordId(params.evidenceId);
  const handingOver = useDetailPaneHandover(id);
  if (id === null) return <Redirect href="/evidence" />;
  if (handingOver) return null;
  return <EvidenceDetailScreen evidenceId={id} />;
}
