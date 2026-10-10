// The read-only connection test, driven by the real `onvif` package (blueprint row 142; checks
// M4-CONN-OUT-1 (adapter half), M4-SEC-CONN-1, M4-SEC-CONN-2, M4-SEC-CONN-3; capture spec §A.6.2
// CT-1 to CT-7, §A.6.3 CR-1 to CR-5; SEC35-31, SEC35-32, SEC35-33, SEC35-34, SEC35-38).
//
// TWO FIXTURES, both on the literal 127.0.0.1 and on ports of the fixture range:
//   the fake ONVIF stub of row 60 (`test/support/fake-onvif-stub.ts`): the well-behaved camera with
//     its five device modes, its request log and its violation list. This file is the FIRST that
//     drives it with the package and not with a hand-written reference client;
//   the scripted device of this row (`test/support/onvif-odd-device.ts`): hostile and odd answers,
//     and the token-only device. It keeps what it received, so that a test can prove what did
//     not travel.
//
// NO DEVICE OF A REAL NETWORK IS CONTACTED (D76): every candidate of this file has the host
// 127.0.0.1, and a candidate with another host is only ever REFUSED before a request.
// Fixture credentials are drawn at run time. EVERY RULE HAS ITS CONTROL.
import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_ONVIF_ALLOWED_OPERATIONS, FAKE_ONVIF_HOST, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub, type FakeOnvifStubOptions } from '../../../../../test/support/fake-onvif-stub';
import {
  ODD_DEVICE_FOREIGN_HOST,
  ODD_DEVICE_HOST,
  capabilitiesAnswer,
  createOddOnvifDevice,
  dateAnswer,
  freeOddDevicePort,
  notAuthorizedFault,
  ok,
  profilesAnswer,
  servicesAnswer,
  soapEnvelope,
  streamAnswer,
  tokenHolds,
  type OddDeviceReply,
  type OddDeviceRequest,
  type OddOnvifDevice,
} from '../../../../../test/support/onvif-odd-device';
import type { CaptureTimers } from '../../../types';
import { sealCredential } from '../../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../../errors';
import { CaptureAdapterKind } from '../../kinds';
import { ConnectionTestOutcome, type CameraCandidate } from '../../types';
import { ONVIF_SESSION_LIMITS, ONVIF_SESSION_READS, OnvifTestReason, OnvifTestWarning, createOnvifConnectionTester, type OnvifSessionResult } from '../onvif-session';
import { connectionTargetOf } from '../connection-target';

// Two canaries, as the credential of the fixture account: neither is a word of any message.
const ACCOUNT = { username: `cnryU${randomUUID().replaceAll('-', '')}`, secret: `cnryS${randomUUID().replaceAll('-', '')}` };
const WRONG = { username: ACCOUNT.username, secret: `cnryW${randomUUID().replaceAll('-', '')}` };

/** Every form a password could travel in without being a digest. */
const clearForms = (account: { username: string; secret: string }): string[] => [
  account.secret,
  Buffer.from(account.secret, 'utf8').toString('base64'),
  Buffer.from(`${account.username}:${account.secret}`, 'utf8').toString('base64'),
  encodeURIComponent(account.secret),
];

/** Manual timers: the connection limit is asked of the seam and never of a global timer. */
function manualTimers(): CaptureTimers & { readonly asked: number[]; pending(): number; fireAll(): void } {
  const waiting = new Map<number, () => void>();
  const asked: number[] = [];
  let next = 0;
  return {
    asked,
    after(delayMs, callback) {
      const id = (next += 1);
      asked.push(delayMs);
      waiting.set(id, callback);
      return () => {
        waiting.delete(id);
      };
    },
    pending: () => waiting.size,
    fireAll() {
      for (const [id, callback] of waiting) {
        waiting.delete(id);
        callback();
      }
    },
  };
}

const candidateAt = (serviceAddress: string | null, overrides: Partial<CameraCandidate> = {}): CameraCandidate => ({
  adapterKind: CaptureAdapterKind.FAKE,
  host: FAKE_ONVIF_HOST,
  serviceAddress,
  endpointRef: `urn:uuid:${randomUUID()}`,
  vendor: null,
  model: 'FAKE-CAM-1',
  name: 'Fake Camera 1',
  testable: true,
  conflict: false,
  ...overrides,
});

const open: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const fixture of open.splice(0)) await fixture.stop();
});

async function startStub(overrides: Partial<Omit<FakeOnvifStubOptions, 'ports' | 'credential'>> = {}): Promise<FakeOnvifStub> {
  const stub = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: ACCOUNT, ...overrides });
  await stub.start();
  open.push(stub);
  return stub;
}

async function startOdd(script: (request: OddDeviceRequest, index: number, base: string) => OddDeviceReply): Promise<OddOnvifDevice> {
  const port = await freeOddDevicePort();
  const base = `http://${ODD_DEVICE_HOST}:${port}`;
  const device = createOddOnvifDevice(port, (request, index) => script(request, index, base));
  await device.start();
  open.push(device);
  return device;
}

const tester = (timers: CaptureTimers = manualTimers(), limits: Partial<typeof ONVIF_SESSION_LIMITS> = {}) => createOnvifConnectionTester({ timers, limits });
const never = (): AbortSignal => new AbortController().signal;
const deviceRequests = (stub: FakeOnvifStub) => stub.requestLog().filter((request) => request.channel === 'device');

describe('M4-CONN-OUT-1 (adapter half): the five outcomes on the fake stub, through the real package', () => {
  it('REACHABLE: the fixture account, one H.264 profile, a stream address on the candidate\'s own host', async () => {
    const stub = await startStub();
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(result).toEqual({
      outcome: ConnectionTestOutcome.REACHABLE,
      authenticated: true,
      usableProfiles: ['profile_1'],
      reason: null,
      warnings: [],
      reads: ['GetSystemDateAndTime', 'GetServices', 'GetProfiles', 'GetStreamUri'],
      // One digest answer for each of the two reads behind authentication.
      credentialRequests: 2,
      rejectedCredentialRequests: 0,
    });
    // ST-5: only the read-only list reached the stub, nothing was offered in clear, and no RTSP connection was opened (D82).
    expect(stub.violations()).toEqual([]);
    expect([...new Set(deviceRequests(stub).map((request) => request.operation))].every((operation) => (FAKE_ONVIF_ALLOWED_OPERATIONS as readonly string[]).includes(operation))).toBe(true);
    expect(stub.requestLog().filter((request) => request.channel !== 'device')).toEqual([]);
    // The two reads before authentication carried nothing; each read behind it was first asked without the credential.
    expect(deviceRequests(stub).map((request) => `${request.operation}:${request.authPresent}`)).toEqual([
      'GetSystemDateAndTime:false',
      'GetServices:false',
      'GetProfiles:false',
      'GetProfiles:true',
      'GetStreamUri:false',
      'GetStreamUri:true',
    ]);
  });

  it('AUTHENTICATION_FAILED: a wrong secret is refused, and the test stops there', async () => {
    const stub = await startStub();
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(WRONG), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], reason: OnvifTestReason.CREDENTIAL_REFUSED });
    expect(result.reads).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetProfiles']);
    expect(stub.violations()).toEqual([]);
  });

  it('WRONG_PROFILE: authenticated, and the device lists no profile', async () => {
    const stub = await startStub();
    stub.setDeviceMode('NO_PROFILE');
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, authenticated: true, usableProfiles: [] });
    expect([OnvifTestReason.NO_USABLE_PROFILE, OnvifTestReason.PROFILE_ANSWER_INVALID]).toContain(result.reason);
    expect(result.reads).not.toContain('GetStreamUri');
  });

  it('NOT_H264: a usable profile, and no H.264 encoder among them', async () => {
    const stub = await startStub();
    stub.setDeviceMode('H265_ONLY');
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.NOT_H264, authenticated: true, usableProfiles: [], reason: OnvifTestReason.NO_H264_PROFILE });
  });

  it('UNREACHABLE: a refused connection, and a device that never answers until the deadline', async () => {
    const stub = await startStub();
    const address = stub.addresses().deviceServiceUrl;
    stub.setDeviceMode('NO_ANSWER');
    const deadline = new AbortController();
    const pending = tester().test(candidateAt(address), sealCredential(ACCOUNT), deadline.signal);
    // The stub has the request and says nothing; the deadline is the caller's signal.
    await expect.poll(() => deviceRequests(stub).length).toBe(1);
    deadline.abort();
    expect(await pending).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.DEADLINE, credentialRequests: 0 });

    await stub.closeDeviceListener();
    stub.resetLog();
    expect(await tester().test(candidateAt(address), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NO_ANSWER, credentialRequests: 0 });
    expect(stub.requestLog()).toEqual([]);
  });

  it('the five stub modes give five different outcomes (control: two modes with one outcome would be seen)', async () => {
    const stub = await startStub();
    const address = stub.addresses().deviceServiceUrl;
    const outcomes: string[] = [];
    outcomes.push((await tester().test(candidateAt(address), sealCredential(ACCOUNT), never())).outcome);
    outcomes.push((await tester().test(candidateAt(address), sealCredential(WRONG), never())).outcome);
    stub.setDeviceMode('NO_PROFILE');
    outcomes.push((await tester().test(candidateAt(address), sealCredential(ACCOUNT), never())).outcome);
    stub.setDeviceMode('H265_ONLY');
    outcomes.push((await tester().test(candidateAt(address), sealCredential(ACCOUNT), never())).outcome);
    await stub.closeDeviceListener();
    outcomes.push((await tester().test(candidateAt(address), sealCredential(ACCOUNT), never())).outcome);
    expect(outcomes).toEqual(['REACHABLE', 'AUTHENTICATION_FAILED', 'WRONG_PROFILE', 'NOT_H264', 'UNREACHABLE']);
    expect(new Set(outcomes).size).toBe(Object.keys(ConnectionTestOutcome).length);
    expect(stub.violations()).toEqual([]);
  });

  it('a GOP announced above 2 s is a warning of a REACHABLE result, never a change (class C)', async () => {
    const stub = await startStub({ govLength: 100 });
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, warnings: [OnvifTestWarning.GOP_ABOVE_BOUND] });
    expect(stub.violations()).toEqual([]);
  });
});

describe('M4-SEC-CONN-2 (SEC35-38): the request budget of a failed test', () => {
  it('a wrong secret: ONE request carried the credential, the reads before authentication carried none', async () => {
    const stub = await startStub();
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(WRONG), never());
    const carried = deviceRequests(stub).filter((request) => request.authPresent);
    expect(carried.map((request) => request.operation)).toEqual(['GetProfiles']);
    expect(carried.length).toBeLessThanOrEqual(2);
    expect(result).toMatchObject({ credentialRequests: 1, rejectedCredentialRequests: 1 });
    expect(deviceRequests(stub).filter((request) => ['GetSystemDateAndTime', 'GetServices', 'GetCapabilities'].includes(request.operation) && request.authPresent)).toEqual([]);
    // Control: the count is read from the stub's own log, which does see a request that carries one.
    stub.resetLog();
    await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(deviceRequests(stub).filter((request) => request.authPresent)).toHaveLength(2);
  });

  it('a device that challenges GetSystemDateAndTime is not answered with the credential', async () => {
    const digest = { 'WWW-Authenticate': 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", qop="auth"' };
    const device = await startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return notAuthorizedFault(401, digest);
      if (request.operation === 'GetServices') return servicesAnswer(base);
      return notAuthorizedFault(401, digest);
    });
    const result = await tester().test(candidateAt(device.serviceUrl), sealCredential(WRONG), never());
    const clock = device.requests().filter((request) => request.operation === 'GetSystemDateAndTime');
    expect(clock.length).toBeGreaterThanOrEqual(1);
    expect(clock.filter((request) => request.authorization !== '' || request.token)).toEqual([]);
    // The one request that carried it was the read the credential is for.
    expect(device.requests().filter((request) => request.authorization !== '' || request.token).map((request) => request.operation)).toEqual(['GetProfiles']);
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, credentialRequests: 1, rejectedCredentialRequests: 1 });
  });

  it('a device that wants the token form: one token request; a refusal is final', async () => {
    const script = (account: { username: string; secret: string }) => (request: OddDeviceRequest, _index: number, base: string): OddDeviceReply => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      if (!tokenHolds(request, account)) return notAuthorizedFault(400);
      return request.operation === 'GetProfiles' ? profilesAnswer([{ token: 'main', encoding: 'H264' }]) : streamAnswer(`${['rtsp', '//'].join(':')}${ODD_DEVICE_HOST}:8554/main`);
    };
    const accepting = await startOdd(script(ACCOUNT));
    const accepted = await tester().test(candidateAt(accepting.serviceUrl), sealCredential(ACCOUNT), never());
    expect(accepted).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, usableProfiles: ['main'], credentialRequests: 2, rejectedCredentialRequests: 0 });
    // GetProfiles: asked without, then with the token. GetStreamUri: the form is known, one request.
    expect(accepting.requests().map((request) => `${request.operation}:${request.token}`)).toEqual(['GetSystemDateAndTime:false', 'GetServices:false', 'GetProfiles:false', 'GetProfiles:true', 'GetStreamUri:true']);
    expect(accepting.requests().every((request) => request.authorization === '')).toBe(true);
    await accepting.stop();

    const refusing = await startOdd(script(ACCOUNT));
    const refused = await tester().test(candidateAt(refusing.serviceUrl), sealCredential(WRONG), never());
    expect(refused).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: OnvifTestReason.CREDENTIAL_REFUSED, credentialRequests: 1, rejectedCredentialRequests: 1 });
    expect(refusing.requests().filter((request) => request.token || request.authorization !== '')).toHaveLength(1);
  });

  it('no credential: a device that asks for one is told nothing, and nothing is counted as carried', async () => {
    const stub = await startStub();
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), null, never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, authenticated: false, reason: OnvifTestReason.CREDENTIAL_ABSENT, credentialRequests: 0, rejectedCredentialRequests: 0 });
    expect(deviceRequests(stub).filter((request) => request.authPresent)).toEqual([]);
    expect(stub.violations()).toEqual([]);
  });
});

// Fix F-M4 (review row 69, finding R69-12; decision D178): the operator confirms the FULL target -
// scheme, host, port and path - and that text is what the test uses, from one function.
describe('R69-12: the target the operator confirms is the target the test contacts', () => {
  it('scheme, host, the port written out (also the default one) and the path; null for a candidate the test refuses', () => {
    expect(connectionTargetOf(candidateAt('http://127.0.0.1/onvif/device_service'))).toBe('http://127.0.0.1:80/onvif/device_service');
    expect(connectionTargetOf(candidateAt('https://127.0.0.1/onvif/device_service'))).toBe('https://127.0.0.1:443/onvif/device_service');
    expect(connectionTargetOf(candidateAt('http://127.0.0.1:8899/a/b'))).toBe('http://127.0.0.1:8899/a/b');
    expect(connectionTargetOf(candidateAt('http://127.0.0.1:8899'))).toBe('http://127.0.0.1:8899/');
    // Every candidate the test refuses before a request has no target to confirm.
    for (const refused of [candidateAt(null), candidateAt('http://127.0.0.2/x'), candidateAt('http://user@127.0.0.1/x'), candidateAt('http://127.0.0.1/x?y=1'), candidateAt('ftp://127.0.0.1/x'), candidateAt('http://127.0.0.1/x', { conflict: true }), candidateAt('http://127.0.0.1/x', { testable: false })]) {
      expect(connectionTargetOf(refused)).toBeNull();
    }
  });

  it('the stub is contacted on exactly the port and the path of that text (control: a candidate on another port names another target)', async () => {
    const stub = await startStub();
    const candidate = candidateAt(stub.addresses().deviceServiceUrl);
    const target = new URL(connectionTargetOf(candidate) ?? 'http://invalid.invalid/');
    await tester().test(candidate, null, never());
    const served = new URL(stub.addresses().deviceServiceUrl);
    expect([target.protocol, target.hostname, target.port, target.pathname]).toEqual([served.protocol, served.hostname, served.port, served.pathname]);
    expect(deviceRequests(stub).length).toBeGreaterThan(0);
    expect(connectionTargetOf(candidateAt(`http://127.0.0.1:${Number(served.port) + 1}${served.pathname}`))).not.toBe(connectionTargetOf(candidate));
  });
});

describe('M4-SEC-CONN-1 (SEC35-31): the password never leaves in clear', () => {
  it('the Basic-only stub mode receives no credential at all: outcome AUTHENTICATION_FAILED, reason SCHEME_NOT_ALLOWED', async () => {
    const stub = await startStub();
    stub.setDeviceMode('BASIC_ONLY');
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: OnvifTestReason.SCHEME_NOT_ALLOWED, credentialRequests: 0, rejectedCredentialRequests: 0 });
    expect(deviceRequests(stub).filter((request) => request.authPresent)).toEqual([]);
    expect(stub.violations()).toEqual([]);
  });

  it('a Digest challenge with a hash outside the list is not answered', async () => {
    const device = await startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      return notAuthorizedFault(401, { 'WWW-Authenticate': 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", algorithm=SHA1' });
    });
    const result = await tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: OnvifTestReason.SCHEME_NOT_ALLOWED, credentialRequests: 0 });
    expect(device.requests().filter((request) => request.authorization !== '' || request.token)).toEqual([]);
  });

  it('what travelled, in both forms: a digest answer or a digest token, never the secret, its base64 form or Basic', async () => {
    const digestDevice = await startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      return notAuthorizedFault(401, { 'WWW-Authenticate': 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", qop="auth"' });
    });
    await tester().test(candidateAt(digestDevice.serviceUrl), sealCredential(ACCOUNT), never());
    const tokenDevice = await startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      return notAuthorizedFault(400);
    });
    await tester().test(candidateAt(tokenDevice.serviceUrl), sealCredential(ACCOUNT), never());

    const travelled = [...digestDevice.requests(), ...tokenDevice.requests()].map((request) => `${request.authorization}\n${request.body}`).join('\n');
    for (const form of clearForms(ACCOUNT)) expect(travelled.includes(form), 'a clear form of the secret').toBe(false);
    expect(travelled).not.toMatch(/Basic\s|PasswordText/);
    // Control: the sweep reads real traffic - the digest forms and the account name (in clear, CR-5) ARE in it.
    expect(digestDevice.requests().some((request) => /^Digest\s/.test(request.authorization) && request.authorization.includes(ACCOUNT.username))).toBe(true);
    expect(tokenDevice.requests().some((request) => request.token && request.body.includes('#PasswordDigest') && request.body.includes(ACCOUNT.username))).toBe(true);
    // Control: the same sweep finds a secret that does travel in clear.
    expect(clearForms(ACCOUNT).some((form) => `${travelled}<Password>${ACCOUNT.secret}</Password>`.includes(form))).toBe(true);
  });
});

describe('M4-SEC-CONN-3 (SEC35-32, SEC35-33): a hostile device ends in a named outcome, inside the bounds', () => {
  const uncaught: unknown[] = [];
  const onUncaught = (error: unknown): void => {
    uncaught.push(error);
  };

  it('an endless body: the test ends at the byte cap, long before the device stops sending', async () => {
    const device = await startOdd(() => ({ kind: 'FLOOD', chunkBytes: 64 * 1024 }));
    const result = await tester(manualTimers(), { maxReceivedBytes: 256 * 1024 }).test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.BYTE_CAP, credentialRequests: 0 });
    expect(device.requests()).toHaveLength(1);
    // The device would have gone on for ever; the client took a bounded amount (the cap plus what was in flight).
    expect(device.bytesSent()).toBeLessThan(16 * 1024 * 1024);
  });

  it('the default cap is 1 MiB, the request limit 5 s, the connection limit 3 s (CT-4)', () => {
    expect(ONVIF_SESSION_LIMITS).toMatchObject({ maxReceivedBytes: 1_048_576, requestMs: 5_000, connectMs: 3_000 });
  });

  it('a body that drips and an answer that never comes: the caller\'s deadline ends both, and every socket is gone', async () => {
    for (const reply of [{ kind: 'DRIP', intervalMs: 20 }, { kind: 'HANG' }] as const) {
      const device = await startOdd(() => reply);
      const deadline = new AbortController();
      const timers = manualTimers();
      const pending = tester(timers).test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), deadline.signal);
      await expect.poll(() => device.requests().length).toBe(1);
      deadline.abort();
      expect(await pending, reply.kind).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.DEADLINE });
      // Nothing of the test is left: no timer waits, and no further request follows.
      expect(timers.pending()).toBe(0);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
      expect(device.requests()).toHaveLength(1);
      await device.stop();
    }
  });

  it('the connection limit is asked of the timer seam, and it is cancelled once the connection stands', async () => {
    const stub = await startStub();
    const timers = manualTimers();
    await tester(timers).test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(timers.asked.length).toBeGreaterThan(0);
    expect(timers.asked.every((delay) => delay === ONVIF_SESSION_LIMITS.connectMs)).toBe(true);
    expect(timers.pending()).toBe(0);
  });

  it('a redirect is not followed: 0 requests leave for the second host, and the outcome is named', async () => {
    const device = await startOdd(() => ({ kind: 'ANSWER', status: 302, body: '', headers: { Location: `http://${ODD_DEVICE_FOREIGN_HOST}/onvif/device_service` } }));
    const result = await tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NOT_ONVIF, credentialRequests: 0 });
    expect(result.reads.every((read) => (ONVIF_SESSION_READS as readonly string[]).includes(read))).toBe(true);
    // Everything the test sent arrived HERE: the device counts its own requests, and the credential was never attached.
    expect(device.requests().length).toBe(result.reads.length);
    expect(device.requests().filter((request) => request.authorization !== '' || request.token)).toEqual([]);
  });

  it('a one-element service list, a missing element and a 3,000-level body: no uncaught exception, a named outcome each', async () => {
    process.on('uncaughtException', onUncaught);
    try {
      const digest = { 'WWW-Authenticate': 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", qop="auth"' };
      // (a) GetServices lists ONE service (finding P-12): the package cannot read it; the capabilities are asked instead.
      const single = await startOdd((request, _index, base) => {
        if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
        if (request.operation === 'GetServices') return servicesAnswer(base, true);
        if (request.operation === 'GetCapabilities') return capabilitiesAnswer(base);
        if (request.authorization === '') return notAuthorizedFault(401, digest);
        return request.operation === 'GetProfiles' ? profilesAnswer([{ token: 'main', encoding: 'H264' }]) : streamAnswer(`${['rtsp', '//'].join(':')}${ODD_DEVICE_HOST}:8554/main`);
      });
      const first = await tester().test(candidateAt(single.serviceUrl), sealCredential(ACCOUNT), never());
      expect(first.outcome).toBe(ConnectionTestOutcome.REACHABLE);
      expect(first.reads).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetCapabilities', 'GetProfiles', 'GetStreamUri']);
      await single.stop();

      // (b) The response element of GetProfiles is missing.
      const missing = await startOdd((request, _index, base) => {
        if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
        if (request.operation === 'GetServices') return servicesAnswer(base);
        return ok('<trt:SomethingElse/>');
      });
      expect(await tester().test(candidateAt(missing.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.PROFILE_ANSWER_INVALID });
      await missing.stop();

      // (c) 3,000 nested elements where the clock answer should be.
      const deep = await startOdd(() => ({ kind: 'ANSWER', status: 200, body: soapEnvelope(`${'<a>'.repeat(3_000)}${'</a>'.repeat(3_000)}`) }));
      const third = await tester().test(candidateAt(deep.serviceUrl), sealCredential(ACCOUNT), never());
      expect([ConnectionTestOutcome.UNREACHABLE, ConnectionTestOutcome.WRONG_PROFILE]).toContain(third.outcome);
      expect(third.reason).not.toBeNull();
      expect(third.credentialRequests).toBe(0);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
      expect(uncaught).toEqual([]);
    } finally {
      process.off('uncaughtException', onUncaught);
    }
  });

  it('a stream address on another host, with a user part or of another scheme is WRONG_PROFILE; the foreign host is not contacted', async () => {
    const stub = await startStub();
    stub.setDeviceMode('FOREIGN_STREAM_HOST');
    const foreign = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(foreign).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.STREAM_HOST_MISMATCH, usableProfiles: [] });
    expect(stub.requestLog().filter((request) => request.channel === 'rtsp')).toEqual([]);

    const digest = { 'WWW-Authenticate': 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", qop="auth"' };
    for (const [address, reason] of [
      [`${['rtsp', '//'].join(':')}someone:something@${ODD_DEVICE_HOST}/main`, OnvifTestReason.STREAM_USER_PART],
      [`http://${ODD_DEVICE_HOST}/main`, OnvifTestReason.STREAM_SCHEME],
      ['', OnvifTestReason.STREAM_ADDRESS_MISSING],
    ] as const) {
      const device = await startOdd((request, _index, base) => {
        if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
        if (request.operation === 'GetServices') return servicesAnswer(base);
        if (request.authorization === '') return notAuthorizedFault(401, digest);
        return request.operation === 'GetProfiles' ? profilesAnswer([{ token: 'main', encoding: 'H264' }]) : streamAnswer(address);
      });
      expect(await tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never()), reason).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason });
      await device.stop();
    }
  });
});

describe('CT-3 / SEC35-32: only the candidate\'s own address is ever contacted', () => {
  it('a candidate that may not be contacted is refused before any request', async () => {
    const stub = await startStub();
    const address = stub.addresses().deviceServiceUrl;
    const refused: readonly CameraCandidate[] = [
      candidateAt(address, { testable: false }),
      candidateAt(address, { conflict: true }),
      candidateAt(null),
      // The service address names another host than the answer came from (anti-steering, DS-9).
      candidateAt(address, { host: ODD_DEVICE_FOREIGN_HOST }),
      candidateAt(`http://${ODD_DEVICE_FOREIGN_HOST}/onvif/device_service`),
      candidateAt(address.replace('http://', 'http://someone:something@')),
      candidateAt(address.replace('http://', 'ftp://')),
      candidateAt(`${address}?next=1`),
      candidateAt(`${address}#x`),
      candidateAt('http://camera.example/onvif/device_service', { host: 'camera.example' }),
      candidateAt(`http://${FAKE_ONVIF_HOST}:0/onvif/device_service`),
    ];
    for (const candidate of refused) {
      const error: unknown = await tester()
        .test(candidate, sealCredential(ACCOUNT), never())
        .then(
          () => null,
          (caught: unknown) => caught,
        );
      expect(error).toBeInstanceOf(CaptureAdapterError);
      expect((error as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.LOCATOR_INVALID);
    }
    expect(stub.requestLog()).toEqual([]);
    // Control: the same stub does log a candidate that may be contacted.
    await tester().test(candidateAt(address), null, never());
    expect(stub.requestLog().length).toBeGreaterThan(0);
  });

  it('a signal that is already aborted: refused, 0 requests', async () => {
    const stub = await startStub();
    const aborted = new AbortController();
    aborted.abort();
    await expect(tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), aborted.signal)).rejects.toMatchObject({ code: CaptureAdapterRefusal.ABORTED });
    expect(stub.requestLog()).toEqual([]);
  });
});

describe('CR-1, CR-4 / SEC35-34: nothing the call returns, and nothing that outlives it, holds the credential', () => {
  const holds = (value: unknown, account: { username: string; secret: string }): boolean => {
    const text = `${inspect(value, { depth: 12, showHidden: true, getters: true })}\n${JSON.stringify(value)}`;
    return text.includes(account.secret) || text.includes(account.username);
  };

  it('every result, on success and on refusal, and the facade itself: 0 hits of either canary', async () => {
    const stub = await startStub();
    const facade = tester();
    const results: OnvifSessionResult[] = [];
    results.push(await facade.test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never()));
    results.push(await facade.test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(WRONG), never()));
    for (const result of results) expect(holds(result, ACCOUNT) || holds(result, WRONG)).toBe(false);
    expect(holds(facade, ACCOUNT)).toBe(false);
    // The facade has one member: no client object, no agent, no option object can be reached from it.
    expect(Object.keys(facade)).toEqual(['test']);
    expect(Object.isFrozen(facade)).toBe(true);
    // Control: the same sweep finds a canary in an object that does hold one.
    expect(holds({ nested: { account: { ...ACCOUNT } } }, ACCOUNT)).toBe(true);
  });

  it('a refusal that is thrown names no part of the candidate and none of the credential', async () => {
    const error: unknown = await tester()
      .test(candidateAt(`http://${ACCOUNT.username}:${ACCOUNT.secret}@${FAKE_ONVIF_HOST}:8564/x`), sealCredential(ACCOUNT), never())
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(CaptureAdapterError);
    expect(holds(error, ACCOUNT)).toBe(false);
    expect(String((error as Error).stack)).not.toContain(ACCOUNT.secret);
  });
});
