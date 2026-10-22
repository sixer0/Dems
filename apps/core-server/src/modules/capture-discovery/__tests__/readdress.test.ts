// The operator-confirmed re-address of a registered camera (task 4 blueprint row 97, WP-12;
// NEW-1 as answered by U12 A7; AD-02; SEC35-28).
//
// THE DOUBLES. The candidate state is a hand-built list (what `store.find` answers for the caller's
// own search); the engine unit is a scope whose pending state is a hand-built registry and whose
// audit door collects the entries; the engine's door for the address is a function that changes
// that pending state. The DESTINATION RULE is the real one (`capture/destination-rule`), bound to a
// host whose camera interface holds 192.168.50.1/24. No database, no socket, no camera.
//
// WHAT STAYS UNPROVEN HERE: the unit of the real engine with its durable mapping and audit chain
// (the engine has no door for a re-address yet: request of row 97), and a real camera that moved
// (`9A/H-12`).
import { CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE, CAPTURE_READDRESS_REFUSAL_SENTENCES, CaptureReaddressReason } from '@dems/shared/api';
import { AuditType, type CaptureDeviceStatus } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../capture/destination-rule';
import { detailRulesOf, type AuditEntry } from '../../../core';
import type { EngineOutcome, EngineUnit } from '../../../engine';
import {
  READDRESS_AUDIT_REASON,
  READDRESS_UNIT_LABEL,
  ReaddressRefusal,
  ReaddressRefused,
  confirmCameraReaddress,
  operatorReaddressConfirmation,
  readdressTargetOf,
  storedHostLiteral,
  type OperatorReaddressConfirmation,
  type ReaddressCaller,
  type ReaddressCandidate,
  type ReaddressRule,
  type ReaddressSeams,
} from '../readdress';
import { engineDeviceReaddresser, readdressRefusedAnswer, readdressRuleOf } from '../readdress-route';

const HOST: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 16 }],
  // R-FLEX NW-C1 (row 104): every eligible interface of the host - STORED_CAMERA is global.
  interfaceSubnets: [
    { name: 'eth0', address: '192.168.50.1', network: '192.168.50.0', prefixLength: 24 },
    { name: 'eth1', address: '10.20.0.15', network: '10.20.0.0', prefixLength: 16 },
  ],
  hostAddresses: ['10.20.0.15', '192.168.50.1'],
};
/** The composition's binding: the real rule, purpose STORED_CAMERA, on the host above. */
const realRule: ReaddressRule = (host, port) => decideDestination(port === undefined ? { purpose: DestinationPurpose.STORED_CAMERA, address: host } : { purpose: DestinationPurpose.STORED_CAMERA, address: host, port }, HOST);

const ENDPOINT = 'urn:uuid:11111111-2222-4333-8444-555555555555';
const camera = (id: string, host: string): CaptureDeviceStatus =>
  ({ id, kind: 'CAMERA', model: 'M', firmware: null, host, poePort: null, online: true, streamState: null, capabilities: ['VIDEO'], adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' }) as CaptureDeviceStatus;

const moved = (over: Partial<ReaddressCandidate> = {}, host = '192.168.50.77', serviceAddress: string | null = null): ReaddressCandidate => ({
  candidateId: 'CND-000000000001',
  searchId: 'SRCH-000000000001',
  camera: { host, serviceAddress, endpointRef: ENDPOINT, conflict: false },
  registeredDeviceId: 'CAM-01',
  addressChanged: true,
  ...over,
});

const OPERATOR: ReaddressCaller = { principal: { kind: 'OPERATOR', operatorId: 'OPR-003', sessionId: 'S-A' } as ReaddressCaller['principal'] };

interface Rig {
  readonly seams: ReaddressSeams;
  readonly entries: AuditEntry[];
  readonly notes: Array<Readonly<Record<string, string | number | boolean | null>>>;
  readonly units: string[];
  readonly doorCalls: Array<{ deviceId: string; address: string; at: number }>;
  devices(): readonly CaptureDeviceStatus[];
  ruleCalls: Array<[string, number | undefined]>;
}

function rig(options: {
  candidates?: readonly ReaddressCandidate[];
  devices?: readonly CaptureDeviceStatus[];
  sessionOpen?: boolean;
  sessionOpensInUnit?: boolean;
  rule?: ReaddressRule | null;
  door?: 'none' | 'throws';
  noCandidates?: boolean;
} = {}): Rig {
  let devices: CaptureDeviceStatus[] = [...(options.devices ?? [camera('CAM-01', '192.168.50.64'), camera('CAM-02', '192.168.50.65')])];
  const committedSession = options.sessionOpen === true ? { state: 'RECORDING' } : null;
  const entries: AuditEntry[] = [];
  const notes: Rig['notes'] = [];
  const units: string[] = [];
  const doorCalls: Rig['doorCalls'] = [];
  const ruleCalls: Rig['ruleCalls'] = [];
  const list = options.candidates ?? [moved()];
  const rule = options.rule === undefined ? realRule : options.rule;
  const stateOf = (session: unknown) => ({ session, captureDevices: { devices } }) as unknown as ReturnType<ReaddressSeams['host']['state']>;
  const seams: ReaddressSeams = {
    host: {
      now: () => 1_760_000_000_000,
      state: () => stateOf(committedSession),
      async engineUnit<Value>(label: string, work: (scope: EngineUnit) => Promise<Value>): Promise<EngineOutcome<Value>> {
        units.push(label);
        // A unit: what it did is kept only when the work resolves.
        const devicesBefore = devices;
        const pendingEntries: AuditEntry[] = [];
        const scope = {
          pending: () => stateOf(options.sessionOpensInUnit === true ? { state: 'RECORDING' } : committedSession),
          unit: { audit: { append: async (entry: AuditEntry) => void pendingEntries.push(entry) } },
        } as unknown as EngineUnit;
        try {
          const value = await work(scope);
          entries.push(...pendingEntries);
          return { value, epoch: 1, revision: 7 } as unknown as EngineOutcome<Value>;
        } catch (error) {
          devices = devicesBefore;
          throw error;
        }
      },
      note: (fields) => void notes.push(fields),
    },
    candidates: () => (options.noCandidates === true ? null : { find: (sessionId, candidateId) => (sessionId === 'S-A' ? (list.find((entry) => entry.candidateId === candidateId) ?? null) : null) }),
    addressRule: () =>
      rule === null
        ? null
        : (host, port) => {
            ruleCalls.push([host, port]);
            return rule(host, port);
          },
    readdresser: () =>
      options.door === 'none'
        ? null
        : async (_scope, change) => {
            doorCalls.push({ ...change });
            if (options.door === 'throws') throw new Error('the registry refused the write');
            devices = devices.map((device) => (device.id === change.deviceId ? { ...device, host: change.address } : device));
          },
  };
  return { seams, entries, notes, units, doorCalls, ruleCalls, devices: () => devices };
}

const confirm = (over: Partial<{ deviceId: string; candidateId: string; address: string }> = {}): OperatorReaddressConfirmation =>
  operatorReaddressConfirmation({ deviceId: 'CAM-01', candidateId: 'CND-000000000001', address: '192.168.50.77', ...over });

async function refusalOf(run: Promise<unknown>): Promise<{ code: string; rule: string | null }> {
  try {
    await run;
  } catch (error) {
    if (error instanceof ReaddressRefused) return { code: error.code, rule: error.rule };
    throw error;
  }
  throw new Error('the re-address was not refused');
}

/** Nothing was written: no unit's entry, the registry as it was, the door not reached. */
const untouched = (r: Rig): void => {
  expect(r.entries).toEqual([]);
  expect(r.devices().map((device) => [device.id, device.host])).toEqual([
    ['CAM-01', '192.168.50.64'],
    ['CAM-02', '192.168.50.65'],
  ]);
};

describe('a confirmed re-address writes the address and ONE audit entry, in one unit', () => {
  it('the device holds the new address; the entry is CAPTURE_DEVICE_ADDRESS_CHANGED with the two IP literals, the reason and the actor', async () => {
    const r = rig();
    const answer = await confirmCameraReaddress(r.seams, OPERATOR, confirm());
    expect(answer).toEqual({ deviceId: 'CAM-01', fromAddress: '192.168.50.64', toAddress: '192.168.50.77' });
    expect(r.units).toEqual([READDRESS_UNIT_LABEL]);
    expect(r.doorCalls).toEqual([{ deviceId: 'CAM-01', address: '192.168.50.77', at: 1_760_000_000_000 }]);
    expect(r.devices().map((device) => [device.id, device.host])).toEqual([
      ['CAM-01', '192.168.50.77'],
      ['CAM-02', '192.168.50.65'],
    ]);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toEqual({
      type: AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED,
      message: 'Camera address changed',
      actorId: 'OPR-003',
      deviceId: 'CAM-01',
      // Row 197: the entry names the operation of the contract an operator confirms through.
      details: { deviceId: 'CAM-01', fromAddress: '192.168.50.64', toAddress: '192.168.50.77', reason: READDRESS_AUDIT_REASON, operationId: 'confirmCaptureDeviceAddress', permission: 'CAPTURE_CONFIG' },
    });
    // The rule was asked once, with the host of the candidate and no port.
    expect(r.ruleCalls).toEqual([['192.168.50.77', undefined]]);
  });

  it('the entry passes the audit writer\'s closed detail rule of its type: every required key, no foreign key, every value in its form', async () => {
    const r = rig();
    await confirmCameraReaddress(r.seams, OPERATOR, confirm());
    const details = r.entries[0]?.details ?? {};
    const rules = detailRulesOf(AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED);
    if (rules === undefined) throw new Error('no detail rule for the type');
    expect(Object.keys(details).filter((key) => !Object.hasOwn(rules, key))).toEqual([]);
    for (const [key, rule] of Object.entries(rules)) {
      const value = (details as Record<string, string | number | boolean | null>)[key];
      if (value === undefined) expect(rule.required, key).toBe(false);
      else expect(rule.accepts(value), key).toBe(true);
    }
  });

  it('a candidate whose service address names a port: the stored address is host:port, the port goes to the rule, the entry holds the IP literal only', async () => {
    // A host whose stored port list holds 8080 beside 80 (the default port of a locator is not part of an address, as in adoption).
    const withPorts: ReaddressRule = (host, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host, ...(port === undefined ? {} : { port }) }, { ...HOST, allowedPorts: [80, 8080] });
    const r = rig({
      rule: withPorts,
      candidates: [moved({}, '192.168.50.77', 'http://192.168.50.77:8080/onvif/device_service')],
      devices: [camera('CAM-01', '192.168.50.64:8080'), camera('CAM-02', '192.168.50.65')],
    });
    const answer = await confirmCameraReaddress(r.seams, OPERATOR, confirm({ address: '192.168.50.77:8080' }));
    expect(answer).toEqual({ deviceId: 'CAM-01', fromAddress: '192.168.50.64:8080', toAddress: '192.168.50.77:8080' });
    expect(r.ruleCalls).toEqual([['192.168.50.77', 8080]]);
    expect(r.entries.map((entry) => [entry.details?.['fromAddress'], entry.details?.['toAddress']])).toEqual([['192.168.50.64', '192.168.50.77']]);
  });

  it('no note of the flow carries an address or an endpoint reference', async () => {
    const r = rig();
    await confirmCameraReaddress(r.seams, OPERATOR, confirm());
    await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm({ address: '192.168.50.99' })));
    const text = JSON.stringify(r.notes);
    expect(r.notes.length).toBeGreaterThanOrEqual(2);
    expect(text).not.toMatch(/192\.168\.|urn:uuid/);
  });
});

describe('never automatic: without an operator\'s confirmation nothing is written', () => {
  it('re-addresses without a confirmation: 0 - a plain object, a copy of a confirmation, null and a non-operator caller are all refused before any seam is asked', async () => {
    const r = rig();
    const copy = { ...confirm() };
    const lookalike = { deviceId: 'CAM-01', candidateId: 'CND-000000000001', address: '192.168.50.77', confirmed: true };
    for (const notConfirmed of [lookalike, JSON.parse(JSON.stringify(confirm())), null, undefined, 'CAM-01']) {
      expect(await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, notConfirmed as unknown as OperatorReaddressConfirmation))).toEqual({ code: ReaddressRefusal.NOT_CONFIRMED, rule: null });
    }
    // A spread copy keeps the brand (a symbol key is copied): it is still the operator's own confirmation of this request.
    expect(Object.getOwnPropertySymbols(copy)).toHaveLength(1);
    for (const caller of [{ principal: { kind: 'DEVICE', deviceId: 'TAB-01' } }, { principal: { kind: 'ANONYMOUS' } }, {}]) {
      expect((await refusalOf(confirmCameraReaddress(r.seams, caller as unknown as ReaddressCaller, confirm()))).code).toBe(ReaddressRefusal.NOT_CONFIRMED);
    }
    expect(r.units).toEqual([]);
    expect(r.ruleCalls).toEqual([]);
    expect(r.doorCalls).toEqual([]);
    untouched(r);
  });

  it('the confirmation names what the operator SAW: another address than the candidate holds now confirms nothing', async () => {
    const r = rig();
    expect(await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm({ address: '192.168.50.78' })))).toEqual({ code: ReaddressRefusal.CONFIRMATION_MISMATCH, rule: null });
    // Nor a confirmation without the port the candidate names.
    const withPort = rig({ candidates: [moved({}, '192.168.50.77', 'http://192.168.50.77:8080/onvif/device_service')] });
    expect((await refusalOf(confirmCameraReaddress(withPort.seams, OPERATOR, confirm()))).code).toBe(ReaddressRefusal.CONFIRMATION_MISMATCH);
    untouched(r);
    untouched(withPort);
    expect(r.ruleCalls).toEqual([]);
  });
});

describe('the candidate is the registered camera by its endpoint reference, or nothing is written', () => {
  it.each([
    ['of another operator session (or unknown, or expired)', { candidates: [] as ReaddressCandidate[] }, ReaddressRefusal.CANDIDATE_UNKNOWN],
    ['a NEW candidate (registered as nothing)', { candidates: [moved({ registeredDeviceId: null, addressChanged: false })] }, ReaddressRefusal.NOT_THE_REGISTERED_CAMERA],
    ['registered as ANOTHER device', { candidates: [moved({ registeredDeviceId: 'CAM-02' })] }, ReaddressRefusal.NOT_THE_REGISTERED_CAMERA],
    ['registered by its address only (the address did not change)', { candidates: [moved({ addressChanged: false })] }, ReaddressRefusal.NOT_THE_REGISTERED_CAMERA],
    ['without an endpoint reference', { candidates: [moved({ camera: { host: '192.168.50.77', serviceAddress: null, endpointRef: null, conflict: false } })] }, ReaddressRefusal.NOT_THE_REGISTERED_CAMERA],
    ['in an identity conflict (two devices announce the reference)', { candidates: [moved({ camera: { host: '192.168.50.77', serviceAddress: null, endpointRef: ENDPOINT, conflict: true } })] }, ReaddressRefusal.IDENTITY_CONFLICT],
  ])('%s', async (_name, options, code) => {
    const r = rig(options);
    expect((await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm()))).code).toBe(code);
    expect(r.units).toEqual([]);
    expect(r.ruleCalls).toEqual([]);
    untouched(r);
  });

  it('a candidate of the caller\'s search is not found through another session', async () => {
    const r = rig();
    const other: ReaddressCaller = { principal: { ...OPERATOR.principal, sessionId: 'S-B' } };
    expect((await refusalOf(confirmCameraReaddress(r.seams, other, confirm()))).code).toBe(ReaddressRefusal.CANDIDATE_UNKNOWN);
    untouched(r);
  });
});

describe('the new address is held to the destination rule (AD-02), before the unit opens', () => {
  it.each([
    ['loopback', '127.0.0.1'],
    ['a public address', '8.8.8.8'],
    ['the host\'s own address', '192.168.50.1'],
    // R-FLEX (row 104): the subnet of another interface (10.20.0.0/16) is admitted now (RM-N1); a private address no interface holds is refused (NW-R1).
    ['a private address no interface holds', '172.16.9.9'],
    ['a private address outside the camera subnet', '192.168.51.20'],
    ['the broadcast address of the camera subnet', '192.168.50.255'],
    ['a link-local address', '169.254.10.10'],
  ])('%s is refused with the rule\'s own code; nothing is written', async (_name, address) => {
    const r = rig({ candidates: [moved({}, address)] });
    const refusal = await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm({ address })));
    expect(refusal.code).toBe(ReaddressRefusal.ADDRESS_NOT_ALLOWED);
    // The code is the real rule's refusal for that address, whatever its name.
    const decision = realRule(address, undefined);
    expect(decision.allowed).toBe(false);
    expect(refusal.rule).toBe(decision.allowed ? null : decision.refusal);
    expect(r.units).toEqual([]);
    expect(r.doorCalls).toEqual([]);
    untouched(r);
  });

  it('a port outside the stored list, a rule that throws and a rule that answers nonsense allow nothing', async () => {
    const port = rig({ candidates: [moved({}, '192.168.50.77', 'http://192.168.50.77:8899/onvif/device_service')] });
    expect((await refusalOf(confirmCameraReaddress(port.seams, OPERATOR, confirm({ address: '192.168.50.77:8899' })))).code).toBe(ReaddressRefusal.ADDRESS_NOT_ALLOWED);
    const throwing = rig({
      rule: () => {
        throw new Error('the interface list could not be read');
      },
    });
    expect(await refusalOf(confirmCameraReaddress(throwing.seams, OPERATOR, confirm()))).toEqual({ code: ReaddressRefusal.ADDRESS_NOT_ALLOWED, rule: 'RULE_FAILED' });
    for (const answer of [undefined, null, {}, { allowed: 'true' }, { allowed: 1 }, { allowed: false, refusal: 'lower case text with 192.168.50.77' }]) {
      const nonsense = rig({ rule: () => answer as unknown as ReturnType<ReaddressRule> });
      expect(await refusalOf(confirmCameraReaddress(nonsense.seams, OPERATOR, confirm()))).toEqual({ code: ReaddressRefusal.ADDRESS_NOT_ALLOWED, rule: 'RULE_FAILED' });
      untouched(nonsense);
    }
    untouched(port);
    untouched(throwing);
  });
});

describe('the state of the Core and of the registry', () => {
  it('a session is open: refused before the unit; a session that opened meanwhile: refused inside it', async () => {
    const open = rig({ sessionOpen: true });
    expect((await refusalOf(confirmCameraReaddress(open.seams, OPERATOR, confirm()))).code).toBe(ReaddressRefusal.CAPTURE_LOCKED);
    expect(open.units).toEqual([]);
    const meanwhile = rig({ sessionOpensInUnit: true });
    expect((await refusalOf(confirmCameraReaddress(meanwhile.seams, OPERATOR, confirm()))).code).toBe(ReaddressRefusal.CAPTURE_LOCKED);
    expect(meanwhile.units).toEqual([READDRESS_UNIT_LABEL]);
    expect(meanwhile.doorCalls).toEqual([]);
    untouched(open);
    untouched(meanwhile);
  });

  it('a seam that is not provided answers NOT_READY: the candidate state, the rule, the engine\'s door', async () => {
    for (const options of [{ noCandidates: true }, { rule: null }, { door: 'none' as const }]) {
      const r = rig(options);
      expect((await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm()))).code).toBe(ReaddressRefusal.NOT_READY);
      expect(r.units).toEqual([]);
      untouched(r);
    }
  });

  it.each([
    ['the device is not in the registry', [camera('CAM-02', '192.168.50.65')], ReaddressRefusal.DEVICE_UNKNOWN],
    ['the stored address already is the new one', [camera('CAM-01', '192.168.50.77')], ReaddressRefusal.ADDRESS_UNCHANGED],
    ['another device holds the new address', [camera('CAM-01', '192.168.50.64'), camera('CAM-02', '192.168.50.77')], ReaddressRefusal.ADDRESS_TAKEN],
    ['the stored address is a name, not an IP literal', [camera('CAM-01', 'camera-one.local')], ReaddressRefusal.STORED_ADDRESS_UNREADABLE],
  ])('%s: refused inside the unit, the door not reached, no entry', async (_name, devices, code) => {
    const r = rig({ devices });
    expect((await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm()))).code).toBe(code);
    expect(r.doorCalls).toEqual([]);
    expect(r.entries).toEqual([]);
    expect(r.devices()).toEqual(devices);
  });

  it('the door fails: the unit rolls back - no entry, the registry as it was', async () => {
    const r = rig({ door: 'throws' });
    await expect(confirmCameraReaddress(r.seams, OPERATOR, confirm())).rejects.toThrow('the registry refused the write');
    expect(r.doorCalls).toHaveLength(1);
    untouched(r);
  });

  it('a second confirmation of the same target after the first: the address is unchanged, still one entry', async () => {
    const r = rig();
    await confirmCameraReaddress(r.seams, OPERATOR, confirm());
    expect((await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm()))).code).toBe(ReaddressRefusal.ADDRESS_UNCHANGED);
    expect(r.entries).toHaveLength(1);
  });
});

// ── Row 197: what the route file gives the function (`readdress-route.ts`) ───────────────────────

describe('row 197: the destination rule on INJECTED network facts (fail-closed)', () => {
  const GOOD = '192.168.50.77';

  it('no reader, a reader that answers null, and a reader that throws each refuse an address the configured host admits', () => {
    let told = 0;
    const tell = (): void => {
      told += 1;
    };
    expect(readdressRuleOf(() => () => HOST, tell)(GOOD, undefined)).toMatchObject({ allowed: true });
    const absent = readdressRuleOf(() => null, tell)(GOOD, undefined);
    expect(absent).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
    expect(readdressRuleOf(() => () => null, tell)(GOOD, undefined)).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
    expect(told).toBe(0);
    const thrown = readdressRuleOf(
      () => () => {
        throw new Error('the interface listing failed at 192.168.50.1');
      },
      tell,
    )(GOOD, 80);
    expect(thrown).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
    expect(told).toBe(1);
    // R-FLEX (row 104; RM-N4, RF-N3): facts without a camera subnet, or without an address on the camera interface, are no longer a
    // refusal - STORED_CAMERA is judged on every interface. Facts that do not list the interfaces (NW-C1 left out) still admit nothing (RF-N7).
    expect(readdressRuleOf(() => () => ({ ...HOST, cameraSubnet: null }), tell)(GOOD, undefined).allowed).toBe(true);
    expect(readdressRuleOf(() => () => ({ ...HOST, cameraAddresses: [] }), tell)(GOOD, undefined).allowed).toBe(true);
    const { interfaceSubnets: _unlisted, ...unlisted } = HOST;
    expect(readdressRuleOf(() => () => unlisted, tell)(GOOD, undefined)).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
  });

  it('on the host\'s facts it is the rule of a stored camera: the same answers as the binding the function was built against, and the reader is asked at EVERY judgement', () => {
    let asked = 0;
    let facts: DestinationContext | null = HOST;
    const rule = readdressRuleOf(
      () => () => {
        asked += 1;
        return facts;
      },
      () => undefined,
    );
    for (const address of [GOOD, '127.0.0.1', '8.8.8.8', '192.168.50.1', '10.20.3.4', '192.168.60.77', '192.168.50.255', '169.254.10.10']) {
      const expected = realRule(address, undefined);
      const answered = rule(address, undefined);
      expect(answered.allowed, address).toBe(expected.allowed);
      if (!answered.allowed && !expected.allowed) expect(answered.refusal, address).toBe(expected.refusal);
    }
    expect(asked).toBe(8);
    // The facts go away (the interface lost its address): the next judgement refuses what the last admitted.
    facts = null;
    expect(rule(GOOD, undefined).allowed).toBe(false);
    expect(asked).toBe(9);
  });

  it('through the function: with no reader a confirmed re-address is refused ADDRESS_NOT_ALLOWED before the unit - nothing written, no entry', async () => {
    const r = rig({ rule: readdressRuleOf(() => null, () => undefined) });
    const refused = await refusalOf(confirmCameraReaddress(r.seams, OPERATOR, confirm()));
    expect([refused.code, refused.rule]).toEqual([ReaddressRefusal.ADDRESS_NOT_ALLOWED, 'NOT_CONFIGURED']);
    untouched(r);
    expect(r.doorCalls).toEqual([]);
  });
});

describe('row 197: the contract\'s answer of every refusal', () => {
  it('each code of `ReaddressRefusal` has its answer of operation 100; the six 409 reasons ARE the codes; `NOT_CONFIRMED` has none', () => {
    const answers = Object.fromEntries(
      Object.values(ReaddressRefusal).map((code) => {
        const answer = readdressRefusedAnswer(new ReaddressRefused(code, code === ReaddressRefusal.ADDRESS_NOT_ALLOWED ? 'OUTSIDE_CAMERA_SUBNET' : null));
        return [code, answer === null ? null : [answer.statusCode, answer.code, (answer.details as { reason?: string } | undefined)?.reason ?? null]];
      }),
    );
    expect(answers).toEqual({
      READDRESS_NOT_CONFIRMED: null,
      READDRESS_NOT_READY: [503, 'NOT_READY', 'DISCOVERY_NOT_READY'],
      READDRESS_CAPTURE_LOCKED: [409, 'CAPTURE_CONFIG_LOCKED', null],
      READDRESS_CANDIDATE_UNKNOWN: [404, 'NOT_FOUND', null],
      READDRESS_DEVICE_UNKNOWN: [404, 'NOT_FOUND', null],
      READDRESS_NOT_THE_REGISTERED_CAMERA: [409, 'INVALID_STATE', 'READDRESS_NOT_THE_REGISTERED_CAMERA'],
      READDRESS_IDENTITY_CONFLICT: [409, 'INVALID_STATE', 'READDRESS_IDENTITY_CONFLICT'],
      READDRESS_CONFIRMATION_MISMATCH: [409, 'INVALID_STATE', 'READDRESS_CONFIRMATION_MISMATCH'],
      READDRESS_ADDRESS_NOT_ALLOWED: [422, 'INVALID_INPUT', 'DISCOVERY_ADDRESS_NOT_ALLOWED'],
      READDRESS_ADDRESS_UNCHANGED: [409, 'INVALID_STATE', 'READDRESS_ADDRESS_UNCHANGED'],
      READDRESS_ADDRESS_TAKEN: [409, 'INVALID_STATE', 'READDRESS_ADDRESS_TAKEN'],
      READDRESS_STORED_ADDRESS_UNREADABLE: [409, 'INVALID_STATE', 'READDRESS_STORED_ADDRESS_UNREADABLE'],
    });
    // The contract's set of 409 reasons is exactly the six codes above.
    expect(Object.values(CaptureReaddressReason).sort()).toEqual(Object.values(answers).flatMap((answer) => (answer !== null && answer[1] === 'INVALID_STATE' ? [answer[2]] : [])).sort());
  });

  it('the sentences are the contract\'s; no answer carries an address, and the rule\'s own code never leaves the Core', () => {
    for (const reason of Object.values(CaptureReaddressReason)) {
      expect(readdressRefusedAnswer(new ReaddressRefused(reason))?.message).toBe(CAPTURE_READDRESS_REFUSAL_SENTENCES[reason]);
    }
    const ruled = readdressRefusedAnswer(new ReaddressRefused(ReaddressRefusal.ADDRESS_NOT_ALLOWED, 'OUTSIDE_CAMERA_SUBNET'));
    expect(ruled?.message).toBe(CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE);
    expect(ruled?.details).toEqual({ in: 'body', reason: 'DISCOVERY_ADDRESS_NOT_ALLOWED' });
    for (const code of Object.values(ReaddressRefusal)) {
      const answer = readdressRefusedAnswer(new ReaddressRefused(code, 'OUTSIDE_CAMERA_SUBNET'));
      const text = JSON.stringify([answer?.message, answer?.details ?? null]);
      expect(text, code).not.toMatch(/\d{1,3}(?:\.\d{1,3}){3}/);
      expect(text, code).not.toContain('OUTSIDE_CAMERA_SUBNET');
    }
  });

  it('the engine\'s door, as the seam takes it, is a function of the unit: a scope the host did not build is refused (the door is the engine\'s, not a statement)', async () => {
    await expect(engineDeviceReaddresser({} as EngineUnit, { deviceId: 'CAM-01', address: '192.168.50.77', at: 1 })).rejects.toMatchObject({ code: 'ENGINE_ACTION_NOT_HOSTED' });
  });
});

describe('the two address helpers', () => {
  it('the target of a candidate is what adoption stores: the host, or the host and the port of its service address', () => {
    expect(readdressTargetOf({ host: '192.168.50.77', serviceAddress: null })).toEqual({ address: '192.168.50.77', host: '192.168.50.77', port: undefined });
    expect(readdressTargetOf({ host: '192.168.50.77', serviceAddress: 'http://192.168.50.77/onvif/device_service' })).toEqual({ address: '192.168.50.77', host: '192.168.50.77', port: undefined });
    expect(readdressTargetOf({ host: '192.168.50.77', serviceAddress: 'http://192.168.50.77:8080/onvif/device_service' })).toEqual({ address: '192.168.50.77:8080', host: '192.168.50.77', port: 8080 });
    expect(readdressTargetOf({ host: '192.168.50.77', serviceAddress: 'not a locator' }).address).toBe('192.168.50.77');
  });

  it('the IP literal of a stored address; null for a name, a locator and a user part', () => {
    expect(storedHostLiteral('192.168.50.64')).toBe('192.168.50.64');
    expect(storedHostLiteral('192.168.50.64:8080')).toBe('192.168.50.64');
    for (const text of ['camera-one.local', 'http://192.168.50.64/', 'admin:secret@192.168.50.64', '']) expect(storedHostLiteral(text), text).toBeNull();
  });
});
