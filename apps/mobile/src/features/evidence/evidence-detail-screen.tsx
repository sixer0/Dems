import { SafeScreen } from '@/layout';
import { EvidenceDetail } from './evidence-detail';

export interface EvidenceDetailScreenProps {
  /** Validated evidence id from the path (`recordIdSchema`). */
  readonly evidenceId: string;
}

/**
 * Evidence detail (04 §4.11, MB 6) at `/evidence/[evidenceId]`. Owner: step 83 (P6).
 *
 * The route file under `src/app/` renders `<EvidenceDetailScreen … />` on single-pane windows (on
 * medium and expanded windows it hands over to `/evidence?selected=<id>`, where the list screen
 * shows the same `EvidenceDetail` in its detail pane). The root stays
 * `SafeScreen id="evidence-detail"` (testID `screen-evidence-detail`, 04 §4.0; T-M02, MA-04).
 */
export function EvidenceDetailScreen({ evidenceId }: EvidenceDetailScreenProps) {
  return (
    <SafeScreen id="evidence-detail">
      <EvidenceDetail key={evidenceId} evidenceId={evidenceId} variant="screen" />
    </SafeScreen>
  );
}
