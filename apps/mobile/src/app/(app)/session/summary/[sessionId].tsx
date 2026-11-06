import { Redirect, useLocalSearchParams } from 'expo-router';
import { SessionSummaryScreen } from '@/features/session-summary/session-summary-screen';
import { parseRecordId } from '@/navigation';

/** Route `/session/summary/[sessionId]` (04_mobile_specs §4.7). A malformed id goes Home. */
export default function SessionSummaryRoute() {
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = parseRecordId(params.sessionId);
  if (sessionId === null) return <Redirect href="/home" />;
  return <SessionSummaryScreen sessionId={sessionId} />;
}
