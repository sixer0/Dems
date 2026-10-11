// Fix wave K, closing pass Z1 (mobile half; the tablet's own proof is in implementation/145_fix_wave_k_z1.md).
//
// | Finding | What the tablet showed | Rule held here |
// |---------|------------------------|----------------|
// | G94b-01 | With the Core's INDEXED VIEW the Android player reports a duration and seeks land | The answer's `seekIndex` is read BY THE CONTRACT'S NAME (its exported example); a session asked with it; the scrubber seeks when the player reports a duration |
// | G94b-01 | After a renewal the new stream reported 0:00 before the position was written | A renewal comes back to the playhead: the position is written at the hand-over AND when the leading player has loaded the stream; the new stream's own start is not shown meanwhile |
// | (seen)  | Taking the old source off a player made it report "played to end": the control read Play while the renewed players played | The end report of a hand-over is not a Pause |
// | G94b-10 | One tamper stop = 8 refused requests: the native player's 3 retries, then the app's renewal and 3 more | An error on a session that has NOT ended is not renewed by itself |
// | G94b-04 | The action bar read "Play" while the player played | It reads "Pause" then, and pauses |
// | G94b-07 | No development mark in the band legend before a verify run | The player hands the item's own interval classes to the band |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE, EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE, EvidenceMediaSessionRequestSchema, EvidenceMediaSessionSchema } from '@dems/shared/api';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import type { MobileLiveSim } from '@/runtime';
import { SEEK_INDEX_MEMBER, registryKnowsSeekIndex, requestMediaSession } from './media-session';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { bedWith, openItem, realItem } from './testing/real-item-kit';
import { seekAvailabilityOf, bandSegments, segmentAt } from './sealed-playback';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { AppState, ScrollView, type AppStateStatus } from 'react-native';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('the indexed view, a renewal, a player error, the action bar and the legend', () => {
unmountBeforeTheHooksOfThisGroup();

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
  /** Moves the player's own clock without counting as a write of the app. */
  drift(seconds: number): void;
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
    drift: (seconds) => {
      time = seconds;
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
const NO_SEEK_SENTENCE = 'A position cannot be chosen: the Core server sent this recording without a seek index. Play and Pause work.';
const DURATION_S = 60.795;

/** A streamable REAL item of 1:01 with both camera files, on its detail; the Core answers every session as the INDEXED view. */
async function onDetail(more: Record<string, unknown> = {}): Promise<LiveEvidenceBed> {
  const { b, id } = await bedWith('0001', realItem({ durationMs: 61_000, ...more }));
  bed = b;
  b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
  (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: 'http://core.test:8090', headers: { Authorization: 'Bearer marker' } });
  let calls = 0;
  b.fake.answer('createEvidenceMediaSession', (call) => {
    calls += 1;
    const first = calls % 2 === 1;
    // The contract's example, member by member: only the IDs, the path and the instant are this test's.
    return { status: 201, body: { ...EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE, evidenceId: call.params.id ?? '', fileId: first ? 'VIDEO-01' : 'VIDEO-02', url: `http://127.0.0.1:8443/media/mts_${first ? 'a' : 'b'}${'x'.repeat(20)}${calls}`, expiresAt: b.fake.clock.now() + TTL_MS } };
  });
  await openItem(b, id);
  return b;
}

/** The player open through the action bar and playing; the leading player has loaded its stream. */
async function playingFromActionBar(more: Record<string, unknown> = {}): Promise<{ b: LiveEvidenceBed; lead: FakePlayer; follow: FakePlayer }> {
  const b = await onDetail(more);
  fireEvent.press(screen.getByTestId('evidence-action-play'));
  await b.flush();
  const lead = players.at(-2) as FakePlayer;
  const follow = players.at(-1) as FakePlayer;
  act(() => lead.emit('sourceLoad', { duration: DURATION_S }));
  return { b, lead, follow };
}

const scrubTo = (ms: number) => fireEvent(screen.getByTestId('evidence-sealed-scrubber'), 'changeEnd', ms);
const sessionRequests = (b: LiveEvidenceBed) => b.requests('createEvidenceMediaSession');

describe('G94b-01 - the indexed view is read by the name of the contract', () => {
  it('the constant IS the name the contract example and both schemas hold; the request example asks with it', () => {
    expect(SEEK_INDEX_MEMBER in EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE).toBe(true);
    expect(EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE[SEEK_INDEX_MEMBER]).toBe(true);
    expect(EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE[SEEK_INDEX_MEMBER]).toBe(true);
    expect(SEEK_INDEX_MEMBER in (EvidenceMediaSessionRequestSchema as unknown as { shape: Record<string, unknown> }).shape).toBe(true);
    expect(SEEK_INDEX_MEMBER in (EvidenceMediaSessionSchema as unknown as { shape: Record<string, unknown> }).shape).toBe(true);
    // So the app of THIS build asks for the view.
    expect(registryKnowsSeekIndex()).toBe(true);
  });

  it('ONE request `{ fileId, seekIndex: true }` (no fall-back request); an answer shaped like the contract example marks the session indexed', async () => {
    const b = await onDetail();
    const answer = await requestMediaSession(b.mobile.live as unknown as MobileLiveSim, 'EV-20260929-0001', 'VIDEO-02');
    expect(answer.ok && answer.session.indexed).toBe(true);
    const asked = sessionRequests(b);
    expect(asked).toHaveLength(1);
    expect(asked[0]?.body).toEqual({ fileId: 'VIDEO-02', [SEEK_INDEX_MEMBER]: true });
  });

  it('CONTROL: the Core states no indexed view (the member is absent): the session is not marked indexed', async () => {
    const b = await onDetail();
    const { [SEEK_INDEX_MEMBER]: _stated, ...plain } = EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE;
    b.fake.answerOnce('createEvidenceMediaSession', { status: 201, body: { ...plain, evidenceId: 'EV-20260929-0001', expiresAt: b.fake.clock.now() + TTL_MS } });
    const answer = await requestMediaSession(b.mobile.live as unknown as MobileLiveSim, 'EV-20260929-0001', 'VIDEO-01');
    expect(answer.ok && answer.session.indexed).toBe(false);
  });

  it('the scrubber of an indexed stream is enabled, without the no-seek sentence, and a seek goes to both players; CONTROL: a player that reports no duration keeps the sentence', async () => {
    const { lead, follow } = await playingFromActionBar();
    expect(screen.queryByTestId('evidence-playback-no-seek')).toBeNull();
    expect(screen.getByTestId('evidence-sealed-scrubber').props.accessibilityState?.disabled ?? false).toBe(false);
    lead.writes.length = 0;
    follow.writes.length = 0;
    scrubTo(15_000);
    expect([lead.writes, follow.writes]).toEqual([[15], [15]]);
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:15 / 1:01');
    // Control: the same player handed a stream it cannot seek.
    act(() => lead.emit('sourceLoad', { duration: -9223372474941440 }));
    expect(screen.getByTestId('evidence-playback-no-seek')).toHaveTextContent(NO_SEEK_SENTENCE);
  });
});

describe('a session renewal keeps the playhead', () => {
  /** Plays to 0:15, pauses, lets the session end, presses Play: the renewal is in flight and the new players hold their sources. */
  async function renewedAt15(): Promise<{ b: LiveEvidenceBed; lead: FakePlayer; follow: FakePlayer }> {
    const { b, lead, follow } = await playingFromActionBar();
    lead.drift(15);
    follow.drift(15);
    act(() => lead.emit('timeUpdate', { currentTime: 15 }));
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-playing'));
    expect(screen.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    await b.elapse(TTL_MS + 2_000, 1_000);
    lead.writes.length = 0;
    follow.writes.length = 0;
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    await b.flush();
    expect(sessionRequests(b)).toHaveLength(4);
    return { b, lead, follow };
  }

  it('the position is written to both players at the hand-over, and the new stream\'s own "0:00" is NOT shown as the playhead', async () => {
    const { lead, follow } = await renewedAt15();
    expect([lead.writes, follow.writes]).toEqual([[15], [15]]);
    // The Android player dropped the write (it had not read the index yet) and reports its own start.
    lead.drift(0);
    follow.drift(0);
    act(() => lead.emit('timeUpdate', { currentTime: 0 }));
    act(() => lead.emit('timeUpdate', { currentTime: 0.25 }));
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:15 / 1:01');
  });

  it('when the leading player has loaded the stream, a player that is not at the place gets the position AGAIN; from there the playhead follows the player', async () => {
    const { lead, follow } = await renewedAt15();
    lead.drift(0);
    follow.drift(0);
    lead.writes.length = 0;
    follow.writes.length = 0;
    act(() => lead.emit('sourceLoad', { duration: DURATION_S }));
    expect([lead.writes, follow.writes]).toEqual([[15], [15]]);
    act(() => lead.emit('timeUpdate', { currentTime: 15.3 }));
    act(() => lead.emit('timeUpdate', { currentTime: 17 }));
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:17 / 1:01');
  });

  it('CONTROL: a player that kept the first write is not written again at the load', async () => {
    const { lead, follow } = await renewedAt15();
    lead.writes.length = 0;
    follow.writes.length = 0;
    act(() => lead.emit('sourceLoad', { duration: DURATION_S }));
    expect([lead.writes, follow.writes]).toEqual([[], []]);
  });

  it('a renewed stream that CANNOT be sought plays from its start, and the playhead says so (nothing is held back)', async () => {
    const { lead, follow } = await renewedAt15();
    lead.drift(0);
    follow.drift(0);
    act(() => lead.emit('sourceLoad', { duration: Number.NaN }));
    act(() => lead.emit('timeUpdate', { currentTime: 0.5 }));
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:00 / 1:01');
    expect(screen.getByTestId('evidence-playback-no-seek')).toBeTruthy();
  });

  it('the end report of the old source during the hand-over is not a Pause: the control keeps reading Pause; CONTROL: the end of the loaded stream pauses', async () => {
    const { lead } = await renewedAt15();
    expect(screen.getByTestId('evidence-sealed-toggle-playing')).toBeTruthy();
    const pausesBefore = lead.pause.mock.calls.length;
    act(() => lead.emit('playToEnd'));
    expect(screen.getByTestId('evidence-sealed-toggle-playing')).toBeTruthy();
    expect(lead.pause.mock.calls.length).toBe(pausesBefore);
    act(() => lead.emit('sourceLoad', { duration: DURATION_S }));
    act(() => lead.emit('playToEnd'));
    expect(screen.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
  });
});

describe('G94b-10 - a player error on a session that has NOT ended is not renewed by itself', () => {
  it('no new media session is asked: playback stops with its position and the Verify sentence, and "Open again" is offered', async () => {
    const { b, lead } = await playingFromActionBar();
    act(() => lead.emit('timeUpdate', { currentTime: 3.2 }));
    expect(sessionRequests(b)).toHaveLength(2);
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(sessionRequests(b)).toHaveLength(2);
    expect(screen.getByTestId('evidence-playback-stopped-position')).toHaveTextContent(/Playback stopped at 0:03 and did not resume\..*run Verify to see which\./);
    expect(screen.getByTestId('evidence-playback-reopen')).toBeTruthy();
    expect(screen.queryByTestId('evidence-playback-renewing')).toBeNull();
  });

  it('CONTROL: the same error on a session at its END (the Core\'s clock) is renewed once, at the same place', async () => {
    const { b, lead } = await playingFromActionBar();
    act(() => lead.emit('timeUpdate', { currentTime: 3.2 }));
    await b.elapse(TTL_MS + 2_000, 1_000);
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(sessionRequests(b)).toHaveLength(4);
    expect(screen.queryByTestId(/^evidence-playback-stopped-/)).toBeNull();
  });
});

describe('G94b-04 - the action bar follows the player', () => {
  it('"Play" before and after; "Pause" while the player plays; pressing it then pauses the players and asks for no new session', async () => {
    const b = await onDetail();
    expect(screen.getByTestId('evidence-action-play-label-play')).toHaveTextContent('Play');
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    const lead = players.at(-2) as FakePlayer;
    const follow = players.at(-1) as FakePlayer;
    expect(screen.getByTestId('evidence-action-play-label-pause')).toHaveTextContent('Pause');
    expect(screen.queryByTestId('evidence-action-play-label-play')).toBeNull();
    const pauses = [lead.pause.mock.calls.length, follow.pause.mock.calls.length];
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect([lead.pause.mock.calls.length, follow.pause.mock.calls.length]).toEqual([pauses[0]! + 1, pauses[1]! + 1]);
    expect(screen.getByTestId('evidence-action-play-label-play')).toHaveTextContent('Play');
    expect(screen.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    expect(sessionRequests(b)).toHaveLength(2);
    // And again: Play starts the open players.
    const plays = lead.play.mock.calls.length;
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect(lead.play.mock.calls.length).toBe(plays + 1);
    expect(screen.getByTestId('evidence-action-play-label-pause')).toBeTruthy();
  });

  it('the player\'s own control and the end of the recording move the action bar too', async () => {
    const { lead } = await playingFromActionBar();
    expect(screen.getByTestId('evidence-action-play-label-pause')).toBeTruthy();
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-playing'));
    expect(screen.getByTestId('evidence-action-play-label-play')).toBeTruthy();
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    expect(screen.getByTestId('evidence-action-play-label-pause')).toBeTruthy();
    act(() => lead.emit('playToEnd'));
    expect(screen.getByTestId('evidence-action-play-label-play')).toBeTruthy();
  });
});

describe('G94b-07 - the band legend gets the item\'s own interval classes', () => {
  const intervals = (sourceClass: string | null) => [
    { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 26_000, reason: 'START', ...(sourceClass === null ? {} : { sourceClass }) },
    { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 26_000, toMs: 61_000, reason: 'MANUAL', ...(sourceClass === null ? {} : { sourceClass }) },
  ];

  it('a microphone the item states as a generated test source carries the development mark in the legend, with no verify run', async () => {
    await playingFromActionBar({ audioSourceIntervals: intervals('FAKE') });
    expect(screen.getByTestId('evidence-band-development-MIC-01')).toBeTruthy();
    expect(screen.getByTestId('evidence-band-development-MIC-02')).toBeTruthy();
  });

  it('CONTROL: an item that states no class for its intervals shows no mark', async () => {
    await playingFromActionBar({ audioSourceIntervals: intervals(null) });
    expect(screen.getByTestId('evidence-band-legend-MIC-01')).toBeTruthy();
    expect(screen.queryByTestId('evidence-band-development-MIC-01')).toBeNull();
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m1-seek.test.tsx` (test-suite consolidation, D233): every case as it was.
// Wave K, driver M1 (mobile, with the tablet) - the sealed player's seek and its place on the page.
//
// | Finding | What the tablet showed (implementation/142_fix_wave_k_m1.md section 1) | Rule held here |
// |---------|-----------------------------------------------------------------------|----------------|
// | G94b-01 | The scrubber hands over the right value and the player receives it; the Android player then lands on 0:00 because the stream it was handed carries no seek index (no duration at `sourceLoad`) | A stream the player CAN seek: the value of the scrubber is the position written to both players, and Play goes on from there. A stream it CANNOT seek: nothing is written to a player (a write restarts it at 0), the scrubber is disabled and says why |
// | G94b-01 | The session must be asked with the index | `{ fileId, seekIndex: true }` first; `{ fileId }` when the registry or the Core does not know the member |
// | G94b-04 | Play in the action bar started the player below the fold | The Play action scrolls the detail to its tabs block |
describe('seek', () => {
unmountBeforeTheHooksOfThisGroup();
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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-l-m-player.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave L, driver L-M - the sealed player on the tablet and the phone (re-check 94; the devices' own
// proof is in implementation/155_fix_wave_l_m.md).
//
// | Finding | What the device showed | Rule held here |
// |---------|------------------------|----------------|
// | G94c-03 | An interrupted recording ended early in the player ("0:29 / 0:31", Play) without a word | When the item states the interruption and the leading player reports the end of its file, the player says so (the web's sentence, the same meaning). Not for a clean item; not for the end report of a source hand-over |
// | G94c-04 | "Audio at the playhead: no interval" at 0:00 (the first interval starts some ms in) | THE SAME tolerance rule as the web's `segmentAt`: a playhead before the first interval that reads the same second as its start is inside it; a gap between two intervals stays a gap |
// | G94c-05 | Phone, after background / foreground: the player stood still while both controls read "Pause"; the first press only flipped the label | Leaving the foreground pauses players AND state; coming back the controls follow the leading player's own `playing` report |
// | G94c-06 | On a short item Play left the player half below the fold and the stop sentence out of view | While the sealed player is asked for, the tabs block is at least as tall as the scroll view, and the player is brought to the top when it is drawn, when it stops with a sentence and at the interrupted end - until the operator scrolls |
describe('band, interrupted end, background and scroll', () => {
unmountBeforeTheHooksOfThisGroup();
type Listener = (payload: Record<string, unknown>) => void;
interface FakePlayer {
  /** What the native player reports of itself (expo-video `playing`). */
  playing: boolean;
  currentTime: number;
  /** Every position written to the player, in order. */
  writes: number[];
  play: jest.Mock;
  pause: jest.Mock;
  replaceAsync: jest.Mock;
  addListener: (event: string, listener: Listener) => { remove(): void };
  emit(event: string, payload?: Record<string, unknown>): void;
  /** Moves the player's own clock without counting as a write of the app. */
  drift(seconds: number): void;
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
    playing: false,
    play: jest.fn(() => {
      player.playing = true;
    }),
    pause: jest.fn(() => {
      player.playing = false;
    }),
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
    drift: (seconds) => {
      time = seconds;
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
const DURATION_S = 60.795;

/** A streamable REAL item of 1:01 with both camera files, on its detail; the Core answers every session as the INDEXED view. */
async function onDetail(more: Record<string, unknown> = {}): Promise<LiveEvidenceBed> {
  const { b, id } = await bedWith('0001', realItem({ durationMs: 61_000, ...more }));
  bed = b;
  b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
  (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: 'http://core.test:8090', headers: { Authorization: 'Bearer marker' } });
  let calls = 0;
  b.fake.answer('createEvidenceMediaSession', (call) => {
    calls += 1;
    const first = calls % 2 === 1;
    // The contract's example, member by member: only the IDs, the path and the instant are this test's.
    return { status: 201, body: { ...EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE, evidenceId: call.params.id ?? '', fileId: first ? 'VIDEO-01' : 'VIDEO-02', url: `http://127.0.0.1:8443/media/mts_${first ? 'a' : 'b'}${'x'.repeat(20)}${calls}`, expiresAt: b.fake.clock.now() + TTL_MS } };
  });
  await openItem(b, id);
  return b;
}

/** The player open through the action bar and playing; the leading player has loaded its stream. */
async function playingFromActionBar(more: Record<string, unknown> = {}): Promise<{ b: LiveEvidenceBed; lead: FakePlayer; follow: FakePlayer }> {
  const b = await onDetail(more);
  fireEvent.press(screen.getByTestId('evidence-action-play'));
  await b.flush();
  const lead = players.at(-2) as FakePlayer;
  const follow = players.at(-1) as FakePlayer;
  act(() => lead.emit('sourceLoad', { duration: DURATION_S }));
  return { b, lead, follow };
}

const scrubTo = (ms: number) => fireEvent(screen.getByTestId('evidence-sealed-scrubber'), 'changeEnd', ms);

/** The app-state listeners the player registered (the spy keeps them), and a way to say a change. */
let appStateListeners: ((next: AppStateStatus) => void)[] = [];
const appState = (next: AppStateStatus) => act(() => appStateListeners.forEach((listener) => listener(next)));
let scrolls: { y?: number }[] = [];
beforeEach(() => {
  appStateListeners = [];
  scrolls = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((type: string, listener: (next: AppStateStatus) => void) => {
    if (type === 'change') appStateListeners.push(listener);
    return { remove: () => void appStateListeners.splice(appStateListeners.indexOf(listener), 1) };
  }) as unknown as typeof AppState.addEventListener);
  jest.spyOn(ScrollView.prototype as unknown as { scrollTo: (to: { y?: number }) => void }, 'scrollTo').mockImplementation((to) => void scrolls.push(to));
});

const END_SENTENCE = /^End of the sealed recording at 0:29: the recording was interrupted, so it ends here\.$/;

describe('G94c-04 - the band at the start of a recording (the web\'s tolerance rule)', () => {
  const real = bandSegments(
    [
      { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 28_000, reason: 'START' },
      { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 30_500, toMs: 61_000, reason: 'MANUAL' },
    ] as never,
    61_000,
  );

  it('a playhead before the first interval that reads the same second as its start is inside it', () => {
    expect(segmentAt(real, 0)?.inputId).toBe('MIC-01');
    expect(segmentAt(real, 20)?.inputId).toBe('MIC-01');
    expect(segmentAt(real, 21)?.inputId).toBe('MIC-01');
  });

  it('CONTROL - a gap between two intervals stays a gap, and a first interval that starts a second in is not at 0:00', () => {
    expect(segmentAt(real, 29_000)).toBeNull();
    expect(segmentAt(real, 30_100)).toBeNull();
    const late = bandSegments([{ seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 1_200, toMs: 28_000, reason: 'START' }] as never, 61_000);
    expect(segmentAt(late, 0)).toBeNull();
    expect(segmentAt(late, 1_000)?.inputId).toBe('MIC-01');
  });

  it('on the screen: the opened player at 0:00 names the microphone of the first interval', async () => {
    await playingFromActionBar({ audioSourceIntervals: [{ seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 61_000, reason: 'START' }] });
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:00 / 1:01');
    expect(screen.getByTestId('evidence-band-now')).toHaveTextContent('Audio at the playhead: MIC 1');
  });
});

describe('G94c-03 - an interrupted recording says where its sealed prefix ends', () => {
  it('the item states the interruption and the leading player reports its end: the sentence, with the place', async () => {
    const { lead } = await playingFromActionBar({ durationMs: 31_000, interrupted: true, interruptedCause: 'CAPTURE_FAULT' });
    expect(screen.queryByTestId('evidence-playback-interrupted-end')).toBeNull();
    lead.drift(29.4);
    act(() => lead.emit('timeUpdate', { currentTime: 29.4 }));
    act(() => lead.emit('playToEnd'));
    expect(screen.getByTestId('evidence-playback-interrupted-end')).toHaveTextContent(END_SENTENCE);
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('0:29 / 0:31');
    expect(screen.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    // A seek back into the recording takes the sentence away again.
    scrubTo(10_000);
    expect(screen.queryByTestId('evidence-playback-interrupted-end')).toBeNull();
  });

  it('CONTROL - a clean item that plays to its end says nothing', async () => {
    const { lead } = await playingFromActionBar({ durationMs: 31_000, interrupted: false });
    act(() => lead.emit('timeUpdate', { currentTime: 31 }));
    act(() => lead.emit('playToEnd'));
    expect(screen.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    expect(screen.queryByTestId('evidence-playback-interrupted-end')).toBeNull();
  });
});

describe('G94c-05 - the controls follow the player across background / foreground', () => {
  it('leaving the foreground pauses the players AND the state: both controls read "Play", and ONE press plays', async () => {
    const { lead, follow } = await playingFromActionBar();
    expect(screen.getByTestId('evidence-sealed-toggle-playing')).toBeTruthy();
    expect(screen.getByTestId('evidence-action-play-label-pause')).toBeTruthy();
    lead.pause.mockClear();
    appState('background');
    expect(lead.pause).toHaveBeenCalled();
    expect(follow.pause).toHaveBeenCalled();
    appState('active');
    expect(screen.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    expect(screen.getByTestId('evidence-action-play-label-play')).toBeTruthy();
    lead.play.mockClear();
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    expect(lead.play).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('evidence-sealed-toggle-playing')).toBeTruthy();
  });

  it('back in the foreground with a player the PLATFORM paused (no background event reached the app): the controls say so', async () => {
    const { lead } = await playingFromActionBar();
    // The platform stopped the player by itself; this app's state still says "playing".
    lead.playing = false;
    expect(screen.getByTestId('evidence-sealed-toggle-playing')).toBeTruthy();
    appState('active');
    expect(screen.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    expect(screen.getByTestId('evidence-action-play-label-play')).toBeTruthy();
  });

  it('CONTROL - back in the foreground with a player that really plays: nothing changes', async () => {
    const { lead } = await playingFromActionBar();
    expect(lead.playing).toBe(true);
    lead.pause.mockClear();
    appState('active');
    expect(lead.pause).not.toHaveBeenCalled();
    expect(screen.getByTestId('evidence-sealed-toggle-playing')).toBeTruthy();
  });
});

describe('G94c-06 - the player and its message are brought into view', () => {
  const block = () => screen.getByTestId('evidence-detail-tabs-block');
  const flat = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(Infinity as 1).filter(Boolean)) as Record<string, unknown>;
  const scrollView = () => screen.queryByTestId('evidence-detail-scroll') ?? screen.getByTestId('evidence-detail-scroll-tabs');

  it('Play makes the tabs block as tall as the scroll view (so a SHORT item can reach the top) and scrolls to it', async () => {
    const b = await onDetail();
    fireEvent(scrollView(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 640 } } });
    fireEvent(block(), 'layout', { nativeEvent: { layout: { x: 0, y: 520, width: 400, height: 300 } } });
    expect(flat(block().props.style).minHeight).toBeUndefined();
    expect(scrolls).toEqual([]);
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect(flat(block().props.style).minHeight).toBe(640);
    expect(scrolls.length).toBeGreaterThan(0);
    expect(scrolls.every((to) => to.y === 520)).toBe(true);
  });

  it('a stop with a sentence asks to be seen again - and after the operator scrolled by hand, layout changes no longer pull the view', async () => {
    const { lead } = await playingFromActionBar();
    fireEvent(block(), 'layout', { nativeEvent: { layout: { x: 0, y: 480, width: 400, height: 700 } } });
    // The operator scrolls away: the view is theirs.
    fireEvent(scrollView(), 'scrollBeginDrag');
    scrolls.length = 0;
    fireEvent(scrollView(), 'contentSizeChange', 400, 1_400);
    expect(scrolls).toEqual([]);
    // The player stops with its sentence: it asks to be seen.
    act(() => lead.emit('statusChange', { status: 'error' }));
    expect(screen.getByTestId('evidence-playback-stopped-position')).toBeTruthy();
    expect(scrolls).toEqual([{ y: 480, animated: false }]);
  });
});
});
