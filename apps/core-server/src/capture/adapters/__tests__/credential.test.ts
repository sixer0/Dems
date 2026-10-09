// SEC35-04 at run time (blueprint row 65; capture spec §A.6 "Credential handling", §A.6.3 CR-1 to
// CR-7): a credential VALUE never reaches a log line, the persistent error log, an audit detail,
// an error, a result, a JSON text or an inspection, and a locator with a user part is composed
// nowhere: the two values and the locator meet in `credentialAtInjection` only, as separate
// members.
//
// A canary pair is sent through every channel this layer has, and every captured text is
// searched for it. The negative controls prove the search: the same channels DO show the canary
// when it is passed as a plain value, and the injection result holds it by design.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { SERVER_AUDIT_DETAIL_RULES } from '../../../core/audit-details';
import { describeError } from '../../../plugins/logger';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import {
  CREDENTIAL_MARK,
  CaptureAdapterError,
  CaptureAdapterKind,
  blankCredentialLocators,
  createFakeCameraAdapter,
  createFakeRegistry,
  credentialAtInjection,
  credentialFreeLocator,
  sealCredential,
  streamLocator,
  usingCredential,
  type CameraCandidate,
} from '../index';

const CANARY = { username: 'canary-user-4e81c7', secret: 'canary-secret-9d02fa' } as const;
const CANARIES = [CANARY.username, CANARY.secret];
/** A locator with the canary as its user part: what must never be composed, built here from parts. */
const WITH_USER_PART = ['rtsp:', '', `${CANARY.username}:${CANARY.secret}@192.0.2.10:554`, 'stream', 'main'].join('/');
const PLAIN = ['rtsp:', '', '192.0.2.10:554', 'stream', 'main'].join('/');
const leaks = (text: string): string[] => CANARIES.filter((canary) => text.includes(canary));
const everything = (value: unknown): string =>
  [
    String(value),
    `${value as string}`,
    JSON.stringify(value) ?? '',
    JSON.stringify({ wrapped: value, list: [value] }),
    inspect(value, { depth: 8, showHidden: true, getters: true }),
    inspect({ wrapped: value }, { depth: 8, showHidden: true }),
    Object.entries(value as object).join(),
    JSON.stringify(Object.getOwnPropertyNames(value as object).map((name) => (value as Record<string, unknown>)[name])),
    JSON.stringify({ ...(value as object) }),
    value instanceof Error ? `${value.message}\n${value.stack}\n${JSON.stringify(describeError(value))}` : '',
  ].join('\n');
const candidate: CameraCandidate = { adapterKind: CaptureAdapterKind.FAKE, host: '127.0.0.1', serviceAddress: null, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false };
const thrownBy = async (work: () => unknown): Promise<unknown> => {
  try {
    await work();
  } catch (error) {
    return error;
  }
  throw new Error('nothing was thrown');
};

const logDir = mkdtempSync(join(tmpdir(), 'dems-row65-'));
afterAll(() => rmSync(logDir, { recursive: true, force: true }));

describe('a sealed credential shows nothing', () => {
  it('as text, as JSON, in an inspection, spread, cloned or enumerated', () => {
    const sealed = sealCredential(CANARY);
    expect(leaks(everything(sealed))).toEqual([]);
    expect(String(sealed)).toBe(CREDENTIAL_MARK);
    expect(JSON.stringify({ credential: sealed })).toBe(`{"credential":"${CREDENTIAL_MARK}"}`);
    expect(Object.keys(sealed)).toEqual([]);
    expect(() => structuredClone(sealed)).not.toThrow();
    expect(leaks(everything(structuredClone(sealed)))).toEqual([]);
    // Negative control: the same search finds the plain pair.
    expect(leaks(everything(CANARY))).toEqual(CANARIES);
  });

  it('is read by the one call it is handed to, and by nothing that outlives it', () => {
    const sealed = sealCredential(CANARY);
    expect(usingCredential(sealed, (credential) => credential.username.length + credential.secret.length)).toBe(CANARY.username.length + CANARY.secret.length);
    // A copy of the object is not the object: it opens nothing.
    expect(() => usingCredential(structuredClone(sealed), () => 1)).toThrow(CaptureAdapterError);
  });
});

describe('a locator never carries a user part', () => {
  it('the host-and-path form passes; a user part, a query, a trailing slash and another scheme are refused without naming the input', async () => {
    expect(credentialFreeLocator(PLAIN)).toBe(PLAIN);
    expect(streamLocator({ host: '192.0.2.10', port: 554, path: 'stream/main' })).toBe(PLAIN);
    const refused = [WITH_USER_PART, PLAIN.replace('192.0.2.10', `${CANARY.username}@192.0.2.10`), `${PLAIN}?token=${CANARY.secret}`, `${PLAIN}#${CANARY.secret}`, `${PLAIN}/`, PLAIN.replace('rtsp:', 'http:'), `${CANARY.secret}`, ''];
    for (const locator of refused) {
      const error = await thrownBy(() => credentialFreeLocator(locator, 'CAM-03'));
      expect(error).toBeInstanceOf(CaptureAdapterError);
      expect(error).toMatchObject({ code: 'CAPTURE_LOCATOR_INVALID', deviceId: 'CAM-03' });
      expect(leaks(everything(error))).toEqual([]);
    }
    // The composer cannot produce a user part either: a host that smuggles one is refused.
    expect(leaks(everything(await thrownBy(() => streamLocator({ host: `${CANARY.username}:${CANARY.secret}@192.0.2.10`, path: 'stream' }))))).toEqual([]);
  });

  it('the injection point is where the two meet: separate members, and the locator stays free of them', async () => {
    const injected = credentialAtInjection(PLAIN, sealCredential(CANARY));
    expect(injected).toEqual({ locator: PLAIN, username: CANARY.username, secret: CANARY.secret });
    expect(leaks(injected.locator)).toEqual([]);
    expect(Object.isFrozen(injected)).toBe(true);
    // It refuses a locator that already carries a user part, and its refusal shows nothing.
    expect(leaks(everything(await thrownBy(() => credentialAtInjection(WITH_USER_PART, sealCredential(CANARY)))))).toEqual([]);
    // Negative control: the injection result is the one value that holds the canary, by design.
    expect(leaks(everything(injected))).toEqual(CANARIES);
  });

  it('text the Core did not write is blanked before any of it is kept', () => {
    const foreign = `Connection to ${WITH_USER_PART} failed; retry ${WITH_USER_PART.replace('rtsp:', 'http:')} later, or ${PLAIN}`;
    expect(leaks(foreign)).toEqual(CANARIES);
    const blanked = blankCredentialLocators(foreign);
    expect(leaks(blanked)).toEqual([]);
    expect(blanked).toContain(`${CREDENTIAL_MARK}@192.0.2.10:554/stream/main`);
    expect(blanked).toContain(PLAIN);
  });
});

describe('the canary through every channel of the layer', () => {
  it('results, recorded calls, descriptors, errors, the log, the persistent error log and the audit detail rules hold no credential value', async () => {
    const log = captureLog();
    const errorLogFile = join(logDir, 'errors.log');
    const app = buildApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: log.stream, errorLogFile });
    await app.ready();
    const sealed = sealCredential(CANARY);
    const captured: string[] = [];

    // 1. The adapter: both answers of a test with a credential, what the fake recorded, the registry's view.
    const camera = createFakeCameraAdapter({ id: 'CAM-01', authenticate: (credential) => credential.secret === CANARY.secret && credential.username === CANARY.username });
    const accepted = await camera.testConnection(candidate, sealed, new AbortController().signal);
    const refused = await camera.testConnection(candidate, sealCredential({ username: CANARY.username, secret: `${CANARY.secret}-wrong` }), new AbortController().signal);
    expect([accepted.outcome, refused.outcome]).toEqual(['REACHABLE', 'AUTHENTICATION_FAILED']);
    const { registry } = createFakeRegistry({ runDir: '/nonexistent/dems-run/capture', camera: { authenticate: () => true } });
    captured.push(everything(accepted), everything(refused), everything(camera.calls), everything(camera), JSON.stringify(registry.list()), inspect(registry, { depth: 8 }));

    // 2. Errors: every refusal of the layer that a credential or a credential-bearing text can meet.
    const errors = [
      await thrownBy(() => camera.testConnection(candidate, sealed, AbortSignal.abort())),
      await thrownBy(() => credentialFreeLocator(WITH_USER_PART)),
      await thrownBy(() => credentialAtInjection(WITH_USER_PART, sealed)),
      await thrownBy(() => registry.assertAssignable('CAMERA', WITH_USER_PART)),
      await thrownBy(() => registry.resolve('CAMERA', CANARY.secret)),
      await thrownBy(() => camera.pullUrl('CAM-01', CANARY.secret)),
      await thrownBy(() => camera.openSource(CANARY.secret, { ingestUrl: WITH_USER_PART }, new AbortController().signal)),
    ];
    for (const error of errors) expect(error).toBeInstanceOf(CaptureAdapterError);
    captured.push(...errors.map(everything));

    // 3. The log and the persistent error log, written the way the capture module writes them:
    //    a logged object, a logged error, and an error-log row built by `describeError`.
    for (const error of errors) {
      app.log.error({ err: error, code: (error as CaptureAdapterError).code, deviceId: (error as CaptureAdapterError).deviceId, credential: sealed, result: accepted }, 'a capture adapter refused');
      app.errorLog.append({ level: 'error', source: 'capture.adapters', message: 'a capture adapter refused', ...describeError(error), code: (error as CaptureAdapterError).code, context: { deviceId: (error as CaptureAdapterError).deviceId } });
    }
    app.log.info({ sealed, list: [sealed], outcome: accepted.outcome }, `tested with ${String(sealed)}`);
    await app.close();
    const logText = log.text();
    const errorLogText = readFileSync(errorLogFile, 'utf8');
    expect(log.lines().length).toBeGreaterThanOrEqual(errors.length + 1);
    expect(errorLogText.split('\n').filter((line) => line !== '')).toHaveLength(errors.length);
    captured.push(logText, errorLogText);

    expect(captured.flatMap(leaks)).toEqual([]);
    expect(captured.join('\n')).not.toContain('@192.0.2.10');

    // 4. Audit: no detail key of a capture audit type takes a credential value or a locator with a user part.
    const captureTypes = Object.entries(SERVER_AUDIT_DETAIL_RULES).filter(([type]) => type.startsWith('CAPTURE_'));
    expect(captureTypes.map(([type]) => type)).toContain('CAPTURE_CREDENTIAL_SET');
    const takers = captureTypes.flatMap(([type, rules]) =>
      Object.entries(rules).flatMap(([key, rule]) => [CANARY.secret, CANARY.username, WITH_USER_PART, String(sealed)].filter((value) => rule.accepts(value)).map((value) => `${type}.${key} takes ${value}`)),
    );
    expect(takers).toEqual([]);
    expect(captureTypes.flatMap(([, rules]) => Object.keys(rules)).filter((key) => /secret|credential|passw|user|locator|url|uri/i.test(key))).toEqual([]);

    // Negative control: the same channels DO show a value that is passed in the clear.
    const control = captureLog();
    const controlFile = join(logDir, 'control.log');
    const controlApp = buildApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: control.stream, errorLogFile: controlFile });
    await controlApp.ready();
    controlApp.log.info({ outcome: CANARY.secret }, 'a value in the clear');
    controlApp.errorLog.append({ level: 'error', source: 'capture.adapters', message: 'control', context: { deviceId: CANARY.secret } });
    await controlApp.close();
    expect(leaks(control.text())).toEqual([CANARY.secret]);
    expect(leaks(readFileSync(controlFile, 'utf8'))).toEqual([CANARY.secret]);
    expect(SERVER_AUDIT_DETAIL_RULES.CAPTURE_CREDENTIAL_SET.deviceId.accepts('CAM-01')).toBe(true);
  });
});
