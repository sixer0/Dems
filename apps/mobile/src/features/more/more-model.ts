/**
 * More screen model (04_mobile_specs §4.17; §2.3 "More dissolves" on tablets; H-MB-01). Pure:
 * which destinations the screen lists for a layout class and a session state, their hrefs, the
 * tones of the live status chips, and the flat `useSim` selectors (F74-13: primitives only).
 */
import { SessionState } from '@dems/shared/domain';
import { selectAuditChainBreak, storageSummary, type SimState } from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';
import type { CoreLinkInfo } from '@/runtime';
import type { LayoutClass, NavChrome } from '@/layout';
import { MORE_TABS, type TabName } from '@/navigation/routes';

// ---------------------------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------------------------

/** The four tab routes that have no visible trigger on phones (step 70 `MORE_TABS`, H-MB-01). */
export type ConsoleDestination = Extract<TabName, 'storage' | 'network-time' | 'audit' | 'settings'>;

export const CONSOLE_DESTINATIONS = MORE_TABS as readonly ConsoleDestination[];

/** Secondary destinations: derived screens that are never tabs (§4.17 About; §1.1 Pairing, Recovery). */
export type LinkDestination = 'pairing' | 'recovery' | 'about' | 'dev-gallery';

export const LINK_HREFS = {
  pairing: '/pair',
  recovery: '/session/recovery',
  about: '/settings/about',
  'dev-gallery': '/dev-gallery',
} as const satisfies Record<LinkDestination, string>;

export type MoreHref = (typeof LINK_HREFS)[LinkDestination] | `/${ConsoleDestination}`;

/**
 * True when the chrome has a More item, i.e. the four console destinations are reachable only from
 * here (phone bar and the phone-landscape rail, 5 destinations). On tablets the rail lists them
 * (8 destinations), so the screen does not repeat them (H-MB-01, 04 §2.3).
 */
export function showsConsole(nav: Pick<NavChrome, 'destinations'>): boolean {
  return nav.destinations === 5;
}

/** Session states that the Recovery status screen explains (04 §3.7 table: FAULT, RECOVERY). */
const RECOVERY_STATES: ReadonlySet<SessionState> = new Set([SessionState.FAULT, SessionState.RECOVERY]);

export function needsRecovery(state: SessionState | null): boolean {
  return state !== null && RECOVERY_STATES.has(state);
}

/**
 * The secondary rows, in order: Pairing, Recovery (only while the session is FAULT or RECOVERY),
 * About, and the developer gallery (debug builds only; the route redirects home in release).
 */
export function linkDestinations(input: { sessionState: SessionState | null; debug: boolean }): LinkDestination[] {
  const rows: LinkDestination[] = ['pairing'];
  if (needsRecovery(input.sessionState)) rows.push('recovery');
  rows.push('about');
  if (input.debug) rows.push('dev-gallery');
  return rows;
}

/** Console tile columns: 2 on a phone in portrait, 4 in the wide phone-landscape window. */
export function consoleColumns(layoutClass: LayoutClass): 2 | 4 {
  return layoutClass === 'compact' ? 2 : 4;
}

// ---------------------------------------------------------------------------------------------
// Tones
// ---------------------------------------------------------------------------------------------

export type StorageState = SimState['storage']['state'];

export function storageTone(state: StorageState): StatusTone {
  if (state === 'FULL') return 'danger';
  if (state === 'LOW') return 'warning';
  return 'success';
}

/** Network & Time is healthy when the LAN is up and the clock is locked on any source. */
export function networkTimeTone(linkUp: boolean, timeLocked: boolean): StatusTone {
  return linkUp && timeLocked ? 'success' : 'warning';
}

export function chainTone(broken: boolean): StatusTone {
  return broken ? 'danger' : 'success';
}

export function pairingTone(state: SimState['pairing']['state']): StatusTone {
  if (state === 'PAIRED') return 'success';
  if (state === 'FAILED') return 'danger';
  return 'warning';
}

/** The `common.status.*` word of the Core link chip. */
export type CoreLinkWordKey = 'offline' | 'simulated' | 'live';

/**
 * The word of the two Core link chips, Home header `home-core-link` and More footer `more-core-link`
 * (one rule for both; backend task W66, 04_client_integration_spec §3.2, MD-8, AC-C-30):
 *
 * | Source | Link | Word |
 * |---|---|---|
 * | SIMULATED | always up | Simulated |
 * | HEARTBEAT | mock-core heartbeat up | **Simulated** (MD-8: it read "Live", although the data is simulated) |
 * | HEARTBEAT | mock-core heartbeat down | Offline (as before) |
 * | LIVE | `liveOffline` false | Live |
 * | LIVE | `liveOffline` true | Offline |
 *
 * "Live" only when the source is LIVE. In LIVE the caller decides `liveOffline` with the runtime's
 * one rule (`offlineNoticeAfter` over `coreLinkViewOf(useCoreLink())`, row M0; `use-core-link-chip.ts`),
 * never from `link.state`. The SIMULATED and HEARTBEAT rows read `link.state` as they always did:
 * that link is mock-core's, which never drives the Core server's notice (the M0 view is `none`).
 */
export function coreLinkWordKey(link: Pick<CoreLinkInfo, 'state' | 'source'>, liveOffline: boolean): CoreLinkWordKey {
  if (link.source === 'LIVE') return liveOffline ? 'offline' : 'live';
  return link.state === 'ONLINE' ? 'simulated' : 'offline';
}

/** The tone of the Core link chip: Simulated (info), Live (success), Offline (danger). */
export function coreLinkTone(word: CoreLinkWordKey): StatusTone {
  if (word === 'offline') return 'danger';
  return word === 'simulated' ? 'info' : 'success';
}

// ---------------------------------------------------------------------------------------------
// Flat simulator selectors (primitives only, F74-13)
// ---------------------------------------------------------------------------------------------

export const selectUsedPercent = (s: SimState): number => storageSummary(s).usedPercent;
export const selectStorageState = (s: SimState): StorageState => s.storage.state;
export const selectTimeSource = (s: SimState): SimState['time']['source'] => s.time.source;
export const selectTimeLocked = (s: SimState): boolean => s.time.locked;
export const selectLinkUp = (s: SimState): boolean => s.network.linkUp;
export const selectAuditCount = (s: SimState): number => s.audit.rows.length;
/** The Audit screen's discontinuity rule (an AUDIT_TAMPER fault on an existing row, EVT-30). */
export const selectChainBroken = (s: SimState): boolean => selectAuditChainBreak(s) !== null;
export const selectPairingState = (s: SimState): SimState['pairing']['state'] => s.pairing.state;
export const selectCoreName = (s: SimState): string => s.pairing.coreName;
export const selectSessionStateFlat = (s: SimState): SessionState | null => s.session?.state ?? null;
export const selectSignedInAt = (s: SimState): number | null => s.auth.issuedAt;
