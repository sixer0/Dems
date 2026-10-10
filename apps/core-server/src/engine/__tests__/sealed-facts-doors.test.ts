// The sealed-facts transition of the engine host (task 3 wave H, driver C1; gate findings G94-04,
// G89-03, G89-04; decision D200): pure, on a state of the shared simulator.
import { createSim, type EvidenceItem, type SimState } from '@dems/shared/sim';
import { EvidenceSliceSchema } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { applySealedItemFactsTransition, type ItemWithSealedFacts, type SealedItemFacts } from '../sealed-facts-doors';

function stateWithItem(change: (item: EvidenceItem) => EvidenceItem = (item) => item): { state: SimState; item: EvidenceItem } {
  const state = createSim().store.getState();
  const first = state.evidence[0];
  if (first === undefined) throw new Error('the dataset holds no evidence item');
  const item = change(first);
  return { state: { ...state, evidence: [item, ...state.evidence.slice(1)] }, item };
}

const present = (item: EvidenceItem, over: Partial<Extract<SealedItemFacts, { sealedPackage: 'PRESENT' }>> = {}): SealedItemFacts => ({
  evidenceId: item.id,
  manifestHash: item.manifestHash,
  sealedPackage: 'PRESENT',
  interrupted: false,
  developmentKey: true,
  audioSourceIntervals: [
    { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 17_601, reason: 'START', sourceClass: 'FAKE' },
    { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 17_601, toMs: 49_001, reason: 'MANUAL', sourceClass: 'FAKE' },
    { seq: 3, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 49_001, toMs: 134_145, reason: 'MANUAL', sourceClass: 'FAKE' },
  ],
  files: [{ trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 68_363_781, sha256: 'a'.repeat(64), fragmentCount: 67, sha256Plain: 'b'.repeat(64), fragmentChainHead: 'c'.repeat(64) }],
  ...over,
});
const held = (state: SimState, evidenceId: string): ItemWithSealedFacts => state.evidence.find((item) => item.id === evidenceId) as ItemWithSealedFacts;

describe('applySealedItemFactsTransition', () => {
  it('G94-04: puts the THREE sealed intervals, the flag, the files and the key fact on the item; the slice still parses; nothing stored moved', () => {
    const { state, item } = stateWithItem();
    const next = applySealedItemFactsTransition(state, [present(item)]);
    const after = held(next, item.id);
    expect(after.audioSourceIntervals?.map((interval) => [interval.seq, interval.inputId, interval.sourceClass])).toEqual([[1, 'MIC-01', 'FAKE'], [2, 'MIC-02', 'FAKE'], [3, 'MIC-01', 'FAKE']]);
    expect(after.sealedPackage).toBe('PRESENT');
    expect(after.interrupted).toBe(false);
    expect(after).not.toHaveProperty('interruptedCause');
    expect(after.signature).toEqual({ ...item.signature, developmentKey: true });
    expect(after.files?.map((file) => file.trackId)).toEqual(['VIDEO-01']);
    expect(EvidenceSliceSchema.safeParse(next.evidence).success).toBe(true);
    // The stored members: the SAME objects (the write-through compares track rows only when `tracks` was replaced).
    expect(after.tracks).toBe(item.tracks);
    expect(after.custody).toBe(item.custody);
    for (const key of ['status', 'lifecycleStage', 'manifestHash', 'verification', 'sizeBytes', 'durationMs', 'sealedAt'] as const) expect(after[key]).toEqual(item[key]);
    // Every other item, and every other slice, is the same object.
    expect(next.evidence.slice(1)).toEqual(state.evidence.slice(1));
    expect(next.audit).toBe(state.audit);
    expect(next.meta).toBe(state.meta);
  });

  it('a second call with the same facts returns the SAME state (no statement, no revision)', () => {
    const { state, item } = stateWithItem();
    const once = applySealedItemFactsTransition(state, [present(item)]);
    expect(applySealedItemFactsTransition(once, [present(item)])).toBe(once);
    expect(applySealedItemFactsTransition(once, [])).toBe(once);
  });

  it('NEGATIVE CONTROL of the anchor: facts read under ANOTHER manifest digest, and facts of an unknown item, change nothing', () => {
    const { state, item } = stateWithItem();
    expect(applySealedItemFactsTransition(state, [present(item, { manifestHash: 'f'.repeat(64) })])).toBe(state);
    expect(applySealedItemFactsTransition(state, [present({ ...item, id: 'EV-20261010-0999' })])).toBe(state);
  });

  it('an interrupted seal carries the cause its own custody entry names; a clean one carries none', () => {
    const { state, item } = stateWithItem((first) => ({ ...first, custody: [...first.custody, { at: first.endedAt, action: 'RECORDING_INTERRUPTED', actorId: null, detail: 'CAMERA_DISCONNECT' }] }));
    const after = held(applySealedItemFactsTransition(state, [present(item, { interrupted: true })]), item.id);
    expect([after.interrupted, after.interruptedCause]).toEqual([true, 'CAMERA_DISCONNECT']);
    const plain = stateWithItem();
    const unnamed = held(applySealedItemFactsTransition(plain.state, [present(plain.item, { interrupted: true })]), plain.item.id);
    expect([unnamed.interrupted, unnamed.interruptedCause]).toEqual([true, null]);
  });

  it('NOT_READABLE states the state and no sealed fact - also when an earlier reading had put facts there; the key fact is absent, never false', () => {
    const { state, item } = stateWithItem();
    const read = applySealedItemFactsTransition(state, [present(item)]);
    const gone = applySealedItemFactsTransition(read, [{ evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'NOT_READABLE' }]);
    const after = held(gone, item.id);
    expect(after.sealedPackage).toBe('NOT_READABLE');
    expect(after).not.toHaveProperty('audioSourceIntervals');
    expect(after).not.toHaveProperty('interrupted');
    expect(after.signature).toEqual(item.signature);
    expect(after.tracks).toBe(item.tracks);
    expect(EvidenceSliceSchema.safeParse(gone.evidence).success).toBe(true);
    expect(applySealedItemFactsTransition(gone, [{ evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'NOT_READABLE' }])).toBe(gone);
  });
});
