// END-TO-END PROOF of blueprint row 82b: ONE session recorded by the BUILT capture worker from
// GENERATED sources, sealed by the composition in the running Core, verified by operation 41.
//
// A RUNNER CHECK, NOT A SUITE TEST: it starts the capture worker and the development helper
// (generated picture and tone - no camera, no microphone, no device is opened), so it runs only
// when asked for, under the heavy-host lock and the db lock:
//
//   DEMS_SEAL_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock \
//     npx vitest run --root apps/core-server --project db src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts
//
// Loopback only; the worker listens on the Core's two ingest ports 127.0.0.1:8554 and 8556.
//
// WHAT IS REAL: the app factory with every unit, the request stages and the routes (through
// `app.inject`: no TCP listener of the Core), the engine on a throw-away PostgreSQL database as
// `dems_app`, the capture supervisor with the built worker (protocol 4), the fragment recorder,
// the sealing composition of this folder, the credential store and the signer of a throw-away
// data directory, verify v2. The clock and the timers are the system's: the recording takes real
// seconds. WHAT IS NOT: the sources (generated), the tablet link (set through the engine, no
// tablet), and in case (b) the death of the Core (see there).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, truncateSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PackageFile, parseManifestV2 } from '@dems/shared/evidence-package';
import { HOST_CLOCK_TIME, OPERATORS } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../../test/support/identity';
import { buildApp } from '../../../app';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { sessionCapture } from '../../../capture-session';
import { provisionDevelopmentSigningKey } from '../../../sealing';
import { CORE_SERVER_VERSION } from '../../../version';
import { sealingHost } from '../../index';
import { CORE_TIME_SOURCE, NOT_CONFIGURED } from '../../session-reader';

const ASKED = process.env.DEMS_SEAL_E2E === '1';
const REPOSITORY = resolve(import.meta.dirname, '../../../../../..');
const WORKER = resolve(REPOSITORY, 'apps/capture-worker/build/capture-worker');
// The private helper copy of `npm run capture:dev-setup` (the fence refuses a package manager's FFmpeg).
const HELPER = process.env.DEMS_CAPTURE_HELPER_FFMPEG ?? resolve(REPOSITORY, '.data/helpers/ffmpeg');
const FAKE_DEVICES = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'];

const db = useTestDatabase({ template: 'seed' });
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

interface Core {
  readonly app: FastifyInstance;
  readonly owner: Pool;
  readonly log: ReturnType<typeof captureLog>;
  readonly cookie: () => Promise<string>;
  get(url: string, cookie: string): Promise<LightMyRequestResponse>;
  post(url: string, cookie: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse>;
}

type Target = Awaited<ReturnType<typeof db.another>>;
type Fixture = ReturnType<typeof realBootFixture>;

async function core(target: Target, fixture: Fixture): Promise<Core> {
  const log = captureLog();
  // No speech runtime on a test host (the boot of real capture refuses an STT configuration it cannot
  // run): STT is switched off in THIS throw-away database, as row 71b's rig does. The transcript of
  // the sealed session is therefore DISABLED; the transcriber is not the subject here.
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, captureWorkerPath: WORKER }),
    logStream: log.stream,
    errorLogFile: `${fixture.dataDir}/error.log`,
  });
  let closed = false;
  target.onCleanup(async () => {
    if (!closed) await app.close();
  });
  app.addHook('onClose', async () => {
    closed = true;
  });
  await app.ready();
  await app.readiness.boot();
  // As the entry point does after the boot steps (`src/index.ts`): the supervisor of the capture worker.
  await app.capture.boot();
  const investigator = OPERATORS.find((operator) => operator.role === 'INVESTIGATOR');
  if (investigator === undefined) throw new Error('no seeded investigator');
  return {
    app,
    owner: target.ownerPool(),
    log,
    cookie: async () => {
      const answer = await webSignIn(app, investigator.username);
      const token = cookieValue(answer, app.config.sessionCookieName);
      if (answer.statusCode !== 200 || token === null) throw new Error(`the sign-in answered ${answer.statusCode}`);
      return `${app.config.sessionCookieName}=${token}`;
    },
    get: (url, cookie) => app.inject({ method: 'GET', url, headers: { cookie } }),
    post: (url, cookie, payload) => app.inject({ method: 'POST', url, headers: { cookie, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) }),
  };
}

async function until<Value>(what: string, limitMs: number, read: () => Promise<Value | null> | Value | null, diagnose: () => unknown = () => null): Promise<Value> {
  for (const started = Date.now(); Date.now() - started < limitMs; ) {
    const value = await read();
    if (value !== null) return value;
    await sleep(250);
  }
  throw new Error(`not reached within ${limitMs} ms: ${what} ${JSON.stringify(diagnose())}`);
}

const sessionOf = (c: Core) => c.app.engine.state().session;
const codes = (c: Core): string[] => c.log.lines().map((line) => String((line as { code?: unknown }).code ?? '')).filter((code) => code !== '');
/** The last coded log lines with what they say of a failure: codes and identifiers only. */
const tail = (c: Core): string => JSON.stringify(c.log.lines().filter((line) => typeof line.code === 'string').slice(-8).map((line) => ({ code: line.code, msg: line.msg, cause: line.cause, detail: line.detail, step: line.step, deviceId: line.deviceId, err: (line.err as { message?: string; code?: string } | undefined)?.code ?? (line.err as { message?: string } | undefined)?.message })));

/** From nothing to a RECORDING session with durable media, through the HTTP routes. Resolves with the session ID. */
async function record(c: Core, cookie: string, seconds: number): Promise<string> {
  // NEVER A REAL DEVICE: the selector of this throw-away database must name the four built-in FAKE devices only.
  const state = c.app.engine.state();
  const assigned = [...state.captureConfig.cameras.map((camera) => camera.deviceId), ...state.captureConfig.mics.map((mic) => mic.deviceId)];
  expect(assigned.sort()).toEqual(FAKE_DEVICES);
  expect(state.captureDevices.devices.filter((device) => assigned.includes(device.id)).map((device) => device.adapter ?? 'FAKE')).toEqual(['FAKE', 'FAKE', 'FAKE', 'FAKE']);

  await c.app.engine.setTabletLink('CONNECTED');
  const investigator = OPERATORS.find((operator) => operator.role === 'INVESTIGATOR')!;
  const created = await c.post('/api/v1/session', cookie, { caseNumber: 'LP/2026/1009-0082', subjectType: 'SAKSI', subjectName: 'Generated Subject', investigatorId: investigator.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
  expect([200, 201], created.body).toContain(created.statusCode);
  const sessionId = sessionOf(c)?.id ?? '';
  expect((await c.post(`/api/v1/session/${sessionId}/start`, cookie)).statusCode).toBe(202);
  await until('the pre-check ends', 20_000, () => (['ARMED', 'PRECHECK'].includes(sessionOf(c)?.state ?? '') && sessionOf(c)?.precheck.completedAt !== null ? true : sessionOf(c)?.state === 'ARMED' ? true : null), () => sessionOf(c)?.precheck);
  if (sessionOf(c)?.state === 'PRECHECK') {
    const acknowledged = await c.post(`/api/v1/session/${sessionId}/precheck/acknowledge`, cookie);
    expect(acknowledged.statusCode, acknowledged.body).toBe(200);
  }
  const started = await c.post(`/api/v1/session/${sessionId}/start`, cookie);
  expect(started.statusCode, started.body).toBe(200);
  expect(sessionOf(c)).toMatchObject({ state: 'RECORDING', captureDurable: false });
  await until('the first durable fragment', 40_000, () => (sessionOf(c)?.captureDurable === true ? true : sessionOf(c)?.state !== 'RECORDING' ? Promise.reject(new Error(`the session left RECORDING: ${sessionOf(c)?.state} ${tail(c)}`)) : null), () => codes(c).slice(-12));
  await sleep(seconds * 1_000);
  return sessionId;
}

const fragmentRows = async (c: Core, sessionId: string): Promise<number[]> =>
  (await c.owner.query<{ track_id: string; n: string }>('SELECT track_id, count(*)::text AS n FROM public.recording_fragments WHERE session_id = $1 GROUP BY track_id ORDER BY track_id', [sessionId])).rows.map((row) => Number(row.n));

/** What a sealed session must be, in the database, on the disk and through operation 41. */
async function sealedAndVerified(c: Core, cookie: string, sessionId: string, fixture: Fixture, interrupted: boolean): Promise<void> {
  const evidenceId = sessionOf(c)?.evidenceId ?? '';
  const item = c.app.engine.state().evidence.find((entry) => entry.id === evidenceId);
  expect(item).toMatchObject({ sessionId, status: 'SEALED', integritySource: 'REAL', manifestVersion: 2, developmentSources: true, signature: { algorithm: 'Ed25519', simulated: false } });
  // R80-01: the seal wrote the item's transcript summary - here the declared absence of a session whose snapshot disables STT.
  expect(item?.transcript).toEqual({ state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false });

  // The package folder: the sealed camera files are there, the plaintext recordings are gone.
  const folder = `${fixture.mediaStoreDir}/SESSION-${sessionId}`;
  expect(readdirSync(folder).sort()).toEqual([PackageFile.AUDIT_EXTRACT, PackageFile.CERTIFICATE, PackageFile.FRAGMENTS_DIR, PackageFile.MANIFEST, PackageFile.SIGNATURE].sort());
  expect(readdirSync(`${folder}/${PackageFile.FRAGMENTS_DIR}`).sort()).toEqual(['VIDEO-01.mp4', 'VIDEO-02.mp4', 'fragments.json']);
  expect(existsSync(`${folder}/VIDEO-01.mp4`) || existsSync(`${folder}/VIDEO-02.mp4`)).toBe(false);
  const manifest = parseManifestV2(JSON.parse(readFileSync(`${folder}/${PackageFile.MANIFEST}`, 'utf8')));
  expect(manifest).toMatchObject({ evidenceId, sessionId, integrity: 'REAL', developmentSources: true, timeline: { interrupted }, transcript: { state: 'DISABLED' } });
  // The class of every source is the START record's kind (generated sources: FAKE), never PRODUCTION.
  expect(manifest.tracks.map((track) => [track.trackId, track.sourceClass])).toEqual([['VIDEO-01', 'FAKE'], ['VIDEO-02', 'FAKE']]);
  expect(manifest.audio.sourceIntervals.length).toBeGreaterThanOrEqual(1);
  expect(manifest.audio.sourceIntervals.every((interval) => interval.sourceClass === 'FAKE')).toBe(true);
  expect(manifest.files.every((file) => file.fragments.length >= 1 && file.fragments.every((fragment) => fragment.keyId === `KID-${sessionId}` && fragment.interrupted === interrupted))).toBe(true);
  // The sealed bytes are not an MP4 fragment in the clear: after the init segment no `moof` type is readable at a fragment's offset.
  for (const file of manifest.files) {
    const stored = readFileSync(`${folder}/${PackageFile.FRAGMENTS_DIR}/${file.trackId}.mp4`);
    expect(stored.subarray(4, 8).toString('ascii')).toBe('ftyp');
    expect(file.fragments.map((fragment) => stored.subarray(fragment.byteOffset + 4, fragment.byteOffset + 8).toString('ascii')).includes('moof')).toBe(false);
  }

  // The six checkpoints, all DONE.
  const jobs = (await c.owner.query<{ step: string; status: string }>('SELECT step, status FROM public.sealing_jobs WHERE session_id = $1', [sessionId])).rows;
  expect(jobs.map((job) => job.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'DONE', 'DONE']);

  // Operation 83 after the seal, and operation 41: PASS with the 15 checks, development sources named.
  const progress = await c.get(`/api/v1/session/${sessionId}/sealing`, cookie);
  expect(progress.statusCode, progress.body).toBe(200);
  expect(progress.json()).toMatchObject({ sessionId, state: 'SEALED', progressPct: 100, etaMs: 0 });
  const verified = await c.post(`/api/v1/evidence/${evidenceId}/verify`, cookie);
  expect(verified.statusCode, verified.body).toBe(200);
  const body = verified.json();
  // The report of the run, for the runner's record (codes, check IDs and counts: no value of evidence).
  // The output folder is made when it is not there (fix pass F-M7: the run used to fail on a missing folder after the work was done).
  if (process.env.DEMS_SEAL_E2E_OUT !== undefined) mkdirSync(process.env.DEMS_SEAL_E2E_OUT, { recursive: true });
  if (process.env.DEMS_SEAL_E2E_OUT !== undefined) writeFileSync(`${process.env.DEMS_SEAL_E2E_OUT}/verify-${sessionId}-${Date.now()}.json`, JSON.stringify({ interruptedExpected: interrupted, status: verified.statusCode, ok: body.ok, overall: body.overall, interrupted: body.interrupted, sources: body.sources, transcriptState: body.transcriptState, failedFragmentCount: body.failedFragmentCount, checks: body.checks }, null, 1));
  expect(body).toMatchObject({ evidenceId, ok: true, overall: 'PASS', interrupted, sources: { development: true } });

  // PASS H-Y: WHAT A PRODUCT-SEALED MANIFEST AND ITS AUDIT EXTRACT SAY, kept for the record before the fixture is removed
  // (two checkpoints and gate 64's condition C2 could quote none of it). Facts read from the sealed package only: codes,
  // identifiers, counts and instants - no media, no key material, no hash of evidence, no text of an audit row.
  const extract = readFileSync(`${folder}/${PackageFile.AUDIT_EXTRACT}`, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as { type: string; details: Record<string, unknown> | null });
  const rowsPerType: Record<string, number> = {};
  for (const type of extract.map((row) => row.type).sort()) rowsPerType[type] = (rowsPerType[type] ?? 0) + 1;
  const recordingStarted = extract.filter((row) => row.type === 'RECORDING_STARTED').map((row) => row.details?.timeSource ?? null);
  const developmentKey = (body as { signature?: { developmentKey?: unknown } }).signature?.developmentKey ?? null;
  const facts = {
    case: interrupted ? 'b' : 'a',
    sessionId,
    evidenceId,
    manifest: {
      timeSource: manifest.timeline.timeSource,
      device: { deviceId: manifest.device.deviceId, name: manifest.device.name, serialNumber: manifest.device.serialNumber, hardwareUuid: manifest.device.hardwareUuid, softwareVersion: manifest.device.softwareVersion },
      tracksLength: manifest.tracks.length,
      tracks: manifest.tracks.map((track) => ({ trackId: track.trackId, deviceId: track.deviceId, sourceClass: track.sourceClass, codec: track.codec, clockOffsetMs: track.clockOffsetMs })),
      timeline: { interrupted: manifest.timeline.interrupted, stoppedAt: manifest.timeline.stoppedAt },
      transcript: { state: manifest.transcript.state },
      signature: { keyId: manifest.signature.keyId, algorithm: manifest.signature.algorithm, simulated: manifest.signature.simulated },
      developmentSources: manifest.developmentSources,
    },
    // The verifier's own statement of the certificate that verified the signature (operation 41): the development mark.
    certificate: { developmentMark: developmentKey },
    auditExtract: { rows: extract.length, rowsPerType, recordingStartedTimeSource: recordingStarted },
  };
  if (process.env.DEMS_SEAL_E2E_OUT !== undefined) writeFileSync(`${process.env.DEMS_SEAL_E2E_OUT}/facts-${facts.case}-${sessionId}.json`, `${JSON.stringify(facts, null, 1)}\n`);

  // WHAT FIX WAVE H PUT RIGHT, on a package the PRODUCT sealed (each was a value of the simulator's dataset before it).
  // No row of the simulator's recording loop in a real-capture extract.
  expect(extract.length).toBeGreaterThan(0);
  expect(Object.keys(rowsPerType).filter((type) => ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'].includes(type))).toEqual([]);
  // The time source is the host system clock, in the manifest and on the start row: never GNSS.
  expect(manifest.timeline.timeSource).toEqual({ source: 'RTC', state: 'HOST_SYSTEM_CLOCK', fallbackOrder: [] });
  expect(manifest.timeline.timeSource).toEqual(CORE_TIME_SOURCE);
  expect(recordingStarted).toEqual([HOST_CLOCK_TIME.source]);
  expect(recordingStarted).not.toContain('GNSS');
  // The version is the Core's; serial and hardware UUID are not configured; fields 20 / 21 are the rig's configured identity.
  expect(manifest.device.softwareVersion).toBe(CORE_SERVER_VERSION);
  expect([manifest.device.serialNumber, manifest.device.hardwareUuid]).toEqual([NOT_CONFIGURED, NOT_CONFIGURED]);
  expect(c.app.config.installationDeviceId).not.toBeNull();
  expect([manifest.device.deviceId, manifest.device.name]).toEqual([c.app.config.installationDeviceId, c.app.config.installationName]);
  expect(manifest.tracks).toHaveLength(2);
  // A generated-source package is signed with the development key, and the verifier says so of its certificate.
  expect(developmentKey).toBe(true);
  expect(body.checks).toHaveLength(15);
  expect((body.checks as { id: string; status: string }[]).filter((check) => check.status === 'FAIL')).toEqual([]);
  expect(c.app.engine.state().evidence.find((entry) => entry.id === evidenceId)?.verification.status).toBe('PASS');
}

describe.skipIf(!ASKED)('row 82b end to end: recorded by the built worker, sealed by the composition, verified by operation 41 (skipped unless DEMS_SEAL_E2E=1: it needs the built worker and the heavy-host lock)', () => {
  const fixtures: Fixture[] = [];
  afterAll(() => {
    for (const fixture of fixtures) fixture.remove();
  });
  const fresh = (label: string): Fixture => {
    const fixture = realBootFixture(label);
    provisionDevelopmentSigningKey({ dataDir: fixture.dataDir, now: Date.now() });
    fixtures.push(fixture);
    return fixture;
  };

  it('(a) start -> record a few fragments -> stop -> the composition seals -> verify PASS (15 checks, development sources) -> recordings gone, sealed files there', async () => {
    const fixture = fresh('row82b-a');
    const target = await db.another({ template: 'seed', slug: 'r82b_e2e_a' });
    const c = await core(target, fixture);
    expect(sealingHost(c.app).mounted).toBe(true);
    const cookie = await c.cookie();
    const sessionId = await record(c, cookie, 7);
    const early = await c.get(`/api/v1/session/${sessionId}/sealing`, cookie);
    expect(early.statusCode).toBe(409);

    const stopped = await c.post(`/api/v1/session/${sessionId}/stop`, cookie, { reason: 'Interview complete' });
    expect(stopped.statusCode, stopped.body).toBe(202);
    // Operation 83 while the pipeline works: once it has started, every answer is of the contract's shape and moves forward.
    const seen: number[] = [];
    await until('the session is SEALED', 120_000, async () => {
      const answer = await c.get(`/api/v1/session/${sessionId}/sealing`, cookie);
      if (answer.statusCode === 200) seen.push(answer.json().progressPct as number);
      return sessionOf(c)?.state === 'SEALED' ? true : null;
    }, () => ({ state: sessionOf(c)?.state, steps: sessionOf(c)?.finalization.steps.map((step) => [step.id, step.status, step.detail]), outcome: sealingHost(c.app).lastOutcome(), codes: codes(c).slice(-15) }));
    await sealingHost(c.app).settled();
    expect(sealingHost(c.app).lastOutcome()).toMatchObject({ status: 'SEALED', sessionId, interrupted: false, attempt: 1 });
    expect(seen.length).toBeGreaterThan(0);
    expect([...seen].sort((left, right) => left - right)).toEqual(seen);
    const rows = await fragmentRows(c, sessionId);
    expect(rows).toHaveLength(2);
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(2);
    await sealedAndVerified(c, cookie, sessionId, fixture, false);
    console.info(`[row82b e2e a] session ${sessionId}: fragments per file ${rows.join(' / ')}, op 83 percents seen ${seen.join(',')}`);
  }, 300_000);

  it('(b) the worker is KILLED mid-recording and the Core goes down before it records anything of it -> a new Core on the same database and media -> RECOVERY seals the durable prefix as interrupted -> verify PASS with the interrupted flag', async () => {
    const fixture = fresh('row82b-b');
    const target = await db.another({ template: 'seed', slug: 'r82b_e2e_b' });
    const first = await core(target, fixture);
    const sessionId = await record(first, await first.cookie(), 6);
    // The one worker of THIS Core: its arguments name the log file of this throw-away data directory.
    const pids = execFileSync('/usr/bin/pgrep', ['-f', `${WORKER} --log ${fixture.dataDir}/`], { encoding: 'utf8' }).trim().split('\n').map(Number);
    expect(pids).toHaveLength(1);
    const pid = pids[0];
    // THE CRASH, as far as one process can stage it: SIGKILL to the worker (no flush, no close of
    // its files), and the Core closed in the same turn, before the supervisor has seen the exit -
    // its engine stops first, so nothing of the end is recorded: the session row still says RECORDING.
    process.kill(pid as number, 'SIGKILL');
    await first.app.close();
    await sessionCapture(first.app).idle().catch(() => {});
    const left = (await target.ownerPool().query<{ state: string }>('SELECT state FROM public.active_session')).rows;
    expect(left.map((row) => row.state)).toEqual(['RECORDING']);
    expect((await target.ownerPool().query('SELECT 1 FROM public.sealing_jobs WHERE session_id = $1', [sessionId])).rowCount).toBe(0);
    expect(existsSync(`${fixture.mediaStoreDir}/SESSION-${sessionId}/VIDEO-01.mp4`)).toBe(true);

    const second = await core(target, fixture);
    await until('RECOVERY sealed the session', 120_000, () => (second.app.engine.state().session?.state === 'SEALED' ? true : null), () => ({ state: second.app.engine.state().session?.state, steps: second.app.engine.state().session?.finalization.steps.map((step) => [step.id, step.status, step.detail]), outcome: sealingHost(second.app).lastOutcome(), codes: codes(second).slice(-15) }));
    await sealingHost(second.app).settled();
    expect(sealingHost(second.app).lastOutcome()).toMatchObject({ status: 'SEALED', sessionId, interrupted: true });
    const cookie = await second.cookie();
    await sealedAndVerified(second, cookie, sessionId, fixture, true);
    console.info(`[row82b e2e b] session ${sessionId}: fragments per file ${(await fragmentRows(second, sessionId)).join(' / ')}`);
  }, 300_000);

  // Fix pass F-M7b (review R88-02 (c); rulings D178 (2), D183): THE TERMINAL OUTCOME in a running Core.
  it('(c) a session of which NO camera file can be sealed -> RECOVERY ends it UNSEALABLE: recordings in the quarantine, one CRITICAL alert + audit row, no open session, a NEW session is created, and the next start lists the quarantine and retries nothing', async () => {
    const fixture = fresh('fm7b-c');
    const target = await db.another({ template: 'seed', slug: 'fm7b_e2e_c' });
    const first = await core(target, fixture);
    const sessionId = await record(first, await first.cookie(), 6);
    const pids = execFileSync('/usr/bin/pgrep', ['-f', `${WORKER} --log ${fixture.dataDir}/`], { encoding: 'utf8' }).trim().split('\n').map(Number);
    expect(pids).toHaveLength(1);
    process.kill(pids[0] as number, 'SIGKILL');
    await first.app.close();
    await sessionCapture(first.app).idle().catch(() => {});
    expect((await target.ownerPool().query('SELECT 1 FROM public.recording_fragments WHERE session_id = $1', [sessionId])).rowCount).toBeGreaterThan(0);
    // BOTH recordings lose everything after their first 64 bytes: no file holds a whole fragment any more, while the rows say they recorded.
    const folder = `${fixture.mediaStoreDir}/SESSION-${sessionId}`;
    for (const name of ['VIDEO-01.mp4', 'VIDEO-02.mp4']) {
      expect(existsSync(`${folder}/${name}`)).toBe(true);
      truncateSync(`${folder}/${name}`, 64);
    }

    const second = await core(target, fixture);
    await until('the session is ended', 60_000, () => (second.app.engine.state().session === null ? true : null), () => ({ state: second.app.engine.state().session?.state, steps: second.app.engine.state().session?.finalization.steps.map((step) => [step.id, step.status, step.detail]), outcome: sealingHost(second.app).lastOutcome(), codes: codes(second).slice(-15) }));
    await sealingHost(second.app).settled();
    expect(sealingHost(second.app).lastOutcome()).toMatchObject({ status: 'FAILED', sessionId, code: 'NOTHING_SEALABLE' });
    const state = second.app.engine.state();
    expect(state.sessionHistory[0]).toMatchObject({ id: sessionId, outcome: 'INCOMPLETE', evidenceId: null });
    expect(state.evidence.some((item) => item.sessionId === sessionId)).toBe(false);
    expect(state.alerts.filter((alert) => alert.params?.reason === 'UNSEALABLE')).toMatchObject([{ kind: 'SYSTEM', severity: 'CRITICAL', active: true, target: sessionId, params: { cause: 'NOTHING_SEALABLE', sessionId } }]);
    const audit = (await second.owner.query<{ type: string; severity: string; details: Record<string, unknown> }>("SELECT type, severity, details FROM public.audit_log WHERE session_id = $1 AND type = 'SESSION_INCOMPLETE'", [sessionId])).rows;
    expect(audit).toMatchObject([{ severity: 'CRITICAL', details: { reason: 'UNSEALABLE', cause: 'NOTHING_SEALABLE' } }]);
    // MOVED, never deleted: both files, owner-only, in the quarantine; nothing of the session in its folder.
    const kept = `${fixture.mediaStoreDir}/.quarantine/${sessionId}`;
    for (const name of ['VIDEO-01.mp4', 'VIDEO-02.mp4']) {
      expect(statSync(`${kept}/${name}`).size).toBe(64);
      expect(statSync(`${kept}/${name}`).mode & 0o077).toBe(0);
    }
    expect(statSync(kept).mode & 0o077).toBe(0);
    expect(existsSync(folder)).toBe(false);
    expect((await second.owner.query<{ error_code: string | null }>("SELECT error_code FROM public.sealing_jobs WHERE session_id = $1 AND status = 'FAILED'", [sessionId])).rows).toEqual([{ error_code: 'UNSEALABLE' }]);

    // THE CORE IS FREE: a new session is created.
    const cookie = await second.cookie();
    const investigator = OPERATORS.find((operator) => operator.role === 'INVESTIGATOR')!;
    const created = await second.post('/api/v1/session', cookie, { caseNumber: 'LP/2026/1010-0083', subjectType: 'SAKSI', subjectName: 'Generated Subject', investigatorId: investigator.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    expect([200, 201], created.body).toContain(created.statusCode);
    const next = sessionOf(second)?.id ?? '';
    expect(next).not.toBe(sessionId);
    expect((await second.post(`/api/v1/session/${next}/cancel`, cookie)).statusCode).toBe(204);
    await second.app.close();

    // THE NEXT START: the quarantine is listed in one line, and nothing is retried.
    const third = await core(target, fixture);
    await sealingHost(third.app).settled();
    expect(codes(third)).toContain('SEALING_QUARANTINE_HOLDS_SESSIONS');
    expect(sealingHost(third.app).lastOutcome()).toBeNull();
    expect(third.app.engine.state().session).toBeNull();
    console.info(`[fm7b e2e c] session ${sessionId}: ended UNSEALABLE, quarantine ${kept}`);
  }, 300_000);
});
