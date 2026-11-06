// Row M0 (finding CPM1-3 of the CP-M1 review): the one view of the Core link and the one rule of
// the "Core server unreachable" notice (`link-notice.ts`; 04_client_integration_spec §3.5, LB-6,
// LB-10, CL-17). The static rule over `features/**` is `link-notice-static.test.ts`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';
import { HEARTBEAT_STALE_AFTER_MS, RECONNECT_BACKOFF_MS } from '@dems/shared/api';
import { HeartbeatState } from '@dems/shared/domain';
import { LiveLinkState, LiveTransportError, LiveTransportReason } from '@dems/shared/live';
import { liveOfflineNoticeAfter } from '@/features/login/login-live-model';
import { offlineNoticeAfter as pairingOfflineNoticeAfter } from '@/features/pairing/pairing-live-model';
import { coreLinkViewOf as barrelCoreLinkViewOf, offlineNoticeAfter as barrelOfflineNoticeAfter } from '@/runtime';
import { nextBannerKind, type ConnectionBannerKind } from './connection-banner';
import type { CoreLinkInfo, CoreLinkSource } from './contract';
import { describeCoreError } from './core-errors';
import { coreLinkStateFor } from './core-link';
import { coreLinkViewOf, offlineNoticeAfter, type CoreLinkInput, type CoreLinkView } from './link-notice';

type LinkState = LiveLinkState | HeartbeatState;

/**
 * Every state of both vocabularies and its view. A `Record` over the union: a state added to
 * `LiveLinkState` or `HeartbeatState` fails the type check here until somebody decides its view.
 */
const VIEW_OF_STATE: Record<LinkState, CoreLinkView> = {
  ONLINE: 'up',
  LIVE: 'up',
  CONNECTING: 'settling',
  RESYNCING: 'settling',
  STALE: 'down',
  OFFLINE: 'down',
};
const ALL_STATES = Object.keys(VIEW_OF_STATE) as LinkState[];
const VIEWS: readonly CoreLinkView[] = ['up', 'settling', 'down', 'none'];
const SOURCES: readonly CoreLinkSource[] = ['SIMULATED', 'HEARTBEAT', 'LIVE'];
const HEARTBEATS = Object.values(HeartbeatState);

/** The runtime's link of LIVE mode, built as `LiveRuntime` builds it (`sim-runtime-provider.tsx`). */
const liveLink = (heartbeat: HeartbeatState): CoreLinkInfo => ({ source: 'LIVE', state: coreLinkStateFor('LIVE', heartbeat, 'CONNECTED'), heartbeat });

describe('the one view of the link (coreLinkViewOf)', () => {
  it('maps every state of both vocabularies, and the vocabularies hold no other state', () => {
    const known = [...new Set([...Object.values(LiveLinkState), ...Object.values(HeartbeatState)])].sort();
    expect([...ALL_STATES].sort()).toEqual(known);
    for (const state of ALL_STATES) expect([state, coreLinkViewOf(state)]).toEqual([state, VIEW_OF_STATE[state]]);
  });

  it('no link is `none`: Simulated mode (`useLiveLink()` is null) and an absent heartbeat', () => {
    expect(coreLinkViewOf(null)).toBe('none');
    expect(coreLinkViewOf(undefined)).toBe('none');
  });

  it("the runtime's link: a LIVE source reads its heartbeat; SIMULATED and HEARTBEAT have no link to the Core server", () => {
    for (const heartbeat of HEARTBEATS) {
      expect([heartbeat, coreLinkViewOf(liveLink(heartbeat))]).toEqual([heartbeat, VIEW_OF_STATE[heartbeat]]);
      // HEARTBEAT mode follows mock-core's heartbeat: its outage is the banner's, never this notice.
      expect([heartbeat, coreLinkViewOf({ source: 'HEARTBEAT', state: coreLinkStateFor('HEARTBEAT', heartbeat, 'CONNECTED'), heartbeat })]).toEqual([heartbeat, 'none']);
    }
    expect(coreLinkViewOf({ source: 'SIMULATED', state: 'OFFLINE' })).toBe('none');
    expect(coreLinkViewOf({ source: 'SIMULATED', state: 'ONLINE' })).toBe('none');
  });

  it('a LIVE link without a heartbeat (a fake runtime) falls back on its two-valued state', () => {
    expect(coreLinkViewOf({ source: 'LIVE', state: 'ONLINE' })).toBe('up');
    expect(coreLinkViewOf({ source: 'LIVE', state: 'OFFLINE' })).toBe('down');
  });

  it('a view is its own view, so a screen can key its state on the view', () => {
    for (const view of VIEWS) expect(coreLinkViewOf(view)).toBe(view);
  });

  it('a value that is no link state says nothing about the link', () => {
    for (const other of ['LIMIT', 'RATE_LIMITED', 'DENIED', '', 'online', 'offline']) {
      expect([other, coreLinkViewOf(other as unknown as CoreLinkInput)]).toEqual([other, 'settling']);
    }
    expect(coreLinkViewOf(429 as unknown as CoreLinkInput)).toBe('settling');
  });
});

describe('the rule (offlineNoticeAfter): down shows at once, up and none hide at once, settling keeps', () => {
  it('every view, from hidden and from shown', () => {
    const table: [CoreLinkView, boolean, boolean][] = [
      // view, after hidden, after shown
      ['down', true, true],
      ['up', false, false],
      ['none', false, false],
      ['settling', false, true],
    ];
    for (const [view, fromHidden, fromShown] of table) {
      expect([view, offlineNoticeAfter(false, view), offlineNoticeAfter(true, view)]).toEqual([view, fromHidden, fromShown]);
    }
  });

  it('every state of both vocabularies, from hidden and from shown', () => {
    const table: [CoreLinkInput, boolean, boolean][] = [
      [LiveLinkState.OFFLINE, true, true],
      [LiveLinkState.STALE, true, true],
      [LiveLinkState.ONLINE, false, false],
      // The first connect of a start does not flash the notice; between two reconnect attempts it stays.
      [LiveLinkState.CONNECTING, false, true],
      // The RESYNCING of a settle time-out (CL-17) is a transient too.
      [LiveLinkState.RESYNCING, false, true],
      [HeartbeatState.OFFLINE, true, true],
      [HeartbeatState.STALE, true, true],
      [HeartbeatState.LIVE, false, false],
      [HeartbeatState.CONNECTING, false, true],
      // Simulated mode, an absent heartbeat: no Live link, no notice.
      [null, false, false],
      [undefined, false, false],
    ];
    for (const [link, fromHidden, fromShown] of table) {
      expect([link, offlineNoticeAfter(false, link), offlineNoticeAfter(true, link)]).toEqual([link, fromHidden, fromShown]);
    }
  });

  it("the runtime's link: LIVE follows its heartbeat; HEARTBEAT mode with mock-core down shows no Core server notice", () => {
    expect(offlineNoticeAfter(false, liveLink('OFFLINE'))).toBe(true);
    expect(offlineNoticeAfter(true, liveLink('CONNECTING'))).toBe(true);
    expect(offlineNoticeAfter(false, liveLink('CONNECTING'))).toBe(false);
    expect(offlineNoticeAfter(true, liveLink('LIVE'))).toBe(false);
    expect(offlineNoticeAfter(true, { source: 'HEARTBEAT', state: 'OFFLINE', heartbeat: 'OFFLINE' })).toBe(false);
    expect(offlineNoticeAfter(true, { source: 'SIMULATED', state: 'OFFLINE' })).toBe(false);
  });

  it('is idempotent for a fixed input: re-applying it when nothing changed changes nothing', () => {
    for (const link of [...ALL_STATES, ...VIEWS, null, undefined] as CoreLinkInput[]) {
      for (const shown of [false, true]) {
        const once = offlineNoticeAfter(shown, link);
        expect([link, shown, offlineNoticeAfter(once, link)]).toEqual([link, shown, once]);
      }
    }
  });
});

describe('no flicker, on a manual clock: one flip on at the first down state, one flip off when the link is back', () => {
  interface Step {
    readonly at: number;
    readonly link: LiveLinkState;
  }
  interface Flip {
    readonly at: number;
    readonly step: number;
    readonly shown: boolean;
  }

  /**
   * The link of an outage as the Live socket reports it, stamped with the transport's own constants:
   * a cold start, the Core going silent, STALE after `HEARTBEAT_STALE_AFTER_MS`, the socket closing,
   * one reconnect attempt per `RECONNECT_BACKOFF_MS` value (each CONNECTING, then OFFLINE again), and
   * the link coming back. `scale` stretches or squeezes every interval.
   */
  function outage(scale = 1): { steps: Step[]; staleAt: number; backAt: number } {
    const steps: Step[] = [];
    let t = 0;
    const add = (delta: number, link: LiveLinkState) => {
      t += delta * scale;
      steps.push({ at: t, link });
    };
    add(0, LiveLinkState.CONNECTING); // cold start, before the first heartbeat
    add(120, LiveLinkState.ONLINE); // the first heartbeat and the snapshot
    add(5_000 + HEARTBEAT_STALE_AFTER_MS, LiveLinkState.STALE); // the last message came 2.5 s ago
    const staleAt = t;
    add(1_000, LiveLinkState.OFFLINE); // the socket closes
    for (const backoff of RECONNECT_BACKOFF_MS) {
      add(backoff, LiveLinkState.CONNECTING);
      add(300, LiveLinkState.OFFLINE);
    }
    add(8_000, LiveLinkState.CONNECTING);
    add(40, LiveLinkState.RESYNCING); // the snapshot is late: a resync, still a transient
    add(200, LiveLinkState.ONLINE);
    return { steps, staleAt, backAt: t };
  }

  /** Runs the steps on a manual clock and records each instant the notice changed. */
  function run(steps: readonly { at: number; link: CoreLinkInput }[]): Flip[] {
    const clock = { now: 0 };
    const flips: Flip[] = [];
    let shown = false;
    steps.forEach((step, index) => {
      clock.now = step.at;
      const next = offlineNoticeAfter(shown, step.link);
      if (next !== shown) flips.push({ at: clock.now, step: index, shown: next });
      shown = next;
    });
    return flips;
  }

  it('the notice shows at the very instant of the first down state (no hold time) and stays through every reconnect attempt', () => {
    const { steps, staleAt, backAt } = outage();
    expect(steps.filter((step) => step.link === LiveLinkState.CONNECTING)).toHaveLength(RECONNECT_BACKOFF_MS.length + 2);
    expect(run(steps).map(({ at, shown }) => ({ at, shown }))).toEqual([
      { at: staleAt, shown: true },
      { at: backAt, shown: false },
    ]);
  });

  it('the same outage read from the heartbeat (the Login screen holds that) flips at the same instants', () => {
    const { steps, staleAt } = outage();
    const toHeartbeat = (link: LiveLinkState): HeartbeatState | null =>
      link === LiveLinkState.ONLINE ? 'LIVE' : link === LiveLinkState.RESYNCING ? null : (link as HeartbeatState);
    const heartbeats = steps.flatMap((step) => {
      const heartbeat = toHeartbeat(step.link);
      return heartbeat === null ? [] : [{ at: step.at, link: heartbeat }];
    });
    const backAt = heartbeats[heartbeats.length - 1]!.at;
    expect(run(heartbeats).map(({ at, shown }) => ({ at, shown }))).toEqual([
      { at: staleAt, shown: true },
      { at: backAt, shown: false },
    ]);
    // And from the runtime's link of LIVE mode, as a screen gets it from `useCoreLink()`.
    expect(run(heartbeats.map((step) => ({ at: step.at, link: liveLink(step.link) }))).map(({ at, shown }) => ({ at, shown }))).toEqual([
      { at: staleAt, shown: true },
      { at: backAt, shown: false },
    ]);
  });

  it('the intervals do not matter: states 1 ms apart or an hour apart flip the notice at the same steps', () => {
    const base = run(outage().steps).map(({ step, shown }) => ({ step, shown }));
    for (const scale of [0.0002, 1, 720]) {
      expect([scale, run(outage(scale).steps).map(({ step, shown }) => ({ step, shown }))]).toEqual([scale, base]);
    }
  });

  it('a cold start that never reaches the Core shows the notice at the first OFFLINE, not before', () => {
    const steps = [
      { at: 0, link: LiveLinkState.CONNECTING },
      { at: 500, link: LiveLinkState.CONNECTING },
      { at: 3_000, link: LiveLinkState.OFFLINE },
      { at: 3_500, link: LiveLinkState.CONNECTING },
    ];
    expect(run(steps)).toEqual([{ at: 3_000, step: 2, shown: true }]);
  });
});

describe('a 429 is a limit, never an outage (LB-10)', () => {
  const limit = new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 41 });

  it('the presenter calls a 429 a limit and no outage', () => {
    expect(describeCoreError(limit)).toMatchObject({ kind: 'LIMIT', outage: false, retryAfterSeconds: 41 });
  });

  it('a 429 is no link state: whatever the link shows stays, with the link up and with the link down', () => {
    const presentation = describeCoreError(limit)!;
    for (const [shown, link] of [
      [false, LiveLinkState.ONLINE],
      [true, LiveLinkState.OFFLINE],
    ] as const) {
      const before = offlineNoticeAfter(shown, link);
      // The refusal does not move the link, so the notice is re-applied on the same link …
      expect(offlineNoticeAfter(before, link)).toBe(before);
      // … and a refusal handed in by mistake keeps what is shown (the type check refuses it first).
      // @ts-expect-error a refusal's kind is no link state
      expect(offlineNoticeAfter(before, presentation.kind)).toBe(before);
      // @ts-expect-error a status code is no link state
      expect(offlineNoticeAfter(before, 429)).toBe(before);
    }
  });
});

describe('one rule in the app', () => {
  it('the Pair screen and the Login screen call this very function, under the names they use', () => {
    expect(pairingOfflineNoticeAfter).toBe(offlineNoticeAfter);
    expect(liveOfflineNoticeAfter).toBe(offlineNoticeAfter);
    expect(barrelOfflineNoticeAfter).toBe(offlineNoticeAfter);
    expect(barrelCoreLinkViewOf).toBe(coreLinkViewOf);
  });

  it("the screens' notice and the app's connection banner agree on every heartbeat of LIVE mode", () => {
    const kinds: readonly ConnectionBannerKind[] = ['hidden', 'offline', 'resynced'];
    for (const current of kinds) {
      for (const heartbeat of HEARTBEATS) {
        const banner = nextBannerKind(current, liveLink(heartbeat));
        expect([current, heartbeat, banner === 'offline']).toEqual([current, heartbeat, offlineNoticeAfter(current === 'offline', liveLink(heartbeat))]);
      }
    }
  });

  it('every source: only LIVE can show the notice', () => {
    for (const source of SOURCES) {
      const shows = HEARTBEATS.some((heartbeat) => offlineNoticeAfter(false, { source, state: coreLinkStateFor(source, heartbeat, 'OFFLINE'), heartbeat }));
      expect([source, shows]).toEqual([source, source === 'LIVE']);
    }
  });
});

describe('pure: the rule reads no clock, no timer, no React and no storage (rule 7 of the CP-M1 review)', () => {
  it('asks no clock and starts no timer while it decides, for every input', () => {
    const spies = [
      jest.spyOn(Date, 'now'),
      jest.spyOn(performance, 'now'),
      jest.spyOn(globalThis, 'setTimeout'),
      jest.spyOn(globalThis, 'setInterval'),
    ];
    const inputs: CoreLinkInput[] = [...ALL_STATES, ...VIEWS, null, undefined, liveLink('OFFLINE'), liveLink('LIVE'), { source: 'LIVE', state: 'OFFLINE' }, { source: 'HEARTBEAT', state: 'OFFLINE', heartbeat: 'OFFLINE' }];
    try {
      for (const link of inputs) {
        coreLinkViewOf(link);
        for (const shown of [false, true]) offlineNoticeAfter(shown, link);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('the file names none of them in its code', () => {
    const text = readFileSync(join(__dirname, 'link-notice.ts'), 'utf8');
    const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
    const forbidden: Record<string, RegExp> = {
      'a wall clock': /\bDate\b|\bperformance\b|\.now\s*\(/,
      'a timer': /\bset(?:Timeout|Interval|Immediate)\b|\brequestAnimationFrame\b/,
      'React or a store': /from\s+'react'|\buse[A-Z]\w*\s*\(|zustand|\bclock\b/,
      'storage or a log': /AsyncStorage|SecureStore|reportRuntimeIssue|runtimeLog/,
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, pattern.test(code)]).toEqual([what, false]);
    // The matchers find what they look for.
    expect(forbidden['a wall clock']!.test('const t = Date.now();')).toBe(true);
    expect(forbidden['a wall clock']!.test('const t = sim.clock.now();')).toBe(true);
    expect(forbidden['a timer']!.test('setTimeout(() => show(), 3000);')).toBe(true);
    expect(forbidden['React or a store']!.test('const now = useSim((s) => s.clock.now);')).toBe(true);
  });
});
