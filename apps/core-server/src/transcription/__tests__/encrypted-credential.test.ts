// Integration pass A (decision D109): the seams of rows 84 / 115 / 79 closed in the production
// composition, on an in-process host with a data directory in the system's temporary folder.
//
//   1. A stored `ENCRYPTED` credential is opened by the REAL Core credential store of the app (a
//      real key file, the real envelope cipher) inside the transcriber's key-loader: operation 92's
//      probe and a session's adapter send it as the `Authorization` header and it appears NOWHERE
//      else (canary sweep of the log, the persistent error log, the results and every failure).
//   2. The engine guard of `@dems/transcriber` is in the mount: an engine a killed Core left
//      running is reaped when the session is opened again.
//
// The oMLX server is a loopback fake (never the real one, D7(d)); no engine is started.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { ENGINE_RECORD_FILE, createEngineGuard } from '@dems/transcriber';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { CredentialPurpose, coreCredentialStore, type CoreCredentialStore } from '../../credential-store';
import { createMemorySnapshotStore, mountTranscription, sessionScratchDir, sessionTapPath, type StoredSttSelection, type TranscriptionControl } from '../index';
import { answerer, fakeHost, fullHost, makeDataDir, serverRow, startFakeOmlx, writeTap, type Answerer, type FakeHost, type FakeOmlx, mediaOf } from './support';

/** The API key of this file. Built from parts: no other file of the repository holds it, and it is NOT the key of the settings file. */
const SECRET_CANARY = ['stt', 'ENCRYPTED', 'CANARY', 'passA', 'Hx7Pd2Lm9Qc4Wz'].join('-');

const dirs: string[] = [];
const fakes: FakeOmlx[] = [];
/** PIDs of the stand-in processes this file started and that are no child of it: killed here if a case left one. */
const orphans: number[] = [];
afterEach(async () => {
  await Promise.all(fakes.splice(0).map((entry) => entry.close()));
  for (const pid of orphans.splice(0)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone: the guard reaped it.
    }
  }
});
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

interface Mounted {
  readonly host: FakeHost;
  readonly control: TranscriptionControl;
  readonly store: CoreCredentialStore;
  readonly dataDir: string;
  readonly transport: Answerer;
  stored: StoredSttSelection;
  /** Seals `secret` with the real store and puts the envelope where the reveal function reads it. */
  storeSecret(secret: string): Promise<void>;
}

function mount(slug: string, row: (endpoint: string) => StoredSttSelection, endpoint: string, viaAnswerer = false): Mounted {
  const dir = makeDataDir(slug);
  dirs.push(dir.dataDir);
  dir.writeHost(fullHost(dir));
  const host = fakeHost(dir.dataDir);
  const opened = coreCredentialStore(host.app);
  if (opened.status !== 'READY') throw new Error(`the credential store of the test app is ${opened.status}`);
  const transport = answerer();
  const mounted: Mounted = {
    host,
    store: opened.store,
    dataDir: dir.dataDir,
    transport,
    stored: row(endpoint),
    // No `openEncrypted` is handed in: the opener is the mount's own default, the store of the app.
    control: mountTranscription(host.app, { readConfig: async () => mounted.stored, snapshots: createMemorySnapshotStore(), ...(viaAnswerer ? { fetchImpl: transport.fetchImpl } : {}) }),
    async storeSecret(secret) {
      const sealed = await opened.store.stt.seal(secret);
      host.credential = { credential_kind: 'ENCRYPTED', credential_ref: sealed.keyRef, secret_ciphertext: sealed.ciphertext, nonce: sealed.nonce };
    },
  };
  return mounted;
}

const encryptedRow = (endpoint: string): StoredSttSelection => serverRow(endpoint, { credentialKind: 'ENCRYPTED' });
const target = (m: Mounted) => ({ enabled: true, backend: m.stored.backend, endpoint: m.stored.endpoint, model: m.stored.model, credentialKind: m.stored.credentialKind });
const options = (): { signal: AbortSignal; timeoutMs: number } => ({ signal: new AbortController().signal, timeoutMs: 3_000 });

describe('a stored ENCRYPTED credential: opened by the Core credential store, through the key-loader, for operation 92', () => {
  it('2 runs + the sweep: ONE authenticated GET /v1/models per test with the opened key; 0 hits of the key in logs, persisted errors and results', async () => {
    const omlx = await startFakeOmlx({ key: SECRET_CANARY });
    fakes.push(omlx);
    const m = mount('enc-probe', encryptedRow, omlx.endpoint);
    await m.storeSecret(SECRET_CANARY);
    const results: unknown[] = [];
    for (let run = 1; run <= 2; run += 1) {
      const result = await m.control.probe(target(m), options());
      results.push(result);
      expect(result).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
      expect(omlx.requests).toHaveLength(run);
    }
    // Positive control of the sweep: the key DID travel, in the one place it may.
    expect(omlx.requests.map((request) => `${request.method} ${request.url} ${request.authorization}`)).toEqual([`GET /v1/models Bearer ${SECRET_CANARY}`, `GET /v1/models Bearer ${SECRET_CANARY}`]);
    // One reveal per test, and the envelope in the database columns is not the key.
    expect(m.host.statements.filter((text) => text.includes('dems_stt_credential_reveal'))).toHaveLength(2);
    expect(Buffer.from(m.host.credential.secret_ciphertext ?? []).includes(Buffer.from(SECRET_CANARY))).toBe(false);

    // A refusal after the key was opened: the server wants another key. The log line of it holds no key.
    const strict = await startFakeOmlx({ key: 'another-key-the-server-wants' });
    fakes.push(strict);
    m.stored = encryptedRow(strict.endpoint);
    const rejected = await m.control.probe(target(m), options());
    results.push(rejected);
    expect(rejected).toEqual({ reachable: true, modelAvailable: false, detailCode: 'CREDENTIAL_REJECTED' });
    // And an endpoint nothing listens on: the transport failure is logged and persisted.
    const closed = await startFakeOmlx();
    await closed.close();
    m.stored = encryptedRow(closed.endpoint);
    const unreachable = await m.control.probe(target(m), options());
    results.push(unreachable);
    expect(unreachable).toMatchObject({ reachable: false, detailCode: 'UNREACHABLE' });
    expect(m.host.persisted.length).toBeGreaterThanOrEqual(1);

    const swept = `${m.host.everything()}\n${JSON.stringify(results)}\n${inspect(m.control, { depth: 8 })}\n${m.host.statements.join('\n')}`;
    expect(swept.length).toBeGreaterThan(200);
    for (const form of [SECRET_CANARY, Buffer.from(SECRET_CANARY).toString('base64'), encodeURIComponent(`Bearer ${SECRET_CANARY}`), 'Bearer ']) expect(swept.split(form).length - 1, form).toBe(0);
    console.info(`[passA] op-92 probe, ENCRYPTED via the real credential store | runs=2 requests=${omlx.requests.length} result=OK | canary hits in logs/persisted/results=0 (swept ${swept.length} chars; header seen by the fake=2)`);
  });

  it('an envelope that does not open (one flipped byte; a destroyed key): CREDENTIAL_UNAVAILABLE, NO connection, a code in the log, no key anywhere', async () => {
    const omlx = await startFakeOmlx({ key: SECRET_CANARY });
    fakes.push(omlx);
    const m = mount('enc-tamper', encryptedRow, omlx.endpoint);
    await m.storeSecret(SECRET_CANARY);
    const intact = m.host.credential;
    const flipped = new Uint8Array(intact.secret_ciphertext ?? []);
    flipped[flipped.length >> 1] = (flipped[flipped.length >> 1] ?? 0) ^ 0x01;
    m.host.credential = { ...intact, secret_ciphertext: flipped };
    expect(await m.control.probe(target(m), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'CREDENTIAL_UNAVAILABLE' });
    expect(omlx.requests).toEqual([]);
    expect(m.host.persisted.at(-1)).toMatchObject({ level: 'warn', code: 'CREDENTIAL_UNAVAILABLE', context: { reason: 'OPEN_FAILED' } });

    // Control: the SAME app with the intact envelope connects.
    m.host.credential = intact;
    expect(await m.control.probe(target(m), options())).toMatchObject({ reachable: true, detailCode: 'OK' });
    expect(omlx.requests).toHaveLength(1);

    // Key loss (SEC35-09): the key of the envelope is destroyed - the credential must be typed again.
    expect(m.store.credentialKeys.retainOnly(CredentialPurpose.STT_API_KEY, [])).toEqual([intact.credential_ref]);
    expect(await m.control.probe(target(m), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'CREDENTIAL_UNAVAILABLE' });
    expect(omlx.requests).toHaveLength(1);
    // The row changed to a REFERENCE under a test that was told ENCRYPTED: no connection either.
    m.host.credential = { credential_kind: 'REFERENCE', credential_ref: 'omlx-settings:auth.api_key', secret_ciphertext: null, nonce: null };
    expect(await m.control.probe(target(m), options())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'CREDENTIAL_UNAVAILABLE' });
    expect(omlx.requests).toHaveLength(1);
    expect(m.host.everything()).not.toContain(SECRET_CANARY);
  });
});

describe('a stored ENCRYPTED credential: the adapter of a session', () => {
  it('the session transcribes with the opened key (revealed and opened once); a session whose envelope does not open is UNAVAILABLE and sends nothing', async () => {
    const SESSION = 'SES-20310101-0901';
    const m = mount('enc-session', encryptedRow, 'http://127.0.0.1:18911', true);
    await m.storeSecret(SECRET_CANARY);
    expect(await m.control.snapshotSttConfigForSession(SESSION)).toMatchObject({ ok: true, snapshot: { credentialKind: 'ENCRYPTED' } });
    await m.control.settled();
    writeTap(sessionTapPath(mediaOf(m.dataDir), SESSION), 40);
    m.transport.calls.length = 0;
    m.transport.authorizations.length = 0;
    const reveals = (): number => m.host.statements.filter((text) => text.includes('dems_stt_credential_reveal')).length;
    const before = reveals();
    const open = await m.control.openSession(SESSION);
    if (open.state !== 'ENABLED') throw new Error(`the session is ${open.state}${'code' in open ? ` (${open.code})` : ''}`);
    const report = await open.step({ final: true });
    expect(report.complete).toBe(true);
    expect(report.decoded).toBeGreaterThanOrEqual(1);
    expect(reveals() - before).toBe(1);
    expect(m.transport.authorizations).toHaveLength(report.decoded);
    expect(new Set(m.transport.authorizations)).toEqual(new Set([`Bearer ${SECRET_CANARY}`]));
    open.close();
    const swept = `${m.host.everything()}\n${JSON.stringify(report)}\n${inspect(open, { depth: 8 })}\n${JSON.stringify(open.runner.checkpoint())}`;
    expect(swept).not.toContain(SECRET_CANARY);
    expect(swept).not.toContain('Bearer ');

    // The key of the envelope is gone: the NEXT session is not transcribed, and nothing is sent.
    const NEXT = 'SES-20310101-0902';
    await m.control.snapshotSttConfigForSession(NEXT);
    await m.control.settled();
    m.store.credentialKeys.retainOnly(CredentialPurpose.STT_API_KEY, []);
    m.transport.calls.length = 0;
    expect(await m.control.openSession(NEXT)).toMatchObject({ state: 'UNAVAILABLE', code: 'CREDENTIAL_UNAVAILABLE' });
    expect(m.transport.calls).toEqual([]);
    expect(m.host.everything()).not.toContain(SECRET_CANARY);
    console.info(`[passA] session adapter, ENCRYPTED via the real credential store | chunks=${report.decoded} header=opened key on every request, reveals=1 | key destroyed -> UNAVAILABLE CREDENTIAL_UNAVAILABLE, 0 requests`);
  });
});

describe('the engine guard of the pipeline is in the production composition (review finding N-2)', () => {
  const alive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  /**
   * The stand-in of an engine a killed Core left behind: a process that does nothing, that ignores
   * SIGTERM (so only a SIGKILL ends it) and that is NOT a child of this process. A shell starts it
   * in the background, prints its PID and ends: the stand-in then belongs to no living parent, as
   * a real orphan does.
   *
   * Why not a child (test-suite consolidation, test/14): the guard's reap is synchronous. A killed
   * CHILD of this process stays a zombie until the event loop collects it, which cannot happen
   * while the reap holds the loop, so the guard polled its whole bound (200 polls of 50 ms) for a
   * process that was already dead. That was 12 s of real waiting in this one case, measured in
   * every unit run (test/13 section 5.1), and it showed nothing about the product: no engine of a
   * killed Core is the new Core's child.
   */
  const orphanedStandIn = (): Promise<number> =>
    new Promise((resolve, reject) => {
      const shell = spawn('/bin/sh', ['-c', "trap '' TERM; /bin/sleep 120 >/dev/null 2>&1 & echo $!"], { stdio: ['ignore', 'pipe', 'ignore'] });
      let printed = '';
      shell.stdout.on('data', (chunk: Buffer) => {
        printed += chunk.toString('utf8');
      });
      shell.once('error', reject);
      shell.once('close', () => {
        const pid = Number(printed.trim());
        if (Number.isInteger(pid) && pid > 1) resolve(pid);
        else reject(new Error('the stand-in process did not start'));
      });
    });

  it('an engine a killed Core left running is reaped when the session is opened again, and its record is removed', async () => {
    const SESSION = 'SES-20310101-0903';
    const m = mount('guard', (endpoint) => serverRow(endpoint, { credentialKind: null }), 'http://127.0.0.1:18912', true);
    await m.control.snapshotSttConfigForSession(SESSION);
    await m.control.settled();
    writeTap(sessionTapPath(mediaOf(m.dataDir), SESSION), 2);
    const scratch = sessionScratchDir(mediaOf(m.dataDir), SESSION);
    mkdirSync(scratch, { recursive: true });

    // The stand-in of an orphaned engine, recorded as the pipeline records an engine.
    const pid = await orphanedStandIn();
    orphans.push(pid);
    // CONTROL: the signal a process may refuse does not end it. What ends it below is the guard's SIGKILL.
    process.kill(pid, 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(alive(pid)).toBe(true);
    createEngineGuard(scratch).record({ pid });
    const record = join(scratch, 'work', ENGINE_RECORD_FILE);
    expect(existsSync(record)).toBe(true);
    expect(alive(pid)).toBe(true);

    const open = await m.control.openSession(SESSION);
    expect(open.state).toBe('ENABLED');
    // The reap is done when `openSession` answers: the process that refused SIGTERM is gone, so it was killed.
    expect(alive(pid)).toBe(false);
    expect(existsSync(record)).toBe(false);
    if (open.state === 'ENABLED') open.close();
    console.info('[passA] engine guard in the mount | orphan pid recorded -> reaped at openSession (SIGTERM refused before, gone after), record removed');
  }, 20_000);
});
