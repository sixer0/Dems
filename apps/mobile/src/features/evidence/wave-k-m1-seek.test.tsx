// Wave K, driver M1 (mobile, with the tablet) - the sealed player's seek and its place on the page.
//
// | Finding | What the tablet showed (implementation/142_fix_wave_k_m1.md section 1) | Rule held here |
// |---------|-----------------------------------------------------------------------|----------------|
// | G94b-01 | The scrubber hands over the right value and the player receives it; the Android player then lands on 0:00 because the stream it was handed carries no seek index (no duration at `sourceLoad`) | A stream the player CAN seek: the value of the scrubber is the position written to both players, and Play goes on from there. A stream it CANNOT seek: nothing is written to a player (a write restarts it at 0), the scrubber is disabled and says why |
// | G94b-01 | The session must be asked with the index | `{ fileId, seekIndex: true }` first; `{ fileId }` when the registry or the Core does not know the member |
// | G94b-04 | Play in the action bar started the player below the fold | The Play action scrolls the detail to its tabs block |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import type { MobileLiveSim } from '@/runtime';
import { EvidenceMediaSessionRequestSchema } from '@dems/shared/api';
import { SEEK_INDEX_MEMBER, registryKnowsSeekIndex, requestMediaSession } from './media-session';
import { seekAvailabilityOf } from './sealed-playback';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { bedWith, openItem, realItem } from './testing/wave-h-c2-kit';

jest.setTimeout(40_000);

/** What Media3 reports as the duration of a stream it cannot seek (the tablet's own value, logcat of 2026-10-11). */
const ANDROID_DURATION_UNSET = -9223372474941440;
const NO_SEEK_SENTENCE = 'A position cannot be chosen: the Core server sent this recording without a seek index. Play and Pause work.';

type Listener = (payload: Record<string, unknown>) => void;
interface FakePlayer {
  currentTime: number;
  /** Every position written to the player, in order. */
  writes: number[];
  play: jest.Mock;
  pause: jest.Mock;
  replaceAsync: jest.Mock;
  addListener: (event: string, listener: Listener) => { remove(): void };
  emit(event: string, payload?: Record<string, unknown>): void;
}
let players: FakePlayer[] = [];
function fakePlayer(): FakePlayer {
  const listeners = new Map<string, Set<Listener>>();
  let time = 0;
  const player: FakePlayer = {
    get currentTime() {
      return time;
    },
    set currentTime(value: number) {
      time = value;
      player.writes.push(value);
    },
    writes: [],
    play: jest.fn(),
    pause: jest.fn(),
    replaceAsync: jest.fn(async () => undefined),
    addListener: (event, listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      listeners.set(event, set);
      set.add(listener);
      return { remove: () => void set.delete(listener) };
    },
    emit: (event, payload = {}) => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
    },
  };
  return player;
}

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
  players = [];
  jest.spyOn(ExpoVideo, 'useVideoPlayer').mockImplementation((() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRef } = require('react') as typeof import('react');
    const held = useRef<FakePlayer | null>(null);
    if (held.current === null) {
      held.current = fakePlayer();
      players.push(held.current);
    }
    return held.current;
  }) as unknown as typeof ExpoVideo.useVideoPlayer);
});
afterEach(() => {
  bed?.stop();
  bed = null;
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const TTL_MS = 60_000;

/** A streamable REAL item of 1:36 (the length of the gate's `EV-20261010-0020`) with both camera files, on its detail. */
async function onDetail(): Promise<LiveEvidenceBed> {
  const { b, id } = await bedWith('0001', realItem({ durationMs: 96_000 }));
  bed = b;
  b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
  (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: 'http://core.test:8090', headers: { Authorization: 'Bearer marker' } });
  let calls = 0;
  b.fake.answer('createEvidenceMediaSession', (call) => {
    calls += 1;
    const first = calls % 2 === 1;
    return { status: 201, body: { evidenceId: call.params.id ?? '', fileId: first ? 'VIDEO-01' : 'VIDEO-02', url: `http://127.0.0.1:8443/media/mts_${first ? 'a' : 'b'}${'x'.repeat(20)}${calls}`, expiresAt: b.fake.clock.now() + TTL_MS, ranges: true } };
  });
  await openItem(b, id);
  return b;
}

/** The player open and paused at 0:00; the leading player has reported `duration` for its source. */
async function opened(duration: number): Promise<{ b: LiveEvidenceBed; lead: FakePlayer; follow: FakePlayer }> {
  const b = await onDetail();
  fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
  await b.flush();
  const lead = players.at(-2) as FakePlayer;
  const follow = players.at(-1) as FakePlayer;
  act(() => lead.emit('sourceLoad', { duration }));
  lead.writes.length = 0;
  follow.writes.length = 0;
  return { b, lead, follow };
}

const scrubTo = (ms: number) => fireEvent(screen.getByTestId('evidence-sealed-scrubber'), 'changeEnd', ms);

describe('seekAvailabilityOf - what a player\'s duration says about its stream', () => {
  it('a duration: the stream can be sought', () => {
    expect(seekAvailabilityOf(97.301)).toBe('AVAILABLE');
    expect(seekAvailabilityOf(0.04)).toBe('AVAILABLE');
  });
  it('no duration, in every form a player reports it: the stream cannot be sought', () => {
    for (const none of [ANDROID_DURATION_UNSET, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined, null, '97']) expect(seekAvailabilityOf(none)).toBe('NONE');
  });
});

describe('G94b-01 - a stream the player can seek (it reported a duration)', () => {
  it.each([
    ['25 %', 24_000, '0:24 / 1:36'],
    ['50 %', 48_000, '0:48 / 1:36'],
    ['90 %', 86_000, '1:26 / 1:36'],
  ])('the scrubber released at %s: that position is written to BOTH players, the time shows it, and Play goes on from there', async (_label, ms, shown) => {
    const { lead, follow } = await opened(96.0);
    expect(screen.queryByTestId('evidence-playback-no-seek')).toBeNull();
    scrubTo(ms);
    expect(lead.writes).toEqual([ms / 1000]);
    expect(follow.writes).toEqual([ms / 1000]);
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent(shown);
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    expect(lead.play).toHaveBeenCalledTimes(1);
    expect(follow.play).toHaveBeenCalledTimes(1);
    // Play wrote no other position: both players start where the seek put them.
    expect(lead.currentTime).toBe(ms / 1000);
    expect(follow.currentTime).toBe(ms / 1000);
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent(shown);
  });

  it('CONTROL: the second file is re-aligned to the first when it drifts', async () => {
    const { lead, follow } = await opened(96.0);
    act(() => lead.emit('timeUpdate', { currentTime: 10 }));
    expect(follow.writes).toEqual([10]);
  });
});

describe('G94b-01 - a stream the player cannot seek (no duration: the file came without a seek index)', () => {
  it('the scrubber is disabled and says why; a released scrubber writes NOTHING to a player and the playhead stays where the player is', async () => {
    const { lead, follow } = await opened(ANDROID_DURATION_UNSET);
    expect(screen.getByTestId('evidence-playback-no-seek')).toHaveTextContent(NO_SEEK_SENTENCE);
    act(() => lead.emit('timeUpdate', { currentTime: 5 }));
    follow.writes.length = 0;
    scrubTo(48_000);
    expect(lead.writes).toEqual([]);
    expect(follow.writes).toEqual([]);
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:05 / 1:36');
  });

  it('the second file is NOT "re-aligned" (a position written to it would restart it at 0:00), and Play starts both without writing a position', async () => {
    const { lead, follow } = await opened(ANDROID_DURATION_UNSET);
    act(() => lead.emit('timeUpdate', { currentTime: 10 }));
    expect(follow.writes).toEqual([]);
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    expect(follow.writes).toEqual([]);
    expect(lead.play).toHaveBeenCalledTimes(1);
    expect(follow.play).toHaveBeenCalledTimes(1);
  });

  it('a new source is judged anew: after a stream without an index, one WITH an index seeks', async () => {
    const { lead, follow } = await opened(ANDROID_DURATION_UNSET);
    act(() => lead.emit('sourceLoad', { duration: 96.0 }));
    expect(screen.queryByTestId('evidence-playback-no-seek')).toBeNull();
    scrubTo(48_000);
    expect(lead.writes).toEqual([48]);
    expect(follow.writes).toEqual([48]);
  });
});

describe('G94b-01 - the media session is asked with the seek index', () => {
  type Call = { params: { id: string }; body?: Record<string, unknown> };
  const session = (extra: Record<string, unknown> = {}) => ({ ok: true as const, status: 201, data: { evidenceId: 'EV-1', fileId: 'VIDEO-01', url: `http://127.0.0.1:8443/media/mts_${'a'.repeat(24)}`, expiresAt: 60_000, ranges: true, ...extra } });
  const refusal = (status: number, code: string) => ({ ok: false as const, status, error: { code } });
  function liveWith(answer: (call: Call, nth: number) => unknown): { live: MobileLiveSim; bodies: (Record<string, unknown> | undefined)[] } {
    const bodies: (Record<string, unknown> | undefined)[] = [];
    const call = jest.fn(async (_operation: string, input: Call) => {
      bodies.push(input.body);
      const result = answer(input, bodies.length);
      if (result instanceof Error) throw result;
      return result;
    });
    return { live: { client: { call } } as unknown as MobileLiveSim, bodies };
  }
  const usageError = () => Object.assign(new Error('unknown member'), { name: 'CoreClientUsageError' });

  it('the member is named in ONE constant, and it is sent only when the contract of this build holds it BY THAT NAME', () => {
    expect(SEEK_INDEX_MEMBER).toBe('seekIndex');
    expect(registryKnowsSeekIndex()).toBe(Object.keys(EvidenceMediaSessionRequestSchema.shape).includes(SEEK_INDEX_MEMBER));
  });

  it('the contract does not hold the member: ONE request `{ fileId }`, nothing the contract does not know is sent', async () => {
    const { live, bodies } = liveWith(() => session());
    const answer = await requestMediaSession(live, 'EV-1', 'VIDEO-01', false);
    expect(bodies).toEqual([{ fileId: 'VIDEO-01' }]);
    expect(answer.ok && answer.session.indexed).toBe(false);
  });

  it('a Core that knows the member: ONE request `{ fileId, seekIndex: true }`; the session records that the Core sent the index', async () => {
    const { live, bodies } = liveWith(() => session({ [SEEK_INDEX_MEMBER]: true }));
    const answer = await requestMediaSession(live, 'EV-1', 'VIDEO-01', true);
    expect(bodies).toEqual([{ fileId: 'VIDEO-01', [SEEK_INDEX_MEMBER]: true }]);
    expect(answer.ok && answer.session.indexed).toBe(true);
  });

  it('the typed client refuses the member: the session is asked with `{ fileId }` and is not marked indexed', async () => {
    const { live, bodies } = liveWith((call) => (call.body?.[SEEK_INDEX_MEMBER] === true ? usageError() : session()));
    const answer = await requestMediaSession(live, 'EV-1', 'VIDEO-01', true);
    expect(bodies).toEqual([{ fileId: 'VIDEO-01', [SEEK_INDEX_MEMBER]: true }, { fileId: 'VIDEO-01' }]);
    expect(answer.ok && answer.session.indexed).toBe(false);
  });

  it('a Core older than this app answers 422 to the member: asked again without it, once', async () => {
    const { live, bodies } = liveWith((call) => (call.body?.[SEEK_INDEX_MEMBER] === true ? refusal(422, 'INVALID_INPUT') : session()));
    const answer = await requestMediaSession(live, 'EV-1', 'VIDEO-01', true);
    expect(bodies).toEqual([{ fileId: 'VIDEO-01', [SEEK_INDEX_MEMBER]: true }, { fileId: 'VIDEO-01' }]);
    expect(answer.ok).toBe(true);
  });

  it('CONTROL: any other refusal (403, 409) is the answer - nothing is asked twice', async () => {
    for (const [status, code, kind] of [[403, 'NOT_PERMITTED', 'NOT_PERMITTED'], [409, 'MEDIA_NOT_AVAILABLE', 'NOT_AVAILABLE']] as const) {
      const { live, bodies } = liveWith(() => refusal(status, code));
      const answer = await requestMediaSession(live, 'EV-1', 'VIDEO-01', true);
      expect(bodies).toHaveLength(1);
      expect(!answer.ok && answer.refusal).toBe(kind);
    }
  });

  it('the registry knows neither member: asked without a body, as before', async () => {
    const { live, bodies } = liveWith((call) => (call.body === undefined ? session() : usageError()));
    const answer = await requestMediaSession(live, 'EV-1', 'VIDEO-01', true);
    expect(bodies).toEqual([{ fileId: 'VIDEO-01', [SEEK_INDEX_MEMBER]: true }, { fileId: 'VIDEO-01' }, undefined]);
    expect(answer.ok).toBe(true);
  });
});

describe('G94b-04 - Play in the action bar brings the player into view', () => {
  it('the detail scrolls to its tabs block (where the tab row and the player are), wherever the block was laid out', async () => {
    const b = await onDetail();
    const scrollTo = jest.fn();
    // The scroll view of the detail: its imperative handle is found on the way up from the host view.
    type Node = { parent: Node | null; instance?: { scrollTo?: unknown } | null };
    let patched = false;
    for (let node: Node | null = screen.getByTestId('evidence-detail-scroll') as unknown as Node; node !== null && !patched; node = node.parent) {
      if (typeof node.instance?.scrollTo === 'function') {
        node.instance.scrollTo = scrollTo;
        patched = true;
      }
    }
    expect(patched).toBe(true);
    fireEvent(screen.getByTestId('evidence-detail-tabs-block'), 'layout', { nativeEvent: { layout: { x: 0, y: 912, width: 600, height: 400 } } });
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect(scrollTo).toHaveBeenCalledWith({ y: 912, animated: false });
    // The press also opened the player: one media session per camera file.
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(2);
  });
});
