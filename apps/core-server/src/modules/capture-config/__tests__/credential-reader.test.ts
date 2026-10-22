// The credential reader without a database (task 4 blueprint row 45, WP-06a; security check 04,
// requirement AD-03 points 1 and 2): what is true of the reader whatever stands behind it.
//
//   - the holders are a closed list, each given its own reader ONCE, bound to its own reasons;
//   - no method takes a reason; the reasons of the holders are exactly the closed set of three the
//     audit writer accepts;
//   - a request that is not a device id (or, for an operator, an operator id) sends nothing;
//   - a unit runner that resolves WITHOUT a commit yields no credential: the reader takes the
//     commit from the unit, not from the runner it was handed;
//   - the reveal module turns a stored row into an answer and never throws for its form.
//
// The unit, the opener and the error log are doubles here. The same paths against PostgreSQL, the
// real pipeline and the real credential store are in `credential-reader.db.test.ts`.
// Placeholders only: built from parts, never a real account.
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { recordingErrorLog } from '../../../../test/support/core';
import { CREDENTIAL_MARK, SealedCredential, usingCredential } from '../../../capture/adapters';
import type { AuditEntry, UnitContext } from '../../../core';
import { CAPTURE_CREDENTIAL_REVEAL_REASONS } from '../../../core/audit-details';
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../capture/destination-rule';
import { ONVIF_DEVICE_SERVICE_DEFAULT_PORT } from '../../../capture/adapters/camera/stored-address';
import { READ_CAPTURE_CREDENTIAL_DEVICE, wireCaptureCredentialHolders } from '../credential-holders';
import {
  CAPTURE_CREDENTIAL_HOLDERS,
  CAPTURE_CREDENTIAL_REVEAL_UNIT,
  CaptureCredentialHolder,
  CaptureCredentialReadError,
  STORED_ADDRESS_DEFAULT_PORT,
  StoredAddressRefusal,
  createCaptureCredentialReaders,
  type CameraAdapterCredentialReader,
  type CaptureCredentialDevice,
  type CaptureCredentialReaderDependencies,
  type ConnectionTestCredentialReader,
} from '../credential-reader';
import { CAPTURE_CREDENTIAL_ENCRYPTION, REVEAL_CAPTURE_CREDENTIAL, revealCaptureCredential } from '../credential-reveal';

const PLACEHOLDER = { username: ['row45', 'unit', 'account'].join('-'), secret: ['row45', 'unit', 'placeholder', 'Hd3Kq9'].join('-') } as const;
const NEEDLES = [PLACEHOLDER.username, PLACEHOLDER.secret];
const leaks = (text: string): string[] => NEEDLES.filter((needle) => text.includes(needle));
/** Every print form of a value (the assertions of `capture/adapters/__tests__/credential.test.ts`). */
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
    inspect(new Error('carrier', { cause: value }), { depth: 8 }),
  ].join('\n');

const storedRow = () => ({ username: PLACEHOLDER.username, encryption: CAPTURE_CREDENTIAL_ENCRYPTION, secret_ciphertext: Buffer.alloc(80, 7), nonce: Buffer.alloc(12, 9), key_ref: 'CAPTURE_DEVICE_K_00000000000000000000' });

/**
 * The host of the gate cases (row 144): a camera interface on 192.168.50.0/24 and an office
 * interface on 10.20.0.0/24. The rule is the REAL one (`capture/destination-rule.ts`), bound as the
 * production composition will bind it; no permissive rule exists in this file.
 */
const HOST: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  // R-FLEX NW-C1 (row 136): the eligible interfaces the global STORED_CAMERA rule reads; without them it is NOT_CONFIGURED (RF-N7, RM-N4).
  interfaceSubnets: [
    { name: 'eth1', address: '192.168.50.1', network: '192.168.50.0', prefixLength: 24 },
    { name: 'eth0', address: '10.20.0.5', network: '10.20.0.0', prefixLength: 24 },
  ],
  hostAddresses: ['192.168.50.1', '10.20.0.5'],
};
const realRule: CaptureCredentialReaderDependencies['storedAddress'] = (address, port) =>
  decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address, ...(port === undefined ? {} : { port }) }, HOST);
const PRODUCTION_CAMERA: CaptureCredentialDevice = { kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', address: '192.168.50.21' };
/** Row 145: the session the camera adapter's two reasons are said for (the form of a session id; no such session exists anywhere). */
const SESSION = 'SES-20261013-0145';

interface Rig {
  readonly dependencies: CaptureCredentialReaderDependencies;
  readonly errorLog: ReturnType<typeof recordingErrorLog>;
  readonly statements: { text: string; values: readonly unknown[] | undefined }[];
  readonly entries: AuditEntry[];
  readonly labels: string[];
  opened: number;
}

/**
 * A unit runner on doubles. `commits: true` behaves as the pipeline does (the tasks registered
 * with `afterCommit` run when the work returned, before the runner resolves); `false` resolves
 * with the work's value and never commits.
 */
function rig(options: { commits: boolean; rows?: unknown[]; open?: () => string; device?: CaptureCredentialReaderDependencies['device']; storedAddress?: CaptureCredentialReaderDependencies['storedAddress'] }): Rig {
  const errorLog = recordingErrorLog();
  const out: Rig = {
    errorLog,
    statements: [],
    entries: [],
    labels: [],
    opened: 0,
    dependencies: {
      errorLog,
      // Row 144: what is stored for the device, and the destination rule. By default a registered
      // production camera at an address the REAL rule allows on the host of `HOST` below.
      device: options.device ?? (async () => PRODUCTION_CAMERA),
      storedAddress: options.storedAddress ?? realRule,
      open: () => {
        out.opened += 1;
        return (options.open ?? (() => PLACEHOLDER.secret))();
      },
      async unit(label, work) {
        out.labels.push(label);
        const tasks: (() => void)[] = [];
        const unit = {
          label,
          id: 1,
          query: async (text: string, values?: readonly unknown[]) => {
            out.statements.push({ text, values });
            return { rows: options.rows ?? [storedRow()] };
          },
          audit: {
            append: async (entry: AuditEntry) => {
              out.entries.push(entry);
              return entry;
            },
          },
          afterCommit: (task: () => void) => void tasks.push(task),
        } as unknown as UnitContext;
        const value = await work(unit);
        if (options.commits) for (const task of tasks) task();
        return value;
      },
    },
  };
  return out;
}

const refusal = async (pending: Promise<unknown>): Promise<unknown> => pending.then(() => 'answered', (error: unknown) => error);
const codeOf = async (pending: Promise<unknown>): Promise<unknown> => {
  const error = await refusal(pending);
  return error instanceof CaptureCredentialReadError ? error.code : error;
};

describe('AD-03 (1): a closed list of holders, each bound to its reasons', () => {
  it('the holders are two; their reasons together are exactly the closed set of the audit writer, each said by one holder', () => {
    expect(Object.keys(CAPTURE_CREDENTIAL_HOLDERS)).toEqual(Object.values(CaptureCredentialHolder));
    expect(Object.values(CaptureCredentialHolder)).toEqual(['CAMERA_ADAPTER', 'CONNECTION_TEST']);
    const said = Object.values(CAPTURE_CREDENTIAL_HOLDERS).flat();
    expect(said).toEqual([...CAPTURE_CREDENTIAL_REVEAL_REASONS]);
    expect(new Set(said).size).toBe(said.length);
    // Nothing adds a holder or a reason at run time.
    expect(Object.isFrozen(CAPTURE_CREDENTIAL_HOLDERS)).toBe(true);
    for (const reasons of Object.values(CAPTURE_CREDENTIAL_HOLDERS)) expect(Object.isFrozen(reasons)).toBe(true);
  });

  it('each holder takes its reader once; a second request, a name outside the list and an inherited name are refused', () => {
    const handout = createCaptureCredentialReaders(rig({ commits: true }).dependencies);
    expect(Object.keys(handout)).toEqual(['take']);
    expect(Object.isFrozen(handout)).toBe(true);
    const adapter = handout.take(CaptureCredentialHolder.CAMERA_ADAPTER);
    const test = handout.take(CaptureCredentialHolder.CONNECTION_TEST);
    for (const name of ['CAMERA_ADAPTER', 'CONNECTION_TEST', 'SET_IP_JOB', 'MEDIA_DIAGNOSTICS', 'SESSION_OPEN', 'toString', 'constructor', '__proto__', '', undefined, null, 7]) {
      let thrown: unknown = 'answered';
      try {
        handout.take(name as never);
      } catch (error) {
        thrown = error;
      }
      expect(thrown instanceof CaptureCredentialReadError ? thrown.code : thrown, String(name)).toBe('CAPTURE_CREDENTIAL_HOLDER_REFUSED');
    }
    // What a holder has: its own methods and nothing that names another holder's reason.
    expect([Object.keys(adapter), Object.keys(test)]).toEqual([['sessionOpen', 'relayRestart'], ['connectionTest']]);
    expect([Object.isFrozen(adapter), Object.isFrozen(test)]).toEqual([true, true]);
    // No method has a reason parameter: the device, then the session (row 145) and for the connection test the operator.
    expect([adapter.sessionOpen.length, adapter.relayRestart.length, test.connectionTest.length]).toEqual([2, 2, 2]);
  });

  it('every method writes its own reason and no other, whatever further arguments a caller adds', async () => {
    const built = rig({ commits: true });
    const handout = createCaptureCredentialReaders(built.dependencies);
    const adapter = handout.take(CaptureCredentialHolder.CAMERA_ADAPTER);
    const test = handout.take(CaptureCredentialHolder.CONNECTION_TEST);
    await adapter.sessionOpen('CAM-01', SESSION);
    await adapter.relayRestart('CAM-01', SESSION);
    await test.connectionTest('CAM-01', 'OPR-002');
    // A caller that passes a reason anyway is not heard.
    await (adapter.sessionOpen as unknown as (...parameters: unknown[]) => Promise<unknown>)('CAM-02', SESSION, 'CONNECTION_TEST', 'OPR-001');
    await (test.connectionTest as unknown as (...parameters: unknown[]) => Promise<unknown>)('CAM-02', 'OPR-003', 'SESSION_OPEN', SESSION);
    expect(built.entries.map((entry) => [entry.type, entry.actorId, entry.deviceId, entry.details])).toEqual([
      ['CAPTURE_CREDENTIAL_REVEALED', null, 'CAM-01', { deviceId: 'CAM-01', reason: 'SESSION_OPEN' }],
      ['CAPTURE_CREDENTIAL_REVEALED', null, 'CAM-01', { deviceId: 'CAM-01', reason: 'RELAY_RESTART' }],
      ['CAPTURE_CREDENTIAL_REVEALED', 'OPR-002', 'CAM-01', { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' }],
      ['CAPTURE_CREDENTIAL_REVEALED', null, 'CAM-02', { deviceId: 'CAM-02', reason: 'SESSION_OPEN' }],
      ['CAPTURE_CREDENTIAL_REVEALED', 'OPR-003', 'CAM-02', { deviceId: 'CAM-02', reason: 'CONNECTION_TEST' }],
    ]);
    // An entry has the members of an audit entry and no other (no time). Row 145: a session's reveal
    // has the session as a member of the ROW; the connection test's entry has no such member at all,
    // also when a caller adds a session after the operator. The details are two keys in every entry.
    expect(built.entries.map((entry) => Object.keys(entry).sort().join())).toEqual([
      'actorId,details,deviceId,message,sessionId,type',
      'actorId,details,deviceId,message,sessionId,type',
      'actorId,details,deviceId,message,type',
      'actorId,details,deviceId,message,sessionId,type',
      'actorId,details,deviceId,message,type',
    ]);
    expect(built.entries.map((entry) => entry.sessionId)).toEqual([SESSION, SESSION, undefined, SESSION, undefined]);
    for (const entry of built.entries) expect(Object.keys(entry.details).sort()).toEqual(['deviceId', 'reason']);
    expect(new Set(built.labels)).toEqual(new Set([CAPTURE_CREDENTIAL_REVEAL_UNIT]));
    // One statement per read, the constant text, the device as its one bind parameter.
    expect(built.statements).toEqual(['CAM-01', 'CAM-01', 'CAM-01', 'CAM-02', 'CAM-02'].map((deviceId) => ({ text: REVEAL_CAPTURE_CREDENTIAL, values: [deviceId] })));
  });

  it('a request that is not a device id, or names no operator, sends nothing and writes nothing', async () => {
    const built = rig({ commits: true });
    const handout = createCaptureCredentialReaders(built.dependencies);
    const adapter = handout.take(CaptureCredentialHolder.CAMERA_ADAPTER);
    const test = handout.take(CaptureCredentialHolder.CONNECTION_TEST);
    for (const deviceId of ['', 'cam-01', "CAM-01'; --", 'CAM 01', 'DSC-0001/..', `A${'1'.repeat(40)}`, null, undefined, 7, { toString: () => 'CAM-01' }]) {
      expect(await codeOf(adapter.sessionOpen(deviceId as never, SESSION)), String(deviceId)).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
      expect(await codeOf(adapter.relayRestart(deviceId as never, SESSION)), String(deviceId)).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
    }
    // Row 145 (AD-03 (3)): a session's reason without a session, or with a text that is no session id, sends nothing either.
    for (const sessionId of [undefined, null, '', 'SESSION_OPEN', 'ses-20261013-0145', 'SES-20261013-145', 'SES-20261013-0145 ', "SES-20261013-0145'; --", 'OPR-001', 20261013, { toString: () => SESSION }]) {
      expect(await codeOf(adapter.sessionOpen('CAM-01', sessionId as never)), String(sessionId)).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
      expect(await codeOf(adapter.relayRestart('CAM-01', sessionId as never)), String(sessionId)).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
    }
    for (const operatorId of ['', 'operator', 'OPR-1', 'opr-001', null, undefined, 3]) {
      expect(await codeOf(test.connectionTest('CAM-01', operatorId as never)), String(operatorId)).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
    }
    expect([built.labels.length, built.statements.length, built.entries.length, built.opened]).toEqual([0, 0, 0, 0]);
  });
});

describe('AD-03 (2): a credential only after the commit of its entry', () => {
  it('a runner that commits: the opaque credential, opened once, after the entry', async () => {
    const built = rig({ commits: true });
    const adapter = createCaptureCredentialReaders(built.dependencies).take(CaptureCredentialHolder.CAMERA_ADAPTER);
    const credential = await adapter.sessionOpen('CAM-01', SESSION);
    expect(credential).toBeInstanceOf(SealedCredential);
    expect(usingCredential(credential, (inner) => inner.username === PLACEHOLDER.username && inner.secret === PLACEHOLDER.secret)).toBe(true);
    expect([built.entries.length, built.opened, built.errorLog.entries.length]).toEqual([1, 1, 0]);
    // Nothing printable carries either value; the control shows the search finds them in a plain object.
    expect(leaks(everything(credential))).toEqual([]);
    expect(String(credential)).toBe(CREDENTIAL_MARK);
    expect(leaks(everything({ ...PLACEHOLDER }))).toEqual(NEEDLES);
  });

  it('a runner that resolves WITHOUT a commit: no credential, the envelope is never opened, one error-log code', async () => {
    const built = rig({ commits: false });
    const adapter = createCaptureCredentialReaders(built.dependencies).take(CaptureCredentialHolder.CAMERA_ADAPTER);
    const error = await refusal(adapter.sessionOpen('CAM-01', SESSION));
    expect(error).toBeInstanceOf(CaptureCredentialReadError);
    expect((error as CaptureCredentialReadError).code).toBe('CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED');
    expect(built.opened).toBe(0);
    expect(built.errorLog.entries.map((entry) => [entry.level, entry.source, entry.code, entry.context])).toEqual([['error', 'captureConfig.credentialReader', 'CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', { deviceId: 'CAM-01', reason: 'SESSION_OPEN' }]]);
    expect(leaks(everything(error))).toEqual([]);
  });

  // Row 145: "after the commit is acknowledged" on a runner whose commit can be held, refused or lost.
  // The same on PostgreSQL, with a COMMIT that really waits, is in `credential-reader.db.test.ts`.
  it('row 145: while the commit is not acknowledged nothing leaves the reader - the read is pending and the envelope is not opened; acknowledged: 1 credential', async () => {
    const built = rig({ commits: true });
    const runUnit = built.dependencies.unit;
    let acknowledge: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (acknowledge = resolve));
    let workReturned = false;
    const adapter = createCaptureCredentialReaders({
      ...built.dependencies,
      // The work has returned (the statement and the append are done); the commit waits for `held`.
      unit: async (label, work) => {
        const tasks: (() => void)[] = [];
        const value = await runUnit(label, (unit) => work({ ...unit, afterCommit: (task: () => void) => void tasks.push(task) } as UnitContext));
        workReturned = true;
        await held;
        for (const task of tasks) task();
        return value;
      },
    }).take(CaptureCredentialHolder.CAMERA_ADAPTER);
    let settled: unknown = 'pending';
    const pending = adapter.sessionOpen('CAM-01', SESSION).then((credential) => (settled = credential), (error: unknown) => (settled = error));
    for (let turn = 0; turn < 50 && !workReturned; turn += 1) await new Promise((resolve) => setImmediate(resolve));
    for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve));
    expect([workReturned, settled, built.entries.length, built.statements.length, built.opened]).toEqual([true, 'pending', 1, 1, 0]);
    acknowledge();
    await pending;
    expect(settled).toBeInstanceOf(SealedCredential);
    expect([built.opened, built.errorLog.entries.length]).toEqual([1, 0]);
  });

  it('row 145: a commit that is refused, lost or abandoned after the work returned - the runner rejects - gives no credential, whatever the runner did before', async () => {
    for (const [name, ranTasks] of [['the commit is refused: no task ran', false], ['the acknowledgement is lost: the tasks ran, then the runner rejected', true]] as const) {
      const built = rig({ commits: ranTasks });
      const runUnit = built.dependencies.unit;
      const adapter = createCaptureCredentialReaders({
        ...built.dependencies,
        unit: async (label, work) => {
          await runUnit(label, work);
          // What the pipeline rejects with carries a code; nothing of it travels with the reader's error.
          throw Object.assign(new Error(`commit of ${PLACEHOLDER.secret} not acknowledged`), { code: 'COMMIT_FAILED' });
        },
      }).take(CaptureCredentialHolder.CAMERA_ADAPTER);
      const error = await refusal(adapter.relayRestart('CAM-01', SESSION));
      expect(error instanceof CaptureCredentialReadError ? [error.code, error.deviceId, error.cause] : error, name).toEqual(['CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', 'CAM-01', undefined]);
      expect(built.opened, name).toBe(0);
      expect(built.errorLog.entries.map((entry) => [entry.code, entry.context]), name).toEqual([['CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', { deviceId: 'CAM-01', reason: 'RELAY_RESTART', causeCode: 'COMMIT_FAILED' }]]);
      expect(leaks(everything(error)), name).toEqual([]);
      expect(leaks(JSON.stringify(built.errorLog.entries)), name).toEqual([]);
    }
  });

  it('the answers after a commit that are no credential: not stored, a row of an unknown form, an envelope that does not open', async () => {
    const cases: [string, Parameters<typeof rig>[0], string, number][] = [
      ['no row', { commits: true, rows: [] }, 'CAPTURE_CREDENTIAL_NOT_STORED', 0],
      ['another encryption', { commits: true, rows: [{ ...storedRow(), encryption: 'NONE' }] }, 'CAPTURE_CREDENTIAL_ROW_INVALID', 0],
      [
        'the opener throws',
        {
          commits: true,
          open: () => {
            // What an opener must never do; the reader's error still carries nothing of it.
            throw Object.assign(new Error(`cannot open ${PLACEHOLDER.secret}`), { code: 'CREDENTIAL_OPEN_FAILED' });
          },
        },
        'CAPTURE_CREDENTIAL_OPEN_FAILED',
        1,
      ],
    ];
    for (const [name, options, code, opened] of cases) {
      const built = rig(options);
      const adapter = createCaptureCredentialReaders(built.dependencies).take(CaptureCredentialHolder.CAMERA_ADAPTER);
      const error = await refusal(adapter.sessionOpen('CAM-01', SESSION));
      expect(error instanceof CaptureCredentialReadError ? [error.code, error.deviceId, error.cause] : error, name).toEqual([code, 'CAM-01', undefined]);
      // The entry was written before the answer was looked at: 1 entry, 0 credentials, 1 error-log code.
      expect([built.entries.length, built.opened, built.errorLog.entries.map((entry) => entry.code)], name).toEqual([1, opened, [code]]);
      expect(leaks(everything(error)), name).toEqual([]);
      expect(leaks(JSON.stringify(built.errorLog.entries)), name).toEqual([]);
    }
  });
});

// Task 4 row 144 (AD-03 points 1 and 4, with AD-02): the device gate before the reveal, and the
// wiring that hands each holder its reader. Doubles: the stored facts of a device are an object;
// the destination rule is the real one on the host facts of `HOST`.
describe('AD-03 (4): the reader refuses a device before the reveal (row 144)', () => {
  /** One read that must be refused by the gate: 0 units, 0 statements, 0 entries, 0 openings, 1 error-log code. */
  async function expectRefused(name: string, options: Parameters<typeof rig>[0], code: string, context: Record<string, unknown>): Promise<void> {
    for (const call of ['sessionOpen', 'relayRestart', 'connectionTest'] as const) {
      const built = rig(options);
      const handout = createCaptureCredentialReaders(built.dependencies);
      const adapter = handout.take(CaptureCredentialHolder.CAMERA_ADAPTER);
      const test = handout.take(CaptureCredentialHolder.CONNECTION_TEST);
      const error = await refusal(call === 'connectionTest' ? test.connectionTest('CAM-01', 'OPR-002') : adapter[call]('CAM-01', SESSION));
      expect(error instanceof CaptureCredentialReadError ? [error.code, error.deviceId, error.cause] : error, `${name} / ${call}`).toEqual([code, 'CAM-01', undefined]);
      expect([built.labels.length, built.statements.length, built.entries.length, built.opened], `${name} / ${call}`).toEqual([0, 0, 0, 0]);
      const reason = { sessionOpen: 'SESSION_OPEN', relayRestart: 'RELAY_RESTART', connectionTest: 'CONNECTION_TEST' }[call];
      expect(built.errorLog.entries.map((entry) => [entry.level, entry.source, entry.code, entry.context]), `${name} / ${call}`).toEqual([['error', 'captureConfig.credentialReader', code, { deviceId: 'CAM-01', reason, ...context }]]);
    }
  }

  it('CONTROL: a registered production camera at an allowed address is served; the gate is asked once per read, with the device id', async () => {
    const asked: string[] = [];
    const ruled: [string, number | undefined][] = [];
    const built = rig({
      commits: true,
      device: async (deviceId) => (asked.push(deviceId), { ...PRODUCTION_CAMERA, address: '192.168.50.21:80' }),
      storedAddress: (host, port) => (ruled.push([host, port]), realRule(host, port)),
    });
    const adapter = createCaptureCredentialReaders(built.dependencies).take(CaptureCredentialHolder.CAMERA_ADAPTER);
    expect(await adapter.sessionOpen('CAM-01', SESSION)).toBeInstanceOf(SealedCredential);
    expect([asked, ruled, built.entries.length, built.opened, built.errorLog.entries.length]).toEqual([['CAM-01'], [['192.168.50.21', 80]], 1, 1, 0]);
    // R-FLEX (row 136, RM-N1 lifted for STORED_CAMERA): a camera on the office interface's subnet is served too.
    const office = rig({ commits: true, device: async () => ({ ...PRODUCTION_CAMERA, address: '10.20.0.9' }), storedAddress: realRule });
    expect(await createCaptureCredentialReaders(office.dependencies).take(CaptureCredentialHolder.CAMERA_ADAPTER).sessionOpen('CAM-01', SESSION)).toBeInstanceOf(SealedCredential);
    expect([office.entries.length, office.opened, office.errorLog.entries.length]).toEqual([1, 1, 0]);
  });

  it('a device that is not a registered camera of a production kind: 0 reveal statements, 0 entries', async () => {
    const devices: [string, CaptureCredentialDevice | null][] = [
      ['not registered', null],
      ['a microphone', { kind: 'MIC', adapterKind: 'USB_AUDIO', address: null }],
      ['a PoE switch', { kind: 'POE', adapterKind: 'SNMP_POE', address: '192.168.50.2' }],
      ['a fake camera', { ...PRODUCTION_CAMERA, adapterKind: 'FAKE' }],
      ['a local development camera', { ...PRODUCTION_CAMERA, adapterKind: 'LOCAL_DEVICE' }],
      ['a camera of a production kind that is not a camera kind', { ...PRODUCTION_CAMERA, kind: 'MIC' }],
      ['an adapter kind outside the closed set', { ...PRODUCTION_CAMERA, adapterKind: 'ONVIF_RTSP_V2' }],
      ['an inherited name as adapter kind', { ...PRODUCTION_CAMERA, adapterKind: 'toString' }],
      ['a lower-case kind', { ...PRODUCTION_CAMERA, kind: 'camera' }],
    ];
    for (const [name, stored] of devices) await expectRefused(name, { commits: true, device: async () => stored }, 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', {});
    // The stored facts cannot be read: refused too, and what was thrown is named by its code only.
    const lost = async (): Promise<never> => {
      throw Object.assign(new Error(`lost ${PLACEHOLDER.secret}`), { code: '57P01' });
    };
    await expectRefused('the read fails', { commits: true, device: lost }, 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', { causeCode: '57P01' });
  });

  it('a stored address that is absent, malformed or refused by the destination rule: 0 reveal statements, 0 entries, the refusal named', async () => {
    const addresses: [string | null, string][] = [
      [null, 'STORED_ADDRESS_ABSENT'],
      ['', 'STORED_ADDRESS_ABSENT'],
      ['http://192.168.50.21/onvif', 'STORED_ADDRESS_MALFORMED'],
      ['admin@192.168.50.21', 'STORED_ADDRESS_MALFORMED'],
      ['192.168.50.21:80:80', 'STORED_ADDRESS_MALFORMED'],
      ['192.168.50.21/24', 'STORED_ADDRESS_MALFORMED'],
      [' 192.168.50.21', 'STORED_ADDRESS_MALFORMED'],
      // From here on the REAL rule answers (AD-02): its own refusal code is what the error log names.
      ['127.0.0.1', 'LOOPBACK'],
      ['camera.local', 'HOST_NAME'],
      ['192.168.050.21', 'MALFORMED_IPV4'],
      ['8.8.8.8', 'PUBLIC_ADDRESS'],
      ['169.254.10.10', 'LINK_LOCAL'],
      ['192.168.50.1', 'HOST_ADDRESS'],
      // R-FLEX (row 136): 10.20.0.9 on the office interface is no longer refused OTHER_INTERFACE_SUBNET (RM-N1, lifted for STORED_CAMERA);
      // an off-link address is no longer OUTSIDE_CAMERA_SUBNET (RM-N2) but NW-R1 NO_SOURCE_INTERFACE.
      ['192.168.51.21', 'NO_SOURCE_INTERFACE'],
      ['192.168.50.255', 'SUBNET_BROADCAST'],
      ['192.168.50.21:8080', 'PORT_NOT_LISTED'],
      ['192.168.50.21:0', 'PORT_OUT_OF_RANGE'],
    ];
    for (const [address, named] of addresses) {
      await expectRefused(String(address), { commits: true, device: async () => ({ ...PRODUCTION_CAMERA, address }) }, 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED', { refusal: named });
    }
  });

  it('a rule that throws, answers nothing, or answers anything but the literal allowed: refused; a refusal that is no code is not copied', async () => {
    const rules: [string, CaptureCredentialReaderDependencies['storedAddress'], Record<string, unknown>][] = [
      [
        'throws',
        () => {
          throw Object.assign(new Error('no interface list'), { code: 'ENODEV' });
        },
        { causeCode: 'ENODEV', refusal: 'STORED_ADDRESS_RULE_FAILED' },
      ],
      ['answers undefined', () => undefined as never, { refusal: 'STORED_ADDRESS_RULE_FAILED' }],
      ['answers a truthy word', () => ({ allowed: 'yes' }) as never, { refusal: 'STORED_ADDRESS_RULE_FAILED' }],
      ['a refusal that carries a text', () => ({ allowed: false, refusal: `not ${PLACEHOLDER.secret}` }), { refusal: 'STORED_ADDRESS_RULE_FAILED' }],
    ];
    for (const [name, storedAddress, context] of rules) await expectRefused(name, { commits: true, storedAddress }, 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED', context);
  });

  it('the form of the request is judged first: a text that is no device id never reaches the gate', async () => {
    let asked = 0;
    const built = rig({ commits: true, device: async () => ((asked += 1), PRODUCTION_CAMERA) });
    const adapter = createCaptureCredentialReaders(built.dependencies).take(CaptureCredentialHolder.CAMERA_ADAPTER);
    expect(await codeOf(adapter.sessionOpen("CAM-01'; --", SESSION))).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
    // Row 145: so is the session - a production camera with a text that is no session id is not even looked up.
    expect(await codeOf(adapter.sessionOpen('CAM-01', 'SES-1'))).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
    expect(asked).toBe(0);
  });
});

describe('AD-03 (1): the wiring hands each holder its reader, and no holder passes a reason (row 144)', () => {
  /** The wiring on the doubles of `rig`; the stored row of each device is what `rows` answers for its id. */
  function wired(rows: Record<string, unknown[]>, options: Parameters<typeof rig>[0] = { commits: true }) {
    const built = rig(options);
    const queries: { text: string; values: unknown[] }[] = [];
    const { unit, open, errorLog, storedAddress } = built.dependencies;
    const holders = wireCaptureCredentialHolders({
      unit,
      open,
      errorLog,
      storedAddress,
      query: async (text, values) => (queries.push({ text, values }), { rows: rows[String(values[0])] ?? [] }),
    });
    return { built, queries, holders };
  }
  const CAMERA_ROW = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: '192.168.50.21' };

  it('the pair is frozen, has the two holders and nothing else; a holder has its own methods, none with a reason parameter', () => {
    const { holders } = wired({});
    expect(Object.keys(holders)).toEqual(['cameraAdapter', 'connectionTest']);
    expect(Object.isFrozen(holders)).toBe(true);
    expect([Object.keys(holders.cameraAdapter), Object.keys(holders.connectionTest)]).toEqual([['sessionOpen', 'relayRestart'], ['connectionTest']]);
    expect([holders.cameraAdapter.sessionOpen.length, holders.cameraAdapter.relayRestart.length, holders.connectionTest.connectionTest.length]).toEqual([2, 2, 2]);
    // The types say the same: a holder cannot be written with a reason argument. Row 145: the camera
    // adapter's two methods take the device and the session, exactly; neither can be written without the session.
    const adapterTakesDeviceAndSession: Parameters<CameraAdapterCredentialReader['sessionOpen']> extends [string, string] ? ([string, string] extends Parameters<CameraAdapterCredentialReader['relayRestart']> ? true : false) : false = true;
    const adapterNeedsTheSession: [string] extends Parameters<CameraAdapterCredentialReader['sessionOpen']> ? false : [string] extends Parameters<CameraAdapterCredentialReader['relayRestart']> ? false : true = true;
    const testTakesDeviceAndOperator: Parameters<ConnectionTestCredentialReader['connectionTest']> extends [string, string] ? true : false = true;
    expect([adapterTakesDeviceAndSession, adapterNeedsTheSession, testTakesDeviceAndOperator]).toEqual([true, true, true]);
    // Two apps are two independent pairs: the handout of one is not reachable from the other.
    expect(wired({}).holders.cameraAdapter).not.toBe(holders.cameraAdapter);
  });

  it('each holder writes its own reasons through the wiring; the device facts are read by one constant statement with one bind parameter', async () => {
    const { built, queries, holders } = wired({ 'CAM-01': [CAMERA_ROW] });
    await holders.cameraAdapter.sessionOpen('CAM-01', SESSION);
    await holders.cameraAdapter.relayRestart('CAM-01', SESSION);
    await holders.connectionTest.connectionTest('CAM-01', 'OPR-002');
    await (holders.cameraAdapter.sessionOpen as unknown as (...parameters: unknown[]) => Promise<unknown>)('CAM-01', SESSION, 'CONNECTION_TEST', 'OPR-001');
    expect(built.entries.map((entry) => [entry.actorId, entry.details])).toEqual([
      [null, { deviceId: 'CAM-01', reason: 'SESSION_OPEN' }],
      [null, { deviceId: 'CAM-01', reason: 'RELAY_RESTART' }],
      ['OPR-002', { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' }],
      [null, { deviceId: 'CAM-01', reason: 'SESSION_OPEN' }],
    ]);
    // Row 145: through the wiring too, the session is in the row of the adapter's entries and in no other.
    expect(built.entries.map((entry) => entry.sessionId ?? null)).toEqual([SESSION, SESSION, null, SESSION]);
    expect(queries).toEqual(Array(4).fill({ text: READ_CAPTURE_CREDENTIAL_DEVICE, values: ['CAM-01'] }));
    expect(READ_CAPTURE_CREDENTIAL_DEVICE).toBe('SELECT kind, adapter_kind, address FROM public.capture_devices WHERE id = $1');
  });

  it('a row the wiring cannot read as a device is no device: refused before the reveal', async () => {
    const rows: Record<string, unknown[]> = {
      'CAM-01': [],
      'CAM-02': [CAMERA_ROW, CAMERA_ROW],
      'CAM-03': [{ ...CAMERA_ROW, adapter_kind: null }],
      'CAM-04': [null],
      'CAM-05': [{ ...CAMERA_ROW, adapter_kind: 'FAKE' }],
      'MIC-01': [{ kind: 'MIC', adapter_kind: 'USB_AUDIO', address: null }],
    };
    const { built, holders } = wired(rows);
    for (const deviceId of Object.keys(rows)) expect(await codeOf(holders.cameraAdapter.sessionOpen(deviceId, SESSION)), deviceId).toBe('CAPTURE_CREDENTIAL_DEVICE_REFUSED');
    // A camera row without an address: the address refusal, the rule not asked.
    const { built: noAddress, holders: second } = wired({ 'CAM-01': [{ ...CAMERA_ROW, address: null }] });
    expect(await codeOf(second.connectionTest.connectionTest('CAM-01', 'OPR-002'))).toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
    for (const rigOf of [built, noAddress]) expect([rigOf.labels.length, rigOf.statements.length, rigOf.entries.length, rigOf.opened]).toEqual([0, 0, 0, 0]);
  });
});

describe('the reveal module: an answer, never a throw for the form of a row', () => {
  const connectionOf = (rows: unknown[]) => ({ query: async () => ({ rows }) }) as unknown as Parameters<typeof revealCaptureCredential>[0];

  it('names the function once, with one bind parameter, and selects the five members of its result', () => {
    expect(REVEAL_CAPTURE_CREDENTIAL).toBe(`SELECT username, encryption, secret_ciphertext, nonce, key_ref FROM public.${['dems', 'capture', 'credential', 'reveal'].join('_')}($1)`);
  });

  it('no row is NONE; the stored form is SEALED with copies of the two byte members; anything else is INVALID', async () => {
    expect(await revealCaptureCredential(connectionOf([]), 'CAM-01')).toEqual({ kind: 'NONE' });
    const row = storedRow();
    const sealed = await revealCaptureCredential(connectionOf([row]), 'CAM-01');
    expect(sealed).toEqual({ kind: 'SEALED', username: PLACEHOLDER.username, sealed: { keyRef: row.key_ref, ciphertext: new Uint8Array(row.secret_ciphertext), nonce: new Uint8Array(row.nonce) } });
    if (sealed.kind !== 'SEALED') throw new Error('not sealed');
    expect(Buffer.isBuffer(sealed.sealed.ciphertext)).toBe(false);
    expect(Object.keys(sealed).sort()).toEqual(['kind', 'sealed', 'username']);
    for (const invalid of [
      [row, row],
      [{ ...row, username: '' }],
      [{ ...row, username: null }],
      [{ ...row, encryption: 'AES-128-GCM' }],
      [{ ...row, key_ref: 4 }],
      [{ ...row, secret_ciphertext: 'text' }],
      [{ ...row, nonce: null }],
    ]) {
      expect(await revealCaptureCredential(connectionOf(invalid), 'CAM-01')).toEqual({ kind: 'INVALID' });
    }
  });
});

// Decision C127 (security review 086 caution C-3, finding S-04): the credential gate asks the rule about the port DIALLED.
describe('C127 / S-04: the reader\'s gate holds the dialled port to the stored allowed list', () => {
  const ruleWith = (allowedPorts: readonly number[]): CaptureCredentialReaderDependencies['storedAddress'] => (address, port) =>
    decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address, ...(port === undefined ? {} : { port }) }, { ...HOST, allowedPorts });
  const at = (address: string): CaptureCredentialReaderDependencies['device'] => async () => ({ ...PRODUCTION_CAMERA, address });
  const read = (built: Rig) => createCaptureCredentialReaders(built.dependencies).take(CaptureCredentialHolder.CAMERA_ADAPTER).sessionOpen('CAM-01', SESSION);
  const refusalOf = (built: Rig): unknown => built.errorLog.entries.map((entry) => (entry.context as Record<string, unknown>)['refusal']);

  it('the default port is the `http:` one, 80, the same number as the stored-address judgement\'s', () => {
    expect([STORED_ADDRESS_DEFAULT_PORT, ONVIF_DEVICE_SERVICE_DEFAULT_PORT]).toEqual([80, 80]);
  });

  it('list [80] admits 80; list [8080] refuses an address with no port and one at 80, and admits 8080 - each refusal named, 0 reveal statements', async () => {
    // SEEN RED: `STORED_ADDRESS_DEFAULT_PORT` -> `undefined` as the asked port (the [8080] address with no port admitted).
    for (const [list, address] of [[[80], '192.168.50.21'], [[80], '192.168.50.21:80'], [[8080], '192.168.50.21:8080'], [[8080, 80], '192.168.50.21']] as const) {
      const built = rig({ commits: true, device: at(address), storedAddress: ruleWith(list) });
      expect(await read(built), `${address} under [${list.join(',')}]`).toBeInstanceOf(SealedCredential);
    }
    for (const address of ['192.168.50.21', '192.168.50.21:80', '192.168.50.21:554']) {
      const built = rig({ commits: true, device: at(address), storedAddress: ruleWith([8080]) });
      expect(await codeOf(read(built)), address).toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
      expect([refusalOf(built), built.statements.length, built.entries.length], address).toEqual([['PORT_NOT_LISTED'], 0, 0]);
    }
  });

  it('an admission that states another port than the one dialled is STORED_ADDRESS_PORT_MISMATCH', async () => {
    // SEEN RED: the comparison of the admitted port with the dialled one removed (the credential was served).
    const admits8080: CaptureCredentialReaderDependencies['storedAddress'] = () => ({ allowed: true, destination: { port: 8080 } });
    for (const address of ['192.168.50.21', '192.168.50.21:554']) {
      const built = rig({ commits: true, device: at(address), storedAddress: admits8080 });
      expect(await codeOf(read(built)), address).toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
      expect([refusalOf(built), built.statements.length], address).toEqual([[StoredAddressRefusal.PORT_MISMATCH], 0]);
    }
    expect(await read(rig({ commits: true, device: at('192.168.50.21:8080'), storedAddress: admits8080 }))).toBeInstanceOf(SealedCredential);
  });
});
