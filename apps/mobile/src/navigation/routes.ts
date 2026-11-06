/**
 * Route registry of the navigation shell (04_mobile_specs §1.1, §2.3, §3.1, §3.5; step 70).
 *
 * One place for: the tab destinations and their chrome (bottom bar on phones, rail on tablets),
 * the screen id of every route (the `screen-<id>` testID, 04 §4.0), and which URL paths are
 * public or guarded (04 §3.3, §3.5). Route files, the chrome, the boot router, the pending-href
 * recorder and the tests all read it, so a new route is added here once.
 */
import type { LucideIcon } from 'lucide-react-native';
import { Cctv, ClipboardList, Database, Ellipsis, Folder, House, Network, Settings, ShieldCheck } from 'lucide-react-native';

/** Tab route names of `(app)/(tabs)` (the file or folder name under `src/app/(app)/(tabs)`). */
export type TabName =
  | 'home'
  | 'sessions'
  | 'evidence'
  | 'devices'
  | 'storage'
  | 'network-time'
  | 'audit'
  | 'settings'
  | 'more';

/** i18n keys of the destination labels (the `mobile.nav.*` namespace, step 68). */
export type NavLabelKey =
  | 'mobile.nav.home'
  | 'mobile.nav.sessions'
  | 'mobile.nav.evidence'
  | 'mobile.nav.devices'
  | 'mobile.nav.storage'
  | 'mobile.nav.networkTime'
  | 'mobile.nav.audit'
  | 'mobile.nav.settings'
  | 'mobile.nav.more';

/** Tab hrefs. Literal strings, so they type-check against the typed routes (app.json `typedRoutes`). */
export type TabHref =
  | '/home'
  | '/sessions'
  | '/evidence'
  | '/devices'
  | '/storage'
  | '/network-time'
  | '/audit'
  | '/settings'
  | '/more';

export interface TabDestination {
  readonly name: TabName;
  readonly href: TabHref;
  readonly labelKey: NavLabelKey;
  readonly icon: LucideIcon;
}

/**
 * Every tab route, in rail order (04 §2.3). The tab navigator always holds all nine routes; the
 * chrome decides which triggers are visible (H-MB-01: Storage, Network & Time, Audit and Settings
 * have no visible trigger on phones and are reached from More, with identical URLs everywhere).
 *
 * Icons follow the phone mockup for the five bar items (MB 2 tab bar: house, clipboard, folder,
 * device, ellipsis) and the web sidebar for the rest (apps/core-web nav-items.ts), so the two
 * apps name each page with the same glyph where the mockup does not decide.
 */
export const TAB_DESTINATIONS: Readonly<Record<TabName, TabDestination>> = {
  home: { name: 'home', href: '/home', labelKey: 'mobile.nav.home', icon: House },
  sessions: { name: 'sessions', href: '/sessions', labelKey: 'mobile.nav.sessions', icon: ClipboardList },
  evidence: { name: 'evidence', href: '/evidence', labelKey: 'mobile.nav.evidence', icon: Folder },
  devices: { name: 'devices', href: '/devices', labelKey: 'mobile.nav.devices', icon: Cctv },
  storage: { name: 'storage', href: '/storage', labelKey: 'mobile.nav.storage', icon: Database },
  'network-time': { name: 'network-time', href: '/network-time', labelKey: 'mobile.nav.networkTime', icon: Network },
  audit: { name: 'audit', href: '/audit', labelKey: 'mobile.nav.audit', icon: ShieldCheck },
  settings: { name: 'settings', href: '/settings', labelKey: 'mobile.nav.settings', icon: Settings },
  more: { name: 'more', href: '/more', labelKey: 'mobile.nav.more', icon: Ellipsis },
};

/** The five phone destinations (bottom bar and the icon-only landscape rail; MB 2). */
export const PHONE_TABS: readonly TabName[] = ['home', 'sessions', 'evidence', 'devices', 'more'];

/** The eight tablet destinations ("More" dissolves into the rail, 04 §2.3). */
export const TABLET_TABS: readonly TabName[] = [
  'home',
  'sessions',
  'evidence',
  'devices',
  'storage',
  'network-time',
  'audit',
  'settings',
];

/** Destinations that live under More on phones; the bar highlights More while one is open (MB 8, MB 10). */
export const MORE_TABS: readonly TabName[] = ['storage', 'network-time', 'audit', 'settings'];

/** Every tab, in navigator order (the trigger list of `useTabsWithTriggers`). */
export const ALL_TABS: readonly TabName[] = [...TABLET_TABS, 'more'];

const TAB_NAMES: ReadonlySet<string> = new Set(ALL_TABS);

/** The tab a set of route segments belongs to, e.g. `['(app)', '(tabs)', 'evidence', '[evidenceId]']` → `evidence`. */
export function tabForSegments(segments: readonly string[]): TabName | null {
  const at = segments.indexOf('(tabs)');
  if (at < 0) return null;
  const name = segments[at + 1];
  return name !== undefined && TAB_NAMES.has(name) ? (name as TabName) : null;
}

/**
 * The destination the chrome shows as active. On a phone the bar has no Storage, Network & Time,
 * Audit or Settings item, so it highlights More for them (MB 8, MB 10 show exactly that).
 */
export function activeDestination(tab: TabName | null, visible: readonly TabName[]): TabName | null {
  if (tab === null) return null;
  if (visible.includes(tab)) return tab;
  if (MORE_TABS.includes(tab) && visible.includes('more')) return 'more';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Screen ids (04 §4.0 testID convention; §3.1 file tree; step 70 stubs)
// ---------------------------------------------------------------------------------------------

/**
 * Screen id per route pattern: the route renders a root with `testID="screen-<id>"`. The feature
 * folder and screen file are where the screen step writes it (P6: screen steps never edit
 * `src/app/**`, only `src/features/<folder>/**`).
 */
export const ROUTE_SCREENS = [
  { pattern: '/', id: 'stack-check', folder: 'home', file: 'home-screen.tsx', access: 'public' },
  { pattern: '/stack-check', id: 'stack-check', folder: 'home', file: 'home-screen.tsx', access: 'public' },
  { pattern: '/pair', id: 'pair', folder: 'pairing', file: 'pairing-screen.tsx', access: 'public' },
  { pattern: '/login', id: 'login', folder: 'login', file: 'login-screen.tsx', access: 'signed-out' },
  { pattern: '/home', id: 'home', folder: 'dashboard', file: 'dashboard-screen.tsx', access: 'guarded' },
  { pattern: '/sessions', id: 'sessions', folder: 'sessions', file: 'sessions-screen.tsx', access: 'guarded' },
  { pattern: '/sessions/[sessionId]', id: 'session-detail', folder: 'sessions', file: 'session-detail-screen.tsx', access: 'guarded' },
  { pattern: '/evidence', id: 'evidence', folder: 'evidence', file: 'evidence-list-screen.tsx', access: 'guarded' },
  { pattern: '/evidence/[evidenceId]', id: 'evidence-detail', folder: 'evidence', file: 'evidence-detail-screen.tsx', access: 'guarded' },
  { pattern: '/devices', id: 'devices', folder: 'devices', file: 'devices-screen.tsx', access: 'guarded' },
  { pattern: '/devices/[deviceId]', id: 'device-detail', folder: 'devices', file: 'device-detail-screen.tsx', access: 'guarded' },
  { pattern: '/storage', id: 'storage', folder: 'storage', file: 'storage-screen.tsx', access: 'guarded' },
  { pattern: '/network-time', id: 'network-time', folder: 'network-time', file: 'network-time-screen.tsx', access: 'guarded' },
  { pattern: '/audit', id: 'audit', folder: 'audit', file: 'audit-screen.tsx', access: 'guarded' },
  { pattern: '/settings', id: 'settings', folder: 'settings', file: 'settings-screen.tsx', access: 'guarded' },
  { pattern: '/settings/[section]', id: 'settings-section', folder: 'settings', file: 'settings-section-screen.tsx', access: 'guarded' },
  { pattern: '/more', id: 'more', folder: 'more', file: 'more-screen.tsx', access: 'guarded' },
  { pattern: '/session/new', id: 'session-new', folder: 'session-new', file: 'session-new-screen.tsx', access: 'guarded' },
  { pattern: '/session/live', id: 'session-live', folder: 'session-live', file: 'session-live-screen.tsx', access: 'guarded' },
  { pattern: '/session/finalizing', id: 'session-finalizing', folder: 'session-finalizing', file: 'session-finalizing-screen.tsx', access: 'guarded' },
  { pattern: '/session/summary/[sessionId]', id: 'session-summary', folder: 'session-summary', file: 'session-summary-screen.tsx', access: 'guarded' },
  { pattern: '/session/recovery', id: 'session-recovery', folder: 'session-recovery', file: 'session-recovery-screen.tsx', access: 'guarded' },
] as const;

export type RouteAccess = (typeof ROUTE_SCREENS)[number]['access'];

// ---------------------------------------------------------------------------------------------
// Public and guarded paths (04 §3.3, §3.5)
// ---------------------------------------------------------------------------------------------

/** First path segments of the `(app)` group: everything under them needs a signed-in operator. */
const GUARDED_FIRST_SEGMENTS: ReadonlySet<string> = new Set([...ALL_TABS, 'session']);

/** True when a pathname (no scheme, no query) belongs to the guarded `(app)` group (04 §3.5 "guarded"). */
export function isGuardedPath(pathname: string): boolean {
  const first = pathname.replace(/^\/+/, '').split(/[/?#]/, 1)[0] ?? '';
  return GUARDED_FIRST_SEGMENTS.has(first);
}
