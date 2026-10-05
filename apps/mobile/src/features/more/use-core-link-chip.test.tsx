// Backend task W66 (plan row W66; 04_client_integration_spec §3.2, MD-8, AC-C-30; gateway_check/09a
// §10): the one rule of the two Core link chips (Home header `home-core-link`, More footer
// `more-core-link`), and the chip's LIVE "Offline" decided by the runtime's no-flicker rule (row M0).
//
// The hook is driven through a fake runtime contract, so every link state of every source can be
// handed to it in any order; the screens' own tests render the chips over the real runtime.
import { describe, expect, it } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { CoreLinkState, HeartbeatState } from '@dems/shared/domain';
import { RuntimeContractProvider, createRuntimeContract, offlineNoticeAfter, type CoreLinkInfo, type CoreLinkSource } from '@/runtime';
import { coreLinkTone, coreLinkWordKey } from './more-model';
import { useCoreLinkChip } from './use-core-link-chip';

const SOURCES: readonly CoreLinkSource[] = ['SIMULATED', 'HEARTBEAT', 'LIVE'];
const STATES: readonly CoreLinkState[] = ['ONLINE', 'OFFLINE'];

/** The runtime's link of a heartbeat-following source: LIVE → ONLINE, anything else → OFFLINE (`contract.ts`). */
const linkOf = (source: CoreLinkSource, heartbeat: HeartbeatState): CoreLinkInfo => ({
  source,
  state: heartbeat === 'LIVE' ? 'ONLINE' : 'OFFLINE',
  heartbeat,
});

function mountChip(first: CoreLinkInfo) {
  const holder = { link: first };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RuntimeContractProvider value={createRuntimeContract({ coreLink: holder.link })}>{children}</RuntimeContractProvider>
  );
  const view = renderHook(() => useCoreLinkChip(), { wrapper });
  return {
    current: () => view.result.current,
    show(link: CoreLinkInfo) {
      holder.link = link;
      view.rerender({});
      return view.result.current;
    },
  };
}

describe('the chip word, one rule for Home and More (MD-8, AC-C-30)', () => {
  it('SIMULATED and HEARTBEAT read "Simulated" while their link is up; only LIVE reads "Live"', () => {
    expect(coreLinkWordKey({ source: 'SIMULATED', state: 'ONLINE' }, false)).toBe('simulated');
    // MD-8: the mock-core heartbeat is up, the data is still the simulator's.
    expect(coreLinkWordKey({ source: 'HEARTBEAT', state: 'ONLINE' }, false)).toBe('simulated');
    expect(coreLinkWordKey({ source: 'LIVE', state: 'ONLINE' }, false)).toBe('live');
  });

  it('"Live" for exactly one input class: source LIVE and the M0 rule says the link is not down', () => {
    for (const source of SOURCES) {
      for (const state of STATES) {
        for (const liveOffline of [false, true]) {
          const word = coreLinkWordKey({ source, state }, liveOffline);
          expect([source, state, liveOffline, word === 'live']).toEqual([source, state, liveOffline, source === 'LIVE' && !liveOffline]);
        }
      }
    }
  });

  it('a link that is down reads "Offline": by the M0 state in LIVE, by the link state elsewhere (as before)', () => {
    expect(coreLinkWordKey({ source: 'LIVE', state: 'ONLINE' }, true)).toBe('offline');
    expect(coreLinkWordKey({ source: 'HEARTBEAT', state: 'OFFLINE' }, false)).toBe('offline');
    expect(coreLinkWordKey({ source: 'SIMULATED', state: 'OFFLINE' }, false)).toBe('offline');
    // In LIVE the two-valued state is not read (a reconnect attempt reads OFFLINE there): the rule decides.
    expect(coreLinkWordKey({ source: 'LIVE', state: 'OFFLINE' }, false)).toBe('live');
    // The M0 state never reaches a source that is not LIVE.
    expect(coreLinkWordKey({ source: 'HEARTBEAT', state: 'ONLINE' }, true)).toBe('simulated');
  });

  it('tones: Simulated info, Live success, Offline danger', () => {
    expect(coreLinkTone('simulated')).toBe('info');
    expect(coreLinkTone('live')).toBe('success');
    expect(coreLinkTone('offline')).toBe('danger');
  });
});

describe('useCoreLinkChip over the runtime link', () => {
  it('SIMULATED: "Simulated", info, the Wi-Fi mark, not live', () => {
    const chip = mountChip({ source: 'SIMULATED', state: 'ONLINE' });
    expect(chip.current()).toEqual({ word: 'simulated', tone: 'info', icon: 'Wifi', source: 'SIMULATED', live: false });
  });

  it('HEARTBEAT: "Simulated" with the heartbeat up (MD-8), "Offline" when mock-core is gone, as the link state says', () => {
    const chip = mountChip(linkOf('HEARTBEAT', 'CONNECTING'));
    expect(chip.current().word).toBe('offline');
    expect(chip.show(linkOf('HEARTBEAT', 'LIVE'))).toEqual({ word: 'simulated', tone: 'info', icon: 'Wifi', source: 'HEARTBEAT', live: false });
    expect(chip.show(linkOf('HEARTBEAT', 'STALE')).word).toBe('offline');
    expect(chip.show(linkOf('HEARTBEAT', 'OFFLINE'))).toMatchObject({ word: 'offline', tone: 'danger', icon: 'TriangleAlert' });
    expect(chip.show(linkOf('HEARTBEAT', 'LIVE')).word).toBe('simulated');
  });

  it('LIVE: "Live", success, while the Core server\'s heartbeat comes', () => {
    const chip = mountChip(linkOf('LIVE', 'LIVE'));
    expect(chip.current()).toEqual({ word: 'live', tone: 'success', icon: 'Wifi', source: 'LIVE', live: true });
  });

  it('LIVE outage: exactly two flips, on at the first down state and off at the first heartbeat; reconnect attempts keep "Offline"', () => {
    const outage: HeartbeatState[] = ['LIVE', 'STALE', 'CONNECTING', 'OFFLINE', 'CONNECTING', 'OFFLINE', 'CONNECTING', 'LIVE', 'LIVE'];
    const chip = mountChip(linkOf('LIVE', outage[0]!));
    const words = [chip.current().word, ...outage.slice(1).map((beat) => chip.show(linkOf('LIVE', beat)).word)];
    expect(words).toEqual(['live', 'offline', 'offline', 'offline', 'offline', 'offline', 'offline', 'live', 'live']);
    const flips = words.filter((word, index) => index > 0 && word !== words[index - 1]).length;
    expect(flips).toBe(2);
    // The same answers as the runtime's rule itself, step by step (one rule in the app, not a copy).
    let shown = offlineNoticeAfter(false, linkOf('LIVE', outage[0]!));
    const byRule = [shown, ...outage.slice(1).map((beat) => (shown = offlineNoticeAfter(shown, linkOf('LIVE', beat))))];
    expect(words.map((word) => word === 'offline')).toEqual(byRule);
  });

  it('LIVE cold start: CONNECTING before the first heartbeat flashes no "Offline"; a start that never connects turns Offline at the first OFFLINE', () => {
    const chip = mountChip(linkOf('LIVE', 'CONNECTING'));
    expect(chip.current().word).toBe('live');
    expect(chip.show(linkOf('LIVE', 'OFFLINE')).word).toBe('offline');
    expect(chip.show(linkOf('LIVE', 'CONNECTING')).word).toBe('offline');
  });

  it('leaving LIVE while it read "Offline" shows "Simulated" at once; LIVE again with the link up reads "Live"', () => {
    const chip = mountChip(linkOf('LIVE', 'LIVE'));
    expect(chip.show(linkOf('LIVE', 'OFFLINE')).word).toBe('offline');
    expect(chip.show({ source: 'SIMULATED', state: 'ONLINE' })).toMatchObject({ word: 'simulated', live: false });
    expect(chip.show(linkOf('LIVE', 'LIVE'))).toMatchObject({ word: 'live', live: true });
  });
});
