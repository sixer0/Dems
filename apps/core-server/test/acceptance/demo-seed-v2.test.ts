// Integration pass E3 item 6: THE v2 DEMO PACKAGES AT SEED TIME, end to end on a throw-away
// database and a scratch Core data directory (evidence package spec F.2 - F.4; row 82c's four
// requests; decisions D155, D167).
//
//   seed     `db:seed` (the function its entry file calls) with the demo-package port of a
//            development-capture Core: the REAL helper program writes the generated picture (the
//            argument table names generated inputs only - no device), the PRODUCT pipeline seals two
//            packages with the development key into that Core's store, and the rows are written
//            from the seals;
//   boot     the real app in capture operation REAL_DEVELOPMENT on that database and data directory;
//   op 41    the clean item through the REAL verifier: 15 of 15, `sources.development: true`, the
//            development-key fact; EV 0005: TAMPERED, naming exactly (VIDEO-02, 3);
//   reset    `db:reset` is PERMITTED (the two folders are exempt by the development rules), removes
//            them, and the reseed seals them again - other digests, the same verdicts;
//   control  without the helper program the seed says so by name and writes the dataset WITHOUT
//            the v2 demo items: thirteen items in their v1 shape, no folder, no half item.
//
// WHAT IS REAL: PostgreSQL (as `dems_owner` for the commands, `dems_app` for the Core), the seed and
// the reset routine, the helper program `.data/helpers/ffmpeg`, the pipeline, the cipher over a
// session key of the scratch credential store, the development signing key, the verifier, the app.
// WHAT IS NOT: a capture worker (a stand-in that says HELLO and is never asked to record), a camera,
// a microphone. No local device is selected, pre-checked or started (D163).
//
// The helper-dependent cases are skipped when the helper copy is absent (`npm run capture:dev-setup`);
// the control case always runs.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageFolderName } from '@dems/shared/evidence-package';
import { DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { realBootFixture } from '../../src/capture/boot/__tests__/support';
import { captureFenceControl } from '../../src/capture/fence';
import type { CommandIo } from '../../src/db/commands/cli';
import { runReset } from '../../src/db/reset/cli';
import { demoPackagesOfEnvironment, runSeedHelper, type SeedDemoPackages } from '../../src/db/seed';
import { runSeed } from '../../src/db/seed/cli';
import { provisionDevelopmentSigningKey } from '../../src/sealing';
import { createDemoPackageSeeder } from '../../src/sealing-host';
import { useTestDatabase } from '../helpers/db';
import { captureLog, unitTestConfig } from '../support/config';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../support/identity';
import { PATIENT_MS, dropOwn, maintenancePool, quiet } from '../support/reset';

vi.setConfig({ testTimeout: 300_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'schema', slug: 'e3demo' });

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const HELPER = join(REPOSITORY, '.data/helpers/ffmpeg');
const TAMPER_ITEM = /^EV-[0-9]{8}-0005$/;

/** The scratch data directory of the Core: below the git-ignored `.data`, removed after the file. */
const core = realBootFixture('e3demo');
let maintenance: Pool;
beforeAll(() => {
  maintenance = maintenancePool(db.run.dataDir);
});
afterAll(async () => {
  // The reset rebuilt the database beside the old one: a plain removal of this file's own names, before the helper's.
  await db.database.closeResources();
  for (const name of [`${db.name}_next`, `${db.name}_prev`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
  core.remove();
});

function capture(): { io: CommandIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

/** The port of a development-capture Core over the scratch data directory, with the REAL helper program. */
const portAt = (now: number): SeedDemoPackages =>
  createDemoPackageSeeder({ dataDir: core.dataDir, mediaStoreDir: core.mediaStoreDir }, { synthesise: ({ args }) => runSeedHelper(HELPER, args), now: () => now, log: { file: null, append: () => {} } });

interface V2Row {
  id: string;
  session_id: string;
  integrity_source: string;
  manifest_version: number;
  development_sources: boolean | null;
  signature_simulated: boolean;
  signature_algorithm: string;
  tampered: boolean;
  tampered_track_id: string | null;
  manifest_hash: string;
}
const itemRows = async (): Promise<V2Row[]> =>
  (
    await db
      .ownerPool()
      .query<V2Row>('SELECT id, session_id, integrity_source, manifest_version, development_sources, signature_simulated, signature_algorithm, tampered, tampered_track_id, manifest_hash FROM public.evidence_items ORDER BY id')
  ).rows;
const packageFolders = (): string[] => (existsSync(core.mediaStoreDir) ? readdirSync(core.mediaStoreDir).filter((name) => name.startsWith('SESSION-')).sort() : []);

interface VerifyBody {
  ok: boolean;
  overall: string;
  checks: { id: string; status: string }[];
  fragments: { trackId: string; seq: number }[];
  failedFragmentCount: number;
  sources: { development: boolean; code: string };
  signature?: { developmentKey: boolean };
}

/** The real app in REAL_DEVELOPMENT on the seeded database and the scratch data directory. */
async function bootCore(): Promise<{ app: FastifyInstance; verify(evidenceId: string): Promise<VerifyBody>; errorLines(): Record<string, unknown>[] }> {
  // A real-capture boot resolves the stored STT selection first: off, as in the other real-mode fixtures.
  await db.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({
      database: db.runtime,
      dataDir: core.dataDir,
      logLevel: 'info',
      captureMode: 'real',
      demoControls: false,
      captureDevSources: true,
      // A root-owned program that passes the path rule and is never asked to capture (row 136's fixture).
      captureHelperFfmpegPath: '/bin/echo',
      captureWorkerPath: core.worker('capture-worker', 'capture-worker/0.3.0'),
    }),
    logStream: log.stream,
  });
  await app.ready();
  await app.readiness.boot();
  expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');
  const signedIn = await webSignIn(app, 'andi.pratama');
  expect(signedIn.statusCode).toBe(200);
  const token = cookieValue(signedIn, app.config.sessionCookieName);
  if (token === null) throw new Error('the web sign-in set no session cookie');
  const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
  return {
    app,
    async verify(evidenceId) {
      const answer = await app.inject({ method: 'POST', url: `/api/v1/evidence/${evidenceId}/verify`, headers, payload: {} });
      expect(answer.statusCode, answer.body).toBe(200);
      return answer.json() as VerifyBody;
    },
    errorLines: () => log.lines().filter((line) => Number(line['level']) >= 50),
  };
}

/** Both verdicts of a seeded Core, through operation 41. */
async function expectDemoVerdicts(rows: readonly V2Row[]): Promise<void> {
  const clean = rows.find((row) => row.manifest_version === 2 && !row.tampered);
  const tampered = rows.find((row) => row.manifest_version === 2 && row.tampered);
  if (clean === undefined || tampered === undefined) throw new Error('the seed wrote no v2 demo pair');
  const server = await bootCore();
  try {
    // The Core BOOTED on the rows (the mapping read them back) and its boot said no error.
    expect(server.errorLines()).toEqual([]);
    const state = server.app.engine.state().evidence;
    expect(state.find((item) => item.id === clean.id)).toMatchObject({ integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, signature: { algorithm: 'Ed25519', simulated: false } });

    // THE CLEAN ITEM, through the real verifier: every one of the 15 checks, development sources, the development key.
    const pass = await server.verify(clean.id);
    expect(pass.checks).toHaveLength(15);
    expect(pass.checks.filter((check) => check.status !== 'PASS')).toEqual([]);
    expect([pass.ok, pass.overall, pass.failedFragmentCount]).toEqual([true, 'PASS', 0]);
    expect(pass.sources).toMatchObject({ development: true, code: 'DEVELOPMENT' });
    expect(pass.signature).toEqual({ developmentKey: true });

    // EV 0005: TAMPERED, and the ONE fragment that did not verify is the scripted one.
    const fail = await server.verify(tampered.id);
    expect([fail.ok, fail.overall]).toEqual([false, 'TAMPERED']);
    expect(fail.fragments.map((fragment) => [fragment.trackId, fragment.seq])).toEqual([[DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_FRAGMENT_SEQ]]);
    expect(fail.failedFragmentCount).toBe(1);
    expect(fail.sources).toMatchObject({ development: true });
    expect(fail.signature).toEqual({ developmentKey: true });

    // CONTROL: a frozen v1 demo item is NOT the real verifier's - the hosted verify answers it (no 15 checks).
    const v1 = rows.find((row) => row.manifest_version === 1 && row.integrity_source === 'DEMO_PACKAGE' && !row.tampered);
    if (v1 === undefined) throw new Error('the dataset holds no v1 demo item');
    const hosted = await server.verify(v1.id);
    expect(hosted.checks ?? []).toEqual([]);
  } finally {
    await server.app.close();
  }
}

describe('CONTROL: without the helper program the seed says so by name and writes NO v2 demo item', () => {
  it('the port of an environment whose helper copy is absent answers SKIPPED naming the path; the dataset keeps thirteen v1 items and the store no folder', async () => {
    const target = await db.another({ template: 'schema', slug: 'e3demo_nohelper' });
    // The Core's own loader reads the runtime connection file of the data directory it is given: the run's.
    const absent = join(core.dataDir, 'helpers-absent', 'ffmpeg');
    const port = demoPackagesOfEnvironment({
      environment: { DEMS_CAPTURE_MODE: 'real', ['DEMS_CAPTURE_' + 'DEV_SOURCES']: '1', DEMS_CAPTURE_HELPER_FFMPEG: absent },
      dataDir: db.run.dataDir,
      now: () => Date.now(),
    });
    const { io, out, err } = capture();
    const code = await runSeed(['--database', target.name], { io, dataDir: db.run.dataDir, allowTestDatabase: true, demoPackages: port });
    expect([code, err]).toEqual([0, []]);
    const line = out.find((entry) => entry.includes('v2 demo packages'));
    // Fix F-M4 (question 5 of review row 69): the seed asks the boot's own path rule; its code for a path that names nothing is NOT_FOUND.
    expect(line).toContain('NOT generated (HELPER_NOT_FOUND)');
    expect(line).toContain(absent);
    expect(line).toContain('without the v2 demo items');
    const rows = (await target.ownerPool().query<{ manifest_version: number; signature_simulated: boolean }>('SELECT manifest_version, signature_simulated FROM public.evidence_items')).rows;
    expect(rows).toHaveLength(13);
    expect(rows.filter((row) => row.manifest_version !== 1 || row.signature_simulated !== true)).toEqual([]);
    expect((await target.ownerPool().query('SELECT 1 FROM public.session_capture_sources')).rows).toEqual([]);

    // And a SIMULATED environment (the default of every lane): skipped by its own name, before the helper is looked at.
    const simulated = await demoPackagesOfEnvironment({ environment: {}, dataDir: db.run.dataDir, now: () => Date.now() }).seal([], { replaceable: [] });
    expect(simulated).toMatchObject({ status: 'SKIPPED', reason: 'NOT_A_DEVELOPMENT_CAPTURE_CORE' });
  });
});

describe.skipIf(!existsSync(HELPER))('seed -> boot -> operation 41 -> reset -> regenerated (the REAL helper program, generated sources only)', () => {
  let first: V2Row[] = [];

  it('db:seed seals the two demo packages into the Core\'s store and writes their rows; the other eleven items keep their v1 shape', async () => {
    const seededAt = Date.now();
    provisionDevelopmentSigningKey({ dataDir: core.dataDir, now: seededAt - 60_000 });
    const { io, out, err } = capture();
    const code = await runSeed(['--database', db.name], { io, dataDir: db.run.dataDir, allowTestDatabase: true, clock: () => seededAt, demoPackages: portAt(seededAt) });
    console.log(`[e3] db:seed on ${db.name}: exit ${code}\n${[...out, ...err].filter((line) => line.includes('v2 demo')).map((line) => `  ${line}`).join('\n')}`);
    expect([code, err]).toEqual([0, []]);
    expect(out.some((line) => /v2 demo packages: 2 sealed with the development key/.test(line))).toBe(true);

    first = await itemRows();
    expect(first).toHaveLength(13);
    const sealed = first.filter((row) => row.manifest_version === 2);
    expect(sealed.map((row) => [row.integrity_source, row.development_sources, row.signature_simulated, row.signature_algorithm])).toEqual([
      ['DEMO_PACKAGE', true, false, 'Ed25519'],
      ['DEMO_PACKAGE', true, false, 'Ed25519'],
    ]);
    expect(sealed.filter((row) => row.tampered).map((row) => [TAMPER_ITEM.test(row.id), row.tampered_track_id])).toEqual([[true, DEMO_TAMPERED_FRAGMENT_TRACK]]);
    // The eleven others: the frozen v1 shape, stand-in signature, no development mark.
    expect(first.filter((row) => row.manifest_version === 1).map((row) => [row.signature_simulated, row.development_sources])).toEqual(Array.from({ length: 11 }, () => [true, null]));
    // Four FAKE source rows per sealed session, and the folders where the Core looks for them - nothing else.
    const sources = (await db.ownerPool().query<{ session_id: string; n: number }>("SELECT session_id, count(*)::int AS n FROM public.session_capture_sources WHERE adapter_kind = 'FAKE' GROUP BY session_id ORDER BY session_id")).rows;
    expect(sources).toEqual(sealed.map((row) => ({ session_id: row.session_id, n: 4 })).sort((a, b) => a.session_id.localeCompare(b.session_id)));
    expect(packageFolders()).toEqual(sealed.map((row) => packageFolderName(row.session_id)).sort());
    expect(existsSync(join(core.mediaStoreDir, '.demo-seed'))).toBe(false);
  });

  it('the Core boots on those rows; operation 41: the clean item PASS 15 of 15 with the development marks, EV 0005 TAMPERED naming exactly (VIDEO-02, 3)', async () => {
    await expectDemoVerdicts(first);
  });

  it('db:reset is PERMITTED, removes the two package folders, and the reseed seals them again: other digests, the same verdicts', async () => {
    const resetAt = Date.now();
    const { io, out, err } = capture();
    // The routine refuses a target that is in use: the test's own pools are closed and gone first.
    await quiet(maintenance, db.database);
    const code = await runReset(['--database', db.name], {
      io,
      dataDir: db.run.dataDir,
      evidenceStoreDir: core.mediaStoreDir,
      clock: () => resetAt,
      sessionDrainMs: PATIENT_MS,
      internals: { testRunPrefix: db.run.identity.prefix },
      demoPackages: portAt(resetAt),
    });
    console.log(`[e3] db:reset on ${db.name}: exit ${code}\n${[...out, ...err].filter((line) => /demo|development|removed|REAL/.test(line)).map((line) => `  ${line}`).join('\n')}`);
    expect(code, [...out, ...err].join('\n')).toBe(0);
    // Said before anything was built, removed after the swap, sealed again by the reseed.
    expect(err.some((line) => /replaces 2 seed-sealed demo package record\(s\)/.test(line))).toBe(true);
    expect(err.some((line) => /removed 2 development-source package folder\(s\)/.test(line))).toBe(true);
    expect(err.filter((line) => /NOT_PLACED|was not removed|RESET_BLOCKED/.test(line))).toEqual([]);
    expect(out.some((line) => /v2 demo packages: 2 sealed with the development key/.test(line))).toBe(true);

    const second = await itemRows();
    const before = first.filter((row) => row.manifest_version === 2);
    const after = second.filter((row) => row.manifest_version === 2);
    expect(after.map((row) => row.session_id)).toEqual(before.map((row) => row.session_id));
    // REGENERATED, not kept: each package is a new seal (other IVs, another instant), so its digest is another one.
    for (const row of after) expect(before.find((old) => old.id === row.id)?.manifest_hash).not.toBe(row.manifest_hash);
    expect(packageFolders()).toEqual(after.map((row) => packageFolderName(row.session_id)).sort());
    expect(existsSync(join(core.mediaStoreDir, '.demo-seed'))).toBe(false);
    await expectDemoVerdicts(second);
  });
});
