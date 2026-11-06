// The destination rule on a stored camera as one judgement (task 4 blueprint row 143; AD-02 (1)).
// Pure: no double is needed beyond the rule handed in. The rule of the table is the REAL one, bound
// to hand-written host facts (`stored-address-cases.ts`).
import { describe, expect, it } from 'vitest';
import { CaptureAdapterKind } from '../../kinds';
import { DestinationPurpose, decideDestination } from '../../../destination-rule';
import { ONVIF_DEVICE_SERVICE_DEFAULT_PORT, ONVIF_DEVICE_SERVICE_PATH, StoredCameraRefusal, isSourceAddress, judgeStoredCamera, storedCameraCandidate, storedCameraSourceOf, type StoredCameraAddressRule } from '../stored-address';
import { ADMITTED_HOST, ADMITTED_OFFICE_HOST, GATE_CLASSES, HOST_FACTS, REAL_RULE, REFUSED_STORED_ADDRESSES, storedCameraAt } from './stored-address-cases';

/** Row 143b: an admission of the real rule names the ONE camera-interface address of the hand-written host facts as the source. */
const ADMITTED_FROM_THE_CAMERA_INTERFACE = { allowed: true, sourceAddress: '192.168.50.1' };

// Task 4 row 143b (S13-11 point 2): THE SOURCE HALF. The rule names the camera-interface address a connection must be
// made FROM; the judgement carries it on in the strict form, and a dial takes it from `storedCameraSourceOf` or is refused.
describe('row 143b: the source address of an admission, and the refusal that stands in its place', () => {
  const camera = storedCameraAt(ADMITTED_HOST);
  const admitting = (destination: unknown): StoredCameraAddressRule => (() => ({ allowed: true, destination })) as unknown as StoredCameraAddressRule;

  it('the real rule: for a camera-subnet host the source is the camera-interface address of the host facts - never the office interface, never the camera', () => {
    const judged = judgeStoredCamera(camera, REAL_RULE);
    expect(judged).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    expect(storedCameraSourceOf(judged)).toEqual({ sourceAddress: HOST_FACTS.cameraAddresses[0]?.address });
    expect(HOST_FACTS.hostAddresses).not.toContain('192.168.50.1');
    // A refused address has no source: its refusal is the answer.
    for (const entry of REFUSED_STORED_ADDRESSES) expect(storedCameraSourceOf(judgeStoredCamera(entry.candidate, REAL_RULE)), entry.className).toEqual({ refusal: entry.refusal });
    expect(storedCameraSourceOf(judgeStoredCamera(camera, undefined))).toEqual({ refusal: StoredCameraRefusal.RULE_ABSENT });
  });

  it('R-FLEX (RF-N1, row 103): STORED_CAMERA is global - an address on the office subnet is admitted FROM the office address; facts without `interfaceSubnets` are NOT_CONFIGURED', () => {
    // Lifted pin: this address was OTHER_INTERFACE_SUBNET before R-FLEX.
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_OFFICE_HOST), REAL_RULE)).toEqual({ allowed: true, sourceAddress: '10.20.0.5' });
    expect(storedCameraSourceOf(judgeStoredCamera(storedCameraAt(ADMITTED_OFFICE_HOST), REAL_RULE))).toEqual({ sourceAddress: '10.20.0.5' });
    // Control: the camera-subnet host keeps the camera-interface source.
    expect(judgeStoredCamera(camera, REAL_RULE)).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    // RF-N7: the same facts without `interfaceSubnets` refuse every stored address.
    const { interfaceSubnets: _dropped, ...withoutSubnets } = HOST_FACTS;
    const unreadable: StoredCameraAddressRule = (host, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host, ...(port === undefined ? {} : { port }) }, withoutSubnets);
    expect(judgeStoredCamera(camera, unreadable)).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_OFFICE_HOST), unreadable)).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
  });

  it('an admission that names no source, or one outside the strict form, is `STORED_ADDRESS_SOURCE_ABSENT` at the dial: there is no third answer', () => {
    expect(StoredCameraRefusal.SOURCE_ABSENT).toBe('STORED_ADDRESS_SOURCE_ABSENT');
    expect(judgeStoredCamera(camera, (() => ({ allowed: true })) as StoredCameraAddressRule)).toEqual({ allowed: true, sourceAddress: null });
    expect(storedCameraSourceOf(judgeStoredCamera(camera, (() => ({ allowed: true })) as StoredCameraAddressRule))).toEqual({ refusal: 'STORED_ADDRESS_SOURCE_ABSENT' });
    const notSources: unknown[] = [
      undefined, null, '', '0.0.0.0', '0.1.2.3', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255', 'camera-interface', 'localhost', 'a.b.c.d',
      '192.168.50', '1.2.3.4.5', '192.168.050.1', '010.0.0.1', '192.168.50.256', '192.168.50.0001', '0xc0.0xa8.0x32.0x01', '3232248321', '192.168.50.1.', '.192.168.50.1',
      '192..50.1', ' 192.168.50.1', '192.168.50.1 ', '192.168.50.1\n', '192.168.50.1:0', '192.168.50.1/24', '+192.168.50.1', '::1', '::ffff:192.168.50.1', '1'.repeat(300),
      3232248321, 0, true, ['192.168.50.1'], { address: '192.168.50.1' },
    ];
    for (const sourceAddress of notSources) {
      expect(isSourceAddress(sourceAddress), String(sourceAddress)).toBe(false);
      const judged = judgeStoredCamera(camera, admitting({ address: ADMITTED_HOST, sourceAddress }));
      expect(judged, String(sourceAddress)).toEqual({ allowed: true, sourceAddress: null });
      expect(storedCameraSourceOf(judged), String(sourceAddress)).toEqual({ refusal: 'STORED_ADDRESS_SOURCE_ABSENT' });
    }
    // A judgement made up elsewhere does not pass either: the form is held again where the dial takes its source.
    expect(storedCameraSourceOf({ allowed: true, sourceAddress: '0.0.0.0' })).toEqual({ refusal: 'STORED_ADDRESS_SOURCE_ABSENT' });
    expect(storedCameraSourceOf({ allowed: true, sourceAddress: null })).toEqual({ refusal: 'STORED_ADDRESS_SOURCE_ABSENT' });
  });

  it('the strict form: four numbers 0 to 255 without a leading 0, the first 1 to 223 - the form the relay holds its start message to', () => {
    for (const sourceAddress of ['1.0.0.0', '10.0.0.7', '127.0.0.1', '192.168.50.1', '192.0.2.1', '223.255.255.255', '100.64.0.1', '9.99.199.255']) {
      expect(isSourceAddress(sourceAddress), sourceAddress).toBe(true);
      expect(storedCameraSourceOf(judgeStoredCamera(camera, admitting({ address: ADMITTED_HOST, sourceAddress }))), sourceAddress).toEqual({ sourceAddress });
    }
    // A source is named only with an admission of the address asked: another address admitted is still no admission.
    expect(judgeStoredCamera(camera, admitting({ address: '192.168.50.21', sourceAddress: '192.168.50.1' }))).toEqual({ allowed: false, refusal: 'STORED_ADDRESS_RULE_FAILED' });
  });
});

describe('a stored camera as the candidate its users take', () => {
  const kind = CaptureAdapterKind.ONVIF_RTSP;

  it('`host` and `host:port` become the host as stored and the device service on it; the endpoint reference travels, nothing else is invented', () => {
    expect(ONVIF_DEVICE_SERVICE_PATH).toBe('/onvif/device_service');
    expect(storedCameraCandidate({ adapterKind: kind, address: '192.168.50.20' })).toEqual({ adapterKind: kind, host: '192.168.50.20', serviceAddress: 'http://192.168.50.20/onvif/device_service', endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false });
    expect(storedCameraCandidate({ adapterKind: kind, address: '192.168.50.20:8080', endpointRef: 'urn:uuid:0d2c1b9e-6a53-4f0e-9f6b-1c5d2e7a8b90' })).toMatchObject({ host: '192.168.50.20', serviceAddress: 'http://192.168.50.20:8080/onvif/device_service', endpointRef: 'urn:uuid:0d2c1b9e-6a53-4f0e-9f6b-1c5d2e7a8b90' });
    // It decides nothing: a loopback row becomes a candidate, and the judgement then refuses it.
    const loopback = storedCameraCandidate({ adapterKind: kind, address: '127.0.0.1:8557' });
    expect(loopback?.host).toBe('127.0.0.1');
    expect(judgeStoredCamera(loopback, REAL_RULE)).toEqual({ allowed: false, refusal: 'LOOPBACK' });
    expect(judgeStoredCamera(storedCameraCandidate({ adapterKind: kind, address: ADMITTED_HOST }), REAL_RULE)).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
  });

  it('a stored value that is absent or not of the stored form is no candidate: a scheme, a user part, a path, a blank, a bracketed literal', () => {
    const SEPARATOR = String.fromCharCode(64);
    for (const address of [null, '', ' ', 'http://192.168.50.20', `someone${SEPARATOR}192.168.50.20`, '192.168.50.20/onvif', '192.168.50.20:', '192.168.50.20:123456', '[::1]:80', '192.168.50.20 ', '192.168.50.20\n127.0.0.1']) {
      expect(storedCameraCandidate({ adapterKind: kind, address }), JSON.stringify(address)).toBeNull();
    }
  });
});

describe('the judgement of a stored camera (AD-02 (1))', () => {
  it('admits a camera inside the camera subnet at the stored port list, and nothing is kept between two questions', () => {
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST), REAL_RULE)).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 80), REAL_RULE)).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    // The same question about another stored value is another answer: the judgement holds no memory of the first.
    expect(judgeStoredCamera(storedCameraAt('127.0.0.1'), REAL_RULE)).toEqual({ allowed: false, refusal: 'LOOPBACK' });
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST), REAL_RULE)).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
  });

  it('refuses every class by its code word: the five of the gate condition and the further ones of the brief', () => {
    for (const className of GATE_CLASSES) expect(REFUSED_STORED_ADDRESSES.some((entry) => entry.className === className), className).toBe(true);
    for (const entry of REFUSED_STORED_ADDRESSES) expect(judgeStoredCamera(entry.candidate, REAL_RULE), entry.className).toEqual({ allowed: false, refusal: entry.refusal });
  });

  it('the rule is asked about the stored host as it stands and about the port of the service address; a malformed camera is refused without asking it', () => {
    const asked: [string, number | undefined][] = [];
    const rule: StoredCameraAddressRule = (host, port) => {
      asked.push([host, port]);
      return { allowed: true };
    };
    expect(judgeStoredCamera(storedCameraAt('192.168.50.20'), rule).allowed).toBe(true);
    expect(judgeStoredCamera(storedCameraAt('192.168.50.20', 8080), rule).allowed).toBe(true);
    expect(asked).toEqual([
      ['192.168.50.20', undefined],
      ['192.168.50.20', 8080],
    ]);
    asked.length = 0;
    const base = storedCameraAt('192.168.50.20');
    const USER_PART = `http://someone${String.fromCharCode(64)}192.168.50.20/onvif/device_service`;
    for (const candidate of [
      null,
      undefined,
      { ...base, host: '' },
      { ...base, serviceAddress: null },
      { ...base, serviceAddress: 'not an address' },
      { ...base, serviceAddress: 'https://192.168.50.20/onvif/device_service' },
      { ...base, serviceAddress: 'http://192.168.50.21/onvif/device_service' },
      { ...base, serviceAddress: USER_PART },
      // The host part is compared as written: an abbreviated or an octal form of the stored host is not the stored host.
      { ...base, host: '192.168.050.20' },
      { ...base, host: '0300.0250.062.024', serviceAddress: 'http://0300.0250.062.024/onvif/device_service' },
    ]) {
      const judged = judgeStoredCamera(candidate, rule);
      expect(judged.allowed, JSON.stringify(candidate)).toBe(false);
      expect([StoredCameraRefusal.ABSENT, StoredCameraRefusal.MALFORMED] as string[]).toContain(judged.allowed ? '' : judged.refusal);
    }
    expect(asked).toEqual([]);
  });

  it('no rule, a rule that throws, an answer that is no decision, a refusal that is no code word, an admission of another address: all refused, none permissive', () => {
    const camera = storedCameraAt(ADMITTED_HOST);
    expect(judgeStoredCamera(camera, undefined)).toEqual({ allowed: false, refusal: 'STORED_ADDRESS_RULE_ABSENT' });
    const failing: readonly unknown[] = [
      () => {
        throw new Error(`no route to ${ADMITTED_HOST}`);
      },
      () => undefined,
      () => null,
      () => 'allowed',
      () => ({}),
      () => ({ allowed: 'true' }),
      () => ({ allowed: 1 }),
      () => ({ allowed: false }),
      () => ({ allowed: false, refusal: `refused ${ADMITTED_HOST}` }),
      () => ({ allowed: false, refusal: 'lower_case' }),
      () => ({ allowed: true, destination: { address: '127.0.0.1' } }),
      () => ({ allowed: true, destination: {} }),
    ];
    for (const rule of failing) expect(judgeStoredCamera(camera, rule as StoredCameraAddressRule)).toEqual({ allowed: false, refusal: 'STORED_ADDRESS_RULE_FAILED' });
    // Nothing of the address is in a refusal.
    for (const entry of REFUSED_STORED_ADDRESSES) expect(JSON.stringify(judgeStoredCamera(entry.candidate, REAL_RULE)).includes(entry.candidate.host === '' ? ADMITTED_HOST : entry.candidate.host)).toBe(false);
  });
});

// Decision C127 (security review 086 caution C-3, finding S-04): THE PORT HALF. The port DIALLED - the service
// address's own, or 80 (`http:`) when it names none - must be in the stored list of allowed ONVIF ports.
describe('C127 / S-04: the port dialled is a member of the stored allowed list', () => {
  const ruleWith = (allowedPorts: readonly number[]): StoredCameraAddressRule => (host, port) =>
    decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host, ...(port === undefined ? {} : { port }) }, { ...HOST_FACTS, allowedPorts });

  it('the default port of a service address that names none is the `http:` one, 80', () => {
    expect(ONVIF_DEVICE_SERVICE_DEFAULT_PORT).toBe(80);
  });

  it('list [80] admits 80 (named or not); list [8080] refuses 80 (named or not) and admits 8080; list [8080, 80] admits both', () => {
    // SEEN RED: `?? ONVIF_DEVICE_SERVICE_DEFAULT_PORT` -> `?? 8080` (the [80] cases); the second ask removed (`PORT_NOT_LISTED` -> `STORED_ADDRESS_PORT_MISMATCH`, and [8080, 80] host-only refused).
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST), ruleWith([80]))).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 80), ruleWith([80]))).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST), ruleWith([8080]))).toEqual({ allowed: false, refusal: 'PORT_NOT_LISTED' });
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 80), ruleWith([8080]))).toEqual({ allowed: false, refusal: 'PORT_NOT_LISTED' });
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 8080), ruleWith([8080]))).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST), ruleWith([8080, 80]))).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 8080), ruleWith([8080, 80]))).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 554), ruleWith([8080, 80]))).toEqual({ allowed: false, refusal: 'PORT_NOT_LISTED' });
  });

  it('an admission that states another port than the one dialled is STORED_ADDRESS_PORT_MISMATCH, whatever was asked', () => {
    // SEEN RED: the comparison of `destination.port` with the dialled port removed (both cases admitted).
    const admits8080: StoredCameraAddressRule = (host) => ({ allowed: true, destination: { address: host, sourceAddress: '192.168.50.1', port: 8080 } });
    expect(StoredCameraRefusal.PORT_MISMATCH).toBe('STORED_ADDRESS_PORT_MISMATCH');
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST), admits8080)).toEqual({ allowed: false, refusal: 'STORED_ADDRESS_PORT_MISMATCH' });
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 554), admits8080)).toEqual({ allowed: false, refusal: 'STORED_ADDRESS_PORT_MISMATCH' });
    expect(judgeStoredCamera(storedCameraAt(ADMITTED_HOST, 8080), admits8080)).toEqual(ADMITTED_FROM_THE_CAMERA_INTERFACE);
  });
});
