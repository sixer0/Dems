// Fix pass F-M6 (code review row 80, findings R80-01 and R80-11): the transcript summary of a
// sealed item is written BY THE SEAL, and a revision moves its head only.
import { describe, expect, it } from 'vitest';
import { EvidenceItemSchema } from '../src/api/state-slices';
import { applySealingProgressTransition, completeSealTransition, createManualClock, createSim, FINALIZATION_ORDER, noteTranscriptRevisionTransition, type CompleteSealInput, type EvidenceTranscriptSummary, type SessionCreateInput, type SimState } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);
const HASH = hex('7a');

/** A session at the last step of a Core-driven seal, and the seal of it with `overrides`. */
function sealed(overrides: Partial<CompleteSealInput>): { state: SimState; evidenceId: string } {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const run = (ms: number): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  sim.actions.createSession(INPUT);
  sim.actions.beginPrecheck();
  run(5_000);
  sim.actions.startRecording();
  run(4_000);
  const sessionId = sim.store.getState().session?.id ?? '';
  sim.actions.stopRecording('Interview complete');
  const steps = FINALIZATION_ORDER.map((id, index) => ({ id, status: index < 5 ? ('DONE' as const) : ('RUNNING' as const), progress: index < 5 ? 100 : 90, etaMs: index < 5 ? null : 900, attempt: 1 }));
  const finalizing = applySealingProgressTransition(sim.store.getState(), clock.now(), { sessionId, steps });
  const at = clock.now() + 500;
  const state = completeSealTransition(finalizing, at, {
    sessionId,
    sealedAt: at,
    manifestSha256: hex('ab'),
    signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
    tracks: [
      { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') },
      { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: hex('02') },
    ],
    interrupted: false,
    durableEndAt: at - 2_000,
    transcriptSha256: null,
    labelsStatus: null,
    developmentSources: true,
    ...overrides,
  });
  sim.stop();
  return { state, evidenceId: state.session?.evidenceId ?? '' };
}

const itemOf = (state: SimState, evidenceId: string) => state.evidence.find((item) => item.id === evidenceId);

describe('R80-01: the seal writes the transcript summary on its item', () => {
  const summaries: readonly [string, Partial<CompleteSealInput>, EvidenceTranscriptSummary][] = [
    ['ASSEMBLED', { transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' }, { state: 'READY', sha256: HASH, machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE', revision: 0, failedChunks: 0, backendUnreachable: false }],
    ['PARTIAL with chunks', { transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' }, { state: 'PARTIAL', sha256: HASH, machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE', revision: 0, failedChunks: 3, backendUnreachable: true }],
    ['PARTIAL without a document', {}, { state: 'PARTIAL', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false }],
    ['DISABLED', {}, { state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false }],
  ];

  it.each(summaries)('%s: the item carries the summary it was handed, and passes the slice schema', (_name, columns, transcript) => {
    const { state, evidenceId } = sealed({ ...columns, transcript });
    const item = itemOf(state, evidenceId);
    expect(item?.transcript).toEqual(transcript);
    expect(EvidenceItemSchema.safeParse(JSON.parse(JSON.stringify(item))).success).toBe(true);
  });

  it('CONTROL: a seal that hands in no summary writes none (nothing is derived or defaulted)', () => {
    const { state, evidenceId } = sealed({ transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' });
    expect(itemOf(state, evidenceId)).toBeDefined();
    expect(itemOf(state, evidenceId)).not.toHaveProperty('transcript');
  });

  it('refuses a summary that names another transcript than the item, and seals nothing', () => {
    expect(() => sealed({ transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE', transcript: { state: 'READY', sha256: hex('99'), machineTranscriptHash: hex('99'), labelsStatus: 'UNAVAILABLE', revision: 0 } })).toThrow();
  });
});

describe('R80-01 / R80-11: the note of a Core publishes the whole summary once, then moves the head only', () => {
  it('an item without a summary takes the whole note: state, failed chunks, the unreachable backend, the head', () => {
    const { state, evidenceId } = sealed({ transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' });
    const next = noteTranscriptRevisionTransition(state, { evidenceId, revision: 2, state: 'PARTIAL', machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE', failedChunks: 4, backendUnreachable: true });
    expect(itemOf(next, evidenceId)?.transcript).toEqual({ state: 'PARTIAL', sha256: HASH, machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE', revision: 2, failedChunks: 4, backendUnreachable: true });
    // A declared absence is a summary too: revision 0, no hash.
    const disabled = noteTranscriptRevisionTransition(state, { evidenceId, revision: 0, state: 'DISABLED', machineTranscriptHash: null, labelsStatus: null, backendUnreachable: false });
    expect(itemOf(disabled, evidenceId)?.transcript).toEqual({ state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false });
  });

  it('R80-11: a revision of a PARTIAL transcript keeps `failedChunks` and `backendUnreachable`; only the head moves', () => {
    const held: EvidenceTranscriptSummary = { state: 'PARTIAL', sha256: HASH, machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE', revision: 0, failedChunks: 3, backendUnreachable: true };
    const { state, evidenceId } = sealed({ transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE', transcript: held });
    // What operation 85 says after its unit committed: it knows the document's state, not the manifest's counts.
    const next = noteTranscriptRevisionTransition(state, { evidenceId, revision: 1, state: 'PARTIAL', machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE' });
    expect(itemOf(next, evidenceId)?.transcript).toEqual({ ...held, revision: 1 });
    // The head only moves forward, and the same note again changes nothing.
    expect(noteTranscriptRevisionTransition(next, { evidenceId, revision: 1, state: 'PARTIAL', machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE' })).toBe(next);
    expect(noteTranscriptRevisionTransition(next, { evidenceId, revision: 0, state: 'READY', machineTranscriptHash: HASH, labelsStatus: 'UNAVAILABLE' })).toBe(next);
  });
});
