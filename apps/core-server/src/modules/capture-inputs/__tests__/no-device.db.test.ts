// The no-device notices and operation 97 against PostgreSQL and the REAL engine (blueprint row
// 133; specs R-10 AC-1, AC-2, AC-4, AC-5, AC-6; contract C3 §2.6 op 97, §3.1, §5.2, §5.4; checks
// M4-NODEV-A-1, M4-NODEV-B-1, M4-MIC-RESCAN-1, M4-AUD-1 for CAPTURE_DEVICE_UNREACHABLE).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it; the engine is booted on a manual clock and a manual timer; the three seeded operators are
// signed in on the web console. `app.ts` does not register the capture-inputs module yet (P25, the
// request is in `file_requests.md`): the support registers it before `ready()`. The adapters are
// the fakes of row 65 behind the probe; the discovery service is a stand-in that counts its calls
// (the real one is row 132's). What is stored is read as `dems_owner`.
//
// ONE app for the file: the probe and the discovery seam are provided once per app.
import { validateCoreApiResponse, type CurrentSessionResponse } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { storedSlices } from '../../../../test/support/engine';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { captureNotices, type ClosedSearch, type PrecheckSearchOwner } from '../../../capture-notices';
import { AudioInputErrorCode } from '../../../capture/adapters';
import { captureDiscoveryControl } from '../../capture-discovery';
import { bodyOf, errorOf, outcome } from '../../devices/__tests__/support';
import { CURRENT, SESSION, on, sessionInput } from '../../sessions/__tests__/support';
import { RESCAN, noticesApp, stoppableFakes, type NoticesApp, type StoppableFakes } from './support';

const db = useTestDatabase({ template: 'seed' });
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let server: NoticesApp;
let adapters: StoppableFakes;
const searches: PrecheckSearchOwner[] = [];
let nextSearch: () => ClosedSearch | null = () => null;

beforeAll(async () => {
  server = await noticesApp(db);
  // A process start leaves the tablet link OFFLINE, which blocks the CORE check of every pre-check.
  await server.engine.setTabletLink('CONNECTED');
  adapters = stoppableFakes();
  const notices = captureNotices(server.app);
  notices.provideProbe(adapters.probe);
  // The discovery module (row 132) provides the pre-check search seam itself since decision D114.
  // This file keeps its stand-in that counts the calls: it takes the place of that seam's one method.
  vi.spyOn(captureDiscoveryControl(server.app).precheckSearch, 'runPrecheckSearch').mockImplementation(async (owner) => {
    searches.push(owner);
    return nextSearch();
  });
});

const alerts = (reason: string, active?: boolean) =>
  server.engine.slice('alerts').filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === reason && (active === undefined || alert.active === active));
const typed = (rows: readonly AuditRow[], type: string): AuditRow[] => rows.filter((row) => row.type === type);
const alertPublications = () => server.stateChanges().filter((change) => change.ops.some((op) => op.op === 'replace' && op.slice === 'alerts'));

/** What the tables hold equals the committed state of the engine (the mic order of the selector apart: row 66's open request), and the chain verifies. */
async function expectStoredEqualsCommitted(): Promise<void> {
  await server.app.pipeline.drain();
  const stored = await storedSlices(server.owner);
  // Audit row W3F (F-W3TW-D3, D142): `reach` and `checkedAt` of a device are the Core's live reach reading, held in memory
  // only (row 125; row 127 §7; state-slices.ts: "never part of a stored snapshot"). Since row 128b a pre-check run with a
  // probe states them in the engine, so the committed state carries them and the tables cannot. They are taken out of the
  // COMMITTED side only, and nothing else is: a stored reach, or any other difference, still fails the equality.
  const committedState = withoutNegativeZeros(server.engine.state());
  const memoryOnlyOut = <Device extends { reach?: unknown; checkedAt?: unknown }>(device: Device): Device => {
    const copy = { ...device };
    delete copy.reach;
    delete copy.checkedAt;
    return copy;
  };
  const committed = { ...committedState, captureDevices: { ...committedState.captureDevices, devices: committedState.captureDevices.devices.map(memoryOnlyOut) } };
  const byInput = <Mic extends { inputId: string }>(mics: readonly Mic[]): Mic[] => [...mics].sort((left, right) => (left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0));
  expect({ ...stored, captureConfig: { ...stored.captureConfig, mics: byInput(stored.captureConfig.mics) } }).toStrictEqual({ ...committed, captureConfig: { ...committed.captureConfig, mics: byInput(committed.captureConfig.mics) } });
  const rows = await readTrail(server.owner);
  const head = await readHead(server.owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
}

/** Waits for what the gate of the last pre-check run started in the background (its search and the camera alerts). */
async function settle(): Promise<void> {
  // The gate's outcome is not handed to the route: the test waits on the engine and the pipeline.
  for (let round = 0; round < 5; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    await server.engine.idle();
    await server.app.pipeline.drain();
  }
}

type OpenSession = NonNullable<CurrentSessionResponse['session']>;
type Checked = OpenSession & { precheck: NonNullable<OpenSession['precheck']> };

/** A check row of the replicated `session` slice: what the clients draw (`reasonCode`, `params`); operation 27 carries the four book members only. */
const sliceItem = (id: string) => server.engine.slice('session')?.precheck.items.find((item) => item.id === id);

async function currentSession(): Promise<Checked> {
  const response = await server.get('INVESTIGATOR', CURRENT);
  const session = (response.json() as CurrentSessionResponse).session;
  if (session === null || session === undefined) throw new Error('no open session');
  if (session.precheck === null || session.precheck === undefined) throw new Error('the open session has no pre-check');
  return session as Checked;
}

describe('situation A through the real engine (M4-NODEV-A-1)', () => {
  it('an empty search stores exactly ONE alert and NO audit row; five leave one; a later non-empty search resolves it; the next empty one is a NEW alert', async () => {
    const notifier = captureNotices(server.app).notifier;
    await expectStoredEqualsCommitted();
    const before = await server.trailLength();
    const published = alertPublications().length;

    for (let index = 1; index <= 5; index += 1) expect(await notifier.searchClosed({ searchId: `DSC-00000${index}`, trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 0 })).toBe(true);
    expect(alerts('CAPTURE_DISCOVERY_EMPTY')).toHaveLength(1);
    expect(alerts('CAPTURE_DISCOVERY_EMPTY')[0]).toMatchObject({ kind: 'SYSTEM', severity: 'WARNING', active: true, target: 'CAPTURE_DISCOVERY', params: { reason: 'CAPTURE_DISCOVERY_EMPTY', searchId: 'DSC-000001', trigger: 'MANUAL' } });
    // D80(8): no second audit row. The trail did not grow at all (the search row is the discovery module's).
    expect(await server.trailLength()).toBe(before);
    // Raised once: ONE publication of the alerts slice for five searches.
    expect(alertPublications()).toHaveLength(published + 1);
    await expectStoredEqualsCommitted();

    await notifier.searchClosed({ searchId: 'DSC-000006', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2 });
    expect(alerts('CAPTURE_DISCOVERY_EMPTY', true)).toHaveLength(0);
    expect(await server.trailLength()).toBe(before);
    await expectStoredEqualsCommitted();

    await notifier.searchClosed({ searchId: 'DSC-000007', trigger: 'PRECHECK', outcome: 'COMPLETE', responderCount: 0 });
    const all = alerts('CAPTURE_DISCOVERY_EMPTY');
    expect(all.map((alert) => alert.active)).toEqual([false, true]);
    expect(all[0]?.id).not.toBe(all[1]?.id);
    expect(await server.trailLength()).toBe(before);
    // Leave no alert of situation A behind for the next block.
    await notifier.searchClosed({ searchId: 'DSC-000008', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 1 });
    await expectStoredEqualsCommitted();
  });
});

describe('situation B through the sessions routes (M4-NODEV-B-1, M4-PRECHK-RULE-1)', () => {
  it('one camera stopped, started by an operator WITHOUT CAPTURE_CONFIG: WARN, one search for that operator, one alert with its count, one CAPTURE_DEVICE_UNREACHABLE row; retry reachable resolves; a second occurrence is NEW', async () => {
    const investigator = server.operatorId('INVESTIGATOR');
    adapters.stop('CAM-02');
    nextSearch = () => ({ searchId: 'DSC-000021', trigger: 'PRECHECK', outcome: 'COMPLETE', responderCount: 3 });
    searches.length = 0;

    const created = await server.post('INVESTIGATOR', SESSION, sessionInput(investigator, 'LP/2026/1001-0133'));
    expect(created.statusCode).toBe(201);
    const sessionId = (created.json() as { sessionId: string }).sessionId;
    const before = await server.trailLength();

    // 28 beginPrecheck: the gate runs before the hosted action.
    expect((await server.post('INVESTIGATOR', on(sessionId, 'precheck'))).statusCode).toBe(202);
    await settle();
    await server.drive(5_000);
    await settle();

    // The one search of the run, owned by the INVESTIGATOR's web session: no CAPTURE_CONFIG was asked.
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatchObject({ operatorId: investigator, deviceId: null });
    let session = await currentSession();
    expect(session.precheck.outcome).toBe('WARN');
    // Audit fix rows 83/90 (DF-03): twelve checks - four lenses, four channels.
    expect(session.precheck.items.map((item) => item.id)).toEqual(['CORE', 'LENS_1', 'LENS_2', 'LENS_3', 'LENS_4', 'MIC_PRIMARY', 'MIC_STANDBY', 'MIC_3', 'MIC_4', 'STORAGE', 'TIME', 'SECURITY']);
    expect(session.precheck.items.find((item) => item.id === 'LENS_2')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', reason: 'CAM-02 is not reachable' });
    expect(sliceItem('LENS_2')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', reasonCode: null, params: { deviceId: 'CAM-02', deviceKind: 'CAMERA', rule: 'oneCamera' } });
    expect(validateCoreApiResponse('getCurrentSession', 200, bodyOf(await server.get('INVESTIGATOR', CURRENT)))).toEqual({ ok: true });

    // The notification only: one alert, ids, counts and codes.
    expect(alerts('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => [alert.target, alert.severity, alert.params])).toEqual([
      ['CAM-02', 'WARNING', { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 3 }],
    ]);
    let rows = await server.since(before);
    const unreachable = typed(rows, 'CAPTURE_DEVICE_UNREACHABLE');
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0]).toMatchObject({ category: 'DEVICE', severity: 'WARNING', actorId: null, deviceId: 'CAM-02', sessionId });
    // Exactly the six keys of C3 §5.2: no address, no label, no user name.
    expect(unreachable[0]?.details).toEqual({ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId });
    expect(server.engine.slice('captureDevices').devices.find((device) => device.id === 'CAM-02')).toMatchObject({ online: false, streamState: 'LOST' });
    await expectStoredEqualsCommitted();

    // 29 retryPrecheck, still stopped: no second alert, no second row (raised once per occurrence).
    expect((await server.post('INVESTIGATOR', on(sessionId, 'precheck/retry'))).statusCode).toBe(202);
    await settle();
    await server.drive(5_000);
    await settle();
    expect(alerts('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(typed(await server.since(before), 'CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(searches).toHaveLength(2);

    // The camera answers again: the next run resolves the alert, writes no row for that, and arms.
    adapters.start('CAM-02');
    expect((await server.post('INVESTIGATOR', on(sessionId, 'precheck/retry'))).statusCode).toBe(202);
    await settle();
    await server.drive(5_000);
    await settle();
    session = await currentSession();
    expect(session.state).toBe('ARMED');
    expect(alerts('CAPTURE_DEVICE_UNREACHABLE').map((alert) => alert.active)).toEqual([false]);
    rows = await server.since(before);
    expect(typed(rows, 'CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(searches).toHaveLength(2);
    expect(server.engine.slice('captureDevices').devices.find((device) => device.id === 'CAM-02')).toMatchObject({ online: true, streamState: 'LIVE' });
    await expectStoredEqualsCommitted();

    // A second occurrence after clearing: a NEW alert with its own row.
    expect((await server.post('INVESTIGATOR', on(sessionId, 'cancel'))).statusCode).toBe(204);
    adapters.stop('CAM-02');
    nextSearch = () => null;
    const again = await server.post('INVESTIGATOR', SESSION, sessionInput(investigator, 'LP/2026/1001-0134'));
    const secondId = (again.json() as { sessionId: string }).sessionId;
    // 25 startSession from CREATE is a pre-check run too.
    expect((await server.post('INVESTIGATOR', on(secondId, 'start'), {})).statusCode).toBe(202);
    await settle();
    await server.drive(5_000);
    await settle();
    const all = alerts('CAPTURE_DEVICE_UNREACHABLE');
    expect(all.map((alert) => alert.active)).toEqual([false, true]);
    expect(all[0]?.id).not.toBe(all[1]?.id);
    // The search was not started (single flight): no count, and the pre-check is not failed by it.
    expect(all[1]?.params).toEqual({ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE' });
    expect((await currentSession()).precheck.outcome).toBe('WARN');
    expect(typed(await server.since(before), 'CAPTURE_DEVICE_UNREACHABLE').map((row) => row.sessionId)).toEqual([sessionId, secondId]);
    await expectStoredEqualsCommitted();

    expect((await server.post('INVESTIGATOR', on(secondId, 'cancel'))).statusCode).toBe(204);
    adapters.start('CAM-02');
    // The alert of this occurrence is still active (no later run found the camera reachable). The
    // capture side resolves it here, so that the next block starts from no alert.
    await captureNotices(server.app).notifier.deviceReachable('CAM-02', 'PRECHECK');
    expect(alerts('CAPTURE_DEVICE_UNREACHABLE', true)).toEqual([]);
  });

  it('every camera stopped blocks the start; one camera down warns; the active microphone removed blocks; another channel removed warns (D83; D60, 2026-11-04: four tracks)', async () => {
    const investigator = server.operatorId('INVESTIGATOR');
    nextSearch = () => ({ searchId: 'DSC-000031', trigger: 'PRECHECK', outcome: 'COMPLETE', responderCount: 1 });
    const run = async (caseNumber: string): Promise<{ sessionId: string; session: Checked; rows: AuditRow[] }> => {
      const before = await server.trailLength();
      const created = await server.post('INVESTIGATOR', SESSION, sessionInput(investigator, caseNumber));
      const sessionId = (created.json() as { sessionId: string }).sessionId;
      expect((await server.post('INVESTIGATOR', on(sessionId, 'precheck'))).statusCode).toBe(202);
      await settle();
      await server.drive(5_000);
      await settle();
      return { sessionId, session: await currentSession(), rows: await server.since(before) };
    };
    // Read after each run from the replicated slice (the run's session is still open).
    const itemOf = (_session: Checked, id: string) => sliceItem(id);

    // D60 (2026-11-04): the selector names FOUR cameras, so `noCamera` needs all four down — the
    // old two-camera pair now only degrades (the rule of the one remaining track, `oneCamera`).
    const ALL_CAMERAS = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'];
    // All four cameras.
    for (const id of ALL_CAMERAS) adapters.stop(id);
    const both = await run('LP/2026/1001-0135');
    expect(both.session.precheck.outcome).toBe('BLOCK');
    expect(itemOf(both.session, 'LENS_1')).toMatchObject({ status: 'BLOCK', params: { rule: 'noCamera' } });
    expect(itemOf(both.session, 'LENS_2')).toMatchObject({ status: 'BLOCK', params: { rule: 'noCamera' } });
    // Audit fix rows 83/90 (DF-03): lenses 3 and 4 have their own items and say the same.
    expect(itemOf(both.session, 'LENS_3')).toMatchObject({ status: 'BLOCK', params: { deviceId: 'CAM-03', rule: 'noCamera' } });
    expect(itemOf(both.session, 'LENS_4')).toMatchObject({ status: 'BLOCK', params: { deviceId: 'CAM-04', rule: 'noCamera' } });
    expect(typed(both.rows, 'CAPTURE_DEVICE_UNREACHABLE').map((row) => [row.details['deviceId'], row.details['degraded']])).toEqual([['CAM-01', false], ['CAM-02', false], ['CAM-03', false], ['CAM-04', false]]); // D60: one row per stopped track
    expect(typed(both.rows, 'PRECHECK_BLOCKED')).toHaveLength(1);
    // A start from a blocked result is refused, also with the acknowledgement.
    const refused = await server.post('INVESTIGATOR', on(both.sessionId, 'start'), { acknowledgeWarnings: true });
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused).code).toBe('PRECHECK_BLOCKED');
    expect((await currentSession()).state).toBe('PRECHECK');
    expect((await server.post('INVESTIGATOR', on(both.sessionId, 'cancel'))).statusCode).toBe(204);
    for (const id of ALL_CAMERAS) adapters.start(id);

    // The ACTIVE microphone: blocked, 0 searches, the named cause in the row.
    searches.length = 0;
    adapters.fakes.mics[0]?.setPresent(false, AudioInputErrorCode.DEVICE_BUSY);
    const active = await run('LP/2026/1001-0136');
    expect(active.session.precheck.outcome).toBe('BLOCK');
    expect(itemOf(active.session, 'MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', value: 'UNREACHABLE', params: { deviceId: 'MIC-01', rule: 'activeMicrophone', other: 'MIC-02' } });
    expect(itemOf(active.session, 'LENS_1')).toMatchObject({ status: 'PASS' });
    expect(typed(active.rows, 'CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details)).toEqual([{ deviceId: 'MIC-01', deviceKind: 'MIC', phase: 'PRECHECK', reason: 'DEVICE_BUSY', degraded: false, sessionId: active.sessionId }]);
    expect(searches).toEqual([]);
    expect((await server.post('INVESTIGATOR', on(active.sessionId, 'cancel'))).statusCode).toBe(204);
    adapters.fakes.mics[0]?.setPresent(true);

    // Audit fix rows 83/90 (DF-03): channel 3 has its own item (MIC_3). Removed, it WARNS like channel 2 - only channel 1
    // blocks (D83) - and names its own device. Run before the STANDBY case, which then resolves this alert.
    const third = adapters.fakes.mics.find((mic) => mic.devices[0]?.id === 'MIC-03');
    if (third === undefined) throw new Error('the fake registry holds no MIC-03');
    third.setPresent(false, AudioInputErrorCode.DEVICE_NOT_FOUND);
    const channel3 = await run('LP/2026/1001-0138');
    expect(channel3.session.precheck.outcome).toBe('WARN');
    expect(itemOf(channel3.session, 'MIC_3')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId: 'MIC-03', deviceKind: 'MIC', rule: 'noStandby' } });
    expect(typed(channel3.rows, 'CAPTURE_DEVICE_UNREACHABLE').map((row) => [row.details['deviceId'], row.details['degraded']])).toEqual([['MIC-03', true]]);
    expect((await server.post('INVESTIGATOR', on(channel3.sessionId, 'cancel'))).statusCode).toBe(204);
    third.setPresent(true);

    // The STANDBY microphone: a warning, and the degraded session starts after the acknowledgement.
    adapters.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.DEVICE_NOT_FOUND);
    const standby = await run('LP/2026/1001-0137');
    expect(standby.session.precheck.outcome).toBe('WARN');
    expect(itemOf(standby.session, 'MIC_STANDBY')).toMatchObject({ status: 'WARN', params: { deviceId: 'MIC-02', rule: 'noStandby' } });
    // The previous run's MIC-03 alert (the channel 3 case above) was resolved by this run (it answered), with no row.
    expect(alerts('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.target)).toEqual(['MIC-02']);
    expect(typed(standby.rows, 'CAPTURE_DEVICE_UNREACHABLE').map((row) => [row.details['deviceId'], row.details['degraded']])).toEqual([['MIC-02', true]]);
    await expectStoredEqualsCommitted();
    expect((await server.post('INVESTIGATOR', on(standby.sessionId, 'cancel'))).statusCode).toBe(204);
    adapters.fakes.mics[1]?.setPresent(true);
  });
});

describe('operation 97 through the real pipeline (M4-MIC-RESCAN-1)', () => {
  it('TECHNICIAN re-reads the inputs twice, one CAPTURE_DISCOVERY_SEARCHED row each with scope MIC_LOCAL; SUPERVISOR (CAPTURE_CONFIG REVOKED, 0034) and INVESTIGATOR are refused 403 with ONE ACCESS_DENIED row each; the spacing answers 429 with no row', async () => {
    server.clock.advance(60_000);
    adapters.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.PERMISSION_DENIED);
    let before = await server.trailLength();
    const enumerated = adapters.fakes.mics.map((mic) => mic.calls.enumerate);
    // The standby case above left the pre-check alert of MIC-02 active: a re-read neither adds to the alerts nor resolves one.
    const alertsBefore = server.engine.slice('alerts');
    expect(alerts('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.target)).toEqual(['MIC-02']);

    // REVISED 2026-11-04 (migration 0034, ratified 2026-10-29): CAPTURE_CONFIG was REVOKED from SUPERVISOR —
    // the re-read is the installing technician's (the idiom of the audio-cards routes and camera-network files).
    const first = await server.post('TECHNICIAN', RESCAN);
    expect(first.statusCode).toBe(200);
    expect(validateCoreApiResponse('rescanCaptureInputs', 200, bodyOf(first))).toEqual({ ok: true });
    // Fix wave H (G70-01, decision D196): this server runs SIMULATED capture (the probe is the test's), so no entry
    // states an adapter or a source class; what a real operation states is `routes.test.ts`'s (capture mode real).
    // D61 (2026-11-04): the Core registers FOUR numbered microphone channels, so the re-read names all four.
    expect((first.json() as { inputs: unknown[]; unregisteredCount: number }).inputs).toEqual([
      { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, errorCode: null },
      { deviceId: 'MIC-02', inputId: 'MIC-02', present: false, errorCode: 'PERMISSION_DENIED' },
      { deviceId: 'MIC-03', inputId: 'MIC-03', present: true, errorCode: null },
      { deviceId: 'MIC-04', inputId: 'MIC-04', present: true, errorCode: null },
    ]);
    await server.app.pipeline.drain();
    let rows = await server.since(before);
    expect(rows.map((row) => [row.type, row.category, row.actorId])).toEqual([['CAPTURE_DISCOVERY_SEARCHED', 'DEVICE', server.operatorId('TECHNICIAN')]]);
    // D61 (2026-11-04): four channels are registered; THREE answer (MIC-02 is out with its error).
    expect(rows[0]?.details).toMatchObject({ scope: 'MIC_LOCAL', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 3, registeredCount: 4, newCount: 0, interfaceCount: 0, operationId: 'rescanCaptureInputs', permission: 'CAPTURE_CONFIG' });
    expect(String(rows[0]?.details['searchId'])).toMatch(/^DSC-[0-9]{6,}$/);
    // `captureDevices` is published and stored: MIC-02 reads not online. No alert: that is a pre-check's.
    expect(server.engine.slice('captureDevices').devices.find((device) => device.id === 'MIC-02')?.online).toBe(false);
    expect(server.engine.slice('alerts')).toEqual(alertsBefore);
    await expectStoredEqualsCommitted();

    // Inside the interval: 429, retry-after, no row, nothing read.
    before = await server.trailLength();
    const limited = await server.post('TECHNICIAN', RESCAN);
    expect(outcome(limited)).toEqual([429, 'RATE_LIMITED']);
    expect(errorOf(limited).details).toMatchObject({ reason: 'INPUT_RESCAN_RATE_LIMITED' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    await server.app.pipeline.drain();
    expect(await server.trailLength()).toBe(before);
    expect(adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual(enumerated.map((count) => count + 1));

    // INVESTIGATOR and SUPERVISOR: refused and audited, nothing read. The refusal takes no spacing slot.
    // (SUPERVISOR since 2026-10-29: its CAPTURE_CONFIG is REVOKED, migration 0034 — the guard got stronger.)
    server.clock.advance(60_000);
    for (const deniedRole of ['INVESTIGATOR', 'SUPERVISOR'] as const) {
      const from = await server.trailLength();
      const denied = await server.post(deniedRole, RESCAN);
      expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
      await server.app.pipeline.drain();
      rows = await server.since(from);
      expect(rows.map((row) => [row.type, row.actorId]), deniedRole).toEqual([['ACCESS_DENIED', server.operatorId(deniedRole)]]);
      expect(rows[0]?.details).toMatchObject({ operationId: 'rescanCaptureInputs', permission: 'CAPTURE_CONFIG', role: deniedRole });
      expect(adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual(enumerated.map((count) => count + 1));
    }
    expect(outcome(await server.post(null, RESCAN))).toEqual([401, 'NOT_SIGNED_IN']);

    // TECHNICIAN, the microphone plugged back: present, online again, its own row.
    adapters.fakes.mics[1]?.setPresent(true);
    before = await server.trailLength();
    const second = await server.post('TECHNICIAN', RESCAN);
    expect(second.statusCode).toBe(200);
    expect((second.json() as { inputs: { present: boolean }[] }).inputs.map((input) => input.present)).toEqual([true, true, true, true]); // D61 (2026-11-04): the four numbered channels
    await server.app.pipeline.drain();
    rows = await server.since(before);
    expect(rows.map((row) => [row.type, row.actorId, row.details['responderCount']])).toEqual([['CAPTURE_DISCOVERY_SEARCHED', server.operatorId('TECHNICIAN'), 4]]); // D61: four channels answered
    expect(server.engine.slice('captureDevices').devices.find((device) => device.id === 'MIC-02')?.online).toBe(true);
    // Present again in a re-read: the pre-check alert stays until a pre-check run finds it reachable (C3 §5.4).
    expect(alerts('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.target)).toEqual(['MIC-02']);
    await expectStoredEqualsCommitted();
  });
});
