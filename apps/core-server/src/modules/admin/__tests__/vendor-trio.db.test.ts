// The vendor-only trio against PostgreSQL (RB-9 as amended by the principal, PT GSP, 02-11-2026;
// spec §4.6 RB-8, §4.7, §7.6 operations 15 to 17; decision U19; database contract §5.6 AT-3;
// migration 0036: the purge, its ticket, its ledger and its re-seal).
//
// `vendor-root.test.ts` runs the unit of work on an in-memory table and proves the behaviour of a
// refusal. THIS file is the promise that file makes but cannot keep: the same three operations on
// the real database, through the real stages 3 to 6, booted — what a 403 leaves untouched in the
// tables, what a create really writes, what a purge really erases, and whether the hash chain
// still verifies afterwards. No stage is replaced; the sessions are real sign-ins.
//
// The vendor account: the seed holds no `root`, so the file renames the seeded SUPERVISOR into it
// (a fixture behind the server's back, as `demos_owner`, exactly like `putOperator`). The
// positive control of every refusal is the same call by that account.
import { validateCoreApiResponse, type AdminUser, type DeletedUser } from '@dems/shared/api';
import { AuditType, OPERATORS, verifyAuditChain, type PurgedRange } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readHead, readTrail } from '../../../../test/support/core';
import { PURGE_KEPT_AUDIT_TYPES } from '../statements';
import { webSignIn, type Headers } from '../../../../test/support/identity';
import {
  INVESTIGATOR,
  SUPERVISOR,
  TECHNICIAN,
  USERS,
  adminApp,
  forgetCounters,
  outcome,
  publicationLines,
  putOperator,
  roleUrl,
  signInWeb,
  storedOperators,
  web,
  type AdminApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });

// Same wide limits as the other rows' files: a clone, a boot and a sign-in take many times their
// usual time under load; a real hang still fails, later.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

let admin: AdminApp;
let owner: Pool;
/** The vendor account: the renamed seeded SUPERVISOR (`OPR-002`), signed in on the web console. */
let root: Headers;
/** The seeded INVESTIGATOR: a holder of no administration permission. */
let investigator: Headers;

const profileUrl = (operatorId: string): string => `${USERS}/${operatorId}/profile`;
const deleteUrl = (operatorId: string): string => `${USERS}/${operatorId}/delete`;

const MARKER = 'MARK-rb9-reason covers the vendor trio';
const NEW_USERNAME = 'vendortest';
const NEW_BODY = { username: NEW_USERNAME, name: 'Vendor Testaccount', initials: 'VT', role: 'INVESTIGATOR', reason: MARKER };

const trailLength = async (): Promise<number> => (await readTrail(owner)).length;
const since = async (from: number) => (await readTrail(owner)).slice(from);
const user = (response: Awaited<ReturnType<typeof web>>): AdminUser => response.json() as AdminUser;

/** Everything a refusal must leave as it was (the shape of `users.db.test.ts`). */
async function everything() {
  return {
    operators: await storedOperators(owner),
    trail: await trailLength(),
    events: (await readEvents(owner)).length,
    revision: admin.app.engine.revision,
    engineOperators: admin.app.engine.slice('operators'),
  };
}

/** The rows of one table for one operator, for a capture/restore around the purge. */
const rowsOf = async (table: string, column: string, operatorId: string): Promise<Record<string, unknown>[]> =>
  (await owner.query(`SELECT * FROM public.${table} WHERE ${column} = $1`, [operatorId])).rows;

/** Puts captured rows back verbatim (the purge test restores what it erased, for the next file's clone). */
async function restore(table: string, rows: readonly Record<string, unknown>[]): Promise<void> {
  for (const row of rows) {
    const columns = Object.keys(row);
    const text = `INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${columns.map((_c, i) => `$${i + 1}`).join(', ')})`;
    await owner.query(text, columns.map((column) => row[column]));
  }
}

/** Counts of what belongs to one operator, read as `dems_owner`. */
async function belongingTo(operatorId: string) {
  const one = async (sql: string): Promise<number> => Number((await owner.query(sql, [operatorId])).rows[0]?.n ?? 0);
  return {
    audit: await one('SELECT count(*)::int AS n FROM public.audit_log WHERE actor_id = $1'),
    signIns: await one('SELECT count(*)::int AS n FROM public.auth_sessions WHERE operator_id = $1'),
    credentials: await one('SELECT count(*)::int AS n FROM public.operator_credentials WHERE operator_id = $1'),
    openSessions: await one('SELECT count(*)::int AS n FROM public.auth_sessions WHERE operator_id = $1 AND ended_at IS NULL'),
  };
}

beforeAll(async () => {
  owner = db.ownerPool();
  admin = await adminApp(db);
  // The vendor account is an identity, not a role: the rename makes the seeded SUPERVISOR the one
  // username the narrowed rule accepts, keeping its seeded credential so it can sign in.
  await owner.query('UPDATE public.operators SET username = $2 WHERE id = $1', [SUPERVISOR.id, 'root']);
  root = await signInWeb(admin, 'root');
  investigator = await signInWeb(admin, INVESTIGATOR.username);
  await admin.app.pipeline.drain();
});

beforeEach(() => {
  forgetCounters(admin);
  admin.published.length = 0;
});

afterEach(async () => {
  await admin.app.pipeline.drain();
  for (const seeded of OPERATORS) await putOperator(owner, seeded.id, { role: seeded.role, enabled: true });
  await owner.query('UPDATE public.operators SET role_changed_at = NULL');
  // Any account a test created: it never acted (it holds no credential), so nothing references it.
  await owner.query('DELETE FROM public.operators WHERE id <> ALL($1)', [OPERATORS.map((seeded) => seeded.id)]);
  await admin.app.engine.mirrorOperators();
});

describe('the identity gate on the real tables', () => {
  // A holder of USER_ADMIN who is not `root`: the seeded INVESTIGATOR promoted behind the server's
  // back, exactly as `users.db.test.ts` promotes for the permission checks.
  const promoteInvestigator = async (): Promise<void> => {
    await putOperator(owner, INVESTIGATOR.id, { role: 'SUPERVISOR', enabled: true });
    await admin.app.engine.mirrorOperators();
  };

  it.each([
    ['createUser', () => web(admin.app, investigator, 'POST', USERS, NEW_BODY)],
    ['updateUser', () => web(admin.app, investigator, 'POST', profileUrl(TECHNICIAN.id), { name: 'Renamed Behind the Gate', reason: MARKER })],
    ['deleteUser', () => web(admin.app, investigator, 'POST', deleteUrl(TECHNICIAN.id), { confirm: TECHNICIAN.username, reason: MARKER })],
  ] as const)('%s: USER_ADMIN without the root username is 403 NOT_PERMITTED and the tables do not move', async (_name, call) => {
    await promoteInvestigator();
    // The mirror of the promotion publishes a state change of its own: the assertion below is
    // about what the REFUSED call publishes, which must be nothing.
    admin.published.length = 0;
    const before = await everything();
    const response = await call();
    expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
    // The refusal is a transaction that rolled back: no USER_* row, no ACCESS_DENIED row either —
    // stage 6 passed; the narrowed rule refused inside the unit.
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
  });

  it('the same three calls by the vendor root pass the gate (positive control)', async () => {
    const created = await web(admin.app, root, 'POST', USERS, NEW_BODY);
    expect(created.statusCode).toBe(200);
    const id = user(created).id;
    expect(outcome(await web(admin.app, root, 'POST', profileUrl(id), { name: 'Vendor Renamed', reason: MARKER }))[0]).toBe(200);
    const removed = await web(admin.app, root, 'POST', deleteUrl(id), { confirm: NEW_USERNAME, reason: MARKER });
    expect(removed.statusCode, removed.body.slice(0, 400) + ' || LOG: ' + admin.log.text().slice(-1500)).toBe(200);
  });
});

describe('operation 15 createUser', () => {
  it('an enabled account with no credential, one USER_CREATED row, one publication', async () => {
    const before = await everything();
    const response = await web(admin.app, root, 'POST', USERS, NEW_BODY);
    expect(response.statusCode).toBe(200);
    const body = user(response);
    expect(validateCoreApiResponse('createUser', 200, body)).toEqual({ ok: true });
    expect(body).toMatchObject({ username: NEW_USERNAME, name: 'Vendor Testaccount', displayName: 'Vendor Testaccount', initials: 'VT', role: 'INVESTIGATOR', enabled: true, lastSignInAt: null });
    expect(body.id).toMatch(/^OPR-[0-9]{3}$/);
    // The next free ID beside the three seeded ones.
    expect(body.id).toBe('OPR-004');
    // Stored, and stored WITHOUT a credential: the account cannot sign in until the host command
    // sets a password (U19) — the refusal is the ordinary unknown-credential one.
    expect((await storedOperators(owner)).map((operator) => operator.id)).toEqual(['OPR-001', 'OPR-002', 'OPR-003', 'OPR-004']);
    expect(await belongingTo('OPR-004')).toMatchObject({ credentials: 0, signIns: 0 });
    expect(outcome(await webSignIn(admin.app, NEW_USERNAME))).toEqual([401, 'INVALID_CREDENTIALS']);
    // One audit row naming the target and the acting root; the engine mirror and the list notice.
    const rows = await since(before.trail);
    const created = rows.filter((row) => row.type === AuditType.USER_CREATED);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ actorId: SUPERVISOR.id, details: { targetOperatorId: 'OPR-004', role: 'INVESTIGATOR' } });
    expect(publicationLines(admin.published)).toContain('admin.changed USERS');
    // The list carries the new row.
    const list = (await web(admin.app, root, 'GET', USERS)).json() as { users: AdminUser[] };
    expect(list.users.map((entry) => entry.id)).toEqual(['OPR-001', 'OPR-002', 'OPR-003', 'OPR-004']);
  });

  it('a username that is taken answers 422 INVALID_INPUT and writes no row of any kind', async () => {
    const before = await everything();
    const response = await web(admin.app, root, 'POST', USERS, { ...NEW_BODY, username: INVESTIGATOR.username });
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
  });
});

describe('operation 16 updateUser', () => {
  it('a profile change writes the row, the USER_UPDATED fields and the mirror', async () => {
    expect((await web(admin.app, root, 'POST', USERS, NEW_BODY)).statusCode).toBe(200);
    const before = await trailLength();
    const response = await web(admin.app, root, 'POST', profileUrl('OPR-004'), { name: 'Vendor Renamed', initials: 'VR', reason: MARKER });
    expect(response.statusCode).toBe(200);
    expect(user(response)).toMatchObject({ name: 'Vendor Renamed', initials: 'VR', displayName: 'Vendor Testaccount' });
    const rows = (await since(before)).filter((row) => row.type === AuditType.USER_UPDATED);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: SUPERVISOR.id, details: { targetOperatorId: 'OPR-004', fields: 'name,initials' } });
    // The mirror of the slice runs on the engine's manual timer (decision D77): the publication
    // is the evidence here; what the tick then does to the slice belongs to the engine's own rows.
  });

  it('a request that changes nothing answers the row, writes no audit row and publishes nothing', async () => {
    expect((await web(admin.app, root, 'POST', USERS, NEW_BODY)).statusCode).toBe(200);
    admin.published.length = 0;
    const before = await everything();
    const response = await web(admin.app, root, 'POST', profileUrl('OPR-004'), { name: 'Vendor Testaccount', reason: MARKER });
    expect(response.statusCode).toBe(200);
    expect(user(response).name).toBe('Vendor Testaccount');
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
  });

  it('an unknown operator is 404 before the gate matters', async () => {
    expect(outcome(await web(admin.app, root, 'POST', profileUrl('OPR-900'), { name: 'Nobody', reason: MARKER }))).toEqual([404, 'NOT_FOUND']);
  });
});

describe('operation 17 deleteUser: the refusals', () => {
  it('a confirm that does not repeat the username is 409 INVALID_STATE and the account stays', async () => {
    expect((await web(admin.app, root, 'POST', USERS, NEW_BODY)).statusCode).toBe(200);
    admin.published.length = 0;
    const before = await everything();
    const response = await web(admin.app, root, 'POST', deleteUrl('OPR-004'), { confirm: 'someone.else', reason: MARKER });
    expect(outcome(response)).toEqual([409, 'INVALID_STATE']);
    expect(await everything()).toEqual(before);
    expect(admin.published).toEqual([]);
  });

  it('the confirm is trimmed and lower-cased like the rule says', async () => {
    expect((await web(admin.app, root, 'POST', USERS, NEW_BODY)).statusCode).toBe(200);
    const response = await web(admin.app, root, 'POST', deleteUrl('OPR-004'), { confirm: `  ${NEW_USERNAME.toUpperCase()}  `, reason: MARKER });
    expect(response.statusCode).toBe(200);
    expect((await storedOperators(owner)).some((operator) => operator.id === 'OPR-004')).toBe(false);
  });

  it('a delete that would leave no enabled holder of USER_ADMIN is 409 LAST_ADMIN', async () => {
    // After the afterEach of the previous tests the only enabled administrator is the root itself.
    const before = await everything();
    const response = await web(admin.app, root, 'POST', deleteUrl(SUPERVISOR.id), { confirm: 'root', reason: MARKER });
    expect(outcome(response)).toEqual([409, 'LAST_ADMIN']);
    expect(await everything()).toEqual(before);
  });
});

describe('operation 17 deleteUser: the purge and the re-sealed chain (migration 0036)', () => {
  it('the account, its history and its sessions go; the unit keeps its records; the chain verifies', async () => {
    // Give the target a history: promote it so it can act, sign it in once more (a sign-in row),
    // and let it write one audited change of its own.
    await putOperator(owner, INVESTIGATOR.id, { role: 'SUPERVISOR', enabled: true });
    await admin.app.engine.mirrorOperators();
    const extra = await signInWeb(admin, INVESTIGATOR.username);
    expect((await web(admin.app, extra, 'POST', roleUrl(TECHNICIAN.id), { role: 'INVESTIGATOR', reason: MARKER })).statusCode).toBe(200);
    await admin.app.pipeline.drain();

    const capturedOperators = await rowsOf('operators', 'id', INVESTIGATOR.id);
    const capturedCredentials = await rowsOf('operator_credentials', 'operator_id', INVESTIGATOR.id);
    const before = await belongingTo(INVESTIGATOR.id);
    expect(before.audit).toBeGreaterThan(0);
    expect(before.credentials).toBe(1);
    // Row 95 (migration 0043; D22(4), D38 DR-1): the seeded investigator wrote evidence-chain rows of
    // the seeded sessions (measured 2026-11-05 on the idle seed state: 31 of OPR-001's rows are of the
    // kept types). Those stay, and so does the account row, disabled; only the rest is removed.
    const keptBefore = Number(
      (await owner.query('SELECT count(*)::int AS n FROM public.audit_log WHERE actor_id = $1 AND type = ANY($2::text[])', [INVESTIGATOR.id, PURGE_KEPT_AUDIT_TYPES])).rows[0]?.n ?? 0,
    );
    expect(keptBefore).toBeGreaterThan(0);
    const removed = before.audit - keptBefore;
    expect(removed).toBeGreaterThan(0);
    // New rows are found by sequence ABOVE the head taken now, not by an index slice: the purge
    // removes rows from the middle of the trail and shifts every index below the new ones.
    const seqBefore = (await readHead(owner)).seq;
    const trailBefore = await trailLength();

    let thrown: unknown = null;
    try {
      const response = await web(admin.app, root, 'POST', deleteUrl(INVESTIGATOR.id), { confirm: INVESTIGATOR.username, reason: MARKER });
      expect(response.statusCode, response.body.slice(0, 300) + ' || LOG: ' + admin.log.text().slice(-1200)).toBe(200);
      const deleted = response.json() as DeletedUser;
      expect(validateCoreApiResponse('deleteUser', 200, deleted)).toEqual({ ok: true });
      expect(deleted).toMatchObject({ operatorId: INVESTIGATOR.id, username: INVESTIGATOR.username, credentialsRemoved: 1 });
      expect(deleted.sessionsEnded).toBeGreaterThanOrEqual(2);

      // What belonged to the account is gone; its evidence-chain rows stay, and its row stays disabled (D38 DR-1).
      expect(await belongingTo(INVESTIGATOR.id)).toEqual({ audit: keptBefore, signIns: 0, credentials: 0, openSessions: 0 });
      expect((await storedOperators(owner)).find((operator) => operator.id === INVESTIGATOR.id)).toMatchObject({ enabled: false });

      // The announcement names the erasure, and the ledger records it with the same counts.
      const rows = (await readTrail(owner)).filter((row) => row.seq > seqBefore);
      const announced = rows.filter((row) => row.type === AuditType.USER_DELETED);
      expect(announced).toHaveLength(1);
      expect(announced[0]).toMatchObject({
        actorId: SUPERVISOR.id,
        details: { targetOperatorId: INVESTIGATOR.id, auditRowsRemoved: removed, signInRowsRemoved: before.signIns, credentialsRemoved: 1, recordsLeftUnattributed: 0 },
      });
      expect(announced[0]?.message).toMatch(/; evidence-chain rows kept, account kept disabled$/);
      const ledger = (await owner.query('SELECT operator_id, actor_id, first_seq, last_seq, rows_removed FROM public.audit_purge_log')).rows;
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ operator_id: INVESTIGATOR.id, actor_id: SUPERVISOR.id, rows_removed: removed });

      // The chain over what survives: links continuous, digests right, the hole covered by the
      // ledger alone — the judgement of boot check B-8, recomputed here.
      const trail = await readTrail(owner);
      const head = await readHead(owner);
      const purged: PurgedRange[] = ledger.map((row) => ({ from: Number(row.first_seq), to: Number(row.last_seq) }));
      expect(trail).toHaveLength(trailBefore + 1 - removed);
      expect(verifyAuditChain({ rows: [...trail], head: head.hash, total: head.seq, dropped: 0 }, purged).ok).toBe(true);

      // The sessions ended and the list moved.
      expect(publicationLines(admin.published)).toEqual(expect.arrayContaining([expect.stringMatching(/^session\.ended USER_DISABLED/), 'admin.changed USERS']));
    } catch (error) {
      thrown = error;
    }
    // The next tests need their seeded INVESTIGATOR back: the rows go in verbatim. The purged
    // audit rows stay purged — every assertion of this file counts relative to its own start.
    // A failure of the test itself outranks a failure of the restore in the report.
    try {
      // The parent first: the credential rides its operator_id foreign key. Row 95: the row is still
      // there (kept, disabled); `afterEach` enables it again, so only a missing row is put back.
      if (!(await storedOperators(owner)).some((operator) => operator.id === INVESTIGATOR.id)) await restore('operators', capturedOperators);
      await restore('operator_credentials', capturedCredentials);
      await admin.app.engine.mirrorOperators();
    } catch (error) {
      if (thrown === null) thrown = error;
      else console.error('[vendor-trio] the restore failed too:', error);
    }
    if (thrown !== null) throw thrown;
  });
});
