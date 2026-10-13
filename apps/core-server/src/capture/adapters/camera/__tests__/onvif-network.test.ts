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
import { inspect } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_ONVIF_FOREIGN_HOST, FAKE_ONVIF_GATEWAY_READ_BACK_OPERATION, FAKE_ONVIF_HOST, FAKE_ONVIF_NETWORK_DEFAULTS, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub, type FakeOnvifStubOptions } from '../../../../../test/support/fake-onvif-stub';
import { loopbackDestination } from '../../../../../test/support/loopback-destination';
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

const setter = (destination: (address: string, port: number) => DestinationDecision = loopbackDestination, limits: Partial<typeof ONVIF_NETWORK_LIMITS> = {}) => createOnvifNetworkSetter({ timers: manualTimers(), destination, limits });
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
