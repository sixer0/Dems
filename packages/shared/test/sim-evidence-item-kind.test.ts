// Reconcile pass R (decisions D205, D207): the ONE rule of "what kind of item is on screen" and the ONE
// interrupted fact, tested once here; both clients read the same vector through their own readers.
//
// | Rule | Test |
// |------|------|
// | `sealedPackage` stated = a package sealed on this Core; DEMO_PACKAGE / SIMULATED without it = a bundled demo item; a signature or a version is never the test | "the mapping table" |
// | The contract's own `getEvidence` examples classify as their names say | "the contract's examples" |
// | The Core's `interrupted` (sealed manifest) answers when stated; else the custody entry; the manifest wins a disagreement | "the mapping table", "interruptedSealOfItem agrees" |
import { describe, expect, it } from 'vitest';
import { CORE_API_EXAMPLES, EvidenceDetailSchema } from '../src/api';
import { EVIDENCE_ITEM_KIND_VECTORS, evidenceItemKindOf, interruptedFactOf, interruptedSealOfItem, isBundledDemoItem, isSealedOnThisCore, sealedPackageOf } from '../src/sim';

describe('the kind of an evidence item, by the Core\'s own members', () => {
  it.each(EVIDENCE_ITEM_KIND_VECTORS.map((vector) => [vector.name, vector] as const))('the mapping table: %s', (_name, vector) => {
    expect(evidenceItemKindOf(vector.item)).toBe(vector.kind);
    expect([isSealedOnThisCore(vector.item), isBundledDemoItem(vector.item)]).toEqual([vector.kind === 'SEALED_HERE', vector.kind === 'DEMO']);
    const fact = interruptedFactOf(vector.item);
    expect([fact.interrupted, fact.cause]).toEqual([vector.interrupted, vector.cause]);
  });

  it('the vector names every kind, and both disagreements of the interrupted fact', () => {
    expect([...new Set(EVIDENCE_ITEM_KIND_VECTORS.map((vector) => vector.kind))].sort()).toEqual(['DEMO', 'RECORD', 'SEALED_HERE', 'UNKNOWN']);
    expect(EVIDENCE_ITEM_KIND_VECTORS.filter((vector) => vector.name.startsWith('disagreement'))).toHaveLength(2);
  });

  it("the contract's examples of getEvidence classify as their names say, and each is the strict shape of operation 40", () => {
    const examples = CORE_API_EXAMPLES.getEvidence?.responses[200] as Record<string, { value: { evidence: unknown; media: { source: string } } }>;
    const kinds = Object.fromEntries(Object.entries(examples).map(([name, example]) => [name, [evidenceItemKindOf(example.value.evidence), sealedPackageOf(example.value.evidence), example.value.media.source, interruptedFactOf(example.value.evidence).interrupted]]));
    expect(kinds).toEqual({
      withPackage: ['DEMO', null, 'DEMO_PACKAGE', null],
      productSealed: ['SEALED_HERE', 'PRESENT', 'LIVE_STREAM', false],
      productSealedInterrupted: ['SEALED_HERE', 'PRESENT', 'LIVE_STREAM', true],
      productSealedOneCamera: ['SEALED_HERE', 'PRESENT', 'LIVE_STREAM', false],
      noMedia: ['SEALED_HERE', 'NOT_READABLE', 'NONE', null],
      outsideCaseScope: ['SEALED_HERE', 'PRESENT', 'LIVE_STREAM', false],
      seedSealedDemo: ['SEALED_HERE', 'PRESENT', 'LIVE_STREAM', false],
    });
    for (const [name, example] of Object.entries(examples)) expect([name, EvidenceDetailSchema.safeParse(example.value).success]).toEqual([name, true]);
    // A bundled demo package is never named for a package sealed on this Core (decision D205).
    for (const example of Object.values(examples)) if (isSealedOnThisCore(example.value.evidence)) expect(example.value.media.source).not.toBe('DEMO_PACKAGE');
  });

  it('interruptedSealOfItem agrees with the item\'s own member wherever an item is on screen (D207)', () => {
    const examples = CORE_API_EXAMPLES.getEvidence?.responses[200] as Record<string, { value: { evidence: Parameters<typeof interruptedSealOfItem>[0] } }>;
    const interrupted = examples['productSealedInterrupted']!.value.evidence!;
    expect(interruptedSealOfItem(interrupted)).toEqual({ faultKind: 'CAPTURE_FAULT', endedAt: interrupted.custody[1]!.at });
    expect(interruptedSealOfItem(examples['productSealed']!.value.evidence)).toBeNull();
    const entry = { at: 5, action: 'RECORDING_INTERRUPTED', actorId: null, detail: 'CAPTURE_FAULT' };
    // The custody entry alone (the member is not stated): as before.
    expect(interruptedSealOfItem({ custody: [entry] })).toEqual({ faultKind: 'CAPTURE_FAULT', endedAt: 5 });
    // The manifest says NOT interrupted: no interrupted seal, whatever the custody says.
    expect(interruptedSealOfItem({ custody: [entry], interrupted: false } as never)).toBeNull();
    // The manifest says interrupted, no custody entry: named, with the Core's cause and the item's end.
    expect(interruptedSealOfItem({ custody: [], interrupted: true, interruptedCause: 'CAMERA_LOST', endedAt: 9 } as never)).toEqual({ faultKind: 'CAMERA_LOST', endedAt: 9 });
    for (const vector of EVIDENCE_ITEM_KIND_VECTORS) {
      const item = vector.item as { custody?: unknown } | null;
      if (item === null || !Array.isArray(item.custody)) continue;
      expect([vector.name, interruptedSealOfItem(item as never) !== null]).toEqual([vector.name, vector.interrupted === true]);
    }
    expect([interruptedSealOfItem(null), interruptedSealOfItem(undefined)]).toEqual([null, null]);
  });
});
