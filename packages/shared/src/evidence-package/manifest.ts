/**
 * Manifest v2: `dems.evidence-manifest/2` (evidence package spec §B, 128 field definitions).
 *
 * STRICT. Every object refuses a member it does not know and every field is required as a key
 * (a nullable field is present with `null`). There is no default and no optional member: a
 * manifest without a source class does not parse, so absence can never be read as PRODUCTION
 * (spec §B.12 "Compatibility"). ONE EXCEPTION since task 4 row V4, named and reasoned at
 * `MANIFEST_V2_OPTIONAL_FIELDS`: `audio.absentOnRestart` (fields 129-132), optional so that no
 * package sealed before it verifies differently; since row P1 the same list holds a second member,
 * `hostProfileNotAsked` (field 133), for the same reason; since row R1b a third,
 * `tracks[].absentInSession` (fields 134-138).
 *
 * WHERE THE 128 LIVE. 119 fields are members of the sealed `session-manifest.json`; the 9 fields
 * of §B.11 (`export.*`) are "present only in an export" and live in the export manifest, because
 * the export carries `session-manifest.json` unchanged (§G.2) and the sealed manifest's hash
 * covers every member but two. So the sealed schema REFUSES an `export` member, and
 * `ManifestV2ExportBlockSchema` is the schema of that block for the export's owner.
 * 119 + 9 = 128 (`MANIFEST_V2_FIELDS`).
 *
 * Pure and platform neutral: zod only. No Node built-in, no DOM.
 */
import { z } from 'zod';
import { FinalizationStep } from '../domain';
import { CAMERA_FILE_MEDIA_TYPE, MANIFEST_V2_SCHEMA_ID, MANIFEST_V2_VERSION, PackageFile, SESSION_AUDIO_TRACK_ID, VIDEO_TRACK_IDS, cameraFileName, isSealedTrackList } from './layout';
import { MANIFEST_SOURCE_CLASSES, ManifestSourceClass, deriveDevelopmentSources } from './source-class';

// ── Leaf types ───────────────────────────────────────────────────────────────────────────────
const text = z.string().min(1);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
/** A whole number >= 0 that JSON holds exactly (the spec's `bigint`/`n` columns). */
const count = z.number().int().min(0);
const positive = z.number().int().min(1);
const epochMs = count;
const sourceClass = z.enum(MANIFEST_SOURCE_CLASSES);
const videoTrackId = z.enum(VIDEO_TRACK_IDS);

export const ManifestIntegrity = ['REAL', 'DEMO_PACKAGE', 'SIMULATED'] as const;
export const ManifestSignatureAlgorithm = ['Ed25519', 'ECDSA-P256-SHA256'] as const;
export type ManifestSignatureAlgorithm = (typeof ManifestSignatureAlgorithm)[number];
export const TRANSCRIPT_DOC_VERSION = 'dems.transcript/1';
/** Field 121 for `state = 'DISABLED'` (spec §B.7a): STT was off in the session's snapshot. */
export const TRANSCRIPT_DISABLED_REASON = 'DISABLED_BY_CONFIGURATION';
/**
 * Field 121 for the LAST-RESORT state (row 119, decision D110): STT was enabled, and at the bound
 * of the seal the transcriber could hand over no transcript at all. The package is sealed
 * `PARTIAL` WITHOUT a transcript document: a recording is never held back by transcription.
 */
export const TRANSCRIPT_UNAVAILABLE_REASON = 'TRANSCRIPT_UNAVAILABLE_AT_SEAL';
/** Every value of field 121. Each belongs to exactly one state: see `transcriptRules`. */
export const TRANSCRIPT_ABSENCE_REASONS = [TRANSCRIPT_DISABLED_REASON, TRANSCRIPT_UNAVAILABLE_REASON] as const;
export type TranscriptAbsenceReason = (typeof TRANSCRIPT_ABSENCE_REASONS)[number];
/**
 * Field 123 `configSnapshot.model`: a model IDENTIFIER, the form of `STT_MODEL_ID_PATTERN`
 * (`../api/transcription`; held equal by a test). It leaves no room for an endpoint, a path, a
 * credential or a credential reference: no `:`, `/`, `=`, white space (E-31).
 */
export const MANIFEST_STT_MODEL_PATTERN = /^(?!.*\.\.)(?!.*\.$)(?!.*\.[bB][iI][nN]$)[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * THE PROVENANCE OF THE STT MODEL IS RECORDED AS FAR AS THE CORE CAN KNOW IT, AND THE BACKEND SAYS
 * WHICH KIND IT IS (decision D160; spec §B.7 fields 84-87, erratum PE-D9-01). No field is added:
 * the backend is already sealed in field 123 (`configSnapshot.backend`).
 *
 *   backend                 84 name    85 version   86 quantisation   87 file SHA-256
 *   a SERVER (`omlx-server`) required   null         null              null
 *   any other (`cpu-local`)  required   required     required          required
 *
 * A server backend is a program the Core does not start and whose model files it never reads:
 * the name is the identifier the session's snapshot names / the server reported; a version, a
 * quantisation or a file hash beside it would be a value nobody verified, so one that is NOT null
 * is refused. For a backend whose model file the Core itself reads nothing is loosened: a null is
 * refused. A backend this list does not name is not a server (it fails closed: all four required).
 */
export const SERVER_STT_BACKENDS: readonly string[] = ['omlx-server'];
export const isServerSttBackend = (backend: string): boolean => SERVER_STT_BACKENDS.includes(backend);

export type TranscriptModelMember = 'name' | 'version' | 'quantisation' | 'sha256';
export interface TranscriptModelValues {
  readonly name: string | null;
  readonly version: string | null;
  readonly quantisation: string | null;
  /** SHA-256 of the model FILE (manifest: `modelSha256`; transcript document: `sha256`). */
  readonly sha256: string | null;
}
export interface TranscriptModelFault {
  readonly member: TranscriptModelMember;
  readonly message: string;
}
const CORE_READ_MEMBERS: readonly Exclude<TranscriptModelMember, 'name'>[] = ['version', 'quantisation', 'sha256'];

/**
 * The members of a SEALED transcript's model provenance that break the rule above; empty when it
 * holds. ONE rule for the manifest schema, the transcript document (both writers) and the Core's
 * provider port. Messages name members, never values.
 */
export function transcriptModelFaults(backend: string, model: TranscriptModelValues): TranscriptModelFault[] {
  const faults: TranscriptModelFault[] = [];
  if (model.name === null) faults.push({ member: 'name', message: 'not null where a transcript is sealed' });
  const server = isServerSttBackend(backend);
  for (const member of CORE_READ_MEMBERS) {
    if (server && model[member] !== null) faults.push({ member, message: 'null for a server backend: the Core cannot know it' });
    if (!server && model[member] === null) faults.push({ member, message: 'not null for a backend whose model file the Core reads' });
  }
  return faults;
}

// ── B.2 timeline (11) ────────────────────────────────────────────────────────────────────────
const TimelineSchema = z.strictObject({
  timezone: z.string().regex(/^[+-][0-9]{2}:[0-9]{2}$/),
  createdAt: epochMs,
  startedAt: epochMs,
  stoppedAt: epochMs.nullable(),
  sealedAt: epochMs,
  recordingDurationMs: count,
  interrupted: z.boolean(),
  durableEndMs: epochMs,
  timeSource: z.strictObject({
    source: z.enum(['GNSS', 'NTP', 'RTC']),
    state: text,
    fallbackOrder: z.array(text),
  }),
});

// ── B.3 device, operator, subject (14) ───────────────────────────────────────────────────────
const DeviceSchema = z.strictObject({
  deviceId: text,
  name: text,
  serialNumber: text,
  hardwareUuid: text,
  softwareVersion: text,
  certificate: z.strictObject({ subject: text, serialNumber: text, sha256: hex64 }),
});
const OperatorSchema = z.strictObject({
  investigatorId: text,
  displayName: text,
  role: z.enum(['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN']),
});
const SubjectSchema = z.strictObject({
  name: text,
  type: z.enum(['TERSANGKA', 'SAKSI', 'LAINNYA']),
  authorization: text,
});

// ── Fields 134-138 (optional): a camera absent inside the session ─────────────────────────────
/**
 * The longest absence of a camera a manifest can state (ms): one day, the bound of the audit type
 * `CAPTURE_VIDEO_ABSENT_IN_SESSION` (the Core's `CAPTURE_VIDEO_ABSENT_MAX_MS`; held equal by a test
 * there). A larger number is a clock fault, not a measurement.
 */
export const MANIFEST_VIDEO_ABSENT_MAX_MS = 86_400_000;
/** How an absence of a camera ended: the relay opened the camera again, or the capture ended with the camera still away. */
export const MANIFEST_VIDEO_ABSENCE_ENDS = ['RE_OPENED', 'NOT_RE_OPENED'] as const;
export type ManifestVideoAbsenceEnd = (typeof MANIFEST_VIDEO_ABSENCE_ENDS)[number];

/**
 * ONE ABSENCE OF A CAMERA INSIDE THE SESSION (task 4 row R1b; decision C99; finding F3-01 of the M3
 * review; the video twin of `audio.absentOnRestart`). The camera of this track stopped delivering
 * pictures while the session went on and its relay kept the push to the capture worker. The relay
 * places the first picture after the absence as far after the last one before it as its own clock
 * counted, so the FILE of the track has ONE STEP IN TIME as long as the absence: `durationMs` of
 * the track spans the absence and holds no picture inside it. This record is how the Core accounts
 * for that step, under the signature. For `NOT_RE_OPENED` there is no step: the track's pictures
 * END at the loss, and the track is shorter than the session by about the stated time.
 *
 * Numbers and one closed word. `attempt`: the capture worker of the session the relay fed (the
 * first is 1); `loss`: the relay's own number of the loss (it counts from 1). THE TWO BOUNDS are
 * whole milliseconds, each measured differently because neither clock sees the last picture:
 *   `absentAtLeastMs`  RE_OPENED: the RELAY's own measure, on its monotonic clock, from the
 *                      instant it called the camera lost to the first keyframe of the new leg -
 *                      the last picture was forwarded BEFORE that instant, so no shorter time is
 *                      possible. NOT_RE_OPENED: the CORE's clock, from the relay's word of the
 *                      loss to the instant the Core asked the capture to end.
 *   `absentAtMostMs`   the CORE's clock from the relay's word of the loss to its word of the
 *                      re-open (NOT_RE_OPENED: to the instant the capture had ended), never below
 *                      the least, PLUS the longest the relay lets a playing camera be silent
 *                      before it calls it lost (5 s) - the last picture came no earlier than that.
 * A bound is null only when the instant it is measured from is not known: the record then says
 * that the absence exists and was not measured. No address, no stream name, no file name.
 */
export const ManifestVideoAbsenceSchema = z.strictObject({
  /** Field 134. */
  attempt: positive,
  /** Field 135. */
  loss: positive,
  /** Field 136: null = not measured. */
  absentAtLeastMs: count.max(MANIFEST_VIDEO_ABSENT_MAX_MS).nullable(),
  /** Field 137: null = not measured. */
  absentAtMostMs: count.max(MANIFEST_VIDEO_ABSENT_MAX_MS).nullable(),
  /** Field 138. */
  ended: z.enum(MANIFEST_VIDEO_ABSENCE_ENDS),
});

// ── B.4 + B.12 track records (18 + 3 = 21) ───────────────────────────────────────────────────
export const ManifestTrackSchema = z.strictObject({
  trackId: videoTrackId,
  deviceId: text,
  profile: text,
  name: text,
  model: text,
  firmware: text,
  clockOffsetMs: z.number().int(),
  file: text,
  mediaType: z.literal(CAMERA_FILE_MEDIA_TYPE),
  codec: text.nullable(),
  bytes: count,
  durationMs: count.nullable(),
  sha256: hex64,
  sha256Plain: hex64.nullable(),
  fragmentChainHead: hex64.nullable(),
  fragmentCount: count.nullable(),
  keyframeAligned: z.boolean(),
  avOffsetMs: z.number().nullable(),
  /** Field 124. */
  sourceClass,
  /** Field 127: the worker's `FIRST_VIDEO_SAMPLE` pts, exactly as delivered; counts from T0. */
  firstVideoSamplePts: count.nullable(),
  /** Field 128: ticks per second of the video track; null exactly when field 127 is null. */
  firstVideoSampleTimescale: positive.nullable(),
  /**
   * Fields 134-138, THE THIRD OPTIONAL MEMBER (see `MANIFEST_V2_OPTIONAL_FIELDS`). One record per
   * absence of this track's camera inside the session, in the order they happened. ABSENT = the
   * Core states no absence for this track; an EMPTY list is refused, so "none" has exactly one
   * form and one digest. When present it is inside the digest and under the signature.
   */
  absentInSession: z.array(ManifestVideoAbsenceSchema).min(1).optional(),
});

// ── B.5 + B.12 session audio (10 + 1 = 11) ───────────────────────────────────────────────────
export const ManifestAudioIntervalSchema = z.strictObject({
  seq: positive,
  micDeviceId: text,
  role: z.enum(['PRIMARY', 'STANDBY']),
  /** Field 58, in FILE (media) time of the sealed file, whole milliseconds. */
  fromMs: count,
  /** Field 59, FILE time; null = open interval. */
  toMs: count.nullable(),
  reason: z.enum(['START', 'MANUAL', 'STOP']),
  switchedBy: text.nullable(),
  /** Field 125. */
  sourceClass,
});
/**
 * The longest audio gap a manifest can state (ms): one day, the bound of the audit type
 * `CAPTURE_AUDIO_ABSENT_ON_RESTART` (the Core's `CAPTURE_AUDIO_ABSENT_MAX_MS`; held equal by a test
 * there). A larger number is a clock fault, not a measurement.
 */
export const MANIFEST_AUDIO_ABSENT_MAX_MS = 86_400_000;
const gapMs = count.max(MANIFEST_AUDIO_ABSENT_MAX_MS);

/**
 * ONE WORKER RESTART DURING WHICH NO AUDIO WAS RECORDED (task 4 row V4; decision C73; the finding
 * of row 191b): the capture worker of the session was replaced before anything was durable, and
 * between the earlier worker and the later one the microphones delivered nothing. The camera files
 * begin with the later worker, so `tracks[].durationMs` is SHORTER than `timeline.
 * recordingDurationMs` - this record is how the Core accounts for the difference, under the
 * signature. Numbers only: the two attempt numbers (the first worker of a session is attempt 1)
 * and the two MEASURED bounds of the gap in whole milliseconds - at least (the earlier worker down
 * until the microphones of the later one were started) and at most (until the later worker's audio
 * was heard). A bound is null only when the instant it is measured from is not known: the record
 * then says that the gap exists and was not measured. No device, no card text, no file name.
 */
export const ManifestAudioRestartGapSchema = z.strictObject({
  /** Field 129. */
  earlierAttempt: positive,
  /** Field 130. */
  laterAttempt: positive,
  /** Field 131: null = not measured. */
  absentAtLeastMs: gapMs.nullable(),
  /** Field 132: null = not measured. */
  absentAtMostMs: gapMs.nullable(),
});
const AudioSchema = z.strictObject({
  trackId: z.literal(SESSION_AUDIO_TRACK_ID),
  codec: text,
  containsIn: z.array(videoTrackId),
  sourceIntervals: z.array(ManifestAudioIntervalSchema),
  /**
   * Fields 129-132, THE ONE OPTIONAL MEMBER OF THE MANIFEST (see `MANIFEST_V2_OPTIONAL_FIELDS` for
   * why it is optional). One record per restart, in the order they happened. ABSENT = the Core
   * states no restart gap; an EMPTY list is refused, so "none" has exactly one form and one
   * digest. When present it is inside the digest and under the signature like every other member.
   */
  absentOnRestart: z.array(ManifestAudioRestartGapSchema).min(1).optional(),
});

// ── Field 133 (optional): the host profile was not asked ──────────────────────────────────────
/**
 * The platforms a PRODUCTION Core is allowed on WITHOUT its host profile being asked (task 4 row P1;
 * decision U21 (2): Linux and macOS). On Linux the Core asks the whole host profile at every start and
 * its manifests carry no such member, so `linux` is not in this list and can never be stated here.
 */
export const MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS = ['darwin'] as const;

/**
 * THE CORE THAT SEALED THIS PACKAGE RAN AS A PRODUCTION CORE ON A PLATFORM WHERE ITS HOST PROFILE IS
 * NOT ASKED (task 4 row P1; decisions U21 (2), C66 (1), C71 C-7). The host profile is what a production
 * host must be - the loopback owner rule that keeps other accounts of the host away from the camera
 * listeners, no crash collector that images the Core's memory, no packet forwarding, a synchronised
 * clock, no sleep, the address helper's socket. On Linux the Core refuses to start unless every item is
 * in place. On the platform named here it starts WITHOUT asking any of them: nothing of the above was
 * checked for the Core that sealed this package. Until this member that was a warning in the Core's log
 * alone; now it is inside the digest and under the signature.
 *
 * It is the statement of the boot of the Core that SEALED (built this manifest) - a function of that
 * Core's platform alone. It does not say that anything was wrong with the host: it says that nobody
 * checked. One member, the platform word, of a closed list.
 */
export const ManifestHostProfileNotAskedSchema = z.strictObject({
  /** Field 133. */
  platform: z.enum(MANIFEST_HOST_PROFILE_NOT_ASKED_PLATFORMS),
});

// ── B.6 fragment records (17) ────────────────────────────────────────────────────────────────
export const ManifestFragmentSchema = z.strictObject({
  seq: positive,
  byteOffset: count,
  byteLength: positive,
  mediaStartMs: count,
  mediaDurationMs: positive,
  sha256: hex64,
  sha256Plain: hex64.nullable(),
  chainHash: hex64,
  prefixSha256: hex64.nullable(),
  keyframe: z.boolean(),
  interrupted: z.boolean(),
  truncated: z.boolean(),
  gcmIv: z.string().regex(/^[0-9a-f]{24}$/),
  gcmTag: z.string().regex(/^[0-9a-f]{32}$/),
  keyId: text,
  durableAt: epochMs,
});
export const ManifestFileSchema = z.strictObject({
  trackId: videoTrackId,
  fragments: z.array(ManifestFragmentSchema),
});

// ── B.7 + B.7a transcript (16 + 3 = 19) ──────────────────────────────────────────────────────
const TranscriptSchema = z.strictObject({
  file: z.literal(PackageFile.TRANSCRIPT_JSON).nullable(),
  docVersion: z.literal(TRANSCRIPT_DOC_VERSION).nullable(),
  sha256: hex64.nullable(),
  srtSha256: hex64.nullable(),
  vttSha256: hex64.nullable(),
  model: z.strictObject({
    name: text.nullable(),
    version: text.nullable(),
    quantisation: text.nullable(),
    modelSha256: hex64.nullable(),
  }),
  diarization: z.strictObject({
    numSpeakers: count.nullable(),
    status: z.enum(['LABELLED', 'UNAVAILABLE']).nullable(),
    confidence: z.number().nullable(),
  }),
  speakerState: z.enum(['LABELLED', 'UNAVAILABLE']).nullable(),
  state: z.enum(['ASSEMBLED', 'PARTIAL', 'DISABLED']),
  failedChunks: count.nullable(),
  revisionHead: count.nullable(),
  /** Field 121: why the package holds no transcript document; null exactly when it holds one. */
  disabledReason: z.enum(TRANSCRIPT_ABSENCE_REASONS).nullable(),
  backendUnreachable: z.boolean(),
  /** Never the endpoint, a credential or a credential reference (E-31): five members, strict. */
  configSnapshot: z.strictObject({
    enabled: z.boolean(),
    backend: z.enum(['omlx-server', 'cpu-local']),
    model: z.string().regex(MANIFEST_STT_MODEL_PATTERN),
    diarization: z.boolean(),
    revision: positive,
  }),
});

// ── B.8 sealing steps (7) ────────────────────────────────────────────────────────────────────
const SealingSchema = z.strictObject({
  steps: z.array(
    z.strictObject({
      step: z.enum(Object.values(FinalizationStep) as [FinalizationStep, ...FinalizationStep[]]),
      status: z.enum(['RUNNING', 'DONE', 'FAILED']),
      progress: z.number().int().min(0).max(100),
      etaMs: count.nullable(),
      attempt: positive,
      checkpoint: z.record(z.string(), z.json()).nullable(),
      completedAt: epochMs.nullable(),
    }),
  ),
});

// ── B.9 signature (9 of 10; the tenth is `manifestSha256`) ───────────────────────────────────
const signatureMembers = {
  algorithm: z.enum(ManifestSignatureAlgorithm),
  keyId: text,
  simulated: z.boolean(),
  file: z.literal(PackageFile.SIGNATURE),
  covers: text,
  certificate: z.strictObject({ file: z.literal(PackageFile.CERTIFICATE), sha256: hex64 }),
  signedAt: epochMs,
};
const SignatureSchema = z.strictObject({ ...signatureMembers, value: z.string().regex(/^([0-9a-f]{2})+$/) });
const UnsignedSignatureSchema = z.strictObject(signatureMembers);

// ── B.11 export block (9): NOT a member of the sealed manifest ───────────────────────────────
export const ManifestV2ExportBlockSchema = z.strictObject({
  exportId: z.string().regex(/^EXP-.+$/),
  exportedAt: epochMs,
  exportedBy: text,
  authorizationRef: text,
  derived: z.boolean(),
  composite: z.strictObject({ included: z.boolean(), encoder: text.nullable(), sha256: hex64.nullable() }),
  manifestSha256: hex64,
});
export type ManifestV2ExportBlock = z.output<typeof ManifestV2ExportBlockSchema>;

// ── The manifest ─────────────────────────────────────────────────────────────────────────────
const bodyMembers = {
  schema: z.literal(MANIFEST_V2_SCHEMA_ID),
  evidenceId: text,
  sessionId: text,
  caseNumber: text,
  manifestVersion: z.literal(MANIFEST_V2_VERSION),
  integrity: z.enum(ManifestIntegrity),
  demo: z.boolean(),
  notice: text,
  /** Field 126: derived from fields 124 and 125; a summary, never a second source of truth. */
  developmentSources: z.boolean(),
  timeline: TimelineSchema,
  device: DeviceSchema,
  operator: OperatorSchema,
  subject: SubjectSchema,
  tracks: z.array(ManifestTrackSchema),
  audio: AudioSchema,
  files: z.array(ManifestFileSchema),
  transcript: TranscriptSchema,
  sealing: SealingSchema,
  manifestSha256: hex64,
  /**
   * Field 133, THE SECOND OPTIONAL MEMBER (see `MANIFEST_V2_OPTIONAL_FIELDS`). ABSENT = the manifest
   * states nothing about the host profile: every package sealed before the member, every package of a
   * development or simulated Core (no host profile is asked there, by design), and every package of a
   * production Core on Linux, where the profile WAS asked - so a Linux manifest is byte for byte the
   * manifest of before. PRESENT = a production Core sealed it on the named platform without its host
   * profile being asked. When present it is inside the digest and under the signature.
   */
  hostProfileNotAsked: ManifestHostProfileNotAskedSchema.optional(),
};

type Issue = (path: readonly (string | number)[], message: string) => void;
type BodyShape = z.output<z.ZodObject<typeof bodyMembers>>;

/** The rules between fields that a per-field type cannot hold. Messages name members, never values. */
function crossFieldRules(manifest: BodyShape, issue: Issue): void {
  // §B.4 (erratum F-M7 / D178): the track records of the camera files that EXIST - one or two,
  // VIDEO-01 before VIDEO-02, each with its file name. A camera that recorded nothing has no record.
  const trackIds = manifest.tracks.map((track) => track.trackId);
  if (!isSealedTrackList(trackIds)) issue(['tracks'], '1 or 2 track records, VIDEO-01 before VIDEO-02');
  manifest.tracks.forEach((track, index) => {
    if (track.file !== cameraFileName(track.trackId)) issue(['tracks', index, 'file'], 'the camera file is named after its track');
    // §B.12 fields 127 / 128: null together.
    if ((track.firstVideoSamplePts === null) !== (track.firstVideoSampleTimescale === null)) {
      issue(['tracks', index, 'firstVideoSampleTimescale'], 'null exactly when firstVideoSamplePts is null');
    }
    // Fields 134-138 (row R1b, optional): the least an absence can be is not above the most; the
    // records follow each other (a later attempt, or the next loss of the same attempt); and an
    // absence that did not end can only be the last one of its track.
    (track.absentInSession ?? []).forEach((absence, at, absences) => {
      const path = ['tracks', index, 'absentInSession', at] as const;
      if (absence.absentAtLeastMs !== null && absence.absentAtMostMs !== null && absence.absentAtLeastMs > absence.absentAtMostMs) {
        issue([...path, 'absentAtMostMs'], 'the most an absence can be is not below the least');
      }
      const previous = at > 0 ? absences[at - 1] : undefined;
      if (previous !== undefined && (absence.attempt < previous.attempt || (absence.attempt === previous.attempt && absence.loss <= previous.loss))) {
        issue([...path, 'loss'], 'an absence follows the previous one: a later attempt, or a higher loss number of the same attempt');
      }
      if (absence.ended === 'NOT_RE_OPENED' && at !== absences.length - 1) issue([...path, 'ended'], 'only the last absence of a track may be one that did not end');
    });
  });
  // §B.6: one fragment array per SEALED camera file, in the order of the track records.
  if (manifest.files.length !== manifest.tracks.length) issue(['files'], 'one file record per track record');
  manifest.files.forEach((file, index) => {
    if (file.trackId !== trackIds[index]) issue(['files', index, 'trackId'], 'the file records follow the track records');
  });
  // §B.5: the session audio lies in a camera file of THIS package, and in at least one.
  if (manifest.audio.containsIn.length === 0) issue(['audio', 'containsIn'], 'at least one camera file');
  manifest.audio.containsIn.forEach((trackId, index) => {
    if (!trackIds.includes(trackId)) issue(['audio', 'containsIn', index], 'a camera file of this package');
  });
  if (new Set(manifest.audio.containsIn).size !== manifest.audio.containsIn.length) issue(['audio', 'containsIn'], 'no track twice');

  // §B.5 / §B.12: intervals in FILE time: seq 1..n, each closed interval forward, none overlapping
  // the next, only the last one open.
  const intervals = manifest.audio.sourceIntervals;
  const classOfMic = new Map<string, ManifestSourceClass>();
  intervals.forEach((interval, index) => {
    if (interval.seq !== index + 1) issue(['audio', 'sourceIntervals', index, 'seq'], 'seq counts 1..n without a gap');
    if (interval.toMs !== null && interval.toMs < interval.fromMs) issue(['audio', 'sourceIntervals', index, 'toMs'], 'an interval does not end before it starts');
    if (interval.toMs === null && index !== intervals.length - 1) issue(['audio', 'sourceIntervals', index, 'toMs'], 'only the last interval may be open');
    const previous = index > 0 ? intervals[index - 1] : undefined;
    if (previous !== undefined && previous.toMs !== null && interval.fromMs < previous.toMs) {
      issue(['audio', 'sourceIntervals', index, 'fromMs'], 'an interval does not start before the previous one ended');
    }
    // §B.12 rule 4: within one manifest the same microphone has one class.
    const seen = classOfMic.get(interval.micDeviceId);
    if (seen !== undefined && seen !== interval.sourceClass) issue(['audio', 'sourceIntervals', index, 'sourceClass'], 'one microphone has one class');
    classOfMic.set(interval.micDeviceId, interval.sourceClass);
  });

  // Fields 129-132 (row V4, optional): each record goes forward - a later attempt after the earlier
  // one, the least gap not above the most - and the records follow each other in time.
  (manifest.audio.absentOnRestart ?? []).forEach((gap, index, gaps) => {
    const at = ['audio', 'absentOnRestart', index] as const;
    if (gap.laterAttempt <= gap.earlierAttempt) issue([...at, 'laterAttempt'], 'the later attempt has a higher number than the earlier one');
    if (gap.absentAtLeastMs !== null && gap.absentAtMostMs !== null && gap.absentAtLeastMs > gap.absentAtMostMs) {
      issue([...at, 'absentAtMostMs'], 'the most a gap can be is not below the least');
    }
    const previous = index > 0 ? gaps[index - 1] : undefined;
    if (previous !== undefined && gap.earlierAttempt < previous.laterAttempt) issue([...at, 'earlierAttempt'], 'a restart does not begin before the previous one ended');
  });

  // §B.12 field 126 and rule 5: the flag is exactly the summary of fields 124 and 125.
  const classes = [...manifest.tracks.map((track) => track.sourceClass), ...intervals.map((interval) => interval.sourceClass)];
  if (manifest.developmentSources !== deriveDevelopmentSources(classes)) issue(['developmentSources'], 'equals "some source is not PRODUCTION"');
  // §B.12 rule 6: a demo package has FAKE on every source.
  if ((manifest.demo || manifest.integrity === 'DEMO_PACKAGE') && classes.some((value) => value !== ManifestSourceClass.FAKE)) {
    issue(['developmentSources'], 'a demo package has FAKE on every source');
  }

  // Field 133 (row P1, optional): the statement of a PRODUCTION Core. A demo package is sealed by the
  // seed-time generator and never by a production Core, so the two do not stand in one manifest.
  if (manifest.hostProfileNotAsked !== undefined && (manifest.demo || manifest.integrity !== 'REAL')) {
    issue(['hostProfileNotAsked'], 'only in a package a production Core sealed: never beside demo or an integrity other than REAL');
  }

  // §B.2 field 12: `stoppedAt` is null only for an interrupted seal.
  if (manifest.timeline.stoppedAt === null && !manifest.timeline.interrupted) issue(['timeline', 'stoppedAt'], 'null only for an interrupted seal');

  transcriptRules(manifest.transcript, issue);
}

/**
 * §B.7 / §B.7a and decision D110: the transcript block is ONE of four shapes, and nothing between.
 *
 *   state      document            field 121 (reason)               snapshot.enabled  backendUnreachable
 *   ASSEMBLED  sealed, 79-94 set*  null                             true              false
 *   PARTIAL    sealed, 79-94 set*  null                             true              either
 *   PARTIAL    NONE, 79-91, 94 null TRANSCRIPT_UNAVAILABLE_AT_SEAL  true              either
 *   DISABLED   NONE, 79-94 null    DISABLED_BY_CONFIGURATION        false             false
 *
 * (*) Fields 85-87 (model version, quantisation, file SHA-256) are null beside a document exactly
 * when the snapshot's backend is a SERVER, and set for every other backend: `transcriptModelFaults`.
 *
 * "Document" is fields 79-91 and 94 (and 90, which a document may leave null). Field 93
 * `failedChunks` is a count wherever a document is sealed; without one it is null when disabled,
 * and the number of planned chunks - or null where the plan is not known - when unavailable.
 * So: a transcript that claims to be there without a document is refused; a declared absence that
 * carries a hash is refused; a reason never stands beside a document; each reason has one state.
 */
function transcriptRules(transcript: BodyShape['transcript'], issue: Issue): void {
  const at = (path: readonly string[], message: string): void => issue(['transcript', ...path], message);
  /** Fields 79-83, 88, 89, 91, 94: set exactly when a document is sealed. */
  const docFields: readonly (readonly [readonly string[], unknown])[] = [
    [['file'], transcript.file],
    [['docVersion'], transcript.docVersion],
    [['sha256'], transcript.sha256],
    [['srtSha256'], transcript.srtSha256],
    [['vttSha256'], transcript.vttSha256],
    [['diarization', 'numSpeakers'], transcript.diarization.numSpeakers],
    [['diarization', 'status'], transcript.diarization.status],
    [['speakerState'], transcript.speakerState],
    [['revisionHead'], transcript.revisionHead],
  ];
  const reason = transcript.disabledReason;
  /** Fields 84-87: all null without a document; with one, as the backend of field 123 allows (D160). */
  const model = transcript.model;
  const modelFields: readonly (readonly [readonly string[], unknown])[] = [
    [['model', 'name'], model.name],
    [['model', 'version'], model.version],
    [['model', 'quantisation'], model.quantisation],
    [['model', 'modelSha256'], model.modelSha256],
  ];
  const absent = (why: string): void => {
    for (const [path, value] of [...docFields, ...modelFields]) if (value !== null) at(path, why);
    if (transcript.diarization.confidence !== null) at(['diarization', 'confidence'], why);
  };

  if (transcript.state === 'DISABLED') {
    absent('null when the transcript is disabled');
    if (transcript.failedChunks !== null) at(['failedChunks'], 'null when the transcript is disabled');
    if (reason !== TRANSCRIPT_DISABLED_REASON) at(['disabledReason'], 'DISABLED_BY_CONFIGURATION when the transcript is disabled');
    if (transcript.configSnapshot.enabled) at(['configSnapshot', 'enabled'], 'false when the transcript is disabled');
    if (transcript.backendUnreachable) at(['backendUnreachable'], 'false when the transcript is disabled');
    return;
  }

  if (!transcript.configSnapshot.enabled) at(['configSnapshot', 'enabled'], 'true unless the transcript is disabled');
  // D-EV-1: an unreachable backend seals PARTIAL.
  if (transcript.backendUnreachable && transcript.state !== 'PARTIAL') at(['state'], 'PARTIAL when the backend was unreachable');

  if (reason === TRANSCRIPT_UNAVAILABLE_REASON) {
    // D110: the last-resort state. PARTIAL only, and no member of a document beside it.
    if (transcript.state !== 'PARTIAL') at(['state'], 'PARTIAL when the transcript was unavailable at the seal');
    absent('null when the transcript was unavailable at the seal');
    return;
  }
  if (reason !== null) at(['disabledReason'], 'DISABLED_BY_CONFIGURATION only when the transcript is disabled');
  // A transcript that is declared there: every member of its document, and the failed-chunk count.
  for (const [path, value] of docFields) if (value === null) at(path, 'not null unless the transcript is disabled or was unavailable at the seal');
  if (transcript.failedChunks === null) at(['failedChunks'], 'not null unless the transcript is disabled or was unavailable at the seal');
  // ... and the provenance of its model, as far as the backend of the snapshot lets the Core know it.
  for (const fault of transcriptModelFaults(transcript.configSnapshot.backend, { name: model.name, version: model.version, quantisation: model.quantisation, sha256: model.modelSha256 })) {
    at(['model', fault.member === 'sha256' ? 'modelSha256' : fault.member], fault.message);
  }
}

/** True when the manifest declares a transcript document: the `transcript/` folder is part of the package. */
export function manifestDeclaresTranscript(transcript: { readonly file: string | null }): boolean {
  return transcript.file !== null;
}

/** Database contract §C.4 / §C.5: what a v2 seal may write as a signature. */
function signatureRules(signature: { algorithm: ManifestSignatureAlgorithm; simulated: boolean; value?: string }, issue: Issue): void {
  if (signature.simulated) issue(['signature', 'simulated'], 'a v2 manifest carries a real signature');
  if (signature.value === undefined) return;
  const bytes = signature.value.length / 2;
  const ok = signature.algorithm === 'Ed25519' ? bytes === 64 : bytes >= 64 && bytes <= 72;
  if (!ok) issue(['signature', 'value'], 'the length of the signature fits its algorithm');
}

function withRules<T extends z.ZodType<BodyShape & { signature: { algorithm: ManifestSignatureAlgorithm; simulated: boolean; value?: string } }>>(schema: T): T {
  return schema.superRefine((manifest, context) => {
    const issue: Issue = (path, message) => context.addIssue({ code: 'custom', path: [...path], message });
    crossFieldRules(manifest, issue);
    signatureRules(manifest.signature, issue);
  }) as T;
}

/** The sealed, signed manifest: 119 members, strict, with the cross-field rules. */
export const ManifestV2Schema = withRules(z.strictObject({ ...bodyMembers, signature: SignatureSchema }));
export type ManifestV2 = z.output<typeof ManifestV2Schema>;

/** The manifest between `BUILD_MANIFEST` and `SIGN_MANIFEST`: everything but `signature.value`. */
export const UnsignedManifestV2Schema = withRules(z.strictObject({ ...bodyMembers, signature: UnsignedSignatureSchema }));
export type UnsignedManifestV2 = z.output<typeof UnsignedManifestV2Schema>;

export type ManifestTrack = z.output<typeof ManifestTrackSchema>;
export type ManifestAudioInterval = z.output<typeof ManifestAudioIntervalSchema>;
export type ManifestFragment = z.output<typeof ManifestFragmentSchema>;
export type ManifestFile = z.output<typeof ManifestFileSchema>;

// ── The 128 field definitions ────────────────────────────────────────────────────────────────
export interface ManifestFieldDefinition {
  /** The number of the field in spec §B. */
  readonly n: number;
  /** Dotted path; `[]` marks "each record of this array". */
  readonly path: string;
  /** Where the field lives: the sealed manifest, or the export block of §B.11. */
  readonly block: 'sealed' | 'export';
}

const sealed = (n: number, path: string): ManifestFieldDefinition => Object.freeze({ n, path, block: 'sealed' });
const exported = (n: number, path: string): ManifestFieldDefinition => Object.freeze({ n, path, block: 'export' });

/** Every field of spec §B with its number, in number order. 128 entries. */
export const MANIFEST_V2_FIELDS: readonly ManifestFieldDefinition[] = Object.freeze([
  sealed(1, 'schema'),
  sealed(2, 'evidenceId'),
  sealed(3, 'sessionId'),
  sealed(4, 'caseNumber'),
  sealed(5, 'manifestVersion'),
  sealed(6, 'integrity'),
  sealed(7, 'demo'),
  sealed(8, 'notice'),
  sealed(9, 'timeline.timezone'),
  sealed(10, 'timeline.createdAt'),
  sealed(11, 'timeline.startedAt'),
  sealed(12, 'timeline.stoppedAt'),
  sealed(13, 'timeline.sealedAt'),
  sealed(14, 'timeline.recordingDurationMs'),
  sealed(15, 'timeline.interrupted'),
  sealed(16, 'timeline.durableEndMs'),
  sealed(17, 'timeline.timeSource.source'),
  sealed(18, 'timeline.timeSource.state'),
  sealed(19, 'timeline.timeSource.fallbackOrder'),
  sealed(20, 'device.deviceId'),
  sealed(21, 'device.name'),
  sealed(22, 'device.serialNumber'),
  sealed(23, 'device.hardwareUuid'),
  sealed(24, 'device.softwareVersion'),
  sealed(25, 'device.certificate.subject'),
  sealed(26, 'device.certificate.serialNumber'),
  sealed(27, 'device.certificate.sha256'),
  sealed(28, 'operator.investigatorId'),
  sealed(29, 'operator.displayName'),
  sealed(30, 'operator.role'),
  sealed(31, 'subject.name'),
  sealed(32, 'subject.type'),
  sealed(33, 'subject.authorization'),
  sealed(34, 'tracks[].trackId'),
  sealed(35, 'tracks[].deviceId'),
  sealed(36, 'tracks[].profile'),
  sealed(37, 'tracks[].name'),
  sealed(38, 'tracks[].model'),
  sealed(39, 'tracks[].firmware'),
  sealed(40, 'tracks[].clockOffsetMs'),
  sealed(41, 'tracks[].file'),
  sealed(42, 'tracks[].mediaType'),
  sealed(43, 'tracks[].codec'),
  sealed(44, 'tracks[].bytes'),
  sealed(45, 'tracks[].durationMs'),
  sealed(46, 'tracks[].sha256'),
  sealed(47, 'tracks[].sha256Plain'),
  sealed(48, 'tracks[].fragmentChainHead'),
  sealed(49, 'tracks[].fragmentCount'),
  sealed(50, 'tracks[].keyframeAligned'),
  sealed(51, 'tracks[].avOffsetMs'),
  sealed(52, 'audio.trackId'),
  sealed(53, 'audio.codec'),
  sealed(54, 'audio.containsIn'),
  sealed(55, 'audio.sourceIntervals[].seq'),
  sealed(56, 'audio.sourceIntervals[].micDeviceId'),
  sealed(57, 'audio.sourceIntervals[].role'),
  sealed(58, 'audio.sourceIntervals[].fromMs'),
  sealed(59, 'audio.sourceIntervals[].toMs'),
  sealed(60, 'audio.sourceIntervals[].reason'),
  sealed(61, 'audio.sourceIntervals[].switchedBy'),
  sealed(62, 'files[].trackId'),
  sealed(63, 'files[].fragments[].seq'),
  sealed(64, 'files[].fragments[].byteOffset'),
  sealed(65, 'files[].fragments[].byteLength'),
  sealed(66, 'files[].fragments[].mediaStartMs'),
  sealed(67, 'files[].fragments[].mediaDurationMs'),
  sealed(68, 'files[].fragments[].sha256'),
  sealed(69, 'files[].fragments[].sha256Plain'),
  sealed(70, 'files[].fragments[].chainHash'),
  sealed(71, 'files[].fragments[].prefixSha256'),
  sealed(72, 'files[].fragments[].keyframe'),
  sealed(73, 'files[].fragments[].interrupted'),
  sealed(74, 'files[].fragments[].truncated'),
  sealed(75, 'files[].fragments[].gcmIv'),
  sealed(76, 'files[].fragments[].gcmTag'),
  sealed(77, 'files[].fragments[].keyId'),
  sealed(78, 'files[].fragments[].durableAt'),
  sealed(79, 'transcript.file'),
  sealed(80, 'transcript.docVersion'),
  sealed(81, 'transcript.sha256'),
  sealed(82, 'transcript.srtSha256'),
  sealed(83, 'transcript.vttSha256'),
  sealed(84, 'transcript.model.name'),
  sealed(85, 'transcript.model.version'),
  sealed(86, 'transcript.model.quantisation'),
  sealed(87, 'transcript.model.modelSha256'),
  sealed(88, 'transcript.diarization.numSpeakers'),
  sealed(89, 'transcript.diarization.status'),
  sealed(90, 'transcript.diarization.confidence'),
  sealed(91, 'transcript.speakerState'),
  sealed(92, 'transcript.state'),
  sealed(93, 'transcript.failedChunks'),
  sealed(94, 'transcript.revisionHead'),
  sealed(95, 'sealing.steps[].step'),
  sealed(96, 'sealing.steps[].status'),
  sealed(97, 'sealing.steps[].progress'),
  sealed(98, 'sealing.steps[].etaMs'),
  sealed(99, 'sealing.steps[].attempt'),
  sealed(100, 'sealing.steps[].checkpoint'),
  sealed(101, 'sealing.steps[].completedAt'),
  sealed(102, 'signature.algorithm'),
  sealed(103, 'signature.keyId'),
  sealed(104, 'signature.value'),
  sealed(105, 'signature.simulated'),
  sealed(106, 'signature.file'),
  sealed(107, 'signature.covers'),
  sealed(108, 'signature.certificate.file'),
  sealed(109, 'signature.certificate.sha256'),
  sealed(110, 'signature.signedAt'),
  sealed(111, 'manifestSha256'),
  exported(112, 'export.exportId'),
  exported(113, 'export.exportedAt'),
  exported(114, 'export.exportedBy'),
  exported(115, 'export.authorizationRef'),
  exported(116, 'export.derived'),
  exported(117, 'export.composite.included'),
  exported(118, 'export.composite.encoder'),
  exported(119, 'export.composite.sha256'),
  exported(120, 'export.manifestSha256'),
  sealed(121, 'transcript.disabledReason'),
  sealed(122, 'transcript.backendUnreachable'),
  sealed(123, 'transcript.configSnapshot'),
  sealed(124, 'tracks[].sourceClass'),
  sealed(125, 'audio.sourceIntervals[].sourceClass'),
  sealed(126, 'developmentSources'),
  sealed(127, 'tracks[].firstVideoSamplePts'),
  sealed(128, 'tracks[].firstVideoSampleTimescale'),
]);

/**
 * THE OPTIONAL FIELDS OF THE SEALED MANIFEST (task 4 row V4; decisions C73, C80), numbered on from
 * 128. They are NOT in `MANIFEST_V2_FIELDS`: that list is "every member a manifest must have", and
 * a manifest without one of these parses.
 *
 * WHY OPTIONAL, AGAINST THE RULE OF THIS FILE'S HEADER ("no optional member"). The rule exists so
 * that absence can never be read as a claim (a manifest without a source class must not read as
 * PRODUCTION). Every member added before this one was added as a REQUIRED key - which is right
 * only while no sealed package exists without it. Packages sealed before this step exist, and a
 * required key would make each of them fail V-01: an evidence form may not change what an existing
 * sealed package verifies as. So the member is optional and ABSENT in every package sealed before;
 * such a package has the same parse, the same canonical body, the same digest and the same verdict
 * as before. What absence means is stated and is no claim in the Core's favour: "this manifest
 * states no restart gap" - never "the audio is complete" (a package sealed before the member
 * existed could not state one; the unsigned audit extract is where its gap is). A verifier that
 * predates the member refuses a manifest that CARRIES it (strict), which is the safe side.
 */
export const MANIFEST_V2_OPTIONAL_FIELDS: readonly ManifestFieldDefinition[] = Object.freeze([
  sealed(129, 'audio.absentOnRestart[].earlierAttempt'),
  sealed(130, 'audio.absentOnRestart[].laterAttempt'),
  sealed(131, 'audio.absentOnRestart[].absentAtLeastMs'),
  sealed(132, 'audio.absentOnRestart[].absentAtMostMs'),
  // Task 4 row P1 (decision U21 (2)): optional for the SAME reason - no package sealed before it, and no
  // package a Linux production Core seals after it, may verify or read differently. What absence means
  // is stated at the member and is no claim in the Core's favour: "this manifest states nothing about
  // the host profile" - never "the host profile was in place" (a development Core asks none, and a
  // package sealed before the member could not state it).
  sealed(133, 'hostProfileNotAsked.platform'),
  // Task 4 row R1b (decision C99): optional for the SAME reason - no package sealed before it, and no
  // package of a session without a camera loss sealed after it, may verify or read differently. What
  // absence means is no claim in the Core's favour: "this manifest states no absence of this track's
  // camera" - never "the video is complete" (a package sealed before the member could not state one;
  // its `FAULT_RAISED` / `FAULT_CLEARED` rows in the unsigned audit extract are where it is).
  sealed(134, 'tracks[].absentInSession[].attempt'),
  sealed(135, 'tracks[].absentInSession[].loss'),
  sealed(136, 'tracks[].absentInSession[].absentAtLeastMs'),
  sealed(137, 'tracks[].absentInSession[].absentAtMostMs'),
  sealed(138, 'tracks[].absentInSession[].ended'),
]);
export type ManifestVideoAbsence = z.output<typeof ManifestVideoAbsenceSchema>;
export type ManifestAudioRestartGap = z.output<typeof ManifestAudioRestartGapSchema>;
export type ManifestHostProfileNotAsked = z.output<typeof ManifestHostProfileNotAskedSchema>;

/** The two members that the canonical body leaves out (spec §B.10). Nothing else is excluded. */
export const MANIFEST_SIGNATURE_EXCLUSIONS = Object.freeze(['manifestSha256', 'signature.value'] as const);
