import { Redirect, useLocalSearchParams } from 'expo-router';
import { SessionDetailScreen } from '@/features/sessions/session-detail-screen';
import { parseRecordId, useDetailPaneHandover } from '@/navigation';

/**
 * Route `/sessions/[sessionId]` (04_mobile_specs §4.9). A malformed id returns to the list. On medium and
 * expanded windows the detail lives in the list's pane, so this route hands over to
 * `/sessions?selected=<id>` (§2.5 rule 3).
 */
export default function SessionDetailRoute() {
  const params = useLocalSearchParams<{ sessionId: string }>();
  const id = parseRecordId(params.sessionId);
  const handingOver = useDetailPaneHandover(id);
  if (id === null) return <Redirect href="/sessions" />;
  if (handingOver) return null;
  return <SessionDetailScreen sessionId={id} />;
}
