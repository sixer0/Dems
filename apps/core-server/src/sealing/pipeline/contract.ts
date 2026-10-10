/**
 * THE CONTRACT OF THE SEALING PIPELINE v2 (blueprint row 82 / M7-W1; evidence package spec §A,
 * §E.1, §E.2, §E.4, §E.5, §E.6; database contract dbc-3 §B.4; decisions D67, D133).
 *
 * WHAT THE PIPELINE IS. Six steps, in the order of `FINALIZATION_STEPS_V2`, that turn the two
 * camera files of one recorded session into the sealed package `SESSION-<sessionId>/`:
 *
 *   CLOSE_TRACKS          the tail validation of each RECORDING file (`SESSION-<id>/VIDEO-0n.mp4`,
 *                         what the worker wrote: plaintext) by BOX WALK, never a media probe
 *                         (erratum AU2-08), against the rows of `recording_fragments`; a tail that
 *                         is no whole fragment is LEFT OUT and FLAGGED, and the seal is then an
 *                         interrupted one. Then THE CORE SEALS (ruling D147): the sealed camera file
 *                         `fragments/VIDEO-0n.mp4` is written - init segment clear, each fragment
 *                         one AES-256-GCM message - and `fragments/fragments.json` with it, the
 *                         durable home of every IV, tag and key ID
 *   FINALIZE_HASHES       the SEALED files read again, independently: every stored range against
 *                         its record and chain, every range opened and held against the
 *                         recording-time digest of its row, both whole-file hashes
 *   FINALIZE_TRANSCRIPT   row 79's step, asked until it is DONE
 *   BUILD_MANIFEST        the manifest of row 83's builder, its instants frozen in the checkpoint
 *                         BEFORE the first build, so that a resumed build has the same digest
 *   SIGN_MANIFEST         the same digest signed; `session-manifest.json`, `signature.sig`, the
 *                         certificate
 *   STORE_SEALED_PACKAGE  the folder made durable, nothing undeclared left in it, and the item
 *                         committed through the engine's INTERNAL action `completeSeal`
 *
 * CHECKPOINTS AND RESUME. Every step has one row of `sealing_jobs` (`step-journal.ts`): RUNNING
 * when it starts, DONE with its checkpoint when it has finished. A run reads the row first and
 * does not run a step that is DONE again; every step is written so that running it twice gives
 * the same bytes. A run that finds rows of an earlier run is one attempt higher.
 *
 * EVERYTHING OUTSIDE COMES THROUGH A PORT. This folder reads the camera files and writes the
 * package folder (`camera-files.ts`, `package-writer.ts`); it holds no key, opens no database
 * connection of its own, reads no configuration and names no clock. A session key never crosses
 * a port: the `FragmentOpener` of verify v2 is what turns stored bytes into plaintext.
 */
import type { FinalizationStep } from '@dems/shared/domain';
import type { ManifestAudioIntervalInput, ManifestTrackInput, ManifestV2Input, SessionCaptureSourceRow } from '@dems/shared/evidence-package';
import { VERIFY_MAX_OPEN_FRAGMENT_BYTES, type FragmentOpener } from '@dems/shared/evidence-verify';
import type { CompleteSealInput, SealingProgressInput } from '@dems/shared/sim';
import type { Signer, SigningCertificate } from '../../capture';
import type { RecordingFragment, VideoTrackId } from '../../modules/recording-fragments';
import type { ErrorLog } from '../../plugins/logger';
import type { FinalizeTranscriptResult, FinalizedTranscript, SttConfigSnapshot } from '../finalize-transcript/contract';
import type { StepTimer } from '../finalize-transcript/bounds';
import type { SealingStepJournal } from '../step-journal';

/** The six normal-path steps, in pipeline order (the fallback steps of OD-21 are not built). */
export const SEALING_STEP_ORDER = ['CLOSE_TRACKS', 'FINALIZE_HASHES', 'FINALIZE_TRANSCRIPT', 'BUILD_MANIFEST', 'SIGN_MANIFEST', 'STORE_SEALED_PACKAGE'] as const satisfies readonly FinalizationStep[];
export type SealingStepId = (typeof SEALING_STEP_ORDER)[number];

/**
 * THE LARGEST FRAGMENT THE PIPELINE SEALS (blueprint row 82c, finding F-86-1). It is the verifier's
 * own bound, IMPORTED, never a second number: verify v2 holds one sealed range in memory at a time
 * (GCM authenticates a whole message) and answers `FRAGMENT_TOO_LARGE` (V-05, CORRUPT) above
 * `VERIFY_MAX_OPEN_FRAGMENT_BYTES`; the media route and the export refuse the same range. A package
 * the Core's own verifier refuses is never produced: a larger fragment fails CLOSE_TRACKS with
 * `SealingFailure.FRAGMENT_TOO_LARGE` before a sealed byte is written and before anything is signed.
 */
export const SEALING_MAX_FRAGMENT_BYTES = VERIFY_MAX_OPEN_FRAGMENT_BYTES;

/** Why this run seals: a clean stop, or the durable prefix of a recording that did not end by a stop (OD-08). */
export type SealCause = 'STOPPED' | 'INTERRUPTED';

export const SealingFailure = {
  /** The call itself is malformed. */
  INPUT_INVALID: 'INPUT_INVALID',
  /** A camera file is not there, has no init segment or holds no whole fragment (ev §E.1 "a file not closed"). */
  CAMERA_FILE_UNUSABLE: 'CAMERA_FILE_UNUSABLE',
  /** Bytes a row of `recording_fragments` declares durable are not in the file. */
  DURABLE_BYTES_MISSING: 'DURABLE_BYTES_MISSING',
  /** A recorded value is not what the bytes give: the fragment is named in the detail (CORRUPT, ev §E.1). */
  FRAGMENT_MISMATCH: 'FRAGMENT_MISMATCH',
  /** A whole fragment of a recording is larger than `SEALING_MAX_FRAGMENT_BYTES`: the Core's own verifier could not open it. Nothing is sealed or signed. */
  FRAGMENT_TOO_LARGE: 'FRAGMENT_TOO_LARGE',
  /** The fragment table of the package does not hold a cipher record for a sealed fragment (ev §B.6). */
  FRAGMENT_NOT_SEALED: 'FRAGMENT_NOT_SEALED',
  /** The session key could not be made or used to seal. */
  SEALER_FAILED: 'SEALER_FAILED',
  /** The session key is not there, or a stored range does not authenticate. */
  FRAGMENT_NOT_OPENABLE: 'FRAGMENT_NOT_OPENABLE',
  /** The file is not the file the step before left (length changed between two steps). */
  CAMERA_FILE_CHANGED: 'CAMERA_FILE_CHANGED',
  /** `FINALIZE_TRANSCRIPT` failed for good (its own code is in the detail). */
  TRANSCRIPT_STEP_FAILED: 'TRANSCRIPT_STEP_FAILED',
  /** The manifest could not be built: a field is missing or has no canonical form, or a source has no class (ev §E.6). */
  MANIFEST_INVALID: 'MANIFEST_INVALID',
  /** A rebuilt manifest does not have the digest the checkpoint holds. Nothing is signed. */
  MANIFEST_NOT_REPRODUCIBLE: 'MANIFEST_NOT_REPRODUCIBLE',
  /** The signer refused or its signature did not verify. */
  SIGNER_FAILED: 'SIGNER_FAILED',
  /** A file the package does not declare is in the folder. */
  PACKAGE_NOT_CLEAN: 'PACKAGE_NOT_CLEAN',
  /** A file of the package could not be read or written. */
  STORAGE_FAILED: 'STORAGE_FAILED',
  /** The journal could not be read or written, or a row is not one this pipeline wrote. */
  JOURNAL_FAILED: 'JOURNAL_FAILED',
  /** The engine refused the progress or the completion. */
  ENGINE_REFUSED: 'ENGINE_REFUSED',
  /** A step failed for a reason it does not name (a defect: the cause is in the error log). */
  STEP_FAILED: 'SEALING_STEP_FAILED',
} as const;
export type SealingFailure = (typeof SealingFailure)[keyof typeof SealingFailure];

/** Failures a later run may get past without anybody changing the evidence: storage, the signer, the engine, the journal. */
const RETRIABLE: readonly SealingFailure[] = [SealingFailure.STORAGE_FAILED, SealingFailure.SIGNER_FAILED, SealingFailure.ENGINE_REFUSED, SealingFailure.JOURNAL_FAILED, SealingFailure.FRAGMENT_NOT_OPENABLE, SealingFailure.SEALER_FAILED, SealingFailure.TRANSCRIPT_STEP_FAILED];

export type SealingDetail = Readonly<Record<string, string | number | boolean | null>>;

/** Every failure of a step. Fixed text; `detail` holds identifiers, counts and codes - never a path, a hash of evidence or transcript text. */
export class SealingError extends Error {
  readonly code: SealingFailure;
  readonly detail: SealingDetail;
  readonly retriable: boolean;

  constructor(code: SealingFailure, message: string, detail: SealingDetail = {}, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SealingError';
    this.code = code;
    this.detail = detail;
    this.retriable = RETRIABLE.includes(code);
  }
}

/**
 * WHAT AN OPERATOR READS OF A FAILED STEP (the `detail` of the step in the session record, and so
 * operation 83 and the Finalizing screen). One sentence per failure code: what could not be done
 * and, where a camera file is the reason, which one. Never a path, a hash or a value.
 */
export function sealingFailureReason(code: SealingFailure, detail: SealingDetail = {}): string {
  const track = typeof detail.trackId === 'string' ? ` ${detail.trackId}` : '';
  switch (code) {
    case SealingFailure.CAMERA_FILE_UNUSABLE:
      return `Camera file${track} holds no whole recording${typeof detail.reason === 'string' ? ` (${detail.reason})` : ''}: this session cannot be sealed.`;
    case SealingFailure.DURABLE_BYTES_MISSING:
      return `Recorded bytes of camera file${track} are missing: this session cannot be sealed.`;
    case SealingFailure.FRAGMENT_MISMATCH:
      return `Camera file${track} is not what was recorded: this session cannot be sealed.`;
    case SealingFailure.FRAGMENT_TOO_LARGE: {
      const mib = (bytes: unknown): string => (typeof bytes === 'number' ? `${(bytes / (1024 * 1024)).toFixed(1)} MiB` : 'unknown size');
      return `Fragment ${typeof detail.seq === 'number' ? detail.seq : '?'} of camera file${track} is too large to be verified (${mib(detail.bytes)}, limit ${mib(detail.limitBytes)}): the camera's keyframe interval or bitrate is too high. This session cannot be sealed.`;
    }
    case SealingFailure.CAMERA_FILE_CHANGED:
      return `Camera file${track} changed while it was sealed: the seal stopped.`;
    case SealingFailure.FRAGMENT_NOT_SEALED:
    case SealingFailure.FRAGMENT_NOT_OPENABLE:
    case SealingFailure.SEALER_FAILED:
      return 'The session key could not be used: the seal stopped and can be tried again.';
    case SealingFailure.TRANSCRIPT_STEP_FAILED:
      return 'The transcript could not be finalized: the seal stopped and can be tried again.';
    case SealingFailure.MANIFEST_INVALID:
    case SealingFailure.MANIFEST_NOT_REPRODUCIBLE:
      return 'The manifest could not be built from the session record: nothing was signed.';
    case SealingFailure.SIGNER_FAILED:
      return 'The evidence signing key could not sign: nothing was signed. The seal can be tried again.';
    case SealingFailure.PACKAGE_NOT_CLEAN:
      return 'The package folder holds a file that does not belong to the package: nothing was committed.';
    case SealingFailure.STORAGE_FAILED:
      return 'The evidence storage could not be read or written: the seal stopped and can be tried again.';
    case SealingFailure.JOURNAL_FAILED:
    case SealingFailure.ENGINE_REFUSED:
      return 'The Core could not record the progress of the seal: the seal stopped and can be tried again.';
    default:
      return 'The seal stopped for a reason the Core does not name. It is in the error log.';
  }
}

/**
 * THE PROCESS STOPPED HERE. Thrown by a hook of a test (or of the kill harness of row 86 in
 * process) to end a run exactly as a killed process ends it: the pipeline writes NOTHING after
 * it - no FAILED row, no log entry, no report to the engine - and the run rejects with it.
 */
export class SealingStop extends Error {
  readonly point: SealingHookPoint;
  constructor(point: SealingHookPoint) {
    super(`the sealing run was stopped at ${point.step} ${point.phase}`);
    this.name = 'SealingStop';
    this.point = point;
  }
}

/**
 * THE HOOK POINTS (for the kill matrix of row 86). Each step passes three:
 *
 *   BEFORE            the step is about to start; nothing of it is written (its row is as the run before left it)
 *   AFTER_WORK        the step did its work (files written, the engine told) and its row still says RUNNING
 *   AFTER_CHECKPOINT  the row says DONE; the next step has not started
 *
 * `FINALIZE_TRANSCRIPT` keeps its own row (row 79) and writes DONE inside its work, so its
 * AFTER_WORK is already after its checkpoint. The commit of the item lies inside the work of
 * `STORE_SEALED_PACKAGE`: its AFTER_WORK is "the item is committed, the row still says RUNNING".
 */
export type SealingHookPhase = 'BEFORE' | 'AFTER_WORK' | 'AFTER_CHECKPOINT';
export interface SealingHookPoint {
  readonly step: SealingStepId;
  readonly phase: SealingHookPhase;
  readonly attempt: number;
}
export type SealingHook = (point: SealingHookPoint) => void | Promise<void>;
export const SEALING_HOOK_PHASES = ['BEFORE', 'AFTER_WORK', 'AFTER_CHECKPOINT'] as const satisfies readonly SealingHookPhase[];

/**
 * THE SEAL-TIME CIPHER (ruling D147). The Core seals at seal time, not the worker at write time:
 * each fragment's whole `moof` + `mdat` range becomes ONE AES-256-GCM message of row 84's cipher,
 * AAD `(trackId, seq, byteOffset, keyId)`, under the session key `KID-<sessionId>`, which the
 * credential store generates and keeps. No key crosses this port. The production adapter creates
 * the session key at the first call and opens the same key for a step that runs again.
 */
export interface SealedFragmentBytes {
  readonly ciphertext: Uint8Array;
  /** 12 bytes, lower-case hex. */
  readonly gcmIv: string;
  /** 16 bytes, lower-case hex. */
  readonly gcmTag: string;
  readonly keyId: string;
}
export interface SessionFragmentSealer {
  seal(sessionId: string, position: { readonly trackId: VideoTrackId; readonly seq: number; readonly byteOffset: number }, plaintext: Uint8Array): Promise<SealedFragmentBytes> | SealedFragmentBytes;
}

/** The two calls the pipeline makes on `recording_fragments` (`createRecordingFragmentStore`). */
export interface FragmentRows {
  read(sessionId: string, trackId: VideoTrackId): Promise<RecordingFragment[]>;
  insertMissing(rows: readonly RecordingFragment[]): Promise<{ readonly inserted: number; readonly alreadyStored: number }>;
}

/** What the session record says of one camera file: the manifest members no byte of the file gives (ev §B.4, §B.12). */
export type SealTrackFacts = Omit<ManifestTrackInput, 'file' | 'mediaType' | 'bytes' | 'durationMs' | 'sha256' | 'sha256Plain' | 'fragmentChainHead' | 'fragmentCount' | 'keyframeAligned'> & {
  /** Read by nobody: field 50 is what the box walk found of every sealed fragment (`files[].fragments[].keyframe`), never a statement of the session record. */
  readonly keyframeAligned?: boolean;
};

/**
 * The session as it was RECORDED AT ITS START and as the session record holds it now. Read once
 * per run. The reader (the composition) takes it from the engine's committed state and from the
 * INSERT-only tables; nothing of it is read from the device registry or a flag at sealing time
 * (ev §E.6).
 */
export interface SealSessionFacts {
  readonly sessionId: string;
  readonly evidenceId: string;
  readonly caseNumber: string;
  readonly notice: string;
  readonly timezone: string;
  readonly createdAt: number;
  readonly startedAt: number;
  /** Null when the recording did not end by a stop. */
  readonly stoppedAt: number | null;
  readonly timeSource: ManifestV2Input['timeline']['timeSource'];
  readonly device: Omit<ManifestV2Input['device'], 'certificate'>;
  readonly operator: ManifestV2Input['operator'];
  readonly subject: ManifestV2Input['subject'];
  /** VIDEO-01, then VIDEO-02. */
  readonly tracks: readonly [SealTrackFacts, SealTrackFacts];
  readonly audioCodec: string;
  /** The rows of `session_audio_intervals` in FILE time; the last may be open (`toMs` null). */
  readonly audioIntervals: readonly ManifestAudioIntervalInput[];
  /** The four rows of `session_capture_sources` (T-41). Fewer, or an unknown kind: BUILD_MANIFEST fails (ev §E.6). */
  readonly sourceRows: readonly SessionCaptureSourceRow[];
  /** The session's own STT snapshot (R-8). */
  readonly sttSnapshot: SttConfigSnapshot;
  /** What is known of the STT backend when no transcript can be sealed (row 119). */
  readonly backendUnreachable?: boolean;
  /** `audit-session-extract.jsonl`: the session's audit rows at the seal, one JSON object per line. */
  readonly auditExtract: Uint8Array;
  /**
   * True ONLY for a package of the demo dataset that the seed-time generator seals (row 82c; ev
   * §B.12 rule 6, §F.4): the manifest then says `integrity: 'DEMO_PACKAGE'` and `demo: true`, and
   * the manifest schema refuses it unless every source is of class FAKE. Absent for every session
   * the Core recorded: its manifest says `REAL` and `demo: false`. The session reader of the
   * running Core never sets it.
   */
  readonly demoPackage?: boolean;
}

export interface SealSessionReader {
  /** Null when the Core holds no such session. */
  read(sessionId: string): Promise<SealSessionFacts | null>;
}

/** `FINALIZE_TRANSCRIPT` bound to its own ports (`finalizeTranscript` of row 79), the journal included. */
export interface TranscriptStep {
  finalize(input: { readonly sessionId: string; readonly sttSnapshot: SttConfigSnapshot; readonly attempt: number; readonly backendUnreachable?: boolean }): Promise<FinalizeTranscriptResult>;
}

/** The engine host's two INTERNAL sealing actions (`applySealingProgress`, `completeSeal`), as the pipeline calls them. */
export interface SealEngine {
  /** Resolves without effect when the session is already SEALED (a run that was stopped after the commit reports once more). */
  applySealingProgress(input: SealingProgressInput): Promise<void>;
  /**
   * The item, the session's history and the audit row of the seal in ONE unit with the row of
   * `transcripts`. `ALREADY_SEALED`: the engine holds the item of this session with this manifest
   * digest (a run that was stopped after the commit).
   */
  completeSeal(input: CompleteSealInput, transcript: FinalizedTranscript): Promise<'SEALED' | 'ALREADY_SEALED'>;
  /**
   * True when the engine HOLDS the committed item of this session with this manifest digest (row
   * 82c, finding F-86-2): the process ended after the commit and before the last step's DONE row.
   * The last step then commits nothing again; it finishes its bookkeeping.
   */
  isSealed(sessionId: string, manifestSha256: string): boolean;
}

export interface SealingPorts {
  readonly journal: SealingStepJournal;
  readonly fragments: FragmentRows;
  readonly sealer: SessionFragmentSealer;
  /** Opens what the sealer sealed, for the re-read of FINALIZE_HASHES. Null: the Core has no session keys (`FRAGMENT_NOT_OPENABLE`). */
  readonly opener: FragmentOpener | null;
  readonly session: SealSessionReader;
  readonly transcript: TranscriptStep;
  readonly signing: { readonly signer: Signer; readonly certificate: SigningCertificate };
  readonly engine: SealEngine;
  /** The folder of the session's package: `<mediaStoreDir>/SESSION-<sessionId>` (ev §A.1, §A.2; D133 (2)). Absolute. */
  readonly packageDir: (sessionId: string) => string;
  /** A folder on the SAME volume, outside every package, for files being written and for names moved out of a package. */
  readonly stagingDir: (sessionId: string) => string;
  /** The persistent error log of the Core. */
  readonly log: ErrorLog;
  /** Epoch milliseconds: the Core clock. */
  readonly now: () => number;
  /** The clock the wait for the transcript is counted on. */
  readonly timer: StepTimer;
  /** The kill matrix of row 86 and the resume tests. Absent in production. */
  readonly hook?: SealingHook;
  /** Bytes read per call while hashing (a test reads small). */
  readonly chunkBytes?: number;
  /**
   * A LOWER fragment bound than `SEALING_MAX_FRAGMENT_BYTES`, for a test with small fragments. A
   * value above the constant is not taken: the pipeline never seals what its verifier refuses.
   */
  readonly maxFragmentBytes?: number;
}

/** One camera file as CLOSE_TRACKS sealed it (the checkpoint of the step). */
export interface ClosedTrack {
  readonly trackId: VideoTrackId;
  /** Length of the SEALED file: the durable prefix of the recording. */
  readonly bytes: number;
  readonly fragments: number;
  /** Bytes of the recording after its last whole fragment that were left out of the sealed file, or 0. */
  readonly droppedBytes: number;
  /** Why the tail was no fragment (a `TailReason`), or null. */
  readonly tailReason: string | null;
  /** Whole fragments the file held beyond the recorded ones and whose rows were added. */
  readonly rowsAdded: number;
  /** `.part` second names removed, and orphan `.part` files moved out of the package. */
  readonly partNamesRemoved: number;
  readonly orphansMoved: number;
  /** What the step computed while it sealed; FINALIZE_HASHES must find the same from the sealed file. */
  readonly hashes: HashedTrack;
}

/** One camera file as FINALIZE_HASHES found it (the checkpoint of the step; manifest fields 44-50). */
export interface HashedTrack {
  readonly trackId: VideoTrackId;
  readonly bytes: number;
  readonly sha256: string;
  readonly sha256Plain: string;
  readonly fragmentChainHead: string;
  readonly fragmentCount: number;
  /** Where the media of the file ends, in FILE time. */
  readonly mediaEndMs: number;
}

export type SealOutcome =
  | {
      readonly status: 'SEALED';
      readonly sessionId: string;
      readonly evidenceId: string;
      readonly attempt: number;
      readonly manifestSha256: string;
      readonly interrupted: boolean;
      /** The steps this run did not run again because their row said DONE. */
      readonly skipped: readonly SealingStepId[];
      readonly tracks: readonly HashedTrack[];
      readonly transcriptSha256: string | null;
    }
  /** A failed start (D84): no camera file and no fragment row. No row of `sealing_jobs` was written and no item exists. */
  | { readonly status: 'NOTHING_DURABLE'; readonly sessionId: string }
  | { readonly status: 'FAILED'; readonly sessionId: string; readonly attempt: number; readonly step: SealingStepId; readonly code: SealingFailure; readonly retriable: boolean; readonly detail: SealingDetail };

export interface SealRequest {
  readonly sessionId: string;
  readonly cause: SealCause;
}

export interface SealingPipeline {
  /** One run: every step that is not DONE, in order. Never two runs of one session at a time (the controller holds that). */
  run(request: SealRequest): Promise<SealOutcome>;
}
