/**
 * Connection banner logic (04_mobile_specs §4.5 S7, §5.5; MA-10; motion M-MB-04).
 *
 * The banner is the app-wide answer to "is the Core link up?":
 * - `offline` while the link is OFFLINE: "Core link lost — recording continues on the Core.
 *   Reconnecting…" (`mobile.coreLink.lost`). The in-app simulator keeps recording (§5.6);
 * - `resynced` for `RESYNCED_BANNER_MS` after the link comes back, or after a heartbeat resync
 *   (`mobile.coreLink.resynced`);
 * - `hidden` otherwise.
 *
 * In heartbeat mode CONNECTING is a transient (first connect, or between reconnect attempts), so
 * it keeps the current banner instead of flickering it. LIVE mode has the same heartbeat states,
 * read from the Core server's socket, and the same rule (backend task W51; 04_client_integration_spec
 * §3.5, §7.2): the banner is the answer to "link lost", "link back", and never to a refused call
 * (a 429 does not change it, LB-10). This file is pure logic plus a React context; the screens
 * (step 79 and the shell) draw the banner from `useConnectionBanner()`.
 */
import { createContext, useContext } from 'react';
import type { CoreLinkInfo } from './contract';

export type ConnectionBannerKind = 'hidden' | 'offline' | 'resynced';

/** How long "Resynced" stays before the banner hides. */
export const RESYNCED_BANNER_MS = 3000;

export const CONNECTION_BANNER_MESSAGE_KEYS = {
  offline: 'mobile.coreLink.lost',
  resynced: 'mobile.coreLink.resynced',
} as const;

/** A source whose link follows a heartbeat: its CONNECTING state is a transient. */
function followsHeartbeat(link: CoreLinkInfo): boolean {
  return link.source === 'HEARTBEAT' || link.source === 'LIVE';
}

/** The next banner kind after a Core link change (pure). */
export function nextBannerKind(current: ConnectionBannerKind, link: CoreLinkInfo): ConnectionBannerKind {
  if (followsHeartbeat(link) && link.heartbeat === 'CONNECTING') return current;
  if (link.state === 'OFFLINE') return 'offline';
  if (current === 'offline') return 'resynced';
  return current;
}

/** The next kind after a heartbeat resync signal (pure): a resync never hides an outage. */
export function bannerKindAfterResync(current: ConnectionBannerKind): ConnectionBannerKind {
  return current === 'offline' ? current : 'resynced';
}

export interface ConnectionBanner {
  readonly kind: ConnectionBannerKind;
  /** i18n key of the banner text, or `null` when hidden. */
  readonly messageKey: (typeof CONNECTION_BANNER_MESSAGE_KEYS)[keyof typeof CONNECTION_BANNER_MESSAGE_KEYS] | null;
}

export function connectionBannerFor(kind: ConnectionBannerKind): ConnectionBanner {
  return { kind, messageKey: kind === 'hidden' ? null : CONNECTION_BANNER_MESSAGE_KEYS[kind] };
}

export const HIDDEN_BANNER: ConnectionBanner = connectionBannerFor('hidden');

export const ConnectionBannerContext = createContext<ConnectionBanner>(HIDDEN_BANNER);

/** The app-wide connection banner state (computed once by `SimRuntimeProvider`). */
export function useConnectionBanner(): ConnectionBanner {
  return useContext(ConnectionBannerContext);
}
