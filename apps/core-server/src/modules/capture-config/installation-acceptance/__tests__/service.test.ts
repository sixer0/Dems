// The installation acceptance and its revocation without a database (task 4 blueprint row 117,
// WP-26b; contract of row 116, operations 109 and 110):
//   - operations 109 and 110 (`service.ts`) on a unit of work of this file: every refusal, the ONE
//     audit entry of a committed change, nothing on a refused one;
//   - the Core's own copy of its diagnostics run, made storable and held to the closed key lists;
//   - the closed key lists against the denied key names of the Core (`AUDIT_DETAIL_FORBIDDEN_KEYS`,
//     by import), and where a denied name is refused: by the body's schema, before a statement;
//   - what the folder does NOT have: a read of the table, a reader for another unit, a gate.
//
// THE DOUBLES: the store is a list in memory that refuses a second row in force the way the
// database does (an error of SQLSTATE 23505 naming the in-force index - the judge is never this
// file's service); the unit of work commits when its work resolves and forgets everything when it
// throws; the Core's facts are a device and a run written here. The database, the real unit of the
// engine, stage 6 and two requests at the same moment are `routes.db.test.ts`.
import {
  INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS,
  INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS,
  INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS,
  INSTALLATION_ACCEPTANCE_LIMITS,
  INSTALLATION_ACCEPTANCE_STEP_IDS,
  INSTALLATION_ACCEPTANCE_STEP_KEYS,
  INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION,
  InstallationAcceptRequestSchema,
  InstallationAcceptanceRevokeRequestSchema,
  InstallationAcceptanceSchema,
  installationDocumentBytes,
} from '@dems/shared/api';
import type { DiagnosticsRun } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree } from '../../../../../test/static/scan';
import { detailRulesOf, type AuditEntry } from '../../../../core';
import { AUDIT_DETAIL_FORBIDDEN_KEYS } from '../../../../db/schema';
import { ApiFailure } from '../../../../plugins/error-envelope';
import * as folder from '../index';
import {
  INSTALLATION_ACCEPTANCE_WRITES,
  IN_FORCE_CONSTRAINT,
  acceptInstallation,
  isClockBehindViolation,
  isInForceViolation,
  revokeInstallationAcceptance,
  storableDiagnosticsOf,
  type InstallationAcceptanceSeams,
  type InstallationAcceptanceStore,
  type InstallationFacts,
  type StoredAcceptance,
} from '../index';

// ── The Core of this file ──────────────────────────────────────────────────────────────────────

const TECHNICIAN = { operatorId: 'OPR-003', deviceId: null };
const T0 = 1_791_000_000_000;
const DEVICE = { id: 'DEMS-IR-01', name: 'Interview room 1', room: 'IR-01' };
const RUN: DiagnosticsRun = {
  id: 'DIAG-000004',
  startedAt: T0 - 60_000,
  completedAt: T0 - 30_000,
  checks: [
    { id: 'CPU', label: 'CPU and memory', status: 'PASS', detail: 'CPU 12%, 48.5 °C', params: { cpuPercent: 12, cpuTempC: 48.5 }, resolvesAt: T0 - 50_000 },
    { id: 'CAMERA', label: 'Cameras', status: 'FAIL', detail: 'One lens is not ready', params: { tracks: 'VIDEO-02' }, resolvesAt: T0 - 30_000 },
    { id: 'TIME', label: 'Time', status: 'PASS', detail: null },
  ],
};
/** THE CONTRACT'S CLOSED LIST (row V6, R119-07): every check once - 25 passed, one failed and one not run, each of the two with its reason. */
const STEPS = INSTALLATION_ACCEPTANCE_STEP_IDS.map((id) =>
  id === '9A/H-11'
    ? { id, result: 'FAIL', detail: 'Microphone 2 was left out on purpose.' }
    : id === '9A/H-19'
      ? { id, result: 'NOT_RUN', detail: 'The long session was left for the next visit.' }
      : { id, result: 'PASS', detail: null },
);
/** A record as the FIRST contract stored it: ids a client chose. Read and revoked, never accepted again. */
const LEGACY_STEPS = [
  { id: 'CAMERAS_ASSIGNED', passed: true, detail: null },
  { id: 'MICROPHONES_ASSIGNED', passed: false, detail: null },
];
/** Every text of a body of this file: none may be in an audit entry or a log line. */
const BODY_TEXT = ['Microphone 2', 'Example street', 'moved to another room', 'One lens'];

interface Bench {
  readonly seams: InstallationAcceptanceSeams;
  readonly rows: StoredAcceptance[];
  readonly audits: AuditEntry[];
  readonly notes: Record<string, unknown>[];
  readonly failures: string[];
  /** The statements the service sent, by kind, refused ones included. */
  readonly sent: string[];
  readonly state: {
    now: number;
    version: string;
    sessionOpen: boolean;
    sessionOpensInUnit: boolean;
    failAudit: boolean;
    /** An error the next INSERT rejects with, in the place of the store's own answer. */
    insertError: unknown;
    facts: InstallationFacts;
    units: number;
  };
  /** Puts other steps into the row in force, as a Core of an earlier contract stored them (row V6). */
  replaceSteps(steps: unknown): void;
}

function bench(): Bench {
  let rows: StoredAcceptance[] = [];
  const audits: AuditEntry[] = [];
  const notes: Record<string, unknown>[] = [];
  const failures: string[] = [];
  const sent: string[] = [];
  const state: Bench['state'] = { now: T0, version: '0.2.0', sessionOpen: false, sessionOpensInUnit: false, failAudit: false, insertError: null, facts: { device: DEVICE, diagnostics: RUN }, units: 0 };
  let serial = 0;
  // THE DATABASE OF THIS FILE: it, not the service, refuses a second row in force.
  const store: InstallationAcceptanceStore = {
    async insert(_db, write) {
      sent.push('INSERT');
      if (state.insertError !== null) throw state.insertError;
      // As the statement's own condition (row V6b): a stored instant later than the new one writes nothing and answers no row.
      if (rows.some((row) => row.acceptedAt > write.acceptedAt || (row.revokedAt !== null && row.revokedAt > write.acceptedAt))) return null;
      if (rows.some((row) => row.revokedAt === null)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint: IN_FORCE_CONSTRAINT });
      serial += 1;
      const row: StoredAcceptance = { ...write, id: `00000000-0000-4000-8000-${String(serial).padStart(12, '0')}`, revokedAt: null, revokedBy: null, revokeReason: null };
      rows = [...rows, row];
      return row;
    },
    async revoke(_db, write) {
      sent.push('UPDATE');
      const inForce = rows.find((row) => row.revokedAt === null);
      if (inForce === undefined) return null;
      // As the table: a revocation stamped before the acceptance is refused by the revoked-at CHECK.
      if (write.revokedAt < inForce.acceptedAt) throw Object.assign(new Error('new row violates check constraint'), { code: '23514', constraint: 'installation_acceptances_revoked_at_check' });
      const revoked: StoredAcceptance = { ...inForce, ...write };
      rows = rows.map((row) => (row === inForce ? revoked : row));
      return revoked;
    },
  };
  const seams: InstallationAcceptanceSeams = {
    store,
    host: {
      now: () => state.now,
      softwareVersion: () => state.version,
      sessionOpen: () => state.sessionOpen,
      async unit(_label, work) {
        state.units += 1;
        const before = rows;
        const pending: AuditEntry[] = [];
        try {
          const value = await work({
            db: { query: async () => ({ rows: [], rowCount: 0 }) },
            sessionOpen: () => state.sessionOpen || state.sessionOpensInUnit,
            facts: () => state.facts,
            async audit(entry) {
              if (state.failAudit) throw Object.assign(new Error('row117: the audit writer failed'), { code: 'ROW117_INJECTED' });
              pending.push(entry);
            },
          });
          audits.push(...pending);
          return value;
        } catch (error) {
          rows = before;
          throw error;
        }
      },
      note: (fields) => void notes.push(fields),
      failed: (source) => void failures.push(source),
    },
  };
  return {
    seams,
    get rows() {
      return rows;
    },
    audits,
    notes,
    failures,
    sent,
    state,
    replaceSteps(steps) {
      rows = rows.map((row) => (row.revokedAt === null ? { ...row, steps } : row));
    },
  };
}

const refusalOf = async (work: Promise<unknown>): Promise<[number, string, unknown]> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof ApiFailure) return [error.statusCode, error.code, (error.details as Record<string, unknown> | undefined)?.['reason'] ?? null];
    throw error;
  }
  throw new Error('row117: the call was not refused');
};
const accept = (target: Bench, body: unknown = { steps: STEPS }) => acceptInstallation(target.seams, TECHNICIAN, InstallationAcceptRequestSchema.parse(body));
const revoke = (target: Bench, reason = 'The Core was moved to another room.') => revokeInstallationAcceptance(target.seams, TECHNICIAN, InstallationAcceptanceRevokeRequestSchema.parse({ reason }));
/** What a refusal must leave: the rows as they were, no entry, no line. */
const untouched = (target: Bench, rows: readonly StoredAcceptance[] = []): void => {
  expect(target.rows).toEqual(rows);
  expect([target.audits.length, target.notes.length]).toEqual([0, 0]);
};
/** The diagnostics of the first stored row, as the run it is a copy of. */
const runOf = (target: Bench): DiagnosticsRun => target.rows[0]!.diagnostics as DiagnosticsRun;
const INVALID_STATE =(reason: string): [number, string, string] => [409, 'INVALID_STATE', reason];
const LOCKED: [number, string, null] = [409, 'CAPTURE_CONFIG_LOCKED', null];

describe('operation 109 acceptInstallation', () => {
  it('stores ONE row - who, when, the version, the copy of the site and the run are the Core\'s own; the steps and the address are the body\'s - and writes ONE entry of the record id and two counts', async () => {
    const target = bench();
    const answer = await accept(target, { siteAddress: 'Example street 1\nExample city', steps: STEPS });

    expect(target.rows).toHaveLength(1);
    expect(target.rows[0]).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      acceptedAt: T0,
      acceptedBy: 'OPR-003',
      softwareVersion: '0.2.0',
      coreDeviceId: 'DEMS-IR-01',
      siteName: 'Interview room 1',
      room: 'IR-01',
      siteAddress: 'Example street 1\nExample city',
      steps: STEPS,
      diagnostics: RUN,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    });
    // A run with a FAILED check is recorded as it is (decision DD-2 of row 116): the acceptance is the operator's statement.
    expect(runOf(target).checks.map((check) => check.status)).toEqual(['PASS', 'FAIL', 'PASS']);
    expect(InstallationAcceptanceSchema.safeParse(answer).success).toBe(true);
    expect(answer).toMatchObject({ acceptanceId: target.rows[0]?.id, acceptedBy: 'OPR-003', revokedAt: null, revokedBy: null, revokeReason: null });

    expect(target.audits).toEqual([
      {
        type: 'INSTALLATION_ACCEPTED',
        message: 'Installation accepted',
        actorId: 'OPR-003',
        deviceId: null,
        // `passedCount`: the checks whose result is PASS - a FAIL and a NOT_RUN are not counted.
        details: { acceptanceId: '00000000-0000-4000-8000-000000000001', stepCount: 27, passedCount: 25, operationId: 'acceptInstallation', permission: 'CAPTURE_COMMISSION' },
      },
    ]);
    expect(target.notes).toEqual([{ code: 'INSTALLATION_ACCEPTED', source: 'installationAcceptance', acceptanceId: '00000000-0000-4000-8000-000000000001', stepCount: 27 }]);
    const written = JSON.stringify([target.audits, target.notes]);
    for (const text of BODY_TEXT) expect(written, text).not.toContain(text);
    expect(target.failures).toEqual([]);
  });

  it('no address is an acceptance too: a NULL address; `siteAddress: null` says the same as leaving it out', async () => {
    const target = bench();
    await accept(target);
    expect(target.rows[0]).toMatchObject({ steps: STEPS, siteAddress: null });
    const second = bench();
    await accept(second, { siteAddress: null, steps: STEPS });
    expect(second.rows[0]?.siteAddress).toBeNull();
  });

  // Row V6 (R119-07; decision C94 (h)). Before this row the Core stored whatever codes a client sent, an empty list included.
  it('THE STEP LIST IS THE CONTRACT\'S, held AGAIN in the Core past the route: an empty list, an unknown step, a missing check, a repeated check, a result outside the set, a failed or not-run check without its reason and the steps of the first contract are each 422 INSTALLATION_STEPS_NOT_THE_LIST - no unit, no statement, no entry, and nothing of the body quoted', async () => {
    const unchecked = (target: Bench, steps: unknown) => acceptInstallation(target.seams, TECHNICIAN, { steps } as never);
    const [first, second, ...rest] = STEPS;
    if (first === undefined || second === undefined) throw new Error('the list has two checks at least');
    const refusedLists: readonly [string, unknown][] = [
      ['an empty list', []],
      ['a step that is no check of the list', [{ id: 'CAMERAS_ASSIGNED', result: 'PASS', detail: null }, second, ...rest]],
      ['an id of the right form outside the list', [{ id: '9A/H-28', result: 'PASS', detail: null }, second, ...rest]],
      ['a preparation step of the frame', [{ id: 'PREP-01', result: 'PASS', detail: null }, second, ...rest]],
      ['a missing check', [second, ...rest]],
      ['a repeated check in the place of another', [first, first, ...rest]],
      ['a repeated check beside the whole list', [...STEPS, first]],
      ['a result outside the closed set', [{ ...first, result: 'OK' }, second, ...rest]],
      ['the member of the first contract', [{ id: first.id, passed: true, detail: null }, second, ...rest]],
      ['a failed check without its reason', [{ ...first, result: 'FAIL', detail: null }, second, ...rest]],
      ['a check that was not run with a blank reason', [{ ...first, result: 'NOT_RUN', detail: '   ' }, second, ...rest]],
      ['the steps of the first contract', LEGACY_STEPS],
      ['no list at all', null],
    ];
    for (const [label, steps] of refusedLists) {
      const target = bench();
      const refusal = await unchecked(target, steps).then(
        () => null,
        (error: unknown) => error,
      );
      expect(refusal, label).toBeInstanceOf(ApiFailure);
      const failure = refusal as ApiFailure;
      expect([failure.statusCode, failure.code, failure.details?.['reason']], label).toEqual([422, 'INVALID_INPUT', 'INSTALLATION_STEPS_NOT_THE_LIST']);
      expect(JSON.stringify([failure.message, failure.details]), label).not.toContain('CAMERAS_ASSIGNED');
      expect([target.rows, target.audits, target.sent, target.state.units], label).toEqual([[], [], [], 0]);
    }
    // The order of the list is the frame's, and a body may state it in any order: the same checks, each once.
    const reversed = bench();
    await unchecked(reversed, [...STEPS].reverse());
    expect(reversed.rows[0]?.steps).toEqual([...STEPS].reverse());
    // The route's own schema says the same of each list (422 before this file is reached).
    for (const [label, steps] of refusedLists) expect(InstallationAcceptRequestSchema.safeParse({ steps }).success, label).toBe(false);
    expect([INSTALLATION_ACCEPTANCE_STEP_IDS.length, new Set(INSTALLATION_ACCEPTANCE_STEP_IDS).size, INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION]).toEqual([27, 27, 1]);
    expect(INSTALLATION_ACCEPTANCE_STEP_IDS.every((id) => /^9A\/H-\d{2}$/.test(id))).toBe(true);
  });

  it('a record stored BEFORE the closed list (the steps of the first contract) is still read and revoked: the answer holds it as it was stored, and the contract takes it as an ANSWER only', async () => {
    const target = bench();
    await accept(target);
    // The row as an older Core wrote it.
    target.replaceSteps(LEGACY_STEPS);
    const answer = await revoke(target);
    expect(answer.steps).toEqual(LEGACY_STEPS);
    expect(InstallationAcceptanceSchema.safeParse(answer).success).toBe(true);
    expect(InstallationAcceptRequestSchema.safeParse({ steps: LEGACY_STEPS }).success).toBe(false);
  });

  // Row V6 (R119-08; decision C94 (i)). Before this row it was a 500 with a persisted failure.
  it('A CLOCK BEHIND THE STORED STATE is a NAMED 409 with no value: a revocation stamped before its acceptance is the table\'s CHECK, named - the statement IS sent, no entry is written, nothing is persisted as a defect, no instant is bent; at the stored instant itself it is taken', async () => {
    const target = bench();
    await accept(target);
    // The clock went back past `accepted_at`: the revocation is refused by name.
    target.state.now = T0 - 1;
    const revocation = await revoke(target).then(
      () => null,
      (error: unknown) => error,
    );
    expect(revocation).toBeInstanceOf(ApiFailure);
    expect([(revocation as ApiFailure).statusCode, (revocation as ApiFailure).code, (revocation as ApiFailure).details]).toEqual([409, 'INVALID_STATE', { reason: 'INSTALLATION_CLOCK_BEHIND_RECORD' }]);
    expect(target.rows[0]).toMatchObject({ acceptedAt: T0, revokedAt: null });
    expect(target.audits).toHaveLength(1);
    expect(target.failures).toEqual([]);
    expect(target.notes.at(-1)).toEqual({ code: 'INSTALLATION_CLOCK_BEHIND_RECORD', source: 'installationAcceptance', level: 'warn' });

    // The same instant as the stored one is not "behind": the revocation is taken, with the clock's own instant.
    target.state.now = T0;
    await revoke(target);
    expect(target.rows[0]).toMatchObject({ acceptedAt: T0, revokedAt: T0 });
    expect(target.audits).toHaveLength(2);
    expect(target.failures).toEqual([]);
    // The statement WAS sent each time: the database answers, no question is asked first.
    expect(target.sent).toEqual(['INSERT', 'UPDATE', 'UPDATE']);
    // Only the revoked-at CHECK is the named answer; every other CHECK of the table stays a defect (persisted, 500).
    expect(isClockBehindViolation({ code: '23514', constraint: 'installation_acceptances_revoked_at_check' })).toBe(true);
    for (const other of [{ code: '23514', constraint: 'installation_acceptances_revoke_check' }, { code: '23505', constraint: 'installation_acceptances_revoked_at_check' }, { code: '23514' }, null, undefined, 'x']) expect(isClockBehindViolation(other)).toBe(false);
  });

  // Row V6b (R119-08 for operation 109; decision C105 (5)). Before this row such an acceptance was STORED, its instants out of order.
  it('A CLOCK BEHIND THE STORED STATE, OPERATION 109: an acceptance stamped before a stored instant - the revocation of the record before it, or an acceptance in force - is a NAMED 409 with no value: the statement IS sent and writes nothing, no entry, nothing persisted as a defect, one warning line that names the clock; at the stored instant itself it is taken', async () => {
    const target = bench();
    await accept(target);
    target.state.now = T0 + 10;
    await revoke(target);
    const [revoked] = target.rows;
    expect(revoked).toMatchObject({ acceptedAt: T0, revokedAt: T0 + 10 });

    // NONE IS IN FORCE, and the clock went back past the revocation: the new acceptance would stand before it.
    target.state.now = T0 + 9;
    const refusal = await accept(target).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refusal).toBeInstanceOf(ApiFailure);
    // Pass I-9b: the contract lists the clock reason for operation 109 (row R1b), and the statement's empty answer is the guard's, never the index's.
    expect([(refusal as ApiFailure).statusCode, (refusal as ApiFailure).code, (refusal as ApiFailure).details]).toEqual([409, 'INVALID_STATE', { reason: 'INSTALLATION_CLOCK_BEHIND_RECORD' }]);
    expect(target.rows).toEqual([revoked]);
    expect(target.audits.map((entry) => entry.type)).toEqual(['INSTALLATION_ACCEPTED', 'INSTALLATION_ACCEPTANCE_REVOKED']);
    expect(target.failures).toEqual([]);
    expect(target.notes.at(-1)).toEqual({ code: 'INSTALLATION_CLOCK_BEHIND_RECORD', source: 'installationAcceptance', level: 'warn' });
    // No question was asked first: the INSERT went to the store and answered no row.
    expect(target.sent).toEqual(['INSERT', 'UPDATE', 'INSERT']);

    // The same instant as the newest stored one is not "behind": taken, with the clock's own instant.
    target.state.now = T0 + 10;
    await accept(target);
    expect(target.rows).toHaveLength(2);
    expect(target.rows[1]).toMatchObject({ acceptedAt: T0 + 10, revokedAt: null });
    expect(target.audits).toHaveLength(3);

    // ONE IS IN FORCE and the clock is behind it: the same named answer, the same warning line, nothing written.
    const notes = target.notes.length;
    target.state.now = T0 + 9;
    expect(await refusalOf(accept(target))).toEqual(INVALID_STATE('INSTALLATION_CLOCK_BEHIND_RECORD'));
    expect(target.rows).toHaveLength(2);
    expect(target.audits).toHaveLength(3);
    expect(target.failures).toEqual([]);
    expect(target.notes.slice(notes)).toEqual([{ code: 'INSTALLATION_CLOCK_BEHIND_RECORD', source: 'installationAcceptance', level: 'warn' }]);
    // With the clock right, one in force is the index's answer as before: no warning line.
    target.state.now = T0 + 11;
    expect(await refusalOf(accept(target))).toEqual(INVALID_STATE('INSTALLATION_ACCEPTANCE_IN_FORCE'));
    expect(target.notes).toHaveLength(notes + 1);
  });

  it('409 CAPTURE_CONFIG_LOCKED while a session is open - before the unit, and for a session that opened meanwhile, inside it; no statement, no entry', async () => {
    const target = bench();
    target.state.sessionOpen = true;
    expect(await refusalOf(accept(target))).toEqual(LOCKED);
    expect(target.state.units).toBe(0);
    target.state.sessionOpen = false;
    target.state.sessionOpensInUnit = true;
    expect(await refusalOf(accept(target))).toEqual(LOCKED);
    expect(target.state.units).toBe(1);
    expect(target.sent).toEqual([]);
    untouched(target);
    // CONTROL: idle, the same call is taken.
    target.state.sessionOpensInUnit = false;
    await accept(target);
    expect(target.rows).toHaveLength(1);
  });

  it('409 INSTALLATION_DIAGNOSTICS_NOT_COMPLETE: no run was ever started, or the newest has not ended; no statement, no entry', async () => {
    const target = bench();
    target.state.facts = { device: DEVICE, diagnostics: null };
    expect(await refusalOf(accept(target))).toEqual(INVALID_STATE('INSTALLATION_DIAGNOSTICS_NOT_COMPLETE'));
    target.state.facts = { device: DEVICE, diagnostics: { ...RUN, completedAt: null } };
    expect(await refusalOf(accept(target))).toEqual(INVALID_STATE('INSTALLATION_DIAGNOSTICS_NOT_COMPLETE'));
    expect(target.sent).toEqual([]);
    untouched(target);
  });

  it('409 INSTALLATION_DIAGNOSTICS_NOT_STORABLE: a run of the Core with a member outside the closed key lists - a denied key name among them - a map in `params`, or more than 16,384 bytes; NOTHING is dropped silently and no statement is sent', async () => {
    const withCheck = (check: Record<string, unknown>): DiagnosticsRun => ({ ...RUN, checks: [...RUN.checks, check as unknown as DiagnosticsRun['checks'][number]] });
    const plain = { id: 'NEW', label: 'New check', status: 'PASS', detail: null };
    const unstorable: readonly (readonly [string, DiagnosticsRun])[] = [
      ['a `params` key outside the 16', withCheck({ ...plain, params: { vendorNote: 'x' } })],
      ['a denied key name in `params`', withCheck({ ...plain, params: { password: 'x' } })],
      ['a denied key name as a member of a check', withCheck({ ...plain, token: 'x' })],
      ['a member of a check the list does not name', withCheck({ ...plain, hint: 'x' })],
      ['a member of the run the list does not name', { ...RUN, operator: 'OPR-003' } as unknown as DiagnosticsRun],
      ['a map inside `params` (a fifth level)', withCheck({ ...plain, params: { reason: { nested: 'x' } } })],
      ['a list inside `params`', withCheck({ ...plain, params: { tracks: ['VIDEO-01'] } })],
      ['a status outside the value set', withCheck({ ...plain, status: 'MAYBE' })],
      ['a run id of another form', { ...RUN, id: 'run 4' }],
      ['more than 16,384 bytes', { ...RUN, checks: Array.from({ length: 120 }, (_, index) => ({ id: `C${String(index)}`, label: 'x'.repeat(200), status: 'PASS' as const, detail: null })) }],
    ];
    for (const [label, run] of unstorable) {
      const target = bench();
      target.state.facts = { device: DEVICE, diagnostics: run };
      expect(storableDiagnosticsOf(run), label).toBeNull();
      expect(await refusalOf(accept(target)), label).toEqual(INVALID_STATE('INSTALLATION_DIAGNOSTICS_NOT_STORABLE'));
      expect(target.sent, label).toEqual([]);
      untouched(target);
    }
    // The size case is over the bound for its size alone: every text of it is in bound.
    expect(installationDocumentBytes(unstorable.at(-1)?.[1])).toBeGreaterThan(INSTALLATION_ACCEPTANCE_LIMITS.diagnosticsMaxBytes);
  });

  it('device text inside the run is made ONE LINE of at most 200 characters before it is stored: a line break, an escape, U+2028 and a long text; numbers, flags and null stay; a member without a value is not kept', async () => {
    const target = bench();
    const hostile: DiagnosticsRun = {
      ...RUN,
      checks: [
        {
          id: 'CAMERA',
          label: 'Cameras second line',
          status: 'WARN',
          detail: `Lens "Front\r\ndoor"\u001b[31m ${'x'.repeat(300)}`,
          params: { tracks: 'VIDEO-01\nVIDEO-02', linkUp: false, fanRpm: 0, reason: null, source: undefined } as unknown as NonNullable<DiagnosticsRun['checks'][number]['params']>,
          resolvesAt: null,
        },
      ],
    };
    target.state.facts = { device: DEVICE, diagnostics: hostile };
    await accept(target);
    const stored = runOf(target).checks[0];
    expect(stored?.label).toBe('Cameras second line');
    expect(stored?.detail).toBe(`Lens "Front  door" [31m ${'x'.repeat(200)}`.slice(0, 200));
    expect(Array.from(stored?.detail ?? '')).toHaveLength(200);
    expect(stored?.params).toEqual({ tracks: 'VIDEO-01 VIDEO-02', linkUp: false, fanRpm: 0, reason: null });
    expect(stored?.resolvesAt).toBeNull();
    // The run of the state is not rewritten: the copy is the folder's.
    expect(hostile.checks[0]?.label).toBe('Cameras second line');
  });

  it('409 INSTALLATION_SITE_NOT_STORABLE: the id, the name, the room or the version of the Core outside its one-line bound is refused, NEVER cut; no statement, no entry', async () => {
    const cases: readonly (readonly [string, (state: Bench['state']) => void])[] = [
      ['a room of two lines', (state) => void (state.facts = { ...state.facts, device: { ...DEVICE, room: 'IR-01\nannex' } })],
      ['a name of 201 characters', (state) => void (state.facts = { ...state.facts, device: { ...DEVICE, name: 'n'.repeat(201) } })],
      ['an empty id', (state) => void (state.facts = { ...state.facts, device: { ...DEVICE, id: '' } })],
      ['a name with U+2029', (state) => void (state.facts = { ...state.facts, device: { ...DEVICE, name: 'Room one' } })],
      ['a version of 65 characters', (state) => void (state.version = 'v'.repeat(65))],
      ['an empty version', (state) => void (state.version = '')],
    ];
    for (const [label, arrange] of cases) {
      const target = bench();
      arrange(target.state);
      expect(await refusalOf(accept(target)), label).toEqual(INVALID_STATE('INSTALLATION_SITE_NOT_STORABLE'));
      expect(target.sent, label).toEqual([]);
      untouched(target);
    }
    // AT THE BOUND: 200 characters for the three copies and 64 for the version are taken.
    const target = bench();
    target.state.facts = { ...target.state.facts, device: { id: 'i'.repeat(200), name: '\u{1F600}'.repeat(200), room: 'r'.repeat(200) } };
    target.state.version = 'v'.repeat(64);
    await accept(target);
    expect(target.rows).toHaveLength(1);
  });

  it('409 INSTALLATION_ACCEPTANCE_IN_FORCE is THE DATABASE\'S answer: the second INSERT is SENT and refused by the in-force index; one row, one entry', async () => {
    const target = bench();
    await accept(target);
    const [row] = target.rows;
    expect(await refusalOf(accept(target))).toEqual(INVALID_STATE('INSTALLATION_ACCEPTANCE_IN_FORCE'));
    // No question was asked first: both statements went to the store.
    expect(target.sent).toEqual(['INSERT', 'INSERT']);
    expect(target.rows).toEqual([row]);
    expect(target.audits.map((entry) => entry.type)).toEqual(['INSTALLATION_ACCEPTED']);
    expect(target.notes).toHaveLength(1);
    // A refusal of the database is no failure of the Core.
    expect(target.failures).toEqual([]);
  });

  it('`isInForceViolation` is 23505 BY THE IN-FORCE INDEX and nothing else', () => {
    expect(isInForceViolation({ code: '23505', constraint: 'installation_acceptances_in_force_key' })).toBe(true);
    expect(isInForceViolation({ code: '23505', constraint: 'installation_acceptances_pkey' })).toBe(false);
    expect(isInForceViolation({ code: '23514', constraint: 'installation_acceptances_in_force_key' })).toBe(false);
    expect(isInForceViolation({ code: '23505' })).toBe(false);
    expect(isInForceViolation(new Error('x'))).toBe(false);
    expect(isInForceViolation(null)).toBe(false);
    expect(isInForceViolation('23505')).toBe(false);
  });

  it('any OTHER answer of the database - a CHECK of the table included - is a failure, not a refusal: persisted once, it leaves as it is, no entry', async () => {
    for (const refused of [
      { code: '23514', constraint: 'installation_acceptances_steps_no_secret_keys_check' },
      { code: '23505', constraint: 'installation_acceptances_pkey' },
      { code: '42501' },
    ]) {
      const target = bench();
      const error = Object.assign(new Error('row117: refused by the database'), refused);
      target.state.insertError = error;
      await expect(accept(target)).rejects.toBe(error);
      expect(error).not.toBeInstanceOf(ApiFailure);
      expect(target.failures).toEqual(['installationAcceptance.accept']);
      untouched(target);
    }
  });

  it('a unit that rolls back (the audit writer fails) leaves NO row: the row and its entry commit together or not at all', async () => {
    const target = bench();
    target.state.failAudit = true;
    await expect(accept(target)).rejects.toMatchObject({ code: 'ROW117_INJECTED' });
    expect(target.sent).toEqual(['INSERT']);
    untouched(target);
  });
});

describe('operation 110 revokeInstallationAcceptance', () => {
  it('revokes the ONE row in force - who, when and the TRIMMED reason - and writes ONE entry that names the record and NOT the reason; the body holds no id', async () => {
    const target = bench();
    await accept(target);
    target.audits.length = 0;
    target.notes.length = 0;
    target.state.now = T0 + 5_000;
    const answer = await revoke(target, '   The Core was moved to another room.  ');

    expect(target.rows).toHaveLength(1);
    expect(target.rows[0]).toMatchObject({ id: '00000000-0000-4000-8000-000000000001', acceptedAt: T0, revokedAt: T0 + 5_000, revokedBy: 'OPR-003', revokeReason: 'The Core was moved to another room.' });
    // What was accepted is not rewritten.
    expect(target.rows[0]).toMatchObject({ steps: STEPS, diagnostics: RUN, siteName: 'Interview room 1' });
    expect(InstallationAcceptanceSchema.safeParse(answer).success).toBe(true);
    expect(answer).toMatchObject({ acceptanceId: '00000000-0000-4000-8000-000000000001', revokedAt: T0 + 5_000, revokedBy: 'OPR-003', revokeReason: 'The Core was moved to another room.' });

    expect(target.audits).toEqual([
      {
        type: 'INSTALLATION_ACCEPTANCE_REVOKED',
        message: 'Installation acceptance revoked',
        actorId: 'OPR-003',
        deviceId: null,
        details: { acceptanceId: '00000000-0000-4000-8000-000000000001', operationId: 'revokeInstallationAcceptance', permission: 'CAPTURE_COMMISSION' },
      },
    ]);
    expect(target.notes).toEqual([{ code: 'INSTALLATION_ACCEPTANCE_REVOKED', source: 'installationAcceptance', acceptanceId: '00000000-0000-4000-8000-000000000001' }]);
    const written = JSON.stringify([target.audits, target.notes]);
    for (const text of BODY_TEXT) expect(written, text).not.toContain(text);
    expect(Object.keys(InstallationAcceptanceRevokeRequestSchema.shape)).toEqual(['reason']);
  });

  it('409 INSTALLATION_ACCEPTANCE_NOT_IN_FORCE: nothing was ever accepted, and a second revocation of the same acceptance; the statement is sent and changes no row; no entry', async () => {
    const target = bench();
    expect(await refusalOf(revoke(target))).toEqual(INVALID_STATE('INSTALLATION_ACCEPTANCE_NOT_IN_FORCE'));
    expect(target.sent).toEqual(['UPDATE']);
    untouched(target);

    await accept(target);
    await revoke(target);
    const rows = [...target.rows];
    const entries = target.audits.length;
    expect(await refusalOf(revoke(target, 'A second reason that is long enough.'))).toEqual(INVALID_STATE('INSTALLATION_ACCEPTANCE_NOT_IN_FORCE'));
    // The first revocation is not rewritten by the second.
    expect(target.rows).toEqual(rows);
    expect(target.audits).toHaveLength(entries);
    expect(target.failures).toEqual([]);
  });

  it('409 CAPTURE_CONFIG_LOCKED while a session is open, before the unit and inside it: the acceptance stays in force', async () => {
    const target = bench();
    await accept(target);
    const rows = [...target.rows];
    target.state.sessionOpen = true;
    expect(await refusalOf(revoke(target))).toEqual(LOCKED);
    target.state.sessionOpen = false;
    target.state.sessionOpensInUnit = true;
    expect(await refusalOf(revoke(target))).toEqual(LOCKED);
    expect(target.sent).toEqual(['INSERT']);
    expect(target.rows).toEqual(rows);
    expect(target.audits.map((entry) => entry.type)).toEqual(['INSTALLATION_ACCEPTED']);
  });

  it('after a revocation the next acceptance is taken: the history keeps both rows, one in force; each committed change wrote exactly ONE entry', async () => {
    const target = bench();
    await accept(target);
    await revoke(target);
    target.state.now = T0 + 60_000;
    await accept(target);
    expect(target.rows.map((row) => [row.id.slice(-1), row.revokedAt === null])).toEqual([
      ['1', false],
      ['2', true],
    ]);
    expect(target.audits.map((entry) => [entry.type, entry.details?.['acceptanceId']])).toEqual([
      ['INSTALLATION_ACCEPTED', target.rows[0]?.id],
      ['INSTALLATION_ACCEPTANCE_REVOKED', target.rows[0]?.id],
      ['INSTALLATION_ACCEPTED', target.rows[1]?.id],
    ]);
  });

  it('a unit that rolls back (the audit writer fails) leaves the acceptance IN FORCE', async () => {
    const target = bench();
    await accept(target);
    const rows = [...target.rows];
    target.state.failAudit = true;
    await expect(revoke(target)).rejects.toMatchObject({ code: 'ROW117_INJECTED' });
    expect(target.rows).toEqual(rows);
    expect(target.audits).toHaveLength(1);
  });
});

describe('NO FREE JSON (S13-13): the closed key lists against the denied key names of the Core, and WHERE a denied name is refused', () => {
  /** The whole closed list, with `step` in the place of its first check (row V6: a body names every check once). */
  const body = (step: Record<string, unknown>): unknown => ({ steps: [step, ...STEPS.slice(1)] });
  const taken = (value: unknown): boolean => InstallationAcceptRequestSchema.safeParse(value).success;

  it('none of the four key lists of the contract, and no key of the two audit entries, is one of the 28 denied key names (read by IMPORT from the Core\'s schema)', () => {
    expect(AUDIT_DETAIL_FORBIDDEN_KEYS).toHaveLength(28);
    const denied = new Set<string>(AUDIT_DETAIL_FORBIDDEN_KEYS);
    const lists = [INSTALLATION_ACCEPTANCE_STEP_KEYS, INSTALLATION_ACCEPTANCE_DIAGNOSTICS_KEYS, INSTALLATION_ACCEPTANCE_DIAGNOSTICS_CHECK_KEYS, INSTALLATION_ACCEPTANCE_DIAGNOSTICS_PARAM_KEYS];
    expect(lists.flat().filter((key) => denied.has(key))).toEqual([]);
    expect(lists.map((list) => list.length)).toEqual([3, 4, 6, 16]);
    // The entries of this folder use exactly the keys the closed detail lists of row 19 name.
    expect(Object.keys(detailRulesOf('INSTALLATION_ACCEPTED') ?? {})).toEqual(['acceptanceId', 'stepCount', 'passedCount', 'operationId', 'permission']);
    expect(Object.keys(detailRulesOf('INSTALLATION_ACCEPTANCE_REVOKED') ?? {})).toEqual(['acceptanceId', 'operationId', 'permission']);
  });

  it('BY THE ROUTE\'S SCHEMA, BEFORE THE DATABASE: each of the 28 denied names is refused as a member of a step, as a member of the body, and at depth (inside a value of a step); so is every other member the list does not name', () => {
    const step = { id: STEPS[0]!.id, result: 'PASS', detail: null };
    expect(taken(body(step))).toBe(true);
    for (const name of AUDIT_DETAIL_FORBIDDEN_KEYS) {
      expect(taken(body({ ...step, [name]: 'x' })), `step.${name}`).toBe(false);
      expect(taken({ steps: STEPS, [name]: 'x' }), `body.${name}`).toBe(false);
      expect(taken(body({ ...step, detail: { [name]: 'x' } })), `step.detail.${name}`).toBe(false);
      expect(taken(body({ id: step.id, result: { nested: { [name]: 'x' } }, detail: null })), `step.result.nested.${name}`).toBe(false);
    }
    // The member of the first contract is no member of the list any more: `passed` beside `result`, or in its place.
    expect(taken(body({ ...step, passed: true }))).toBe(false);
    expect(taken(body({ id: step.id, passed: true, detail: null }))).toBe(false);
    // A near name is no member of the list either: the list is closed, not a deny list.
    expect(taken(body({ ...step, my_code: 'x' }))).toBe(false);
    expect(taken(body({ ...step, note: 'x' }))).toBe(false);
    // The Core's own facts are no members of the body.
    for (const name of ['diagnostics', 'acceptedBy', 'acceptedAt', 'softwareVersion', 'coreDeviceId', 'siteName', 'room', 'acceptanceId']) expect(taken({ steps: STEPS, [name]: 'x' }), name).toBe(false);
  });

  it('the body\'s bounds are the table\'s and the list\'s: the 27 checks of the list are taken (inside the table\'s 32), one more or one fewer is refused, and so is more than 8,192 bytes; a text of two lines, of 201 characters or with U+2028 is refused', () => {
    const step = (detail: string | null, index = 0) => ({ id: STEPS[index]!.id, result: 'PASS', detail });
    expect(STEPS.length).toBeLessThanOrEqual(INSTALLATION_ACCEPTANCE_LIMITS.stepsMax);
    expect(taken({ steps: STEPS.map((_, index) => step(null, index)) })).toBe(true);
    expect(taken({ steps: [...STEPS.map((_, index) => step(null, index)), step(null, 0)] })).toBe(false);
    expect(taken({ steps: STEPS.slice(1).map((_, index) => step(null, index + 1)) })).toBe(false);
    expect(taken(body(step('x'.repeat(200))))).toBe(true);
    expect(taken(body(step('x'.repeat(201))))).toBe(false);
    expect(taken(body(step('two\nlines')))).toBe(false);
    expect(taken(body(step('a b')))).toBe(false);
    expect(taken(body(step('a b')))).toBe(false);
    // The whole list with texts that are each in bound and too large together.
    const large = STEPS.map((_, index) => step('\u{1F600}'.repeat(200), index));
    expect(installationDocumentBytes(large)).toBeGreaterThan(INSTALLATION_ACCEPTANCE_LIMITS.stepsMaxBytes);
    expect(taken({ steps: large })).toBe(false);
    // The reason of a revocation: 5 to 500 characters after trimming; nothing else in the body.
    const reason = (value: unknown): boolean => InstallationAcceptanceRevokeRequestSchema.safeParse(value).success;
    expect([reason({ reason: 'moved' }), reason({ reason: '  abc   ' }), reason({ reason: 'x'.repeat(501) }), reason({ reason: 'moved', acceptanceId: 'x' }), reason({})]).toEqual([true, false, false, false, false]);
  });
});

describe('what the folder does NOT have: a read of the table, a reader for another unit, a gate on recording', () => {
  const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path)));
  const FOLDER = 'src/modules/capture-config/installation-acceptance/';
  const files = (places: readonly string[]): string[] => [...new Set(places.map((place) => place.replace(/:\d+$/, '')))].sort();

  /**
   * THE ONE NAMED ENTRY OF THE RULE "NO READ IN THE FOLDER" (row V6b; caution R119-08, decision C105 (5)).
   * PURPOSE OF THE RULE: no statement reads an acceptance so that something could be decided from the answer - a
   * question before a write (a race between two requests), or a reader that could gate a recording.
   * WHY THIS ENTRY MEETS IT: these words are a CONDITION INSIDE THE INSERT, not a statement; their answer goes nowhere
   * but into whether that one write happens; they read the two INSTANTS of the stored rows and never whether a row is
   * in force. They exist so that a clock of the Core that reads earlier than the stored record writes nothing.
   * The entry is held WORD FOR WORD: any other read in the folder, and any other condition here, fails the test.
   */
  const CLOCK_FLOOR_ENTRY = 'WHERE NOT EXISTS (SELECT 1 FROM public.installation_acceptances AS stored WHERE stored.accepted_at > $1::bigint OR stored.revoked_at > $1::bigint)';
  /** True for an INSERT the rule takes: the entry exactly once, and around it a write of the nine parameters that reads nothing. */
  const insertTaken = (insert: string): boolean => {
    const around = insert.split(CLOCK_FLOOR_ENTRY);
    if (around.length !== 2) return false;
    const rest = around.join('');
    return (
      /^INSERT INTO public\.installation_acceptances \([a-z_, ]+\) SELECT \$1::bigint, \$2::text, \$3::text, \$4::text, \$5::text, \$6::text, \$7::text, \$8::jsonb, \$9::jsonb  RETURNING [^;]+$/.test(rest) &&
      (rest.match(/public\.installation_acceptances/g) ?? []).length === 1 &&
      (rest.match(/\bSELECT\b/g) ?? []).length === 1 &&
      !/\bFROM\b|\bJOIN\b|\bDELETE\b|\bON CONFLICT\b|\bIS NULL\b|\$\{|'/.test(rest)
    );
  };

  it('both statements WRITE and neither is a question: the UPDATE names the table once and reads nothing; the INSERT reads nothing but its ONE NAMED ENTRY, the clock floor, word for word; no other SELECT and no DELETE exists in the folder', () => {
    const [insert, update] = INSTALLATION_ACCEPTANCE_WRITES as [string, string];
    expect(INSTALLATION_ACCEPTANCE_WRITES.map((statement) => statement.split(' ')[0])).toEqual(['INSERT', 'UPDATE']);
    expect(update.match(/public\.installation_acceptances/g)).toHaveLength(1);
    expect(update).not.toMatch(/\bSELECT\b|\bDELETE\b|\bON CONFLICT\b/);
    for (const statement of INSTALLATION_ACCEPTANCE_WRITES) expect(statement).not.toMatch(/\$\{|'|\bDELETE\b|\bON CONFLICT\b/);
    // The UPDATE sets the three revoke columns and names its row by "in force", never by an id of the request.
    expect(update).toMatch(/^UPDATE public\.installation_acceptances SET revoked_at = \$1, revoked_by = \$2, revoke_reason = \$3 WHERE revoked_at IS NULL RETURNING /);
    // The INSERT: the entry once, and nothing else of it reads.
    expect(insertTaken(insert)).toBe(true);
    // The entry reads the two instants against the new one, and never asks "in force".
    expect([...new Set(CLOCK_FLOOR_ENTRY.match(/stored\.\w+/g))].sort()).toEqual(['stored.accepted_at', 'stored.revoked_at']);
    expect(CLOCK_FLOOR_ENTRY).not.toMatch(/\bNULL\b|\$[2-9]/);
    const own = production.filter((file) => file.path.startsWith(FOLDER));
    expect(own.map((file) => file.path).sort()).toEqual(['index.ts', 'routes.ts', 'service.ts', 'store.ts'].map((name) => `${FOLDER}${name}`));
    expect(occurrences(own, /\bDELETE\b/g)).toEqual([]);
    // The word exists TWICE in the folder's code, both in the store's INSERT: the list of its parameters and the entry.
    const selects = occurrences(own, /\bSELECT\b/g);
    expect([files(selects), selects.length]).toEqual([[`${FOLDER}store.ts`], 2]);
    expect(own.filter((file) => file.text.includes('NOT EXISTS')).map((file) => file.path)).toEqual([`${FOLDER}store.ts`]);
  });

  it('RECORDING IS NOT GATED ON AN ACCEPTANCE: outside the schema folder the table is named by this folder\'s store alone, the folder is imported by its mount alone, and it exports no function that reads an acceptance', () => {
    const outsideSchema = production.filter((file) => !file.path.startsWith('src/db/'));
    // The table is named by this folder's store alone - and, since the RB-9 operator purge of
    // 2026-11-02, by the admin purge's reference count (a COUNT of an operator's acceptances and
    // revocations before the delete; it gates nothing and reads no acceptance into a decision).
    expect(files(occurrences(outsideSchema, /installation_acceptances|installationAcceptances\b/g))).toEqual([`${FOLDER}store.ts`, 'src/modules/admin/statements.ts'].sort());
    const importers = production.filter((file) => !file.path.startsWith(FOLDER) && /from\s+'[^']*installation-acceptance'/.test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['src/modules/capture-config/index.ts']);
    // Nothing of the capture session, the recording engine or the sealing names an acceptance at all.
    const recording = production.filter((file) => /^src\/(?:capture-session|capture|engine|sealing|sealing-host|modules\/sessions)\//.test(file.path));
    expect(recording.length).toBeGreaterThan(20);
    expect(occurrences(recording, /installation[-_ ]?acceptance/gi)).toEqual([]);
    // The door of the folder: the mount, its test control, the two operations and their parts. No reader, no "in force" question.
    const functions = Object.entries(folder)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      'InstallationAcceptanceRowError',
      'acceptInstallation',
      'createInstallationAcceptanceStore',
      'installationAcceptanceControl',
      'installationAcceptanceOf',
      'installationAcceptanceOperation',
      // Row V6 (R119-08): names ONE answer of the database (the revoked-at CHECK). It reads no acceptance.
      'isClockBehindViolation',
      'isInForceViolation',
      'mountInstallationAcceptance',
      'revokeInstallationAcceptance',
      'storableDiagnosticsOf',
    ]);
    expect(Object.keys(folder.createInstallationAcceptanceStore()).sort()).toEqual(['insert', 'revoke']);
  });

  it('the scan sees a reader when one is planted (positive control)', () => {
    const planted = codeOnly([{ path: 'src/capture-session/gate.ts', text: "const inForce = 'SELECT 1 FROM public.installation_acceptances WHERE revoked_at IS NULL';\nimport { x } from '../modules/capture-config/installation-acceptance';" }]);
    expect(occurrences(planted, /installation_acceptances|installationAcceptances\b/g)).toHaveLength(1);
    expect(occurrences(planted, /installation[-_ ]?acceptance/gi).length).toBeGreaterThan(0);
    expect(occurrences(planted, /\bSELECT\b|\bDELETE\b/g)).toHaveLength(1);
  });

  it('the named entry is held word for word (planted controls, row V6b): an INSERT without it, one whose condition asks "in force", one that reads the table a second time, and a third SELECT in the folder are each seen', () => {
    const [insert] = INSTALLATION_ACCEPTANCE_WRITES as [string];
    expect(insertTaken(insert)).toBe(true);
    // The statement of row 117, without the condition: a clock behind the record would be stored again.
    expect(insertTaken(insert.replace(` ${CLOCK_FLOOR_ENTRY}`, ''))).toBe(false);
    expect(insertTaken(insert.replace(/SELECT \$1::bigint.*\$9::jsonb .*\) RETURNING/, 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb) RETURNING'))).toBe(false);
    // A condition that asks whether one is in force: the question the folder never asks.
    expect(insertTaken(insert.replace(CLOCK_FLOOR_ENTRY, 'WHERE NOT EXISTS (SELECT 1 FROM public.installation_acceptances AS stored WHERE stored.revoked_at IS NULL)'))).toBe(false);
    expect(insertTaken(insert.replace(CLOCK_FLOOR_ENTRY, `${CLOCK_FLOOR_ENTRY} AND NOT EXISTS (SELECT 1 FROM public.installation_acceptances WHERE revoked_at IS NULL)`))).toBe(false);
    // A second read beside the entry, and the entry twice.
    expect(insertTaken(insert.replace('$7::text', '(SELECT site_address FROM public.installation_acceptances LIMIT 1)'))).toBe(false);
    expect(insertTaken(insert.replace(CLOCK_FLOOR_ENTRY, `${CLOCK_FLOOR_ENTRY} ${CLOCK_FLOOR_ENTRY}`))).toBe(false);
    // A reader planted in the folder: a third SELECT.
    const own = production.filter((file) => file.path.startsWith(FOLDER));
    const withReader = [...own, ...codeOnly([{ path: `${FOLDER}reader.ts`, text: "export const IN_FORCE = 'SELECT id FROM public.installation_acceptances WHERE revoked_at IS NULL';" }])];
    expect(occurrences(withReader, /\bSELECT\b/g)).toHaveLength(3);
    expect(files(occurrences(withReader, /\bSELECT\b/g))).toEqual([`${FOLDER}reader.ts`, `${FOLDER}store.ts`]);
  });
});
