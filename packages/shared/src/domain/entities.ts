/**
 * §21.3 Core Data Entities (research/01_explore.md L370-L385; masterplan/01_specs.md §2.2).
 *
 * Rule: each stub carries only the attributes the design book itself fixes. The book
 * defines no other attributes (01 G10), so the feature phase adds them from §11.3,
 * §19.2, §24.1 and §25.3.
 */
import type { EntityId } from './ids';
import type {
  AudioTrackId,
  MicInputId,
  MicRole,
  SessionState,
  TimeSource,
  VideoTrackId,
} from './enums';

/**
 * The 24 entity names in the book's order (8 groups of 3), plus the seven the capture/sealing
 * phase adds (register SH-02). The book's 24 stay a prefix in their exact order; the seven v2
 * entities are appended as one group so any code that walks the book's list is unaffected.
 */
export const ENTITY_NAMES = [
  // Device
  'Device',
  'HardwareRevision',
  'SoftwareRelease',
  // Identity
  'Operator',
  'Role',
  'AuthenticationEvent',
  // Session
  'Session',
  'CaseReference',
  'SubjectWitnessMetadata',
  // Tracks
  'VideoTrack',
  'AudioTrack',
  'TrackHealthEvent',
  // Evidence
  'EvidenceObject',
  'Manifest',
  'SignatureRecord',
  // Audit
  'AuditEvent',
  'ExportEvent',
  'TamperEvent',
  // Trust
  'Certificate',
  'KeyReference',
  'ProvisioningRecord',
  // Health
  'HealthSnapshot',
  'StorageDevice',
  'TimeSourceState',
  // Capture and sealing v2 (register SH-02; appended as one group)
  'EvidenceFile',
  'AudioSourceInterval',
  'FragmentCheckpoint',
  'Transcript',
  'TranscriptRevision',
  'CaptureConfig',
  'CaptureDevice',
] as const;
export type EntityName = (typeof ENTITY_NAMES)[number];

// Device
export interface Device {
  readonly id: EntityId<'Device'>;
}
export interface HardwareRevision {
  readonly id: EntityId<'HardwareRevision'>;
}
export interface SoftwareRelease {
  readonly id: EntityId<'SoftwareRelease'>;
}

// Identity
export interface Operator {
  readonly id: EntityId<'Operator'>;
}
/** Role names are a book gap (01 G1); the feature phase defines them. */
export interface Role {
  readonly id: EntityId<'Role'>;
}
export interface AuthenticationEvent {
  readonly id: EntityId<'AuthenticationEvent'>;
}

// Session
export interface Session {
  readonly id: EntityId<'Session'>;
  /** §6.2 */
  state: SessionState;
}
export interface CaseReference {
  readonly id: EntityId<'CaseReference'>;
}
/** The book's "Subject/Witness metadata". */
export interface SubjectWitnessMetadata {
  readonly id: EntityId<'SubjectWitnessMetadata'>;
}

// Tracks
export interface VideoTrack {
  readonly id: EntityId<'VideoTrack'>;
  /** §6.3 */
  trackId: VideoTrackId;
}
export interface AudioTrack {
  readonly id: EntityId<'AudioTrack'>;
  /** §6.3 */
  trackId: AudioTrackId;
}
export interface TrackHealthEvent {
  readonly id: EntityId<'TrackHealthEvent'>;
}

// Evidence
export interface EvidenceObject {
  readonly id: EntityId<'EvidenceObject'>;
}
export interface Manifest {
  readonly id: EntityId<'Manifest'>;
}
export interface SignatureRecord {
  readonly id: EntityId<'SignatureRecord'>;
}

// Audit
export interface AuditEvent {
  readonly id: EntityId<'AuditEvent'>;
}
export interface ExportEvent {
  readonly id: EntityId<'ExportEvent'>;
}
export interface TamperEvent {
  readonly id: EntityId<'TamperEvent'>;
}

// Trust
export interface Certificate {
  readonly id: EntityId<'Certificate'>;
}
export interface KeyReference {
  readonly id: EntityId<'KeyReference'>;
}
export interface ProvisioningRecord {
  readonly id: EntityId<'ProvisioningRecord'>;
}

// Health
export interface HealthSnapshot {
  readonly id: EntityId<'HealthSnapshot'>;
}
export interface StorageDevice {
  readonly id: EntityId<'StorageDevice'>;
}
export interface TimeSourceState {
  readonly id: EntityId<'TimeSourceState'>;
  /** §2.2, §5.3 */
  source: TimeSource;
}

// ── Schema v2 (task 3, register SH-02; `dbc-3 §B`, `C3 §2.3`/`§6`) ──────────────────────────
// These seven are the domain shapes the capture/sealing phase adds. Each carries only the
// attributes the contracts themselves fix; the wire forms are the zod schemas of
// `api/state-slices.ts` (SH-16) and the operation shapes of `C3 §2.3`.

/**
 * One whole media FILE inside the sealed package (v2 replaces the v1 per-track rows:
 * `dbc-3 §B.12`, D224/D225). `sha256` is the hash of the **stored** (encrypted) bytes and
 * `sha256Plain` the hash of the plaintext (D-DB-02).
 */
export interface EvidenceFile {
  readonly id: EntityId<'EvidenceFile'>;
  evidenceId: EntityId<'EvidenceObject'>;
  /** `VIDEO-01`/`VIDEO-02`: the camera file this row describes. */
  trackId: VideoTrackId;
  kind: 'FILE';
  containsAudio: boolean;
  codec: string | null;
  durationMs: number | null;
  fragmentCount: number | null;
  /** Head of the per-fragment hash chain (`dbc-3 §B.12`). */
  fragmentChainHead: string | null;
  /** Hash of the stored bytes as they sit on disk. */
  sha256: string;
  /** Hash of the plaintext bytes; null while the v1 shape is in force. */
  sha256Plain: string | null;
}

/**
 * One interval of one mic input inside `AUDIO-01` (`dbc-3 §B.5`; R-3). Times are **media pts**
 * in ms, never operator wall clock (S2 §6 finding 3); `fromAt`/`toAt` are the UTC-ms record kept
 * alongside. An open interval has both `to*` members null.
 */
export interface AudioSourceInterval {
  sessionId: EntityId<'Session'>;
  seq: number;
  /** The mic device of this interval (`MIC-01`/`MIC-02`). */
  micDeviceId: MicInputId;
  role: MicRole;
  fromMediaMs: number;
  toMediaMs: number | null;
  fromAt: number;
  toAt: number | null;
  /** The actor of the manual toggle that opened it (OD-09); null when the run opened it. */
  switchedBy: EntityId<'Operator'> | null;
  reason: 'START' | 'MANUAL' | 'STOP';
}

/** One closed fragment of one camera file (`dbc-3 §B.6`; NM-04, OD-03). */
export interface FragmentCheckpoint {
  sessionId: EntityId<'Session'>;
  trackId: VideoTrackId;
  seq: number;
  byteOffset: number;
  byteLength: number;
  mediaStartMs: number;
  mediaDurationMs: number;
  /** SHA-256 of the stored fragment bytes. */
  sha256: string;
  /** Chain hash over the fragments of this file; the first row's anchor is the empty digest. */
  chainHash: string;
  durableAt: number;
}

/**
 * The sealed machine transcript of one evidence item (`dbc-3 §B.8`). The machine transcript is
 * revision 0 and is byte-unchanged forever (OD-15).
 */
export interface Transcript {
  evidenceId: EntityId<'EvidenceObject'>;
  jsonSha256: string;
  srtSha256: string;
  vttSha256: string;
  /** Model provenance: name, version, quantisation, params, model-file hash (`ev §B`). */
  model: Record<string, string | number>;
  /** Diarization summary: `numSpeakers`, status, confidence (`ev §B`). */
  diarization: Record<string, string | number>;
  labelsStatus: 'LABELLED' | 'UNAVAILABLE';
  createdAt: number;
}

/**
 * One signed correction of a transcript (`dbc-3 §B.9`; OD-15). `baseRevision` is not stored: it
 * is the `max(revision_no)` read inside the minting transaction (SEC35-21).
 */
export interface TranscriptRevision {
  evidenceId: EntityId<'EvidenceObject'>;
  revisionNo: number;
  /** Revision 0's parent is `transcripts.jsonSha256`. */
  parentSha256: string;
  sha256: string;
  authorId: EntityId<'Operator'>;
  reason: string;
  signatureValue: string;
  signatureKeyId: string;
  signatureAlgorithm: 'Ed25519' | 'SIMULATED-SHA256';
  signatureSimulated: boolean;
  /** The certificate that signed this revision (SEC35-20); null when none was bound. */
  signatureCertificateSha256: string | null;
  createdAt: number;
}

/**
 * The persistent device selector (`dbc-3 §B.1`; ops 76-80). Snapshotted into
 * `active_session.capture_config` at session start (SH-06), which is why the config is locked
 * while a session is open (OD-10).
 *
 * Task 4 row 28 (WP-13a; schema set A; row 27 site A9): a slot may be UNASSIGNED. The six slot
 * members are `null` then, as the six nullable columns of `capture_config` are; per video slot
 * the device and its profile are both `null` or both set (CHECK `capture_config_slot_pair_check`).
 * Only the `unassign` member of operation 78 clears a slot.
 */
export interface CaptureConfig {
  /** Device feeding `VIDEO-01`; `null`: the slot is not assigned. */
  video01DeviceId: string | null;
  video01Profile: string | null;
  video02DeviceId: string | null;
  video02Profile: string | null;
  micPrimaryId: MicInputId | null;
  micStandbyId: MicInputId | null;
  /** Optimistic-concurrency counter (`C3 §2.4`; `REVISION_CONFLICT`). */
  revision: number;
  updatedBy: EntityId<'Operator'> | null;
  updatedAt: number;
}

/**
 * One entry of the capture-device registry (`dbc-3 §B.2`). This is **never** the paired-client
 * registry: `AdminResource.DEVICES` stays what it was (E-04). Carries no credential — the secret
 * lives in `capture_device_credentials` and is write-only through op 89 (RK-12, SEC35-01).
 */
export interface CaptureDevice {
  readonly id: EntityId<'CaptureDevice'>;
  kind: 'CAMERA' | 'MIC' | 'POE';
  /** Open set (`CODE` format): transports may change without a migration (OD-06/OD-07, MG-11). */
  transport: string;
  model: string | null;
  firmware: string | null;
  address: string | null;
  mac: string | null;
  /** Media profiles this device offers (OD-05 dual-lens topology). */
  profiles: readonly string[];
  poePort: string | null;
  enabled: boolean;
  lastSeenAt: number | null;
}

/** Name → interface map; lets generic code stay exhaustive over the 31 entities. */
export interface EntityByName {
  Device: Device;
  HardwareRevision: HardwareRevision;
  SoftwareRelease: SoftwareRelease;
  Operator: Operator;
  Role: Role;
  AuthenticationEvent: AuthenticationEvent;
  Session: Session;
  CaseReference: CaseReference;
  SubjectWitnessMetadata: SubjectWitnessMetadata;
  VideoTrack: VideoTrack;
  AudioTrack: AudioTrack;
  TrackHealthEvent: TrackHealthEvent;
  EvidenceObject: EvidenceObject;
  Manifest: Manifest;
  SignatureRecord: SignatureRecord;
  AuditEvent: AuditEvent;
  ExportEvent: ExportEvent;
  TamperEvent: TamperEvent;
  Certificate: Certificate;
  KeyReference: KeyReference;
  ProvisioningRecord: ProvisioningRecord;
  HealthSnapshot: HealthSnapshot;
  StorageDevice: StorageDevice;
  TimeSourceState: TimeSourceState;
  EvidenceFile: EvidenceFile;
  AudioSourceInterval: AudioSourceInterval;
  FragmentCheckpoint: FragmentCheckpoint;
  Transcript: Transcript;
  TranscriptRevision: TranscriptRevision;
  CaptureConfig: CaptureConfig;
  CaptureDevice: CaptureDevice;
}

// Compile-time proof that ENTITY_NAMES and EntityByName list the same names.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const entityNamesMatch: Exact<EntityName, keyof EntityByName> = true;
void entityNamesMatch;
