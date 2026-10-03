/** Status tones of the Audit view (01S §2.8 tone set; the web page's `tones.ts` mapping). */
import type { Severity } from '@dems/shared/sim';
import { toneTextHex, type StatusTone } from '@dems/shared/tokens';

export const SEVERITY_TONE: Readonly<Record<Severity, StatusTone>> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
};

/** Dot colour of a severity (the row's severity dot). */
export function severityDotColor(severity: Severity): string {
  return toneTextHex[SEVERITY_TONE[severity]];
}
