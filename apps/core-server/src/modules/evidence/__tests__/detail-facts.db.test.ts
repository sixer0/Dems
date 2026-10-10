// Operation 40 and the replicated item against PostgreSQL (task 3 wave H, driver C1; gate findings
// G94-01 BLOCKER, G94-04, G94-05 / G81-07 access, G94-06; decision D200).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it, the evidence module mounted by `app.ts`, real sign-in sessions on the web console. The answer
// is read THROUGH THE ROUTE (`GET /api/v1/evidence/{id}`): nothing of it is a stubbed value.
//
// THE SEALED TEST PACKAGE is row 85's builder with the product cipher (the form of
// `media-stream.db.test.ts`): its session key lives in a throw-away credential store, its manifest
// holds THREE audio-source intervals, and the evidence item is a copy of a seeded item's row with
// the facts of a real sealed package (`integrity_source = REAL`, `manifest_version = 2`, the digest
// of the built manifest, the investigator who holds the case).
//
// Three kinds of item answer three different media states (the contract-level case), a non-holder
// reads `access.play: false` WITHOUT a denial row, and one opening of playback is ONE audit row.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCoreApiResponse } from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { WEB_ORIGIN, signInOnWeb, type Headers } from '../../../../test/support/identity';
import { coreCredentialStore, createFragmentSealer } from '../../../credential-store';
import { evidenceFacts } from '../../../evidence-facts';
import { coreFragmentOpener } from '../../../evidence-verify';
import { buildPackage, removeScratch, type BuiltPackage } from '../../../evidence-verify/__tests__/support';
import { mediaSessionMacOf, mediaStream } from '../../../media-stream';
import { noticesApp, type NoticesApp } from '../../capture-inputs/__tests__/support';

const db = useTestDatabase({ template: 'seed' });
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

/** A product-sealed item with its package present. */
const SEALED = { evidenceId: 'EV-20261010-0911', sessionId: 'SES-20261010-0911' } as const;
/** A product-sealed item whose package folder is gone (quarantined / removed). */
const GONE = { evidenceId: 'EV-20261010-0912', sessionId: 'SES-20261010-0912' } as const;

let server: NoticesApp;
let built: BuiltPackage;
let storeDir = '';
let demoEvidenceId = '';
const cookies: Record<'INVESTIGATOR' | 'SUPERVISOR' | 'TECHNICIAN', Headers> = { INVESTIGATOR: {}, SUPERVISOR: {}, TECHNICIAN: {} };

async function insertCopy(owner: Pool, table: string, row: Record<string, unknown>): Promise<void> {
  const columns = Object.keys(row);
  const values = columns.map((column) => {
    const value = row[column];
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
  });
  await owner.query(`INSERT INTO public.${table} (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`, values);
}

interface Detail {
  evidence: Record<string, unknown> & { signature: Record<string, unknown> };
  media: { source: string; packageSuffix: string | null; fileIds?: string[]; reason?: string };
  access?: { play: boolean; readTranscript: boolean; export: boolean };
  exports?: unknown[];
}
const detail = (who: Headers, evidenceId: string): Promise<LightMyRequestResponse> => server.app.inject({ method: 'GET', url: `/api/v1/evidence/${evidenceId}`, headers: who });
const bodyOf = async (who: Headers, evidenceId: string): Promise<Detail> => {
  const response = await detail(who, evidenceId);
  expect(response.statusCode).toBe(200);
  const body = response.json() as Detail;
  expect(validateCoreApiResponse('getEvidence', 200, body)).toEqual({ ok: true });
  return body;
};

beforeAll(async () => {
  server = await noticesApp(db);
  const { app, owner } = server;

  storeDir = mkdtempSync(join(tmpdir(), 'dems-wave-h-c1-'));
  const host = { stages: {}, config: { dataDir: storeDir } };
  const opened = coreCredentialStore(host);
  if (opened.status !== 'READY') throw new Error(`the throw-away credential store is ${opened.status}`);
  const key = opened.store.sessionKeys.create(SEALED.sessionId);
  const sealer = createFragmentSealer(key);
  built = await buildPackage({
    evidenceId: SEALED.evidenceId,
    sessionId: SEALED.sessionId,
    sealer: (position, plaintext) => sealer.seal(position, plaintext),
    // THREE intervals, as gate 94's session had them (two switches).
    beforeSeal: (input) => {
      const [first, second] = input.audio.sourceIntervals;
      if (first === undefined || second === undefined) throw new Error('the builder made fewer than two intervals');
      (input.audio as unknown as { sourceIntervals: unknown[] }).sourceIntervals = [first, second, { ...first, seq: 3, fromMs: second.toMs ?? 0, toMs: (second.toMs ?? 0) + 500, reason: 'MANUAL', switchedBy: second.switchedBy }];
    },
  });
  opened.store.sessionKeys.release(key);
  const packageDirOf = (sessionId: string): string | null => (sessionId === SEALED.sessionId ? built.dir : sessionId === GONE.sessionId ? join(storeDir, 'no-such-package') : null);
  mediaStream(app).replaceForTest({ packageDirOf, opener: coreFragmentOpener(host), mac: () => mediaSessionMacOf(host) });
  evidenceFacts(app).replaceForTest({ packageDirOf: (sessionId) => packageDirOf(sessionId) ?? join(storeDir, 'no-such-package') });

  const seeded = (await owner.query<Record<string, unknown>>('SELECT * FROM public.evidence_items ORDER BY id LIMIT 1')).rows[0];
  if (seeded === undefined) throw new Error('the seed holds no evidence item');
  const history = (await owner.query<Record<string, unknown>>('SELECT * FROM public.session_history WHERE id = $1', [seeded['session_id']])).rows[0];
  for (const item of [SEALED, GONE]) {
    if (history !== undefined) await insertCopy(owner, 'session_history', { ...history, id: item.sessionId });
    await insertCopy(owner, 'evidence_items', {
      ...seeded,
      id: item.evidenceId,
      session_id: item.sessionId,
      investigator_id: server.operatorId('INVESTIGATOR'),
      integrity_source: 'REAL',
      manifest_version: 2,
      manifest_hash: built.manifest.manifestSha256,
    });
  }

  cookies.INVESTIGATOR = (await signInOnWeb(server.identity, 'budi.santoso')).cookie;
  cookies.SUPERVISOR = (await signInOnWeb(server.identity, 'andi.pratama')).cookie;
  cookies.TECHNICIAN = (await signInOnWeb(server.identity, 'rina.wijaya')).cookie;
  await app.pipeline.drain();

  // A demonstration item of the seed that a bundled package belongs to.
  const listed = (await app.inject({ method: 'GET', url: '/api/v1/evidence?limit=200', headers: cookies.SUPERVISOR })).json() as { items: { id: string }[] };
  for (const item of listed.items) {
    if (item.id === SEALED.evidenceId || item.id === GONE.evidenceId) continue;
    const body = (await detail(cookies.SUPERVISOR, item.id)).json() as Detail;
    if (body.media.source === 'DEMO_PACKAGE') {
      demoEvidenceId = item.id;
      break;
    }
  }
});

afterAll(() => {
  removeScratch();
  if (storeDir !== '') rmSync(storeDir, { recursive: true, force: true });
});

describe('G94-01: operation 40 states the media source truthfully for every kind of item', () => {
  it('a product-sealed v2 item with its package present answers LIVE_STREAM with the camera files it really has', async () => {
    const body = await bodyOf(cookies.INVESTIGATOR, SEALED.evidenceId);
    expect(body.media).toEqual({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: built.manifest.tracks.map((track) => track.trackId) });
    expect(body.media.fileIds).toEqual(['VIDEO-01', 'VIDEO-02']);
    // What it says plays, operation 88 opens: each file it names gets a session.
    for (const fileId of body.media.fileIds ?? []) {
      const opened = await server.app.inject({ method: 'POST', url: `/api/v1/evidence/${SEALED.evidenceId}/media-sessions`, headers: { ...cookies.INVESTIGATOR, origin: WEB_ORIGIN, 'content-type': 'application/json' }, payload: JSON.stringify({ fileId }) });
      expect(opened.statusCode).toBe(201);
    }
  });

  it('a demonstration item of the seed answers DEMO_PACKAGE with its suffix, and no files', async () => {
    expect(demoEvidenceId).not.toBe('');
    const body = await bodyOf(cookies.SUPERVISOR, demoEvidenceId);
    expect(body.media.source).toBe('DEMO_PACKAGE');
    expect(body.media.packageSuffix).toMatch(/^\d{4}$/);
    expect(body.media.fileIds).toBeUndefined();
    expect(body.media.reason).toBeUndefined();
  });

  it('a product-sealed item whose package is gone answers NONE with the reason, and operation 88 refuses it by the same code', async () => {
    const body = await bodyOf(cookies.INVESTIGATOR, GONE.evidenceId);
    expect(body.media).toEqual({ source: 'NONE', packageSuffix: null, reason: 'PACKAGE_MISSING' });
    expect(body.evidence['sealedPackage']).toBe('NOT_READABLE');
    expect(body.evidence['audioSourceIntervals']).toBeUndefined();
    const refused = await server.app.inject({ method: 'POST', url: `/api/v1/evidence/${GONE.evidenceId}/media-sessions`, headers: { ...cookies.INVESTIGATOR, origin: WEB_ORIGIN } });
    expect([refused.statusCode, (refused.json() as { error: { details: { reason: string } } }).error.details.reason]).toEqual([409, 'PACKAGE_MISSING']);
  });

  it('CONTRACT: the three kinds of item answer three different states, each a valid `getEvidence` answer', async () => {
    const sources = [
      (await bodyOf(cookies.SUPERVISOR, SEALED.evidenceId)).media.source,
      (await bodyOf(cookies.SUPERVISOR, demoEvidenceId)).media.source,
      (await bodyOf(cookies.SUPERVISOR, GONE.evidenceId)).media.source,
    ];
    expect(sources).toEqual(['LIVE_STREAM', 'DEMO_PACKAGE', 'NONE']);
    expect(new Set(sources).size).toBe(3);
  });
});

describe('G94-04 and the item members a client must not guess', () => {
  it('the item carries the THREE intervals of the sealed manifest (seq from 1, the source class per interval) and its other sealed facts', async () => {
    const { evidence } = await bodyOf(cookies.INVESTIGATOR, SEALED.evidenceId);
    const sealed = built.manifest.audio.sourceIntervals;
    expect(sealed).toHaveLength(3);
    expect(evidence['audioSourceIntervals']).toEqual(sealed.map((interval) => ({ seq: interval.seq, inputId: interval.micDeviceId, role: interval.role, fromMs: interval.fromMs, toMs: interval.toMs, reason: interval.reason, sourceClass: interval.sourceClass })));
    expect((evidence['audioSourceIntervals'] as { seq: number }[]).map((interval) => interval.seq)).toEqual([1, 2, 3]);
    expect(evidence['manifestVersion']).toBe(2);
    expect(evidence['integritySource']).toBe('REAL');
    expect(evidence['sealedPackage']).toBe('PRESENT');
    expect(evidence['interrupted']).toBe(built.manifest.timeline.interrupted);
    // The camera files of the SEALED manifest: never a v1 row (no AUDIO-01 / AUDIO-02 file), the sealed hashes.
    expect(evidence['files']).toEqual(
      built.manifest.tracks.map((track) => ({ trackId: track.trackId, fileName: `fragments/${track.trackId}.mp4`, sizeBytes: track.bytes, sha256: track.sha256, fragmentCount: track.fragmentCount, sha256Plain: track.sha256Plain, fragmentChainHead: track.fragmentChainHead })),
    );
    // Stated before any verification run: true or false from the certificate the sealed manifest names - never absent for a readable package.
    expect(typeof evidence.signature['developmentKey']).toBe('boolean');
    // Fix wave K, driver S2 (G81b-06; D160): the model of the sealed transcript is ON THE ITEM, from the signed manifest.
    const model = built.manifest.transcript.model;
    expect(evidence['transcriptModel']).toMatchObject({ name: model.name, version: model.version, quantisation: model.quantisation, modelSha256: model.modelSha256, reportedByServer: false });
    expect((evidence['transcriptModel'] as { report: string }).report).toContain(String(model.name));
    // CONTROL: an item of the demonstration data states no model.
    expect((await bodyOf(cookies.SUPERVISOR, demoEvidenceId)).evidence['transcriptModel']).toBeUndefined();
  });

  it('REHYDRATE: an item the engine reads back gets the facts on the REPLICATED item (no column holds them), and operation 39 answers them', async () => {
    await server.engine.stop();
    await server.engine.reload();
    await server.engine.idle();
    const before = server.app.engine.slice('evidence').find((item) => item.id === SEALED.evidenceId) as Record<string, unknown> | undefined;
    expect(before).toBeDefined();
    expect(before?.['audioSourceIntervals']).toBeUndefined(); // control: the rows hold none
    expect(await evidenceFacts(server.app).publish()).toBeGreaterThanOrEqual(2);
    await server.app.pipeline.drain();
    const after = server.app.engine.slice('evidence').find((item) => item.id === SEALED.evidenceId) as Record<string, unknown> | undefined;
    expect((after?.['audioSourceIntervals'] as unknown[] | undefined)?.length).toBe(3);
    expect(after?.['sealedPackage']).toBe('PRESENT');
    expect((after?.['transcriptModel'] as { name?: string } | undefined)?.name).toBe(built.manifest.transcript.model.name); // fix wave K (G81b-06): on the replicated item too
    const gone = server.app.engine.slice('evidence').find((item) => item.id === GONE.evidenceId) as Record<string, unknown> | undefined;
    expect(gone?.['sealedPackage']).toBe('NOT_READABLE');
    // Nothing stored was touched: the item's row is as it was (a sealed column cannot be written by the runtime role at all).
    const listed = (await server.app.inject({ method: 'GET', url: '/api/v1/evidence?limit=200', headers: cookies.SUPERVISOR })).json() as { items: Record<string, unknown>[] };
    expect((listed.items.find((item) => item['id'] === SEALED.evidenceId)?.['audioSourceIntervals'] as unknown[] | undefined)?.length).toBe(3);
    expect((listed.items.find((item) => item['id'] === SEALED.evidenceId)?.['transcriptModel'] as { reportedByServer?: boolean } | undefined)?.reportedByServer).toBe(false);
    // A second publication reads only what is still unreadable, and changes nothing: the engine's revision does not move.
    const revision = server.app.engine.revision;
    expect(await evidenceFacts(server.app).publish()).toBeGreaterThanOrEqual(1);
    await server.app.pipeline.drain();
    expect(server.app.engine.revision).toBe(revision);
  });
});

describe('G81-07 / G94-06: a page view asks nothing it would be refused, and a playback is ONE row', () => {
  it('a non-holder reads access.play false on operation 40 - and that VIEW writes no ACCESS_DENIED row', async () => {
    const before = await server.trailLength();
    const body = await bodyOf(cookies.TECHNICIAN, SEALED.evidenceId);
    expect(body.access).toEqual({ play: false, readTranscript: false, export: false });
    expect(body.exports).toBeUndefined();
    await server.app.pipeline.drain();
    expect(await server.trailLength()).toBe(before);
    // The holder and the supervisor may play.
    expect((await bodyOf(cookies.INVESTIGATOR, SEALED.evidenceId)).access?.play).toBe(true);
    expect((await bodyOf(cookies.SUPERVISOR, SEALED.evidenceId)).access).toMatchObject({ play: true, readTranscript: true });
    // NEGATIVE CONTROL: the denial row is written when the operator really ASKS to play.
    const refused = await server.app.inject({ method: 'POST', url: `/api/v1/evidence/${SEALED.evidenceId}/media-sessions`, headers: { ...cookies.TECHNICIAN, origin: WEB_ORIGIN } });
    expect(refused.statusCode).toBe(403);
    await server.app.pipeline.drain();
    expect((await server.since(before)).map((row) => row.type)).toEqual(['ACCESS_DENIED']);
  });

  it('one opening of playback and forty range requests are ONE audit row: the issue of the media session', async () => {
    const before = await server.trailLength();
    const opened = await server.app.inject({ method: 'POST', url: `/api/v1/evidence/${SEALED.evidenceId}/media-sessions`, headers: { ...cookies.INVESTIGATOR, origin: WEB_ORIGIN } });
    expect(opened.statusCode).toBe(201);
    const path = new URL((opened.json() as { url: string }).url).pathname;
    for (let index = 0; index < 40; index += 1) {
      const part = await server.app.inject({ method: 'GET', url: path, headers: { ...cookies.INVESTIGATOR, range: `bytes=${index * 10}-${index * 10 + 99}` } });
      expect(part.statusCode).toBe(206);
    }
    await server.app.pipeline.drain();
    const rows = await server.since(before);
    expect(rows.map((row) => [row.type, row.actorId, row.evidenceId, row.details['fileId'], row.details['bytesServed']])).toEqual([['EVIDENCE_MEDIA_SERVED', server.operatorId('INVESTIGATOR'), SEALED.evidenceId, 'VIDEO-01', 0]]);
  });
});
