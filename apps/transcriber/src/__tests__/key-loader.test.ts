// SEC35-14 — the single key-loader and the log-blanking rule. The key used here is a test value
// written to a scratch file; the real settings file of the host is never opened by this suite.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createTranscriberAdapter } from '../adapter';
import { createOmlxHttp } from '../backends/omlx-http';
import { resolveTranscriberConfig } from '../config';
import { CREDENTIAL_PLACEHOLDER, OMLX_CREDENTIAL_REF, bearerHeaderValue, credentialFromValue, credentialOf, defaultOmlxSettingsPath, loadCredential, openCredential, releaseCredential, scrubCredential } from '../key-loader';
import { createConnectionProbe } from '../probe';
import { CREDENTIAL_BLANK, redactCredentialText } from '@dems/shared/api';
import { LOG_FILE_NAME, blankText, createFileLog, createMemoryLog } from '../log';
import { TranscriberErrorCode, type EngineRunRecord } from '../types';
import { createFakeOmlx, pcmChunk, scratchDir, writeSettingsFile } from './support';

const KEY = 'unit-test-key-c41d77e2b9';

describe('SEC35-14: the single key-loader', () => {
  it('loads the referenced key into an opaque holder that never renders as text', () => {
    const credential = loadCredential(OMLX_CREDENTIAL_REF, { settingsPath: writeSettingsFile(KEY) });
    expect(credential).not.toBeNull();
    const renderings = [String(credential), `${credential}`, JSON.stringify(credential), JSON.stringify({ credential }), inspect(credential), inspect({ nested: { credential } }, { depth: 5 })];
    for (const text of renderings) {
      expect(text).toContain(CREDENTIAL_PLACEHOLDER);
      expect(text).not.toContain(KEY);
    }
    expect(Object.keys(credential!)).toEqual([]);
    expect(Object.getOwnPropertyNames(credential!)).toEqual([]);
    expect(Object.isFrozen(credential)).toBe(true);
    // Negative control of the opacity checks: the one sanctioned function does give the header.
    expect(bearerHeaderValue(credential!)).toBe(`Bearer ${KEY}`);
  });

  it('an empty key is "no credential", not an empty header', () => {
    expect(loadCredential(OMLX_CREDENTIAL_REF, { settingsPath: writeSettingsFile(null) })).toBeNull();
  });

  it('reads only the one member: another store, another member and key material in place of a reference are refused', () => {
    const settingsPath = writeSettingsFile(KEY);
    for (const ref of ['omlx-settings:auth.secret_key', 'omlx-settings:auth', 'env:OMLX_API_KEY', 'file:/etc/passwd', KEY, '']) {
      expect(() => loadCredential(ref, { settingsPath })).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_REF_UNSUPPORTED }));
    }
  });

  it('a store that cannot be read or parsed fails closed, and the error never quotes the file', () => {
    const dir = scratchDir('store');
    expect(() => loadCredential(OMLX_CREDENTIAL_REF, { settingsPath: join(dir, 'absent.json') })).toThrowError(
      expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, detail: { ref: OMLX_CREDENTIAL_REF, reason: 'ENOENT' } }),
    );
    const broken = join(dir, 'broken.json');
    writeFileSync(broken, `{"auth": {"api_key": "${KEY}" oops`);
    let caught: unknown;
    try {
      loadCredential(OMLX_CREDENTIAL_REF, { settingsPath: broken });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, detail: { reason: 'NOT_JSON' } });
    expect(`${(caught as Error).message} ${(caught as Error).stack} ${JSON.stringify((caught as { detail: unknown }).detail)}`).not.toContain(KEY);
    const notText = join(dir, 'number.json');
    writeFileSync(notText, JSON.stringify({ auth: { api_key: 12345 } }));
    expect(() => loadCredential(OMLX_CREDENTIAL_REF, { settingsPath: notText })).toThrowError(expect.objectContaining({ detail: { ref: OMLX_CREDENTIAL_REF, reason: 'NOT_TEXT' } }));
  });

  it('the default store is under the home directory of the host, not under the repository', () => {
    const path = defaultOmlxSettingsPath();
    expect(path.startsWith('/')).toBe(true);
    expect(path.includes('/DEMS/')).toBe(false);
  });

  it('a holder that is not of this loader gives no header', () => {
    const foreign = Object.create(Object.getPrototypeOf(credentialFromValue('x1'))) as Parameters<typeof bearerHeaderValue>[0];
    expect(() => bearerHeaderValue(foreign)).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE }));
    expect(() => credentialFromValue('')).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE }));
  });
});

describe('SEC35-14: the key reaches the loopback server as a header and nothing else', () => {
  it('is sent as Authorization on the request, with redirects refused, and appears in no result, record or log line', async () => {
    const omlx = createFakeOmlx({ key: KEY, models: ['server-model'] });
    const log = createMemoryLog();
    const runs: EngineRunRecord[] = [];
    const config = resolveTranscriberConfig(
      { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model', credentialRef: OMLX_CREDENTIAL_REF },
      { physicalCores: 10, omlxServer: { settingsPath: writeSettingsFile(KEY) } },
    );
    const adapter = createTranscriberAdapter(config, { log, fetchImpl: omlx.fetchImpl, onEngineRun: (record) => runs.push(record) });
    const result = await adapter.transcribe(pcmChunk(), { language: 'id', correlationId: 'corr-1' });

    expect(omlx.calls).toHaveLength(1);
    expect(omlx.calls[0]).toMatchObject({ method: 'POST', path: '/v1/audio/transcriptions', host: '127.0.0.1:8000', authorization: `Bearer ${KEY}`, redirect: 'error' });
    expect(omlx.calls[0]!.fields).toEqual({ model: 'server-model', language: 'id' });
    expect(omlx.calls[0]!.fileBytes).toBe(44 + 32_000);
    const everything = JSON.stringify({ result, runs, config, adapter: inspect(adapter, { depth: 6 }), log: log.lines });
    expect(everything).not.toContain(KEY);
    expect(everything).not.toContain('Bearer');
    expect(runs[0]).toMatchObject({ backend: 'omlx-server', argv: [], requestPath: '/v1/audio/transcriptions', status: 200 });
  });

  it('a wrong key is CREDENTIAL_REJECTED, and the log line of the refusal carries no key', async () => {
    const omlx = createFakeOmlx({ key: 'the-key-the-server-wants-88', models: ['server-model'] });
    const log = createMemoryLog();
    const config = resolveTranscriberConfig(
      { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model', credentialRef: OMLX_CREDENTIAL_REF },
      { physicalCores: 10, omlxServer: { settingsPath: writeSettingsFile(KEY) } },
    );
    await expect(createTranscriberAdapter(config, { log, fetchImpl: omlx.fetchImpl }).transcribe(pcmChunk(), { language: 'id', correlationId: 'corr-2' })).rejects.toMatchObject({
      code: TranscriberErrorCode.CREDENTIAL_REJECTED,
      detail: { status: 401 },
    });
    expect(log.records()).toHaveLength(1);
    expect(log.records()[0]).toMatchObject({ level: 'error', source: 'transcriber.omlxServer.transcribe', correlationId: 'corr-2', context: { code: 'CREDENTIAL_REJECTED', status: 401 } });
    expect(log.lines.join('\n')).not.toContain(KEY);
  });

  it('the HTTP client refuses any address that is not loopback, before a request and before the key is used', () => {
    const credential = credentialFromValue(KEY);
    for (const endpoint of ['http://192.168.1.20:8000', 'https://127.0.0.1:8000', 'http://localhost.evil.example:8000', 'http://user@127.0.0.1:8000', 'http://[::1]:8000', 'http://0.0.0.0:8000', 'http://127.0.0.1:99999']) {
      const omlx = createFakeOmlx({ key: KEY, models: [] });
      expect(() => createOmlxHttp({ endpoint, credential, timeoutMs: 1_000, fetchImpl: omlx.fetchImpl })).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.ENDPOINT_NOT_LOOPBACK }));
      expect(omlx.calls).toHaveLength(0);
    }
    // Negative control: the two loopback forms are accepted.
    for (const endpoint of ['http://127.0.0.1:8000', 'http://localhost:8000', 'http://127.0.0.1']) {
      expect(() => createOmlxHttp({ endpoint, credential, timeoutMs: 1_000 })).not.toThrow();
    }
  });

  it('a transport failure keeps its code only: the message of the cause is not passed on', async () => {
    const credential = credentialFromValue(KEY);
    const http = createOmlxHttp({
      endpoint: 'http://127.0.0.1:8000',
      credential,
      timeoutMs: 1_000,
      fetchImpl: async (_input, init) => {
        throw new TypeError(`fetch failed for headers ${new Headers(init.headers).get('authorization')}`, { cause: Object.assign(new Error('x'), { code: 'ECONNRESET' }) });
      },
    });
    let caught: unknown;
    try {
      await http.get('/v1/models');
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: TranscriberErrorCode.UNREACHABLE, detail: { transport: 'ECONNRESET', path: '/v1/models' } });
    expect(`${(caught as Error).message} ${JSON.stringify((caught as { detail: unknown }).detail)}`).not.toContain(KEY);
  });

  it('a request that does not answer within its bound is TIMEOUT', async () => {
    const http = createOmlxHttp({
      endpoint: 'http://127.0.0.1:8000',
      credential: null,
      timeoutMs: 30,
      fetchImpl: (_input, init) => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error))),
    });
    await expect(http.get('/v1/models')).rejects.toMatchObject({ code: TranscriberErrorCode.TIMEOUT });
  });
});

describe('SEC35-14 / E-31: the log-blanking rule', () => {
  it('blanks by position with the ONE shared rule set of the client logs (`@dems/shared/api`, row 113)', () => {
    expect(blankText('Authorization: Bearer abc.DEF-123_x')).toBe(redactCredentialText('Authorization: Bearer abc.DEF-123_x'));
    expect(blankText('Authorization: Bearer abc.DEF-123_x')).toBe(`Authorization: ${CREDENTIAL_BLANK}`);
    expect(blankText('got header Bearer abc.DEF-123_x, retrying')).toBe(`got header Bearer ${CREDENTIAL_BLANK}, retrying`);
    expect(blankText('{"api_key":"abc123","model":"m"}')).toBe(`{"api_key":"${CREDENTIAL_BLANK}","model":"m"}`);
    // An unquoted value fails closed: it is blanked to the next separator, whatever follows.
    expect(blankText('apiKey=abc123 secret_key: zzz x-api-key=qq')).toBe(`apiKey=${CREDENTIAL_BLANK}`);
    // Inside a JSON string (a quoted answer in a log line): blanked, and the line still parses.
    const nested = JSON.stringify({ message: 'server said {"api_key":"abc123"}' });
    expect(JSON.parse(blankText(nested))).toEqual({ message: `server said {"api_key":"${CREDENTIAL_BLANK}"}` });
  });

  it('blanks by value: the protected key in any position, with no marker beside it', () => {
    const credential = credentialFromValue(KEY);
    expect(blankText(`engine said ${KEY} and again ${KEY}`, [credential])).toBe(`engine said ${CREDENTIAL_PLACEHOLDER} and again ${CREDENTIAL_PLACEHOLDER}`);
    expect(scrubCredential(`x${KEY}y`, credential)).toBe(`x${CREDENTIAL_PLACEHOLDER}y`);
    // Negative control: without protection a bare value is not recognisable, which is why it is protected.
    expect(blankText(`engine said ${KEY}`)).toBe(`engine said ${KEY}`);
  });

  it('blanks by value a key that JSON writes with escapes: a quote, a backslash, a non-ASCII character (N-10)', () => {
    for (const awkward of ['pa"ss\\word-9f2', 'kunci-rahasia-é-ü-41', 'tab\there-77', 'slash\\\\and"quote-3', 'a+b/c=d e&f-12']) {
      const credential = credentialFromValue(awkward);
      const log = createMemoryLog();
      log.protect(credential);
      // The key in a message, in a context value, in an error, and inside a JSON text inside a message.
      log.error({ source: 'transcriber.test', message: `server echoed ${awkward}`, error: new Error(`cause ${awkward}`), context: { echoed: awkward, nested: JSON.stringify({ k: awkward }) } });
      log.warn({ source: 'transcriber.test', message: `in a url ?k=${encodeURIComponent(awkward)} and as base64 ${Buffer.from(awkward).toString('base64')}` });
      const written = log.lines.join('\n');
      for (const form of [awkward, JSON.stringify(awkward).slice(1, -1), JSON.stringify(JSON.stringify(awkward)).slice(2, -2), encodeURIComponent(awkward), Buffer.from(awkward).toString('base64')]) {
        expect(written.includes(form), `the form ${JSON.stringify(form)} of a test key is in the log`).toBe(false);
      }
      // The line is still one JSON record, and what is around the key is still there.
      const records = log.records();
      expect(records[0]!.message).toBe(`server echoed ${CREDENTIAL_PLACEHOLDER}: cause ${CREDENTIAL_PLACEHOLDER}`);
      expect(records[0]!.context['echoed']).toBe(CREDENTIAL_PLACEHOLDER);
      // Negative control: the same record without protection keeps the key (so the check above can fail).
      const open = createMemoryLog();
      open.error({ source: 'transcriber.test', message: `server echoed ${awkward}` });
      expect(open.records()[0]!.message).toBe(`server echoed ${awkward}`);
    }
  });

  it('a member that is NAMED like a credential is blanked whatever it holds, at any depth of the record', () => {
    const log = createMemoryLog();
    log.error({ source: 'transcriber.test', message: 'x', context: { apiKey: 'not-protected-value-1', authorization: 'Basic abc', model: 'm' } as never });
    expect(log.records()[0]!.context).toEqual({ apiKey: CREDENTIAL_BLANK, authorization: CREDENTIAL_BLANK, model: 'm' });
  });

  it('leaves ordinary members alone (no over-blanking of a transcript)', () => {
    const line = '{"tokens":[1,2],"text":"Selamat pagi","model":"m","code":"UNREACHABLE"}';
    expect(blankText(line)).toBe(line);
  });

  it('the persistent log writes one structured, blanked JSON line per event and rotates by size', () => {
    const dir = join(scratchDir('log'), 'nested', 'logs');
    const log = createFileLog({ dir, rotateBytes: 600, now: () => new Date('2026-10-09T03:00:00.000Z') });
    const credential = credentialFromValue(KEY);
    log.protect(credential);
    log.error({ source: 'transcriber.test', message: 'request failed', error: new Error(`server echoed ${KEY} and Authorization: Bearer ${KEY}`), context: { code: 'ENGINE_FAILED', status: 500 }, correlationId: 'corr-9' });
    const file = join(dir, LOG_FILE_NAME);
    const text = readFileSync(file, 'utf8');
    expect(text).not.toContain(KEY);
    const record = JSON.parse(text.trim()) as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual(['context', 'correlationId', 'level', 'message', 'source', 'stackTrace', 'timestamp']);
    expect(record).toMatchObject({ timestamp: '2026-10-09T03:00:00.000Z', level: 'error', source: 'transcriber.test', correlationId: 'corr-9', context: { code: 'ENGINE_FAILED', status: 500 } });
    expect(String(record['stackTrace'])).toContain('Error: server echoed');

    expect(existsSync(`${file}.1`)).toBe(false);
    log.warn({ source: 'transcriber.test', message: 'second' });
    log.info({ source: 'transcriber.test', message: 'third' });
    expect(existsSync(`${file}.1`)).toBe(true);
    expect(readFileSync(file, 'utf8').trim().split('\n').map((line) => (JSON.parse(line) as { message: string }).message)).toEqual(['second', 'third']);
    expect((JSON.parse(readFileSync(`${file}.1`, 'utf8').trim()) as { message: string }).message).toContain('request failed');
  });
});

// Integration pass A: the opener path of an ENCRYPTED credential. The opener is a plain function
// of the composition; this workspace imports no credential store.
describe('SEC35-14: an ENCRYPTED credential comes through an opener the composition hands in', () => {
  const OPENED = ['opened', 'CANARY', 'passA', 'Qm4Zt8Rb1Ny6'].join('-');
  const runtime = { physicalCores: 10, omlxServer: { settingsPath: writeSettingsFile(KEY) } };
  const selection = { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000', model: 'server-model' };
  const probeOptions = (): { signal: AbortSignal; timeoutMs: number } => ({ signal: new AbortController().signal, timeoutMs: 1_000 });

  it('the opened key is held opaquely, and the same one function gives the header', () => {
    const credential = openCredential({ open: () => OPENED });
    for (const text of [String(credential), JSON.stringify({ credential }), inspect({ nested: { credential } }, { depth: 5 })]) expect(text).not.toContain(OPENED);
    expect(Object.getOwnPropertyNames(credential)).toEqual([]);
    expect(bearerHeaderValue(credential)).toBe(`Bearer ${OPENED}`);
    // Released: the holder gives no header and scrubs nothing any more.
    releaseCredential(credential);
    expect(() => bearerHeaderValue(credential)).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE }));
  });

  it('no opener, an opener that throws, and one that returns nothing are CREDENTIAL_UNAVAILABLE; a thrown message is never passed on', () => {
    expect(() => openCredential({})).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, detail: { reason: 'NO_OPENER' } }));
    let caught: unknown;
    try {
      openCredential({
        open: () => {
          throw Object.assign(new Error(`the envelope of ${OPENED} did not open`), { code: 'CREDENTIAL_OPEN_FAILED' });
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, detail: { reason: 'OPEN_FAILED', openerCode: 'CREDENTIAL_OPEN_FAILED' } });
    expect(`${(caught as Error).message} ${(caught as Error).stack} ${JSON.stringify(caught)} ${inspect(caught, { depth: 6 })}`).not.toContain(OPENED);
    // A `code` that is not of the form of a code (it could be a value) is dropped.
    expect(() =>
      openCredential({
        open: () => {
          throw Object.assign(new Error('x'), { code: `key=${OPENED}` });
        },
      }),
    ).toThrowError(expect.objectContaining({ detail: { reason: 'OPEN_FAILED' } }));
    expect(() => openCredential({ open: () => '' })).toThrowError(expect.objectContaining({ detail: { reason: 'EMPTY' } }));
    expect(() => openCredential({ open: () => 7 as unknown as string })).toThrowError(expect.objectContaining({ detail: { reason: 'NOT_TEXT' } }));
    // One request has one credential: a reference AND an encrypted source is refused before the opener is asked.
    let asked = 0;
    expect(() => credentialOf({ credentialRef: OMLX_CREDENTIAL_REF, settingsPath: null }, { open: () => ((asked += 1), OPENED) })).toThrowError(expect.objectContaining({ detail: { reason: 'AMBIGUOUS' } }));
    expect(asked).toBe(0);
  });

  it('the probe: ONE request with the opened key, asked once per test, in no log line; the holder is empty afterwards', async () => {
    const omlx = createFakeOmlx({ key: OPENED, models: ['server-model'] });
    const memory = createMemoryLog();
    // The holders the probe hands to the log: the only way a test can reach them.
    const held: Parameters<typeof bearerHeaderValue>[0][] = [];
    const log = { ...memory, protect: (credential: Parameters<typeof memory.protect>[0]) => (credential === null ? undefined : void held.push(credential), memory.protect(credential)) };
    let opened = 0;
    const probe = createConnectionProbe({ runtime, log, credentialRef: () => null, fetchImpl: omlx.fetchImpl, encryptedCredential: { open: () => ((opened += 1), OPENED) } });
    for (let run = 1; run <= 2; run += 1) {
      expect(await probe({ enabled: true, ...selection }, probeOptions())).toEqual({ reachable: true, modelAvailable: true, detailCode: 'OK' });
      expect(opened).toBe(run);
    }
    // Request scope: each test had its own holder, and each is empty once its request is over.
    expect(held).toHaveLength(2);
    for (const credential of held) expect(() => bearerHeaderValue(credential)).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE }));
    expect(omlx.calls.map((call) => `${call.method} ${call.path} ${call.authorization}`)).toEqual([`GET /v1/models Bearer ${OPENED}`, `GET /v1/models Bearer ${OPENED}`]);
    expect(log.lines.join('\n')).not.toContain(OPENED);
    // Control: the key of the settings file (the reference path) is NOT what was sent.
    expect(JSON.stringify(omlx.calls)).not.toContain(KEY);
  });

  it('the probe without an opener, or with one that fails: no request at all, and the refusal is logged by code only', async () => {
    const omlx = createFakeOmlx({ key: OPENED, models: ['server-model'] });
    const log = createMemoryLog();
    const none = createConnectionProbe({ runtime, log, credentialRef: () => null, fetchImpl: omlx.fetchImpl, encryptedCredential: {} });
    expect(await none({ enabled: true, ...selection }, probeOptions())).toEqual({ reachable: false, modelAvailable: false, detailCode: 'CREDENTIAL_REJECTED' });
    const failing = createConnectionProbe({
      runtime,
      log,
      credentialRef: () => null,
      fetchImpl: omlx.fetchImpl,
      encryptedCredential: {
        open: () => {
          throw new Error(`cannot open ${OPENED}`);
        },
      },
    });
    expect(await failing({ enabled: true, ...selection }, probeOptions())).toMatchObject({ reachable: false });
    expect(omlx.calls).toEqual([]);
    expect(log.records()).toHaveLength(2);
    expect(log.lines.join('\n')).not.toContain(OPENED);
    // Control: without the statement "encrypted" the same probe connects (no credential: 401 from this fake).
    const plain = createConnectionProbe({ runtime, log, credentialRef: () => null, fetchImpl: omlx.fetchImpl });
    expect(await plain({ enabled: true, ...selection }, probeOptions())).toMatchObject({ reachable: true, detailCode: 'CREDENTIAL_REJECTED' });
    expect(omlx.calls).toHaveLength(1);
  });

  it('the adapter: built with the opened key (asked once, kept for its lifetime), sent as the header, in no result, record or log line', async () => {
    const omlx = createFakeOmlx({ key: OPENED, models: ['server-model'] });
    const log = createMemoryLog();
    const config = resolveTranscriberConfig(selection, runtime);
    let opened = 0;
    const adapter = createTranscriberAdapter(config, { log, fetchImpl: omlx.fetchImpl, encryptedCredential: { open: () => ((opened += 1), OPENED) } });
    const results = [await adapter.transcribe(pcmChunk(), { language: 'id', correlationId: 'corr-e1' }), await adapter.transcribe(pcmChunk(), { language: 'id', correlationId: 'corr-e2' })];
    expect(opened).toBe(1);
    expect(omlx.calls.map((call) => call.authorization)).toEqual([`Bearer ${OPENED}`, `Bearer ${OPENED}`]);
    expect(JSON.stringify({ results, config, adapter: inspect(adapter, { depth: 6 }), log: log.lines })).not.toContain(OPENED);
    // No opener: the adapter is not built, and nothing is sent.
    const before = omlx.calls.length;
    expect(() => createTranscriberAdapter(config, { log, fetchImpl: omlx.fetchImpl, encryptedCredential: {} })).toThrowError(expect.objectContaining({ code: TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, detail: { reason: 'NO_OPENER' } }));
    expect(omlx.calls).toHaveLength(before);
  });
});
