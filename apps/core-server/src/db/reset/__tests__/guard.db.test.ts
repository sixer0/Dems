// T-RS-4 inside the row's own command (`npm run test:db -- src/db/reset`), so that T-RS-1 to
// T-RS-6 are proven by one run (plan row W29; database contract §8.5; spec AC-B-72).
//
// The cases are the ones of `guard.test.ts` (project `unit`): a stand-in answers the role
// question, because no test of the server connects as a superuser (HC-1). This file adds the
// other half on the real server: the role check as the real owner connection answers it, and
// what the runtime role would be told.
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { ROLE_CHECK_STATEMENT } from '../routine';
import { PRIVILEGED_ANSWERS, ROLE_CHECK, runOnStub } from './guard-cases';
import { scriptOf } from './pools';

const db = useTestDatabase({ template: 'schema', slug: 'rg' });

describe('T-RS-4: the role check of R-0, with a stand-in for the connection', () => {
  it.each(PRIVILEGED_ANSWERS)('%s: RESET_ROLE_PRIVILEGED before R-1; no statement other than the check was sent', async (_label, rows) => {
    const run = await runOnStub(scriptOf([['FROM pg_roles', rows]]));
    expect(run.error).toMatchObject({ code: 'RESET_ROLE_PRIVILEGED', step: 'R-0', targetUntouched: true });
    expect(run.pools.sent).toEqual([{ database: 'postgres', text: ROLE_CHECK }]);
    expect(run.checkpoints).toEqual(['R-0']);
    expect(run.quiesced).toBe(0);
    expect(run.pools.counts).toEqual({ connected: 1, released: 1, ended: 1 });
    expect(run.logged.map((entry) => entry.code)).toEqual(['RESET_ROLE_PRIVILEGED']);
  });
});

describe('AC-B-72: what the real connections answer to the same question', () => {
  it('the statement of the check is the one the stand-in was asked', () => {
    expect(ROLE_CHECK_STATEMENT).toBe(ROLE_CHECK);
  });

  it('the owner connection is dems_owner and not a superuser: the answer the routine accepts', async () => {
    const { rows } = await db.ownerPool().query(ROLE_CHECK_STATEMENT);
    expect(rows).toEqual([{ rolname: 'dems_owner', rolsuper: false }]);
  });

  it('the runtime connection is dems_app: an answer the routine refuses', async () => {
    const { rows } = await db.appPool().query(ROLE_CHECK_STATEMENT);
    expect(rows).toEqual([{ rolname: 'dems_app', rolsuper: false }]);
    const run = await runOnStub(scriptOf([['FROM pg_roles', rows]]));
    expect(run.error?.code).toBe('RESET_ROLE_PRIVILEGED');
  });
});
