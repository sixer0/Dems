// The first measurement of this host (database contract §10.1: "No figure exists for this host;
// the test helper records the first measurement"). Later rows budget on these numbers, so the
// test prints them; it asserts only that they are sane.
import { describe, expect, it } from 'vitest';
import { LOG_PREFIX } from '../constants';
import type { TemplateDefinition } from '../hooks';
import { useTestDatabase } from '../index';
import { SELFTEST_TEMPLATE, probeSchemaHook } from '../testing/probe-hooks';
import { median } from '../testing/private-run';

const CLONES = 15;
const USED_CLONES = 7;

/** A template of this file's own, so that its build is timed here whoever built the shared one. */
const TIMING_TEMPLATE: TemplateDefinition = { key: 'x_timing', base: 'empty', build: probeSchemaHook };

const db = useTestDatabase({ template: SELFTEST_TEMPLATE });

function ms(value: number | undefined): string {
  return value === undefined ? 'n/a' : `${value.toFixed(1)} ms`;
}

describe('measured on this host', () => {
  it('a template build, the first clone, the median clone and the median drop', async () => {
    const first = await db.another({ template: TIMING_TEMPLATE, slug: 'timing_first' });
    const build = db.run.templateTimings.find((timing) => timing.key === TIMING_TEMPLATE.key);
    expect(build).toBeDefined();

    const clones: number[] = [];
    const drops: number[] = [];
    const size = await first.ownerPool().query<{ bytes: string }>('SELECT pg_database_size(current_database())::text AS bytes');
    let started = performance.now();
    await first.drop();
    drops.push(performance.now() - started);
    for (let i = 0; i < CLONES; i += 1) {
      const clone = await db.another({ template: TIMING_TEMPLATE, slug: `timing_${i}` });
      clones.push(clone.timings.cloneMs);
      started = performance.now();
      await clone.drop();
      drops.push(performance.now() - started);
    }

    // What a module row's file does at its end: both pools were used, then the drop.
    const usedDrops: number[] = [];
    for (let i = 0; i < USED_CLONES; i += 1) {
      const clone = await db.another({ template: TIMING_TEMPLATE, slug: `timing_used_${i}` });
      await Promise.all([clone.appPool().query('SELECT 1'), clone.appPool().query('SELECT 2'), clone.ownerPool().query('SELECT 3')]);
      started = performance.now();
      await clone.drop();
      usedDrops.push(performance.now() - started);
    }

    console.log(
      [
        `${LOG_PREFIX} timing (one-table template, ${Math.round(Number(size.rows[0]?.bytes ?? 0) / 1024)} kB per database):`,
        `  template build   total ${ms(build?.totalMs)} = create from the empty template ${ms(build?.createMs)} + hook ${ms(build?.hookMs)} + lock`,
        `  clone, this file ${ms(db.timings.cloneMs)} (lock wait ${ms(db.timings.lockWaitMs)})`,
        `  clone, first     ${ms(first.timings.cloneMs)}`,
        `  clone, next ${CLONES}   median ${ms(median(clones))}, min ${ms(Math.min(...clones))}, max ${ms(Math.max(...clones))}`,
        `  drop, ${drops.length} times   median ${ms(median(drops))}, max ${ms(Math.max(...drops))} (no session was open)`,
        `  drop, ${usedDrops.length} times    median ${ms(median(usedDrops))}, max ${ms(Math.max(...usedDrops))} (three sessions of two roles closed first)`,
      ].join('\n'),
    );

    expect(first.timings.cloneMs).toBeGreaterThan(0);
    expect(median(clones)).toBeGreaterThan(0);
    // Sanity only: the sources state 30 to 400 ms per clone; ten times that would be a defect.
    expect(median(clones)).toBeLessThan(4_000);
    expect(build?.totalMs ?? 0).toBeLessThan(20_000);
  }, 120_000);
});
