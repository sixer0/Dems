/**
 * "Session actions are read-only while the Core link is down" in ONE call (row M2, decision D175
 * DN-4; finding F73-5 of W73). The Session Monitor (step 79, row W68) and Recovery (step 81, row W73)
 * each held a copy of this rule; 04_client_integration_spec §3.5 names both screens.
 *
 * ```ts
 * const readOnly = useCoreLinkReadOnly();
 * ```
 *
 * | Source | Read-only while |
 * |---|---|
 * | LIVE | the "Core server unreachable" notice shows, `useCoreLinkNotice().offline` (rows M0, M1): from the first OFFLINE or STALE until the first ONLINE; a reconnect attempt keeps it; a cold start flashes nothing; a screen first opened during a reconnect after an outage is read-only from its first render |
 * | SIMULATED, HEARTBEAT | the step-79 rule, unchanged: the connection banner is `offline` or the link's two-valued `state` is OFFLINE |
 *
 * In LIVE the two-valued `state` reads a reconnect attempt as OFFLINE, so the step-79 rule would
 * blink the controls at every attempt; the notice keeps what it showed through the transients.
 *
 * The hook only answers whether; the screen decides what read-only does (disable a control, refuse
 * a press with its own toast and log line). A refused call (a 429 among them) is no link state and
 * never reaches it (LB-10). No effect, no ref, no timer: the state lives in `useCoreLinkNotice()`.
 */
import { useConnectionBanner } from './connection-banner';
import { useCoreLink } from './contract';
import { useCoreLinkNotice } from './use-core-link-notice';

export function useCoreLinkReadOnly(): boolean {
  const banner = useConnectionBanner();
  const link = useCoreLink();
  const { offline } = useCoreLinkNotice();
  if (link.source === 'LIVE') return offline;
  return banner.kind === 'offline' || link.state === 'OFFLINE';
}
