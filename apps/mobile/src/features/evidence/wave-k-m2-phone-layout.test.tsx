// Fix wave K, driver M2 - item 7: the PHONE layout of the sealed player (`M8-PB-P`, gate 94: "NOT
// PROVEN - the phone sits on the simulated lane, which has no v2 item"). Every screen state of the
// sealed player is held here in the phone window (`phonePortrait`, the pushed detail screen), so the
// re-check on the device only has to confirm them. The tablet's own cases are the wave H tests; one
// tablet case stays here as the CONTROL of the window switch.
//
// | State | What the phone shows |
// |-------|----------------------|
// | before a press | "Open playback"; the page view asks for no media session |
// | ready, two files | both sealed files, the play / pause control, the time, the audio band; no bundled picture |
// | ready, one file | one media session, "This recording has one camera file (Camera 1)." |
// | `409 MEDIA_NOT_AVAILABLE` | "No playback media is available for this evidence item."; no player |
// | `access.play: false` | "You are not permitted to play this recording."; nothing is asked |
// | the session ended | "Playback paused: the media session ended. Press Play to continue." |
// | a stop that is not the session's end | the position and "run Verify to see which." |
// | the Core says NONE | the state sentence and its reason; no player |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { bedWith, openItem, realItem } from './testing/wave-h-c2-kit';

jest.setTimeout(30_000);

const OWN_ORIGIN = 'http://127.0.0.1:8443';
const TTL_MS = 60_000;
type Listener = (payload: Record<string, unknown>) => void;
interface FakePlayer {
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  replaceAsync: jest.Mock;
  addListener: (event: string, listener: Listener) => { remove(): void };
  emit(event: string, payload?: Record<string, unknown>): void;
}
let players: FakePlayer[] = [];
function fakePlayer(): FakePlayer {
  const listeners = new Map<string, Set<Listener>>();
  return {
    currentTime: 0,
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

const PHONE = { window: 'phonePortrait', root: 'evidence-detail-screen' } as const;
const INTERVALS = [
  { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 40_000, reason: 'START' },
  { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 40_000, toMs: 120_000, reason: 'MANUAL' },
];

/** A sealed item of this Core whose files the Core says are streamable, opened on the phone. */
async function sealedOnPhone(options: { cameras?: readonly string[]; window?: 'phonePortrait' | 'tabletLandscape'; extras?: Readonly<Record<string, unknown>> } = {}): Promise<{ b: LiveEvidenceBed; id: string }> {
  const cameras = options.cameras ?? ['VIDEO-01', 'VIDEO-02'];
  const { b, id } = await bedWith('0001', realItem({ durationMs: 120_000, audioSourceIntervals: INTERVALS }, { cameras, files: cameras.length === 2 }), { window: options.window ?? PHONE.window });
  bed = b;
  b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: [...cameras] as ('VIDEO-01' | 'VIDEO-02')[] });
  (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: OWN_ORIGIN, headers: { Authorization: 'Bearer marker' } });
  let calls = 0;
  b.fake.answer('createEvidenceMediaSession', (call) => {
    calls += 1;
    const fileId = cameras.length === 1 ? cameras[0] : calls % 2 === 1 ? 'VIDEO-01' : 'VIDEO-02';
    return { status: 201, body: { evidenceId: call.params.id ?? '', fileId, url: `${OWN_ORIGIN}/media/mts_${'p'.repeat(22)}${calls}`, expiresAt: b.fake.clock.now() + TTL_MS, ranges: true } };
  });
  if (options.extras !== undefined) b.detailExtras = () => options.extras as Readonly<Record<string, unknown>>;
  await openItem(b, id);
  return { b, id };
}
const openPlayback = async (b: LiveEvidenceBed) => {
  fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
  await b.flush();
};

describe('the sealed player in the PHONE layout (M8-PB-P)', () => {
  it('the pushed detail screen (not the tablet\'s pane): "Open playback", and the page view asks for no media session', async () => {
    const { b } = await sealedOnPhone();
    expect(screen.getByTestId(PHONE.root)).toBeTruthy();
    expect(screen.queryByTestId('evidence-detail-pane')).toBeNull();
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-media-panel-sealed')).toBeTruthy();
    expect(screen.getByTestId('evidence-playback-open-ALLOWED')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
    // No bundled picture and no demo wording on a recording of this Core.
    expect(screen.queryByTestId('evidence-media-demo-label')).toBeNull();
  });

  it('ready with two files: both sealed files, the play control, the time and the audio band of both microphones', async () => {
    const { b } = await sealedOnPhone();
    await openPlayback(b);
    const root = within(screen.getByTestId(PHONE.root));
    expect(root.getByTestId('evidence-playback-ready-VIDEO-01+VIDEO-02')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(2);
    expect(root.getByTestId('evidence-sealed-video-VIDEO-01')).toBeTruthy();
    expect(root.getByTestId('evidence-sealed-video-VIDEO-02')).toBeTruthy();
    expect(root.getByTestId('evidence-sealed-toggle-paused')).toBeTruthy();
    expect(root.getByTestId('evidence-sealed-time')).toBeTruthy();
    expect(root.getByTestId('evidence-band-legend-MIC-01')).toBeTruthy();
    expect(root.getByTestId('evidence-band-legend-MIC-02')).toBeTruthy();
    expect(screen.queryByTestId('evidence-playback-one-camera')).toBeNull();
  });

  it('ready with ONE file: one media session and "This recording has one camera file (Camera 1)."', async () => {
    const { b } = await sealedOnPhone({ cameras: ['VIDEO-01'] });
    await openPlayback(b);
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-ready-VIDEO-01')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(1);
    expect(screen.getByTestId('evidence-playback-one-camera')).toHaveTextContent('This recording has one camera file (Camera 1).');
  });

  it('`409 MEDIA_NOT_AVAILABLE`: the fixed sentence, and no player', async () => {
    const { b } = await sealedOnPhone();
    b.fake.answer('createEvidenceMediaSession', () => b.fake.example('createEvidenceMediaSession', 409));
    await openPlayback(b);
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-refused-NOT_AVAILABLE')).toHaveTextContent('No playback media is available for this evidence item.');
    expect(screen.queryByTestId(/^evidence-playback-ready-/)).toBeNull();
    expect(screen.queryByTestId(/^evidence-sealed-video-/)).toBeNull();
  });

  it('`access.play: false`: "You are not permitted to play this recording."; Play is disabled and nothing is asked', async () => {
    const { b } = await sealedOnPhone({ extras: { access: { play: false, readTranscript: false, export: false } } });
    expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-media-may-not-play')).toHaveTextContent('You are not permitted to play this recording.');
    expect(screen.queryByTestId(/^evidence-playback-/)).toBeNull();
    fireEvent.press(screen.getByTestId('evidence-action-play'));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
  });

  it('the Core says NONE: the state sentence and its reason; no player and no picture', async () => {
    const { b, id } = await bedWith('0001', realItem(), { window: PHONE.window });
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null, reason: 'PACKAGE_MISSING' });
    await openItem(b, id);
    const root = within(screen.getByTestId(PHONE.root));
    expect(root.getByTestId('evidence-media-none')).toBeTruthy();
    expect(root.getByTestId('evidence-media-none-reason')).toBeTruthy();
    expect(screen.queryByTestId(/^evidence-playback-/)).toBeNull();
    expect(screen.getByTestId('evidence-action-play').props.accessibilityState?.disabled).toBe(true);
  });

  describe('a stopped playback', () => {
    async function stoppedOnce(): Promise<{ b: LiveEvidenceBed; lead: FakePlayer }> {
      const { b } = await sealedOnPhone();
      await openPlayback(b);
      fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
      const lead = players.at(-2) as FakePlayer;
      act(() => lead.emit('timeUpdate', { currentTime: 70 }));
      // The first error, on a session at its END by the Core's clock (wave K Z1, G94b-10: an error on a
      // live session is not renewed by itself): ONE renewal, back at the same place.
      await b.elapse(TTL_MS + 2_000, 1_000);
      act(() => lead.emit('statusChange', { status: 'error' }));
      await b.flush();
      expect(b.requests('createEvidenceMediaSession')).toHaveLength(4);
      return { b, lead };
    }

    it('the session had not ended: the stop names its position and points to Verify', async () => {
      const { b, lead } = await stoppedOnce();
      act(() => lead.emit('statusChange', { status: 'error' }));
      await b.flush();
      expect(within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-stopped-position')).toHaveTextContent(/Playback stopped at 1:10 and did not resume\..*run Verify to see which\./);
    });

    it('the media session ended: "Playback paused: the media session ended. Press Play to continue." - no integrity sentence', async () => {
      const { b, lead } = await stoppedOnce();
      await b.elapse(TTL_MS + 2_000, 1_000);
      act(() => lead.emit('statusChange', { status: 'error' }));
      await b.flush();
      const stopped = within(screen.getByTestId(PHONE.root)).getByTestId('evidence-playback-stopped-session');
      expect(stopped).toHaveTextContent('Playback paused: the media session ended. Press Play to continue.');
      expect(stopped).not.toHaveTextContent(/integrity|Verify/);
    });
  });

  it('CONTROL of the window: the tablet draws the same item in its detail PANE, not on a pushed screen', async () => {
    await sealedOnPhone({ window: 'tabletLandscape' });
    expect(screen.getByTestId('evidence-detail-pane')).toBeTruthy();
    expect(screen.queryByTestId(PHONE.root)).toBeNull();
  });
});
