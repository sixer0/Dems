import { SafeScreen } from '@/layout';
import { SessionDetail } from './session-detail';

export interface SessionDetailScreenProps {
  /** Validated session id from the path (`recordIdSchema`). */
  readonly sessionId: string;
}

/**
 * Session detail (04_mobile_specs §4.9) at `/sessions/[sessionId]`. Owner: step 82 (P6; replaces
 * step 70's stub with the same export name, props and root).
 *
 * The route file under `src/app/` renders `<SessionDetailScreen … />` on single-pane windows (on
 * medium and expanded windows it hands over to `/sessions?selected=<id>`, where the hub shows the
 * same `SessionDetail` in its detail pane). Home's Recent Sessions rows land here too. The root
 * stays `SafeScreen id="session-detail"` (testID `screen-session-detail`, 04 §4.0; T-M02, MA-04).
 */
export function SessionDetailScreen({ sessionId }: SessionDetailScreenProps) {
  return (
    <SafeScreen id="session-detail">
      <SessionDetail key={sessionId} sessionId={sessionId} variant="screen" />
    </SafeScreen>
  );
}
