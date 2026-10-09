/**
 * Manifest v2: `dems.evidence-manifest/2` (evidence package spec §B, 128 field definitions).
 *
 * STRICT. Every object refuses a member it does not know and every field is required as a key
 * (a nullable field is present with `null`). There is no default and no optional member: a
 * manifest without a source class does not parse, so absence can never be read as PRODUCTION
 * (spec §B.12 "Compatibility").
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
import { CAMERA_FILE_MEDIA_TYPE, MANIFEST_V2_SCHEMA_ID, MANIFEST_V2_VERSION, PackageFile, SESSION_AUDIO_TRACK_ID, VIDEO_TRACK_IDS, cameraFileName } from './layout';
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
const AudioSchema = z.strictObject({
  trackId: z.literal(SESSION_AUDIO_TRACK_ID),
  codec: text,
  containsIn: z.array(videoTrackId),
  sourceIntervals: z.array(ManifestAudioIntervalSchema),
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
};

type Issue = (path: readonly (string | number)[], message: string) => void;
type BodyShape = z.output<z.ZodObject<typeof bodyMembers>>;

/** The rules between fields that a per-field type cannot hold. Messages name members, never values. */
function crossFieldRules(manifest: BodyShape, issue: Issue): void {
  // §B.4: exactly two track records, VIDEO-01 then VIDEO-02, each with its file name.
  if (manifest.tracks.length !== VIDEO_TRACK_IDS.length) issue(['tracks'], 'exactly 2 track records');
  manifest.tracks.forEach((track, index) => {
    const expected = VIDEO_TRACK_IDS[index];
    if (expected !== undefined && track.trackId !== expected) issue(['tracks', index, 'trackId'], 'tracks are VIDEO-01 then VIDEO-02');
    if (track.file !== cameraFileName(track.trackId)) issue(['tracks', index, 'file'], 'the camera file is named after its track');
    // §B.12 fields 127 / 128: null together.
    if ((track.firstVideoSamplePts === null) !== (track.firstVideoSampleTimescale === null)) {
      issue(['tracks', index, 'firstVideoSampleTimescale'], 'null exactly when firstVideoSamplePts is null');
    }
  });
  // §B.6: one fragment array per camera file, in track order.
  if (manifest.files.length !== VIDEO_TRACK_IDS.length) issue(['files'], 'exactly 2 file records');
  manifest.files.forEach((file, index) => {
    const expected = VIDEO_TRACK_IDS[index];
    if (expected !== undefined && file.trackId !== expected) issue(['files', index, 'trackId'], 'files are VIDEO-01 then VIDEO-02');
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

  // §B.12 field 126 and rule 5: the flag is exactly the summary of fields 124 and 125.
  const classes = [...manifest.tracks.map((track) => track.sourceClass), ...intervals.map((interval) => interval.sourceClass)];
  if (manifest.developmentSources !== deriveDevelopmentSources(classes)) issue(['developmentSources'], 'equals "some source is not PRODUCTION"');
  // §B.12 rule 6: a demo package has FAKE on every source.
  if ((manifest.demo || manifest.integrity === 'DEMO_PACKAGE') && classes.some((value) => value !== ManifestSourceClass.FAKE)) {
    issue(['developmentSources'], 'a demo package has FAKE on every source');
  }

  // §B.2 field 12: `stoppedAt` is null only for an interrupted seal.
  if (manifest.timeline.stoppedAt === null && !manifest.timeline.interrupted) issue(['timeline', 'stoppedAt'], 'null only for an interrupted seal');

  transcriptRules(manifest.transcript, issue);
}

/**
 * §B.7 / §B.7a and decision D110: the transcript block is ONE of four shapes, and nothing between.
 *
 *   state      document            field 121 (reason)               snapshot.enabled  backendUnreachable
 *   ASSEMBLED  sealed, 79-94 set   null                             true              false
 *   PARTIAL    sealed, 79-94 set   null                             true              either
 *   PARTIAL    NONE, 79-91, 94 null TRANSCRIPT_UNAVAILABLE_AT_SEAL  true              either
 *   DISABLED   NONE, 79-94 null    DISABLED_BY_CONFIGURATION        false             false
 *
 * "Document" is fields 79-91 and 94 (and 90, which a document may leave null). Field 93
 * `failedChunks` is a count wherever a document is sealed; without one it is null when disabled,
 * and the number of planned chunks - or null where the plan is not known - when unavailable.
 * So: a transcript that claims to be there without a document is refused; a declared absence that
 * carries a hash is refused; a reason never stands beside a document; each reason has one state.
 */
function transcriptRules(transcript: BodyShape['transcript'], issue: Issue): void {
  const at = (path: readonly string[], message: string): void => issue(['transcript', ...path], message);
  /** Fields 79-89, 91, 94: set exactly when a document is sealed. */
  const docFields: readonly (readonly [readonly string[], unknown])[] = [
    [['file'], transcript.file],
    [['docVersion'], transcript.docVersion],
    [['sha256'], transcript.sha256],
    [['srtSha256'], transcript.srtSha256],
    [['vttSha256'], transcript.vttSha256],
    [['model', 'name'], transcript.model.name],
    [['model', 'version'], transcript.model.version],
    [['model', 'quantisation'], transcript.model.quantisation],
    [['model', 'modelSha256'], transcript.model.modelSha256],
    [['diarization', 'numSpeakers'], transcript.diarization.numSpeakers],
    [['diarization', 'status'], transcript.diarization.status],
    [['speakerState'], transcript.speakerState],
    [['revisionHead'], transcript.revisionHead],
  ];
  const reason = transcript.disabledReason;
  const absent = (why: string): void => {
    for (const [path, value] of docFields) if (value !== null) at(path, why);
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

/** The two members that the canonical body leaves out (spec §B.10). Nothing else is excluded. */
export const MANIFEST_SIGNATURE_EXCLUSIONS = Object.freeze(['manifestSha256', 'signature.value'] as const);
