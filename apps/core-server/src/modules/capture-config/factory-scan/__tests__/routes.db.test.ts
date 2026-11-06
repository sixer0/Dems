// Operation 103 `scanFactoryCameras` on a booted Core, as `dems_app`, against PostgreSQL (task 4
// blueprint row 107, WP-19c; contract `packages/shared/src/api/capture-commissioning.ts`; decisions
// U9, U10, C19; S13-11, S13-12 (b)).
//
// WHAT IS REAL: the app factory with every stage (stage 6 enforces CAPTURE_COMMISSION and
// `WEB_CONSOLE_SESSION`, stage 7 the body), booted as the entry point boots it on a throw-away
// clone of the seed; the route; the stored network configuration, written through operation 102
// and read by the scan; the reader of the network facts of row 108; the engine's unit of work and
// the audit chain; THE DESTINATION RULE of the capture unit (`decideDestination`, purpose
// COMMISSIONING_SCAN) as the judge of every address.
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the capture operation  the test Core is SIMULATED. The folder's own answer there is 409
//                          COMMISSIONING_NOT_AVAILABLE, which the first block measures; every later
//                          block says "this Core scans" with `replaceForTest`.
//   the parts              handed in by this file through the folder's test door, in the place of
//                          the composition (requested; `capture-composition.ts` is another row's):
//                          the rule above; a recording double of the temporary address (the shape of
//                          row 105's caller - row 106's lifecycle is in flight); a probe of this file
//                          that answers for chosen addresses with hostile text. NOTHING is sent
//                          anywhere and no address of any host is read or changed.
//   the host               a table of interfaces of this file; the double puts the temporary
//                          address on its camera port when it answers "done".
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readTrail } from '../../../../../test/support/core';
import { manualTimer } from '../../../../../test/support/engine';
import { buildGuardApp, deviceOperator, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { CLOCK_START, WEB_ORIGIN, insertPairedDevice, type Headers } from '../../../../../test/support/identity';
import { FAKE_ONVIF_MARKUP_TEXT } from '../../../../../test/support/fake-onvif-stub';
import { DestinationPurpose, decideDestination } from '../../../../capture/destination-rule';
import { createSystemTimers } from '../../../../capture';
import { captureFenceControl, hostCommissioningInputsOf, productionCameraDoors } from '../../../../capture/fence';
import { engineControl } from '../../../../engine';
import { throttleControl } from '../../../../plugins/throttle';
import { identityControl } from '../../../identity';
import { captureFactoryScanControl, captureNetworkConfigControl } from '../../index';
import type { HostInterface } from '../../network';
import { createFactoryScanGate, type FactoryScanAliasOutcome, type FactoryScanParts } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row107' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row107-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row107-log-'));
const errorLogFile = join(logDir, 'errors.log');

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const TABLET = 'DEV-0107';
const SCAN = '/api/v1/capture/network/scan';
const CONFIG = '/api/v1/capture/network/config';
const CANARY = 'cnryrow107devicetext';
/** What the found camera "announces": markup, control characters, a text far above the bound. */
const HOSTILE = { vendor: `${FAKE_ONVIF_MARKUP_TEXT}\u0000\u001b[2J`, model: `${CANARY}${'M'.repeat(6_000)}`, name: `${CANARY}\r\nsecond line` };

let guard: GuardApp;
let owner: Pool;
let supervisor: Headers;
let technician: Headers;
let investigator: Headers;
let technicianOnTablet: Headers;

/** The host of this file: the office network on `eth0`, the camera port `eth1`, a loopback. The double below adds to `eth1`. */
let onPort: string | null = null;
// R-FLEX row 136: a non-zero `mac` on every non-loopback address - row 105 makes an address without one ineligible as a source (RG-13).
const hostTable = (): readonly HostInterface[] => [
  { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
  { name: 'eth0', internal: false, addresses: [{ address: '10.20.0.15', prefixLength: 16, mac: '02:00:00:00:00:e0' }] },
  { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24, mac: '02:00:00:00:00:e1' }, ...(onPort === null ? [] : [{ address: onPort, prefixLength: 24, mac: '02:00:00:00:00:e1' }])] },
];
let calls: string[] = [];
let addAnswer: FactoryScanAliasOutcome = { refusal: null, effect: 'DONE' };
let answering: ReadonlySet<string> = new Set();
const parts: FactoryScanParts = {
  rule: (address, facts) => decideDestination({ purpose: DestinationPurpose.COMMISSIONING_SCAN, address }, facts),
  alias: {
    helper: async () => null,
    async add(request) {
      calls.push(`add ${request.address} ${String(request.minutes)} by ${request.subject.operatorId}`);
      if (addAnswer.refusal === null && addAnswer.effect === 'DONE') onPort = request.address;
      return addAnswer;
    },
    async remove(request) {
      calls.push(`remove ${request.address}`);
      onPort = null;
      return { refusal: null, effect: 'DONE' };
    },
  },
  async probe(destination) {
    calls.push(`probe ${destination.address} from ${destination.sourceAddress}`);
    return answering.has(destination.address) ? { answered: true, onvifReachable: true, ...HOSTILE } : { answered: false, onvifReachable: false };
  },
};

async function post(url: string, session: Headers | null, payload?: unknown): Promise<LightMyRequestResponse> {
  const headers = session === null ? { origin: WEB_ORIGIN } : { ...session, ...('cookie' in session ? { origin: WEB_ORIGIN } : {}) };
  const response = await guard.app.inject({ method: 'POST', url, headers: { ...headers, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) }, ...(payload === undefined ? {} : { payload: payload as object }) });
  await guard.app.pipeline.drain();
  return response;
}
const scan = (session: Headers | null, payload?: unknown): Promise<LightMyRequestResponse> => post(SCAN, session, payload);
const errorOf = (response: LightMyRequestResponse): { code?: string; details?: Record<string, unknown> } => (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error ?? {};
const reasonOf = (response: LightMyRequestResponse): [number, unknown, unknown] => [response.statusCode, errorOf(response).code, errorOf(response).details?.['reason'] ?? null];
const trail = (): Promise<AuditRow[]> => readTrail(owner);
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
/** The number of rows of EVERY table of the public schema, as the owner counts them. */
async function tableCounts(): Promise<Record<string, number>> {
  const { rows } = await owner.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const counts: Record<string, number> = {};
  for (const { tablename } of rows as { tablename: string }[]) {
    counts[tablename] = Number(((await owner.query(`SELECT count(*)::int AS n FROM public."${tablename}"`)).rows[0] as { n: number }).n);
  }
  return counts;
}
const changedTables = (before: Record<string, number>, after: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.keys(after).filter((table) => after[table] !== before[table]).map((table) => [table, (after[table] ?? 0) - (before[table] ?? 0)]));
/** Everything the Core wrote beside its answer: the log, the persistent error log, the audit trail. */
const written = async (since: Mark): Promise<string> => `${guard.log.text().slice(since.log)}\n${persisted().slice(since.persisted)}\n${JSON.stringify((await trail()).slice(since.trail))}`;
/** Where the three end NOW: what a case reads is what was written after its mark (the seed's own demo rows name addresses). */
interface Mark {
  readonly log: number;
  readonly persisted: number;
  readonly trail: number;
}
const mark = async (): Promise<Mark> => ({ log: guard.log.text().length, persisted: persisted().length, trail: (await trail()).length });
/** The persistent error log; the file does not exist until a first failure was persisted. */
const persisted = (): string => (existsSync(errorLogFile) ? readFileSync(errorLogFile, 'utf8') : '');

beforeAll(async () => {
  owner = db.ownerPool();
  guard = buildGuardApp({ runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) }, { errorLogFile, logLevel: 'trace' });
  await guard.app.ready();
  engineControl(guard.app).useTimer(manualTimer().timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();

  await insertPairedDevice(owner, TABLET, TECHNICIAN.id, CLOCK_START);
  const tablet = guard.devices.pair(TABLET);
  supervisor = await webOperator(guard, SUPERVISOR.username);
  technician = await webOperator(guard, TECHNICIAN.username);
  investigator = await webOperator(guard, INVESTIGATOR.username);
  technicianOnTablet = await deviceOperator(guard, tablet, TECHNICIAN.username);
  await guard.app.pipeline.drain();
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

beforeEach(() => {
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
  calls = [];
  addAnswer = { refusal: null, effect: 'DONE' };
  answering = new Set();
  onPort = null;
});

describe('the Core this file runs on: no parts were handed in and it is not in production capture', () => {
  it('the scan is mounted, refuses with 409 COMMISSIONING_NOT_AVAILABLE, writes no audit entry and stores nothing', async () => {
    expect(captureFenceControl(guard.app).operation).toBe('SIMULATED');
    const control = captureFactoryScanControl(guard.app);
    expect([control.available(), control.provided(), control.busy()]).toEqual([false, false, false]);
    const from = (await trail()).length;
    const before = await tableCounts();
    expect(reasonOf(await scan(technician))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(reasonOf(await scan(technician, { address: '192.168.1.64' }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(await since(from)).toEqual([]);
    expect(changedTables(before, await tableCounts())).toEqual({});
    // A production Core that was handed no parts answers the same: the door is the only way in.
    control.replaceForTest({ available: true });
    expect(reasonOf(await scan(technician))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    // The door takes the parts once.
    control.provide(parts);
    expect(control.provided()).toBe(true);
    expect(() => control.provide(parts)).toThrow('provided twice');
  });
});

describe('who may call: CAPTURE_COMMISSION on a web console session - the TECHNICIAN, and nobody else', () => {
  it('401 without a session; 403 NOT_PERMITTED for the INVESTIGATOR and the SUPERVISOR; 403 WEB_CONSOLE_ONLY for the TECHNICIAN on a tablet: one ACCESS_DENIED row each, nothing asked', async () => {
    let from = (await trail()).length;
    expect(reasonOf(await scan(null))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(await since(from)).toEqual([]);
    for (const [session, operator] of [
      [investigator, INVESTIGATOR],
      [supervisor, SUPERVISOR],
    ] as const) {
      from = (await trail()).length;
      const denied = await scan(session, { address: '192.168.1.64' });
      expect([denied.statusCode, errorOf(denied).code, errorOf(denied).details?.['permission']], operator.role).toEqual([403, 'NOT_PERMITTED', 'CAPTURE_COMMISSION']);
      const rows = await since(from);
      expect(rows.map((row) => row.type), operator.role).toEqual(['ACCESS_DENIED']);
      expect(rows[0], operator.role).toMatchObject({ actorId: operator.id, details: { operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } });
    }
    from = (await trail()).length;
    expect(reasonOf(await scan(technicianOnTablet))).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    expect((await since(from)).map((row) => row.type)).toEqual(['ACCESS_DENIED']);
    // A body that is no JSON, from a role without the permission: the refusal is the same, before the body is used.
    expect((await scan(supervisor, '{"address": ')).statusCode).toBe(403);
    expect(calls).toEqual([]);
  });
});

describe('the body: optional, at most ONE address of the contract\'s form - nothing else can be scanned', () => {
  it('400 for a body that is no JSON; 422 for a list, a range, a subnet, a port, an interface, a timeout, a name, a public or loopback address - none quoted, nothing asked', async () => {
    const from = (await trail()).length;
    expect((await scan(technician, '{"address": ')).statusCode).toBe(400);
    for (const body of [
      { addresses: ['192.168.1.64', '192.168.1.65'] },
      { address: ['192.168.1.64'] },
      { address: '192.168.1.0/24' },
      { address: '192.168.1.1-192.168.1.254' },
      { address: '192.168.1.64:8080' },
      { address: '192.168.1.64', port: 8080 },
      { address: '192.168.1.64', interfaceName: 'eth0' },
      { address: '192.168.1.64', timeoutMs: 60_000 },
      { address: 'camera.local' },
      { address: '8.8.8.8' },
      { address: '127.0.0.1' },
      { address: '192.168.1.255' },
      { address: '' },
    ]) {
      const response = await scan(technician, body);
      expect([response.statusCode, errorOf(response).code], JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
      expect(response.body, JSON.stringify(body)).not.toMatch(/192\.168\.1\.|camera\.local|8\.8\.8\.8|8080/);
    }
    expect(await since(from)).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe('the scan on a Core that scans: the stored list plus one typed address; the result in memory only', () => {
  it('no interface and no subnet are chosen yet: 409 COMMISSIONING_NOT_CONFIGURED, nothing asked', async () => {
    expect(reasonOf(await scan(technician))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED']);
    expect(calls).toEqual([]);
  });

  it('a camera at a stored factory address and one at the typed address are found; ONE CAMERA_FACTORY_SCANNED entry of counts; NO table gains or loses a row but the audit trail', async () => {
    // The technician states the camera network (operation 102, row 108) on the host of this file.
    captureNetworkConfigControl(guard.app).replaceForTest({ available: true, interfaces: hostTable });
    expect((await post(CONFIG, technician, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' })).statusCode).toBe(200);

    answering = new Set(['192.168.1.108', '192.168.7.9']);
    const marked = await mark();
    const from = (await trail()).length;
    const before = await tableCounts();
    const response = await scan(technician, { address: '192.168.7.9' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { addressCount: number; alias: unknown; synthetic: boolean; devices: { address: string; vendor: string | null; model: string | null; name: string | null; registeredDeviceId: unknown }[] };
    expect(validateCoreApiResponse('scanFactoryCameras', 200, body)).toMatchObject({ ok: true });
    // The stored defaults of the contract (four addresses in two /24) and the typed one.
    expect(calls).toEqual([
      `add 192.168.1.253 30 by ${TECHNICIAN.id}`,
      'probe 192.168.1.64 from 192.168.1.253',
      'probe 192.168.1.108 from 192.168.1.253',
      'probe 192.168.1.13 from 192.168.1.253',
      'remove 192.168.1.253',
      `add 192.168.0.253 30 by ${TECHNICIAN.id}`,
      'probe 192.168.0.90 from 192.168.0.253',
      'remove 192.168.0.253',
      `add 192.168.7.253 30 by ${TECHNICIAN.id}`,
      'probe 192.168.7.9 from 192.168.7.253',
      'remove 192.168.7.253',
    ]);
    expect([body.addressCount, body.alias, body.synthetic, body.devices.map((device) => device.address)]).toEqual([5, null, false, ['192.168.1.108', '192.168.7.9']]);
    // The device's text: cleaned and bounded, in the answer.
    expect(body.devices[0]).toMatchObject({ vendor: `${FAKE_ONVIF_MARKUP_TEXT}[2J`, model: `${CANARY}${'M'.repeat(120 - CANARY.length)}`, name: `${CANARY} second line`, registeredDeviceId: null });

    // ONE entry: counts and codes.
    const rows = await since(from);
    expect(rows.map((row) => row.type)).toEqual(['CAMERA_FACTORY_SCANNED']);
    expect(rows[0]).toMatchObject({ actorId: TECHNICIAN.id, details: { outcome: 'COMPLETE', addressCount: 5, responderCount: 2, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } });
    expect(Object.keys(rows[0]?.details ?? {}).sort()).toEqual(['addressCount', 'operationId', 'outcome', 'permission', 'responderCount']);

    // NOT STORED: of the 47 tables only the audit trail has another count; no candidate, no capture device, no alias row.
    const changed = changedTables(before, await tableCounts());
    expect(Object.values(changed)).toEqual([1]);
    expect(Object.keys(changed).join(',')).toMatch(/audit/);
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(47);

    // The device's words and the addresses of the scan: in no log line, no persisted failure, no audit row.
    const everything = await written(marked);
    expect(everything).toContain('CAMERA_FACTORY_SCANNED');
    for (const part of [CANARY, 'script', 'jndi', '{{7*7}}', 'MMMM', '192.168.1.', '192.168.7.', '192.168.0.90']) expect(everything, part).not.toContain(part);
    expect(guard.log.text()).toContain('commissioning scan ended');
    // A scan that ran as asked persisted no failure.
    expect(persisted()).toBe('');
  });

  it('the spacing through the route: the next scan at the same instant is 429 with retry-after, asks nothing and writes no entry', async () => {
    const from = (await trail()).length;
    const response = await scan(technician);
    expect(reasonOf(response)).toEqual([429, 'RATE_LIMITED', 'COMMISSIONING_SCAN_RATE_LIMITED']);
    expect(response.headers['retry-after']).toBe('10');
    expect(calls).toEqual([]);
    expect(await since(from)).toEqual([]);
  });

  it('a typed address the RULE refuses although the contract\'s form admits it (the office network, the Core\'s own, the temporary address itself): 422 COMMISSIONING_ADDRESS_NOT_ALLOWED, nothing asked', async () => {
    captureFactoryScanControl(guard.app).replaceForTest({ gate: createFactoryScanGate(0) });
    const from = (await trail()).length;
    for (const address of ['10.20.0.99', '192.168.50.1', '192.168.1.253', '172.16.5.253']) {
      const response = await scan(technician, { address });
      expect(reasonOf(response), address).toEqual([422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']);
      expect(response.body, address).not.toContain(address);
    }
    expect(calls).toEqual([]);
    expect(await since(from)).toEqual([]);
  });

  it('a temporary address that is not confirmed: 409 HOST_ALIAS_FAILED with the helper\'s word as `cause`, 0 probes, the removal asked, ONE entry FAILED, a found camera\'s text nowhere', async () => {
    // "The helper may have acted": possibly in place, so its removal is asked.
    addAnswer = { refusal: 'HELPER_ADD_FAILED', effect: 'UNKNOWN' };
    answering = new Set(['192.168.1.108']);
    const marked = await mark();
    const from = (await trail()).length;
    const before = await tableCounts();
    const response = await scan(technician);
    expect(reasonOf(response)).toEqual([409, 'INVALID_STATE', 'HOST_ALIAS_FAILED']);
    expect(errorOf(response).details?.['cause']).toBe('HELPER_ADD_FAILED');
    expect(calls).toEqual([`add 192.168.1.253 30 by ${TECHNICIAN.id}`, 'remove 192.168.1.253']);
    const rows = await since(from);
    expect(rows.map((row) => [row.type, row.details])).toEqual([['CAMERA_FACTORY_SCANNED', { outcome: 'FAILED', addressCount: 0, responderCount: 0, failureReason: 'HOST_ALIAS_FAILED', operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' }]]);
    expect(Object.values(changedTables(before, await tableCounts()))).toEqual([1]);
    expect(persisted()).toContain('COMMISSIONING_SCAN_ALIAS_NOT_CONFIRMED');
    expect(await written(marked)).not.toMatch(/192\.168\.1\.|cnryrow107/);
  });

  // Task 4 row 111b (decisions C78, C87). THE HARDWARE ADDRESS IS THE PRODUCT'S READ of the host's neighbour table
  // (`hostCommissioningInputsOf(...).scan.mac`, the destination rule before the program). WHAT IS A STAND-IN: the
  // PROGRAM - a shell script of this case, started by the real production door (only the core-file limit of this test
  // process is answered as 0). No `ip`, `ping` or `arping` runs; nothing is dialled (the probe is this file's).
  it('row 111b: `mac` of a found camera is what the HOST learnt, asked once per camera that answered, from the alias address; a line of another form is "not known" (null); neither is written anywhere but the answer', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'dems-row111b-scan-'));
    try {
      const program = join(folder, 'neighbour');
      // The camera at .108 is in the table; for the typed one the program prints a line with a device's words after the state.
      writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$*" >> "$0.args"\nif [ "$5" = "192.168.1.108" ]; then printf '%s dev eth1 lladdr aa:bb:cc:00:11:22 STALE\\n' "$5"; else printf '%s dev eth1 lladdr aa:bb:cc:00:11:33 REACHABLE ${CANARY}\\n' "$5"; fi\n`, { mode: 0o700 });
      chmodSync(program, 0o700);
      const timers = createSystemTimers();
      const network = captureNetworkConfigControl(guard.app);
      const observed = hostCommissioningInputsOf({
        platform: 'linux',
        timers,
        network: () => network.facts(),
        cameraInterface: () => network.storedInterface(),
        door: (options) => productionCameraDoors(timers).door({ ...options, coreFileLimit: () => 0 }),
        neighbourProgram: program,
      });
      if (observed === null) throw new Error('expected the observations of a linux host');
      captureFactoryScanControl(guard.app).replaceForTest({ gate: createFactoryScanGate(0), parts: { ...parts, mac: observed.scan.mac } });
      answering = new Set(['192.168.1.108', '192.168.7.9']);
      const marked = await mark();
      const response = await scan(technician, { address: '192.168.7.9' });
      expect(response.statusCode, response.body).toBe(200);
      const body = response.json() as { devices: { address: string; mac: string | null; endpointCount: number | null; deviceCount: string }[] };
      expect(validateCoreApiResponse('scanFactoryCameras', 200, body)).toMatchObject({ ok: true });
      // Row V6 (R119-03): the probe did not count, so the answer says NOT_KNOWN - never "one".
      expect(body.devices.map((device) => [device.address, device.mac, device.endpointCount, device.deviceCount])).toEqual([
        ['192.168.1.108', 'AA:BB:CC:00:11:22', null, 'NOT_KNOWN'],
        ['192.168.7.9', null, null, 'NOT_KNOWN'],
      ]);
      // Asked for the two addresses that answered and for no other; each while the alias address of its /24 was on the port.
      expect(readFileSync(`${program}.args`, 'utf8').trim().split('\n')).toEqual(['-4 neigh show to 192.168.1.108', '-4 neigh show to 192.168.7.9']);
      expect(calls.filter((call) => call.startsWith('probe '))).toHaveLength(5);
      expect(onPort).toBeNull();
      // The hardware addresses, the program's words and the addresses of the scan: in no log line, no persisted failure, no audit row.
      expect(await written(marked)).not.toMatch(/aa:bb:cc|AA:BB:CC|cnryrow107|192\.168\.1\.|192\.168\.7\./);
      expect(persisted().slice(marked.persisted)).toBe('');
    } finally {
      rmSync(folder, { recursive: true, force: true });
      captureFactoryScanControl(guard.app).replaceForTest({ parts });
    }
  });
});
