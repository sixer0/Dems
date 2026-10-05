// The audit table: append-only and chain serialisation (database contract §6; AC-B-54, AC-B-87;
// SR-52, SR-53, SR-78). Tests T-AO-1, T-AO-2a, T-AO-2b, T-AO-3, T-CH-1, T-CH-2, T-CH-3.
// (T-AO-2d is in `catalog.db.test.ts`; T-AO-2c runs at provisioning, not here; T-AO-4 is the
// static guard `test/static/audit-protection.test.ts`.)
//
// Roles: `app` is the runtime role `dems_app`, exactly as the server connects; `owner` is
// `dems_owner`. Nothing here connects as a superuser.
import { verifyAuditChain, type AuditLogSlice, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import {
  AUDIT_INSERT,
  appendAuditRows,
  insertAuditRow,
  insertRbac,
  insertRow,
  lineageRow,
  lockChain,
  nextAuditRow,
  type ChainHead,
} from './fixtures';
import { SQLSTATE, connect, expectRefused, runtimePool, sleep, tableChecksum, until, waitingLocks } from './support';

const db = useTestDatabase({ template: 'schema' });
let app: Pool;
let owner: Pool;

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  await insertRbac(owner);
});

async function head(pool: Pool): Promise<ChainHead> {
  const { rows } = await pool.query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_chain_head');
  return { seq: Number(rows[0]?.seq), hash: String(rows[0]?.hash) };
}

async function storedChain(pool: Pool): Promise<AuditLogSlice> {
  const { rows } = await pool.query(
    'SELECT seq, id, at, type, category, severity, actor_id, message, session_id, evidence_id, device_id, details, prev_hash, hash FROM audit_log ORDER BY seq',
  );
  const mapped = rows.map(
    (row): AuditRow =>
      ({
        seq: Number(row.seq),
        id: row.id,
        at: Number(row.at),
        type: row.type,
        category: row.category,
        severity: row.severity,
        actorId: row.actor_id,
        message: row.message,
        sessionId: row.session_id,
        evidenceId: row.evidence_id,
        deviceId: row.device_id,
        details: row.details,
        prevHash: row.prev_hash,
        hash: row.hash,
      }) as AuditRow,
  );
  const last = mapped[mapped.length - 1];
  return { rows: mapped, head: last?.hash ?? '0'.repeat(64), total: mapped.length, dropped: 0 };
}

describe('the append protocol, as the runtime role (AP-1 to AP-5)', () => {
  it('dems_app may call the lock function although it holds no UPDATE on the head (PG-04), and the lock is held until the transaction ends (PG-06)', async () => {
    const first = await connect(db.runtime);
    const second = await connect(db.runtime);
    try {
      await first.query('BEGIN');
      expect(await lockChain(first)).toEqual({ seq: 0, hash: '0'.repeat(64) });

      await second.query('BEGIN');
      let secondReturned = false;
      const waiting = lockChain(second).then((value) => {
        secondReturned = true;
        return value;
      });
      await until(async () => (await waitingLocks(owner)) === 1, 'the second writer waits at the lock');
      await sleep(50);
      expect(secondReturned).toBe(false);

      // The first writer appends one row and commits: the lock is released only now.
      const row = nextAuditRow({ seq: 0, hash: '0'.repeat(64) });
      await insertAuditRow(first, row);
      expect(secondReturned).toBe(false);
      await first.query('COMMIT');

      // PG-05: the waiter gets the COMMITTED head, not the one that existed when it started to wait.
      expect(await waiting).toEqual({ seq: 1, hash: row['hash'] });
      await second.query('ROLLBACK');
    } finally {
      await first.end();
      await second.end();
    }
    expect(await head(app)).toMatchObject({ seq: 1 });
  });
});

describe('T-CH-1: 50 concurrent appends on 10 connections of dems_app give a chain that verifies (AC-B-54)', () => {
  it('50 commits, no error, no retry; no gap; the head equals the last row; the shared check passes', async () => {
    const pool = runtimePool(db.runtime, 10, 'dems-w17-chain');
    db.onCleanup(() => pool.end());
    const before = await head(app);
    let maxInFlight = 0;
    let inFlight = 0;

    const task = async (index: number): Promise<number> => {
      const client = await pool.connect();
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await client.query('BEGIN'); // READ COMMITTED, the default (AP-1)
        const current = await lockChain(client); // AP-2
        await sleep(Math.floor(Math.random() * 21)); // a pause of 0 to 20 ms between the lock and the INSERT
        const row = nextAuditRow(current, { type: 'ACCESS_DENIED', category: 'SECURITY', details: { task: index } }); // AP-3
        await insertAuditRow(client, row); // AP-4
        await client.query('COMMIT'); // AP-5
        return Number(row['seq']);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        inFlight -= 1;
        client.release();
      }
    };

    const results = await Promise.allSettled(Array.from({ length: 50 }, (_, index) => task(index)));
    const failed = results.filter((result) => result.status === 'rejected');
    expect(failed).toEqual([]);
    const sequences = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])).sort((a, b) => a - b);
    expect(sequences).toEqual(Array.from({ length: 50 }, (_, index) => before.seq + 1 + index));
    expect(maxInFlight).toBe(10);

    const chain = await storedChain(app);
    expect(chain.rows.map((row) => row.seq)).toEqual(Array.from({ length: before.seq + 50 }, (_, index) => index + 1));
    const last = chain.rows[chain.rows.length - 1];
    expect(await head(app)).toEqual({ seq: last?.seq, hash: last?.hash });
    const verdict = verifyAuditChain(chain);
    expect(verdict.ok).toBe(true);
    console.info(
      `[w17] T-CH-1: 50 tasks on 10 connections (${maxInFlight} in flight at once): 50 commits, 0 errors; seq ${sequences[0]}..${sequences[49]} without a gap; verifyAuditChain ok=${verdict.ok} over ${chain.rows.length} rows`,
    );
  });
});

describe('T-CH-2: the chain guard refuses a row that does not continue the head (AC-B-54)', () => {
  it('two writers that read the head WITHOUT the lock and build the same next row: exactly one commits, the other gets ZA001', async () => {
    const before = await head(app);
    const checksum = await tableChecksum(owner, 'audit_log', 'seq');
    const first = await connect(db.runtime);
    const second = await connect(db.runtime);
    try {
      // A plain SELECT, no lock: both see the same head.
      const seenByFirst = await head(app);
      const seenBySecond = await head(app);
      expect(seenByFirst).toEqual(seenBySecond);
      const rowA = nextAuditRow(seenByFirst, { message: 'writer A' });
      const rowB = nextAuditRow(seenBySecond, { message: 'writer B' });

      await first.query('BEGIN');
      await second.query('BEGIN');
      await insertAuditRow(first, rowA); // the guard locks the head for A
      const insertB = insertAuditRow(second, rowB).then(
        () => 'inserted',
        (error: { code?: string }) => error.code,
      );
      await until(async () => (await waitingLocks(owner)) === 1, 'writer B waits on the head row inside the guard');
      await first.query('COMMIT');
      expect(await insertB).toBe(SQLSTATE.chainDiscontinuity);
      await second.query('ROLLBACK');
    } finally {
      await first.end();
      await second.end();
    }
    const after = await head(app);
    expect(after.seq).toBe(before.seq + 1);
    const { rows } = await owner.query('SELECT message FROM audit_log WHERE seq = $1', [after.seq]);
    expect(rows).toEqual([{ message: 'writer A' }]);
    expect(await tableChecksum(owner, 'audit_log', 'seq')).not.toBe(checksum);
  });

  it('a row with seq = head + 2, and a row with the right seq and a wrong prev_hash: ZA001; the table is unchanged', async () => {
    const current = await head(app);
    const checksum = await tableChecksum(owner, 'audit_log', 'seq');

    const gap = nextAuditRow({ seq: current.seq + 1, hash: current.hash });
    const refusedGap = await expectRefused(() => app.query(AUDIT_INSERT, Object.values(gap)), SQLSTATE.chainDiscontinuity);
    expect(refusedGap.message).toBe(`audit chain: row ${current.seq + 2} does not continue head ${current.seq}`);

    const wrongLink = nextAuditRow({ seq: current.seq, hash: 'f'.repeat(64) });
    await expectRefused(() => app.query(AUDIT_INSERT, Object.values(wrongLink)), SQLSTATE.chainDiscontinuity);

    // The owner role is bound by the guard as well: the trigger is ENABLE ALWAYS and fires for every role.
    await expectRefused(() => owner.query(AUDIT_INSERT, Object.values(gap)), SQLSTATE.chainDiscontinuity);

    expect(await tableChecksum(owner, 'audit_log', 'seq')).toBe(checksum);
    expect(await head(app)).toEqual(current);
  });

  it('the chain cannot fork: the UNIQUE constraints on seq, prev_hash and hash exist beside the guard (G-5)', async () => {
    const { rows } = await owner.query<{ name: string }>(
      "SELECT conname::text AS name FROM pg_constraint WHERE conrelid = 'public.audit_log'::regclass AND contype IN ('p', 'u') ORDER BY 1",
    );
    expect(rows.map((row) => row.name)).toEqual(['audit_log_hash_key', 'audit_log_id_key', 'audit_log_pkey', 'audit_log_prev_hash_key']);
  });
});

describe('T-CH-3: the runtime role cannot move the chain head', () => {
  it('UPDATE audit_chain_head and SELECT ... FOR UPDATE both fail with 42501 (PG-04, PG-25)', async () => {
    const before = await head(app);
    await expectRefused(() => app.query('UPDATE audit_chain_head SET seq = 0'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('SELECT seq, hash FROM audit_chain_head FOR UPDATE'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('DELETE FROM audit_chain_head'), SQLSTATE.insufficientPrivilege);
    await expectRefused(
      () => app.query("INSERT INTO audit_chain_head (singleton, seq, hash) VALUES (false, 0, repeat('0', 64))"),
      SQLSTATE.insufficientPrivilege,
    );
    expect(await head(app)).toEqual(before);
  });
});

describe('T-AO-1: audit_log is append-only for the runtime role, by privilege (AC-B-54, SR-52)', () => {
  it('UPDATE, DELETE and TRUNCATE each fail with 42501; the table is unchanged; the three privileges are false', async () => {
    const checksum = await tableChecksum(owner, 'audit_log', 'seq');
    expect(checksum.startsWith('0:')).toBe(false);

    await expectRefused(() => app.query("UPDATE audit_log SET message = 'x' WHERE seq = 1"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('DELETE FROM audit_log WHERE seq = 1'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('TRUNCATE audit_log'), SQLSTATE.insufficientPrivilege);
    // A statement that matches no row is refused in the same way: the privilege is checked first.
    await expectRefused(() => app.query("UPDATE audit_log SET message = 'x' WHERE false"), SQLSTATE.insufficientPrivilege);

    expect(await tableChecksum(owner, 'audit_log', 'seq')).toBe(checksum);
    const { rows } = await app.query(
      `SELECT has_table_privilege('dems_app', 'public.audit_log', 'UPDATE') AS can_update,
              has_table_privilege('dems_app', 'public.audit_log', 'DELETE') AS can_delete,
              has_table_privilege('dems_app', 'public.audit_log', 'TRUNCATE') AS can_truncate,
              has_table_privilege('dems_app', 'public.audit_log', 'INSERT') AS can_insert,
              has_table_privilege('dems_app', 'public.audit_log', 'SELECT') AS can_select`,
    );
    expect(rows).toEqual([{ can_update: false, can_delete: false, can_truncate: false, can_insert: true, can_select: true }]);
  });
});

describe('T-AO-2a: audit_log is append-only for the owner role, by trigger', () => {
  it('UPDATE, DELETE, TRUNCATE and an UPDATE that matches no row each fail with ZA002; the table is unchanged', async () => {
    const checksum = await tableChecksum(owner, 'audit_log', 'seq');
    const statements: Array<[string, string]> = [
      ["UPDATE audit_log SET message = 'x' WHERE seq = 1", 'UPDATE'],
      ['DELETE FROM audit_log WHERE seq = 1', 'DELETE'],
      ['TRUNCATE audit_log', 'TRUNCATE'],
      ["UPDATE audit_log SET message = 'x' WHERE false", 'UPDATE'],
    ];
    for (const [statement, operation] of statements) {
      const refusal = await expectRefused(() => owner.query(statement), SQLSTATE.appendOnly);
      expect(refusal.message).toBe(`audit_log is append-only: ${operation} refused`);
    }
    expect(await tableChecksum(owner, 'audit_log', 'seq')).toBe(checksum);
  });
});

describe('T-AO-2b: neither project role can switch the session mode that skips ordinary triggers (PG-22)', () => {
  it('SET session_replication_role = replica fails with 42501 for dems_owner and for dems_app', async () => {
    const asOwner = await expectRefused(() => owner.query('SET session_replication_role = replica'), SQLSTATE.insufficientPrivilege);
    expect(asOwner.message).toBe('permission denied to set parameter "session_replication_role"');
    await expectRefused(() => app.query('SET session_replication_role = replica'), SQLSTATE.insufficientPrivilege);
    const { rows } = await owner.query("SELECT current_setting('session_replication_role') AS mode");
    expect(rows).toEqual([{ mode: 'origin' }]);
  });
});

describe('T-AO-3: the lineage table is read-only for the runtime role and append-only for the owner (AC-B-87, SR-78)', () => {
  it('dems_app: INSERT, UPDATE, DELETE and TRUNCATE fail with 42501; dems_owner: UPDATE, DELETE and TRUNCATE fail with ZA002', async () => {
    // One lineage row, written as the owner role: what the reset routine does (LN-1).
    await insertRow(owner, 'audit_chain_history', lineageRow(1, { actor_id: 'OPR-002', reason: 'SCENARIO_LOAD', scenario: 'recording' }));
    const checksum = await tableChecksum(owner, 'audit_chain_history', 'reset_no');
    expect(checksum.startsWith('1:')).toBe(true);

    const wellFormed = Object.values(lineageRow(2));
    await expectRefused(
      () =>
        app.query(
          'INSERT INTO audit_chain_history (reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          wellFormed,
        ),
      SQLSTATE.insufficientPrivilege,
    );
    await expectRefused(() => app.query("UPDATE audit_chain_history SET scenario = 'idle'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('DELETE FROM audit_chain_history'), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('TRUNCATE audit_chain_history'), SQLSTATE.insufficientPrivilege);

    for (const [statement, operation] of [
      ["UPDATE audit_chain_history SET scenario = 'idle'", 'UPDATE'],
      ['DELETE FROM audit_chain_history', 'DELETE'],
      ['TRUNCATE audit_chain_history', 'TRUNCATE'],
    ] as const) {
      const refusal = await expectRefused(() => owner.query(statement), SQLSTATE.appendOnly);
      expect(refusal.message).toBe(`audit_chain_history is append-only: ${operation} refused`);
    }

    expect(await tableChecksum(owner, 'audit_chain_history', 'reset_no')).toBe(checksum);
    const { rows } = await app.query(
      `SELECT has_table_privilege('dems_app', 'public.audit_chain_history', 'INSERT') AS can_insert,
              has_table_privilege('dems_app', 'public.audit_chain_history', 'SELECT') AS can_select,
              has_any_column_privilege('dems_app', 'public.audit_chain_history', 'INSERT') AS any_insert,
              has_any_column_privilege('dems_app', 'public.audit_chain_history', 'UPDATE') AS any_update`,
    );
    expect(rows).toEqual([{ can_insert: false, can_select: true, any_insert: false, any_update: false }]);

    // The runtime role reads the lineage (LN-4), and the owner may append to it (the reset routine).
    const read = await app.query('SELECT reset_no::int AS reset_no, reason, scenario, actor_id FROM audit_chain_history ORDER BY reset_no DESC LIMIT 20');
    expect(read.rows).toEqual([{ reset_no: 1, reason: 'SCENARIO_LOAD', scenario: 'recording', actor_id: 'OPR-002' }]);
    await insertRow(owner, 'audit_chain_history', lineageRow(2));
    expect((await app.query('SELECT count(*)::int AS rows FROM audit_chain_history')).rows).toEqual([{ rows: 2 }]);
  });
});

describe('a multi-row append in one transaction keeps the chain (AP-4, AP-5)', () => {
  it('three rows in one transaction commit together; a refused row rolls the whole unit back', async () => {
    const before = await head(app);
    const after = await appendAuditRows(app, 3, { type: 'ROLE_CHANGED', category: 'SECURITY', actorId: 'OPR-002' });
    expect(after.seq).toBe(before.seq + 3);
    expect(await head(app)).toEqual(after);

    const client = await app.connect();
    try {
      await client.query('BEGIN');
      const current = await lockChain(client);
      const good = nextAuditRow(current);
      await insertAuditRow(client, good);
      // The next row continues the chain but its payload has a denied key name: the CHECK refuses
      // it, the transaction is aborted, and the row before it goes with it.
      const bad = nextAuditRow({ seq: Number(good['seq']), hash: String(good['hash']) }, { details: { password: 'x' } });
      await expectRefused(() => insertAuditRow(client, bad), SQLSTATE.checkViolation, 'audit_log_details_no_secret_keys_check');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(await head(app)).toEqual(after);
    expect(verifyAuditChain(await storedChain(app)).ok).toBe(true);
  });
});
