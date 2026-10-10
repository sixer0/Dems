// Reconcile pass R, decision D205: a demonstration item the SEED SEALED on this Core is a sealed
// package of this Core - operation 40 answers it as one and operation 88 / the media route open it.
//
// The real app factory on a clone of the seed, as `dems_app`, every stage as the server has it; the
// answers are read THROUGH THE ROUTES. THE PACKAGES are the seed generator's own
// (`sealDemoPackages`, the product pipeline, the development signing key, a throw-away Core data
// directory - `sealing-host/__tests__/demo-seed-support.ts`): one clean item and the tamper demo
// (evidence sequence 5: ONE byte of fragment 3 of VIDEO-02 altered after the seal). The camera
// bytes are the sealing tests' built fragments, handed over by a synthesiser double (no helper
// program runs). The item rows are copies of a seeded row with the facts the seed writes for such
// an item (DEMO_PACKAGE, version 2, development sources, the real Ed25519 signature).
//
// | Rule | Test |
// |------|------|
// | Operation 40: LIVE_STREAM with the item's own camera file IDs, `sealedPackage: PRESENT`, the development marks it truly has; never a bundled package | "operation 40" |
// | Operation 88 + the media route open it for ANY holder of EVIDENCE_VIEW (no case scope: it is no REAL evidence), and no ACCESS_DENIED row is written | "any EVIDENCE_VIEW holder" |
// | NEGATIVE CONTROL: REAL evidence keeps its case scope (SEC35-16) | "REAL evidence keeps" |
// | NEGATIVE CONTROL: a v1 demonstration item (no sealed package here) is still refused by operation 88 and still answers its bundled package | "a v1 demonstration item" |
// | The tampered item plays up to the altered fragment; a range that starts in it is refused 409 FRAGMENT_NOT_AUTHENTIC (VIDEO-02, seq 3) and not one byte of it is sent; VIDEO-01 plays whole | "the tamper demo" |
import { copyFileSync } from 'node:fs';
import { validateCoreApiResponse } from '@dems/shared/api';
import { DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { WEB_ORIGIN, signInOnWeb, type Headers } from '../../../../test/support/identity';
import { coreCredentialStore } from '../../../credential-store';
import { evidenceFacts } from '../../../evidence-facts';
import { coreFragmentOpener } from '../../../evidence-verify';
import { mediaSessionMacOf, mediaStream } from '../../../media-stream';
import { removePackages } from '../../../sealing/__tests__/package-support';
import { recordSession, removeRecordings } from '../../../sealing/__tests__/pipeline-support';
import { demoCore, demoItem, removeDemoCores, type DemoCore } from '../../../sealing-host/__tests__/demo-seed-support';
import { sealDemoPackages, type DemoSealItem, type DemoSealOptions, type DemoSealedPackage } from '../../../sealing-host/demo-seed';
import { noticesApp, type NoticesApp } from '../../capture-inputs/__tests__/support';

const db = useTestDatabase({ template: 'seed' });
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

/** IDs no seeded item has; the second is the tamper demo's by its sequence (5). */
const withIds = (item: DemoSealItem, suffix: string): DemoSealItem => ({ ...item, evidenceId: `EV-20260102-${suffix}`, sessionId: `SES-20260102-${suffix}`, caseNumber: `LP/2026/0102-${suffix}` });
const CLEAN = withIds(demoItem(4), '0004');
const TAMPERED = withIds(demoItem(5), '0005');
/** A REAL item (negative control of the scope): held by the investigator. */
const REAL = { evidenceId: 'EV-20260102-0931', sessionId: 'SES-20260102-0931' } as const;
const FRAGMENTS = 4;

let server: NoticesApp;
let core: DemoCore;
let clean: DemoSealedPackage;
let tampered: DemoSealedPackage;
let v1DemoId = '';
const cookies: Record<'INVESTIGATOR' | 'SUPERVISOR' | 'TECHNICIAN', Headers> = { INVESTIGATOR: {}, SUPERVISOR: {}, TECHNICIAN: {} };

/** The synthesiser double of `demo-seed.test.ts`: a camera file of whole fragments in the worker's box shapes. */
function builtSynthesiser(): DemoSealOptions['synthesise'] {
  let recording = recordSession({ fragments: FRAGMENTS });
  return async (request) => {
    if (request.trackId === 'VIDEO-01') recording = recordSession({ fragments: FRAGMENTS });
    copyFileSync(recording.recordingFile(request.trackId), request.outPath);
  };
}

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
}
const get = (who: Headers, url: string, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> => server.app.inject({ method: 'GET', url, headers: { ...who, ...headers } });
const detailOf = async (who: Headers, evidenceId: string): Promise<Detail> => {
  const response = await get(who, `/api/v1/evidence/${evidenceId}`);
  expect(response.statusCode).toBe(200);
  const body = response.json() as Detail;
  expect(validateCoreApiResponse('getEvidence', 200, body)).toEqual({ ok: true });
  return body;
};
const open = (who: Headers, evidenceId: string, fileId: string): Promise<LightMyRequestResponse> =>
  server.app.inject({ method: 'POST', url: `/api/v1/evidence/${evidenceId}/media-sessions`, headers: { ...who, origin: WEB_ORIGIN, 'content-type': 'application/json' }, payload: JSON.stringify({ fileId }) });
const pathOf = (response: LightMyRequestResponse): string => new URL((response.json() as { url: string }).url).pathname;

beforeAll(async () => {
  server = await noticesApp(db);
  const { app, owner } = server;

  core = demoCore('wave-h-r');
  const sealed = await sealDemoPackages({ ...core.options(), synthesise: builtSynthesiser() }, [CLEAN, TAMPERED]);
  if (sealed[0] === undefined || sealed[1] === undefined) throw new Error('two items were asked');
  [clean, tampered] = [sealed[0], sealed[1]];
  expect([clean.tampered, tampered.tampered]).toEqual([null, { trackId: DEMO_TAMPERED_FRAGMENT_TRACK, seq: DEMO_TAMPERED_FRAGMENT_SEQ }]);

  // The Core's own opener and media-session key, over the data directory the generator sealed into.
  const host = { stages: {}, config: { dataDir: core.dataDir } };
  if (coreCredentialStore(host).status !== 'READY') throw new Error('the throw-away credential store is not ready');
  const dirs = new Map([clean, tampered].map((entry) => [entry.sessionId, core.packageDir(entry.sessionId)] as const));
  mediaStream(app).replaceForTest({ packageDirOf: (sessionId) => dirs.get(sessionId) ?? null, opener: coreFragmentOpener(host), mac: () => mediaSessionMacOf(host) });
  evidenceFacts(app).replaceForTest({ packageDirOf: (sessionId) => dirs.get(sessionId) ?? `${core.dataDir}/no-such-package` });

  const seeded = (await owner.query<Record<string, unknown>>('SELECT * FROM public.evidence_items ORDER BY id LIMIT 1')).rows[0];
  if (seeded === undefined) throw new Error('the seed holds no evidence item');
  const history = (await owner.query<Record<string, unknown>>('SELECT * FROM public.session_history WHERE id = $1', [seeded['session_id']])).rows[0];
  const investigator = server.operatorId('INVESTIGATOR');
  for (const entry of [clean, tampered]) {
    if (history !== undefined) await insertCopy(owner, 'session_history', { ...history, id: entry.sessionId });
    // The facts the seed writes for an item it sealed (`db/mapping/rows.ts signatureFromRow`: all of them, or the row is refused).
    await insertCopy(owner, 'evidence_items', {
      ...seeded,
      id: entry.evidenceId,
      session_id: entry.sessionId,
      investigator_id: investigator,
      integrity_source: 'DEMO_PACKAGE',
      manifest_version: 2,
      development_sources: true,
      manifest_hash: entry.seal.manifestSha256,
      signature_value: entry.seal.signature.value,
      signature_key_id: entry.seal.signature.keyId,
      signature_algorithm: 'Ed25519',
      signature_simulated: false,
    });
  }
  if (history !== undefined) await insertCopy(owner, 'session_history', { ...history, id: REAL.sessionId });
  await insertCopy(owner, 'evidence_items', { ...seeded, id: REAL.evidenceId, session_id: REAL.sessionId, investigator_id: investigator, integrity_source: 'REAL', manifest_version: 2, manifest_hash: clean.seal.manifestSha256 });

  cookies.INVESTIGATOR = (await signInOnWeb(server.identity, 'budi.santoso')).cookie;
  cookies.SUPERVISOR = (await signInOnWeb(server.identity, 'andi.pratama')).cookie;
  cookies.TECHNICIAN = (await signInOnWeb(server.identity, 'rina.wijaya')).cookie;
  await app.pipeline.drain();

  const listed = (await get(cookies.SUPERVISOR, '/api/v1/evidence?limit=200')).json() as { items: { id: string }[] };
  for (const item of listed.items) {
    if ([clean.evidenceId, tampered.evidenceId, REAL.evidenceId].includes(item.id)) continue;
    if (((await get(cookies.SUPERVISOR, `/api/v1/evidence/${item.id}`)).json() as Detail).media.source === 'DEMO_PACKAGE') {
      v1DemoId = item.id;
      break;
    }
  }
});

afterAll(() => {
  removeDemoCores();
  removeRecordings();
  removePackages();
});

describe('D205: a seed-sealed demonstration item is a package sealed on this Core', () => {
  it('operation 40 answers the streamable source with its own camera file IDs and the marks it truly has - never a bundled package', async () => {
    for (const entry of [clean, tampered]) {
      const body = await detailOf(cookies.TECHNICIAN, entry.evidenceId);
      expect(body.media).toEqual({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
      expect(body.evidence).toMatchObject({ integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, sealedPackage: 'PRESENT', interrupted: false });
      expect(body.evidence.signature).toMatchObject({ algorithm: 'Ed25519', simulated: false, developmentKey: true });
      expect((body.evidence['files'] as { trackId: string }[]).map((file) => file.trackId)).toEqual(['VIDEO-01', 'VIDEO-02']);
      // The technician does not hold the case and is no supervisor: for a demonstration item that does not matter.
      expect(body.access).toMatchObject({ play: true, readTranscript: true });
    }
  });

  it('any EVIDENCE_VIEW holder opens and reads both camera files of the clean item; no ACCESS_DENIED row is written', async () => {
    await server.app.pipeline.drain();
    const before = await server.trailLength();
    for (const fileId of ['VIDEO-01', 'VIDEO-02']) {
      const session = await open(cookies.TECHNICIAN, clean.evidenceId, fileId);
      expect([fileId, session.statusCode]).toEqual([fileId, 201]);
      const whole = await get(cookies.TECHNICIAN, pathOf(session));
      expect([whole.statusCode, whole.headers['content-type']]).toEqual([200, 'video/mp4']);
      expect(whole.rawPayload.byteLength).toBe(Number(whole.headers['content-length']));
      expect(whole.rawPayload.byteLength).toBeGreaterThan(1_000);
      const part = await get(cookies.TECHNICIAN, pathOf(session), { range: 'bytes=0-99' });
      expect([part.statusCode, part.rawPayload.byteLength]).toEqual([206, 100]);
    }
    await server.app.pipeline.drain();
    // One row per media session that was opened, and nothing else: no refusal was written.
    expect((await server.since(before)).map((row) => row.type)).toEqual(['EVIDENCE_MEDIA_SERVED', 'EVIDENCE_MEDIA_SERVED']);
  });

  it('NEGATIVE CONTROL: REAL evidence keeps its case scope - the same technician is refused 403 EVIDENCE_CASE_SCOPE, and operation 40 told him so first', async () => {
    expect((await detailOf(cookies.TECHNICIAN, REAL.evidenceId)).access).toMatchObject({ play: false, readTranscript: false });
    const refused = await open(cookies.TECHNICIAN, REAL.evidenceId, 'VIDEO-01');
    expect(refused.statusCode).toBe(403);
    expect((refused.json() as { error: { details: { reason: string } } }).error.details.reason).toBe('EVIDENCE_CASE_SCOPE');
  });

  it('NEGATIVE CONTROL: a v1 demonstration item has no sealed package here - operation 40 names its bundled package, operation 88 refuses 409 NOT_A_SEALED_PACKAGE', async () => {
    expect(v1DemoId).not.toBe('');
    const body = await detailOf(cookies.SUPERVISOR, v1DemoId);
    expect(body.media.source).toBe('DEMO_PACKAGE');
    expect(body.evidence['sealedPackage']).toBeUndefined();
    const refused = await open(cookies.SUPERVISOR, v1DemoId, 'VIDEO-01');
    expect(refused.statusCode).toBe(409);
    expect((refused.json() as { error: { code: string; details: { reason: string } } }).error).toMatchObject({ code: 'MEDIA_NOT_AVAILABLE', details: { reason: 'NOT_A_SEALED_PACKAGE' } });
  });

  it('the tamper demo: VIDEO-01 plays whole; VIDEO-02 plays up to the altered fragment and a range that starts in it is refused 409 FRAGMENT_NOT_AUTHENTIC (seq 3) without one byte', async () => {
    const first = await open(cookies.TECHNICIAN, tampered.evidenceId, 'VIDEO-01');
    expect(first.statusCode).toBe(201);
    const whole = await get(cookies.TECHNICIAN, pathOf(first));
    expect([whole.statusCode, whole.rawPayload.byteLength]).toEqual([200, Number(whole.headers['content-length'])]);

    const second = await open(cookies.TECHNICIAN, tampered.evidenceId, DEMO_TAMPERED_FRAGMENT_TRACK);
    expect(second.statusCode).toBe(201);
    const path = pathOf(second);
    const head = await get(cookies.TECHNICIAN, path, { range: 'bytes=0-0' });
    expect(head.statusCode).toBe(206);
    const size = Number(String(head.headers['content-range']).split('/')[1]);
    expect(size).toBeGreaterThan(1_000);

    // One byte at 64 places across the file: every answer is either the byte or the integrity refusal.
    const refusals: { at: number; seq: unknown; fileId: unknown; reason: unknown }[] = [];
    let served = 0;
    for (let step = 0; step < 64; step += 1) {
      const at = Math.floor((size * step) / 64);
      const answer = await get(cookies.TECHNICIAN, path, { range: `bytes=${at}-${at}` });
      if (answer.statusCode === 206) {
        expect(answer.rawPayload.byteLength).toBe(1);
        served += 1;
        continue;
      }
      expect(answer.statusCode).toBe(409);
      const error = (answer.json() as { error: { code: string; details: { reason: string; fileId: string; seq: number } } }).error;
      expect(error.code).toBe('MEDIA_NOT_AVAILABLE');
      refusals.push({ at, seq: error.details.seq, fileId: error.details.fileId, reason: error.details.reason });
    }
    // The refusals are ONE contiguous run - the altered fragment, named - and the bytes before and after it are served.
    expect(refusals.length).toBeGreaterThan(0);
    expect(served).toBeGreaterThan(0);
    expect(new Set(refusals.map((refusal) => `${String(refusal.reason)}|${String(refusal.fileId)}|${String(refusal.seq)}`))).toEqual(new Set([`FRAGMENT_NOT_AUTHENTIC|${DEMO_TAMPERED_FRAGMENT_TRACK}|${DEMO_TAMPERED_FRAGMENT_SEQ}`]));
    expect(refusals[0]?.at).toBeGreaterThan(0);
    // The page still says the item plays: the manifest of record is intact, the refusal is the fragment's.
    expect((await detailOf(cookies.TECHNICIAN, tampered.evidenceId)).media.source).toBe('LIVE_STREAM');
  });
});
