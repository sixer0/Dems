// Operation 91 with the Core credential store (blueprint row 84; D68(c); SEC35-03; C3 §2.5): the
// `SECRET` write that answered 503 until the store existed. In-process, on the stand-in pool of
// this folder's support, with a data directory in the system's temporary folder: the app then has
// a store, and the module takes its sealer from it when the app is ready. What PostgreSQL says to
// the same write is the subject of `credential-store.db.test.ts`.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OperatorRole } from '@dems/shared/sim';
import { afterEach, describe, expect, it } from 'vitest';
import { coreCredentialStore, type CoreCredentialStore } from '../../../credential-store';
import { SEEDED_ROW, STT_PATH, haystacksOf, hitsOf, operator, outcome, sttApp, testSealer, type SttApp } from './support';

const SUPERVISOR = operator(OperatorRole.SUPERVISOR, 'OPR-003');
/** Planted in requests only. Built from parts, so that no other file of the repository holds it. */
const CANARY = ['stt', 'CANARY', 'row84', 'Vb6Jn3Rc8Yd1'].join('-');

const apps: SttApp[] = [];
const folders: string[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

async function build(prepare?: (dataDir: string) => void): Promise<{ stt: SttApp; dataDir: string; errorLogFile: string }> {
  const dataDir = mkdtempSync(join(tmpdir(), 'dems-row84-stt-'));
  folders.push(dataDir);
  prepare?.(dataDir);
  const errorLogFile = join(dataDir, 'error.log');
  const stt = await sttApp({ dataDir, errorLogFile });
  apps.push(stt);
  return { stt, dataDir, errorLogFile };
}

function storeOf(stt: SttApp): CoreCredentialStore {
  const opened = coreCredentialStore(stt.app);
  if (opened.status !== 'READY') throw new Error(`the store is ${opened.status}`);
  return opened.store;
}

const keyFiles = (dataDir: string): string[] => (existsSync(join(dataDir, 'credential-store', 'keys')) ? readdirSync(join(dataDir, 'credential-store', 'keys')) : []);

describe('a SECRET write with the Core credential store', () => {
  it('answers 200 with credentialKind ENCRYPTED; the row holds a key reference, a nonce and a padded envelope the store opens', async () => {
    const { stt, dataDir } = await build();
    expect(stt.control.hasCredentialSealer()).toBe(true);
    stt.actAs(SUPERVISOR);
    const response = await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: CANARY } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ credentialSet: true, credentialKind: 'ENCRYPTED', revision: 2 });
    const row = stt.db.row();
    expect(row?.credential_kind).toBe('ENCRYPTED');
    expect(row?.credential_ref).toMatch(/^STT_API_KEY_K_[0-9A-F]{20}$/);
    expect([row?.nonce?.byteLength, row?.secret_ciphertext?.byteLength]).toEqual([12, 80]);
    expect(keyFiles(dataDir)).toEqual([`${row?.credential_ref}.key`]);
    // THE OPENER (what row 115 hands the transcriber's key-loader): the three stored values in, the key out.
    const opened = storeOf(stt).stt.open({ keyRef: row?.credential_ref ?? '', ciphertext: new Uint8Array(row?.secret_ciphertext ?? []), nonce: new Uint8Array(row?.nonce ?? []) });
    expect(opened).toBe(CANARY);
  });

  it('a one-character secret is stored as 80 bytes of ciphertext (F-122-2), and opens', async () => {
    const { stt } = await build();
    stt.actAs(SUPERVISOR);
    expect((await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: 'k' } })).statusCode).toBe(200);
    const row = stt.db.row();
    expect(row?.secret_ciphertext?.byteLength).toBe(80);
    expect(storeOf(stt).stt.open({ keyRef: row?.credential_ref ?? '', ciphertext: new Uint8Array(row?.secret_ciphertext ?? []), nonce: new Uint8Array(row?.nonce ?? []) })).toBe('k');
  });

  it('the canary is in no answer, no log line at trace level, no error-log entry, no audit row, no event, and not in the stored row or the key file', async () => {
    const { stt, dataDir, errorLogFile } = await build();
    stt.actAs(SUPERVISOR);
    expect((await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: CANARY } })).statusCode).toBe(200);
    // Refusals that carry the canary too: a stale revision, a value outside the contract.
    expect(outcome(await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: CANARY } }))[0]).toBe(409);
    expect(outcome(await stt.post(STT_PATH, { revision: 2, backend: 'cloud', credential: { kind: 'SECRET', value: CANARY } }))[0]).toBe(422);
    await stt.get();
    await stt.app.pipeline.drain();
    const haystacks = haystacksOf(stt, existsSync(errorLogFile) ? readFileSync(errorLogFile, 'utf8') : '');
    const hits = hitsOf(haystacks, CANARY);
    const stored = stt.db.updates.flatMap((update) => update.values.map((value) => (Buffer.isBuffer(value) ? value.toString('latin1') : String(value)))).join('\n');
    const keys = keyFiles(dataDir).map((name) => readFileSync(join(dataDir, 'credential-store', 'keys', name)).toString('latin1')).join('\n');
    const base64 = Buffer.from(CANARY).toString('base64');
    console.info(`[row84] STT canary | responses=${hits.responses} logs=${hits.logs} errorLog=${hits.errorLog} auditRows=${hits.auditRows} events=${hits.events} | storedRow=${stored.split(CANARY).length - 1} keyFiles=${keys.split(CANARY).length - 1} | logBytes=${haystacks.logs.length} auditBytes=${haystacks.auditRows.length}`);
    expect(hits).toEqual({ responses: 0, logs: 0, errorLog: 0, auditRows: 0, events: 0 });
    for (const text of [stored, keys, haystacks.logs, haystacks.auditRows, haystacks.events, haystacks.responses]) {
      expect(text).not.toContain(CANARY);
      expect(text).not.toContain(base64);
    }
    // Negative control: the search does find a value that IS logged and one that IS stored.
    expect(haystacks.logs.split('STT_CONFIG_CHANGED').length - 1).toBeGreaterThanOrEqual(1);
    expect(stored).toContain('STT_API_KEY_K_');
    // No key reference and no key in a log line or an audit row either.
    expect(haystacks.logs).not.toContain('STT_API_KEY_K_');
    expect(haystacks.auditRows).not.toContain('STT_API_KEY_K_');
  });

  it('a refused body seals nothing: no key is left in the store', async () => {
    const { stt, dataDir } = await build();
    stt.actAs(SUPERVISOR);
    expect(outcome(await stt.post(STT_PATH, { revision: 9, credential: { kind: 'SECRET', value: CANARY } }))[0]).toBe(409);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, backend: 'cloud', credential: { kind: 'SECRET', value: CANARY } }))[0]).toBe(422);
    expect(keyFiles(dataDir)).toEqual([]);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
  });

  it('writing the secret again is its rotation: a new key and a new reference; the hook destroys the replaced key', async () => {
    const { stt, dataDir } = await build();
    stt.actAs(SUPERVISOR);
    await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: 'first-secret' } });
    const first = stt.db.row()?.credential_ref ?? '';
    await stt.post(STT_PATH, { revision: 2, credential: { kind: 'SECRET', value: 'second-secret' } });
    const second = stt.db.row()?.credential_ref ?? '';
    expect(second).not.toBe(first);
    expect(keyFiles(dataDir).sort()).toEqual([`${first}.key`, `${second}.key`].sort());
    expect(storeOf(stt).credentialKeys.retainOnly('STT_API_KEY', [second])).toEqual([first]);
    expect(keyFiles(dataDir)).toEqual([`${second}.key`]);
  });

  it('a sealer handed in wins over the store (a test states what a sealer is given)', async () => {
    const { stt, dataDir } = await build();
    const sealer = testSealer();
    stt.control.provideCredentialSealer(sealer);
    stt.actAs(SUPERVISOR);
    expect((await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: CANARY } })).statusCode).toBe(200);
    expect(stt.db.row()?.credential_ref).toBe('TEST_STT_KEY_1');
    expect(keyFiles(dataDir)).toEqual([]);
  });
});

describe('without a usable store the write answers as before', () => {
  it('no data directory: 503 NOT_READY (CREDENTIAL_STORE_NOT_READY), nothing stored, nothing logged as a fault', async () => {
    const stt = await sttApp();
    apps.push(stt);
    expect(coreCredentialStore(stt.app)).toEqual({ status: 'ABSENT' });
    expect(stt.control.hasCredentialSealer()).toBe(false);
    stt.actAs(SUPERVISOR);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: CANARY } }))).toEqual([503, 'NOT_READY', 'CREDENTIAL_STORE_NOT_READY']);
    expect(stt.db.updates).toEqual([]);
    expect(stt.log.text()).not.toContain('CREDENTIAL_STORE_UNSAFE');
  });

  it('a store directory that others may read is refused: 503, the fault is in the log and the error log by its code, nothing is sealed', async () => {
    const { stt, dataDir, errorLogFile } = await build((folder) => {
      mkdirSync(join(folder, 'credential-store'));
      chmodSync(join(folder, 'credential-store'), 0o755);
    });
    expect(stt.control.hasCredentialSealer()).toBe(false);
    stt.actAs(SUPERVISOR);
    expect(outcome(await stt.post(STT_PATH, { revision: 1, credential: { kind: 'SECRET', value: CANARY } }))).toEqual([503, 'NOT_READY', 'CREDENTIAL_STORE_NOT_READY']);
    expect(stt.db.row()).toEqual(SEEDED_ROW);
    expect(keyFiles(dataDir)).toEqual([]);
    const line = stt.log.lines().find((entry) => entry['code'] === 'CREDENTIAL_STORE_UNSAFE');
    expect(line).toMatchObject({ level: 50, source: 'sttConfig.credentialStore' });
    const persisted = readFileSync(errorLogFile, 'utf8');
    expect(persisted).toContain('"code":"CREDENTIAL_STORE_UNSAFE"');
    expect(persisted).not.toContain(dataDir);
    expect(persisted).not.toContain(CANARY);
  });
});
