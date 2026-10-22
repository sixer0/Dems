// The credential reader against PostgreSQL (task 4 blueprint row 45, WP-06a; design addendum 04
// section 2.6 "Reader, on the test PostgreSQL"; security check 04, requirement AD-03 points 1, 2).
//
// The real app factory on a clone of the seed, as `dems_app`: the REAL pipeline (`app.pipeline.run`),
// the REAL audit writer, the owner's REAL reveal function with its grants, and a REAL Core
// credential store in a directory of the system's temporary folder (no key is written to the data
// directory of this repository). The clone is a throw-away database of this run: no demo or lane
// database is touched. What is stored is read as `dems_owner`.
//
//   - one call: 1 credential and 1 audit entry with exactly two detail keys;
//   - the audit append made to fail (a trigger on the clone): 0 credentials, 0 entries;
//   - the COMMIT made to fail (a deferred trigger on the clone): 0 credentials, 0 entries;
//   - the reveal statement made to fail (EXECUTE revoked on the clone): 0 credentials, 0 entries;
//   - no credential stored, and an envelope that does not open: 0 credentials, 1 entry, 1 code;
//   - a reason outside the closed set is refused by the audit writer: 0 entries;
//   - neither placeholder is in any audit row, event, log line, error-log entry or thrown error.
//
// Row 145 (AD-03 points 2 and 3), same clone:
//   - a COMMIT that is sent and WAITS (a third planted trigger, deferred, on an advisory lock of this
//     test): while it waits the read is pending, the store is not asked and no entry is visible;
//     let through: 1 credential, 1 entry; refused after the wait, or held past the unit's time
//     limit: 0 credentials, 0 entries, 1 error-log code;
//   - a reveal for a session carries the session in the audit row's `session_id`: per session, the
//     entries equal its cameras plus its relay restarts; the connection test's entry has none.
//
// The account and the secret are placeholders built from parts. No device is contacted.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import type { AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, recordingErrorLog, verifyTrail, type RecordingErrorLog } from '../../../../test/support/core';
import { CREDENTIAL_MARK, SealedCredential, usingCredential } from '../../../capture/adapters';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import { createCredentialStore, type CoreCredentialStore } from '../../../credential-store';
import { INSERT_CAPTURE_CREDENTIAL } from '../../capture-discovery/connect';
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../capture/destination-rule';
import { wireCaptureCredentialHolders } from '../credential-holders';
import { CaptureCredentialReadError, type CameraAdapterCredentialReader, type ConnectionTestCredentialReader } from '../credential-reader';

/**
 * Row 144: the host facts the REAL destination rule is bound to in this file (a camera interface
 * on 192.168.50.0/24, an office interface on 10.20.0.0/24). No permissive rule is used.
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

const db = useTestDatabase({ template: 'seed', slug: 'row45' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row45-db-'));

const PLACEHOLDER = { username: ['row45', 'db', 'account'].join('-'), secret: ['row45', 'db', 'placeholder', 'Wn5Tz2'].join('-') } as const;
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

const REVEALED = 'CAPTURE_CREDENTIAL_REVEALED';
/**
 * Row 145 (AD-03 (3)): the session the camera adapter's reads of the earlier blocks are said for,
 * and the two sessions of the row's own count. Texts in the form of a session id; the audit row's
 * `session_id` is no foreign key, and no session of these names is stored on the clone.
 */
const SESSION = 'SES-20261013-0045';
const SESSION_A = 'SES-20261013-0145';
const SESSION_B = 'SES-20261013-0146';
/** Row 145: the two advisory keys of the held COMMIT (this clone only): the first holds it, the second, while taken, makes it fail. */
const HOLD_KEY = 145_001;
const REFUSE_KEY = 145_002;
const REVEAL_SIGNATURE = `public.${['dems', 'capture', 'credential', 'reveal'].join('_')}(text)`;

/** The real app factory on the clone, as `dems_app`, ready; closed before the clone is dropped. */
let core: { readonly app: ReturnType<typeof buildApp>; readonly log: CapturedLog };
/** Which of the two planted triggers refuses: on this clone only, switched by a row and never dropped. */
const refuseAt = (mode: 'off' | 'append' | 'commit' | 'hold'): Promise<unknown> => owner.query('UPDATE public.row45_switch SET mode = $1', [mode]);
let owner: Pool;
let store: CoreCredentialStore;
let errorLog: RecordingErrorLog;
let adapter: CameraAdapterCredentialReader;
let connection: ConnectionTestCredentialReader;
let operatorId: string;
/** How often the store's opener was asked. */
let opened = 0;
/** Everything the reader threw in this file, for the last search. */
const thrown: unknown[] = [];

const reveals = async (): Promise<AuditRow[]> => (await readTrail(owner)).filter((row) => row.type === REVEALED);
const refusal = async (pending: Promise<unknown>): Promise<unknown> => {
  const outcome = await pending.then(
    () => 'answered',
    (error: unknown) => error,
  );
  thrown.push(outcome);
  return outcome;
};
const codeOf = (error: unknown): unknown => (error instanceof CaptureCredentialReadError ? error.code : error);
const isPlaceholder = (credential: SealedCredential): boolean => usingCredential(credential, (inner) => inner.username === PLACEHOLDER.username && inner.secret === PLACEHOLDER.secret);

/** The stored facts of a registered device, set as the owner on this clone. */
const setDevice = (deviceId: string, adapterKind: string, address: string | null): Promise<unknown> =>
  owner.query('UPDATE public.capture_devices SET adapter_kind = $2, address = $3 WHERE id = $1', [deviceId, adapterKind, address]);

async function storeCredential(deviceId: string, sealedFor: string = deviceId): Promise<void> {
  const sealed = await store.capture.seal(sealedFor, PLACEHOLDER.secret);
  // As the runtime role, with the statement the adoption sends (`connect/statements.ts`).
  await core.app.db.pool.query(INSERT_CAPTURE_CREDENTIAL, [deviceId, PLACEHOLDER.username, Buffer.from(sealed.ciphertext), Buffer.from(sealed.nonce), sealed.keyRef, 1_730_000_000_000]);
}

beforeAll(async () => {
  owner = db.ownerPool();
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ database: db.runtime, dataDir, logLevel: 'trace' }), logStream: log.stream });
  db.onCleanup(() => app.close());
  await app.ready();
  core = { app, log };
  store = createCredentialStore({ root: join(dataDir, 'credential-store') });
  errorLog = recordingErrorLog();
  // Row 144: the readers come from THE WIRING, with what the production composition will pass:
  // the real pipeline, the real store, a read on the pool as the runtime role outside any unit,
  // and the real destination rule for a stored camera on the host facts above.
  const holders = wireCaptureCredentialHolders({
    unit: (label, work) => core.app.pipeline.run(label, work),
    open: (deviceId, sealed) => {
      opened += 1;
      return store.capture.open(deviceId, sealed);
    },
    errorLog,
    query: (text, values) => core.app.db.read('row144.credentialDevice', (pool) => pool.query(text, values)),
    storedAddress: (address, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address, ...(port === undefined ? {} : { port }) }, HOST),
  });
  adapter = holders.cameraAdapter;
  connection = holders.connectionTest;
  // On this clone only, as the owner (the runtime role cannot update the adapter kind): the two
  // seeded cameras become cameras of the production kind at addresses of the camera subnet.
  await setDevice('CAM-01', 'ONVIF_RTSP', '192.168.50.21');
  await setDevice('CAM-02', 'ONVIF_RTSP', '192.168.50.22:80');
  operatorId = ((await owner.query<{ id: string }>('SELECT id FROM public.operators ORDER BY id LIMIT 1')).rows[0] as { id: string }).id;
  await storeCredential('CAM-01');
  // The two failure cases, on this clone only: a trigger at the insert of an audit row and a
  // deferred one that fires at COMMIT. Both stay; a one-row switch says which of them refuses
  // (no trigger of the audit table is ever removed or disabled, T-AO-4).
  await owner.query("CREATE TABLE public.row45_switch (mode text NOT NULL DEFAULT 'off')");
  await owner.query('INSERT INTO public.row45_switch DEFAULT VALUES');
  await owner.query('GRANT SELECT ON public.row45_switch TO dems_app');
  await owner.query("CREATE FUNCTION public.row45_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT mode FROM public.row45_switch) = TG_ARGV[0] THEN RAISE EXCEPTION 'row45 refuses this row'; END IF; RETURN NEW; END $$");
  await owner.query("CREATE TRIGGER row45_append BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.row45_refuse('append')");
  await owner.query("CREATE CONSTRAINT TRIGGER row45_commit AFTER INSERT ON public.audit_log DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.row45_refuse('commit')");
  // Row 145: a COMMIT that WAITS. A third planted trigger, deferred, so it runs inside the COMMIT of
  // the unit: in mode `hold` it asks for an advisory lock a connection of this test holds, and when
  // it gets it, it refuses the commit if the second key is taken too. Nothing of the audit table is
  // removed or disabled, and in any other mode the trigger does nothing.
  await owner.query(
    `CREATE FUNCTION public.row145_hold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT mode FROM public.row45_switch) = 'hold' THEN PERFORM pg_advisory_xact_lock(${HOLD_KEY}); IF NOT pg_try_advisory_xact_lock(${REFUSE_KEY}) THEN RAISE EXCEPTION 'row145 refuses this commit'; END IF; END IF; RETURN NEW; END $$`,
  );
  await owner.query('CREATE CONSTRAINT TRIGGER row145_commit_hold AFTER INSERT ON public.audit_log DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.row145_hold()');
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('one read is one credential and one audit entry', () => {
  it('SESSION_OPEN: the opaque credential, and ONE entry with exactly two detail keys, no actor, on a chain that verifies', async () => {
    const before = await readTrail(owner);
    const credential = await adapter.sessionOpen('CAM-01', SESSION);
    expect(credential).toBeInstanceOf(SealedCredential);
    expect(isPlaceholder(credential)).toBe(true);
    expect(leaks(everything(credential))).toEqual([]);
    expect(String(credential)).toBe(CREDENTIAL_MARK);

    const after = await readTrail(owner);
    expect(after.length - before.length).toBe(1);
    const row = after.at(-1) as AuditRow;
    // Row 145: the session is in the ROW (`session_id`), and the details are still exactly two keys.
    expect([row.type, row.actorId, row.deviceId, row.sessionId ?? null, row.evidenceId ?? null]).toEqual([REVEALED, null, 'CAM-01', SESSION, null]);
    expect(Object.keys(row.details).sort()).toEqual(['deviceId', 'reason']);
    expect(row.details).toEqual({ deviceId: 'CAM-01', reason: 'SESSION_OPEN' });
    const head = await readHead(owner);
    expect(linkProblems(after)).toEqual([]);
    expect(verifyTrail(after, head)).toEqual({ ok: true, checked: after.length, head: head.hash });
    expect([opened, errorLog.entries.length]).toEqual([1, 0]);
    console.info(`[row45] one call | credentials=1 entries=${after.length - before.length} detailKeys=${Object.keys(row.details).sort().join(',')} opened=${opened}`);
  });

  it('each bound method writes its own reason; the connection test names its operator; two reads in flight are two entries', async () => {
    const before = (await reveals()).length;
    expect(isPlaceholder(await adapter.relayRestart('CAM-01', SESSION))).toBe(true);
    expect(isPlaceholder(await connection.connectionTest('CAM-01', operatorId))).toBe(true);
    const pair = await Promise.all([adapter.sessionOpen('CAM-01', SESSION), adapter.sessionOpen('CAM-01', SESSION)]);
    expect(pair.map(isPlaceholder)).toEqual([true, true]);
    expect(pair[0]).not.toBe(pair[1]);
    const rows = (await reveals()).slice(before);
    expect(rows.map((row) => [row.actorId, row.details])).toEqual([
      [null, { deviceId: 'CAM-01', reason: 'RELAY_RESTART' }],
      [operatorId, { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' }],
      [null, { deviceId: 'CAM-01', reason: 'SESSION_OPEN' }],
      [null, { deviceId: 'CAM-01', reason: 'SESSION_OPEN' }],
    ]);
    expect(errorLog.entries.length).toBe(0);
  });

  it('the runtime role itself still cannot read the table, and holds EXECUTE on the function (the grants this path stands on)', async () => {
    const sqlstate = (pending: Promise<unknown>): Promise<unknown> => pending.then(() => 'answered', (error: { code?: string }) => error.code);
    expect(await sqlstate(core.app.db.pool.query('SELECT username, secret_ciphertext FROM public.capture_device_credentials'))).toBe('42501');
    const grants = await owner.query<{ app: boolean; everyone: boolean }>(`SELECT has_function_privilege('dems_app', $1, 'EXECUTE') AS app, has_function_privilege('public', $1, 'EXECUTE') AS everyone`, [REVEAL_SIGNATURE]);
    expect(grants.rows[0]).toEqual({ app: true, everyone: false });
  });
});

describe('no credential without its committed entry (AD-03 (2))', () => {
  /** Runs one read that must fail before the envelope is opened: 0 credentials, 0 entries, 1 error-log code. */
  async function expectNothing(code: string, causeCode: string | null): Promise<void> {
    const [entriesBefore, openedBefore, loggedBefore] = [(await readTrail(owner)).length, opened, errorLog.entries.length];
    const error = await refusal(adapter.sessionOpen('CAM-01', SESSION));
    expect(codeOf(error)).toBe(code);
    expect([(error as CaptureCredentialReadError).deviceId, (error as CaptureCredentialReadError).cause]).toEqual(['CAM-01', undefined]);
    expect((await readTrail(owner)).length - entriesBefore).toBe(0);
    expect(opened - openedBefore).toBe(0);
    const logged = errorLog.entries.slice(loggedBefore);
    expect(logged.map((entry) => [entry.level, entry.source, entry.code])).toEqual([['error', 'captureConfig.credentialReader', code]]);
    // The code of what was thrown underneath is named beside the reader's own; pinned where the driver's error arrives bare.
    expect(logged[0]?.context).toMatchObject({ deviceId: 'CAM-01', reason: 'SESSION_OPEN', ...(causeCode === null ? {} : { causeCode }) });
    expect(Object.keys(logged[0]?.context ?? {}).filter((key) => !['deviceId', 'reason', 'causeCode'].includes(key))).toEqual([]);
    console.info(`[row45] ${code} | credentials=0 entries=${(await readTrail(owner)).length - entriesBefore} opened=${opened - openedBefore} errorLog=${logged.length} underneath=${String(logged[0]?.context?.['causeCode'] ?? '(none)')}`);
  }

  it('the audit append fails: 0 credentials, 0 entries', async () => {
    await refuseAt('append');
    try {
      await expectNothing('CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', null);
    } finally {
      await refuseAt('off');
    }
  });

  it('the COMMIT fails after the append succeeded: 0 credentials, 0 entries', async () => {
    const notCommitted = (): number => core.log.lines().filter((line) => line['msg'] === 'unit not committed' && line['code'] === 'COMMIT_FAILED').length;
    const before = notCommitted();
    await refuseAt('commit');
    try {
      await expectNothing('CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', null);
    } finally {
      await refuseAt('off');
    }
    // It was the COMMIT that failed, not a statement of the unit: the pipeline says so once.
    expect(notCommitted() - before).toBe(1);
  });

  it('the reveal statement fails (EXECUTE revoked on this clone): 0 credentials, 0 entries', async () => {
    await owner.query(`REVOKE EXECUTE ON FUNCTION ${REVEAL_SIGNATURE} FROM dems_app`);
    try {
      await expectNothing('CAPTURE_CREDENTIAL_REVEAL_FAILED', '42501');
    } finally {
      await owner.query(`GRANT EXECUTE ON FUNCTION ${REVEAL_SIGNATURE} TO dems_app`);
    }
  });

  it('after the three failures the path works again: 1 credential, 1 entry', async () => {
    const before = (await reveals()).length;
    expect(isPlaceholder(await adapter.sessionOpen('CAM-01', SESSION))).toBe(true);
    expect((await reveals()).length - before).toBe(1);
  });
});

describe('an entry without a credential: the function was called, so it is audited', () => {
  it('no credential stored for the device: named refusal, 1 entry, 1 error-log code, the store is not asked', async () => {
    const [before, openedBefore, loggedBefore] = [(await reveals()).length, opened, errorLog.entries.length];
    const error = await refusal(adapter.sessionOpen('CAM-02', SESSION));
    expect(codeOf(error)).toBe('CAPTURE_CREDENTIAL_NOT_STORED');
    const rows = (await reveals()).slice(before);
    expect(rows.map((row) => row.details)).toEqual([{ deviceId: 'CAM-02', reason: 'SESSION_OPEN' }]);
    expect(opened - openedBefore).toBe(0);
    expect(errorLog.entries.slice(loggedBefore).map((entry) => entry.code)).toEqual(['CAPTURE_CREDENTIAL_NOT_STORED']);
  });

  it('the store cannot open the envelope (sealed for another device): 0 credentials, 1 entry, 1 error-log code', async () => {
    await storeCredential('CAM-02', 'CAM-01');
    const [before, openedBefore, loggedBefore] = [(await reveals()).length, opened, errorLog.entries.length];
    const error = await refusal(connection.connectionTest('CAM-02', operatorId));
    expect(codeOf(error)).toBe('CAPTURE_CREDENTIAL_OPEN_FAILED');
    expect((error as CaptureCredentialReadError).cause).toBeUndefined();
    const rows = (await reveals()).slice(before);
    expect(rows.map((row) => [row.actorId, row.details])).toEqual([[operatorId, { deviceId: 'CAM-02', reason: 'CONNECTION_TEST' }]]);
    expect(opened - openedBefore).toBe(1);
    const logged = errorLog.entries.slice(loggedBefore);
    expect(logged.map((entry) => [entry.code, entry.context])).toEqual([['CAPTURE_CREDENTIAL_OPEN_FAILED', { deviceId: 'CAM-02', reason: 'CONNECTION_TEST', causeCode: 'CREDENTIAL_OPEN_FAILED' }]]);
    console.info(`[row45] store fails to open after the commit | credentials=0 entries=${rows.length} errorLogCodes=${logged.length}`);
  });
});

// Task 4 row 144 (AD-03 points 1 and 4, AD-02): through the wiring, on the stored rows of the clone.
describe('a refused device gives 0 reveal entries (AD-03 (4), row 144)', () => {
  /**
   * One read the gate must refuse: no audit row of ANY type, the store not asked, 1 error-log code.
   * That the reveal statement itself was not sent is held on doubles (`credential-reader.test.ts`:
   * 0 units, 0 statements); this server does not keep call statistics of functions.
   */
  async function expectRefused(pending: () => Promise<unknown>, deviceId: string, code: string, refusalCode: string | null): Promise<void> {
    const [trailBefore, openedBefore, loggedBefore] = [(await readTrail(owner)).length, opened, errorLog.entries.length];
    const error = await refusal(pending());
    expect([codeOf(error), (error as CaptureCredentialReadError).deviceId, (error as CaptureCredentialReadError).cause]).toEqual([code, deviceId, undefined]);
    await core.app.pipeline.drain();
    expect([(await readTrail(owner)).length - trailBefore, opened - openedBefore]).toEqual([0, 0]);
    const logged = errorLog.entries.slice(loggedBefore);
    expect(logged.map((entry) => [entry.level, entry.source, entry.code])).toEqual([['error', 'captureConfig.credentialReader', code]]);
    expect(logged[0]?.context?.['refusal'] ?? null).toBe(refusalCode);
  }

  it('a device that is not a camera of a production kind: a microphone, a fake camera, a device that is not registered', async () => {
    await expectRefused(() => adapter.sessionOpen('MIC-01', SESSION), 'MIC-01', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
    await expectRefused(() => connection.connectionTest('CAM-77', operatorId), 'CAM-77', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
    // CAM-01 holds a stored credential: it is still not read while the row says FAKE.
    await setDevice('CAM-01', 'FAKE', '192.168.50.21');
    try {
      await expectRefused(() => adapter.sessionOpen('CAM-01', SESSION), 'CAM-01', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
      await expectRefused(() => adapter.relayRestart('CAM-01', SESSION), 'CAM-01', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
    } finally {
      await setDevice('CAM-01', 'ONVIF_RTSP', '192.168.50.21');
    }
  });

  it('a production camera whose STORED address fails the destination rule: loopback, off-link, no address', async () => {
    const stored: [string | null, string][] = [
      ['127.0.0.1', 'LOOPBACK'],
      // R-FLEX (row 136): 10.20.0.9 (another interface) is no longer refused OTHER_INTERFACE_SUBNET for STORED_CAMERA (RM-N1);
      // an address no interface holds on-link is refused NW-R1 NO_SOURCE_INTERFACE instead.
      ['192.168.51.21', 'NO_SOURCE_INTERFACE'],
      ['192.168.50.21:8080', 'PORT_NOT_LISTED'],
      [null, 'STORED_ADDRESS_ABSENT'],
    ];
    try {
      for (const [address, named] of stored) {
        await setDevice('CAM-01', 'ONVIF_RTSP', address);
        await expectRefused(() => adapter.sessionOpen('CAM-01', SESSION), 'CAM-01', 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED', named);
      }
    } finally {
      await setDevice('CAM-01', 'ONVIF_RTSP', '192.168.50.21');
    }
    console.info(`[row144] refused devices | reveal entries=0 for ${stored.length} stored addresses`);
  });

  it('CONTROL: the same camera with its address restored is served again: 1 credential, 1 entry', async () => {
    const before = (await reveals()).length;
    expect(isPlaceholder(await adapter.sessionOpen('CAM-01', SESSION))).toBe(true);
    expect((await reveals()).length - before).toBe(1);
  });

  it('a read from INSIDE a unit of work is refused by the pipeline: 0 credentials, 0 entries (the blocking rule of row 45)', async () => {
    const [trailBefore, openedBefore, loggedBefore] = [(await readTrail(owner)).length, opened, errorLog.entries.length];
    const inner = await core.app.pipeline.run('row144.outerUnit', async () => refusal(adapter.sessionOpen('CAM-01', SESSION)));
    expect(codeOf(inner)).toBe('CAPTURE_CREDENTIAL_REVEAL_FAILED');
    expect([(await readTrail(owner)).length - trailBefore, opened - openedBefore]).toEqual([0, 0]);
    expect(errorLog.entries.slice(loggedBefore).map((entry) => [entry.code, entry.context])).toEqual([['CAPTURE_CREDENTIAL_REVEAL_FAILED', { deviceId: 'CAM-01', reason: 'SESSION_OPEN', causeCode: 'PIPELINE_REENTRANT' }]]);
  });
});

// Task 4 row 145 (AD-03 points 2 and 3). Point 2 is "returned only after the unit's commit is
// ACKNOWLEDGED": the cases above make the COMMIT fail at once; here the COMMIT is sent and WAITS
// (the planted deferred trigger asks for an advisory lock a connection of this test holds), so the
// moment between "the work of the unit returned" and "the server answered the COMMIT" can be looked
// at: nothing has left the reader in it. Then the COMMIT is let through, made to fail, or held past
// the unit's own time limit. Point 3: the session of a reveal is in the audit row.
describe('row 145: nothing leaves the reader before the COMMIT is acknowledged; the session is in the audit row (AD-03 (2), (3))', () => {
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  /** Backends of this clone that wait for the hold key: 1 while a COMMIT of the reader's unit is held. */
  const waiting = async (): Promise<number> =>
    Number((await owner.query<{ n: string }>(`SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = ${HOLD_KEY} AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`)).rows[0]?.n ?? -1);
  const until = async (condition: () => Promise<boolean>, withinMs: number): Promise<boolean> => {
    for (const end = Date.now() + withinMs; Date.now() < end; await sleep(20)) if (await condition()) return true;
    return condition();
  };
  const commitFailures = (): number => core.log.lines().filter((line) => line['msg'] === 'unit not committed' && line['code'] === 'COMMIT_FAILED').length;

  /**
   * Runs `work` while a connection of this test holds the given advisory keys and the planted
   * trigger is in mode `hold`. `release` gives one key back. Whatever happens, the mode is switched
   * off and every key is released before the connection goes back to its pool.
   */
  async function holding<Value>(keys: readonly number[], work: (release: (key: number) => Promise<void>) => Promise<Value>): Promise<Value> {
    const locker = await owner.connect();
    try {
      for (const key of keys) await locker.query(`SELECT pg_advisory_lock(${key})`);
      await refuseAt('hold');
      return await work(async (key) => void (await locker.query(`SELECT pg_advisory_unlock(${key})`)));
    } finally {
      await refuseAt('off');
      await locker.query('SELECT pg_advisory_unlock_all()');
      locker.release();
    }
  }

  /** One read in flight, with what can be seen of it from outside. */
  function inFlight(read: () => Promise<SealedCredential>) {
    const marks = { trail: 0, opened, logged: errorLog.entries.length };
    const state: { settled: unknown; done: Promise<unknown> } = { settled: 'pending', done: Promise.resolve() };
    return {
      state,
      /** Starts the read and returns at once: `state.done` settles when the read does (an async function would wait for a returned promise). */
      async start(): Promise<void> {
        marks.trail = (await readTrail(owner)).length;
        state.done = read().then(
          (credential) => (state.settled = credential),
          (error: unknown) => (thrown.push(error), (state.settled = error)),
        );
      },
      /** [settled or 'pending', openings of the store, audit rows another connection can see, error-log entries]. */
      async seen(): Promise<unknown[]> {
        return [state.settled instanceof SealedCredential ? 'credential' : state.settled === 'pending' ? 'pending' : codeOf(state.settled), opened - marks.opened, (await readTrail(owner)).length - marks.trail, errorLog.entries.length - marks.logged];
      },
    };
  }

  it('a COMMIT that is sent and not answered: the read is pending, the store is not asked, no entry is visible - then it is acknowledged: 1 credential, 1 entry', async () => {
    const read = inFlight(() => adapter.sessionOpen('CAM-01', SESSION_A));
    await holding([HOLD_KEY], async (release) => {
      await read.start();
      // The unit's work has returned: the reveal statement and the audit insert are done (the trigger
      // fires for the inserted row), and the COMMIT is waiting inside the server.
      expect(await until(async () => (await waiting()) === 1, 3_000)).toBe(true);
      expect(await read.seen()).toEqual(['pending', 0, 0, 0]);
      await sleep(400);
      expect([await waiting(), ...(await read.seen())]).toEqual([1, 'pending', 0, 0, 0]);
      await release(HOLD_KEY);
      await read.state.done;
    });
    expect(await read.seen()).toEqual(['credential', 1, 1, 0]);
    expect(isPlaceholder(read.state.settled as SealedCredential)).toBe(true);
    const row = (await reveals()).at(-1) as AuditRow;
    expect([row.sessionId, row.details]).toEqual([SESSION_A, { deviceId: 'CAM-01', reason: 'SESSION_OPEN' }]);
    console.info('[row145] COMMIT held | during: credentials=0 opened=0 visibleEntries=0 | after the acknowledgement: credentials=1 entries=1');
  });

  it('a COMMIT that waits and is then REFUSED: 0 credentials, 0 entries, 1 error-log code - the store was never asked', async () => {
    const before = commitFailures();
    const read = inFlight(() => adapter.relayRestart('CAM-01', SESSION_A));
    await holding([HOLD_KEY, REFUSE_KEY], async (release) => {
      await read.start();
      expect(await until(async () => (await waiting()) === 1, 3_000)).toBe(true);
      expect(await read.seen()).toEqual(['pending', 0, 0, 0]);
      // The second key is still held: the trigger gets the first and refuses the commit.
      await release(HOLD_KEY);
      await read.state.done;
    });
    expect(await read.seen()).toEqual(['CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', 0, 0, 1]);
    expect((read.state.settled as CaptureCredentialReadError).cause).toBeUndefined();
    expect(errorLog.entries.at(-1)?.context).toMatchObject({ deviceId: 'CAM-01', reason: 'RELAY_RESTART' });
    expect(commitFailures() - before).toBe(1);
    console.info('[row145] COMMIT held, then refused | credentials=0 entries=0 opened=0 errorLog=1');
  });

  it('a COMMIT that waits past the time limit of the unit: the read ends with no credential and the store is not asked; the transaction is not committed: 0 entries', async () => {
    const read = inFlight(() => adapter.sessionOpen('CAM-01', SESSION_A));
    const started = Date.now();
    /** How the pipeline itself named the end of the unit: abandoned by its watchdog, or a COMMIT the server cancelled. */
    const ended = (): string[] => core.log.lines().flatMap((line) => (line['msg'] === 'unit abandoned: it ran too long' || line['msg'] === 'unit not committed' ? [String(line['code'])] : []));
    const endedBefore = ended().length;
    let waitedMs = 0;
    let stillWaiting = -1;
    await holding([HOLD_KEY, REFUSE_KEY], async (release) => {
      await read.start();
      expect(await until(async () => (await waiting()) === 1, 3_000)).toBe(true);
      expect(await read.seen()).toEqual(['pending', 0, 0, 0]);
      // Nobody releases the key: the unit's own limit ends the wait of the READER (5 s, the pipeline's watchdog and the statement limit of the unit).
      await read.state.done;
      waitedMs = Date.now() - started;
      expect((await read.seen()).slice(0, 2)).toEqual(['CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', 0]);
      // The reader has answered. The server may still hold the transaction (a connection that was
      // closed under a waiting COMMIT is not noticed by the backend until it wakes): whatever still
      // waits meets the second key, which this test still holds, and is refused.
      stillWaiting = await waiting();
      await release(HOLD_KEY);
      expect(await until(async () => (await waiting()) === 0, 4_000)).toBe(true);
    });
    await core.app.pipeline.drain();
    expect(await read.seen()).toEqual(['CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', 0, 0, 1]);
    expect(waitedMs).toBeGreaterThan(4_000);
    const named = ended().slice(endedBefore);
    expect(named.length).toBe(1);
    expect(['UNIT_TIMEOUT', 'COMMIT_FAILED']).toContain(named[0]);
    console.info(`[row145] COMMIT held past the unit's limit | credentials=0 entries=0 opened=0 errorLog=1 pipeline=${named.join()} readerAnsweredAfterMs=${waitedMs} backendsStillWaitingThen=${stillWaiting}`);
  }, 30_000);

  it('CONTROL: with the trigger idle the same read is served again, on a chain that verifies: 1 credential, 1 entry', async () => {
    const before = (await reveals()).length;
    expect(isPlaceholder(await adapter.sessionOpen('CAM-01', SESSION_A))).toBe(true);
    expect((await reveals()).length - before).toBe(1);
    const [trail, head] = [await readTrail(owner), await readHead(owner)];
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, head)).toEqual({ ok: true, checked: trail.length, head: head.hash });
  });

  it('AD-03 (3): the reveal entries of a session are its cameras plus its relay restarts; a connection test is no session\'s; a read that failed before its commit left none', async () => {
    // Session B: two camera lines of a plan (the second camera's envelope does not open: the function
    // was called, so it is an entry all the same) and one relay restart. One connection test beside it.
    expect(isPlaceholder(await adapter.sessionOpen('CAM-01', SESSION_B))).toBe(true);
    expect(codeOf(await refusal(adapter.sessionOpen('CAM-02', SESSION_B)))).toBe('CAPTURE_CREDENTIAL_OPEN_FAILED');
    expect(isPlaceholder(await adapter.relayRestart('CAM-01', SESSION_B))).toBe(true);
    expect(isPlaceholder(await connection.connectionTest('CAM-01', operatorId))).toBe(true);
    // Read from the column itself, as the owner.
    const counted = await owner.query<{ session_id: string | null; reason: string; n: string }>(
      "SELECT session_id, details->>'reason' AS reason, count(*) AS n FROM public.audit_log WHERE type = $1 GROUP BY 1, 2 ORDER BY 1 NULLS LAST, 2",
      [REVEALED],
    );
    const of = (sessionId: string | null): Record<string, number> => Object.fromEntries(counted.rows.filter((row) => row.session_id === sessionId).map((row) => [row.reason, Number(row.n)]));
    expect(of(SESSION_B)).toEqual({ RELAY_RESTART: 1, SESSION_OPEN: 2 });
    // Session A: the held read that was acknowledged and the control. The refused and the timed-out read of A left nothing.
    expect(of(SESSION_A)).toEqual({ SESSION_OPEN: 2 });
    // No session: the connection tests of this file, and nothing of the camera adapter.
    expect(Object.keys(of(null))).toEqual(['CONNECTION_TEST']);
    // Every entry still has exactly the two detail keys: the session is a member of the row, not a third key.
    for (const row of await reveals()) expect(Object.keys(row.details).sort()).toEqual(['deviceId', 'reason']);
    console.info(`[row145] session in the audit row | ${SESSION_B}: SESSION_OPEN=2 RELAY_RESTART=1 (2 cameras + 1 restart) | no session: CONNECTION_TEST only`);
  });

  it('a session that is no session id, or none: refused before any statement - 0 entries, 0 error-log codes, the store not asked', async () => {
    const [trailBefore, openedBefore, loggedBefore] = [(await readTrail(owner)).length, opened, errorLog.entries.length];
    for (const sessionId of [undefined, null, '', 'SES-1', "SES-20261013-0145' OR '1'='1", operatorId]) {
      expect(codeOf(await refusal(adapter.sessionOpen('CAM-01', sessionId as never))), String(sessionId)).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
      expect(codeOf(await refusal(adapter.relayRestart('CAM-01', sessionId as never))), String(sessionId)).toBe('CAPTURE_CREDENTIAL_REQUEST_INVALID');
    }
    await core.app.pipeline.drain();
    expect([(await readTrail(owner)).length - trailBefore, opened - openedBefore, errorLog.entries.length - loggedBefore]).toEqual([0, 0, 0]);
  });
});

describe('the closed sets hold at the audit writer too', () => {
  it('a reason outside the closed set, a third detail key and a missing key are refused: 0 entries', async () => {
    const before = (await readTrail(owner)).length;
    const append = (details: Record<string, string>): Promise<unknown> =>
      core.app.pipeline
        .run('row45.foreignDetail', async (unit) => {
          await unit.audit.append({ type: REVEALED, message: 'Camera credential revealed', actorId: null, deviceId: 'CAM-01', details });
        })
        .then(
          () => 'answered',
          (error: { code?: string }) => error.code,
        );
    expect(await append({ deviceId: 'CAM-01', reason: 'MEDIA_DIAGNOSTICS' })).toBe('AUDIT_DETAIL_VALUE_INVALID');
    expect(await append({ deviceId: 'CAM-01', reason: 'SET_IP_JOB' })).toBe('AUDIT_DETAIL_VALUE_INVALID');
    expect(await append({ deviceId: 'CAM-01', reason: 'SESSION_OPEN', host: '192.0.2.10' })).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    expect(await append({ deviceId: 'CAM-01', reason: 'SESSION_OPEN', username: 'x' })).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
    expect(await append({ deviceId: 'CAM-01' })).toBe('AUDIT_DETAIL_MISSING');
    expect((await readTrail(owner)).length - before).toBe(0);
  });
});

describe('nothing printable carries the value', () => {
  it('neither placeholder is in an audit row, an event, a log line, an error-log entry or a thrown error; the control finds them', async () => {
    await core.app.pipeline.drain();
    const channels: Record<string, string> = {
      audit: JSON.stringify(await readTrail(owner)),
      events: JSON.stringify(await readEvents(owner)),
      log: core.log.text(),
      errorLog: JSON.stringify(errorLog.entries),
      thrown: thrown.map(everything).join('\n'),
    };
    expect(thrown.length).toBeGreaterThanOrEqual(5);
    expect(channels.log?.length ?? 0).toBeGreaterThan(0);
    for (const [name, text] of Object.entries(channels)) expect(leaks(text), name).toEqual([]);
    // Controls: the search finds a plain pair, and the secret is not stored in clear either (the account name is a clear column).
    expect(leaks(everything({ ...PLACEHOLDER }))).toEqual(NEEDLES);
    const stored = await owner.query('SELECT username, encode(secret_ciphertext, \'escape\') AS bytes FROM public.capture_device_credentials ORDER BY device_id');
    expect(leaks(JSON.stringify(stored.rows))).toEqual([PLACEHOLDER.username]);
    console.info(`[row45] leak search | channels=${Object.keys(channels).join(',')} occurrences=0 thrown=${thrown.length} reveals=${(await reveals()).length}`);
  });
});
