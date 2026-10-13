/**
 * THE SEALING PIPELINE v2 (blueprint row 82 / M7-W1). The contract, the steps and the resume
 * rules are stated in `contract.ts`; this file runs them.
 *
 * ONE RUN. `run` reads the six rows of `sealing_jobs`, counts its attempt (one more than the
 * highest attempt a row holds), and goes through the steps in order. A step whose row says DONE
 * is not run again: what later steps need of it is read from its checkpoint, or rebuilt from the
 * files and rows the step left (every step leaves the same bytes when it runs twice). Before a
 * step starts its row says RUNNING; when it has finished, DONE with the checkpoint; when it
 * failed, FAILED with the code - and the failure is in the persistent error log.
 *
 * WHAT IS FROZEN FOR THE DIGEST (fix pass F-M7, R88-03). `BUILD_MANIFEST` writes EVERYTHING a
 * resumed build could otherwise read differently into its RUNNING row BEFORE the first build:
 * `sealedAt`, `signedAt`, the step list, and the whole input of the manifest as the session record
 * gave it then (the time source, the device and its software version, the operator, the cameras,
 * the certificate block, the transcript block, the source rows). A resumed build and
 * `SIGN_MANIFEST` take them from there and read nothing live, so they form the same canonical
 * body. The fragment table is not in the snapshot: it is `fragments.json` of the package. The
 * signer signs the digest the checkpoint holds or nothing (`MANIFEST_NOT_REPRODUCIBLE`: now only
 * when a file of the package changed after the build).
 *
 * THE SESSION RECORD IS TOLD AS THE RUN GOES: after every change of a row the step states go to
 * the engine (`applySealingProgress`), with the tails the tail validation dropped. The item is
 * committed by `completeSeal` inside the last step, never from a progress value (decision D67).
 */
import { join } from 'node:path';
import {
  CAMERA_FILE_MEDIA_TYPE,
  EvidencePackageError,
  FRAGMENT_CHAIN_GENESIS,
  MANIFEST_SIGNATURE_COVERS,
  MANIFEST_V2_SCHEMA_ID,
  MANIFEST_V2_VERSION,
  PackageFile,
  SESSION_AUDIO_TRACK_ID,
  buildUnsignedManifest,
  cameraFileName,
  cameraFilePath,
  canonicalJsonBytes,
  declaredPackageFiles,
  nextFragmentChainHash,
  parseFragmentsJson,
  serializeDetachedSignature,
  serializeFragmentsJson,
  serializeManifest,
  type ManifestFile,
  type ManifestFragment,
  type ManifestV2Input,
  type SessionCaptureSourceRow,
  type UnsignedManifestV2,
} from '@dems/shared/evidence-package';
import { TRANSCRIPT_REVISIONS_SCHEMA_ID, isDevelopmentKeySubject } from '@dems/shared/evidence-verify';
import type { CompleteSealInput, SealingStepReport } from '@dems/shared/sim';
import { CameraFileFlag, SignerError, classifyPartNames, deviceCertificateBlock, signManifest, validateCameraFile, verifyEd25519, type RecordedCheckpoint } from '../../capture';
import { VIDEO_TRACK_IDS, type VideoTrackId } from '../../modules/recording-fragments';
import { describeError } from '../../plugins/logger';
import { FinalizeTranscriptError, type FinalizeTranscriptResult } from '../finalize-transcript/contract';
import { SealingStepJournalError, type SealingStepRecord, type StepCheckpoint } from '../step-journal';
import { cameraFileNames, createExclusive, ensureDirectory, listPackageFiles, moveOut, nodeSha256, openCameraFile, removeIfThere, removeName, renameWithin, syncDirectory, syncFile, wholeFragmentsOnDisk } from './camera-files';
import {
  CONFINED_TO_ONE_CAMERA_FILE,
  SEALING_MAX_FRAGMENT_BYTES,
  SEALING_STEP_ORDER,
  SealingError,
  SealingFailure,
  SealingStop,
  type ClosedTrack,
  type HashedTrack,
  type OmittedTrack,
  type SealEngine,
  type SealOutcome,
  type SealRequest,
  type SealSessionFacts,
  type SealingDetail,
  type SealingHookPhase,
  type SealingPipeline,
  type SealingPorts,
  type SealingStepId,
  sealingFailureReason,
  sealerCauseOf,
  sealingOmittedNotice,
} from './contract';
import { createPackageWriter, type PackageWriter } from './package-writer';
import { SEALING_ORPHANS_DIR, finishSealedPlaintext } from './sealed-plaintext';

const SOURCE = 'sealing.pipeline';
const DEFAULT_CHUNK_BYTES = 1024 * 1024;
/** A running step's row and the engine are told of its progress at most this often. */
export const SEALING_PROGRESS_INTERVAL_MS = 500;
/** While `FINALIZE_TRANSCRIPT` waits, it is asked again no slower than this. */
export const TRANSCRIPT_POLL_MS = 1_000;
/** Typed failures of `FINALIZE_TRANSCRIPT` in one run before the run gives the step up (the step itself seals without a document after its own bound, row 119). */
export const TRANSCRIPT_RETRIES_PER_RUN = 4;
const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;

const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

interface ClosedCheckpoint {
  readonly interrupted: boolean;
  /** The camera files that ARE sealed: one or two, VIDEO-01 before VIDEO-02 (F-M7 R88-01). */
  readonly tracks: readonly ClosedTrack[];
  /** The cameras of the session that are not in the seal, and why. Absent in a checkpoint written before fix pass F-M7 (then: none). */
  readonly omitted?: readonly OmittedTrack[];
}
interface HashedCheckpoint {
  readonly tracks: readonly HashedTrack[];
}
type ManifestStep = ManifestV2Input['sealing']['steps'][number];
interface FrozenBuild {
  readonly sealedAt: number;
  readonly signedAt: number;
  readonly steps: readonly ManifestStep[];
  /**
   * THE SNAPSHOT (fix pass F-M7, R88-03; decision D178): everything the manifest is built from,
   * as it was when BUILD_MANIFEST first ran - the session record, the certificate block, the
   * tracks, the audio intervals, the transcript block - WITHOUT `files` (the fragment table is
   * `fragments.json`, durable in the package and read again), and the source rows the classes
   * are computed from. A resumed build takes these and nothing live. Absent only in a checkpoint
   * written before this fix: that build reads the session record again, as it did.
   */
  readonly input?: Omit<ManifestV2Input, 'files'>;
  readonly sourceRows?: readonly SessionCaptureSourceRow[];
}
interface BuiltCheckpoint extends FrozenBuild {
  readonly manifestSha256: string;
  readonly developmentSources: boolean;
  readonly transcript: boolean;
}

interface StepState {
  status: SealingStepReport['status'];
  progress: number;
  etaMs: number | null;
  attempt: number;
  detail: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const journalInvalid = (step: SealingStepId): SealingError => new SealingError(SealingFailure.JOURNAL_FAILED, 'a sealing step row does not hold the checkpoint this pipeline writes', { step });

function closedOf(row: SealingStepRecord): ClosedCheckpoint {
  const checkpoint = row.checkpoint;
  if (!isRecord(checkpoint) || typeof checkpoint.interrupted !== 'boolean' || !Array.isArray(checkpoint.tracks) || checkpoint.tracks.length < 1 || checkpoint.tracks.length > VIDEO_TRACK_IDS.length) throw journalInvalid('CLOSE_TRACKS');
  return checkpoint as unknown as ClosedCheckpoint;
}
function hashedOf(row: SealingStepRecord): HashedCheckpoint {
  const checkpoint = row.checkpoint;
  if (!isRecord(checkpoint) || !Array.isArray(checkpoint.tracks) || checkpoint.tracks.length < 1 || checkpoint.tracks.length > VIDEO_TRACK_IDS.length) throw journalInvalid('FINALIZE_HASHES');
  return checkpoint as unknown as HashedCheckpoint;
}
function frozenOf(row: SealingStepRecord | null): FrozenBuild | null {
  const checkpoint = row?.checkpoint;
  if (!isRecord(checkpoint)) return null;
  if (!Number.isSafeInteger(checkpoint.sealedAt) || !Number.isSafeInteger(checkpoint.signedAt) || !Array.isArray(checkpoint.steps)) return null;
  return checkpoint as unknown as FrozenBuild;
}
function builtOf(row: SealingStepRecord): BuiltCheckpoint {
  const frozen = frozenOf(row);
  const checkpoint = row.checkpoint as Record<string, unknown> | null;
  if (frozen === null || checkpoint === null || typeof checkpoint.manifestSha256 !== 'string' || typeof checkpoint.transcript !== 'boolean') throw journalInvalid('BUILD_MANIFEST');
  return checkpoint as unknown as BuiltCheckpoint;
}

export function createSealingPipeline(ports: SealingPorts): SealingPipeline {
  const chunkBytes = ports.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  // ONE BOUND (row 82c, F-86-1): the verifier's. A port may lower it for a test; it is never raised.
  const maxFragmentBytes = Math.min(ports.maxFragmentBytes ?? SEALING_MAX_FRAGMENT_BYTES, SEALING_MAX_FRAGMENT_BYTES);

  async function run(request: SealRequest): Promise<SealOutcome> {
    const { sessionId, cause } = request;
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId) || (cause !== 'STOPPED' && cause !== 'INTERRUPTED')) {
      throw new SealingError(SealingFailure.INPUT_INVALID, 'a seal is asked for a session ID and one of the two causes');
    }
    const packageDir = ports.packageDir(sessionId);
    const stagingDir = ports.stagingDir(sessionId);
    const fragmentsDir = join(packageDir, PackageFile.FRAGMENTS_DIR);
    const writer: PackageWriter = createPackageWriter(packageDir, stagingDir);
    const pathOf = (trackId: VideoTrackId): string => join(packageDir, ...cameraFilePath(trackId).split('/'));

    // ── What the run before left ────────────────────────────────────────────────────────────────
    const rows = new Map<SealingStepId, SealingStepRecord | null>();
    try {
      for (const step of SEALING_STEP_ORDER) rows.set(step, await ports.journal.read(sessionId, step));
    } catch (error) {
      throw new SealingError(SealingFailure.JOURNAL_FAILED, 'the sealing step rows could not be read', {}, error);
    }
    const known = [...rows.values()].filter((row): row is SealingStepRecord => row !== null);

    // A FAILED START (D84): nothing durable, so no seal runs, no row is written and no item exists.
    if (known.length === 0) {
      let anything = false;
      for (const trackId of VIDEO_TRACK_IDS) {
        // The file is the truth, the row is a hint (ruling D144 (2)): a whole fragment on the disk
        // without a row is durable media; a file that holds no whole fragment is not.
        if ((await ports.fragments.read(sessionId, trackId)).length > 0 || (await wholeFragmentsOnDisk(packageDir, trackId)) > 0) anything = true;
      }
      if (!anything) return { status: 'NOTHING_DURABLE', sessionId };
    }

    const attempt = known.reduce((highest, row) => Math.max(highest, row.attempt), 0) + 1;
    const facts = await ports.session.read(sessionId);
    if (facts === null) throw new SealingError(SealingFailure.INPUT_INVALID, 'the Core holds no such session', { sessionId });

    const states = new Map<SealingStepId, StepState>(
      SEALING_STEP_ORDER.map((step) => {
        const row = rows.get(step) ?? null;
        return [step, row?.status === 'DONE' ? { status: 'DONE', progress: 100, etaMs: 0, attempt: row.attempt, detail: null } : { status: 'PENDING', progress: 0, etaMs: null, attempt, detail: null }] as const;
      }),
    );
    const droppedTails: { trackId: string; droppedBytes: number }[] = [];
    const skipped: SealingStepId[] = [];

    const tell = async (): Promise<void> => {
      try {
        await ports.engine.applySealingProgress({
          sessionId,
          steps: SEALING_STEP_ORDER.map((id) => ({ id, ...(states.get(id) as StepState) })),
          ...(droppedTails.length > 0 ? { truncatedTails: droppedTails.map((tail) => ({ ...tail })) } : {}),
        });
      } catch (error) {
        throw new SealingError(SealingFailure.ENGINE_REFUSED, 'the engine did not take the sealing progress', {}, error);
      }
    };
    const writeRow = async (step: SealingStepId, status: 'RUNNING' | 'DONE' | 'FAILED', progress: number, checkpoint: StepCheckpoint | null, errorCode: string | null, etaMs: number | null): Promise<void> => {
      try {
        await ports.journal.write({ sessionId, step, status, progress, etaMs, attempt, checkpoint, errorCode, at: ports.now() });
      } catch (error) {
        throw new SealingError(SealingFailure.JOURNAL_FAILED, 'a sealing step row could not be written', { step }, error);
      }
    };
    const hook = async (step: SealingStepId, phase: SealingHookPhase): Promise<void> => {
      await ports.hook?.({ step, phase, attempt });
    };

    /** A progress callback for one step: its row and the engine, at most once per interval. */
    const progressOf = (step: SealingStepId, checkpoint: () => StepCheckpoint | null) => {
      const startedAt = ports.now();
      let toldAt = startedAt;
      return async (fraction: number, detail: string | null): Promise<void> => {
        const now = ports.now();
        if (now - toldAt < SEALING_PROGRESS_INTERVAL_MS) return;
        toldAt = now;
        const bounded = Math.min(0.99, Math.max(0, fraction));
        const state = states.get(step) as StepState;
        state.progress = Math.max(state.progress, Math.floor(bounded * 100));
        // The remaining time of THIS step, from the Core clock (D121); none before a twentieth is done.
        state.etaMs = bounded >= 0.05 ? Math.round(((now - startedAt) * (1 - bounded)) / bounded) : null;
        state.detail = detail;
        await writeRow(step, 'RUNNING', state.progress, checkpoint(), null, state.etaMs);
        await tell();
      };
    };

    // ── What the steps hand on (from this run, or from the checkpoint of a run before) ──────────
    let closed: ClosedCheckpoint | null = null;
    let hashed: HashedCheckpoint | null = null;
    let transcript: Extract<FinalizeTranscriptResult, { status: 'DONE' }> | null = null;
    let built: BuiltCheckpoint | null = null;
    let unsigned: UnsignedManifestV2 | null = null;

    const doneRow = (step: SealingStepId): SealingStepRecord => {
      const row = rows.get(step);
      if (row === null || row === undefined || row.status !== 'DONE') throw journalInvalid(step);
      return row;
    };
    const closedNow = (): ClosedCheckpoint => (closed ??= closedOf(doneRow('CLOSE_TRACKS')));
    const hashedNow = (): HashedCheckpoint => (hashed ??= hashedOf(doneRow('FINALIZE_HASHES')));
    const builtNow = (): BuiltCheckpoint => (built ??= builtOf(doneRow('BUILD_MANIFEST')));

    const recordingPathOf = (trackId: VideoTrackId): string => join(packageDir, cameraFileName(trackId));
    const sealingNameOf = (trackId: VideoTrackId): string => `${cameraFileName(trackId)}.seal.part`;

    // ── CLOSE_TRACKS ────────────────────────────────────────────────────────────────────────────
    //
    // THE CORE SEALS HERE (ruling D147). The worker's recording file is validated and read; the
    // sealed camera file is WRITTEN: the init segment clear, then each whole fragment (`moof` +
    // `mdat`) as one AES-256-GCM message at the same offset. The recording file is not changed by
    // this step: it is removed by the last step, after the item is committed. A run that was
    // stopped inside this step starts both sealed files again (new IVs: nothing was checkpointed).
    //
    // ONE OR TWO CAMERA FILES (fix pass F-M7; decision D178). A camera that never recorded - no
    // recording file and no fragment row - has no track in the seal (R88-01: a one-camera session
    // is valid and is sealed). A failure CONFINED to one camera file leaves that file out, is said
    // in the persistent log and the checkpoint, and makes the seal an INTERRUPTED one (R88-02 (b));
    // the file is moved to the quarantine by the last step. The step fails only when NO camera
    // file validates (`NOTHING_SEALABLE`).
    async function closeTracks(): Promise<StepCheckpoint> {
      const tracks: ClosedTrack[] = [];
      const files: ManifestFile[] = [];
      const omitted: OmittedTrack[] = [];
      const total = VIDEO_TRACK_IDS.length;
      const progress = progressOf('CLOSE_TRACKS', () => null);
      await ensureDirectory(fragmentsDir);
      for (const trackId of VIDEO_TRACK_IDS) {
        const fileName = cameraFileName(trackId);
        // The `.part` names the WORKER left beside its recording: a second name of the file is only
        // a name; a file of its own was never evidence and is moved out, its bytes kept (pair-58 R-5).
        const names = await cameraFileNames(packageDir, fileName);
        let partNamesRemoved = 0;
        let orphansMoved = 0;
        for (const verdict of classifyPartNames(names.file, names.parts)) {
          if (verdict.nameMayBeRemoved) {
            await removeName(packageDir, verdict.name);
            partNamesRemoved += 1;
          } else {
            await moveOut(packageDir, verdict.name, join(stagingDir, SEALING_ORPHANS_DIR));
            orphansMoved += 1;
            ports.log.append({ level: 'warn', source: SOURCE, message: 'a part file of a dead worker was moved out of the package folder', code: 'SEALING_ORPHAN_PART_MOVED', context: { sessionId, trackId } });
          }
        }
        // What an earlier run of THIS step left of the sealed file is started again from the beginning.
        await removeIfThere(fragmentsDir, sealingNameOf(trackId));
        await removeIfThere(fragmentsDir, fileName);

        const recorded = await ports.fragments.read(sessionId, trackId);
        const file = await openCameraFile(recordingPathOf(trackId));
        if (file === null && recorded.length === 0) {
          // THE CAMERA NEVER RECORDED (D72(k)): no file, no row. Not a failure and not an interruption.
          omitted.push({ trackId, code: null, reason: 'NOT_RECORDED' });
          ports.log.append({ level: 'warn', source: SOURCE, message: 'a camera of the session recorded nothing: the session is sealed without its file', code: 'SEALING_CAMERA_NOT_RECORDED', context: { sessionId, trackId } });
          continue;
        }
        try {
          if (file === null) throw new SealingError(SealingFailure.CAMERA_FILE_UNUSABLE, 'a recording file of the session is not there', { trackId, reason: 'MISSING' });
        try {
          // The worker wrote plaintext: the rows hold the digests and the chain of exactly these bytes.
          const checkpoints: RecordedCheckpoint[] = recorded.map((row) => ({ index: row.seq, start: row.byteOffset, len: row.byteLength, fragSha256: row.sha256, chainSha256: row.chainHash, prefixSha256: null }));
          const validation = await validateCameraFile(file.source, nodeSha256, checkpoints);
          const has = (flag: CameraFileFlag): boolean => validation.flags.includes(flag);
          const walk = validation.walk;
          if (has(CameraFileFlag.NO_INIT_SEGMENT) || has(CameraFileFlag.NO_WHOLE_FRAGMENT)) {
            throw new SealingError(SealingFailure.CAMERA_FILE_UNUSABLE, 'a recording file holds no whole fragment', { trackId, reason: has(CameraFileFlag.NO_INIT_SEGMENT) ? 'NO_INIT_SEGMENT' : 'NO_WHOLE_FRAGMENT' });
          }
          // WHAT ENDS THE DURABLE PREFIX (ruling D183): a recorded value that is not what the bytes
          // give, or durable bytes that are gone. Not thrown here: the fragments BEFORE the first bad
          // one are sealed when they validate (the loop below); only a file with none is left out.
          let prefixEnd: SealingError | null = null;
          if (has(CameraFileFlag.CHECKPOINT_MISMATCH) || has(CameraFileFlag.RECORDS_NOT_CONTIGUOUS)) {
            const mismatch = validation.comparison?.firstMismatch ?? null;
            prefixEnd = new SealingError(SealingFailure.FRAGMENT_MISMATCH, 'a recorded fragment is not what the bytes of the recording file give', { trackId, seq: mismatch?.index ?? null, member: mismatch?.member ?? 'seq' });
          } else if (has(CameraFileFlag.FILE_SHORTER_THAN_RECORDS)) {
            prefixEnd = new SealingError(SealingFailure.DURABLE_BYTES_MISSING, 'bytes that were recorded as durable are not in the recording file', { trackId, missing: validation.comparison?.missing.length ?? 0 });
          }
          let whole = walk.fragments;
          let tailReason: string | null = has(CameraFileFlag.TORN_TAIL) ? (walk.tail?.reason ?? 'TORN_TAIL') : null;
          let rowsAdded = 0;
          if (has(CameraFileFlag.FRAGMENTS_BEYOND_RECORDS)) {
            // Whole fragments the worker wrote and the recorder never stored (the Core died between
            // the write and the row, or the recorder is behind): their rows are rebuilt from the
            // validated bytes - as far as the walk reads their media time; from the first one it
            // cannot read, the rest is left out like a torn tail.
            const beyond = validation.comparison?.unrecorded ?? [];
            const unusable = beyond.findIndex((fragment) => fragment.media === null);
            const add = unusable === -1 ? beyond : beyond.slice(0, unusable);
            if (add.length > 0) {
              const at = ports.now();
              rowsAdded = (await ports.fragments.insertMissing(add.map((fragment) => ({ sessionId, trackId, seq: fragment.index, byteOffset: fragment.start, byteLength: fragment.len, mediaStartMs: fragment.media!.mediaStartMs, mediaDurationMs: fragment.media!.mediaDurationMs, sha256: fragment.fragSha256, chainHash: fragment.chainSha256, durableAt: at })))).inserted;
            }
            if (unusable !== -1) {
              whole = walk.fragments.slice(0, recorded.length + add.length);
              tailReason = 'FRAGMENT_WITHOUT_MEDIA_TIME';
            }
          }
          const rows = new Map((await ports.fragments.read(sessionId, trackId)).map((row) => [row.seq, row] as const));
          // THE DURABLE PREFIX THAT VALIDATES (ruling D183; fix pass F-M7b). Fragment by fragment, in
          // order: its number follows the one before, its row is there, and the row's offset, length,
          // digest AND recording-time chain are what the box walk made of the bytes; and it is no
          // larger than the verifier can open (row 82c, F-86-1: THE PIPELINE NEVER PRODUCES A PACKAGE
          // ITS OWN VERIFIER REFUSES). The first fragment that fails ends the prefix: nothing from it
          // on is sealed. A file whose FIRST fragment fails has no valid fragment and is left out.
          let valid = 0;
          for (const fragment of whole) {
            const row = rows.get(fragment.index);
            if (fragment.index !== valid + 1 || row === undefined || row.byteOffset !== fragment.start || row.byteLength !== fragment.len || row.sha256 !== fragment.fragSha256 || row.chainHash !== fragment.chainSha256) {
              // The comparison of the validation named the fragment and the member when it found this one; otherwise it is named here.
              if (prefixEnd === null || prefixEnd.code !== SealingFailure.FRAGMENT_MISMATCH || prefixEnd.detail.seq !== fragment.index) {
                prefixEnd = new SealingError(SealingFailure.FRAGMENT_MISMATCH, 'a recorded fragment is not what the bytes of the recording file give', { trackId, seq: fragment.index, member: row !== undefined && row.sha256 === fragment.fragSha256 ? 'chainHash' : 'sha256' });
              }
              break;
            }
            if (fragment.len > maxFragmentBytes) {
              prefixEnd = new SealingError(SealingFailure.FRAGMENT_TOO_LARGE, 'a fragment of the recording is larger than the Core can verify', { trackId, seq: fragment.index, bytes: fragment.len, limitBytes: maxFragmentBytes });
              break;
            }
            valid += 1;
          }
          // No fragment validates: THIS file is left out (the catch below), named by what ended it.
          if (prefixEnd !== null && valid === 0) throw prefixEnd;
          let partial: ClosedTrack['partial'];
          if (prefixEnd !== null) {
            whole = whole.slice(0, valid);
            tailReason = prefixEnd.code;
            partial = { code: prefixEnd.code, reason: prefixEnd.code, firstBadSeq: valid + 1 };
            ports.log.append({ level: 'error', source: SOURCE, message: 'a camera file of the session failed validation part-way: its durable prefix is sealed as an interrupted recording, and the whole original file goes to the quarantine', ...describeError(prefixEnd), code: 'SEALING_CAMERA_PREFIX_SEALED', context: { sessionId, attempt, ...prefixEnd.detail, trackId, failure: prefixEnd.code, firstBadSeq: valid + 1, sealedFragments: valid } });
          }
          const last = whole[whole.length - 1];
          if (last === undefined) throw new SealingError(SealingFailure.CAMERA_FILE_UNUSABLE, 'a recording file holds no whole fragment', { trackId, reason: 'NO_WHOLE_FRAGMENT' });
          const durableLength = last.start + last.len;
          const droppedBytes = walk.fileLength - durableLength;

          // The sealed file, under a name of its own until it is whole and synced.
          const out = await createExclusive(join(fragmentsDir, sealingNameOf(trackId)));
          const storedWhole = nodeSha256();
          const plainWhole = nodeSha256();
          const fragments: ManifestFragment[] = [];
          let chain = FRAGMENT_CHAIN_GENESIS;
          try {
            const first = whole[0] as (typeof whole)[number];
            for (let at = 0; at < first.start; at += chunkBytes) {
              const clear = await file.source.read(at, Math.min(chunkBytes, first.start - at));
              storedWhole.update(clear);
              plainWhole.update(clear);
              await out.write(clear);
            }
            for (const [index, fragment] of whole.entries()) {
              const row = rows.get(fragment.index);
              // Every sealed fragment has its row: the recording-time record of exactly these bytes.
              if (row === undefined || row.byteOffset !== fragment.start || row.byteLength !== fragment.len || row.sha256 !== fragment.fragSha256) {
                throw new SealingError(SealingFailure.FRAGMENT_MISMATCH, 'a recorded fragment is not what the bytes of the recording file give', { trackId, seq: fragment.index, member: 'sha256' });
              }
              if (fragment.media === null) throw new SealingError(SealingFailure.CAMERA_FILE_UNUSABLE, 'a fragment whose boxes do not say whether it starts on a keyframe', { trackId, reason: 'NO_MEDIA_TIME' });
              const plain = await file.source.read(fragment.start, fragment.len);
              const again = nodeSha256();
              again.update(plain);
              if (plain.byteLength !== fragment.len || hexOf(again.digest()) !== row.sha256) throw new SealingError(SealingFailure.CAMERA_FILE_CHANGED, 'the recording file changed while it was sealed', { trackId, seq: fragment.index });
              let sealed;
              try {
                sealed = await ports.sealer.seal(sessionId, { trackId, seq: fragment.index, byteOffset: fragment.start }, plain);
              } catch (error) {
                // G75b-01: the CAUSE goes with the failure, as a closed code read from the code of what the sealer threw.
                const cause = sealerCauseOf(error);
                throw new SealingError(SealingFailure.SEALER_FAILED, 'a fragment could not be sealed with the session key', { trackId, seq: fragment.index, ...(cause === null ? {} : { cause }) }, error);
              }
              if (sealed.ciphertext.byteLength !== fragment.len) throw new SealingError(SealingFailure.SEALER_FAILED, 'a sealed fragment has another length than its plaintext', { trackId, seq: fragment.index });
              const one = nodeSha256();
              one.update(sealed.ciphertext);
              const storedSha = hexOf(one.digest());
              chain = nextFragmentChainHash(chain, storedSha);
              storedWhole.update(sealed.ciphertext);
              plainWhole.update(plain);
              await out.write(sealed.ciphertext);
              fragments.push({
                seq: fragment.index,
                byteOffset: fragment.start,
                byteLength: fragment.len,
                mediaStartMs: row.mediaStartMs,
                mediaDurationMs: row.mediaDurationMs,
                // The STORED bytes are the sealed ones: their digest, chain and prefix are made here.
                sha256: storedSha,
                // The recording-time digest of the worker's bytes is the PLAINTEXT digest.
                sha256Plain: row.sha256,
                chainHash: chain,
                prefixSha256: hexOf(storedWhole.copy().digest()),
                keyframe: fragment.media.keyframe,
                // ev §E.4: the durable set of an interrupted seal says so on every fragment (set
                // below, once both files are known); the fragment after which bytes were left out
                // says `truncated`.
                interrupted: false,
                truncated: (droppedBytes > 0 || partial !== undefined) && index === whole.length - 1,
                gcmIv: sealed.gcmIv,
                gcmTag: sealed.gcmTag,
                keyId: sealed.keyId,
                durableAt: row.durableAt,
              });
              await progress((tracks.length + (fragment.start + fragment.len) / durableLength) / total, `${fragments.length} of ${whole.length} fragments sealed (${trackId})`);
            }
            await out.sync();
          } finally {
            await out.close();
          }
          await renameWithin(fragmentsDir, sealingNameOf(trackId), fileName);
          if (droppedBytes > 0) {
            // THE DROP-FRAGMENT RULE (ev §E.4; AU2-08): `[durableLength, end)` of the recording is no
            // whole fragment. It is not sealed, and it is SAID: checkpoint, session record, log, manifest.
            droppedTails.push({ trackId, droppedBytes });
            ports.log.append({ level: 'warn', source: SOURCE, message: 'the tail of a recording file was no whole fragment and was left out of the sealed file', code: 'SEALING_TORN_TAIL_DROPPED', context: { sessionId, trackId, droppedBytes, reason: tailReason } });
          }
          const lastSealed = fragments[fragments.length - 1] as ManifestFragment;
          files.push({ trackId, fragments });
          tracks.push({
            trackId,
            bytes: durableLength,
            fragments: fragments.length,
            droppedBytes,
            tailReason,
            rowsAdded,
            partNamesRemoved,
            orphansMoved,
            hashes: { trackId, bytes: durableLength, sha256: hexOf(storedWhole.digest()), sha256Plain: hexOf(plainWhole.digest()), fragmentChainHead: chain, fragmentCount: fragments.length, mediaEndMs: lastSealed.mediaStartMs + lastSealed.mediaDurationMs },
            ...(partial === undefined ? {} : { partial }),
          });
        } finally {
          await file.close();
        }
        } catch (error) {
          if (!(error instanceof SealingError) || !CONFINED_TO_ONE_CAMERA_FILE.includes(error.code)) throw error;
          // CONFINED TO THIS CAMERA FILE (R88-02 (b)): nothing of it is left in the package as if it were sealed.
          await removeIfThere(fragmentsDir, sealingNameOf(trackId));
          await removeIfThere(fragmentsDir, fileName);
          const reason = error.code === SealingFailure.CAMERA_FILE_UNUSABLE && typeof error.detail.reason === 'string' ? error.detail.reason : error.code;
          omitted.push({ trackId, code: error.code, reason });
          ports.log.append({ level: 'error', source: SOURCE, message: 'a camera file of the session could not be sealed and is left out of the package: what validates is sealed as an interrupted recording', ...describeError(error), code: 'SEALING_CAMERA_LEFT_OUT', context: { sessionId, attempt, ...error.detail, trackId, reason, failure: error.code } });
        }
      }
      if (tracks.length === 0) {
        // NOTHING VALIDATES (R88-02 (c)): no sealed byte is left, nothing is signed, every recording stays where it is.
        throw new SealingError(SealingFailure.NOTHING_SEALABLE, 'no camera file of the session can be sealed', { reasons: omitted.map((entry) => `${entry.trackId}:${entry.reason}`).join(',') });
      }
      // A left-out tail - or a camera file left out for a failure - makes the seal an interrupted
      // one, whatever the cause it was asked with: a recording that lost bytes is never sealed as whole.
      const interrupted = cause === 'INTERRUPTED' || tracks.some((track) => track.droppedBytes > 0 || track.partial !== undefined) || omitted.some((entry) => entry.code !== null);
      // C3 (wave H driver A; D199, D202): a camera that was given up while the session went on left a file that ends early.
      // Its fragment records say `interrupted: true` (field 73) whatever the session's own end was; the cause is in the CLOSE_TRACKS record.
      const endedEarly = new Set(((facts as SealSessionFacts).cameraEnds ?? []).map((end) => end.trackId));
      const marked = files.map((entry) => ({ trackId: entry.trackId, fragments: entry.fragments.map((fragment) => ({ ...fragment, interrupted: interrupted || endedEarly.has(entry.trackId) })) }));
      // THE DURABLE HOME OF THE CIPHER RECORDS (ev §A.3; ruling D147): `fragments.json`, the exact
      // serialization of the manifest's `files[]` (SEC35-11), written before the step's checkpoint.
      await writer.write(PackageFile.FRAGMENTS_JSON, serializeFragmentsJson(marked));
      await syncDirectory(fragmentsDir);
      closed = { interrupted, tracks, omitted };
      return closed as unknown as StepCheckpoint;
    }

    // ── FINALIZE_HASHES ─────────────────────────────────────────────────────────────────────────
    //
    // The sealed files read AGAIN, by code that shares nothing with the writer above but the
    // records: what CLOSE_TRACKS says it wrote is what the disk holds, and what it holds opens to
    // the bytes the worker recorded.
    async function finalizeHashes(): Promise<StepCheckpoint> {
      const before = closedNow();
      const progress = progressOf('FINALIZE_HASHES', () => null);
      const total = before.tracks.reduce((sum, track) => sum + track.bytes, 0);
      const text = await writer.read(PackageFile.FRAGMENTS_JSON);
      if (text === null) throw new SealingError(SealingFailure.FRAGMENT_NOT_SEALED, 'the fragment table of the package is not there', {});
      const table = parseFragmentsJson(Buffer.from(text).toString('utf8')).files as ManifestFile[];
      if (ports.opener === null) throw new SealingError(SealingFailure.FRAGMENT_NOT_OPENABLE, 'the Core holds no session key', {});
      const tracks: HashedTrack[] = [];
      // The camera files CLOSE_TRACKS sealed: one or two (F-M7 R88-01).
      for (const { trackId } of before.tracks) {
        const was = before.tracks.find((track) => track.trackId === trackId);
        const records = table.find((entry) => entry.trackId === trackId)?.fragments;
        const file = await openCameraFile(pathOf(trackId));
        if (file === null || was === undefined) throw new SealingError(SealingFailure.CAMERA_FILE_UNUSABLE, 'a sealed camera file of the session is not there', { trackId, reason: 'MISSING' });
        try {
          if (file.source.size !== was.bytes) throw new SealingError(SealingFailure.CAMERA_FILE_CHANGED, 'a sealed camera file is not as long as it was written', { trackId });
          if (records === undefined || records.length !== was.fragments) throw new SealingError(SealingFailure.FRAGMENT_NOT_SEALED, 'the fragment table does not hold the fragments of the camera file', { trackId });
          const rows = new Map((await ports.fragments.read(sessionId, trackId)).map((row) => [row.seq, row] as const));
          if (!(await ports.opener.hasKey(records[0]?.keyId ?? ''))) throw new SealingError(SealingFailure.FRAGMENT_NOT_OPENABLE, 'the session key is not in the credential store', { trackId });
          const whole = nodeSha256();
          const plainWhole = nodeSha256();
          const clear = async (from: number, until: number): Promise<void> => {
            for (let at = from; at < until; at += chunkBytes) {
              const bytes = await file.source.read(at, Math.min(chunkBytes, until - at));
              if (bytes.byteLength === 0) throw new SealingError(SealingFailure.CAMERA_FILE_CHANGED, 'a sealed camera file ended while it was hashed', { trackId });
              whole.update(bytes);
              plainWhole.update(bytes);
            }
          };
          let cursor = 0;
          let chain = FRAGMENT_CHAIN_GENESIS;
          for (const [index, record] of records.entries()) {
            const seq = record.seq;
            const mismatch = (member: string): SealingError => new SealingError(SealingFailure.FRAGMENT_MISMATCH, 'a sealed fragment is not what its record says', { trackId, seq, member });
            const row = rows.get(seq);
            if (seq !== index + 1 || row === undefined || record.byteOffset !== row.byteOffset || record.byteLength !== row.byteLength || record.byteOffset < cursor || record.byteOffset + record.byteLength > was.bytes) throw mismatch('byteOffset');
            await clear(cursor, record.byteOffset);
            const stored = await file.source.read(record.byteOffset, record.byteLength);
            if (stored.byteLength !== record.byteLength) throw new SealingError(SealingFailure.DURABLE_BYTES_MISSING, 'bytes of a sealed fragment are not in the camera file', { trackId, seq });
            const one = nodeSha256();
            one.update(stored);
            const storedSha = hexOf(one.digest());
            if (storedSha !== record.sha256) throw mismatch('sha256');
            chain = nextFragmentChainHash(chain, storedSha);
            if (chain !== record.chainHash) throw mismatch('chainHash');
            whole.update(stored);
            if (hexOf(whole.copy().digest()) !== record.prefixSha256) throw mismatch('prefixSha256');
            let plain: Uint8Array;
            try {
              plain = await ports.opener.open({ trackId, seq, byteOffset: record.byteOffset, byteLength: record.byteLength, gcmIv: record.gcmIv, gcmTag: record.gcmTag, keyId: record.keyId }, stored);
            } catch (error) {
              throw new SealingError(SealingFailure.FRAGMENT_NOT_OPENABLE, 'a sealed range of the camera file does not open', { trackId, seq }, error);
            }
            const plainOne = nodeSha256();
            plainOne.update(plain);
            const plainSha = hexOf(plainOne.digest());
            // What opens is what the worker recorded: the recording-time digest of the row.
            if (plain.byteLength !== record.byteLength || plainSha !== row.sha256 || plainSha !== record.sha256Plain) throw mismatch('sha256Plain');
            plainWhole.update(plain);
            cursor = record.byteOffset + record.byteLength;
            await progress(total === 0 ? 0 : Math.min(1, (tracks.reduce((sum, track) => sum + track.bytes, 0) + cursor) / total), `${index + 1} of ${records.length} fragments (${trackId})`);
          }
          await clear(cursor, was.bytes);
          const lastRecord = records[records.length - 1] as ManifestFragment;
          const found: HashedTrack = { trackId, bytes: was.bytes, sha256: hexOf(whole.digest()), sha256Plain: hexOf(plainWhole.digest()), fragmentChainHead: chain, fragmentCount: records.length, mediaEndMs: lastRecord.mediaStartMs + lastRecord.mediaDurationMs };
          for (const member of ['sha256', 'sha256Plain', 'fragmentChainHead'] as const) {
            if (found[member] !== was.hashes[member]) throw new SealingError(SealingFailure.FRAGMENT_MISMATCH, 'a sealed camera file is not what was written', { trackId, seq: null, member });
          }
          tracks.push(found);
        } finally {
          await file.close();
        }
      }
      hashed = { tracks };
      return hashed as unknown as StepCheckpoint;
    }

    // ── FINALIZE_TRANSCRIPT ─────────────────────────────────────────────────────────────────────
    async function finalizeTranscript(): Promise<Extract<FinalizeTranscriptResult, { status: 'DONE' }>> {
      const state = states.get('FINALIZE_TRANSCRIPT') as StepState;
      let failures = 0;
      for (;;) {
        let answer: FinalizeTranscriptResult;
        try {
          answer = await ports.transcript.finalize({ sessionId, sttSnapshot: facts!.sttSnapshot, attempt, ...(facts!.backendUnreachable === undefined ? {} : { backendUnreachable: facts!.backendUnreachable }) });
        } catch (error) {
          if (!(error instanceof FinalizeTranscriptError)) throw error;
          failures += 1;
          // The step counts its own failures at its bound and seals without a document after them
          // (row 119): asking again is how that state is reached. A run gives up after a few.
          if (failures > TRANSCRIPT_RETRIES_PER_RUN) throw new SealingError(SealingFailure.TRANSCRIPT_STEP_FAILED, 'the transcript step failed', { transcriptCode: error.code, failures }, error);
          continue;
        }
        if (answer.status === 'DONE') return answer;
        state.status = 'RUNNING';
        state.progress = Math.max(state.progress, Math.min(99, answer.progress));
        // NO ETA FOR THIS STEP (fix wave K, driver S1; re-gate 75 finding G75c-05). The value written here was
        // `answer.remainingWaitMs`: what is left of the BOUND of the wait (the longest the step waits before it
        // closes the transcript out; D223, row 116) - about 28 minutes at the start of a step that takes seconds.
        // That is a limit, not an estimate, and the Core has no sound basis for one: the number of chunks still
        // grows while the audio is planned, and a time derived from the rate of the engine would be a speed figure
        // of the STT (D230). A fact the Core does not have is absent: the member is null and the sentence
        // "n of m chunks" is what the operator reads. The bound still paces the poll below.
        state.etaMs = null;
        state.detail = `${answer.counters.chunksDone} of ${answer.counters.chunksTotal} chunks`;
        await tell();
        await new Promise<void>((resolve) => void ports.timer.after(Math.max(1, Math.min(TRANSCRIPT_POLL_MS, answer.remainingWaitMs)), resolve));
      }
    }
    const transcriptNow = async (): Promise<Extract<FinalizeTranscriptResult, { status: 'DONE' }>> => (transcript ??= await finalizeTranscript());

    /**
     * `endedTracks` of the signed CLOSE_TRACKS record (C3): `VIDEO-02:CAMERA_CLOCK_OUT_OF_BOUND`, one per camera that was
     * given up while the session went on, in track order, joined by a comma. Absent when none: the record is as before.
     */
    const endedTracksOf = (ends: SealSessionFacts['cameraEnds']): { endedTracks?: string } => {
      const named = [...(ends ?? [])].filter((end) => /^VIDEO-0[12]$/.test(end.trackId) && /^[A-Z][A-Z0-9_]{1,63}$/.test(end.reason)).sort((a, b) => a.trackId.localeCompare(b.trackId));
      return named.length === 0 ? {} : { endedTracks: named.map((end) => `${end.trackId}:${end.reason}`).join(',') };
    };

    // ── BUILD_MANIFEST and SIGN_MANIFEST ────────────────────────────────────────────────────────
    function manifestSteps(done: Extract<FinalizeTranscriptResult, { status: 'DONE' }>): ManifestStep[] {
      const entry = (step: SealingStepId, checkpoint: Record<string, string | number | boolean | null>): ManifestStep => {
        const row = rows.get(step);
        if (row === null || row === undefined) throw journalInvalid(step);
        return { step, status: 'DONE', progress: 100, etaMs: 0, attempt: row.attempt, checkpoint, completedAt: row.updatedAt };
      };
      const closedTracks = closedNow();
      const hashedTracks = hashedNow();
      return [
        // `absentTracks` (F-M7 R88-01): the camera(s) of the session that are not in this package, stated under the
        // signature by this existing member (no new manifest field). Absent for a two-camera seal: its record is as before.
        entry('CLOSE_TRACKS', { tracks: closedTracks.tracks.length, truncatedTails: closedTracks.tracks.filter((track) => track.droppedBytes > 0 || track.partial !== undefined).length, interrupted: closedTracks.interrupted, ...((closedTracks.omitted ?? []).length > 0 ? { absentTracks: (closedTracks.omitted ?? []).map((entry) => entry.trackId).join(',') } : {}), ...endedTracksOf(facts!.cameraEnds) }),
        entry('FINALIZE_HASHES', { files: hashedTracks.tracks.length, fragments: hashedTracks.tracks.reduce((sum, track) => sum + track.fragmentCount, 0) }),
        entry('FINALIZE_TRANSCRIPT', { state: done.transcript.manifest.state, failedChunks: done.transcript.manifest.failedChunks }),
      ];
    }

    /** The fragment table of the package: the manifest's `files[]`, read from `fragments.json` every time. */
    async function fragmentTable(): Promise<ManifestFile[]> {
      const text = await writer.read(PackageFile.FRAGMENTS_JSON);
      if (text === null) throw new SealingError(SealingFailure.STORAGE_FAILED, 'the fragment table of the package is not there', {});
      return parseFragmentsJson(Buffer.from(text).toString('utf8')).files as ManifestFile[];
    }

    /**
     * THE MANIFEST OF A BUILD. From the SNAPSHOT of the checkpoint when it holds one (R88-03): the
     * same input, the same source rows, the fragment table of the package - so a resumed build has
     * the digest of the first one whatever the Core's state is now. Otherwise from the session
     * record as it is (the first build, which then freezes it).
     */
    async function assemble(frozen: FrozenBuild): Promise<UnsignedManifestV2> {
      if (frozen.input !== undefined && frozen.sourceRows !== undefined) {
        return buildUnsignedManifest({ ...frozen.input, files: await fragmentTable() } as ManifestV2Input, frozen.sourceRows);
      }
      const live = await liveInput(frozen);
      return buildUnsignedManifest(live.input, live.sourceRows);
    }

    /** The manifest input from the session record as it is NOW. Called once per seal (the first BUILD_MANIFEST). */
    async function liveInput(frozen: Pick<FrozenBuild, 'sealedAt' | 'signedAt' | 'steps'>): Promise<{ input: ManifestV2Input; sourceRows: readonly SessionCaptureSourceRow[] }> {
      const session = facts as SealSessionFacts;
      const closedTracks = closedNow();
      const hashedTracks = hashedNow();
      const done = await transcriptNow();
      const files = await fragmentTable();
      const mediaEndMs = Math.max(...hashedTracks.tracks.map((track) => track.mediaEndMs));
      const interrupted = closedTracks.interrupted;
      // The camera files of THIS package: one or two (F-M7 R88-01).
      const sealedIds = closedTracks.tracks.map((track) => track.trackId);
      // Where the sealed media ends on the Core clock: the operator's stop, or - for a durable
      // prefix - the end of the last durable fragment counted from the start of the recording.
      const durableEndMs = !interrupted && session.stoppedAt !== null ? session.stoppedAt : session.startedAt + mediaEndMs;
      const intervals = session.audioIntervals.map((interval, index, all) => (interval.toMs === null && index === all.length - 1 ? { ...interval, toMs: Math.max(interval.fromMs, mediaEndMs) } : interval));
      // Task 4 row 191c (C73, C83): fields 129-132, the manifest's ONE optional member. The records are the session's
      // own (its reader states them from what the session stored); a session without a restart hands none, and then
      // NO KEY is written - an empty list is refused by the manifest and "none" has one form and one digest.
      const restartGaps = (session.audioRestartGaps ?? []).map((gap) => ({ earlierAttempt: gap.earlierAttempt, laterAttempt: gap.laterAttempt, absentAtLeastMs: gap.absentAtLeastMs, absentAtMostMs: gap.absentAtMostMs }));
      const input: ManifestV2Input = {
        schema: MANIFEST_V2_SCHEMA_ID,
        evidenceId: session.evidenceId,
        sessionId,
        caseNumber: session.caseNumber,
        manifestVersion: MANIFEST_V2_VERSION,
        // A package of the demo dataset says so (ev §B.12 rule 6); everything the Core recorded is REAL.
        integrity: session.demoPackage === true ? 'DEMO_PACKAGE' : 'REAL',
        demo: session.demoPackage === true,
        notice: session.notice,
        timeline: {
          timezone: session.timezone,
          createdAt: session.createdAt,
          startedAt: session.startedAt,
          stoppedAt: interrupted ? null : session.stoppedAt,
          sealedAt: frozen.sealedAt,
          recordingDurationMs: Math.max(0, durableEndMs - session.startedAt),
          interrupted,
          durableEndMs,
          timeSource: session.timeSource,
        },
        device: { ...session.device, certificate: deviceCertificateBlock(ports.signing.certificate) },
        operator: session.operator,
        subject: session.subject,
        tracks: sealedIds.map((trackId) => {
          const hashedTrack = hashedTracks.tracks.find((track) => track.trackId === trackId) as HashedTrack;
          // Task 4 row R1b (C99): fields 134-138, the manifest's third optional member. The records are the session's own (its
          // reader states them from the audit entries the session stored), each copied to its five keys. A track whose camera
          // was not lost hands none, and then NO KEY is written: the track record is the one of before, byte for byte.
          const { absentInSession: absences, ...facts } = session.tracks[VIDEO_TRACK_IDS.indexOf(trackId)] as SealSessionFacts['tracks'][number];
          const absentInSession = (absences ?? []).map((absence) => ({ attempt: absence.attempt, loss: absence.loss, absentAtLeastMs: absence.absentAtLeastMs, absentAtMostMs: absence.absentAtMostMs, ended: absence.ended }));
          return {
            ...facts,
            ...(absentInSession.length > 0 ? { absentInSession } : {}),
            trackId,
            file: cameraFileName(trackId),
            mediaType: CAMERA_FILE_MEDIA_TYPE,
            bytes: hashedTrack.bytes,
            durationMs: hashedTrack.mediaEndMs,
            sha256: hashedTrack.sha256,
            sha256Plain: hashedTrack.sha256Plain,
            fragmentChainHead: hashedTrack.fragmentChainHead,
            fragmentCount: hashedTrack.fragmentCount,
            // Field 50 is what the bytes say: every sealed fragment of the file starts on a keyframe (the box walk of CLOSE_TRACKS).
            keyframeAligned: (files.find((entry) => entry.trackId === trackId)?.fragments ?? []).every((fragment) => fragment.keyframe),
          };
        }),
        audio: { trackId: SESSION_AUDIO_TRACK_ID, codec: session.audioCodec, containsIn: [...sealedIds], sourceIntervals: intervals, ...(restartGaps.length > 0 ? { absentOnRestart: restartGaps } : {}) },
        files,
        transcript: done.transcript.manifest,
        sealing: { steps: [...frozen.steps] },
        // Task 4 row P1 (U21 (2)): field 133, the manifest's second optional member. Stated only when the session's facts hand it in
        // (a production Core on a platform where its host profile is not asked); otherwise NO KEY is written and the manifest is the
        // one of before. Copied to its one key; frozen with the rest of this input, so a resumed build signs the same statement.
        ...(session.hostProfileNotAsked === undefined ? {} : { hostProfileNotAsked: { platform: session.hostProfileNotAsked.platform } }),
        signature: {
          algorithm: ports.signing.signer.algorithm as ManifestV2Input['signature']['algorithm'],
          keyId: ports.signing.signer.keyId,
          simulated: false,
          file: PackageFile.SIGNATURE,
          covers: MANIFEST_SIGNATURE_COVERS,
          certificate: { file: PackageFile.CERTIFICATE, sha256: ports.signing.certificate.sha256 },
          signedAt: frozen.signedAt,
        },
      };
      // The source classes and field 126 are computed by the builder from the four session-start
      // rows; an unknown kind or a missing row throws before a digest exists (ev §E.6).
      return { input, sourceRows: session.sourceRows.map((row) => ({ slot: row.slot, deviceId: row.deviceId, adapterKind: row.adapterKind })) };
    }

    async function buildManifest(): Promise<StepCheckpoint> {
      const done = await transcriptNow();
      // FROZEN BEFORE THE FIRST BUILD: a resumed build reads these from the row and forms the same body.
      let frozen = frozenOf(rows.get('BUILD_MANIFEST') ?? null);
      if (frozen === null || frozen.input === undefined || frozen.sourceRows === undefined) {
        // THE ONE READ OF LIVE STATE (R88-03): the instants, the step list AND the whole input of the
        // manifest are written into the RUNNING row before the first digest exists.
        const at = ports.now();
        const times = frozen ?? { sealedAt: at, signedAt: at, steps: manifestSteps(done) };
        const live = await liveInput(times);
        const { files: _files, ...input } = live.input;
        // Through JSON, as the journal stores it: what a resumed build reads back is exactly this value.
        frozen = JSON.parse(JSON.stringify({ sealedAt: times.sealedAt, signedAt: times.signedAt, steps: times.steps, input, sourceRows: live.sourceRows })) as FrozenBuild;
        await writeRow('BUILD_MANIFEST', 'RUNNING', 0, frozen as unknown as StepCheckpoint, null, null);
      }
      unsigned = await assemble(frozen);
      await writer.write(PackageFile.AUDIT_EXTRACT, (facts as SealSessionFacts).auditExtract);
      if (done.files !== null) {
        await writer.copyIn(PackageFile.TRANSCRIPT_JSON, done.files.json);
        await writer.copyIn(PackageFile.TRANSCRIPT_SRT, done.files.srt);
        await writer.copyIn(PackageFile.TRANSCRIPT_VTT, done.files.vtt);
        // The revision list exists exactly when a machine transcript is sealed; it starts empty
        // (`dems.transcript-revisions/1`, the format verify V-11 reads; decision D107 (4)).
        await writer.write(PackageFile.TRANSCRIPT_REVISIONS, canonicalJsonBytes({ schema: TRANSCRIPT_REVISIONS_SCHEMA_ID, evidenceId: unsigned.evidenceId, machineTranscriptSha256: unsigned.transcript.sha256, revisions: [] }));
      }
      built = { ...frozen, manifestSha256: unsigned.manifestSha256, developmentSources: unsigned.developmentSources, transcript: done.files !== null };
      return built as unknown as StepCheckpoint;
    }

    async function signManifestStep(): Promise<StepCheckpoint> {
      const was = builtNow();
      const again = unsigned ?? (await assemble(was));
      // The signer signs the digest the checkpoint holds, or nothing.
      if (again.manifestSha256 !== was.manifestSha256) throw new SealingError(SealingFailure.MANIFEST_NOT_REPRODUCIBLE, 'the rebuilt manifest does not have the digest of its checkpoint', {});
      // A DEVELOPMENT KEY NEVER SIGNS A PACKAGE OF PRODUCTION SOURCES (R88-08 (3)): field 126 false = every source is PRODUCTION.
      if (!again.developmentSources && isDevelopmentKeySubject(ports.signing.certificate.subject)) {
        throw new SealingError(SealingFailure.DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES, 'a development signing key does not sign a package of production sources', {});
      }
      const { manifest, detached } = await signManifest(ports.signing.signer, again, verifyEd25519);
      await writer.write(PackageFile.CERTIFICATE, Buffer.from(ports.signing.certificate.pemText, 'utf8'));
      await writer.write(PackageFile.SIGNATURE, serializeDetachedSignature(detached));
      await writer.write(PackageFile.MANIFEST, serializeManifest(manifest));
      return { manifestSha256: manifest.manifestSha256, keyId: manifest.signature.keyId, certificateSha256: manifest.signature.certificate.sha256, signature: manifest.signature.value };
    }

    // ── STORE_SEALED_PACKAGE ────────────────────────────────────────────────────────────────────
    async function storePackage(): Promise<StepCheckpoint> {
      const was = builtNow();
      const signedRow = rows.get('SIGN_MANIFEST');
      const signed = signedRow?.checkpoint;
      if (!isRecord(signed) || signed.manifestSha256 !== was.manifestSha256 || typeof signed.signature !== 'string' || typeof signed.keyId !== 'string') throw journalInvalid('SIGN_MANIFEST');
      const done = await transcriptNow();
      const hashedTracks = hashedNow();
      const closedTracks = closedNow();
      // The worker's recording files (plaintext) stay beside the sealed package until its item is
      // committed (ruling D147): a crash before that leaves them for the resumed run, never a
      // package without media. They are the one thing here the package does not declare.
      const recordings: string[] = VIDEO_TRACK_IDS.map((trackId) => cameraFileName(trackId));
      const sealedIds = closedTracks.tracks.map((track) => track.trackId);
      const present = (await listPackageFiles(packageDir)).filter((name) => !recordings.includes(name));
      let committed: 'SEALED' | 'ALREADY_SEALED';
      if (ports.engine.isSealed(sessionId, was.manifestSha256)) {
        // THE ITEM IS COMMITTED ALREADY (row 82c, F-86-2): the process ended after the commit and
        // before this step's DONE row. Nothing is committed again - no second item, no second audit
        // row - and the folder is not judged again (a sealed package may have gained an export or a
        // retained certificate since). What is left is the bookkeeping below.
        committed = 'ALREADY_SEALED';
      } else {
        // Nothing the package does not declare may be in its folder (verify V-14), and nothing it declares may be missing.
        const declared = new Set(declaredPackageFiles({ transcript: was.transcript, tracks: sealedIds }));
        const undeclared = present.filter((name) => !declared.has(name));
        const missing = [...declared].filter((name) => !present.includes(name));
        if (undeclared.length > 0) throw new SealingError(SealingFailure.PACKAGE_NOT_CLEAN, 'the package folder holds a file the package does not declare', { undeclared: undeclared.length });
        if (missing.length > 0) throw new SealingError(SealingFailure.STORAGE_FAILED, 'a file of the package is not in its folder', { missing: missing.length });
        for (const trackId of sealedIds) await syncFile(pathOf(trackId));
        for (const dir of [fragmentsDir, ...(was.transcript ? [join(packageDir, PackageFile.TRANSCRIPT_DIR)] : []), packageDir]) await syncDirectory(dir);
        await syncDirectory(join(packageDir, '..'));

        const session = facts as SealSessionFacts;
        const mediaEndMs = Math.max(...hashedTracks.tracks.map((track) => track.mediaEndMs));
        const input: CompleteSealInput = {
          sessionId,
          sealedAt: was.sealedAt,
          manifestSha256: was.manifestSha256,
          signature: { value: signed.signature, keyId: signed.keyId, algorithm: 'Ed25519' },
          tracks: hashedTracks.tracks.map((track) => ({ trackId: track.trackId, sizeBytes: track.bytes, sha256: track.sha256 })),
          interrupted: closedTracks.interrupted,
          durableEndAt: !closedTracks.interrupted && session.stoppedAt !== null ? session.stoppedAt : session.startedAt + mediaEndMs,
          transcriptSha256: done.transcript.itemColumns.transcriptSha256,
          labelsStatus: done.transcript.itemColumns.labelsStatus,
          developmentSources: was.developmentSources,
        };
        try {
          committed = await ports.engine.completeSeal(input, done.transcript);
        } catch (error) {
          // A process that ended inside the commit call (a test's stop) writes nothing more.
          if (error instanceof SealingStop) throw error;
          throw new SealingError(SealingFailure.ENGINE_REFUSED, 'the engine did not commit the sealed item', {}, error);
        }
      }
      // THE ITEM IS COMMITTED: what the seal left in plaintext is dealt with by ONE unit
      // (`sealed-plaintext.ts`; fix pass F-M7c, R88-05 + R88-15) - the original of a prefix-sealed
      // camera file and a left-out camera file MOVED to the quarantine, the recordings the signed
      // manifest accounts for REMOVED by proof, a file that fails the proof TOLD to the engine and
      // moved to the quarantine, the orphan part files removed. When this step does not run in the
      // attempt that hashed the sealed files (a resume, a finish at a start), the sealed files are
      // decrypted and compared again before a recording goes.
      const hashedAttempt = rows.get('FINALIZE_HASHES')?.attempt ?? null;
      const finished = await finishSealedPlaintext({
        sessionId,
        packageDir,
        stagingDir,
        quarantineDir: ports.quarantineDir(sessionId),
        manifestSha256: was.manifestSha256,
        closed: closedTracks,
        recheck: hashedAttempt === attempt ? null : { opener: ports.opener, fragments: ports.fragments },
        chunkBytes,
        log: ports.log,
        ...(ports.engine.noteKeptPlaintext === undefined ? {} : { noteKeptPlaintext: (note) => (ports.engine.noteKeptPlaintext as NonNullable<SealEngine['noteKeptPlaintext']>)(note) }),
      });
      return { manifestSha256: was.manifestSha256, files: present.length, committed, ...finished };
    }

    const work: Record<SealingStepId, () => Promise<StepCheckpoint | null>> = {
      CLOSE_TRACKS: closeTracks,
      FINALIZE_HASHES: finalizeHashes,
      // Row 79's step keeps its own row: it writes RUNNING, DONE and FAILED itself.
      FINALIZE_TRANSCRIPT: async () => {
        transcript = await finalizeTranscript();
        return null;
      },
      BUILD_MANIFEST: buildManifest,
      SIGN_MANIFEST: signManifestStep,
      STORE_SEALED_PACKAGE: storePackage,
    };

    // ── The run ─────────────────────────────────────────────────────────────────────────────────
    for (const step of SEALING_STEP_ORDER) {
      const state = states.get(step) as StepState;
      if (rows.get(step)?.status === 'DONE') {
        skipped.push(step);
        continue;
      }
      try {
        await hook(step, 'BEFORE');
        state.status = 'RUNNING';
        state.attempt = attempt;
        if (step !== 'FINALIZE_TRANSCRIPT') {
          // The frozen values of an earlier BUILD_MANIFEST stay in its row while it runs again.
          const kept = step === 'BUILD_MANIFEST' ? ((frozenOf(rows.get(step) ?? null) as unknown as StepCheckpoint | null) ?? null) : null;
          await writeRow(step, 'RUNNING', 0, kept, null, null);
        }
        await tell();
        const checkpoint = await work[step]();
        await hook(step, 'AFTER_WORK');
        if (step !== 'FINALIZE_TRANSCRIPT') await writeRow(step, 'DONE', 100, checkpoint, null, 0);
        rows.set(step, await ports.journal.read(sessionId, step));
        // A seal that goes on without a camera says so on its first step, in words an operator reads (F-M7).
        Object.assign(state, { status: 'DONE', progress: 100, etaMs: 0, detail: step === 'CLOSE_TRACKS' ? sealingOmittedNotice(closedNow().omitted ?? [], closedNow().tracks.flatMap((track) => (track.partial === undefined ? [] : [{ trackId: track.trackId, code: track.partial.reason, sealedFragments: track.fragments }]))) : null });
        // After the item is committed the session is SEALED: there is no finalization left to report.
        if (step !== 'STORE_SEALED_PACKAGE') await tell();
        await hook(step, 'AFTER_CHECKPOINT');
      } catch (error) {
        // A stopped process writes nothing more.
        if (error instanceof SealingStop) throw error;
        const failure = failureOf(error);
        const detail: SealingDetail = { ...failure.detail };
        ports.log.append({ level: 'error', source: SOURCE, message: 'a sealing step failed', ...describeError(failure.cause ?? failure), code: failure.code, context: { sessionId, step, attempt, ...detail } });
        // Best effort from here: the failure itself is already persisted.
        try {
          if (step !== 'FINALIZE_TRANSCRIPT') {
            const kept = step === 'BUILD_MANIFEST' ? ((frozenOf(await ports.journal.read(sessionId, step)) as unknown as StepCheckpoint | null) ?? null) : null;
            await ports.journal.write({ sessionId, step, status: 'FAILED', progress: state.progress, etaMs: null, attempt, checkpoint: kept, errorCode: failure.code, at: ports.now() });
          }
          // The session record says WHY in words an operator reads (operation 83, the Finalizing screen).
          Object.assign(state, { status: 'FAILED', etaMs: null, detail: sealingFailureReason(failure.code, detail) });
          await ports.engine.applySealingProgress({ sessionId, steps: SEALING_STEP_ORDER.map((id) => ({ id, ...(states.get(id) as StepState) })) });
        } catch (second) {
          ports.log.append({ level: 'error', source: SOURCE, message: 'the failure of a sealing step could not be recorded in its row or told to the engine', ...describeError(second), context: { sessionId, step, attempt } });
        }
        return { status: 'FAILED', sessionId, attempt, step, code: failure.code, retriable: failure.retriable, detail };
      }
    }

    const final = builtNow();
    const done = await transcriptNow();
    return {
      status: 'SEALED',
      sessionId,
      evidenceId: facts.evidenceId,
      attempt,
      manifestSha256: final.manifestSha256,
      interrupted: closedNow().interrupted,
      skipped,
      tracks: hashedNow().tracks,
      transcriptSha256: done.transcript.itemColumns.transcriptSha256,
    };
  }

  return Object.freeze({ run });
}

/** Every thrown value as a typed failure of the step. */
function failureOf(error: unknown): SealingError {
  if (error instanceof SealingError) return error;
  if (error instanceof SealingStepJournalError) return new SealingError(SealingFailure.JOURNAL_FAILED, 'the sealing step rows could not be read or written', { journalCode: error.code }, error);
  if (error instanceof FinalizeTranscriptError) return new SealingError(SealingFailure.TRANSCRIPT_STEP_FAILED, 'the transcript step failed', { transcriptCode: error.code }, error);
  if (error instanceof SignerError) return new SealingError(SealingFailure.SIGNER_FAILED, 'the signer did not sign the manifest', { signerCode: error.code }, error);
  if (error instanceof EvidencePackageError) return new SealingError(SealingFailure.MANIFEST_INVALID, 'the manifest could not be built', { packageCode: error.code, members: error.members.slice(0, 8).join(',') }, error);
  const errno = (error as NodeJS.ErrnoException | null)?.code;
  if (typeof errno === 'string' && /^E[A-Z]+$/.test(errno)) return new SealingError(SealingFailure.STORAGE_FAILED, 'a file of the package could not be read or written', { errno }, error);
  return new SealingError(SealingFailure.STEP_FAILED, 'a sealing step failed for a reason it does not name', {}, error);
}
