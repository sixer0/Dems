// Operation 88 and the media route without a database (blueprint row 90, M8-W1; C3 §2.2 op 88,
// §2.4, §5.1, §5.2; capture spec §D.4; SEC35-12, SEC35-13, SEC35-16; checks M8-RNG-1, M8-BLK-1
// (server side), M8-EV-SCOPE-1 (server rule) and the session-binding refusals).
//
// The real app factory, the REAL access rule on operation 88, a real sealed v2 package whose
// fragments were sealed by the PRODUCT cipher under a key of a real credential store, opened by
// the app's own `coreFragmentOpener`, and the media-session key of that store (`support.ts`).
// Each `it` holds its negative control.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { EVIDENCE_MEDIA_SESSION_TTL_MS, validateCoreApiResponse } from '@dems/shared/api';
import { cameraFilePath } from '@dems/shared/evidence-package';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { MEDIA_SESSION_KEY_SECRET_NAME } from '../../../media-stream';
import { coreCredentialStore } from '../../../credential-store';
import { flipByte } from '../../../evidence-verify/__tests__/support';
import { ANONYMOUS, operatorOf } from '../../devices/__tests__/support';
import { EVIDENCE_ID, SESSION_ID, filesBelow, mediaApp, removeMediaScratch, type MediaApp, type MediaAppOptions } from './support';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
afterAll(removeMediaScratch);

async function build(options: MediaAppOptions = {}): Promise<MediaApp> {
  const built = await mediaApp(options);
  apps.push(built.app);
  return built;
}

// The builder's file: 129 clear bytes, five sealed fragments of 700 bytes, 17 clear bytes.
const HEADER = 129;
const FRAGMENT = 700;
const SIZE = HEADER + 5 * FRAGMENT + 17;
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const errorOf = (response: LightMyRequestResponse): { code: string; details?: Record<string, unknown> } => (response.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
/** The seeded operators: OPR-001 INVESTIGATOR (holds the case of the test item), OPR-002 SUPERVISOR, OPR-003 TECHNICIAN. */
const INVESTIGATOR = operatorOf('INVESTIGATOR');
const SUPERVISOR = operatorOf('SUPERVISOR');
const TECHNICIAN = operatorOf('TECHNICIAN');
const otherSession = (principal: typeof INVESTIGATOR): typeof INVESTIGATOR => (principal.kind === 'OPERATOR' ? { ...principal, sessionId: 'another-sign-in' } : principal);

interface Session {
  evidenceId: string;
  fileId: string;
  url: string;
  expiresAt: number;
  ranges: boolean;
}

async function sessionOf(media: MediaApp, fileId?: 'VIDEO-01' | 'VIDEO-02'): Promise<Session> {
  const response = await media.open(fileId === undefined ? undefined : { fileId });
  if (response.statusCode !== 201) throw new Error(`operation 88 answered ${response.statusCode} ${response.body}`);
  return response.json() as Session;
}

/** The whole plaintext of a camera file, through the route, proved against the sealed plaintext hash of the manifest. */
async function plaintextOf(media: MediaApp, session: Session): Promise<Buffer> {
  const whole = await media.fetch(session.url);
  expect(whole.statusCode).toBe(200);
  const track = media.built.manifest.tracks.find((candidate) => candidate.trackId === session.fileId);
  expect(sha256(whole.rawPayload)).toBe(track?.sha256Plain);
  return whole.rawPayload;
}

describe('operation 88: a signed media session', () => {
  it('201 in the shape of the contract, a loopback URL with an `mts_` token, ONE audit row committed for it - and no token in a row or a log line', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const response = await media.open();
    expect(response.statusCode).toBe(201);
    const session = response.json() as Session;
    expect(validateCoreApiResponse('createEvidenceMediaSession', 201, session)).toEqual({ ok: true });
    expect(session).toMatchObject({ evidenceId: EVIDENCE_ID, fileId: 'VIDEO-01', expiresAt: media.clock.now() + EVIDENCE_MEDIA_SESSION_TTL_MS, ranges: true });
    expect(EVIDENCE_MEDIA_SESSION_TTL_MS).toBe(60_000);
    expect(session.url).toMatch(/^http:\/\/127\.0\.0\.1:4420\/media\/mts_[A-Za-z0-9_-]{60,96}$/);

    expect(media.appended).toEqual([
      {
        unit: 'mediaStream.sessionIssued',
        type: 'EVIDENCE_MEDIA_SERVED',
        message: 'Media session opened for VIDEO-01',
        actorId: 'OPR-001',
        deviceId: null,
        sessionId: SESSION_ID,
        evidenceId: EVIDENCE_ID,
        details: { fileId: 'VIDEO-01', bytesServed: 0, signed: true, expiresAt: session.expiresAt },
      },
    ]);
    // M8-BLK-1, server side: the token is in the answer and nowhere else.
    const token = session.url.split('/').at(-1) ?? '';
    expect(token.length).toBeGreaterThan(60);
    for (const text of [media.log.text(), JSON.stringify(media.appended), JSON.stringify(media.errors)]) {
      expect(text).not.toContain(token);
      expect(text).not.toContain(token.slice(-16));
      expect(text).not.toContain('mts_');
      expect(text).not.toContain('/media/');
    }
    // Control: the log was captured (the line of the session is there, by its code).
    expect(media.log.lines().some((line) => line['code'] === 'EVIDENCE_MEDIA_SERVED' && line['fileId'] === 'VIDEO-01')).toBe(true);
  });

  it('the body names the file: VIDEO-02; a body with a member that is not exactly `fileId` is 422 and issues nothing', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    expect((await sessionOf(media, 'VIDEO-02')).fileId).toBe('VIDEO-02');
    // No body and `{}` are the same request on this server: VIDEO-01.
    expect(((await media.open({})).json() as Session).fileId).toBe('VIDEO-01');
    const before = media.appended.length;
    for (const body of [{ fileId: 'AUDIO-01' }, { fileId: 'VIDEO-01', extra: 1 }, { file: 'VIDEO-01' }, { fileId: null }, { fileId: ['VIDEO-01'] }]) {
      const refused = await media.open(body);
      expect([refused.statusCode, errorOf(refused).code], JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
    }
    expect(media.appended).toHaveLength(before);
  });

  it('M8-RNG-1 "refusal without EVIDENCE_VIEW": stage 6 refuses a role without it and an anonymous caller, before anything is read', async () => {
    const media = await build();
    media.actAs(operatorOf('TECHNICIAN', []));
    const denied = await media.open();
    expect([denied.statusCode, errorOf(denied).code]).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(denied).details).toMatchObject({ operationId: 'createEvidenceMediaSession', permission: 'EVIDENCE_VIEW' });
    media.actAs(ANONYMOUS);
    expect((await media.open()).statusCode).toBe(401);
    // Control: the same caller WITH the permission (a supervisor) gets a session.
    media.actAs(SUPERVISOR);
    expect((await media.open()).statusCode).toBe(201);
  });

  it('404 for an unknown item, 422 for an ID of another form, 409 MEDIA_NOT_AVAILABLE for an item without a real sealed package', async () => {
    const media = await build();
    media.actAs(SUPERVISOR);
    const unknown = await media.open(undefined, 'EV-20261009-0999');
    expect([unknown.statusCode, errorOf(unknown).code]).toEqual([404, 'NOT_FOUND']);
    expect((await media.open(undefined, 'EV-1')).statusCode).toBe(422);
    media.items.set('EV-20261009-0002', { evidenceId: 'EV-20261009-0002', sessionId: 'SES-20261009-0002', investigatorId: 'OPR-001', real: false, manifestSha256: '0'.repeat(64) });
    const demo = await media.open(undefined, 'EV-20261009-0002');
    expect([demo.statusCode, errorOf(demo).code, errorOf(demo).details?.['reason']]).toEqual([409, 'MEDIA_NOT_AVAILABLE', 'NOT_A_SEALED_PACKAGE']);
    expect(media.appended).toEqual([]);
  });

  it('409 with a reason, and no session, when the package cannot be played: folder gone, manifest not the sealed one, session key lost', async () => {
    const media = await build();
    media.actAs(SUPERVISOR);
    const reasonOf = async (evidenceId: string): Promise<unknown> => {
      const response = await media.open(undefined, evidenceId);
      expect([response.statusCode, errorOf(response).code]).toEqual([409, 'MEDIA_NOT_AVAILABLE']);
      return errorOf(response).details?.['reason'];
    };
    const own = media.items.get(EVIDENCE_ID);
    if (own === undefined) throw new Error('no item');
    // A session whose folder the test does not name.
    media.items.set('EV-20261009-0003', { ...own, evidenceId: 'EV-20261009-0003', sessionId: 'SES-20261009-0003' });
    expect(await reasonOf('EV-20261009-0003')).toBe('PACKAGE_MISSING');
    // The database recorded ANOTHER digest than the manifest on disk states: a swapped or edited manifest.
    media.items.set(EVIDENCE_ID, { ...own, manifestSha256: 'f'.repeat(64) });
    expect(await reasonOf(EVIDENCE_ID)).toBe('MANIFEST_NOT_OF_ITEM');
    media.items.set(EVIDENCE_ID, own);
    expect((await media.open()).statusCode).toBe(201); // control: the true digest plays
    // Key lost = data unreadable (SEC35-09). A fresh app, so that no plan is remembered.
    const lost = await build();
    lost.actAs(SUPERVISOR);
    const store = coreCredentialStore(lost.app);
    if (store.status !== 'READY') throw new Error('no store');
    expect(store.store.sessionKeys.destroy(`KID-${SESSION_ID}`)).toBe(true);
    const response = await lost.open();
    expect([response.statusCode, errorOf(response).details?.['reason']]).toEqual([409, 'SESSION_KEY_UNAVAILABLE']);
    expect(lost.appended).toEqual([]);
  });

  it('503 NOT_READY while the Core has no credential store: no key, no session', async () => {
    const media = await build({ store: false });
    media.actAs(SUPERVISOR);
    const response = await media.open();
    expect([response.statusCode, errorOf(response).code, errorOf(response).details?.['reason']]).toEqual([503, 'NOT_READY', 'CREDENTIAL_STORE_NOT_READY']);
    expect(media.appended).toEqual([]);
  });

  it('SEC35-12: the signing key is a SEPARATE named secret of the store, made at the first session, 32 bytes, and it is not the session key', async () => {
    const media = await build();
    const store = coreCredentialStore(media.app);
    if (store.status !== 'READY') throw new Error('no store');
    expect(MEDIA_SESSION_KEY_SECRET_NAME).toBe('MEDIA_KEY_EVMEDIA_01');
    expect(store.store.namedSecrets.has(MEDIA_SESSION_KEY_SECRET_NAME)).toBe(false);
    media.actAs(SUPERVISOR);
    await sessionOf(media);
    expect(store.store.namedSecrets.has(MEDIA_SESSION_KEY_SECRET_NAME)).toBe(true);
    expect(store.store.namedSecrets.use(MEDIA_SESSION_KEY_SECRET_NAME, (key) => key.byteLength)).toBe(32);
    // A second session uses the same key: the first token still verifies.
    const first = await sessionOf(media);
    await sessionOf(media, 'VIDEO-02');
    expect((await media.fetch(first.url, 'bytes=0-0')).statusCode).toBe(206);
  });
});

describe('M8-EV-SCOPE-1 (SEC35-16, Q-SEC-1 (a)): REAL evidence is for the operator who holds the case, and for a supervisor', () => {
  it('the holder and a supervisor get a session; another investigator and a technician are refused 403 NOT_PERMITTED with ONE audited attempt each', async () => {
    const media = await build();
    const own = media.items.get(EVIDENCE_ID);
    if (own === undefined) throw new Error('no item');
    // The case is held by ANOTHER investigator (OPR-009): the seeded investigator and the technician both hold EVIDENCE_VIEW and not the case.
    media.items.set(EVIDENCE_ID, { ...own, investigatorId: 'OPR-009' });
    for (const [caller, role, operatorId] of [[INVESTIGATOR, 'INVESTIGATOR', 'OPR-001'], [TECHNICIAN, 'TECHNICIAN', 'OPR-003']] as const) {
      expect(caller.kind === 'OPERATOR' && caller.permissions.includes('EVIDENCE_VIEW')).toBe(true);
      media.actAs(caller);
      const before = media.appended.length;
      const refused = await media.open();
      expect([refused.statusCode, errorOf(refused).code]).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(refused).details).toEqual({ operationId: 'createEvidenceMediaSession', permission: 'EVIDENCE_VIEW', role, reason: 'EVIDENCE_CASE_SCOPE' });
      expect(media.appended.slice(before)).toEqual([
        expect.objectContaining({ unit: 'mediaStream.denied', type: 'ACCESS_DENIED', severity: 'WARNING', actorId: operatorId, evidenceId: EVIDENCE_ID, details: { operationId: 'createEvidenceMediaSession', permission: 'EVIDENCE_VIEW', role, reason: 'EVIDENCE_CASE_SCOPE' } }),
      ]);
    }
    media.actAs(SUPERVISOR);
    expect((await media.open()).statusCode).toBe(201);
    // Control: the SAME investigator, once the case is theirs.
    media.items.set(EVIDENCE_ID, own);
    media.actAs(INVESTIGATOR);
    expect((await media.open()).statusCode).toBe(201);
  });

  it('the scope holds at the media route too: a session issued while the case was the caller\'s plays nothing once it is not', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    expect((await media.fetch(session.url, 'bytes=0-9')).statusCode).toBe(206);
    const own = media.items.get(EVIDENCE_ID);
    if (own === undefined) throw new Error('no item');
    media.items.set(EVIDENCE_ID, { ...own, investigatorId: 'OPR-009' });
    const refused = await media.fetch(session.url, 'bytes=0-9');
    expect([refused.statusCode, errorOf(refused).details?.['reason']]).toEqual([403, 'EVIDENCE_CASE_SCOPE']);
    expect(media.appended.at(-1)).toMatchObject({ type: 'ACCESS_DENIED', actorId: 'OPR-001', evidenceId: EVIDENCE_ID });
  });
});

describe('M8-RNG-1: the media route answers byte ranges of the DECRYPTED file', () => {
  it('no Range: 200, the whole file, and it hashes to the sealed plaintext hash of the manifest (both files)', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    for (const fileId of ['VIDEO-01', 'VIDEO-02'] as const) {
      const session = await sessionOf(media, fileId);
      const whole = await media.fetch(session.url);
      expect(whole.statusCode).toBe(200);
      expect(whole.headers).toMatchObject({ 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': String(SIZE), 'cache-control': 'no-store' });
      expect(whole.headers['content-range']).toBeUndefined();
      expect(whole.rawPayload.byteLength).toBe(SIZE);
      const track = media.built.manifest.tracks.find((candidate) => candidate.trackId === fileId);
      expect(sha256(whole.rawPayload)).toBe(track?.sha256Plain);
      // Control: what lies on disk is NOT that (it is ciphertext), and has another hash.
      const stored = readFileSync(media.built.path(cameraFilePath(fileId)));
      expect(sha256(stored)).toBe(track?.sha256);
      expect(track?.sha256).not.toBe(track?.sha256Plain);
    }
  });

  it.each([
    ['the first byte', 'bytes=0-0', 0, 1, []],
    ['inside the clear header: no fragment is opened', 'bytes=10-100', 10, 101, []],
    ['inside one fragment', `bytes=${HEADER + 10}-${HEADER + 19}`, HEADER + 10, HEADER + 20, [1]],
    ['across a fragment boundary: both are opened, no third', `bytes=${HEADER + 690}-${HEADER + 709}`, HEADER + 690, HEADER + 710, [1, 2]],
    ['multi-fragment, from the header to the middle of fragment 4', `bytes=100-${HEADER + 3 * FRAGMENT + 50}`, 100, HEADER + 3 * FRAGMENT + 51, [1, 2, 3, 4]],
    ['exactly one whole fragment', `bytes=${HEADER + FRAGMENT}-${HEADER + 2 * FRAGMENT - 1}`, HEADER + FRAGMENT, HEADER + 2 * FRAGMENT, [2]],
    ['open-ended', `bytes=${HEADER + 4 * FRAGMENT + 5}-`, HEADER + 4 * FRAGMENT + 5, SIZE, [5]],
    ['open-ended from 0', 'bytes=0-', 0, SIZE, [1, 2, 3, 4, 5]],
    ['the last byte', `bytes=${SIZE - 1}-${SIZE - 1}`, SIZE - 1, SIZE, []],
    ['the last byte of the last fragment', `bytes=${HEADER + 5 * FRAGMENT - 1}-${HEADER + 5 * FRAGMENT - 1}`, HEADER + 5 * FRAGMENT - 1, HEADER + 5 * FRAGMENT, [5]],
    ['a suffix', 'bytes=-17', SIZE - 17, SIZE, []],
    ['a suffix that reaches into the last fragment', 'bytes=-20', SIZE - 20, SIZE, [5]],
    ['an end past the file is cut to its last byte', `bytes=${SIZE - 5}-999999`, SIZE - 5, SIZE, []],
  ] as const)('206 %s (%s)', async (_name, header, start, end, fragments) => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    const plain = await plaintextOf(media, session);
    media.opened.length = 0;
    const before = media.appended.length;
    const response = await media.fetch(session.url, header);
    expect(response.statusCode).toBe(206);
    expect(response.headers).toMatchObject({ 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': String(end - start), 'content-range': `bytes ${start}-${end - 1}/${SIZE}` });
    expect(response.rawPayload.equals(plain.subarray(start, end))).toBe(true);
    // §D.4: only the fragments the range covers are opened, each once.
    expect(media.opened).toEqual([...fragments]);
    // One row for the answered range, with what was served.
    expect(media.appended.slice(before)).toEqual([
      expect.objectContaining({ unit: 'mediaStream.served', type: 'EVIDENCE_MEDIA_SERVED', actorId: 'OPR-001', evidenceId: EVIDENCE_ID, sessionId: SESSION_ID, details: { fileId: 'VIDEO-01', bytesServed: end - start, rangeStart: start, rangeEnd: end - 1, signed: true } }),
    ]);
    expect(media.appended.at(-1)?.severity).toBeUndefined();
  });

  it('416 for a range that starts at or past the end, with `content-range: bytes */size`, no byte, no fragment opened and no row', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    const before = media.appended.length;
    for (const header of [`bytes=${SIZE}-`, `bytes=${SIZE}-${SIZE + 9}`, 'bytes=999999-', 'bytes=-0']) {
      const response = await media.fetch(session.url, header);
      expect([response.statusCode, errorOf(response).code, errorOf(response).details?.['reason']], header).toEqual([416, 'INVALID_INPUT', 'RANGE_NOT_SATISFIABLE']);
      expect(response.headers).toMatchObject({ 'content-range': `bytes */${SIZE}`, 'accept-ranges': 'bytes' });
    }
    expect(media.opened).toEqual([]);
    expect(media.appended).toHaveLength(before);
    // Control: one byte earlier is satisfiable.
    expect((await media.fetch(session.url, `bytes=${SIZE - 1}-`)).statusCode).toBe(206);
  });

  it('a header this server does not serve (several ranges, another unit, a malformed value) is ignored: 200, the whole file', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    for (const header of ['bytes=0-1,5-9', 'items=0-1', 'bytes=5-2', 'bytes=abc']) {
      const response = await media.fetch(session.url, header);
      expect([response.statusCode, response.rawPayload.byteLength], header).toEqual([200, SIZE]);
    }
  });

  it('nothing is written anywhere: the package folder and the data directory hold the same files before and after serving both files', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const first = await sessionOf(media, 'VIDEO-01'); // makes the signing key: the one file a session may add
    const packageBefore = filesBelow(media.built.dir);
    const dataBefore = filesBelow(media.dataDir);
    const second = await sessionOf(media, 'VIDEO-02');
    for (const session of [first, second]) {
      expect((await media.fetch(session.url)).statusCode).toBe(200);
      expect((await media.fetch(session.url, 'bytes=200-2999')).statusCode).toBe(206);
    }
    expect(filesBelow(media.built.dir)).toEqual(packageBefore);
    expect(filesBelow(media.dataDir)).toEqual(dataBefore);
    expect(packageBefore.length).toBeGreaterThan(5);
  });

  it('M8-BLK-1, server side: after serving, no log line, audit row or error entry holds the token, the URL or a `Range` value; the request line names the route PATTERN', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    const token = session.url.split('/').at(-1) ?? '';
    await media.fetch(session.url, 'bytes=131-141');
    await media.fetch(session.url, `bytes=${SIZE}-`);
    await media.fetch(`${session.url.slice(0, -2)}AA`, 'bytes=0-1');
    await media.app.close();
    const everything = [media.log.text(), JSON.stringify(media.appended), JSON.stringify(media.errors)].join('\n');
    expect(everything).not.toContain(token);
    expect(everything).not.toContain(token.slice(4, 24));
    expect(everything).not.toContain('mts_');
    expect(everything).not.toContain('/media/mts');
    expect(everything).not.toContain('bytes=');
    const routes = media.log.lines().map((line) => (line['req'] as { route?: string } | undefined)?.route ?? line['route']).filter((route) => typeof route === 'string');
    expect(routes).toContain('/media/:token');
    expect(routes.every((route) => !String(route).includes('mts'))).toBe(true);
  });
});

describe('the session binding at the media route (SEC35-12)', () => {
  it('the token alone opens nothing: an anonymous caller is 401', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    media.actAs(ANONYMOUS);
    const response = await media.fetch(session.url, 'bytes=0-0');
    expect([response.statusCode, errorOf(response).code]).toEqual([401, 'NOT_SIGNED_IN']);
    expect(media.opened).toEqual([]);
  });

  it('another operator, and the SAME operator in another sign-in session, are refused 403 MEDIA_SESSION_INVALID with one audited attempt and not one byte', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    expect((await media.fetch(session.url, 'bytes=0-0')).statusCode).toBe(206); // control: the holder
    media.opened.length = 0;
    for (const [caller, operatorId, role] of [[SUPERVISOR, 'OPR-002', 'SUPERVISOR'], [otherSession(INVESTIGATOR), 'OPR-001', 'INVESTIGATOR']] as const) {
      media.actAs(caller);
      const before = media.appended.length;
      const response = await media.fetch(session.url, 'bytes=0-0');
      expect([response.statusCode, errorOf(response).code]).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(response).details).toEqual({ operationId: 'createEvidenceMediaSession', role, reason: 'MEDIA_SESSION_INVALID' });
      expect(response.headers['content-type']).toMatch(/json/);
      // The row names the caller and NOT the evidence item: the claims of a token that did not verify are not believed.
      expect(media.appended.slice(before)).toEqual([expect.objectContaining({ unit: 'mediaStream.denied', type: 'ACCESS_DENIED', actorId: operatorId, details: { operationId: 'createEvidenceMediaSession', role, reason: 'MEDIA_SESSION_INVALID' } })]);
      expect(media.appended.at(-1)?.evidenceId).toBeUndefined();
    }
    expect(media.opened).toEqual([]);
    // Control: back in the session the token was issued to, it plays.
    media.actAs(INVESTIGATOR);
    expect((await media.fetch(session.url, 'bytes=0-0')).statusCode).toBe(206);
  });

  it('an altered token, a token for the other file made by editing, and what is no token at all are refused the same way', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    const token = session.url.split('/').at(-1) ?? '';
    const bytes = Buffer.from(token.slice(4), 'base64url');
    const edited = (change: (copy: Buffer) => void): string => {
      const copy = Buffer.from(bytes);
      change(copy);
      return `http://127.0.0.1:4420/media/mts_${copy.toString('base64url')}`;
    };
    const attempts = [
      edited((copy) => void (copy[1] = 2)), // VIDEO-01 -> VIDEO-02
      edited((copy) => void copy.writeUIntBE(session.expiresAt + 3_600_000, 2, 6)), // a longer life
      edited((copy) => void (copy[copy.byteLength - 1] = (copy[copy.byteLength - 1] ?? 0) ^ 1)),
      'http://127.0.0.1:4420/media/mts_AAAA',
      `http://127.0.0.1:4420/media/ses_${token.slice(4)}`,
      'http://127.0.0.1:4420/media/x',
    ];
    for (const url of attempts) {
      const response = await media.fetch(url, 'bytes=0-0');
      expect([response.statusCode, errorOf(response).details?.['reason']], url.slice(28, 40)).toEqual([403, 'MEDIA_SESSION_INVALID']);
    }
    expect(media.opened).toEqual([]);
  });

  it('the lifetime is exactly the TTL: played one millisecond before `expiresAt`, 403 MEDIA_SESSION_EXPIRED from it on, with no row', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    media.clock.advance(EVIDENCE_MEDIA_SESSION_TTL_MS - 1);
    expect((await media.fetch(session.url, 'bytes=0-0')).statusCode).toBe(206);
    media.clock.advance(1);
    const before = media.appended.length;
    const expired = await media.fetch(session.url, 'bytes=0-0');
    expect([expired.statusCode, errorOf(expired).code, errorOf(expired).details]).toEqual([403, 'NOT_PERMITTED', { operationId: 'createEvidenceMediaSession', reason: 'MEDIA_SESSION_EXPIRED' }]);
    expect(media.appended).toHaveLength(before);
    // A new session of the same caller plays again.
    expect((await media.fetch((await sessionOf(media)).url, 'bytes=0-0')).statusCode).toBe(206);
  });

  it('ruling D140: the guard gives the media route the rule of operation 88 - a caller without EVIDENCE_VIEW is refused by stage 6 BEFORE the token is looked at; with it, the token checks run', async () => {
    const media = await build();
    media.actAs(SUPERVISOR);
    const session = await sessionOf(media);
    const store = coreCredentialStore(media.app);
    if (store.status !== 'READY') throw new Error('no store');
    const garbage = 'http://127.0.0.1:4420/media/not-a-token';

    // Without the permission: the same refusal for a VALID token and for garbage - the token decided nothing.
    media.actAs(operatorOf('SUPERVISOR', []));
    for (const url of [session.url, garbage]) {
      const before = media.appended.length;
      const refused = await media.fetch(url, 'bytes=0-0');
      expect([refused.statusCode, errorOf(refused).code, errorOf(refused).details]).toEqual([403, 'NOT_PERMITTED', { operationId: 'evidenceMediaStream', permission: 'EVIDENCE_VIEW', role: 'SUPERVISOR' }]);
      // One row, written by stage 6 (its unit), not by the handler.
      expect(media.appended.slice(before)).toEqual([expect.objectContaining({ unit: 'rbac.denied', type: 'ACCESS_DENIED', actorId: 'OPR-002', details: { operationId: 'evidenceMediaStream', permission: 'EVIDENCE_VIEW', role: 'SUPERVISOR' } })]);
    }
    expect(media.opened).toEqual([]);
    // Nobody: 401 from stage 6, no row, whatever the token.
    media.actAs(ANONYMOUS);
    const rows = media.appended.length;
    for (const url of [session.url, garbage]) expect((await media.fetch(url, 'bytes=0-0')).statusCode).toBe(401);
    expect(media.appended).toHaveLength(rows);

    // Control: WITH the permission the handler is reached and the token decides - garbage is the handler's refusal, the valid token plays.
    media.actAs(SUPERVISOR);
    const invalid = await media.fetch(garbage, 'bytes=0-0');
    expect([invalid.statusCode, errorOf(invalid).details]).toEqual([403, { operationId: 'createEvidenceMediaSession', role: 'SUPERVISOR', reason: 'MEDIA_SESSION_INVALID' }]);
    expect(media.appended.at(-1)).toMatchObject({ unit: 'mediaStream.denied' });
    expect((await media.fetch(session.url, 'bytes=0-0')).statusCode).toBe(206);
  });

  it('an item that is gone (a reset) plays nothing: 409', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    media.items.delete(EVIDENCE_ID);
    const response = await media.fetch(session.url, 'bytes=0-0');
    expect([response.statusCode, errorOf(response).code]).toEqual([409, 'MEDIA_NOT_AVAILABLE']);
  });
});

describe('a fragment whose tag fails is never served (capture spec §D.4)', () => {
  /** One byte of fragment 3 of VIDEO-01 inverted on disk. */
  const tamper = (media: MediaApp): void => flipByte(media.built.path(cameraFilePath('VIDEO-01')), media.built.fragment('VIDEO-01', 3).byteOffset + 5);
  const THIRD = HEADER + 2 * FRAGMENT;

  it('a range that STARTS in the tampered fragment: a clean 409 naming the fragment, a WARNING row with 0 bytes, an error entry - and the ranges beside it still play', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    const plain = await plaintextOf(media, session);
    tamper(media);
    const before = media.appended.length;
    const refused = await media.fetch(session.url, `bytes=${THIRD + 10}-${THIRD + 400}`);
    expect([refused.statusCode, errorOf(refused).code]).toEqual([409, 'MEDIA_NOT_AVAILABLE']);
    expect(errorOf(refused).details).toMatchObject({ reason: 'FRAGMENT_NOT_AUTHENTIC', fileId: 'VIDEO-01', seq: 3 });
    expect(refused.headers['content-type']).toMatch(/json/);
    expect(refused.rawPayload.includes(plain.subarray(THIRD + 10, THIRD + 40))).toBe(false);
    expect(media.appended.slice(before)).toEqual([
      expect.objectContaining({ unit: 'mediaStream.served', type: 'EVIDENCE_MEDIA_SERVED', severity: 'WARNING', message: 'Media stream stopped: VIDEO-01 fragment 3 (FRAGMENT_NOT_AUTHENTIC)', details: { fileId: 'VIDEO-01', bytesServed: 0, rangeStart: THIRD + 10, rangeEnd: THIRD + 400, signed: true } }),
    ]);
    expect(media.errors.at(-1)).toMatchObject({ level: 'error', source: 'mediaStream.serve', code: 'FRAGMENT_NOT_AUTHENTIC' });
    // Fragments 2 and 4 are untouched and play; the other file plays whole.
    const second = await media.fetch(session.url, `bytes=${HEADER + FRAGMENT}-${THIRD - 1}`);
    expect([second.statusCode, second.rawPayload.equals(plain.subarray(HEADER + FRAGMENT, THIRD))]).toEqual([206, true]);
    expect((await media.fetch(session.url, `bytes=${THIRD + FRAGMENT}-`)).statusCode).toBe(206);
    expect((await media.fetch((await sessionOf(media, 'VIDEO-02')).url)).statusCode).toBe(200);
  });

  it('a range that REACHES the tampered fragment later: the answer ends before it - the client holds fewer bytes than it was told, none of them of that fragment - and the stop is audited with the bytes handed over', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    const plain = await plaintextOf(media, session);
    tamper(media);
    media.opened.length = 0;
    const before = media.appended.length;
    let received: Buffer = Buffer.alloc(0);
    let status: number | null = null;
    let told: string | null = null;
    try {
      const response = await media.fetch(session.url, 'bytes=0-');
      status = response.statusCode;
      told = String(response.headers['content-length']);
      received = response.rawPayload;
    } catch {
      // The connection was destroyed: the in-process client reports it as a failure of the request.
    }
    // Never the whole range, never a byte of fragment 3 or behind it.
    expect(received.byteLength).toBeLessThanOrEqual(THIRD);
    expect(received.equals(plain.subarray(0, received.byteLength))).toBe(true);
    if (status !== null) expect([status, told]).toEqual([206, String(SIZE)]);
    expect(media.opened).toEqual([1, 2, 3]);
    expect(media.appended.slice(before)).toEqual([
      expect.objectContaining({ unit: 'mediaStream.served', type: 'EVIDENCE_MEDIA_SERVED', severity: 'WARNING', message: 'Media stream stopped: VIDEO-01 fragment 3 (FRAGMENT_NOT_AUTHENTIC)', details: { fileId: 'VIDEO-01', bytesServed: THIRD, rangeStart: 0, rangeEnd: SIZE - 1, signed: true } }),
    ]);
    expect(media.errors.some((entry) => entry['source'] === 'mediaStream.serve' && entry['code'] === 'FRAGMENT_NOT_AUTHENTIC')).toBe(true);
  });

  it('a ciphertext moved to another position does not open there (the AAD of row 84): swapping the stored bytes of fragments 1 and 2 plays neither', async () => {
    const media = await build();
    media.actAs(INVESTIGATOR);
    const session = await sessionOf(media);
    const file = media.built.path(cameraFilePath('VIDEO-01'));
    const bytes = readFileSync(file);
    const first = Buffer.from(bytes.subarray(HEADER, HEADER + FRAGMENT));
    bytes.copy(bytes, HEADER, HEADER + FRAGMENT, HEADER + 2 * FRAGMENT);
    first.copy(bytes, HEADER + FRAGMENT);
    (await import('node:fs')).writeFileSync(file, bytes);
    for (const start of [HEADER, HEADER + FRAGMENT]) {
      const response = await media.fetch(session.url, `bytes=${start}-${start + 9}`);
      expect([response.statusCode, errorOf(response).details?.['reason']]).toEqual([409, 'FRAGMENT_NOT_AUTHENTIC']);
    }
    expect((await media.fetch(session.url, `bytes=${HEADER + 2 * FRAGMENT}-${HEADER + 2 * FRAGMENT + 9}`)).statusCode).toBe(206);
  });
});
