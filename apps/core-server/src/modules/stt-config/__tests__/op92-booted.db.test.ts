// Operation 92 on a BOOTED, LISTENING server (blueprint row 115; the op-92 200 half of
// `M6-STTCFG-API`; D68(d); C3 §2.5 erratum PE-113-08), and `M6-STTCFG-NEXT` against PostgreSQL.
//
// The real app factory on a clone of the seed, as `dems_app`, booted as the entry point boots it
// (every boot step, the transcriber's among them), with a data directory in the system's temporary
// folder and a real listener on 127.0.0.1 at an EPHEMERAL port. Every call of operation 92 below
// is a real HTTP request to that listener. No probe is provided by this file: the probe is the one
// the production wiring makes (`src/transcription`), through the transcriber's own HTTP client and
// its single key-loader.
//
//   - 200 `reachable: true` against a loopback fake that speaks the model-list API (the real oMLX
//     server is not started: D7(d)); 200 `reachable: false` when nothing listens; 2 runs each;
//   - the credential REFERENCE is read through `dems_stt_credential_reveal()` as the runtime role,
//     the KEY through the key-loader from a settings file that holds a canary;
//   - the canary is searched in every channel the server has: the answers, the log, the persistent
//     error log, `audit_log`, `events`, `stt_config` - with a control that the search finds a value
//     that IS there;
//   - a change of operation 91 while a session holds its snapshot does not alter that session.
//
// The clone is a throw-away database of this run (`useTestDatabase`): no live database is touched.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { manualTimer } from '../../../../test/support/engine';
import { buildGuardApp, webOperator, type GuardApp } from '../../../../test/support/guard';
import type { Headers } from '../../../../test/support/identity';
import { engineControl } from '../../../engine';
import { throttleControl } from '../../../plugins/throttle';
import { TRANSCRIBER_BOOT_STEP, transcriptionControl } from '../../../transcription';
import { KEY_CANARY, REFERENCE, SERVER_MODEL, closedPort, makeDataDir, startFakeOmlx, type FakeOmlx } from '../../../transcription/__tests__/support';
import { identityControl } from '../../identity';
import { SUPERVISOR, WEB_ORIGIN } from '../../storage/__tests__/support';
import { sttConfigControl } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row115' });
const dir = makeDataDir('db');
const logDir = mkdtempSync(join(tmpdir(), 'dems-row115-errlog-'));
const errorLogFile = join(logDir, 'errors.log');
dir.writeHost({ version: 1, cpuLocal: { binaryPath: dir.binaryPath, modelDir: dir.modelDir }, omlxServer: { settingsPath: dir.settingsPath } });

let guard: GuardApp;
let owner: Pool;
let session: Headers;
let base: string;
let fake: FakeOmlx;
const answers: string[] = [];

const CONFIG = '/api/v1/transcription/config';
const TEST = '/api/v1/transcription/config/test';

interface Answer {
  readonly status: number;
  readonly text: string;
  json(): Record<string, unknown>;
}

/** One real HTTP request to the listener. Every answer is kept for the canary sweep. */
function call(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Answer> {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  return new Promise<Answer>((resolve, reject) => {
    const request = httpRequest(
      `${base}${path}`,
      { method, headers: { ...session, origin: WEB_ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }) } },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          answers.push(text);
          resolve({ status: response.statusCode ?? 0, text, json: () => JSON.parse(text) as Record<string, unknown> });
        });
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

const revisionNow = async (): Promise<number> => (await call('GET', CONFIG)).json()['revision'] as number;

beforeAll(async () => {
  owner = db.ownerPool();
  guard = buildGuardApp({ runtime: db.runtime, run: { dataDir: dir.dataDir }, onCleanup: (close) => db.onCleanup(close) }, { errorLogFile });
  await guard.app.ready();
  engineControl(guard.app).useTimer(manualTimer().timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();
  await guard.app.listen({ host: '127.0.0.1', port: 0 });
  base = `http://127.0.0.1:${(guard.app.server.address() as AddressInfo).port}`;
  session = await webOperator(guard, SUPERVISOR.username);
  fake = await startFakeOmlx();
  await guard.app.pipeline.drain();
});

afterAll(async () => {
  await fake?.close();
  rmSync(dir.dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

beforeEach(() => {
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
});

describe('the booted server', () => {
  it('ran the transcriber boot step, listens on loopback at an ephemeral port, and has its probe without anyone providing one', () => {
    const passed = guard.log.lines().filter((line) => line['msg'] === 'boot step passed').map((line) => line['step']);
    expect(passed).toContain(TRANSCRIBER_BOOT_STEP);
    const address = guard.app.server.address() as AddressInfo;
    expect([guard.app.server.listening, address.address]).toEqual([true, '127.0.0.1']);
    expect([4420, 4421, 4422, 4423, 8000, 5432, 5173]).not.toContain(address.port);
    expect(sttConfigControl(guard.app).hasProbe()).toBe(true);
    expect(transcriptionControl(guard.app).mounted).toBe(true);
    // Simulated capture (the default of the test configuration): no transcriber runs.
    expect(transcriptionControl(guard.app).serviceState()).toEqual({ state: 'NOT_CONFIGURED', startedAt: null });
  });
});

describe('operation 92 answers 200 on the booted server (M6-STTCFG-API, the 200 half)', () => {
  it('omlx-server against the loopback fake, 2 runs: reachable, model available; ONE authenticated model-list request per test', async () => {
    const stored = await call('POST', CONFIG, { revision: await revisionNow(), backend: 'omlx-server', endpoint: fake.endpoint, model: SERVER_MODEL, credential: { kind: 'REFERENCE', ref: REFERENCE } });
    expect(stored.status).toBe(200);
    expect(stored.json()).toMatchObject({ backend: 'omlx-server', credentialSet: true, credentialKind: 'REFERENCE' });
    for (let run = 1; run <= 2; run += 1) {
      const response = await call('POST', TEST);
      expect(response.status).toBe(200);
      expect(response.json()).toEqual({ reachable: true, modelAvailable: true, backend: 'omlx-server', detailCode: 'OK' });
      expect(fake.requests).toHaveLength(run);
    }
    expect(fake.requests[0]).toEqual({ method: 'GET', url: '/v1/models', host: `127.0.0.1:${fake.port}`, authorization: `Bearer ${KEY_CANARY}` });
    // Operation 90 reports the last test, never the credential.
    const read = (await call('GET', CONFIG)).json();
    expect(read['lastTest']).toMatchObject({ reachable: true, modelAvailable: true });
    expect(Object.keys(read).filter((key) => /ref|secret|key|nonce/i.test(key))).toEqual([]);
    console.info(`[row115] M6-STTCFG-API op 92 on a booted server | listener=127.0.0.1:<ephemeral> backend=omlx-server (loopback fake) runs=2 status=200 reachable=true modelAvailable=true requests=${fake.requests.length}`);
  });

  it('nothing listens on the stored endpoint (the unreachable case), 2 runs: 200 with reachable false, not an HTTP error', async () => {
    const port = await closedPort();
    expect((await call('POST', CONFIG, { revision: await revisionNow(), endpoint: `http://127.0.0.1:${port}` })).status).toBe(200);
    for (let run = 1; run <= 2; run += 1) {
      const response = await call('POST', TEST);
      expect(response.status).toBe(200);
      expect(response.json()).toEqual({ reachable: false, modelAvailable: false, backend: 'omlx-server', detailCode: 'UNREACHABLE' });
    }
    console.info('[row115] M6-STTCFG-API op 92 on a booted server | backend=omlx-server (nothing listens) runs=2 status=200 reachable=false detailCode=UNREACHABLE');
  });

  it('cpu-local, 2 runs: engine and model present and the CPU-only build check; then the model absent', async () => {
    expect((await call('POST', CONFIG, { revision: await revisionNow(), backend: 'cpu-local', model: 'ggml-large-v3-turbo', credential: { kind: 'CLEAR' } })).status).toBe(200);
    for (let run = 1; run <= 2; run += 1) {
      const response = await call('POST', TEST);
      expect([response.status, response.json()]).toEqual([200, { reachable: true, modelAvailable: true, backend: 'cpu-local', detailCode: 'OK' }]);
    }
    expect((await call('POST', CONFIG, { revision: await revisionNow(), model: 'ggml-absent' })).status).toBe(200);
    expect((await call('POST', TEST)).json()).toEqual({ reachable: true, modelAvailable: false, backend: 'cpu-local', detailCode: 'MODEL_NOT_AVAILABLE' });
  });

  it('operation 91 refuses an endpoint with `?`, `#`, a backslash or white space: 422, the stored row keeps its revision', async () => {
    const revision = await revisionNow();
    for (const endpoint of ['http://127.0.0.1:9000/v1?x=1', 'http://127.0.0.1:9000/v1#f', 'http://127.0.0.1:9000/v1\\m', 'http://127.0.0.1:9000/v1 m']) {
      const response = await call('POST', CONFIG, { revision, backend: 'omlx-server', endpoint });
      expect([response.status, (response.json()['error'] as { details: { reason: string } }).details.reason], endpoint).toEqual([422, 'ENDPOINT_NOT_LOOPBACK']);
    }
    expect(await revisionNow()).toBe(revision);
  });

  it('a caller without CAPTURE_CONFIG is refused before any probe runs; an anonymous caller is 401', async () => {
    const before = fake.requests.length;
    const kept = session;
    session = {};
    expect((await call('POST', TEST)).status).toBe(401);
    session = kept;
    expect(fake.requests.length).toBe(before);
  });
});

describe('M6-STTCFG-NEXT against PostgreSQL: a change while a session holds its snapshot does not alter that session', () => {
  it('the snapshot is taken from the stored row; operation 91 moves the row on; the session keeps what it took, the next one takes the new row', async () => {
    const control = transcriptionControl(guard.app);
    expect((await call('POST', CONFIG, { revision: await revisionNow(), backend: 'omlx-server', endpoint: fake.endpoint, model: SERVER_MODEL, credential: { kind: 'REFERENCE', ref: REFERENCE } })).status).toBe(200);
    const revision = await revisionNow();
    const at = guard.clock.now();
    const first = await control.snapshotSttConfigForSession('SES-20310101-0001');
    await control.settled();
    expect(first).toMatchObject({ ok: true, taken: true, snapshot: { revision, takenAt: at, backend: 'omlx-server', endpoint: fake.endpoint, model: SERVER_MODEL, credentialKind: 'REFERENCE' } });
    // No credential and no reference in a snapshot.
    expect(JSON.stringify(first)).not.toContain(REFERENCE);

    guard.clock.advance(60_000);
    expect((await call('POST', CONFIG, { revision, enabled: false, backend: 'cpu-local', model: 'ggml-large-v3-turbo' })).status).toBe(200);
    expect(await control.sessionSnapshot('SES-20310101-0001')).toMatchObject({ revision, enabled: true, backend: 'omlx-server', endpoint: fake.endpoint });
    expect(await control.manifestSnapshot('SES-20310101-0001')).toEqual({ enabled: true, backend: 'omlx-server', model: SERVER_MODEL, diarization: true, revision });
    const open = await control.openSession('SES-20310101-0001');
    if (open.state !== 'ENABLED') throw new Error(`the open session is ${open.state}`);
    expect([open.adapter.backend, open.adapter.model]).toEqual(['omlx-server', SERVER_MODEL]);
    open.close();

    const next = await control.snapshotSttConfigForSession('SES-20310101-0002');
    expect(next).toMatchObject({ ok: true, snapshot: { revision: revision + 1, takenAt: at + 60_000, enabled: false, backend: 'cpu-local' } });
    expect((await control.openSession('SES-20310101-0002')).state).toBe('DISABLED');
    expect(existsSync(control.scratchDirFor('SES-20310101-0002'))).toBe(false);
    console.info(`[row115] M6-STTCFG-NEXT (PostgreSQL) | session 1 snapshot rev ${revision} omlx-server kept after op 91 | session 2 snapshot rev ${revision + 1} disabled/cpu-local | clock moved by the test only`);
  });
});

describe('secrecy: the key of the settings file, searched in every channel of the server', () => {
  it('0 hits in the answers, the log, the persistent error log, audit_log, events and stt_config; the fake server did receive it (control)', async () => {
    await guard.app.pipeline.drain();
    const dump = async (table: string): Promise<string> => (await owner.query<{ text: string }>(`SELECT t::text AS text FROM public.${table} t`)).rows.map((row) => row.text).join('\n');
    const channels: Record<string, string> = {
      answers: answers.join('\n'),
      log: guard.log.text(),
      errorLog: existsSync(errorLogFile) ? readFileSync(errorLogFile, 'utf8') : '',
      audit_log: await dump('audit_log'),
      events: await dump('events'),
      stt_config: await dump('stt_config'),
    };
    const hits = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
    const forms = [KEY_CANARY, Buffer.from(KEY_CANARY).toString('base64'), encodeURIComponent(`Bearer ${KEY_CANARY}`)];
    const found = Object.fromEntries(Object.entries(channels).map(([name, text]) => [name, forms.reduce((sum, form) => sum + hits(text, form), 0)]));
    console.info(`[row115] canary sweep (booted server, PostgreSQL) | ${Object.entries(channels).map(([name, text]) => `${name}=${text.length}b:${found[name]}`).join(' ')} | received by the fake server: ${fake.requests.filter((request) => request.authorization === `Bearer ${KEY_CANARY}`).length}`);
    expect(found).toEqual({ answers: 0, log: 0, errorLog: 0, audit_log: 0, events: 0, stt_config: 0 });
    // Controls: the key WAS sent (so there was something to leak), the channels are not empty,
    // and the same search finds a value that is stored.
    expect(fake.requests.filter((request) => request.authorization === `Bearer ${KEY_CANARY}`).length).toBeGreaterThanOrEqual(2);
    expect(channels['log']?.length).toBeGreaterThan(1_000);
    expect(hits(channels['audit_log'] ?? '', 'STT_CONFIG_CHANGED')).toBeGreaterThanOrEqual(4);
    expect(hits(channels['stt_config'] ?? '', REFERENCE) + hits(channels['stt_config'] ?? '', 'cpu-local')).toBeGreaterThanOrEqual(1);
    // The unreachable case was written to the persistent error log by its code (a test that failed is a fault to the team).
    expect(hits(channels['errorLog'] ?? '', 'UNREACHABLE')).toBeGreaterThanOrEqual(1);
    // The endpoint and the reference target are in no audit row either (field NAMES only).
    expect(hits(channels['audit_log'] ?? '', REFERENCE) + hits(channels['audit_log'] ?? '', fake.endpoint)).toBe(0);
  });

  it('the runtime role still cannot select the credential columns; the reveal function answers the reference, never a key', async () => {
    const refused = await guard.app.db.pool.query('SELECT credential_ref FROM public.stt_config').then(
      () => 'answered',
      (error: { code?: string }) => error.code,
    );
    expect(refused).toBe('42501');
    expect((await call('POST', CONFIG, { revision: await revisionNow(), backend: 'omlx-server', endpoint: fake.endpoint, model: SERVER_MODEL, credential: { kind: 'REFERENCE', ref: REFERENCE } })).status).toBe(200);
    const revealed = (await guard.app.db.pool.query('SELECT credential_kind, credential_ref FROM public.dems_stt_credential_reveal()')).rows;
    expect(revealed).toEqual([{ credential_kind: 'REFERENCE', credential_ref: REFERENCE }]);
  });
});
