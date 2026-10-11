// The command pipeline of the hosted engine, against PostgreSQL as `dems_app` (plan row W26;
// spec ENG-1 to ENG-7, ENG-8, ENG-10, §7.2, §12.3; SR-55, SR-59, SR-65, SR-79; AC-B-53, AC-B-55).
//
// Every test boots the real app on a clone of the seed template (a process start), on a manual
// clock and a manual timer, and reads what is stored as `dems_owner`.
import { passCaptureStart, signedOutAuth, verifyAuditChain, type AuditRow, type SimState } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { PipelineFailure, createPipeline, looksLikeSecret, type UnitContext } from '../../core';
import { linkProblems, readEventCounter, readEvents, readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { DURABLE_SLICE_KEYS, type DurableSlices } from '../../db/mapping';
import { dumpDatabase, tableChecksums, withoutNegativeZeros } from '../../../test/support/seed';
import type { Principal } from '../../plugins/authenticate';
import { credentialLeaks } from '../../../test/support/config';
import { ApiFailure } from '../../plugins/error-envelope';
import { EngineError } from '../errors';
import { engineApp, stateChanges, storedSlices, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

interface Booted extends EngineApp {
  readonly owner: Pool;
  /** The engine's working state: the durable slices of the hosted `Sim`, by reference. */
  working(): SimState;
}

/** A process start on a fresh clone of the seed: epoch 1, the tablet link OFFLINE. */
async function booted(slug: string): Promise<Booted> {
  const target = await db.another({ template: 'seed', slug });
  const host = await engineApp(target, db.run.dataDir);
  await host.app.readiness.boot();
  return {
    ...host,
    owner: target.ownerPool(),
    working() {
      const sim = host.engine.simulator();
      if (sim === null) throw new Error('the engine is not running');
      return sim.store.getState();
    },
  };
}

const auth = (host: Booted) => host.working().auth;

async function rejection(work: Promise<unknown>): Promise<unknown> {
  return work.then(
    () => {
      throw new Error('the promise resolved; a rejection was expected');
    },
    (error: unknown) => error,
  );
}

const SESSION_INPUT = {
  caseNumber: 'LP/2026/1001-0099',
  subjectType: 'SAKSI',
  subjectName: 'Test Subject',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

/** From idle to a running recording, through hosted commands only. */
async function startRecording(host: Booted): Promise<void> {
  const investigator = host.principal('INVESTIGATOR');
  await host.engine.setTabletLink('CONNECTED');
  const created = await host.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
  expect(created.value).toMatchObject({ ok: true, created: true });
  await host.engine.command(investigator, 'beginPrecheck');
  await host.drive(5_000);
  if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(investigator, 'acknowledgePrecheckWarnings');
  expect(host.engine.slice('session')?.state).toBe('ARMED');
  await host.engine.command(investigator, 'startRecording');
  // Pass D10: past the connecting part of the start (a member no column holds; a stop is refused in it).
  await passCaptureStart((ms) => host.drive(ms));
  expect(host.engine.slice('session')?.state).toBe('RECORDING');
}

/** A row of a server-native module, through the core's writer: a sign-in. */
const native = (unit: UnitContext, operatorId: string) =>
  unit.audit.append({ type: 'AUTH_SUCCESS', actorId: operatorId, deviceId: null, message: 'Signed in.', severity: 'SUCCESS', details: { method: 'PASSWORD' } });

describe('a hosted command is one unit of work (ENG-1, ENG-2, ENG-4)', () => {
  it('a session from create to seal: after EVERY command nobody is signed in, the rows are committed, and each row names the caller at the server clock', async () => {
    const host = await booted('w26_cmd_journey');
    const investigator = host.principal('INVESTIGATOR');
    const ran: string[] = [];

    /** Runs one command and checks what holds after every command. Returns the audit rows it stored. */
    const command = async (label: string, run: () => Promise<{ epoch: number; revision: number }>): Promise<AuditRow[]> => {
      const before = await readHead(host.owner);
      const at = host.clock.now();
      const outcome = await run();
      ran.push(label);
      // AC-B-53: signed out again, at once.
      expect(auth(host), label).toEqual(signedOutAuth());
      // ENG-4: the answer comes after the commit. The stored head is the engine's head now.
      const head = await readHead(host.owner);
      expect(head, label).toEqual({ seq: host.engine.slice('audit').total, hash: host.engine.slice('audit').head });
      expect(outcome, label).toMatchObject({ epoch: host.engine.epoch, revision: host.engine.revision });
      const rows = (await readTrail(host.owner)).filter((row) => row.seq > before.seq);
      // AC-B-55, SR-65: the time is the server clock's, whatever the command was given.
      for (const row of rows) expect(row.at, `${label} ${row.type}`).toBe(at);
      return rows;
    };
    const types = (rows: AuditRow[]): string[] => rows.map((row) => row.type);
    const byCaller = (rows: AuditRow[]): boolean => rows.every((row) => row.actorId === investigator.operatorId);

    expect(types(await command('setTabletLink', () => host.engine.setTabletLink('CONNECTED')))).toEqual(['TABLET_LINK_CHANGED']);

    const created = await command('createSession', () => host.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId }));
    expect(types(created)).toEqual(['SESSION_CREATED']);
    expect(byCaller(created)).toBe(true);
    expect(host.engine.slice('session')).toMatchObject({ state: 'CREATE', createdBy: investigator.operatorId, input: { caseNumber: SESSION_INPUT.caseNumber } });

    // A hosted action that writes no audit row today keeps writing none (spec §13.2, NONE-P).
    expect(await command('beginPrecheck', () => host.engine.command(investigator, 'beginPrecheck'))).toEqual([]);
    expect(host.engine.slice('session')?.state).toBe('PRECHECK');

    // The engine arms the session by itself: that row names the session's creator by design
    // (decision D28 D-2), and it does not take its actor from `auth`, which is signed out.
    const beforeArm = await readHead(host.owner);
    await host.drive(5_000);
    const armed = (await readTrail(host.owner)).filter((row) => row.seq > beforeArm.seq);
    expect(types(armed)).toContain('PRECHECK_PASSED');
    expect(armed.find((row) => row.type === 'PRECHECK_PASSED')).toMatchObject({ actorId: investigator.operatorId, details: { by: 'system' } });
    expect(armed.filter((row) => row.type !== 'PRECHECK_PASSED').every((row) => row.actorId === null)).toBe(true);
    expect(auth(host)).toEqual(signedOutAuth());
    expect(host.engine.slice('session')?.state).toBe('ARMED');

    const started = await command('startRecording', () => host.engine.command(investigator, 'startRecording'));
    expect(types(started)).toContain('RECORDING_STARTED');
    expect(byCaller(started)).toBe(true);

    await host.drive(3_000);
    expect(types(await command('addMarker', () => host.engine.command(investigator, 'addMarker', 'Key statement')))).toEqual(['MARKER_ADDED']);
    expect(types(await command('addNote', () => host.engine.command(investigator, 'addNote', 'Subject asked for a break')))).toEqual(['NOTE_ADDED']);
    expect(types(await command('snapshot', () => host.engine.command(investigator, 'snapshot')))).toEqual(['SNAPSHOT_TAKEN']);

    const stopped = await command('stopRecording', () => host.engine.command(investigator, 'stopRecording', 'Interview completed'));
    expect(types(stopped)).toContain('RECORDING_STOPPED');
    expect(stopped.find((row) => row.type === 'RECORDING_STOPPED')).toMatchObject({ actorId: investigator.operatorId });

    // The engine finalises and seals by itself: rows without an actor.
    const beforeSeal = await readHead(host.owner);
    await host.drive(20_000);
    expect(host.engine.slice('session')?.state).toBe('SEALED');
    const sealed = (await readTrail(host.owner)).filter((row) => row.seq > beforeSeal.seq);
    expect(types(sealed)).toContain('EVIDENCE_SEALED');
    expect(sealed.every((row) => row.actorId === null)).toBe(true);

    const sealedId = host.engine.slice('lastSealedSessionId') ?? '';
    expect(host.engine.slice('lastSealedAcknowledged')).toBe(false);
    await command('acknowledgeSummary', () => host.engine.command(investigator, 'acknowledgeSummary', sealedId));
    expect(host.engine.slice('lastSealedAcknowledged')).toBe(true);
    // The sealed session stays until the next one replaces it; its evidence item is sealed.
    expect(host.engine.slice('session')?.state).toBe('SEALED');
    expect(host.engine.slice('evidence').find((item) => item.sessionId === sealedId)).toMatchObject({ status: 'SEALED' });

    // The stored chain verifies over all rows, and the tables hold the engine's committed state.
    const trail = await readTrail(host.owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(host.owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
    expect(host.engine.stats()).toMatchObject({ commands: ran.length - 1, commandsRefused: 0, ticksFailed: 0, simErrors: 0 });
    console.info(`[w26] journey: ${ran.join(' → ')}; ${trail.length} stored audit rows, chain ok; auth signed out after each of ${ran.length} commands`);
  });

  it('the statements of one command, in order: the unit, the operators, the audit row, the event, the changed rows, the commit', async () => {
    const host = await booted('w26_cmd_statements');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const before = host.database.statements.length;
    const opened = host.database.connections.opened;
    const began = performance.now();
    await host.engine.command(investigator, 'addMarker', 'Key statement');
    const ms = performance.now() - began;
    const sent = host.database.statements.slice(before);

    expect(sent[0]).toBe('BEGIN ISOLATION LEVEL READ COMMITTED');
    expect(sent[1]).toBe('SELECT seq, hash FROM public.audit_chain_lock()');
    expect(sent[2]).toContain('statement_timeout');
    expect(sent[3]).toMatch(/^select .* from "operators" order by/);
    expect(sent[4]).toMatch(/^insert into "audit_log" /);
    expect(sent.at(-1)).toBe('COMMIT');
    expect(sent.some((text) => text.startsWith('update "active_session"'))).toBe(true);
    // One connection, one transaction, and the audit row before every other write (AP-7).
    expect(host.database.connections.opened - opened).toBe(1);
    expect(sent.filter((text) => text.startsWith('BEGIN'))).toHaveLength(1);
    const firstWrite = sent.findIndex((text) => /^(insert|update|delete)/i.test(text));
    expect(firstWrite).toBe(4);
    console.info(
      `[w26] one command (addMarker): ${sent.length} statements in ${ms.toFixed(1)} ms: ` +
        sent.map((text) => text.replace(/\s+/g, ' ').slice(0, 44)).join(' | '),
    );
  });

  it('API-7: the outcome carries the revision of the change that holds the effect; a command that changes nothing publishes nothing', async () => {
    const host = await booted('w26_cmd_revision');
    const supervisor = host.principal('SUPERVISOR');
    const before = host.engine.revision;
    const published = stateChanges(host.publications).length;

    const changed = await host.engine.command(supervisor, 'updateSettings', { timeFormat: '12' });
    expect(changed).toMatchObject({ value: undefined, epoch: 1, revision: before + 1 });
    const change = stateChanges(host.publications).at(-1);
    expect(change).toMatchObject({ epoch: 1, revision: before + 1, cause: 'command', records: true, at: host.clock.now() });
    expect(change?.ops.map((op) => [op.op, op.slice])).toEqual([['replace', 'settings']]);
    expect(host.engine.slice('settings').timeFormat).toBe('12');

    // The same value again: nothing replicated changed, nothing is published, the revision stays.
    const same = await host.engine.command(supervisor, 'updateSettings', { timeFormat: '12' });
    expect(same.revision).toBe(before + 1);
    expect(stateChanges(host.publications)).toHaveLength(published + 1);
    const verdict = await host.engine.command(supervisor, 'verifyAuditChain');
    expect(verdict.value).toMatchObject({ ok: true });
    expect(verdict.revision).toBe(before + 1);
  });
});

describe('a command that the simulator refuses (ENG-7, SR-79, spec §7.2)', () => {
  it('each refusal is the mapped answer with details.simCode; nobody stays signed in; nothing is stored and nothing changes', async () => {
    const host = await booted('w26_cmd_refusals');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const technician = host.principal('TECHNICIAN');
    const supervisor = host.principal('SUPERVISOR');

    const cases: ReadonlyArray<readonly [label: string, run: () => Promise<unknown>, status: number, code: string, details: Record<string, unknown>]> = [
      ['a role without the permission', () => host.engine.command(technician, 'stopRecording', 'Interview completed'), 403, 'NOT_PERMITTED', { simCode: 'NOT_PERMITTED', permission: 'SESSION_START' }],
      ['an illegal transition', () => host.engine.command(investigator, 'startRecording'), 409, 'INVALID_STATE', { simCode: 'ILLEGAL_STATE', from: 'RECORDING', event: 'startRecording' }],
      ['a stop reason under five characters', () => host.engine.command(investigator, 'stopRecording', 'no'), 422, 'INVALID_REASON', { simCode: 'REASON_TOO_SHORT' }],
      ['an empty note', () => host.engine.command(investigator, 'addNote', ''), 422, 'INVALID_INPUT', { simCode: 'NOTE_INVALID' }],
      ['an unknown evidence item', () => host.engine.command(supervisor, 'archiveEvidence', 'EV-20261001-9999'), 404, 'NOT_FOUND', { simCode: 'NOT_FOUND' }],
      ['a services restart during a session', () => host.engine.command(technician, 'restartServices'), 409, 'SESSION_ACTIVE', { simCode: 'SESSION_ACTIVE' }],
    ];

    for (const [label, run, status, code, details] of cases) {
      const working = host.working();
      const committed = host.engine.state();
      const head = await readHead(host.owner);
      const checksums = await tableChecksums(host.owner);
      const revision = host.engine.revision;
      const published = host.publications.length;

      const error = await rejection(run());
      expect(error, label).toBeInstanceOf(ApiFailure);
      expect(error, label).not.toBeInstanceOf(PipelineFailure);
      expect(error, label).toMatchObject({ statusCode: status, code });
      expect((error as ApiFailure).details, label).toMatchObject(details);

      // SR-79, AC-B-53: the scope was cleared in the `finally`, although the action threw.
      expect(auth(host), label).toEqual(signedOutAuth());
      // ENG-7: nothing changed. Not in the engine (every durable slice is the same object), not
      // in what a reader sees, not in the database.
      for (const key of DURABLE_SLICE_KEYS) expect(host.working()[key], `${label}: ${key}`).toBe(working[key]);
      expect(host.engine.state(), label).toBe(committed);
      expect(await readHead(host.owner), label).toEqual(head);
      expect(await tableChecksums(host.owner), label).toEqual(checksums);
      expect(host.engine.revision, label).toBe(revision);
      expect(host.publications, label).toHaveLength(published);
    }
    expect(host.engine.stats().commandsRefused).toBe(cases.length);

    // The command after a refusal works, and it is attributed to ITS caller.
    await host.engine.command(investigator, 'addMarker', 'After the refusals');
    const last = (await readTrail(host.owner)).at(-1);
    expect(last).toMatchObject({ type: 'MARKER_ADDED', actorId: investigator.operatorId });
    console.info(`[w26] ${cases.length} refused commands: ${cases.map(([, , status, code, details]) => `${status} ${code} (${String(details['simCode'])})`).join(', ')}; auth signed out after each`);
  });

  it('a refusal the simulator reports IN ITS RESULT is returned, and the row it wrote is stored (EXPORT_DENIED names the caller)', async () => {
    const host = await booted('w26_cmd_denied');
    const investigator = host.principal('INVESTIGATOR');
    const evidenceId = host.engine.slice('evidence').find((item) => item.status === 'SEALED')?.id ?? '';
    const before = await readHead(host.owner);

    const outcome = await host.engine.command(investigator, 'exportEvidence', evidenceId, { reason: 'Prosecutor request', destination: 'Case file transfer' });
    expect(outcome.value).toEqual({ ok: false, status: 403, reason: 'FORBIDDEN' });
    const rows = (await readTrail(host.owner)).filter((row) => row.seq > before.seq);
    expect(rows.map((row) => [row.type, row.actorId, row.evidenceId])).toEqual([['EXPORT_DENIED', investigator.operatorId, evidenceId]]);
    expect(auth(host)).toEqual(signedOutAuth());

    // The permitted export writes its row and its export record in the same unit.
    const exports = await host.owner.query<{ rows: string }>('SELECT count(*)::text AS rows FROM public.exports');
    const supervisor = host.principal('SUPERVISOR');
    const exported = await host.engine.command(supervisor, 'exportEvidence', evidenceId, { reason: 'Prosecutor request', destination: 'Case file transfer' });
    expect(exported.value).toMatchObject({ ok: true, status: 202 });
    const after = await host.owner.query<{ rows: string }>('SELECT count(*)::text AS rows FROM public.exports');
    expect(Number(after.rows[0]?.rows)).toBe(Number(exports.rows[0]?.rows) + 1);
    expect((await readTrail(host.owner)).at(-1)).toMatchObject({ type: 'EVIDENCE_EXPORTED', actorId: supervisor.operatorId });
  });

  it('a caller that is no operator, an action that is not hosted, and an engine that is not running are refused before a unit is submitted', async () => {
    const host = await booted('w26_cmd_guards');
    const sent = host.database.statements.length;
    const device: Principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };
    const anonymous: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };

    for (const principal of [device, anonymous]) {
      expect(await rejection(host.engine.command(principal, 'addMarker', 'x'))).toMatchObject({ statusCode: 401, code: 'NOT_SIGNED_IN' });
    }
    const supervisor = host.principal('SUPERVISOR');
    for (const name of ['signIn', 'signOut', 'loadScenario', 'resetDemo', 'pair', 'setTabletLink', 'applyCaptureTelemetry', 'raiseCaptureWarning', 'clearCaptureWarning', 'toString']) {
      const error = await rejection(host.engine.command(supervisor, name as 'addMarker'));
      expect(error, name).toBeInstanceOf(EngineError);
      expect(error, name).toMatchObject({ code: 'ENGINE_ACTION_NOT_HOSTED' });
    }
    expect(host.database.statements).toHaveLength(sent);

    await host.engine.stop();
    expect(host.engine.running).toBe(false);
    expect(await rejection(host.engine.command(supervisor, 'updateSettings', { timeFormat: '12' }))).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    expect(() => host.engine.state()).toThrow(ApiFailure);
    expect(await rejection(host.engine.setTabletLink('CONNECTED'))).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    expect(host.app.readiness.snapshot().engine).toBe(false);
  });
});

describe('ENG-3: the operators are the table\'s before every command', () => {
  it('a role changed in the table decides the very next command, and the changed slice is published', async () => {
    const host = await booted('w26_cmd_operators');
    await startRecording(host);
    const technician = host.principal('TECHNICIAN');
    // `scanCaseNumber` needs SESSION_START, which the simulator itself checks against the role
    // of the engine's `operators` slice (RB-7).
    expect(await rejection(host.engine.command(technician, 'scanCaseNumber'))).toMatchObject({ statusCode: 403, code: 'NOT_PERMITTED' });

    // What the administration module does in its own unit: the operators table is the server's.
    await host.owner.query("UPDATE public.operators SET role_id = 'INVESTIGATOR' WHERE id = $1", [technician.operatorId]);

    // `mirrorOperators` publishes the slice without a command.
    const revision = host.engine.revision;
    const mirrored = await host.engine.mirrorOperators();
    expect(mirrored).toMatchObject({ value: true, revision: revision + 1 });
    const change = stateChanges(host.publications).at(-1);
    expect(change).toMatchObject({ cause: 'operators', revision: revision + 1 });
    expect(change?.ops.map((op) => [op.op, op.slice])).toEqual([['replace', 'operators']]);
    expect(host.engine.slice('operators').find((operator) => operator.id === technician.operatorId)?.role).toBe('INVESTIGATOR');
    expect((await host.engine.mirrorOperators()).value).toBe(false);
    expect((await host.engine.command(technician, 'scanCaseNumber')).value).toMatch(/^LP\//);

    // And a command mirrors by itself: the role is changed back in the table, nothing is told
    // to the engine, and the very next command is judged by the table.
    await host.owner.query("UPDATE public.operators SET role_id = 'TECHNICIAN' WHERE id = $1", [technician.operatorId]);
    const published = stateChanges(host.publications).length;
    expect(await rejection(host.engine.command(technician, 'scanCaseNumber'))).toMatchObject({ statusCode: 403, code: 'NOT_PERMITTED' });
    // The refused unit was rolled back: the mirror it made is not published. The next unit that
    // commits carries it.
    expect(stateChanges(host.publications)).toHaveLength(published);
    await host.engine.command(host.principal('INVESTIGATOR'), 'addNote', 'A note');
    expect(stateChanges(host.publications).at(-1)?.ops.map((op) => op.slice)).toContain('operators');
    expect(host.engine.slice('operators').find((operator) => operator.id === technician.operatorId)?.role).toBe('TECHNICIAN');
    // The engine never writes the operators table.
    expect(host.database.statements.some((text) => /^(insert into|update|delete from) "operators"/.test(text))).toBe(false);
  });
});

describe('one chain: rows of server-native units and rows of the engine (ENG-8, AP-6)', () => {
  it('a native row appended by another unit is taken into the ring, so the engine\'s next row continues the stored head', async () => {
    const host = await booted('w26_chain_native');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    await host.engine.command(investigator, 'addMarker', 'Before the sign-in');
    const before = await readHead(host.owner);
    const revision = host.engine.revision;

    // A server-native unit of another module: a sign-in row and its event, through the core's writers.
    const appended = await host.app.pipeline.run('test.signIn', async (unit) => {
      const row = await native(unit, investigator.operatorId);
      const event = await unit.events.append({ type: 'AUTH_LOGIN', message: 'Signed in.', severity: 'SUCCESS' });
      return { row, event };
    });
    expect(appended.row.seq).toBe(before.seq + 1);

    // The ring and the committed state hold the row at once, and the change was published as an append.
    expect(host.engine.slice('audit')).toMatchObject({ total: before.seq + 1, head: appended.row.hash });
    expect(host.engine.slice('audit').rows.at(-1)).toBe(appended.row);
    expect(host.engine.slice('events').at(-1)).toBe(appended.event);
    expect(host.engine.slice('meta').counters.event).toBe(appended.event.seq + 1);
    const change = stateChanges(host.publications).at(-1);
    expect(change).toMatchObject({ cause: 'native', revision: revision + 1, records: true });
    expect(change?.ops.map((op) => [op.op, op.slice])).toEqual([
      ['replace', 'meta'],
      ['append', 'events'],
      ['append', 'audit'],
    ]);
    expect(host.engine.stats().nativeRowsMerged).toBe(1);

    // The engine's next command and its next ticks continue that head.
    await host.engine.command(investigator, 'addMarker', 'After the sign-in');
    await host.drive(30_000);
    const trail = await readTrail(host.owner);
    const head = await readHead(host.owner);
    expect(trail.slice(before.seq, before.seq + 2).map((row) => row.type)).toEqual(['AUTH_SUCCESS', 'MARKER_ADDED']);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, head)).toMatchObject({ ok: true, checked: trail.length });
    expect(verifyAuditChain(host.engine.slice('audit'))).toMatchObject({ ok: true });
    // The event numbers have no gap and no duplicate, whoever took them.
    const events = await readEvents(host.owner);
    expect(events.map((event) => event.seq)).toEqual(Array.from({ length: events.length }, (_, index) => index + 1));
    expect(await readEventCounter(host.owner)).toBe(host.engine.slice('meta').counters.event);
    expect(host.engine.stats().resyncs).toBe(0);
  });

  it('engine.run: native rows and hosted actions of ONE unit are contiguous, in the order they were made, and commit together', async () => {
    const host = await booted('w26_chain_run');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const before = await readHead(host.owner);
    const revision = host.engine.revision;
    const published = stateChanges(host.publications).length;

    const outcome = await host.engine.run('test.mixed', async ({ unit, command, pending }) => {
      await native(unit, investigator.operatorId);
      // The host syncs its ring with the unit's own row before the action.
      await command(investigator, 'addMarker', 'Between two native rows');
      expect(pending().audit.total).toBe(before.seq + 2);
      // Not committed yet: a reader still sees the state before the unit.
      expect(host.engine.slice('audit').total).toBe(before.seq);
      await native(unit, investigator.operatorId);
      await command(investigator, 'addNote', 'After the second native row');
      await unit.events.append({ type: 'AUTH_LOGIN', message: 'Signed in.' });
      return 'done';
    });

    expect(outcome).toMatchObject({ value: 'done', revision: revision + 1 });
    const rows = (await readTrail(host.owner)).filter((row) => row.seq > before.seq);
    expect(rows.map((row) => row.type)).toEqual(['AUTH_SUCCESS', 'MARKER_ADDED', 'AUTH_SUCCESS', 'NOTE_ADDED']);
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4].map((offset) => before.seq + offset));
    // One unit, one publication.
    expect(stateChanges(host.publications)).toHaveLength(published + 1);
    expect(host.engine.slice('audit').total).toBe(before.seq + 4);
    expect(verifyTrail(await readTrail(host.owner), await readHead(host.owner))).toMatchObject({ ok: true });
    expect(await storedSlices(host.owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
    expect(auth(host)).toEqual(signedOutAuth());
  });

  it('engine.run: a unit that throws after a hosted action stores nothing, and the engine is set back', async () => {
    const host = await booted('w26_chain_rollback');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const working = host.working();
    const committed = host.engine.state();
    const head = await readHead(host.owner);
    const checksums = await tableChecksums(host.owner);
    const published = host.publications.length;

    const refusal = new ApiFailure(409, 'LAST_ADMIN', 'A refusal of the module.');
    const error = await rejection(
      host.engine.run('test.refused', async ({ unit, command }) => {
        await native(unit, investigator.operatorId);
        await command(investigator, 'addMarker', 'Never stored');
        throw refusal;
      }),
    );
    expect(error).toBe(refusal);
    for (const key of DURABLE_SLICE_KEYS) expect(host.working()[key], key).toBe(working[key]);
    expect(host.engine.state()).toBe(committed);
    expect(await readHead(host.owner)).toEqual(head);
    expect(await tableChecksums(host.owner)).toEqual(checksums);
    expect(host.publications).toHaveLength(published);
    expect(auth(host)).toEqual(signedOutAuth());

    await host.engine.command(investigator, 'addMarker', 'Stored');
    expect((await readTrail(host.owner)).at(-1)).toMatchObject({ seq: head.seq + 1, type: 'MARKER_ADDED' });
  });

  it('a hosted command inside app.pipeline.run is refused: a unit cannot submit a unit', async () => {
    const host = await booted('w26_chain_nested');
    const supervisor = host.principal('SUPERVISOR');
    const error = await rejection(host.app.pipeline.run('test.outer', () => host.engine.command(supervisor, 'updateSettings', { timeFormat: '12' })));
    expect(error).toMatchObject({ code: 'PIPELINE_REENTRANT' });
    expect(host.engine.slice('settings').timeFormat).toBe('24');
  });
});

describe('ENG-5: a unit that is not committed sets the engine back', () => {
  /** What must be equal before and after a unit that was not committed. */
  async function snapshotOf(host: Booted) {
    return {
      working: host.working(),
      committed: host.engine.state(),
      head: await readHead(host.owner),
      checksums: await tableChecksums(host.owner),
      revision: host.engine.revision,
      published: host.publications.length,
    };
  }

  async function expectSetBack(host: Booted, before: Awaited<ReturnType<typeof snapshotOf>>, label: string): Promise<void> {
    for (const key of DURABLE_SLICE_KEYS) expect(host.working()[key], `${label}: ${key}`).toBe(before.working[key]);
    expect(host.working(), label).toBe(before.working);
    expect(host.engine.state(), label).toBe(before.committed);
    expect(await readHead(host.owner), label).toEqual(before.head);
    expect(await tableChecksums(host.owner), label).toEqual(before.checksums);
    expect(host.engine.revision, label).toBe(before.revision);
    expect(host.publications, label).toHaveLength(before.published);
    expect(auth(host), label).toEqual(signedOutAuth());
  }

  it('a COMMIT that fails: 503, state before = state after, nothing stored, and the next command works and continues the head', async () => {
    const host = await booted('w26_fail_commit');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const before = await snapshotOf(host);

    const left = host.database.failNext(/^COMMIT$/);
    const error = await rejection(host.engine.command(investigator, 'addMarker', 'Lost with the commit'));
    expect(left()).toBe(0);
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'COMMIT_FAILED' });
    await expectSetBack(host, before, 'failed commit');
    expect(host.database.connections.inUse).toBe(0);

    const outcome = await host.engine.command(investigator, 'addMarker', 'Stored after the failure');
    expect(outcome.revision).toBe(before.revision + 1);
    const trail = await readTrail(host.owner);
    expect(trail.at(-1)).toMatchObject({ seq: before.head.seq + 1, type: 'MARKER_ADDED', prevHash: before.head.hash });
    expect(trail.filter((row) => row.type === 'MARKER_ADDED')).toHaveLength(1);
    expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true });
    expect(host.engine.stats().resyncs).toBe(0);
    expect(host.log.lines().some((line) => line['msg'] === 'engine state set back: the unit was not committed' && line['code'] === 'COMMIT_FAILED')).toBe(true);
  });

  it.each([
    ['the audit row', /^insert into "audit_log"/],
    ['the session row', /^update "active_session"/],
    ['the first statement of the unit', /^BEGIN/],
  ] as const)('a statement that fails (%s): nothing of the unit is stored, the engine is set back, the next command works', async (label, pattern) => {
    const host = await booted(`w26_fail_${label.split(' ')[1]}`);
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const before = await snapshotOf(host);

    host.database.failNext(pattern, '57P01');
    const error = await rejection(host.engine.command(investigator, 'addMarker', 'Lost with the statement'));
    expect(error).toBeDefined();
    await expectSetBack(host, before, label);

    await host.engine.command(investigator, 'addMarker', 'Stored after the failure');
    expect((await readTrail(host.owner)).at(-1)).toMatchObject({ seq: before.head.seq + 1, type: 'MARKER_ADDED' });
    expect(await storedSlices(host.owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
  });

  it('a diverged head (another writer the engine did not see): 503, nothing stored, the engine set back; it reloads with a new epoch and goes on', async () => {
    const host = await booted('w26_fail_diverged');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const epoch = host.engine.epoch;

    // A second pipeline on the same database, as a second server process would have: its commit
    // listeners are its own, so this engine does not learn of the row.
    const other = createPipeline({ pool: () => host.app.db.pool, clock: host.clock, log: host.app.log, errorLog: host.app.errorLog });
    const foreign = await other.run('test.otherProcess', (unit) => native(unit, investigator.operatorId));
    await other.close();
    expect(host.engine.slice('audit').total).toBe(foreign.seq - 1);

    const before = await snapshotOf(host);
    expect(before.head.seq).toBe(foreign.seq);
    const error = await rejection(host.engine.command(investigator, 'addMarker', 'Not stored'));
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'AUDIT_HEAD_DIVERGED' });

    // Nothing was stored: the head is still the foreign row, and no table changed.
    expect(await readHead(host.owner)).toEqual(before.head);
    expect((await readTrail(host.owner)).some((row) => row.type === 'MARKER_ADDED')).toBe(false);
    const line = host.log.lines().find((entry) => String(entry['msg']).startsWith('audit head diverged'));
    expect(line).toMatchObject({ level: 50, code: 'AUDIT_HEAD_DIVERGED', headSeq: foreign.seq, engineSeq: foreign.seq - 1 });

    // While it reloads, the engine is not ready; afterwards it holds the foreign row.
    await host.engine.settled();
    expect(host.engine.running).toBe(true);
    expect(host.engine.epoch).toBe(epoch + 1);
    expect(host.engine.revision).toBe(0);
    expect(host.engine.slice('audit')).toMatchObject({ total: foreign.seq, head: foreign.hash });
    expect(host.engine.slice('session')?.state).toBe('RECORDING');
    expect(stateChanges(host.publications).at(-1)).toMatchObject({ cause: 'start', epoch: epoch + 1, revision: 0 });
    expect(host.engine.stats().resyncs).toBe(1);
    expect(host.app.readiness.snapshot().engine).toBe(true);

    await host.engine.command(investigator, 'addMarker', 'Stored after the reload');
    await host.drive(5_000);
    const trail = await readTrail(host.owner);
    expect(trail[foreign.seq]).toMatchObject({ seq: foreign.seq + 1, type: 'MARKER_ADDED', prevHash: foreign.hash });
    expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true });
  });
});

describe('the tablet link (spec §6.8, X-2) and the demo faults (SR-59, spec §12.3)', () => {
  it('setTabletLink writes TABLET_LINK_CHANGED with no actor when the state changes, and no statement when it does not', async () => {
    const host = await booted('w26_tablet');
    expect(host.engine.slice('tabletLink').state).toBe('OFFLINE');
    const before = await readHead(host.owner);
    await host.engine.setTabletLink('CONNECTED');
    const row = (await readTrail(host.owner)).at(-1);
    expect(row).toMatchObject({ seq: before.seq + 1, type: 'TABLET_LINK_CHANGED', actorId: null, deviceId: 'TABLET', details: { state: 'CONNECTED' } });
    expect(host.engine.slice('tabletLink')).toEqual({ state: 'CONNECTED', changedAt: host.clock.now() });

    const sent = host.database.statements.length;
    const revision = host.engine.revision;
    expect(await host.engine.setTabletLink('CONNECTED')).toMatchObject({ revision });
    expect(host.database.statements).toHaveLength(sent);
  });

  it('AUDIT_TAMPER alters the engine\'s ring only: every stored audit row is byte-equal before and after, and clearing restores the ring', async () => {
    const host = await booted('w26_tamper_audit');
    await startRecording(host);
    await host.drive(20_000);
    const supervisor = host.principal('SUPERVISOR');
    const storedBefore = await readTrail(host.owner);
    const dumpBefore = await host.owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.audit_log AS t ORDER BY seq');

    await host.engine.command(supervisor, 'inject', 'AUDIT_TAMPER');

    // The view (the ring) is broken at the altered row; the stored chain is intact.
    const view = verifyAuditChain(host.engine.slice('audit'));
    expect(view).toMatchObject({ ok: false, reason: 'HASH_MISMATCH' });
    const storedAfter = await readTrail(host.owner);
    expect(storedAfter.slice(0, storedBefore.length)).toEqual(storedBefore);
    const dumpAfter = await host.owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.audit_log AS t ORDER BY seq');
    expect(dumpAfter.rows.slice(0, dumpBefore.rows.length)).toEqual(dumpBefore.rows);
    expect(storedAfter.slice(storedBefore.length).map((row) => [row.type, row.actorId])).toEqual([['AUDIT_CHAIN_DISCONTINUITY', null]]);
    expect(storedAfter.some((row) => row.message.includes('[altered]'))).toBe(false);
    expect(verifyTrail(storedAfter, await readHead(host.owner))).toMatchObject({ ok: true, checked: storedAfter.length });
    // The change went out as a whole ring, because a ring row changed in place.
    const tamperChange = stateChanges(host.publications).at(-1);
    expect(tamperChange?.ops.find((op) => op.slice === 'audit')).toMatchObject({ op: 'replace' });
    // Decision D28 D-3: the row has no actor; the server's log names the operator of the command.
    expect(host.log.lines().find((line) => line['msg'] === 'hosted action ran' && line['action'] === 'inject')).toMatchObject({ operatorId: supervisor.operatorId });

    // Appends go on under the overlay, and the table stays a verifying chain.
    await host.drive(20_000);
    expect(verifyTrail(await readTrail(host.owner), await readHead(host.owner))).toMatchObject({ ok: true });
    expect(verifyAuditChain(host.engine.slice('audit')).ok).toBe(false);

    await host.engine.command(supervisor, 'clearFault', 'AUDIT_TAMPER');
    expect(verifyAuditChain(host.engine.slice('audit'))).toMatchObject({ ok: true });
    const end = await readTrail(host.owner);
    expect(end.slice(0, storedBefore.length)).toEqual(storedBefore);
    expect(end.at(-1)).toMatchObject({ type: 'FAULT_CLEARED', actorId: null });
    const health = await host.owner.query<{ cause: string; fault_kind: string }>("SELECT cause, fault_kind FROM public.health_snapshots WHERE cause <> 'INTERVAL' ORDER BY at, cause DESC");
    expect(health.rows).toEqual([
      { cause: 'FAULT_RAISED', fault_kind: 'AUDIT_TAMPER' },
      { cause: 'FAULT_CLEARED', fault_kind: 'AUDIT_TAMPER' },
    ]);
  });

  it('the evidence TAMPER fault sets the stored flag and nothing that was sealed: tracks, hashes, manifest and signature are byte-equal', async () => {
    const host = await booted('w26_tamper_evidence');
    const supervisor = host.principal('SUPERVISOR');
    const item = host.engine.slice('evidence').find((entry) => entry.status === 'SEALED');
    if (item === undefined) throw new Error('the seed has sealed evidence');
    const sealed = async () =>
      (
        await host.owner.query<{ line: string }>(
          `SELECT (to_jsonb(i) - 'tampered' - 'tampered_track_id' - 'updated_at' - 'verification_status' - 'verification_at')::text AS line
             FROM public.evidence_items AS i WHERE id = $1
           UNION ALL SELECT to_jsonb(t)::text FROM public.evidence_tracks AS t WHERE evidence_id = $1`,
          [item.id],
        )
      ).rows;
    const custody = async () =>
      (await host.owner.query<{ line: string }>('SELECT to_jsonb(c)::text AS line FROM public.evidence_custody AS c WHERE evidence_id = $1 ORDER BY seq', [item.id])).rows;
    const before = await sealed();
    const custodyBefore = await custody();
    expect(before).toHaveLength(5);

    await host.engine.command(supervisor, 'inject', 'TAMPER', { evidenceId: item.id });
    const flag = async () => (await host.owner.query<{ tampered: boolean }>('SELECT tampered FROM public.evidence_items WHERE id = $1', [item.id])).rows[0]?.tampered;
    expect(await flag()).toBe(true);
    expect(await sealed()).toEqual(before);
    const verdict = await host.engine.command(supervisor, 'verify', item.id);
    expect(verdict.value).toMatchObject({ ok: false });
    expect(await sealed()).toEqual(before);

    await host.engine.command(supervisor, 'clearFault', 'TAMPER', { evidenceId: item.id });
    expect(await flag()).toBe(false);
    expect(await sealed()).toEqual(before);
    // The custody chain only grew: the failed verification is one more entry, the old ones are as they were.
    const custodyAfter = await custody();
    expect(custodyAfter.slice(0, custodyBefore.length)).toEqual(custodyBefore);
    expect(custodyAfter.length).toBe(custodyBefore.length + 1);
    expect(await storedSlices(host.owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
  });
});

describe('the log of the engine (SR-48)', () => {
  it('holds codes, counts, labels, action names and operator IDs; never an argument of a command, a slice or a row', async () => {
    const host = await booted('w26_log');
    // The lines of the boot checks are the core's; from here on the engine and its units write.
    const fromLine = host.log.lines().findIndex((line) => line['msg'] === 'engine started');
    await startRecording(host);
    const investigator = host.principal('INVESTIGATOR');
    const MARKS = ['MARK-label-4b1e', 'MARK-note-9a70', 'MARK-reason-22cd', 'MARK-destination-5f08'];
    await host.engine.command(investigator, 'addMarker', MARKS[0]);
    await host.engine.command(investigator, 'addNote', `Note ${MARKS[1]}`);
    await rejection(host.engine.command(investigator, 'addNote', ''));
    await rejection(host.engine.command(host.principal('TECHNICIAN'), 'stopRecording', `Reason ${MARKS[2]}`));
    const evidenceId = host.engine.slice('evidence')[0]?.id ?? '';
    await host.engine.command(host.principal('SUPERVISOR'), 'exportEvidence', evidenceId, { reason: `Reason ${MARKS[2]}`, destination: MARKS[3] ?? '' });
    await host.engine.command(investigator, 'stopRecording', `Reason ${MARKS[2]}`);
    await host.drive(20_000);
    await host.app.close();

    // The whole log, without the two members the logger adds about the machine it runs on.
    const text = host.log
      .lines()
      .map(({ hostname: _hostname, pid: _pid, ...line }) => JSON.stringify(line))
      .join('\n');
    for (const mark of MARKS) expect(text, mark).not.toContain(mark);
    // The tables hold the texts: the search above can find them.
    const stored = await dumpDatabase(host.owner);
    for (const mark of MARKS) expect(stored, mark).toContain(mark);
    // Nothing of a slice: no subject, no case number, no operator name, no device serial.
    const state: DurableSlices = await storedSlices(host.owner);
    const contents = [SESSION_INPUT.subjectName, SESSION_INPUT.caseNumber, state.device.identity.serialNumber, ...state.operators.flatMap((operator) => [operator.name, operator.username])];
    for (const content of contents) expect(text, content).not.toContain(content);
    // By-design change (checkpoint CP-B1, finding CPB1-13; standing rule M10; decision D82): this
    // test held ONE closed set of keys for every line after the start, the lines of other units
    // included (readiness, the pipeline's shutdown), and broke when one of them logged a new key.
    // It is closed for the engine's own lines, and a deny-list for the rest.
    expect(fromLine).toBeGreaterThan(0);
    const after = host.log.lines().slice(fromLine);

    // (1) The engine's own lines: its messages, the lines about its hosted actions, and the lines
    // the pipeline and the writers write for a unit of the engine. Only these members.
    const isEngineLine = (line: Record<string, unknown>): boolean =>
      /^(?:engine |hosted action |the engine |the last write of the engine|a publication of the engine|the system time is behind)/.test(String(line['msg'])) ||
      typeof line['action'] === 'string' ||
      (typeof line['label'] === 'string' && line['label'].startsWith('engine.'));
    const engineKeys = new Set([
      'level', 'time', 'pid', 'hostname', 'msg', 'unit', 'label', 'action', 'code', 'simCode', 'operatorId', 'mode', 'epoch', 'revision', 'step',
      'auditTotal', 'session', 'restartFault', 'tamperCleared', 'tabletLinkReset', 'tabletLinkCarried', 'auditRows', 'headSeq', 'engineSeq', 'ms',
      'committed', 'audit', 'events', 'seq', 'type', 'behindMs', 'tabletLinkOfflineUnwritten',
      // Fix wave K (G75c-01, ruling D223): the start line says whether the restart fault of a closed session was ended.
      'restartFaultEnded',
    ]);
    const engineLines = after.filter(isEngineLine);
    expect(engineLines.length).toBeGreaterThan(20);
    expect(engineLines.some((line) => line['msg'] === 'engine stopped')).toBe(true);
    expect(engineLines.some((line) => line['msg'] === 'hosted action ran')).toBe(true);
    const keysOutsideTheList = [...new Set(engineLines.flatMap((line) => Object.keys(line).filter((key) => !engineKeys.has(key))))];
    expect(
      keysOutsideTheList,
      `the engine log line holds the key(s) [${keysOutsideTheList.join(', ')}], which are not in engineKeys. The rule: a log key must carry a count or a boolean, never text - add it to the list only after checking its value`,
    ).toEqual([]);
    // The new member is a flag, never a text: `effects.restartFaultEnded === true` (`engine/host.ts`, the start line).
    expect(engineLines.filter((line) => 'restartFaultEnded' in line).map((line) => typeof line['restartFaultEnded'])).toEqual(['boolean']);

    // (2) Every other line (readiness, the pipeline's shutdown, whatever a later unit writes when
    // the app closes): no key that names a secret, and no value in the form of one.
    const others = after.filter((line) => !isEngineLine(line));
    expect(others.length).toBeGreaterThan(0);
    const secretKey = /pass(?:word)?|secret|token|credential|authorization|cookie|salt|hash|pairingcode|qrpayload/i;
    const namesOf = (value: unknown): string[] =>
      typeof value !== 'object' || value === null
        ? []
        : Object.entries(value).flatMap(([key, member]) => [key, ...namesOf(member)]);
    const textsOf = (value: unknown): string[] =>
      typeof value === 'string' ? [value] : typeof value !== 'object' || value === null ? [] : Object.values(value).flatMap(textsOf);
    expect(others.flatMap(namesOf).filter((key) => secretKey.test(key))).toEqual([]);
    expect(others.flatMap(textsOf).filter(looksLikeSecret)).toEqual([]);
    // (3) And over the whole log of the test: nothing in the form of a credential.
    expect(credentialLeaks(text)).toEqual([]);
    expect(host.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});
