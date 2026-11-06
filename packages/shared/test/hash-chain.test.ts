// Audit hash chain (AC-55; EVT-30) and evidence integrity (EVT-13/14).
// verify() passes on the pristine chain; after inject('AUDIT_TAMPER') it fails at exactly the
// tampered index; clearing the fault repairs it. The evidence tamper hook fails verify() on
// exactly the altered track while the manifest and the simulated signature still match.
import { describe, expect, it } from 'vitest';
import {
  canonicalJSON,
  chainHash,
  createManualClock,
  createSim,
  GENESIS_HASH,
  selectAuditChainBreak,
  selectSystemState,
  sha256Hex,
  type AuditRow,
  type ScenarioName,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const run = (ms: number, step = 100) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  return { sim, clock, run, state: () => sim.store.getState() };
}

function body(row: AuditRow) {
  const { prevHash: _prev, hash: _hash, ...rest } = row;
  return rest;
}

describe('pristine chain', () => {
  it.each(['idle', 'recording', 'finalizing', 'fault-demo'] as const)('verifies for the %s scenario', (scenario) => {
    const h = harness(scenario);
    const { audit } = h.state();
    expect(audit.rows[0]?.prevHash).toBe(GENESIS_HASH);
    expect(h.sim.actions.verifyAuditChain()).toEqual({ ok: true, checked: audit.rows.length, head: audit.head });
    for (const row of audit.rows) expect(row.hash).toBe(sha256Hex(row.prevHash + canonicalJSON(body(row))));
  });

  it('still verifies after a full live session (create → seal → verify → export)', () => {
    const h = harness();
    h.sim.actions.signIn('andi.pratama', 'demo-2026');
    h.sim.actions.createSession({
      caseNumber: 'LP/2026/1001-0008',
      subjectType: 'TERSANGKA',
      subjectName: 'Chain Test',
      investigatorId: 'OPR-002',
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    h.sim.actions.beginPrecheck();
    h.run(5_000, 50);
    h.sim.actions.startRecording();
    h.run(60_000);
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    const evidenceId = h.state().evidence.at(-1)?.id ?? '';
    h.sim.actions.verify(evidenceId);
    expect(h.sim.actions.exportEvidence(evidenceId, { reason: 'Prosecutor request', destination: 'Kejaksaan' }).ok).toBe(true);
    const result = h.sim.actions.verifyAuditChain();
    expect(result.ok).toBe(true);
    // Rows stay in time order even when scheduled transitions and user actions interleave.
    const times = h.state().audit.rows.map((row) => row.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('verifies from the oldest kept row once the 1000-row ring drops rows', () => {
    const h = harness('recording');
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    for (let i = 0; i < 850; i += 1) h.sim.actions.addMarker(`M${i}`);
    const { audit } = h.state();
    expect(audit.rows).toHaveLength(1_000);
    expect(audit.dropped).toBeGreaterThan(0);
    expect(h.sim.actions.verifyAuditChain()).toMatchObject({ ok: true, checked: 1_000 });
  });
});

describe("inject('AUDIT_TAMPER') (EVT-30)", () => {
  it('fails at exactly the tampered index, and says so in its own audit row', () => {
    const h = harness();
    const rowsBefore = h.state().audit.rows.length;
    const expectedIndex = rowsBefore - 5;
    const target = h.state().audit.rows[expectedIndex];
    h.sim.actions.inject('AUDIT_TAMPER');
    const state = h.state();
    expect(h.sim.actions.verifyAuditChain()).toEqual({
      ok: false,
      checked: expectedIndex,
      index: expectedIndex,
      seq: target?.seq,
      reason: 'HASH_MISMATCH',
    });
    expect(state.audit.rows[expectedIndex]?.message).toMatch(/\[altered\]$/);
    expect(state.audit.rows.at(-1)).toMatchObject({
      type: 'AUDIT_CHAIN_DISCONTINUITY',
      severity: 'CRITICAL',
      details: { index: expectedIndex, seq: target?.seq, evt: 'EVT-30' },
    });
    // The new row still links to the true head: only the altered row breaks the chain.
    const newRow = state.audit.rows.at(-1) as AuditRow;
    expect(newRow.hash).toBe(chainHash(newRow.prevHash, body(newRow)));
    expect(selectAuditChainBreak(state)).toEqual({ seq: target?.seq, index: expectedIndex, id: target?.id });
    expect(state.security.posture).toBe('CRITICAL');
    expect(state.security.controls.find((control) => control.id === 'HASH_CHAIN')).toMatchObject({ ok: false });
    expect(selectSystemState(state)).toMatchObject({ state: 'CRITICAL' });
    expect(selectSystemState(state).flags.map((flag) => flag.id)).toContain('AUDIT_CHAIN');
    expect(state.alerts.at(-1)).toMatchObject({ kind: 'AUDIT_TAMPER', severity: 'CRITICAL', active: true });
  });

  it('fails at the index the target names, and keeps failing there as the chain grows', () => {
    const h = harness('recording');
    h.sim.actions.inject('AUDIT_TAMPER', { auditIndex: 12 });
    expect(h.sim.actions.verifyAuditChain()).toMatchObject({ ok: false, index: 12, reason: 'HASH_MISMATCH' });
    const totalAfterTamper = h.state().audit.total;
    h.run(60_000);
    expect(h.state().audit.total).toBeGreaterThan(totalAfterTamper); // the generator kept appending
    expect(h.sim.actions.verifyAuditChain()).toMatchObject({ ok: false, index: 12 });
  });

  it('clearFault repairs the row: PASS again, with FAULT_CLEARED appended', () => {
    const h = harness();
    h.sim.actions.inject('AUDIT_TAMPER');
    h.sim.actions.clearFault('AUDIT_TAMPER');
    const state = h.state();
    expect(h.sim.actions.verifyAuditChain().ok).toBe(true);
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_CLEARED', details: { kind: 'AUDIT_TAMPER' } });
    expect(selectAuditChainBreak(state)).toBeNull();
    expect(state.security.posture).toBe('SECURE');
  });

  it('is idempotent for the same target', () => {
    const h = harness();
    h.sim.actions.inject('AUDIT_TAMPER', { auditIndex: 3 });
    const total = h.state().audit.total;
    h.sim.actions.inject('AUDIT_TAMPER', { auditIndex: 3 });
    expect(h.state().audit.total).toBe(total);
  });
});

describe('evidence integrity (EVT-13/14 tamper hook)', () => {
  it('a pristine item verifies: every track, the manifest and the simulated signature', () => {
    const h = harness();
    const item = h.state().evidence[0]!;
    const result = h.sim.actions.verify(item.id);
    expect(result).toMatchObject({ evidenceId: item.id, ok: true, manifestOk: true, signatureOk: true });
    expect(result.tracks.every((track) => track.ok && track.actual === track.expected)).toBe(true);
    expect(item.signature).toMatchObject({ simulated: true, algorithm: 'SIMULATED-SHA256' });
    const after = h.state().evidence[0]!;
    expect(after.verification.status).toBe('PASS');
    expect(after.custody.at(-1)).toMatchObject({ action: 'VERIFIED' });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFIED', evidenceId: item.id });
  });

  it('tampered media fails on exactly the altered track; clearing restores PASS', () => {
    const h = harness();
    const id = h.state().evidence[1]!.id;
    h.sim.actions.inject('TAMPER', { evidenceId: id });
    const failed = h.sim.actions.verify(id);
    expect(failed.ok).toBe(false);
    expect(failed.tracks.filter((track) => !track.ok).map((track) => track.trackId)).toEqual(['AUDIO-02']);
    expect(failed).toMatchObject({ manifestOk: true, signatureOk: true });
    expect(h.state().evidence[1]!.verification.status).toBe('FAIL');
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFY_FAILED', severity: 'CRITICAL', evidenceId: id });
    // The enclosure switch is untouched: this is the evidence hook, not EVT-12.
    expect(h.state().security.tamper).toBe(false);

    h.sim.actions.clearFault('TAMPER', { evidenceId: id });
    expect(h.sim.actions.verify(id).ok).toBe(true);
  });

  it('tampering a named track fails that track only', () => {
    const h = harness();
    const id = h.state().evidence[2]!.id;
    h.sim.actions.inject('TAMPER', { evidenceId: id, trackId: 'VIDEO-01' });
    expect(h.sim.actions.verify(id).tracks.filter((track) => !track.ok).map((track) => track.trackId)).toEqual(['VIDEO-01']);
  });

  it('an unknown evidence ID throws SimNotFoundError', () => {
    const h = harness();
    expect(() => h.sim.actions.verify('EV-19700101-9999')).toThrow(/not found/);
  });
});
