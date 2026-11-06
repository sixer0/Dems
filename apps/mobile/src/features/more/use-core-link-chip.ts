/**
 * The Core link chip of Home (H1 header, `home-core-link`) and of More (footer, `more-core-link`):
 * one hook, one rule (backend task W66; 04_client_integration_spec §3.2, MD-8, MD-9, AC-C-30).
 *
 * - The word comes from `coreLinkWordKey` (`more-model.ts`): "Simulated" in SIMULATED and in
 *   HEARTBEAT mode, "Live" only when the source is LIVE, "Offline" when the link is down.
 * - In LIVE, "down" is the runtime's one rule (rows M0, M1), not a rule of this screen, taken in ONE
 *   call, `useCoreLinkNotice()` (row M2, D164 DN-2; React Compiler, D138: never a ref plus an effect,
 *   never a timer, never a hold time). So the chip turns Offline at the first OFFLINE or STALE, back
 *   to Live at the first heartbeat, and a reconnect attempt (CONNECTING) between two OFFLINEs keeps
 *   it Offline: no flicker. First rendered while the socket reconnects after an outage it reads
 *   Offline at once (seeded from the connection banner, row M1, F-1). A refused call (a 429 among
 *   them) is no link state and never reaches the chip (LB-10).
 * - Outside LIVE `offline` stays false, so SIMULATED and HEARTBEAT keep their link rule of before
 *   (mock-core's heartbeat; `link.state`).
 *
 * `live` tells Home where to draw the chip (MD-9: in LIVE in every layout class; in SIMULATED and
 * HEARTBEAT on the expanded header only, as before).
 */
import type { StatusTone } from '@dems/shared/tokens';
import { useCoreLink, useCoreLinkNotice, type CoreLinkSource } from '@/runtime';
import { coreLinkTone, coreLinkWordKey, type CoreLinkWordKey } from './more-model';

export interface CoreLinkChip {
  /** The `common.status.*` key of the chip's word. */
  readonly word: CoreLinkWordKey;
  readonly tone: StatusTone;
  /** The kit icon: the Wi-Fi mark unless the word is Offline. */
  readonly icon: 'Wifi' | 'TriangleAlert';
  /** For the accessibility label (`mobile.coreLink.source.*`): the label keeps naming the source (MD-8). */
  readonly source: CoreLinkSource;
  /** The data mode is LIVE (rule 5: `useCoreLink().source === 'LIVE'`). */
  readonly live: boolean;
}

export function useCoreLinkChip(): CoreLinkChip {
  const link = useCoreLink();
  const { offline } = useCoreLinkNotice();
  const word = coreLinkWordKey(link, offline);
  return {
    word,
    tone: coreLinkTone(word),
    icon: word === 'offline' ? 'TriangleAlert' : 'Wifi',
    source: link.source,
    live: link.source === 'LIVE',
  };
}
