// `M7-STTCFG-VERIFY` (blueprint row 119; test strategy §A.6a, the verify clause split off
// `M6-STTCFG-OFF` / `M6-STTCFG-UNREACH` by CF-12; ev §B.7a, §D; decision D110).
//
// THE CHAIN OF EVERY TEST: the REAL seal step (`finalizeTranscript`, on the real `@dems/transcriber`
// pipeline with stand-in engines) answers a transcript block -> row 83's builder puts it into a
// manifest -> row 83's signer signs it with a throw-away Ed25519 key -> the package is written to
// a throw-away folder with real bytes and real hashes -> row 85's verifier (`verifyPackageV2`
// through the Core's ports) reads it from disk. Nothing in between is a stand-in but the media
// bytes, the fragment cipher double and the engines (see `package-support.ts`, `support.ts`).
//
// WHAT IS SHOWN:
//   1. a DISABLED package, an unreachable-PARTIAL package and the no-document PARTIAL package of
//      D110 each verify PASS, all 14 checks, with the state reported;
//   2. the state, the reason, the unreachable flag, the failed-chunk count and the snapshot sit
//      inside the signed manifest: a raw edit fails the manifest hash (V-03); an edit that is
//      re-hashed fails the signature (V-09); re-signed with a key of the editor's own it fails
//      against what the Core holds of the item (V-03 anchor, V-13 trust);
//   3. the state and the files must agree whatever the signature says: a document that is there
//      although the manifest declares none, or missing although it declares one, fails (V-10, V-14).
// No database, no process, no model, no oMLX; no wall-clock wait.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { PackageFile, isServerSttBackend, type ManifestV2Input } from '@dems/shared/evidence-package';
import { TRANSCRIPT_STATE_REPORT, VERIFY_V2_CHECKS, verifyPackageV2, type PackageVerifyResult, type VerifyCheckId, type VerifyExpectations } from '@dems/shared/evidence-verify';
import { TranscriberError, createMemoryChunkMirror } from '@dems/transcriber';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import { FINALIZE_TRANSCRIPT_STEP, FinalizeTranscriptError, createTranscriptFileReader, finalizeTranscript, type AssembledTranscriptSource, type FinalizeTranscriptInput, type FinalizeTranscriptLimits, type FinalizeTranscriptResult, type SttConfigSnapshot, type TranscriptFiles } from '../index';
import { removePackages, sealPackage, sha256Hex, tamperManifest, throwAwaySigner, type SealedPackage } from './package-support';
import { manualClock, memoryErrorLog, memoryJournal, snapshotOf, transcribedSession, type SessionOptions } from './support';

afterAll(removePackages);

const LIMITS: FinalizeTranscriptLimits = { stepLimitMs: 600_000, callLimitMs: 30_000, closeOutLimitMs: 60_000 };
type Block = ManifestV2Input['transcript'];
type Done = Extract<FinalizeTranscriptResult, { status: 'DONE' }>;
let counter = 0;

// ── The seal step, as the pipeline calls it ────────────────────────────────────────────────────

interface StepRun {
  readonly block: Block;
  readonly files: TranscriptFiles | null;
}

async function sealStep(options: Omit<SessionOptions, 'mirror'> & { snapshot?: SttConfigSnapshot; start?: 'FINISH' | 'HANG_AFTER_ONE' | 'NONE'; closeOutFails?: boolean; backendUnreachable?: boolean }): Promise<StepRun> {
  const mirror = createMemoryChunkMirror();
  const sessionId = `SES-20261009-${String(8400 + (counter += 1)).padStart(4, '0')}`;
  const { snapshot, start, closeOutFails, backendUnreachable, ...sessionOptions } = options;
  let reach: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => void (reach = resolve));
  const session = transcribedSession(sessionId, {
    ...sessionOptions,
    mirror,
    ...(start === 'HANG_AFTER_ONE'
      ? {
          engineGate: (offsetMs: number) => {
            if (offsetMs < 40_000) return Promise.resolve();
            reach();
            return new Promise<void>(() => undefined);
          },
        }
      : {}),
  });
  if (start === 'FINISH') await session.finish();
  if (start === 'HANG_AFTER_ONE') {
    void session.runner.step({ final: true });
    await reached;
  }
  const journal = memoryJournal();
  const clock = manualClock();
  // A close-out that fails: the transcriber cannot hand anything over (D110).
  const transcript: AssembledTranscriptSource = closeOutFails === true ? { ...session.seam, assemble: async () => ({ kind: 'NOT_READY' }), closeOut: async () => ({ kind: 'NOT_READY' }) } : session.seam;
  const input: FinalizeTranscriptInput = { sessionId, sttSnapshot: snapshot ?? snapshotOf({ backend: sessionOptions.backend ?? 'cpu-local' }), attempt: 1, limits: LIMITS, ...(backendUnreachable === undefined ? {} : { backendUnreachable }) };
  for (let calls = 0; calls < 400; calls += 1) {
    let result: FinalizeTranscriptResult;
    try {
      result = await finalizeTranscript(input, { transcript, chunkRows: mirror, files: createTranscriptFileReader(), journal, log: memoryErrorLog(), now: clock.now, timer: clock.timer });
    } catch (error) {
      // The retries of the pipeline (row 82) on a typed failure of the step.
      if (!(error instanceof FinalizeTranscriptError) || error.code !== 'TRANSCRIPT_CLOSE_OUT_FAILED') throw error;
      continue;
    }
    if (result.status === 'DONE') {
      const done: Done = result;
      expect(journal.rows.get(`${sessionId}#${FINALIZE_TRANSCRIPT_STEP}`)?.status).toBe('DONE');
      return { block: done.transcript.manifest, files: done.files };
    }
    clock.advance(Math.min(10_000, result.remainingWaitMs));
  }
  throw new Error('THE STEP WAITED FOR EVER');
}

const unreachable = (): Error => new TranscriberError('UNREACHABLE', 'the transcriber backend could not be reached', { reason: 'UNREACHABLE' });

const SCENARIOS = {
  /** `M6-STTCFG-OFF`: STT disabled in the session's snapshot. */
  DISABLED: () => sealStep({ start: 'NONE', snapshot: snapshotOf({ enabled: false }) }),
  /** `M6-STTCFG-UNREACH`: STT enabled, the backend refuses every chunk: a PARTIAL document without text. */
  UNREACHABLE: () => sealStep({ backend: 'omlx-server', fail: unreachable, start: 'FINISH' }),
  /** D110: STT enabled, the backend hangs and the close-out fails: PARTIAL without a document. */
  UNAVAILABLE: () => sealStep({ backend: 'omlx-server', start: 'HANG_AFTER_ONE', closeOutFails: true, backendUnreachable: true }),
  /** The control: every chunk committed. */
  READY: () => sealStep({ start: 'FINISH' }),
} as const;
type Scenario = keyof typeof SCENARIOS;

async function packageOf(scenario: Scenario): Promise<SealedPackage> {
  const step = await SCENARIOS[scenario]();
  return sealPackage({ transcript: step.block, files: step.files });
}

// ── Verify, as the Core runs it ────────────────────────────────────────────────────────────────

const CHUNK = 256;
const ALL: VerifyCheckId[] = VERIFY_V2_CHECKS.map((check) => check.id);
/** Every anchor the Core holds of the item (operation 41). */
const verifyAtCore = (sealed: SealedPackage, expected: VerifyExpectations = sealed.anchors): Promise<PackageVerifyResult> => verifyPackageV2(corePorts(sealed.dir, sealed.opener, CHUNK), { plaintext: 'REQUIRED', expected });
/** What the package says of ITSELF: no anchor from outside it. */
const verifyAlone = (sealed: SealedPackage): Promise<PackageVerifyResult> => verifyPackageV2(corePorts(sealed.dir, sealed.opener, CHUNK), { plaintext: 'REQUIRED' });
const failing = (result: PackageVerifyResult): VerifyCheckId[] => result.checks.filter((check) => check.status === 'FAIL').map((check) => check.id);
const passing = (result: PackageVerifyResult): VerifyCheckId[] => result.checks.filter((check) => check.status === 'PASS').map((check) => check.id);
const codes = (result: PackageVerifyResult, id: VerifyCheckId): string[] => result.checks.find((check) => check.id === id)?.findings.map((finding) => finding.code) ?? [];

const UNTOLD = { sealedState: null, reason: null, documentSealed: null, failedChunks: null, backendUnreachable: null };

/** A failed run says nothing of the transcript as fact: neither the sealed state nor the edited one. */
function expectNotTrusted(result: PackageVerifyResult): void {
  expect(result.ok).toBe(false);
  expect(result.overall).not.toBe('PASS');
  expect(result.transcriptState).toEqual({ code: 'NOT_TRUSTWORTHY', report: 'Transcript state: not trustworthy — the manifest was altered', ...UNTOLD });
}

describe('M7-STTCFG-VERIFY: each transcript state verifies PASS, and the state is shown', () => {
  it('DISABLED: all 14 checks pass; reported "Transcript disabled by configuration"; no transcript file is in the package or expected', async () => {
    const sealed = await packageOf('DISABLED');
    expect(sealed.manifest.transcript).toMatchObject({ state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', file: null, sha256: null, backendUnreachable: false, configSnapshot: { enabled: false } });
    const result = await verifyAtCore(sealed);
    expect([result.ok, result.overall, passing(result)]).toEqual([true, 'PASS', ALL]);
    expect(result.transcript).toEqual({ state: 'DISABLED', revisions: null });
    expect(result.transcriptState).toEqual({ code: 'DISABLED_BY_CONFIGURATION', report: 'Transcript disabled by configuration', sealedState: 'DISABLED', reason: 'DISABLED_BY_CONFIGURATION', documentSealed: false, failedChunks: null, backendUnreachable: false });
  });

  it('PARTIAL, backend unreachable: all 14 checks pass over the sealed PARTIAL document; reported "Transcript partial — backend unreachable" with the failed-chunk count', async () => {
    const sealed = await packageOf('UNREACHABLE');
    expect(sealed.manifest.transcript).toMatchObject({ state: 'PARTIAL', disabledReason: null, file: 'transcript/transcript.json', failedChunks: 3, backendUnreachable: true, configSnapshot: { enabled: true, backend: 'omlx-server' } });
    const result = await verifyAtCore(sealed);
    expect([result.ok, result.overall, passing(result)]).toEqual([true, 'PASS', ALL]);
    // The document IS hashed (V-10) and its revision list read (V-11): the absence of text is not an absence of evidence.
    expect(result.transcript).toEqual({ state: 'VERIFIED', revisions: 0 });
    expect(result.transcriptState).toEqual({ code: 'PARTIAL_BACKEND_UNREACHABLE', report: 'Transcript partial — backend unreachable', sealedState: 'PARTIAL', reason: null, documentSealed: true, failedChunks: 3, backendUnreachable: true });
  });

  it('PARTIAL without a document (D110): all 14 checks pass; reported "Transcript unavailable at seal" — and never as disabled', async () => {
    const sealed = await packageOf('UNAVAILABLE');
    expect(sealed.manifest.transcript).toMatchObject({ state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', file: null, sha256: null, srtSha256: null, vttSha256: null, revisionHead: null, failedChunks: 3, backendUnreachable: true, configSnapshot: { enabled: true } });
    const result = await verifyAtCore(sealed);
    expect([result.ok, result.overall, passing(result)]).toEqual([true, 'PASS', ALL]);
    expect(result.transcript).toEqual({ state: 'UNAVAILABLE', revisions: null });
    expect(result.transcriptState).toEqual({ code: 'UNAVAILABLE_AT_SEAL', report: 'Transcript unavailable at seal', sealedState: 'PARTIAL', reason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', documentSealed: false, failedChunks: 3, backendUnreachable: true });
    expect(JSON.stringify(result)).not.toMatch(/DISABLED|disabled/);
  });

  it('CONTROL: a complete transcript is reported as sealed, so the three states above are not what every package says', async () => {
    const result = await verifyAtCore(await packageOf('READY'));
    expect([result.ok, passing(result)]).toEqual([true, ALL]);
    expect(result.transcriptState).toEqual({ code: 'READY', report: 'Transcript sealed', sealedState: 'ASSEMBLED', reason: null, documentSealed: true, failedChunks: 0, backendUnreachable: false });
    // Every state has its own line.
    expect(new Set(Object.values(TRANSCRIPT_STATE_REPORT)).size).toBe(Object.keys(TRANSCRIPT_STATE_REPORT).length);
  });
});

// ── Tampering ──────────────────────────────────────────────────────────────────────────────────

type Edit = (manifest: Record<string, any>) => void;
const DISABLED_BLOCK = { state: 'DISABLED', disabledReason: 'DISABLED_BY_CONFIGURATION', backendUnreachable: false, failedChunks: null };
const NO_DOCUMENT = { file: null, docVersion: null, sha256: null, srtSha256: null, vttSha256: null, model: { name: null, version: null, quantisation: null, modelSha256: null }, diarization: { numSpeakers: null, status: null, confidence: null }, speakerState: null, revisionHead: null };

/**
 * Edits that leave the manifest a VALID manifest (the schema has nothing to say): only the hash,
 * the signature and the anchors can find them. `files`: whether the files on disk still agree
 * with what the edited manifest declares.
 */
const VALID_EDITS: readonly { readonly on: Scenario; readonly what: string; readonly edit: Edit; readonly files: 'AGREE' | 'DOCUMENT_LEFT_OVER' }[] = [
  // The state field itself.
  { on: 'UNAVAILABLE', what: 'state PARTIAL(unavailable) -> DISABLED: "STT was off" in the place of "STT failed"', files: 'AGREE', edit: (m) => Object.assign(m.transcript, DISABLED_BLOCK, { configSnapshot: { ...m.transcript.configSnapshot, enabled: false } }) },
  { on: 'DISABLED', what: 'state DISABLED -> PARTIAL(unavailable): "STT failed" in the place of "STT was off"', files: 'AGREE', edit: (m) => Object.assign(m.transcript, { state: 'PARTIAL', disabledReason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', configSnapshot: { ...m.transcript.configSnapshot, enabled: true } }) },
  { on: 'UNREACHABLE', what: 'state PARTIAL -> ASSEMBLED with no failed chunk: a transcript without text passed off as complete', files: 'AGREE', edit: (m) => Object.assign(m.transcript, { state: 'ASSEMBLED', failedChunks: 0, backendUnreachable: false }) },
  { on: 'UNREACHABLE', what: 'state PARTIAL(document) -> DISABLED, the document left in the folder', files: 'DOCUMENT_LEFT_OVER', edit: (m) => Object.assign(m.transcript, NO_DOCUMENT, DISABLED_BLOCK, { configSnapshot: { ...m.transcript.configSnapshot, enabled: false } }) },
  // The reason of the state, the unreachable flag, the failed-chunk count.
  { on: 'UNREACHABLE', what: 'backendUnreachable true -> false', files: 'AGREE', edit: (m) => void (m.transcript.backendUnreachable = false) },
  { on: 'UNAVAILABLE', what: 'backendUnreachable true -> false', files: 'AGREE', edit: (m) => void (m.transcript.backendUnreachable = false) },
  { on: 'UNREACHABLE', what: 'failedChunks 3 -> 1', files: 'AGREE', edit: (m) => void (m.transcript.failedChunks = 1) },
  { on: 'UNAVAILABLE', what: 'failedChunks 3 -> null', files: 'AGREE', edit: (m) => void (m.transcript.failedChunks = null) },
  // The snapshot of the session's STT configuration.
  { on: 'DISABLED', what: 'snapshot.revision + 1', files: 'AGREE', edit: (m) => void (m.transcript.configSnapshot.revision += 1) },
  { on: 'DISABLED', what: 'snapshot.backend cpu-local -> omlx-server', files: 'AGREE', edit: (m) => void (m.transcript.configSnapshot.backend = 'omlx-server') },
  { on: 'UNREACHABLE', what: 'snapshot.model -> another model', files: 'AGREE', edit: (m) => void (m.transcript.configSnapshot.model = 'another-model') },
  { on: 'UNAVAILABLE', what: 'snapshot.diarization flipped', files: 'AGREE', edit: (m) => void (m.transcript.configSnapshot.diarization = !m.transcript.configSnapshot.diarization) },
];

/** Edits of ONE member that break a rule between the fields: the manifest is no manifest any more. */
const BREAKING_EDITS: readonly { readonly on: Scenario; readonly what: string; readonly member: string; readonly edit: Edit }[] = [
  { on: 'DISABLED', what: 'state DISABLED -> ASSEMBLED, nothing else', member: 'transcript.file', edit: (m) => void (m.transcript.state = 'ASSEMBLED') },
  { on: 'DISABLED', what: 'state DISABLED -> PARTIAL, nothing else', member: 'transcript.configSnapshot.enabled', edit: (m) => void (m.transcript.state = 'PARTIAL') },
  { on: 'UNAVAILABLE', what: 'state PARTIAL -> DISABLED, nothing else', member: 'transcript.disabledReason', edit: (m) => void (m.transcript.state = 'DISABLED') },
  { on: 'UNAVAILABLE', what: 'reason -> DISABLED_BY_CONFIGURATION, nothing else', member: 'transcript.disabledReason', edit: (m) => void (m.transcript.disabledReason = 'DISABLED_BY_CONFIGURATION') },
  { on: 'UNAVAILABLE', what: 'reason removed (null), nothing else', member: 'transcript.file', edit: (m) => void (m.transcript.disabledReason = null) },
  { on: 'DISABLED', what: 'reason removed (null), nothing else', member: 'transcript.disabledReason', edit: (m) => void (m.transcript.disabledReason = null) },
  { on: 'UNREACHABLE', what: 'state PARTIAL(document) -> DISABLED, nothing else', member: 'transcript.file', edit: (m) => void (m.transcript.state = 'DISABLED') },
  { on: 'DISABLED', what: 'snapshot.enabled false -> true, nothing else', member: 'transcript.configSnapshot.enabled', edit: (m) => void (m.transcript.configSnapshot.enabled = true) },
  { on: 'UNREACHABLE', what: 'snapshot gains an endpoint', member: 'transcript.configSnapshot', edit: (m) => void (m.transcript.configSnapshot.endpoint = 'http://127.0.0.1:8000/v1') },
  { on: 'UNREACHABLE', what: 'snapshot.model -> a credential reference', member: 'transcript.configSnapshot.model', edit: (m) => void (m.transcript.configSnapshot.model = 'omlx-settings:auth.api_key') },
  { on: 'UNAVAILABLE', what: 'an unknown reason', member: 'transcript.disabledReason', edit: (m) => void (m.transcript.disabledReason = 'TRANSCRIPT_LOST') },
];

describe('M7-STTCFG-VERIFY: a tampered state FAILS — layer 1, the manifest hash (a raw edit)', () => {
  it.each(VALID_EDITS)('$on: $what -> V-03 TAMPERED, the signature over the recorded digest still verifies', async ({ on, edit, files }) => {
    const sealed = await packageOf(on);
    tamperManifest(sealed, 'RAW', edit);
    const result = await verifyAtCore(sealed);
    // The document that the edited manifest no longer declares is found as well: four files nobody sealed, and an item that has a transcript.
    expect(failing(result)).toEqual(files === 'AGREE' ? ['V-03'] : ['V-03', 'V-10', 'V-14']);
    expect(codes(result, 'V-03')).toEqual(['MANIFEST_HASH_MISMATCH']);
    expect(result.checks.find((check) => check.id === 'V-03')?.failureClass).toBe('TAMPERED');
    expect(result.signature.ok).toBe(true);
    expectNotTrusted(result);
  });

  it.each(BREAKING_EDITS)('$on: $what -> V-01 names the member and V-03 fails; nothing that needs the manifest is called a pass', async ({ on, edit, member }) => {
    const sealed = await packageOf(on);
    tamperManifest(sealed, 'RAW', edit);
    const result = await verifyAtCore(sealed);
    expect(failing(result)).toEqual(['V-01', 'V-03']);
    expect(result.checks.find((check) => check.id === 'V-01')?.findings.map((finding) => finding.member)).toContain(member);
    // V-14 counts the files that every package has; it needs no manifest for that. Everything else is BLOCKED.
    expect(passing(result)).toEqual(['V-14']);
    expectNotTrusted(result);
  });
});

describe('M7-STTCFG-VERIFY: a tampered state FAILS — layer 2, the signature (the edit is re-hashed)', () => {
  it.each(VALID_EDITS)('$on: $what, manifestSha256 and signature.sig recomputed, no key -> the hash agrees, the SIGNATURE does not (V-09)', async ({ on, edit, files }) => {
    const sealed = await packageOf(on);
    tamperManifest(sealed, 'REHASHED', edit);
    // The package alone: its hash is consistent again, and exactly the signature gives the edit away.
    const alone = await verifyAlone(sealed);
    expect(failing(alone)).toEqual(files === 'AGREE' ? ['V-09'] : ['V-09', 'V-14']);
    expect(codes(alone, 'V-09')).toEqual(['SIGNATURE_INVALID']);
    expect(codes(alone, 'V-03')).toEqual([]);
    expectNotTrusted(alone);
    // At the Core the recorded digest of the item is one more witness.
    const atCore = await verifyAtCore(sealed);
    expect(failing(atCore)).toEqual(files === 'AGREE' ? ['V-03', 'V-09'] : ['V-03', 'V-09', 'V-10', 'V-14']);
    expect(codes(atCore, 'V-03')).toEqual(['MANIFEST_NOT_OF_ITEM']);
    expectNotTrusted(atCore);
  });

  it('re-signed with a key that is not the Core\'s, the Core\'s certificate left in place -> V-09', async () => {
    const other = throwAwaySigner();
    for (const { on, edit } of VALID_EDITS.filter((_, index) => [0, 1, 4].includes(index))) {
      const sealed = await packageOf(on);
      tamperManifest(sealed, 'RESIGNED', edit, other);
      const result = await verifyAlone(sealed);
      expect(failing(result), on).toEqual(['V-09']);
      expectNotTrusted(result);
    }
  });

  it('re-signed with another key AND its certificate put in place: consistent with itself — only what the Core holds of the item catches it (V-03 anchor, V-13 trust)', async () => {
    const other = throwAwaySigner();
    const [hideFailure] = VALID_EDITS;
    if (hideFailure === undefined) throw new Error('no edit');
    const sealed = await packageOf(hideFailure.on);
    tamperManifest(sealed, 'FORGED', hideFailure.edit, other);
    // THE KNOWN LIMIT (SEC35-06), stated and not hidden: without an anchor a wholly forged package passes, and says what its forger wrote.
    const alone = await verifyAlone(sealed);
    expect([alone.ok, alone.transcriptState.code]).toEqual([true, 'DISABLED_BY_CONFIGURATION']);
    // The Core has the anchors: the digest it recorded at the seal and the certificates it trusts.
    const atCore = await verifyAtCore(sealed);
    expect(failing(atCore)).toEqual(['V-03', 'V-13']);
    expect([codes(atCore, 'V-03'), codes(atCore, 'V-13')]).toEqual([['MANIFEST_NOT_OF_ITEM'], ['CERTIFICATE_NOT_TRUSTED']]);
    expectNotTrusted(atCore);
    expect(JSON.stringify(atCore)).not.toContain('disabled by configuration');
  });

  it.each(BREAKING_EDITS)('$on: $what, re-hashed -> still no manifest (V-01); the state is not reported', async ({ on, edit }) => {
    const sealed = await packageOf(on);
    tamperManifest(sealed, 'REHASHED', edit);
    const result = await verifyAlone(sealed);
    expect(failing(result)).toEqual(['V-01']);
    expect(result.ok).toBe(false);
    // The hash of the edited text agrees with itself, and the files every package has are there: nothing else is a pass.
    expect(passing(result)).toEqual(['V-03', 'V-14']);
    expect(result.transcriptState).toEqual({ code: 'UNKNOWN', report: 'Transcript state: unknown — the manifest cannot be read', ...UNTOLD });
  });
});

describe('M7-STTCFG-VERIFY: a tampered state FAILS — layer 3, the state against the files (whatever the signature says)', () => {
  const other = throwAwaySigner;

  it('DISABLED on paper, a document in the folder: a wholly forged manifest (valid signature of the forger) still fails — the transcript files are files nobody sealed', async () => {
    const sealed = await packageOf('UNREACHABLE');
    tamperManifest(sealed, 'FORGED', (m) => Object.assign(m.transcript, NO_DOCUMENT, DISABLED_BLOCK, { configSnapshot: { ...m.transcript.configSnapshot, enabled: false } }), other());
    const result = await verifyAlone(sealed);
    expect(failing(result)).toEqual(['V-14']);
    expect(result.checks.find((check) => check.id === 'V-14')?.findings).toEqual(
      [PackageFile.TRANSCRIPT_REVISIONS, PackageFile.TRANSCRIPT_JSON, PackageFile.TRANSCRIPT_SRT, PackageFile.TRANSCRIPT_VTT].map((file) => ({ code: 'UNEXPECTED_FILE', failureClass: 'TAMPERED', file })),
    );
    expect(result.ok).toBe(false);
  });

  it('READY on paper, no document in the folder: a DISABLED and an UNAVAILABLE package forged into ASSEMBLED fail the transcript hash, the revisions and the completeness check', async () => {
    const invented = { file: 'transcript/transcript.json', docVersion: 'dems.transcript/1', sha256: sha256Hex(Buffer.from('json')), srtSha256: sha256Hex(Buffer.from('srt')), vttSha256: sha256Hex(Buffer.from('vtt')), model: { name: 'm', version: '1', quantisation: 'none', modelSha256: sha256Hex(Buffer.from('model')) }, diarization: { numSpeakers: 2, status: 'LABELLED', confidence: 0.9 }, speakerState: 'LABELLED', state: 'ASSEMBLED', failedChunks: 0, revisionHead: 0, disabledReason: null, backendUnreachable: false };
    for (const on of ['DISABLED', 'UNAVAILABLE'] as const) {
      const sealed = await packageOf(on);
      // A forger who knows the format follows decision D160 (a server backend states the model name only): the forgery must be WELL-FORMED, so that it is the files that fail it, not the schema.
      tamperManifest(
        sealed,
        'FORGED',
        (m) => Object.assign(m.transcript, invented, { configSnapshot: { ...m.transcript.configSnapshot, enabled: true } }, isServerSttBackend(m.transcript.configSnapshot.backend) ? { model: { name: 'm', version: null, quantisation: null, modelSha256: null } } : {}),
        other(),
      );
      const result = await verifyAlone(sealed);
      expect(failing(result), on).toEqual(['V-10', 'V-11', 'V-14']);
      expect(codes(result, 'V-10'), on).toEqual(['TRANSCRIPT_FILE_MISSING', 'TRANSCRIPT_FILE_MISSING', 'TRANSCRIPT_FILE_MISSING']);
      expect(result.transcript.state, on).toBe('FAILED');
      expect(result.ok, on).toBe(false);
    }
  });

  it('untouched manifest, touched folder: a transcript file planted in the no-document package, and the document removed from the PARTIAL one', async () => {
    const without = await packageOf('UNAVAILABLE');
    mkdirSync(without.path(PackageFile.TRANSCRIPT_DIR), { recursive: true });
    writeFileSync(without.path(PackageFile.TRANSCRIPT_JSON), '{"segments":[{"text":"a transcript that was never sealed"}]}');
    const planted = await verifyAtCore(without);
    expect(failing(planted)).toEqual(['V-14']);
    expect(planted.checks.find((check) => check.id === 'V-14')?.findings).toEqual([{ code: 'UNEXPECTED_FILE', failureClass: 'TAMPERED', file: PackageFile.TRANSCRIPT_JSON }]);
    expect(planted.ok).toBe(false);
    // The manifest IS the signed one, so the state it declares is still told — beside the failure.
    expect(planted.transcriptState.code).toBe('UNAVAILABLE_AT_SEAL');

    const partial = await packageOf('UNREACHABLE');
    rmSync(partial.path(PackageFile.TRANSCRIPT_JSON));
    const removed = await verifyAtCore(partial);
    expect(failing(removed)).toEqual(['V-10', 'V-14']);
    expect(codes(removed, 'V-10')).toEqual(['TRANSCRIPT_FILE_MISSING']);
    expect(removed.transcript.state).toBe('FAILED');
  });

  it('the item is the anchor of the transcript: a no-document package for an item that HAS a transcript hash fails V-10, and so does a document for an item that has none', async () => {
    const hash = sha256Hex(Buffer.from('the transcript of the item'));
    for (const on of ['DISABLED', 'UNAVAILABLE'] as const) {
      const sealed = await packageOf(on);
      const result = await verifyAtCore(sealed, { ...sealed.anchors, transcriptSha256: hash });
      expect(failing(result), on).toEqual(['V-10']);
      expect(codes(result, 'V-10'), on).toEqual(['TRANSCRIPT_NOT_OF_ITEM']);
    }
    const partial = await packageOf('UNREACHABLE');
    const result = await verifyAtCore(partial, { ...partial.anchors, transcriptSha256: null });
    expect(failing(result)).toEqual(['V-10']);
  });
});

describe('what a report of these states may hold', () => {
  it('codes, counts and fixed lines only: no hash, no model name, no path — for a pass and for a tampered package', async () => {
    const sealed = await packageOf('UNAVAILABLE');
    const pass = JSON.stringify(await verifyAtCore(sealed));
    tamperManifest(sealed, 'REHASHED', (m) => void (m.transcript.configSnapshot.model = 'edited-model'));
    const fail = JSON.stringify(await verifyAtCore(sealed));
    for (const text of [pass, fail]) {
      expect(text).not.toMatch(/[0-9a-f]{24,}/i);
      expect(text).not.toContain(sealed.dir);
      expect(text).not.toContain(sealed.manifest.transcript.configSnapshot.model);
      expect(text).not.toContain('edited-model');
    }
  });
});
