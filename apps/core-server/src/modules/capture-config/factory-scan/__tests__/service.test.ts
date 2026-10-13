// The commissioning scan, operation 103 (task 4 blueprint row 107, WP-19c; contract of row 102;
// decisions U9, U10, C19; S13-10, S13-11, S13-12 (b)).
//
// WHAT IS REAL: `scanFactoryCameras` of this folder; THE DESTINATION RULE of the capture unit
// (`decideDestination` with the purpose COMMISSIONING_SCAN - the binding the composition will hand
// in); in the last block the unauthenticated ONVIF time read of the capture unit
// (`createOnvifTimeReader`) against the fake ONVIF stub on 127.0.0.1, and the platform seam of the
// address helper (`hostAliasSocketTransportOf`) for the two "helper cannot be asked" refusals.
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the temporary address   a recording double with the shape of row 105's caller (`add` / `remove`
//                           answering `refusal` and `effect`). No helper exists on this Mac; no
//                           address of any host is read or changed. Row 106's lifecycle is in flight.
//   the host                a table of this file: the camera port with 192.168.50.1/24, an office
//                           network 10.20.0.0/16. The double puts the temporary address into that
//                           table when it answers "done" (and a case makes it NOT do so).
//   the camera's address    a factory address cannot exist on this Mac. In the stub block the probe of
//                           this file maps the address the rule admitted to the stub's loopback
//                           listener and dials from 127.0.0.1; the rule itself never saw loopback.
//   the device's text       the time read returns NO text by construction, so the hostile texts are
//                           handed to the scan by the probe of this file, beside the real read.
import { CameraFactoryScanSchema } from '@dems/shared/api';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_ONVIF_HOST, FAKE_ONVIF_MARKUP_TEXT, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import { createSystemTimers } from '../../../../capture';
import { createOnvifTimeReader } from '../../../../capture/adapters/camera/onvif-session';
import { CaptureAdapterKind } from '../../../../capture/adapters/kinds';
import type { CameraCandidate } from '../../../../capture/adapters/types';
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../../capture/destination-rule';
import type { AuditEntry } from '../../../../core';
import { hostAliasSocketTransportOf } from '../../../../host-alias-socket';
import { ApiFailure } from '../../../../plugins/error-envelope';
import {
  FACTORY_SCAN_MIN_INTERVAL_MS,
  FACTORY_SCAN_PARALLEL_PROBES,
  announcedTextOf,
  createFactoryScanGate,
  scanFactoryCameras,
  type FactoryScanAliasOutcome,
  type FactoryScanDestination,
  type FactoryScanGate,
  type FactoryScanParts,
  type FactoryScanProbe,
  type FactoryScanProbeAnswer,
  type FactoryScanRule,
  type FactoryScanSeams,
  type FactoryScanSettings,
} from '../service';

const CALLER = { operatorId: 'OPR-003', deviceId: null };
// Invisible characters by their number: none of them stands in this file as itself.
const RLO = String.fromCodePoint(0x202e);
const ZWSP = String.fromCodePoint(0x200b);
const BOM = String.fromCodePoint(0xfeff);
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const OWN = '192.168.50.1';
/** THE RULE as the composition binds it: the capture unit's one function, the purpose of a commissioning scan. */
const RULE: FactoryScanRule = (address, facts) => decideDestination({ purpose: DestinationPurpose.COMMISSIONING_SCAN, address }, facts);
const DONE: FactoryScanAliasOutcome = { refusal: null, effect: 'DONE' };
const SETTINGS: FactoryScanSettings = { configured: true, factoryAddresses: ['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.50.20'], aliasHost: 253, aliasMinutes: 30 };
const ANSWERS: FactoryScanProbeAnswer = { answered: true, onvifReachable: true };
const SILENT: FactoryScanProbeAnswer = { answered: false, onvifReachable: false };

interface RigOptions {
  readonly sessionOpen?: () => boolean;
  readonly available?: boolean;
  readonly noParts?: boolean;
  readonly helper?: () => Promise<string | null>;
  readonly settings?: Partial<FactoryScanSettings>;
  /** The facts of the host: `undefined` = the table of this file; a function is asked instead. */
  readonly facts?: () => DestinationContext | null;
  readonly add?: (address: string) => FactoryScanAliasOutcome | Promise<FactoryScanAliasOutcome>;
  readonly remove?: (address: string) => FactoryScanAliasOutcome | Promise<FactoryScanAliasOutcome>;
  /** What the host states on its camera port after an `add` that answered "done". Default: the address asked for. */
  readonly hostShowsAfterAdd?: (asked: string) => string | null;
  /** A temporary address that is on the camera port before the scan. */
  readonly leftover?: string;
  readonly probe?: FactoryScanProbe;
  readonly gate?: FactoryScanGate;
  readonly after?: (delayMs: number, callback: () => void) => () => void;
  /** Row 106b: the lifecycle's own state, as the alias port hands it on. Left out: the port has no such member. */
  readonly state?: () => Promise<unknown>;
}

function rigOf(options: RigOptions = {}) {
  let onPort: string | null = options.leftover ?? null;
  let now = 1_800_000_000_000;
  const calls: string[] = [];
  const audits: AuditEntry[] = [];
  const notes: { fields: Record<string, unknown>; message: string }[] = [];
  const failures: { source: string; message: string; code: string; context: Record<string, unknown> }[] = [];
  const table = (): DestinationContext => ({
    cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
    cameraAddresses: [{ address: OWN, alias: false }, ...(onPort === null ? [] : [{ address: onPort, alias: true }])],
    otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 16 }],
    hostAddresses: ['127.0.0.1', '10.20.0.15', OWN, ...(onPort === null ? [] : [onPort])],
  });
  const parts: FactoryScanParts = {
    rule: RULE,
    alias: {
      helper: options.helper ?? (async () => null),
      async add(request) {
        calls.push(`add ${request.address} ${String(request.minutes)} ${request.subject.reason}`);
        const outcome = await (options.add ?? (() => DONE))(request.address);
        if (outcome.refusal === null && outcome.effect === 'DONE') onPort = options.hostShowsAfterAdd === undefined ? request.address : options.hostShowsAfterAdd(request.address);
        return outcome;
      },
      async remove(request) {
        calls.push(`remove ${request.address}`);
        const outcome = await (options.remove ?? (() => DONE))(request.address);
        if (outcome.refusal === null && outcome.effect === 'DONE') onPort = null;
        return outcome;
      },
      ...(options.state === undefined
        ? {}
        : {
            state: async () => {
              calls.push('state');
              return options.state?.();
            },
          }),
    },
    async probe(destination, signal) {
      calls.push(`probe ${destination.address}:${String(destination.port)} from ${destination.sourceAddress}`);
      return (options.probe ?? (async () => SILENT))(destination, signal);
    },
  };
  const seams: FactoryScanSeams = {
    host: {
      now: () => now,
      sessionOpen: options.sessionOpen ?? (() => false),
      settings: async () => ({ ...SETTINGS, ...options.settings }),
      facts: options.facts ?? table,
      async audit(entry) {
        calls.push('audit');
        audits.push(entry);
      },
      after: options.after ?? (() => () => undefined),
      note: (fields, message) => notes.push({ fields, message }),
      failed: (source, message, code, context) => failures.push({ source, message, code, context }),
    },
    gate: options.gate ?? createFactoryScanGate(),
    available: () => options.available ?? true,
    parts: () => (options.noParts === true ? null : parts),
  };
  return {
    seams,
    calls,
    audits,
    notes,
    failures,
    advance: (ms: number): void => void (now += ms),
    onPort: (): string | null => onPort,
    scan: (body?: { address?: string }) => scanFactoryCameras(seams, CALLER, body),
    /** Everything that left the scan but its answer: the log lines, the persisted failures, the audit entries. */
    written: (): string => JSON.stringify({ notes, failures, audits }),
  };
}

/** `[status, code, reason, cause]` of a refusal, and its whole text for a search. */
async function refusalOf(attempt: Promise<unknown>): Promise<{ readonly answer: [number, string, unknown, unknown]; readonly text: string; readonly failure: ApiFailure }> {
  const failure = await attempt.then(
    () => null,
    (error: unknown) => error,
  );
  if (!(failure instanceof ApiFailure)) throw new Error(`expected a refusal, got ${failure === null ? 'an answer' : String(failure)}`);
  return { answer: [failure.statusCode, failure.code, failure.details?.['reason'] ?? null, failure.details?.['cause'] ?? null], text: JSON.stringify({ message: failure.message, details: failure.details, stack: failure.stack }), failure };
}
const probesOf = (calls: readonly string[]): string[] => calls.filter((call) => call.startsWith('probe '));
const aliasCallsOf = (calls: readonly string[]): string[] => calls.filter((call) => call.startsWith('add ') || call.startsWith('remove '));

describe('every refusal comes BEFORE anything is asked: 0 probes, 0 calls of the temporary address, 0 audit entries', () => {
  const refusals: readonly [title: string, options: RigOptions, body: { address?: string } | undefined, expected: [number, string, unknown, unknown]][] = [
    ['a session is open', { sessionOpen: () => true }, undefined, [409, 'CAPTURE_CONFIG_LOCKED', null, null]],
    ['this Core is not in production capture', { available: false }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE', null]],
    ['the composition handed no parts in', { noParts: true }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE', null]],
    ['macOS: the PRODUCT seam of the helper answers "not available on this platform"', { helper: () => hostAliasSocketTransportOf({ platform: 'darwin', socketPath: '/run/dems-core-netalias/socket' }).preflight() }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE', null]],
    ['Linux without a socket path: the PRODUCT seam answers "not configured"', { helper: () => hostAliasSocketTransportOf({ platform: 'linux', socketPath: null }).preflight() }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_HELPER_NOT_CONFIGURED', null]],
    ['the helper\'s socket is not as installed', { helper: async () => 'SOCKET_OWNER_OR_MODE' }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_HELPER_NOT_CONFIGURED', null]],
    ['no interface or subnet is chosen', { settings: { configured: false } }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED', null]],
    ['the host has no such interface (the reader answers null)', { facts: () => null }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED', null]],
    ['a stored list above the bound', { settings: { factoryAddresses: Array.from({ length: 33 }, (_unused, index) => `192.168.1.${String(index + 1)}`) } }, undefined, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED', null]],
  ];
  it.each(refusals)('%s', async (_title, options, body, expected) => {
    const rig = rigOf({ ...options, probe: async () => ANSWERS });
    expect((await refusalOf(rig.scan(body))).answer).toEqual(expected);
    expect([probesOf(rig.calls), aliasCallsOf(rig.calls), rig.audits]).toEqual([[], [], []]);
    expect(rig.seams.gate.busy()).toBe(false);
  });

  it('a helper check that throws, and host facts that cannot be read: NOT_AVAILABLE, one persisted failure each - a code, no text of what was thrown', async () => {
    const thrown = `cnry${randomUUID()}`;
    const helper = rigOf({ helper: async () => Promise.reject(new Error(thrown)) });
    expect((await refusalOf(helper.scan())).answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE', null]);
    const facts = rigOf({
      facts: () => {
        throw new Error(thrown);
      },
    });
    expect((await refusalOf(facts.scan())).answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE', null]);
    expect([helper.failures.map((entry) => entry.code), facts.failures.map((entry) => entry.code)]).toEqual([['COMMISSIONING_SCAN_HELPER_NOT_ASKED'], ['COMMISSIONING_SCAN_HOST_FACTS_UNREADABLE']]);
    for (const rig of [helper, facts]) {
      expect([rig.calls, rig.audits]).toEqual([[], []]);
      expect(rig.written()).not.toContain(thrown);
    }
  });

  // The typed address through THE rule (S13-11): every text the service could be handed, the schema's own refusals included.
  const REFUSED_TYPED = [
    '127.0.0.1', '0.0.0.0', '169.254.1.5', '224.0.0.251', '255.255.255.255', '8.8.8.8', '100.64.0.1',
    '10.20.0.99', // inside the office network of another interface (DR-4)
    OWN, // the Core's own address
    '192.168.1.253', // the temporary address itself
    '192.168.1.0', '192.168.1.255',
    '192.168.01.64', '0xc0.0xa8.1.64', '3232235840', '192.168.1', '192.168.1.64.1', '192.168.1.64:80', '192.168.1.64/24', ' 192.168.1.64',
    'camera.local', 'localhost', '::1', '::ffff:192.168.1.64', '[fe80::1]', '',
  ];
  it.each(REFUSED_TYPED)('a typed address the rule refuses (%j): 422 COMMISSIONING_ADDRESS_NOT_ALLOWED, the address in no part of the refusal, the spacing not used up', async (address) => {
    const rig = rigOf({ probe: async () => ANSWERS });
    const refusal = await refusalOf(rig.scan({ address }));
    expect(refusal.answer).toEqual([422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED', null]);
    if (address.trim().length > 3) expect(refusal.text).not.toContain(address);
    expect([rig.calls, rig.audits, rig.notes, rig.failures]).toEqual([[], [], [], []]);
    // The refused request took no place in the spacing: the next scan starts at once.
    expect((await rig.scan()).addressCount).toBe(4);
  });

  it('one scan at a time per Core: a second request while the first waits for a probe is 409 COMMISSIONING_JOB_IN_PROGRESS and asks nothing', async () => {
    let answer: (value: FactoryScanProbeAnswer) => void = () => undefined;
    const waiting = new Promise<FactoryScanProbeAnswer>((resolve) => (answer = resolve));
    const rig = rigOf({ settings: { factoryAddresses: ['192.168.50.20'] }, probe: () => waiting });
    const first = rig.scan();
    await new Promise((resolve) => setImmediate(resolve));
    const during = [...rig.calls];
    expect((await refusalOf(rig.scan())).answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_JOB_IN_PROGRESS', null]);
    expect(rig.calls).toEqual(during);
    answer(ANSWERS);
    expect((await first).devices.map((device) => device.address)).toEqual(['192.168.50.20']);
    expect(rig.seams.gate.busy()).toBe(false);
  });

  it('the spacing: a scan sooner than 10 s after the last one is 429 with retry-after and asks nothing; at the bound it runs; a clock that went back is refused', async () => {
    const rig = rigOf({ settings: { factoryAddresses: ['192.168.50.20'] } });
    await rig.scan();
    const after = [...rig.calls];
    rig.advance(FACTORY_SCAN_MIN_INTERVAL_MS - 2_500);
    const soon = await refusalOf(rig.scan());
    expect(soon.answer).toEqual([429, 'RATE_LIMITED', 'COMMISSIONING_SCAN_RATE_LIMITED', null]);
    expect([soon.failure.details?.['retryInMs'], soon.failure.headers]).toEqual([2_500, { 'retry-after': '3' }]);
    rig.advance(-60_000);
    expect((await refusalOf(rig.scan())).failure.details?.['retryInMs']).toBe(FACTORY_SCAN_MIN_INTERVAL_MS);
    expect(rig.calls).toEqual(after);
    rig.advance(60_000 + 2_500);
    await rig.scan();
    expect(probesOf(rig.calls)).toHaveLength(2);
  });

  it('a session that opens after the judgement and before the first step: 409 CAPTURE_CONFIG_LOCKED, nothing asked', async () => {
    let asked = 0;
    const rig = rigOf({ sessionOpen: () => (asked += 1) > 1 });
    expect((await refusalOf(rig.scan())).answer).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null, null]);
    expect([rig.calls, rig.audits]).toEqual([[], []]);
  });
});

describe('the scan: the stored list plus one typed address, each /24 from its own temporary address, the result in memory only', () => {
  it('the order of everything it does; the answer; ONE audit entry of counts', async () => {
    const answering = new Set(['192.168.1.108', '192.168.50.20', '192.168.7.9']);
    const rig = rigOf({ probe: async (destination) => (answering.has(destination.address) ? ANSWERS : SILENT) });
    const answer = await rig.scan({ address: '192.168.7.9' });
    expect(rig.calls).toEqual([
      // one temporary address at a time (C19): added, used, taken away - then the next
      'add 192.168.1.253 30 FACTORY_SCAN',
      'probe 192.168.1.64:80 from 192.168.1.253',
      'probe 192.168.1.108:80 from 192.168.1.253',
      'remove 192.168.1.253',
      'add 192.168.0.253 30 FACTORY_SCAN',
      'probe 192.168.0.90:80 from 192.168.0.253',
      'remove 192.168.0.253',
      'add 192.168.7.253 30 FACTORY_SCAN',
      'probe 192.168.7.9:80 from 192.168.7.253',
      'remove 192.168.7.253',
      // inside the camera subnet: from the camera port's own address, no temporary address
      'probe 192.168.50.20:80 from 192.168.50.1',
      'audit',
    ]);
    expect(CameraFactoryScanSchema.parse(answer)).toEqual(answer);
    expect(answer).toEqual({
      scannedAt: 1_800_000_000_000,
      addressCount: 5,
      // the stored list's order, the typed address last
      devices: ['192.168.1.108', '192.168.50.20', '192.168.7.9'].map((address) => ({ address, mac: null, onvifReachable: true, endpointCount: null, deviceCount: 'NOT_KNOWN', vendor: null, model: null, name: null, registeredDeviceId: null })),
      alias: null,
      synthetic: false,
    });
    expect(rig.onPort()).toBeNull();
    expect(rig.audits).toEqual([
      { type: 'CAMERA_FACTORY_SCANNED', message: 'Factory addresses scanned for cameras', actorId: 'OPR-003', deviceId: null, details: { outcome: 'COMPLETE', addressCount: 5, responderCount: 3, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } },
    ]);
    // No address in the log, the error log or the audit entry.
    expect(rig.written()).not.toMatch(/192\.168|10\.20/);
    expect(rig.failures).toEqual([]);
  });

  it('a STORED address the rule refuses is not asked and not counted; the typed address that is also stored is asked once; nothing to scan is an empty answer', async () => {
    const rig = rigOf({ settings: { factoryAddresses: ['10.20.0.5', '192.168.1.64', '192.168.1.253', '192.168.1.64', 'camera.local'] }, probe: async () => ANSWERS });
    const answer = await rig.scan({ address: '192.168.1.64' });
    expect(probesOf(rig.calls)).toEqual(['probe 192.168.1.64:80 from 192.168.1.253']);
    expect([answer.addressCount, answer.devices.map((device) => device.address)]).toEqual([1, ['192.168.1.64']]);
    expect(rig.notes.map((note) => note.fields['refusedCount'])).toEqual([3]);

    const empty = rigOf({ settings: { factoryAddresses: [] } });
    expect(await empty.scan()).toMatchObject({ addressCount: 0, devices: [], alias: null });
    expect(empty.calls).toEqual(['audit']);
  });

  // Task 4 row 106b (decision C78 DD-3): the member `alias` of the answer is THE LIFECYCLE'S OWN STATE, asked once when the
  // scan ends - not this file's guess that "what was added is gone".
  it('`alias` of the answer is what the lifecycle states, asked ONCE after the scan\'s own entry: none, or the address still on the camera port; anything that is no alias of the contract\'s form, and a state that cannot be read, is null', async () => {
    const ONE = { settings: { factoryAddresses: ['192.168.1.64'] } };
    const none = rigOf({ ...ONE, state: async () => null });
    expect((await none.scan()).alias).toBeNull();
    expect(none.calls).toEqual(['add 192.168.1.253 30 FACTORY_SCAN', 'probe 192.168.1.64:80 from 192.168.1.253', 'remove 192.168.1.253', 'audit', 'state']);

    // A removal that was not confirmed: the lifecycle still holds the row, with the code of the removal that failed.
    const LEFT = { aliasId: '00000000-0000-4000-8000-0000000000a1', address: '192.168.1.253', reason: 'FACTORY_SCAN', addedAt: 1_800_000_000_000, expiresAt: 1_800_001_800_000, removeError: 'HELPER_CONNECTION_LOST' };
    const left = rigOf({ ...ONE, remove: () => ({ refusal: 'HELPER_CONNECTION_LOST', effect: 'UNKNOWN' }), state: async () => LEFT });
    const answer = await left.scan();
    expect(answer.alias).toEqual(LEFT);
    expect(CameraFactoryScanSchema.parse(answer)).toEqual(answer);
    expect(left.failures.map((failure) => failure.code)).toEqual(['COMMISSIONING_SCAN_ALIAS_REMOVAL_NOT_CONFIRMED']);
    // The address of the answer is in no log line, no persisted failure and no audit entry.
    expect(left.written()).not.toMatch(/192\.168/);

    for (const stated of [{ ...LEFT, address: '8.8.8.8' }, { ...LEFT, removeError: 'the helper said: eth9' }, { ...LEFT, interfaceName: 'eth1' }, 'an alias', 7, undefined]) {
      expect((await rigOf({ ...ONE, state: async () => stated }).scan()).alias, JSON.stringify(stated)).toBeNull();
    }
    expect((await rigOf({ ...ONE, state: async () => Promise.reject(new Error('eth9 hunter2')) }).scan()).alias).toBeNull();
    // A scan that is refused or fails answers no `alias` at all, and does not ask the state.
    const refused = rigOf({ ...ONE, add: () => ({ refusal: 'HELPER_ADDRESS_IN_USE', effect: 'NOT_DONE' }), state: async () => LEFT });
    expect((await refusalOf(refused.scan())).answer).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED', 'HELPER_ADDRESS_IN_USE']);
    expect(refused.calls).toEqual(['add 192.168.1.253 30 FACTORY_SCAN', 'audit']);
  });

  it(`at most ${String(FACTORY_SCAN_PARALLEL_PROBES)} addresses are asked at the same time, each under its own deadline, which is cancelled when the address answered`, async () => {
    let open = 0;
    let most = 0;
    const deadlines: number[] = [];
    let cancelled = 0;
    const rig = rigOf({
      settings: { factoryAddresses: Array.from({ length: 32 }, (_unused, index) => `192.168.50.${String(index + 10)}`) },
      after: (delayMs) => {
        deadlines.push(delayMs);
        return () => void (cancelled += 1);
      },
      probe: async () => {
        open += 1;
        most = Math.max(most, open);
        await new Promise((resolve) => setImmediate(resolve));
        open -= 1;
        return ANSWERS;
      },
    });
    const answer = await rig.scan();
    expect([answer.addressCount, answer.devices.length, most, cancelled]).toEqual([32, 32, FACTORY_SCAN_PARALLEL_PROBES, 32]);
    expect(new Set(deadlines)).toEqual(new Set([2_000]));
  });

  it('a probe that does not answer under its deadline: the signal is aborted and the address is not listed', async () => {
    const fire: (() => void)[] = [];
    const rig = rigOf({
      settings: { factoryAddresses: ['192.168.50.20'] },
      after: (_delayMs, callback) => {
        fire.push(callback);
        return () => undefined;
      },
      probe: (_destination, signal) => new Promise((resolve) => signal.addEventListener('abort', () => resolve(SILENT))),
    });
    const pending = rig.scan();
    await new Promise((resolve) => setImmediate(resolve));
    fire.forEach((callback) => callback());
    expect(await pending).toMatchObject({ addressCount: 1, devices: [] });
  });

  it('more than one device at one address is the conflict flag (DR-6); the hardware address is the neighbour table\'s, only in its closed form', async () => {
    const rig = rigOf({ settings: { factoryAddresses: ['192.168.50.20', '192.168.50.21', '192.168.50.22'] }, probe: async (destination) => ({ ...ANSWERS, endpointCount: destination.address.endsWith('.20') ? 2 : destination.address.endsWith('.21') ? 9_999 : 'x' }) });
    const table: Record<string, string> = { '192.168.50.20': 'AA:BB:CC:00:11:22', '192.168.50.21': 'aa:bb:cc:00:11:22 <b>' };
    const withMac: FactoryScanSeams = { ...rig.seams, parts: () => ({ ...rig.seams.parts()!, mac: (address) => (address.endsWith('.22') ? (() => { throw new Error('unreadable'); })() : (table[address] ?? null)) }) };
    const answer = await scanFactoryCameras(withMac, CALLER, undefined);
    // Row V6 (R119-03): a count that is no whole number from 1 is NOT COUNTED - `NOT_KNOWN`, never one.
    expect(answer.devices.map((device) => [device.endpointCount, device.deviceCount, device.mac])).toEqual([[2, 'MORE_THAN_ONE', 'AA:BB:CC:00:11:22'], [16, 'MORE_THAN_ONE', null], [null, 'NOT_KNOWN', null]]);
    // THE THREE STATES, and what is never read as "one": a probe that did not count (the member left out - the PRODUCT's
    // probe today), zero, a fraction, a negative number, a text. ONE only for a probe that counted exactly one.
    const counted = rigOf({
      settings: { factoryAddresses: ['192.168.50.20', '192.168.50.21', '192.168.50.22', '192.168.50.23', '192.168.50.24', '192.168.50.25'] },
      probe: async (destination) => ({ ...ANSWERS, ...({ '.20': {}, '.21': { endpointCount: 1 }, '.22': { endpointCount: 0 }, '.23': { endpointCount: 1.5 }, '.24': { endpointCount: -1 }, '.25': { endpointCount: '1' } }[destination.address.slice(-3)]) }),
    });
    const states = await counted.scan();
    expect(states.devices.map((device) => [device.endpointCount, device.deviceCount])).toEqual([[null, 'NOT_KNOWN'], [1, 'ONE'], [null, 'NOT_KNOWN'], [null, 'NOT_KNOWN'], [null, 'NOT_KNOWN'], [null, 'NOT_KNOWN']]);
    expect(CameraFactoryScanSchema.parse(states)).toEqual(states);
    expect(JSON.stringify(states)).not.toContain('"conflict"');
    expect(CameraFactoryScanSchema.parse(answer)).toEqual(answer);
  });
});

describe('the temporary address: nothing is dialled unless it was confirmed in place, and its removal is ALWAYS asked', () => {
  const ONE = { settings: { factoryAddresses: ['192.168.1.64', '192.168.50.20'] }, probe: async () => ANSWERS } satisfies RigOptions;
  const notConfirmed: readonly [title: string, options: RigOptions, cause: string][] = [
    ['the helper refuses (one address exists already)', { add: () => ({ refusal: 'HELPER_ALIAS_LIMIT_REACHED', effect: 'NOT_DONE' }) }, 'HELPER_ALIAS_LIMIT_REACHED'],
    ['the wrong-network guard refuses', { add: () => ({ refusal: 'OTHER_INTERFACE_HOLDS_SUBNET', effect: 'NOT_DONE' }) }, 'OTHER_INTERFACE_HOLDS_SUBNET'],
    ['the helper timed out: possibly in place', { add: () => ({ refusal: 'HELPER_TIMED_OUT', effect: 'UNKNOWN' }) }, 'HELPER_TIMED_OUT'],
    ['"done" is not said although no refusal is named', { add: () => ({ refusal: null, effect: 'UNKNOWN' }) }, 'ALIAS_NOT_CONFIRMED'],
    ['a refusal that is no word of a closed set is not handed on', { add: () => ({ refusal: 'eth1: <b>RTNETLINK</b> answers', effect: 'UNKNOWN' }) }, 'ALIAS_NOT_CONFIRMED'],
    ['`add` throws', { add: () => Promise.reject(new Error('socket lost')) }, 'ALIAS_CALL_FAILED'],
    ['`add` answers what is no outcome', { add: () => null as unknown as FactoryScanAliasOutcome }, 'ALIAS_CALL_FAILED'],
    ['the helper says "done" and the host does not state the address', { hostShowsAfterAdd: () => null }, 'ALIAS_NOT_IN_PLACE'],
    ['the helper says "done" and the host states ANOTHER address on the camera port', { hostShowsAfterAdd: () => '192.168.1.200' }, 'ALIAS_NOT_IN_PLACE'],
  ];
  it.each(notConfirmed)('%s: 409 HOST_ALIAS_FAILED, 0 probes (the camera subnet included), the audit entry FAILED; the removal asked unless `add` answered that it certainly changed nothing', async (_title, options, cause) => {
    const rig = rigOf({ ...ONE, ...options });
    expect((await refusalOf(rig.scan())).answer).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED', cause]);
    // The two NOT_DONE rows of the table: nothing of this scan is on the camera port, so nothing is asked away.
    const certainlyNothing = ['HELPER_ALIAS_LIMIT_REACHED', 'OTHER_INTERFACE_HOLDS_SUBNET'].includes(cause);
    expect(rig.calls).toEqual(['add 192.168.1.253 30 FACTORY_SCAN', ...(certainlyNothing ? [] : ['remove 192.168.1.253']), 'audit']);
    expect(rig.audits.map((entry) => entry.details)).toEqual([{ outcome: 'FAILED', addressCount: 0, responderCount: 0, failureReason: 'HOST_ALIAS_FAILED', operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' }]);
    expect(rig.failures.map((entry) => [entry.code, entry.context])).toEqual([['COMMISSIONING_SCAN_ALIAS_NOT_CONFIRMED', { aliasWord: cause }]]);
    expect(rig.written()).not.toMatch(/192\.168|RTNETLINK|socket lost/);
  });

  it('a temporary address that is ALREADY on the camera port and was not added by this scan is never a source', async () => {
    const rig = rigOf({ ...ONE, leftover: '192.168.1.253', add: () => ({ refusal: 'HELPER_ALIAS_LIMIT_REACHED', effect: 'NOT_DONE' }) });
    expect((await refusalOf(rig.scan())).answer).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED', 'HELPER_ALIAS_LIMIT_REACHED']);
    expect(probesOf(rig.calls)).toEqual([]);
    // ... and it is NOT taken away by this scan: it is another operation's (a set-network job, or the operator's to remove with operation 105).
    expect(aliasCallsOf(rig.calls)).toEqual(['add 192.168.1.253 30 FACTORY_SCAN']);
    expect(rig.onPort()).toBe('192.168.1.253');
    expect(rig.failures.map((entry) => entry.code)).toEqual(['COMMISSIONING_SCAN_ALIAS_NOT_CONFIRMED']);
  });

  it('a second group whose address is not confirmed ends the scan: the first group was asked and counted, nothing after it, both removals asked', async () => {
    const rig = rigOf({ probe: async () => ANSWERS, add: (address) => (address === '192.168.0.253' ? { refusal: 'HELPER_CONFLICT_PROBE_FAILED', effect: 'UNKNOWN' } : DONE) });
    expect((await refusalOf(rig.scan())).answer).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED', 'HELPER_CONFLICT_PROBE_FAILED']);
    expect(rig.calls).toEqual(['add 192.168.1.253 30 FACTORY_SCAN', 'probe 192.168.1.64:80 from 192.168.1.253', 'probe 192.168.1.108:80 from 192.168.1.253', 'remove 192.168.1.253', 'add 192.168.0.253 30 FACTORY_SCAN', 'remove 192.168.0.253', 'audit']);
    expect(rig.audits[0]?.details).toMatchObject({ outcome: 'FAILED', addressCount: 2, responderCount: 2 });
  });

  it('a probe that THROWS: the removal is asked, the address is not listed, the others are, and what was thrown is in no log, error or audit entry', async () => {
    const thrown = `${FAKE_ONVIF_MARKUP_TEXT} cnry${randomUUID()}`;
    const rig = rigOf({
      probe: async (destination) => {
        if (destination.address === '192.168.1.64') throw Object.assign(new Error(thrown), { code: thrown, cause: thrown });
        return ANSWERS;
      },
    });
    const answer = await rig.scan();
    expect(answer.devices.map((device) => device.address)).toEqual(['192.168.1.108', '192.168.0.90', '192.168.50.20']);
    expect(aliasCallsOf(rig.calls)).toEqual(['add 192.168.1.253 30 FACTORY_SCAN', 'remove 192.168.1.253', 'add 192.168.0.253 30 FACTORY_SCAN', 'remove 192.168.0.253']);
    expect(rig.onPort()).toBeNull();
    expect(rig.failures).toEqual([{ source: 'captureFactoryScan.probe', message: expect.stringContaining('probe'), code: 'COMMISSIONING_SCAN_PROBE_FAILED', context: { probeFailures: 1 } }]);
    for (const part of [thrown, 'script', 'jndi', 'cnry']) expect(rig.written()).not.toContain(part);
  });

  it('a session that opens while a group is asked: its removal is asked, nothing further is dialled, 409 CAPTURE_CONFIG_LOCKED with one FAILED entry', async () => {
    let open = false;
    const rig = rigOf({ sessionOpen: () => open, probe: async () => ((open = true), ANSWERS) });
    expect((await refusalOf(rig.scan())).answer).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null, null]);
    expect(rig.calls).toEqual(['add 192.168.1.253 30 FACTORY_SCAN', 'probe 192.168.1.64:80 from 192.168.1.253', 'probe 192.168.1.108:80 from 192.168.1.253', 'remove 192.168.1.253', 'audit']);
    expect(rig.audits[0]?.details).toMatchObject({ outcome: 'FAILED', failureReason: 'CAPTURE_CONFIG_LOCKED', addressCount: 2 });
  });

  it('a removal that is not confirmed (refused, unknown, thrown): the scan\'s answer stands and ONE failure is persisted per address, by code', async () => {
    for (const remove of [() => ({ refusal: 'HELPER_DEL_FAILED', effect: 'UNKNOWN' }), () => ({ refusal: null, effect: 'NOT_DONE' }), () => Promise.reject(new Error('lost'))] as const) {
      const rig = rigOf({ ...ONE, remove });
      expect((await rig.scan()).devices).toHaveLength(2);
      expect(rig.failures.map((entry) => entry.code)).toEqual(['COMMISSIONING_SCAN_ALIAS_REMOVAL_NOT_CONFIRMED']);
      expect(rig.notes[0]?.fields).toMatchObject({ removalsNotConfirmed: 1, outcome: 'COMPLETE' });
    }
  });

  it('an audit entry that cannot be written: the scan answers nothing (the result is not handed out unrecorded), and the temporary address was taken away before', async () => {
    const rig = rigOf({ ...ONE });
    const failing: FactoryScanSeams = { ...rig.seams, host: { ...rig.seams.host, audit: () => Promise.reject(new Error('chain locked')) } };
    await expect(scanFactoryCameras(failing, CALLER, undefined)).rejects.toThrow('chain locked');
    expect(aliasCallsOf(rig.calls)).toEqual(['add 192.168.1.253 30 FACTORY_SCAN', 'remove 192.168.1.253']);
    expect(rig.seams.gate.busy()).toBe(false);
  });
});

describe('device text (S13-12 (b)): bounded and cleaned before it leaves; in the answer only', () => {
  it('the text rule', () => {
    expect(announcedTextOf('  IPC-HFW \t 2431 \r\n ')).toBe('IPC-HFW 2431');
    expect(announcedTextOf(`a\u0000b\u001b[31mc\u007fd\u0085e${RLO}f${ZWSP}g${BOM}h${LINE_SEPARATOR}i`)).toBe('ab[31mcdefghi');
    expect(announcedTextOf(FAKE_ONVIF_MARKUP_TEXT)).toBe(FAKE_ONVIF_MARKUP_TEXT);
    expect(announcedTextOf('A'.repeat(50_000))).toBe('A'.repeat(120));
    expect(announcedTextOf(`${'😀'.repeat(200)}`)?.length).toBeLessThanOrEqual(120);
    expect(announcedTextOf(`ab\ud800cd\udc00`)).toBe('abcd');
    for (const nothing of ['', ' \t\n', '\u0000\u0001', null, undefined, 7, {}, ['x'], Symbol('x')]) expect(announcedTextOf(nothing)).toBeNull();
  });

  it('oversized, control-character and markup text of a found camera: cleaned in the answer, and in NO log line, persisted failure, audit detail or refusal', async () => {
    const canary = `cnry${randomUUID().replaceAll('-', '')}`;
    const hostile = { vendor: `${canary}\u0000\u001b[2J${'V'.repeat(8_000)}`, model: `${FAKE_ONVIF_MARKUP_TEXT}\r\n${canary}`, name: `${RLO}${canary}${LINE_SEPARATOR}line` };
    const rig = rigOf({ probe: async () => ({ ...ANSWERS, ...hostile }) });
    const answer = await rig.scan({ address: '192.168.7.9' });
    expect(CameraFactoryScanSchema.parse(answer)).toEqual(answer);
    for (const device of answer.devices) {
      expect([device.vendor?.length, device.model, device.name]).toEqual([120, `${FAKE_ONVIF_MARKUP_TEXT} ${canary}`, `${canary}line`]);
      // No control character survived.
      expect(`${String(device.vendor)}${String(device.model)}${String(device.name)}`).not.toMatch(new RegExp(`[\\u0000-\\u001f\\u007f-\\u009f${LINE_SEPARATOR}${RLO}]`));
    }
    for (const part of [canary, 'script', 'jndi', '{{7*7}}', 'VVVV']) expect(rig.written()).not.toContain(part);

    // The same camera in a scan that is REFUSED afterwards (a later group's address not confirmed): the refusal holds none of it either.
    const refused = rigOf({ probe: async () => ({ ...ANSWERS, ...hostile }), add: (address) => (address === '192.168.0.253' ? { refusal: 'HELPER_ADD_FAILED', effect: 'UNKNOWN' } : DONE) });
    const refusal = await refusalOf(refused.scan());
    expect(refusal.answer).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED', 'HELPER_ADD_FAILED']);
    for (const part of [canary, 'script', 'jndi', 'VVVV']) expect(`${refusal.text}${refused.written()}`).not.toContain(part);
  });

  it('the file itself: it logs through its host only, reads nothing of what a probe threw, and imports no socket, process, file or timer module', () => {
    const source = readFileSync(new URL('../service.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(source).not.toMatch(/console\.|\.log\.|errorLog|\.stack\b|\.message\b|String\(error\)|catch \(error/);
    expect(source).not.toMatch(/from 'node:|setTimeout|setInterval|Date\.now|new Date|Math\.random|fetch\(/);
    // Seven places catch, and none of them names what it caught.
    // Row 106b: an eighth - the read of the lifecycle's state for the member `alias` (a state that cannot be read is null).
    expect(source.match(/catch \{/g)).toHaveLength(8);
    expect(source.match(/\bcatch\b/g)).toHaveLength(8);
    // The texts of a device reach ONE function, and its three results reach the answer's three members only.
    expect(source.match(/announcedTextOf\(/g)).toHaveLength(4);
    expect(source.match(/answer\.(?:vendor|model|name)\b/g)).toHaveLength(3);
  });
});

// ── On the fake ONVIF stub: the scan's probe is the capture unit's unauthenticated time read ───────
// Loopback only (127.0.0.1, ephemeral ports); no credential exists in this block.
describe('against the fake ONVIF stub (loopback): a listed address is found with ONE request; every refusal leaves 0 requests at the stub', () => {
  const open: FakeOnvifStub[] = [];
  afterEach(async () => {
    for (const stub of open.splice(0)) await stub.stop();
  });
  const timers = createSystemTimers();
  const reader = createOnvifTimeReader({ timers });
  const candidateAt = (serviceAddress: string): CameraCandidate => ({ adapterKind: CaptureAdapterKind.FAKE, host: FAKE_ONVIF_HOST, serviceAddress, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false });
  /** The camera network of this block: ONE camera, at the factory address 192.168.1.64; nothing listens for any other address. */
  async function network(): Promise<{ readonly stub: FakeOnvifStub; readonly probe: FactoryScanProbe; readonly seen: FactoryScanDestination[] }> {
    const stub = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: { username: `cnryU${randomUUID()}`, secret: `cnryS${randomUUID()}` } });
    await stub.start();
    open.push(stub);
    const nothingThere = `http://${FAKE_ONVIF_HOST}:${String((await freeFakeOnvifPorts()).device)}/onvif/device_service`;
    const seen: FactoryScanDestination[] = [];
    const probe: FactoryScanProbe = async (destination, signal) => {
      seen.push(destination);
      // THE MAPPING OF THIS FILE: the admitted factory address is the stub's loopback listener; the dial leaves from loopback.
      const answer = await reader.read(candidateAt(destination.address === '192.168.1.64' ? stub.addresses().deviceServiceUrl : nothingThere), signal, FAKE_ONVIF_HOST);
      // The time read hands out no text. The hostile texts are planted HERE, beside the real answer.
      return { answered: answer.answered, onvifReachable: answer.answered, vendor: `${FAKE_ONVIF_MARKUP_TEXT}\u0000`, model: 'M'.repeat(4_000), name: `stub\u001b[31m camera` };
    };
    return { stub, probe, seen };
  }
  const realTimers: Pick<RigOptions, 'after'> = { after: (delayMs, callback) => timers.after(delayMs, callback) };

  it('the camera at a listed factory address is found: 1 scan entry, 1 unauthenticated request at the stub, the temporary address taken away, the text cleaned and nowhere else', async () => {
    const { stub, probe, seen } = await network();
    const rig = rigOf({ ...realTimers, probe });
    const answer = await rig.scan();
    expect(answer.addressCount).toBe(4);
    expect(answer.devices).toEqual([{ address: '192.168.1.64', mac: null, onvifReachable: true, endpointCount: null, deviceCount: 'NOT_KNOWN', vendor: FAKE_ONVIF_MARKUP_TEXT, model: 'M'.repeat(120), name: 'stub[31m camera', registeredDeviceId: null }]);
    expect(CameraFactoryScanSchema.parse(answer)).toEqual(answer);
    // What reached the camera: the ONE read, with no Authorization header and no token - nothing else on any channel.
    expect(stub.httpRequests().map((request) => [request.method, request.operation, request.authorizationPresent, request.wsSecurity])).toEqual([['POST', 'GetSystemDateAndTime', false, 'NONE']]);
    expect(stub.requestLog().filter((request) => request.channel !== 'device')).toEqual([]);
    expect(stub.violations()).toEqual([]);
    // Dialled only what the rule admitted, each from the source it named; the factory address through the temporary one.
    expect(seen.map((destination) => `${destination.address} from ${destination.sourceAddress} alias=${String(destination.viaAlias)}`)).toEqual([
      '192.168.1.64 from 192.168.1.253 alias=true', '192.168.1.108 from 192.168.1.253 alias=true', '192.168.0.90 from 192.168.0.253 alias=true', '192.168.50.20 from 192.168.50.1 alias=false',
    ]);
    expect(rig.onPort()).toBeNull();
    expect(rig.audits.map((entry) => entry.details)).toEqual([{ outcome: 'COMPLETE', addressCount: 4, responderCount: 1, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' }]);
    for (const part of ['script', 'jndi', 'MMMM', 'stub', '192.168']) expect(rig.written()).not.toContain(part);
  });

  const beforeAnyPacket: readonly [title: string, options: RigOptions, body: { address?: string } | undefined, status: number, reason: unknown][] = [
    ['a session is open', { sessionOpen: () => true }, undefined, 409, null],
    ['the network configuration is absent', { settings: { configured: false } }, undefined, 409, 'COMMISSIONING_NOT_CONFIGURED'],
    ['the host states no camera interface', { facts: () => null }, undefined, 409, 'COMMISSIONING_NOT_CONFIGURED'],
    ['macOS: the helper is not available (the product seam)', { helper: () => hostAliasSocketTransportOf({ platform: 'darwin', socketPath: null }).preflight() }, undefined, 409, 'COMMISSIONING_NOT_AVAILABLE'],
    ['the helper is not configured (the product seam)', { helper: () => hostAliasSocketTransportOf({ platform: 'linux', socketPath: null }).preflight() }, undefined, 409, 'COMMISSIONING_HELPER_NOT_CONFIGURED'],
    ['not a production Core', { available: false }, undefined, 409, 'COMMISSIONING_NOT_AVAILABLE'],
    ['the typed address is loopback - the stub\'s own', {}, { address: FAKE_ONVIF_HOST }, 422, 'COMMISSIONING_ADDRESS_NOT_ALLOWED'],
    ['the typed address is public', {}, { address: '203.0.113.7' }, 422, 'COMMISSIONING_ADDRESS_NOT_ALLOWED'],
    ['the typed address lies in the office network', {}, { address: '10.20.4.4' }, 422, 'COMMISSIONING_ADDRESS_NOT_ALLOWED'],
    ['the temporary address is refused by the helper', { add: () => ({ refusal: 'HELPER_ALIAS_LIMIT_REACHED', effect: 'NOT_DONE' }) }, undefined, 409, 'HOST_ALIAS_FAILED'],
    ['the temporary address is "done" but not on the camera port', { hostShowsAfterAdd: () => null }, undefined, 409, 'HOST_ALIAS_FAILED'],
  ];
  it.each(beforeAnyPacket)('%s: refused with 0 requests at the stub', async (_title, options, body, status, reason) => {
    const { stub, probe, seen } = await network();
    const rig = rigOf({ ...realTimers, ...options, probe });
    const refusal = await refusalOf(rig.scan(body));
    expect([refusal.answer[0], refusal.answer[2]]).toEqual([status, reason]);
    expect([stub.httpRequests(), stub.requestLog(), seen]).toEqual([[], [], []]);
  });

  it('a stored list that holds the stub\'s own loopback address and a public one: neither is dialled; the scan asks the others', async () => {
    const { stub, probe, seen } = await network();
    const rig = rigOf({ ...realTimers, settings: { factoryAddresses: [FAKE_ONVIF_HOST, '203.0.113.7', '192.168.50.20'] }, probe });
    expect(await rig.scan()).toMatchObject({ addressCount: 1, devices: [] });
    expect([stub.httpRequests(), seen.map((destination) => destination.address)]).toEqual([[], ['192.168.50.20']]);
  });
});
