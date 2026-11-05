// Task 4 rows 211 and 215 (package X2-3), on throw-away clones of the seed, as the runtime role.
//
// ROW 211 (this first block): the count check 4c computes, and its exported per-row predicate, on a
// seeded database - the function the command of row 215 counts with (R-X2-11).
//
// SX-19: every password of this file is made from randomness in the run; none is a literal here, in
// a fixture, a log or a record. The published demo password is used by import only.
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import type { AuditChainStatus } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { Pool, QueryResultRow } from 'pg';
import { afterAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { AUDIT_MESSAGE, SET_WORD, SetPasswordExit, runSetPasswordCommand, type SetPasswordPorts } from '../../cli/operator-set-password-command';
import { PROVISION_WORD, runProductionKeyCommand, type EntryFacts } from '../../cli/production-key-command';
import { connect } from '../db/support';
import { useFurtherDatabase, useTestDatabase } from '../helpers/db';
import { CAPTURE_BOOT_STEP, CaptureBootRefusal, SELECT_STORED_HASH_SETS, captureBootControl, demoPasswordHashSetsAmong, storedDemoPasswordOperators, storedHashSetIsDemoPassword, type StoredHashSetRow } from '../../src/capture/boot';
import { realBootFixture } from '../../src/capture/boot/__tests__/support';
import { CONNECTION_FILE_KEYS, CONNECTION_FILE_NAME } from '../../src/config';
import { createSystemClock } from '../../src/core/clock';
import { hashPassword } from '../../src/modules/identity/password-hash';
import { createRuntimePool } from '../../src/plugins/db';
import type { ErrorLogEntry } from '../../src/plugins/logger';
import { BootError } from '../../src/plugins/readiness';
import { provideTestCaptureHost, testHostPrograms } from '../support/capture-host';
import { FIXED_NOW, engineApp, type EngineApp } from '../support/engine';
import { openHostCommandUnit } from '../support/host-command-unit';
import { cookieValue, get, insertPairedDevice, occurrences, webSignIn, type Headers } from '../support/identity';

/** Operation 60, `verifyAuditChain`. */
const AUDIT_CHAIN = '/api/v1/audit/chain';

const db = useTestDatabase({ template: 'seed' });

describe('row 211: the exported predicate gives the count of check 4c on a seeded database (R-X2-11)', () => {
  it('every seeded operator is counted, one by one and together, and the boot check`s own reader answers the same number', async () => {
    const pool = createRuntimePool(db.runtime);
    // Ended when this test ends, not when the file ends: the command of row 215 below refuses a database with another session.
    onTestFinished(() => pool.end());
    const rows = (await pool.query<StoredHashSetRow>(SELECT_STORED_HASH_SETS)).rows;
    expect(rows).toHaveLength(OPERATORS.length);
    for (const row of rows) expect(await storedHashSetIsDemoPassword(row)).toBe(true);
    expect(await demoPasswordHashSetsAmong(rows)).toBe(OPERATORS.length);
    // The reader check 4c is wired to, on the same pool: the same statement, the same count.
    const app = { db: { read: async (_label: string, work: (given: typeof pool) => Promise<unknown>) => work(pool) } } as unknown as Pick<FastifyInstance, 'db'>;
    expect(await storedDemoPasswordOperators(app)).toBe(OPERATORS.length);
    // A verifier that answers no for every set: nothing is counted (the predicate is the verifier's answer, nothing else).
    expect(await demoPasswordHashSetsAmong(rows, async () => false)).toBe(0);
    // A set that cannot be verified rejects in the predicate and is "could not be read" in the check's reader (fail closed).
    const broken = async (): Promise<boolean> => {
      throw new Error('a derivation failed');
    };
    await expect(storedHashSetIsDemoPassword(rows[0] as StoredHashSetRow, broken)).rejects.toThrow();
    expect(await storedDemoPasswordOperators(app, broken)).toBeNull();
  });
});

// ── ROW 215: the command's FUNCTION on the clone ────────────────────────────────────────────────
//
// The terminal entry is not driven. The prompt is an injected port; EVERYTHING ELSE IS REAL: the
// command opens and parses `<data dir>/pg.env` itself with the server's reader (the data directory
// is the one the database helper of this suite was given; this file never opens that file), builds
// the runtime role's pool with `createRuntimePool`, hashes with `hashPassword`, and runs the Core's
// pipeline, unit of work and audit writer against PostgreSQL as `dems_app`.
//
//   1  a Core runs, the Supervisor signs in with the seeded credential, the Core stops;
//   2  refusals for real: a connection that stands in for a running Core, before the first prompt
//      and again inside the unit;
//   3  the walk, with a host clock one hour BEHIND the stored state (the clock floor);
//   4  a Core boots on that database: its own chain verification passes, the old session is dead,
//      the seeded credential opens nothing, each value of the run signs in.

const HOUR = 3_600_000;

function operatorOf(role: OperatorRole) {
  const found = OPERATORS.find((candidate) => candidate.role === role);
  if (found === undefined) throw new Error(`no seeded operator has the role ${role}`);
  return found;
}

interface Core {
  readonly app: EngineApp['app'];
  stop(): Promise<void>;
}
/** The real app on the clone, booted: B-1 to B-9 and the engine's reload. `stop` closes it, also after a failed boot. */
async function boot(): Promise<Core> {
  const closers: Array<() => Promise<unknown> | unknown> = [];
  const stop = async (): Promise<void> => {
    for (const close of closers.splice(0)) await close();
  };
  db.onCleanup(stop);
  try {
    const built = await engineApp({ runtime: db.runtime, onCleanup: (close) => void closers.push(close) }, db.run.dataDir, { logLevel: 'info' });
    await built.app.readiness.boot();
    await built.engine.idle();
    await built.app.pipeline.drain();
    return { app: built.app, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

/** One statement on a pool that is opened and ended around it: nothing of this file stays connected. */
async function once<Row extends QueryResultRow>(text: string, values: unknown[] = []): Promise<Row[]> {
  const pool = createRuntimePool(db.runtime);
  try {
    return (await pool.query<Row>(text, values)).rows;
  } finally {
    await pool.end();
  }
}

interface Driven {
  readonly ports: SetPasswordPorts;
  readonly out: string[];
  readonly errorEntries: ErrorLogEntry[];
  readonly labels: string[];
  readonly buffers: Buffer[];
}
function driven(typed: Array<string | (() => Promise<string>)>, clockSource: () => number): Driven {
  const out: string[] = [];
  const errorEntries: ErrorLogEntry[] = [];
  const labels: string[] = [];
  const buffers: Buffer[] = [];
  const queue = [...typed];
  const ports: SetPasswordPorts = {
    clock: createSystemClock(clockSource),
    uid: () => (typeof process.getuid === 'function' ? process.getuid() : -1),
    out: (line) => void out.push(line),
    isTerminal: () => true,
    environmentNames: () => ['PATH', 'HOME'],
    ask: async () => SET_WORD,
    prompt: {
      async readSecretLine(label) {
        labels.push(label);
        const next = queue.shift();
        if (next === undefined) return { kind: 'ABORTED', cause: 'INPUT_ENDED' };
        const secret = Buffer.from(typeof next === 'string' ? next : await next(), 'utf8');
        buffers.push(secret);
        return { kind: 'LINE', secret };
      },
    },
    hasher: hashPassword,
    openPool: createRuntimePool,
    errorLog: { file: null, append: (entry) => void errorEntries.push(entry) },
  };
  return { ports, out, errorEntries, labels, buffers };
}

describe('row 215: operator:set-password on a seeded database, as the runtime role, with the Core stopped', () => {
  const supervisor = operatorOf('SUPERVISOR');
  /** Made here, used here, stored nowhere but as hashes on a database that is dropped. One per operator. */
  const values = new Map(OPERATORS.map((operator) => [operator.username, randomBytes(24).toString('base64url')]));
  const valueOf = (username: string): string => values.get(username) as string;
  let staleSession: Headers;
  const args = (...rest: string[]): string[] => ['--database', db.name, '--data-dir', db.run.dataDir, ...rest];
  const typedFor = (usernames: readonly string[]): string[] => usernames.flatMap((username) => [valueOf(username), valueOf(username)]);
  /** The order of the walk: the Supervisor first, then by username. */
  const walkOrder = [supervisor.username, ...OPERATORS.filter((operator) => operator.role !== 'SUPERVISOR').map((operator) => operator.username).sort()];

  it('step 1: a Core runs on the database, the Supervisor signs in with the seeded credential, the Core stops', async () => {
    const core = await boot();
    try {
      const response = await webSignIn(core.app, supervisor.username);
      const token = response.statusCode === 200 ? cookieValue(response, core.app.config.sessionCookieName) : null;
      if (token === null) throw new Error(`the web sign-in answered ${response.statusCode}`);
      staleSession = { cookie: `${core.app.config.sessionCookieName}=${token}` };
      expect((await get(core.app, AUDIT_CHAIN, staleSession)).json<AuditChainStatus>().stored.ok).toBe(true);
    } finally {
      await core.stop();
    }
  });

  it('step 2: a connection that stands in for a running Core is refused before the first prompt, and again inside the unit (rolled back, nothing stored)', async () => {
    const head = (await once<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_head'))[0];
    // (a) Connected before the command starts: refused before anybody is prompted.
    const running = await connect(db.runtime, 'dems-core-server');
    try {
      const early = driven(typedFor(walkOrder), () => FIXED_NOW - HOUR);
      const run = await runSetPasswordCommand(args('--all-demo'), early.ports);
      expect(run.code).toBe(SetPasswordExit.REFUSED);
      expect(run.lines.join('\n')).toMatch(/REFUSED \(DATABASE_IN_USE\).*dems_app: 1.*sees connections, not a process/);
      expect(early.labels).toEqual([]);
    } finally {
      await running.end();
    }
    // (b) A Core that starts while the person types: the connection appears after the first check.
    let late: Awaited<ReturnType<typeof connect>> | null = null;
    const typing = driven(
      [
        async () => {
          late = await connect(db.runtime, 'dems-core-server');
          return valueOf(supervisor.username);
        },
        valueOf(supervisor.username),
      ],
      () => FIXED_NOW - HOUR,
    );
    try {
      const run = await runSetPasswordCommand(args('--username', supervisor.username), typing.ports);
      expect(run.code).toBe(SetPasswordExit.REFUSED);
      expect(run.set).toEqual([]);
      expect(run.lines.join('\n')).toMatch(/REFUSED \(DATABASE_IN_USE\) .*NOT set, its unit was rolled back/);
      expect(typing.errorEntries.at(-1)).toMatchObject({ source: 'cli.operatorSetPassword', code: 'DATABASE_IN_USE', context: { targetOperatorId: supervisor.id } });
    } finally {
      await (late as { end(): Promise<void> } | null)?.end();
    }
    // Nothing was stored by either: the chain head did not move and all three still have the demo password.
    expect((await once<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_head'))[0]).toEqual(head);
    expect(await demoPasswordHashSetsAmong(await once<StoredHashSetRow>(SELECT_STORED_HASH_SETS))).toBe(OPERATORS.length);
  });

  it('step 3: the walk sets three passwords in three units, with a host clock one hour behind the stored state; the final line is the count of check 4c; the Core`s own chain check passes', async () => {
    const before = await once<{ seq: string }>('SELECT seq FROM public.audit_chain_head');
    const headBefore = Number(before[0]?.seq);
    const walk = driven(typedFor(walkOrder), () => FIXED_NOW - HOUR);
    const run = await runSetPasswordCommand(args('--all-demo'), walk.ports);
    expect(run.lines.filter((line) => line.includes('REFUSED'))).toEqual([]);
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(run.set).toEqual(walkOrder);
    expect(walk.errorEntries).toEqual([]);
    // What it showed before the first prompt, and what it said after each commit.
    expect(run.lines.join('\n')).toContain(`database:        ${db.name} on 127.0.0.1:${db.runtime.port}, as the role dems_app`);
    expect(run.lines.join('\n')).toContain(`data directory:  ${db.run.dataDir}`);
    expect(run.lines).toContain(`${supervisor.username}: password set, 1 session(s) ended`);
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 0');
    expect(run.demoPasswordOperators).toBe(0);
    for (const buffer of walk.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);

    // THE COUNT OF CHECK 4c, by the boot check's own reader on a pool of the runtime role: the same number.
    const pool = createRuntimePool(db.runtime);
    let ended = false;
    onTestFinished(async () => {
      if (!ended) await pool.end();
    });
    const app = { db: { read: async (_label: string, work: (given: typeof pool) => Promise<unknown>) => work(pool) } } as unknown as Pick<FastifyInstance, 'db'>;
    expect(await storedDemoPasswordOperators(app)).toBe(0);

    // The credentials: one row each, the product's hash form, stamped at or after the stored state (the floor).
    const stored = (await pool.query<{ operator_id: string; algorithm: string; hashed_at: string }>('SELECT operator_id, algorithm, hashed_at FROM public.operator_credentials ORDER BY operator_id')).rows;
    expect(stored).toHaveLength(OPERATORS.length);
    for (const row of stored) expect(Number(row.hashed_at)).toBeGreaterThan(FIXED_NOW - HOUR);
    expect((await pool.query('SELECT 1 FROM public.operators')).rowCount).toBe(OPERATORS.length);

    // The session of step 1: ended by the command, with its own reason. No other reason was written.
    const sessions = (await pool.query<{ operator_id: string; end_reason: string | null }>('SELECT operator_id, end_reason FROM public.auth_sessions')).rows;
    expect(sessions.filter((row) => row.operator_id === supervisor.id).map((row) => row.end_reason)).toEqual(['CREDENTIAL_REPLACED']);

    // The audit rows: exactly one per operator, by the Core's writer, in the walk's order.
    const audit = (
      await pool.query<{ seq: string; type: string; category: string; severity: string; actor_id: string | null; message: string; details: Record<string, unknown> }>(
        'SELECT seq, type, category, severity, actor_id, message, details FROM public.audit_log WHERE seq > $1 ORDER BY seq',
        [headBefore],
      )
    ).rows;
    const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
    expect(audit.map((row) => ({ ...row, seq: Number(row.seq) }))).toEqual(
      walkOrder.map((username, index) => {
        const operator = OPERATORS.find((candidate) => candidate.username === username) as (typeof OPERATORS)[number];
        return {
          seq: headBefore + index + 1,
          type: 'OPERATOR_PASSWORD_SET',
          category: 'SECURITY',
          severity: 'WARNING',
          actor_id: null,
          message: AUDIT_MESSAGE,
          details: { targetOperatorId: operator.id, method: 'HOST_COMMAND', sessionsEnded: operator.id === supervisor.id ? 1 : 0, earlierWasDemo: true, ...(uid >= 0 ? { invokerUid: uid } : {}) },
        };
      }),
    );
    await pool.end();
    ended = true;

    // THE CORE'S OWN VERIFICATION of the stored chain, a full pass (SX-02).
    const host = openHostCommandUnit(db.runtime);
    onTestFinished(() => host.close());
    expect(await host.verifyStoredChain()).toMatchObject({ ok: true, checked: headBefore + OPERATORS.length, firstBadSeq: null });
    await host.close();

    // R-X2-4: no typed value, in any form, in what the command said, logged or put into the audit rows.
    const written = JSON.stringify([run.lines, walk.errorEntries, audit]);
    for (const value of values.values()) expect(written.includes(value)).toBe(false);
  });

  it('step 4: a Core boots on that database; its chain verification passes; the old session is dead; the seeded credential opens nothing; each value of the run signs in', async () => {
    const core = await boot();
    try {
      expect((await get(core.app, AUDIT_CHAIN, staleSession)).statusCode).toBe(401);
      for (const operator of OPERATORS) {
        expect((await webSignIn(core.app, operator.username)).statusCode).toBe(401);
      }
      let session: Headers | null = null;
      for (const operator of OPERATORS) {
        const response = await webSignIn(core.app, operator.username, valueOf(operator.username));
        expect(response.statusCode).toBe(200);
        if (operator.id === supervisor.id) session = { cookie: `${core.app.config.sessionCookieName}=${cookieValue(response, core.app.config.sessionCookieName)}` };
      }
      const status = (await get(core.app, AUDIT_CHAIN, session as Headers)).json<AuditChainStatus>();
      expect(status.view.ok).toBe(true);
      expect(status.stored.ok).toBe(true);
      expect(status.stored.firstBadSeq).toBeNull();
    } finally {
      await core.stop();
    }
  });

  it('step 5: nobody has the demo password any more: the walk asks nothing, says 0 and ends with exit 0; a named operator can still be set (recovery)', async () => {
    const idle = driven([], () => FIXED_NOW - HOUR);
    const walk = await runSetPasswordCommand(args('--all-demo'), idle.ports);
    expect(walk.code).toBe(SetPasswordExit.DONE);
    expect(walk.lines.at(-1)).toBe('operators that still have the demo password: 0');
    expect(idle.labels).toEqual([]);
    const technician = operatorOf('TECHNICIAN');
    const again = randomBytes(24).toString('base64url');
    const recovery = driven([again, again], () => FIXED_NOW - HOUR);
    const run = await runSetPasswordCommand(args('--username', technician.username), recovery.ports);
    expect(run.code).toBe(SetPasswordExit.DONE);
    // The session the technician opened in step 4 (left open when that Core stopped) is ended by the recovery.
    expect(run.lines.slice(-2)).toEqual([`${technician.username}: password set, 1 session(s) ended`, 'operators that still have the demo password: 0']);
    const row = (await once<{ details: Record<string, unknown> }>('SELECT details FROM public.audit_log ORDER BY seq DESC LIMIT 1'))[0];
    expect(row?.details).toMatchObject({ targetOperatorId: technician.id, earlierWasDemo: false });
    expect(JSON.stringify([run.lines, recovery.errorEntries, row]).includes(again)).toBe(false);
  });

  // Row 215b (decision C66 (4)). The data directory is a TEMPORARY one with a connection file written here: the port
  // of this clone's server, the runtime role, and a value made in this run. The command is given that directory and
  // no other, reads THAT file, and every statement it sends reaches the throw-away database through what the file said.
  // THE ONE DOUBLE, stated: a made-up value cannot authenticate at PostgreSQL, so the pool port first proves that the
  // connection it was handed is the file's (port, role, the run's value), then opens the pool with the helper's
  // in-memory credential in its place. No credential file is opened by this test, and none is copied.
  it('step 6 (row 215b): with a temporary data directory, the command reads THAT directory`s connection file, shows its full path before the word, and works on the database through it; with the file absent it refuses before anything', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'dems-row215b-')));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const dataDir = join(root, 'data');
    const emptyDir = join(root, 'empty');
    for (const directory of [dataDir, emptyDir]) mkdirSync(directory, { mode: 0o700 });
    const made = randomBytes(24).toString('base64url');
    const file = join(dataDir, CONNECTION_FILE_NAME);
    const text = [`${CONNECTION_FILE_KEYS.host}=127.0.0.1`, `${CONNECTION_FILE_KEYS.port}=${db.runtime.port}`, `${CONNECTION_FILE_KEYS.database}=dems_named_on_the_command_line_instead`, `${CONNECTION_FILE_KEYS.user}=dems_app`, `${CONNECTION_FILE_KEYS.password}=${made}`];
    writeFileSync(file, `${text.join('\n')}\n`, { mode: 0o600 });
    expect(dataDir).not.toBe(db.run.dataDir);

    const handed: Array<{ port: number; user: string; database: string; fromTheFile: boolean }> = [];
    const through = driven([], () => FIXED_NOW - HOUR);
    const asks: string[] = [];
    const ports: SetPasswordPorts = {
      ...through.ports,
      ask: async (prompt) => (asks.push(prompt), 'no'),
      openPool: (connection) => {
        handed.push({ port: connection.port, user: connection.user, database: connection.database, fromTheFile: connection.password.reveal() === made });
        return createRuntimePool({ ...connection, password: db.runtime.password });
      },
    };
    const technician = operatorOf('TECHNICIAN');
    const run = await runSetPasswordCommand(['--database', db.name, '--data-dir', dataDir, '--username', technician.username], ports);
    expect(handed).toEqual([{ port: db.runtime.port, user: 'dems_app', database: db.name, fromTheFile: true }]);
    // The database answered through that connection: the operator was found, the summary names what was really used.
    const said = run.lines.join('\n');
    expect(said).toContain(`database:        ${db.name} on 127.0.0.1:${db.runtime.port}, as the role dems_app`);
    expect(said).toContain(`data directory:  ${dataDir}`);
    expect(said).toContain(`connection file: ${file} `);
    expect(said).toContain(`    - ${technician.username} (TECHNICIAN)`);
    expect(said).not.toContain(db.run.dataDir);
    expect(said.includes(made)).toBe(false);
    expect(asks).toHaveLength(1);
    expect(run.lines.at(-1)).toMatch(/REFUSED \(NOT_CONFIRMED\)/);
    expect(run.set).toEqual([]);
    expect(through.labels).toEqual([]);

    // The file absent: one named refusal with the full path; no pool, no question, no prompt.
    const absent = driven([], () => FIXED_NOW - HOUR);
    let opened = 0;
    const none = await runSetPasswordCommand(['--database', db.name, '--data-dir', emptyDir, '--username', technician.username], {
      ...absent.ports,
      ask: async (prompt) => (asks.push(prompt), 'no'),
      openPool: (connection) => ((opened += 1), createRuntimePool(connection)),
    });
    expect(none.code).toBe(SetPasswordExit.REFUSED);
    expect(none.lines).toEqual([`operator:set-password: REFUSED (CONNECTION_FILE) ${join(emptyDir, CONNECTION_FILE_NAME)} could not be used (CONNECTION_FILE_MISSING). Nothing was read.`]);
    expect([opened, asks.length, absent.labels.length]).toEqual([0, 1, 0]);
  });
});

// ── ROW 216: THE DATABASE ACCEPTANCE of the command (package X2-3, M11) ─────────────────────────
//
// ONE scripted session, in order, on a throw-away database OF ITS OWN (a further clone of the seed,
// dropped when the block ends, pass or fail). The terminal entry is not driven: the command's
// FUNCTION is called with an injected prompt port that returns values made from randomness in this
// run (SX-19). What the blocks above do not hold, and this one does:
//
//   - CHECK 4c THROUGH THE REAL BOOT FUNCTION, BOTH WAYS: a whole `REAL_PRODUCTION` start of the real
//     app factory (the capture unit's own mount, no seam) is refused at 4c with the number of seeded
//     operators BEFORE the walk and passes the whole step AFTER it;
//   - the sessions AND the biometric tokens of an operator end IN THE TRANSACTION that stores the
//     credential and writes the audit row (one transaction id on the four rows);
//   - the policy refusals on a real database (too short, the published demo password, the username);
//   - A FAILURE AT OPERATOR 2 OF 3 leaves operator 1 committed and operator 3 not asked, and the
//     command says exactly that; the next walk lists two operators, so each stored credential is
//     changed exactly once;
//   - a sweep of standard output, standard error, the command's lines, the error log, the audit
//     rows, the logs of every Core, the process arguments and the environment for each typed value
//     and for the salt and the tag of each stored set: count 0.
//
// DOUBLES, and nothing else: (1) the prompt; (2) the host facts of steps 4d and 4e and the two
// stand-in delivered programs (`provideTestCaptureHost`, `testHostPrograms`: decision C46, C55 DD-3);
// (3) the worker program, row 61's stand-in that says one HELLO; (4) for the key command's directory
// rule only, the directories ABOVE the test's own root (row 206's double). The signing key that lets
// a start reach check 4c is made by the production key command's function in a fresh directory of
// the temporary folder, which this block removes; no key is put anywhere else and no key file is
// read here. Fixture rows written as the owner role, stated where they are written: the speech
// configuration off and an empty selector (a seeded database does not start in production without
// them - that is the fence's and the speech host's matter, not the command's), one paired device
// and one biometric token of the Supervisor.

describe('row 216: database acceptance of operator:set-password, one scripted session on a throw-away database of its own', () => {
  const programs = realBootFixture('row216');
  /** Task 4 row 228b: the installation this session's production key and production Core name - a synthetic id of this suite. */
  const ROW216_INSTALLATION = 'DEMS-TEST-216';
  const roots: string[] = [];
  const spies: Array<{ mockRestore(): void }> = [];
  let accName: string | null = null;
  // Registered BEFORE the database of this block: after-hooks run in reverse order, so this one runs AFTER its drop.
  afterAll(async () => {
    for (const spy of spies) spy.mockRestore();
    programs.remove();
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    for (const gone of [...roots, programs.dataDir]) expect(() => lstatSync(gone), gone).toThrow();
    // The database of the session is gone from the catalog (asked on the file's own database).
    expect(accName).not.toBeNull();
    expect((await db.ownerPool().query('SELECT 1 FROM pg_database WHERE datname = $1', [accName])).rowCount).toBe(0);
  });
  const acc = useFurtherDatabase(db, { template: 'seed', slug: 'r216_acceptance' });

  const supervisor = operatorOf('SUPERVISOR');
  const others = OPERATORS.filter((operator) => operator.role !== 'SUPERVISOR').sort((a, b) => (a.username < b.username ? -1 : 1));
  const second = others[0] as (typeof OPERATORS)[number];
  const third = others[1] as (typeof OPERATORS)[number];
  const walkOrder = [supervisor.username, second.username, third.username];
  /** Made here, used here, stored nowhere but as hashes on a database that is dropped. */
  const values = new Map(OPERATORS.map((operator) => [operator.username, randomBytes(24).toString('base64url')]));
  const valueOf = (username: string): string => values.get(username) as string;
  /** Values the policy must refuse, made in the run as well: eight characters; the username with a random tail. */
  const tooShort = randomBytes(6).toString('base64url');
  const holdsUsername = `${supervisor.username}-${randomBytes(12).toString('base64url')}`;
  const args = (...rest: string[]): string[] => ['--database', acc.name, '--data-dir', acc.run.dataDir, ...rest];
  const BOOT_AT = FIXED_NOW + 60_000;
  const UID = typeof process.getuid === 'function' ? process.getuid() : -1;

  // What the session collects for the sweep of step 8.
  const said: string[] = [];
  const errorEntries: ErrorLogEntry[] = [];
  const coreLogs: string[] = [];
  const staleSessions = new Map<string, Headers>();
  let keyDataDir = '';

  async function asApp<Row extends QueryResultRow>(text: string, bound: unknown[] = []): Promise<Row[]> {
    const pool = createRuntimePool(acc.runtime);
    try {
      return (await pool.query<Row>(text, bound)).rows;
    } finally {
      await pool.end();
    }
  }
  /** Fixture statements as the owner role, on a pool that is ended at once: the command refuses a database with another session. */
  async function asOwner(work: (owner: Pool) => Promise<void>): Promise<void> {
    const owner = acc.run.poolOn(acc.name, 'owner');
    try {
      await work(owner);
    } finally {
      await acc.run.endPool(owner);
    }
  }
  /** THE COUNT OF CHECK 4c, by the boot check's own reader, on a pool of the runtime role. */
  async function countOfCheck4c(): Promise<number | null> {
    const pool = createRuntimePool(acc.runtime);
    try {
      return await storedDemoPasswordOperators({ db: { read: async (_label: string, work: (given: typeof pool) => Promise<unknown>) => work(pool) } } as unknown as Pick<FastifyInstance, 'db'>);
    } finally {
      await pool.end();
    }
  }
  interface CredentialFacts extends QueryResultRow {
    readonly operator_id: string;
    readonly salt: Buffer;
    readonly hash: Buffer;
    readonly hashed_at: string;
    /** The id of the transaction that wrote this version of the row. */
    readonly tx: string;
  }
  const credentials = (): Promise<CredentialFacts[]> => asApp<CredentialFacts>('SELECT operator_id, salt, hash, hashed_at, xmin::text AS tx FROM public.operator_credentials ORDER BY operator_id');
  const credentialOf = (rows: readonly CredentialFacts[], operatorId: string): CredentialFacts => rows.find((row) => row.operator_id === operatorId) as CredentialFacts;
  const head = async (): Promise<{ seq: string; hash: string }> => (await asApp<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_head'))[0] as { seq: string; hash: string };
  const setRows = (): Promise<Array<{ seq: string; actor_id: string | null; category: string; severity: string; message: string; details: Record<string, unknown>; tx: string }>> =>
    asApp("SELECT seq, actor_id, category, severity, message, details, xmin::text AS tx FROM public.audit_log WHERE type = 'OPERATOR_PASSWORD_SET' ORDER BY seq");

  /** One run of the command's function; its lines and its error entries are kept for the sweep. */
  async function command(rest: string[], typed: Array<string | (() => Promise<string>)>): Promise<{ run: Awaited<ReturnType<typeof runSetPasswordCommand>>; d: Driven }> {
    const d = driven(typed, () => FIXED_NOW - HOUR);
    const run = await runSetPasswordCommand(args(...rest), d.ports);
    said.push(...run.lines, ...d.out, ...d.labels);
    errorEntries.push(...d.errorEntries);
    return { run, d };
  }

  // ── The signing key of the session: the production key command's function, in the temporary folder ──
  const entryOf = (path: string): EntryFacts | null => {
    try {
      const status = lstatSync(path);
      return { kind: status.isSymbolicLink() ? 'link' : status.isDirectory() ? 'directory' : status.isFile() ? 'file' : 'other', ownerUid: status.uid, mode: status.mode & 0o7777 };
    } catch {
      return null;
    }
  };
  async function productionKeyStore(): Promise<string> {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row216-'));
    roots.push(root);
    const dataDir = join(root, 'data');
    mkdirSync(dataDir, { mode: 0o700 });
    // Task 4 row 228b: this suite's own synthetic installation (`ROW216_INSTALLATION`, not a reserved id) - the id of the test configuration is reserved and never starts a production Core.
    const typed = ['SYNTHETIC TEST ORG - NOT AN INSTALLATION', ROW216_INSTALLATION, PROVISION_WORD];
    const run = await runProductionKeyCommand(['--data-dir', dataDir], {
      now: () => FIXED_NOW,
      uid: () => UID,
      out: () => undefined,
      ask: async () => typed.shift() ?? null,
      // Only the steps ABOVE the test's root are stated (the temporary folder lies below a directory every user may write).
      inspect: (path) => (root !== path && (path === sep || root.startsWith(`${path}${sep}`)) ? { kind: 'directory', ownerUid: 0, mode: 0o755 } : entryOf(path)),
    });
    expect([run.code, run.refusal]).toEqual([0, null]);
    return dataDir;
  }

  interface ProductionStart {
    readonly host: EngineApp;
    readonly failure: BootError | null;
    readonly codes: readonly string[];
    close(): Promise<void>;
  }
  /** A whole REAL_PRODUCTION start of the real app factory on the session's database, with the explicit test host. A refused boot is returned, not thrown. */
  async function productionStart(): Promise<ProductionStart> {
    const host = await engineApp(acc, keyDataDir, {
      startAt: BOOT_AT,
      logLevel: 'info',
      config: { captureMode: 'real', demoControls: false, dataDir: keyDataDir, installationDeviceId: ROW216_INSTALLATION, captureWorkerPath: programs.worker('capture-worker'), ...testHostPrograms(programs.programsDir) },
    });
    expect(captureBootControl(host.app).decision).toMatchObject({ operation: 'REAL_PRODUCTION', refusal: null });
    provideTestCaptureHost(host.app);
    let failure: BootError | null = null;
    try {
      await host.app.readiness.boot();
    } catch (error) {
      if (!(error instanceof BootError)) throw error;
      failure = error;
    }
    const lines = host.log.lines();
    return {
      host,
      failure,
      codes: lines.map((line) => line['code']).filter((code): code is string => typeof code === 'string' && code.startsWith('CAPTURE_')),
      async close() {
        coreLogs.push(JSON.stringify(host.log.lines()));
        await host.app.close();
      },
    };
  }

  it('step 0: the seeded state - check 4c counts every operator; a Core runs and each operator signs in with the seeded credential; then the fixture rows of the session', async () => {
    accName = acc.name;
    spies.push(vi.spyOn(process.stdout, 'write'), vi.spyOn(process.stderr, 'write'));
    expect(OPERATORS).toHaveLength(3);
    expect(await countOfCheck4c()).toBe(OPERATORS.length);

    const closers: Array<() => Promise<unknown> | unknown> = [];
    const built = await engineApp({ runtime: acc.runtime, onCleanup: (close) => void closers.push(close) }, acc.run.dataDir, { logLevel: 'info' });
    try {
      await built.app.readiness.boot();
      await built.engine.idle();
      await built.app.pipeline.drain();
      for (const operator of OPERATORS) {
        const response = await webSignIn(built.app, operator.username);
        const token = response.statusCode === 200 ? cookieValue(response, built.app.config.sessionCookieName) : null;
        if (token === null) throw new Error(`the web sign-in of an operator answered ${response.statusCode}`);
        staleSessions.set(operator.username, { cookie: `${built.app.config.sessionCookieName}=${token}` });
      }
    } finally {
      coreLogs.push(JSON.stringify(built.log.lines()));
      for (const close of closers.splice(0)) await close();
    }

    await asOwner(async (owner) => {
      // What a production start needs of a seeded database beside the two commands (as row 208 states it).
      await owner.query('UPDATE public.stt_config SET enabled = false');
      // D60/D61 (2026-11-04): the selector carries four video pairs and four numbered channels — every slot column goes NULL.
      await owner.query('UPDATE public.capture_config SET video_01_device_id = NULL, video_01_profile = NULL, video_02_device_id = NULL, video_02_profile = NULL, video_03_device_id = NULL, video_03_profile = NULL, video_04_device_id = NULL, video_04_profile = NULL, mic_01_id = NULL, mic_02_id = NULL, mic_03_id = NULL, mic_04_id = NULL');
      // One biometric token of the Supervisor that is neither used nor revoked: the command must revoke it.
      await insertPairedDevice(owner, 'DEV-0216', supervisor.id, FIXED_NOW);
      await owner.query(
        "INSERT INTO public.biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at, used_at, revoked_at, revoke_reason) VALUES ($1, '21621621-6216-4216-8216-216216216216', 'DEV-0216', $2, $3, $4, NULL, NULL, NULL)",
        [randomBytes(32), supervisor.id, FIXED_NOW, FIXED_NOW + 30 * 24 * HOUR],
      );
    });
    const sessions = await asApp<{ operator_id: string; ended_at: string | null }>('SELECT operator_id, ended_at FROM public.auth_sessions');
    expect(sessions.map((row) => [row.operator_id, row.ended_at]).sort()).toEqual(OPERATORS.map((operator) => [operator.id, null]).sort());
  });

  it('step 1, CHECK 4c BEFORE THE WALK, through the real boot function: a REAL_PRODUCTION start passes checks 4 and 4b on the command-made key and is refused at 4c with the three seeded operators', async () => {
    keyDataDir = await productionKeyStore();
    const start = await productionStart();
    try {
      expect(start.failure).toBeInstanceOf(BootError);
      expect(start.failure?.stepId).toBe(CAPTURE_BOOT_STEP);
      const cause = start.failure?.cause as { code?: unknown; reason?: unknown } | undefined;
      expect([cause?.code, cause?.reason]).toEqual([CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, `operators=${OPERATORS.length}`]);
      // AT 4c: the key loaded and is not a development key (their refusals come first and were not written).
      expect(start.codes).not.toContain(CaptureBootRefusal.SIGNING_KEY_UNUSABLE);
      expect(start.codes).not.toContain(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY);
      expect(start.codes).not.toContain('CAPTURE_BOOT_CHECKS_PASSED');
      expect(captureBootControl(start.host.app).outcome()).toBeNull();
    } finally {
      await start.close();
    }
  });

  it('step 2, SX-01 before the first prompt: another session on the database refuses the walk; nobody is prompted and nothing is stored', async () => {
    const before = { head: await head(), credentials: await credentials() };
    const running = await connect(acc.runtime, 'dems-core-server');
    try {
      const { run, d } = await command(['--all-demo'], walkOrder.flatMap((username) => [valueOf(username), valueOf(username)]));
      expect(run.code).toBe(SetPasswordExit.REFUSED);
      expect(run.lines.join('\n')).toMatch(/REFUSED \(DATABASE_IN_USE\).*dems_app: 1.*sees connections, not a process/);
      expect(d.labels).toEqual([]);
      expect(run.set).toEqual([]);
    } finally {
      await running.end();
    }
    expect(await head()).toEqual(before.head);
    expect(await credentials()).toEqual(before.credentials);
  });

  it('step 3, the policy on a real database: too short, the published demo password and the username are refused by their codes; after three tries the operator is NOT set and nothing is stored', async () => {
    const before = { head: await head(), credentials: await credentials() };
    const { run, d } = await command(['--username', supervisor.username], [tooShort, tooShort, DEMO_OPERATOR_PASSWORD, DEMO_OPERATOR_PASSWORD, holdsUsername, holdsUsername]);
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.set).toEqual([]);
    const refused = run.lines.map((line) => /not accepted \(([A-Z_]+)\)/.exec(line)?.[1]).filter((code) => code !== undefined);
    expect(refused).toEqual(['PASSWORD_TOO_SHORT', 'PASSWORD_IS_DEMONSTRATION', 'PASSWORD_HOLDS_USERNAME']);
    expect(run.lines.join('\n')).toContain(`REFUSED (TRIES_EXHAUSTED) ${supervisor.username}: NOT set, nothing of this operator was stored; no password was set before it.`);
    expect(d.labels).toHaveLength(6);
    for (const buffer of d.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);
    // No refused value is repeated by the command, the demo password included.
    for (const typed of [tooShort, DEMO_OPERATOR_PASSWORD, holdsUsername]) expect(occurrences(JSON.stringify([run.lines, d.out, d.errorEntries]), typed)).toBe(0);
    expect(await head()).toEqual(before.head);
    expect(await credentials()).toEqual(before.credentials);
    expect(await countOfCheck4c()).toBe(OPERATORS.length);
  });

  it('step 4, A FAILURE AT OPERATOR 2 OF 3: operator 1 stays committed - credential, sessions, token and audit row in ONE transaction - operator 2 is rolled back, operator 3 is not asked, and the command says exactly that', async () => {
    const before = { head: await head(), credentials: await credentials() };
    let late: Awaited<ReturnType<typeof connect>> | null = null;
    let outcome: Awaited<ReturnType<typeof command>>;
    try {
      outcome = await command(
        ['--all-demo'],
        [
          valueOf(supervisor.username),
          valueOf(supervisor.username),
          // A Core that starts while the second operator types: the connection appears after the first check.
          async () => {
            late = await connect(acc.runtime, 'dems-core-server');
            return valueOf(second.username);
          },
          valueOf(second.username),
        ],
      );
    } finally {
      await (late as { end(): Promise<void> } | null)?.end();
    }
    const { run, d } = outcome;
    expect(run.code).toBe(SetPasswordExit.REFUSED);
    expect(run.set).toEqual([supervisor.username]);
    // What it listed, whom it asked, and what it reported - exactly.
    expect(run.lines.join('\n')).toContain('operators:       3 (every operator that still has the published demo password)');
    expect(d.labels).toEqual([`New password for ${supervisor.username} (SUPERVISOR): `, 'Again: ', `New password for ${second.username} (${second.role}): `, 'Again: ']);
    expect(run.lines).toContain(`${supervisor.username}: password set, 1 session(s) ended`);
    expect(run.lines).toContain(
      `operator:set-password: REFUSED (DATABASE_IN_USE) ${second.username}: NOT set, its unit was rolled back and nothing of this operator was stored; set and committed before it: ${supervisor.username}. Another connection to the database appeared: stop the Core and run again.`,
    );
    expect(run.lines.filter((line) => line.includes(third.username))).toEqual([`    - ${third.username} (${third.role})`]);
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 2');
    expect(run.demoPasswordOperators).toBe(2);
    expect(d.errorEntries).toHaveLength(1);
    expect(d.errorEntries[0]).toMatchObject({ source: 'cli.operatorSetPassword', code: 'DATABASE_IN_USE', context: { targetOperatorId: second.id, committedBefore: 1 } });

    // The database: one credential changed, two byte-identical; the chain moved by one row.
    const after = await credentials();
    const changed = credentialOf(after, supervisor.id);
    expect(changed.tx).not.toBe(credentialOf(before.credentials, supervisor.id).tx);
    expect(changed.hash.equals(credentialOf(before.credentials, supervisor.id).hash)).toBe(false);
    for (const untouched of [second, third]) expect(credentialOf(after, untouched.id)).toEqual(credentialOf(before.credentials, untouched.id));
    expect(Number((await head()).seq)).toBe(Number(before.head.seq) + 1);
    const audit = await setRows();
    expect(audit.map((row) => [Number(row.seq), row.actor_id, row.details['targetOperatorId']])).toEqual([[Number(before.head.seq) + 1, null, supervisor.id]]);

    // ONE TRANSACTION: the credential, the ended session, the revoked token and the audit row carry one transaction id.
    const sessions = await asApp<{ operator_id: string; ended_at: string | null; end_reason: string | null; tx: string }>('SELECT operator_id, ended_at, end_reason, xmin::text AS tx FROM public.auth_sessions');
    const ended = sessions.filter((row) => row.operator_id === supervisor.id);
    expect(ended.map((row) => [row.end_reason, row.ended_at, row.tx])).toEqual([['CREDENTIAL_REPLACED', changed.hashed_at, changed.tx]]);
    const tokens = await asApp<{ revoked_at: string | null; revoke_reason: string | null; tx: string }>('SELECT revoked_at, revoke_reason, xmin::text AS tx FROM public.biometric_tokens WHERE operator_id = $1', [supervisor.id]);
    expect(tokens.map((row) => [row.revoke_reason, row.revoked_at, row.tx])).toEqual([['CREDENTIAL_REPLACED', changed.hashed_at, changed.tx]]);
    expect(audit[0]?.tx).toBe(changed.tx);
    // The sessions of the two others are as they were: open.
    expect(sessions.filter((row) => row.operator_id !== supervisor.id).map((row) => row.ended_at)).toEqual([null, null]);
    expect(await countOfCheck4c()).toBe(2);
  });

  it('step 5, the walk again: it lists the two operators that are left and does not ask the Supervisor; each stored credential was changed exactly once, each in a transaction of its own', async () => {
    const before = await credentials();
    const { run, d } = await command(['--all-demo'], [second, third].flatMap((operator) => [valueOf(operator.username), valueOf(operator.username)]));
    expect(run.lines.filter((line) => line.includes('REFUSED'))).toEqual([]);
    expect(run.code).toBe(SetPasswordExit.DONE);
    expect(run.set).toEqual([second.username, third.username]);
    expect(run.lines.join('\n')).toContain('operators:       2 (every operator that still has the published demo password)');
    expect(d.labels.filter((label) => label.includes(supervisor.username))).toEqual([]);
    expect(run.lines).toContain(`${second.username}: password set, 1 session(s) ended`);
    expect(run.lines).toContain(`${third.username}: password set, 1 session(s) ended`);
    expect(run.lines.at(-1)).toBe('operators that still have the demo password: 0');
    expect(d.errorEntries).toEqual([]);
    for (const buffer of d.buffers) expect(buffer.every((byte) => byte === 0)).toBe(true);

    const after = await credentials();
    // The Supervisor's row is the one step 4 wrote: not written again.
    expect(credentialOf(after, supervisor.id)).toEqual(credentialOf(before, supervisor.id));
    for (const operator of [second, third]) expect(credentialOf(after, operator.id).tx).not.toBe(credentialOf(before, operator.id).tx);
    expect(new Set(after.map((row) => row.tx)).size).toBe(OPERATORS.length);
  });

  it('step 6, afterwards: exactly one audit row per operator by the existing writer, every earlier session ended with the command`s reason, the Core`s OWN chain verification passes, and the count of check 4c is 0', async () => {
    const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
    const audit = await setRows();
    expect(audit.map(({ seq: _seq, tx: _tx, ...row }) => row)).toEqual(
      [supervisor, second, third].map((operator) => ({
        actor_id: null,
        category: 'SECURITY',
        severity: 'WARNING',
        message: AUDIT_MESSAGE,
        details: { targetOperatorId: operator.id, method: 'HOST_COMMAND', sessionsEnded: 1, earlierWasDemo: true, ...(uid >= 0 ? { invokerUid: uid } : {}) },
      })),
    );
    // Each audit row lies in the transaction of its operator's credential.
    const stored = await credentials();
    expect(audit.map((row) => row.tx)).toEqual([supervisor, second, third].map((operator) => credentialOf(stored, operator.id).tx));
    const reasons = await asApp<{ end_reason: string | null }>('SELECT end_reason FROM public.auth_sessions');
    expect(reasons.map((row) => row.end_reason)).toEqual(OPERATORS.map(() => 'CREDENTIAL_REPLACED'));

    const host = openHostCommandUnit(acc.runtime);
    try {
      expect(await host.verifyStoredChain()).toMatchObject({ ok: true, checked: Number((await head()).seq), firstBadSeq: null });
    } finally {
      await host.close();
    }
    expect(await countOfCheck4c()).toBe(0);
  });

  it('step 7, CHECK 4c AFTER THE WALK, through the real boot function: the same REAL_PRODUCTION start passes the whole step; on that Core every earlier session is dead, the demo password opens nothing, each value of the run signs in and the chain verifies', async () => {
    const start = await productionStart();
    try {
      const cause = start.failure?.cause as { code?: unknown; reason?: unknown } | undefined;
      expect(start.failure === null ? null : [start.failure.stepId, cause?.code, cause?.reason]).toBeNull();
      expect(start.codes).toContain('CAPTURE_BOOT_CHECKS_PASSED');
      for (const refusal of [CaptureBootRefusal.SIGNING_KEY_UNUSABLE, CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION]) expect(start.codes).not.toContain(refusal);
      expect(captureBootControl(start.host.app).outcome()).toMatchObject({ operation: 'REAL_PRODUCTION' });
      await start.host.engine.idle();
      await start.host.app.pipeline.drain();

      const app = start.host.app;
      for (const operator of OPERATORS) {
        expect((await get(app, AUDIT_CHAIN, staleSessions.get(operator.username) as Headers)).statusCode).toBe(401);
        expect((await webSignIn(app, operator.username)).statusCode).toBe(401);
      }
      let session: Headers | null = null;
      for (const operator of OPERATORS) {
        const response = await webSignIn(app, operator.username, valueOf(operator.username));
        expect(response.statusCode).toBe(200);
        if (operator.id === supervisor.id) session = { cookie: `${app.config.sessionCookieName}=${cookieValue(response, app.config.sessionCookieName)}` };
      }
      const status = (await get(app, AUDIT_CHAIN, session as Headers)).json<AuditChainStatus>();
      expect([status.view.ok, status.stored.ok, status.stored.firstBadSeq]).toEqual([true, true, null]);
    } finally {
      await start.close();
    }
  });

  it('step 8, THE SWEEP: no typed value, and no salt or tag of a stored set, in standard output, standard error, the command`s lines, the error log, the audit rows, the logs of the Cores, the process arguments or the environment - count 0', async () => {
    const chunkText = (chunk: unknown): string => (typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) || chunk instanceof Uint8Array ? Buffer.from(chunk).toString('utf8') : '');
    const [stdout, stderr] = spies.map((spy) => (spy as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((call) => chunkText(call[0])).join(''));
    const auditRows = (await asApp<{ line: string }>('SELECT row_to_json(a)::text AS line FROM public.audit_log a ORDER BY seq')).map((row) => row.line);
    const haystacks: Record<string, string> = {
      'standard output': stdout ?? '',
      'standard error': stderr ?? '',
      'the lines and prompts of the command': said.join('\n'),
      'the error log': JSON.stringify(errorEntries),
      'the audit rows': auditRows.join('\n'),
      'the logs of the Cores': coreLogs.join('\n'),
      'the process arguments': JSON.stringify([process.argv, process.execArgv]),
      'the environment': JSON.stringify(Object.entries(process.env)),
    };
    // The haystacks are real: the command spoke, the Cores logged, the audit table holds the command's rows.
    expect(said.length).toBeGreaterThan(40);
    expect(errorEntries.length).toBeGreaterThan(0);
    expect(coreLogs).toHaveLength(3);
    expect(occurrences(haystacks['the audit rows'] as string, 'OPERATOR_PASSWORD_SET')).toBeGreaterThanOrEqual(OPERATORS.length);

    const needles: Record<string, string> = {};
    const textForms = (label: string, typed: string): void => {
      const bytes = Buffer.from(typed, 'utf8');
      Object.assign(needles, { [`${label} plain`]: typed, [`${label} hex`]: bytes.toString('hex'), [`${label} base64`]: bytes.toString('base64'), [`${label} uri`]: encodeURIComponent(typed) });
    };
    OPERATORS.forEach((operator, index) => textForms(`value of operator ${index + 1}`, valueOf(operator.username)));
    textForms('refused short value', tooShort);
    textForms('refused value with the username', holdsUsername);
    const stored = await credentials();
    stored.forEach((row, index) => {
      for (const [part, bytes] of [['salt', row.salt], ['tag', row.hash]] as const) {
        Object.assign(needles, { [`${part} ${index + 1} hex`]: bytes.toString('hex'), [`${part} ${index + 1} HEX`]: bytes.toString('hex').toUpperCase(), [`${part} ${index + 1} base64`]: bytes.toString('base64'), [`${part} ${index + 1} base64url`]: bytes.toString('base64url') });
      }
    });
    expect(Object.keys(needles)).toHaveLength(5 * 4 + OPERATORS.length * 2 * 4);
    // POSITIVE CONTROL: the search finds a needle where it is planted.
    for (const needle of Object.values(needles)) expect(occurrences(`planted ${needle} here`, needle)).toBe(1);

    const hits: string[] = [];
    let searches = 0;
    for (const [place, text] of Object.entries(haystacks)) {
      for (const [label, needle] of Object.entries(needles)) {
        searches += 1;
        const count = occurrences(text, needle);
        if (count > 0) hits.push(`${label} in ${place}: ${count}`);
      }
    }
    expect(searches).toBe(8 * 44);
    // A hit is named by its label and its place, never by its value.
    expect(hits).toEqual([]);
  });
});
