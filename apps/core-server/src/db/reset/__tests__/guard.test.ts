// Step R-0 and the refusals around it, with no database (plan row W29; database contract §8.5
// R-0, R-1, R-2; T-RS-4; spec AC-B-72, SR-58, SR-68). The role check is proven with a stand-in
// for the connection: no test of the server connects as a superuser.
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResetError } from '../errors';
import { CONNECTION_CLOSE_WAIT_MS, resetDatabase, type ResetLogEntry } from '../routine';
import { PRIVILEGED_ANSWERS, ROLE_CHECK, runOnStub, upToCatalog } from './guard-cases';
import { healthy, scriptOf, stubPools } from './pools';

describe('T-RS-4: the role check of R-0', () => {
  it.each(PRIVILEGED_ANSWERS)('%s: RESET_ROLE_PRIVILEGED before R-1, and no statement but the check was sent', async (_label, rows) => {
    const run = await runOnStub(scriptOf([['FROM pg_roles', rows]]));
    expect(run.error).toMatchObject({ code: 'RESET_ROLE_PRIVILEGED', step: 'R-0', targetUntouched: true });
    expect(run.error?.message).toBe('refused: the reset runs as dems_owner, which is not a superuser; this connection is not that role. Nothing was touched.');
    // The one statement of the whole call is the check itself.
    expect(run.pools.sent).toEqual([{ database: 'postgres', text: ROLE_CHECK }]);
    // R-1 was never reached: nothing was quiesced, the clock was not read, no other database was opened.
    expect(run.checkpoints).toEqual(['R-0']);
    expect(run.quiesced).toBe(0);
    expect(run.clockReads).toBe(0);
    expect(run.pools.opened).toEqual(['postgres']);
    // The owner connection is closed, and the defect is logged with its code.
    expect(run.pools.counts).toEqual({ connected: 1, released: 1, ended: 1 });
    expect(run.logged.map((entry) => [entry.level, entry.code])).toEqual([['error', 'RESET_ROLE_PRIVILEGED']]);
  });

  it('the owner role, not a superuser, passes the check and goes on to the lock', async () => {
    const run = await runOnStub(scriptOf([['FROM pg_roles', healthy.role()], ['pg_try_advisory_lock', [{ locked: false }]]]));
    expect(run.error).toMatchObject({ code: 'RESET_ALREADY_RUNNING', step: 'R-0' });
    expect(run.pools.sent.map((entry) => entry.text)).toEqual([ROLE_CHECK, 'SELECT pg_try_advisory_lock($1::int, $2::int) AS locked']);
    // A lock that was not taken is not released.
    expect(run.pools.sent.some((entry) => entry.text.includes('pg_advisory_unlock'))).toBe(false);
    expect(run.checkpoints).toEqual(['R-0']);
    expect(run.quiesced).toBe(0);
    expect(run.pools.counts).toEqual({ connected: 1, released: 1, ended: 1 });
  });
});

describe('R-0: the connection', () => {
  it('nothing answers: RESET_DATABASE_UNREACHABLE, and the pool is closed', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4432'), { code: 'ECONNREFUSED' });
    const run = await runOnStub(() => [], { connectError: refused });
    expect(run.error).toMatchObject({ code: 'RESET_DATABASE_UNREACHABLE', step: 'R-0', targetUntouched: true });
    expect(run.error?.message).toBe('R-0 failed: the connection failed (ECONNREFUSED).');
    expect(run.pools.sent).toEqual([]);
    expect(run.pools.counts).toEqual({ connected: 0, released: 0, ended: 1 });
  });

  it('the owner connection file is read only at R-0, by the routine itself: a missing file stops it there', async () => {
    const outcome = await resetDatabase({ database: 'dems_lane_3', dataDir: '/nonexistent/dems-w29' }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(outcome).toBeInstanceOf(ResetError);
    expect(outcome).toMatchObject({ code: 'RESET_OWNER_CREDENTIALS', step: 'R-0', targetUntouched: true });
    expect((outcome as ResetError).message).toMatch(/cannot be read \(ENOENT\)\. It is created with the cluster: run "npm run pg:init"\.$/);
  });

  it('an owner file that group or others may read is refused, and nothing of it is read or shown', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dems-w29-mode-'));
    const marker = 'w29-not-a-credential';
    try {
      const file = join(directory, ['pg', 'owner', 'env'].join('.'));
      writeFileSync(file, `DEMS_PG_HOST=127.0.0.1\nDEMS_PG_PORT=4432\nDEMS_PG_DATABASE=postgres\nDEMS_PG_OWNER_ROLE=dems_owner\nDEMS_PG_OWNER_PASSWORD=${marker}\n`);
      chmodSync(file, 0o644);
      const outcome = await resetDatabase({ database: 'dems_lane_3', dataDir: directory }).then(
        () => null,
        (error: unknown) => error,
      );
      expect(outcome).toMatchObject({ code: 'RESET_OWNER_CREDENTIALS', step: 'R-0' });
      expect((outcome as ResetError).message).toContain('has mode 644; expected 600');
      expect((outcome as ResetError).message).not.toContain(marker);
      expect(JSON.stringify(outcome)).not.toContain(marker);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('an owner file that names another role is refused before any connection', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dems-w29-role-'));
    try {
      const file = join(directory, ['pg', 'owner', 'env'].join('.'));
      writeFileSync(file, 'DEMS_PG_HOST=127.0.0.1\nDEMS_PG_PORT=4432\nDEMS_PG_DATABASE=postgres\nDEMS_PG_OWNER_ROLE=dems_admin\nDEMS_PG_OWNER_PASSWORD=w29-not-a-credential\n', { mode: 0o600 });
      const outcome = await resetDatabase({ database: 'dems_lane_3', dataDir: directory }).then(
        () => null,
        (error: unknown) => error,
      );
      expect(outcome).toMatchObject({ code: 'RESET_OWNER_CREDENTIALS', step: 'R-0' });
      expect((outcome as ResetError).message).toContain('DEMS_PG_OWNER_ROLE must be dems_owner; the database commands run as no other role.');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('before R-0: a refused name or option opens nothing', () => {
  it.each([
    ['postgres', {}],
    ['template1', {}],
    ['dems_lane_3_next', {}],
    ['dems_lane_9', {}],
    ['dems_lane_3', { scenario: 'night' as never }],
    ['dems_lane_3', { actorId: 'someone' }],
    ['dems_lane_3', { reason: 'CLEANUP' as never }],
  ])('%s %j', async (database, more) => {
    let opened = 0;
    const outcome = await resetDatabase(
      { database, ...more, onCheckpoint: () => void (opened += 1) },
      {
        openPool: () => {
          opened += 1;
          throw new Error('a pool was asked for');
        },
      },
    ).then(
      () => null,
      (error: unknown) => error,
    );
    expect(outcome).toBeInstanceOf(ResetError);
    expect(['RESET_TARGET_REFUSED', 'RESET_OPTIONS_INVALID']).toContain((outcome as ResetError).code);
    expect((outcome as ResetError).step).toBe('R-0');
    // Not even the first checkpoint was announced.
    expect(opened).toBe(0);
  });
});

describe('R-1: a database in use', () => {
  it('sessions on the target: RESET_TARGET_IN_USE after the quiesce hook, with the roles and counts, and no statement that ends a session', async () => {
    const run = await runOnStub(
      scriptOf([
        ['FROM pg_roles', healthy.role()],
        ['pg_try_advisory_lock', healthy.lock()],
        ['server_version', healthy.version()],
        ['FROM pg_stat_activity', [{ database: 'dems_lane_3', role: 'dems_app', sessions: 4 }, { database: 'dems_lane_3', role: 'dems_owner', sessions: 1 }]],
        ['pg_advisory_unlock', [{ unlocked: true }]],
      ]),
    );
    expect(run.error).toMatchObject({ code: 'RESET_TARGET_IN_USE', step: 'R-1', targetUntouched: true });
    expect(run.error?.message).toBe(
      "refused: dems_lane_3 is in use (4 of role dems_app on dems_lane_3, 1 of role dems_owner on dems_lane_3). The reset ends nobody's session: stop the server of this database, or close its pool, and run again. Nothing was changed.",
    );
    expect(run.quiesced).toBe(1);
    expect(run.clockReads).toBe(0);
    expect(run.checkpoints).toEqual(['R-0', 'R-1']);
    const texts = run.pools.sent.map((entry) => entry.text);
    expect(texts.filter((text) => /terminate|cancel|FORCE|DROP|ALTER|CREATE/i.test(text))).toEqual([]);
    // The lock was taken, so it is released; the connection is closed.
    expect(texts.at(-1)).toBe('SELECT pg_advisory_unlock($1::int, $2::int) AS unlocked');
    expect(run.pools.counts).toEqual({ connected: 1, released: 1, ended: 1 });
  });
});

describe('R-2: only databases of the owner role are touched', () => {
  it.each([
    ['the target belongs to the bootstrap superuser', [{ name: 'dems_lane_3', owner: 'dems_admin', template: false }], 'the database dems_lane_3 belongs to dems_admin, not to dems_owner'],
    ['a staging leftover belongs to another role', [{ name: 'dems_lane_3', owner: 'dems_owner', template: false }, { name: 'dems_lane_3_next', owner: 'dems_app', template: false }], 'the database dems_lane_3_next belongs to dems_app, not to dems_owner'],
    ['a previous leftover belongs to another role', [{ name: 'dems_lane_3_prev', owner: 'dems_admin', template: false }], 'the database dems_lane_3_prev belongs to dems_admin, not to dems_owner'],
    ['the target is a template', [{ name: 'dems_lane_3', owner: 'dems_owner', template: true }], 'the database dems_lane_3 is a template'],
  ])('%s: RESET_TARGET_NOT_OURS, and nothing was created, renamed or dropped', async (_label, catalog, message) => {
    const run = await runOnStub(upToCatalog(catalog));
    expect(run.error).toMatchObject({ code: 'RESET_TARGET_NOT_OURS', step: 'R-2', targetUntouched: true });
    expect(run.error?.message).toContain(message);
    const texts = run.pools.sent.map((entry) => entry.text);
    expect(texts.filter((text) => /\b(?:CREATE|ALTER|DROP)\s+DATABASE\b/i.test(text))).toEqual([]);
    expect(run.pools.opened).toEqual(['postgres']);
    expect(texts.at(-1)).toContain('pg_advisory_unlock');
  });

  it('a leftover that cannot be dropped stops the routine: RESET_LEFTOVER_FAILED, the target is not read', async () => {
    const inUse = Object.assign(new Error('database "dems_lane_3_next" is being accessed by other users'), { code: '55006' });
    const run = await runOnStub((text) => {
      if (text.startsWith('DROP DATABASE')) return inUse;
      return upToCatalog([
        { name: 'dems_lane_3', owner: 'dems_owner', template: false },
        { name: 'dems_lane_3_next', owner: 'dems_owner', template: false },
      ])(text, [], 'postgres');
    });
    expect(run.error).toMatchObject({ code: 'RESET_LEFTOVER_FAILED', step: 'R-2', sqlState: '55006', targetUntouched: true });
    expect(run.pools.sent.filter((entry) => entry.text.startsWith('DROP DATABASE')).map((entry) => entry.text)).toEqual(['DROP DATABASE "dems_lane_3_next"']);
    expect(run.pools.opened).toEqual(['postgres']);
    expect(run.checkpoints).toEqual(['R-0', 'R-1', 'R-2']);
  });

  it('the target is missing and its previous database exists: one rename back, then RESET_RECOVERED_PREVIOUS', async () => {
    const run = await runOnStub(upToCatalog([{ name: 'dems_lane_3_prev', owner: 'dems_owner', template: false }]));
    expect(run.error).toMatchObject({ code: 'RESET_RECOVERED_PREVIOUS', step: 'R-2' });
    const database = run.pools.sent.map((entry) => entry.text).filter((text) => /\b(?:CREATE|ALTER|DROP)\s+DATABASE\b/i.test(text));
    expect(database).toEqual(['ALTER DATABASE "dems_lane_3_prev" RENAME TO "dems_lane_3"']);
    expect(run.logged.map((entry) => entry.code)).toEqual(['RESET_RECOVERED_PREVIOUS']);
  });
});

describe('no message, log entry or error of a refusal holds anything of the connection', () => {
  it('a server answer with a detail line is reduced to its SQLSTATE, constraint and table', async () => {
    const secretLooking = 'Key (token_hash)=(\\x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff) already exists.';
    const violation = Object.assign(new Error(`duplicate key value violates unique constraint; ${secretLooking}`), {
      code: '23505',
      detail: secretLooking,
      constraint: 'auth_sessions_token_hash_key',
      table: 'auth_sessions',
    });
    const run = await runOnStub((text) => {
      if (text.includes('FROM pg_database')) return violation;
      return upToCatalog([])(text, [], 'postgres');
    });
    expect(run.error).toMatchObject({ code: 'RESET_LEFTOVER_FAILED', step: 'R-2', sqlState: '23505', constraint: 'auth_sessions_token_hash_key', table: 'auth_sessions' });
    expect(run.error?.message).toBe('R-2 failed: the server answered SQLSTATE 23505 (constraint auth_sessions_token_hash_key, table auth_sessions).');
    const everything = JSON.stringify({ error: run.error, message: run.error?.message, stack: run.error?.stack, logged: run.logged });
    expect(everything).not.toContain('00112233');
    expect(everything).not.toContain('already exists');
    expect(run.error?.cause).toBeUndefined();
  });
});

describe('R-9: the routine settles only when the driver has closed the owner connection', () => {
  // The driver's pool reports "ended" when it has ASKED its connections to close; it reports each
  // connection that has really ended with the event `remove`. The routine waits for that event.
  afterEach(() => {
    vi.useRealTimers();
  });

  const refusedAtR0 = scriptOf([['FROM pg_roles', [{ rolname: 'dems_admin', rolsuper: true }]]]);
  const settleOf = (pools: ReturnType<typeof stubPools>, logged: ResetLogEntry[] = []) => {
    const state = { settled: false };
    const outcome = resetDatabase({ database: 'dems_lane_3', dataDir: '/nonexistent/dems-w29', log: (entry) => logged.push(entry) }, { openPool: pools.openPool })
      .then(
        () => null,
        (error: unknown) => error,
      )
      .finally(() => {
        state.settled = true;
      });
    return { state, outcome };
  };
  /** Lets the routine run until it has asked its pool to end: in-process, no clock involved. */
  const untilEndAsked = async (pools: ReturnType<typeof stubPools>): Promise<void> => {
    while (pools.counts.ended === 0) await new Promise((resolve) => setImmediate(resolve));
  };

  it('a pool that holds a connection: the routine has not settled when the pool was asked to end, and settles when the connection is reported closed', async () => {
    const pools = stubPools(refusedAtR0, { held: 1 });
    const { state, outcome } = settleOf(pools);
    await untilEndAsked(pools);
    await new Promise((resolve) => setImmediate(resolve));
    expect(pools.counts).toEqual({ connected: 1, released: 1, ended: 1 });
    expect(pools.removeListeners).toHaveLength(1);
    // Asked to end, and not yet closed: the promise of the routine is still pending.
    expect(state.settled).toBe(false);

    // The driver reports that the connection has ended.
    for (const listener of pools.removeListeners) listener();
    const error = await outcome;
    expect(state.settled).toBe(true);
    expect(error).toBeInstanceOf(ResetError);
    expect((error as ResetError).code).toBe('RESET_ROLE_PRIVILEGED');
  });

  it('a connection that never reports its end does not hold the routine: after the bound it goes on, and says so', async () => {
    vi.useFakeTimers();
    const logged: ResetLogEntry[] = [];
    const pools = stubPools(refusedAtR0, { held: 1 });
    const { state, outcome } = settleOf(pools, logged);
    await vi.advanceTimersByTimeAsync(CONNECTION_CLOSE_WAIT_MS - 1);
    expect(pools.counts.ended).toBe(1);
    expect(state.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await outcome;
    expect((error as ResetError).code).toBe('RESET_ROLE_PRIVILEGED');
    expect(CONNECTION_CLOSE_WAIT_MS).toBe(5_000);
    expect(logged.map((entry) => [entry.level, entry.code])).toEqual([
      ['error', 'RESET_ROLE_PRIVILEGED'],
      ['warn', 'RESET_CONNECTION_SLOW_TO_CLOSE'],
    ]);
    expect(logged[1]?.message).toBe('a connection of the reset on postgres had not reported its end after 5000 ms; the routine went on.');
  });

  it('a pool that holds no connection (it never connected) is ended without a wait', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4432'), { code: 'ECONNREFUSED' });
    const pools = stubPools(() => [], { connectError: refused, held: 0 });
    const { outcome } = settleOf(pools);
    const error = await outcome;
    expect((error as ResetError).code).toBe('RESET_DATABASE_UNREACHABLE');
    expect(pools.removeListeners).toEqual([]);
    expect(pools.counts.ended).toBe(1);
  });
});
