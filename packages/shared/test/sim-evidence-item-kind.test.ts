// Reconcile pass R (decisions D205, D207): the ONE rule of "what kind of item is on screen" and the ONE
// interrupted fact, tested once here; both clients read the same vector through their own readers.
//
// | Rule | Test |
// |------|------|
// | `sealedPackage` stated = a package sealed on this Core; DEMO_PACKAGE / SIMULATED without it = a bundled demo item; a signature or a version is never the test | "the mapping table" |
// | The contract's own `getEvidence` examples classify as their names say | "the contract's examples" |
// | The Core's `interrupted` (sealed manifest) answers when stated; else the custody entry; the manifest wins a disagreement | "the mapping table", "interruptedSealOfItem agrees" |
import { describe, expect, it } from 'vitest';
import {
  CORE_API_EXAMPLES,
  EVIDENCE_MEDIA_DEMONSTRATION_RECORD_EXAMPLE,
  EVIDENCE_NOT_SEALED_DIGEST_EXAMPLE,
  EVIDENCE_NOT_SEALED_ITEM_EXAMPLE,
  EXPORT_COMPOSITE_UNAVAILABLE_REASON as API_COMPOSITE_REASON,
  EXPORT_KINDS_EXAMPLE,
  EvidenceDetailSchema,
  EvidenceMediaRefSchema,
  EvidenceVerifyResultSchema,
  EXAMPLE_EVIDENCE_ITEM,
  EvidenceItemSchema,
  SECURITY_STATUS_EVIDENCE_VERIFICATION_EXAMPLE,
  SecurityStatusSchema,
  VERIFY_DEMONSTRATION_EXAMPLE,
  VERIFY_NOT_SEALED_EXAMPLE,
  VERIFY_NOT_SEALED_TEXT,
} from '../src/api';
import {
  EVIDENCE_ITEM_KIND_VECTORS,
  EVIDENCE_NOT_SEALED_DIGEST,
  EVIDENCE_NOT_SEALED_SIGNATURE,
  EXPORT_COMPOSITE_UNAVAILABLE_REASON,
  evidenceItemKindOf,
  hasSealedValues,
  incompleteSessionFactOf,
  interruptedFactOf,
  interruptedSealOfItem,
  isBundledDemoItem,
  isSealedOnThisCore,
  neverSealedShape,
  sealedPackageOf,
  verificationOfRecordFailed,
  type EvidenceItem,
} from '../src/sim';
import * as micPairBed from './support/mic-pair-bed';

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
      // Fix wave J: a never-sealed record and the demonstration record of a simulated session - no media, no package of the Core.
      neverSealed: ['DEMO', null, 'NONE', null],
      simulatedSealed: ['DEMO', null, 'NONE', null],
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

// Integration pass C1 (decision D120), seam 3: `manifestVersion` / `labelsStatus` on the evidence
// item (row 129b; dbc-3 §B.11). Every acceptance has its refusal beside it.
describe('the sealed columns of a v2 evidence item (pass C1, seam 3)', () => {
  it('the strict item schema takes manifestVersion and labelsStatus as optional members, value by value', () => {
    expect(EvidenceItemSchema.safeParse(EXAMPLE_EVIDENCE_ITEM).success).toBe(true);
    const accepted: readonly object[] = [
      { manifestVersion: 2, labelsStatus: 'LABELLED' },
      { manifestVersion: 2, labelsStatus: 'UNAVAILABLE' },
      // A v2 seal with STT disabled: no transcript hash, no labels (ev §B.7a) - the row (2, NULL, NULL).
      { manifestVersion: 2, transcriptSha256: null, labelsStatus: null },
      { manifestVersion: 1 },
      { labelsStatus: null },
    ];
    for (const members of accepted) expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, ...members }).success, JSON.stringify(members)).toBe(true);
    const refused: readonly object[] = [{ manifestVersion: 3 }, { manifestVersion: 0 }, { manifestVersion: '2' }, { manifestVersion: null }, { labelsStatus: 'PENDING' }, { labelsStatus: '' }, { labelStatus: 'LABELLED' }];
    for (const members of refused) expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, ...members }).success, JSON.stringify(members)).toBe(false);
    // The members come back out as they went in (nothing is stripped or defaulted).
    const parsed = EvidenceItemSchema.parse({ ...EXAMPLE_EVIDENCE_ITEM, manifestVersion: 2, labelsStatus: 'LABELLED' });
    expect([parsed.manifestVersion, parsed.labelsStatus]).toEqual([2, 'LABELLED']);
    expect('manifestVersion' in EvidenceItemSchema.parse(EXAMPLE_EVIDENCE_ITEM)).toBe(false);
  });
});

// Integration pass D1b (decision D133), seam 3: `developmentSources` on the evidence item
// (operations 39 / 40; row 141's request).
describe('developmentSources', () => {
  const { harness } = micPairBed;

  describe('developmentSources on the evidence item (pass D1b, seam 3)', () => {
    it('an optional boolean or null; absent and null are "not recorded", and nothing else is taken', () => {
      expect(EvidenceItemSchema.safeParse(EXAMPLE_EVIDENCE_ITEM).success).toBe(true);
      expect('developmentSources' in EXAMPLE_EVIDENCE_ITEM).toBe(false);
      for (const value of [true, false, null]) {
        const parsed = EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, developmentSources: value });
        expect(parsed.success, String(value)).toBe(true);
        // The value is carried as it is: null is never turned into false (never read as production).
        if (parsed.success) expect(parsed.data.developmentSources).toBe(value);
      }
      for (const bad of ['true', 'DEVELOPMENT', 0, 1, {}]) expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, developmentSources: bad }).success, String(bad)).toBe(false);
      // CONTROL: the item is strict - a neighbouring unknown member is still refused.
      expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, developmentSource: true }).success).toBe(false);
    });

    it('an item of the simulator state carries the member through the slice schema', () => {
      const h = harness();
      const item = h.state().evidence[0];
      if (item === undefined) throw new Error('the dataset holds no evidence item');
      // The dataset items are v1: the member is absent (not recorded).
      expect('developmentSources' in item).toBe(false);
      const marked: typeof item = { ...item, developmentSources: true };
      expect(EvidenceItemSchema.safeParse(marked).success).toBe(true);
    });
  });
});

// Fix wave J (decision D243; `delegation_progress/contract_wave_j.md`): the readers both clients use, the
// shape of a never-sealed item, and the contract examples of the new optional members.
describe('fix wave J: the never-sealed shape, the readers and the contract examples', () => {
  const sealed = EXAMPLE_EVIDENCE_ITEM as unknown as EvidenceItem;

  it('JA2-01 / JW-01: `hasSealedValues` is the fact `sealedAt` - never the presence of a hash', () => {
    expect(hasSealedValues(sealed)).toBe(true);
    // A row written before wave J: `sealedAt` null with the full integrity block of a seal and a stored PASS.
    const old = { ...sealed, sealedAt: null, status: 'RECORDED', lifecycleStage: 'RECORDING', verification: { status: 'PASS', at: 5 } } as unknown as EvidenceItem;
    expect(hasSealedValues(old)).toBe(false);
    expect(hasSealedValues(EVIDENCE_NOT_SEALED_ITEM_EXAMPLE)).toBe(false);
    for (const nothing of [null, undefined, 'x', [], {}, { sealedAt: '1790741649000' }]) expect(hasSealedValues(nothing)).toBe(false);
  });

  it('JA2-01 / JW-01: `neverSealedShape` takes every sealed value off an unsealed item - also one stored with them - and leaves a sealed item alone', () => {
    const old = { ...sealed, sealedAt: null, status: 'RECORDED', lifecycleStage: 'RECORDING', verification: { status: 'PASS', at: 5 }, tampered: true, tamperedTrackId: 'AUDIO-02', files: [], fragmentChainHead: 'a'.repeat(64), transcriptSha256: 'b'.repeat(64) } as unknown as EvidenceItem;
    const shaped = neverSealedShape(old);
    expect(shaped).toMatchObject({ tracks: [], manifestHash: EVIDENCE_NOT_SEALED_DIGEST, signature: EVIDENCE_NOT_SEALED_SIGNATURE, verification: { status: 'NOT_RUN', at: null }, tampered: false, tamperedTrackId: null });
    for (const member of ['files', 'fragmentChainHead', 'transcriptSha256', 'transcript']) expect(shaped).not.toHaveProperty(member);
    // Nothing of the stored integrity block is left in the answer.
    expect((JSON.stringify(shaped).match(/[0-9a-f]{64}/g) ?? []).filter((hex) => hex !== EVIDENCE_NOT_SEALED_DIGEST)).toEqual([]);
    // What is NOT a sealed value stays: the identity, the custody, the times.
    expect(shaped).toMatchObject({ id: old.id, sessionId: old.sessionId, custody: old.custody, recordedAt: old.recordedAt, sizeBytes: old.sizeBytes });
    expect(EvidenceItemSchema.safeParse(JSON.parse(JSON.stringify(shaped))).success).toBe(true);
    // The identity for an item that already has the shape, and for a sealed item.
    expect(neverSealedShape(shaped)).toBe(shaped);
    expect(neverSealedShape(sealed)).toBe(sealed);
  });

  it('the contract example of a never-sealed item IS that shape, and the placeholder constants of the two packages are one value', () => {
    expect(EVIDENCE_NOT_SEALED_DIGEST_EXAMPLE).toBe(EVIDENCE_NOT_SEALED_DIGEST);
    expect(EVIDENCE_NOT_SEALED_DIGEST).toBe('0'.repeat(64));
    expect(EVIDENCE_NOT_SEALED_ITEM_EXAMPLE.signature).toEqual(EVIDENCE_NOT_SEALED_SIGNATURE);
    expect(neverSealedShape(EVIDENCE_NOT_SEALED_ITEM_EXAMPLE as unknown as EvidenceItem)).toBe(EVIDENCE_NOT_SEALED_ITEM_EXAMPLE);
    expect(EvidenceItemSchema.safeParse(EVIDENCE_NOT_SEALED_ITEM_EXAMPLE).success).toBe(true);
    const refusal = VERIFY_NOT_SEALED_EXAMPLE.value;
    expect(refusal.error).toMatchObject({ code: 'NOT_SEALED', message: VERIFY_NOT_SEALED_TEXT, details: { simCode: 'UNSEALED_EVIDENCE' } });
    expect(CORE_API_EXAMPLES.verifyEvidence?.responses[409]).toEqual({ notSealed: VERIFY_NOT_SEALED_EXAMPLE });
  });

  it('JT-04 / JW-09: `verificationOfRecordFailed` reads the member every list entry and item carries', () => {
    expect(verificationOfRecordFailed({ ...sealed, verification: { status: 'FAIL', at: 5 } })).toBe(true);
    expect(verificationOfRecordFailed({ ...sealed, verification: { status: 'PASS', at: 5 } })).toBe(false);
    expect(verificationOfRecordFailed(sealed)).toBe(false);
    for (const nothing of [null, undefined, {}, { verification: null }, { verification: 'FAIL' }]) expect(verificationOfRecordFailed(nothing)).toBe(false);
  });

  it('JA2-02: the demonstration record and the demonstration verdict - new value, new optional member, both strict shapes of the contract', () => {
    expect(EVIDENCE_MEDIA_DEMONSTRATION_RECORD_EXAMPLE).toEqual({ source: 'NONE', packageSuffix: null, reason: 'DEMONSTRATION_RECORD' });
    expect(EvidenceMediaRefSchema.safeParse(EVIDENCE_MEDIA_DEMONSTRATION_RECORD_EXAMPLE).success).toBe(true);
    expect(VERIFY_DEMONSTRATION_EXAMPLE).toMatchObject({ ok: true, demonstration: true });
    expect(EvidenceVerifyResultSchema.safeParse(VERIFY_DEMONSTRATION_EXAMPLE).success).toBe(true);
    expect(EvidenceVerifyResultSchema.safeParse({ ...VERIFY_DEMONSTRATION_EXAMPLE, demonstration: false }).success).toBe(false);
    const examples = CORE_API_EXAMPLES.verifyEvidence?.responses[200] as Record<string, { value: { demonstration?: true; files?: unknown[] } }>;
    // The simulator's two verdicts say it; the verdict of a real package does not.
    expect([examples['passed']?.value.demonstration, examples['failed']?.value.demonstration, examples['passedDevelopmentSources']?.value.demonstration]).toEqual([true, true, undefined]);
  });

  it('JA2-03 / JW-03: `exportKinds` - a PACKAGE is available, a COMPOSITE is not and says why', () => {
    expect(EXPORT_KINDS_EXAMPLE).toEqual([{ kind: 'PACKAGE', available: true }, { kind: 'COMPOSITE', available: false, reason: 'COMPOSITE_ENCODER_NOT_SELECTED' }]);
    expect(API_COMPOSITE_REASON).toBe(EXPORT_COMPOSITE_UNAVAILABLE_REASON);
    const detail = (CORE_API_EXAMPLES['getEvidence']!.responses[200] as Record<string, { value: unknown }>)['productSealed']!.value;
    expect(detail).toMatchObject({ exportKinds: EXPORT_KINDS_EXAMPLE });
    expect(EvidenceDetailSchema.safeParse(detail).success).toBe(true);
    expect(EvidenceDetailSchema.safeParse({ ...(detail as object), exportKinds: [{ kind: 'ARCHIVE', available: true }] }).success).toBe(false);
    const refusal = (CORE_API_EXAMPLES['exportEvidence']!.responses[409] as Record<string, { value: { error: { code: string; details?: Record<string, unknown> } } }>)['compositeUnavailable']!.value;
    expect(refusal.error).toMatchObject({ code: 'COMMAND_UNSUPPORTED', details: { reason: 'COMPOSITE_ENCODER_NOT_SELECTED' } });
  });

  it('GM-02: `evidenceVerification` of operation getSecurityStatus adds up, and is optional', () => {
    const counts = SECURITY_STATUS_EVIDENCE_VERIFICATION_EXAMPLE;
    expect(counts.passed + counts.failed + counts.neverVerified).toBe(counts.sealed);
    const example = (CORE_API_EXAMPLES['getSecurityStatus']!.responses[200] as Record<string, { value: Record<string, unknown> }>)['secure']!.value;
    expect(example['evidenceVerification']).toEqual(counts);
    expect(SecurityStatusSchema.safeParse(example).success).toBe(true);
    const { evidenceVerification: _left, ...without } = example;
    expect(SecurityStatusSchema.safeParse(without).success).toBe(true);
    expect(SecurityStatusSchema.safeParse({ ...example, evidenceVerification: { sealed: 1 } }).success).toBe(false);
  });

  it('JW-22: `incompleteSessionFactOf` - quarantined, a never-sealed record, never recorded - from the members of a history entry', () => {
    const entry = { id: 'SES-20261011-0041', outcome: 'INCOMPLETE', startedAt: 5, endedAt: 9, evidenceId: null, faultKind: 'CAPTURE_FAULT' };
    expect(incompleteSessionFactOf(entry)).toEqual({ kind: 'QUARANTINED', cause: 'CAPTURE_FAULT', evidenceId: null });
    expect(incompleteSessionFactOf({ ...entry, evidenceId: 'EV-20261011-0015', faultKind: 'POWER_FAIL' })).toEqual({ kind: 'RECORDED_NOT_SEALED', cause: 'POWER_FAIL', evidenceId: 'EV-20261011-0015' });
    expect(incompleteSessionFactOf({ ...entry, startedAt: null, faultKind: null })).toEqual({ kind: 'NEVER_RECORDED', cause: null, evidenceId: null });
    expect(incompleteSessionFactOf({ ...entry, outcome: 'SEALED', evidenceId: 'EV-20261011-0015' })).toBeNull();
    for (const nothing of [null, undefined, 'x', []]) expect(incompleteSessionFactOf(nothing)).toBeNull();
  });
});

