/**
 * §21.3 Core Data Entities (research/01_explore.md L370-L385; masterplan/01_specs.md §2.2).
 *
 * Rule: each stub carries only the attributes the design book itself fixes. The book
 * defines no other attributes (01 G10), so the feature phase adds them from §11.3,
 * §19.2, §24.1 and §25.3.
 */
import type { EntityId } from './ids';
import type { AudioTrackId, SessionState, TimeSource, VideoTrackId } from './enums';

/** The 24 entity names, in the book's order (8 groups of 3). */
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

/** Name → interface map; lets generic code stay exhaustive over the 24 entities. */
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
}

// Compile-time proof that ENTITY_NAMES and EntityByName list the same 24 names.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const entityNamesMatch: Exact<EntityName, keyof EntityByName> = true;
void entityNamesMatch;
