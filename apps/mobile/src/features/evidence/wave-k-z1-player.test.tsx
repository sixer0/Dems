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
import { bedWith, openItem, realItem } from './testing/wave-h-c2-kit';

jest.setTimeout(40_000);

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
