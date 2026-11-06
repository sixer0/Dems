// The administration module on the bulk template (plan row W33; database contract §11; decision
// D62; implementation/25 §15): 12 operators, of which three enabled SUPERVISORs, one disabled
// SUPERVISOR, accounts that were disabled and enabled, roles that were changed, open and ended
// sessions, and an audit trail of thousands of rows.
//
// A clone of `tpl_bulk`; the app is booted with the engine on a manual timer; the clock runs
// after `BULK_TEMPLATE_NOW`; the session is a real sign-in of the SEEDED supervisor. Rows of the
// trail are told apart by `seq`, never by `at`.
import { validateCoreApiResponse, type AdminUser } from '@dems/shared/api';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readHead, readTrail } from '../../../../test/support/core';
import { BULK_TEMPLATE_NOW } from '../../../db/fixtures/__tests__/template-hook.bulk';
import type { Headers } from '../../../../test/support/identity';
import { SUPERVISOR, USERS, adminApp, disableUrl, forgetCounters, outcome, roleUrl, signInWeb, storedAdministrators, storedOperators, web, type AdminApp } from './support';

const db = useTestDatabase({ template: 'bulk' });

// Under the load of several rows' runs a clone, a boot or a sign-in takes many times its usual
// time (seen: a 0.2 s test past the default 5 s). The limits of this file are wide enough for
// that; a real hang still fails, later.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });
let admin: AdminApp;
let owner: Pool;
let supervisor: Headers;

const users = async (): Promise<AdminUser[]> => ((await web(admin.app, supervisor, 'GET', USERS)).json() as { users: AdminUser[] }).users;
const headSeq = async (): Promise<number> => (await readHead(owner)).seq;
const rowsAfter = async (seq: number) => (await readTrail(owner)).filter((row) => row.seq > seq);

/** The open sessions of every operator, counted by the database. */
async function openSessions(): Promise<Record<string, number>> {
  const { rows } = await owner.query<{ operator_id: string; open: number }>(
    'SELECT operator_id, count(*)::int AS open FROM public.auth_sessions WHERE ended_at IS NULL GROUP BY operator_id',
  );
  return Object.fromEntries(rows.map((row) => [row.operator_id, row.open]));
}

beforeAll(async () => {
  owner = db.ownerPool();
  admin = await adminApp(db, { startAt: BULK_TEMPLATE_NOW + 60_000 });
  supervisor = await signInWeb(admin, SUPERVISOR.username);
  await admin.app.pipeline.drain();
});

beforeEach(() => {
  forgetCounters(admin);
  admin.published.length = 0;
});

describe('operation 11 listUsers on 12 operators', () => {
  it('answers all twelve in operator ID order, valid against the contract, each equal to its stored row and its open sessions', async () => {
    const response = await web(admin.app, supervisor, 'GET', USERS);
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('listUsers', 200, response.json())).toEqual({ ok: true });
    const listed = (response.json() as { users: AdminUser[] }).users;
    expect(listed).toHaveLength(12);
    expect(listed.map((entry) => entry.id)).toEqual(Array.from({ length: 12 }, (_unused, index) => `OPR-${String(index + 1).padStart(3, '0')}`));

    const stored = await storedOperators(owner);
    const open = await openSessions();
    expect(listed.map((entry) => [entry.id, entry.role, entry.enabled, entry.lastSignInAt, entry.roleChangedAt, entry.activeSessions])).toEqual(
      stored.map((row) => [row.id, row.role, row.enabled, row.lastSignInAt, row.roleChangedAt, open[row.id] ?? 0]),
    );
    // The fixture's shape: disabled accounts, changed roles, and more than one open session somewhere.
    expect(listed.filter((entry) => !entry.enabled)).toHaveLength(3);
    expect(listed.filter((entry) => entry.roleChangedAt !== null)).toHaveLength(2);
    expect(listed.reduce((sum, entry) => sum + entry.activeSessions, 0)).toBe(Object.values(open).reduce((sum, count) => sum + count, 0));
    expect(listed.find((entry) => entry.id === SUPERVISOR.id)?.activeSessions).toBeGreaterThanOrEqual(1);
    console.info(
      `[w33] bulk: 12 operators listed; enabled ${listed.filter((entry) => entry.enabled).length}, disabled ${listed.filter((entry) => !entry.enabled).length}; ` +
        `SUPERVISOR ${listed.filter((entry) => entry.role === 'SUPERVISOR').length} (enabled ${listed.filter((entry) => entry.role === 'SUPERVISOR' && entry.enabled).length}); ` +
        `open sessions ${listed.reduce((sum, entry) => sum + entry.activeSessions, 0)}; audit rows ${await headSeq()}`,
    );
  });
});

describe('the last-administrator rule over twelve rows', () => {
  it('three enabled SUPERVISORs and one disabled: two may go, by a demotion and by a disable; the third is the last, whatever the disabled one\'s role', async () => {
    const holders = await storedAdministrators(owner);
    const disabledSupervisors = (await storedOperators(owner)).filter((row) => row.role === 'SUPERVISOR' && !row.enabled).map((row) => row.id);
    expect(holders).toHaveLength(3);
    expect(holders).toContain(SUPERVISOR.id);
    expect(disabledSupervisors).toHaveLength(1);
    const [first, second] = holders.filter((id) => id !== SUPERVISOR.id);
    if (first === undefined || second === undefined) throw new Error('the fixture holds no two further supervisors');
    const sessionsOfSecond = (await openSessions())[second] ?? 0;
    const from = await headSeq();

    // One by a demotion ...
    const demoted = await web(admin.app, supervisor, 'POST', roleUrl(first), { role: 'INVESTIGATOR', reason: 'bulk' });
    expect(demoted.statusCode).toBe(200);
    expect(validateCoreApiResponse('assignUserRole', 200, demoted.json())).toEqual({ ok: true });
    // ... one by a disable, which ends exactly the sessions the fixture left open for that operator.
    const disabled = await web(admin.app, supervisor, 'POST', disableUrl(second));
    expect(disabled.statusCode).toBe(200);
    expect(validateCoreApiResponse('disableUser', 200, disabled.json())).toEqual({ ok: true });
    expect((disabled.json() as AdminUser).activeSessions).toBe(0);
    expect((await openSessions())[second] ?? 0).toBe(0);

    // The seeded SUPERVISOR is the last enabled holder now: the disabled one does not count.
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);
    for (const refused of [
      await web(admin.app, supervisor, 'POST', roleUrl(SUPERVISOR.id), { role: 'TECHNICIAN' }),
      await web(admin.app, supervisor, 'POST', disableUrl(SUPERVISOR.id)),
    ]) {
      expect(outcome(refused)).toEqual([409, 'LAST_ADMIN']);
    }
    expect(await storedAdministrators(owner)).toEqual([SUPERVISOR.id]);

    // Exactly two rows since, in this order, continuing the bulk trail's sequence without a gap.
    const rows = await rowsAfter(from);
    expect(rows.map((row) => [row.seq, row.type, row.actorId, row.details])).toEqual([
      [from + 1, 'ROLE_CHANGED', SUPERVISOR.id, { targetOperatorId: first, from: 'SUPERVISOR', to: 'INVESTIGATOR', reason: 'bulk' }],
      [from + 2, 'USER_DISABLED', SUPERVISOR.id, { targetOperatorId: second, sessionsEnded: sessionsOfSecond }],
    ]);
    // The list shows both changes.
    const listed = await users();
    expect(listed.find((entry) => entry.id === first)).toMatchObject({ role: 'INVESTIGATOR', roleChangedAt: admin.clock.now() });
    expect(listed.find((entry) => entry.id === second)).toMatchObject({ enabled: false, activeSessions: 0 });
  });
});
