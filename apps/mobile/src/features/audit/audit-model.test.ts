/**
 * Audit view model (step 87): newest-first filtering, the actor rule shared with the web page, the
 * fault / method facts, the chain-link status and the strip's pinned older break. Real simulator
 * rows (82 at load, D61), no React.
 */
import { describe, expect, it } from '@jest/globals';
import { FaultKind, OPERATORS, selectAuditChainBreak } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import {
  ALL,
  DEFAULT_AUDIT_QUERY,
  NO_OPERATOR,
  actorKindOf,
  authMethodOf,
  chainLinkOf,
  eventRecordJson,
  faultKindOf,
  filterAuditRows,
  isFiltered,
  menuFilterCount,
  shortHash,
  stripEntries,
} from './audit-model';

const textOf = () => '';

describe('audit model', () => {
  it('lists the ring newest first and filters by category, severity and operator', () => {
    const { sim } = createTestSim();
    const rows = sim.store.getState().audit.rows;
    expect(rows.length).toBeGreaterThan(50);

    const all = filterAuditRows(rows, DEFAULT_AUDIT_QUERY, textOf);
    expect(all.map((row) => row.seq)).toEqual(rows.map((row) => row.seq).reverse());

    const auth = filterAuditRows(rows, { ...DEFAULT_AUDIT_QUERY, category: 'AUTH' }, textOf);
    expect(auth.length).toBeGreaterThan(0);
    expect(auth.every((row) => row.category === 'AUTH')).toBe(true);

    const warnings = filterAuditRows(rows, { ...DEFAULT_AUDIT_QUERY, severity: 'WARNING' }, textOf);
    expect(warnings.every((row) => row.severity === 'WARNING')).toBe(true);

    const operatorId = OPERATORS[0]!.id;
    const mine = filterAuditRows(rows, { ...DEFAULT_AUDIT_QUERY, operator: operatorId }, textOf);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((row) => row.actorId === operatorId)).toBe(true);
    const none = filterAuditRows(rows, { ...DEFAULT_AUDIT_QUERY, operator: NO_OPERATOR }, textOf);
    expect(none.every((row) => row.actorId === null)).toBe(true);
    expect(mine.length + none.length).toBeLessThan(all.length + 1);
  });

  it('searches the shown text, the entry number, IDs and the hash; every word must match', () => {
    const { sim } = createTestSim();
    const rows = sim.store.getState().audit.rows;
    const target = rows[10]!;
    expect(filterAuditRows(rows, { ...DEFAULT_AUDIT_QUERY, text: `#${target.seq}` }, textOf).map((row) => row.seq)).toContain(target.seq);
    expect(filterAuditRows(rows, { ...DEFAULT_AUDIT_QUERY, text: shortHash(target.hash) }, textOf).map((row) => row.id)).toEqual([target.id]);
    const labelled = filterAuditRows(rows, { ...DEFAULT_AUDIT_QUERY, text: 'alpha beta' }, (row) => (row.id === target.id ? 'Alpha Beta' : 'alpha'));
    expect(labelled.map((row) => row.id)).toEqual([target.id]);
    expect(isFiltered(DEFAULT_AUDIT_QUERY)).toBe(false);
    expect(isFiltered({ ...DEFAULT_AUDIT_QUERY, text: '  ' })).toBe(false);
    expect(menuFilterCount({ ...DEFAULT_AUDIT_QUERY, severity: 'CRITICAL', operator: NO_OPERATOR })).toBe(2);
    expect(DEFAULT_AUDIT_QUERY.category).toBe(ALL);
  });

  it('names a null actor "unverified" only at the sign-in form; reads method and fault codes', () => {
    expect(actorKindOf({ actorId: 'OPR-001', type: 'AUTH_SUCCESS' })).toBe('OPERATOR');
    expect(actorKindOf({ actorId: null, type: 'AUTH_FAILED' })).toBe('UNVERIFIED');
    expect(actorKindOf({ actorId: null, type: 'AUTH_LOCKED' })).toBe('UNVERIFIED');
    expect(actorKindOf({ actorId: null, type: 'FAULT_RAISED' })).toBe('SYSTEM');

    const test = createTestSim();
    test.sim.actions.signInWithBiometric('OPR-001');
    test.sim.actions.inject(FaultKind.MIC_CLIP);
    const rows = test.sim.store.getState().audit.rows;
    const signIn = rows.filter((row) => row.type === 'AUTH_SUCCESS').at(-1)!;
    expect(authMethodOf(signIn)).toBe('BIOMETRIC');
    const fault = rows.filter((row) => row.type === 'FAULT_RAISED').at(-1)!;
    expect(faultKindOf(fault)).toBe('MIC_CLIP');
    expect(authMethodOf(fault)).toBeNull();
  });

  it('marks exactly the AUDIT_TAMPER row BROKEN and pins a break older than the strip', () => {
    const test = createTestSim();
    test.sim.actions.inject(FaultKind.AUDIT_TAMPER);
    const state = test.sim.store.getState();
    const breakSeq = selectAuditChainBreak(state)!.seq;
    const verify = test.sim.actions.verifyAuditChain();
    expect(verify.ok).toBe(false);
    expect(verify.ok ? null : verify.seq).toBe(breakSeq);
    const broken = state.audit.rows.filter((row) => chainLinkOf(row, breakSeq) === 'BROKEN');
    expect(broken.map((row) => row.seq)).toEqual([breakSeq]);
    expect(chainLinkOf(broken[0]!, null)).toBe('LINKED');

    const inStrip = stripEntries(state.audit.rows, breakSeq, 8);
    expect(inStrip.tail).toHaveLength(8);
    expect(inStrip.olderBreakSeq).toBeNull(); // the default target is 5 from the end
    const short = stripEntries(state.audit.rows, breakSeq, 3);
    expect(short.olderBreakSeq).toBe(breakSeq);
  });

  it('shows the hashed record without the English message fallback', () => {
    const { sim } = createTestSim();
    const row = sim.store.getState().audit.rows.at(-1)!;
    const json = eventRecordJson(row);
    expect(JSON.parse(json)).toMatchObject({ seq: row.seq, id: row.id, type: row.type, details: row.details });
    expect(json).not.toContain('"message"');
    expect(shortHash(row.hash)).toHaveLength(8);
  });
});
