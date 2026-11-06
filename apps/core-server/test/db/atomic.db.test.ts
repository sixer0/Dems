// Atomic state changes at the database level (database contract §5.6; SR-72; SD-04, SD-10):
// T-AT-1 to T-AT-5, with the contract's exact statements.
//
// How the contract asks for them: on a clone, as `dems_app`, WITHOUT the chain lock (AP-2), so
// that each statement pattern is proven on its own, and with REAL parallel connections: every
// participant is a session of its own, and every race is forced, not hoped for. A "holder"
// session takes the row lock first; the participants then send their statements and the test
// waits until the server reports every one of them WAITING for a lock (`pg_locks`); only then is
// the holder released. Nothing below depends on timing.
import { randomUUID } from 'node:crypto';
import type { Client, Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import {
  T,
  authSession,
  biometricToken,
  hash32,
  insertDevice,
  insertRbac,
  insertRow,
  pairedDevice,
  pairingCode,
} from './fixtures';
import { SQLSTATE, connect, expectRefused, until, waitingLocks } from './support';

const db = useTestDatabase({ template: 'schema' });
let app: Pool;
let owner: Pool;

const HOUR = 3_600_000;
const USER_ADMIN = 'USER_ADMIN';

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  await insertRbac(owner);
  await insertDevice(owner, 'DEV-0001', 'PCD-000001');
  await insertDevice(owner, 'DEV-0002', 'PCD-000002');
  await insertRow(owner, 'registry_counters', { name: 'device', next_value: 3 });
  await insertRow(owner, 'registry_counters', { name: 'pairingCode', next_value: 10 });
});

/** `count` sessions of the runtime role, each a connection of its own; closed after `body`. */
async function withSessions<T>(count: number, body: (sessions: Client[]) => Promise<T>): Promise<T> {
  const sessions: Client[] = [];
  try {
    for (let index = 0; index < count; index += 1) sessions.push(await connect(db.runtime, `dems-w17-at-${index}`));
    return await body(sessions);
  } finally {
    await Promise.all(sessions.map((session) => session.query('ROLLBACK').catch(() => undefined).then(() => session.end())));
  }
}

/** Waits until exactly `count` sessions of this database wait for a lock. */
const waiters = (count: number, what: string): Promise<void> => until(async () => (await waitingLocks(owner)) === count, what);

// ── The statements of §5.6, verbatim ───────────────────────────────────────────────────────────

const SIGN_IN_RECHECK = `UPDATE operators
   SET last_sign_in_at = $2, updated_at = $2
 WHERE id = $1 AND enabled
RETURNING id`;
const SESSION_ROTATE = `UPDATE auth_sessions
   SET ended_at = $2, end_reason = 'ROTATED'
 WHERE id = $3 AND ended_at IS NULL
RETURNING id`;
const SESSION_INSERT = `INSERT INTO auth_sessions (token_hash, operator_id, device_id, method,
                           issued_at, last_seen_at, absolute_expires_at)
VALUES ($4, $1, $5, $6, $2, $2, $7)`;

const CODE_CONSUME = `UPDATE pairing_codes
   SET failed_attempts = failed_attempts + 1
 WHERE state = 'ACTIVE' AND expires_at > $1 AND failed_attempts < 5
RETURNING id, code_hash, failed_attempts`;
const CODE_EXHAUST = `UPDATE pairing_codes
   SET state = 'EXHAUSTED', closed_at = $1
 WHERE id = $2 AND state = 'ACTIVE' AND failed_attempts = 5
RETURNING id`;
const CODE_REDEEM = `UPDATE pairing_codes
   SET state = 'REDEEMED', closed_at = $1, failed_attempts = failed_attempts - 1
 WHERE id = $2 AND state = 'ACTIVE' AND expires_at > $1
RETURNING id`;
const DEVICE_COUNTER = `UPDATE registry_counters
   SET next_value = next_value + 1
 WHERE name = 'device'
RETURNING next_value - 1`;
const DEVICE_INSERT = `INSERT INTO paired_devices (id, name, platform, app_version, state,
                            paired_at, paired_with_code_id, last_seen_at, updated_at)
VALUES ($3, $4, $5, $6, 'PAIRED', $1, $2, $1, $1)`;
const CREDENTIAL_INSERT = 'INSERT INTO device_credentials (device_id, current_hash) VALUES ($3, $7)';

const TOKEN_USE = `UPDATE biometric_tokens
   SET used_at = $2
 WHERE token_hash = $1 AND device_id = $3
   AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $2
RETURNING id, family_id, operator_id`;
const TOKEN_NEXT = `INSERT INTO biometric_tokens (token_hash, family_id, device_id, operator_id, issued_at, expires_at)
VALUES ($4, $5, $3, $6, $2, $7)`;
const TOKEN_SESSION = `INSERT INTO auth_sessions (token_hash, operator_id, device_id, method,
                           issued_at, last_seen_at, absolute_expires_at)
VALUES ($8, $6, $3, 'BIOMETRIC', $2, $2, $9)`;
const TOKEN_WHY = `SELECT id, family_id, device_id, operator_id, used_at, revoked_at, expires_at
  FROM biometric_tokens
 WHERE token_hash = $1`;
const FAMILY_REVOKE = `UPDATE biometric_tokens
   SET revoked_at = $2, revoke_reason = 'TOKEN_REUSE'
 WHERE family_id = $5 AND revoked_at IS NULL
RETURNING id`;
const FAMILY_SESSIONS_END = `UPDATE auth_sessions
   SET ended_at = $2, end_reason = 'TOKEN_REUSE'
 WHERE device_id = $10 AND operator_id = $11
   AND method = 'BIOMETRIC' AND ended_at IS NULL
RETURNING id`;

const OPERATORS_LOCK = `SELECT id, role_id, enabled
  FROM operators
 ORDER BY id
   FOR UPDATE`;
const PERMISSION_HOLDERS = 'SELECT role_id FROM role_permissions WHERE permission_id = $5';
const ASSIGN_ROLE = `UPDATE operators
   SET role_id = $2, role_changed_at = $3, updated_at = $3
 WHERE id = $1 AND role_id = $4
RETURNING id`;
const DISABLE_USER = `UPDATE operators
   SET enabled = false, updated_at = $3
 WHERE id = $1 AND enabled
RETURNING id`;
const DISABLE_SESSIONS = `UPDATE auth_sessions
   SET ended_at = $3, end_reason = 'USER_DISABLED'
 WHERE operator_id = $1 AND ended_at IS NULL
RETURNING id`;
const DISABLE_TOKENS = `UPDATE biometric_tokens
   SET revoked_at = $3, revoke_reason = 'USER_DISABLED'
 WHERE operator_id = $1 AND used_at IS NULL AND revoked_at IS NULL
RETURNING id`;

/**
 * The statements above number their parameters as the contract does ($1, $2, $5, ...). The
 * driver wants a dense list, so a statement is sent with the parameters it names, renumbered.
 */
function bound(statement: string, parameters: Record<number, unknown>): [string, unknown[]] {
  const used = [...new Set([...statement.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
  let text = statement;
  // Highest first, so that $1 is not replaced inside $10 or $11.
  for (const number of [...used].reverse()) text = text.replaceAll(`$${number}`, `§${used.indexOf(number) + 1}`);
  return [text.replaceAll('§', '$'), used.map((number) => parameters[number])];
}

const run = (session: Pick<Client, 'query'>, statement: string, parameters: Record<number, unknown>) =>
  session.query(...bound(statement, parameters));

describe('T-AT-1 (AT-C1): a sign-in re-checks the operator after the hash was computed', () => {
  const now = T + 1_000;
  const signIn = (session: Client, operatorId: string, marker: string) =>
    (async () => {
      const parameters = { 1: operatorId, 2: now, 4: hash32(`session:${marker}`), 5: null, 6: 'PASSWORD', 7: now + 8 * HOUR };
      const rechecked = await run(session, SIGN_IN_RECHECK, parameters);
      if (rechecked.rowCount === 1) await run(session, SESSION_INSERT, parameters);
      return rechecked.rowCount;
    })();

  it('control: with nobody else, the first UPDATE returns the operator and a session row is inserted', async () => {
    await withSessions(1, async ([session]) => {
      await session!.query('BEGIN');
      expect(await signIn(session!, 'OPR-003', 'control')).toBe(1);
      await session!.query('COMMIT');
    });
    const { rows } = await owner.query("SELECT method, device_id, end_reason FROM auth_sessions WHERE operator_id = 'OPR-003'");
    expect(rows).toEqual([{ method: 'PASSWORD', device_id: null, end_reason: null }]);
  });

  it('the operator is disabled by a transaction that commits first: the sign-in UPDATE returns no row and no session is inserted', async () => {
    await insertRow(owner, 'auth_sessions', authSession('open-before-disable', { operator_id: 'OPR-001' }));
    await withSessions(2, async ([signer, admin]) => {
      // B: the unit of AT-C5 that disables OPR-001. It locks every operator row.
      await admin!.query('BEGIN');
      const locked = await admin!.query(OPERATORS_LOCK);
      expect(locked.rowCount).toBe(4);
      expect((await run(admin!, DISABLE_USER, { 1: 'OPR-001', 3: now })).rowCount).toBe(1);
      expect((await run(admin!, DISABLE_SESSIONS, { 1: 'OPR-001', 3: now })).rowCount).toBe(1);
      await run(admin!, DISABLE_TOKENS, { 1: 'OPR-001', 3: now });

      // A: the sign-in of OPR-001, whose password hash was computed meanwhile. It waits on B's row lock.
      await signer!.query('BEGIN');
      const outcome = signIn(signer!, 'OPR-001', 'raced');
      await waiters(1, 'the sign-in waits for the row the disable holds');

      await admin!.query('COMMIT');
      // PG-24: the waiting UPDATE evaluates `enabled` again on the committed row.
      expect(await outcome).toBe(0);
      await signer!.query('COMMIT');
    });

    const sessions = await owner.query("SELECT end_reason FROM auth_sessions WHERE operator_id = 'OPR-001' ORDER BY issued_at");
    expect(sessions.rows).toEqual([{ end_reason: 'USER_DISABLED' }]);
    const state = await owner.query("SELECT enabled, last_sign_in_at FROM operators WHERE id = 'OPR-001'");
    expect(state.rows).toEqual([{ enabled: false, last_sign_in_at: null }]);
    await owner.query("UPDATE operators SET enabled = true WHERE id = 'OPR-001'");
  });

  it('a presented session is rotated by the compare-and-set of the same unit; a second rotate returns no row', async () => {
    const old = authSession('to-rotate', { operator_id: 'OPR-003' });
    await insertRow(owner, 'auth_sessions', old);
    expect((await run(app, SESSION_ROTATE, { 2: now, 3: old['id'] })).rowCount).toBe(1);
    expect((await run(app, SESSION_ROTATE, { 2: now, 3: old['id'] })).rowCount).toBe(0);
  });
});

describe('T-AT-2 (AT-C2): 20 concurrent wrong redeems take exactly five attempts and close the code', () => {
  it('exactly 5 statements return a row, with the values 1 to 5; 15 return none; the code ends EXHAUSTED', async () => {
    const now = T + 2_000;
    await insertRow(
      owner,
      'pairing_codes',
      pairingCode('PCD-000010', { state: 'ACTIVE', closed_at: null, issued_at: now - 1_000, expires_at: now + 300_000 }),
    );

    const outcomes = await withSessions(21, async ([holder, ...redeemers]) => {
      await holder!.query('BEGIN');
      await holder!.query("SELECT id FROM pairing_codes WHERE state = 'ACTIVE' FOR UPDATE");

      const attempts = redeemers.map(async (session) => {
        await session.query('BEGIN');
        const consumed = await run(session, CODE_CONSUME, { 1: now });
        const row = consumed.rows[0] as { id: string; failed_attempts: number } | undefined;
        let closed = 0;
        // The digits are wrong by construction; the request that took the fifth attempt closes the code.
        if (row?.failed_attempts === 5) closed = (await run(session, CODE_EXHAUST, { 1: now, 2: row.id })).rowCount ?? 0;
        await session.query('COMMIT');
        return { attempt: row?.failed_attempts ?? null, closed };
      });

      await waiters(20, 'all 20 consuming UPDATEs wait on the one ACTIVE row');
      await holder!.query('COMMIT');
      return Promise.all(attempts);
    });

    const taken = outcomes.flatMap((outcome) => (outcome.attempt === null ? [] : [outcome.attempt])).sort();
    expect(taken).toEqual([1, 2, 3, 4, 5]);
    expect(outcomes.filter((outcome) => outcome.attempt === null)).toHaveLength(15);
    expect(outcomes.reduce((sum, outcome) => sum + outcome.closed, 0)).toBe(1);

    const { rows } = await owner.query("SELECT state, failed_attempts, closed_at::text AS closed_at, closed_by_operator_id FROM pairing_codes WHERE id = 'PCD-000010'");
    expect(rows).toEqual([{ state: 'EXHAUSTED', failed_attempts: 5, closed_at: String(now), closed_by_operator_id: null }]);
    // No usable code is left: one more attempt gets no row, and nothing was compared.
    expect((await run(app, CODE_CONSUME, { 1: now })).rowCount).toBe(0);
    console.info(`[w17] T-AT-2: 20 sessions waited at once; attempts taken ${JSON.stringify(taken)}; 15 got no row; code EXHAUSTED at failed_attempts 5`);
  });
});

describe('T-AT-3 (AT-C3): the right code is redeemed once', () => {
  it('two concurrent redeems: one pairs a device, the other gets no row; one device, one credential; the counter moved by 1', async () => {
    const now = T + 3_000;
    await insertRow(
      owner,
      'pairing_codes',
      pairingCode('PCD-000011', { state: 'ACTIVE', closed_at: null, issued_at: now - 1_000, expires_at: now + 300_000, failed_attempts: 2 }),
    );
    const counterBefore = Number((await owner.query("SELECT next_value FROM registry_counters WHERE name = 'device'")).rows[0]?.next_value);

    const outcomes = await withSessions(3, async ([holder, ...redeemers]) => {
      await holder!.query('BEGIN');
      await holder!.query("SELECT id FROM pairing_codes WHERE state = 'ACTIVE' FOR UPDATE");

      const redeems = redeemers.map(async (session, index) => {
        await session.query('BEGIN');
        const consumed = await run(session, CODE_CONSUME, { 1: now });
        const row = consumed.rows[0] as { id: string; failed_attempts: number } | undefined;
        if (row === undefined) {
          await session.query('COMMIT');
          return { paired: null, attemptSeen: null };
        }
        // The comparison matched (5.2). Same transaction: redeem, mint the number, pair.
        expect((await run(session, CODE_REDEEM, { 1: now, 2: row.id })).rowCount).toBe(1);
        const minted = Number((await session.query(DEVICE_COUNTER)).rows[0]?.['?column?']);
        const deviceId = `DEV-${String(minted).padStart(4, '0')}`;
        const parameters = { 1: now, 2: row.id, 3: deviceId, 4: `Tablet ${index}`, 5: 'android', 6: '0.1.0', 7: hash32(`device:${index}`) };
        await run(session, DEVICE_INSERT, parameters);
        await run(session, CREDENTIAL_INSERT, parameters);
        await session.query('COMMIT');
        return { paired: deviceId, attemptSeen: row.failed_attempts };
      });

      await waiters(2, 'both redeems wait on the one ACTIVE row');
      await holder!.query('COMMIT');
      return Promise.all(redeems);
    });

    const winners = outcomes.filter((outcome) => outcome.paired !== null);
    expect(winners).toEqual([{ paired: `DEV-${String(counterBefore).padStart(4, '0')}`, attemptSeen: 3 }]);
    expect(outcomes.filter((outcome) => outcome.paired === null)).toHaveLength(1);

    const code = await owner.query("SELECT state, failed_attempts, closed_at::text AS closed_at FROM pairing_codes WHERE id = 'PCD-000011'");
    // REDEEMED with the failed_attempts it had before: the attempt taken was given back.
    expect(code.rows).toEqual([{ state: 'REDEEMED', failed_attempts: 2, closed_at: String(now) }]);
    const devices = await owner.query("SELECT d.id, c.device_id FROM paired_devices d JOIN device_credentials c ON c.device_id = d.id WHERE d.paired_with_code_id = 'PCD-000011'");
    expect(devices.rows).toEqual([{ id: winners[0]?.paired, device_id: winners[0]?.paired }]);
    const counterAfter = Number((await owner.query("SELECT next_value FROM registry_counters WHERE name = 'device'")).rows[0]?.next_value);
    expect(counterAfter).toBe(counterBefore + 1);

    // The last line of defence: a second device for the same code fails on the UNIQUE constraint.
    await expectRefused(
      () => insertRow(owner, 'paired_devices', pairedDevice('DEV-0099', 'PCD-000011')),
      SQLSTATE.uniqueViolation,
      'paired_devices_paired_with_code_id_key',
    );
  });

  it('AT-5: 20 concurrent mints of the device counter give 20 different numbers', async () => {
    const before = Number((await owner.query("SELECT next_value FROM registry_counters WHERE name = 'device'")).rows[0]?.next_value);
    const minted = await withSessions(20, (sessions) =>
      Promise.all(
        sessions.map(async (session) => {
          await session.query('BEGIN');
          const value = Number((await session.query(DEVICE_COUNTER)).rows[0]?.['?column?']);
          await session.query('COMMIT');
          return value;
        }),
      ),
    );
    expect([...minted].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => before + index));
  });
});

describe('T-AT-4 (AT-C4): a biometric token is used once; a reuse ends the sessions of its family', () => {
  const now = T + 4_000;
  const family = randomUUID();
  const presented = hash32('biometric:presented');
  const next = hash32('biometric:next');
  const base = { 1: presented, 2: now, 3: 'DEV-0001', 4: next, 5: family, 7: now + 30 * 24 * HOUR, 9: now + 8 * HOUR };

  it('(a) two concurrent uses of one token: one row in total; one new token row and one new session row', async () => {
    await insertRow(owner, 'biometric_tokens', biometricToken('presented', { token_hash: presented, family_id: family, operator_id: 'OPR-002' }));

    const outcomes = await withSessions(3, async ([holder, ...users]) => {
      await holder!.query('BEGIN');
      await holder!.query('SELECT id FROM biometric_tokens WHERE token_hash = $1 FOR UPDATE', [presented]);

      const uses = users.map(async (session, index) => {
        await session.query('BEGIN');
        const used = await run(session, TOKEN_USE, base);
        const row = used.rows[0] as { id: string; family_id: string; operator_id: string } | undefined;
        if (row !== undefined) {
          expect(row.family_id).toBe(family);
          const parameters = { ...base, 6: row.operator_id, 8: hash32(`biometric-session:${index}`) };
          await run(session, TOKEN_NEXT, parameters);
          await run(session, TOKEN_SESSION, parameters);
        }
        await session.query('COMMIT');
        return used.rowCount;
      });

      await waiters(2, 'both uses wait on the one token row');
      await holder!.query('COMMIT');
      return Promise.all(uses);
    });

    expect([...outcomes].sort()).toEqual([0, 1]);
    const tokens = await owner.query('SELECT used_at IS NOT NULL AS used, revoked_at FROM biometric_tokens WHERE family_id = $1 ORDER BY issued_at, used_at NULLS LAST', [family]);
    expect(tokens.rows).toEqual([
      { used: true, revoked_at: null },
      { used: false, revoked_at: null },
    ]);
    const sessions = await owner.query("SELECT operator_id, device_id, end_reason FROM auth_sessions WHERE method = 'BIOMETRIC'");
    expect(sessions.rows).toEqual([{ operator_id: 'OPR-002', device_id: 'DEV-0001', end_reason: null }]);
  });

  it('(b) the used token is presented again: the family is revoked and only the BIOMETRIC session of that device and operator ends', async () => {
    // The same operator also has an open PASSWORD session on that device and a BIOMETRIC session on another device.
    const password = authSession('password-on-device', { operator_id: 'OPR-002', device_id: 'DEV-0001', method: 'PASSWORD' });
    const elsewhere = authSession('biometric-elsewhere', { operator_id: 'OPR-002', device_id: 'DEV-0002', method: 'BIOMETRIC' });
    await insertRow(owner, 'auth_sessions', password);
    await insertRow(owner, 'auth_sessions', elsewhere);

    const later = now + 500;
    const reuse = { ...base, 2: later };
    const ended = await withSessions(1, async ([session]) => {
      await session!.query('BEGIN');
      expect((await run(session!, TOKEN_USE, reuse)).rowCount).toBe(0);
      const why = (await run(session!, TOKEN_WHY, reuse)).rows[0] as { family_id: string; device_id: string; operator_id: string; used_at: string | null };
      expect(why.used_at).not.toBeNull(); // used_at is set: TOKEN_REUSE
      expect((await run(session!, FAMILY_REVOKE, { ...reuse, 5: why.family_id })).rowCount).toBe(2);
      const result = await run(session!, FAMILY_SESSIONS_END, { ...reuse, 10: why.device_id, 11: why.operator_id });
      await session!.query('COMMIT');
      return result.rowCount;
    });
    expect(ended).toBe(1);

    const tokens = await owner.query('SELECT revoked_at::text AS revoked_at, revoke_reason FROM biometric_tokens WHERE family_id = $1', [family]);
    expect(tokens.rows).toEqual([
      { revoked_at: String(later), revoke_reason: 'TOKEN_REUSE' },
      { revoked_at: String(later), revoke_reason: 'TOKEN_REUSE' },
    ]);
    const sessions = await owner.query(
      "SELECT method, device_id, end_reason FROM auth_sessions WHERE operator_id = 'OPR-002' AND device_id IS NOT NULL ORDER BY device_id, method",
    );
    expect(sessions.rows).toEqual([
      { method: 'BIOMETRIC', device_id: 'DEV-0001', end_reason: 'TOKEN_REUSE' },
      { method: 'PASSWORD', device_id: 'DEV-0001', end_reason: null },
      { method: 'BIOMETRIC', device_id: 'DEV-0002', end_reason: null },
    ]);

    // An UPDATE that ends a PASSWORD session with TOKEN_REUSE fails on the CHECK.
    await expectRefused(
      () => app.query("UPDATE auth_sessions SET ended_at = $1, end_reason = 'TOKEN_REUSE' WHERE id = $2", [later, password['id']]),
      SQLSTATE.checkViolation,
      'auth_sessions_token_reuse_check',
    );
  });
});

describe('T-AT-5 (AT-C5): the last administrator, under the lock on every operator row', () => {
  /** What the server does with the locked rows: apply the change, count the enabled holders of USER_ADMIN. */
  async function change(
    session: Client,
    request: { kind: 'demote'; operatorId: string } | { kind: 'disable'; operatorId: string },
    onLocked?: () => void,
  ): Promise<'changed' | 'LAST_ADMIN'> {
    const now = T + 5_000;
    await session.query('BEGIN');
    const locked = (await session.query(OPERATORS_LOCK)).rows as Array<{ id: string; role_id: string; enabled: boolean }>;
    onLocked?.();
    const holders = new Set((await run(session, PERMISSION_HOLDERS, { 5: USER_ADMIN })).rows.map((row: { role_id: string }) => row.role_id));
    const target = locked.find((row) => row.id === request.operatorId);
    const after = locked.map((row) =>
      row.id !== request.operatorId ? row : request.kind === 'demote' ? { ...row, role_id: 'INVESTIGATOR' } : { ...row, enabled: false },
    );
    if (after.filter((row) => row.enabled && holders.has(row.role_id)).length === 0) {
      await session.query('ROLLBACK');
      return 'LAST_ADMIN';
    }
    const changed =
      request.kind === 'demote'
        ? await run(session, ASSIGN_ROLE, { 1: request.operatorId, 2: 'INVESTIGATOR', 3: now, 4: target?.role_id })
        : await run(session, DISABLE_USER, { 1: request.operatorId, 3: now });
    expect(changed.rowCount).toBe(1);
    await session.query('COMMIT');
    return 'changed';
  }

  const administrators = async (): Promise<string[]> =>
    (
      await owner.query<{ id: string }>(
        `SELECT o.id FROM operators o JOIN role_permissions rp ON rp.role_id = o.role_id
          WHERE rp.permission_id = $1 AND o.enabled ORDER BY o.id`,
        [USER_ADMIN],
      )
    ).rows.map((row) => row.id);

  async function restore(): Promise<void> {
    await owner.query("UPDATE operators SET role_id = 'SUPERVISOR', enabled = true WHERE id IN ('OPR-002', 'OPR-004')");
  }

  it.each([
    ['two demotions, one of each administrator', { kind: 'demote', operatorId: 'OPR-002' }, { kind: 'demote', operatorId: 'OPR-004' }],
    ['one demotion and one disable', { kind: 'demote', operatorId: 'OPR-002' }, { kind: 'disable', operatorId: 'OPR-004' }],
  ] as const)('%s: the second waits at the SELECT, then counts one administrator and refuses', async (_label, first, second) => {
    await restore();
    expect(await administrators()).toEqual(['OPR-002', 'OPR-004']);

    const results = await withSessions(2, async ([a, b]) => {
      // A takes the lock on every operator row and stops there.
      await a!.query('BEGIN');
      await a!.query(OPERATORS_LOCK);

      // B asks for the same lock: it waits at the SELECT.
      let secondLocked = false;
      const outcomeB = change(b!, second, () => {
        secondLocked = true;
      });
      await waiters(1, 'the second change waits at the lock SELECT');
      expect(secondLocked).toBe(false);

      // A finishes its change and commits; only then does B's SELECT return, with A's committed result (PG-05).
      const holders = new Set((await run(a!, PERMISSION_HOLDERS, { 5: USER_ADMIN })).rows.map((row: { role_id: string }) => row.role_id));
      expect([...holders]).toEqual(['SUPERVISOR']);
      expect((await run(a!, ASSIGN_ROLE, { 1: first.operatorId, 2: 'INVESTIGATOR', 3: T + 5_000, 4: 'SUPERVISOR' })).rowCount).toBe(1);
      await a!.query('COMMIT');
      return { first: 'changed' as const, second: await outcomeB, secondLocked };
    });

    expect(results).toEqual({ first: 'changed', second: 'LAST_ADMIN', secondLocked: true });
    // Afterwards one enabled operator holds USER_ADMIN.
    expect(await administrators()).toEqual(['OPR-004']);
    await restore();
  });

  it('the runtime role may take the lock with a column-level UPDATE grant only (PG-25), and may not change an identity column', async () => {
    const { rows } = await app.query(
      `SELECT has_table_privilege('dems_app', 'public.operators', 'UPDATE') AS whole_table,
              has_any_column_privilege('dems_app', 'public.operators', 'UPDATE') AS some_column`,
    );
    expect(rows).toEqual([{ whole_table: false, some_column: true }]);
    await expectRefused(() => app.query("UPDATE operators SET username = 'x' WHERE id = 'OPR-001'"), SQLSTATE.insufficientPrivilege);
    // REVISED 2026-11-02 (RB-9, 0035; purge amendment, principal PT GSP, 0036): the identity column
    // itself stays closed to the runtime role — `id` joins no UPDATE list — while DELETE is now a
    // granted privilege (the purge erases the account), so the whole-DELETE probe reaches the
    // RESTRICT of the credential foreign key instead of the old 42501.
    await expectRefused(() => app.query("UPDATE operators SET id = 'OPR-009' WHERE id = 'OPR-001'"), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query("DELETE FROM operators WHERE id = 'OPR-001'"), SQLSTATE.restrictViolation, 'operator_credentials_operator_id_fkey');
  });
});

describe('the other transitions of §5.6 (AT-3): the row count decides', () => {
  it('end, touch, cancel, expire, revoke, unpair and promote each change one row once, and none the second time', async () => {
    const now = T + 6_000;
    const session = authSession('transitions', { operator_id: 'OPR-003', issued_at: now, last_seen_at: now, absolute_expires_at: now + 8 * HOUR });
    await insertRow(owner, 'auth_sessions', session);
    const touch = 'UPDATE auth_sessions SET last_seen_at = $2 WHERE id = $1 AND ended_at IS NULL AND last_seen_at < $2 RETURNING id';
    expect((await app.query(touch, [session['id'], now + 10])).rowCount).toBe(1);
    expect((await app.query(touch, [session['id'], now + 10])).rowCount).toBe(0); // a newer touch exists
    const end = 'UPDATE auth_sessions SET ended_at = $2, end_reason = $3 WHERE id = $1 AND ended_at IS NULL RETURNING id';
    expect((await app.query(end, [session['id'], now + 20, 'SIGNED_OUT'])).rowCount).toBe(1);
    expect((await app.query(end, [session['id'], now + 30, 'IDLE_EXPIRED'])).rowCount).toBe(0); // already ended
    expect((await app.query(touch, [session['id'], now + 40])).rowCount).toBe(0); // ended

    await insertRow(owner, 'pairing_codes', pairingCode('PCD-000020', { state: 'ACTIVE', closed_at: null, issued_at: now, expires_at: now + 300_000 }));
    // "One active code at a time" is a database rule: a second ACTIVE row is refused.
    await expectRefused(
      () => insertRow(app, 'pairing_codes', pairingCode('PCD-000021', { state: 'ACTIVE', closed_at: null, issued_at: now, expires_at: now + 300_000 })),
      SQLSTATE.uniqueViolation,
      'pairing_codes_one_active_key',
    );
    const expire = "UPDATE pairing_codes SET state = 'EXPIRED', closed_at = $1 WHERE state = 'ACTIVE' AND expires_at <= $1 RETURNING id";
    expect((await app.query(expire, [now + 1])).rowCount).toBe(0); // not expired yet
    const cancel = "UPDATE pairing_codes SET state = 'CANCELLED', closed_at = $1, closed_by_operator_id = $2 WHERE state = 'ACTIVE' RETURNING id";
    expect((await app.query(cancel, [now + 2, 'OPR-002'])).rows).toEqual([{ id: 'PCD-000020' }]);
    expect((await app.query(cancel, [now + 3, 'OPR-002'])).rowCount).toBe(0); // no active code
    // The new code is then inserted, by the runtime role.
    await insertRow(app, 'pairing_codes', pairingCode('PCD-000021', { state: 'ACTIVE', closed_at: null, issued_at: now, expires_at: now + 300_000 }));
    expect((await app.query(expire, [now + 300_000])).rows).toEqual([{ id: 'PCD-000021' }]);

    const revoke =
      "UPDATE paired_devices SET state = 'REVOKED', revoked_at = $2, revoked_by_operator_id = $3, revoke_reason = $4, updated_at = $2 WHERE id = $1 AND state = 'PAIRED' RETURNING id";
    expect((await app.query(revoke, ['DEV-0002', now, 'OPR-002', 'Fixture: lost tablet'])).rowCount).toBe(1);
    expect((await app.query(revoke, ['DEV-0002', now, 'OPR-002', 'Fixture: lost tablet'])).rowCount).toBe(0);
    const unpair = "UPDATE paired_devices SET state = 'UNPAIRED', unpaired_at = $2, updated_at = $2 WHERE id = $1 AND state = 'PAIRED' RETURNING id";
    expect((await app.query(unpair, ['DEV-0002', now])).rowCount).toBe(0); // not PAIRED any more

    // Promote a rotated credential (5.2): the first presentation of next_hash promotes it, once.
    const rotated = hash32('device-credential:rotated');
    await app.query('UPDATE device_credentials SET next_hash = $1, rotated_at = $2 WHERE device_id = $3', [rotated, now, 'DEV-0001']);
    const promote = 'UPDATE device_credentials SET current_hash = next_hash, next_hash = NULL WHERE device_id = $2 AND next_hash = $1 RETURNING device_id';
    expect((await app.query(promote, [rotated, 'DEV-0001'])).rowCount).toBe(1);
    expect((await app.query(promote, [rotated, 'DEV-0001'])).rowCount).toBe(0); // promoted by another request
    const lookup = await app.query('SELECT device_id FROM device_credentials WHERE current_hash = $1 OR next_hash = $1', [rotated]);
    expect(lookup.rows).toEqual([{ device_id: 'DEV-0001' }]);
  });
});
