// Reconcile pass R, decision D207: ONE "interrupted" fact for a sealed item.
//
// Three drivers stated it three ways: the Core's `interrupted` member (read from the sealed manifest's
// `timeline.interrupted`), the item's custody entry `RECORDING_INTERRUPTED` (written by
// `completeSealTransition` from `CompleteSealInput.interrupted`), and the clients reading either.
// This file holds that THE PRODUCT'S OWN SEAL cannot make them differ: the pipeline hands the engine
// the SAME value it wrote into the manifest it signed, for every way a seal can end.
//
// | Rule | Test |
// |------|------|
// | A seal after a stop, a seal of a damaged camera file (durable prefix), a seal after an interruption: `timeline.interrupted` of the signed manifest === `CompleteSealInput.interrupted` === what `readSealedItemFacts` states | "the product's own seal" |
// | The custody entry is written from that input and from nothing else (shared: `completeSealTransition`) | `packages/shared/test/sim-core-driven-seal.test.ts`, `sim-evidence-item-kind.test.ts` |
import { readFileSync, writeFileSync } from 'node:fs';
import { PackageFile, parseManifestV2 } from '@dems/shared/evidence-package';
import { interruptedFactOf } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings, type Recording } from '../../sealing/__tests__/pipeline-support';
import { readSealedItemFacts } from '../sealed-facts';

afterAll(() => {
  removeRecordings();
  removePackages();
});

type SealCause = 'STOPPED' | 'INTERRUPTED';
const changedByte = (recording: Recording): void => {
  const path = recording.recordingFile('VIDEO-02');
  const bytes = readFileSync(path);
  const at = bytes.byteLength - 40;
  bytes[at] = (bytes[at] ?? 0) ^ 0xff;
  writeFileSync(path, bytes);
};

describe("D207: the product's own seal states ONE interrupted fact", () => {
  const cases: readonly (readonly [string, SealCause, ((recording: Recording) => void) | null, boolean])[] = [
    ['a recording that ended by a stop', 'STOPPED', null, false],
    ['a stopped recording whose camera file fails part-way (durable prefix)', 'STOPPED', changedByte, true],
    ['a recording that did not end by a stop', 'INTERRUPTED', null, true],
  ];

  it.each(cases)("the product's own seal of %s: the signed manifest, the seal input and the Core's member say the same", async (_label, cause, damage, expected) => {
    const recording = recordSession();
    damage?.(recording);
    const h = harnessOf(recording);
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause });
    expect(outcome.status).toBe('SEALED');

    const manifest = parseManifestV2(JSON.parse(readFileSync(recording.path(PackageFile.MANIFEST), 'utf8')));
    const input = h.engine.sealed[0]?.input;
    expect(h.engine.sealed).toHaveLength(1);
    // (1) the signed manifest, (2) what the engine is handed to write the custody entry from.
    expect([manifest.timeline.interrupted, input?.interrupted]).toEqual([expected, expected]);

    // (3) what the Core states on the item (`interrupted`), read from that package under the digest of record.
    const anchors = h.anchors();
    const facts = await readSealedItemFacts(recording.packageDir, { id: anchors.evidenceId ?? '', sessionId: anchors.sessionId ?? '', manifestHash: anchors.manifestSha256 ?? '' });
    expect(facts).toMatchObject({ sealedPackage: 'PRESENT', interrupted: expected });

    // (4) the ONE reader of both clients, on the item this seal makes: the member and the custody entry
    // `completeSealTransition` writes for that input (RECORDING_INTERRUPTED iff `input.interrupted`).
    const custody = [{ action: 'RECORDING_STARTED', detail: null }, { action: input?.interrupted === true ? 'RECORDING_INTERRUPTED' : 'RECORDING_STOPPED', detail: input?.interrupted === true ? 'CAPTURE_FAULT' : null }];
    const withMember = interruptedFactOf({ sealedPackage: 'PRESENT', interrupted: facts.sealedPackage === 'PRESENT' ? facts.interrupted : undefined, custody });
    const custodyOnly = interruptedFactOf({ custody });
    expect(withMember.interrupted).toBe(expected);
    expect(custodyOnly.interrupted === true).toBe(expected);
  });
});
