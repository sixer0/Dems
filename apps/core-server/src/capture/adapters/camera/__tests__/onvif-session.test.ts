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
import { readFileSync } from 'node:fs';
import { Agent as HttpAgent } from 'node:http';
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_ONVIF_ALLOWED_OPERATIONS, FAKE_ONVIF_HOST, FAKE_ONVIF_ODD_PROFILE_TOKEN, FAKE_ONVIF_TWO_SOURCE_PROFILES, createFakeOnvifStub, fakeOnvifProfileStreamUri, freeFakeOnvifPorts, type FakeOnvifStub, type FakeOnvifStubOptions } from '../../../../../test/support/fake-onvif-stub';
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
import { ONVIF_SESSION_LIMITS, ONVIF_SESSION_READS, OnvifTestReason, OnvifTestWarning, createOnvifConnectionTester, createOnvifStreamLocator, createOnvifTimeReader, type OnvifLocatorResult, type OnvifSessionResult } from '../onvif-session';
import { connectionTargetOf } from '../connection-target';
import { CameraPresence, createCameraWatch, type CameraWatchReport } from '../camera-watch';
import type { StoredCameraAddressRule } from '../stored-address';

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

/**
 * Finding E-02 of the fifth review pass (S-03 of the second): the two facades REQUIRE the source address of a call. The
 * devices of this file stand on loopback and none of them is a stored camera, so a call that names no address STATES the
 * old behaviour - "as the host routes" - by this one name, here, for every call below that passes three (four) arguments.
 * The facades themselves have no default: `createOnvifConnectionTester(...).test(a, b, c)` does not compile.
 */
const AS_THE_HOST_ROUTES = undefined;
const statedTester = (made: ReturnType<typeof createOnvifConnectionTester>) => ({
  test: (candidate: CameraCandidate, credential: Parameters<typeof made.test>[1], signal: AbortSignal, sourceAddress: string | undefined = AS_THE_HOST_ROUTES) => made.test(candidate, credential, signal, sourceAddress),
});
const statedLocator = (made: ReturnType<typeof createOnvifStreamLocator>) => ({
  locate: (candidate: CameraCandidate, credential: Parameters<typeof made.locate>[1], profileToken: string, signal: AbortSignal, sourceAddress: string | undefined = AS_THE_HOST_ROUTES) => made.locate(candidate, credential, profileToken, signal, sourceAddress),
});
const tester = (timers: CaptureTimers = manualTimers(), limits: Partial<typeof ONVIF_SESSION_LIMITS> = {}) => statedTester(createOnvifConnectionTester({ timers, limits }));
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
      // Task 4 row 26: the stream of the one video source, with its tokens and its announced size.
      profiles: [{ token: 'profile_1', videoSourceToken: 'vs_1', width: 1920, height: 1080 }],
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
    // Review 060d Q-08 (section 6, survivor 3), row CB: ONE reason, not either of two. The stub's NO_PROFILE device
    // answers an EMPTY response element (`<trt:GetProfilesResponse/>`), which the package cannot read as a list: the
    // read FAILED, and the reason is the name of an answer that could not be read - `PROFILE_ANSWER_INVALID`.
    // Seen RED on (in memory): the product answering `NO_USABLE_PROFILE` where it answers `PROFILE_ANSWER_INVALID`.
    expect(result.reason).toBe(OnvifTestReason.PROFILE_ANSWER_INVALID);
    expect(result.profiles).toEqual([]);
    expect(result.reads).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetProfiles']);
    expect(result.reads).not.toContain('GetStreamUri');
    // CONTROL of the name - THE OTHER REASON, on an answer that WAS read: one listed profile that names no video
    // source and no encoder is no usable profile. `NO_USABLE_PROFILE`, by its exact value (no case of this file held
    // it so before). Seen RED on (in memory): the product answering `PROFILE_ANSWER_INVALID` for an empty usable list.
    const hollow = await startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      return ok('<trt:GetProfilesResponse><trt:Profiles token="main" fixed="true"><tt:Name>hollow</tt:Name></trt:Profiles></trt:GetProfilesResponse>');
    });
    const listed = await tester().test(candidateAt(hollow.serviceUrl), sealCredential(ACCOUNT), never());
    expect(listed).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, usableProfiles: [] });
    expect(listed.reason).toBe(OnvifTestReason.NO_USABLE_PROFILE);
    expect(listed.reads).toEqual(['GetSystemDateAndTime', 'GetServices', 'GetProfiles']);
  });

  it('NOT_H264: a usable profile, and no H.264 encoder among them', async () => {
    const stub = await startStub();
    stub.setDeviceMode('H265_ONLY');
    const result = await tester().test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: ConnectionTestOutcome.NOT_H264, authenticated: true, usableProfiles: [], reason: OnvifTestReason.NO_H264_PROFILE });
    // Task 4 row 50 (amendment AM-2): the announcement is advice. The streams are named all the same - one per
    // video source, by its bounded tokens - so that the stream test can judge them; no code is formed here.
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]).toMatchObject({ token: expect.stringMatching(/^[A-Za-z0-9_.:-]{1,64}$/), width: expect.any(Number), height: expect.any(Number) });
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

  // Review 060d Q-03 (section 6, survivor 1), wave 12 row CB. The case asked only that a timer of `connectMs` was asked
  // and that none was left: with `if (socket.connecting === true) socket.destroy();` deleted from the session file it
  // passed. Its second half now keeps a connection from being established and FIRES the limit (row T3's case (b) of
  // the set-network file, here for the tester - the three facades share the exchange).
  // Seen RED on (in memory): that line deleted - the test is still pending 3 s after the limit fired; `timers.after(
  // limits.connectMs,` -> `limits.requestMs,` - the timer asked is 60,000 and not 1,234; `cancel();` of `established`
  // deleted - a timer is left pending in the first half. (`socket.once('connect', established)` deleted is row T3's
  // EQUIVALENT mutant, another one: the same `established` runs at `close`. It survives here too, for that reason.)
  it('the connection limit is asked of the timer seam, and it is cancelled once the connection stands; a connection that never stands is destroyed when the limit fires - NO_ANSWER - and nothing else ends the test before', async () => {
    const stub = await startStub();
    const timers = manualTimers();
    await tester(timers).test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never());
    expect(timers.asked.length).toBeGreaterThan(0);
    expect(timers.asked.every((delay) => delay === ONVIF_SESSION_LIMITS.connectMs)).toBe(true);
    expect(timers.pending()).toBe(0);

    // THE OTHER SIDE. The double of "a device that does not complete the connection": the agent's real maker is
    // handed a host NAME and a resolver that never answers, so the socket stays `connecting` and nothing is sent
    // anywhere. The limits are this call's own (1,234 ms; a request limit far away), on manual timers: only the
    // connection limit can end the test, and only when the test fires it.
    const reached = stub.requestLog().length;
    const waiting = manualTimers();
    const cutting = new AbortController();
    const seen: { outcome: OnvifSessionResult | 'PENDING'; atLimit: OnvifSessionResult | 'PENDING' | 'NOT FIRED' } = { outcome: 'PENDING', atLimit: 'NOT FIRED' };
    const made = Reflect.get(HttpAgent.prototype, 'createConnection') as (this: unknown, options: Record<string, unknown>, callback?: unknown) => unknown;
    let dials = 0;
    Reflect.set(HttpAgent.prototype, 'createConnection', function wrapped(this: unknown, options: Record<string, unknown>, callback?: unknown): unknown {
      dials += 1;
      return made.call(this, { ...options, host: 'never-established.invalid', lookup: () => undefined }, callback);
    });
    try {
      const pending = tester(waiting, { connectMs: 1_234, requestMs: 60_000 })
        .test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), cutting.signal)
        .then((result) => {
          seen.outcome = result;
        });
      // The limit was asked of the timer seam, once, with the limit of THIS call - not the request limit, not a constant.
      await expect.poll(() => waiting.asked.length, { timeout: 2_000 }).toBe(1);
      expect(waiting.asked).toEqual([1_234]);
      expect(waiting.pending()).toBe(1);
      // The connection is not established and nothing has ended the test: only the limit can.
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
      expect(seen.outcome).toBe('PENDING');
      waiting.fireAll();
      await Promise.race([pending, new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000))]);
      seen.atLimit = seen.outcome;
    } finally {
      Reflect.set(HttpAgent.prototype, 'createConnection', made);
      cutting.abort();
    }
    // Ended BY THE LIMIT (read before the abort above could end it): no answer, and no credential travelled.
    expect(seen.atLimit).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NO_ANSWER, credentialRequests: 0, rejectedCredentialRequests: 0, profiles: [], usableProfiles: [] });
    expect(dials).toBe(1);
    expect(stub.requestLog()).toHaveLength(reached);
    expect(waiting.pending()).toBe(0);
  });

  // Review 060d Q-03, its second sentence (row CB): the REQUEST limit of the session file was held by a text pin only.
  // Seen RED on (in memory): `timeout: limits.requestMs,` deleted from the package client's options - still pending at 4 s.
  it('the request limit ends a read: a device that accepts the connection, takes the request and never answers - NO_ANSWER after `requestMs`, not before and not much later; ONE request was sent', async () => {
    const silent = await startOdd(() => ({ kind: 'HANG' }));
    const cutting = new AbortController();
    const seen: { outcome: OnvifSessionResult | 'PENDING'; atLimit: OnvifSessionResult | 'PENDING' | 'NOT WAITED'; afterMs: number } = { outcome: 'PENDING', atLimit: 'NOT WAITED', afterMs: -1 };
    const fromAt = performance.now();
    try {
      const pending = tester(manualTimers(), { requestMs: 400 })
        .test(candidateAt(silent.serviceUrl), sealCredential(ACCOUNT), cutting.signal)
        .then((result) => {
          seen.outcome = result;
          seen.afterMs = performance.now() - fromAt;
        });
      await Promise.race([pending, new Promise((resolvePromise) => setTimeout(resolvePromise, 4_000))]);
      seen.atLimit = seen.outcome;
    } finally {
      cutting.abort();
    }
    expect(seen.atLimit).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NO_ANSWER, credentialRequests: 0 });
    expect(seen.afterMs).toBeGreaterThanOrEqual(350);
    expect(seen.afterMs).toBeLessThan(4_000);
    expect(silent.requests()).toHaveLength(1);
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
      // Review 060b note M-10 / section 7.4 (5), row T2: ONE outcome with ONE reason, not "any refusal". A clock
      // answer that is no answer is "not an ONVIF device", the test ends at that first read (nothing further is
      // asked of the device, by any read), and nothing of the account was sent or kept.
      expect(third).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NOT_ONVIF, credentialRequests: 0, rejectedCredentialRequests: 0, profiles: [], usableProfiles: [] });
      expect(third.reads).toEqual(['GetSystemDateAndTime']);
      expect(deep.requests().map((request) => request.operation)).toEqual(['GetSystemDateAndTime']);
      expect(deep.requests().filter((request) => request.authorization !== '' || request.token)).toEqual([]);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
      expect(uncaught).toEqual([]);
      await deep.stop();
      // CONTROLS of the name. (1) A small, shallow, well-formed body that holds no clock is named the same way: the
      // name is "this read got no answer", whatever made the body useless. (2) The 3,000 elements side by side are
      // the SAME bytes, not nested: longer than a clock answer may be, they end as the byte cap - so the nested body
      // above was refused for its depth BEFORE its length was reached (were it not, it would read BYTE_CAP too).
      const shallow = await startOdd(() => ({ kind: 'ANSWER', status: 200, body: soapEnvelope('<a></a>'.repeat(30)) }));
      expect(await tester().test(candidateAt(shallow.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NOT_ONVIF, credentialRequests: 0 });
      expect(shallow.requests().map((request) => request.operation)).toEqual(['GetSystemDateAndTime']);
      await shallow.stop();
      const flat = await startOdd(() => ({ kind: 'ANSWER', status: 200, body: soapEnvelope('<a></a>'.repeat(3_000)) }));
      expect(await tester().test(candidateAt(flat.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.BYTE_CAP, credentialRequests: 0 });
      expect(flat.requests().map((request) => request.operation)).toEqual(['GetSystemDateAndTime']);
      await flat.stop();
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
    // The facade ITSELF is judged below (`made`); the calls go through the helper that states the source address (finding E-02).
    const made = createOnvifConnectionTester({ timers: manualTimers() });
    const facade = statedTester(made);
    const results: OnvifSessionResult[] = [];
    results.push(await facade.test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), never()));
    results.push(await facade.test(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(WRONG), never()));
    for (const result of results) expect(holds(result, ACCOUNT) || holds(result, WRONG)).toBe(false);
    expect(holds(made, ACCOUNT)).toBe(false);
    // The facade has one member: no client object, no agent, no option object can be reached from it.
    expect(Object.keys(made)).toEqual(['test']);
    expect(Object.isFrozen(made)).toBe(true);
    // Finding E-02: its one call declares FOUR parameters - the source address has no default and cannot be left out.
    expect(made.test).toHaveLength(4);
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

// Task 4 row 26 (WP-04; design addendum 2.3, 4.1, 7.2; logic H-03, H-05, H-11 of the input-av scheme).
// The fake stub of row 60 announces ONE profile of ONE video source, and it is being extended by
// another row: every device of more than that is the scripted device with a LOCAL profile answer.
describe('task 4 row 26: the stream of each video source, and the locator of a profile', () => {
  const STREAM = ['rtsp', '//'].join(':');
  const DIGEST = { 'WWW-Authenticate': 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", qop="auth"' };

  interface FixtureProfile {
    readonly token: string;
    /** `null`: the device names no video source. */
    readonly source?: string | null;
    /** `null`: the device announces no size. A text is sent as it is. */
    readonly width?: number | string | null;
    readonly height?: number | string;
    readonly encoding?: string;
  }
  const profilesOf = (profiles: readonly FixtureProfile[]): OddDeviceReply =>
    ok(
      `<trt:GetProfilesResponse>${profiles
        .map(
          (profile, index) =>
            `<trt:Profiles token="${profile.token}" fixed="true"><tt:Name>p${index}</tt:Name>` +
            `<tt:VideoSourceConfiguration token="vsc_${index}"><tt:Name>source</tt:Name>${profile.source === null ? '' : `<tt:SourceToken>${profile.source ?? 'vs_0'}</tt:SourceToken>`}</tt:VideoSourceConfiguration>` +
            `<tt:VideoEncoderConfiguration token="vec_${index}"><tt:Name>encoder</tt:Name><tt:Encoding>${profile.encoding ?? 'H264'}</tt:Encoding>` +
            (profile.width === null ? '' : `<tt:Resolution><tt:Width>${profile.width ?? 1920}</tt:Width><tt:Height>${profile.height ?? 1080}</tt:Height></tt:Resolution>`) +
            `<tt:RateControl><tt:FrameRateLimit>25</tt:FrameRateLimit><tt:EncodingInterval>1</tt:EncodingInterval><tt:BitrateLimit>4096</tt:BitrateLimit></tt:RateControl>` +
            `<tt:H264><tt:GovLength>50</tt:GovLength></tt:H264></tt:VideoEncoderConfiguration></trt:Profiles>`,
        )
        .join('')}</trt:GetProfilesResponse>`,
    );

  /** A camera behind Digest that lists `profiles` and names `address` for whatever profile it is asked. */
  const camera = (profiles: readonly FixtureProfile[], address = `${STREAM}${ODD_DEVICE_HOST}:554/main`): Promise<OddOnvifDevice> =>
    startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      if (request.authorization === '') return notAuthorizedFault(401, DIGEST);
      return request.operation === 'GetProfiles' ? profilesOf(profiles) : streamAnswer(address);
    });
  const tested = async (profiles: readonly FixtureProfile[]): Promise<OnvifSessionResult> => {
    const device = await camera(profiles);
    const result = await tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never());
    await device.stop();
    return result;
  };
  const locator = (timers: CaptureTimers = manualTimers()) => statedLocator(createOnvifStreamLocator({ timers }));

  const TWO_LENSES: readonly FixtureProfile[] = [
    { token: 'a.sub', source: 'vs_A', width: 704, height: 576 },
    { token: 'a.main', source: 'vs_A', width: 1920, height: 1080, encoding: 'H265' },
    { token: 'b.main', source: 'vs_B', width: 2560, height: 1440 },
    { token: 'b.sub', source: 'vs_B', width: 640, height: 360 },
    { token: 'a.main2', source: 'vs_A', width: 1920, height: 1080 },
  ];

  it('two video sources with several profiles each: 2 profiles, per source the largest pixel area, the larger picture first', async () => {
    const result = await tested(TWO_LENSES);
    expect(result.outcome).toBe(ConnectionTestOutcome.REACHABLE);
    expect(result.profiles).toEqual([
      { token: 'b.main', videoSourceToken: 'vs_B', width: 2560, height: 1440 },
      // The first of two equal areas; the encoding the device announces (H265 here) takes no part.
      { token: 'a.main', videoSourceToken: 'vs_A', width: 1920, height: 1080 },
    ]);
    // What the row does not touch: the H.264 list of task 3, in the device's order.
    expect(result.usableProfiles).toEqual(['a.sub', 'b.main', 'b.sub', 'a.main2']);
    expect(Object.isFrozen(result.profiles) && result.profiles.every((profile) => Object.isFrozen(profile))).toBe(true);
    // No profile code is formed here: every value is the device's token or a number.
    expect(JSON.stringify(result.profiles)).not.toMatch(/H264|HEVC|H265|1080P/);

    // Control: the order is the rule's and not the device's - the same answer for the reversed list, but for the tie.
    expect((await tested([...TWO_LENSES].reverse())).profiles.map((profile) => profile.token)).toEqual(['b.main', 'a.main2']);
    // Control: one video source gives ONE profile, however many it lists; no source named is one source too.
    expect((await tested(TWO_LENSES.map((profile) => ({ ...profile, source: 'vs_A' })))).profiles.map((profile) => profile.token)).toEqual(['b.main']);
    expect((await tested(TWO_LENSES.map((profile) => ({ ...profile, source: null })))).profiles).toEqual([{ token: 'b.main', videoSourceToken: null, width: 2560, height: 1440 }]);
    // Task 4 row 50 (amendment AM-2): a device that announces no H264 encoder is NOT_H264 BY THE ANNOUNCEMENT, which is
    // advice - its streams are named exactly as before, for the stream test to judge. (Until row 50 this line read
    // "a result that is not REACHABLE names none".) Every OTHER result that is not REACHABLE still names none.
    const announcedOther = await tested(TWO_LENSES.map((profile) => ({ ...profile, encoding: 'H265' })));
    expect([announcedOther.outcome, announcedOther.reason, announcedOther.usableProfiles]).toEqual([ConnectionTestOutcome.NOT_H264, OnvifTestReason.NO_H264_PROFILE, []]);
    expect(announcedOther.profiles.map((profile) => profile.token)).toEqual(['b.main', 'a.main']);
    expect((await tested([])).profiles).toEqual([]);
  });

  it('a token with lower-case letters, a dot, a colon and a hyphen is returned unchanged, and asked for unchanged', async () => {
    const ODD_TOKEN = 'Main.Stream:0-a';
    const device = await camera([{ token: ODD_TOKEN, source: 'Video.Source:0-b' }]);
    const result = await tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never());
    expect(result.profiles).toEqual([{ token: ODD_TOKEN, videoSourceToken: 'Video.Source:0-b', width: 1920, height: 1080 }]);
    expect(result.usableProfiles).toEqual([ODD_TOKEN]);
    expect(device.requests().filter((request) => request.operation === 'GetStreamUri').every((request) => request.body.includes(`>${ODD_TOKEN}</`))).toBe(true);

    const located = await locator().locate(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), ODD_TOKEN, never());
    expect(located).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, locator: `${STREAM}${ODD_DEVICE_HOST}:554/main` });
    expect(device.requests().at(-1)?.body).toContain(`>${ODD_TOKEN}</`);

    // Control: the token rule does refuse - 65 characters, a space, and (a limit of the package, which
    // reads the text of a plain number as a number) a token that is a plain number are not usable profiles.
    const refused = await tested([{ token: 'a'.repeat(65) }, { token: 'two words' }, { token: '101' }, { token: 'kept' }]);
    expect(refused.profiles.map((profile) => profile.token)).toEqual(['kept']);
  });

  it('device text in the source token and the size: bounded, held to the rule or answered as null; never copied', async () => {
    const HOSTILE = `${'x'.repeat(290)}&lt;b&gt;`;
    const result = await tested([
      { token: 'h.sub', source: HOSTILE, width: 640, height: 360 },
      { token: 'h.main', source: HOSTILE, width: 1280, height: 720 },
      { token: 'other', source: `${HOSTILE}2`, width: 800, height: 600 },
      // A source token that is a plain number reaches the file as a number (a limit of the package):
      // two sources still, neither token is answered. One with a leading zero stays text.
      { token: 'n0', source: '7', width: 320, height: 240 },
      { token: 'n1', source: '8', width: 320, height: 200 },
      { token: 'n2', source: '007', width: 160, height: 120 },
    ]);
    expect(result.profiles).toEqual([
      { token: 'h.main', videoSourceToken: null, width: 1280, height: 720 },
      { token: 'other', videoSourceToken: null, width: 800, height: 600 },
      { token: 'n0', videoSourceToken: null, width: 320, height: 240 },
      { token: 'n1', videoSourceToken: null, width: 320, height: 200 },
      { token: 'n2', videoSourceToken: '007', width: 160, height: 120 },
    ]);
    expect(JSON.stringify(result)).not.toContain('xxxxxxxx');

    // A size that is absent, zero, negative, not whole or above the bound is null and counts as area 0.
    const sizes = await tested([
      { token: 'absent', source: 's1', width: null },
      { token: 'zero', source: 's2', width: 0, height: 1080 },
      { token: 'negative', source: 's3', width: -1920, height: 1080 },
      { token: 'fraction', source: 's4', width: '1920.5', height: 1080 },
      { token: 'huge', source: 's5', width: 99_999, height: 99_999 },
      { token: 'text', source: 's6', width: 'wide', height: 'high' },
      { token: 'small', source: 's7', width: 320, height: 240 },
    ]);
    expect(sizes.profiles).toEqual([
      { token: 'small', videoSourceToken: 's7', width: 320, height: 240 },
      ...['absent', 'zero', 'negative', 'fraction', 'huge', 'text'].map((token, index) => ({ token, videoSourceToken: `s${index + 1}`, width: null, height: null })),
    ]);
    // Control: within one source the one profile with a believable size wins over a "larger" unbelievable one.
    expect((await tested([{ token: 'huge', width: 99_999, height: 99_999 }, { token: 'small', width: 320, height: 240 }])).profiles.map((profile) => profile.token)).toEqual(['small']);
  });

  it('locate on the fake stub: the credential-free locator of the profile, ONE authenticated GetStreamUri, no profile listed, no stream opened', async () => {
    const stub = await startStub();
    const timers = manualTimers();
    // The facade ITSELF is judged below (`made`); the calls go through the helper that states the source address (finding E-02).
    const made = createOnvifStreamLocator({ timers });
    const facade = statedLocator(made);
    const result = await facade.locate(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), 'profile_1', never());
    expect(result).toEqual({
      outcome: ConnectionTestOutcome.REACHABLE,
      reason: null,
      locator: stub.addresses().streamUri,
      reads: ['GetSystemDateAndTime', 'GetServices', 'GetStreamUri'],
      credentialRequests: 1,
      rejectedCredentialRequests: 0,
    });
    expect(result.locator).not.toContain('@');
    expect(deviceRequests(stub).map((request) => `${request.operation}:${request.authPresent}`)).toEqual(['GetSystemDateAndTime:false', 'GetServices:false', 'GetStreamUri:false', 'GetStreamUri:true']);
    expect(stub.requestLog().filter((request) => request.channel !== 'device')).toEqual([]);
    expect(stub.violations()).toEqual([]);
    expect(timers.pending()).toBe(0);
    // The facade has one member, and neither it nor its answer holds the credential.
    expect(Object.keys(made)).toEqual(['locate']);
    expect(Object.isFrozen(made) && Object.isFrozen(result)).toBe(true);
    // Finding E-02: FIVE declared parameters - the source address has no default and cannot be left out.
    expect(made.locate).toHaveLength(5);
    const text = `${inspect([made, result], { depth: 12, showHidden: true, getters: true })}\n${JSON.stringify(result)}`;
    expect(text.includes(ACCOUNT.secret) || text.includes(ACCOUNT.username)).toBe(false);

    // A wrong secret: one request carried it, the refusal is final, no locator.
    stub.resetLog();
    const refused = await facade.locate(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(WRONG), 'profile_1', never());
    expect(refused).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: OnvifTestReason.CREDENTIAL_REFUSED, locator: null, credentialRequests: 1, rejectedCredentialRequests: 1 });
    expect(deviceRequests(stub).filter((request) => request.authPresent)).toHaveLength(1);
    // A stream address on another host is not a locator.
    stub.setDeviceMode('FOREIGN_STREAM_HOST');
    expect(await facade.locate(candidateAt(stub.addresses().deviceServiceUrl), sealCredential(ACCOUNT), 'profile_1', never())).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.STREAM_HOST_MISMATCH, locator: null });
    expect(stub.violations()).toEqual([]);
  });

  it('a locator with a user part is refused; so is every address that is not the host-and-path form, and no part of it is answered', async () => {
    const results: OnvifLocatorResult[] = [];
    for (const [address, reason] of [
      [`${STREAM}someone:something@${ODD_DEVICE_HOST}:554/main`, OnvifTestReason.STREAM_USER_PART],
      [`${STREAM}someone@${ODD_DEVICE_HOST}/main`, OnvifTestReason.STREAM_USER_PART],
      [`${STREAM}${ODD_DEVICE_HOST}/main?next=someone@elsewhere`, OnvifTestReason.STREAM_USER_PART],
      // Task 4 row 174 (C24): a query is no longer refused as such (`?channel=someone` is a locator now, see
      // the block of row 174 below); the query of this line stays refused, by the name of its parameter.
      [`${STREAM}${ODD_DEVICE_HOST}/main?token=someone`, OnvifTestReason.STREAM_LOCATOR_FORM],
      [`${STREAM}${ODD_DEVICE_HOST}/main#someone`, OnvifTestReason.STREAM_LOCATOR_FORM],
      [`${STREAM}${ODD_DEVICE_HOST}/someone/`, OnvifTestReason.STREAM_LOCATOR_FORM],
      [`${STREAM}${ODD_DEVICE_HOST}/someoné`, OnvifTestReason.STREAM_LOCATOR_FORM],
      [`${STREAM}${ODD_DEVICE_HOST}/${'someone'.repeat(40)}`, OnvifTestReason.STREAM_LOCATOR_FORM],
      [`http://${ODD_DEVICE_HOST}/someone`, OnvifTestReason.STREAM_SCHEME],
      [`${STREAM}${ODD_DEVICE_FOREIGN_HOST}/someone`, OnvifTestReason.STREAM_HOST_MISMATCH],
      ['', OnvifTestReason.STREAM_ADDRESS_MISSING],
    ] as const) {
      const device = await camera([{ token: 'main' }], address);
      const result = await locator().locate(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), 'main', never());
      expect(result, address).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason, locator: null });
      results.push(result);
      await device.stop();
    }
    expect(inspect(results, { depth: 12 })).not.toMatch(/someon|something|elsewhere/);
    // Control: the same device with the host-and-path form is answered, unchanged.
    const device = await camera([{ token: 'main' }], `${STREAM}${ODD_DEVICE_HOST}:554/someone/main`);
    expect((await locator().locate(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), 'main', never())).locator).toBe(`${STREAM}${ODD_DEVICE_HOST}:554/someone/main`);
  });

  it('locate refuses before any request: a token outside the token form, an aborted signal, a candidate that may not be contacted', async () => {
    const stub = await startStub();
    const address = stub.addresses().deviceServiceUrl;
    for (const token of ['', 'two words', 'a'.repeat(65), 'main</ProfileToken><x>', 'mäin']) {
      await expect(locator().locate(candidateAt(address), sealCredential(ACCOUNT), token, never()), token).rejects.toMatchObject({ code: CaptureAdapterRefusal.PROFILE_UNKNOWN });
    }
    const aborted = new AbortController();
    aborted.abort();
    await expect(locator().locate(candidateAt(address), sealCredential(ACCOUNT), 'profile_1', aborted.signal)).rejects.toMatchObject({ code: CaptureAdapterRefusal.ABORTED });
    await expect(locator().locate(candidateAt(address, { host: ODD_DEVICE_FOREIGN_HOST }), sealCredential(ACCOUNT), 'profile_1', never())).rejects.toMatchObject({ code: CaptureAdapterRefusal.LOCATOR_INVALID });
    expect(stub.requestLog()).toEqual([]);
    // Control: the same stub does log a locate that may run.
    await locator().locate(candidateAt(address), sealCredential(ACCOUNT), 'profile_1', never());
    expect(stub.requestLog().length).toBeGreaterThan(0);
  });

  it('locate ends in a named outcome whatever the device does: a profile it does not know, silence until the deadline, no credential', async () => {
    const unknown = await startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      if (request.authorization === '') return notAuthorizedFault(401, DIGEST);
      return { kind: 'ANSWER', status: 400, body: soapEnvelope('<s:Fault><s:Code><s:Value>s:Sender</s:Value></s:Code><s:Reason><s:Text xml:lang="en">no such profile</s:Text></s:Reason></s:Fault>') };
    });
    expect(await locator().locate(candidateAt(unknown.serviceUrl), sealCredential(ACCOUNT), 'gone', never())).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.STREAM_ADDRESS_MISSING, locator: null, rejectedCredentialRequests: 0 });

    const silent = await startOdd(() => ({ kind: 'HANG' }));
    const deadline = new AbortController();
    const timers = manualTimers();
    const pending = locator(timers).locate(candidateAt(silent.serviceUrl), sealCredential(ACCOUNT), 'main', deadline.signal);
    await expect.poll(() => silent.requests().length).toBe(1);
    deadline.abort();
    expect(await pending).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.DEADLINE, locator: null, credentialRequests: 0 });
    expect(timers.pending()).toBe(0);

    const stub = await startStub();
    expect(await locator().locate(candidateAt(stub.addresses().deviceServiceUrl), null, 'profile_1', never())).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: OnvifTestReason.CREDENTIAL_ABSENT, locator: null, credentialRequests: 0 });
    expect(deviceRequests(stub).filter((request) => request.authPresent)).toEqual([]);
  });

  // Integration pass I-2: the same rules on the fake stub's own profile set (the request of this row),
  // beside the scripted device above, which keeps the controls a fixed set cannot give.
  it('on the fake stub with two video sources: the largest profile of each source, the odd token unchanged, and the locator of each profile by its own token', async () => {
    const stub = await startStub({ profileSet: 'TWO_SOURCES' });
    const address = stub.addresses().deviceServiceUrl;
    const result = await tester().test(candidateAt(address), sealCredential(ACCOUNT), never());
    expect(result.outcome).toBe(ConnectionTestOutcome.REACHABLE);
    expect(result.profiles).toEqual([
      { token: FAKE_ONVIF_ODD_PROFILE_TOKEN, videoSourceToken: 'Video.Source:0-b', width: 2560, height: 1440 },
      { token: 'lens1.main', videoSourceToken: 'vs_1', width: 1920, height: 1080 },
    ]);
    expect(result.usableProfiles).toEqual(FAKE_ONVIF_TWO_SOURCE_PROFILES.map((profile) => profile.token));

    const rtspPort = Number(new URL(stub.addresses().streamUri).port);
    for (const profile of FAKE_ONVIF_TWO_SOURCE_PROFILES) {
      const located = await locator().locate(candidateAt(address), sealCredential(ACCOUNT), profile.token, never());
      expect(located, profile.token).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, locator: fakeOnvifProfileStreamUri(rtspPort, profile), credentialRequests: 1 });
    }
    // A token the device does not list ends in a named outcome, with no locator.
    expect(await locator().locate(candidateAt(address), sealCredential(ACCOUNT), 'profile_1', never())).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.STREAM_ADDRESS_MISSING, locator: null });
    expect(stub.violations()).toEqual([]);
    expect(stub.requestLog().filter((request) => request.channel !== 'device')).toEqual([]);
  });

  // Task 4 row 174 (decision C24): the stream locator may carry a QUERY, under a closed rule. Every
  // device of this block is the scripted device (the fake stub names its streams without a query);
  // each bound of the rule is a named case with its control on the allowed side.
  describe('task 4 row 174 (C24): a stream locator with a query, under the closed rule', () => {
    const BASE = `${STREAM}${ODD_DEVICE_HOST}:554/cam/realmonitor`;
    /** The address as the device's XML answer carries it. */
    const inXml = (address: string): string => address.replaceAll('&', '&amp;');
    const located = async (address: string): Promise<OnvifLocatorResult> => {
      const device = await camera([{ token: 'main' }], inXml(address));
      const result = await locator().locate(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), 'main', never());
      await device.stop();
      return result;
    };
    const READS = ['GetSystemDateAndTime', 'GetServices', 'GetStreamUri'];
    /** The whole answer of an allowed locator: the device's text, unchanged. */
    const allowed = (address: string) => ({ outcome: ConnectionTestOutcome.REACHABLE, reason: null, locator: address, reads: READS, credentialRequests: 1, rejectedCredentialRequests: 0 });
    /** The WHOLE answer of a refusal: a code and counts, so no part of the address can be in it. */
    const refused = (reason: OnvifTestReason = OnvifTestReason.STREAM_LOCATOR_FORM) => ({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reason, locator: null, reads: READS, credentialRequests: 1, rejectedCredentialRequests: 0 });
    const expectAllowed = async (addresses: readonly string[]): Promise<void> => {
      for (const address of addresses) expect(await located(address), address).toEqual(allowed(address));
    };
    const expectRefused = async (addresses: readonly string[], reason?: OnvifTestReason): Promise<void> => {
      for (const address of addresses) expect(await located(address), address).toEqual(refused(reason));
    };
    const CREDENTIAL_LIKE = ['user', 'username', 'pass', 'password', 'pwd', 'auth', 'token', 'key', 'secret', 'session'] as const;

    it('an allowed query is returned unchanged: the forms common cameras name their stream with', async () => {
      await expectAllowed([
        `${BASE}?channel=1&subtype=0`,
        `${BASE}?channel=1&subtype=0&unicast=true&proto=Onvif`,
        `${STREAM}${ODD_DEVICE_HOST}/Streaming/Channels/101?transportmode=unicast&profile=Profile_1`,
        `${STREAM}${ODD_DEVICE_HOST}/onvif-media/media.amp?profile=profile_1_h264&sessiontimeout=60&streamtype=unicast`,
        // A parameter without a value, and every character of the closed set.
        `${BASE}?real_stream`,
        `${BASE}?a.b_c~d-E9=F.g_h~i-0`,
      ]);
      // Control: the same path without a query is a locator as before.
      await expectAllowed([BASE]);
      // The connection test is untouched: it compares the address and drops it, query or not.
      const device = await camera([{ token: 'main' }], inXml(`${BASE}?channel=1&subtype=0`));
      const tested = await tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never());
      expect(tested.outcome).toBe(ConnectionTestOutcome.REACHABLE);
      expect(JSON.stringify(tested)).not.toMatch(/channel|subtype|realmonitor/);
    });

    it('over-length: the query at most 128 characters, the locator at most 256, at most 8 parameters, a name 32 and a value 64', async () => {
      const pad = (length: number, lead = 'a='): string => `${lead}${'x'.repeat(length - lead.length)}`;
      // The query: two parameters of 64 and 63 characters and the `&` are 128; one more character is refused.
      const at128 = `${pad(64)}&${pad(63, 'b=')}`;
      expect(at128).toHaveLength(128);
      await expectAllowed([`${BASE}?${at128}`]);
      await expectRefused([`${BASE}?${at128}x`]);
      // The locator: a path that fills it to 256 with a short query is a locator; 257 is not.
      const short = '?channel=1';
      const fill = (total: number): string => `${STREAM}${ODD_DEVICE_HOST}/${'p'.repeat(total - `${STREAM}${ODD_DEVICE_HOST}/${short}`.length)}${short}`;
      expect(fill(256)).toHaveLength(256);
      await expectAllowed([fill(256)]);
      await expectRefused([fill(257)]);
      // The number of parameters, the length of a name and of a value.
      const numbered = (count: number): string => Array.from({ length: count }, (_unused, index) => `p${index}=1`).join('&');
      await expectAllowed([`${BASE}?${numbered(8)}`, `${BASE}?${'n'.repeat(32)}=1`, `${BASE}?v=${'1'.repeat(64)}`]);
      await expectRefused([`${BASE}?${numbered(9)}`, `${BASE}?${'n'.repeat(33)}=1`, `${BASE}?v=${'1'.repeat(65)}`]);
    });

    it('a character outside the closed set is refused, in a name and in a value; so is every shape that is not name or name=value joined by &', async () => {
      const outside = ['%', '+', ';', '/', ':', ',', '*', '!', '$', '(', ')', '[', ']', '{', '}', '|', '^', '`', "'", '?', '\\'];
      await expectRefused(outside.map((character) => `${BASE}?channel=1${character}2`));
      await expectRefused(outside.map((character) => `${BASE}?chan${character}nel=1`));
      await expectRefused([
        `${BASE}?channel=1&mode=café`, // not ASCII
        `${BASE}?`, // an empty query
        `${BASE}?=1`, // an empty name
        `${BASE}?channel=1&&subtype=0`, // an empty parameter
        `${BASE}?&channel=1`,
        `${BASE}?channel=1&`,
        `${BASE}?channel=1=2`, // a second `=`
        `${BASE}/?channel=1`, // the path rule of the injection point still holds before the query
      ]);
      // Control: the same shapes with characters of the set are locators.
      await expectAllowed([`${BASE}?channel=12`, `${BASE}?channel=1&subtype=0`]);
    });

    it('each of the 10 credential-like parameter names is refused, in lower case, in upper case and in mixed case, wherever it stands', async () => {
      expect(CREDENTIAL_LIKE).toHaveLength(10);
      for (const name of CREDENTIAL_LIKE) {
        const mixed = `${name.slice(0, 1).toUpperCase()}${name.slice(1, 2)}${name.slice(2).toUpperCase()}`;
        await expectRefused([
          `${BASE}?${name}=1`,
          `${BASE}?${name.toUpperCase()}=1`,
          `${BASE}?${mixed}=1`,
          `${BASE}?channel=1&${name}=1`, // not the first parameter
          `${BASE}?channel=1&${name.toUpperCase()}=1&subtype=0`,
          `${BASE}?${name}`, // without a value
        ]);
      }
      // Control (row 174b, C127 C-4): a name is judged by the class of a part it holds; the camera's own `sessiontimeout` with digits, and a longer name holding only a short whole word, are locators.
      await expectAllowed([`${BASE}?sessiontimeout=60&pwm=1&busrate=2&accountancy=3`]);
      await expectRefused([`${BASE}?keyframe=1`, `${BASE}?authmode=digest`, `${BASE}?username2=a`, `${BASE}?tokens=2`, `${BASE}?apikey=1`, `${BASE}?access_token=1`, `${BASE}?sessiontimeout=abc`]);
    });

    it('a percent-encoded parameter name is refused: no name hides behind an encoding, because no encoding is admitted', async () => {
      await expectRefused([
        `${BASE}?%70assword=1`, // "password", first letter encoded
        `${BASE}?p%61ss=1`,
        `${BASE}?%75%73%65%72=1`, // "user", every letter encoded
        `${BASE}?%2570assword=1`, // encoded twice
        `${BASE}?channel=1%26token=1`, // an encoded separator in front of a name
        `${BASE}?channel=1%3Btoken%3D1`,
        `${BASE}?channel=%31`, // an encoded value: refused too, the set has no `%`
      ]);
    });

    it('a repeated parameter is refused, whatever the letter case of its two names', async () => {
      await expectRefused([`${BASE}?channel=1&channel=2`, `${BASE}?channel=1&subtype=0&Channel=1`, `${BASE}?flag&flag`, `${BASE}?channel=1&token=1&channel=1`]);
      // Control: two different names with the same value are a locator.
      await expectAllowed([`${BASE}?channel=1&subtype=1`]);
    });

    it('an empty value is allowed for a plain name and changes nothing for a credential-like one', async () => {
      await expectAllowed([`${BASE}?channel=`, `${BASE}?channel=&subtype=0`]);
      await expectRefused([`${BASE}?password=`, `${BASE}?channel=&secret=`]);
    });

    it('a fragment is refused, with or without a query, also an empty one', async () => {
      await expectRefused([`${BASE}?channel=1#part`, `${BASE}#part?channel=1`, `${BASE}#part`, `${BASE}?channel=1#`, `${BASE}#`]);
    });

    it('a query that looks like a credential only by a VALUE is a locator: values are not judged', async () => {
      await expectAllowed([`${BASE}?mode=password&stream=token&profile=secret_key&name=user`, `${BASE}?kind=session&channel=auth`]);
    });

    it('a user part stays refused beside a query, wherever the @ stands, and by its own reason', async () => {
      await expectRefused(
        [`${STREAM}someone:something@${ODD_DEVICE_HOST}:554/cam/realmonitor?channel=1&subtype=0`, `${STREAM}someone@${ODD_DEVICE_HOST}/main?channel=1`, `${BASE}?channel=1&next=someone@elsewhere`],
        OnvifTestReason.STREAM_USER_PART,
      );
      // A foreign host and another scheme keep their reasons beside an allowed query.
      await expectRefused([`${STREAM}${ODD_DEVICE_FOREIGN_HOST}/main?channel=1`], OnvifTestReason.STREAM_HOST_MISMATCH);
      await expectRefused([`http://${ODD_DEVICE_HOST}/main?channel=1`], OnvifTestReason.STREAM_SCHEME);
    });
  });
});

// Task 4 integration pass I-7 (the request of row 49; blueprint section 8.4): the time read the camera
// watch asks through its seam `CameraTimeReader`. One read, no credential, the device's words untrusted.
describe('task 4 integration pass I-7: the time read of a camera, without a credential', () => {
  const reader = (timers: CaptureTimers = manualTimers(), limits: Partial<typeof ONVIF_SESSION_LIMITS> = {}) => createOnvifTimeReader({ timers, limits });
  /** The clock element of an answer, written by the test: the device's own text. */
  const clockBody = (inner: string): OddDeviceReply => ok(`<tds:GetSystemDateAndTimeResponse><tds:SystemDateAndTime><tt:DateTimeType>NTP</tt:DateTimeType>${inner}</tds:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>`);
  const instant = (name: string, at: Date, hour: string = String(at.getUTCHours())): string =>
    `<tt:${name}><tt:Time><tt:Hour>${hour}</tt:Hour><tt:Minute>${at.getUTCMinutes()}</tt:Minute><tt:Second>${at.getUTCSeconds()}</tt:Second></tt:Time>` +
    `<tt:Date><tt:Year>${at.getUTCFullYear()}</tt:Year><tt:Month>${at.getUTCMonth() + 1}</tt:Month><tt:Day>${at.getUTCDate()}</tt:Day></tt:Date></tt:${name}>`;

  it('on the fake stub: ONE unauthenticated GetSystemDateAndTime, the instant the device names in whole seconds (control: a device whose clock is 90 s ahead)', async () => {
    for (const clockOffsetMs of [0, 90_000]) {
      const stub = await startStub({ clockOffsetMs });
      const before = Date.now();
      const answer = await reader().read(candidateAt(stub.addresses().deviceServiceUrl), never());
      const after = Date.now();
      expect(Object.keys(answer).sort()).toEqual(['answered', 'cameraUtcMs']);
      expect(answer.answered).toBe(true);
      const cameraUtcMs = answer.cameraUtcMs ?? Number.NaN;
      // The answer carries whole seconds: the device's instant, cut to its second.
      expect(cameraUtcMs % 1_000).toBe(0);
      expect(cameraUtcMs).toBeGreaterThan(before + clockOffsetMs - 1_000);
      expect(cameraUtcMs).toBeLessThanOrEqual(after + clockOffsetMs);
      // What reached the device: the one read, nothing offered with it, no other channel.
      expect(stub.requestLog().map((request) => `${request.channel}:${request.operation}:${request.authPresent}`)).toEqual(['device:GetSystemDateAndTime:false']);
      expect(stub.violations()).toEqual([]);
    }
  });

  it('a device that keeps its clock behind authentication ANSWERED and names no instant; no request carried anything, and no other read was made', async () => {
    const digest = { 'WWW-Authenticate': 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", qop="auth"' };
    for (const refusal of [notAuthorizedFault(401, digest), notAuthorizedFault(400)]) {
      const device = await startOdd(() => refusal);
      expect(await reader().read(candidateAt(device.serviceUrl), never())).toEqual({ answered: true, cameraUtcMs: null });
      expect(device.requests().length).toBeGreaterThanOrEqual(1);
      expect([...new Set(device.requests().map((request) => request.operation))]).toEqual(['GetSystemDateAndTime']);
      expect(device.requests().filter((request) => request.authorization !== '' || request.token)).toEqual([]);
      await device.stop();
    }
  });

  it('device text is untrusted: an answer without a UTC instant, with a local time only, or with a date that is none hands out NO instant (never the Core\'s own clock, never a local time read as UTC)', async () => {
    const at = new Date(Date.UTC(2031, 4, 17, 9, 30, 15));
    // CONTROL: the same script with a UTC instant is read, exactly.
    const stated = await startOdd(() => clockBody(instant('UTCDateTime', at)));
    expect(await reader().read(candidateAt(stated.serviceUrl), never())).toEqual({ answered: true, cameraUtcMs: at.getTime() });
    await stated.stop();
    // A UTC instant beside a local one: the UTC one.
    const both = await startOdd(() => clockBody(instant('UTCDateTime', at) + instant('LocalDateTime', new Date(at.getTime() + 7 * 3_600_000))));
    expect(await reader().read(candidateAt(both.serviceUrl), never())).toEqual({ answered: true, cameraUtcMs: at.getTime() });
    await both.stop();

    const noInstant: readonly OddDeviceReply[] = [
      // No instant at all: the package would answer the clock of the Core itself.
      clockBody(''),
      // A local time only: the package would read it as UTC.
      clockBody(instant('LocalDateTime', at)),
      // A UTC element whose hour is no number.
      clockBody(instant('UTCDateTime', at, 'noon')),
      // A UTC element with nothing in it.
      clockBody('<tt:UTCDateTime></tt:UTCDateTime>'),
      // The element name inside a text, not as an element.
      clockBody(`<tt:TimeZone><tt:TZ>UTCDateTime</tt:TZ></tt:TimeZone>${instant('LocalDateTime', at)}`),
    ];
    for (const [index, reply] of noInstant.entries()) {
      const device = await startOdd(() => reply);
      const answer = await reader().read(candidateAt(device.serviceUrl), never());
      expect(answer.cameraUtcMs, `answer ${index}`).toBeNull();
      expect(device.requests().map((request) => request.operation), `answer ${index}`).toEqual(['GetSystemDateAndTime']);
      await device.stop();
    }
  });

  it('whatever the device does, the read resolves: no ONVIF answer, a closed port, silence until the deadline and an endless body are "not answered"', async () => {
    const html = await startOdd(() => ({ kind: 'ANSWER', status: 200, body: '<html><body>hello</body></html>' }));
    expect(await reader().read(candidateAt(html.serviceUrl), never())).toEqual({ answered: false, cameraUtcMs: null });

    const stub = await startStub();
    const address = stub.addresses().deviceServiceUrl;
    await stub.closeDeviceListener();
    expect(await reader().read(candidateAt(address), never())).toEqual({ answered: false, cameraUtcMs: null });

    const silent = await startOdd(() => ({ kind: 'HANG' }));
    const deadline = new AbortController();
    const timers = manualTimers();
    const pending = reader(timers).read(candidateAt(silent.serviceUrl), deadline.signal);
    await expect.poll(() => silent.requests().length).toBe(1);
    deadline.abort();
    expect(await pending).toEqual({ answered: false, cameraUtcMs: null });
    expect(timers.pending()).toBe(0);

    const flood = await startOdd(() => ({ kind: 'FLOOD', chunkBytes: 16 * 1024 }));
    expect(await reader(manualTimers(), { maxReceivedBytes: 64 * 1024 }).read(candidateAt(flood.serviceUrl), never())).toEqual({ answered: false, cameraUtcMs: null });
  });

  it('refused before any request: a signal already aborted, and a candidate that may not be contacted (the address rule of the test)', async () => {
    const stub = await startStub();
    const address = stub.addresses().deviceServiceUrl;
    const aborted = new AbortController();
    aborted.abort();
    await expect(reader().read(candidateAt(address), aborted.signal)).rejects.toMatchObject({ code: CaptureAdapterRefusal.ABORTED });
    const refused: readonly CameraCandidate[] = [
      candidateAt(address, { testable: false }),
      candidateAt(address, { conflict: true }),
      candidateAt(null),
      candidateAt(address, { host: ODD_DEVICE_FOREIGN_HOST }),
      candidateAt(`http://${ODD_DEVICE_FOREIGN_HOST}/onvif/device_service`),
      candidateAt(address.replace('http://', 'http://someone:something@')),
      candidateAt(`${address}?next=1`),
    ];
    for (const candidate of refused) await expect(reader().read(candidate, never())).rejects.toMatchObject({ code: CaptureAdapterRefusal.LOCATOR_INVALID });
    expect(stub.requestLog()).toEqual([]);
    // Control: the same stub does log a candidate that may be contacted.
    await reader().read(candidateAt(address), never());
    expect(stub.requestLog()).toHaveLength(1);
  });

  it('no credential is in its reach: the call takes a candidate, a signal and (row 143b) the address to connect from, and the facade is the one frozen call', () => {
    const facade = reader();
    expect(Object.keys(facade)).toEqual(['read']);
    expect(Object.isFrozen(facade)).toBe(true);
    // Three parameters since row 143b: the third is the source address, a dotted literal - a credential still has no way in.
    expect(facade.read).toHaveLength(3);
  });
});

// Task 4 row 143b (S13-11 point 2; the SOURCE half of the destination rule): every request of the ONVIF session to a
// STORED camera leaves from the camera-interface address the rule named. The three calls take it last.
//
// WHAT LOOPBACK SHOWS: (1) with the address this host holds on the fixture's network (127.0.0.1) every read works as
// before; (2) with an address this host does NOT hold (192.0.2.1, a documentation address) NOTHING reaches the device -
// 0 requests in the stub's log - and each call ends in its named "no answer"; (3) a text that is no source address is
// refused before any request. WHAT IT CANNOT SHOW: that the address of a SECOND interface is the one a camera sees, and
// that a camera reachable only through the other interface is not reached: this Mac's doubles have one network.
describe('row 143b: the requests of the session leave from the source address handed in, or do not leave', () => {
  const NOT_THIS_HOSTS = '192.0.2.1';
  const reader = (timers: CaptureTimers = manualTimers()) => createOnvifTimeReader({ timers });
  const locator = (timers: CaptureTimers = manualTimers()) => statedLocator(createOnvifStreamLocator({ timers }));

  // Review 060b section 7.4 (3), row T2: on loopback a connection that was never given a local address arrives from
  // 127.0.0.1 as well, so "it answered" passes with the source address dropped. What is asked here instead is THE
  // CONNECTION REQUEST ITSELF: every connection an HTTP agent of this process makes while `run` runs is written down
  // with the local address and the family it was asked with (the agent's own maker is wrapped and put back; the
  // connection is then made as always). That the system honours a local address is the next case: 192.0.2.1 gets none.
  const dialsOf = async (run: () => Promise<void>): Promise<Array<{ localAddress: unknown; family: unknown; port: unknown }>> => {
    const dials: Array<{ localAddress: unknown; family: unknown; port: unknown }> = [];
    const made = Reflect.get(HttpAgent.prototype, 'createConnection') as (this: unknown, options: Record<string, unknown>, callback?: unknown) => unknown;
    expect(typeof made).toBe('function');
    Reflect.set(HttpAgent.prototype, 'createConnection', function wrapped(this: unknown, options: Record<string, unknown>, callback?: unknown): unknown {
      dials.push({ localAddress: 'localAddress' in options ? options.localAddress : 'NOT STATED', family: 'family' in options ? options.family : 'NOT STATED', port: Number(options.port) });
      return made.call(this, options, callback);
    });
    try {
      await run();
    } finally {
      Reflect.set(HttpAgent.prototype, 'createConnection', made);
    }
    return dials;
  };

  it('the address this host holds: the test, the locator read and the time read answer as they do without one (control)', async () => {
    const stub = await startStub();
    const candidate = candidateAt(stub.addresses().deviceServiceUrl);
    const port = Number(new URL(stub.addresses().deviceServiceUrl).port);
    const dials = await dialsOf(async () => {
      expect(await tester().test(candidate, sealCredential(ACCOUNT), never(), FAKE_ONVIF_HOST)).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, reason: null, rejectedCredentialRequests: 0 });
      expect(await locator().locate(candidate, sealCredential(ACCOUNT), 'profile_1', never(), FAKE_ONVIF_HOST)).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, locator: stub.addresses().streamUri });
      expect(await reader().read(candidate, never(), FAKE_ONVIF_HOST)).toMatchObject({ answered: true });
    });
    // Every one of them reached the device: the stub saw the reads of all three.
    expect(deviceRequests(stub).map((request) => request.operation).filter((operation) => operation === 'GetSystemDateAndTime')).toHaveLength(3);
    expect(stub.violations()).toEqual([]);
    // FROM THAT ADDRESS: one connection for every request the stub saw, and EVERY one was asked with the source
    // address handed in as its local address, family 4. A session that drops the address states none: this fails.
    expect(dials.length).toBeGreaterThanOrEqual(3);
    expect(dials.length).toBe(stub.requestLog().length);
    expect(dials.filter((dial) => dial.localAddress !== FAKE_ONVIF_HOST || dial.family !== 4 || dial.port !== port)).toEqual([]);
    // CONTROL of the record: the same read with NO source address states no local address - so the one stated
    // above is the session's own doing, and the record tells the two apart.
    const plain = await dialsOf(async () => {
      expect(await reader().read(candidate, never())).toMatchObject({ answered: true });
    });
    expect(plain).toEqual([{ localAddress: 'NOT STATED', family: 'NOT STATED', port }]);
  });

  it('an address this host does not hold: 0 requests reach the device - the test and the locator read are UNREACHABLE (NO_ANSWER), the time read is not answered; no credential travelled', async () => {
    const stub = await startStub();
    const candidate = candidateAt(stub.addresses().deviceServiceUrl);
    const timers = manualTimers();
    expect(await tester(timers).test(candidate, sealCredential(ACCOUNT), never(), NOT_THIS_HOSTS)).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NO_ANSWER, credentialRequests: 0, rejectedCredentialRequests: 0, profiles: [], usableProfiles: [] });
    expect(await locator(timers).locate(candidate, sealCredential(ACCOUNT), 'profile_1', never(), NOT_THIS_HOSTS)).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NO_ANSWER, locator: null, credentialRequests: 0 });
    expect(await reader(timers).read(candidate, never(), NOT_THIS_HOSTS)).toEqual({ answered: false, cameraUtcMs: null });
    expect(stub.requestLog()).toEqual([]);
    expect(timers.pending()).toBe(0);
    // Control: the SAME stub, the same candidate, with no source address handed in: it is reached.
    expect(await reader().read(candidate, never())).toMatchObject({ answered: true });
    expect(stub.requestLog()).toHaveLength(1);
  });

  it('a text that is no source address is refused before any request by all three calls: never a dial without it', async () => {
    const stub = await startStub();
    const candidate = candidateAt(stub.addresses().deviceServiceUrl);
    for (const notASource of ['', '0.0.0.0', 'localhost', 'camera-interface', '192.168.050.1', '127.0.0.1:0', ' 127.0.0.1', '224.0.0.1', '255.255.255.255', '::1', '3232248321']) {
      await expect(tester().test(candidate, sealCredential(ACCOUNT), never(), notASource), notASource).rejects.toMatchObject({ code: CaptureAdapterRefusal.LOCATOR_INVALID });
      await expect(locator().locate(candidate, sealCredential(ACCOUNT), 'profile_1', never(), notASource), notASource).rejects.toMatchObject({ code: CaptureAdapterRefusal.LOCATOR_INVALID });
      await expect(reader().read(candidate, never(), notASource), notASource).rejects.toMatchObject({ code: CaptureAdapterRefusal.LOCATOR_INVALID });
    }
    for (const notAText of [null, 0, 2130706433, ['127.0.0.1'], { address: '127.0.0.1' }]) {
      await expect(reader().read(candidate, never(), notAText as unknown as string)).rejects.toMatchObject({ code: CaptureAdapterRefusal.LOCATOR_INVALID });
    }
    expect(stub.requestLog()).toEqual([]);
  });
});

// Task 4 row 143c (decision C65): THE THIRD DIAL of a stored camera - the camera watch's time read - through the REAL
// time reader of this file against the fake stub. The rule of each case is a rule of THIS test (the stub lives on
// loopback): it admits the stub's address and names the source address under test. The stub's per-request record is
// the proof: a refusal is 0 requests.
describe('row 143c: the camera watch reads the time from the source address its rule names, or sends nothing', () => {
  const NOT_THIS_HOSTS = '192.0.2.1';
  const admitFrom = (source: unknown): StoredCameraAddressRule => ((host: string) => (host === FAKE_ONVIF_HOST ? { allowed: true, destination: source === undefined ? { address: host } : { address: host, sourceAddress: source } } : { allowed: false, refusal: 'TEST_RULE_LOOPBACK_ONLY' })) as StoredCameraAddressRule;
  const watchOf = (candidate: CameraCandidate, rule: StoredCameraAddressRule | undefined) => {
    const reports: CameraWatchReport[] = [];
    const timers = manualTimers();
    const watch = createCameraWatch({ timers, now: () => Date.now(), reader: createOnvifTimeReader({ timers: manualTimers() }), candidate: async () => candidate, ...(rule === undefined ? {} : { storedAddress: rule }), report: (report) => reports.push(report) });
    return { watch, reports, timers };
  };
  const outcomeOf = async (pending: Promise<unknown>): Promise<unknown> => pending.then((value) => value, (error: unknown) => error);

  it('the address this host holds: `check`, `clockOffsetMs` and a heartbeat each reach the device with ONE clock read and no credential (control)', async () => {
    const stub = await startStub();
    const { watch, reports } = watchOf(candidateAt(stub.addresses().deviceServiceUrl), admitFrom(FAKE_ONVIF_HOST));
    expect(await watch.check('CAM-01', never())).toMatchObject({ present: true });
    expect(Math.abs(await watch.clockOffsetMs('CAM-01'))).toBeLessThan(5_000);
    watch.watch('CAM-01');
    await expect.poll(() => watch.presence('CAM-01')).toBe(CameraPresence.PRESENT);
    watch.close();
    expect(deviceRequests(stub).map((request) => request.operation)).toEqual(['GetSystemDateAndTime', 'GetSystemDateAndTime', 'GetSystemDateAndTime']);
    expect(stub.requestLog().filter((request) => request.authPresent)).toEqual([]);
    expect(stub.violations()).toEqual([]);
    expect(reports).toEqual([]);
  });

  it('an address this host does not hold: 0 requests reach the device - `check` answers absent, the clock read is not answered, the heartbeat counts no answer', async () => {
    const stub = await startStub();
    const { watch, timers } = watchOf(candidateAt(stub.addresses().deviceServiceUrl), admitFrom(NOT_THIS_HOSTS));
    expect(await watch.check('CAM-01', never())).toEqual({ present: false, clockOffsetMs: null, clockWithinBound: false });
    expect(await outcomeOf(watch.clockOffsetMs('CAM-01'))).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_NOT_ANSWERED' });
    watch.watch('CAM-01');
    // Two beats without an answer: the second is asked for by the interval timer of the first (the manual timers are fired here).
    await expect
      .poll(() => {
        timers.fireAll();
        return watch.presence('CAM-01');
      })
      .toBe(CameraPresence.ABSENT);
    watch.close();
    expect(stub.requestLog()).toEqual([]);
  });

  it('a rule that admits and names no source address, a source that is no address, and no rule at all: the read is refused by the named code and 0 requests are sent', async () => {
    const stub = await startStub();
    const candidate = candidateAt(stub.addresses().deviceServiceUrl);
    for (const source of [undefined, null, '', '0.0.0.0', 'localhost', '127.0.0.1:0', '::1', 2130706433]) {
      const { watch, reports } = watchOf(candidate, admitFrom(source));
      expect(await outcomeOf(watch.check('CAM-01', never())), String(source)).toMatchObject({ name: 'CameraClockError', code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED' });
      expect(await outcomeOf(watch.clockOffsetMs('CAM-01')), String(source)).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED' });
      watch.watch('CAM-01');
      await expect.poll(() => reports.length).toBe(3);
      expect(new Set(reports.map((report) => report.code))).toEqual(new Set(['CAMERA_WATCH_ADDRESS_REFUSED']));
      expect(watch.presence('CAM-01')).not.toBe(CameraPresence.PRESENT);
      watch.close();
    }
    const none = watchOf(candidate, undefined);
    expect(await outcomeOf(none.watch.check('CAM-01', never()))).toMatchObject({ code: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED' });
    expect(stub.requestLog()).toEqual([]);
    // Control: the same stub and candidate ARE reached by a watch whose rule names the held address.
    const reached = watchOf(candidate, admitFrom(FAKE_ONVIF_HOST));
    expect(await reached.watch.check('CAM-01', never())).toMatchObject({ present: true });
    expect(stub.requestLog()).toHaveLength(1);
  });
});

// ── Row B1 (decision C95; blocking finding B-01 of `verification/060b_m3_review_second_pass.md`) ──────────────
// ONE reply inside the old 1 MiB cap held the event loop for 41.9 s: the package's namespace replacement is quadratic
// for the five letters of a declaration repeated without an equals sign, and it is synchronous. Every reply is now
// capped per read and scanned BEFORE the package is handed it (`../onvif-reply-guard.ts`; the scan's own cases stand
// in `onvif-reply-guard.test.ts`). HERE: the review's reproducer as the reply of a device on loopback, through the
// real package, with the wall time held.
describe('row B1 / B-01: a hostile reply never reaches the package - the review\'s reproducer on loopback, in bounded time', () => {
  const KIB = 1024;
  /** The review's reproducer: the five letters and nothing else. */
  const hostile = (kib: number): OddDeviceReply => ({ kind: 'ANSWER', status: 200, body: 'xmlns'.repeat((kib * KIB) / 5) });
  /** The review measured 41.9 s at 1,000 KiB and 2.8 s at 256 KiB on this Mac. A bound the old behaviour cannot meet and a loaded host does not miss. */
  const BOUND_MS = 5_000;
  const timed = async <Result>(pending: Promise<Result>): Promise<{ readonly result: Result; readonly elapsedMs: number }> => {
    const from = performance.now();
    const result = await pending;
    return { result, elapsedMs: performance.now() - from };
  };
  const locator = () => statedLocator(createOnvifStreamLocator({ timers: manualTimers() }));
  const reader = () => createOnvifTimeReader({ timers: manualTimers() });
  const padded = (reply: OddDeviceReply, bytes: number): OddDeviceReply => (reply.kind === 'ANSWER' ? { ...reply, body: reply.body.replace('</s:Body>', `<!--${'x'.repeat(Math.max(0, bytes - Buffer.byteLength(reply.body) - 7))}--></s:Body>`) } : reply);

  it('the reproducer as the FIRST reply, at the size of the old cap and at the size of the new one: all three facades end by name within the bound, after ONE request', async () => {
    for (const kib of [1_000, 256, 15]) {
      const device = await startOdd(() => hostile(kib));
      const candidate = candidateAt(device.serviceUrl);

      const tested = await timed(tester().test(candidate, sealCredential(ACCOUNT), never()));
      expect(tested.result, `${kib} KiB`).toEqual({
        outcome: ConnectionTestOutcome.UNREACHABLE,
        authenticated: true,
        usableProfiles: [],
        profiles: [],
        reason: OnvifTestReason.NOT_ONVIF,
        warnings: [],
        reads: ['GetSystemDateAndTime'],
        credentialRequests: 0,
        rejectedCredentialRequests: 0,
      });
      expect(tested.elapsedMs, `${kib} KiB, the connection test`).toBeLessThan(BOUND_MS);
      // Nothing further was sent: not the package's own second clock read, not the service read.
      expect(device.requests().map((request) => request.operation)).toEqual(['GetSystemDateAndTime']);

      device.reset();
      const located = await timed(locator().locate(candidate, sealCredential(ACCOUNT), 'profile_1', never()));
      expect(located.result, `${kib} KiB`).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NOT_ONVIF, locator: null, reads: ['GetSystemDateAndTime'], credentialRequests: 0 });
      expect(located.elapsedMs, `${kib} KiB, the locator read`).toBeLessThan(BOUND_MS);

      const read = await timed(reader().read(candidate, never()));
      expect(read.result, `${kib} KiB`).toEqual({ answered: false, cameraUtcMs: null });
      expect(read.elapsedMs, `${kib} KiB, the time read`).toBeLessThan(BOUND_MS);
      expect(device.requests().map((request) => request.operation)).toEqual(['GetSystemDateAndTime', 'GetSystemDateAndTime']);
      await device.stop();
    }
  });

  it('the reproducer as a LATER reply: the read it answers ends as a reply that is no answer does, and no further read is sent (control: a reply that is merely cut IS followed by the next read)', async () => {
    const scripted = (hostileAt: string, reply: OddDeviceReply = hostile(60)) =>
      startOdd((request, _index, base) => {
        if (request.operation === hostileAt) return reply;
        if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
        if (request.operation === 'GetServices') return servicesAnswer(base);
        if (request.operation === 'GetCapabilities') return capabilitiesAnswer(base);
        if (request.operation === 'GetProfiles') return profilesAnswer([{ token: 'main', encoding: 'H264' }]);
        return streamAnswer(`rtsp://${ODD_DEVICE_HOST}:554/main`);
      });
    const cases: readonly [string, Partial<OnvifSessionResult>, readonly string[]][] = [
      ['GetServices', { outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NOT_ONVIF }, ['GetSystemDateAndTime', 'GetServices']],
      ['GetProfiles', { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.PROFILE_ANSWER_INVALID }, ['GetSystemDateAndTime', 'GetServices', 'GetProfiles']],
      ['GetStreamUri', { outcome: ConnectionTestOutcome.WRONG_PROFILE, reason: OnvifTestReason.STREAM_ADDRESS_MISSING }, ['GetSystemDateAndTime', 'GetServices', 'GetProfiles', 'GetStreamUri']],
    ];
    for (const [hostileAt, expected, sent] of cases) {
      const device = await scripted(hostileAt);
      const tested = await timed(tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never()));
      expect(tested.result, hostileAt).toMatchObject({ ...expected, usableProfiles: [], profiles: [], reads: sent });
      expect(tested.elapsedMs, hostileAt).toBeLessThan(BOUND_MS);
      expect(device.requests().map((request) => request.operation), hostileAt).toEqual(sent);
      await device.stop();
    }
    // Control: the whole course on this device, and the fall-back read after a service answer that is only cut in the middle.
    const whole = await scripted('-');
    expect(await tester().test(candidateAt(whole.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, usableProfiles: ['main'] });
    await whole.stop();
    const cutShort = await scripted('GetServices', { kind: 'ANSWER', status: 200, body: soapEnvelope('<tds:GetServicesResponse><tds:Service><tds:Name').slice(0, -24) });
    expect(await tester().test(candidateAt(cutShort.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE });
    expect(cutShort.requests().map((request) => request.operation)).toContain('GetCapabilities');
  });

  it('the other refused shapes end the same way: a document type with an entity, nesting above the bound, a second processing instruction; nothing of the reply is in the result', async () => {
    const canary = `cnryR${randomUUID().replaceAll('-', '')}`;
    const bodies = [
      `<?xml version="1.0"?><!DOCTYPE a [<!ENTITY e "${canary}">]>${soapEnvelope(`<a>&e;${canary}</a>`).replace(/^<\?xml[^>]*\?>/, '')}`,
      soapEnvelope(`${`<${canary}>`.repeat(40)}${`</${canary}>`.repeat(40)}`),
      soapEnvelope(`<?${canary} x?><a/>`),
      `${canary}${'xmlns'.repeat(200)}`,
    ];
    for (const body of bodies) {
      const device = await startOdd(() => ({ kind: 'ANSWER', status: 200, body }));
      const result = await tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never());
      expect(result).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.NOT_ONVIF, reads: ['GetSystemDateAndTime'] });
      expect(`${JSON.stringify(result)}\n${inspect(result, { depth: 8, showHidden: true, getters: true })}`).not.toContain(canary);
      expect(device.requests()).toHaveLength(1);
      await device.stop();
    }
  });

  it('the cap of a reply is its read\'s: a well-formed clock answer above 16 KiB and a profile list above 128 KiB end as the byte cap does (control: each just under its cap is read)', async () => {
    const overClock = await startOdd(() => padded(dateAnswer(), 17 * KIB));
    expect(await tester().test(candidateAt(overClock.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.BYTE_CAP, reads: ['GetSystemDateAndTime'] });
    expect(await reader().read(candidateAt(overClock.serviceUrl), never())).toEqual({ answered: false, cameraUtcMs: null });
    await overClock.stop();
    const underClock = await startOdd(() => padded(dateAnswer(new Date(Date.UTC(2026, 9, 13, 1, 2, 3))), 15 * KIB));
    expect(await reader().read(candidateAt(underClock.serviceUrl), never())).toEqual({ answered: true, cameraUtcMs: Date.UTC(2026, 9, 13, 1, 2, 3) });
    await underClock.stop();

    const profilesOf = (bytes: number) =>
      startOdd((request, _index, base) => {
        if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
        if (request.operation === 'GetServices') return servicesAnswer(base);
        if (request.operation === 'GetProfiles') return padded(profilesAnswer([{ token: 'main', encoding: 'H264' }]), bytes);
        return streamAnswer(`rtsp://${ODD_DEVICE_HOST}:554/main`);
      });
    const over = await profilesOf(129 * KIB);
    expect(await tester().test(candidateAt(over.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.BYTE_CAP, reads: ['GetSystemDateAndTime', 'GetServices', 'GetProfiles'] });
    await over.stop();
    // 127 KiB: above the cap of every other read, under its own.
    const under = await profilesOf(127 * KIB);
    expect(await tester().test(candidateAt(under.serviceUrl), sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.REACHABLE, usableProfiles: ['main'], reason: null });
  });

  it('the sweep, through the real package: a profile answer the scan ADMITS costs a bounded time at every size up to its cap - the whole test of three requests stays inside the budget', async () => {
    /** The budget of one whole connection test here (three requests on loopback and the parse of the admitted reply). Measured: 6 to 40 ms at 127 KiB on a host at load 13 to 18. */
    const BUDGET_MS = 1_000;
    const fill = (unit: string, length: number): string => unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
    const shapes: Readonly<Record<string, (bytes: number) => string>> = {
      // The most the bounds leave the replacement: nine occurrences share one equals sign and the value runs to its line end.
      'the worst admitted namespace shape': (bytes) => fill(`${'xmlns'.repeat(9)}aaa="${'b'.repeat(511)}\n`, bytes),
      'elements up to the element bound': (bytes) => soapEnvelope(`<trt:GetProfilesResponse>${fill('<tt:a><tt:b>1</tt:b><tt:c>x</tt:c></tt:a>', Math.min(bytes - 600, 2_500 * 41)).replace(/<[^>]*$/, '')}</trt:GetProfilesResponse>`),
      'entities and text': (bytes) => soapEnvelope(`<trt:GetProfilesResponse><trt:Profiles token="main"><tt:Name>${fill('&amp;&lt;1 ', bytes - 600).replace(/&[a-z]*$/, '')}</tt:Name></trt:Profiles></trt:GetProfilesResponse>`),
    };
    for (const [name, make] of Object.entries(shapes)) {
      for (const kib of [16, 32, 64, 127]) {
        const body = make(kib * KIB);
        const device = await startOdd((request, _index, base) => {
          if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
          if (request.operation === 'GetServices') return servicesAnswer(base);
          return { kind: 'ANSWER', status: 200, body };
        });
        const tested = await timed(tester().test(candidateAt(device.serviceUrl), sealCredential(ACCOUNT), never()));
        // Admitted (not the byte cap, three reads made), and judged by the package: no profile of it is usable.
        expect(tested.result, `${name}, ${kib} KiB`).toMatchObject({ outcome: ConnectionTestOutcome.WRONG_PROFILE, reads: ['GetSystemDateAndTime', 'GetServices', 'GetProfiles'] });
        expect([OnvifTestReason.PROFILE_ANSWER_INVALID, OnvifTestReason.NO_USABLE_PROFILE]).toContain(tested.result.reason);
        expect(tested.elapsedMs, `${name}, ${kib} KiB`).toBeLessThan(BUDGET_MS);
        await device.stop();
      }
    }
  });
});

// ── Row T3 (decision C100 (2): "the package's `WWW-Authenticate` parse was NOT measured for the same quadratic shape -
// a header a device controls") ─────────────────────────────────────────────────────────────────────────────────────
// MEASURED (`.cache/task4-t3/header_parse.cjs`, the package's own functions called as this file's wrapper calls them;
// record `docs/.../test/t3_mutation_and_ports.md`): the package's parse of one challenge is linear for commas, quotes,
// an unterminated quote, repeated `nonce=` and repeated scheme words, and QUADRATIC for one shape - a run of spaces
// before a quoted value with a tail (its part expression walks back): 0.86 ms at 2,048 characters, 53.8 ms at 16,000,
// the largest value Node's HTTP parser lets through (the whole head is held to `http.maxHeaderSize`, 16,384 bytes).
// THE BOUND EXISTS ALREADY: `digestChallengeAllowed` of the connection file hands the package no challenge above 2,048
// characters, so the worst a device can cause is under 1.1 ms a challenge. NO TEST HELD THAT BOUND: this file passed 62
// of 62 with ` || challenge.length > 2_048` deleted. The case below fails without it. No product line was added.
describe('row T3 / C100 (2): a Digest challenge above 2,048 characters never reaches the package\'s parse', () => {
  it('2,049 characters: `SCHEME_NOT_ALLOWED`, 0 requests carried the credential, the package\'s digest function was not reached; 2,048 is answered (control); the quadratic shape at the largest head Node admits is refused the same way, in the time of a refusal', async () => {
    const challenge = { text: '' };
    const device = await startOdd((request, _index, base) => {
      if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
      if (request.operation === 'GetServices') return servicesAnswer(base);
      return notAuthorizedFault(401, { 'WWW-Authenticate': challenge.text });
    });
    const candidate = candidateAt(device.serviceUrl);
    const carried = (): string[] => device.requests().map((request) => (request.authorization === '' ? 'none' : (request.authorization.split(' ')[0] ?? '?')));
    // How often the PACKAGE'S own answer to a challenge - the function that parses it - was reached. The connection
    // file reads it from the package's prototype at each exchange; it is wrapped here and put back.
    const { default: cam } = await import('onvif/lib/cam.js');
    const methods = cam.Cam.prototype as unknown as Record<string, (this: unknown, ...parts: unknown[]) => unknown>;
    const packageDigest = methods['digestAuth'];
    if (packageDigest === undefined) throw new Error('fixture: the package has no digest method');
    let parsed = 0;
    methods['digestAuth'] = function counted(this: unknown, ...parts: unknown[]): unknown {
      parsed += 1;
      return packageDigest.apply(this, parts);
    };
    try {
      /** A well-formed challenge of exactly `length` characters: its opaque value is the filler. */
      const wellFormed = (length: number): string => {
        const head = 'Digest realm="odd", nonce="00112233445566778899aabbccddeeff", qop="auth", opaque="';
        return `${head}${'o'.repeat(length - head.length - 1)}"`;
      };
      // CONTROL: at the bound the challenge is answered - ONE request carried the credential, and the device refused it.
      challenge.text = wellFormed(2_048);
      expect(challenge.text.length).toBe(2_048);
      expect(await tester().test(candidate, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, credentialRequests: 1, rejectedCredentialRequests: 1 });
      expect(carried().filter((scheme) => scheme !== 'none')).toEqual(['Digest']);
      expect(parsed).toBe(1);

      // One character more: not answered, and the package's parse is not reached.
      device.reset();
      challenge.text = wellFormed(2_049);
      expect(await tester().test(candidate, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: OnvifTestReason.SCHEME_NOT_ALLOWED, credentialRequests: 0, rejectedCredentialRequests: 0 });
      expect(carried().filter((scheme) => scheme !== 'none')).toEqual([]);
      expect(parsed).toBe(1);

      // THE QUADRATIC SHAPE at the largest size the HTTP parser lets through: refused the same way. The time is that
      // of a refusal (the three reads of a test on loopback), far from the 53.8 ms the package alone takes over it.
      device.reset();
      challenge.text = `Digest a=${' '.repeat(16_000 - 13)}"x"y`;
      expect(challenge.text.length).toBe(16_000);
      const from = performance.now();
      expect(await tester().test(candidate, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: ConnectionTestOutcome.AUTHENTICATION_FAILED, reason: OnvifTestReason.SCHEME_NOT_ALLOWED, credentialRequests: 0 });
      expect(performance.now() - from).toBeLessThan(2_000);
      expect(carried().filter((scheme) => scheme !== 'none')).toEqual([]);
      expect(parsed).toBe(1);
    } finally {
      methods['digestAuth'] = packageDigest;
    }
  });
});

// Finding E-05 of the fifth review pass (decision C113): row V6b's guard "an exchange that ended is never armed again"
// (caution R119-09) stood in `onvif-network.ts` only. In THIS file - the one every camera open and every connection test
// uses - `finish` disarmed the client at a cut, and a course that went on to its next read armed it again: no request
// could leave, and the two values of the account sat on the dead client until the exchange was collected.
// The client never leaves the file: the cases see it as `this` of the package's own read methods, which they replace for
// the one case and put back. NO REQUEST IS MADE and no port is used: every read of the course is answered here.
// MUTATIONS (the row record has the failing lines):
//   both guard lines absent (the file as it was at 1fbeada7): BOTH cases RED - the client held the account's two values;
//   only the line in `arm` absent: the SECOND case RED (the first is then held by the line in `authorizedAsk`);
//   only the line in `authorizedAsk` absent: no case is red - with the line in `arm` it changes nothing a caller can
//   see (it keeps a request from being COUNTED on a result that was handed out already). It stands for parity with the
//   set-network file, and is said here so that nobody takes it for a tested rule.
describe('finding E-05: an exchange that ended is never armed again - after a cut the client holds neither value of the account, whatever the course still does', () => {
  type Method = (this: Record<string, unknown>, ...parts: unknown[]) => unknown;
  type Callback = (error: unknown, value?: unknown) => void;
  const turns = async (count = 8): Promise<void> => {
    for (let turn = 0; turn < count; turn += 1) await new Promise((resolvePromise) => setImmediate(resolvePromise));
  };
  /** The package's client with some of its read methods replaced for `body`, and put back. */
  const withReads = async (replaced: Record<string, Method>, body: () => Promise<void>): Promise<void> => {
    const { default: cam } = await import('onvif/lib/cam.js');
    const methods = cam.Cam.prototype as unknown as Record<string, Method | undefined>;
    const kept = Object.keys(replaced).map((name) => [name, methods[name]] as const);
    for (const [name, method] of kept) if (method === undefined) throw new Error(`fixture: the package has no ${name}`);
    Object.assign(methods, replaced);
    try {
      await body();
    } finally {
      for (const [name, method] of kept) methods[name] = method;
    }
  };
  // Nothing listens there and nothing is dialled: the candidate only has to be one the exchange may contact.
  const NOWHERE = candidateAt(`http://${FAKE_ONVIF_HOST}:8571/onvif/device_service`);
  const held = (client: Record<string, unknown> | null): unknown[] => [client?.['username'], client?.['password'], client?.['useWSSecurity']];

  it('cut during a read WITHOUT the credential; the read is then answered and the course goes on to the read the credential is for: the client is not armed, and that read is never asked', async () => {
    const seen: { client: Record<string, unknown> | null; answerServices: Callback | null; profilesAsked: number } = { client: null, answerServices: null, profilesAsked: 0 };
    await withReads(
      {
        getSystemDateAndTime(callback) {
          seen.client = this;
          (callback as Callback)(null, new Date());
        },
        getServices(_capabilities, callback) {
          seen.answerServices = callback as Callback;
        },
        getProfiles(callback) {
          seen.profilesAsked += 1;
          (callback as Callback)(new Error('not expected: the exchange had ended'));
        },
      },
      async () => {
        const cutting = new AbortController();
        const pending = createOnvifConnectionTester({ timers: manualTimers() }).test(NOWHERE, sealCredential(ACCOUNT), cutting.signal, AS_THE_HOST_ROUTES);
        await turns();
        expect(seen.answerServices).not.toBeNull();
        // Control: the two reads so far carry no credential, and the client holds none.
        expect(held(seen.client)).toEqual([undefined, undefined, false]);
        cutting.abort();
        expect(await pending).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.DEADLINE, reads: ['GetSystemDateAndTime', 'GetServices'], credentialRequests: 0 });
        // The package answers the read it was asked before the cut, with a media service: the course goes on to `GetProfiles`.
        Object.assign(seen.client ?? {}, { uri: { media: {} } });
        seen.answerServices?.(null, {});
        await turns();
        expect(held(seen.client)).toEqual([undefined, undefined, false]);
        expect(inspect({ ...seen.client, agent: undefined }, { depth: 4 })).not.toContain(ACCOUNT.secret);
        expect(seen.profilesAsked).toBe(0);
      },
    );
  });

  it('cut during the read the credential is for, which the device then answers with a fault that asks for the token form: the client is not armed a second time', async () => {
    const seen: { client: Record<string, unknown> | null; heldAtProfiles: unknown[]; answerProfiles: Callback | null; profilesAsked: number } = { client: null, heldAtProfiles: [], answerProfiles: null, profilesAsked: 0 };
    await withReads(
      {
        getSystemDateAndTime(callback) {
          seen.client = this;
          (callback as Callback)(null, new Date());
        },
        getServices(_capabilities, callback) {
          Object.assign(this, { uri: { media: {} } });
          (callback as Callback)(null, {});
        },
        getProfiles(callback) {
          seen.profilesAsked += 1;
          seen.heldAtProfiles = [this['username'], this['password']];
          seen.answerProfiles = callback as Callback;
        },
      },
      async () => {
        const cutting = new AbortController();
        const pending = createOnvifConnectionTester({ timers: manualTimers() }).test(NOWHERE, sealCredential(ACCOUNT), cutting.signal, AS_THE_HOST_ROUTES);
        await turns();
        // Control: while the exchange runs the client IS armed for this read - this is what must be gone after the cut.
        expect(seen.heldAtProfiles).toEqual([ACCOUNT.username, ACCOUNT.secret]);
        cutting.abort();
        expect(await pending).toMatchObject({ outcome: ConnectionTestOutcome.UNREACHABLE, reason: OnvifTestReason.DEADLINE, reads: ['GetSystemDateAndTime', 'GetServices', 'GetProfiles'] });
        expect(held(seen.client)).toEqual([undefined, undefined, false]);
        // The answer of the read that was cut: a fault that asks for authentication. Before the guard this armed the token form.
        seen.answerProfiles?.(new Error('ONVIF SOAP Fault: Sender not authorized'));
        await turns();
        expect(held(seen.client)).toEqual([undefined, undefined, false]);
        expect(inspect({ ...seen.client, agent: undefined }, { depth: 4 })).not.toContain(ACCOUNT.secret);
        // The second form was never asked of the device.
        expect(seen.profilesAsked).toBe(1);
      },
    );
  });

  // THE LINE IN `authorizedAsk` (controller's order after the first record). No BEHAVIOUR tells it from its absence: with
  // the line in `arm` an ended exchange cannot be armed, and the only other thing the line prevents - a request COUNTED
  // after the end - is a number of a result nobody receives (`finish` hands out one result, at the cut). So this is a
  // PIN OF THE SOURCE, said as one: in BOTH copies of the exchange the ended-call answer stands in `authorizedAsk` before
  // the client is armed and before a request is counted, and `arm` begins with the same guard.
  // SEEN RED on the mutant without the line `if (settled) return ask(read, invoke);` of `onvif-session.ts` (the first
  // `toEqual` below: the body then begins with the no-credential line and the arming line).
  it('the source, both copies: `authorizedAsk` answers an ended exchange BEFORE it arms or counts, and `arm` never arms one (the session file and the set-network file say it the same way)', () => {
    const code = (name: string): string[] =>
      readFileSync(resolve(__dirname, '..', name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, '').trim())
        .filter((line) => line !== '');
    const after = (lines: string[], opening: RegExp, count: number): string[] => {
      const at = lines.findIndex((line) => opening.test(line));
      expect(at).toBeGreaterThanOrEqual(0);
      return lines.slice(at + 1, at + 1 + count);
    };
    const session = code('onvif-session.ts');
    const network = code('onvif-network.ts');
    expect(after(session, /^const authorizedAsk = async \(read: OnvifSessionRead, invoke: Invoke\): Promise<Answer> => \{$/, 3)).toEqual([
      'if (credential === null) return ask(read, invoke);',
      'if (settled) return ask(read, invoke);',
      "if (!armed) arm('HTTP_DIGEST');",
    ]);
    expect(after(network, /^const authorizedAsk = async \(call: OnvifNetworkCall, invoke: Invoke\): Promise<Answer> => \{$/, 2)).toEqual(['if (settled) return ask(call, invoke);', "if (!armed) arm('HTTP_DIGEST');"]);
    for (const lines of [session, network]) expect(after(lines, /^const arm = \(form: 'HTTP_DIGEST' \| 'TOKEN'\): void => \{$/, 1)).toEqual(['if (settled) return;']);
    // Each file has ONE `authorizedAsk` and ONE `arm`: no second copy without the guard.
    for (const lines of [session, network]) expect([lines.filter((line) => line.startsWith('const authorizedAsk = ')).length, lines.filter((line) => line.startsWith('const arm = ')).length]).toEqual([1, 1]);
  });
});
