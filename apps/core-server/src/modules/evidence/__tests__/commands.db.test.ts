// Operations 41, 42 and 43 against PostgreSQL as `dems_app`: the three hosted actions `verify`,
// `exportEvidence` and `archiveEvidence` through the real stages and the real engine host (plan
// row W35; spec §7.9, §7.2, §7.3, §7.17, ENG-1 to ENG-7; decision D83 rules M3, M4, M11; engine
// host finding F-11: each hosted action of the module is run against PostgreSQL here).
//
// Each block boots the real app on its own clone of the seed template (a process start), on a
// manual clock and a manual timer. Operators are the seeded ones, signed in on the web console.
// What is stored is read as `dems_owner`. Counts are relative to the trail AFTER the boot.
import { EPOCH_HEADER_NAME, EvidenceVerifyResultSchema, EXPORT_ID_PATTERN, REVISION_HEADER_NAME, validateCoreApiResponse } from '@dems/shared/api';
import { DEFAULT_EXPORT_DESTINATION, EVIDENCE_STATUS_STAGE, ROLE_PERMISSIONS, type AuditRow, type EvidenceItem, type OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { stateChanges } from '../../../../test/support/engine';
import {
  EVIDENCE,
  UNKNOWN_EVIDENCE_ID,
  archiveUrl,
  countOf,
  errorOf,
  evidenceApp,
  exportUrl,
  itemUrl,
  outcomeOf,
  principalOf,
  sealedDigest,
  storedCustody,
  storedState,
  trackListsOf,
  trailLength,
  trailSince,
  verifyUrl,
  type EvidenceApp,
  type EvidenceAppOptions,
  type Headers,
} from './support';

const db = useTestDatabase({ template: 'seed' });

const FOUR_TRACKS = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'];
const ROLES: readonly OperatorRole[] = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'];

interface Booted {
  readonly host: EvidenceApp;
  readonly owner: Pool;
  readonly session: Record<OperatorRole, Headers>;
  /** The seeded items by what the tests need of them. */
  readonly sealed: readonly EvidenceItem[];
  readonly recorded: EvidenceItem;
  readonly exported: EvidenceItem;
  readonly underReview: EvidenceItem;
  /** The dataset's item whose stored AUDIO-02 was altered after sealing. */
  readonly tampered: EvidenceItem;
}

/** A process start on a fresh clone of the seed, with the three seeded operators signed in on the web. */
async function booted(slug: string, options: EvidenceAppOptions & { signIn?: boolean } = {}): Promise<Booted> {
  const target = await db.another({ slug });
  const host = await evidenceApp(target, db.run.dataDir, options);
  const owner = target.ownerPool();
  const session = { INVESTIGATOR: {}, SUPERVISOR: {}, TECHNICIAN: {} } as Record<OperatorRole, Headers>;
  if (options.signIn !== false) for (const role of ROLES) session[role] = await host.signIn(role);
  const items = host.engine.slice('evidence');
  const one = (label: string, pick: (item: EvidenceItem) => boolean): EvidenceItem => {
    const found = items.find(pick);
    if (found === undefined) throw new Error(`the seed has no ${label} item`);
    return found;
  };
  return {
    host,
    owner,
    session,
    sealed: items.filter((item) => item.status === 'SEALED' && !item.tampered),
    recorded: one('RECORDED', (item) => item.status === 'RECORDED'),
    exported: one('EXPORTED', (item) => item.status === 'EXPORTED'),
    underReview: one('UNDER_REVIEW', (item) => item.status === 'UNDER_REVIEW'),
    tampered: one('tampered', (item) => item.tampered),
  };
}

/** The n-th untampered SEALED item of the seed: each test takes its own. */
function sealedItem(from: Booted, index: number): EvidenceItem {
  const item = from.sealed[index];
  if (item === undefined) throw new Error(`the seed has no ${index + 1}th sealed item`);
  return item;
}

/** What one request stored and published, measured around it. */
interface Effect {
  readonly response: LightMyRequestResponse;
  readonly rows: AuditRow[];
  readonly events: Awaited<ReturnType<typeof readEvents>>;
  /** Units of work the pipeline completed. */
  readonly units: number;
  /** Hosted commands the engine ran (also the refused ones). */
  readonly commands: number;
  readonly revisionBefore: number;
  readonly published: ReturnType<typeof stateChanges>;
  /** Every statement the request sent on a checked-out connection. */
  readonly statements: string[];
}

async function effectOf(from: Booted, request: () => Promise<LightMyRequestResponse>): Promise<Effect> {
  const { host, owner } = from;
  const trail = await trailLength(owner);
  const events = (await readEvents(owner)).length;
  const units = host.app.pipeline.snapshot().completed;
  const commands = host.engine.stats().commands;
  const revisionBefore = host.engine.revision;
  const published = host.publications.length;
  const sent = host.database.statements.length;
  const response = await request();
  return {
    response,
    rows: await trailSince(owner, trail),
    events: (await readEvents(owner)).slice(events),
    units: host.app.pipeline.snapshot().completed - units,
    commands: host.engine.stats().commands - commands,
    revisionBefore,
    published: stateChanges(host.publications.slice(published)),
    statements: host.database.statements.slice(sent),
  };
}

/** The state position of API-7 on a 2xx answer of a POST is the engine's, after the command. */
function expectStatePosition(response: LightMyRequestResponse, host: EvidenceApp): void {
  expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(host.engine.epoch));
  expect(response.headers[REVISION_HEADER_NAME]).toBe(String(host.engine.revision));
}

/** The statements of one request, numbered and cut to their first 64 characters: for the row's document. */
const numbered = (statements: readonly string[]): string =>
  statements.map((text, index) => `[w35]   ${String(index + 1).padStart(2)} ${text.replace(/\s+/g, ' ').slice(0, 64)}`).join('\n');

function expectNoStatePosition(response: LightMyRequestResponse): void {
  expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
  expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
}

/** The stored trail still verifies from the genesis hash, and its head is the engine's. */
async function expectChainIntact(from: Booted): Promise<void> {
  const head = await readHead(from.owner);
  expect(verifyTrail(await readTrail(from.owner), head)).toMatchObject({ ok: true });
  expect(head).toEqual({ seq: from.host.engine.slice('audit').total, hash: from.host.engine.slice('audit').head });
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('operation 41 verifyEvidence: the hosted action `verify`', () => {
  let app: Booted;

  beforeAll(async () => {
    app = await booted('w35_verify');
  });
  beforeEach(() => app.host.forgetCounters());

  it('a sealed item verifies: 200 with the verdict of record, one EVIDENCE_VERIFIED row and one event naming the caller, one custody entry, the state position', async () => {
    const { host, owner } = app;
    const item = sealedItem(app, 0);
    const custody = await storedCustody(owner, item.id);
    const at = host.clock.now();

    const effect = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.INVESTIGATOR));
    const { response } = effect;
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('verifyEvidence', 200, response.json())).toEqual({ ok: true });
    const verdict = EvidenceVerifyResultSchema.parse(response.json());
    expect(verdict).toMatchObject({ evidenceId: item.id, ok: true, at, manifestOk: true, signatureOk: true });
    // One result per track, each against the SEALED hash of that track.
    expect(verdict.tracks).toEqual(item.tracks.map((track) => ({ trackId: track.trackId, expected: track.sha256, actual: track.sha256, ok: true })));
    expect(trackListsOf(response.json())).toEqual([FOUR_TRACKS]);

    // API-7: the answer came after the commit and names the revision that holds the effect.
    expectStatePosition(response, host);
    expect(host.engine.revision).toBe(effect.revisionBefore + 1);
    expect(effect.units).toBe(1);
    expect(effect.commands).toBe(1);
    expect(effect.published).toHaveLength(1);
    expect(effect.published[0]).toMatchObject({ cause: 'command', revision: host.engine.revision, records: true });

    const operatorId = host.operator('INVESTIGATOR').id;
    expect(effect.rows.map((row) => row.type)).toEqual(['EVIDENCE_VERIFIED']);
    expect(effect.rows[0]).toMatchObject({
      actorId: operatorId,
      evidenceId: item.id,
      at,
      severity: 'INFO',
      deviceId: null,
      details: { manifestOk: true, signatureOk: true, failedTracks: '' },
    });
    expect(effect.events.map((event) => event.type)).toEqual(['EVIDENCE_VERIFIED']);
    expect(effect.events[0]).toMatchObject({ severity: 'SUCCESS', params: { evidenceId: item.id, failedTracks: '' } });

    // Custody only grows: the entries that were there are as they were, and one is added.
    const after = await storedCustody(owner, item.id);
    expect(after.slice(0, custody.length)).toEqual(custody);
    expect(after.slice(custody.length)).toEqual([{ seq: custody.length + 1, at, action: 'VERIFIED', actorId: operatorId, detail: null }]);
    expect(await storedState(owner, item.id)).toMatchObject({ status: 'SEALED', verificationStatus: 'PASS', verificationAt: at, tampered: false });
    await expectChainIntact(app);
  });

  it('measured round trips of one command: the unit of the hosted action, statement by statement', async () => {
    const { host } = app;
    const item = sealedItem(app, 1);
    const effect = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.INVESTIGATOR));
    expect(effect.response.statusCode).toBe(200);
    console.info(`[w35] verifyEvidence: ${effect.statements.length} statements on one connection, one transaction:\n${numbered(effect.statements)}`);
    expect(effect.statements[0]).toMatch(/^BEGIN/);
    expect(effect.statements.at(-1)).toBe('COMMIT');
    expect(effect.statements.filter((text) => text.startsWith('insert into "audit_log"'))).toHaveLength(1);
    expect(effect.statements.filter((text) => text.startsWith('insert into "events"'))).toHaveLength(1);
    expect(effect.statements.filter((text) => text.startsWith('insert into "evidence_custody"'))).toHaveLength(1);
    // The item's row is updated in the columns the command changed, and in no sealed one.
    const update = effect.statements.find((text) => text.startsWith('update "evidence_items"')) ?? '';
    expect(update).toMatch(/"verification_status" = \$\d+/);
    expect(update).not.toMatch(/manifest_hash|signature_|"sha256"|recorded_at|size_bytes/);
    // No statement touches a track.
    expect(effect.statements.filter((text) => text.includes('evidence_tracks'))).toEqual([]);
  });

  it('the dataset\'s tampered item fails: 200 with ok false on AUDIO-02 only, one EVIDENCE_VERIFY_FAILED row (CRITICAL), custody VERIFY_FAILED', async () => {
    const { host, owner } = app;
    const item = app.tampered;
    const at = host.clock.now();
    const effect = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.SUPERVISOR));
    expect(effect.response.statusCode).toBe(200);
    expect(validateCoreApiResponse('verifyEvidence', 200, effect.response.json())).toEqual({ ok: true });
    const verdict = EvidenceVerifyResultSchema.parse(effect.response.json());
    expect(verdict).toMatchObject({ evidenceId: item.id, ok: false, manifestOk: true, signatureOk: true });
    expect(verdict.tracks.map((track) => [track.trackId, track.ok])).toEqual([['VIDEO-01', true], ['VIDEO-02', true], ['AUDIO-01', true], ['AUDIO-02', false]]);
    const audio2 = verdict.tracks.find((track) => track.trackId === 'AUDIO-02');
    // "expected" is the sealed hash, still what the item holds; "actual" is what the altered media gives.
    expect(audio2?.expected).toBe(item.tracks.find((track) => track.trackId === 'AUDIO-02')?.sha256);
    expect(audio2?.actual).not.toBe(audio2?.expected);
    expectStatePosition(effect.response, host);

    expect(effect.rows.map((row) => row.type)).toEqual(['EVIDENCE_VERIFY_FAILED']);
    expect(effect.rows[0]).toMatchObject({
      actorId: host.operator('SUPERVISOR').id,
      evidenceId: item.id,
      severity: 'CRITICAL',
      details: { manifestOk: true, signatureOk: true, failedTracks: 'AUDIO-02', eventKind: 'TAMPER' },
    });
    expect(effect.events.map((event) => [event.type, event.severity])).toEqual([['EVIDENCE_VERIFY_FAILED', 'CRITICAL']]);
    expect((await storedCustody(owner, item.id)).at(-1)).toMatchObject({ at, action: 'VERIFY_FAILED', actorId: host.operator('SUPERVISOR').id, detail: 'Mismatch: AUDIO-02' });
    expect(await storedState(owner, item.id)).toMatchObject({ verificationStatus: 'FAIL', verificationAt: at, tampered: true, tamperedTrackId: 'AUDIO-02' });
  });

  it('every role holds EVIDENCE_VIEW: the INVESTIGATOR, the SUPERVISOR and the TECHNICIAN verify, and each row names its caller', async () => {
    const { host } = app;
    const item = sealedItem(app, 2);
    for (const role of ROLES) {
      const effect = await effectOf(app, () => host.post(verifyUrl(item.id), app.session[role]));
      expect(effect.response.statusCode, role).toBe(200);
      expect(effect.rows.map((row) => [row.type, row.actorId]), role).toEqual([['EVIDENCE_VERIFIED', host.operator(role).id]]);
    }
  });

  it('SR-65: the actor is the session\'s operator, whatever a body claims; a time in the body is not used', async () => {
    const { host } = app;
    const item = sealedItem(app, 3);
    const at = host.clock.now();
    const effect = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.TECHNICIAN, { actorId: 'OPR-002', operatorId: 'OPR-002', at: 1, evidenceId: sealedItem(app, 4).id }));
    expect(effect.response.statusCode).toBe(200);
    expect(effect.rows[0]).toMatchObject({ actorId: host.operator('TECHNICIAN').id, evidenceId: item.id, at });
    expect((effect.response.json() as { at: number }).at).toBe(at);
  });

  it('an item of every status can be verified: RECORDED, EXPORTED and UNDER_REVIEW answer 200 and keep their status', async () => {
    const { host, owner } = app;
    for (const item of [app.recorded, app.exported, app.underReview]) {
      const effect = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.INVESTIGATOR));
      expect(effect.response.statusCode, item.status).toBe(200);
      expect(validateCoreApiResponse('verifyEvidence', 200, effect.response.json()), item.status).toEqual({ ok: true });
      expect(effect.rows).toHaveLength(1);
      expect((await storedState(owner, item.id)).status).toBe(item.status);
    }
  });

  it('an unknown item: 404 NOT_FOUND with the simulator\'s code; the unit is rolled back and nothing is stored or published', async () => {
    const { host } = app;
    const effect = await effectOf(app, () => host.post(verifyUrl(UNKNOWN_EVIDENCE_ID), app.session.INVESTIGATOR));
    expect(outcomeOf(effect.response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(effect.response)).toMatchObject({ message: 'Evidence not found.', details: { simCode: 'NOT_FOUND' } });
    expect(validateCoreApiResponse('verifyEvidence', 404, effect.response.json())).toEqual({ ok: true });
    expectNoStatePosition(effect.response);
    expect(effect.rows).toEqual([]);
    expect(effect.events).toEqual([]);
    expect(effect.published).toEqual([]);
    expect(host.engine.revision).toBe(effect.revisionBefore);
    expect(effect.statements.at(-1)).toBe('ROLLBACK');
    expect(effect.commands).toBe(1);
  });

  it('an ID that is no evidence ID: 422 INVALID_INPUT at the schema stage; the engine is not asked', async () => {
    const effect = await effectOf(app, () => app.host.post(verifyUrl('EV-2026093-0004'), app.session.INVESTIGATOR));
    expect(outcomeOf(effect.response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(effect.response).details).toEqual({ in: 'params' });
    expect(effect.commands).toBe(0);
    expect(effect.units).toBe(0);
  });

  it('nobody without a session verifies: 401, no row, no command', async () => {
    const effect = await effectOf(app, () => app.host.post(verifyUrl(sealedItem(app, 0).id)));
    expect(outcomeOf(effect.response)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(effect.rows).toEqual([]);
    expect(effect.commands).toBe(0);
  });

  it('ENG-5: a unit whose COMMIT fails answers 503 NOT_READY; nothing is stored, the engine is set back, and the same command works afterwards', async () => {
    const { host, owner } = app;
    const item = sealedItem(app, 5);
    const custody = await storedCustody(owner, item.id);
    const state = await storedState(owner, item.id);
    const held = host.engine.slice('evidence').find((entry) => entry.id === item.id);

    const left = host.database.failNext(/^COMMIT$/);
    const failed = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.INVESTIGATOR));
    expect(left()).toBe(0);
    expect(outcomeOf(failed.response)).toEqual([503, 'NOT_READY']);
    expect(validateCoreApiResponse('verifyEvidence', 503, failed.response.json())).toEqual({ ok: true });
    expectNoStatePosition(failed.response);
    expect(failed.rows).toEqual([]);
    expect(failed.events).toEqual([]);
    expect(failed.published).toEqual([]);
    expect(await storedCustody(owner, item.id)).toEqual(custody);
    expect(await storedState(owner, item.id)).toEqual(state);
    // The engine's committed item is the very object it was: the state was set back by reference.
    expect(host.engine.slice('evidence').find((entry) => entry.id === item.id)).toBe(held);
    expect(host.engine.revision).toBe(failed.revisionBefore);

    // The database answers again: the next command is committed, with exactly one row.
    await host.app.db.probe({ fresh: true });
    host.app.readiness.set('database', true);
    await host.drive(1_000);
    const again = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.INVESTIGATOR));
    expect(again.response.statusCode).toBe(200);
    expect(again.rows.filter((row) => row.type === 'EVIDENCE_VERIFIED')).toHaveLength(1);
    expect(await storedCustody(owner, item.id)).toHaveLength(custody.length + 1);
    await expectChainIntact(app);
  });

  it('a statement of the write-through that fails: the command is refused with an error envelope, nothing is stored and the engine is set back', async () => {
    const { host, owner } = app;
    const item = sealedItem(app, 6);
    const custody = await storedCustody(owner, item.id);
    const state = await storedState(owner, item.id);
    const held = host.engine.slice('evidence').find((entry) => entry.id === item.id);

    const left = host.database.failNext(/^insert into "evidence_custody"/, '57P01');
    const failed = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.INVESTIGATOR));
    expect(left()).toBe(0);
    // The status is the pipeline's, not this module's: 500 for a statement the store could not
    // write, 503 once the core reports a lost connection as not ready (decision D87, heads-up 2).
    expect([500, 503]).toContain(failed.response.statusCode);
    expect(['INTERNAL_ERROR', 'NOT_READY']).toContain(errorOf(failed.response).code);
    expect(validateCoreApiResponse('verifyEvidence', failed.response.statusCode, failed.response.json())).toEqual({ ok: true });
    expectNoStatePosition(failed.response);
    expect(failed.rows).toEqual([]);
    expect(failed.published).toEqual([]);
    expect(await storedCustody(owner, item.id)).toEqual(custody);
    expect(await storedState(owner, item.id)).toEqual(state);
    expect(host.engine.slice('evidence').find((entry) => entry.id === item.id)).toBe(held);
    // The log of the failure holds no statement and no row content (rule M14).
    const written = host.log.lines().slice(-12).map((line) => JSON.stringify(line)).join('\n');
    for (const forbidden of ['insert into', 'evidence_custody', 'Failed query']) expect(written, forbidden).not.toContain(forbidden);

    await host.app.db.probe({ fresh: true });
    host.app.readiness.set('database', true);
    await host.drive(1_000);
    const again = await effectOf(app, () => host.post(verifyUrl(item.id), app.session.INVESTIGATOR));
    expect(again.response.statusCode).toBe(200);
    expect(await storedCustody(owner, item.id)).toHaveLength(custody.length + 1);
    await expectChainIntact(app);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('operation 42 exportEvidence: the hosted action `exportEvidence`', () => {
  let app: Booted;

  beforeAll(async () => {
    app = await booted('w35_export');
  });
  beforeEach(() => app.host.forgetCounters());

  it('the SUPERVISOR exports a sealed item: 202 with the export ID, one EVIDENCE_EXPORTED row and event, one custody entry, one export record with the reason', async () => {
    const { host, owner } = app;
    const item = sealedItem(app, 0);
    const custody = await storedCustody(owner, item.id);
    const exportsBefore = await countOf(owner, 'exports');
    const at = host.clock.now();
    const supervisorId = host.operator('SUPERVISOR').id;

    const effect = await effectOf(app, () => host.post(exportUrl(item.id), app.session.SUPERVISOR, { reason: '  Prosecutor request 17/X  ', destination: 'Encrypted drive KJ-04' }));
    const { response } = effect;
    expect(response.statusCode).toBe(202);
    expect(validateCoreApiResponse('exportEvidence', 202, response.json())).toEqual({ ok: true });
    const body = response.json() as { exportId: string; evidenceId: string; status: string };
    expect(body).toEqual({ exportId: 'EXP-000032', evidenceId: item.id, status: 'EXPORTED' });
    expect(body.exportId).toMatch(EXPORT_ID_PATTERN);
    expectStatePosition(response, host);
    expect(host.engine.revision).toBe(effect.revisionBefore + 1);
    expect(effect.units).toBe(1);

    expect(effect.rows.map((row) => row.type)).toEqual(['EVIDENCE_EXPORTED']);
    expect(effect.rows[0]).toMatchObject({
      actorId: supervisorId,
      evidenceId: item.id,
      at,
      details: { exportId: 'EXP-000032', reason: 'Prosecutor request 17/X', destination: 'Encrypted drive KJ-04', eventKind: 'EXPORT' },
    });
    expect(effect.events.map((event) => event.type)).toEqual(['EVIDENCE_EXPORTED']);
    expect(effect.events[0]).toMatchObject({ params: { evidenceId: item.id, exportId: 'EXP-000032' } });

    const after = await storedCustody(owner, item.id);
    expect(after.slice(0, custody.length)).toEqual(custody);
    expect(after.slice(custody.length)).toEqual([{ seq: custody.length + 1, at, action: 'EXPORTED', actorId: supervisorId, detail: 'Encrypted drive KJ-04' }]);
    expect(await storedState(owner, item.id)).toMatchObject({ status: 'EXPORTED', lifecycleStage: EVIDENCE_STATUS_STAGE.EXPORTED });

    // The export record: who, what, why, where to, when. The reason as trimmed by the contract.
    expect(await countOf(owner, 'exports')).toBe(exportsBefore + 1);
    const record = await owner.query('SELECT id, scope, evidence_id, operator_id, reason, destination, at::text AS at FROM public.exports WHERE id = $1', ['EXP-000032']);
    expect(record.rows).toEqual([{ id: 'EXP-000032', scope: 'EVIDENCE', evidence_id: item.id, operator_id: supervisorId, reason: 'Prosecutor request 17/X', destination: 'Encrypted drive KJ-04', at: String(at) }]);
    // The answer holds no file and no path.
    expect(Object.keys(body).sort()).toEqual(['evidenceId', 'exportId', 'status']);
    await expectChainIntact(app);

    // Measured round trips: one transaction on one connection, and no statement touches a track.
    console.info(`[w35] exportEvidence: ${effect.statements.length} statements on one connection, one transaction:\n${numbered(effect.statements)}`);
    expect(effect.statements[0]).toMatch(/^BEGIN/);
    expect(effect.statements.at(-1)).toBe('COMMIT');
    expect(effect.statements.filter((text) => text.startsWith('insert into "exports"'))).toHaveLength(1);
    expect(effect.statements.filter((text) => text.includes('evidence_tracks'))).toEqual([]);
    const update = effect.statements.find((text) => text.startsWith('update "evidence_items"')) ?? '';
    expect(update).toMatch(/"status" = \$\d+/);
    expect(update).not.toMatch(/manifest_hash|signature_|"sha256"|recorded_at|size_bytes/);
  });

  it('an absent destination is the action\'s default; an item that is already EXPORTED can be exported again, with the next export ID', async () => {
    const { host, owner } = app;
    const effect = await effectOf(app, () => host.post(exportUrl(app.exported.id), app.session.SUPERVISOR, { reason: 'Second copy for the court' }));
    expect(effect.response.statusCode).toBe(202);
    const { exportId } = effect.response.json() as { exportId: string };
    expect(exportId).toBe('EXP-000033');
    expect(effect.rows[0]).toMatchObject({ type: 'EVIDENCE_EXPORTED', details: { destination: DEFAULT_EXPORT_DESTINATION, reason: 'Second copy for the court' } });
    const record = await owner.query<{ destination: string }>('SELECT destination FROM public.exports WHERE id = $1', [exportId]);
    expect(record.rows[0]?.destination).toBe(DEFAULT_EXPORT_DESTINATION);
    expect((await storedCustody(owner, app.exported.id)).at(-1)).toMatchObject({ action: 'EXPORTED', detail: DEFAULT_EXPORT_DESTINATION });
  });

  it('the bounds are the contract\'s and the server cuts nothing: a reason of 500 code units and a destination of 120 are stored as sent', async () => {
    const { host, owner } = app;
    const reason = `${'r'.repeat(498)}\u{1F6F0}`;
    const destination = `${'d'.repeat(118)}\u{10348}`;
    expect(reason).toHaveLength(500);
    expect(destination).toHaveLength(120);
    const effect = await effectOf(app, () => host.post(exportUrl(app.underReview.id), app.session.SUPERVISOR, { reason, destination }));
    expect(effect.response.statusCode).toBe(202);
    const { exportId } = effect.response.json() as { exportId: string };
    const record = await owner.query<{ reason: string; destination: string }>('SELECT reason, destination FROM public.exports WHERE id = $1', [exportId]);
    expect(record.rows[0]).toEqual({ reason, destination });
    expect(effect.rows[0]?.details).toMatchObject({ reason, destination });
    // One unit more than the bound is refused before the engine: nothing is stored.
    const tooLong = await effectOf(app, () => host.post(exportUrl(app.underReview.id), app.session.SUPERVISOR, { reason: `${reason}x`, destination }));
    expect(outcomeOf(tooLong.response)).toEqual([422, 'INVALID_INPUT']);
    expect(tooLong.commands).toBe(0);
    expect(tooLong.rows).toEqual([]);
  });

  it('line 10 of the precedence table, in the order the hosted action checks: 404, then 409 NOT_SEALED, then 409 SECURITY_FAULT, then 422 INVALID_REASON; each stores nothing', async () => {
    const { host, owner } = app;
    const sealed = sealedItem(app, 1);
    const exportsBefore = await countOf(owner, 'exports');
    const shortReason = { reason: 'abc' };
    const validReason = { reason: 'Prosecutor request' };

    const refused = async (label: string, url: string, payload: unknown, status: number, code: string, message: string): Promise<void> => {
      const effect = await effectOf(app, () => host.post(url, app.session.SUPERVISOR, payload as Record<string, unknown>));
      expect(outcomeOf(effect.response), label).toEqual([status, code]);
      expect(errorOf(effect.response).message, label).toBe(message);
      expect(validateCoreApiResponse('exportEvidence', status, effect.response.json()), label).toEqual({ ok: true });
      expectNoStatePosition(effect.response);
      // The hosted action ran and refused in its result: one command, one unit, nothing stored, nothing published.
      expect(effect.commands, label).toBe(1);
      expect(effect.units, label).toBe(1);
      expect(effect.rows, label).toEqual([]);
      expect(effect.events, label).toEqual([]);
      expect(effect.published, label).toEqual([]);
      expect(host.engine.revision, label).toBe(effect.revisionBefore);
    };

    // 404 first: an unknown item, whatever the reason is.
    await refused('unknown, short reason', exportUrl(UNKNOWN_EVIDENCE_ID), shortReason, 404, 'NOT_FOUND', 'Evidence not found.');
    await refused('unknown, valid reason', exportUrl(UNKNOWN_EVIDENCE_ID), validReason, 404, 'NOT_FOUND', 'Evidence not found.');
    await refused('unknown, no body', exportUrl(UNKNOWN_EVIDENCE_ID), undefined, 404, 'NOT_FOUND', 'Evidence not found.');
    // 409 NOT_SEALED before the reason: the RECORDED item of the incomplete session.
    await refused('recorded, short reason', exportUrl(app.recorded.id), shortReason, 409, 'NOT_SEALED', 'Only sealed evidence can be exported.');
    await refused('recorded, valid reason', exportUrl(app.recorded.id), validReason, 409, 'NOT_SEALED', 'Only sealed evidence can be exported.');
    // 422 INVALID_REASON last: a sealed item and no usable reason.
    await refused('sealed, short reason', exportUrl(sealed.id), shortReason, 422, 'INVALID_REASON', 'An export reason of at least 5 characters is required.');
    await refused('sealed, no body', exportUrl(sealed.id), undefined, 422, 'INVALID_REASON', 'An export reason of at least 5 characters is required.');
    await refused('sealed, blank reason', exportUrl(sealed.id), { reason: '     ', destination: 'Case file' }, 422, 'INVALID_REASON', 'An export reason of at least 5 characters is required.');

    // 409 SECURITY_FAULT: a security fault raised through the engine host (the demo-control module is another row).
    await host.engine.command(principalOf('SUPERVISOR'), 'inject', 'SECURITY_FAULT');
    expect(host.engine.slice('security').state).toBe('FAULT');
    await refused('security fault, valid reason', exportUrl(sealed.id), validReason, 409, 'SECURITY_FAULT', 'A security fault blocks export.');
    await refused('security fault, short reason', exportUrl(sealed.id), shortReason, 409, 'SECURITY_FAULT', 'A security fault blocks export.');
    await refused('security fault, unknown item', exportUrl(UNKNOWN_EVIDENCE_ID), validReason, 404, 'NOT_FOUND', 'Evidence not found.');
    await host.engine.command(principalOf('SUPERVISOR'), 'clearFault', 'SECURITY_FAULT');
    expect(host.engine.slice('security').state).not.toBe('FAULT');

    expect(await countOf(owner, 'exports')).toBe(exportsBefore);
    expect(await storedState(owner, sealed.id)).toMatchObject({ status: 'SEALED' });
    // After the refusals the same item exports.
    const accepted = await effectOf(app, () => host.post(exportUrl(sealed.id), app.session.SUPERVISOR, validReason));
    expect(accepted.response.statusCode).toBe(202);
    await expectChainIntact(app);
  });

  it('line 8 before line 10: a body that breaks the schema answers 422 INVALID_INPUT before the engine, also for an unknown item and for one that was never sealed', async () => {
    // Gap W35-2, closed by the contract close-out W83: the `all`-scope text of this 422 names
    // INVALID_INPUT beside INVALID_REASON (the offline text, the simulator's, names INVALID_REASON).
    const { host } = app;
    for (const id of [UNKNOWN_EVIDENCE_ID, app.recorded.id, sealedItem(app, 2).id]) {
      for (const payload of [{ reason: 12_345 }, { reason: 'Prosecutor request', destination: 'd'.repeat(121) }, { reason: 'abc\u0000def' }]) {
        const effect = await effectOf(app, () => host.post(exportUrl(id), app.session.SUPERVISOR, payload));
        expect(outcomeOf(effect.response), id).toEqual([422, 'INVALID_INPUT']);
        expect(errorOf(effect.response).details).toEqual({ in: 'body' });
        expect(effect.commands).toBe(0);
        expect(effect.units).toBe(0);
        expect(effect.rows).toEqual([]);
      }
    }
  });

  it('an ID that is no evidence ID answers 404 without a unit of work', async () => {
    const effect = await effectOf(app, () => app.host.post(exportUrl('not-an-evidence-id'), app.session.SUPERVISOR, { reason: 'Prosecutor request' }));
    expect(outcomeOf(effect.response)).toEqual([404, 'NOT_FOUND']);
    expect(effect.units).toBe(0);
    expect(effect.commands).toBe(0);
    expect(effect.statements.filter((text) => text.startsWith('BEGIN'))).toEqual([]);
  });

  describe('the denied export (RB-5; decision D83 DN-4): the GUARD refuses and writes the one row; the module adds none', () => {
    it.each(['INVESTIGATOR', 'TECHNICIAN'] as const)('%s: 403 FORBIDDEN, exactly one EXPORT_DENIED row and one EXPORT_DENIED event, the hosted action never reached', async (role) => {
      const { host, owner } = app;
      const item = sealedItem(app, 3);
      const before = { digest: await sealedDigest(owner, item.id), custody: await storedCustody(owner, item.id), state: await storedState(owner, item.id), exports: await countOf(owner, 'exports') };
      const operatorId = host.operator(role).id;

      const effect = await effectOf(app, () => host.post(exportUrl(item.id), app.session[role], { reason: 'Prosecutor request', destination: 'Case file transfer' }));
      expect(outcomeOf(effect.response)).toEqual([403, 'FORBIDDEN']);
      expect(errorOf(effect.response)).toMatchObject({
        message: 'Your role cannot export evidence (RBAC). The attempt was audited.',
        details: { operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT', role },
      });
      expect(validateCoreApiResponse('exportEvidence', 403, effect.response.json())).toEqual({ ok: true });
      expectNoStatePosition(effect.response);

      // Exactly ONE denial row in the whole trail for this call, and it is the guard's: it names
      // the operation and the permission, which the simulator's own row does not.
      expect(effect.rows).toHaveLength(1);
      expect(effect.rows.filter((row) => row.type === 'EXPORT_DENIED')).toHaveLength(1);
      expect(effect.rows[0]).toMatchObject({
        type: 'EXPORT_DENIED',
        severity: 'WARNING',
        actorId: operatorId,
        evidenceId: item.id,
        message: `Export of ${item.id} denied: role ${role} lacks EVIDENCE_EXPORT`,
        details: { operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT', role, eventKind: 'UNAUTHORIZED_EXPORT' },
      });
      expect(effect.events.map((event) => event.type)).toEqual(['EXPORT_DENIED']);
      expect(effect.events[0]).toMatchObject({ severity: 'WARNING', params: { evidenceId: item.id, role } });

      // The module added none: no hosted action ran, so the simulator's own denial branch did not either.
      expect(effect.commands).toBe(0);
      // The one unit of work is the guard's (`rbac.denied`); the engine's unit never opened.
      expect(effect.units).toBe(1);
      expect(host.log.lines().filter((line) => line['msg'] === 'request refused by the access rule').at(-1)).toMatchObject({ operationId: 'exportEvidence', code: 'FORBIDDEN', audited: true });

      // Nothing of the item changed, and no export was recorded.
      expect(await sealedDigest(owner, item.id)).toEqual(before.digest);
      expect(await storedCustody(owner, item.id)).toEqual(before.custody);
      expect(await storedState(owner, item.id)).toEqual(before.state);
      expect(await countOf(owner, 'exports')).toBe(before.exports);
      await expectChainIntact(app);
    });

    it('the refusal is decided before the body and the item are looked at: a broken body, no body and an unknown item answer the same 403 with one row each', async () => {
      const { host } = app;
      const cases: ReadonlyArray<readonly [string, string, unknown]> = [
        ['a reason that is a number', exportUrl(sealedItem(app, 3).id), { reason: 7 }],
        ['no body', exportUrl(sealedItem(app, 3).id), undefined],
        ['a short reason', exportUrl(sealedItem(app, 3).id), { reason: 'ab' }],
        ['an unknown item', exportUrl(UNKNOWN_EVIDENCE_ID), { reason: 'Prosecutor request' }],
        ['an item that was never sealed', exportUrl(app.recorded.id), { reason: 'Prosecutor request' }],
      ];
      for (const [label, url, payload] of cases) {
        const effect = await effectOf(app, () => host.post(url, app.session.INVESTIGATOR, payload as Record<string, unknown>));
        expect(outcomeOf(effect.response), label).toEqual([403, 'FORBIDDEN']);
        expect(effect.rows.map((row) => row.type), label).toEqual(['EXPORT_DENIED']);
        expect(effect.commands, label).toBe(0);
      }
    });
  });

  it('nobody without a session exports: 401, no row', async () => {
    const effect = await effectOf(app, () => app.host.post(exportUrl(sealedItem(app, 4).id), {}, { reason: 'Prosecutor request' }));
    expect(outcomeOf(effect.response)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('exportEvidence', 401, effect.response.json())).toEqual({ ok: true });
    expect(effect.rows).toEqual([]);
  });

  it('SR-48: the reason and the destination are stored, and neither is in a log line', async () => {
    const { host, owner } = app;
    const marks = ['MARK-w35-reason-3c1a', 'MARK-w35-destination-88f0'];
    const from = host.log.lines().length;
    const response = await host.post(exportUrl(sealedItem(app, 5).id), app.session.SUPERVISOR, { reason: `Court order ${marks[0]}`, destination: `Drive ${marks[1]}` });
    expect(response.statusCode).toBe(202);
    const written = host.log
      .lines()
      .slice(from)
      .map((line) => JSON.stringify(line))
      .join('\n');
    for (const mark of marks) expect(written, mark).not.toContain(mark);
    const record = await owner.query<{ reason: string; destination: string }>('SELECT reason, destination FROM public.exports WHERE id = $1', [(response.json() as { exportId: string }).exportId]);
    expect(record.rows[0]).toEqual({ reason: `Court order ${marks[0]}`, destination: `Drive ${marks[1]}` });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('a refusal the simulator reports IN ITS RESULT is answered after the unit (rule M4; engine host §3)', () => {
  it('a caller whose role lost the permission between stage 4 and the unit: the action refuses in its result, ITS row is stored, and the answer is 403 FORBIDDEN', async () => {
    // Stage 4 as a stand-in: the request acts as the seeded INVESTIGATOR with the permissions a
    // SUPERVISOR holds. That is the state of a request whose operator's role was changed after
    // stage 4 read it: stage 6 lets it through, and the engine, which mirrors the operators
    // table before every action (ENG-3), sees the role that is stored now.
    const forged = principalOf('INVESTIGATOR', ROLE_PERMISSIONS.SUPERVISOR);
    const app = await booted('w35_result_refusal', {
      signIn: false,
      beforeBoot: (instance) =>
        instance.stages.replace('authenticate', (request) => {
          request.principal = forged;
        }),
    });
    const { host, owner } = app;
    const item = sealedItem(app, 0);
    const before = { digest: await sealedDigest(owner, item.id), custody: await storedCustody(owner, item.id), exports: await countOf(owner, 'exports') };

    const effect = await effectOf(app, () => host.post(exportUrl(item.id), {}, { reason: 'Prosecutor request', destination: 'Case file transfer' }));
    expect(outcomeOf(effect.response)).toEqual([403, 'FORBIDDEN']);
    expect(errorOf(effect.response).message).toBe('Your role cannot export evidence (RBAC). The attempt was audited.');
    expect(validateCoreApiResponse('exportEvidence', 403, effect.response.json())).toEqual({ ok: true });
    expectNoStatePosition(effect.response);

    // The hosted action WAS reached, and its unit was committed, not rolled back: the row the
    // simulator wrote for the denial is in the table when the answer arrives.
    expect(effect.commands).toBe(1);
    expect(effect.units).toBe(1);
    expect(effect.statements.at(-1)).toBe('COMMIT');
    expect(effect.rows.map((row) => row.type)).toEqual(['EXPORT_DENIED']);
    expect(effect.rows[0]).toMatchObject({ actorId: forged.operatorId, evidenceId: item.id, severity: 'WARNING', details: { role: 'INVESTIGATOR', eventKind: 'UNAUTHORIZED_EXPORT' } });
    // It is the simulator's row, not one of this module or of the guard: it names no operation.
    expect(effect.rows[0]?.details).not.toHaveProperty('operationId');
    expect(effect.events.map((event) => event.type)).toEqual(['EXPORT_DENIED']);
    // Still exactly one row for the one refused call.
    expect((await readTrail(owner)).filter((row) => row.type === 'EXPORT_DENIED')).toHaveLength(1);

    // Nothing of the item changed, and no export was recorded.
    expect(await sealedDigest(owner, item.id)).toEqual(before.digest);
    expect(await storedCustody(owner, item.id)).toEqual(before.custody);
    expect(await countOf(owner, 'exports')).toBe(before.exports);
    await expectChainIntact(app);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('operation 43 archiveEvidence: the hosted action `archiveEvidence`', () => {
  let app: Booted;

  beforeAll(async () => {
    app = await booted('w35_archive');
  });
  beforeEach(() => app.host.forgetCounters());

  it('the SUPERVISOR archives a sealed item: 204 without a body, one EVIDENCE_ARCHIVED row and event, one custody entry, the status ARCHIVED', async () => {
    const { host, owner } = app;
    const item = sealedItem(app, 0);
    const custody = await storedCustody(owner, item.id);
    const at = host.clock.now();
    const supervisorId = host.operator('SUPERVISOR').id;

    const effect = await effectOf(app, () => host.post(archiveUrl(item.id), app.session.SUPERVISOR));
    expect(effect.response.statusCode).toBe(204);
    expect(effect.response.body).toBe('');
    expect(validateCoreApiResponse('archiveEvidence', 204, undefined)).toEqual({ ok: true });
    expectStatePosition(effect.response, host);
    expect(host.engine.revision).toBe(effect.revisionBefore + 1);

    expect(effect.rows.map((row) => row.type)).toEqual(['EVIDENCE_ARCHIVED']);
    expect(effect.rows[0]).toMatchObject({ actorId: supervisorId, evidenceId: item.id, at, details: { retentionPolicy: host.engine.slice('storagePolicy').retentionPolicy } });
    expect(effect.events.map((event) => event.type)).toEqual(['EVIDENCE_ARCHIVED']);
    const after = await storedCustody(owner, item.id);
    expect(after.slice(0, custody.length)).toEqual(custody);
    expect(after.slice(custody.length)).toEqual([{ seq: custody.length + 1, at, action: 'ARCHIVED', actorId: supervisorId, detail: null }]);
    expect(await storedState(owner, item.id)).toMatchObject({ status: 'ARCHIVED', lifecycleStage: EVIDENCE_STATUS_STAGE.ARCHIVED });
    await expectChainIntact(app);

    console.info(`[w35] archiveEvidence: ${effect.statements.length} statements on one connection, one transaction:\n${numbered(effect.statements)}`);
    expect(effect.statements[0]).toMatch(/^BEGIN/);
    expect(effect.statements.at(-1)).toBe('COMMIT');
    expect(effect.statements.filter((text) => text.includes('evidence_tracks'))).toEqual([]);
    const update = effect.statements.find((text) => text.startsWith('update "evidence_items"')) ?? '';
    expect(update).toMatch(/"status" = \$\d+/);
    expect(update).not.toMatch(/manifest_hash|signature_|"sha256"|recorded_at|size_bytes/);
  });

  it('an item that is already archived: 204 again, no row, no event, no custody entry, and the revision does not move', async () => {
    const { host, owner } = app;
    const item = sealedItem(app, 0);
    const custody = await storedCustody(owner, item.id);
    const effect = await effectOf(app, () => host.post(archiveUrl(item.id), app.session.SUPERVISOR));
    expect(effect.response.statusCode).toBe(204);
    expect(effect.rows).toEqual([]);
    expect(effect.events).toEqual([]);
    expect(effect.published).toEqual([]);
    expect(await storedCustody(owner, item.id)).toEqual(custody);
    // API-7: "the current revision when nothing replicated changed".
    expect(host.engine.revision).toBe(effect.revisionBefore);
    expectStatePosition(effect.response, host);
    // A command that changes nothing writes nothing: the unit's own statements and the operators mirror, then COMMIT.
    expect(effect.statements.filter((text) => /^(insert|update|delete) /i.test(text))).toEqual([]);
    console.info(`[w35] archiveEvidence of an archived item: ${effect.statements.length} statements, none of them a write`);
  });

  it('an EXPORTED and an UNDER_REVIEW item can be archived', async () => {
    const { host, owner } = app;
    for (const item of [app.exported, app.underReview]) {
      const effect = await effectOf(app, () => host.post(archiveUrl(item.id), app.session.SUPERVISOR));
      expect(effect.response.statusCode, item.status).toBe(204);
      expect(effect.rows.map((row) => row.type), item.status).toEqual(['EVIDENCE_ARCHIVED']);
      expect((await storedState(owner, item.id)).status).toBe('ARCHIVED');
    }
  });

  it('an item that was never sealed: 409 NOT_SEALED with the simulator\'s code and event; nothing is stored', async () => {
    const { host, owner } = app;
    const state = await storedState(owner, app.recorded.id);
    const effect = await effectOf(app, () => host.post(archiveUrl(app.recorded.id), app.session.SUPERVISOR));
    expect(outcomeOf(effect.response)).toEqual([409, 'NOT_SEALED']);
    // Gap W35-1, closed by the contract close-out W83: the contract's example of this answer carries
    // `from` and `event` of the refused transition beside `details.simCode` (spec §7.2), as the server does.
    expect(errorOf(effect.response).details).toEqual({ simCode: 'UNSEALED_EVIDENCE', from: null, event: 'archiveEvidence' });
    expect(errorOf(effect.response).message).toBe('Unsealed evidence cannot be archived.');
    expect(validateCoreApiResponse('archiveEvidence', 409, effect.response.json())).toEqual({ ok: true });
    expectNoStatePosition(effect.response);
    expect(effect.rows).toEqual([]);
    expect(effect.statements.at(-1)).toBe('ROLLBACK');
    expect(await storedState(owner, app.recorded.id)).toEqual(state);
  });

  it('an unknown item: 404; an ID that is no evidence ID: 422 without a command', async () => {
    const unknown = await effectOf(app, () => app.host.post(archiveUrl(UNKNOWN_EVIDENCE_ID), app.session.SUPERVISOR));
    expect(outcomeOf(unknown.response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(unknown.response)).toMatchObject({ message: 'Evidence not found.', details: { simCode: 'NOT_FOUND' } });
    expect(validateCoreApiResponse('archiveEvidence', 404, unknown.response.json())).toEqual({ ok: true });
    expect(unknown.rows).toEqual([]);
    const malformed = await effectOf(app, () => app.host.post(archiveUrl('EV-1'), app.session.SUPERVISOR));
    expect(outcomeOf(malformed.response)).toEqual([422, 'INVALID_INPUT']);
    expect(validateCoreApiResponse('archiveEvidence', 422, malformed.response.json())).toEqual({ ok: true });
    expect(malformed.commands).toBe(0);
  });

  it.each(['INVESTIGATOR', 'TECHNICIAN'] as const)('%s lacks EVIDENCE_REVIEW: 403 NOT_PERMITTED with exactly one ACCESS_DENIED row, written by the guard; the action is not reached', async (role) => {
    const { host, owner } = app;
    const item = sealedItem(app, 1);
    const state = await storedState(owner, item.id);
    const effect = await effectOf(app, () => host.post(archiveUrl(item.id), app.session[role]));
    expect(outcomeOf(effect.response)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(effect.response).details).toEqual({ operationId: 'archiveEvidence', permission: 'EVIDENCE_REVIEW', role });
    expect(validateCoreApiResponse('archiveEvidence', 403, effect.response.json())).toEqual({ ok: true });
    expect(effect.rows.map((row) => row.type)).toEqual(['ACCESS_DENIED']);
    expect(effect.rows[0]).toMatchObject({ actorId: host.operator(role).id, details: { operationId: 'archiveEvidence', permission: 'EVIDENCE_REVIEW', role } });
    expect(effect.commands).toBe(0);
    expect(await storedState(owner, item.id)).toEqual(state);
  });

  it('after the archive: the item is still read and verified, and an export of it is refused with 409 NOT_SEALED', async () => {
    const { host } = app;
    const item = sealedItem(app, 0);
    const detail = await host.get(itemUrl(item.id), app.session.INVESTIGATOR);
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { evidence: { status: string; custody: Array<{ action: string }> } }).evidence).toMatchObject({ status: 'ARCHIVED', lifecycleStage: EVIDENCE_STATUS_STAGE.ARCHIVED });
    expect((await host.post(verifyUrl(item.id), app.session.INVESTIGATOR)).statusCode).toBe(200);
    const refused = await effectOf(app, () => host.post(exportUrl(item.id), app.session.SUPERVISOR, { reason: 'Prosecutor request' }));
    expect(outcomeOf(refused.response)).toEqual([409, 'NOT_SEALED']);
    expect(refused.rows).toEqual([]);
    // The list by status finds it.
    const archived = await host.get(`${EVIDENCE}?status=ARCHIVED`, app.session.TECHNICIAN);
    expect((archived.json() as { items: Array<{ id: string }> }).items.map((entry) => entry.id)).toContain(item.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('who may call operations 39, 40 and 41 is the guard\'s decision too (contract finding F-8)', () => {
  it('with the grant of EVIDENCE_VIEW taken away in the clone: 403 NOT_PERMITTED and exactly one ACCESS_DENIED row per call; no read and no action runs; with the grant back, 200', async () => {
    // Every seeded role holds EVIDENCE_VIEW and the matrix is read-only, so the denied case
    // exists only when the stored grant is changed, here as `dems_owner` on this file's clone.
    const app = await booted('w35_view_denied');
    const { host, owner } = app;
    const item = sealedItem(app, 0);
    const calls: ReadonlyArray<readonly [string, () => Promise<LightMyRequestResponse>]> = [
      ['listEvidence', () => host.get(EVIDENCE, app.session.TECHNICIAN)],
      ['getEvidence', () => host.get(itemUrl(item.id), app.session.TECHNICIAN)],
      ['verifyEvidence', () => host.post(verifyUrl(item.id), app.session.TECHNICIAN)],
    ];
    for (const [operationId, call] of calls) expect((await call()).statusCode, operationId).toBe(200);

    await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'TECHNICIAN' AND permission_id = 'EVIDENCE_VIEW'");
    try {
      for (const [operationId, call] of calls) {
        const sent = host.database.statements.length;
        const effect = await effectOf(app, call);
        expect(outcomeOf(effect.response), operationId).toEqual([403, 'NOT_PERMITTED']);
        expect(errorOf(effect.response).details, operationId).toEqual({ operationId, permission: 'EVIDENCE_VIEW', role: 'TECHNICIAN' });
        expect(validateCoreApiResponse(operationId, 403, effect.response.json()), operationId).toEqual({ ok: true });
        expect(effect.rows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
        expect(effect.rows[0]?.details, operationId).toMatchObject({ operationId, permission: 'EVIDENCE_VIEW', role: 'TECHNICIAN' });
        expect(effect.commands, operationId).toBe(0);
        // No statement of a read of this module was sent.
        expect(host.database.statements.slice(sent).filter((text) => /read only|from "evidence_/.test(text)), operationId).toEqual([]);
      }
      // The other roles still hold it.
      expect((await host.get(EVIDENCE, app.session.INVESTIGATOR)).statusCode).toBe(200);
    } finally {
      await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'EVIDENCE_VIEW')");
    }
    for (const [operationId, call] of calls) expect((await call()).statusCode, operationId).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
describe('while the engine is not running', () => {
  it('every operation of the module answers 503 NOT_READY at stage 2: the two reads too, and nothing is read or run', async () => {
    const app = await booted('w35_engine_stopped');
    const { host } = app;
    const item = sealedItem(app, 0);
    await host.engine.stop();
    expect(host.app.readiness.snapshot().engine).toBe(false);
    const sent = host.database.statements.length;
    const calls: ReadonlyArray<readonly [string, () => Promise<LightMyRequestResponse>]> = [
      ['listEvidence', () => host.get(EVIDENCE, app.session.SUPERVISOR)],
      ['getEvidence', () => host.get(itemUrl(item.id), app.session.SUPERVISOR)],
      ['verifyEvidence', () => host.post(verifyUrl(item.id), app.session.SUPERVISOR)],
      ['exportEvidence', () => host.post(exportUrl(item.id), app.session.SUPERVISOR, { reason: 'Prosecutor request' })],
      ['archiveEvidence', () => host.post(archiveUrl(item.id), app.session.SUPERVISOR)],
    ];
    for (const [operationId, call] of calls) {
      const response = await call();
      expect(outcomeOf(response), operationId).toEqual([503, 'NOT_READY']);
      expect(validateCoreApiResponse(operationId, 503, response.json()), operationId).toEqual({ ok: true });
    }
    expect(host.database.statements.slice(sent).filter((text) => text.includes('evidence_'))).toEqual([]);
  });
});
