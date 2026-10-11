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
import { interruptedFactOf, type EvidenceItem, type SimState } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings, type Recording } from '../../sealing/__tests__/pipeline-support';
import { readSealedItemFacts } from '../sealed-facts';
import { EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE, EvidenceItemSchema, EvidenceTranscriptModelSchema, EXAMPLE_EVIDENCE_ITEM, EVIDENCE_SEALED_PROFILE_EXAMPLE, EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE } from '@dems/shared/api';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import { itemWithSealedFacts, type ItemWithSealedFacts, type SealedItemFacts, STREAM_PROFILE_DIFFERS_REASON } from '../../engine';
import { corePorts } from '../../evidence-verify';
import { buildPackage, editManifest, removeScratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { noteStreamProfileDiffersTransition } from '../../engine/sealing-notice-doors';
import { streamProfileNoticeOf } from '../index';

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

const anchorsOf = (built: BuiltPackage): { id: string; sessionId: string; manifestHash: string } => ({ id: built.manifest.evidenceId, sessionId: built.manifest.sessionId, manifestHash: built.manifest.manifestSha256 });

describe('G81b-06: the transcript model of a signed manifest (wave K, driver S2)', () => {
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

  afterAll(() => removeScratch());
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
});

describe('G89c-04: the format of each camera file as the manifest states it (wave L, driver L-S)', () => {
  // Fix wave L, driver L-S - re-check 89 finding G89c-04 (ruling D229 (3)): THE FORMAT OF A SEALED
  // TRACK ON THE ITEM. The manifest states `tracks[].profile` (field 36); no item member carried it,
  // so no client could show the sealed format, and the notice of a session whose recorded stream was
  // not the configured profile was shown on no item.
  //
  // | Rule | Test |
  // |------|------|
  // | The sealed-facts reading restates the manifest's `tracks[].profile` on each file - whatever the manifest says, per track | 1 |
  // | CONTROL (the finding): the members the reading stated before hold no profile | 1 |
  // | A profile outside the item's pattern is not restated (the file is, without it) | 2 |
  // | The door keeps it on the replicated item; an equal reading returns the SAME item; a package that is not readable... keeps no sealed fact | 3 |
  // | The notice of the session, read from the alert the seal wrote; another session's notice, a notice that does not read as written, and no notice answer null | 4 |
  // | The contract examples are what the readers answer; the item schema takes them and refuses a member outside the shape; `profileId` is untouched | 5 |

  afterAll(() => removeScratch());
  type Files = Array<{ trackId: string; profile?: string; sha256: string }>;

  describe('G89c-04: the sealed-facts reading states the format of each camera file as the manifest of record states it', () => {
    it('1 - each file carries the profile of ITS track; the other members are what they were', async () => {
      const built = await buildPackage({
        evidenceId: 'EV-20261011-0901',
        sessionId: 'SES-20261011-0901',
        beforeSeal: (input) => {
          const [first, second] = input.tracks;
          if (first === undefined || second === undefined) throw new Error('the package has no two tracks');
          first.profile = 'H264_720P30';
          second.profile = 'H264_720P27.67';
        },
      });
      const facts = await readSealedItemFacts(built.dir, anchorsOf(built));
      expect(facts.sealedPackage).toBe('PRESENT');
      const files = (facts as unknown as { files: Files }).files;
      expect(files.map((file) => [file.trackId, file.profile])).toEqual([
        ['VIDEO-01', 'H264_720P30'],
        ['VIDEO-02', 'H264_720P27.67'],
      ]);
      expect(files.map((file) => file.profile)).toEqual(built.manifest.tracks.map((track) => track.profile));
      // CONTROL (the finding): without the member, nothing of a file says its format.
      for (const file of files) {
        const { profile: _profile, ...before } = file;
        expect(JSON.stringify(before)).not.toMatch(/H264/);
        expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('2 - a profile the item cannot carry (outside its pattern) is not restated; the file is', async () => {
      const built = await buildPackage({
        evidenceId: 'EV-20261011-0902',
        sessionId: 'SES-20261011-0902',
        beforeSeal: (input) => {
          const [first] = input.tracks;
          if (first === undefined) throw new Error('the package has no track');
          first.profile = 'a profile with spaces / and a path';
        },
      });
      const facts = await readSealedItemFacts(built.dir, anchorsOf(built));
      const files = (facts as unknown as { files: Files }).files;
      expect(files).toHaveLength(2);
      expect('profile' in (files[0] ?? {})).toBe(false);
      expect(typeof files[1]?.profile).toBe('string');
    });
  });

  describe('G89c-04: the door and the notice', () => {
    const item = { ...EXAMPLE_EVIDENCE_ITEM, manifestHash: 'ab'.repeat(32) } as unknown as EvidenceItem;
    const present = (files: unknown): SealedItemFacts => ({ evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'PRESENT', interrupted: false, audioSourceIntervals: [], files, developmentKey: true }) as SealedItemFacts;

    it('3 - the replicated item carries the profile; an equal reading returns the SAME item; a changed profile replaces it; NOT_READABLE says only that', () => {
      const held = itemWithSealedFacts(item, present(EVIDENCE_SEALED_PROFILE_EXAMPLE.files)) as ItemWithSealedFacts;
      expect((held.files as Files).map((file) => file.profile)).toEqual(['H264_720P30', 'H264_720P30']);
      expect(itemWithSealedFacts(held, present(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map((file) => ({ ...file }))))).toBe(held);
      const changed = itemWithSealedFacts(held, present(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map((file) => ({ ...file, profile: 'H264_1080P25' })))) as ItemWithSealedFacts;
      expect(changed).not.toBe(held);
      expect((changed.files as Files).map((file) => file.profile)).toEqual(['H264_1080P25', 'H264_1080P25']);
      expect((itemWithSealedFacts(held, { evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'NOT_READABLE' }) as ItemWithSealedFacts).sealedPackage).toBe('NOT_READABLE');
    });

    it('4 - the notice of a session is read from the alert the seal wrote; nothing else answers one', () => {
      const SESSION = 'SES-20261011-0036';
      const base = { alerts: [], meta: { counters: { item: 40, event: 0 } } } as unknown as SimState;
      const noticed = noteStreamProfileDiffersTransition(base, 1_791_680_000_000, {
        sessionId: SESSION,
        tracks: [
          { trackId: 'VIDEO-01', configured: 'H264_720P30', stream: 'H264_720P27.67' },
          { trackId: 'VIDEO-02', configured: 'H264_720P30', stream: 'H264_720P26' },
        ],
      });
      expect(noticed.alerts).toHaveLength(1);
      expect(noticed.alerts[0]?.params?.['reason']).toBe(STREAM_PROFILE_DIFFERS_REASON);
      expect(streamProfileNoticeOf(noticed.alerts, SESSION)).toEqual({
        tracks: [
          { trackId: 'VIDEO-01', stream: 'H264_720P27.67', configured: 'H264_720P30' },
          { trackId: 'VIDEO-02', stream: 'H264_720P26', configured: 'H264_720P30' },
        ],
      });
      // Another session, no alert, an alert of another reason, tracks that do not read as written: no notice.
      expect(streamProfileNoticeOf(noticed.alerts, 'SES-20261011-0037')).toBeNull();
      expect(streamProfileNoticeOf([], SESSION)).toBeNull();
      const alert = noticed.alerts[0];
      if (alert === undefined) throw new Error('no alert');
      expect(streamProfileNoticeOf([{ ...alert, params: { ...alert.params, reason: 'UNSEALABLE' } }], SESSION)).toBeNull();
      expect(streamProfileNoticeOf([{ ...alert, params: { ...alert.params, tracks: 'VIDEO-01:only-two-parts' } }], SESSION)).toBeNull();
      expect(streamProfileNoticeOf([{ ...alert, params: { ...alert.params, tracks: 'AUDIO-01:a:b' } }], SESSION)).toBeNull();
    });

    it('5 - the contract examples: the item schema takes them, refuses a member outside the shape, and `profileId` is what it was', () => {
      const withProfile = { ...EXAMPLE_EVIDENCE_ITEM, sealedPackage: 'PRESENT', ...EVIDENCE_SEALED_PROFILE_EXAMPLE };
      const parsed = EvidenceItemSchema.safeParse(withProfile);
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.files?.map((file) => file.profile)).toEqual(['H264_720P30', 'H264_720P30']);
      expect(parsed.success && parsed.data.profileId).toBe(EXAMPLE_EVIDENCE_ITEM.profileId);
      expect(EvidenceItemSchema.safeParse({ ...withProfile, ...EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE }).success).toBe(true);
      expect(EvidenceItemSchema.safeParse({ ...withProfile, streamProfileNotice: { tracks: [] } }).success).toBe(false);
      expect(EvidenceItemSchema.safeParse({ ...withProfile, streamProfileNotice: { tracks: [{ trackId: 'AUDIO-01', stream: 'A', configured: 'B' }] } }).success).toBe(false);
      expect(EvidenceItemSchema.safeParse({ ...withProfile, files: withProfile.files.map((file) => ({ ...file, profile: 'not a code' })) }).success).toBe(false);
      // The notice example is what the reader answers for the alert the seal writes.
      const base = { alerts: [], meta: { counters: { item: 0, event: 0 } } } as unknown as SimState;
      const tracks = EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks.map((track) => ({ ...track }));
      expect(streamProfileNoticeOf(noteStreamProfileDiffersTransition(base, 1, { sessionId: 'SES-20261011-0001', tracks }).alerts, 'SES-20261011-0001')).toEqual(EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice);
    });
  });
});
