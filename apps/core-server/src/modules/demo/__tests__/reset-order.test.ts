// The server side of a demo reset, step by step (plan row W43; spec §12.4 DC-4 to DC-7; database
// contract §8.5 R-1, R-9; reset routine §11; engine host §10). In-process, no database and no app:
// `createDemoReset` on a host that writes down, in order, what a reset asked of the server.
//
// What is proven here: the ORDER of the caller's steps, and for every way a reset can fail, what
// was stopped, what was brought back, and what the caller is answered. A step that is skipped,
// moved or repeated changes a trace below. The same against PostgreSQL and the real engine:
// `reset.db.test.ts` and `reset-failures.db.test.ts`.
import { describe, expect, it } from 'vitest';
import { ResetError } from '../../../db/reset';
import { ApiFailure } from '../../../plugins/error-envelope';
import { RECOVERY, RESET_ERROR_SOURCE, RESUME_STEPS, RESYNC_STEP, ResetRefusal, ResumeFailure, createDemoReset, roleChanges, type ResetCall, type ResetHost } from '../index';
import { NETWORK_FACTS_NOT_RELOADED_CODE } from '../reset';
import { SEED_ROLES, recordingHost, recordingLogger, resetError, sharedGrants, standInRoutine, type HostMember, type LoggedLine, type RecordingHost } from './support';

const QUIESCE = ['hold', 'drain', 'roles', 'engine.stop', 'pool.close'];
/** The resume after a reset that happened: the engine takes the epoch the routine wrote. */
const RESUME = ['pool.reopen', 'boot.checks', 'rbac.matrix', 'engine.reload'];
/** The resume after a reset that did NOT happen: the engine takes a new epoch (decision D101). */
const RESUME_FAILED = ['pool.reopen', 'boot.checks', 'rbac.matrix', 'engine.resync'];
const FAILED_LINE = 'error demo reset failed after the server was quiesced; the server is brought back on the database the name points at';
const NEW_EPOCH_LINE = 'info no reset was completed; the engine was reloaded under a new epoch, so that every client takes a fresh snapshot';

function callOf(overrides: Partial<ResetCall> = {}): { call: ResetCall; lines: LoggedLine[] } {
  const logger = recordingLogger();
  return {
    call: { operation: 'resetDemo', scenario: 'idle', actorId: 'OPR-002', requestId: 'req-1', log: logger.log, ...overrides },
    lines: logger.lines,
  };
}

/** Runs one reset and returns how it ended: the report, or the failure it was refused with. */
async function run(recording: RecordingHost, overrides: Partial<ResetCall> = {}) {
  const { call, lines } = callOf(overrides);
  const reset = createDemoReset(recording.host);
  const settled = await reset.run(call).then(
    (report) => ({ report, failure: null }),
    (failure: unknown) => ({ report: null, failure }),
  );
  return { ...settled, lines, reset };
}

function expectRefused(failure: unknown, reason: ResetRefusal): void {
  expect(failure).toBeInstanceOf(ApiFailure);
  expect(failure).toMatchObject({ statusCode: 503, code: 'NOT_READY', details: { reason } });
}

describe('a reset that succeeds', () => {
  it('quiesces in the order hold, drain, roles, engine stop, pool close, resumes in the order pool, boot checks, matrix, engine, and releases last', async () => {
    const recording = recordingHost();
    const { report, failure, lines } = await run(recording);

    expect(failure).toBeNull();
    expect(recording.trace).toEqual([
      'routine:R-0',
      'routine:R-1',
      ...QUIESCE,
      `routine:clock ${recording.now}`,
      'routine:R-2..R-8',
      'routine:R-9',
      ...RESUME,
      'release',
      'roles',
      'publish:admin.changed',
    ]);
    expect(report).toMatchObject({ previousEpoch: 4, epoch: 5 });
    // Exactly one hold, released; nothing was written to the error log.
    expect(recording.heldNow()).toBe(0);
    expect(recording.trace.filter((entry) => entry === 'hold')).toHaveLength(1);
    expect(recording.trace.filter((entry) => entry === 'release')).toHaveLength(1);
    expect(recording.persisted).toEqual([]);
    expect(lines.map((line) => `${line.level} ${line.text}`)).toEqual(['info demo reset requested', 'info demo reset done']);
    expect(lines[0]?.fields).toEqual({ operation: 'resetDemo', operatorId: 'OPR-002', scenario: 'idle' });
    expect(lines[1]?.fields).toMatchObject({ operation: 'resetDemo', operatorId: 'OPR-002', previousEpoch: 4, epoch: 5, auditHeadSeq: 83, lineageRows: 1 });
  });

  it('the resume steps are named in the order they run; after a failed reset the last one is the resync', () => {
    expect([...RESUME_STEPS]).toEqual(RESUME);
    expect([...RESUME_STEPS.slice(0, -1), RESYNC_STEP]).toEqual(RESUME_FAILED);
  });

  it('decision D101: a reset that happened raises the epoch by exactly 1: the routine wrote it, the engine is RELOADED and never resynchronised', async () => {
    const recording = recordingHost();
    const { report } = await run(recording);
    expect(recording.trace).toContain('engine.reload');
    expect(recording.trace).not.toContain('engine.resync');
    // 4 before; the routine wrote 5; the engine holds 5: one increment, not two.
    expect(report).toMatchObject({ previousEpoch: 4, epoch: 5 });
    expect(recording.epoch).toBe(5);
  });

  it('hands the routine the instance database, the data directory, the clock, the actor, the reason, the scenario, a quiesce and a log: and nothing else', async () => {
    const recording = recordingHost();
    await run(recording);
    expect(recording.calls).toHaveLength(1);
    const options = recording.calls[0]!;
    // No credential, no test seam, no drain bound, no application name, no observer.
    // Decision D165: plus the evidence-store root - the media root of the server's configuration, NOT a directory below the data directory.
    expect(Object.keys(options).sort()).toEqual(['actorId', 'clock', 'dataDir', 'database', 'evidenceStoreDir', 'log', 'quiesce', 'reason', 'scenario']);
    expect(options).toMatchObject({ database: 'dems_demo', dataDir: '/nonexistent/dems-unit-test-data', evidenceStoreDir: '/nonexistent/dems-unit-test-media', actorId: 'OPR-002', reason: 'RESET', scenario: 'idle' });
    // The clock is the server's, read when the routine asks: after the quiesce.
    recording.now += 1_234;
    expect(options.clock?.()).toBe(recording.now);
  });

  it.each([
    ['resetDemo', 'idle', 'RESET'],
    ['loadScenario', 'recording', 'SCENARIO_LOAD'],
    ['loadScenario', 'fault-demo', 'SCENARIO_LOAD'],
    ['loadScenario', 'idle', 'SCENARIO_LOAD'],
  ] as const)('%s with the scenario %s tells the routine the reason %s', async (operation, scenario, reason) => {
    const recording = recordingHost();
    const { report } = await run(recording, { operation, scenario, actorId: 'OPR-007' });
    expect(recording.calls[0]).toMatchObject({ scenario, reason, actorId: 'OPR-007' });
    expect(report).toMatchObject({ scenario, reason, actorId: 'OPR-007' });
  });

  it('passes the routine\'s own log lines on, by code, at their level', async () => {
    const recording = recordingHost();
    recording.routine = async (options) => {
      options.log?.({ level: 'info', code: 'RESET_CHAIN_DISCARDED', message: 'the chain of dems_demo was discarded', details: { resetNo: '1', rowCount: '84' } });
      options.log?.({ level: 'warn', code: 'RESET_PREVIOUS_LEFT', message: 'the previous database is left', details: { database: 'dems_demo_prev' } });
      return standInRoutine(recording.trace)(options);
    };
    const { lines } = await run(recording);
    expect(lines.slice(1, 3)).toEqual([
      { level: 'info', fields: { code: 'RESET_CHAIN_DISCARDED', resetNo: '1', rowCount: '84' }, text: 'the chain of dems_demo was discarded' },
      { level: 'warn', fields: { code: 'RESET_PREVIOUS_LEFT', database: 'dems_demo_prev' }, text: 'the previous database is left' },
    ]);
  });

  it('answers the epoch the routine wrote, and says so when the engine reloaded with another one', async () => {
    const recording = recordingHost();
    recording.epochAfterReload = 6;
    const { report, lines } = await run(recording);
    // Still the routine's epoch: one increment, the routine's.
    expect(report?.epoch).toBe(5);
    expect(lines.find((line) => line.level === 'error')).toMatchObject({ fields: { code: 'DEMO_EPOCH_MISMATCH', routineEpoch: 5, engineEpoch: 6 } });
    expect(recording.persisted).toMatchObject([{ level: 'error', source: RESET_ERROR_SOURCE, code: 'DEMO_EPOCH_MISMATCH', context: { requestId: 'req-1', routineEpoch: 5, engineEpoch: 6 } }]);
  });
});

describe('what a reset publishes once the server is back', () => {
  it('session.updated for each operator whose role the seed put back, with the permissions of the stored matrix; then admin.changed for the user list', async () => {
    const recording = recordingHost();
    recording.roles = [
      { id: 'OPR-001', role: 'INVESTIGATOR' },
      { id: 'OPR-002', role: 'SUPERVISOR' },
      { id: 'OPR-003', role: 'SUPERVISOR' },
    ];
    recording.rolesAfterReopen = SEED_ROLES;
    await run(recording);
    const technician = sharedGrants()
      .filter((grant) => grant.role === 'TECHNICIAN')
      .map((grant) => grant.permission);
    expect(technician.length).toBeGreaterThan(0);
    expect(recording.publications).toEqual([
      { kind: 'session.updated', operatorId: 'OPR-003', role: 'TECHNICIAN', permissions: technician },
      { kind: 'admin.changed', resource: 'USERS' },
    ]);
    // After the release: the server answers again before its clients are told.
    expect(recording.trace.slice(recording.trace.indexOf('release'))).toEqual(['release', 'roles', 'publish:session.updated', 'publish:admin.changed']);
  });

  it('admin.changed for the pairing code only when the routine closed one', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { report: { cancelledPairingCodes: 1 } });
    await run(recording);
    expect(recording.publications).toEqual([
      { kind: 'admin.changed', resource: 'USERS' },
      { kind: 'admin.changed', resource: 'PAIRING_CODE' },
    ]);
  });

  it('no session.updated when every role is what it was', async () => {
    const recording = recordingHost();
    await run(recording);
    expect(recording.publications).toEqual([{ kind: 'admin.changed', resource: 'USERS' }]);
  });

  it('roleChanges: only an operator both readings hold and whose role differs; an unknown role and an unknown permission are left out', () => {
    const grants = [...sharedGrants(), { role: 'TECHNICIAN', permission: 'NOT_A_PERMISSION' }];
    const before = [
      { id: 'OPR-001', role: 'SUPERVISOR' },
      { id: 'OPR-002', role: 'SUPERVISOR' },
      { id: 'OPR-003', role: 'INVESTIGATOR' },
      { id: 'OPR-009', role: 'TECHNICIAN' },
    ];
    const after = [
      { id: 'OPR-001', role: 'INVESTIGATOR' },
      { id: 'OPR-002', role: 'SUPERVISOR' },
      { id: 'OPR-003', role: 'NOT_A_ROLE' },
      { id: 'OPR-004', role: 'TECHNICIAN' },
    ];
    const changes = roleChanges(before, after, grants);
    expect(changes.map((change) => [change.operatorId, change.role])).toEqual([['OPR-001', 'INVESTIGATOR']]);
    expect(changes[0]?.permissions).toEqual(sharedGrants().filter((grant) => grant.role === 'INVESTIGATOR').map((grant) => grant.permission));
    expect(roleChanges(SEED_ROLES, SEED_ROLES, grants)).toEqual([]);
  });

  it('a failed read of the operators after the resume does not undo the reset: one warning, the answer stands', async () => {
    const recording = recordingHost();
    let reads = 0;
    const read = recording.host.operatorRoles;
    recording.host.operatorRoles = async () => {
      reads += 1;
      if (reads === 2) throw Object.assign(new Error('the read failed'), { code: '57P01' });
      return read();
    };
    const { report, failure, lines } = await run(recording);
    expect(failure).toBeNull();
    expect(report?.epoch).toBe(5);
    expect(lines.filter((line) => line.level === 'warn').map((line) => line.text)).toEqual(['the operators could not be read after a demo reset; no role change was published']);
    expect(recording.persisted).toMatchObject([{ level: 'warn', source: RESET_ERROR_SOURCE, code: '57P01' }]);
    expect(recording.publications).toEqual([{ kind: 'admin.changed', resource: 'USERS' }]);
  });
});

describe('the routine refuses at R-0: nothing was stopped', () => {
  it.each([
    ['RESET_ALREADY_RUNNING', ResetRefusal.IN_PROGRESS],
    ['RESET_OWNER_CREDENTIALS', ResetRefusal.FAILED],
    ['RESET_ROLE_PRIVILEGED', ResetRefusal.FAILED],
    ['RESET_DATABASE_UNREACHABLE', ResetRefusal.FAILED],
    ['RESET_TARGET_REFUSED', ResetRefusal.FAILED],
    ['RESET_OPTIONS_INVALID', ResetRefusal.FAILED],
  ] as const)('%s: no hold, no drain, no stop, no close, no resume; 503 with the reason %s', async (code, reason) => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { refuse: resetError(code, 'R-0') });
    const { failure, lines } = await run(recording);

    expectRefused(failure, reason);
    expect(recording.trace).toEqual(['routine:R-0']);
    expect(recording.heldNow()).toBe(0);
    expect(recording.publications).toEqual([]);
    // Nothing was stopped, so nothing restarts: the epoch is the one it was.
    expect(recording.epoch).toBe(4);
    // One warning and one entry in the error log, by the routine's code: never its text.
    expect(lines.map((line) => `${line.level} ${line.text}`)).toEqual(['info demo reset requested', 'warn demo reset refused by the routine; nothing was stopped']);
    expect(lines[1]?.fields).toMatchObject({ operatorId: 'OPR-002', routineCode: code, routineStep: 'R-0', targetUntouched: true });
    expect(lines[1]?.fields['err']).toBeInstanceOf(ResetError);
    expect(recording.persisted).toMatchObject([
      { level: 'warn', source: RESET_ERROR_SOURCE, code, message: 'demo reset refused by the routine; nothing was stopped', context: { requestId: 'req-1', operatorId: 'OPR-002', routineCode: code, alreadyRunning: code === 'RESET_ALREADY_RUNNING' } },
    ]);
    // The answer names neither the routine's code nor its step.
    expect(JSON.stringify((failure as ApiFailure).details)).not.toContain(code);
  });

  it('anything else the routine throws before the quiesce is answered the same way', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { refuse: Object.assign(new TypeError('boom'), { code: 'ERR_X' }) });
    const { failure } = await run(recording);
    expectRefused(failure, ResetRefusal.FAILED);
    expect(recording.trace).toEqual(['routine:R-0']);
    expect(recording.persisted).toMatchObject([{ level: 'warn', code: 'ERR_X', errorName: 'TypeError', context: { routineCode: 'ERR_X', routineStep: null, targetUntouched: null } }]);
  });
});

describe('the routine fails after the quiesce: the server is brought back, then 503', () => {
  it.each([
    ['RESET_TARGET_IN_USE', 'R-1', true],
    ['RESET_SCHEMA_MISMATCH', 'R-3', true],
    ['RESET_CREATE_FAILED', 'R-4', true],
    ['RESET_BUILD_FAILED', 'R-5', true],
    ['RESET_VERIFY_FAILED', 'R-6', true],
    ['RESET_SWAP_FAILED', 'R-7', true],
    // The connection was lost while the swap committed: the name points at the old or at the new database.
    ['RESET_SWAP_FAILED', 'R-7', false],
  ] as const)('%s at %s (target untouched: %s): the whole resume runs with a RESYNC of the engine (a new epoch), the hold is released after it', async (code, step, untouched) => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { fail: resetError(code, step, untouched) });
    const { failure, lines } = await run(recording);

    expectRefused(failure, ResetRefusal.FAILED);
    // Decision D101: the engine is RESYNCHRONISED, never reloaded with the epoch it had.
    expect(recording.trace).toEqual(['routine:R-0', 'routine:R-1', ...QUIESCE, `routine:clock ${recording.now}`, 'routine:R-2..R-8', ...RESUME_FAILED, 'release', 'roles']);
    expect(recording.trace).not.toContain('engine.reload');
    expect(recording.heldNow()).toBe(0);
    expect(recording.publications).toEqual([]);
    // The epoch moved by 1 although nothing was reset, and one line says so, after the release.
    expect(recording.epoch).toBe(5);
    expect(lines.map((line) => `${line.level} ${line.text}`)).toEqual(['info demo reset requested', FAILED_LINE, NEW_EPOCH_LINE]);
    expect(lines[1]?.fields).toMatchObject({ routineCode: code, routineStep: step, targetUntouched: untouched });
    expect(lines[2]?.fields).toEqual({ code: 'DEMO_RESET_NEW_EPOCH', operation: 'resetDemo', operatorId: 'OPR-002', scenario: 'idle', epochBefore: 4, epoch: 5, routineCode: code, routineStep: step, targetUntouched: untouched });
    expect(recording.persisted).toMatchObject([{ level: 'error', source: RESET_ERROR_SOURCE, code, context: { routineCode: code, routineStep: step, targetUntouched: untouched } }]);
  });

  it('a swap of unknown outcome that DID happen: the operators of the new database are published, the answer is still 503', async () => {
    const recording = recordingHost();
    recording.roles = [{ id: 'OPR-003', role: 'SUPERVISOR' }];
    recording.rolesAfterReopen = [{ id: 'OPR-003', role: 'TECHNICIAN' }];
    recording.routine = standInRoutine(recording.trace, { fail: resetError('RESET_SWAP_FAILED', 'R-7', false) });
    const { failure } = await run(recording);
    expectRefused(failure, ResetRefusal.FAILED);
    expect(recording.publications).toMatchObject([{ kind: 'session.updated', operatorId: 'OPR-003', role: 'TECHNICIAN' }]);
  });

  it('the server\'s facts about a failed statement reach the log by name: SQLSTATE, constraint, table', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, {
      fail: new ResetError('RESET_BUILD_FAILED', 'R-5', 'R-5 failed', { sqlState: '23503', constraint: 'auth_sessions_operator_id_fkey', table: 'auth_sessions' }),
    });
    const { lines } = await run(recording);
    expect(lines[1]?.fields).toMatchObject({ routineCode: 'RESET_BUILD_FAILED', sqlState: '23503', constraint: 'auth_sessions_operator_id_fkey', table: 'auth_sessions' });
  });

  it('an error that is no ResetError after the quiesce: the same resume, the same answer', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { fail: new RangeError('unexpected') });
    const { failure } = await run(recording);
    expectRefused(failure, ResetRefusal.FAILED);
    expect(recording.trace.slice(-6)).toEqual([...RESUME_FAILED, 'release', 'roles']);
    expect(recording.epoch).toBe(5);
    expect(recording.persisted).toMatchObject([{ level: 'error', code: 'RangeError', context: { routineCode: 'RangeError', targetUntouched: null } }]);
  });
});

describe('the quiesce breaks off: exactly what was stopped is brought back', () => {
  it.each([
    ['drain', ['hold', 'drain'], false],
    ['operatorRoles', ['hold', 'drain', 'roles'], false],
    ['stopEngine', ['hold', 'drain', 'roles', 'engine.stop'], true],
    ['closePool', ['hold', 'drain', 'roles', 'engine.stop', 'pool.close'], true],
  ] as const)('at %s: the routine reports RESET_QUIESCE_FAILED; resumed: %s', async (member, reached, resumed) => {
    const recording = recordingHost();
    recording.failing[member] = Object.assign(new Error('the step failed'), { code: 'E_STEP' });
    const { failure, lines } = await run(recording);

    expectRefused(failure, ResetRefusal.FAILED);
    expect(recording.trace).toEqual(['routine:R-0', 'routine:R-1', ...reached, ...(resumed ? [...RESUME_FAILED, 'release', 'roles'] : ['release'])]);
    expect(recording.heldNow()).toBe(0);
    // The epoch moves exactly when the engine was stopped: a quiesce that broke off before that moves nothing.
    expect(recording.epoch).toBe(resumed ? 5 : 4);
    expect(lines.filter((line) => line.fields['code'] === 'DEMO_RESET_NEW_EPOCH')).toHaveLength(resumed ? 1 : 0);
    // The cause of the broken quiesce is logged here: the routine drops what the hook threw.
    expect(lines[1]).toMatchObject({ level: 'error', text: 'the quiesce of a demo reset failed' });
    expect(lines[1]?.fields['err']).toMatchObject({ code: 'E_STEP' });
    expect(lines[2]).toMatchObject({ level: resumed ? 'error' : 'warn', fields: { routineCode: 'RESET_QUIESCE_FAILED', routineStep: 'R-1' } });
    expect(recording.persisted.map((entry) => [entry.level, entry.code])).toEqual([
      ['error', 'E_STEP'],
      [resumed ? 'error' : 'warn', 'RESET_QUIESCE_FAILED'],
    ]);
  });
});

describe('the resume fails: the server does NOT go back to serving, the hold is kept, 503', () => {
  const NOT_RESUMED = 'the server could not resume after a demo reset; it stays not ready and answers 503 to every request but health';

  it.each([
    ['reopenPool', 'pool.reopen', ['pool.reopen']],
    ['bootChecks', 'boot.checks', ['pool.reopen', 'boot.checks']],
    ['reloadMatrix', 'rbac.matrix', ['pool.reopen', 'boot.checks', 'rbac.matrix']],
    ['reloadEngine', 'engine.reload', ['pool.reopen', 'boot.checks', 'rbac.matrix', 'engine.reload']],
  ] as const)('%s fails after a reset that succeeded: step %s is named, nothing after it runs, nothing is released', async (member: HostMember, step, reached) => {
    const recording = recordingHost();
    recording.failing[member] = Object.assign(new Error('the step failed'), { code: 'E_RESUME' });
    const { report, failure, lines } = await run(recording);

    expect(report).toBeNull();
    expectRefused(failure, ResetRefusal.FAILED);
    // No `release`, no read of the operators, no publication: the trace ends at the step that failed.
    expect(recording.trace).toEqual(['routine:R-0', 'routine:R-1', ...QUIESCE, `routine:clock ${recording.now}`, 'routine:R-2..R-8', 'routine:R-9', ...reached]);
    expect(recording.heldNow()).toBe(1);
    expect(recording.publications).toEqual([]);
    const last = lines.at(-1);
    expect(last).toMatchObject({ level: 'error', text: NOT_RESUMED, fields: { step, code: 'E_RESUME', epochBefore: 4, serving: false, recovery: RECOVERY } });
    expect(last?.fields['err']).toMatchObject({ code: 'E_RESUME' });
    expect(recording.persisted).toMatchObject([
      { level: 'fatal', source: RESET_ERROR_SOURCE, message: NOT_RESUMED, code: 'E_RESUME', context: { step, routine: 'done', requestId: 'req-1', serving: false, recovery: RECOVERY } },
    ]);
  });

  it.each(['STORED_MATRIX_MISMATCH', 'STORED_GRANTS_MISMATCH'] as const)(
    'decision D95: the stored matrix of the rebuilt database is refused with %s: the code is a plain field, the hold stays, the engine is not reloaded',
    async (code) => {
      const recording = recordingHost();
      // What `permissionGuard(app).reloadMatrix()` rejects with: an `AccessRuleError` by its code.
      recording.failing.reloadMatrix = Object.assign(new Error(`the access rules are incomplete: ${code} : extra grant: TECHNICIAN DEMO_CONTROL`), { name: 'AccessRuleError', code });
      const { report, failure, lines } = await run(recording);

      expect(report).toBeNull();
      expectRefused(failure, ResetRefusal.FAILED);
      expect(recording.trace.slice(-3)).toEqual(['pool.reopen', 'boot.checks', 'rbac.matrix']);
      expect(recording.trace).not.toContain('engine.reload');
      expect(recording.trace).not.toContain('release');
      expect(recording.heldNow()).toBe(1);
      const last = lines.at(-1);
      expect(last).toMatchObject({ level: 'error', text: NOT_RESUMED });
      // Plain fields: the step, the code, that the server does not serve, and how it recovers.
      expect(last?.fields).toMatchObject({ step: 'rbac.matrix', code, serving: false, recovery: 'restart the server: a start runs the boot checks', operatorId: 'OPR-002' });
      expect(Object.keys(last?.fields ?? {}).sort()).toEqual(['code', 'epochBefore', 'err', 'operation', 'operatorId', 'recovery', 'scenario', 'serving', 'step']);
      expect(recording.persisted).toMatchObject([{ level: 'fatal', code, errorName: 'AccessRuleError', context: { step: 'rbac.matrix', serving: false } }]);
      // The answer says nothing about the matrix.
      expect(JSON.stringify((failure as ApiFailure).details)).toBe('{"reason":"RESET_FAILED"}');
      expect((failure as ApiFailure).message).not.toContain('grant');
    },
  );

  it('a boot check names itself: the step of the log line is the check, not the group', async () => {
    const recording = recordingHost();
    recording.failing.bootChecks = new ResumeFailure('B-5', Object.assign(new Error('not protected'), { name: 'BootCheckError' }));
    const { failure, lines } = await run(recording);
    expectRefused(failure, ResetRefusal.FAILED);
    expect(lines.at(-1)?.fields).toMatchObject({ step: 'B-5', code: 'BootCheckError' });
    expect(recording.persisted).toMatchObject([{ level: 'fatal', errorName: 'BootCheckError', context: { step: 'B-5' } }]);
    expect(recording.trace.slice(-2)).toEqual(['pool.reopen', 'boot.checks']);
    expect(recording.heldNow()).toBe(1);
  });

  it('the resume fails after the routine failed too: both are written down, by their own codes', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { fail: resetError('RESET_BUILD_FAILED', 'R-5') });
    // After a failed routine the engine's last step is the resync: that is the one that fails here.
    recording.failing.resyncEngine = Object.assign(new Error('not started'), { code: 'ENGINE_STATE_UNREADABLE' });
    const { failure, lines } = await run(recording);
    expectRefused(failure, ResetRefusal.FAILED);
    expect(recording.persisted.map((entry) => [entry.level, entry.code])).toEqual([
      ['error', 'RESET_BUILD_FAILED'],
      ['fatal', 'ENGINE_STATE_UNREADABLE'],
    ]);
    expect(recording.persisted[1]?.context).toMatchObject({ step: 'engine.resync', routine: 'RESET_BUILD_FAILED' });
    expect(recording.trace.slice(-4)).toEqual(RESUME_FAILED);
    expect(recording.heldNow()).toBe(1);
    // The engine did not come back: no epoch moved, and no line claims one did.
    expect(recording.epoch).toBe(4);
    expect(lines.filter((line) => line.fields['code'] === 'DEMO_RESET_NEW_EPOCH')).toEqual([]);
  });

  it('the hold of a reset that could not resume outlives the call: the reset guard is free, the hold is not', async () => {
    const recording = recordingHost();
    recording.failing.reloadMatrix = Object.assign(new Error('mismatch'), { name: 'AccessRuleError', code: 'STORED_GRANTS_MISMATCH' });
    const { reset } = await run(recording);
    expect(reset.inFlight).toBe(false);
    expect(recording.heldNow()).toBe(1);
  });
});

describe('one reset at a time in one server', () => {
  it('a second call while the first runs is refused at once: the routine is not asked, nothing of the first is disturbed', async () => {
    const recording = recordingHost();
    let letGo: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      letGo = resolve;
    });
    recording.routine = standInRoutine(recording.trace, { beforeQuiesce: () => paused });
    const reset = createDemoReset(recording.host);
    const first = callOf();
    const second = callOf({ requestId: 'req-2', actorId: 'OPR-009' });

    const running = reset.run(first.call);
    expect(reset.inFlight).toBe(true);
    const refused = await reset.run(second.call).catch((failure: unknown) => failure);
    expectRefused(refused, ResetRefusal.IN_PROGRESS);
    expect(recording.calls).toHaveLength(1);
    expect(recording.trace).toEqual(['routine:R-0']);
    expect(second.lines).toEqual([{ level: 'warn', fields: { code: 'DEMO_RESET_IN_PROGRESS', operation: 'resetDemo', operatorId: 'OPR-009' }, text: 'demo reset refused: another reset of this server is running' }]);

    letGo();
    await expect(running).resolves.toMatchObject({ epoch: 5 });
    expect(reset.inFlight).toBe(false);
    expect(recording.trace.filter((entry) => entry === 'hold')).toHaveLength(1);

    // The guard is free again, also after a reset that failed.
    recording.routine = standInRoutine(recording.trace, { refuse: resetError('RESET_OWNER_CREDENTIALS', 'R-0') });
    await expect(reset.run(callOf().call)).rejects.toMatchObject({ statusCode: 503 });
    expect(reset.inFlight).toBe(false);
    recording.routine = standInRoutine(recording.trace);
    recording.epochAfterReload = 6;
    recording.epoch = 5;
    await expect(reset.run(callOf().call)).resolves.toBeDefined();
    expect(recording.calls).toHaveLength(3);
  });
});

// Integration pass D10, item 4 (pass D6 finding F-D6-1; C3 §3 ops 72 / 75, §4): the reset guard's
// refusal - a REAL sealed package exists - is answered 409 with the code of the contract. The guard
// itself (`src/db/reset/real-evidence.ts`, the routine's R-3) is closed and unchanged: only what
// the route answers for its refusal is decided here.
describe('the reset guard refuses (real sealed evidence): 409 RESET_BLOCKED_REAL_EVIDENCE, not the 503 of a failed reset', () => {
  it('the routine refuses at R-3 with the guard\'s code: 409 with the documented code and no reason of a failed reset; the server is brought back exactly as after any refusal at R-3', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { fail: resetError('RESET_BLOCKED_REAL_EVIDENCE', 'R-3', true) });
    const { report, failure, lines } = await run(recording);

    expect(report).toBeNull();
    expect(failure).toBeInstanceOf(ApiFailure);
    expect(failure).toMatchObject({ statusCode: 409, code: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect((failure as ApiFailure).details).toBeUndefined();
    // What the guard found stays in the log: the answer names no count, no item and no path.
    expect((failure as ApiFailure).message).toBe('The demo reset is blocked because real sealed evidence exists.');
    // Nothing else changed: the same resume as for every refusal after the quiesce, the hold released.
    expect(recording.trace).toEqual(['routine:R-0', 'routine:R-1', ...QUIESCE, `routine:clock ${recording.now}`, 'routine:R-2..R-8', ...RESUME_FAILED, 'release', 'roles']);
    expect(recording.heldNow()).toBe(0);
    expect(lines[1]?.fields).toMatchObject({ routineCode: 'RESET_BLOCKED_REAL_EVIDENCE', routineStep: 'R-3', targetUntouched: true });
  });

  it('the guard\'s refusal before anything was stopped (R-0, the caller-side guard): the same 409, and nothing was stopped', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { refuse: resetError('RESET_BLOCKED_REAL_EVIDENCE', 'R-0', true) });
    const { failure } = await run(recording);
    expect(failure).toMatchObject({ statusCode: 409, code: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect(recording.trace).not.toContain('engine.stop');
  });

  // Integration pass D11 (pass D10's finding, a contract defect): the module asks the caller-side
  // guard BEFORE the routine, so before the quiesce. A refused reset changes nothing.
  it('PASS D11 - the caller-side guard refuses FIRST: the routine is never called, nothing is held or stopped, the epoch is the same, one audited refusal names the operation and the reason, 409', async () => {
    const recording = recordingHost();
    recording.realSessions = ['SES-20261001-0001'];
    const epochBefore = recording.epoch;
    const { report, failure, lines } = await run(recording);

    expect(report).toBeNull();
    expect(failure).toMatchObject({ statusCode: 409, code: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect((failure as ApiFailure).details).toBeUndefined();
    // The guard was asked before anything else, then the one audit row; the routine and the quiesce never ran.
    expect(recording.guardAskedAt).toEqual([0]);
    expect(recording.trace).toEqual(['guard', 'audit.refusal']);
    expect(recording.calls).toEqual([]);
    expect(recording.heldNow()).toBe(0);
    expect(recording.epoch).toBe(epochBefore);
    expect(recording.publications).toEqual([]);
    expect(recording.refusals).toEqual([{ operation: 'resetDemo', actorId: 'OPR-002', reason: 'RESET_BLOCKED_REAL_EVIDENCE' }]);
    // What the guard found is in the log and in the error log (counts only), never in the answer.
    const said = lines.find((line) => line.fields['code'] === 'RESET_BLOCKED_REAL_EVIDENCE');
    expect(said?.level).toBe('warn');
    expect(said?.fields).toMatchObject({ realRows: 1, realPackages: 0, quiesced: false, epochBefore });
    expect(recording.persisted.map((entry) => [entry.level, entry.code])).toEqual([['warn', 'RESET_BLOCKED_REAL_EVIDENCE']]);
  });

  it('PASS D11 - CONTROL: a guard that finds nothing lets the reset on exactly as before (asked first, no audit row of a refusal, the epoch moves by 1)', async () => {
    const recording = recordingHost();
    const epochBefore = recording.epoch;
    const { report, failure } = await run(recording);
    expect(failure).toBeNull();
    expect(report).not.toBeNull();
    expect(recording.guardAskedAt).toEqual([0]);
    expect(recording.refusals).toEqual([]);
    expect(recording.trace).not.toContain('guard');
    expect(recording.trace.slice(0, 2)).toEqual(['routine:R-0', 'routine:R-1']);
    expect(recording.trace).toContain('engine.stop');
    expect(recording.epoch).toBe(epochBefore + 1);
  });

  it('PASS D11 - a guard that could not be asked refuses with the 503 of a reset that did not happen: nothing stopped, the routine not called, the failure in the error log; an audit row that cannot be written leaves the 409 standing', async () => {
    const unasked = recordingHost();
    unasked.failing.realEvidence = new Error('the pool is gone');
    const first = await run(unasked);
    expect(first.failure).toMatchObject({ statusCode: 503, code: 'NOT_READY', details: { reason: ResetRefusal.FAILED } });
    expect(unasked.trace).toEqual(['guard']);
    expect(unasked.calls).toEqual([]);
    expect(unasked.persisted.map((entry) => [entry.level, entry.code])).toEqual([['error', 'DEMO_RESET_GUARD_NOT_ASKED']]);

    const unaudited = recordingHost();
    unaudited.realSessions = ['SES-20261001-0001'];
    unaudited.failing.auditRefusal = new Error('the unit did not commit');
    const second = await run(unaudited);
    expect(second.failure).toMatchObject({ statusCode: 409, code: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect(unaudited.calls).toEqual([]);
    expect(unaudited.persisted.map((entry) => [entry.level, entry.code])).toEqual([['warn', 'RESET_BLOCKED_REAL_EVIDENCE'], ['error', 'DEMO_RESET_REFUSAL_NOT_AUDITED']]);
  });

  it('CONTROL: another refusal of the routine at the same step is still 503 NOT_READY with RESET_FAILED', async () => {
    const recording = recordingHost();
    recording.routine = standInRoutine(recording.trace, { fail: resetError('RESET_SCHEMA_MISMATCH', 'R-3', true) });
    const { failure } = await run(recording);
    expectRefused(failure, ResetRefusal.FAILED);
  });
});

// Integration pass I-9c (review 120b S2-01 case (c), request line `row NF`): the camera network reader is read again
// after the engine is back and before the hold is released. Mutation seen RED: the call moved after `release` (the
// first case), and the call removed (the first two cases).
describe('I-9c: the camera network settings are read again after a reset, before any request is served', () => {
  /** Gives the recording host the optional door; `behaviour` runs inside it. */
  function withNetworkReload(recording: RecordingHost, behaviour?: () => Promise<void>): void {
    (recording.host as ResetHost).reloadNetworkFacts = async () => {
      recording.trace.push('network.reload');
      await behaviour?.();
    };
  }

  it('a reset that happened: pool, boot checks, matrix, engine reload, THEN the network settings, then the release', async () => {
    const recording = recordingHost();
    withNetworkReload(recording);
    const { failure } = await run(recording);
    expect(failure).toBeNull();
    expect(recording.trace.slice(recording.trace.indexOf('routine:R-9') + 1)).toEqual([...RESUME, 'network.reload', 'release', 'roles', 'publish:admin.changed']);
    expect(recording.persisted).toEqual([]);
  });

  it('a reset that failed after the quiesce: the resync, then the network settings (the database behind the name is read either way)', async () => {
    const recording = recordingHost();
    withNetworkReload(recording);
    recording.routine = standInRoutine(recording.trace, { fail: resetError('RESET_BUILD_FAILED', 'R-5') });
    const { failure } = await run(recording);
    expectRefused(failure, ResetRefusal.FAILED);
    expect(recording.trace.slice(-7)).toEqual([...RESUME_FAILED, 'network.reload', 'release', 'roles']);
  });

  it('a reset refused before anything was stopped asks nothing of the network settings', async () => {
    const recording = recordingHost();
    withNetworkReload(recording);
    recording.routine = standInRoutine(recording.trace, { refuse: resetError('RESET_OWNER_CREDENTIALS', 'R-0') });
    await run(recording);
    expect(recording.trace).not.toContain('network.reload');
  });

  it('a door that throws (the real one never does) is stated once as a warning and does not fail a reset whose server is whole', async () => {
    const recording = recordingHost();
    withNetworkReload(recording, () => Promise.reject(Object.assign(new Error('read failed'), { code: 'X_TEST' })));
    const { report, failure, lines } = await run(recording);
    expect(failure).toBeNull();
    expect(report).toMatchObject({ epoch: 5 });
    expect(recording.heldNow()).toBe(0);
    expect(lines.filter((line) => line.level === 'warn').map((line) => line.fields['code'])).toEqual([NETWORK_FACTS_NOT_RELOADED_CODE]);
    expect(recording.persisted).toMatchObject([{ level: 'warn', source: RESET_ERROR_SOURCE, code: NETWORK_FACTS_NOT_RELOADED_CODE, context: { requestId: 'req-1' } }]);
  });

  it('CONTROL: a host without the door resumes exactly as before (the server host until the composition hands it in)', async () => {
    const recording = recordingHost();
    expect((recording.host as ResetHost).reloadNetworkFacts).toBeUndefined();
    await run(recording);
    expect(recording.trace).not.toContain('network.reload');
  });
});
