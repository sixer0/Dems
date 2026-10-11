// Fix wave L, driver L-M - the sealed player on the tablet and the phone (re-check 94; the devices' own
// proof is in implementation/155_fix_wave_l_m.md).
//
// | Finding | What the device showed | Rule held here |
// |---------|------------------------|----------------|
// | G94c-03 | An interrupted recording ended early in the player ("0:29 / 0:31", Play) without a word | When the item states the interruption and the leading player reports the end of its file, the player says so (the web's sentence, the same meaning). Not for a clean item; not for the end report of a source hand-over |
// | G94c-04 | "Audio at the playhead: no interval" at 0:00 (the first interval starts some ms in) | THE SAME tolerance rule as the web's `segmentAt`: a playhead before the first interval that reads the same second as its start is inside it; a gap between two intervals stays a gap |
// | G94c-05 | Phone, after background / foreground: the player stood still while both controls read "Pause"; the first press only flipped the label | Leaving the foreground pauses players AND state; coming back the controls follow the leading player's own `playing` report |
// | G94c-06 | On a short item Play left the player half below the fold and the stop sentence out of view | While the sealed player is asked for, the tabs block is at least as tall as the scroll view, and the player is brought to the top when it is drawn, when it stops with a sentence and at the interrupted end - until the operator scrolls |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { AppState, ScrollView, type AppStateStatus } from 'react-native';
import { EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE } from '@dems/shared/api';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { bandSegments, segmentAt } from './sealed-playback';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { bedWith, openItem, realItem } from './testing/wave-h-c2-kit';

jest.setTimeout(40_000);

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
