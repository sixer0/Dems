// Post-review fix pass FXR-S (review findings CPB1-19, W91-6; decision D241 DN-W91-2): one
// `CREATE DATABASE` text for an empty project database, and the small second copies tied to their
// source. No database: the statements are built and compared as text; the test helper's builder
// runs against a runner that only records what it was asked to run.
import { GENESIS_HASH as SIM_GENESIS_HASH } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { EVENT_COUNTER_NAME } from '../../src/core/limits';
import { createDatabaseStatement } from '../../src/db/commands/create';
import { guardTargetDatabase } from '../../src/db/commands/database-names';
import { createEmptyDatabaseStatement } from '../../src/db/commands/statements';
import { COUNTER_NAMES } from '../../src/db/mapping/rows';
import { createStagingStatement, guardResetTarget } from '../../src/db/reset/names';
import { GENESIS_HASH } from '../../src/db/schema/boot-checks';
import { createEmptyDatabase } from '../helpers/db/ddl';
import type { GuardedDatabaseName } from '../helpers/db/names';

const TAIL = " TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'";

describe('one CREATE DATABASE statement for an empty project database (CPB1-19)', () => {
  it('the builder adds only constant text around the two guarded names', () => {
    expect(createEmptyDatabaseStatement('dems_demo', 'dems_owner')).toBe(`CREATE DATABASE dems_demo OWNER dems_owner${TAIL}`);
  });

  it('db:create, the reset routine\'s staging database and the test helper\'s first template all build it there', async () => {
    expect(createDatabaseStatement(guardTargetDatabase('dems_demo'))).toBe(createEmptyDatabaseStatement('dems_demo', 'dems_owner'));
    const lane = guardResetTarget('dems_lane_2');
    expect(createStagingStatement(lane)).toBe(createEmptyDatabaseStatement('"dems_lane_2_next"', 'dems_owner'));
    const ran: string[] = [];
    await createEmptyDatabase({ run: async (text: string) => { ran.push(text); return { rows: [], rowCount: 0 } as never; } } as never, 'dems_test_local_tpl_schema' as GuardedDatabaseName);
    expect(ran).toEqual([createEmptyDatabaseStatement('"dems_test_local_tpl_schema"', '"dems_owner"')]);
    for (const text of [createDatabaseStatement(guardTargetDatabase('dems_demo')), createStagingStatement(lane), ...ran]) expect(text.endsWith(TAIL), text).toBe(true);
  });
});

describe('small second copies are tied to their source (W91-6)', () => {
  it('the boot checks\' empty-chain head is the simulator\'s GENESIS_HASH', () => {
    expect(GENESIS_HASH).toBe(SIM_GENESIS_HASH);
    expect(GENESIS_HASH).toBe('0'.repeat(64));
  });

  it('the event counter is a name of the table\'s counter list', () => {
    expect(COUNTER_NAMES).toContain(EVENT_COUNTER_NAME);
  });
});
