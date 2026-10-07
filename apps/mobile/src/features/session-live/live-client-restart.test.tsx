// Closing-fix row CF-M1, defect R-S-2 (and the client half of R-P-2; re-test round, decision D211/D214).
//
// Right after the pairing hand-off Login showed "Core server unreachable" with "Use Simulated mode" for
// 0.10-0.47 s while the Core was up: the app's socket client had given its socket up by itself
// (`live.socket` SYNC_TIMEOUT, `waiting: 'hello'`) and was waiting its reconnect step (500 ms + jitter);
// in that gap the link reads OFFLINE, and the notice shows OFFLINE at once (M0's rule). Nothing was heard
// from the Core about an outage: the Core logged the close as the client's (code 1000) and the next socket
// opened 0.9 s later.
//
// The rule now (DX-3 extended, `ended-link.ts` `isLinkSettling`): between a socket the client gave up itself
// and its next socket, the FIRST restart of a series reads as settling (no banner, no notice); a Core that
// keeps not answering (the next socket times out as well) shows them as before, one reconnect step later.
// Held on the app's own Live source over the contract-checked fake transport (W68's `live-monitor-bed`).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, screen } from '@testing-library/react-native';
import { LIVE_SOCKET_SYNC_TIMEOUT_MS } from '@dems/shared/realtime';
import { isLinkSettling } from '@/runtime';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;

beforeEach(async () => {
  await resetLiveMonitorBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

async function monitor(): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor({ window: 'phonePortrait' });
  bed = b;
  await b.openMonitor();
  expect(b.mobile.live.link).toBe('ONLINE');
  return b;
}

/** The app reopens its socket and the Core does not answer the new one (no `hello`): the client gives it up at the deadline. */
async function giveUpOnce(b: LiveMonitorBed): Promise<void> {
  b.setReachable('hanging', { drop: false });
  act(() => void b.mobile.live.reconnect('RETRY'));
  await b.flush();
  await b.elapse(LIVE_SOCKET_SYNC_TIMEOUT_MS + 100, 100);
}

describe('R-S-2: a socket the client gave up itself is a transient, not "Core link lost"', () => {
  it('after SYNC_TIMEOUT, in the reconnect gap (link OFFLINE): the link reads settling, no banner, the actions stay usable', async () => {
    const b = await monitor();
    await giveUpOnce(b);
    expect(b.mobile.live.socketStatus().counters.errors).toBeGreaterThan(0);
    expect(b.mobile.live.link).toBe('OFFLINE');
    expect(isLinkSettling(b.mobile.live)).toBe(true);
    expect(screen.queryByTestId('monitor-banner-offline')).toBeNull();
    expect(screen.getByTestId('monitor-end-session').props.accessibilityState?.disabled ?? false).toBe(false);
  });

  it('the Core answers the next socket: back ONLINE with no "Core link lost" frame at any step', async () => {
    const b = await monitor();
    const seen: string[] = [];
    await giveUpOnce(b);
    seen.push(screen.queryByTestId('monitor-banner-offline') ? 'offline' : 'none');
    b.setReachable(true);
    for (let i = 0; i < 20; i += 1) {
      await b.elapse(250, 250);
      seen.push(screen.queryByTestId('monitor-banner-offline') ? 'offline' : 'none');
    }
    expect(b.mobile.live.link).toBe('ONLINE');
    expect(seen).not.toContain('offline');
    expect(isLinkSettling(b.mobile.live)).toBe(false);
  });

  it('a Core that keeps not answering (the next socket times out too) shows "Core link lost", one reconnect step later than a lost socket', async () => {
    const b = await monitor();
    await giveUpOnce(b);
    expect(screen.queryByTestId('monitor-banner-offline')).toBeNull();
    // The reconnect step, then the second socket hangs to its deadline as well.
    await b.elapse(1_000 + LIVE_SOCKET_SYNC_TIMEOUT_MS + 200, 100);
    expect(b.mobile.live.link).toBe('OFFLINE');
    expect(isLinkSettling(b.mobile.live)).toBe(false);
    expect(screen.getByTestId('monitor-banner-offline')).toBeTruthy();
  });

  it('a socket the Core really lost still shows the banner at once (M0\'s rule is unchanged)', async () => {
    const b = await monitor();
    b.setReachable(false);
    await b.flush();
    await b.elapse(1_000, 250);
    expect(isLinkSettling(b.mobile.live)).toBe(false);
    expect(screen.getByTestId('monitor-banner-offline')).toBeTruthy();
  });
});
