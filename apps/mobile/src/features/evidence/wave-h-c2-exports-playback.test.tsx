// Wave H, driver C2 (mobile) - finding 7 of the common brief.
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G94-05 | The detail lists the item's finished exports (operation 40 `exports`), each with "Download from the web console."; no download control on this app | "finished exports" |
// | G94-09 | The export sheet of a REAL item names no "(simulated)" destination and says where the export is stored; what it sends as the destination is the plain label. A simulated / demo item keeps its simulated labels | "the export sheet" |
// | G94-07 | A stop caused only by the END OF THE MEDIA SESSION reads "Playback paused: the media session ended. Press Play to continue."; the integrity hint stays for a stop on a session that had not ended | "a stopped playback" |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { EXPORT_AUTH_MS, EXPORT_BUILD_MS } from './export-sheet';
import { VERIFY_ASK_MS } from './integrity-tab';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { RECORDED_VERIFY_V2 } from './testing/verify-v2-recorded';
import { bedWith, openItem, realItem, textUnder, type ItemChange } from './testing/wave-h-c2-kit';
import { SCRAMBLE_MS } from './use-scramble';

jest.setTimeout(40_000);

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

const finished = (exportId: string, jobId: string, kind: 'PACKAGE' | 'COMPOSITE', completedAt: number) => ({ exportId, jobId, kind, completedAt, exportedBy: 'OPR-002', archiveBytes: 136_096_844 });

describe('G94-05 - the finished exports of an item', () => {
  it('operation 40 lists two exports: each is named with its kind and "Download from the web console."; no download control', async () => {
    const { b, id } = await bedWith('0001', realItem({ status: 'EXPORTED' }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    b.detailExtras = () => ({
      access: { play: true, readTranscript: true, export: true },
      exports: [finished('EXP-000036', 'EXPJ-000036', 'PACKAGE', 1_791_600_000_000), finished('EXP-000033', 'EXPJ-000033', 'COMPOSITE', 1_791_500_000_000)],
    });
    await openItem(b, id);
    const text = textUnder('evidence-finished-exports');
    expect(text).toMatch(/Finished exports/);
    expect(screen.getByTestId('evidence-finished-export-EXP-000036')).toHaveTextContent(/EXP-000036 · Package/);
    expect(screen.getByTestId('evidence-finished-export-EXP-000036')).toHaveTextContent(/Download from the web console\./);
    expect(screen.getByTestId('evidence-finished-export-EXP-000033')).toHaveTextContent(/EXP-000033 · Composite/);
    // The page view asked for no job and no download path.
    expect(b.requests('getEvidenceExportJob')).toHaveLength(0);
  });

  it('an empty list: "No finished export of this item."', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    b.detailExtras = () => ({ access: { play: true, readTranscript: true, export: true }, exports: [] });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-finished-exports')).toHaveTextContent(/No finished export of this item\./);
  });

  it('the member is absent on an EXPORTED item: "Finished exports: not reported"', async () => {
    const { b, id } = await bedWith('0001', realItem({ status: 'EXPORTED' }));
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-finished-exports')).toHaveTextContent(/Finished exports: not reported/);
  });

  it('CONTROL: the member is absent on an item that was never exported - nothing is drawn', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-detail-id')).toHaveTextContent(id);
    expect(screen.queryByTestId('evidence-finished-exports')).toBeNull();
  });
});

describe('G94-09 - the export sheet', () => {
  async function toDestination(suffix: string, change: ItemChange | null, verifyV2: boolean): Promise<{ b: LiveEvidenceBed; id: string }> {
    const { b, id } = await bedWith(suffix, change);
    bed = b;
    if (change !== null) b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
    await openItem(b, id);
    fireEvent.press(screen.getByTestId('evidence-action-export'));
    await b.flush();
    await b.elapse(EXPORT_AUTH_MS + 200);
    if (verifyV2) b.fake.answerOnce('verifyEvidence', { status: 200, body: { ...RECORDED_VERIFY_V2.pass.body, evidenceId: id, at: b.fake.clock.now() } });
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    await b.elapse(VERIFY_ASK_MS + SCRAMBLE_MS + 300);
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    return { b, id };
  }

  it('a REAL item: the destinations carry no "(simulated)"; the sheet says the export is stored on the Core server; the request names the plain destination', async () => {
    const { b } = await toDestination('0001', realItem(), true);
    const wizard = textUnder('evidence-export-wizard');
    expect(wizard).toMatch(/Destination recorded with the export/);
    expect(wizard).toMatch(/Encrypted USB drive/);
    expect(wizard).toMatch(/Export\/Transfer network/);
    expect(wizard).toMatch(/The export is stored on the Core server\. The destination is recorded with it; nothing is sent to it from here\./);
    expect(wizard).not.toMatch(/simulated|DEMO/i);
    fireEvent.press(screen.getByTestId('evidence-export-next'));
    await b.flush();
    fireEvent.changeText(screen.getByTestId('evidence-export-reason'), 'Requested by the prosecutor');
    await b.flush();
    fireEvent.press(screen.getByTestId('evidence-export-submit'));
    await b.flush();
    await b.elapse(EXPORT_BUILD_MS + 300);
    const sent = b.requests('exportEvidence').at(-1)?.body as { destination?: string };
    expect(sent.destination).toBe('Encrypted USB drive');
  });

  it('CONTROL: a simulated demo item keeps its "(simulated)" destinations and gets no "stored on the Core server" sentence', async () => {
    await toDestination('0002', null, false);
    const wizard = textUnder('evidence-export-wizard');
    expect(wizard).toMatch(/Encrypted USB drive \(simulated\)/);
    expect(wizard).not.toMatch(/The export is stored on the Core server/);
  });
});

describe('G94-07 - a stopped playback', () => {
  const OWN_ORIGIN = 'http://core.test:8090';
  const TTL_MS = 60_000;

  /** Opens the sealed player of a streamable REAL item, plays, and moves the playhead to 1:10 of 2:00. */
  async function playing(): Promise<{ b: LiveEvidenceBed; lead: FakePlayer }> {
    const { b, id } = await bedWith('0001', realItem({ durationMs: 120_000 }));
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    b.fake.answer('getTranscript', () => b.fake.example('getTranscript', 409));
    (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => ({ origin: OWN_ORIGIN, headers: { Authorization: 'Bearer marker' } });
    let calls = 0;
    b.fake.answer('createEvidenceMediaSession', (call) => {
      calls += 1;
      const first = calls % 2 === 1;
      return { status: 201, body: { evidenceId: call.params.id ?? '', fileId: first ? 'VIDEO-01' : 'VIDEO-02', url: `http://127.0.0.1:8443/media/mts_${first ? 'a' : 'b'}${'x'.repeat(20)}${calls}`, expiresAt: b.fake.clock.now() + TTL_MS, ranges: true } };
    });
    await openItem(b, id);
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    const lead = players.at(-2) as FakePlayer;
    act(() => lead.emit('timeUpdate', { currentTime: 70 }));
    // The first error: ONE renewal by itself, back at the same place.
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(4);
    expect(screen.queryByTestId(/^evidence-playback-stopped-/)).toBeNull();
    return { b, lead };
  }

  it('the renewed session ENDED too (the Core\'s clock is past its end) when the player fails again: "the media session ended. Press Play to continue." - no integrity sentence; Play renews and continues', async () => {
    const { b, lead } = await playing();
    await b.elapse(TTL_MS + 2_000, 1_000);
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    const stopped = screen.getByTestId('evidence-playback-stopped-session');
    expect(stopped).toHaveTextContent('Playback paused: the media session ended. Press Play to continue.');
    expect(stopped).not.toHaveTextContent(/integrity|Verify/);
    expect(screen.queryByTestId('evidence-playback-stopped-position')).toBeNull();
    // Play: the session is at its end, so it is renewed first (two files, two requests) and playback goes on.
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(6);
    expect(screen.queryByTestId(/^evidence-playback-stopped-/)).toBeNull();
  });

  it('CONTROL: the session had NOT ended when the player fails again at the same place: the stop names its position and points to Verify', async () => {
    const { b, lead } = await playing();
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(screen.getByTestId('evidence-playback-stopped-position')).toHaveTextContent(/Playback stopped at 1:10 and did not resume\..*run Verify to see which\./);
    expect(screen.queryByTestId('evidence-playback-stopped-session')).toBeNull();
  });
});
