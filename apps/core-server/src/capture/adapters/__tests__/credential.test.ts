// SEC35-04 at run time (blueprint row 65; capture spec §A.6 "Credential handling", §A.6.3 CR-1 to
// CR-7): a credential VALUE never reaches a log line, the persistent error log, an audit detail,
// an error, a result, a JSON text or an inspection, and a locator with a user part is composed
// nowhere: the two values and the locator meet in `credentialAtInjection` only, as separate
// members.
//
// Row 147 (security addendum AD-03 point 6, weakness W-2): the injection result is opaque as a
// sealed credential is, and ONE function, `startMessageBytes`, reads it - into bytes of its own
// that the process door writes and zero-fills. No text of a start message is made.
//
// A canary pair is sent through every channel this layer has, and every captured text is
// searched for it. The negative controls prove the search: the same channels DO show the canary
// when it is passed as a plain value, and the injection result holds it by design.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { afterAll, describe, expect, it, vi } from 'vitest';
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
import { InjectedStreamAccess, startMessageBytes, type StartMessage } from '../credential';

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

  // Task 4 row 46 (decision C24; the request of row 174): the injection point admits exactly what the locator read
  // admits, by ONE function. The cases of the rule itself are in `camera/__tests__/onvif-session.test.ts` (row 174).
  it('a query inside the closed rule passes the injection point unchanged; outside it, a bare mark and a credential-like name are refused', async () => {
    const admitted = [`${PLAIN}?channel=1&subtype=0`, `${PLAIN}?transportmode=unicast&profile=Profile_1`, `${PLAIN}?tcp`, `${PLAIN}?mode=`];
    for (const locator of admitted) {
      expect(credentialFreeLocator(locator)).toBe(locator);
      // The injection takes it, and the serialiser writes it byte for byte as the relay's `locator`.
      const bytes = startMessageBytes({ access: credentialAtInjection(locator, sealCredential(CANARY)) });
      expect(bytes.includes(Buffer.from(`"locator":"${locator}"`, 'utf8'))).toBe(true);
      bytes.fill(0);
    }
    const refused = [
      `${PLAIN}?`,
      `${PLAIN}#`,
      `${PLAIN}?channel=1#x`,
      `${PLAIN}?a=1&a=2`,
      `${PLAIN}?a=1&&b=2`,
      `${PLAIN}?a=b=c`,
      `${PLAIN}?a=%31`,
      `${PLAIN}?a=1;b=2`,
      `${PLAIN}?a=1?b=2`,
      `${PLAIN}?PassWord=${CANARY.secret}`,
      `${PLAIN}?user=${CANARY.username}`,
      `${PLAIN}?Session=1`,
      `${PLAIN}?${'p=1&'.repeat(8)}q=1`,
      `${PLAIN}?v=${'x'.repeat(65)}`,
    ];
    for (const locator of refused) {
      const error = await thrownBy(() => credentialAtInjection(locator, sealCredential(CANARY)));
      expect(error, String(refused.indexOf(locator))).toMatchObject({ code: 'CAPTURE_LOCATOR_INVALID' });
      expect(leaks(everything(error))).toEqual([]);
    }
  });

  it('the injection point is where the two meet, and its result shows the mark in every print form (AD-03 point 6)', async () => {
    const injected = credentialAtInjection(PLAIN, sealCredential(CANARY));
    expect(injected).toBeInstanceOf(InjectedStreamAccess);
    expect(Object.isFrozen(injected)).toBe(true);
    // The four print forms, each alone: text, interpolation, JSON, inspection.
    expect(String(injected)).toBe(CREDENTIAL_MARK);
    expect(`${injected as unknown as string}`).toBe(CREDENTIAL_MARK);
    expect(`access ${injected as unknown as string} of a start message`).toBe(`access ${CREDENTIAL_MARK} of a start message`);
    expect(JSON.stringify(injected)).toBe(`"${CREDENTIAL_MARK}"`);
    expect(JSON.stringify({ type: 'start', access: injected })).toBe(`{"type":"start","access":"${CREDENTIAL_MARK}"}`);
    expect(inspect(injected)).toBe(CREDENTIAL_MARK);
    expect(inspect({ access: injected }, { depth: 8, showHidden: true, getters: true })).toBe(`{ access: ${CREDENTIAL_MARK} }`);
    // It is not a plain serialisable object: no member, own or inherited, holds a value.
    expect(Reflect.ownKeys(injected)).toEqual([]);
    const inherited: string[] = [];
    for (const name in injected) inherited.push(name);
    expect(inherited).toEqual([]);
    expect(JSON.stringify({ ...injected })).toBe('{}');
    expect(leaks(inspect(injected, { customInspect: false, showHidden: true, depth: 8, getters: true }))).toEqual([]);
    expect(leaks(everything(injected))).toEqual([]);
    expect(leaks(everything(structuredClone(injected)))).toEqual([]);
    // As the cause of an error, as the door or a caller could make one.
    const failure = new Error('the start message was not written', { cause: injected });
    expect(leaks(everything(failure))).toEqual([]);
    expect(leaks(inspect(failure, { depth: 8, showHidden: true }))).toEqual([]);
    expect(leaks(JSON.stringify({ error: failure, cause: failure.cause, list: [failure.cause] }))).toEqual([]);
    expect(inspect(failure)).toContain(CREDENTIAL_MARK);
    // It refuses a locator that already carries a user part, and its refusal shows nothing.
    expect(leaks(everything(await thrownBy(() => credentialAtInjection(WITH_USER_PART, sealCredential(CANARY)))))).toEqual([]);
    // Negative control: the same search finds the pair in a plain object of the former shape.
    expect(leaks(everything({ locator: PLAIN, ...CANARY }))).toEqual(CANARIES);
    expect(leaks(inspect(new Error('control', { cause: { ...CANARY } })))).toEqual(CANARIES);
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

describe('the start message becomes bytes in one function (row 147, AD-03 point 6)', () => {
  const START = { type: 'start', mode: 'record', ingestUrl: 'rtsp://127.0.0.1:18554/in/VIDEO-01', attempt: 2, probe: false, note: null } as const;
  /** The bytes as text, for the search only: one byte, one character. */
  const shown = (bytes: Buffer): string => bytes.toString('latin1');
  /** Every buffer `Buffer.alloc` handed out while `work` ran. */
  const allocatedBy = (work: () => unknown): { buffers: Buffer[]; outcome: unknown } => {
    const buffers: Buffer[] = [];
    const original = Buffer.alloc.bind(Buffer);
    const spy = vi.spyOn(Buffer, 'alloc').mockImplementation(((size: number) => {
      const buffer = original(size);
      buffers.push(buffer);
      return buffer;
    }) as typeof Buffer.alloc);
    try {
      let outcome: unknown;
      try {
        outcome = work();
      } catch (error) {
        outcome = error;
      }
      return { buffers, outcome };
    } finally {
      spy.mockRestore();
    }
  };

  it('one line of JSON in the order of the members, the stream access as its three separate values', () => {
    const access = credentialAtInjection(PLAIN, sealCredential(CANARY));
    const bytes = startMessageBytes({ ...START, access });
    expect(Buffer.isBuffer(bytes)).toBe(true);
    const expected = Buffer.from(`${JSON.stringify({ ...START, access: { locator: PLAIN, username: CANARY.username, secret: CANARY.secret } })}\n`, 'utf8');
    expect(bytes.equals(expected)).toBe(true);
    expect(bytes.indexOf(0x0a)).toBe(bytes.length - 1);
    // The user-part form of a locator is not in it: the two values stay apart from the locator.
    expect(shown(bytes).includes('@')).toBe(false);
    // Positive control: the bytes are the one place that holds the pair, by design.
    expect(leaks(shown(bytes))).toEqual(CANARIES);
    // A message without a stream access, and an empty one.
    expect(startMessageBytes(START).equals(Buffer.from(`${JSON.stringify(START)}\n`, 'utf8'))).toBe(true);
    expect(startMessageBytes({}).equals(Buffer.from('{}\n', 'utf8'))).toBe(true);
  });

  it('a value with a quote, a backslash, a line end, a control byte or a character outside ASCII leaves as valid JSON on one line', () => {
    const awkward = { username: 'placeholder "user" \\ name\u0000', secret: 'placeholder\nline\r\ttab \u001f "q" \\ é ü 字 \u{1F512} \u007f end' } as const;
    const bytes = startMessageBytes({ type: 'start', 'odd "name"\n': 'a\tb', access: credentialAtInjection(PLAIN, sealCredential(awkward)) });
    expect(bytes.indexOf(0x0a)).toBe(bytes.length - 1);
    expect([...bytes.subarray(0, bytes.length - 1)].filter((byte) => byte < 0x20)).toEqual([]);
    const back = JSON.parse(bytes.toString('utf8')) as { access: { locator: string; username: string; secret: string } } & Record<string, unknown>;
    expect(back.access.username === awkward.username && back.access.secret === awkward.secret).toBe(true);
    expect(back.access.locator).toBe(PLAIN);
    expect(back['odd "name"\n']).toBe('a\tb');
    expect(Object.keys(back)).toEqual(['type', 'odd "name"\n', 'access']);
  });

  it('the bytes are memory of their own, a zero-fill clears them, and every copy made on the way is cleared already', () => {
    const access = credentialAtInjection(PLAIN, sealCredential(CANARY));
    const { buffers, outcome } = allocatedBy(() => startMessageBytes({ ...START, access }));
    const bytes = outcome as Buffer;
    expect(Buffer.isBuffer(bytes)).toBe(true);
    // Not a slice of the shared pool: the door's zero-fill reaches all of it.
    expect(bytes.byteOffset).toBe(0);
    expect(bytes.buffer.byteLength).toBe(bytes.length);
    // The function allocated through `Buffer.alloc` only (the spy saw the result), and every other buffer is zero.
    expect(buffers.includes(bytes)).toBe(true);
    const others = buffers.filter((buffer) => buffer !== bytes);
    expect(others.length).toBeGreaterThanOrEqual(3);
    expect(others.filter((buffer) => buffer.some((byte) => byte !== 0))).toHaveLength(0);
    // What the door does after the write.
    bytes.fill(0);
    expect(leaks(shown(bytes))).toEqual([]);
    expect(bytes.every((byte) => byte === 0)).toBe(true);
    // A second message is new memory, with the pair again: nothing is cached and nothing was emptied at the source.
    const again = startMessageBytes({ ...START, access });
    expect(again.buffer === bytes.buffer).toBe(false);
    expect(leaks(shown(again))).toEqual(CANARIES);
    again.fill(0);
  });

  it('refuses what is not a flat message with at most one stream access of this file, by a code that names no part of it', () => {
    const access = credentialAtInjection(PLAIN, sealCredential(CANARY));
    const refused: unknown[] = [
      { ...START, access, second: credentialAtInjection(PLAIN, sealCredential(CANARY)) },
      { ...START, access, forged: structuredClone(access) },
      { ...START, access, forged: { locator: PLAIN, ...CANARY } },
      { ...START, access, sealed: sealCredential(CANARY) },
      { ...START, access, nested: { note: CANARY.secret } },
      { ...START, access, list: [CANARY.secret] },
      { ...START, access, missing: undefined },
      { ...START, access, count: Number.NaN },
      { ...START, access, count: Number.POSITIVE_INFINITY },
      { ...START, access, big: 1n },
      { ...START, access, half: `${CANARY.secret}\ud800` },
      { ...START, access, [`${CANARY.secret}\udc00`]: 1 },
    ];
    for (const message of refused) {
      const { buffers, outcome } = allocatedBy(() => startMessageBytes(message as StartMessage));
      expect(outcome).toBeInstanceOf(CaptureAdapterError);
      expect(outcome).toMatchObject({ code: 'CAPTURE_START_MESSAGE_INVALID', deviceId: null });
      expect(leaks(everything(outcome))).toEqual([]);
      expect((outcome as Error).cause).toBeUndefined();
      // The copies made before the refusal are cleared as well.
      expect(buffers.length).toBeGreaterThanOrEqual(3);
      expect(buffers.filter((buffer) => buffer.some((byte) => byte !== 0))).toHaveLength(0);
    }
  });

  it('is the only place that reads the two members of a stream access (source of credential.ts)', () => {
    const source = readFileSync(new URL('../credential.ts', import.meta.url), 'utf8');
    const code = source.split('\n').map((line) => (/^\s*(?:\/\*\*|\*|\/\/)/.test(line) ? '' : line));
    const blockAt = (opening: RegExp): { from: number; to: number } => {
      const from = code.findIndex((line) => opening.test(line));
      const to = code.findIndex((line, index) => index > from && line === '}');
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeGreaterThan(from);
      return { from, to };
    };
    const within = (block: { from: number; to: number }, pattern: RegExp): number[] => code.flatMap((line, index) => (index >= block.from && index <= block.to && pattern.test(line) ? [index] : []));
    const everywhere = { from: 0, to: code.length - 1 };
    const serialiser = blockAt(/^export function startMessageBytes\(/);
    const sealedClass = blockAt(/^export class SealedCredential \{/);
    const locatorCheck = blockAt(/^export function credentialFreeLocator\(/);
    const MEMBER = /\.\s*(?:secret|username)\b/;
    // The store of stream accesses is opened once, inside the serialiser.
    expect(within(everywhere, /\bACCESS\.get\(/)).toEqual(within(serialiser, /\bACCESS\.get\(/));
    expect(within(serialiser, /\bACCESS\.get\(/)).toHaveLength(1);
    // A member of a credential is read by the serialiser (both) and, of the operator's input, where it is sealed.
    // (The locator check reads the like-named member of a parsed URL, to refuse a user part.)
    expect(within(serialiser, /\.\s*username\b/)).toHaveLength(1);
    expect(within(serialiser, /\.\s*secret\b/)).toHaveLength(1);
    expect(within(everywhere, MEMBER)).toEqual([...within(sealedClass, MEMBER), ...within(locatorCheck, MEMBER), ...within(serialiser, MEMBER)]);
    expect(within(locatorCheck, MEMBER).map((index) => /\bparsed\.username\b/.test(code[index] ?? ''))).toEqual([true]);
    // No text of the message is made in it: no JSON text, no template, no joining, no decoding of bytes.
    expect(within(serialiser, /JSON\.|`|\.join\(|\.toString\(|\.concat\(|TextDecoder|\binspect\b/)).toEqual([]);
    // Control: the same reading finds a planted read.
    expect(MEMBER.test('const text = access.credential . secret;')).toBe(true);
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
    // Row 147: the injection result, logged as a member, as text and as the cause of a logged error, and described for the error log.
    const injected = credentialAtInjection(PLAIN, sealed);
    const startFailure = new Error('the start message was not written', { cause: injected });
    app.log.error({ err: startFailure, access: injected, message: { type: 'start', access: injected } }, `start failed with ${String(injected)}`);
    captured.push(everything(injected), everything(startFailure), JSON.stringify(describeError(startFailure)));
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
    // A key NAMED after credential material exists only as a yes/no fact (`credentialSet` of C3 §5.2, a boolean):
    // one whose rule takes anything but `true` / `false` is a finding.
    const notAFlag = (rule: { accepts(value: unknown): boolean }): boolean => ['', 'x', CANARY.secret, 0, 1, null, [], {}].some((value) => rule.accepts(value)) || !rule.accepts(true) || !rule.accepts(false);
    const named = captureTypes.flatMap(([type, rules]) => Object.entries(rules).filter(([key]) => /secret|credential|passw|user|locator|url|uri/i.test(key)).map(([key, rule]) => ({ name: `${type}.${key}`, rule })));
    expect(named.filter(({ rule }) => notAFlag(rule)).map(({ name }) => name)).toEqual([]);
    expect(named.map(({ name }) => name)).toEqual(['CAPTURE_CANDIDATE_ADOPTED.credentialSet']);
    expect(notAFlag(SERVER_AUDIT_DETAIL_RULES.CAPTURE_CREDENTIAL_SET.deviceId)).toBe(true);
    // Pass D1a (D132): `endpointRef` is a closed form (`urn:uuid:<UUID>`), not a length: no free text, a reference kept.
    for (const type of ['CAPTURE_CONNECTION_TESTED', 'CAPTURE_CANDIDATE_ADOPTED'] as const) {
      const rule = SERVER_AUDIT_DETAIL_RULES[type].endpointRef;
      expect(['free text', 'hunter2', 'urn:uuid:', 'uuid:00000000-0000-4000-8000-000000000001', 'urn:uuid:00000000-0000-4000-8000-000000000001 x', 'x'.repeat(40)].filter((value) => rule.accepts(value))).toEqual([]);
      expect(rule.accepts('urn:uuid:00000000-0000-4000-8000-000000000001')).toBe(true);
    }

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
