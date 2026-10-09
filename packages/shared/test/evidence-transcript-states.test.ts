// The transcript block of manifest v2 (blueprint row 119; evidence package spec §B.7, §B.7a;
// decision D110): its four shapes, the rules between its fields, the configuration snapshot and
// its place inside the signed digest. Pure: no file, no key. The packages on disk with a real
// signature are in `apps/core-server/src/sealing/__tests__/stt-states-verify.test.ts`.
import { describe, expect, it } from 'vitest';
import { STT_MODEL_ID_PATTERN } from '../src/api';
import {
  EXAMPLE_SOURCE_ROWS,
  MANIFEST_STT_MODEL_PATTERN,
  ManifestV2Schema,
  TRANSCRIPT_ABSENCE_REASONS,
  TRANSCRIPT_DISABLED_REASON,
  TRANSCRIPT_UNAVAILABLE_REASON,
  attachSignature,
  buildUnsignedManifest,
  computeManifestSha256,
  declaredPackageFiles,
  exampleManifestInput,
  manifestDeclaresTranscript,
  manifestHashMatches,
  type ManifestV2,
  type ManifestV2Input,
} from '../src/evidence-package';
import { TRANSCRIPT_STATE_REPORT, VerifiedTranscriptState } from '../src/evidence-verify';

type Block = ManifestV2Input['transcript'];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const sealedWith = (transcript: Block): ManifestV2 => attachSignature(buildUnsignedManifest({ ...exampleManifestInput(), transcript }, EXAMPLE_SOURCE_ROWS), new Uint8Array(64).fill(0xab));

const READY: Block = exampleManifestInput().transcript;
const NO_DOCUMENT = {
  file: null,
  docVersion: null,
  sha256: null,
  srtSha256: null,
  vttSha256: null,
  model: { name: null, version: null, quantisation: null, modelSha256: null },
  diarization: { numSpeakers: null, status: null, confidence: null },
  speakerState: null,
  revisionHead: null,
} as const;
const PARTIAL: Block = { ...READY, state: 'PARTIAL', failedChunks: 2 };
const UNREACHABLE: Block = { ...PARTIAL, backendUnreachable: true };
const UNAVAILABLE: Block = { ...READY, ...NO_DOCUMENT, state: 'PARTIAL', failedChunks: 3, disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', backendUnreachable: false };
const DISABLED: Block = { ...READY, ...NO_DOCUMENT, state: 'DISABLED', failedChunks: null, disabledReason: 'DISABLED_BY_CONFIGURATION', backendUnreachable: false, configSnapshot: { ...READY.configSnapshot, enabled: false } };

/** True when the schema refuses the block, as the sealed manifest and as the builder's input. */
function refused(transcript: unknown): boolean {
  const manifest = { ...clone(sealedWith(READY)), transcript };
  const bySchema = !ManifestV2Schema.safeParse(manifest).success;
  let byBuilder = false;
  try {
    buildUnsignedManifest({ ...exampleManifestInput(), transcript: transcript as Block }, EXAMPLE_SOURCE_ROWS);
  } catch {
    byBuilder = true;
  }
  expect(byBuilder, 'the builder and the schema agree').toBe(bySchema);
  return bySchema;
}

/** The document-bearing members of the block (fields 79-89, 91, 94), each as a way to null it. */
const DOCUMENT_MEMBERS: readonly (readonly [string, (block: any, value: unknown) => void, unknown])[] = [
  ['file', (b, v) => (b.file = v), 'transcript/transcript.json'],
  ['docVersion', (b, v) => (b.docVersion = v), 'dems.transcript/1'],
  ['sha256', (b, v) => (b.sha256 = v), 'a'.repeat(64)],
  ['srtSha256', (b, v) => (b.srtSha256 = v), 'b'.repeat(64)],
  ['vttSha256', (b, v) => (b.vttSha256 = v), 'c'.repeat(64)],
  ['model.name', (b, v) => (b.model.name = v), 'a-model'],
  ['model.version', (b, v) => (b.model.version = v), '1'],
  ['model.quantisation', (b, v) => (b.model.quantisation = v), 'none'],
  ['model.modelSha256', (b, v) => (b.model.modelSha256 = v), 'd'.repeat(64)],
  ['diarization.numSpeakers', (b, v) => (b.diarization.numSpeakers = v), 2],
  ['diarization.status', (b, v) => (b.diarization.status = v), 'LABELLED'],
  ['speakerState', (b, v) => (b.speakerState = v), 'LABELLED'],
  ['revisionHead', (b, v) => (b.revisionHead = v), 0],
];

describe('the four shapes of the transcript block (§B.7, §B.7a, D110)', () => {
  it('each is accepted: ASSEMBLED, PARTIAL with a document (reachable or not), PARTIAL without a document, DISABLED', () => {
    for (const block of [READY, PARTIAL, UNREACHABLE, UNAVAILABLE, { ...UNAVAILABLE, backendUnreachable: true }, { ...UNAVAILABLE, failedChunks: null }, { ...UNAVAILABLE, failedChunks: 0 }, DISABLED]) {
      expect(refused(block), JSON.stringify([block.state, block.disabledReason, block.failedChunks])).toBe(false);
    }
    expect(sealedWith(UNAVAILABLE).transcript).toEqual(UNAVAILABLE);
    expect(sealedWith(DISABLED).transcript).toEqual(DISABLED);
  });

  it('the two reasons are the vocabulary of field 121, each with its one state', () => {
    expect(TRANSCRIPT_ABSENCE_REASONS).toEqual(['DISABLED_BY_CONFIGURATION', 'TRANSCRIPT_UNAVAILABLE_AT_SEAL']);
    expect([TRANSCRIPT_DISABLED_REASON, TRANSCRIPT_UNAVAILABLE_REASON]).toEqual([...TRANSCRIPT_ABSENCE_REASONS]);
    // The no-document PARTIAL is allowed ONLY together with its reason ...
    expect(refused({ ...UNAVAILABLE, disabledReason: null })).toBe(true);
    expect(refused({ ...UNAVAILABLE, disabledReason: 'DISABLED_BY_CONFIGURATION' })).toBe(true);
    expect(refused({ ...UNAVAILABLE, disabledReason: 'TRANSCRIPT_LOST' })).toBe(true);
    // ... and the reason only together with PARTIAL and no document.
    expect(refused({ ...UNAVAILABLE, state: 'ASSEMBLED' })).toBe(true);
    expect(refused({ ...UNAVAILABLE, state: 'DISABLED' })).toBe(true);
    expect(refused({ ...PARTIAL, disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' })).toBe(true);
    expect(refused({ ...READY, disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' })).toBe(true);
    // DISABLED has its own reason and no other.
    expect(refused({ ...DISABLED, disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' })).toBe(true);
    expect(refused({ ...DISABLED, disabledReason: null })).toBe(true);
    expect(refused({ ...READY, disabledReason: 'DISABLED_BY_CONFIGURATION' })).toBe(true);
    expect(refused({ ...PARTIAL, disabledReason: 'DISABLED_BY_CONFIGURATION' })).toBe(true);
  });

  it.each(DOCUMENT_MEMBERS)('a READY or PARTIAL transcript without its %s is refused; a DISABLED or UNAVAILABLE one with it is refused', (_name, set, value) => {
    for (const present of [READY, PARTIAL, UNREACHABLE]) {
      const block = clone(present);
      set(block, null);
      expect(refused(block), present.state).toBe(true);
    }
    for (const absent of [DISABLED, UNAVAILABLE]) {
      const block = clone(absent);
      set(block, value);
      expect(refused(block), absent.state).toBe(true);
    }
  });

  it('nothing between the shapes: a confidence without a document, a failed-chunk count of a disabled transcript, a missing count beside a document', () => {
    for (const absent of [DISABLED, UNAVAILABLE]) expect(refused({ ...absent, diarization: { ...absent.diarization, confidence: 0.5 } }), absent.state).toBe(true);
    expect(refused({ ...DISABLED, failedChunks: 0 })).toBe(true);
    expect(refused({ ...READY, failedChunks: null })).toBe(true);
    expect(refused({ ...PARTIAL, failedChunks: null })).toBe(true);
    // A document may leave the confidence null (field 90 is nullable): that is no absence.
    expect(refused({ ...READY, diarization: { ...READY.diarization, confidence: null } })).toBe(false);
  });

  it('the snapshot agrees with the state: enabled is false exactly for DISABLED; unreachable only with PARTIAL', () => {
    expect(refused({ ...DISABLED, configSnapshot: { ...DISABLED.configSnapshot, enabled: true } })).toBe(true);
    for (const enabled of [READY, PARTIAL, UNREACHABLE, UNAVAILABLE]) expect(refused({ ...enabled, configSnapshot: { ...enabled.configSnapshot, enabled: false } }), enabled.state).toBe(true);
    expect(refused({ ...READY, backendUnreachable: true })).toBe(true);
    expect(refused({ ...DISABLED, backendUnreachable: true })).toBe(true);
  });

  it('the package declares transcript files exactly when the block names a document', () => {
    expect([READY, PARTIAL, UNREACHABLE, UNAVAILABLE, DISABLED].map((block) => manifestDeclaresTranscript(block))).toEqual([true, true, true, false, false]);
    expect(declaredPackageFiles({ transcript: manifestDeclaresTranscript(UNAVAILABLE) }).filter((file) => file.startsWith('transcript/'))).toEqual([]);
    expect(declaredPackageFiles({ transcript: manifestDeclaresTranscript(UNREACHABLE) }).filter((file) => file.startsWith('transcript/'))).toHaveLength(4);
  });
});

describe('the configuration snapshot (field 123): five non-secret members and nothing else (E-31)', () => {
  it('has exactly enabled, backend, model, diarization, revision — each required, each typed', () => {
    expect(Object.keys(READY.configSnapshot).sort()).toEqual(['backend', 'diarization', 'enabled', 'model', 'revision']);
    for (const member of Object.keys(READY.configSnapshot)) {
      const snapshot: Record<string, unknown> = { ...READY.configSnapshot };
      delete snapshot[member];
      expect(refused({ ...READY, configSnapshot: snapshot }), member).toBe(true);
    }
    for (const [member, value] of [['enabled', 'true'], ['backend', 'openai'], ['diarization', 1], ['revision', 0], ['revision', 1.5], ['model', '']] as const) {
      expect(refused({ ...READY, configSnapshot: { ...READY.configSnapshot, [member]: value } }), member).toBe(true);
    }
  });

  it('refuses every member of the stored configuration that is not one of the five: the endpoint, the language, and everything of the credential', () => {
    for (const extra of ['endpoint', 'language', 'credential', 'credentialRef', 'credentialKind', 'credentialSet', 'apiKey', 'api_key', 'token', 'secret', 'password', 'authorization', 'ciphertext', 'nonce', 'takenAt', 'sessionId']) {
      expect(refused({ ...READY, configSnapshot: { ...READY.configSnapshot, [extra]: 'x' } }), extra).toBe(true);
      expect(refused({ ...DISABLED, configSnapshot: { ...DISABLED.configSnapshot, [extra]: null } }), extra).toBe(true);
    }
  });

  it('`model` is a model identifier: no endpoint, path, credential reference or key can be carried in it', () => {
    // ONE pattern: the contract's (`STT_MODEL_ID_PATTERN`, operation 91). The manifest holds its own copy
    // because this folder does not import the API module; the copy is held equal here.
    expect(MANIFEST_STT_MODEL_PATTERN.source).toBe(STT_MODEL_ID_PATTERN.source);
    expect(MANIFEST_STT_MODEL_PATTERN.flags).toBe(STT_MODEL_ID_PATTERN.flags);
    for (const model of ['ggml-large-v3-turbo', 'whisper-large-v3-turbo', 'mlx-community--whisper-large-v3-turbo-asr-fp16', 'example-model']) {
      expect(refused({ ...READY, configSnapshot: { ...READY.configSnapshot, model } }), model).toBe(false);
    }
    for (const model of ['http://127.0.0.1:8000/v1', 'omlx-settings:auth.api_key', 'Bearer abcdef', 'key=abcdef', '/models/ggml.bin', '..', 'model.bin', 'a b', 'a\nb', 'x'.repeat(129)]) {
      expect(refused({ ...READY, configSnapshot: { ...READY.configSnapshot, model } }), model).toBe(true);
    }
  });
});

describe('the state is inside what is signed (§B.10)', () => {
  it('the state, the reason, the unreachable flag, the failed-chunk count and every member of the snapshot change the digest', () => {
    const edits: readonly (readonly [Block, (block: any) => void])[] = [
      [UNAVAILABLE, (b) => Object.assign(b, { state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', failedChunks: null, configSnapshot: { ...b.configSnapshot, enabled: false } })],
      [DISABLED, (b) => Object.assign(b, { state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', configSnapshot: { ...b.configSnapshot, enabled: true } })],
      [UNREACHABLE, (b) => (b.backendUnreachable = false)],
      [UNREACHABLE, (b) => (b.failedChunks = 1)],
      [UNAVAILABLE, (b) => (b.failedChunks = null)],
      [DISABLED, (b) => (b.configSnapshot.revision += 1)],
      [DISABLED, (b) => (b.configSnapshot.backend = 'omlx-server')],
      [DISABLED, (b) => (b.configSnapshot.diarization = !b.configSnapshot.diarization)],
      [DISABLED, (b) => (b.configSnapshot.model = 'another-model')],
    ];
    for (const [block, edit] of edits) {
      const sealed = sealedWith(block);
      const edited = clone(sealed);
      edit(edited.transcript);
      // Still a valid manifest: the schema cannot find the edit ...
      expect(ManifestV2Schema.safeParse(edited).success).toBe(true);
      // ... the digest does.
      expect(manifestHashMatches(sealed)).toBe(true);
      expect(manifestHashMatches(edited)).toBe(false);
      expect(computeManifestSha256(edited)).not.toBe(sealed.manifestSha256);
    }
  });
});

describe('the report line of each state (§D; row 119)', () => {
  it('names the three asked states in the asked words, and has one line per state', () => {
    expect(TRANSCRIPT_STATE_REPORT.DISABLED_BY_CONFIGURATION).toBe('Transcript disabled by configuration');
    expect(TRANSCRIPT_STATE_REPORT.PARTIAL_BACKEND_UNREACHABLE).toBe('Transcript partial — backend unreachable');
    expect(TRANSCRIPT_STATE_REPORT.UNAVAILABLE_AT_SEAL).toBe('Transcript unavailable at seal');
    expect(Object.keys(TRANSCRIPT_STATE_REPORT).sort()).toEqual(Object.values(VerifiedTranscriptState).sort());
    expect(new Set(Object.values(TRANSCRIPT_STATE_REPORT)).size).toBe(Object.keys(VerifiedTranscriptState).length);
    // The unavailable line does not carry the word of the disabled one.
    expect(TRANSCRIPT_STATE_REPORT.UNAVAILABLE_AT_SEAL).not.toMatch(/disabled/i);
  });
});
