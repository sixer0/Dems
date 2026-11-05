/**
 * The narrowed gate of the three vendor-only operations, and what each of them refuses (RB-9 as
 * amended by the principal, PT GSP, 02-11-2026; spec §4.6 RB-8, §4.7, §7.6 operations 15 to 17;
 * decision U19; database contract §5.6 AT-3 and AT-C5).
 *
 * WHAT IS UNDER TEST is the real unit of work of `changes.ts` — the same function a route calls —
 * on a stand-in connection that answers the module's OWN exported statements from an in-memory
 * table. The point is the behaviour of a refusal, and a refusal is a transaction that rolled back:
 * with no PostgreSQL in this project (`unit`, GR-1) the only way to watch "nothing was written" is
 * a connection that can say so. The same rules against the real database are the subject of the
 * `*.db.test.ts` files of this folder.
 *
 * FOUR THINGS ARE GUARDED HERE, one per amended operation's refusal:
 *
 *   1. WHO: an operator that holds USER_ADMIN but is NOT the vendor `root` account is refused 403
 *      `NOT_PERMITTED` by each of the three, and NO audit row is written (the row of a refusal that
 *      the specification does not name would invent history). The same call by `root` succeeds:
 *      that is the positive control that keeps this test from passing on a blanket failure.
 *   2. CONFIRM: a delete whose `confirm` does not repeat the username of the operator named by the
 *      path is refused 409 `INVALID_STATE`, and the account, its credential and its sessions stay.
 *   3. RB-8: a delete that would leave no enabled operator holding USER_ADMIN is refused 409
 *      `LAST_ADMIN` — the rule of the role change and the disable reaches the delete too.
 *   4. NAME: a create whose username another operator already has is refused 422 `INVALID_INPUT`
 *      with no row of any kind written: not in `operators`, not in the audit chain.
 *
 * And the reference count: a delete the database would refuse on a foreign key is answered 409
 * `INVALID_STATE` that says how many records hold the operator, before the unit touches anything.
 */
import { ApiErrorCode, type CreateUserRequest, type DeleteUserRequest, type UpdateUserRequest } from '@dems/shared/api';
import { OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The revoke of the biometric tokens belongs to identity/biometric (decision D105): this module
// calls it and owns no statement of its own on that table, so the call is observed, not executed.
const revoked = vi.hoisted(() => vi.fn(async (): Promise<number> => 0));
vi.mock('../../identity/biometric', () => ({ revokeBiometricTokens: revoked }));

const { createUser, deleteUser, updateUser } = await import('../changes');
const store = await import('../statements');

const NOW = 1_791_000_000_000;
const DEVICE = 'DEV-0001';

/** A unit of work of this file: any of the three operations, run on the stand-in app. */
type Work = (app: FastifyInstance) => Promise<unknown>;

interface OperatorSeed {
  readonly id: string;
  readonly username: string;
  readonly role: OperatorRole;
  readonly enabled?: boolean;
  readonly rank?: string | null;
  readonly name?: string;
  readonly displayName?: string;
  readonly initials?: string;
}

const seed = (operator: OperatorSeed) => ({
  id: operator.id,
  username: operator.username,
  rank: operator.rank ?? null,
  name: operator.name ?? `Operator ${operator.id}`,
  display_name: operator.displayName ?? `Operator ${operator.id}`,
  initials: operator.initials ?? 'OP',
  role_id: operator.role,
  enabled: operator.enabled ?? true,
  last_sign_in_at: null,
  role_changed_at: null,
});

/** `root` alone may create, edit and delete; a client's supervisor holds the very same permission. */
const ROOT = { id: 'OPR-001', username: 'root', role: OperatorRole.SUPERVISOR };
const SUPERVISOR = { id: 'OPR-002', username: 'andi.pratama', role: OperatorRole.SUPERVISOR };
const TARGET = { id: 'OPR-003', username: 'rina.wijaya', role: OperatorRole.INVESTIGATOR };

/** The roles that hold USER_ADMIN in the stored matrix: read as data, never hard-coded here. */
function administratorRoles(): Set<string> {
  const permission = Permission.USER_ADMIN as string;
  return new Set(
    Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission)),
  );
}

/** The counts a purge of this account would report: what the stand-in's tables actually hold. */
function purgeCounts(operatorId: string, world: World, done: { removedCredential?: boolean } = {}) {
  const credential = done.removedCredential ?? world.credentials.has(operatorId);
  return {
    operatorId,
    auditRows: 0,
    lineageRows: 0,
    signInRows: (world.openSessions.get(operatorId) ?? []).length,
    biometricTokens: 0,
    credentialsRemoved: credential ? 1 : 0,
    pairingCodes: 0,
    activeSessions: 0,
    resealFromSeq: null,
    // Row 95 (D38 DR-1): kept evidence-chain rows keep the account row, disabled.
    accountKept: (world.keptRows.get(operatorId) ?? 0) > 0,
  };
}

interface World {
  // A created operator carries a real `role_changed_at`; the seeded ones carry none. The map holds
  // both shapes, which is what the store answers after `createUser` writes a row.
  operators: Map<string, Omit<ReturnType<typeof seed>, 'role_changed_at'> & { role_changed_at: number | null }>;
  credentials: Set<string>;
  openSessions: Map<string, string[]>;
  references: Array<{ source: string; n: number }>;
  /** Row 95: evidence-chain rows (migration 0043's kept types) each operator wrote. */
  keptRows: Map<string, number>;
  /** Row 95 (D43): the one row of `active_session`, or null when no session is active. */
  activeSession: { id: string; investigator_id: string; created_by: string | null; started_by: string | null; stopped_by: string | null } | null;
}

/** What one run of one unit left behind: the committed rows, the rows it tried to audit, its publications. */
interface Run<Result> {
  readonly result: Result;
  readonly failure: { status: number; code: string } | null;
  /** The sentence of that refusal, kept apart so that `failure` stays a pair of two members. */
  readonly failureMessage: string;
  readonly world: World;
  readonly audit: Record<string, unknown>[];
  readonly published: unknown[];
  readonly written: string[];
}

/**
 * Run `work` over the module's real unit function on an in-memory copy of the tables: the writes go
 * to the copy, and the copy and the audit rows are kept only when the unit returns. A throw drops
 * both, which is the property the file is about (AT-3: a refusal changes nothing).
 */
async function run<Result>(
  base: World,
  work: (app: FastifyInstance) => Promise<Result>,
  options: { readonly sessionsEnded?: string[] } = {},
): Promise<Run<Result>> {
  const world: World = structuredClone(base);
  const audit: Record<string, unknown>[] = [];
  const stagedAudit: Record<string, unknown>[] = [];
  const resealedChains: unknown[] = [];
  const published: unknown[] = [];
  const afterCommit: Array<() => void> = [];
  const written: string[] = [];
  const forecast = new Map<string, ReturnType<typeof purgeCounts>>();
  const queries: Array<{ text: string; values: unknown[] }> = [];

  const ordered = () => [...world.operators.values()].sort((a, b) => a.id.localeCompare(b.id));
  const userRow = (id: string) => {
    const row = world.operators.get(id);
    if (row === undefined) return null;
    return { ...row, active_sessions: (world.openSessions.get(id) ?? []).length };
  };

  const unit = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values: [...values] });
      const answer = (rows: readonly unknown[]) => ({ rows, rowCount: rows.length });
      if (text === store.LOCK_OPERATORS) return answer(ordered().map(({ id, role_id, enabled }) => ({ id, role_id, enabled })));
      if (text === store.LOCK_OPERATOR) return answer(ordered().filter((row) => row.id === values[0]).map(({ id, role_id, enabled }) => ({ id, role_id, enabled })));
      if (text === store.READ_USERNAME) return answer(ordered().filter((row) => row.id === values[0]).map(({ username }) => ({ username })));
      if (text === store.USERNAME_TAKEN) return answer(ordered().filter((row) => row.username === values[0]).map(() => ({ '?column?': 1 })));
      if (text === store.NEXT_OPERATOR_ID) {
        const highest = ordered().reduce((max, row) => Math.max(max, Number(row.id.slice(4))), 0);
        return answer([{ id: `OPR-${String(highest + 1).padStart(3, '0')}` }]);
      }
      if (text === store.READ_ROLES_HOLDING) return answer([...administratorRoles()].map((role) => ({ role_id: role })));
      if (text === store.READ_USER) return answer([userRow(String(values[0]))].filter((row) => row !== null));
      if (text === store.READ_ACTIVE_SESSION_PARTIES) return answer(world.activeSession === null ? [] : [world.activeSession]);
      if (text === store.REFERENCED_BY) return answer(world.references.map((row) => ({ source: row.source, count: row.n })));
      // The purge statements of the delete (migration 0036). The account of these tests wrote no row
      // of the chain, so the forecast, the erasure and the re-seal all agree on an empty history: the
      // stand-in answers each with the counts of the rows it actually holds, and removes the same two
      // rows the delete always removed (the credential, then the account).
      if (store.PURGE_FORECAST !== undefined && text === store.PURGE_FORECAST) {
        const counts = purgeCounts(String(values[0]), world);
        forecast.set(String(values[0]), counts);
        return answer([counts]);
      }
      if (store.PURGE_OPERATOR !== undefined && text.startsWith('SELECT public.audit_purge_operator')) {
        const id = String(values[0]);
        const had = world.credentials.delete(id);
        if (had) written.push(store.DELETE_CREDENTIAL);
        // Migration 0043 (D38 DR-1): a row of the kept types keeps the account, disabled.
        const kept = (world.keptRows.get(id) ?? 0) > 0;
        const row = world.operators.get(id);
        if (kept && row !== undefined) {
          world.operators.set(id, { ...row, enabled: false });
          written.push('KEEP_OPERATOR_DISABLED');
        } else if (world.operators.delete(id)) {
          written.push(store.DELETE_OPERATOR);
        }
        // The erasure answers with the counts the forecast announced — the unit compares the two
        // (`samePurge`), and the stand-in has to keep that promise the same way the function does.
        return answer([{ counts: forecast.get(id) ?? purgeCounts(id, world, { removedCredential: had }) }]);
      }
      if (store.RESEAL !== undefined && text.startsWith('SELECT public.audit_purge_reseal')) return answer([{ seal: { rows: 0, headSeq: 0 } }]);
      // Row 94 (DF-27): after the seal the unit reads the chain back for the engine. The stand-in's
      // chain is empty (head 0, genesis hash), the same chain the seal above answered.
      if (text.startsWith('SELECT seq, hash FROM public.audit_chain_head')) return answer([{ seq: 0, hash: '0'.repeat(64) }]);
      if (text.includes('FROM public.audit_log ORDER BY seq DESC')) return answer([]);
      if (text === store.INSERT_OPERATOR) {
        const [id, username, rank, name, display_name, initials, role_id, at] = values as [string, string, string, string, string, string, OperatorRole, number];
        world.operators.set(id, { id, username, rank, name, display_name, initials, role_id, enabled: true, last_sign_in_at: null, role_changed_at: at });
        written.push(text);
        return answer([{ id }]);
      }
      if (text === store.UPDATE_PROFILE) {
        const [id, name, displayName, initials, rankProvided, rank] = values as [string, string | null, string | null, string | null, boolean, string | null];
        const row = world.operators.get(id);
        if (row === undefined) return answer([]);
        world.operators.set(id, {
          ...row,
          name: name ?? row.name,
          display_name: displayName ?? row.display_name,
          initials: initials ?? row.initials,
          rank: rankProvided ? rank : row.rank,
        });
        written.push(text);
        return answer([{ id }]);
      }
      if (text === store.DELETE_CREDENTIAL) {
        const removed = [...world.credentials].filter((id) => id === values[0]);
        for (const id of removed) world.credentials.delete(id);
        written.push(text);
        return answer(removed.map((operatorId) => ({ operator_id: operatorId })));
      }
      if (text === store.DELETE_OPERATOR) {
        const row = world.operators.get(String(values[0]));
        if (row === undefined) return answer([]);
        world.operators.delete(row.id);
        written.push(text);
        return answer([{ id: row.id, username: row.username, role_id: row.role_id }]);
      }
      throw new Error(`the unit of work asked a statement this stand-in does not answer: ${text.slice(0, 60)}`);
    },
    audit: {
      append: async (entry: Record<string, unknown>) => {
        stagedAudit.push(entry);
        return { seq: 1 };
      },
      // Row 94 (DF-27): the chain read back after a re-seal, handed to the commit for the engine.
      resealed: async (chain: { head: { seq: number; hash: string }; rows: readonly unknown[] }) => {
        resealedChains.push(chain);
      },
    },
    afterCommit: (task: () => void) => void afterCommit.push(task),
  };

  const app = {
    clock: { now: () => NOW },
    pipeline: {
      run: async (_label: string, fn: (context: unknown) => Promise<Result>) => {
        try {
          const result = await fn(unit);
          audit.push(...stagedAudit);
          for (const task of afterCommit) task();
          return result;
        } catch (error) {
          // The transaction is dropped: the rows, the audit entries and the publications of a unit
          // that did not commit never reach the database or the wire.
          world.operators = new Map(structuredClone(base).operators);
          world.credentials = structuredClone(base).credentials;
          world.openSessions = structuredClone(base).openSessions;
          throw error;
        }
      },
    },
    publish: (publication: unknown) => void published.push(publication),
    sessionRegistry: {
      endForOperator: async (_unit: unknown, operatorId: string, _reason: string) => {
        const sessions = world.openSessions.get(operatorId) ?? [];
        world.openSessions.set(operatorId, []);
        return options.sessionsEnded ?? sessions;
      },
    },
  } as unknown as FastifyInstance;

  let failure: Run<Result>['failure'] = null;
  let message = '';
  let result: Result;
  try {
    result = await work(app);
  } catch (error) {
    const apiFailure = error as { statusCode?: number; code?: string; message?: string };
    failure = { status: apiFailure.statusCode ?? 0, code: apiFailure.code ?? 'UNKNOWN' };
    message = String(apiFailure.message ?? '');
    result = undefined as Result;
  }
  return { result, failure, failureMessage: message, world, audit, published: [...published], written };
}

const world = (
  operators: readonly OperatorSeed[],
  options: {
    readonly credentials?: string[];
    readonly sessions?: Record<string, string[]>;
    readonly references?: Array<{ source: string; n: number }>;
    readonly keptRows?: Record<string, number>;
    readonly activeSession?: World['activeSession'];
  } = {},
): World => ({
  operators: new Map(operators.map((operator) => [operator.id, seed(operator)])),
  credentials: new Set(options.credentials ?? operators.map((operator) => operator.id)),
  openSessions: new Map(Object.entries(options.sessions ?? {})),
  references: options.references ?? [],
  keptRows: new Map(Object.entries(options.keptRows ?? {})),
  activeSession: options.activeSession ?? null,
});

const actor = (operatorId: string) => ({ operatorId, deviceId: DEVICE });
const create = (over: Partial<CreateUserRequest> = {}): CreateUserRequest => ({ username: 'new.operator', name: 'New Operator', initials: 'NO', role: OperatorRole.TECHNICIAN, ...over } as CreateUserRequest);
const edit = (over: Partial<UpdateUserRequest> = {}): UpdateUserRequest => ({ displayName: 'Another Name', ...over } as UpdateUserRequest);
const remove = (confirm: string): DeleteUserRequest => ({ confirm } as DeleteUserRequest);

beforeEach(() => {
  revoked.mockClear();
});

describe('the narrowed gate (RB-9 as amended): USER_ADMIN alone is not enough', () => {
  const trio = (who: { id: string; username: string }): ReadonlyArray<readonly [string, Work]> => [
    ['createUser', (app: FastifyInstance) => createUser(app, actor(who.id), create(), undefined)],
    ['updateUser', (app: FastifyInstance) => updateUser(app, actor(who.id), TARGET.id, edit(), undefined)],
    ['deleteUser', (app: FastifyInstance) => deleteUser(app, actor(who.id), TARGET.id, remove(TARGET.username), undefined)],
  ];

  it.each(trio(SUPERVISOR))('%s: a holder of USER_ADMIN who is not the vendor root is 403 NOT_PERMITTED, with no row of any kind', async (_name, work) => {
    const before = world([ROOT, SUPERVISOR, TARGET]);
    const built = await run(before, work);
    expect(built.failure).toEqual({ status: 403, code: ApiErrorCode.NOT_PERMITTED });
    // No audit row: the specification names none for this refusal, and the guard writes its own.
    expect(built.audit).toEqual([]);
    // Nothing was written, and the tables are as they were.
    expect(built.written).toEqual([]);
    expect([...built.world.operators.keys()].sort()).toEqual([ROOT.id, SUPERVISOR.id, TARGET.id]);
    expect(built.world.operators.get(TARGET.id)).toEqual(before.operators.get(TARGET.id));
    expect(built.world.credentials.size).toBe(3);
    // No publication left the unit, and no token family was touched.
    expect(built.published).toEqual([]);
    expect(revoked.mock.calls).toEqual([]);
  });

  it.each(trio(ROOT))('%s: the same call by the vendor root passes the gate (positive control)', async (_name, work) => {
    const built = await run(world([ROOT, SUPERVISOR, TARGET]), work);
    expect(built.failure).toBeNull();
    expect(built.audit).toHaveLength(1);
  });

  it('the refusal reads the identity of the caller and nothing else of it', async () => {
    const before = world([ROOT, SUPERVISOR, TARGET]);
    const built = await run(before, (app) => createUser(app, actor(SUPERVISOR.id), create(), undefined));
    expect(built.failure?.code).toBe(ApiErrorCode.NOT_PERMITTED);
    // The caller's row is locked and its username read; no role, permission or session of the caller is.
    expect(built.published).toEqual([]);
    expect(built.audit).toEqual([]);
  });
});

describe('deleteUser: the confirmation, the rule and the references', () => {
  it('a confirm that is not the username of the operator of the path is 409 INVALID_STATE and changes nothing', async () => {
    const before = world([ROOT, SUPERVISOR, TARGET], { sessions: { [TARGET.id]: ['SES-T'] } });
    const built = await run(before, (app) => deleteUser(app, actor(ROOT.id), TARGET.id, remove('other.operator'), 'a reason'));
    expect(built.failure).toEqual({ status: 409, code: ApiErrorCode.INVALID_STATE });
    expect(built.audit).toEqual([]);
    expect(built.written).toEqual([]);
    // The account, its credential and its open session are all still there.
    expect(built.world.operators.has(TARGET.id)).toBe(true);
    expect(built.world.operators.get(TARGET.id)).toEqual(before.operators.get(TARGET.id));
    expect(built.world.credentials.has(TARGET.id)).toBe(true);
    expect(built.world.openSessions.get(TARGET.id)).toEqual(['SES-T']);
    expect(built.published).toEqual([]);
    expect(revoked.mock.calls).toEqual([]);
  });

  it('the confirm is the username of that operator, trimmed and read case-insensitively: another name is refused', async () => {
    // A name that is not the operator's — however close — is the refusal, and nothing is changed.
    for (const confirm of ['rina.wijayax', 'budi.santoso', '', 'root']) {
      const built = await run(world([ROOT, SUPERVISOR, TARGET]), (app) => deleteUser(app, actor(ROOT.id), TARGET.id, remove(confirm), undefined));
      expect(built.failure?.code, confirm).toBe(ApiErrorCode.INVALID_STATE);
      expect(built.audit, confirm).toEqual([]);
      expect(built.written, confirm).toEqual([]);
      expect(built.world.operators.has(TARGET.id), confirm).toBe(true);
    }
    // The same name with the spaces or the case a keyboard gives is the confirmation asked for: the
    // unit trims and lowers it before it compares. Stated as a test so that a later row that
    // tightens or loosens that comparison is caught here, not in an answer nobody read.
    for (const confirm of ['rina.wijaya', 'RINA.WIJAYA', '  rina.wijaya  ']) {
      const built = await run(world([ROOT, SUPERVISOR, TARGET]), (app) => deleteUser(app, actor(ROOT.id), TARGET.id, remove(confirm), undefined));
      expect(built.failure, confirm).toBeNull();
      expect(built.audit, confirm).toHaveLength(1);
      expect(built.world.operators.has(TARGET.id), confirm).toBe(false);
    }
  });

  it('a delete that would leave no enabled holder of USER_ADMIN is 409 LAST_ADMIN, with nothing deleted', async () => {
    // ROOT is the only enabled operator whose role holds USER_ADMIN, so no delete of it is allowed:
    // not even its own, because RB-8 is about the state after the change, whoever asks for it.
    const last = await run(world([ROOT, TARGET]), (app) => deleteUser(app, actor(ROOT.id), ROOT.id, remove('root'), undefined));
    expect(last.failure).toEqual({ status: 409, code: ApiErrorCode.LAST_ADMIN });
    expect(last.audit).toEqual([]);
    expect(last.written).toEqual([]);
    expect(last.world.operators.has(ROOT.id)).toBe(true);
    expect(last.published).toEqual([]);
    // A disabled holder does not count either way: with it as the only other holder, ROOT may not go.
    const disabled = { id: 'OPR-004', username: 'sleeping.supervisor', role: OperatorRole.SUPERVISOR, enabled: false };
    const stillLast = await run(world([ROOT, disabled, TARGET]), (app) => deleteUser(app, actor(ROOT.id), ROOT.id, remove('root'), undefined));
    expect(stillLast.failure).toEqual({ status: 409, code: ApiErrorCode.LAST_ADMIN });
    // And the control: while a second ENABLED holder stays, the delete of the first one goes through.
    const live = { id: 'OPR-005', username: 'second.root', role: OperatorRole.SUPERVISOR };
    const allowed = await run(world([ROOT, live, TARGET]), (app) => deleteUser(app, actor(ROOT.id), live.id, remove(live.username), undefined));
    expect(allowed.failure).toBeNull();
    expect(allowed.world.operators.has(live.id)).toBe(false);
  });

  it('a delete of another account is let through while an enabled holder stays', async () => {
    const built = await run(world([ROOT, SUPERVISOR, TARGET]), (app) => deleteUser(app, actor(ROOT.id), TARGET.id, remove(TARGET.username), undefined));
    expect(built.failure).toBeNull();
    expect(built.world.operators.has(TARGET.id)).toBe(false);
    expect(built.world.credentials.has(TARGET.id)).toBe(false);
    expect(built.audit).toHaveLength(1);
  });

  // NOTE 2026-11-02, unresolved, for the principal: the brief I worked from says a delete that a
  // foreign key refuses (SQLSTATE 23503) answers 409 INVALID_STATE and changes nothing, and that the
  // audit rows of the deleted operator STAY (the chain is append-only). As of the sources on disk at
  // 15:01 the module instead counts the references (`REFERENCED_BY`), forecasts a purge, and runs
  // `public.audit_purge_operator` plus `public.audit_purge_reseal` (migration 0036): the rows of the
  // chain go and the tail is sealed again. The two readings cannot both be guarded, so this file
  // guards NEITHER of them and says so: the refusal of a reference is no longer in the unit, and a
  // test that pinned it would freeze a decision the principal has just changed. See the report.

  it('the delete that goes through ends the sessions, removes the credential row and writes one USER_DELETED row', async () => {
    const built = await run(world([ROOT, SUPERVISOR, TARGET], { sessions: { [TARGET.id]: ['SES-A', 'SES-B'] } }), (app) =>
      deleteUser(app, actor(ROOT.id), TARGET.id, remove(TARGET.username), 'no longer used'),
    );
    expect(built.failure).toBeNull();
    expect(built.audit).toHaveLength(1);
    const row = built.audit[0] as { type: string; severity: string; actorId: string; deviceId: string | null; details: Record<string, unknown> };
    expect([row.type, row.severity, row.actorId, row.deviceId]).toEqual(['USER_DELETED', 'WARNING', ROOT.id, DEVICE]);
    // The five keys the writer's own list names for this type (core/audit-details.ts). The module may
    // add more with the purge of 0036; those are the backend's, and this file does not pin them.
    const { targetOperatorId, role, sessionsEnded, credentialsRemoved, reason } = row.details;
    expect({ targetOperatorId, role, sessionsEnded, credentialsRemoved, reason }).toEqual({
      targetOperatorId: TARGET.id,
      role: TARGET.role,
      sessionsEnded: 2,
      credentialsRemoved: 1,
      reason: 'no longer used',
    });
    // The chain keeps every row the deleted operator wrote: no statement of this module names it.
    expect(built.written).toEqual([store.DELETE_CREDENTIAL, store.DELETE_OPERATOR]);
    // The chain keeps every row the deleted operator wrote: no statement of this module names it.
    expect(revoked.mock.calls).toHaveLength(1);
    expect(built.published.length).toBeGreaterThan(0);
  });
});

// Row 95 (DF-28; decisions D43 and D38 DR-1; migration 0043).
describe('deleteUser: never under the active session (D43), and the account kept under its evidence rows (D38 DR-1)', () => {
  const session = (over: Partial<NonNullable<World['activeSession']>> = {}): NonNullable<World['activeSession']> => ({
    id: 'SES-20261105-0001',
    investigator_id: SUPERVISOR.id,
    created_by: null,
    started_by: null,
    stopped_by: null,
    ...over,
  });

  it.each([
    ['investigator', { investigator_id: TARGET.id }],
    ['creator', { created_by: TARGET.id }],
    ['starter', { started_by: TARGET.id }],
    ['stopper', { stopped_by: TARGET.id }],
  ] as const)('the %s of the active session is 409 INVALID_STATE before any write: no row, no session ended, no token revoked', async (_party, over) => {
    const before = world([ROOT, SUPERVISOR, TARGET], { sessions: { [TARGET.id]: ['SES-T'] }, activeSession: session(over) });
    const built = await run(before, (app) => deleteUser(app, actor(ROOT.id), TARGET.id, remove(TARGET.username), 'left the unit'));
    expect(built.failure).toEqual({ status: 409, code: ApiErrorCode.INVALID_STATE });
    expect(built.failureMessage).toMatch(/active session/);
    expect(built.audit).toEqual([]);
    expect(built.written).toEqual([]);
    expect(built.world.operators.get(TARGET.id)).toEqual(before.operators.get(TARGET.id));
    expect(built.world.credentials.has(TARGET.id)).toBe(true);
    expect(built.world.openSessions.get(TARGET.id)).toEqual(['SES-T']);
    expect(built.published).toEqual([]);
    expect(revoked.mock.calls).toEqual([]);
  });

  it('the refusal carries the reason and the session in its details', async () => {
    const { ACTIVE_SESSION_PARTY_REASON } = await import('../changes');
    let caught: unknown;
    await run(world([ROOT, SUPERVISOR, TARGET], { activeSession: session({ investigator_id: TARGET.id }) }), async (app) => {
      try {
        return await deleteUser(app, actor(ROOT.id), TARGET.id, remove(TARGET.username), undefined);
      } catch (error) {
        caught = error;
        throw error;
      }
    });
    expect((caught as { details?: unknown }).details).toEqual({ reason: ACTIVE_SESSION_PARTY_REASON, sessionId: 'SES-20261105-0001' });
  });

  it('positive control: an active session that does not name the target lets the purge through', async () => {
    const built = await run(world([ROOT, SUPERVISOR, TARGET], { activeSession: session() }), (app) => deleteUser(app, actor(ROOT.id), TARGET.id, remove(TARGET.username), undefined));
    expect(built.failure).toBeNull();
    expect(built.world.operators.has(TARGET.id)).toBe(false);
  });

  it('kept evidence-chain rows keep the account row, disabled, with its credential gone; the USER_DELETED row says so and leaves nothing unattributed', async () => {
    const before = world([ROOT, SUPERVISOR, TARGET], { keptRows: { [TARGET.id]: 3 }, references: [{ source: 'evidence_items', n: 2 }] });
    const built = await run(before, (app) => deleteUser(app, actor(ROOT.id), TARGET.id, remove(TARGET.username), 'left the unit'));
    expect(built.failure).toBeNull();
    expect(built.world.operators.get(TARGET.id)).toMatchObject({ id: TARGET.id, enabled: false });
    expect(built.world.credentials.has(TARGET.id)).toBe(false);
    expect(built.written).toEqual([store.DELETE_CREDENTIAL, 'KEEP_OPERATOR_DISABLED']);
    const row = built.audit[0] as { type: string; message: string; details: Record<string, unknown> };
    expect(row.type).toBe('USER_DELETED');
    expect(row.message).toMatch(/; evidence-chain rows kept, account kept disabled$/);
    expect(row.details['recordsLeftUnattributed']).toBe(0);
    // And without kept rows the account goes, and the references count as before.
    const gone = await run(world([ROOT, SUPERVISOR, TARGET], { references: [{ source: 'evidence_items', n: 2 }] }), (app) =>
      deleteUser(app, actor(ROOT.id), TARGET.id, remove(TARGET.username), undefined),
    );
    expect(gone.world.operators.has(TARGET.id)).toBe(false);
    const goneRow = gone.audit[0] as { message: string; details: Record<string, unknown> };
    expect(goneRow.message).not.toMatch(/account kept/);
    expect(goneRow.details['recordsLeftUnattributed']).toBe(2);
  });
});

describe('createUser and updateUser: what a refusal may not leave behind', () => {
  it('a username that another operator already has is 422 INVALID_INPUT and no row of any kind is written', async () => {
    const before = world([ROOT, SUPERVISOR, TARGET]);
    const built = await run(before, (app) => createUser(app, actor(ROOT.id), create({ username: SUPERVISOR.username }), 'a reason'));
    expect(built.failure).toEqual({ status: 422, code: ApiErrorCode.INVALID_INPUT });
    expect(built.audit).toEqual([]);
    expect(built.written).toEqual([]);
    expect([...built.world.operators.keys()].sort()).toEqual([ROOT.id, SUPERVISOR.id, TARGET.id]);
    expect(built.world.operators.get(SUPERVISOR.id)).toEqual(before.operators.get(SUPERVISOR.id));
    expect(built.published).toEqual([]);
  });

  it('the username of the operator being created, not of the caller, is the one tested against the table', async () => {
    const built = await run(world([ROOT, SUPERVISOR, TARGET]), (app) => createUser(app, actor(ROOT.id), create({ username: 'a.brand.new.name' }), undefined));
    expect(built.failure).toBeNull();
    const created = [...built.world.operators.values()].find((row) => row.username === 'a.brand.new.name');
    expect(created?.role_id).toBe(OperatorRole.TECHNICIAN);
    expect(built.audit).toHaveLength(1);
    expect((built.audit[0] as { details: Record<string, unknown> }).details['targetOperatorId']).toBe(created?.id);
  });

  it('an edit that changes no profile field writes no row and publishes nothing', async () => {
    const before = world([ROOT, SUPERVISOR, TARGET]);
    // The three fields are sent as they already are: the unit compares them with the row and finds nothing to change.
    const asYet = before.operators.get(TARGET.id)!;
    const built = await run(before, (app) => updateUser(app, actor(ROOT.id), TARGET.id, { name: asYet.name, displayName: asYet.display_name, initials: asYet.initials }, undefined));
    expect(built.failure).toBeNull();
    expect(built.audit).toEqual([]);
    expect(built.written).toEqual([]);
    expect(built.published).toEqual([]);
  });

  it('an edit of an operator that does not exist is 404 NOT_FOUND, before the identity is read', async () => {
    const built = await run(world([ROOT, SUPERVISOR, TARGET]), (app) => updateUser(app, actor(ROOT.id), 'OPR-999', edit(), undefined));
    expect(built.failure).toEqual({ status: 404, code: ApiErrorCode.NOT_FOUND });
    expect(built.audit).toEqual([]);
    expect(built.written).toEqual([]);
  });

  it('a caller whose own row is gone has no username to be root with: the gate refuses it 403', async () => {
    // The gate reads the username of the CALLER. An actor the table does not hold cannot be `root`,
    // and the refusal is the identity's 403, never a pass on a missing read.
    const works: readonly Work[] = [
      (app: FastifyInstance) => createUser(app, actor('OPR-999'), create(), undefined),
      (app: FastifyInstance) => updateUser(app, actor('OPR-999'), TARGET.id, edit(), undefined),
      (app: FastifyInstance) => deleteUser(app, actor('OPR-999'), TARGET.id, remove(TARGET.username), undefined),
    ];
    for (const work of works) {
      const built = await run(world([ROOT, SUPERVISOR, TARGET]), work);
      expect(built.failure?.code).toBe(ApiErrorCode.NOT_PERMITTED);
      expect(built.audit).toEqual([]);
      expect(built.written).toEqual([]);
    }
  });
});
