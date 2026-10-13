// The set-IP job (task 4 blueprint row 111, WP-22b; decisions C1, C7, C78; security requirements
// S13-04, S13-10, S13-11, S13-12).
//
// THE DOUBLES. No camera, no network device and no helper is contacted; no address of any host is
// read or changed; no `ip`, `ping` or `arping` runs.
//   the camera          block 1: scripted functions. Block 2: the fake ONVIF stub on 127.0.0.1
//                       (ephemeral ports), driven by the REAL set-network file through the fence's
//                       own binding (`cameraNetworkSetterOf`) and by the REAL unauthenticated clock
//                       read. The product's rule never admits loopback: this file maps the address
//                       the rule admitted to the stub's listener (the mapping of the scan's tests);
//   the new address     the stub MOVES its listeners to other loopback ports when the change is
//                       applied; "the camera at the new address" is those ports;
//   the alias address   a recording double;
//   the host            a table of interfaces written here, a neighbour table and an "answers"
//                       function written here, a clock that this file moves;
//   the lock-out guard  the REAL limits object of the connection tests, on this file's clock.
// WHAT IS TYPED is drawn at run time and searched for, count only, in everything the job wrote.
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { CAMERA_NETWORK_SCAN_MAX_AGE_MS, CAMERA_NETWORK_SET_MAX_AUTHENTICATED_READS, CAMERA_NETWORK_SET_POLL_MS, CAMERA_NETWORK_SET_WAIT_MS, CameraNetworkJobSchema, type CameraNetworkJob } from '@dems/shared/api';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_ONVIF_HOST, FAKE_ONVIF_MARKUP_TEXT, FAKE_ONVIF_NETWORK_DEFAULTS, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifPorts, type FakeOnvifStub, type FakeOnvifStubOptions } from '../../../../../test/support/fake-onvif-stub';
import { createSystemTimers } from '../../../../capture';
import { sealCredential } from '../../../../capture/adapters';
import { createOnvifTimeReader } from '../../../../capture/adapters/camera/onvif-session';
import { CaptureAdapterKind } from '../../../../capture/adapters/kinds';
import type { CameraCandidate } from '../../../../capture/adapters/types';
import { DestinationPurpose, decideDestination, decideNewCameraAddress, type DestinationContext } from '../../../../capture/destination-rule';
import { cameraNetworkSetterOf } from '../../../../capture/fence';
import type { AuditEntry } from '../../../../core';
import { hostAliasSocketTransportOf } from '../../../../host-alias-socket';
import { ApiFailure } from '../../../../plugins/error-envelope';
import { createConnectionTestLimits, type ConnectionTestLimits } from '../../../capture-discovery/connect/limits';
import { createFactoryScanGate } from '../../factory-scan';
import {
  CAMERA_NETWORK_FREE_ADDRESS_SPACING_MS,
  CAMERA_NETWORK_FREE_ADDRESS_TOTAL_MS,
  CAMERA_NETWORK_NEXT_FREE_MAX_ASKED,
  createCameraNetworkJobs,
  holdTypedAccount,
  readCameraNetworkJob,
  startCameraNetworkJob,
  type CameraNetworkAliasOutcome,
  type CameraNetworkCamera,
  type CameraNetworkCaller,
  type CameraNetworkParts,
  type CameraNetworkRequest,
  type CameraNetworkSeams,
  type CameraNetworkSetAnswer,
  type CameraNetworkSetCall,
  type CameraNetworkSettings,
  type TypedAccount,
} from '../service';

const ACCOUNT = { username: `cnryU${randomUUID().replaceAll('-', '')}`, secret: `cnryS${randomUUID().replaceAll('-', '')}` };
const WRONG = { username: ACCOUNT.username, secret: `cnryW${randomUUID().replaceAll('-', '')}` };
const NEEDLES = [ACCOUNT.username, ACCOUNT.secret, WRONG.secret];
const CALLER: CameraNetworkCaller = { operatorId: 'OPR-003', sessionId: 'session-technician-1', deviceId: null };
const OTHER: CameraNetworkCaller = { operatorId: 'OPR-003', sessionId: 'session-technician-2', deviceId: null };
const OWN = '192.168.50.1';
/** A factory address, outside the camera subnet: reached from the alias address of its /24. */
const FROM = '192.168.1.64';
const ALIAS = '192.168.1.253';
/** The first address a job offers (`cameraIpStart` 101). */
const NEXT = '192.168.50.101';
const MAC = FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress.toUpperCase();
const OTHER_MAC = '02:00:00:00:00:99';
const DONE: CameraNetworkAliasOutcome = { refusal: null, effect: 'DONE' };
/** What the last scan says by default (row V6): as the PRODUCT's scan today - the count NOT KNOWN, the row showing the camera's hardware address, made just now. */
const SCANNED = (_address: string, now: number): ReturnType<CameraNetworkSeams['scan']['lastScanOf']> => ({ deviceCount: 'NOT_KNOWN', mac: MAC, scannedAt: now });
const SETTINGS: CameraNetworkSettings = { configured: true, aliasHost: 253, aliasMinutes: 30, cameraIpStart: 101 };
/** THE RULES as the composition binds them: the capture unit's own two functions. */
const RULE: CameraNetworkCamera['rule'] = (address, facts) => decideDestination({ purpose: DestinationPurpose.SET_IP, address }, facts);
const NEW_RULE: CameraNetworkCamera['newAddress'] = (request, context) => decideNewCameraAddress(request, context);

interface RigOptions {
  readonly sessionOpen?: () => boolean;
  readonly available?: boolean;
  readonly noParts?: boolean;
  readonly noInputs?: boolean;
  readonly helper?: () => Promise<string | null>;
  readonly settings?: Partial<CameraNetworkSettings>;
  readonly facts?: () => DestinationContext | null;
  readonly registered?: readonly string[];
  readonly add?: (address: string) => CameraNetworkAliasOutcome | Promise<CameraNetworkAliasOutcome>;
  readonly remove?: (address: string) => CameraNetworkAliasOutcome | Promise<CameraNetworkAliasOutcome>;
  readonly hostShowsAfterAdd?: (asked: string) => string | null;
  readonly poll?: CameraNetworkCamera['poll'];
  readonly set?: (call: CameraNetworkSetCall) => Promise<CameraNetworkSetAnswer>;
  readonly neighbour?: (address: string) => Promise<string | null> | string | null;
  readonly answers?: (address: string) => Promise<boolean> | boolean;
  readonly lastScanOf?: (address: string, now: number) => ReturnType<CameraNetworkSeams['scan']['lastScanOf']>;
  readonly guard?: ConnectionTestLimits;
  readonly audit?: (entry: AuditEntry) => Promise<void>;
  /** What a pause of the wait does beside moving the clock (block 2 lets the stub's listeners settle). */
  readonly onPause?: () => Promise<void>;
}

function rigOf(options: RigOptions = {}) {
  let onPort: string | null = null;
  let now = 1_800_000_000_000;
  /** True once the scripted camera took the set: it then answers at the new address. */
  let moved = false;
  const calls: string[] = [];
  const audits: AuditEntry[] = [];
  const notes: { fields: Record<string, unknown>; message: string }[] = [];
  const failures: { source: string; message: string; code: string; context: Record<string, unknown> }[] = [];
  const accounts: TypedAccount[] = [];
  const table = (): DestinationContext => ({
    cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
    cameraAddresses: [{ address: OWN, alias: false }, ...(onPort === null ? [] : [{ address: onPort, alias: true }])],
    otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 16 }],
    hostAddresses: ['127.0.0.1', '10.20.0.15', OWN, ...(onPort === null ? [] : [onPort])],
  });
  const guard = options.guard ?? createConnectionTestLimits({ now: () => now });
  const gate = createFactoryScanGate();
  const scripted = async (call: CameraNetworkSetCall): Promise<CameraNetworkSetAnswer> => {
    if (!call.admitHwAddress(MAC)) return { outcome: 'NOT_SET', reason: 'HW_ADDRESS_REFUSED', rejectedCredentialRequests: 0 };
    moved = true;
    return { outcome: 'SET', reason: null, rejectedCredentialRequests: 0 };
  };
  const parts: CameraNetworkParts = {
    camera: {
      rule: RULE,
      newAddress: NEW_RULE,
      async poll(destination, signal) {
        calls.push(`poll ${destination.address} from ${String(destination.sourceAddress)}`);
        return (options.poll ?? (async (asked) => ({ answered: asked.address === FROM ? !moved : moved })))(destination, signal);
      },
      async set(call) {
        calls.push(`set ${call.address} -> ${call.assignment.address}/${String(call.assignment.prefixLength)} gw ${String(call.assignment.gateway)}`);
        return (options.set ?? scripted)(call);
      },
    },
    alias: {
      helper: options.helper ?? (async () => null),
      async add(request) {
        calls.push(`add ${request.address} ${String(request.minutes)} ${request.subject.reason} ${request.subject.operationId}`);
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
    },
    guard: () => guard,
    ...(options.noInputs === true
      ? {}
      : {
          inputs: {
            async neighbour(address) {
              calls.push(`neighbour ${address}`);
              return options.neighbour === undefined ? MAC : options.neighbour(address);
            },
            async answers(address) {
              calls.push(`answers ${address}`);
              return options.answers === undefined ? address === FROM : options.answers(address);
            },
          },
        }),
  };
  const seams: CameraNetworkSeams = {
    host: {
      now: () => now,
      sessionOpen: options.sessionOpen ?? (() => false),
      settings: async () => ({ ...SETTINGS, ...options.settings }),
      facts: options.facts ?? table,
      registeredAddresses: async () => options.registered ?? [],
      async audit(entry) {
        calls.push(`audit ${String(entry.details?.['phase'])}`);
        if (options.audit !== undefined) await options.audit(entry);
        audits.push(entry);
      },
      // THE CLOCK OF THIS FILE: a pause of the wait moves it by its length and ends at once; a bound never fires.
      after(delayMs, callback) {
        // (Row V6: the spacing of the two "is it free" observations is a pause of the same kind.)
        if (delayMs === CAMERA_NETWORK_FREE_ADDRESS_SPACING_MS) {
          now += delayMs;
          void Promise.resolve().then(callback);
          return () => undefined;
        }
        if (delayMs !== CAMERA_NETWORK_SET_POLL_MS) return () => undefined;
        now += delayMs;
        void (options.onPause?.() ?? Promise.resolve()).then(callback);
        return () => undefined;
      },
      note: (fields, message) => notes.push({ fields, message }),
      failed: (source, message, code, context) => failures.push({ source, message, code, context }),
    },
    scan: { claim: () => gate.claim(), lastScanOf: (address) => (options.lastScanOf ?? SCANNED)(address, now) },
    jobs: createCameraNetworkJobs(7),
    available: () => options.available ?? true,
    parts: () => (options.noParts === true ? null : parts),
  };
  /** Starts a job with what "the technician typed" and waits for its end. */
  const job = async (request: CameraNetworkRequest = { fromAddress: FROM, scannedMac: MAC }, typed = ACCOUNT, caller = CALLER): Promise<{ readonly started: CameraNetworkJob; readonly ended: CameraNetworkJob }> => {
    const account = holdTypedAccount(sealCredential(typed));
    accounts.push(account);
    const started = await startCameraNetworkJob(seams, caller, request, account);
    await seams.jobs.idle();
    return { started, ended: readCameraNetworkJob(seams, caller, started.jobId) };
  };
  return {
    seams,
    calls,
    audits,
    notes,
    failures,
    guard,
    gate,
    job,
    accounts,
    advance: (ms: number): void => void (now += ms),
    now: (): number => now,
    onPort: (): string | null => onPort,
    /** Everything that left a job but its answer: the log lines, the persisted failures, the audit entries, the calls of the doubles, the job records. */
    written: (): string => [JSON.stringify({ notes, failures, audits, calls }), inspect(seams.jobs, { depth: 8, showHidden: true }), inspect(accounts, { depth: 8, showHidden: true })].join('\n'),
  };
}

async function refusalOf(attempt: Promise<unknown>): Promise<{ readonly answer: [number, string, unknown]; readonly text: string; readonly failure: ApiFailure }> {
  const failure = await attempt.then(
    () => null,
    (error: unknown) => error,
  );
  if (!(failure instanceof ApiFailure)) throw new Error(`expected a refusal, got ${failure === null ? 'an answer' : String(failure)}`);
  return { answer: [failure.statusCode, failure.code, failure.details?.['reason'] ?? null], text: JSON.stringify({ message: failure.message, details: failure.details, headers: failure.headers, stack: failure.stack }), failure };
}
const count = (text: string, needle: string): number => text.split(needle).length - 1;
/** COUNT ONLY: how often anything typed stands in a text. The values themselves are never printed. */
const typedIn = (text: string): number => NEEDLES.reduce((sum, needle) => sum + count(text, needle), 0);
const aliasCallsOf = (calls: readonly string[]): string[] => calls.filter((call) => call.startsWith('add ') || call.startsWith('remove '));
const cameraCallsOf = (calls: readonly string[]): string[] => calls.filter((call) => call.startsWith('poll ') || call.startsWith('set '));
const phasesOf = (audits: readonly AuditEntry[]): unknown[] => audits.map((entry) => entry.details?.['phase']);
/** What every job and every refusal must leave: nothing typed held, nothing typed written, no alias address on the camera port, the one turn free. */
function expectClean(rig: ReturnType<typeof rigOf>, ...answers: unknown[]): void {
  expect(rig.accounts.map((account) => account.held())).toEqual(rig.accounts.map(() => false));
  expect(typedIn(`${rig.written()}\n${JSON.stringify(answers)}\n${JSON.stringify(process.env)}\n${process.argv.join(' ')}`)).toBe(0);
  expect(rig.onPort()).toBeNull();
  expect(rig.gate.busy()).toBe(false);
  expect(rig.guard.busy()).toBe(false);
}

describe('every refusal comes BEFORE a job exists: nothing asked of the camera, no alias address, no audit entry, what was typed let go', () => {
  const refusals: readonly [title: string, options: RigOptions, body: CameraNetworkRequest, expected: [number, string, unknown]][] = [
    ['a session is open', { sessionOpen: () => true }, { fromAddress: FROM, scannedMac: MAC }, [409, 'CAPTURE_CONFIG_LOCKED', null]],
    ['this Core is not in production capture', { available: false }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']],
    ['the composition handed no parts in', { noParts: true }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']],
    ['THE PRODUCT AS COMPOSED TODAY: parts without the observations of the host', { noInputs: true }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']],
    ['macOS: the PRODUCT seam of the helper answers "not available on this platform"', { helper: () => hostAliasSocketTransportOf({ platform: 'darwin', socketPath: '/run/dems-core-netalias/socket' }).preflight() }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']],
    ['the helper check throws', { helper: () => Promise.reject(new Error(ACCOUNT.secret)) }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']],
    ['the helper is not configured (the product seam, Linux without a path)', { helper: () => hostAliasSocketTransportOf({ platform: 'linux', socketPath: null }).preflight() }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_HELPER_NOT_CONFIGURED']],
    ['no interface or subnet is chosen', { settings: { configured: false } }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED']],
    ['the host states no camera network', { facts: () => null }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED']],
    ['the facts of the host cannot be read', { facts: () => { throw new Error('unreadable'); } }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']],
    ['the present address is in the office network', {}, { fromAddress: '10.20.0.77', scannedMac: MAC }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the present address is the Core\'s own', {}, { fromAddress: OWN, scannedMac: MAC }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the present address is loopback', {}, { fromAddress: '127.0.0.1', scannedMac: MAC }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the present address is public', {}, { fromAddress: '8.8.8.8', scannedMac: MAC }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the present address is none of the last scan', { lastScanOf: () => null }, { fromAddress: FROM, scannedMac: MAC }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['THE COUNT: the last scan saw more than one device at the present address', { lastScanOf: (_address, now) => ({ deviceCount: 'MORE_THAN_ONE', mac: MAC, scannedAt: now }) }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'CAMERA_ADDRESS_CONFLICT']],
    ['THE COUNT: a state that is none of the three is refused as a conflict', { lastScanOf: (_address, now) => ({ deviceCount: 'TWO' as never, mac: MAC, scannedAt: now }) }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'CAMERA_ADDRESS_CONFLICT']],
    // Row V6 (R119-03): a statement of the scan has an age.
    ['THE AGE OF THE SCAN: one millisecond older than the bound', { lastScanOf: (_address, now) => ({ deviceCount: 'NOT_KNOWN', mac: MAC, scannedAt: now - CAMERA_NETWORK_SCAN_MAX_AGE_MS - 1 }) }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'CAMERA_SCAN_TOO_OLD']],
    ['THE AGE OF THE SCAN: the clock went back since the scan', { lastScanOf: (_address, now) => ({ deviceCount: 'ONE', mac: MAC, scannedAt: now + 1 }) }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'CAMERA_SCAN_TOO_OLD']],
    ['THE AGE OF THE SCAN: a time that is no number', { lastScanOf: () => ({ deviceCount: 'ONE', mac: MAC, scannedAt: Number.NaN }) }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'CAMERA_SCAN_TOO_OLD']],
    // Row V6 (R119-04): the hardware address the technician saw is bound to the job - for NOT_KNOWN and for ONE alike.
    ['THE BINDING, count NOT KNOWN: the request names another hardware address than the scan row showed', {}, { fromAddress: FROM, scannedMac: OTHER_MAC }, [409, 'INVALID_STATE', 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND']],
    ['THE BINDING, count NOT KNOWN: the scan row showed no hardware address', { lastScanOf: (_address, now) => ({ deviceCount: 'NOT_KNOWN', mac: null, scannedAt: now }) }, { fromAddress: FROM, scannedMac: MAC }, [409, 'INVALID_STATE', 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND']],
    ['THE BINDING, count ONE: the request names another hardware address than the scan row showed', { lastScanOf: (_address, now) => ({ deviceCount: 'ONE', mac: MAC, scannedAt: now }) }, { fromAddress: FROM, scannedMac: OTHER_MAC }, [409, 'INVALID_STATE', 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND']],
    ['THE BINDING: a hardware address that is not of the one strict form (lower case) reaches the job past the route', {}, { fromAddress: FROM, scannedMac: MAC.toLowerCase() }, [409, 'INVALID_STATE', 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND']],
    ['THE BINDING: the memory of the scan holds a text that is no hardware address', { lastScanOf: (_address, now) => ({ deviceCount: 'NOT_KNOWN', mac: MAC.toLowerCase(), scannedAt: now }) }, { fromAddress: FROM, scannedMac: MAC.toLowerCase() }, [409, 'INVALID_STATE', 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND']],
    ['the new address is outside the camera subnet', {}, { fromAddress: FROM, scannedMac: MAC, toAddress: '192.168.60.101' }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the new address is the Core\'s own', {}, { fromAddress: FROM, scannedMac: MAC, toAddress: OWN }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the new address is a registered camera\'s (stored with its port)', { registered: ['192.168.50.20:8080'] }, { fromAddress: FROM, scannedMac: MAC, toAddress: '192.168.50.20' }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the new address is the gateway of the request', {}, { fromAddress: FROM, scannedMac: MAC, toAddress: '192.168.50.9', gateway: '192.168.50.9' }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the gateway is outside the camera subnet, with a typed new address', {}, { fromAddress: FROM, scannedMac: MAC, toAddress: NEXT, gateway: '192.168.60.1' }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the gateway is outside the camera subnet, with the next free address', {}, { fromAddress: FROM, scannedMac: MAC, gateway: '192.168.60.1' }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['the new address is the present one', {}, { fromAddress: '192.168.50.20', scannedMac: MAC, toAddress: '192.168.50.20' }, [422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']],
    ['a stored camera address that cannot be read: the registry is not clean', { registered: ['not an address'] }, { fromAddress: FROM, scannedMac: MAC, toAddress: NEXT }, [409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED']],
  ];
  it.each(refusals)('%s', async (_title, options, body, expected) => {
    const rig = rigOf(options);
    const refused = await refusalOf(rig.job(body));
    expect(refused.answer).toEqual(expected);
    expect(cameraCallsOf(rig.calls)).toEqual([]);
    expect(aliasCallsOf(rig.calls)).toEqual([]);
    expect(rig.audits).toEqual([]);
    expect(rig.calls.filter((call) => call.startsWith('answers ') || call.startsWith('neighbour '))).toEqual([]);
    expectClean(rig, refused.text);
  });

  it('AN ADDRESS THAT ANSWERS: a typed new address at which anything answers is 409 CAMERA_NEW_ADDRESS_IN_USE; asked once, of the host, and nothing of the camera', async () => {
    const rig = rigOf({ answers: (address) => address === NEXT });
    const refused = await refusalOf(rig.job({ fromAddress: FROM, scannedMac: MAC, toAddress: NEXT }));
    expect(refused.answer).toEqual([409, 'INVALID_STATE', 'CAMERA_NEW_ADDRESS_IN_USE']);
    expect(rig.calls).toEqual([`answers ${NEXT}`]);
    expect(rig.audits).toEqual([]);
    expectClean(rig, refused.text);
  });

  it('"FREE" AFTER ONE ECHO IS NOT FREE (row V6, R119-06): silent then answering is IN USE; two silent observations are free; the observations of one address end inside one bound of time, and a clock that went back is "not known"', async () => {
    // A device slow to answer its first address question: silent at the first observation, there at the second.
    let asked = 0;
    const slow = rigOf({ answers: (address) => address === NEXT && (asked += 1) >= 2 });
    const refused = await refusalOf(slow.job({ fromAddress: FROM, scannedMac: MAC, toAddress: NEXT }));
    expect(refused.answer).toEqual([409, 'INVALID_STATE', 'CAMERA_NEW_ADDRESS_IN_USE']);
    expect(slow.calls).toEqual([`answers ${NEXT}`, `answers ${NEXT}`]);
    expect(slow.audits).toEqual([]);
    expectClean(slow, refused.text);

    // Silent twice: free. The two observations are spaced on the host's timer.
    const free = rigOf({ answers: () => false, poll: async () => ({ answered: false }) });
    const before = free.now();
    const { started } = await free.job({ fromAddress: FROM, scannedMac: MAC, toAddress: NEXT });
    expect(free.calls.slice(0, 3)).toEqual([`answers ${NEXT}`, `answers ${NEXT}`, 'audit REQUESTED']);
    expect(started.startedAt - before).toBe(CAMERA_NETWORK_FREE_ADDRESS_SPACING_MS);

    // The first observation took the whole bound: the second is NOT asked, and what is not settled is refused, never "free".
    let late: ReturnType<typeof rigOf> | null = null;
    late = rigOf({ answers: () => (late?.advance(CAMERA_NETWORK_FREE_ADDRESS_TOTAL_MS), false) });
    const unsettled = await refusalOf(late.job({ fromAddress: FROM, scannedMac: MAC, toAddress: NEXT }));
    expect(unsettled.answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(late.calls).toEqual([`answers ${NEXT}`]);
    expect(late.failures.map((failure) => failure.code)).toEqual(['CAMERA_NETWORK_HOST_INPUT_FAILED']);

    let back: ReturnType<typeof rigOf> | null = null;
    back = rigOf({ answers: () => (back?.advance(-5_000), false) });
    expect((await refusalOf(back.job({ fromAddress: FROM, scannedMac: MAC, toAddress: NEXT }))).answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(back.calls).toEqual([`answers ${NEXT}`]);
  });

  it('"does it answer" cannot be asked: not known is not free - 409 COMMISSIONING_NOT_AVAILABLE, one persisted failure of codes, nothing thrown is read', async () => {
    const rig = rigOf({ answers: () => Promise.reject(new Error(`${ACCOUNT.secret} ${FAKE_ONVIF_MARKUP_TEXT}`)) });
    const refused = await refusalOf(rig.job({ fromAddress: FROM, scannedMac: MAC, toAddress: NEXT }));
    expect(refused.answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(rig.failures.map((failure) => failure.code)).toEqual(['CAMERA_NETWORK_HOST_INPUT_FAILED']);
    expect(count(rig.written(), FAKE_ONVIF_MARKUP_TEXT)).toBe(0);
    expectClean(rig, refused.text);
  });

  it('THE NEXT FREE ADDRESS: from the configured first one upwards, skipping what the rule refuses and what answers; a full range is 409 CAMERA_NO_FREE_ADDRESS after a bounded number of questions', async () => {
    const taken = rigOf({ registered: ['192.168.50.101'], answers: (address) => address === FROM || address === '192.168.50.102' });
    const { ended } = await taken.job();
    // .101 is a registered camera's (the rule; not asked), .102 answers, .103 is free.
    expect(ended).toMatchObject({ state: 'COMPLETED', toAddress: '192.168.50.103' });
    // Row V6 (R119-06): "taken" is settled by ONE answer; "free" needs two silent observations in a row.
    expect(taken.calls.filter((call) => call.startsWith('answers ')).slice(0, 3)).toEqual(['answers 192.168.50.102', 'answers 192.168.50.103', 'answers 192.168.50.103']);

    const full = rigOf({ answers: () => true });
    const refused = await refusalOf(full.job());
    expect(refused.answer).toEqual([409, 'INVALID_STATE', 'CAMERA_NO_FREE_ADDRESS']);
    expect(full.calls.filter((call) => call.startsWith('answers '))).toHaveLength(CAMERA_NETWORK_NEXT_FREE_MAX_ASKED);
    expect(cameraCallsOf(full.calls)).toEqual([]);
    expectClean(full, refused.text);
  });

  it('ONE TURN: a job is refused while a scan holds the gate, a second job while the first runs, and a job while a connection test holds the turn of the guard', async () => {
    const scanning = rigOf();
    const held = scanning.gate.claim();
    expect((await refusalOf(scanning.job())).answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_JOB_IN_PROGRESS']);
    held?.();

    let let_go: (() => void) | undefined;
    const waiting = rigOf({ poll: () => new Promise((resolve) => (let_go = () => resolve({ answered: false }))) });
    const first = waiting.job();
    await new Promise((resolve) => setImmediate(resolve));
    expect((await refusalOf(startCameraNetworkJob(waiting.seams, CALLER, { fromAddress: FROM, scannedMac: MAC }, holdTypedAccount(sealCredential(ACCOUNT))))).answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_JOB_IN_PROGRESS']);
    // While the job runs the gate is held: the scan and the technician's removal of the alias address ask this gate.
    expect(waiting.gate.busy()).toBe(true);
    let_go?.();
    await first;
    expect(waiting.gate.busy()).toBe(false);

    const testing = rigOf();
    const turn = testing.guard.begin('192.168.50.77', 'another-session');
    expect((await refusalOf(testing.job())).answer).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_JOB_IN_PROGRESS']);
    turn.abandon();
    expect(aliasCallsOf(testing.calls)).toEqual([]);
  });
});

describe('the job on scripted doubles: the order, the alias address on every way out, what the technician sees', () => {
  it('a camera at a factory address: alias, unauthenticated poll, neighbour table, ONE set call, alias away BEFORE the wait, the same hardware address at the new address', async () => {
    const rig = rigOf();
    const { started, ended } = await rig.job();
    expect(CameraNetworkJobSchema.parse(started)).toEqual(started);
    expect(started).toMatchObject({ jobId: 'CNJ-000007', state: 'RUNNING', step: 'REACHING', fromAddress: FROM, toAddress: NEXT, neighbourMac: null, authenticatedMac: null, confirmedMac: null, deviceId: null, failure: null, endedAt: null });
    expect(CameraNetworkJobSchema.parse(ended)).toEqual(ended);
    expect(ended).toMatchObject({ state: 'COMPLETED', step: 'DONE', neighbourMac: MAC, authenticatedMac: MAC, confirmedMac: MAC, deviceId: null, failure: null });
    expect(rig.calls).toEqual([
      `answers ${NEXT}`,
      `answers ${NEXT}`,
      'audit REQUESTED',
      `add ${ALIAS} 30 SET_CAMERA_ADDRESS setCameraNetwork`,
      `poll ${FROM} from ${ALIAS}`,
      `neighbour ${FROM}`,
      `set ${FROM} -> ${NEXT}/24 gw null`,
      `remove ${ALIAS}`,
      `poll ${NEXT} from ${OWN}`,
      `neighbour ${NEXT}`,
      'audit COMPLETED',
    ]);
    expect(rig.audits.map((entry) => [entry.type, entry.actorId, entry.details])).toEqual([
      // Row V6 (R119-03): both entries say that the count was NOT made - the job ran on the hardware-address checks alone.
      ['CAMERA_NETWORK_SET', 'OPR-003', { phase: 'REQUESTED', fromAddress: FROM, toAddress: NEXT, deviceCount: 'NOT_KNOWN', operationId: 'setCameraNetwork', permission: 'CAPTURE_COMMISSION' }],
      ['CAMERA_NETWORK_SET', 'OPR-003', { phase: 'COMPLETED', fromAddress: FROM, toAddress: NEXT, deviceCount: 'NOT_KNOWN', mac: MAC, operationId: 'setCameraNetwork', permission: 'CAPTURE_COMMISSION' }],
    ]);
    expect(ended).toMatchObject({ scannedMac: MAC, deviceCount: 'NOT_KNOWN' });
    expect(rig.failures).toEqual([]);
    expectClean(rig, started, ended);
    // A job is data of the session that started it: ONE answer for another session and for an unknown id.
    expect((await refusalOf((async () => readCameraNetworkJob(rig.seams, OTHER, started.jobId))())).answer).toEqual([404, 'NOT_FOUND', null]);
    expect((await refusalOf((async () => readCameraNetworkJob(rig.seams, CALLER, 'CNJ-999999'))())).answer).toEqual([404, 'NOT_FOUND', null]);
  });

  it('A REGISTERED CAMERA inside the camera subnet: no alias address; the job changes NO registry row and writes no address-changed entry - `deviceId` stays null', async () => {
    const rig = rigOf({ registered: ['192.168.50.20'], poll: async (asked) => ({ answered: asked.address === NEXT || asked.address === '192.168.50.20' }) });
    const { ended } = await rig.job({ fromAddress: '192.168.50.20', scannedMac: MAC, gateway: '192.168.50.254' });
    expect(ended).toMatchObject({ state: 'COMPLETED', fromAddress: '192.168.50.20', toAddress: NEXT, deviceId: null });
    expect(aliasCallsOf(rig.calls)).toEqual([]);
    expect(rig.calls).toContain(`set 192.168.50.20 -> ${NEXT}/24 gw 192.168.50.254`);
    expect(rig.calls).toContain(`poll 192.168.50.20 from ${OWN}`);
    expect(rig.audits.map((entry) => entry.type)).toEqual(['CAMERA_NETWORK_SET', 'CAMERA_NETWORK_SET']);
    expectClean(rig, ended);
  });

  const failing: readonly [title: string, options: RigOptions, failure: string, aliasCalls: string[], sets: number][] = [
    ['`add` answers that it certainly changed nothing: NO removal is asked (C78)', { add: () => ({ refusal: 'ALIAS_ALREADY_OPEN', effect: 'NOT_DONE' }) }, 'HOST_ALIAS_FAILED', ['add'], 0],
    ['`add` answers "not known": the removal IS asked', { add: () => ({ refusal: 'HELPER_TIMED_OUT', effect: 'UNKNOWN' }) }, 'HOST_ALIAS_FAILED', ['add', 'remove'], 0],
    ['`add` throws: the removal is asked', { add: () => Promise.reject(new Error(ACCOUNT.secret)) }, 'HOST_ALIAS_FAILED', ['add', 'remove'], 0],
    ['`add` says "done" and the host does not state the address on the camera port', { hostShowsAfterAdd: () => null }, 'HOST_ALIAS_FAILED', ['add', 'remove'], 0],
    ['nothing answers at the present address', { poll: async () => ({ answered: false }), answers: (address) => address !== FROM && false }, 'CAMERA_UNREACHABLE', ['add', 'remove'], 0],
    ['something answers at the present address, but not as an ONVIF device', { poll: async () => ({ answered: false }) }, 'ONVIF_NOT_ENABLED', ['add', 'remove'], 0],
    ['the poll throws a device\'s words', { poll: () => Promise.reject(new Error(FAKE_ONVIF_MARKUP_TEXT)) }, 'ONVIF_NOT_ENABLED', ['add', 'remove'], 0],
    ['the neighbour table holds no address for the camera: it cannot be recognised, nothing is set', { neighbour: () => null }, 'MAC_MISMATCH', ['add', 'remove'], 0],
    ['the neighbour table cannot be read', { neighbour: () => Promise.reject(new Error(FAKE_ONVIF_MARKUP_TEXT)) }, 'MAC_MISMATCH', ['add', 'remove'], 0],
    ['the neighbour table answers a text that is no hardware address', { neighbour: () => `${FAKE_ONVIF_MARKUP_TEXT}` }, 'MAC_MISMATCH', ['add', 'remove'], 0],
    // Row V6 (R119-04): the technician's address is bound to the job. The table holding ANOTHER ends the job before the one call that carries what was typed.
    ['THE HOST NOW SEES ANOTHER HARDWARE ADDRESS than the technician saw on the scan row: the typed account is NOT used (no set call)', { neighbour: () => OTHER_MAC }, 'MAC_MISMATCH', ['add', 'remove'], 0],
    ['THE DEVICE STATES ANOTHER HARDWARE ADDRESS than the host and the technician saw: the set call makes no set request', { set: async (call) => (call.admitHwAddress(OTHER_MAC) ? { outcome: 'SET', reason: null, rejectedCredentialRequests: 0 } : { outcome: 'NOT_SET', reason: 'HW_ADDRESS_REFUSED', rejectedCredentialRequests: 0 }) }, 'MAC_MISMATCH', ['add', 'remove'], 1],
    ['the device states NO hardware address of the one form: the hook refuses it', { set: async (call) => (call.admitHwAddress(null) || call.admitHwAddress(MAC.toLowerCase()) ? { outcome: 'SET', reason: null, rejectedCredentialRequests: 0 } : { outcome: 'NOT_SET', reason: 'HW_ADDRESS_REFUSED', rejectedCredentialRequests: 0 }) }, 'MAC_MISMATCH', ['add', 'remove'], 1],
    ['the camera refuses what was typed', { set: async () => ({ outcome: 'NOT_SET', reason: 'CREDENTIAL_REFUSED', rejectedCredentialRequests: 1 }) }, 'AUTHENTICATION_FAILED', ['add', 'remove'], 1],
    ['the camera offers only a sign-in the Core refuses', { set: async () => ({ outcome: 'NOT_SET', reason: 'SCHEME_NOT_ALLOWED', rejectedCredentialRequests: 0 }) }, 'AUTHENTICATION_FAILED', ['add', 'remove'], 1],
    ['the camera refuses the setting', { set: async () => ({ outcome: 'NOT_SET', reason: 'SET_REFUSED', rejectedCredentialRequests: 0 }) }, 'SET_REFUSED', ['add', 'remove'], 1],
    ['the camera stops answering before the set', { set: async () => ({ outcome: 'NOT_SET', reason: 'NO_ANSWER', rejectedCredentialRequests: 0 }) }, 'CAMERA_UNREACHABLE', ['add', 'remove'], 1],
    ['A THROWN SET CALL', { set: () => Promise.reject(new Error(`${ACCOUNT.secret} ${FAKE_ONVIF_MARKUP_TEXT}`)) }, 'SET_REFUSED', ['add', 'remove'], 1],
    ['a set call that answers what is no answer', { set: async () => ({ outcome: FAKE_ONVIF_MARKUP_TEXT, reason: ACCOUNT.secret, rejectedCredentialRequests: 0 }) }, 'SET_REFUSED', ['add', 'remove'], 1],
    ['the set is accepted and the camera never answers at the new address', { set: async (call) => (call.admitHwAddress(MAC) ? { outcome: 'SET', reason: null, rejectedCredentialRequests: 0 } : { outcome: 'NOT_SET', reason: 'HW_ADDRESS_REFUSED', rejectedCredentialRequests: 0 }), poll: async (asked) => ({ answered: asked.address === FROM }) }, 'NOT_FOUND_AT_NEW_ADDRESS', ['add', 'remove'], 1],
    ['ANOTHER hardware address answers at the new address for the whole wait', { neighbour: (address) => (address === FROM ? MAC : OTHER_MAC) }, 'NOT_FOUND_AT_NEW_ADDRESS', ['add', 'remove'], 1],
    ['the removal of the alias address throws: the job still ends, and says so in a persisted failure', { remove: () => Promise.reject(new Error(ACCOUNT.secret)), set: async () => ({ outcome: 'NOT_SET', reason: 'SET_REFUSED', rejectedCredentialRequests: 0 }) }, 'SET_REFUSED', ['add', 'remove'], 1],
  ];
  it.each(failing)('%s', async (_title, options, failure, aliasCalls, sets) => {
    const rig = rigOf(options);
    const { ended } = await rig.job();
    expect(ended).toMatchObject({ state: 'FAILED', step: 'DONE', failure, deviceId: null });
    expect(CameraNetworkJobSchema.parse(ended)).toEqual(ended);
    expect(aliasCallsOf(rig.calls).map((call) => call.split(' ')[0])).toEqual(aliasCalls);
    expect(rig.calls.filter((call) => call.startsWith('set '))).toHaveLength(sets);
    expect(phasesOf(rig.audits)).toEqual(['REQUESTED', 'FAILED']);
    expect(rig.audits[1]?.details).toMatchObject({ failureReason: failure, fromAddress: FROM, toAddress: NEXT });
    // No text of a device and nothing that was thrown is in anything written.
    expect(count(`${rig.written()}${JSON.stringify(ended)}`, FAKE_ONVIF_MARKUP_TEXT)).toBe(0);
    if (options.remove === undefined) expectClean(rig, ended);
    else {
      expect(rig.failures.map((entry) => entry.code)).toContain('CAMERA_NETWORK_ALIAS_REMOVAL_NOT_CONFIRMED');
      expect(rig.accounts.every((account) => !account.held())).toBe(true);
      expect(typedIn(rig.written())).toBe(0);
    }
  });

  it('THE WAIT: the new address is asked every 4 s for at most 180 s on the clock, without anything typed; a set of unknown outcome that is never seen ends SET_REFUSED', async () => {
    const rig = rigOf({ set: async (call) => (call.admitHwAddress(MAC) ? { outcome: 'UNKNOWN', reason: 'NO_ANSWER', rejectedCredentialRequests: 0 } : { outcome: 'NOT_SET', reason: 'HW_ADDRESS_REFUSED', rejectedCredentialRequests: 0 }), poll: async (asked) => ({ answered: asked.address === FROM }) });
    const { started, ended } = await rig.job();
    expect(ended).toMatchObject({ state: 'FAILED', failure: 'SET_REFUSED' });
    const polls = rig.calls.filter((call) => call === `poll ${NEXT} from ${OWN}`);
    expect(polls).toHaveLength(CAMERA_NETWORK_SET_WAIT_MS / CAMERA_NETWORK_SET_POLL_MS + 1);
    expect((ended.endedAt ?? 0) - started.startedAt).toBe(CAMERA_NETWORK_SET_WAIT_MS);
    // The set call ended before the first poll of the new address: nothing typed is held during the wait.
    expect(rig.calls.indexOf(`remove ${ALIAS}`)).toBeLessThan(rig.calls.indexOf(`poll ${NEXT} from ${OWN}`));
    expectClean(rig, ended);
  });

  it('the camera appears late: found by the SAME hardware address inside the wait', async () => {
    let asked = 0;
    const rig = rigOf({ poll: async (destination) => ({ answered: destination.address === FROM || (asked += 1) > 20 }) });
    const { started, ended } = await rig.job();
    expect(ended).toMatchObject({ state: 'COMPLETED', confirmedMac: MAC });
    expect((ended.endedAt ?? 0) - started.startedAt).toBe(20 * CAMERA_NETWORK_SET_POLL_MS);
    expect((ended.endedAt ?? 0) - started.startedAt).toBeLessThanOrEqual(CAMERA_NETWORK_SET_WAIT_MS);
  });

  it('THE CORE CLOSES during the wait: the job ends CORE_RESTARTED, holds nothing typed, and the alias address was asked away', async () => {
    let rig: ReturnType<typeof rigOf> | null = null;
    let pauses = 0;
    rig = rigOf({ poll: async (asked) => ({ answered: asked.address === FROM }), onPause: async () => void ((pauses += 1) === 3 && rig?.seams.jobs.stop()) });
    const { ended } = await rig.job();
    expect(ended).toMatchObject({ state: 'FAILED', failure: 'CORE_RESTARTED' });
    expect(pauses).toBe(3);
    expect(phasesOf(rig.audits)).toEqual(['REQUESTED', 'FAILED']);
    expectClean(rig, ended);
  });

  it('a session opens between the start and the set: no set call is made; the closing entry cannot be written: the job still ends and the requested entry stands', async () => {
    let open = false;
    const rig = rigOf({ sessionOpen: () => open, neighbour: () => ((open = true), MAC) });
    const { ended } = await rig.job();
    expect(ended).toMatchObject({ state: 'FAILED', failure: 'SET_REFUSED' });
    expect(rig.calls.filter((call) => call.startsWith('set '))).toEqual([]);
    expect(rig.failures.map((failure) => failure.code)).toEqual(['CAMERA_NETWORK_SESSION_OPENED']);
    expectClean(rig, ended);

    let entries = 0;
    const unwritten = rigOf({
      audit: async () => {
        entries += 1;
        if (entries === 2) throw new Error('no unit');
      },
      set: async () => ({ outcome: 'NOT_SET', reason: 'SET_REFUSED', rejectedCredentialRequests: 0 }) });
    const second = await unwritten.job();
    expect(second.ended).toMatchObject({ state: 'FAILED', failure: 'SET_REFUSED' });
    expect(phasesOf(unwritten.audits)).toEqual(['REQUESTED']);
    expect(unwritten.failures.map((failure) => failure.code)).toEqual(['CAMERA_NETWORK_AUDIT_NOT_WRITTEN']);
    expectClean(unwritten, second.ended);

    const first = rigOf({ audit: () => Promise.reject(new Error('no unit')) });
    await expect(first.job()).rejects.toThrow('no unit');
    expect(cameraCallsOf(first.calls)).toEqual([]);
    expect(aliasCallsOf(first.calls)).toEqual([]);
    expectClean(first);
  });
});

describe('THE LOCK-OUT GUARD: this job is the fourth spender of the ONE count of a camera\'s address', () => {
  const refusing = async (): Promise<CameraNetworkSetAnswer> => ({ outcome: 'NOT_SET', reason: 'CREDENTIAL_REFUSED', rejectedCredentialRequests: 1 });

  it('two refused sign-ins close the guard of the address: the third job is 429 CONNECTION_TEST_LOCKOUT_GUARD and sends nothing; a connection test of that address is refused by the same count', async () => {
    const rig = rigOf({ set: refusing });
    expect(rig.guard.remaining(FROM)).toBe(2);
    expect((await rig.job({ fromAddress: FROM, scannedMac: MAC }, WRONG)).ended.failure).toBe('AUTHENTICATION_FAILED');
    expect(rig.guard.remaining(FROM)).toBe(1);
    expect(rig.audits[1]?.details).not.toHaveProperty('guardTripped');
    // Sooner than the spacing of the guard: refused, nothing sent.
    const before = rig.calls.length;
    const spaced = await refusalOf(rig.job({ fromAddress: FROM, scannedMac: MAC }, WRONG));
    expect(spaced.answer).toEqual([429, 'RATE_LIMITED', 'CONNECTION_TEST_RATE_LIMITED']);
    expect(rig.calls.slice(before)).toEqual([]);

    rig.advance(6_000);
    expect((await rig.job({ fromAddress: FROM, scannedMac: MAC }, WRONG)).ended.failure).toBe('AUTHENTICATION_FAILED');
    expect(rig.guard.remaining(FROM)).toBe(0);
    expect(rig.audits[3]?.details).toMatchObject({ phase: 'FAILED', failureReason: 'AUTHENTICATION_FAILED', guardTripped: true });

    rig.advance(6_000);
    const mark = rig.calls.length;
    const closed = await refusalOf(rig.job({ fromAddress: FROM, scannedMac: MAC }));
    expect(closed.answer).toEqual([429, 'RATE_LIMITED', 'CONNECTION_TEST_LOCKOUT_GUARD']);
    expect(closed.failure.headers).toHaveProperty('retry-after');
    // The refusal came before anything was asked: no "does it answer", no alias address, no poll, no set, no entry.
    expect(rig.calls.slice(mark)).toEqual([]);
    expect(rig.audits).toHaveLength(4);
    // THE SAME COUNT the connection tests ask (operations 95 and 96), by address: another session is refused too; another address is not.
    expect(rig.guard.refusal(FROM, 'a-connection-test')?.reason).toBe('CONNECTION_TEST_LOCKOUT_GUARD');
    expect(rig.guard.refusal('192.168.1.108', 'a-connection-test')).toBeNull();
    expectClean(rig, closed.text, spaced.text);
  });

  it('a refused sign-in of a connection test counts against the job, and a successful set clears the count of the address the camera left', async () => {
    const rig = rigOf();
    rig.guard.begin(FROM, 'a-connection-test').end('AUTHENTICATION_FAILED', 1);
    expect(rig.guard.remaining(FROM)).toBe(1);
    rig.advance(6_000);
    expect((await rig.job()).ended.state).toBe('COMPLETED');
    expect(rig.guard.remaining(FROM)).toBe(2);
  });

  it('a set call that throws is "not known", which counts once; a refusal that sent nothing typed and a mismatch of the hardware address count nothing', async () => {
    const thrown = rigOf({ set: () => Promise.reject(new Error('fault')) });
    await thrown.job();
    expect(thrown.guard.remaining(FROM)).toBe(1);
    expect(thrown.failures.map((failure) => failure.code)).toEqual(['CAMERA_NETWORK_SET_CALL_FAILED']);

    const scheme = rigOf({ set: async () => ({ outcome: 'NOT_SET', reason: 'SCHEME_NOT_ALLOWED', rejectedCredentialRequests: 0 }) });
    await scheme.job();
    expect(scheme.guard.remaining(FROM)).toBe(2);

    const mismatch = rigOf({ neighbour: () => OTHER_MAC });
    await mismatch.job();
    expect(mismatch.guard.remaining(FROM)).toBe(2);
    // A job that ended before the set call gave its turn back unused.
    const early = rigOf({ poll: async () => ({ answered: false }) });
    await early.job();
    expect(early.guard.busy()).toBe(false);
    expect(early.guard.remaining(FROM)).toBe(2);
  });
});

// ── Block 2: the fake ONVIF stub on loopback, the REAL set-network file and the REAL clock read ──
describe('against the fake ONVIF stub (loopback): the whole sequence through the real set-network file; what is typed never leaves but as a Digest answer, and never toward the new address', () => {
  const open: FakeOnvifStub[] = [];
  afterEach(async () => {
    for (const stub of open.splice(0)) await stub.stop();
  });
  const timers = createSystemTimers();
  const reader = createOnvifTimeReader({ timers });
  const candidateAt = (port: number): CameraCandidate => ({ adapterKind: CaptureAdapterKind.FAKE, host: FAKE_ONVIF_HOST, serviceAddress: `http://${FAKE_ONVIF_HOST}:${String(port)}/onvif/device_service`, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false });

  /** ONE camera at the factory address; when it applies a new address it answers on `moved` (the new address of this block). */
  async function network(options: FakeOnvifStubOptions['network'], rigOptions: RigOptions = {}) {
    const ports: FakeOnvifPorts = await freeFakeOnvifPorts();
    const moved: FakeOnvifPorts = await freeFakeOnvifPorts();
    const stub = createFakeOnvifStub({ ports, credential: ACCOUNT, network: { gatewayReadBack: true, ...options, ...(options?.onApply === 'MOVE' ? { movedPorts: moved } : {}) } });
    await stub.start();
    open.push(stub);
    const dialled: string[] = [];
    // THE MAPPING OF THIS FILE. The product's rule judges the real address first; only what it admits is mapped to loopback.
    const set = cameraNetworkSetterOf(timers, (host, facts) => {
      const decision = RULE(host, facts);
      if (decision.allowed !== true) return decideDestination({ purpose: DestinationPurpose.SET_IP, address: host }, facts);
      dialled.push(`${decision.destination.address} from ${String(decision.destination.sourceAddress)} alias=${String(decision.destination.viaAlias)}`);
      return { allowed: true, destination: { address: FAKE_ONVIF_HOST, port: ports.device, sourceAddress: FAKE_ONVIF_HOST, viaAlias: decision.destination.viaAlias === true } };
    });
    const rig = rigOf({
      poll: async (destination, signal) => {
        if (destination.address !== FROM) await stub.networkSettled();
        return reader.read(candidateAt(destination.address === FROM ? ports.device : moved.device), signal, FAKE_ONVIF_HOST);
      },
      set,
      // THE HOST'S NEIGHBOUR TABLE of this block: the hardware address of whatever listens where the address is mapped to.
      neighbour: (address) => (address === FROM || stub.networkState().location === 'MOVED' ? stub.networkState().hwAddress.toUpperCase() : null),
      onPause: () => stub.networkSettled(),
      ...rigOptions,
    });
    return { stub, rig, ports, moved, dialled };
  }
  const authorized = (stub: FakeOnvifStub) => stub.httpRequests().filter((request) => request.authorizationPresent || request.wsSecurity === 'DIGEST' || request.wsSecurity === 'CLEAR');
  /** The password never leaves in clear and never as Basic; the unauthenticated poll carries nothing. */
  function expectDigestOnly(stub: FakeOnvifStub): void {
    expect(stub.httpRequests().filter((request) => request.authorizationScheme === 'Basic' || request.wsSecurity === 'CLEAR')).toEqual([]);
    expect(stub.httpRequests().filter((request) => request.authorizationPresent && request.authorizationScheme !== 'Digest')).toEqual([]);
    expect(stub.httpRequests().filter((request) => request.operation === 'GetSystemDateAndTime').map((request) => [request.authorizationPresent, request.wsSecurity])).toEqual(stub.httpRequests().filter((request) => request.operation === 'GetSystemDateAndTime').map(() => [false, 'NONE']));
    expect(stub.violations()).toEqual([]);
  }

  it('THE CAMERA APPLIES THE ADDRESS: the same hardware address is found at the new address inside 180 s; at most 3 authenticated reads; nothing typed is sent to the new address; 0 occurrences of what was typed', async () => {
    const { stub, rig, ports, moved, dialled } = await network({ onApply: 'MOVE' });
    const { started, ended } = await rig.job({ fromAddress: FROM, scannedMac: MAC, gateway: '192.168.50.254' });
    expect(ended).toMatchObject({ state: 'COMPLETED', fromAddress: FROM, toAddress: NEXT, neighbourMac: MAC, authenticatedMac: MAC, confirmedMac: MAC, failure: null });
    expect((ended.endedAt ?? 0) - started.startedAt).toBeLessThanOrEqual(CAMERA_NETWORK_SET_WAIT_MS);
    // What the camera was told: ONE static address with the prefix of the configuration, the gateway, one reboot.
    expect(stub.networkState()).toMatchObject({ location: 'MOVED', address: NEXT, prefixLength: 24, dhcp: false, gateway: '192.168.50.254', rebootCount: 1, pending: null });
    expect(stub.networkRequests().every((request) => request.wellFormed && request.accepted)).toBe(true);
    // The set call dialled the factory address FROM THE ALIAS ADDRESS (the rule's own answer), and nothing else.
    expect(new Set(dialled)).toEqual(new Set([`${FROM} from ${ALIAS} alias=true`]));
    expectDigestOnly(stub);
    // The first request at the camera is the unauthenticated poll; everything typed went to the OLD place only.
    expect(stub.httpRequests()[0]).toMatchObject({ listener: 'ORIGINAL', port: ports.device, operation: 'GetSystemDateAndTime', authorizationPresent: false });
    expect(authorized(stub).every((request) => request.listener === 'ORIGINAL')).toBe(true);
    const atNew = stub.httpRequests().filter((request) => request.listener === 'MOVED');
    expect(atNew.length).toBeGreaterThanOrEqual(1);
    expect(atNew.map((request) => [request.port, request.operation, request.authorizationPresent, request.wsSecurity])).toEqual(atNew.map(() => [moved.device, 'GetSystemDateAndTime', false, 'NONE']));
    // Authenticated READS of the job: the interface read and the gateway read-back of the set call.
    const reads = authorized(stub).filter((request) => request.operation === 'GetNetworkInterfaces' || request.operation === 'GetNetworkDefaultGateway');
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(reads.length).toBeLessThanOrEqual(CAMERA_NETWORK_SET_MAX_AUTHENTICATED_READS);
    expect(phasesOf(rig.audits)).toEqual(['REQUESTED', 'COMPLETED']);
    expect(aliasCallsOf(rig.calls).map((call) => call.split(' ')[0])).toEqual(['add', 'remove']);
    expect(rig.guard.remaining(FROM)).toBe(2);
    expectClean(rig, started, ended);
  });

  it('THE CAMERA ACCEPTS AND DOES NOT APPLY: it never answers at the new address - NOT_FOUND_AT_NEW_ADDRESS after the whole wait, the alias address away before it', async () => {
    const { stub, rig } = await network({ onApply: 'NOT_APPLIED' });
    const { started, ended } = await rig.job();
    expect(ended).toMatchObject({ state: 'FAILED', failure: 'NOT_FOUND_AT_NEW_ADDRESS', authenticatedMac: MAC, confirmedMac: null });
    expect((ended.endedAt ?? 0) - started.startedAt).toBe(CAMERA_NETWORK_SET_WAIT_MS);
    expect(stub.networkState()).toMatchObject({ location: 'ORIGINAL', changesNotApplied: 1 });
    expect(rig.calls.indexOf(`remove ${ALIAS}`)).toBeLessThan(rig.calls.indexOf(`poll ${NEXT} from ${OWN}`));
    expectDigestOnly(stub);
    expectClean(rig, ended);
  });

  it('THE CONFLICT FLAG and AN ADDRESS THAT ANSWERS: refused with 0 requests at the stub', async () => {
    const conflict = await network({ onApply: 'MOVE' }, { lastScanOf: (_address, now) => ({ deviceCount: 'MORE_THAN_ONE', mac: MAC, scannedAt: now }) });
    expect((await refusalOf(conflict.rig.job())).answer).toEqual([409, 'INVALID_STATE', 'CAMERA_ADDRESS_CONFLICT']);
    expect(conflict.stub.httpRequests()).toEqual([]);
    expect(conflict.stub.requestLog()).toEqual([]);
    const answering = await network({ onApply: 'MOVE' }, { answers: () => true });
    expect((await refusalOf(answering.rig.job({ fromAddress: FROM, scannedMac: MAC, toAddress: NEXT }))).answer).toEqual([409, 'INVALID_STATE', 'CAMERA_NEW_ADDRESS_IN_USE']);
    expect(answering.stub.httpRequests()).toEqual([]);
    expectClean(conflict.rig);
    expectClean(answering.rig);
  });

  it('A WRONG ACCOUNT: one refused Digest answer per job, nothing set; the second closes the guard and the third job reaches the stub with 0 requests', async () => {
    const { stub, rig } = await network({ onApply: 'MOVE' });
    const first = await rig.job({ fromAddress: FROM, scannedMac: MAC }, WRONG);
    expect(first.ended).toMatchObject({ state: 'FAILED', failure: 'AUTHENTICATION_FAILED', neighbourMac: MAC, authenticatedMac: null });
    expect(stub.networkRequests()).toEqual([]);
    expect(stub.networkState()).toMatchObject({ location: 'ORIGINAL', address: FAKE_ONVIF_NETWORK_DEFAULTS.address, rebootCount: 0 });
    expect(authorized(stub)).toHaveLength(1);
    expect(rig.guard.remaining(FROM)).toBe(1);
    rig.advance(6_000);
    const second = await rig.job({ fromAddress: FROM, scannedMac: MAC }, WRONG);
    expect(second.ended.failure).toBe('AUTHENTICATION_FAILED');
    expect(authorized(stub)).toHaveLength(2);
    expect(rig.guard.remaining(FROM)).toBe(0);
    expect(rig.audits.at(-1)?.details).toMatchObject({ guardTripped: true });
    rig.advance(6_000);
    const seen = stub.httpRequests().length;
    expect((await refusalOf(rig.job())).answer).toEqual([429, 'RATE_LIMITED', 'CONNECTION_TEST_LOCKOUT_GUARD']);
    expect(stub.httpRequests()).toHaveLength(seen);
    expectDigestOnly(stub);
    expectClean(rig, first.ended, second.ended);
  });

  it('THE DEVICE STATES ANOTHER HARDWARE ADDRESS than the neighbour table: the interface read is made, NO set request reaches the camera', async () => {
    // Row V6 (R119-04): the scan row and the neighbour table agree on ONE address, the technician sent that one, and the
    // DEVICE that answers the sign-in states another: the hook of the real set-network file, bound here, refuses it.
    const { stub, rig } = await network({ onApply: 'MOVE' }, { neighbour: () => OTHER_MAC, lastScanOf: (_address, now) => ({ deviceCount: 'NOT_KNOWN', mac: OTHER_MAC, scannedAt: now }) });
    const { ended } = await rig.job({ fromAddress: FROM, scannedMac: OTHER_MAC });
    expect(ended).toMatchObject({ state: 'FAILED', failure: 'MAC_MISMATCH', scannedMac: OTHER_MAC, neighbourMac: OTHER_MAC, authenticatedMac: MAC, confirmedMac: null });
    expect(stub.networkRequests().map((request) => request.operation)).toEqual(['GetNetworkInterfaces']);
    expect(stub.networkState()).toMatchObject({ location: 'ORIGINAL', address: FAKE_ONVIF_NETWORK_DEFAULTS.address, pending: null });
    expect(rig.guard.remaining(FROM)).toBe(2);
    expectDigestOnly(stub);
    expectClean(rig, ended);
  });

  it('row V6 (R119-04) THE HOST NOW SEES ANOTHER DEVICE THAN THE TECHNICIAN SAW: the job ends MAC_MISMATCH with NO request that carries the typed account at the stub; the device the neighbour table agrees with but that states another address than the technician saw is not set either', async () => {
    // The table flipped between the scan and the job (the first sign of two devices on one address).
    const flipped = await network({ onApply: 'MOVE' }, { neighbour: () => OTHER_MAC });
    const { ended } = await flipped.rig.job();
    expect(ended).toMatchObject({ state: 'FAILED', step: 'DONE', failure: 'MAC_MISMATCH', scannedMac: MAC, deviceCount: 'NOT_KNOWN', neighbourMac: OTHER_MAC, authenticatedMac: null, confirmedMac: null });
    // Not one request of the set-network file: the interface read is the FIRST request that carries the account, and it was not made.
    expect(flipped.stub.networkRequests()).toEqual([]);
    expect(flipped.stub.networkState()).toMatchObject({ location: 'ORIGINAL', pending: null });
    expect(flipped.rig.guard.remaining(FROM)).toBe(2);
    expect(flipped.rig.audits.map((entry) => entry.details)).toMatchObject([{ phase: 'REQUESTED', deviceCount: 'NOT_KNOWN' }, { phase: 'FAILED', deviceCount: 'NOT_KNOWN', failureReason: 'MAC_MISMATCH' }]);
    expectClean(flipped.rig, ended);

    // The bound value reaches the hook: with the table and the DEVICE agreeing on the stub's own address, a job bound to
    // ANOTHER address cannot even start (the scan row showed the stub's), so the only way to the hook with a different
    // technician value is closed before the job exists.
    const other = await network({ onApply: 'MOVE' });
    expect((await refusalOf(other.rig.job({ fromAddress: FROM, scannedMac: OTHER_MAC }))).answer).toEqual([409, 'INVALID_STATE', 'CAMERA_HARDWARE_ADDRESS_NOT_BOUND']);
    expect(other.stub.httpRequests()).toEqual([]);
    expectClean(other.rig);
  });

  it('HOSTILE REPLIES: a malformed interface answer and a token with markup set nothing; markup in the device\'s free text changes nothing and is written nowhere', async () => {
    const malformed = await network({ onApply: 'MOVE' });
    malformed.stub.setNetworkMode('MALFORMED_REPLY', 'GetNetworkInterfaces');
    expect((await malformed.rig.job()).ended).toMatchObject({ state: 'FAILED', failure: 'SET_REFUSED', authenticatedMac: null });
    expect(malformed.stub.networkRequests().map((request) => request.operation)).toEqual(['GetNetworkInterfaces']);
    expectClean(malformed.rig);

    const token = await network({ onApply: 'MOVE' });
    token.stub.setNetworkMode('MARKUP_TOKEN');
    expect((await token.rig.job()).ended).toMatchObject({ state: 'FAILED', failure: 'SET_REFUSED', authenticatedMac: MAC });
    expect(token.stub.networkRequests().filter((request) => request.operation === 'SetNetworkInterfaces')).toEqual([]);
    expect(token.stub.networkRequests().every((request) => request.wellFormed)).toBe(true);
    expectClean(token.rig);

    const text = await network({ onApply: 'MOVE' });
    text.stub.setNetworkMode('MARKUP_TEXT');
    const done = await text.rig.job();
    expect(done.ended).toMatchObject({ state: 'COMPLETED', confirmedMac: MAC });
    expect(count(`${text.rig.written()}${JSON.stringify(done)}`, FAKE_ONVIF_MARKUP_TEXT)).toBe(0);
    expectDigestOnly(text.stub);
    expectClean(text.rig, done);
  });
});

describe('static: the folder holds nothing typed outside the ONE call site, and has no way to a stored account', () => {
  const folder = fileURLToPath(new URL('..', import.meta.url));
  const sources = readdirSync(folder).filter((name) => name.endsWith('.ts')).map((name) => ({ name, text: readFileSync(join(folder, name), 'utf8') }));
  const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('the files of the folder', () => {
    expect(sources.map((source) => source.name).sort()).toEqual(['index.ts', 'routes.ts', 'service.ts', 'store.ts']);
  });

  it('the two members of the typed account are read ONCE, in the route, into the opaque object; no other file names either', () => {
    const reads = sources.flatMap((source) => (code(source.text).match(/\.\s*(?:username|secret|password)\b/g) ?? []).map((found) => `${source.name} ${found}`));
    expect(reads).toEqual(['routes.ts .username', 'routes.ts .secret']);
    const routes = code(sources.find((source) => source.name === 'routes.ts')?.text ?? '');
    expect(routes).toContain('holdTypedAccount(sealCredential({ username: body.credential.username, secret: body.credential.secret }))');
    expect(routes).toContain("Reflect.deleteProperty(body, 'credential');");
    expect(routes.match(/sealCredential\(/g)).toHaveLength(1);
  });

  it('no file imports the credential reader, the holders, the reveal module or a credential store; none opens what is sealed; the job record and the audit details have no member for it', () => {
    for (const source of sources) {
      const text = code(source.text);
      expect(text, source.name).not.toMatch(/credential-reader|credential-holders|credential-reveal|credential-store|usingCredential|credentialAtInjection|startMessageBytes/);
      expect(text, source.name).not.toMatch(/\bconsole\s*\.|process\s*\.\s*(?:env|argv)|child_process|node:net|node:dgram|node:fs/);
    }
    const service = code(sources.find((source) => source.name === 'service.ts')?.text ?? '');
    // The opaque object is named by ONE holder, taken by ONE function, handed to ONE call.
    expect(service.match(/account\.take\(\)/g)).toHaveLength(1);
    expect(service.match(/credential: used,/g)).toHaveLength(1);
    expect(service.match(/\bcredential\b/g)).toEqual(['credential', 'credential']);
    const record = service.slice(service.indexOf('export interface JobRecord'), service.indexOf('const answerOf'));
    expect(record).not.toMatch(/credential|account|typed|sealed/i);
    expect(service).not.toMatch(/details:\s*\{[^}]*(?:account|credential|username|secret)/);
  });
});
