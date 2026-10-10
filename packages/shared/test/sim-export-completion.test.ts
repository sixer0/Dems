// Review finding R93-03 (ruling D178): custody is evidence of what happened. A REQUEST of an export
// writes its request row and changes nothing of the item; status EXPORTED and the custody entry are
// the COMPLETION's. The simulator's own job is done inside its request, so the two are one step
// there; a Core that defers the completion applies it when its job has completed, and never for a
// job that failed.
import { describe, expect, it } from 'vitest';
import {
  EXPORT_DOWNLOADED_REASON,
  completeEvidenceExportTransition,
  createManualClock,
  createSim,
  exportEvidenceTransition,
  noteEvidenceExportDownloadTransition,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

function supervisorState(): { state: SimState; evidenceId: string } {
  const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'idle' });
  sim.actions.signIn('andi.pratama', 'demo-2026');
  const state = sim.store.getState();
  const evidenceId = state.evidence.find((item) => item.status === 'SEALED')?.id ?? '';
  expect(evidenceId).not.toBe('');
  return { state, evidenceId };
}
const itemOf = (state: SimState, id: string) => state.evidence.find((item) => item.id === id);
const REQUEST = { reason: 'Prosecutor request', destination: 'Case file transfer' } as const;

describe('R93-03: the request and the completion of an export', () => {
  it('a DEFERRED request writes the request row and leaves the item as it was: no status, no custody entry', () => {
    const { state, evidenceId } = supervisorState();
    const before = itemOf(state, evidenceId);
    const { state: requested, result } = exportEvidenceTransition(state, START + 1_000, evidenceId, { ...REQUEST, kind: 'COMPOSITE', completion: 'DEFERRED' });
    expect(result).toEqual({ ok: true, status: 202, exportId: 'EXP-000032' });
    expect(itemOf(requested, evidenceId)).toEqual(before);
    const row = requested.audit.rows.at(-1);
    expect(row).toMatchObject({ type: 'EVIDENCE_EXPORTED', evidenceId, actorId: 'OPR-002', details: { exportId: 'EXP-000032', destination: 'Case file transfer', reason: 'Prosecutor request', kind: 'COMPOSITE' } });
    expect(row?.message).toContain('requested');
  });

  it('the completion marks the item EXPORTED with ONE custody entry at the instant of the completion; nothing but the completion does', () => {
    const { state, evidenceId } = supervisorState();
    const custody = itemOf(state, evidenceId)?.custody.length ?? 0;
    const requested = exportEvidenceTransition(state, START + 1_000, evidenceId, { ...REQUEST, completion: 'DEFERRED' }).state;
    const audit = requested.audit.total;
    const completed = completeEvidenceExportTransition(requested, START + 9_000, { evidenceId, exportId: 'EXP-000032', operatorId: 'OPR-002', destination: 'Case file transfer' });
    const item = itemOf(completed, evidenceId);
    expect(item?.status).toBe('EXPORTED');
    expect(item?.custody.length).toBe(custody + 1);
    expect(item?.custody.at(-1)).toEqual({ at: START + 9_000, action: 'EXPORTED', actorId: 'OPR-002', detail: 'Case file transfer' });
    // The request row stands; the completion adds no second request row.
    expect(completed.audit.total).toBe(audit);
  });

  it('a request that is never completed (a failed job) leaves no trace of an export on the item', () => {
    const { state, evidenceId } = supervisorState();
    const requested = exportEvidenceTransition(state, START + 1_000, evidenceId, { ...REQUEST, completion: 'DEFERRED' }).state;
    expect(itemOf(requested, evidenceId)?.status).toBe('SEALED');
    expect(itemOf(requested, evidenceId)?.custody.some((entry) => entry.action === 'EXPORTED')).toBe(false);
  });

  it('the simulator completes inside its request: the same item as request + completion, in one step', () => {
    const { state, evidenceId } = supervisorState();
    const direct = exportEvidenceTransition(state, START + 1_000, evidenceId, REQUEST).state;
    const requested = exportEvidenceTransition(state, START + 1_000, evidenceId, { ...REQUEST, completion: 'DEFERRED' }).state;
    const twoSteps = completeEvidenceExportTransition(requested, START + 1_000, { evidenceId, exportId: 'EXP-000032', operatorId: 'OPR-002', destination: 'Case file transfer' });
    expect(itemOf(direct, evidenceId)).toEqual(itemOf(twoSteps, evidenceId));
    expect(itemOf(direct, evidenceId)?.status).toBe('EXPORTED');
  });

  it('the completion throws for an unknown item and leaves an archived item alone', () => {
    const { state, evidenceId } = supervisorState();
    expect(() => completeEvidenceExportTransition(state, START, { evidenceId: 'EV-20990101-0001', exportId: 'EXP-000032', operatorId: null, destination: '' })).toThrow();
    const archived: SimState = { ...state, evidence: state.evidence.map((item) => (item.id === evidenceId ? { ...item, status: 'ARCHIVED' } : item)) };
    expect(completeEvidenceExportTransition(archived, START, { evidenceId, exportId: 'EXP-000032', operatorId: null, destination: '' })).toBe(archived);
  });
});

describe('R93-05: a download of a finished export is recorded', () => {
  it('one audit row of the export type with the reason EXPORT_DOWNLOADED and NO exportId (never read as a request), one custody entry', () => {
    const { state, evidenceId } = supervisorState();
    const noted = noteEvidenceExportDownloadTransition(state, START + 5_000, { evidenceId, jobId: 'EXPJ-000032', operatorId: 'OPR-002', deviceId: null, bytes: 4_096 });
    const row = noted.audit.rows.at(-1);
    expect(row).toMatchObject({ type: 'EVIDENCE_EXPORTED', evidenceId, actorId: 'OPR-002', details: { jobId: 'EXPJ-000032', reason: EXPORT_DOWNLOADED_REASON, bytes: 4_096 } });
    expect(row?.details).not.toHaveProperty('exportId');
    expect(itemOf(noted, evidenceId)?.custody.at(-1)).toEqual({ at: START + 5_000, action: 'EXPORT_DOWNLOADED', actorId: 'OPR-002', detail: 'EXPJ-000032' });
    expect(itemOf(noted, evidenceId)?.status).toBe('SEALED');
  });
});
