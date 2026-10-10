// Fix wave K Z1 (G94b-01, ruling D224 (1); G94b-10): the INDEXED VIEW at the two media routes, and
// ONE row per stop. The real app with the real access rule, a real sealed package under a real
// credential store (`support.ts`). The package here has NO clear tail (`tailBytes: 0`), as every
// file of the product writer; the builder's default file (17 clear bytes behind the last fragment)
// is the case of a table that yields no exact index.
import { createHash } from 'node:crypto';
import { EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE, EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE, EVIDENCE_MEDIA_SESSION_TTL_MS, EvidenceMediaSessionRequestSchema, EvidenceMediaSessionSchema, validateCoreApiResponse } from '@dems/shared/api';
import { cameraFilePath } from '@dems/shared/evidence-package';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { flipByte } from '../../../evidence-verify/__tests__/support';
import { operatorOf } from '../../devices/__tests__/support';
import { filesBelow, mediaApp, removeMediaScratch, type MediaApp, type MediaAppOptions } from './support';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
afterAll(removeMediaScratch);

async function build(options: MediaAppOptions = {}): Promise<MediaApp> {
  const built = await mediaApp({ tailBytes: 0, ...options });
  apps.push(built.app);
  return built;
}

// The file: 129 clear bytes (the init segment), five sealed fragments of 700 bytes, nothing behind them.
const HEADER = 129;
const FRAGMENT = 700;
const SIZE = HEADER + 5 * FRAGMENT;
/** One `sidx` box of five references. */
const BOX = 40 + 12 * 5;
const VIEW = SIZE + BOX;
/** The view offset of a file offset behind the init segment. */
const v = (fileOffset: number): number => fileOffset + BOX;
const THIRD = HEADER + 2 * FRAGMENT;
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const errorOf = (response: LightMyRequestResponse): { code: string; details?: Record<string, unknown> } => (response.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
const INVESTIGATOR = operatorOf('INVESTIGATOR');
const SUPERVISOR = operatorOf('SUPERVISOR');
/** The member, by the name of the contract (`contract_wave_k.md`, "Z1"). */
const MEMBER = 'seekIndex';

interface Session {
  url: string;
  fileId: string;
  expiresAt: number;
  seekIndex?: true;
}
async function sessionOf(media: MediaApp, body?: Record<string, unknown>): Promise<Session> {
  const response = await media.open(body);
  if (response.statusCode !== 201) throw new Error(`operation 88 answered ${response.statusCode} ${response.body}`);
  return response.json() as Session;
}
const indexedSession = (media: MediaApp, fileId: 'VIDEO-01' | 'VIDEO-02' = 'VIDEO-01'): Promise<Session> => sessionOf(media, { fileId, [MEMBER]: true });
const stopRows = (media: MediaApp) => media.appended.filter((entry) => entry.unit === 'mediaStream.served');
const tamper = (media: MediaApp): void => flipByte(media.built.path(cameraFilePath('VIDEO-01')), media.built.fragment('VIDEO-01', 3).byteOffset + 5);
/** The answer of a request whose stream the Core may cut (the in-process client then fails the request). */
async function cutFetch(media: MediaApp, url: string, range: string): Promise<{ status: number | null; told: string | null; received: Buffer }> {
  try {
    const response = await media.fetch(url, range);
    return { status: response.statusCode, told: String(response.headers['content-length']), received: response.rawPayload };
  } catch {
    return { status: null, told: null, received: Buffer.alloc(0) };
  }
}

describe('operation 88 states the indexed view additively', () => {
  it('the contract example holds the member by name, and both schemas take it; `false` is no value of it', () => {
    expect(EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE[MEMBER]).toBe(true);
    expect(EvidenceMediaSessionSchema.safeParse(EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE).success).toBe(true);
    expect(EvidenceMediaSessionRequestSchema.safeParse(EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE).success).toBe(true);
    expect(EvidenceMediaSessionSchema.safeParse({ ...EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE, [MEMBER]: false }).success).toBe(false);
    const { [MEMBER]: _member, ...plain } = EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE;
    expect(EvidenceMediaSessionSchema.safeParse(plain).success).toBe(true);
  });

  it('asked `seekIndex: true` on a file whose table yields an index: 201 with `seekIndex: true`, in the shape of the contract, ONE audit row as before', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const response = await media.open({ fileId: 'VIDEO-02', [MEMBER]: true });
    expect(response.statusCode).toBe(201);
    const session = response.json() as Session;
    expect(session[MEMBER]).toBe(true);
    expect(session.fileId).toBe('VIDEO-02');
    expect(session.expiresAt).toBe(media.clock.now() + EVIDENCE_MEDIA_SESSION_TTL_MS);
    expect(validateCoreApiResponse('createEvidenceMediaSession', 201, session).ok).toBe(true);
    expect(media.appended).toEqual([expect.objectContaining({ unit: 'mediaStream.sessionIssued', type: 'EVIDENCE_MEDIA_SERVED', details: { fileId: 'VIDEO-02', bytesServed: 0, signed: true, expiresAt: session.expiresAt } })]);
  });

  it('CONTROL: not asked = not stated, and the session serves the file exactly as before (the web player\'s path)', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    for (const body of [undefined, {}, { fileId: 'VIDEO-01' }] as const) {
      const session = await sessionOf(media, body);
      expect(MEMBER in session).toBe(false);
      const whole = await media.fetch(session.url);
      expect([whole.statusCode, whole.headers['content-length']]).toEqual([200, String(SIZE)]);
      expect(sha256(whole.rawPayload)).toBe(media.built.manifest.tracks[0]?.sha256Plain);
    }
  });

  it('`seekIndex` alone asks for the indexed view of VIDEO-01; another value of it, or another member beside it, is 422 and issues nothing', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    expect(await sessionOf(media, { [MEMBER]: true })).toMatchObject({ fileId: 'VIDEO-01', [MEMBER]: true });
    const before = media.appended.length;
    for (const body of [{ fileId: 'VIDEO-01', [MEMBER]: false }, { fileId: 'VIDEO-01', [MEMBER]: 'yes' }, { [MEMBER]: 1 }, { fileId: 'VIDEO-01', [MEMBER]: true, view: 'INDEXED' }]) {
      const response = await media.open(body);
      expect([response.statusCode, errorOf(response).code]).toEqual([422, 'INVALID_INPUT']);
    }
    expect(media.appended.length).toBe(before);
  });

  it('a file whose table yields NO exact index (bytes behind its last fragment): the session is issued, states no indexed view and serves the file as sealed; the reason is a log line', async () => {
    const media = await build({ tailBytes: 17 });
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    expect(MEMBER in session).toBe(false);
    const whole = await media.fetch(session.url);
    expect([whole.statusCode, whole.headers['content-length']]).toEqual([200, String(SIZE + 17)]);
    expect(sha256(whole.rawPayload)).toBe(media.built.manifest.tracks[0]?.sha256Plain);
    expect(media.log.lines().some((line) => line['code'] === 'FRAGMENTS_NOT_TO_END' && line['fileId'] === 'VIDEO-01')).toBe(true);
  });
});

describe('the media route serves the indexed view: the same decrypted bytes plus ONE index', () => {
  it('no Range: 200, the length of the VIEW; the box sits between the init segment and the first fragment; without it the bytes hash to the sealed plaintext hash (both files)', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    for (const fileId of ['VIDEO-01', 'VIDEO-02'] as const) {
      const whole = await media.fetch((await indexedSession(media, fileId)).url);
      expect(whole.statusCode).toBe(200);
      expect(whole.headers).toMatchObject({ 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': String(VIEW), 'cache-control': 'no-store' });
      const view = whole.rawPayload;
      expect(view.byteLength).toBe(VIEW);
      expect([view.readUInt32BE(HEADER), view.subarray(HEADER + 4, HEADER + 8).toString('latin1')]).toEqual([BOX, 'sidx']);
      // What the box says is the signed table: five references of 700 bytes, 2 s apart.
      const table = media.built.manifest.files.find((file) => file.trackId === fileId)?.fragments ?? [];
      expect(Array.from({ length: 5 }, (_, at) => [view.readUInt32BE(HEADER + 40 + 12 * at), view.readUInt32BE(HEADER + 44 + 12 * at)])).toEqual(table.map((fragment, at) => [fragment.byteLength, (table[at + 1]?.mediaStartMs ?? fragment.mediaStartMs + fragment.mediaDurationMs) - fragment.mediaStartMs]));
      const track = media.built.manifest.tracks.find((candidate) => candidate.trackId === fileId);
      expect(sha256(Buffer.concat([view.subarray(0, HEADER), view.subarray(HEADER + BOX)]))).toBe(track?.sha256Plain);
    }
  });

  it.each([
    ['the first byte', 'bytes=0-0', 0, 1, []],
    ['inside the init segment', 'bytes=10-100', 10, 101, []],
    ['from the init segment into the box', `bytes=${HEADER - 5}-${HEADER + 9}`, HEADER - 5, HEADER + 10, []],
    ['inside the box: no fragment is opened', `bytes=${HEADER + 8}-${HEADER + 60}`, HEADER + 8, HEADER + 61, []],
    ['from the box into fragment 1', `bytes=${HEADER + BOX - 4}-${v(HEADER) + 9}`, HEADER + BOX - 4, v(HEADER) + 10, [1]],
    ['the place the index names for fragment 3 (what a seek asks), open-ended', `bytes=${v(THIRD)}-`, v(THIRD), VIEW, [3, 4, 5]],
    ['inside one fragment', `bytes=${v(HEADER + 10)}-${v(HEADER + 19)}`, v(HEADER + 10), v(HEADER + 20), [1]],
    ['across a fragment boundary: both are opened, no third', `bytes=${v(HEADER + 690)}-${v(HEADER + 709)}`, v(HEADER + 690), v(HEADER + 710), [1, 2]],
    ['the last bytes as a suffix', 'bytes=-10', VIEW - 10, VIEW, [5]],
    ['an end past the view is cut to its last byte', `bytes=${VIEW - 3}-${VIEW + 500}`, VIEW - 3, VIEW, [5]],
    ['the whole view as a range', `bytes=0-${VIEW - 1}`, 0, VIEW, [1, 2, 3, 4, 5]],
  ] as const)('%s (`%s`): 206 with the bytes of the view, `content-range` over the view, and exactly the fragments the range touches are opened', async (_name, header, start, end, fragments) => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    const view = (await media.fetch(session.url)).rawPayload;
    media.opened.length = 0;
    const part = await media.fetch(session.url, header);
    expect(part.statusCode).toBe(206);
    expect(part.headers).toMatchObject({ 'content-range': `bytes ${start}-${end - 1}/${VIEW}`, 'content-length': String(end - start), 'accept-ranges': 'bytes' });
    expect(part.rawPayload.equals(view.subarray(start, end))).toBe(true);
    expect(media.opened).toEqual([...fragments]);
  });

  it('416 at the end of the VIEW (a byte past the file is still inside the view: the control), with `content-range: bytes */<view>`', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    // Inside the view, past the length of the file: served.
    expect((await media.fetch(session.url, `bytes=${SIZE + 3}-`)).statusCode).toBe(206);
    const past = await media.fetch(session.url, `bytes=${VIEW}-`);
    expect([past.statusCode, past.headers['content-range']]).toEqual([416, `bytes */${VIEW}`]);
    // And the plain session of the same file keeps its own end.
    const plain = await sessionOf(media, { fileId: 'VIDEO-01' });
    expect([(await media.fetch(plain.url, `bytes=${SIZE}-`)).statusCode, (await media.fetch(plain.url, `bytes=${SIZE}-`)).headers['content-range']]).toEqual([416, `bytes */${SIZE}`]);
  });

  it('nothing is written: the package folder and the data directory hold the same files before and after the indexed view was served', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    const before = [filesBelow(media.built.dir), filesBelow(media.dataDir)];
    await media.fetch(session.url);
    await media.fetch(session.url, `bytes=${v(THIRD)}-`);
    expect([filesBelow(media.built.dir), filesBelow(media.dataDir)]).toEqual(before);
  });

  it('the media-session rules are unchanged: 60 s by the Core clock, 403 MEDIA_SESSION_EXPIRED from then on, another sign-in session is refused', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    media.clock.advance(EVIDENCE_MEDIA_SESSION_TTL_MS - 1);
    expect((await media.fetch(session.url, 'bytes=0-9')).statusCode).toBe(206);
    media.clock.advance(1);
    const expired = await media.fetch(session.url, 'bytes=0-9');
    expect([expired.statusCode, errorOf(expired).details?.['reason']]).toEqual([403, 'MEDIA_SESSION_EXPIRED']);
    const renewed = await indexedSession(media);
    media.actAs(SUPERVISOR);
    const other = await media.fetch(renewed.url, 'bytes=0-9');
    expect([other.statusCode, errorOf(other).details?.['reason']]).toEqual([403, 'MEDIA_SESSION_INVALID']);
  });
});

describe('a fragment that fails its integrity check stops the indexed view at the same place of the recording', () => {
  it('a range that STARTS in the failed fragment (the offset the index names): a clean 409 FRAGMENT_NOT_AUTHENTIC naming the fragment, not one byte, the row in FILE offsets - and the fragments beside it still play', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    const view = (await media.fetch(session.url)).rawPayload;
    tamper(media);
    const refused = await media.fetch(session.url, `bytes=${v(THIRD + 10)}-${v(THIRD + 400)}`);
    expect([refused.statusCode, errorOf(refused).code]).toEqual([409, 'MEDIA_NOT_AVAILABLE']);
    expect(errorOf(refused).details).toMatchObject({ reason: 'FRAGMENT_NOT_AUTHENTIC', fileId: 'VIDEO-01', seq: 3 });
    expect(refused.rawPayload.includes(view.subarray(v(THIRD + 10), v(THIRD + 40)))).toBe(false);
    expect(stopRows(media)).toEqual([
      expect.objectContaining({ severity: 'WARNING', message: 'Media stream stopped: VIDEO-01 fragment 3 (FRAGMENT_NOT_AUTHENTIC)', details: { fileId: 'VIDEO-01', bytesServed: 0, rangeStart: THIRD + 10, rangeEnd: THIRD + 400, signed: true } }),
    ]);
    // The view offset WITHOUT the shift is fragment 2's bytes: it plays (the shift is what places the refusal).
    const second = await media.fetch(session.url, `bytes=${v(HEADER + FRAGMENT)}-${v(THIRD) - 1}`);
    expect([second.statusCode, second.rawPayload.equals(view.subarray(v(HEADER + FRAGMENT), v(THIRD)))]).toEqual([206, true]);
    expect((await media.fetch(session.url, `bytes=${v(THIRD + FRAGMENT)}-`)).statusCode).toBe(206);
    expect((await media.fetch(session.url, `bytes=${HEADER}-${HEADER + BOX - 1}`)).statusCode).toBe(206);
  });

  it('a range that REACHES it later: the answer ends before it - the init segment, the index and fragments 1-2, never a byte of fragment 3 - and the stop is one WARNING row with the bytes handed over', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    const view = (await media.fetch(session.url)).rawPayload;
    tamper(media);
    media.opened.length = 0;
    const { status, told, received } = await cutFetch(media, session.url, 'bytes=0-');
    expect(received.byteLength).toBeLessThanOrEqual(v(THIRD));
    expect(received.equals(view.subarray(0, received.byteLength))).toBe(true);
    if (status !== null) expect([status, told]).toEqual([206, String(VIEW)]);
    expect(media.opened).toEqual([1, 2, 3]);
    expect(stopRows(media)).toEqual([
      expect.objectContaining({ severity: 'WARNING', message: 'Media stream stopped: VIDEO-01 fragment 3 (FRAGMENT_NOT_AUTHENTIC)', details: { fileId: 'VIDEO-01', bytesServed: v(THIRD), rangeStart: 0, rangeEnd: SIZE - 1, signed: true } }),
    ]);
  });
});

describe('G94b-10: ONE stop writes ONE row, whatever the player asks again', () => {
  it('the cut, then the three retries of a player from the place of the cut, then a renewed session at the same place: every request is refused, the trail holds ONE WARNING row', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await indexedSession(media);
    tamper(media);
    await cutFetch(media, session.url, 'bytes=0-');
    expect(stopRows(media)).toHaveLength(1);
    for (let retry = 0; retry < 3; retry += 1) {
      const again = await media.fetch(session.url, `bytes=${v(THIRD)}-`);
      expect([again.statusCode, errorOf(again).details?.['reason'], errorOf(again).details?.['seq']]).toEqual([409, 'FRAGMENT_NOT_AUTHENTIC', 3]);
    }
    // The app's one automatic renewal: a NEW media session, the same sign-in session, the same place.
    const renewed = await indexedSession(media);
    expect((await media.fetch(renewed.url, `bytes=${v(THIRD)}-`)).statusCode).toBe(409);
    expect(stopRows(media)).toHaveLength(1);
    // The repeats are log lines (warn), each saying it is a repeat; the first is the error line.
    expect(media.log.lines().filter((line) => line['repeated'] === true && line['code'] === 'FRAGMENT_NOT_AUTHENTIC')).toHaveLength(4);
    expect(media.errors.filter((entry) => entry['source'] === 'mediaStream.serve')).toHaveLength(1);
  });

  it('the plain stream holds the same rule (the web player and its probe)', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media, { fileId: 'VIDEO-01' });
    tamper(media);
    for (let ask = 0; ask < 3; ask += 1) expect((await media.fetch(session.url, `bytes=${THIRD}-`)).statusCode).toBe(409);
    expect(stopRows(media)).toHaveLength(1);
  });

  it('CONTROLS: another fragment, the other file, another sign-in session and a later playback are each their OWN row', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media, { fileId: 'VIDEO-01' });
    tamper(media);
    expect((await media.fetch(session.url, `bytes=${THIRD}-`)).statusCode).toBe(409);
    expect(stopRows(media)).toHaveLength(1);
    // Another fragment of the same file.
    flipByte(media.built.path(cameraFilePath('VIDEO-01')), media.built.fragment('VIDEO-01', 5).byteOffset + 5);
    expect((await media.fetch(session.url, `bytes=${THIRD + 2 * FRAGMENT}-`)).statusCode).toBe(409);
    expect(stopRows(media).map((row) => row.message)).toEqual(['Media stream stopped: VIDEO-01 fragment 3 (FRAGMENT_NOT_AUTHENTIC)', 'Media stream stopped: VIDEO-01 fragment 5 (FRAGMENT_NOT_AUTHENTIC)']);
    // The other file.
    flipByte(media.built.path(cameraFilePath('VIDEO-02')), media.built.fragment('VIDEO-02', 3).byteOffset + 5);
    expect((await media.fetch((await sessionOf(media, { fileId: 'VIDEO-02' })).url, `bytes=${THIRD}-`)).statusCode).toBe(409);
    expect(stopRows(media)).toHaveLength(3);
    // Another sign-in session (a supervisor): its own stop.
    media.actAs(SUPERVISOR);
    expect((await media.fetch((await sessionOf(media, { fileId: 'VIDEO-01' })).url, `bytes=${THIRD}-`)).statusCode).toBe(409);
    expect(stopRows(media)).toHaveLength(4);
    // The same operator, one media-session lifetime later: a new playback, a new row.
    media.actAs(INVESTIGATOR);
    media.clock.advance(EVIDENCE_MEDIA_SESSION_TTL_MS);
    expect((await media.fetch((await sessionOf(media, { fileId: 'VIDEO-01' })).url, `bytes=${THIRD}-`)).statusCode).toBe(409);
    expect(stopRows(media)).toHaveLength(5);
  });
});
