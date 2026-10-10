// Blueprint row 92 (M8-W3): playback of the sealed files through the media session of operation 88
// on the tablet and the phone, the transcript pane and the development badge — on the Live bed (the
// contract-checked fake transport, the real Live source, the real routes). UX spec flows 5 and 6;
// SEC35-12 / SEC35-13; E-31; checks M8-PB-T / -P, M8-REV-1 and M7-DEVSRC-EVID-T / -P, software part.
//
// | Criterion | Where |
// |-----------|-------|
// | Only `/media/mts_…` of the answered URL is used; the session object does not print or serialise its path | "the session" |
// | Without a media transport (the runtime answers null: no operator session) the player says it cannot open playback and asks NOTHING of the Core | "the transport seam" |
// | Integration pass D5: with the RUNTIME'S OWN `mediaTransport()` (nothing injected) the players get the app's Core origin + the path + the signed-in operator's header, and the session token is in the two player sources and nowhere else | "the transport seam" |
// | With the transport: one press sends operation 88 once per file; each player gets `<own Core origin><path>` and the operator's `Authorization` header; the host of the answered URL is never used | "the players" |
// | THE CANARY: the two media paths and the header value are in the two player sources and NOWHERE ELSE — not in the runtime log, the query cache (keys, data, errors), AsyncStorage, the secure store's records, or a request URL; also after a player error and a renewal | "the players" |
// | A player error renews the session ONCE and goes back to the same position; a second error at the same place stops there with its position | "the players" |
// | A failed fragment is an integrity failure with its file and fragment | "refusals" |
// | The transcript pane: the exact badge "speaker labels unavailable", the sealed text, "No revisions"; Revise sends ONE operation 85 on the current revision; the sealed text stays and the revision is shown as derived; a 409 keeps the typed text | "the transcript" |
// | The item badge: hero and list row in Live mode for `developmentSources: true` only | "the development badge" |
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { CORE_SERVER_HTTP_ORIGIN } from '@dems/shared/api';
import { FAKE_CREDENTIALS } from '@dems/shared/live/testing';
import type { EvidenceItem } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { runtimeLog } from '@/runtime';
import { MEDIA_SESSION_RENEW_MARGIN_MS, MediaSession, integrityOf, mediaPathOf, mediaSessionStale, mediaTransportOf, videoSourceOf } from './media-session';
import { renderLiveEvidence, resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';

const TOKEN_1 = 'mts_CANARYone7Qm4xZp0Lk2';
const TOKEN_2 = 'mts_CANARYtwo9Zx1vBn3Hd5';
const PATH_1 = `/media/${TOKEN_1}`;
const PATH_2 = `/media/${TOKEN_2}`;
const ANSWERED_HOST = 'http://127.0.0.1:8443';
const OWN_ORIGIN = 'http://core.test:8090';
const BEARER = 'CANARYbearer-5Rt8';
const H = (char: string): string => char.repeat(64);

type Listener = (payload: Record<string, unknown>) => void;
interface FakePlayer {
  source: unknown;
  muted: boolean;
  loop: boolean;
  currentTime: number;
  timeUpdateEventInterval: number;
  play: jest.Mock;
  pause: jest.Mock;
  replaceAsync: jest.Mock;
  addListener: (event: string, listener: Listener) => { remove(): void };
  emit(event: string, payload?: Record<string, unknown>): void;
}

let players: FakePlayer[] = [];
function fakePlayer(): FakePlayer {
  const listeners = new Map<string, Set<Listener>>();
  const player: FakePlayer = {
    source: null,
    muted: false,
    loop: false,
    currentTime: 0,
    timeUpdateEventInterval: 0,
    play: jest.fn(),
    pause: jest.fn(),
    replaceAsync: jest.fn(async (source: unknown) => {
      player.source = source;
    }),
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
let logMark = '';
/** The records written since this test began (the log has no reset; a mark record says where the test starts). */
function logRecords(): readonly { source?: string }[] {
  const all = runtimeLog.records() as readonly { source?: string; message?: string }[];
  const from = all.findIndex((record) => record.message === logMark);
  return all.slice(from + 1);
}

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
  logMark = `row92-mark-${Date.now()}-${Math.random()}`;
  runtimeLog.write({ level: 'info', source: 'test.mark', message: logMark, at: Date.now() } as never);
  players = [];
  // One fake player per `useVideoPlayer` call site and component instance (React keeps it by the ref below).
  jest.spyOn(ExpoVideo, 'useVideoPlayer').mockImplementation(((_: unknown, setup?: (player: FakePlayer) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRef } = require('react') as typeof import('react');
    const held = useRef<FakePlayer | null>(null);
    if (held.current === null) {
      held.current = fakePlayer();
      setup?.(held.current);
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

/** The engine's item as a Core-sealed schema-v2 item. */
const sealedV2 =
  (developmentSources: boolean | null | 'absent', transcript: 'READY' | 'none' = 'none') =>
  (item: EvidenceItem): EvidenceItem =>
    ({
      ...item,
      durationMs: 120_000,
      files: (['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => ({ trackId, fileName: `fragments/${trackId}.mp4`, sizeBytes: 3_500, sha256: H(trackId === 'VIDEO-01' ? 'a' : 'b'), fragmentCount: 5 })),
      ...(developmentSources === 'absent' ? {} : { developmentSources }),
      audioSourceIntervals: [
        { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 30_000, reason: 'START' },
        { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
      ],
      ...(transcript === 'READY' ? { transcriptSha256: H('b'), transcript: { state: 'READY', sha256: H('a'), machineTranscriptHash: H('b'), labelsStatus: 'UNAVAILABLE', revision: 0 } } : {}),
    }) as unknown as EvidenceItem;

interface Opened {
  b: LiveEvidenceBed;
  id: string;
}

async function openSealed(options: { developmentSources?: boolean | null | 'absent'; transcript?: 'READY' | 'none'; transport?: boolean | 'runtime'; source?: 'LIVE_STREAM' | 'NONE' } = {}): Promise<Opened> {
  const { developmentSources = true, transcript = 'none', transport = true, source = 'LIVE_STREAM' } = options;
  const b = await renderLiveEvidence({
    setup: (engine) => {
      const state = engine.sim.store.getState();
      const target = state.evidence.find((entry) => entry.id.endsWith('-0001'))!;
      engine.sim.store.setState({ evidence: state.evidence.map((item) => (item.id === target.id ? sealedV2(developmentSources, transcript)(item) : item)) });
    },
  });
  bed = b;
  b.mediaRef = () => ({ source, packageSuffix: null });
  b.fake.answer('getTranscript', () => b.fake.example('getTranscript', 409));
  if (transport !== 'runtime') {
    // true: canary values in the place of the runtime's (its own Core address and the operator's header).
    // false: what the runtime answers while no operator session is in memory. 'runtime': nothing is replaced.
    (b.mobile.live as unknown as { mediaTransport: () => unknown }).mediaTransport = () => (transport ? { origin: OWN_ORIGIN, headers: { Authorization: `Bearer ${BEARER}` } } : null);
  }
  const id = b.idOf('0001');
  return { b, id };
}

/** Opens the item's detail and waits until the Core's media reference has decided the Media tab (a loaded host needs more turns). */
async function openDetail(b: LiveEvidenceBed, id: string): Promise<void> {
  await b.navigate(`/evidence/${id}`);
  for (let turn = 0; turn < 20 && screen.queryByTestId(/^evidence-media-panel-/) === null; turn += 1) await b.flush();
  await b.flush();
}

function scriptSessions(b: LiveEvidenceBed): void {
  let calls = 0;
  b.fake.answer('createEvidenceMediaSession', (call) => {
    calls += 1;
    const first = calls % 2 === 1;
    return { status: 201, body: { evidenceId: call.params.id ?? '', fileId: first ? 'VIDEO-01' : 'VIDEO-02', url: `${ANSWERED_HOST}${first ? PATH_1 : PATH_2}`, expiresAt: b.fake.clock.now() + 60_000, ranges: true } };
  });
}

/** Everything a media path or the header value could have been written to, as one text (the two player sources apart). */
async function reported(b: LiveEvidenceBed): Promise<string> {
  const cache = b.queryClient.getQueryCache().getAll();
  const keys = await AsyncStorage.getAllKeys();
  const stored = await AsyncStorage.multiGet(keys);
  return JSON.stringify({
    log: logRecords(),
    queryKeys: cache.map((query) => query.queryKey),
    queryData: cache.map((query) => ({ data: query.state.data, error: String(query.state.error) })),
    mutations: b.queryClient.getMutationCache().getAll().map((mutation) => ({ variables: mutation.state.variables, data: mutation.state.data })),
    storage: stored,
    urls: b.fake.log.requests.map((call) => call.url),
  });
}
const leaks = (text: string): string[] => [TOKEN_1, TOKEN_2, 'CANARY', 'mts_'].filter((needle) => text.includes(needle));
const sourcesOf = (): string => JSON.stringify(players.map((player) => player.source));

describe('the session', () => {
  it('only the path of the answered URL is used; the object does not print or serialise it; staleness and the integrity reason', () => {
    expect(mediaPathOf(`${ANSWERED_HOST}${PATH_1}`)).toBe(PATH_1);
    for (const url of [`http://127.0.0.1/api/v1/evidence/${TOKEN_1}`, `http://127.0.0.1/media/${TOKEN_1}?next=1`, `http://127.0.0.1/media/${TOKEN_1}/x`, 'http://127.0.0.1/media/ses_abc', PATH_1, '', null, 7]) {
      expect(mediaPathOf(url)).toBeNull();
    }
    const session = new MediaSession('VIDEO-01', PATH_1, 5);
    expect(leaks(`${String(session)} ${JSON.stringify(session)} ${JSON.stringify({ ...session })} ${Object.values(session).join(' ')}`)).toEqual([]);
    expect(session.takePath()).toBe(PATH_1);
    expect(videoSourceOf(session, { origin: OWN_ORIGIN, headers: { Authorization: 'Bearer x' } })).toEqual({ uri: `${OWN_ORIGIN}${PATH_1}`, headers: { Authorization: 'Bearer x' } });
    expect(mediaSessionStale({ expiresAt: 60_000 }, 60_000 - MEDIA_SESSION_RENEW_MARGIN_MS - 1)).toBe(false);
    expect(mediaSessionStale({ expiresAt: 60_000 }, 60_000 - MEDIA_SESSION_RENEW_MARGIN_MS)).toBe(true);
    expect(integrityOf(409, 'MEDIA_NOT_AVAILABLE', { reason: 'FRAGMENT_NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: 3 })).toEqual({ fileId: 'VIDEO-02', seq: 3 });
    expect(integrityOf(409, 'MEDIA_NOT_AVAILABLE', { reason: 'NOT_A_SEALED_PACKAGE' })).toBeNull();
    // The transport is the runtime's: anything that is not an origin with an Authorization header is no transport.
    expect(mediaTransportOf(null)).toBeNull();
    expect(mediaTransportOf({} as never)).toBeNull();
    expect(mediaTransportOf({ mediaTransport: () => ({ origin: 'core.test', headers: { Authorization: 'Bearer x' } }) } as never)).toBeNull();
    expect(mediaTransportOf({ mediaTransport: () => ({ origin: OWN_ORIGIN, headers: {} }) } as never)).toBeNull();
    expect(mediaTransportOf({ mediaTransport: () => null } as never)).toBeNull();
  });
});

describe('the transport seam', () => {
  it('without a media transport of the runtime: the player says playback cannot be opened and asks nothing of the Core', async () => {
    const { b, id } = await openSealed({ transport: false });
    scriptSessions(b);
    await openDetail(b, id);
    expect(screen.getByTestId('evidence-media-panel-sealed')).toBeTruthy();
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    expect(screen.getByTestId('evidence-playback-refused-NO_TRANSPORT')).toHaveTextContent('The media session could not be opened.');
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
    expect(logRecords().filter((record) => record.source === 'evidence.playback.transport')).toHaveLength(1);
  });

  it("pass D5: the runtime's own transport — the app's Core origin, the signed-in operator's header; the session token is in the player sources and nowhere else", async () => {
    const { b, id } = await openSealed({ transport: 'runtime' });
    scriptSessions(b);
    const own = b.mobile.live.mediaTransport();
    // It prints and serialises without its header.
    expect(JSON.stringify(own)).toBe(JSON.stringify({ origin: CORE_SERVER_HTTP_ORIGIN }));
    expect(mediaTransportOf(b.mobile.live)).toEqual({ origin: CORE_SERVER_HTTP_ORIGIN, headers: { Authorization: `Bearer ${FAKE_CREDENTIALS.sessionToken}` } });
    await openDetail(b, id);
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    expect(screen.getByTestId('evidence-playback-ready-VIDEO-01+VIDEO-02')).toBeTruthy();
    expect(screen.queryByTestId('evidence-playback-refused-NO_TRANSPORT')).toBeNull();
    const [lead, follow] = players as [FakePlayer, FakePlayer];
    // NEGATIVE CONTROL: the token is where it has to be.
    expect(lead.source).toEqual({ uri: `${CORE_SERVER_HTTP_ORIGIN}${PATH_1}`, headers: { Authorization: `Bearer ${FAKE_CREDENTIALS.sessionToken}` } });
    expect(follow.source).toEqual({ uri: `${CORE_SERVER_HTTP_ORIGIN}${PATH_2}`, headers: { Authorization: `Bearer ${FAKE_CREDENTIALS.sessionToken}` } });
    const text = await reported(b);
    expect(leaks(text)).toEqual([]);
    expect(text).not.toContain(FAKE_CREDENTIALS.sessionToken);
    expect(logRecords().filter((record) => record.source === 'evidence.playback.transport')).toHaveLength(0);
  });
});

describe('the players', () => {
  it('one press opens both files; each player gets its own Core origin + the path + the header; the canary holds; an error renews once and resumes; a second error stops at its position', async () => {
    const { b, id } = await openSealed();
    scriptSessions(b);
    await openDetail(b, id);
    // Nothing is asked on mount.
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(0);
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    expect(screen.getByTestId('evidence-playback-ready-VIDEO-01+VIDEO-02')).toBeTruthy();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(2);
    const [lead, follow] = players as [FakePlayer, FakePlayer];
    // NEGATIVE CONTROL: the search finds the paths and the header where they have to be.
    expect(lead.source).toEqual({ uri: `${OWN_ORIGIN}${PATH_1}`, headers: { Authorization: `Bearer ${BEARER}` } });
    expect(follow.source).toEqual({ uri: `${OWN_ORIGIN}${PATH_2}`, headers: { Authorization: `Bearer ${BEARER}` } });
    expect(leaks(sourcesOf())).toEqual([TOKEN_1, TOKEN_2, 'CANARY', 'mts_']);
    expect(sourcesOf()).not.toContain('8443');
    expect([lead.muted, follow.muted]).toEqual([false, true]);
    expect(leaks(await reported(b))).toEqual([]);

    // Play; the leading player's media clock is the clock; the follower is re-aligned beyond the tolerance.
    fireEvent.press(screen.getByTestId('evidence-sealed-toggle-paused'));
    expect([lead.play.mock.calls.length, follow.play.mock.calls.length]).toEqual([1, 1]);
    follow.currentTime = 60;
    act(() => lead.emit('timeUpdate', { currentTime: 70 }));
    expect(follow.currentTime).toBe(70);
    expect(screen.getByTestId('evidence-sealed-time')).toHaveTextContent('1:10 / 2:00');
    expect(screen.getByTestId('evidence-band-now')).toHaveTextContent('Audio at the playhead: MIC 2');

    // A player error (the session ended): ONE renewal, the same position, playing again.
    act(() => lead.emit('statusChange', { status: 'error', error: { message: `GET ${OWN_ORIGIN}${PATH_1} 403` } }));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(4);
    expect([lead.currentTime, follow.currentTime]).toEqual([70, 70]);
    expect(screen.getByTestId('evidence-sealed-toggle-playing')).toBeTruthy();
    expect(screen.queryByTestId(/^evidence-playback-stopped-/)).toBeNull();
    // The record of the error holds the file and the position, never the player's message or source.
    expect(logRecords().filter((record) => record.source === 'evidence.playback.player')).toHaveLength(1);
    expect(leaks(await reported(b))).toEqual([]);

    // The error comes back at the same place: no second renewal by itself.
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(b.requests('createEvidenceMediaSession')).toHaveLength(4);
    expect(screen.getByTestId('evidence-playback-stopped-position')).toHaveTextContent(/Playback stopped at 1:10 and did not resume\./);
    expect(leaks(await reported(b))).toEqual([]);
  });
});

describe('refusals', () => {
  it('a failed fragment is an integrity failure with its file and fragment; 409 without it is the fixed message', async () => {
    const { b, id } = await openSealed();
    b.fake.answerOnce('createEvidenceMediaSession', {
      status: 409,
      body: { error: { code: 'MEDIA_NOT_AVAILABLE', message: 'No playback media is available for this evidence item.', details: { reason: 'FRAGMENT_NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: 3 } } },
    });
    await openDetail(b, id);
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    expect(screen.getByTestId('evidence-playback-refused-INTEGRITY')).toHaveTextContent('This recording failed its integrity check at VIDEO-02 fragment 3.');
    expect(screen.queryByTestId('evidence-playback-reopen')).toBeNull();
  });

  it('pass D5: after a player error the page asks operation 88 again once; when THAT names a failed fragment (here of the second file, the first opens) the integrity sentence carries its file and fragment', async () => {
    const { b, id } = await openSealed();
    scriptSessions(b);
    await openDetail(b, id);
    fireEvent.press(screen.getByTestId('evidence-playback-open-ALLOWED'));
    await b.flush();
    const [lead] = players as [FakePlayer, FakePlayer];
    act(() => lead.emit('timeUpdate', { currentTime: 40 }));
    // The renewal: VIDEO-01 opens, VIDEO-02 is refused with the fragment.
    let renewals = 0;
    b.fake.answer('createEvidenceMediaSession', (call) => {
      renewals += 1;
      if (renewals === 1) return { status: 201, body: { evidenceId: call.params.id ?? '', fileId: 'VIDEO-01', url: `${ANSWERED_HOST}${PATH_1}`, expiresAt: b.fake.clock.now() + 60_000, ranges: true } };
      return { status: 409, body: { error: { code: 'MEDIA_NOT_AVAILABLE', message: 'No playback media is available for this evidence item.', details: { reason: 'FRAGMENT_NOT_AUTHENTIC', fileId: 'VIDEO-02', seq: 7 } } } };
    });
    act(() => lead.emit('statusChange', { status: 'error' }));
    await b.flush();
    expect(renewals).toBe(2);
    expect(screen.getByTestId('evidence-playback-refused-INTEGRITY')).toHaveTextContent('This recording failed its integrity check at VIDEO-02 fragment 7.');
    expect(leaks(await reported(b))).toEqual([]);
  });
});

describe('the development badge (R-11; D83, D91)', () => {
  it('Live mode, `developmentSources: true`: on the list row and on the hero', async () => {
    const { b, id } = await openSealed({ developmentSources: true, source: 'NONE' });
    await b.flush();
    expect(screen.getByTestId(`evidence-row-development-${id}`)).toHaveTextContent('Development source');
    await openDetail(b, id);
    expect(screen.getByTestId('evidence-detail-development')).toHaveTextContent('Development source');
  });

  it.each([false, null, 'absent'] as const)('Live mode, `developmentSources: %s`: no badge on the row or the hero', async (value) => {
    const { b, id } = await openSealed({ developmentSources: value, source: 'NONE' });
    await b.flush();
    // CONTROL: the row itself is drawn.
    expect(screen.getByTestId(`evidence-row-status-${id}`)).toBeTruthy();
    expect(screen.queryByTestId(`evidence-row-development-${id}`)).toBeNull();
    await openDetail(b, id);
    expect(screen.getByTestId('evidence-detail-status')).toBeTruthy();
    expect(screen.queryByTestId('evidence-detail-development')).toBeNull();
  });
});

describe('the transcript (M8-REV-1, software part)', () => {
  const SEGMENTS = [
    { index: 0, startMs: 400, endMs: 4_200, text: 'Silakan mulai dari identitas Anda.', speaker: null },
    { index: 1, startMs: 4_600, endMs: 8_100, text: 'Baik, saya Ahmad Fauzi.', speaker: null },
  ];
  const revisionOf = (number: number, to: string, baseRevision: number) => ({
    revisionId: `TRV-00000${number}`,
    number,
    authorId: 'OPR-001',
    baseRevision,
    machineTranscriptHash: H('b'),
    signedBy: 'KEY-EVSIGN-01',
    signature: { value: 'c'.repeat(128), keyId: 'KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false },
    createdAt: 1_790_824_500_000,
    changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to }],
  });

  it('the sealed text with its marks; Revise appends one signed revision, shown as derived beside the unchanged sealed text; a 409 keeps what was typed', async () => {
    const { b, id } = await openSealed({ transcript: 'READY', source: 'NONE' });
    const core = { revisions: [] as ReturnType<typeof revisionOf>[], conflict: false };
    b.fake.answer('getTranscript', () => ({ status: 200, body: { documentVersion: 'dems.transcript/1', language: 'id', speakerState: 'UNAVAILABLE', segments: SEGMENTS, sha256: H('a'), machineTranscriptHash: H('b'), assembledAt: 1_790_823_600_000, revision: core.revisions.length } }));
    b.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [...core.revisions].reverse(), nextCursor: null } }));
    b.fake.answer('createTranscriptRevision', (call) => {
      if (core.conflict) return b.fake.example('createTranscriptRevision', 409, 'conflict');
      const body = call.body as { baseRevision: number; changes: { to: string }[] };
      const appended = revisionOf(core.revisions.length + 1, body.changes[0]!.to, body.baseRevision);
      core.revisions.push(appended);
      return { status: 201, body: appended };
    });
    await openDetail(b, id);
    await b.flush();
    expect(screen.getByTestId('evidence-transcript-ASSEMBLED')).toBeTruthy();
    expect(screen.getByTestId('evidence-transcript-speakers-UNAVAILABLE')).toHaveTextContent('speaker labels unavailable');
    expect(screen.getByTestId('evidence-transcript-sealed-note')).toHaveTextContent('Sealed original — immutable');
    expect(screen.getByTestId('evidence-transcript-original-1')).toHaveTextContent('Baik, saya Ahmad Fauzi.');
    expect(screen.queryByTestId(/^evidence-transcript-speaker-\d/)).toBeNull();
    expect(screen.getByTestId('evidence-transcript-revisions-none')).toHaveTextContent('No revisions');

    // The Core refuses a stale base: the fixed sentence, the typed text stays.
    fireEvent.press(screen.getByTestId('evidence-transcript-revise-1'));
    await b.flush();
    // Pass D6: a revision needs a reason of 5 to 500 characters. Until then Save is disabled and the form says why.
    expect(screen.getByTestId('transcript-revise-save')).toBeDisabled();
    expect(screen.getByTestId('transcript-revise-note-rule')).toHaveTextContent('Give a reason of 5 to 500 characters. It is signed with the revision.');
    fireEvent.changeText(screen.getByTestId('transcript-revise-text'), 'Baik, saya Ahmad Fausi.');
    fireEvent.changeText(screen.getByTestId('transcript-revise-note'), '  abc   ');
    expect(screen.getByTestId('transcript-revise-save')).toBeDisabled();
    fireEvent.press(screen.getByTestId('transcript-revise-save'));
    expect(b.requests('createTranscriptRevision')).toHaveLength(0);
    fireEvent.changeText(screen.getByTestId('transcript-revise-note'), 'Koreksi nama');
    expect(screen.getByTestId('transcript-revise-save')).not.toBeDisabled();
    expect(screen.queryByTestId('transcript-revise-note-rule')).toBeNull();

    fireEvent.changeText(screen.getByTestId('transcript-revise-text'), 'Baik, saya Ahmad Fauzi.');
    fireEvent.press(screen.getByTestId('transcript-revise-save'));
    expect(screen.getByTestId('transcript-revise-error-unchanged')).toBeTruthy();
    expect(b.requests('createTranscriptRevision')).toHaveLength(0);
    fireEvent.changeText(screen.getByTestId('transcript-revise-text'), 'Baik, saya Ahmad Fausi.');
    core.conflict = true;
    fireEvent.press(screen.getByTestId('transcript-revise-save'));
    await b.flush();
    expect(screen.getByTestId('transcript-revise-refusal-CONFLICT')).toHaveTextContent(/The transcript revision is based on a revision that is no longer current\./);
    expect(screen.getByTestId('transcript-revise-text').props.value).toBe('Baik, saya Ahmad Fausi.');

    core.conflict = false;
    fireEvent.press(screen.getByTestId('transcript-revise-save'));
    await b.flush();
    expect(b.requests('createTranscriptRevision')).toHaveLength(2);
    expect(b.requests('createTranscriptRevision')[1]?.body).toEqual({ baseRevision: 0, changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to: 'Baik, saya Ahmad Fausi.' }], note: 'Koreksi nama' });
    // The sealed text is what it was; the revision stands beside it, marked derived.
    expect(screen.getByTestId('evidence-transcript-original-1')).toHaveTextContent('Baik, saya Ahmad Fauzi.');
    expect(screen.getByTestId('evidence-transcript-derived-text-1')).toHaveTextContent('Baik, saya Ahmad Fausi.');
    expect(screen.getByTestId('evidence-transcript-derived-1')).toHaveTextContent(/Revision 1 · derived, not part of the sealed transcript/);
    expect(screen.getByTestId('evidence-transcript-revision-1')).toHaveTextContent(/Signed by the Core key KEY-EVSIGN-01/);
    // The typed text is in no record of the app.
    expect(JSON.stringify(logRecords())).not.toContain('Fausi');
  });
});
