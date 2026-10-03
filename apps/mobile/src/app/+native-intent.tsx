import { reportNavigationIssue } from '@/navigation/log';
import { recordIncomingLink } from '@/navigation/pending-href';

/**
 * Expo Router's system-URL hook: called with the launch URL (`initial: true`) and with every later
 * deep link, before routing. A guarded URL that arrives while signed out is kept as the pending
 * href and opened as `/login` instead (04_mobile_specs §3.3); every other link is returned
 * unchanged, so routing is Expo Router's own. The global `?motion=` / `?debug=` switches still
 * apply: the motion kit reads the raw incoming URL. Never logs the URL (untrusted input).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return recordIncomingLink(path) ?? path;
  } catch (error) {
    reportNavigationIssue('warn', 'navigation.nativeIntent', error);
    return path;
  }
}
