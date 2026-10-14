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

  // Task 4 row 174b (decision C127, caution C-4 of the security review of row 86): a parameter NAME is refused by the
  // class of a part it contains, case folded (`pass pwd token key secret auth user login session`), or when it IS one
  // of the short words `pw usr account`; one stream parameter a camera states, `sessiontimeout`, is admitted with
  // digits only. Mutations seen RED (implementation/174b_locator_name_class.md): row 174's whole-name rule put back
  // (cases 1, 2, 3, 5); the parts compared as whole names (cases 1, 2, 5 and row 46's case above); the whole-name list
  // emptied (cases 1, 3); the exception removed (cases 4, 5); the exception's value form widened to any value (case 5).
  describe('row 174b (C127 C-4): a credential-like parameter name is refused by its class, not by a closed list of whole names', () => {
    const isRefused = (locator: string): boolean => {
      try {
        credentialFreeLocator(locator, 'CAM-03');
        return false;
      } catch (error) {
        expect(error).toMatchObject({ code: 'CAPTURE_LOCATOR_INVALID', deviceId: 'CAM-03' });
        expect(leaks(everything(error))).toEqual([]);
        return true;
      }
    };
    /** Every form a refused name must be refused in: three letter cases, first and later position, without a value. */
    const forms = (name: string): string[] => {
      const mixed = `${name.slice(0, 1).toUpperCase()}${name.slice(1, 2)}${name.slice(2).toUpperCase()}`;
      return [`${PLAIN}?${name}=1`, `${PLAIN}?${name.toUpperCase()}=1`, `${PLAIN}?${mixed}=1`, `${PLAIN}?channel=1&${name}=1`, `${PLAIN}?channel=1&${name.toUpperCase()}=1&subtype=0`, `${PLAIN}?${name}`];
    };

    it('1. each name the whole-name list let through is refused, in every form', () => {
      const missed = ['passwd', 'pw', 'usr', 'login', 'loginuse', 'loginpas', 'account', 'apikey', 'access_token'];
      expect(missed.flatMap(forms).filter((locator) => !isRefused(locator))).toEqual([]);
      // ... and so is each of the ten names of row 174, unchanged.
      const former = 'user username pass password pwd auth token key secret session'.split(' ');
      expect(former.flatMap(forms).filter((locator) => !isRefused(locator))).toEqual([]);
    });

    it('2. a name that CONTAINS a part of the class is refused, wherever the part stands in it', () => {
      const parts = 'pass pwd token key secret auth user login session'.split(' ');
      const around = parts.flatMap((part) => [`x${part}`, `${part}x`, `x_${part}_2`, `${part}${part}`]);
      expect(around).toHaveLength(36);
      expect(around.flatMap(forms).filter((locator) => !isRefused(locator))).toEqual([]);
      // Names of the kind a device could choose: every one holds a part.
      const chosen = ['authorization', 'oauth', 'x-api-key', 'userid', 'user_name', 'sessionid', 'session_key', 'pwdhash', 'tokens', 'keyframe', 'authmode', 'username2', 'secretkey', 'passphrase', 'loginid'];
      expect(chosen.flatMap(forms).filter((locator) => !isRefused(locator))).toEqual([]);
    });

    it('3. the short words are refused as the WHOLE name only: inside a longer name they are not a class (the stated choice)', () => {
      expect(['pw', 'usr', 'account'].flatMap(forms).filter((locator) => !isRefused(locator))).toEqual([]);
      // Control on the admitted side: a longer name that holds a short word and no part of the class.
      for (const locator of [`${PLAIN}?pwm=1`, `${PLAIN}?busrate=2`, `${PLAIN}?accountancy=3`, `${PLAIN}?pwm=1&busrate=2&accountancy=3`]) expect(isRefused(locator), locator).toBe(false);
    });

    it('4. the names the product\'s locators use are admitted, and pass the injection point byte for byte', () => {
      const products = [
        `${PLAIN}?channel=1&subtype=0`,
        `${PLAIN}?channel=1&subtype=0&unicast=true&proto=Onvif`,
        `${PLAIN}?transportmode=unicast&profile=Profile_1`,
        `${PLAIN}?profile=profile_1_h264&sessiontimeout=60&streamtype=unicast`,
        `${PLAIN}?real_stream`,
        `${PLAIN}?SessionTimeout=60`,
        // A VALUE is still not judged.
        `${PLAIN}?mode=password&stream=token&profile=secret_key&name=user&kind=session&channel=auth`,
      ];
      for (const locator of products) {
        expect(isRefused(locator), locator).toBe(false);
        const bytes = startMessageBytes({ access: credentialAtInjection(locator, sealCredential(CANARY)) });
        expect(bytes.includes(Buffer.from(`"locator":"${locator}"`, 'utf8'))).toBe(true);
        bytes.fill(0);
      }
    });

    it('5. the one exception, sessiontimeout, carries digits only: 1 to 6 of them, never text, never no value', () => {
      expect(isRefused(`${PLAIN}?sessiontimeout=1`)).toBe(false);
      expect(isRefused(`${PLAIN}?sessiontimeout=999999`)).toBe(false);
      const refused = [`${PLAIN}?sessiontimeout`, `${PLAIN}?sessiontimeout=`, `${PLAIN}?sessiontimeout=1234567`, `${PLAIN}?sessiontimeout=abc`, `${PLAIN}?sessiontimeout=6O`, `${PLAIN}?sessiontimeout=${CANARY.secret}`, `${PLAIN}?sessiontimeouts=60`, `${PLAIN}?xsessiontimeout=60`];
      expect(refused.filter((locator) => !isRefused(locator))).toEqual([]);
    });

    it('6. every other bound of the rule holds as before: 128, 8 parameters, the character set, no repeat, no user part', () => {
      const at128 = `a=${'x'.repeat(62)}&b=${'y'.repeat(61)}`;
      expect(at128).toHaveLength(128);
      expect(isRefused(`${PLAIN}?${at128}`)).toBe(false);
      expect(isRefused(`${PLAIN}?${at128}y`)).toBe(true);
      expect(isRefused(`${PLAIN}?${Array.from({ length: 8 }, (_unused, index) => `p${index}=1`).join('&')}`)).toBe(false);
      expect(isRefused(`${PLAIN}?${Array.from({ length: 9 }, (_unused, index) => `p${index}=1`).join('&')}`)).toBe(true);
      expect([`${PLAIN}?p%61ss=1`, `${PLAIN}?channel=1&Channel=2`, `${PLAIN}?sessiontimeout=60&sessiontimeout=60`, `${PLAIN}?a=1;b=2`, WITH_USER_PART, `${WITH_USER_PART}?channel=1`].filter((locator) => !isRefused(locator))).toEqual([]);
    });
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
    // Task 4 row RD2 (design 07 section 4.2; decisions C147, C154): `credentialDestroyed` of CAPTURE_DEVICE_RETIRED - whether
    // the retire unit destroyed a stored credential; a yes/no fact as `credentialSet`, held by the flag rule above.
    expect(named.map(({ name }) => name)).toEqual(['CAPTURE_CANDIDATE_ADOPTED.credentialSet', 'CAPTURE_DEVICE_RETIRED.credentialDestroyed']);
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

// Row N5c (wave 12; decision C138; request of row N5b, record n5b section 4): the blanking of text the
// Core did not write is LINEAR in its length. The form before was quadratic in a run of scheme
// characters not followed by `://` (64 KiB of letters about 2.5 to 4.4 s on this Mac), and the door
// blanks up to 1 MiB of a device's text per stream.
// Seen RED on (in memory, the form before put back in credential.ts): the time case (64 KiB of
// letters took seconds against the 100 ms bound; the 1 MiB step was never reached).
describe('row N5c: the blanking of foreign text is linear, and its output is the output of before', () => {
  /** THE FORM BEFORE, kept here only as the reference of the output: quadratic, so it is given short texts only. */
  const FORM_BEFORE = /([a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*@/gi;
  const timed = (text: string): { out: string; ms: number } => {
    const start = performance.now();
    const out = blankCredentialLocators(text);
    return { out, ms: performance.now() - start };
  };

  it('64 KiB of letters within 100 ms, then 1 MiB of letters and 1 MiB of `x1` within 250 ms each, unchanged (no locator in them)', () => {
    const small = 'a'.repeat(64 * 1024);
    const first = timed(small);
    expect(first.ms).toBeLessThan(100);
    expect(first.out).toBe(small);
    for (const text of ['a'.repeat(1024 * 1024), 'x1'.repeat(512 * 1024), 'Zq9-'.repeat(256 * 1024)]) {
      const run = timed(text);
      expect(run.ms).toBeLessThan(250);
      expect(run.out).toBe(text);
    }
    // A user part after a long run is still blanked, and the run before it is kept as it was.
    const tail = `${'b'.repeat(1024 * 1024)} rtsp://u:p@192.0.2.10/s`;
    const run = timed(tail);
    expect(run.ms).toBeLessThan(250);
    expect(run.out).toBe(`${'b'.repeat(1024 * 1024)} rtsp://${CREDENTIAL_MARK}@192.0.2.10/s`);
  });

  it('the cases of before give the output of before, a run\'s leading digits and signs included', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['rtsp://u:p@h/x', `rtsp://${CREDENTIAL_MARK}@h/x`],
      ['1rtsp://u:p@h', `1rtsp://${CREDENTIAL_MARK}@h`],
      ['-+.9Rtsp://a@b', `-+.9Rtsp://${CREDENTIAL_MARK}@b`],
      ['see HTTP://user:pw@host:80/a and rtsp://h/s', `see HTTP://${CREDENTIAL_MARK}@host:80/a and rtsp://h/s`],
      ['x:rtsp://u@h', `x:rtsp://${CREDENTIAL_MARK}@h`],
      ['(rtsp://u:p@h) "rtsp://a:b@c"', `(rtsp://${CREDENTIAL_MARK}@h) "rtsp://${CREDENTIAL_MARK}@c"`],
      ['rtsp://u:p@h rtsp://v:q@k', `rtsp://${CREDENTIAL_MARK}@h rtsp://${CREDENTIAL_MARK}@k`],
      ['123://u@h', '123://u@h'],
      ['aaaa1x', 'aaaa1x'],
    ];
    for (const [text, expected] of cases) {
      expect(blankCredentialLocators(text)).toBe(expected);
      expect(text.replace(FORM_BEFORE, `$1${CREDENTIAL_MARK}@`)).toBe(expected);
    }
  });

  it('20,000 seeded random short texts: the same output as the form before (the row\'s own fuzz was 500,000, 0 differences)', () => {
    const alphabet = [...'aZ19+.-:/@ <x"\'\n'];
    const pieces = ['://', 'rtsp://', 'u:p@', '1x', 'RTSP://', '-1.a+://'];
    let seed = 20_261_014;
    const next = (): number => {
      seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
      return seed / 4_294_967_296;
    };
    const differ: string[] = [];
    let changed = 0;
    for (let index = 0; index < 20_000; index += 1) {
      let text = '';
      const length = Math.floor(next() * 48);
      for (let at = 0; at < length; at += 1) text += next() < 0.3 ? pieces[Math.floor(next() * pieces.length)] : alphabet[Math.floor(next() * alphabet.length)];
      const before = text.replace(FORM_BEFORE, `$1${CREDENTIAL_MARK}@`);
      if (before !== text) changed += 1;
      if (blankCredentialLocators(text) !== before) differ.push(text);
    }
    expect(differ).toEqual([]);
    // The texts do reach the pattern: a good share of them carries a user part.
    expect(changed).toBeGreaterThan(2_000);
  });
});
