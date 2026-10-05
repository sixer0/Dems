// What a reset writes beyond the seed: the epoch, the lineage row, the SCENARIO_LOADED row
// (plan row W29; database contract §8.5 R-5b, R-5e, R-5f; LN-1 to LN-3). Database-free.
import { AUDIT_TYPE_CATEGORY, DEFAULT_SEED, createIdleState, recordActivity, verifyAuditChain } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { AUDIT_DETAIL_FORBIDDEN_KEYS } from '../../schema';
import { ResetError } from '../errors';
import { EMPTY_CHAIN_HEAD, assertNow, planReset, resolveRequest, scenarioLoadedActivity, type ResetRequest, type SourceFacts } from '../plan';

const NOW = Date.UTC(2026, 9, 1, 4, 0, 0);
const HEAD = 'ab'.repeat(32);
const request: ResetRequest = { scenario: 'idle', reason: 'RESET', actorId: 'OPR-002' };

const seeded: SourceFacts = {
  epoch: '4',
  headSeq: '83',
  headHash: HEAD,
  firstSeq: '1',
  rowCount: '83',
  lineageRows: 0,
  maxResetNo: null,
  maxLineageEpoch: null,
};

function refusal(run: () => unknown): ResetError {
  try {
    run();
  } catch (error) {
    if (error instanceof ResetError) return error;
    throw error;
  }
  throw new Error('not refused');
}

describe('the options of a call', () => {
  it('default to scenario idle, reason RESET and no actor', () => {
    expect(resolveRequest({})).toEqual({ scenario: 'idle', reason: 'RESET', actorId: null });
    expect(resolveRequest({ scenario: 'fault-demo', reason: 'SCENARIO_LOAD', actorId: 'OPR-001' })).toEqual({
      scenario: 'fault-demo',
      reason: 'SCENARIO_LOAD',
      actorId: 'OPR-001',
    });
  });

  it.each([
    ['an unknown scenario', { scenario: 'night' }, 'scenario must be one of idle, recording, finalizing, fault-demo'],
    ['an empty scenario', { scenario: '' }, 'scenario must be one of'],
    ['an unknown reason', { reason: 'CLEANUP' }, 'reason must be one of RESET, SCENARIO_LOAD'],
    ['an actor that is not an operator identifier', { actorId: 'andi' }, 'the actor must be an operator identifier'],
    ['an actor with a statement in it', { actorId: "OPR-001'; --" }, 'the actor must be an operator identifier'],
  ])('%s is refused before anything is opened, and its value is not echoed', (_label, input, message) => {
    const error = refusal(() => resolveRequest(input));
    expect(error).toMatchObject({ code: 'RESET_OPTIONS_INVALID', step: 'R-0', targetUntouched: true });
    expect(error.message).toContain(message);
    for (const value of Object.values(input)) if (value !== '') expect(error.message).not.toContain(String(value));
  });

  it('the clock must return a positive whole number of milliseconds', () => {
    expect(assertNow(NOW)).toBe(NOW);
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60, '1790827200000', null, undefined]) {
      expect(refusal(() => assertNow(bad)).code).toBe('RESET_OPTIONS_INVALID');
    }
  });
});

describe('a first build: the target does not exist', () => {
  it('starts at epoch 0, writes no lineage row and no SCENARIO_LOADED row', () => {
    expect(planReset(null, request, NOW)).toEqual({ firstBuild: true, previousEpoch: null, epoch: 0, lineage: null, scenarioLoaded: null });
  });
});

describe('a reset of a seeded database', () => {
  it('continues the epoch and records the chain that R-3 read (LN-2)', () => {
    expect(planReset(seeded, request, NOW)).toEqual({
      firstBuild: false,
      previousEpoch: 4,
      epoch: 5,
      lineage: {
        resetNo: '1',
        epoch: '4',
        headHash: HEAD,
        rowCount: '83',
        firstSeq: '1',
        lastSeq: '83',
        resetAt: String(NOW),
        actorId: 'OPR-002',
        reason: 'RESET',
        scenario: 'idle',
      },
      scenarioLoaded: { previousRows: 83, previousHead: HEAD },
    });
  });

  it('numbers the lineage row after the highest carried one (LN-1)', () => {
    const plan = planReset({ ...seeded, lineageRows: 11, maxResetNo: '11', maxLineageEpoch: '3' }, { ...request, actorId: null, reason: 'SCENARIO_LOAD', scenario: 'recording' }, NOW);
    expect(plan.lineage).toMatchObject({ resetNo: '12', epoch: '4', actorId: null, reason: 'SCENARIO_LOAD', scenario: 'recording' });
  });

  it('records a chain that is not intact as it is: nothing is "repaired" in the record', () => {
    // 80 rows, the first is sequence 3, the head says 90: a damaged chain. The record says so.
    const plan = planReset({ ...seeded, rowCount: '80', firstSeq: '3', headSeq: '90' }, request, NOW);
    expect(plan.lineage).toMatchObject({ rowCount: '80', firstSeq: '3', lastSeq: '90' });
    expect(plan.scenarioLoaded).toEqual({ previousRows: 80, previousHead: HEAD });
  });

  it('keeps every digit of a number beyond 2^53 in the lineage row', () => {
    const plan = planReset({ ...seeded, lineageRows: 1, maxResetNo: '9007199254740993', maxLineageEpoch: '2' }, request, NOW);
    expect(plan.lineage?.resetNo).toBe('9007199254740994');
  });

  it('refuses an epoch or a row count the shared code cannot represent, before anything is built', () => {
    expect(refusal(() => planReset({ ...seeded, epoch: '9007199254740993' }, request, NOW))).toMatchObject({ code: 'RESET_READ_FAILED', step: 'R-3' });
    expect(refusal(() => planReset({ ...seeded, rowCount: '9007199254740993' }, request, NOW))).toMatchObject({ code: 'RESET_READ_FAILED', step: 'R-3' });
    expect(refusal(() => planReset({ ...seeded, epoch: '-1' }, request, NOW)).code).toBe('RESET_READ_FAILED');
    expect(refusal(() => planReset({ ...seeded, headHash: 'not-a-hash' }, request, NOW)).code).toBe('RESET_READ_FAILED');
  });
});

describe('a database that exists and was never seeded', () => {
  const neverSeeded: SourceFacts = {
    epoch: null,
    headSeq: '0',
    headHash: EMPTY_CHAIN_HEAD,
    firstSeq: null,
    rowCount: '0',
    lineageRows: 0,
    maxResetNo: null,
    maxLineageEpoch: null,
  };

  it('starts at epoch 0 and writes no lineage row (LN-1); the new chain says it replaced an empty one', () => {
    expect(EMPTY_CHAIN_HEAD).toBe('0'.repeat(64));
    expect(planReset(neverSeeded, request, NOW)).toEqual({
      firstBuild: false,
      previousEpoch: null,
      epoch: 0,
      lineage: null,
      scenarioLoaded: { previousRows: 0, previousHead: EMPTY_CHAIN_HEAD },
    });
  });

  it('an empty audit log writes no lineage row even when the database was seeded once (LN-1)', () => {
    const plan = planReset({ ...neverSeeded, epoch: '7' }, request, NOW);
    expect(plan).toMatchObject({ previousEpoch: 7, epoch: 8, lineage: null });
  });
});

describe('a damaged database: a chain or a lineage, and no state row', () => {
  it('takes the epoch after the newest one the lineage records, so the record can still be written', () => {
    const plan = planReset({ ...seeded, epoch: null, lineageRows: 2, maxResetNo: '2', maxLineageEpoch: '9' }, request, NOW);
    expect(plan).toMatchObject({ previousEpoch: 10, epoch: 11 });
    expect(plan.lineage).toMatchObject({ resetNo: '3', epoch: '10' });
  });

  it('with no lineage either, the discarded chain is recorded under epoch 0', () => {
    const plan = planReset({ ...seeded, epoch: null }, request, NOW);
    expect(plan).toMatchObject({ previousEpoch: 0, epoch: 1 });
    expect(plan.lineage?.epoch).toBe('0');
  });
});

describe('the SCENARIO_LOADED row and event', () => {
  it('a reset: the shared simulator\'s messages, the four details of DC-7, the actor', () => {
    const activity = scenarioLoadedActivity(request, { previousRows: 83, previousHead: HEAD });
    expect(activity).toEqual({
      audit: {
        type: 'SCENARIO_LOADED',
        message: 'Demo reset (fresh dataset)',
        actorId: 'OPR-002',
        details: { scenario: 'idle', reset: true, previousRows: 83, previousHead: HEAD },
      },
      event: { type: 'SCENARIO_LOADED', message: 'Demo reset', params: { scenario: 'idle', reset: true } },
    });
  });

  it('a scenario load from the command line: no actor, reset false', () => {
    const activity = scenarioLoadedActivity({ scenario: 'recording', reason: 'SCENARIO_LOAD', actorId: null }, { previousRows: 0, previousHead: EMPTY_CHAIN_HEAD });
    expect(activity.audit).toMatchObject({ message: 'Demo scenario "recording" loaded', actorId: null, details: { scenario: 'recording', reset: false, previousRows: 0 } });
    expect(activity.event).toMatchObject({ message: 'Demo scenario loaded · recording', params: { scenario: 'recording', reset: false } });
  });

  it('holds no key the audit table refuses, and extends the seeded chain by exactly one verifiable row', () => {
    const activity = scenarioLoadedActivity(request, { previousRows: 83, previousHead: HEAD });
    for (const key of Object.keys(activity.audit?.details ?? {})) expect(AUDIT_DETAIL_FORBIDDEN_KEYS as readonly string[]).not.toContain(key);
    expect(AUDIT_TYPE_CATEGORY.SCENARIO_LOADED).toBe('SYSTEM');

    const state = createIdleState({ now: NOW, seed: DEFAULT_SEED });
    const next = { ...state, ...recordActivity(state, NOW, activity) };
    expect(next.audit.total).toBe(state.audit.total + 1);
    expect(next.events).toHaveLength(state.events.length + 1);
    expect(next.meta.counters.event).toBe(state.meta.counters.event + 1);
    const row = next.audit.rows.at(-1);
    expect(row).toMatchObject({ seq: state.audit.total + 1, type: 'SCENARIO_LOADED', actorId: 'OPR-002', prevHash: state.audit.head, at: NOW });
    expect(verifyAuditChain(next.audit).ok).toBe(true);
  });
});
