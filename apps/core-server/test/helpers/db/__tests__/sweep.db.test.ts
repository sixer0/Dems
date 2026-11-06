// TI-12 against the real server: at its start a run drops the test databases of runs that are
// older than six hours and not alive, and nothing else. "Older" is the start time in the run
// stamp; "alive" is the liveness lock a run's session holds for as long as it exists.
//
// The old runs of this test are real runs started with a clock that is set back; nothing sleeps
// for six hours.
import { afterAll, describe, expect, it } from 'vitest';
import { STALE_AFTER_SECONDS } from '../constants';
import { stampSeconds } from '../names';
import { TestRun, useTestDatabase } from '../index';
import { SELFTEST_TEMPLATE } from '../testing/probe-hooks';
import { sleep, startPrivateRun } from '../testing/private-run';

const HOUR_MS = 3_600_000;

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });
const started: TestRun[] = [];

afterAll(async () => {
  for (const run of started) if (!run.closed) await run.teardown();
});

async function namesWithPrefix(prefix: string): Promise<string[]> {
  const rows = await db.ownerPool().query<{ name: string }>(
    'SELECT datname::text AS name FROM pg_database WHERE starts_with(datname, $1) ORDER BY 1',
    [prefix],
  );
  return rows.rows.map((row) => row.name);
}

/**
 * Waits until no database with the prefix is left. A sweep that finds the liveness lock of a
 * stale run taken leaves that run alone, and the holder may be ANOTHER SWEEPER (a second
 * `test:db` that started at the same moment) which is still dropping: then the databases go a
 * moment later, by its hand.
 */
async function goneSoon(prefix: string, timeoutMs = 15_000): Promise<string[]> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const names = await namesWithPrefix(prefix);
    if (names.length === 0 || performance.now() >= deadline) return names;
    await sleep(50);
  }
}

async function privateRun(tag: string, ageMs = 0): Promise<TestRun> {
  const run = await startPrivateRun(tag, ageMs === 0 ? {} : { now: () => Date.now() - ageMs });
  started.push(run);
  // A locked template and a per-file database: both kinds must be swept, or kept.
  await run.createDatabase({ template: 'x_selftest', slug: `of_${tag}` });
  return run;
}

describe('TI-12: the stale sweep', () => {
  it('drops a run that is older than six hours and dead; keeps an old run that is alive and a younger run', async () => {
    const dead = await privateRun('dead', 7 * HOUR_MS);
    const alive = await privateRun('aliv', 8 * HOUR_MS);
    const young = await privateRun('yng');
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(nowSeconds - stampSeconds(dead.identity.stamp)).toBeGreaterThan(STALE_AFTER_SECONDS);
    expect(nowSeconds - stampSeconds(alive.identity.stamp)).toBeGreaterThan(STALE_AFTER_SECONDS);
    expect(nowSeconds - stampSeconds(young.identity.stamp)).toBeLessThan(60);

    const deadNames = await namesWithPrefix(dead.identity.prefix);
    const aliveNames = await namesWithPrefix(alive.identity.prefix);
    const youngNames = await namesWithPrefix(young.identity.prefix);
    expect(deadNames).toEqual([`${dead.identity.prefix}f01_of_dead`, `${dead.identity.prefix}tpl_x_selftest`]);
    expect(aliveNames).toHaveLength(2);
    expect(youngNames).toHaveLength(2);

    // While the old run is alive, a sweep leaves it alone, like the other old run.
    // (Another `test:db` that runs at the same time may have stale databases of its own: the
    // assertions are about the runs of this test.)
    const early = await young.sweepStale();
    for (const name of [...deadNames, ...aliveNames, ...youngNames, db.name]) expect(early.dropped).not.toContain(name);
    expect(early.keptLive).toEqual(expect.arrayContaining([...deadNames, ...aliveNames]));
    expect(await namesWithPrefix(dead.identity.prefix)).toEqual(deadNames);

    // The crash: the run's process is gone, its session and its liveness lock with it.
    await dead.close();

    const sweeper = await startPrivateRun('swp');
    started.push(sweeper);
    const report = await sweeper.sweepStale();

    expect(await goneSoon(dead.identity.prefix)).toEqual([]);
    expect(await namesWithPrefix(alive.identity.prefix)).toEqual(aliveNames);
    expect(await namesWithPrefix(young.identity.prefix)).toEqual(youngNames);
    expect(report.keptLive).toEqual(expect.arrayContaining(aliveNames));
    expect(report.keptYounger).toEqual(expect.arrayContaining([...youngNames, db.name]));
    expect(report.failed.filter((failure) => deadNames.includes(failure.name))).toEqual([]);
    for (const name of report.dropped) expect(name.startsWith('dems_test_')).toBe(true);
    for (const name of [...aliveNames, ...youngNames, db.name]) expect(report.dropped).not.toContain(name);
    console.log(
      `[test:db] sweep: dropped ${report.dropped.length} (${report.dropped.join(', ')}); ` +
        `kept ${report.keptLive.length} of live runs, ${report.keptYounger.length} of younger runs`,
    );

    // The databases of the run in progress, of this file included, were not touched.
    expect((await db.appPool().query<{ db: string }>('SELECT current_database()::text AS db')).rows).toEqual([{ db: db.name }]);
  });

  it('once the old run that was alive has ended without cleaning up, the next sweep takes it', async () => {
    const alive = started.find((run) => run.identity.label.endsWith('aliv'));
    expect(alive).toBeDefined();
    if (alive === undefined) return;
    const names = await namesWithPrefix(alive.identity.prefix);
    expect(names).toHaveLength(2);
    await alive.close();
    const sweeper = started.find((run) => run.identity.label.endsWith('swp'));
    expect(sweeper).toBeDefined();
    if (sweeper === undefined) return;
    await sweeper.sweepStale();
    expect(await goneSoon(alive.identity.prefix)).toEqual([]);
  });

  it('a test file attached to a run cannot sweep', async () => {
    await expect(db.run.sweepStale()).rejects.toMatchObject({ code: 'RUN_NOT_OWNER' });
  });
});
