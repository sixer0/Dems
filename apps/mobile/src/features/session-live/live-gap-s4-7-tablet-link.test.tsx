// Plan row W87 (step 109): a Live test that names site S4-7 (04_client_integration_spec §8.7, AC-C-56).
//
// S4-7 is `runtime/sim-runtime-provider.tsx` (the tablet link from the heartbeat): "Inactive in LIVE:
// the effect returns when the source is LIVE. The server sets the link from real connections [SP:§6.8]."
// In HEARTBEAT mode the runtime writes the simulator's tablet link from the mock-core heartbeat; in LIVE
// the replica's `tabletLink` is the Core's, and only a Core message moves it. The test sits beside the
// Session Monitor's Live bed, which mounts the real runtime over the app's real Live source; `runtime/`
// itself is outside the write paths of this row.
//
// Import order: the gorhom mock, then the router harness, then the bed (see their headers).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { LiveLinkState } from '@dems/shared/live';
import { runtimeLog } from '@/runtime';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;

beforeEach(async () => {
  await resetLiveMonitorBed();
});

afterEach(() => {
  // No Core action of the runtime was read as a value (the Live source's own misuse report).
  expect(bed?.mobile.live.errors().filter((report) => report.source.startsWith('live.misuse')) ?? []).toEqual([]);
  bed?.stop();
  bed = null;
});

async function openMonitor(): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor();
  bed = b;
  await b.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return b;
}

describe('S4-7: the tablet link is the Core`s in LIVE; a heartbeat loss writes nothing (§8.7, §6.8)', () => {
  it('the app`s socket goes STALE and OFFLINE: the replica keeps the link the Core last sent, no request leaves the tablet, and only a Core delta moves it', async () => {
    const b = await openMonitor();
    const tabletLink = () => b.state().tabletLink.state;
    expect(b.mobile.live.link).toBe(LiveLinkState.ONLINE);
    const fromCore = tabletLink();
    expect(fromCore).toBe(b.engine.sim.store.getState().tabletLink.state);
    // The one way a client could write the link: the source's own action (a no-op in LIVE, X-2). Nobody may call it.
    const write = jest.spyOn(b.mobile.sim.actions, 'setTabletLink');
    const linkLines = () => runtimeLog.records().filter((record) => record.source === 'runtime.coreLink.tabletLink');
    const linesBefore = linkLines().length;

    // The heartbeat of the one socket stops: the link goes down and stays down through the reconnect attempts.
    const sent = b.fake.calls.length;
    b.setReachable(false);
    await b.flush();
    let sawDown = false;
    for (let step = 0; step < 40; step += 1) {
      await b.elapse(250, 250);
      if (b.mobile.live.link === LiveLinkState.OFFLINE || b.mobile.live.link === LiveLinkState.STALE) sawDown = true;
      // In HEARTBEAT mode this is where the runtime would write OFFLINE; in LIVE the replica does not move.
      expect(tabletLink()).toBe(fromCore);
    }
    expect(sawDown).toBe(true);
    // Nothing was sent to set a link: the client has no command for it, and it made none.
    expect(b.fake.calls.slice(sent).filter((call) => call.method === 'POST')).toEqual([]);
    // The heartbeat effect of HEARTBEAT mode is not running: it neither wrote the link nor said it did.
    expect(write).not.toHaveBeenCalled();
    expect(linkLines()).toHaveLength(linesBefore);

    // The Core answers again: the new snapshot carries the Core's link, which has not changed.
    b.setReachable(true);
    await b.elapse(40_000, 500);
    expect(b.mobile.live.link).toBe(LiveLinkState.ONLINE);
    expect(tabletLink()).toBe(fromCore);

    // The Core itself records a change of the tablet link (a real connection closed): the delta moves the replica.
    const next = fromCore === 'CONNECTED' ? 'OFFLINE' : 'CONNECTED';
    await b.changeOnCore((engine) => engine.sim.actions.setTabletLink(next));
    await b.elapse(200);
    expect(tabletLink()).toBe(next);
    expect(b.fake.calls.slice(sent).filter((call) => call.method === 'POST')).toEqual([]);
    expect(write).not.toHaveBeenCalled();
    expect(linkLines()).toHaveLength(linesBefore);
    write.mockRestore();
  });
});
