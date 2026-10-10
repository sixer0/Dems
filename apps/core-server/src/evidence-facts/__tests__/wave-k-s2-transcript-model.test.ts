// Fix wave K, driver S2 - re-gate 81 finding G81b-06 (decision D160): THE MODEL OF A SEALED
// TRANSCRIPT ON THE ITEM. Operation 41 answered `transcriptModel`; no item did, so no client could
// say which model made a transcript without running a verification.
//
// | Rule | Test |
// |------|------|
// | A local backend: name, declared version, quantisation, file hash, `reportedByServer: false`, the report line - equal to operation 41's statement of the same package | 1 |
// | A server backend (D160): the name only, three nulls, `reportedByServer: true`, and the line that says "reported by the STT server ... not verified" | 2 |
// | No document sealed (STT disabled): no model is stated | 3 |
// | NEGATIVE CONTROL - a manifest whose signature does not hold states no model (nothing is restated from an unsigned manifest) | 4 |
// | The door puts the model on the replicated item, replaces it, and removes it when a later reading states none or the package is not readable | 5 |
// | The contract examples are what the readers answer, and the item schema takes them | 6 |
import { EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE, EvidenceItemSchema, EvidenceTranscriptModelSchema, EXAMPLE_EVIDENCE_ITEM } from '@dems/shared/api';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import type { EvidenceItem } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { itemWithSealedFacts, type ItemWithSealedFacts, type SealedItemFacts } from '../../engine';
import { corePorts } from '../../evidence-verify';
import { buildPackage, editManifest, removeScratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { readSealedItemFacts } from '../sealed-facts';

afterAll(() => removeScratch());

const anchorsOf = (built: BuiltPackage): { id: string; sessionId: string; manifestHash: string } => ({ id: built.manifest.evidenceId, sessionId: built.manifest.sessionId, manifestHash: built.manifest.manifestSha256 });
const SERVER_MODEL = { backend: 'omlx-server', model: { name: 'whisper-large-v3-turbo', version: null, quantisation: null, modelSha256: null } } as const;

describe('G81b-06: the sealed-facts reading states the transcript model of a signed manifest', () => {
  it('1 - a local backend: the four members, not reported by a server - and the same statement operation 41 makes of the package', async () => {
    const built = await buildPackage({ evidenceId: 'EV-20261011-0801', sessionId: 'SES-20261011-0801' });
    const facts = await readSealedItemFacts(built.dir, anchorsOf(built));
    const model = built.manifest.transcript.model;
    expect(facts).toMatchObject({ sealedPackage: 'PRESENT', transcriptModel: { name: model.name, version: model.version, quantisation: model.quantisation, modelSha256: model.modelSha256, reportedByServer: false } });
    expect([model.version, model.quantisation, model.modelSha256].every((member) => typeof member === 'string')).toBe(true);
    const report = await verifyPackageV2(corePorts(built.dir, null), { scope: 'MANIFEST', expected: { evidenceId: built.manifest.evidenceId, sessionId: built.manifest.sessionId, manifestSha256: built.manifest.manifestSha256 } });
    expect(report.transcriptModel).not.toBeNull();
    expect((facts as { transcriptModel?: unknown }).transcriptModel).toEqual(report.transcriptModel);
    expect(EvidenceTranscriptModelSchema.safeParse((facts as { transcriptModel?: unknown }).transcriptModel).success).toBe(true);
  });

  it('2 - a server backend (D160): the name the server reported, three nulls, and the line that says it was not verified by the Core', async () => {
    const built = await buildPackage({ evidenceId: 'EV-20261011-0802', sessionId: 'SES-20261011-0802', transcriptModel: SERVER_MODEL });
    const facts = (await readSealedItemFacts(built.dir, anchorsOf(built))) as { transcriptModel?: { report: string } | null };
    expect(facts.transcriptModel).toMatchObject({ name: 'whisper-large-v3-turbo', version: null, quantisation: null, modelSha256: null, reportedByServer: true });
    expect(facts.transcriptModel?.report).toContain('reported by the STT server');
    expect(facts.transcriptModel?.report).toContain('not verified');
  });

  it('3 - a package sealed without a document (STT disabled) states no model', async () => {
    const built = await buildPackage({ evidenceId: 'EV-20261011-0803', sessionId: 'SES-20261011-0803', transcript: 'DISABLED' });
    expect(await readSealedItemFacts(built.dir, anchorsOf(built))).toMatchObject({ sealedPackage: 'PRESENT', transcriptModel: null });
  });

  it('4 - NEGATIVE CONTROL: the same package with a signature that does not hold states NO model; before the change it did', async () => {
    const built = await buildPackage({ evidenceId: 'EV-20261011-0804', sessionId: 'SES-20261011-0804' });
    expect(((await readSealedItemFacts(built.dir, anchorsOf(built))) as { transcriptModel?: unknown }).transcriptModel).not.toBeNull();
    editManifest(built, (manifest) => {
      manifest.signature.value = '00'.repeat(64);
    });
    const after = (await readSealedItemFacts(built.dir, anchorsOf(built))) as { sealedPackage: string; transcriptModel?: unknown; developmentKey?: unknown };
    // Whatever the reading says of the package, it restates no model of it.
    expect(after.transcriptModel ?? null).toBeNull();
  });
});

describe('G81b-06: the door puts the model on the replicated item', () => {
  const item = { ...EXAMPLE_EVIDENCE_ITEM, manifestHash: 'ab'.repeat(32) } as unknown as EvidenceItem;
  const present = (transcriptModel: unknown): SealedItemFacts =>
    ({ evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'PRESENT', interrupted: false, audioSourceIntervals: [], files: [], developmentKey: true, transcriptModel }) as SealedItemFacts;

  it('5 - set, replaced, removed by a reading without one, removed with a package that is not readable; an equal reading returns the SAME item', () => {
    const local = itemWithSealedFacts(item, present(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE)) as ItemWithSealedFacts;
    expect(local.transcriptModel).toEqual(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE);
    expect(itemWithSealedFacts(local, present({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE }))).toBe(local);
    const server = itemWithSealedFacts(local, present(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE)) as ItemWithSealedFacts;
    expect(server.transcriptModel).toEqual(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE);
    for (const none of [null, undefined]) expect('transcriptModel' in itemWithSealedFacts(server, present(none))).toBe(false);
    expect('transcriptModel' in itemWithSealedFacts(server, { evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'NOT_READABLE' })).toBe(false);
  });

  it('6 - the contract examples: a local model with four members, a server model with the name only; the item schema takes an item that carries one and refuses a member outside the shape', () => {
    expect(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE).toMatchObject({ reportedByServer: false });
    expect([EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.version, EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.quantisation, EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.modelSha256].every((member) => typeof member === 'string')).toBe(true);
    expect(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE).toMatchObject({ version: null, quantisation: null, modelSha256: null, reportedByServer: true });
    for (const example of [EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE]) {
      expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, transcriptModel: example }).success).toBe(true);
    }
    expect(EvidenceItemSchema.safeParse({ ...EXAMPLE_EVIDENCE_ITEM, transcriptModel: { ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, speed: 1 } }).success).toBe(false);
    expect(EvidenceItemSchema.safeParse(EXAMPLE_EVIDENCE_ITEM).success).toBe(true);
  });
});
