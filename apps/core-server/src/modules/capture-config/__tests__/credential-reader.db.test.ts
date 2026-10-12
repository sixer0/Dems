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
const REVEAL_SIGNATURE = `public.${['dems', 'capture', 'credential', 'reveal'].join('_')}(text)`;

/** The real app factory on the clone, as `dems_app`, ready; closed before the clone is dropped. */
let core: { readonly app: ReturnType<typeof buildApp>; readonly log: CapturedLog };
/** Which of the two planted triggers refuses: on this clone only, switched by a row and never dropped. */
const refuseAt = (mode: 'off' | 'append' | 'commit'): Promise<unknown> => owner.query('UPDATE public.row45_switch SET mode = $1', [mode]);
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
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('one read is one credential and one audit entry', () => {
  it('SESSION_OPEN: the opaque credential, and ONE entry with exactly two detail keys, no actor, on a chain that verifies', async () => {
    const before = await readTrail(owner);
    const credential = await adapter.sessionOpen('CAM-01');
    expect(credential).toBeInstanceOf(SealedCredential);
    expect(isPlaceholder(credential)).toBe(true);
    expect(leaks(everything(credential))).toEqual([]);
    expect(String(credential)).toBe(CREDENTIAL_MARK);

    const after = await readTrail(owner);
    expect(after.length - before.length).toBe(1);
    const row = after.at(-1) as AuditRow;
    expect([row.type, row.actorId, row.deviceId, row.sessionId ?? null, row.evidenceId ?? null]).toEqual([REVEALED, null, 'CAM-01', null, null]);
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
    expect(isPlaceholder(await adapter.relayRestart('CAM-01'))).toBe(true);
    expect(isPlaceholder(await connection.connectionTest('CAM-01', operatorId))).toBe(true);
    const pair = await Promise.all([adapter.sessionOpen('CAM-01'), adapter.sessionOpen('CAM-01')]);
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
    const error = await refusal(adapter.sessionOpen('CAM-01'));
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
    expect(isPlaceholder(await adapter.sessionOpen('CAM-01'))).toBe(true);
    expect((await reveals()).length - before).toBe(1);
  });
});

describe('an entry without a credential: the function was called, so it is audited', () => {
  it('no credential stored for the device: named refusal, 1 entry, 1 error-log code, the store is not asked', async () => {
    const [before, openedBefore, loggedBefore] = [(await reveals()).length, opened, errorLog.entries.length];
    const error = await refusal(adapter.sessionOpen('CAM-02'));
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
    await expectRefused(() => adapter.sessionOpen('MIC-01'), 'MIC-01', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
    await expectRefused(() => connection.connectionTest('CAM-77', operatorId), 'CAM-77', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
    // CAM-01 holds a stored credential: it is still not read while the row says FAKE.
    await setDevice('CAM-01', 'FAKE', '192.168.50.21');
    try {
      await expectRefused(() => adapter.sessionOpen('CAM-01'), 'CAM-01', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
      await expectRefused(() => adapter.relayRestart('CAM-01'), 'CAM-01', 'CAPTURE_CREDENTIAL_DEVICE_REFUSED', null);
    } finally {
      await setDevice('CAM-01', 'ONVIF_RTSP', '192.168.50.21');
    }
  });

  it('a production camera whose STORED address fails the destination rule: loopback, another interface, no address', async () => {
    const stored: [string | null, string][] = [
      ['127.0.0.1', 'LOOPBACK'],
      ['10.20.0.9', 'OTHER_INTERFACE_SUBNET'],
      ['192.168.50.21:8080', 'PORT_NOT_LISTED'],
      [null, 'STORED_ADDRESS_ABSENT'],
    ];
    try {
      for (const [address, named] of stored) {
        await setDevice('CAM-01', 'ONVIF_RTSP', address);
        await expectRefused(() => adapter.sessionOpen('CAM-01'), 'CAM-01', 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED', named);
      }
    } finally {
      await setDevice('CAM-01', 'ONVIF_RTSP', '192.168.50.21');
    }
    console.info(`[row144] refused devices | reveal entries=0 for ${stored.length} stored addresses`);
  });

  it('CONTROL: the same camera with its address restored is served again: 1 credential, 1 entry', async () => {
    const before = (await reveals()).length;
    expect(isPlaceholder(await adapter.sessionOpen('CAM-01'))).toBe(true);
    expect((await reveals()).length - before).toBe(1);
  });

  it('a read from INSIDE a unit of work is refused by the pipeline: 0 credentials, 0 entries (the blocking rule of row 45)', async () => {
    const [trailBefore, openedBefore, loggedBefore] = [(await readTrail(owner)).length, opened, errorLog.entries.length];
    const inner = await core.app.pipeline.run('row144.outerUnit', async () => refusal(adapter.sessionOpen('CAM-01')));
    expect(codeOf(inner)).toBe('CAPTURE_CREDENTIAL_REVEAL_FAILED');
    expect([(await readTrail(owner)).length - trailBefore, opened - openedBefore]).toEqual([0, 0]);
    expect(errorLog.entries.slice(loggedBefore).map((entry) => [entry.code, entry.context])).toEqual([['CAPTURE_CREDENTIAL_REVEAL_FAILED', { deviceId: 'CAM-01', reason: 'SESSION_OPEN', causeCode: 'PIPELINE_REENTRANT' }]]);
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
