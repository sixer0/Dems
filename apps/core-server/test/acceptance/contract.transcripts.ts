/**
 * Test support of the acceptance walk for operations 84 to 86 (task 3 integration pass D4; not a
 * test file). Those operations answer for an item whose seal committed a machine transcript: a
 * REAL v2 package. This file makes one on a booted Core WITHOUT a capture worker and a
 * transcriber:
 *
 *   - the session is stopped by the caller through the API;
 *   - the item is sealed through the engine's seal door (`completeSeal`), and the `transcripts`
 *     row is written in the same unit, as the sealing pipeline does;
 *   - the package is built by the verify row's test builder (generated camera bytes, a real
 *     Ed25519 signature) around a `dems.transcript/1` document the Core's strict reader accepts,
 *     and lies where the Core looks for it: `<mediaStoreDir>/SESSION-<sessionId>`;
 *   - the key that signs revisions is a key of row 83's signer whose ID has the form the table of
 *     revisions takes. The product's own key ID does not (finding of pass D4, held by
 *     `src/modules/transcripts/__tests__/transcript-routes.db.test.ts`), so the walk hands the
 *     module this key through its seam.
 */
import { PackageFile } from '@dems/shared/evidence-package';
import type { CompleteSealInput, SealingStepReport } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceIdFor } from '@dems/shared/sim';
import { loadSoftwareSigner, provisionSigningKey } from '../../src/capture';
import { coreCredentialStore, createFragmentSealer } from '../../src/credential-store';
import { isEngineControl } from '../../src/engine/host';
import { sealDoorsOf } from '../../src/engine/seal-doors';
import { coreFragmentOpener } from '../../src/evidence-verify';
import { buildPackage, removeScratch } from '../../src/evidence-verify/__tests__/support';
import { mediaSessionMacOf, mediaStream } from '../../src/media-stream';
import { createTranscriptStore, provideRevisionSigner } from '../../src/modules/transcripts';
import { SEALING_STEP_ORDER } from '../../src/sealing';

const DOCUMENT = {
  header: {
    doc_version: 'dems.transcript/1',
    session_id: 'SES-20261001-0001',
    language: 'id',
    backend: 'cpu-local',
    model: { id: 'whisper-test', name: 'whisper', version: '1', quantisation: 'q5', sha256: 'ab'.repeat(32) },
    audio: { kind: 'session-audio', sample_rate_hz: 16_000 },
    state: 'ASSEMBLED',
    partial_reason: null,
    chunks: 2,
    failed_chunks: 0,
    speaker_reason: null,
    diarization: { num_speakers: 2, confidence: 0.9, engine: null },
  },
  segments: [
    { index: 0, start_ms: 0, end_ms: 1_500, text: 'Selamat pagi, silakan duduk.', speaker: 'A' },
    { index: 1, start_ms: 1_600, end_ms: 3_200, text: 'Terima kasih, Pak.', speaker: 'B' },
  ],
  speaker_state: 'LABELLED',
  intervals: [{ source: 'MIC-01', from_ms: 0, to_ms: null }],
  qa_flags: [],
} as const;
const DOCUMENT_BYTES = Buffer.from(`${JSON.stringify(DOCUMENT)}\n`);
const DOCUMENT_SHA = createHash('sha256').update(DOCUMENT_BYTES).digest('hex');
/** A key ID both the signer's rule and the table's `CODE` rule take. */
const KEY_ID = 'COREKEYEVSIGN01';

export interface RealTranscriptItem {
  readonly evidenceId: string;
  /** The text of segment 1, for a revision request. */
  readonly segmentText: string;
  /** Removes the package folder, the key folder and the builder's scratch. */
  remove(): void;
}

/**
 * Seals the STOPPING session `sessionId` of `app` as a REAL item with a machine transcript and
 * puts its package into the media store. `scratchDir` holds the signing key of this walk.
 */
export async function sealRealItemWithTranscript(app: FastifyInstance, sessionId: string, scratchDir: string): Promise<RealTranscriptItem> {
  const now = app.clock.now();
  const keyDir = join(scratchDir, `contract-transcript-signer-${process.pid}`);
  provisionSigningKey({ dir: keyDir, now: now - 60_000, keyId: KEY_ID });
  const signer = loadSoftwareSigner({ dir: keyDir, now, keyId: KEY_ID });
  provideRevisionSigner(app, () => signer);

  // Pass D6 (coverage cell `createEvidenceMediaSession 201`): the package must be PLAYABLE - sealed
  // with a session key a credential store holds, and its manifest hash the item's `manifest_hash`.
  // The hash is an input of the seal, so the package is built BEFORE it, for the evidence ID the
  // seal is about to mint (the session machine's own rule; checked against the minted ID below).
  // The key store is a throw-away one of this walk, handed to the media unit through its test door
  // (as `modules/media-stream/__tests__/media-stream.db.test.ts` does): no product secret is used.
  if (!isEngineControl(app.engine)) throw new Error('the walk needs the engine host of src/engine');
  const pending = app.engine.simulator()?.store.getState();
  const open = pending?.session ?? null;
  if (pending === undefined || open === null || open.id !== sessionId) throw new Error('the session to seal is not the open session');
  const evidenceId = open.evidenceId ?? evidenceIdFor(pending.meta.counters.evidence, open.createdAt);
  const storeDir = join(scratchDir, `contract-media-store-${process.pid}`);
  mkdirSync(storeDir, { recursive: true });
  const storeHost = { stages: {}, config: { dataDir: storeDir } };
  const opened = coreCredentialStore(storeHost);
  if (opened.status !== 'READY') throw new Error(`the throw-away credential store is ${opened.status}`);
  const sessionKey = opened.store.sessionKeys.create(sessionId);
  const sealer = createFragmentSealer(sessionKey);
  const built = await buildPackage({ sessionId, evidenceId, signer, sealer: (position, plaintext) => sealer.seal(position, plaintext), beforeSeal: (manifest) => void (manifest.transcript.sha256 = DOCUMENT_SHA) });
  opened.store.sessionKeys.release(sessionKey);
  mediaStream(app).replaceForTest({ opener: coreFragmentOpener(storeHost), mac: () => mediaSessionMacOf(storeHost) });

  const steps: SealingStepReport[] = SEALING_STEP_ORDER.map((id, index) => ({ id, status: index < 5 ? 'DONE' : 'RUNNING', progress: index < 5 ? 100 : 90, etaMs: index < 5 ? null : 700, attempt: 1 }));
  const doors = sealDoorsOf(app.engine);
  await doors.applySealingProgress({ sessionId, steps });
  const input: CompleteSealInput = {
    sessionId,
    sealedAt: now,
    manifestSha256: built.manifest.manifestSha256,
    signature: { value: 'cd'.repeat(64), keyId: signer.signer.keyId, algorithm: 'Ed25519' },
    tracks: [
      { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: '01'.repeat(32) },
      { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: '02'.repeat(32) },
    ],
    interrupted: false,
    durableEndAt: now - 1_000,
    transcriptSha256: DOCUMENT_SHA,
    labelsStatus: 'LABELLED',
    developmentSources: true,
  };
  const packageDir = join(app.config.mediaStoreDir, `SESSION-${sessionId}`);
  const outcome = await doors.completeSeal(input, async (unit, minted) => {
    if (minted !== evidenceId) throw new Error(`the seal minted ${minted}; the package was built for ${evidenceId}`);
    mkdirSync(app.config.mediaStoreDir, { recursive: true });
    cpSync(built.dir, packageDir, { recursive: true });
    writeFileSync(join(packageDir, ...PackageFile.TRANSCRIPT_JSON.split('/')), DOCUMENT_BYTES);
    await createTranscriptStore(unit).writeSealedTranscript({ evidenceId, jsonSha256: DOCUMENT_SHA, srtSha256: 'c1'.repeat(32), vttSha256: 'c2'.repeat(32), model: { name: 'whisper' }, diarization: { numSpeakers: 2 }, labelsStatus: 'LABELLED', createdAt: now });
  });
  return {
    evidenceId: outcome.value.evidenceId,
    segmentText: DOCUMENT.segments[1].text,
    remove() {
      rmSync(packageDir, { recursive: true, force: true });
      rmSync(keyDir, { recursive: true, force: true });
      rmSync(storeDir, { recursive: true, force: true });
      removeScratch();
    },
  };
}
