// The mapping is lossless (plan row W20; database contract MR-1 to MR-5):
// `fromRows(toRows(state))` gives the 28 durable slices back.
//
// No database: the rows go through `asStored`, which does to them what PostgreSQL does to rows it
// stores and gives back (JSON columns take the JSON round trip; the rows of a table come in a
// scrambled order). The same statement against a real database is in
// `../../store/__tests__/write-through.db.test.ts`.
//
// "Gives back" means: every member of every durable slice is equal, absent members stay absent,
// null stays null. ONE difference exists and is asserted, not hidden: the JSON form has one zero,
// so a negative zero comes back as zero. The shared code produces one in exactly one kind of
// value, a rounded clock offset (`offsetMs`): in the time history series and in the details of a
// TIMESTAMP_CONFIRMED audit row. `-0 === 0`, every reader compares or draws it the same, and the
// shared canonical form already hashes a negative zero as `0`, so such an audit row still
// verifies after it was stored. The simulator's own snapshot storage does the same.
import {
  DEFAULT_SEED,
  appendAudit,
  auditBody,
  buildScenarioState,
  chainHash,
  createIdleState,
  verifyAuditChain,
  type AuditRow,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  FIXED_NOW,
  SCENARIOS,
  asStored,
  createHost,
  negativeZeros,
  withoutNegativeZeros,
  type Host,
} from '../../../../test/support/seed';
import { fromRows, pickDurable, toRows, type DurableSlices, type RowContext } from '..';

const context = (state: SimState): RowContext => ({ at: state.clock.now, seededAt: state.clock.now, lastResetAt: null });

function roundTrip(state: SimState): DurableSlices {
  return fromRows(asStored(toRows(state, context(state))));
}

/** Asserts the round trip of one state and returns the paths of its negative zeros. */
function expectLossless(state: SimState): string[] {
  const zeros = negativeZeros(pickDurable(state));
  // Strict: an absent member must stay absent, a null must stay null, no member may be added.
  expect(roundTrip(state)).toStrictEqual(withoutNegativeZeros(state));
  // The one tolerated difference occurs only in a rounded clock offset.
  for (const path of zeros) expect(path).toMatch(/^\$\.(time\.(history\[\d+\]\.)?|audit\.rows\[\d+\]\.details\.)offsetMs$/);
  // And it never costs the chain: the rows that come back still hash to their stored hashes.
  expect(verifyAuditChain(roundTrip(state).audit)).toMatchObject({ ok: true });
  return zeros;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const member of Object.values(value)) freezeDeep(member);
  }
  return value;
}

const idleAt = (now: number): SimState => createIdleState({ now, seed: DEFAULT_SEED });

describe('fromRows(toRows(state)) equals the durable slices', () => {
  it('for the idle state at the fixed instant, exactly (no negative zero occurs there)', () => {
    const state = idleAt(FIXED_NOW);
    expect(negativeZeros(pickDurable(state))).toEqual([]);
    expect(roundTrip(state)).toStrictEqual(pickDurable(state));
  });

  it.each(SCENARIOS)('for scenario %s at the fixed instant, exactly', (scenario) => {
    const state = buildScenarioState(scenario, idleAt(FIXED_NOW));
    expect(negativeZeros(pickDurable(state))).toEqual([]);
    expect(roundTrip(state)).toStrictEqual(pickDurable(state));
    expect(state.meta.scenario).toBe(scenario);
  });

  it.each([
    ['one day later', FIXED_NOW + DAY_MS],
    ['00:10 WIB, when today\'s sessions fall on the previous day', Date.UTC(2026, 9, 3, 17, 10, 0)],
    ['02:00 WIB', Date.UTC(2026, 9, 3, 19, 0, 0)],
    ['06:59 WIB', Date.UTC(2026, 9, 3, 23, 59, 0)],
    ['23:59:59 WIB', Date.UTC(2026, 9, 4, 16, 59, 59)],
    ['00:30 WIB on 1 January, across a year boundary', Date.UTC(2026, 11, 31, 17, 30, 0)],
    ['a leap day, 2028-02-29 12:00 WIB', Date.UTC(2028, 1, 29, 5, 0, 0)],
    ['an instant with milliseconds', FIXED_NOW + 12_345],
  ])('for the idle state at %s', (_label, now) => {
    for (const scenario of SCENARIOS) expectLossless(buildScenarioState(scenario, idleAt(now)));
  });

  it('a negative zero in a chart series is the only thing that changes, and it becomes zero', () => {
    // 2026-10-02 10:00 WIB: the back-filled time series holds one negative zero.
    const state = idleAt(FIXED_NOW + DAY_MS);
    const zeros = negativeZeros(pickDurable(state));
    expect(zeros.length).toBeGreaterThan(0);
    for (const path of zeros) expect(path).toMatch(/^\$\.time\.history\[\d+\]\.offsetMs$/);
    const back = roundTrip(state);
    expect(negativeZeros(back)).toEqual([]);
    expect(back).not.toStrictEqual(pickDurable(state));
    expect(back).toStrictEqual(withoutNegativeZeros(state));
  });

  it('whatever order the rows are read in', () => {
    const state = buildScenarioState('fault-demo', idleAt(FIXED_NOW));
    const rows = toRows(state, context(state));
    const once = fromRows(asStored(rows));
    const twice = fromRows(asStored(asStored(rows) as never));
    expect(twice).toStrictEqual(once);
    expect(once).toStrictEqual(pickDurable(state));
  });
});

describe('toRows is pure', () => {
  it('does not change the state it reads (the state is frozen), and gives the same rows twice', () => {
    const state = freezeDeep(buildScenarioState('finalizing', idleAt(FIXED_NOW)));
    const first = toRows(state, context(state));
    const second = toRows(state, context(state));
    expect(second).toStrictEqual(first);
  });

  it('passes a JSON value through by reference, so that a host can compare references', () => {
    const state = buildScenarioState('recording', idleAt(FIXED_NOW));
    const rows = toRows(state, context(state));
    expect(rows.hardwareSnapshot[0]?.health).toBe(state.health);
    expect(rows.hardwareSnapshot[0]?.timeStatus).toBe(state.time);
    expect(rows.hardwareSnapshot[0]?.softwareUpdate).toBe(state.update);
    expect(rows.activeSession[0]?.timeline).toBe(state.session?.timeline);
    expect(rows.auditLog[0]?.details).toBe(state.audit.rows[0]?.details);
  });
});

describe('a driven journey: recording, stopping, finalizing, sealed, and on', () => {
  async function recordingHost(): Promise<Host> {
    const host = await createHost({ scenario: 'recording' });
    expect(host.state().session?.state).toBe('RECORDING');
    return host;
  }

  it('is lossless at every step, through the seal, an export, a verification and an archive', async () => {
    const host = await recordingHost();
    const investigator = host.operator('INVESTIGATOR');
    const supervisor = host.operator('SUPERVISOR');
    const { actions } = host.sim;
    const states: string[] = [];
    const check = (label: string): void => {
      expectLossless(host.state());
      states.push(`${label}:${host.state().session?.state ?? 'none'}`);
    };

    check('start');
    host.drive(30_000);
    check('after 30 s of recording');
    host.runAs(investigator, () => actions.addMarker('Key statement B'));
    host.runAs(investigator, () => actions.addNote('Subject asked for a break'));
    host.runAs(investigator, () => actions.snapshot());
    check('marker, note, snapshot');

    host.runAs(investigator, () => actions.stopRecording('Interview completed'));
    expect(host.state().session?.state).toBe('STOPPING');
    check('stopping');
    host.drive(1_600);
    expect(host.state().session?.state).toBe('FINALIZING');
    check('finalizing');
    host.drive(15_000);
    expect(host.state().session?.state).toBe('SEALED');
    check('sealed');

    const sealed = host.state();
    const item = sealed.evidence[sealed.evidence.length - 1];
    expect(item?.status).toBe('SEALED');
    expect(sealed.evidence).toHaveLength(14);
    expect(sealed.sessionHistory).toHaveLength(14);
    expect(sealed.sessionHistory[0]?.evidenceId).toBe(item?.id);
    expect(sealed.lastSealedSessionId).toBe(sealed.session?.id);

    const evidenceId = item?.id ?? '';
    const exported = host.runAs(supervisor, () => actions.exportEvidence(evidenceId, { reason: 'Prosecutor request', destination: 'Case file transfer' }));
    expect(exported.ok).toBe(true);
    expect(host.state().meta.counters.export).toBe(33);
    check('exported');
    host.runAs(supervisor, () => actions.verify(evidenceId));
    check('verified');
    host.runAs(supervisor, () => actions.archiveEvidence(evidenceId));
    check('archived');
    host.runAs(investigator, () => actions.acknowledgeSummary(sealed.session?.id ?? ''));
    check('summary acknowledged');

    expect(verifyAuditChain(host.state().audit).ok).toBe(true);
    expect(host.errors).toEqual([]);
    expect(states.map((entry) => entry.split(':')[1])).toEqual(
      expect.arrayContaining(['RECORDING', 'STOPPING', 'FINALIZING', 'SEALED']),
    );
  });

  it('is lossless through a fault, a recovery and an incomplete close, and for a new session', async () => {
    const host = await recordingHost();
    const investigator = host.operator('INVESTIGATOR');
    const technician = host.operator('TECHNICIAN');
    const { actions } = host.sim;

    actions.inject('POWER_FAIL');
    expect(host.state().session?.state).toBe('FAULT');
    expectLossless(host.state());
    expect(host.state().alerts.length).toBeGreaterThan(0);

    host.runAs(investigator, () => actions.recover());
    expect(host.state().session?.state).toBe('RECOVERY');
    expectLossless(host.state());
    host.drive(4_000);
    expect(host.state().session).toBeNull();
    expect(host.state().sessionHistory[0]?.outcome).toBe('INCOMPLETE');
    expectLossless(host.state());

    // A diagnostics run and the settings: slices that are null or default at a seed.
    host.runAs(technician, () => actions.runDiagnostics());
    expect(host.state().diagnostics).not.toBeNull();
    expectLossless(host.state());
    host.drive(6_000);
    expectLossless(host.state());
    actions.updateSettings({ timeFormat: '12', notifySound: true });
    expectLossless(host.state());

    // A new session, through the states before a recording.
    const caseNumber = host.runAs(investigator, () => actions.scanCaseNumber());
    const created = host.runAs(investigator, () =>
      actions.createSession({
        caseNumber,
        subjectType: 'SAKSI',
        subjectName: 'Saksi Uji',
        investigatorId: investigator.id,
        room: host.state().device.room,
        profileId: 'STANDARD_1080P25',
      }),
    );
    expect(created.ok).toBe(true);
    expect(host.state().session?.state).toBe('CREATE');
    // Before the recording starts the session has neither time-source member: both stay absent.
    expect('startTimeSource' in (host.state().session ?? {})).toBe(false);
    expect('startTimeSource' in (roundTrip(host.state()).session ?? {})).toBe(false);
    expectLossless(host.state());
    host.runAs(investigator, () => actions.beginPrecheck());
    expectLossless(host.state());
    host.drive(6_000);
    expectLossless(host.state());
    expect(host.errors).toEqual([]);
  });

  it(
    'is lossless when the audit ring has dropped rows: the ring, its total and its dropped count come back',
    async () => {
      const host = await recordingHost();
      // About two simulated hours of recording, in steps of one second (the engine carries the
      // elapsed time into its next tick): the chain outgrows the ring of 1,000 rows.
      for (let minute = 0; minute < 240 && host.state().audit.total <= 1_100; minute += 1) host.drive(60_000, 1_000);
      const state = host.state();
      expect(host.errors).toEqual([]);
      expect(state.session?.state).toBe('RECORDING');
      expect(state.audit.total).toBeGreaterThan(1_000);
      expect(state.audit.rows).toHaveLength(1_000);
      expect(state.audit.dropped).toBe(state.audit.total - 1_000);
      expect(state.audit.rows[0]?.seq).toBe(state.audit.dropped + 1);
      const back = roundTrip(state);
      expect(back.audit.dropped).toBe(state.audit.dropped);
      expect(back.audit.total).toBe(state.audit.total);
      expect(back.audit.head).toBe(state.audit.head);
      expect(verifyAuditChain(back.audit).ok).toBe(true);
      expectLossless(state);
    },
    60_000,
  );

  it('an audit row whose details hold a negative zero is stored as zero and still verifies', () => {
    // The engine writes such a row when a confirmed clock offset rounds to -0 (seen after about
    // an hour of recording). Built directly here, so that the case does not depend on a long run.
    const base = idleAt(FIXED_NOW);
    const appended = appendAudit(
      base.audit,
      { type: 'TIMESTAMP_CONFIRMED', message: 'Timestamp confirmed', details: { source: 'GNSS', offsetMs: -0 } },
      FIXED_NOW,
    );
    const state: SimState = { ...base, audit: appended.log };
    expect(Object.is(appended.row.details['offsetMs'], -0)).toBe(true);
    expect(negativeZeros(pickDurable(state))).toEqual([`$.audit.rows[${appended.log.rows.length - 1}].details.offsetMs`]);

    const back = roundTrip(state);
    const stored = back.audit.rows[back.audit.rows.length - 1];
    expect(Object.is(stored?.details['offsetMs'], 0)).toBe(true);
    // The shared canonical form writes -0 as 0, so the hash covers "0" in both forms.
    expect(stored?.hash).toBe(appended.row.hash);
    expect(chainHash(stored?.prevHash ?? '', auditBody(stored as AuditRow))).toBe(appended.row.hash);
    expect(verifyAuditChain(back.audit)).toMatchObject({ ok: true, checked: 83 });
    expect(back).toStrictEqual(withoutNegativeZeros(state));
  });
});

describe('the comparison can fail: one changed column in one stored row changes what comes back', () => {
  const state = buildScenarioState('fault-demo', idleAt(FIXED_NOW));
  const stored = () => asStored(toRows(state, context(state)));

  it.each([
    ['operators', 'initials', 'XX'],
    ['coreDevice', 'bspVersion', 'other'],
    ['coreState', 'lastSealedAcknowledged', false],
    ['coreState', 'epoch', 3],
    ['storagePolicy', 'retentionDays', 31],
    ['consoleSettings', 'notifySound', true],
    ['engineCounters', 'nextValue', 999],
    ['hardwareSnapshot', 'activeCameraId', 'VIDEO-02'],
    ['hardwareSnapshot', 'ports', []],
    ['sessionHistory', 'durationMs', 1],
    ['evidenceItems', 'verificationStatus', 'FAIL'],
    ['evidenceItems', 'signatureKeyId', 'other'],
    ['evidenceTracks', 'sha256', 'f'.repeat(64)],
    ['evidenceCustody', 'detail', 'other'],
    ['activeSession', 'bytesWritten', 1],
    ['activeSession', 'inputNotes', 'other'],
    ['alerts', 'acknowledged', true],
    ['auditLog', 'message', 'other'],
    ['events', 'severity', 'CRITICAL'],
  ] as const)('%s.%s', (table, column, value) => {
    const rows = stored();
    const first = (rows[table] as unknown as Record<string, unknown>[])[0];
    expect(first, `${table} has a row`).toBeDefined();
    expect(first?.[column]).not.toEqual(value);
    (first as Record<string, unknown>)[column] = value;
    expect(fromRows(rows)).not.toStrictEqual(pickDurable(state));
  });

  it('and the unchanged rows come back equal', () => {
    expect(fromRows(stored())).toStrictEqual(pickDurable(state));
  });
});
