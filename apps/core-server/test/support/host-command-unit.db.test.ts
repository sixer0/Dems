// The gate of the host command `operator:set-password` (task 4, blueprint row 214; security review
// SX-02 with hypothesis H2, SX-03, H3, SX-01). A PROBE: test support only, no product file.
//
// The question of SX-02: can a host command, run while the Core is STOPPED, write its audit row
// only through the Core's existing unit of work and audit writer, on a pool of its own, so that
// the hash chain stays intact? `host-command-unit.ts` opens the pipeline that way; this file
// proves the answer on throw-away clones of the seed, as the runtime role `dems_app`:
//
//   1  a Core runs, an operator signs in with the seeded credential, the Core stops;
//   2  the harness, with no app: ONE unit that asks for the other sessions of the database,
//      replaces the operator's stored credential (a synthetic value made in this run), ends the
//      operator's sessions and revokes the operator's biometric tokens with the identity module's
//      own functions, and appends one audit row of an EXISTING type through `unit.audit`; then the
//      Core's own stored-chain check passes;
//   3  a Core boots on that database; its operation `verifyAuditChain` answers ok for the view and
//      for the stored chain; the session of step 1 is dead; the synthetic value signs in and the
//      seeded one does not;
//   4  NEGATIVE CONTROL, on a clone of its own: the same row inserted by plain SQL with a digest
//      the command made itself is ACCEPTED by the database (it does not check the digest, GD-01)
//      and the Core's verification REPORTS the break;
//   5  the grants: what the runtime role holds, and what it does not.
//
// The probe row's type is `USER_DISABLED` because it is an existing server-native type with a
// details rule (`targetOperatorId`, `sessionsEnded`), the shape `OPERATOR_PASSWORD_SET` of row 201
// will have. Nobody is disabled: the row is synthetic and the database is dropped. The session and
// token reason is `USER_DISABLED` for the same cause: `CREDENTIAL_REPLACED` is row 202's.
//
// The host clock of step 2 is BEHIND the newest stored instant on purpose (the review asked what a
// host clock read after the Core stopped does to the chain). A Core that starts raises the floor of
// its clock to the stored state (decision D110, `engine/host.ts`); a command has no engine, so it
// has to do that itself. Step 2 shows both halves: without the floor the database refuses the end
// of a session that was issued "later" and the whole unit rolls back; with the floor, read and
// raised inside the unit, the unit commits and its row is not older than its predecessor.
//
// SX-19: the one credential of this file is made from randomness in the run and is in no source,
// fixture, log or record; step 2 sweeps the log, the error log and the stored row for it.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditChainStatus } from '@dems/shared/api';
import { OPERATORS, auditId, type OperatorRole } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { connect, expectRefused, SQLSTATE } from '../db/support';
import { useTestDatabase } from '../helpers/db';
import { createSystemClock, raiseClockFloor } from '../../src/core/clock';
import { CoreError } from '../../src/core/errors';
import { readNewestStoredInstant } from '../../src/engine/rehydrate';
import { revokeBiometricTokens } from '../../src/modules/identity/biometric';
import { hashPassword } from '../../src/modules/identity/password-hash';
import { endSessionsOfOperator } from '../../src/modules/identity/session-store';
import { readHead, readTrail, verifyTrail } from './core';
import { FIXED_NOW, engineApp, type EngineApp } from './engine';
import { openHostCommandUnit } from './host-command-unit';
import { cookieValue, get, webSignIn, type Headers } from './identity';

/** Operation 60, `verifyAuditChain`. */
const AUDIT_CHAIN = '/api/v1/audit/chain';

const db = useTestDatabase({ template: 'seed' });

const HOUR = 3_600_000;
/** The other client sessions of this database, every role, without the asking backend (SX-01). */
const OTHER_SESSIONS =
  'SELECT usename::text AS role, count(*)::int AS sessions FROM pg_stat_activity ' +
  'WHERE datname = current_database() AND usename IS NOT NULL AND pid <> pg_backend_pid() GROUP BY 1 ORDER BY 1';
/** The seven credential columns, by the operator: the row count decides (SX-11). */
const SET_CREDENTIAL =
  'UPDATE public.operator_credentials SET algorithm = $2, memory_kib = $3, passes = $4, parallelism = $5, salt = $6, hash = $7, hashed_at = $8 ' +
  'WHERE operator_id = $1 RETURNING operator_id';

function operatorOf(role: OperatorRole) {
  const found = OPERATORS.find((candidate) => candidate.role === role);
  if (found === undefined) throw new Error(`no seeded operator has the role ${role}`);
  return found;
}

/**
 * A Core of this file: the real app on a clone, booted. `stop` closes it, also when its boot
 * failed half-way (the builder registers the close before it boots), so no session of it stays on
 * a database that is about to be dropped or asked for its other sessions.
 */
interface ProbeCore {
  readonly app: EngineApp['app'];
  readonly log: EngineApp['log'];
  /** Signs a seeded operator of this role in on the web console, with the seeded credential. */
  signIn(role: OperatorRole): Promise<Headers>;
  get(url: string, session: Headers): ReturnType<typeof get>;
}
interface Core {
  readonly host: ProbeCore;
  stop(): Promise<void>;
}
async function boot(runtime: typeof db.runtime): Promise<Core> {
  const closers: Array<() => Promise<unknown> | unknown> = [];
  const stop = async (): Promise<void> => {
    for (const close of closers.splice(0)) await close();
  };
  db.onCleanup(stop);
  try {
    // The real app factory with every stage and the engine; then a process start: B-1 to B-9 and the engine's reload.
    const built = await engineApp({ runtime, onCleanup: (close) => void closers.push(close) }, db.run.dataDir, { logLevel: 'info' });
    await built.app.readiness.boot();
    await built.engine.idle();
    await built.app.pipeline.drain();
    const cookieName = built.app.config.sessionCookieName;
    const host: ProbeCore = {
      app: built.app,
      log: built.log,
      async signIn(role) {
        const response = await webSignIn(built.app, operatorOf(role).username);
        const token = response.statusCode === 200 ? cookieValue(response, cookieName) : null;
        if (token === null) throw new Error(`the web sign-in of the ${role} answered ${response.statusCode}`);
        return { cookie: `${cookieName}=${token}` };
      },
      get: (url, session) => get(built.app, url, session),
    };
    return { host, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function chainOf(host: ProbeCore, session: Headers): Promise<AuditChainStatus> {
  const response = await host.get(AUDIT_CHAIN, session);
  expect(response.statusCode).toBe(200);
  return response.json();
}

const sessionsOf = (rows: ReadonlyArray<{ role: string; sessions: number }>): Record<string, number> =>
  Object.fromEntries(rows.map((row) => [row.role, row.sessions]));

describe('row 214: a host command writes its audit row through the Core`s unit of work and audit writer, with the Core stopped (SX-02, H2)', () => {
  const supervisor = operatorOf('SUPERVISOR');
  /** Made here, used here, stored nowhere but as its hash on a database that is dropped. */
  const synthetic = randomBytes(24).toString('base64url');
  let staleSession: Headers;
  let probeSeq = 0;

  it('step 1: a Core runs on the database, the operator signs in, the Core stops', async () => {
    const core = await boot(db.runtime);
    try {
      staleSession = await core.host.signIn('SUPERVISOR');
      const status = await chainOf(core.host, staleSession);
      expect(status.view.ok).toBe(true);
      expect(status.stored.ok).toBe(true);
    } finally {
      await core.stop();
    }
  });

  it('step 2: with no app, one unit replaces the credential, ends the sessions, revokes the tokens and appends one audit row; the Core`s own chain check passes', async () => {
    // The harness is not the app: its source names no app factory.
    const source = readFileSync(join(import.meta.dirname, 'host-command-unit.ts'), 'utf8');
    expect(source.split('\n').filter((line) => /^import /.test(line) && /src\/app|buildApp|engine|realtime/.test(line))).toEqual([]);

    // A host clock that was set back while the Core was down: one hour behind what the Core stored.
    // The server clock of `core/clock` on a source that does not move: it has a floor to raise.
    const behind = FIXED_NOW - HOUR;
    const clock = createSystemClock(() => behind);
    const host = openHostCommandUnit(db.runtime, { clock });
    db.onCleanup(() => host.close());
    const record = await hashPassword(synthetic);
    const credential = (at: number) => [supervisor.id, record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash, at];

    // WITHOUT the floor: the session of step 1 was issued after the command's "now", the CHECK of
    // the session table refuses its end, and nothing of the unit is stored (fails closed).
    const headBefore = await readHead(host.pool);
    await expect(
      host.pipeline.run('hostCommand.clockBehind', async (unit) => {
        await unit.query(SET_CREDENTIAL, credential(clock.now()));
        await endSessionsOfOperator(unit, supervisor.id, clock.now(), 'USER_DISABLED');
      }),
    ).rejects.toMatchObject({ code: SQLSTATE.checkViolation, constraint: 'auth_sessions_times_check' });
    expect(await readHead(host.pool)).toEqual(headBefore);
    const kept = await host.pool.query<{ hash: Buffer }>('SELECT hash FROM public.operator_credentials WHERE operator_id = $1', [supervisor.id]);
    expect(kept.rows[0]?.hash.equals(record.hash)).toBe(false);

    const outcome = await host.pipeline.run('hostCommand.setPassword', async (unit) => {
      const who = await unit.query<{ role: string; superuser: boolean; owns: boolean }>(
        "SELECT current_user::text AS role, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser, " +
          "(SELECT tableowner = current_user FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') AS owns",
      );
      // SX-01: asked again inside the transaction, after the chain lock (the unit's second statement).
      const others = await unit.query<{ role: string; sessions: number }>(OTHER_SESSIONS);
      // D110, as the engine does at a start: the newest stored instant, read under the chain lock,
      // is the floor of the clock before anything of this unit reads the time.
      const newest = await readNewestStoredInstant(unit);
      const raised = raiseClockFloor(clock, newest);
      const at = clock.now();
      const updated = await unit.query(SET_CREDENTIAL, credential(at));
      const ended = await endSessionsOfOperator(unit, supervisor.id, at, 'USER_DISABLED');
      const revoked = await revokeBiometricTokens(unit, { scope: 'OPERATOR', operatorId: supervisor.id, reason: 'USER_DISABLED' }, at);
      const row = await unit.audit.append({
        type: 'USER_DISABLED',
        severity: 'WARNING',
        actorId: null,
        deviceId: null,
        message: 'Row 214 probe: a synthetic row of a host command.',
        details: { targetOperatorId: supervisor.id, sessionsEnded: ended.length },
      });
      return { who: who.rows[0], others: sessionsOf(others.rows), newest, raised, at, updated: updated.rowCount, ended: ended.length, revoked, row };
    });
    // The floor: the stored state was ahead of the host clock, and the unit's time is the floor.
    expect(outcome.newest).toBeGreaterThan(behind);
    expect(outcome.raised).toBe(true);
    const at = outcome.at;
    expect(at).toBe(outcome.newest);

    // SX-03: the runtime role, not the owner, not a superuser.
    expect(outcome.who).toEqual({ role: 'dems_app', superuser: false, owns: false });
    // The Core is stopped and nobody else is connected: no other session of any role.
    expect(outcome.others).toEqual({});
    // SX-11: exactly one credential row; the session of step 1 ended; the seed has no live token.
    expect(outcome.updated).toBe(1);
    expect(outcome.ended).toBe(1);
    expect(outcome.revoked).toBe(0);
    probeSeq = outcome.row.seq;
    expect(outcome.row).toMatchObject({ type: 'USER_DISABLED', category: 'SECURITY', severity: 'WARNING', actorId: null, at });

    // THE CORE'S OWN VERIFICATION, a full pass over the stored chain.
    const status = await host.verifyStoredChain();
    expect(status).toEqual({ ok: true, checked: probeSeq, head: outcome.row.hash, firstBadSeq: null });
    // And the shared check over every stored row, with the stored head.
    const trail = await readTrail(host.pool);
    const head = await readHead(host.pool);
    expect(head).toEqual({ seq: probeSeq, hash: outcome.row.hash });
    expect(verifyTrail(trail, head).ok).toBe(true);
    // With the floor the command's row is not older than its predecessor, whatever the host clock said.
    const before = trail.at(-2);
    expect(before === undefined ? null : before.at <= at).toBe(true);

    // The unit keeps everybody but the writer out of `audit_log`: a statement of the command is refused before it is sent.
    await expect(
      host.pipeline.run('hostCommand.ownInsert', (unit) => unit.query('INSERT INTO public.audit_log (seq) VALUES ($1)', [probeSeq + 1])),
    ).rejects.toSatisfy((error: unknown) => error instanceof CoreError && error.code === 'UNIT_STATEMENT_NOT_ALLOWED');
    expect(await readHead(host.pool)).toEqual(head);

    // SX-01, the stand-in for a Core that started meanwhile: one more session of the runtime role
    // is seen from inside a unit, and so is a session of another role.
    const core = await connect(db.runtime, 'dems-core-server');
    try {
      const seen = await host.pipeline.run('hostCommand.recheck', (unit) => unit.query<{ role: string; sessions: number }>(OTHER_SESSIONS));
      expect(sessionsOf(seen.rows)).toEqual({ dems_app: 1 });
      await db.ownerPool().query('SELECT 1');
      const both = await host.pipeline.run('hostCommand.recheck', (unit) => unit.query<{ role: string; sessions: number }>(OTHER_SESSIONS));
      expect(sessionsOf(both.rows)).toEqual({ dems_app: 1, dems_owner: 1 });
    } finally {
      await core.end();
    }

    // SX-19 / R-X2-4: the synthetic value, its salt and its tag are in no log line, no error entry and no audit row.
    const written = JSON.stringify([host.logLines, host.errorEntries, outcome.row, trail.at(-1)]);
    for (const needle of [synthetic, record.salt.toString('hex'), record.salt.toString('base64'), record.hash.toString('hex'), record.hash.toString('base64')]) {
      expect(written.includes(needle)).toBe(false);
    }
    expect(host.errorEntries).toEqual([]);
    await host.close();
  });

  it('step 3: a Core boots on that database, its own verification passes, the old session is dead and only the new credential signs in', async () => {
    expect(probeSeq).toBeGreaterThan(0);
    const core = await boot(db.runtime);
    try {
      const second = core.host;
      // The boot ran B-1 to B-9; B-8 reported the stored chain.
      const reported = second.log.lines().filter((line) => line['msg'] === 'the stored audit chain verifies');
      expect(reported).toHaveLength(1);
      expect(reported[0]).toMatchObject({ lastSeq: probeSeq, linkBreaks: 0 });
      expect(second.log.lines().filter((line) => line['msg'] === 'boot check failed')).toEqual([]);

      // The session opened before the command: ended in the database, so it opens nothing.
      expect((await second.get(AUDIT_CHAIN, staleSession)).statusCode).toBe(401);

      const investigator = await second.signIn('INVESTIGATOR');
      const status = await chainOf(second, investigator);
      expect(status.view.ok).toBe(true);
      expect(status.stored.ok).toBe(true);
      expect(status.stored.firstBadSeq).toBeNull();
      expect(status.stored.checked).toBeGreaterThan(probeSeq);

      // The seeded credential of the operator is gone; the synthetic one is the stored one.
      expect((await webSignIn(second.app, supervisor.username)).statusCode).toBe(401);
      expect((await webSignIn(second.app, supervisor.username, synthetic)).statusCode).toBe(200);
      await second.app.pipeline.drain();

      // The Core went on appending after the command's row: still one chain.
      const after = await chainOf(second, investigator);
      expect(after.view.ok).toBe(true);
      expect(after.stored).toMatchObject({ ok: true, firstBadSeq: null });
      expect(after.stored.checked).toBeGreaterThan(status.stored.checked);
    } finally {
      await core.stop();
    }
  });
});

describe('row 214, negative control: the same row inserted by plain SQL is accepted by the database and reported by the Core`s verification', () => {
  it('a row with a digest the command made itself: the guard takes it, the stored-chain check names it, a Core still boots and reports it', async () => {
    const clone = await db.another();
    try {
      const session = await connect(clone.runtime, 'dems-row214-own-sql');
      let seq = 0;
      try {
        // What a command "under the same protocol" would do by hand: the lock, then its own INSERT.
        await session.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        const locked = await session.query<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_lock()');
        const head = { seq: Number(locked.rows[0]?.seq), hash: String(locked.rows[0]?.hash) };
        seq = head.seq + 1;
        const body = {
          id: auditId(seq),
          at: FIXED_NOW,
          type: 'USER_DISABLED',
          category: 'SECURITY',
          severity: 'WARNING',
          message: 'Row 214 probe: a synthetic row of a host command.',
          details: { targetOperatorId: operatorOf('SUPERVISOR').id, sessionsEnded: 0 },
        };
        // A digest of its own making: the link is right, the digest is not the shared one.
        const hash = createHash('sha256').update(head.hash).update(JSON.stringify(body)).digest('hex');
        const inserted = await session.query(
          'INSERT INTO public.audit_log (seq, id, at, type, category, severity, actor_id, message, session_id, evidence_id, device_id, details, prev_hash, hash) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, NULL, NULL, NULL, $8, $9, $10)',
          [seq, body.id, body.at, body.type, body.category, body.severity, body.message, JSON.stringify(body.details), head.hash, hash],
        );
        await session.query('COMMIT');
        // The database does not check the digest (GD-01): the row is stored and the head moved to it.
        expect(inserted.rowCount).toBe(1);
      } finally {
        await session.end();
      }

      // The Core's own stored-chain check, without an app: the break, at that row.
      const host = openHostCommandUnit(clone.runtime);
      try {
        const status = await host.verifyStoredChain();
        expect(status).toMatchObject({ ok: false, firstBadSeq: seq, checked: seq - 1 });
        expect(verifyTrail(await readTrail(host.pool), await readHead(host.pool)).ok).toBe(false);
      } finally {
        await host.close();
      }

      // A Core on that database: B-8 is a REPORTED check, so it starts, and it says so.
      const core = await boot(clone.runtime);
      try {
        const lines = core.host.log.lines();
        expect(lines.filter((line) => line['msg'] === 'the stored audit chain verifies')).toEqual([]);
        expect(lines.filter((line) => line['code'] === 'STORED_CHAIN_NOT_VERIFIED')).toHaveLength(1);
        const investigator = await core.host.signIn('INVESTIGATOR');
        const status = await chainOf(core.host, investigator);
        expect(status.stored).toMatchObject({ ok: false, firstBadSeq: seq });
        // Rows the Core appended since (the sign-in) do not mend it.
        expect(status.stored.checked).toBe(seq - 1);
      } finally {
        await core.stop();
      }
    } finally {
      await clone.drop();
    }
  });
});

describe('row 214: the grants of the runtime role, as the catalog of a migrated database states them (SX-03)', () => {
  it('holds the four things the command needs and none of what it must not do', async () => {
    const app = db.appPool();
    const { rows } = await app.query<{ what: string; held: boolean }>(
      `SELECT what, held FROM (VALUES
         ('role is dems_app', current_user = 'dems_app'),
         ('superuser', (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)),
         ('credential: update of the seven columns', (SELECT bool_and(has_column_privilege('public.operator_credentials', c, 'UPDATE'))
            FROM unnest(ARRAY['algorithm','memory_kib','passes','parallelism','salt','hash','hashed_at']) AS c)),
         ('credential: select', has_table_privilege('public.operator_credentials', 'SELECT')),
         ('credential: insert', has_table_privilege('public.operator_credentials', 'INSERT')),
         ('credential: delete', has_table_privilege('public.operator_credentials', 'DELETE')),
         ('credential: update of operator_id', has_column_privilege('public.operator_credentials', 'operator_id', 'UPDATE')),
         ('sessions: update of ended_at, end_reason', has_column_privilege('public.auth_sessions', 'ended_at', 'UPDATE') AND has_column_privilege('public.auth_sessions', 'end_reason', 'UPDATE')),
         ('tokens: update of revoked_at, revoke_reason', has_column_privilege('public.biometric_tokens', 'revoked_at', 'UPDATE') AND has_column_privilege('public.biometric_tokens', 'revoke_reason', 'UPDATE')),
         ('audit: insert', has_table_privilege('public.audit_log', 'INSERT')),
         ('audit: update', has_table_privilege('public.audit_log', 'UPDATE')),
         ('audit: delete', has_table_privilege('public.audit_log', 'DELETE')),
         ('audit: chain lock', has_function_privilege('public.audit_chain_lock()', 'EXECUTE')),
         ('audit: chain head update', has_table_privilege('public.audit_chain_head', 'UPDATE')),
         ('operators: select', has_table_privilege('public.operators', 'SELECT')),
         ('operators: insert', has_table_privilege('public.operators', 'INSERT')),
         ('operators: delete', has_table_privilege('public.operators', 'DELETE')),
         ('operators: update of username', has_column_privilege('public.operators', 'username', 'UPDATE')),
         ('schema: create', has_schema_privilege('public', 'CREATE'))
       ) AS t (what, held)`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.what, row.held]))).toEqual({
      'role is dems_app': true,
      superuser: false,
      'credential: update of the seven columns': true,
      'credential: select': true,
      // REVISED 2026-11-04 (RB-9/0035, D56/0037): the runtime role may DELETE a credential (the account's row goes with
      // the account) and INSERT one (operator:set-password creates the first credential row of a factory-born account).
      'credential: insert': true,
      'credential: delete': true,
      'credential: update of operator_id': false,
      'sessions: update of ended_at, end_reason': true,
      'tokens: update of revoked_at, revoke_reason': true,
      'audit: insert': true,
      'audit: update': false,
      'audit: delete': false,
      'audit: chain lock': true,
      'audit: chain head update': false,
      'operators: select': true,
      // REVISED 2026-11-04 (RB-9/0035): the add-user trio writes and removes account rows as `dems_app`.
      'operators: insert': true,
      'operators: delete': true,
      'operators: update of username': false,
      'schema: create': false,
    });
    // Never DDL, never a trigger change: a trigger is switched by the owner of its table only, and
    // the runtime role owns no table (the statement itself is not written here: static rule T-AO-4).
    const owned = await app.query<{ tables: number }>("SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user");
    expect(owned.rows[0]?.tables).toBe(0);
    // The identity column stays closed (SX-11 as amended by RB-9/0035 and D56/0037): the command may create, replace
    // and delete a credential row, but the database itself refuses to MOVE one to another operator.
    await expectRefused(
      () => app.query('UPDATE public.operator_credentials SET operator_id = operator_id'),
      SQLSTATE.insufficientPrivilege,
    );
  });
});
