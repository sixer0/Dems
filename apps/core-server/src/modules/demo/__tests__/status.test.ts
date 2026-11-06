// The pure parts of operation 71 `getDemoStatus` (plan row W43; spec §7.16; contract
// `DemoStatusSchema`): the stored seed facts, and the mapping of the committed state.
import { DemoStatusSchema } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { LOADABLE_SCENARIOS, READ_SEED_FACTS, demoStatusOf, seedFactsOf } from '../index';
import { FIXED_NOW, committedOf, scenarioState } from './support';

describe('seedFactsOf: the one row of core_state', () => {
  it('reads the two instants from their decimal text; no reset yet is null', () => {
    expect(seedFactsOf([{ seeded_at: '1790823600000', last_reset_at: null }])).toEqual({ seededAt: 1_790_823_600_000, lastResetAt: null });
    expect(seedFactsOf([{ seeded_at: '1790823600000', last_reset_at: '1924992002000' }])).toEqual({ seededAt: 1_790_823_600_000, lastResetAt: 1_924_992_002_000 });
  });

  it('no row, or more than one, is a defect: it throws and names the count, never a value', () => {
    expect(() => seedFactsOf([])).toThrow('core_state holds 0 row(s); a seeded database holds one');
    const row = { seeded_at: '1', last_reset_at: null };
    expect(() => seedFactsOf([row, row])).toThrow('core_state holds 2 row(s); a seeded database holds one');
  });

  it.each([['-1'], ['1.5'], ['1e3'], [''], ['abc'], ['99999999999999999'], [' 12']])('an instant that is no whole number of milliseconds (%j) is refused, for either column', (text) => {
    expect(() => seedFactsOf([{ seeded_at: text, last_reset_at: null }])).toThrow('core_state.seeded_at is not an instant in milliseconds');
    expect(() => seedFactsOf([{ seeded_at: '1', last_reset_at: text }])).toThrow('core_state.last_reset_at is not an instant in milliseconds');
  });

  it('the statement reads the two columns as text and nothing else', () => {
    expect(READ_SEED_FACTS).toBe('SELECT seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at FROM public.core_state');
  });
});

describe('demoStatusOf', () => {
  it.each(LOADABLE_SCENARIOS)('the scenario %s: its name, its active faults by kind, instant and target, and the facts handed in; valid against the contract', (name) => {
    const state = committedOf(scenarioState(name));
    const status = demoStatusOf(state, 9, { seededAt: FIXED_NOW, lastResetAt: FIXED_NOW + 1 });
    expect(status).toEqual({
      scenarios: ['idle', 'recording', 'finalizing', 'fault-demo'],
      scenario: name,
      activeFaults: state.faults.active.map((fault) => ({ kind: fault.kind, since: fault.since, target: fault.target })),
      seededAt: FIXED_NOW,
      lastResetAt: FIXED_NOW + 1,
      epoch: 9,
    });
    expect(DemoStatusSchema.safeParse(status).success).toBe(true);
    expect(status.activeFaults.length > 0).toBe(name === 'fault-demo');
  });

  it('hands out a list of its own: the caller cannot change the vocabulary or the engine\'s slice through the answer', () => {
    const state = committedOf(scenarioState('fault-demo'));
    const status = demoStatusOf(state, 1, { seededAt: 1, lastResetAt: null });
    expect(status.scenarios).not.toBe(LOADABLE_SCENARIOS);
    expect(Object.isFrozen(LOADABLE_SCENARIOS)).toBe(true);
    expect(status.activeFaults).not.toBe(state.faults.active);
    expect(status.activeFaults[0]).not.toBe(state.faults.active[0]);
  });
});
