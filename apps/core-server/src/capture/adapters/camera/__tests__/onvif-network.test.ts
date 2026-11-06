// The set-network file, driven by the real `onvif` package against the fake ONVIF stub with its
// `network` option (task 4 blueprint row 110, WP-22a; record of row 109; security findings S13-04,
// S13-11, S13-12 (c); decisions C1, C7; static rules G-R10 / G-R11 as amended by SR-3).
//
// THE DOUBLE. The stub of `test/support/fake-onvif-stub.ts` on the literal 127.0.0.1, ephemeral
// ports. It never changes an address: "the camera moved" is a value of `networkState()`. The
// addresses a test WRITES are documentation addresses (RFC 5737) that nothing contacts.
//
// NO DEVICE OF A REAL NETWORK IS CONTACTED. The product's destination rule refuses loopback, so the
// stub is reached through the permissive rule of `test/support/loopback-destination.ts` (AD-02
// point 2); the product's own rule is used where a refusal is the point.
// Fixture credentials are drawn at run time.
import { randomUUID } from 'node:crypto';
import { Agent as HttpAgent, createServer, maxHeaderSize } from 'node:http';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_ONVIF_FOREIGN_HOST, FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION, FAKE_ONVIF_HOST, FAKE_ONVIF_NETWORK_DEFAULTS, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub, type FakeOnvifStubOptions } from '../../../../../test/support/fake-onvif-stub';
import { loopbackDestination } from '../../../../../test/support/loopback-destination';
// Row B1: the answers of the scripted device, for the hostile replies of the last block (its listener is this file's own: see there).
import { ok, soapEnvelope, type OddDeviceReply } from '../../../../../test/support/onvif-odd-device';
import { DestinationPurpose, decideDestination, type DestinationContext, type DestinationDecision, type NewCameraAddress } from '../../../destination-rule';
import type { CaptureTimers } from '../../../types';
import { sealCredential } from '../../credential';
import { CaptureAdapterKind } from '../../kinds';
import type { CameraCandidate } from '../../types';
import { ONVIF_NETWORK_CALLS, ONVIF_NETWORK_LIMITS, createOnvifNetworkSetter, type OnvifNetworkSetResult } from '../onvif-network';

const ACCOUNT = { username: `cnryU${randomUUID().replaceAll('-', '')}`, secret: `cnryS${randomUUID().replaceAll('-', '')}` };
const WRONG = { username: ACCOUNT.username, secret: `cnryW${randomUUID().replaceAll('-', '')}` };
const NEW: NewCameraAddress = { address: '192.0.2.77', prefixLength: 24, gateway: '192.0.2.1' };
const NEW_WITHOUT_GATEWAY: NewCameraAddress = { address: '192.0.2.78', prefixLength: 24, gateway: null };
const HW_ADDRESS = FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress.toUpperCase();

function manualTimers(): CaptureTimers & { readonly asked: number[] } {
  const asked: number[] = [];
  return {
    asked,
    after(delayMs) {
      asked.push(delayMs);
      return () => {};
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
const uncaught: unknown[] = [];
const onUncaught = (error: unknown): void => {
  uncaught.push(error);
};
afterEach(async () => {
  for (const fixture of open.splice(0)) await fixture.stop();
});

async function startStub(network: FakeOnvifStubOptions['network'] = { gatewayReadBack: true }): Promise<FakeOnvifStub> {
  const stub = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: ACCOUNT, network });
  await stub.start();
  open.push(stub);
  return stub;
}

/**
 * Finding E-02 of the fifth review pass (S-03 of the second): the judgement of the reported hardware address is REQUIRED.
 * The cases of this file are about the calls, not about that judgement, so their double STATES one that admits whatever the
 * device reports - by this name. The judgement itself has its own case below (block "finding E-02").
 */
const ADMIT_WHAT_THE_DEVICE_REPORTS = (): boolean => true;
const setter = (destination: (address: string, port: number) => DestinationDecision = loopbackDestination, limits: Partial<typeof ONVIF_NETWORK_LIMITS> = {}) =>
  createOnvifNetworkSetter({ timers: manualTimers(), destination, admitHwAddress: ADMIT_WHAT_THE_DEVICE_REPORTS, limits });
const never = (): AbortSignal => new AbortController().signal;
const here = (stub: FakeOnvifStub): CameraCandidate => candidateAt(stub.addresses().deviceServiceUrl);
const run = (stub: FakeOnvifStub, assignment: NewCameraAddress = NEW, account = ACCOUNT): Promise<OnvifNetworkSetResult> => setter().setAddress(here(stub), assignment, sealCredential(account), never());
const operations = (stub: FakeOnvifStub): string[] => stub.networkRequests().map((request) => request.operation);
const deviceRequests = (stub: FakeOnvifStub) => stub.requestLog().filter((request) => request.channel === 'device');
const everything = (value: unknown): string => [JSON.stringify(value) ?? '', inspect(value, { depth: 8, showHidden: true, getters: true }), value instanceof Error ? `${value.message}\n${value.stack ?? ''}` : ''].join('\n');
const outcomeOf = async (pending: Promise<unknown>): Promise<unknown> => pending.then((value) => value, (error: unknown) => error);

describe('the four calls on a well-behaved camera (the stub), through the real package', () => {
  it('reads the interface, sets ONE static address with its prefix, sets the gateway, reboots when the device asks: every request well-formed, accepted, and received by the camera at its OLD address', async () => {
    const stub = await startStub();
    const result = await run(stub);
    expect(result).toEqual({
      outcome: 'SET',
      reason: null,
      destinationRefusal: null,
      hwAddress: HW_ADDRESS,
      rebootNeeded: true,
      gateway: 'CONFIRMED',
      reboot: 'ACCEPTED',
      calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', 'SystemReboot'],
      credentialRequests: result.credentialRequests,
      rejectedCredentialRequests: 0,
    });
    expect(result.calls).toEqual([...ONVIF_NETWORK_CALLS]);
    expect(result.credentialRequests).toBeGreaterThanOrEqual(4);
    // The package moved its own target to the NEW address after the set; this file held it: the gateway and the reboot reached the stub.
    expect(operations(stub)).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION, 'SystemReboot']);
    expect(stub.networkRequests().every((request) => request.wellFormed && request.accepted)).toBe(true);
    expect(stub.networkRequests().find((request) => request.operation === 'SetNetworkInterfaces')).toMatchObject({ address: NEW.address, prefixLength: 24, dhcp: false });
    expect(stub.networkState()).toMatchObject({ address: NEW.address, prefixLength: 24, dhcp: false, gateway: NEW.gateway, rebootCount: 1, pending: null });
    expect(stub.violations()).toEqual([]);
    // No read of the connection file is made here.
    expect(new Set(deviceRequests(stub).map((request) => request.operation))).toEqual(new Set(['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION, 'SystemReboot']));
  });

  it('no gateway in the assignment: three calls, no gateway request; a device that needs no reboot is not rebooted and holds the address at once', async () => {
    const stub = await startStub({ rebootNeeded: false });
    const result = await run(stub, NEW_WITHOUT_GATEWAY);
    expect(result).toMatchObject({ outcome: 'SET', rebootNeeded: false, gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces'] });
    expect(operations(stub)).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces']);
    expect(stub.networkState()).toMatchObject({ address: NEW_WITHOUT_GATEWAY.address, rebootCount: 0, gateway: FAKE_ONVIF_NETWORK_DEFAULTS.gateway });
  });

  it('the gateway is a warning, never a failure: a fault of the device, and a device that does not answer the package\'s own read-back, both leave the address set and the reboot made', async () => {
    const faulting = await startStub({ gatewayReadBack: true, gatewayFault: true });
    expect(await run(faulting)).toMatchObject({ outcome: 'SET', reason: null, gateway: 'NOT_CONFIRMED', reboot: 'ACCEPTED' });
    expect(faulting.networkState()).toMatchObject({ address: NEW.address, rebootCount: 1 });
    // THE FIFTH REQUEST: with a callback the package reads the gateway back by itself. A stub built without that answer names it.
    const strict = await startStub({});
    expect(await run(strict)).toMatchObject({ outcome: 'SET', gateway: 'NOT_CONFIRMED', reboot: 'ACCEPTED' });
    expect(strict.violations()).toEqual([{ code: 'OPERATION_NOT_ALLOWED', channel: 'device', operation: FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION }]);
    expect(strict.networkState()).toMatchObject({ address: NEW.address, gateway: NEW.gateway, rebootCount: 1 });
  });

  it('a camera that goes down at once on the reboot: the address is set and the reboot is "sent, no answer"', async () => {
    const stub = await startStub({ gatewayReadBack: true, rebootDropsConnection: true });
    expect(await run(stub)).toMatchObject({ outcome: 'SET', reason: null, reboot: 'SENT_NO_ANSWER' });
    expect(stub.networkState()).toMatchObject({ address: NEW.address, rebootCount: 1 });
  });
});

// Finding E-02 of the fifth review pass (decision C113; S-03 of the second pass; the F-07 family of C46 / C50). Before it the
// member was optional and its absence sent the set WITHOUT the judgement. SEEN RED on the mutant that puts the old guard
// back (`if (options.admitHwAddress !== undefined) { ... }` around the judgement): the third part below then answered
// `SET` and the stub's address had moved.
describe('finding E-02: the judgement of the reported hardware address is required - no set leaves without it', () => {
  it('asked ONCE, with what the device reports, between the read and the set; a refusal, a throw, a value that is not `true` and NO FUNCTION AT ALL each end `NOT_SET` / `HW_ADDRESS_REFUSED` with no set request', async () => {
    const asked: (string | null)[] = [];
    const admitted = await startStub();
    const result = await createOnvifNetworkSetter({
      timers: manualTimers(),
      destination: loopbackDestination,
      admitHwAddress: (reported) => {
        asked.push(reported);
        // At this instant the device was read and nothing was written.
        expect(operations(admitted)).toEqual(['GetNetworkInterfaces']);
        return true;
      },
    }).setAddress(here(admitted), NEW, sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: 'SET', hwAddress: HW_ADDRESS });
    expect(asked).toEqual([HW_ADDRESS]);

    const refusing: [string, unknown][] = [
      ['a refusal', () => false],
      ['a throw', () => { throw new Error('the judgement failed'); }],
      ['a value that is not true', () => 'yes'],
      // A caller the type did not hold: the member left out, and a value that is no function.
      ['no function at all', undefined],
      ['a value that is no function', true],
    ];
    for (const [name, admitHwAddress] of refusing) {
      const stub = await startStub();
      const options = { timers: manualTimers(), destination: loopbackDestination, ...(admitHwAddress === undefined ? {} : { admitHwAddress }) } as unknown as Parameters<typeof createOnvifNetworkSetter>[0];
      const refused = await createOnvifNetworkSetter(options).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never());
      expect(refused, name).toMatchObject({ outcome: 'NOT_SET', reason: 'HW_ADDRESS_REFUSED', hwAddress: HW_ADDRESS, gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces'] });
      expect(operations(stub), name).toEqual(['GetNetworkInterfaces']);
      expect(stub.networkState(), name).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, rebootCount: 0 });
    }
  });
});

describe('S13-12 (c): malformed, oversized and markup-token replies - the Core stays up and every request it sent is well-formed', () => {
  it('a malformed reply to each call: no uncaught exception; before the set nothing is written, after it the address is UNKNOWN and nothing more is sent', async () => {
    process.on('uncaughtException', onUncaught);
    try {
      // The interface list cannot be read: no set request at all.
      const first = await startStub();
      first.setNetworkMode('MALFORMED_REPLY', 'GetNetworkInterfaces');
      expect(await run(first)).toMatchObject({ outcome: 'NOT_SET', reason: 'INTERFACES_ANSWER_INVALID', hwAddress: null, calls: ['GetNetworkInterfaces'] });
      expect(operations(first)).toEqual(['GetNetworkInterfaces']);
      expect(first.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null, rebootCount: 0 });

      // The set was OBEYED and answered badly: the file says it does not know, and sends nothing more.
      const second = await startStub();
      second.setNetworkMode('MALFORMED_REPLY', 'SetNetworkInterfaces');
      const unknown = await run(second);
      expect(unknown).toMatchObject({ outcome: 'UNKNOWN', reason: 'SET_ANSWER_INVALID', hwAddress: HW_ADDRESS, rebootNeeded: null, gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces'] });
      expect(operations(second)).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces']);
      expect(second.networkState().pending).toMatchObject({ address: NEW.address });

      // The gateway and the reboot answered badly: the address stands.
      const third = await startStub();
      third.setNetworkMode('MALFORMED_REPLY', 'SetNetworkDefaultGateway');
      expect(await run(third)).toMatchObject({ outcome: 'SET', gateway: 'NOT_CONFIRMED', reboot: 'ACCEPTED' });
      const fourth = await startStub();
      fourth.setNetworkMode('MALFORMED_REPLY', 'SystemReboot');
      expect(await run(fourth)).toMatchObject({ outcome: 'SET', gateway: 'CONFIRMED', reboot: 'SENT_NO_ANSWER' });

      for (const stub of [first, second, third, fourth]) expect(stub.networkRequests().every((request) => request.wellFormed)).toBe(true);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(uncaught).toEqual([]);
    } finally {
      process.off('uncaughtException', onUncaught);
    }
  });

  it('an oversized reply: the call ends at its byte cap with a code; nothing was written', async () => {
    process.on('uncaughtException', onUncaught);
    try {
      const stub = await startStub();
      stub.setNetworkMode('OVERSIZED_REPLY', 'GetNetworkInterfaces');
      const result = await run(stub);
      expect(result).toMatchObject({ outcome: 'NOT_SET', reason: 'BYTE_CAP', calls: ['GetNetworkInterfaces'] });
      expect(operations(stub)).toEqual(['GetNetworkInterfaces']);
      expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null });
      // After the set the same reply leaves the address unknown, as a cut call must.
      const late = await startStub();
      late.setNetworkMode('OVERSIZED_REPLY', 'SetNetworkInterfaces');
      expect(await run(late)).toMatchObject({ outcome: 'UNKNOWN', reason: 'BYTE_CAP', calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces'] });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(uncaught).toEqual([]);
    } finally {
      process.off('uncaughtException', onUncaught);
    }
  });

  it('an interface token with markup characters is never written into a request: refused by a code, 0 set requests, every request the stub saw well-formed', async () => {
    const stub = await startStub();
    stub.setNetworkMode('MARKUP_TOKEN');
    const result = await run(stub);
    expect(result).toMatchObject({ outcome: 'NOT_SET', reason: 'INTERFACE_TOKEN_REFUSED', hwAddress: HW_ADDRESS, calls: ['GetNetworkInterfaces'] });
    expect(operations(stub)).toEqual(['GetNetworkInterfaces']);
    expect(stub.networkRequests().every((request) => request.wellFormed)).toBe(true);
    expect(stub.networkRequests().filter((request) => request.refusal === 'NOT_WELL_FORMED')).toEqual([]);
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null, rebootCount: 0 });
    // Nothing of the token is in what the call answers.
    expect(everything(result)).not.toMatch(/eth0|<x|&/);
  });
});

describe('the credential: a parameter of the one call (C1, C7); a refusal is final (S13-04)', () => {
  it('a wrong secret: ONE rejected request that carried it, no network request passed, nothing changed', async () => {
    const stub = await startStub();
    const result = await run(stub, NEW, WRONG);
    expect(result).toMatchObject({ outcome: 'NOT_SET', reason: 'CREDENTIAL_REFUSED', hwAddress: null, calls: ['GetNetworkInterfaces'], rejectedCredentialRequests: 1 });
    expect(result.credentialRequests).toBe(1);
    expect(stub.networkRequests()).toEqual([]);
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null, rebootCount: 0 });
    expect(stub.violations()).toEqual([]);
  });

  it('neither value of the account is in anything a call answers, on a good run and on a refused one', async () => {
    const stub = await startStub();
    const texts = [everything(await run(stub)), everything(await run(stub, NEW, WRONG))].join('\n');
    for (const needle of [ACCOUNT.username, ACCOUNT.secret, WRONG.secret]) expect(texts.includes(needle)).toBe(false);
    // The password never travelled in clear (the stub would have named it).
    expect(stub.violations().filter((violation) => violation.code === 'PASSWORD_IN_CLEAR')).toEqual([]);
  });
});

describe('S13-11: every destination is a value the destination rule returned', () => {
  const PRODUCT: DestinationContext = {
    cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
    cameraAddresses: [{ address: '192.168.50.1', alias: false }],
    otherInterfaceSubnets: [],
    hostAddresses: ['192.168.50.1'],
  };
  const productRule = (address: string, port: number): DestinationDecision => decideDestination({ purpose: DestinationPurpose.SET_IP, address, port }, PRODUCT);

  it('the product\'s rule refuses the loopback double: the code of the rule is the answer and 0 requests reach the device', async () => {
    const stub = await startStub();
    const result = await setter(productRule).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never());
    expect(result).toEqual({ outcome: 'NOT_SET', reason: 'DESTINATION_REFUSED', destinationRefusal: 'LOOPBACK', hwAddress: null, rebootNeeded: null, gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: [], credentialRequests: 0, rejectedCredentialRequests: 0 });
    expect(deviceRequests(stub)).toEqual([]);
  });

  it('a refused address of any other kind: 0 requests; a rule that throws or answers an address that is none is a refusal too', async () => {
    const stub = await startStub();
    const port = new URL(stub.addresses().deviceServiceUrl).port;
    const foreign = candidateAt(`http://${FAKE_ONVIF_FOREIGN_HOST}:${port}/onvif/device_service`, { host: FAKE_ONVIF_FOREIGN_HOST });
    expect(await setter().setAddress(foreign, NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'DESTINATION_REFUSED', destinationRefusal: 'OUTSIDE_CAMERA_SUBNET', calls: [] });
    const throwing = (): DestinationDecision => {
      throw new Error('rule');
    };
    expect(await setter(throwing).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'DESTINATION_REFUSED', destinationRefusal: null, calls: [] });
    const noAddress = (_address: string, port2: number): DestinationDecision => ({ allowed: true, destination: { address: 'camera.example', port: port2, sourceAddress: '127.0.0.1', viaAlias: false } });
    expect(await setter(noAddress).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'DESTINATION_REFUSED', calls: [] });
    expect(deviceRequests(stub)).toEqual([]);
  });

  it('what is dialled is the rule\'s answer, not the candidate\'s text: a candidate at a documentation address whose rule answers the stub reaches the stub and nothing else', async () => {
    const stub = await startStub();
    const stubPort = Number(new URL(stub.addresses().deviceServiceUrl).port);
    const asked: [string, number][] = [];
    const rule = (address: string, port: number): DestinationDecision => {
      asked.push([address, port]);
      return { allowed: true, destination: { address: FAKE_ONVIF_HOST, port: stubPort, sourceAddress: FAKE_ONVIF_HOST, viaAlias: false } };
    };
    // Port 9 of a documentation address: were the candidate's text dialled, nothing would answer.
    const elsewhere = candidateAt(`http://${FAKE_ONVIF_FOREIGN_HOST}:9/onvif/device_service`, { host: FAKE_ONVIF_FOREIGN_HOST });
    const result = await setter(rule).setAddress(elsewhere, NEW, sealCredential(ACCOUNT), never());
    expect(asked).toEqual([[FAKE_ONVIF_FOREIGN_HOST, 9]]);
    expect(result).toMatchObject({ outcome: 'SET', reboot: 'ACCEPTED' });
    expect(operations(stub)).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION, 'SystemReboot']);
  });
});

describe('refusals before any request, and a camera that does not answer', () => {
  it('an aborted signal and a candidate that may not be contacted reject; an `https:` service address and an assignment outside the rule\'s form resolve as a refusal with 0 requests', async () => {
    const stub = await startStub();
    const gone = new AbortController();
    gone.abort();
    expect(await outcomeOf(setter().setAddress(here(stub), NEW, sealCredential(ACCOUNT), gone.signal))).toMatchObject({ code: 'CAPTURE_ADAPTER_ABORTED' });
    for (const candidate of [candidateAt(null), candidateAt(stub.addresses().deviceServiceUrl, { testable: false }), candidateAt(stub.addresses().deviceServiceUrl, { conflict: true }), candidateAt(`http://${FAKE_ONVIF_FOREIGN_HOST}/onvif/device_service`)]) {
      expect(await outcomeOf(setter().setAddress(candidate, NEW, sealCredential(ACCOUNT), never()))).toMatchObject({ code: 'CAPTURE_LOCATOR_INVALID' });
    }
    const secure = candidateAt(stub.addresses().deviceServiceUrl.replace('http:', 'https:'));
    expect(await setter().setAddress(secure, NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'SERVICE_SCHEME_NOT_SUPPORTED', calls: [] });
    const bad: unknown[] = [
      { address: 'dhcp', prefixLength: 24, gateway: null },
      { address: '192.0.2.77', prefixLength: 33, gateway: null },
      { address: '192.0.2.77', prefixLength: 24.5, gateway: null },
      { address: '192.0.2.77</Address><DHCP>true</DHCP>', prefixLength: 24, gateway: null },
      { address: '192.0.2.77', prefixLength: 24, gateway: 'gateway.example' },
      { address: '192.0.2.077', prefixLength: 24, gateway: null },
      null,
    ];
    for (const assignment of bad) {
      expect(await setter().setAddress(here(stub), assignment as NewCameraAddress, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'ASSIGNMENT_INVALID', calls: [] });
    }
    expect(deviceRequests(stub)).toEqual([]);
  });

  it('a camera that refuses the connection: `NO_ANSWER`, nothing set; a call cut by its signal: `DEADLINE`', async () => {
    const stub = await startStub();
    const candidate = here(stub);
    await stub.closeDeviceListener();
    expect(await setter().setAddress(candidate, NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'NO_ANSWER', calls: ['GetNetworkInterfaces'] });
    await stub.openDeviceListener();
    stub.setNetworkMode('OVERSIZED_REPLY', 'GetNetworkInterfaces');
    const cutting = new AbortController();
    // A cap far above the reply, so that the signal is what ends the call.
    const pending = setter(loopbackDestination, { maxReceivedBytes: 1_000_000_000 }).setAddress(candidate, NEW, sealCredential(ACCOUNT), cutting.signal);
    cutting.abort();
    expect(await pending).toMatchObject({ outcome: 'NOT_SET', reason: 'DEADLINE' });
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null });
  });
});

// ── Row B1 (decision C95; blocking finding B-01 of `verification/060b_m3_review_second_pass.md`) ──────────────
// The same reply that held the event loop for 41.9 s through the connection file reaches the package through this
// file too (the review names `:508`). Every reply is capped per call and scanned before the package is handed it
// (`../onvif-reply-guard.ts`). The double here is the scripted device of `test/support/onvif-odd-device.ts`, on
// loopback: it answers every call without asking for a credential, so 0 requests carry one.
describe('row B1 / B-01: a hostile reply never reaches the package - the review\'s reproducer at each of the calls, in bounded time', () => {
  const KIB = 1024;
  const hostile = (kib: number): OddDeviceReply => ({ kind: 'ANSWER', status: 200, body: 'xmlns'.repeat((kib * KIB) / 5) });
  /** The review measured 41.9 s at 1,000 KiB on this Mac: a bound the old behaviour cannot meet and a loaded host does not miss. */
  const BOUND_MS = 5_000;
  const answers: Readonly<Record<string, OddDeviceReply>> = {
    GetNetworkInterfaces: ok(
      '<tds:GetNetworkInterfacesResponse><tds:NetworkInterfaces token="eth0"><tt:Enabled>true</tt:Enabled><tt:Info><tt:Name>eth0</tt:Name><tt:HwAddress>02:00:00:00:00:0a</tt:HwAddress><tt:MTU>1500</tt:MTU></tt:Info></tds:NetworkInterfaces></tds:GetNetworkInterfacesResponse>',
    ),
    SetNetworkInterfaces: ok('<tds:SetNetworkInterfacesResponse><tds:RebootNeeded>true</tds:RebootNeeded></tds:SetNetworkInterfacesResponse>'),
    SetNetworkDefaultGateway: ok('<tds:SetNetworkDefaultGatewayResponse/>'),
    [FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION]: ok(`<tds:GetNetworkDefaultGatewayResponse><tds:NetworkGateway><tt:IPv4Address>${NEW.gateway ?? ''}</tt:IPv4Address></tds:NetworkGateway></tds:GetNetworkDefaultGatewayResponse>`),
    SystemReboot: ok('<tds:SystemRebootResponse><tds:Message>Rebooting</tds:Message></tds:SystemRebootResponse>'),
  };
  /**
   * A scripted device of this block's own: one HTTP listener on the literal 127.0.0.1, on a port the system chooses.
   * Not the listener of `onvif-odd-device.ts`: that one takes one of five fixed ports, and the connection file's test
   * runs beside this file and uses them.
   */
  interface ScriptedDevice {
    readonly serviceUrl: string;
    /** The SOAP operation of every request received, in order. */
    readonly operations: string[];
    stop(): Promise<void>;
  }
  async function startOdd(hostileAt: string, reply: OddDeviceReply = hostile(1_000)): Promise<ScriptedDevice> {
    const operations: string[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('error', () => undefined);
      response.on('error', () => undefined);
      request.on('end', () => {
        const operation = /<(?:[\w.-]+:)?Body(?:\s[^>]*)?>\s*<(?:[\w.-]+:)?(\w+)/.exec(Buffer.concat(chunks).toString('utf8'))?.[1] ?? '?';
        operations.push(operation);
        const answer = operation === hostileAt ? reply : answers[operation];
        if (answer === undefined || answer.kind !== 'ANSWER') return; // never answered
        response.writeHead(answer.status, { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(answer.body), Connection: 'close' });
        response.end(answer.body);
      });
    });
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.once('error', rejectPromise);
      server.listen({ host: FAKE_ONVIF_HOST, port: 0, exclusive: true }, () => resolvePromise());
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('fixture: no port');
    const device: ScriptedDevice = {
      serviceUrl: `http://${FAKE_ONVIF_HOST}:${address.port}/onvif/device_service`,
      operations,
      stop: () =>
        new Promise<void>((resolvePromise) => {
          server.closeAllConnections();
          server.close(() => resolvePromise());
        }),
    };
    open.push(device);
    return device;
  }
  const timedSet = async (device: ScriptedDevice): Promise<{ readonly result: OnvifNetworkSetResult; readonly elapsedMs: number; readonly sent: string[] }> => {
    const from = performance.now();
    const result = await setter().setAddress(candidateAt(device.serviceUrl), NEW, sealCredential(ACCOUNT), never());
    return { result, elapsedMs: performance.now() - from, sent: [...device.operations] };
  };
  const READ_BACK = FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION;

  it('control: the scripted device answers the whole call - set, gateway confirmed, reboot accepted', async () => {
    const { result, sent } = await timedSet(await startOdd('-'));
    expect(result).toMatchObject({ outcome: 'SET', reason: null, hwAddress: '02:00:00:00:00:0A', rebootNeeded: true, gateway: 'CONFIRMED', reboot: 'ACCEPTED', calls: [...ONVIF_NETWORK_CALLS], credentialRequests: 0 });
    expect(sent).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', READ_BACK, 'SystemReboot']);
  });

  it('the reproducer at the interface read and at the set: the call ends as for a reply that is no answer, within the bound, and nothing further is sent', async () => {
    for (const kib of [1_000, 15]) {
      const first = await timedSet(await startOdd('GetNetworkInterfaces', hostile(kib)));
      expect(first.result, `${kib} KiB`).toEqual({ outcome: 'NOT_SET', reason: 'INTERFACES_ANSWER_INVALID', destinationRefusal: null, hwAddress: null, rebootNeeded: null, gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces'], credentialRequests: 0, rejectedCredentialRequests: 0 });
      expect(first.elapsedMs, `${kib} KiB`).toBeLessThan(BOUND_MS);
      expect(first.sent).toEqual(['GetNetworkInterfaces']);

      // A set that was sent and answered by a refused reply: the camera may hold either address - as for any answer that cannot be read.
      const second = await timedSet(await startOdd('SetNetworkInterfaces', hostile(kib)));
      expect(second.result, `${kib} KiB`).toMatchObject({ outcome: 'UNKNOWN', reason: 'SET_ANSWER_INVALID', hwAddress: '02:00:00:00:00:0A', gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces'] });
      expect(second.elapsedMs, `${kib} KiB`).toBeLessThan(BOUND_MS);
      expect(second.sent).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces']);
    }
  });

  it('the reproducer at the gateway step, as the set\'s answer and as the package\'s own read-back: the address stands, the gateway is not confirmed, and NO REBOOT IS SENT - its state stays NOT_ASKED', async () => {
    for (const [hostileAt, sent] of [
      ['SetNetworkDefaultGateway', ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway']],
      [READ_BACK, ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway', READ_BACK]],
    ] as const) {
      const run2 = await timedSet(await startOdd(hostileAt));
      expect(run2.result, hostileAt).toMatchObject({ outcome: 'SET', reason: null, rebootNeeded: true, gateway: 'NOT_CONFIRMED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway'] });
      expect(run2.elapsedMs, hostileAt).toBeLessThan(BOUND_MS);
      expect(run2.sent, hostileAt).toEqual(sent);
    }
    // At the reboot itself: sent, and its answer is none.
    const last = await timedSet(await startOdd('SystemReboot'));
    expect(last.result).toMatchObject({ outcome: 'SET', gateway: 'CONFIRMED', reboot: 'SENT_NO_ANSWER', calls: [...ONVIF_NETWORK_CALLS] });
    expect(last.elapsedMs).toBeLessThan(BOUND_MS);
  });

  it('the cap of a reply is its call\'s: a well-formed interface list above 64 KiB ends as the byte cap does (control: just under it is read); nothing of a refused reply is in the result', async () => {
    const padded = (bytes: number): OddDeviceReply => {
      const reply = answers['GetNetworkInterfaces'];
      if (reply === undefined || reply.kind !== 'ANSWER') throw new Error('fixture');
      return { ...reply, body: reply.body.replace('</s:Body>', `<!--${'x'.repeat(bytes - Buffer.byteLength(reply.body) - 7)}--></s:Body>`) };
    };
    expect((await timedSet(await startOdd('GetNetworkInterfaces', padded(65 * KIB)))).result).toMatchObject({ outcome: 'NOT_SET', reason: 'BYTE_CAP', calls: ['GetNetworkInterfaces'] });
    expect((await timedSet(await startOdd('GetNetworkInterfaces', padded(63 * KIB)))).result).toMatchObject({ outcome: 'SET', reboot: 'ACCEPTED' });

    const canary = `cnryR${randomUUID().replaceAll('-', '')}`;
    const { result } = await timedSet(await startOdd('GetNetworkInterfaces', { kind: 'ANSWER', status: 200, body: soapEnvelope(`<!DOCTYPE ${canary}><a>${canary}</a>`) }));
    expect(result).toMatchObject({ outcome: 'NOT_SET', reason: 'INTERFACES_ANSWER_INVALID' });
    expect(everything(result)).not.toContain(canary);
  });

  // Row V6b (caution R119-09 of `verification/119_commissioning_security.md`, item (e); decision C105 (6)). Before this row
  // the steps went on to the reboot after a cut and ARMED THE CLIENT AGAIN: no request could leave, but the two typed
  // values sat on the dead client object. The client never leaves the file: the test sees it as `this` of the package's
  // own gateway method, which it wraps for this one case and puts back.
  it('R119-09: a call CUT during the gateway step with a reboot asked - the client holds NEITHER value of the account afterwards, also after the steps have gone on, and no request is made after the cut', async () => {
    const { default: cam } = await import('onvif/lib/cam.js');
    const methods = cam.Cam.prototype as unknown as Record<string, (this: unknown, ...parts: unknown[]) => unknown>;
    const packageGateway = methods['setNetworkDefaultGateway'];
    if (packageGateway === undefined) throw new Error('fixture: the package has no gateway method');
    const seen: { client: Record<string, unknown> | null; heldAtGateway: unknown[]; answered: boolean } = { client: null, heldAtGateway: [], answered: false };
    const until = async (done: () => boolean): Promise<void> => {
      for (const from = performance.now(); !done(); ) {
        if (performance.now() - from > BOUND_MS) throw new Error('fixture: waited too long');
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      }
    };
    methods['setNetworkDefaultGateway'] = function (this: unknown, options: unknown, callback: unknown): unknown {
      const client = this as Record<string, unknown>;
      seen.client = client;
      seen.heldAtGateway = [client['username'], client['password']];
      return packageGateway.call(this, options, (...parts: unknown[]) => {
        seen.answered = true;
        (callback as (...values: unknown[]) => void)(...parts);
      });
    };
    try {
      // The device answers the read and the set (a reboot is needed) and NEVER answers the gateway request.
      const device = await startOdd('SetNetworkDefaultGateway', { kind: 'HANG' });
      const cutting = new AbortController();
      const pending = setter().setAddress(candidateAt(device.serviceUrl), NEW, sealCredential(ACCOUNT), cutting.signal);
      await until(() => device.operations.includes('SetNetworkDefaultGateway'));
      // Control: while the call runs the client is armed with the account (this is what must be gone afterwards).
      expect(seen.heldAtGateway).toEqual([ACCOUNT.username, ACCOUNT.secret]);
      cutting.abort();
      // The cut ends the call with what is known: the address was set, so the result names no reason, and no reboot was asked.
      expect(await pending).toMatchObject({ outcome: 'SET', reason: null, rebootNeeded: true, reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway'] });
      // The package answers its cut request, and the steps of the file go on from there: past the place of the reboot.
      await until(() => seen.answered);
      for (let turn = 0; turn < 5; turn += 1) await new Promise((resolvePromise) => setImmediate(resolvePromise));
      const client = seen.client ?? {};
      expect([client['username'], client['password'], client['useWSSecurity']]).toEqual([undefined, undefined, false]);
      expect(everything({ ...client, agent: undefined })).not.toContain(ACCOUNT.secret);
      // No request after the cut: the reboot never reached the device.
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      expect(device.operations).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway']);
    } finally {
      methods['setNetworkDefaultGateway'] = packageGateway;
    }
  });
});

// ── Row T3 (review 060c T-02; decisions C98, C100 (2)) ───────────────────────────────────────────────────────────
// The review's finding: all 14 cases of this file passed with the source bind deleted (`localAddress:
// destination.sourceAddress`), with the connection limit deleted (the `timers.after(limits.connectMs, ...)` block: the
// timer double recorded and never fired, and `asked` was read by nothing) and with the request limit unused (no device
// accepted and stayed silent). Each rule has a case here that fails without its line; the record of row T3
// (`docs/.../test/t3_mutation_and_ports.md`) names the mutation each was shown red on. This block has its own devices
// (a listener of this block on a port the system chooses) and touches nothing of the blocks above.
describe('row T3 / T-02: the source bind, the connection limit, the request limit, the reply guard and the bound of a Digest challenge - each held by a case that fails without its line', () => {
  type Maker = (this: unknown, options: Record<string, unknown>, callback?: unknown) => unknown;
  type Dial = { readonly host: unknown; readonly port: unknown; readonly localAddress: unknown; readonly family: unknown };
  /**
   * Every connection the agent's REAL maker is handed while `run` runs - that is, AFTER the set-network file forced its
   * own values into the options (the file reads the maker from its agent at each call and calls it with them; the
   * maker is wrapped on the prototype and put back). `how` may change what the real maker then gets - the one use is a
   * connection that is never established.
   */
  const dialsOf = async <T>(run: () => Promise<T>, how: (options: Record<string, unknown>) => Record<string, unknown> = (options) => options): Promise<{ readonly dials: Dial[]; readonly value: T }> => {
    const dials: Dial[] = [];
    const made = Reflect.get(HttpAgent.prototype, 'createConnection') as Maker;
    expect(typeof made).toBe('function');
    Reflect.set(HttpAgent.prototype, 'createConnection', function wrapped(this: unknown, options: Record<string, unknown>, callback?: unknown): unknown {
      dials.push({ host: options['host'], port: Number(options['port']), localAddress: 'localAddress' in options ? options['localAddress'] : 'NOT STATED', family: 'family' in options ? options['family'] : 'NOT STATED' });
      return made.call(this, how(options), callback);
    });
    try {
      return { dials, value: await run() };
    } finally {
      Reflect.set(HttpAgent.prototype, 'createConnection', made);
    }
  };
  type Fired = { readonly delayMs: number; readonly fire: () => void; cancelled: boolean };
  /** The capture timer seam as a double that KEEPS each callback: a test fires it, and sees whether it was cancelled. */
  const firingTimers = (): CaptureTimers & { readonly asked: Fired[] } => {
    const asked: Fired[] = [];
    return {
      asked,
      after(delayMs, callback) {
        const entry: Fired = { delayMs, fire: callback, cancelled: false };
        asked.push(entry);
        return () => {
          entry.cancelled = true;
        };
      },
    };
  };
  const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
  const within = async (ms: number, holds: () => boolean): Promise<boolean> => {
    for (const until = Date.now() + ms; Date.now() < until; ) {
      if (holds()) return true;
      await pause(5);
    }
    return holds();
  };
  /** A rule that admits the stub and names `source` as the address every connection is made from. */
  const from = (port: number, source: string) => (_address: string, _port: number): DestinationDecision => ({ allowed: true, destination: { address: FAKE_ONVIF_HOST, port, sourceAddress: source, viaAlias: false } });
  const portOf = (stub: FakeOnvifStub): number => Number(new URL(stub.addresses().deviceServiceUrl).port);
  /** A listener of this block on the literal 127.0.0.1, on a port the system chooses; `answer` writes the reply or leaves the request unanswered. */
  const listen = async (answer: (operation: string, authorization: string | undefined, reply: (status: number, body: string, headers?: Record<string, string>) => void) => void): Promise<{ readonly serviceUrl: string; readonly operations: string[] }> => {
    const operations: string[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('error', () => undefined);
      response.on('error', () => undefined);
      request.on('end', () => {
        const operation = /<(?:[\w.-]+:)?Body(?:\s[^>]*)?>\s*<(?:[\w.-]+:)?(\w+)/.exec(Buffer.concat(chunks).toString('utf8'))?.[1] ?? '?';
        operations.push(operation);
        answer(operation, request.headers.authorization, (status, body, headers = {}) => {
          response.writeHead(status, { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body), Connection: 'close', ...headers });
          response.end(body);
        });
      });
    });
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.once('error', rejectPromise);
      server.listen({ host: FAKE_ONVIF_HOST, port: 0, exclusive: true }, () => resolvePromise());
    });
    open.push({
      stop: () =>
        new Promise<void>((resolvePromise) => {
          server.closeAllConnections();
          server.close(() => resolvePromise());
        }),
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('fixture: no port');
    return { serviceUrl: `http://${FAKE_ONVIF_HOST}:${address.port}/onvif/device_service`, operations };
  };

  it('(a) THE SOURCE BIND, on the wire: a rule that names a source address this host does not hold (192.0.2.1) - `NO_ANSWER`, 0 requests at the device, nothing written; the same rule with 127.0.0.1 sets the address', async () => {
    const stub = await startStub();
    const notHeld = await setter(from(portOf(stub), '192.0.2.1')).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never());
    expect(notHeld).toEqual({ outcome: 'NOT_SET', reason: 'NO_ANSWER', destinationRefusal: null, hwAddress: null, rebootNeeded: null, gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces'], credentialRequests: 0, rejectedCredentialRequests: 0 });
    expect(deviceRequests(stub)).toEqual([]);
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null, rebootCount: 0 });
    // CONTROL: the device is there and the rule admits it - from an address the host holds the same call is made.
    expect(await setter(from(portOf(stub), FAKE_ONVIF_HOST)).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'SET', reboot: 'ACCEPTED' });
    expect(deviceRequests(stub).length).toBeGreaterThanOrEqual(4);
  });

  it('(a) THE SOURCE BIND, as asked: EVERY connection of a call reaches the agent\'s maker with the rule\'s source as its local address, family 4, the rule\'s host and port - whatever the candidate\'s text says and wherever the package moved its target', async () => {
    const stub = await startStub();
    // The candidate's text is a documentation address on port 9: were it dialled, nothing would answer.
    const elsewhere = candidateAt(`http://${FAKE_ONVIF_FOREIGN_HOST}:9/onvif/device_service`, { host: FAKE_ONVIF_FOREIGN_HOST });
    const held = await dialsOf(() => setter(from(portOf(stub), FAKE_ONVIF_HOST)).setAddress(elsewhere, NEW, sealCredential(ACCOUNT), never()));
    expect(held.value).toMatchObject({ outcome: 'SET', gateway: 'CONFIRMED', reboot: 'ACCEPTED' });
    // One connection per request (no keep-alive): the whole call, the package's own read-back after the set included.
    expect(held.dials.length).toBe(deviceRequests(stub).length);
    expect(held.dials.length).toBeGreaterThanOrEqual(5);
    expect(held.dials.filter((dial) => dial.host !== FAKE_ONVIF_HOST || dial.port !== portOf(stub) || dial.localAddress !== FAKE_ONVIF_HOST || dial.family !== 4)).toEqual([]);
    // CONTROL of the record: with ANOTHER source the record shows that one - so the value above is the rule's, read
    // from what the file handed on, and not a constant of the system. (192.0.2.1 is not this host's: nothing is sent.)
    const other = await dialsOf(() => setter(from(portOf(stub), '192.0.2.1')).setAddress(elsewhere, NEW, sealCredential(ACCOUNT), never()));
    expect(other.value).toMatchObject({ outcome: 'NOT_SET', reason: 'NO_ANSWER' });
    expect(other.dials.length).toBeGreaterThanOrEqual(1);
    expect(other.dials.filter((dial) => dial.host !== FAKE_ONVIF_HOST || dial.port !== portOf(stub) || dial.localAddress !== '192.0.2.1' || dial.family !== 4)).toEqual([]);
  });

  it('(b) THE CONNECTION LIMIT: one timer of `connectMs` per connection; a connection that is not established when it fires is destroyed and the call ends `NO_ANSWER` - and nothing else ends it before', async () => {
    const stub = await startStub();
    const timers = firingTimers();
    const call = createOnvifNetworkSetter({ timers, destination: loopbackDestination, admitHwAddress: ADMIT_WHAT_THE_DEVICE_REPORTS, limits: { connectMs: 1_234, requestMs: 60_000 } });
    const cutting = new AbortController();
    const seen: { outcome: OnvifNetworkSetResult | 'PENDING' } = { outcome: 'PENDING' };
    try {
      await dialsOf(
        async () => {
          const pending = call.setAddress(here(stub), NEW, sealCredential(ACCOUNT), cutting.signal).then((result) => {
            seen.outcome = result;
          });
          // The limit was asked of the timer seam, once, with the limit of THIS call - not the request limit, not a constant.
          expect(await within(2_000, () => timers.asked.length >= 1)).toBe(true);
          expect(timers.asked.map((timer) => [timer.delayMs, timer.cancelled])).toEqual([[1_234, false]]);
          // The connection is not established and nothing has ended the call: only the limit can.
          await pause(150);
          expect(seen.outcome).toBe('PENDING');
          timers.asked[0]?.fire();
          await Promise.race([pending, pause(3_000)]);
        },
        // THE DOUBLE of "a device that does not complete the connection": the real maker is handed a host NAME and a
        // resolver that never answers, so the socket stays `connecting` and nothing is sent anywhere.
        (options) => ({ ...options, host: 'never-established.invalid', lookup: () => undefined }),
      );
    } finally {
      cutting.abort();
    }
    expect(seen.outcome).toMatchObject({ outcome: 'NOT_SET', reason: 'NO_ANSWER', calls: ['GetNetworkInterfaces'], credentialRequests: 0 });
    expect(deviceRequests(stub)).toEqual([]);
  });

  it('(b) THE CONNECTION LIMIT, the other side: a connection that WAS established has its timer cancelled - one timer per request, each of `connectMs`; a late firing destroys nothing', async () => {
    const stub = await startStub();
    const timers = firingTimers();
    const result = await createOnvifNetworkSetter({ timers, destination: loopbackDestination, admitHwAddress: ADMIT_WHAT_THE_DEVICE_REPORTS, limits: { connectMs: 1_234 } }).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never());
    expect(result).toMatchObject({ outcome: 'SET', gateway: 'CONFIRMED', reboot: 'ACCEPTED' });
    expect(timers.asked.length).toBe(deviceRequests(stub).length);
    expect(timers.asked.filter((timer) => timer.delayMs !== 1_234 || !timer.cancelled)).toEqual([]);
    // A firing after the fact (a timer seam that lost a cancel) changes nothing of a call that ended.
    for (const timer of timers.asked) timer.fire();
    expect(stub.networkState()).toMatchObject({ address: NEW.address, rebootCount: 1 });
  });

  it('(c) THE REQUEST LIMIT: a device that accepts the connection, takes the request and never answers - the call ends `NO_ANSWER` after `requestMs`, not before and not much later; ONE request was sent', async () => {
    const silent = await listen(() => undefined);
    const cutting = new AbortController();
    const fromAt = performance.now();
    const seen: { outcome: OnvifNetworkSetResult | 'PENDING' } = { outcome: 'PENDING' };
    try {
      const pending = setter(loopbackDestination, { requestMs: 400 })
        .setAddress(candidateAt(silent.serviceUrl), NEW, sealCredential(ACCOUNT), cutting.signal)
        .then((result) => {
          seen.outcome = result;
        });
      await Promise.race([pending, pause(4_000)]);
    } finally {
      cutting.abort();
    }
    const elapsedMs = performance.now() - fromAt;
    expect(seen.outcome).toMatchObject({ outcome: 'NOT_SET', reason: 'NO_ANSWER', calls: ['GetNetworkInterfaces'], credentialRequests: 0 });
    expect(elapsedMs).toBeGreaterThanOrEqual(350);
    expect(elapsedMs).toBeLessThan(4_000);
    expect(silent.operations).toEqual(['GetNetworkInterfaces']);
  });

  // Review 060c T-02 (c). The cases of row B1 above hold the reply guard by a wall-clock bound at 1,000 KiB. THIS one
  // holds it by what the call DOES, at a size the package itself reads in about a millisecond: a reply of the refused
  // shape, 12 KiB - under every cap of this file - at the gateway step. With the guard the reply is refused BEFORE the
  // package sees it and nothing further is sent: no reboot. Without the guard the package fails to parse it, the
  // gateway is "not confirmed" all the same - and the reboot IS sent. The one request that is missing is the guard's doing.
  it('(d) THE REPLY GUARD, not the size and not the clock: a refused shape of 12 KiB at the gateway step ends the call there - the reboot request is NEVER SENT (control: an answer that is merely not the gateway\'s is followed by the reboot)', async () => {
    const good: Readonly<Record<string, string>> = {
      GetNetworkInterfaces: soapEnvelope('<tds:GetNetworkInterfacesResponse><tds:NetworkInterfaces token="eth0"><tt:Enabled>true</tt:Enabled><tt:Info><tt:Name>eth0</tt:Name><tt:HwAddress>02:00:00:00:00:0a</tt:HwAddress><tt:MTU>1500</tt:MTU></tt:Info></tds:NetworkInterfaces></tds:GetNetworkInterfacesResponse>'),
      SetNetworkInterfaces: soapEnvelope('<tds:SetNetworkInterfacesResponse><tds:RebootNeeded>true</tds:RebootNeeded></tds:SetNetworkInterfacesResponse>'),
      SystemReboot: soapEnvelope('<tds:SystemRebootResponse><tds:Message>Rebooting</tds:Message></tds:SystemRebootResponse>'),
    };
    const deviceWith = (atGateway: readonly [number, string]) =>
      listen((operation, _authorization, reply) => {
        if (operation === 'SetNetworkDefaultGateway') reply(atGateway[0], atGateway[1]);
        else if (good[operation] !== undefined) reply(200, good[operation] ?? '');
      });
    const refusedShape = await deviceWith([200, 'xmlns'.repeat((12 * 1024) / 5)]);
    expect(await setter().setAddress(candidateAt(refusedShape.serviceUrl), NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'SET', reason: null, gateway: 'NOT_CONFIRMED', reboot: 'NOT_ASKED', calls: ['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway'] });
    expect(refusedShape.operations).toEqual(['GetNetworkInterfaces', 'SetNetworkInterfaces', 'SetNetworkDefaultGateway']);
    // CONTROL: a well-formed answer the guard admits, which is no gateway answer (a fault): not confirmed either, and
    // the call goes on - the reboot is sent and accepted. So "no reboot" above is the refusal of the reply.
    const fault = await deviceWith([500, soapEnvelope('<s:Fault><s:Code><s:Value>s:Receiver</s:Value></s:Code><s:Reason><s:Text xml:lang="en">no</s:Text></s:Reason></s:Fault>')]);
    expect(await setter().setAddress(candidateAt(fault.serviceUrl), NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'SET', gateway: 'NOT_CONFIRMED', reboot: 'ACCEPTED', calls: [...ONVIF_NETWORK_CALLS] });
    expect(fault.operations.at(-1)).toBe('SystemReboot');
  });

  // Decision C100 (2): the package's own parse of a `WWW-Authenticate` challenge is QUADRATIC for one shape (a run of
  // spaces before a quoted value with a tail: 53.8 ms at 16,000 characters, 0.86 ms at 2,048 - measured by
  // `.cache/task4-t3/header_parse.cjs`). This file already hands the package no challenge above 2,048 characters
  // (`digestChallengeAllowed`); no case held that bound - this file passed with it deleted. This one fails without it.
  it('(e) C100 (2): a Digest challenge above 2,048 characters never reaches the package\'s parse - `SCHEME_NOT_ALLOWED`, 0 requests carried the credential; one of 2,048 is answered (control); the quadratic shape at the largest head Node admits is refused the same way', async () => {
    const authorizations: string[] = [];
    const device = { challenge: '' };
    const challenging = await listen((_operation, authorization, reply) => {
      authorizations.push(authorization === undefined ? 'none' : (authorization.split(' ')[0] ?? '?'));
      reply(401, '', { 'WWW-Authenticate': device.challenge });
    });
    const candidate = candidateAt(challenging.serviceUrl);
    // How often the PACKAGE'S own answer to a challenge - the function that parses it - was reached.
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
        const head = 'Digest realm="r", nonce="abcdef0123456789", qop="auth", opaque="';
        return `${head}${'o'.repeat(length - head.length - 1)}"`;
      };
      // CONTROL: at the bound the challenge is answered - one request carried the credential, and the device refused it.
      device.challenge = wellFormed(2_048);
      expect(device.challenge.length).toBe(2_048);
      expect(await setter().setAddress(candidate, NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'CREDENTIAL_REFUSED', credentialRequests: 1, rejectedCredentialRequests: 1 });
      expect([authorizations.splice(0), parsed]).toEqual([['none', 'Digest'], 1]);

      // One character more: not answered, not parsed.
      device.challenge = wellFormed(2_049);
      expect(await setter().setAddress(candidate, NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'SCHEME_NOT_ALLOWED', credentialRequests: 0, rejectedCredentialRequests: 0, calls: ['GetNetworkInterfaces'] });
      expect([authorizations.splice(0), parsed]).toEqual([['none'], 1]);

      // THE SHAPE THAT IS QUADRATIC IN THE PACKAGE, at the largest head Node's HTTP parser lets through (16,384 bytes
      // for the whole head: `http.maxHeaderSize`): refused the same way, in the time of a refusal.
      expect(maxHeaderSize).toBe(16_384);
      device.challenge = `Digest a=${' '.repeat(16_000 - 13)}"x"y`;
      expect(device.challenge.length).toBe(16_000);
      const fromAt = performance.now();
      expect(await setter().setAddress(candidate, NEW, sealCredential(ACCOUNT), never())).toMatchObject({ outcome: 'NOT_SET', reason: 'SCHEME_NOT_ALLOWED', credentialRequests: 0 });
      expect(performance.now() - fromAt).toBeLessThan(2_000);
      expect([authorizations.splice(0), parsed]).toEqual([['none'], 1]);
    } finally {
      methods['digestAuth'] = packageDigest;
    }
  });
});

// ── Row S06 (security review 086 caution C-10, finding S-06; decision C127) ─────────────────────────────────────────
// The source of a set call was held to the dotted form only, so `0.0.0.0`, multicast and broadcast passed as the address a
// connection is made FROM. It is now held to `isSourceAddress` (the relay's form) and refused when link-local. Every
// connection the agent's REAL maker is handed is counted (the maker is wrapped on the prototype and put back): a refused
// source opens NO socket. Shown RED on the mutants named in `implementation/s06_source_address_form.md`.
describe('row S06 / C-10: the source of a set call is a source address - not the unspecified address, multicast, broadcast or link-local', () => {
  type Maker = (this: unknown, options: Record<string, unknown>, callback?: unknown) => unknown;
  const socketsOf = async <T>(run: () => Promise<T>): Promise<{ readonly sources: unknown[]; readonly value: T }> => {
    const sources: unknown[] = [];
    const made = Reflect.get(HttpAgent.prototype, 'createConnection') as Maker;
    expect(typeof made).toBe('function');
    Reflect.set(HttpAgent.prototype, 'createConnection', function counted(this: unknown, options: Record<string, unknown>, callback?: unknown): unknown {
      sources.push(options['localAddress']);
      return made.call(this, options, callback);
    });
    try {
      return { sources, value: await run() };
    } finally {
      Reflect.set(HttpAgent.prototype, 'createConnection', made);
    }
  };
  /** A rule that admits the stub and names `source` as the address every connection is made from. */
  const from = (port: number, source: string) => (_address: string, _port: number): DestinationDecision => ({ allowed: true, destination: { address: FAKE_ONVIF_HOST, port, sourceAddress: source, viaAlias: false } });
  const portOf = (stub: FakeOnvifStub): number => Number(new URL(stub.addresses().deviceServiceUrl).port);

  it.each(['0.0.0.0', '224.0.0.1', '239.255.255.250', '255.255.255.255', '169.254.10.20'])('a rule that names %s as the source: `DESTINATION_REFUSED` before any request - 0 sockets, 0 requests at the device, nothing written', async (source) => {
    const stub = await startStub();
    const held = await socketsOf(() => setter(from(portOf(stub), source)).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never()));
    expect(held.value).toEqual({ outcome: 'NOT_SET', reason: 'DESTINATION_REFUSED', destinationRefusal: null, hwAddress: null, rebootNeeded: null, gateway: 'NOT_ASKED', reboot: 'NOT_ASKED', calls: [], credentialRequests: 0, rejectedCredentialRequests: 0 });
    expect(held.sources).toEqual([]);
    expect(deviceRequests(stub)).toEqual([]);
    expect(stub.networkState()).toMatchObject({ address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null, rebootCount: 0 });
  });

  it('an ordinary camera-interface source (the product context\'s 192.168.50.1) is ADMITTED: the call is not refused, and its connection is made from that address; CONTROL: the double\'s own 127.0.0.1 sets the address', async () => {
    const stub = await startStub();
    const camera = await socketsOf(() => setter(from(portOf(stub), '192.168.50.1')).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never()));
    // Whether this host holds 192.168.50.1 decides only whether the dial answers; the form check let it through to a socket.
    expect(camera.value.reason).not.toBe('DESTINATION_REFUSED');
    expect(camera.sources.length).toBeGreaterThanOrEqual(1);
    expect(camera.sources.filter((source) => source !== '192.168.50.1')).toEqual([]);
    const loopback = await socketsOf(() => setter(from(portOf(stub), FAKE_ONVIF_HOST)).setAddress(here(stub), NEW, sealCredential(ACCOUNT), never()));
    expect(loopback.value).toMatchObject({ outcome: 'SET', reboot: 'ACCEPTED' });
    expect(loopback.sources.length).toBeGreaterThanOrEqual(4);
    expect(loopback.sources.filter((source) => source !== FAKE_ONVIF_HOST)).toEqual([]);
  });
});
