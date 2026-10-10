/**
 * One entity, one row builder, one way back (plan row W20; database contract §4, MR-2, MR-5,
 * MR-9). Every function here is pure: no clock, no random source, no database.
 *
 * FULL ROWS. A builder returns the row as the table holds it, every column present, in the
 * select shape of the typed schema. So nothing depends on a column default, a written row can
 * be compared with a row read back, and the same row type goes in both directions.
 *
 * REFERENCES. A value that goes into a JSON column is passed through by reference, never
 * copied: the engine host tells what changed by comparing references.
 *
 * WHAT A STATE DOES NOT HOLD. Some columns are bookkeeping of the row, not members of a slice:
 * `created_at`, `updated_at`, `written_at`, `seeded_at`, `last_reset_at`, and the server-native
 * columns of `operators`. They come from the `RowContext`, and the way back ignores them.
 *
 * AN ABSENT OPTIONAL MEMBER (MR-2) is stored as NULL. On the way back NULL becomes the empty
 * form the shared code itself uses for that member, so that a state survives the round trip
 * unchanged:
 *
 *   member                                               empty form in the shared code   NULL reads as
 *   ActiveSession.startTimeSource, .stopTimeSource       absent until the recording      absent
 *                                                        starts or stops
 *   SessionHistoryEntry.startTimeSource, .endTimeSource  null                            null
 *   EvidenceItem.startTimeSource, .endTimeSource,        null                            null
 *     .tamperedTrackId
 *   EvidenceItem.caseType, .integritySource              always set                      absent (the type has no null)
 *   EvidenceItem.markers, .notes                         always set (an empty list)      an empty list (NOT NULL column)
 *   SimAlert.target                                      null                            null
 *   SimAlert.params                                      always set                      absent (the type has no null)
 *   meta.counters.export                                 absent until the first export   absent (no row)
 *
 * The shared code reads every one of these with `?? null` or `?? []`, so the two empty forms
 * behave alike; the table only decides which one a rehydrated state holds.
 */
import { DEFAULT_CAPTURE_DEVICES, EVIDENCE_FILE_TRACKS, SIM_SNAPSHOT_VERSION, eventCategory } from '@dems/shared/sim';
import type {
  ActiveSession,
  AuditRow,
  CaptureConfigSlice,
  CaptureDevicesSlice,
  CustodyEntry,
  EvidenceFileEntry,
  EvidenceItem,
  EvidenceTrack,
  SessionHistoryEntry,
  SettingsSlice,
  SimAlert,
  SimCounters,
  SimEvent,
  SimOperator,
  SimState,
  StoragePolicy,
} from '@dems/shared/sim';
import type {
  ActiveSessionRow,
  AlertRow,
  AuditLogRow,
  CaptureConfigRow,
  CaptureDeviceRow,
  ConsoleSettingsRow,
  CoreDeviceRow,
  CoreStateRow,
  EngineCounterName,
  EngineCounterRow,
  EventRow,
  EvidenceCustodyRow,
  EvidenceItemRow,
  EvidenceTrackRow,
  HardwareSnapshotRow,
  OperatorRow,
  SessionHistoryRow,
  StoragePolicyRow,
} from '../schema';
import type { CaptureAdapterKindValue, CaptureDeviceKindValue } from '../schema';
import { MappingError, safeInteger, safeIntegerOrNull, storableJson, storableText, storableTextOrNull } from './guards';
import { SNAPSHOT_SLICE_KEYS, type DurableSlices, type MappableState } from './slices';

/** The bookkeeping values of a write. All three are instants on the server clock. */
export interface RowContext {
  /** The instant of this write: `created_at`, `updated_at` and `written_at` of the rows it writes. */
  readonly at: number;
  /** `core_state.seeded_at`: the `now` of the seed that built the database. */
  readonly seededAt: number;
  /** `core_state.last_reset_at`: null after a first seed. */
  readonly lastResetAt: number | null;
}

/** The counters in the order the shared state declares them. */
export const COUNTER_NAMES = ['event', 'session', 'caseNumber', 'evidence', 'item', 'export'] as const satisfies readonly EngineCounterName[];

// ── operators ──────────────────────────────────────────────────────────────────────────────────

/** A seeded operator: enabled, never signed in, role never changed (SD-4). */
export function operatorToRow(operator: SimOperator, context: RowContext): OperatorRow {
  return {
    id: storableText(operator.id, 'operators.id'),
    username: storableText(operator.username, 'operators.username'),
    rank: storableTextOrNull(operator.rank, 'operators.rank'),
    name: storableText(operator.name, 'operators.name'),
    displayName: storableText(operator.displayName, 'operators.display_name'),
    initials: storableText(operator.initials, 'operators.initials'),
    roleId: operator.role,
    enabled: true,
    lastSignInAt: null,
    roleChangedAt: null,
    createdAt: safeInteger(context.at, 'operators.created_at'),
    updatedAt: safeInteger(context.at, 'operators.updated_at'),
  };
}

/** The identity fields and the role: what the engine's `operators` slice holds (never `enabled`, never a hash). */
export function operatorFromRow(
  row: Pick<OperatorRow, 'id' | 'username' | 'rank' | 'name' | 'displayName' | 'initials' | 'roleId'>,
): SimOperator {
  return {
    id: row.id,
    username: row.username,
    rank: row.rank,
    name: row.name,
    displayName: row.displayName,
    initials: row.initials,
    role: row.roleId,
  };
}

// ── core_device ────────────────────────────────────────────────────────────────────────────────

export function coreDeviceToRow(
  device: SimState['device'],
  certificateFingerprint: string,
  context: RowContext,
): CoreDeviceRow {
  const identity = device.identity;
  const text = (value: string, column: string): string => storableText(value, `core_device.${column}`);
  return {
    singleton: true,
    id: text(device.id, 'id'),
    name: text(device.name, 'name'),
    room: text(device.room, 'room'),
    productName: text(device.productName, 'product_name'),
    softwareVersion: text(device.softwareVersion, 'software_version'),
    certificateFingerprint: text(certificateFingerprint, 'certificate_fingerprint'),
    serialNumber: text(identity.serialNumber, 'serial_number'),
    hardwareUuid: text(identity.hardwareUuid, 'hardware_uuid'),
    chassisRevision: text(identity.chassisRevision, 'chassis_revision'),
    somPartRevision: text(identity.somPartRevision, 'som_part_revision'),
    audioBoardRevision: text(identity.audioBoardRevision, 'audio_board_revision'),
    poeBoardRevision: text(identity.poeBoardRevision, 'poe_board_revision'),
    powerBoardRevision: text(identity.powerBoardRevision, 'power_board_revision'),
    bspVersion: text(identity.bspVersion, 'bsp_version'),
    coreSoftwareVersion: text(identity.coreSoftwareVersion, 'core_software_version'),
    tabletAppVersion: text(identity.tabletAppVersion, 'tablet_app_version'),
    tpmModelFirmware: text(identity.tpmModelFirmware, 'tpm_model_firmware'),
    cameraModelFirmware: text(identity.cameraModelFirmware, 'camera_model_firmware'),
    provisioningRecordId: text(identity.provisioningRecordId, 'provisioning_record_id'),
    deviceCertificateId: text(identity.deviceCertificateId, 'device_certificate_id'),
    updatedAt: safeInteger(context.at, 'core_device.updated_at'),
  };
}

export function coreDeviceFromRow(row: CoreDeviceRow): SimState['device'] {
  return {
    id: row.id,
    name: row.name,
    room: row.room,
    productName: row.productName,
    softwareVersion: row.softwareVersion,
    identity: {
      serialNumber: row.serialNumber,
      hardwareUuid: row.hardwareUuid,
      chassisRevision: row.chassisRevision,
      somPartRevision: row.somPartRevision,
      audioBoardRevision: row.audioBoardRevision,
      poeBoardRevision: row.poeBoardRevision,
      powerBoardRevision: row.powerBoardRevision,
      bspVersion: row.bspVersion,
      coreSoftwareVersion: row.coreSoftwareVersion,
      tabletAppVersion: row.tabletAppVersion,
      tpmModelFirmware: row.tpmModelFirmware,
      cameraModelFirmware: row.cameraModelFirmware,
      provisioningRecordId: row.provisioningRecordId,
      deviceCertificateId: row.deviceCertificateId,
    },
  };
}

// ── core_state and engine_counters (the `meta` slice and the two `lastSealed` slices) ──────────

export function coreStateToRow(
  state: Pick<SimState, 'meta' | 'lastSealedSessionId' | 'lastSealedAcknowledged'>,
  context: RowContext,
): CoreStateRow {
  return {
    singleton: true,
    seed: safeInteger(state.meta.seed, 'core_state.seed'),
    simSchemaVersion: safeInteger(state.meta.schemaVersion, 'core_state.sim_schema_version'),
    scenario: state.meta.scenario,
    epoch: safeInteger(state.meta.epoch, 'core_state.epoch'),
    createdAt: safeInteger(state.meta.createdAt, 'core_state.created_at'),
    seededAt: safeInteger(context.seededAt, 'core_state.seeded_at'),
    lastResetAt: safeIntegerOrNull(context.lastResetAt, 'core_state.last_reset_at'),
    lastSealedSessionId: storableTextOrNull(state.lastSealedSessionId, 'core_state.last_sealed_session_id'),
    lastSealedAcknowledged: state.lastSealedAcknowledged,
    updatedAt: safeInteger(context.at, 'core_state.updated_at'),
  };
}

/** One row per counter the state holds. `export` has no row until the first export. */
export function countersToRows(counters: SimCounters): EngineCounterRow[] {
  const rows: EngineCounterRow[] = [];
  for (const name of COUNTER_NAMES) {
    const value = counters[name];
    if (value !== undefined) rows.push({ name, nextValue: safeInteger(value, `engine_counters.next_value (${name})`) });
  }
  return rows;
}

export function countersFromRows(rows: readonly EngineCounterRow[]): SimCounters {
  const byName = new Map(rows.map((row) => [row.name, row.nextValue] as const));
  const required = (name: EngineCounterName): number => {
    const value = byName.get(name);
    if (value === undefined) throw new MappingError('ROW_SHAPE', 'engine_counters', `the counter ${name} has no row.`);
    return value;
  };
  const exported = byName.get('export');
  return {
    event: required('event'),
    session: required('session'),
    caseNumber: required('caseNumber'),
    evidence: required('evidence'),
    item: required('item'),
    ...(exported === undefined ? {} : { export: exported }),
  };
}

export function metaFromRows(state: CoreStateRow, counters: readonly EngineCounterRow[]): SimState['meta'] {
  if (state.simSchemaVersion !== SIM_SNAPSHOT_VERSION) {
    throw new MappingError(
      'ROW_SHAPE',
      'core_state.sim_schema_version',
      `the stored state has shape version ${state.simSchemaVersion}; this mapping reads version ${SIM_SNAPSHOT_VERSION}.`,
    );
  }
  return {
    schemaVersion: SIM_SNAPSHOT_VERSION,
    seed: state.seed,
    scenario: state.scenario,
    epoch: state.epoch,
    createdAt: state.createdAt,
    counters: countersFromRows(counters),
  };
}

// ── storage_policy, console_settings ───────────────────────────────────────────────────────────

export function storagePolicyToRow(policy: StoragePolicy, context: RowContext): StoragePolicyRow {
  return {
    singleton: true,
    retentionPolicy: policy.retentionPolicy,
    retentionDays: safeInteger(policy.retentionDays, 'storage_policy.retention_days'),
    autoArchive: policy.autoArchive,
    updatedAt: safeInteger(context.at, 'storage_policy.updated_at'),
  };
}

export function storagePolicyFromRow(row: StoragePolicyRow): StoragePolicy {
  return { retentionPolicy: row.retentionPolicy, retentionDays: row.retentionDays, autoArchive: row.autoArchive };
}

export function settingsToRow(settings: SettingsSlice, context: RowContext): ConsoleSettingsRow {
  return {
    singleton: true,
    presentationMode: settings.presentationMode,
    timeFormat: settings.timeFormat,
    notifyWarnings: settings.notifyWarnings,
    notifySound: settings.notifySound,
    updatedAt: safeInteger(context.at, 'console_settings.updated_at'),
  };
}

export function settingsFromRow(row: ConsoleSettingsRow): SettingsSlice {
  return {
    presentationMode: row.presentationMode,
    timeFormat: row.timeFormat,
    notifyWarnings: row.notifyWarnings,
    notifySound: row.notifySound,
  };
}

// ── hardware_snapshot (the 15 snapshot slices) ─────────────────────────────────────────────────

export function hardwareSnapshotToRow(state: Pick<MappableState, 'meta' | (typeof SNAPSHOT_SLICE_KEYS)[number]>, context: RowContext): HardwareSnapshotRow {
  const json = <T>(value: T, column: string): T => storableJson(value, `hardware_snapshot.${column}`);
  return {
    singleton: true,
    simSchemaVersion: safeInteger(state.meta.schemaVersion, 'hardware_snapshot.sim_schema_version'),
    tabletLink: json(state.tabletLink, 'tablet_link'),
    activeCameraId: state.activeCameraId,
    cameras: json(state.cameras, 'cameras'),
    mics: json(state.mics, 'mics'),
    storage: json(state.storage, 'storage'),
    timeStatus: json(state.time, 'time_status'),
    network: json(state.network, 'network'),
    security: json(state.security, 'security'),
    services: json(state.services, 'services'),
    health: json(state.health, 'health'),
    otherDevices: json(state.otherDevices, 'other_devices'),
    ports: json(state.ports, 'ports'),
    faults: json(state.faults, 'faults'),
    // No diagnostics run: SQL NULL, never the JSON literal null (J-4).
    diagnostics: state.diagnostics === null ? null : json(state.diagnostics, 'diagnostics'),
    softwareUpdate: json(state.update, 'software_update'),
    writtenAt: safeInteger(context.at, 'hardware_snapshot.written_at'),
  };
}

export function snapshotSlicesFromRow(row: HardwareSnapshotRow): Pick<DurableSlices, (typeof SNAPSHOT_SLICE_KEYS)[number]> {
  if (row.simSchemaVersion !== SIM_SNAPSHOT_VERSION) {
    throw new MappingError(
      'ROW_SHAPE',
      'hardware_snapshot.sim_schema_version',
      `the stored snapshot has shape version ${row.simSchemaVersion}; this mapping reads version ${SIM_SNAPSHOT_VERSION}.`,
    );
  }
  return {
    tabletLink: row.tabletLink,
    activeCameraId: row.activeCameraId,
    cameras: row.cameras,
    mics: row.mics,
    storage: row.storage,
    time: row.timeStatus,
    network: row.network,
    security: row.security,
    services: row.services,
    health: row.health,
    otherDevices: row.otherDevices,
    ports: row.ports,
    faults: row.faults,
    diagnostics: row.diagnostics,
    update: row.softwareUpdate,
  };
}

// ── session_history ────────────────────────────────────────────────────────────────────────────

/** `evidenceId` is not a column: it is the item whose `session_id` is this entry's ID (MR-5). */
export function sessionHistoryToRow(entry: SessionHistoryEntry): SessionHistoryRow {
  const place = (column: string): string => `session_history.${column} (${entry.id})`;
  return {
    id: storableText(entry.id, 'session_history.id'),
    outcome: entry.outcome,
    caseNumber: storableText(entry.caseNumber, place('case_number')),
    subjectName: storableText(entry.subjectName, place('subject_name')),
    subjectType: entry.subjectType,
    investigatorId: storableText(entry.investigatorId, place('investigator_id')),
    room: storableText(entry.room, place('room')),
    profileId: entry.profileId,
    createdAt: safeInteger(entry.createdAt, place('created_at')),
    startedAt: safeIntegerOrNull(entry.startedAt, place('started_at')),
    endedAt: safeInteger(entry.endedAt, place('ended_at')),
    durationMs: safeInteger(entry.durationMs, place('duration_ms')),
    sizeBytes: safeInteger(entry.sizeBytes, place('size_bytes')),
    faultKind: entry.faultKind,
    startTimeSource: entry.startTimeSource ?? null,
    endTimeSource: entry.endTimeSource ?? null,
  };
}

export function sessionHistoryFromRow(row: SessionHistoryRow, evidenceId: string | null): SessionHistoryEntry {
  return {
    id: row.id,
    outcome: row.outcome,
    caseNumber: row.caseNumber,
    subjectName: row.subjectName,
    subjectType: row.subjectType,
    investigatorId: row.investigatorId,
    room: row.room,
    profileId: row.profileId,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMs: row.durationMs,
    sizeBytes: row.sizeBytes,
    evidenceId,
    faultKind: row.faultKind,
    startTimeSource: row.startTimeSource,
    endTimeSource: row.endTimeSource,
  };
}

// ── evidence_items, evidence_tracks, evidence_custody ──────────────────────────────────────────

/**
 * THE THREE SEALED COLUMNS OF A V2 ITEM (dbc-3 §B.11), as the seal hands them to the item's INSERT:
 * `FinalizedTranscript.itemColumns` of `src/sealing` (`SealedItemColumns`; mirrored structurally,
 * the mapping imports no unit). The seal spreads them onto the state item - `transcriptSha256` is a
 * member of the shared item already; `manifestVersion` and `labelsStatus` are read here as optional
 * members the shared `EvidenceItem` type does not declare yet (request filed by row 129b: two
 * optional members beside `transcriptSha256` in `sim/types.ts` and in the evidence item schema).
 *
 * WHY NOT DERIVED FROM THE HASH ALONE (row 79's finding): a v2 item sealed with STT DISABLED, or
 * with no document at the seal, carries no transcript hash by design (ev §B.7a). The derivation
 * `transcriptSha256 != null` stored such an item as version 1.
 */
export type SealedLabelsStatus = 'LABELLED' | 'UNAVAILABLE';
export interface SealedItemMembers {
  readonly manifestVersion?: 1 | 2;
  readonly labelsStatus?: SealedLabelsStatus | null;
}
export type SealedEvidenceItem = EvidenceItem & SealedItemMembers;

const SEALED_LABELS: readonly string[] = ['LABELLED', 'UNAVAILABLE'];

/** `manifest_version` and `labels_status` of one item; refuses a combination no seal produces. */
function sealedColumnsOf(item: EvidenceItem): { manifestVersion: 1 | 2; labelsStatus: SealedLabelsStatus | null } {
  const members = item as { manifestVersion?: unknown; labelsStatus?: unknown };
  const stated = members.manifestVersion;
  const labels = members.labelsStatus ?? null;
  if (stated !== undefined && stated !== 1 && stated !== 2) {
    throw new MappingError('ROW_SHAPE', `evidence_items.manifest_version (${item.id})`, 'the manifest version of an item is 1 or 2.');
  }
  if (labels !== null && (typeof labels !== 'string' || !SEALED_LABELS.includes(labels))) {
    throw new MappingError('ROW_SHAPE', `evidence_items.labels_status (${item.id})`, 'the speaker state of a sealed item is LABELLED, UNAVAILABLE or absent.');
  }
  // 2 for every v2 seal: the seal says so itself, or (the items written before the member existed,
  // and the simulator's own seal) the item binds a transcript hash.
  const manifestVersion = stated === 2 || item.transcriptSha256 != null ? 2 : 1;
  if (stated === 1 && manifestVersion === 2) {
    throw new MappingError('ROW_SHAPE', `evidence_items.manifest_version (${item.id})`, 'an item that binds a transcript hash is a version 2 item; it states version 1.');
  }
  if (manifestVersion === 1 && labels !== null) {
    throw new MappingError('ROW_SHAPE', `evidence_items.labels_status (${item.id})`, 'a version 1 item has no speaker state.');
  }
  return { manifestVersion, labelsStatus: labels as SealedLabelsStatus | null };
}

/** `development_sources` of one item: the seal's boolean, or NULL where the item states none. */
function developmentSourcesOf(item: EvidenceItem): boolean | null {
  const stated = item.developmentSources ?? null;
  if (stated !== null && typeof stated !== 'boolean') {
    throw new MappingError('ROW_SHAPE', `evidence_items.development_sources (${item.id})`, 'the development mark of an item is true, false or absent.');
  }
  return stated;
}

/**
 * The signature of a stored item, on the way back (dbc-3 §C.4; finding F-82-4, pass D4). Two pairs
 * exist and each has ONE writer:
 *   (SIMULATED-SHA256, simulated, 64 hex)   every v1 item and the simulator's own v2 seal, as before;
 *   (Ed25519, not simulated, 128 hex)       the item of a REAL v2 seal (`completeSealTransition`):
 *                                           admitted on a row that is `integrity_source` REAL AND
 *                                           `manifest_version` 2 - and on the row of a SEED-SEALED
 *                                           demo item (pass E3: `DEMO_PACKAGE`, version 2,
 *                                           `development_sources` true). No v1 row, no simulated
 *                                           item and no frozen demo item can come back as really
 *                                           signed.
 * Any other combination is not a row the mapping wrote, and is refused. `ECDSA-P256-SHA256` is a
 * value the column admits and no seal of this phase writes: refused.
 */
function signatureFromRow(row: EvidenceItemRow): EvidenceItem['signature'] {
  if (row.signatureSimulated === true) {
    // C.4 ties `simulated = true` to `algorithm = 'SIMULATED-SHA256'`.
    if (row.signatureAlgorithm !== 'SIMULATED-SHA256') {
      throw new MappingError(
        'ROW_SHAPE',
        `evidence_items.signature_algorithm (${row.id})`,
        `a simulated signature must carry algorithm SIMULATED-SHA256; the row holds ${row.signatureAlgorithm}.`,
      );
    }
    return { value: row.signatureValue, keyId: row.signatureKeyId, algorithm: 'SIMULATED-SHA256', simulated: true };
  }
  if (row.signatureAlgorithm !== 'Ed25519' || !REAL_SIGNATURE_VALUE.test(row.signatureValue)) {
    throw new MappingError(
      'ROW_SHAPE',
      `evidence_items.signature_algorithm (${row.id})`,
      `a real signature rehydrated into the state is an Ed25519 signature of 128 hex characters; the row holds ${row.signatureAlgorithm}.`,
    );
  }
  // The ONE other writer of a real signature (integration pass E3; ev F.2 - F.4): the seed, for a demo
  // item whose package it SEALED into this Core's store with the development key. Such a row is
  // `DEMO_PACKAGE`, version 2 and marked `development_sources` true - all three, so that none of the
  // 14 frozen v1 demo items (stand-in signature, no mark) can ever come back as really signed.
  const seedSealedDemo = row.integritySource === 'DEMO_PACKAGE' && row.manifestVersion === 2 && row.developmentSources === true;
  if (!(row.integritySource === 'REAL' && row.manifestVersion === 2) && !seedSealedDemo) {
    throw new MappingError(
      'ROW_SHAPE',
      `evidence_items.signature_simulated (${row.id})`,
      'a real signature belongs to a REAL item of manifest version 2, or to a seed-sealed demo item (DEMO_PACKAGE, version 2, development sources); this row is neither.',
    );
  }
  return { value: row.signatureValue, keyId: row.signatureKeyId, algorithm: 'Ed25519', simulated: false };
}
const REAL_SIGNATURE_VALUE = /^[0-9a-f]{128}$/;

export function evidenceItemToRow(item: EvidenceItem, context: RowContext): EvidenceItemRow {
  const place = (column: string): string => `evidence_items.${column} (${item.id})`;
  const sealed = sealedColumnsOf(item);
  return {
    id: storableText(item.id, 'evidence_items.id'),
    sessionId: storableText(item.sessionId, place('session_id')),
    caseNumber: storableText(item.caseNumber, place('case_number')),
    subjectName: storableText(item.subjectName, place('subject_name')),
    subjectType: item.subjectType,
    investigatorId: storableText(item.investigatorId, place('investigator_id')),
    room: storableText(item.room, place('room')),
    profileId: item.profileId,
    recordedAt: safeInteger(item.recordedAt, place('recorded_at')),
    endedAt: safeInteger(item.endedAt, place('ended_at')),
    sealedAt: safeIntegerOrNull(item.sealedAt, place('sealed_at')),
    durationMs: safeInteger(item.durationMs, place('duration_ms')),
    sizeBytes: safeInteger(item.sizeBytes, place('size_bytes')),
    status: item.status,
    lifecycleStage: item.lifecycleStage,
    manifestHash: storableText(item.manifestHash, place('manifest_hash')),
    signatureValue: storableText(item.signature.value, place('signature_value')),
    signatureKeyId: storableText(item.signature.keyId, place('signature_key_id')),
    signatureAlgorithm: item.signature.algorithm,
    signatureSimulated: item.signature.simulated,
    verificationStatus: item.verification.status,
    verificationAt: safeIntegerOrNull(item.verification.at, place('verification_at')),
    tampered: item.tampered,
    tamperedTrackId: item.tamperedTrackId ?? null,
    caseType: item.caseType ?? null,
    markers: storableJson(item.markers ?? [], place('markers')),
    notes: storableJson(item.notes ?? [], place('notes')),
    integritySource: item.integritySource ?? null,
    startTimeSource: item.startTimeSource ?? null,
    endTimeSource: item.endTimeSource ?? null,
    // Schema v2 (CS-18; dbc-3 §B.11; row 129b): the three sealed columns, see `sealedColumnsOf`.
    // `manifest_version` is 2 for EVERY v2 seal - also the one sealed without a transcript hash
    // (STT disabled) - and `labels_status` is the seal's speaker state. An item that states
    // neither keeps the old reading: 2 when it binds a transcript hash, else 1; NULL labels.
    // `evidenceItemFromRows` restores what the item carried, so `toRow(fromRow(row))` is byte-stable.
    manifestVersion: sealed.manifestVersion,
    transcriptSha256: item.transcriptSha256 ?? null,
    labelsStatus: sealed.labelsStatus,
    // Schema v3 (dbc-4 §N.4, MR-E1; finding F-82-3, pass D4): the copy of manifest field 126, as
    // the seal put it on the item (the Core derives it from `session_capture_sources`, never from
    // a client). Absent or null = NULL = "not recorded" (a v1 item, the simulator's own seal).
    developmentSources: developmentSourcesOf(item),
    createdAt: safeInteger(context.at, place('created_at')),
    updatedAt: safeInteger(context.at, place('updated_at')),
  };
}

/** `position` is the 1-based place in the item's track list (the order of the shared `TRACK_ORDER`). */
export function evidenceTracksToRows(item: EvidenceItem): EvidenceTrackRow[] {
  // Schema v2 (D44 R5): a v2 sealed item carries one entry per sealed FILE (`files`, SH-07). The
  // file's fragment count rides on the track row of its own track (`fragment_count`, dbc-3 §B.12),
  // the recording duration on `duration_ms`, and the item-level running chain head - which the sim
  // models once per item, not per file - on every file row's `fragment_chain_head`. The way back
  // restores `files` and `fragmentChainHead` from those columns; a v1 item keeps them NULL and the
  // byte-stable v1 read-back it had before. `codec` and `sha256_plain` stay NULL: the sim shape
  // does not model them (the SH-24 dataset writer supplies its own).
  const fileOf = new Map((item.files ?? []).map((file) => [file.trackId, file] as const));
  const v2 = item.files !== undefined && item.files.length > 0;
  return item.tracks.map((track, index) => {
    const file = fileOf.get(track.trackId);
    return {
      evidenceId: item.id,
      trackId: track.trackId,
      position: index + 1,
      label: storableText(track.label, `evidence_tracks.label (${item.id})`),
      sizeBytes: safeInteger(track.sizeBytes, `evidence_tracks.size_bytes (${item.id})`),
      sha256: storableText(track.sha256, `evidence_tracks.sha256 (${item.id})`),
      // The sim `EvidenceTrack` carries only the four v1 members, so `kind` is the sole value the
      // CHECK admits (`'FILE'`) and `contains_audio` is required true (R-4).
      kind: 'FILE',
      containsAudio: true,
      codec: null,
      durationMs: v2 ? safeInteger(item.durationMs, `evidence_tracks.duration_ms (${item.id})`) : null,
      fragmentCount: file === undefined ? null : safeInteger(file.fragmentCount, `evidence_tracks.fragment_count (${item.id})`),
      fragmentChainHead: !v2 || item.fragmentChainHead === undefined || item.fragmentChainHead === null ? null : storableText(item.fragmentChainHead, `evidence_tracks.fragment_chain_head (${item.id})`),
      // The file's OWN whole-file hash. For a SIMULATED item it equals the track's `sha256` (both
      // are `computeTrackHash`); for a DEMO_PACKAGE item the track hash is the frozen package's
      // (`demoTrackHash`) and the file hash stays the synthetic descriptor hash - two families, two
      // columns (D-DB-02 keeps `sha256` the stored-bytes hash of the track row).
      sha256Plain: file === undefined ? null : storableText(file.sha256, `evidence_tracks.sha256_plain (${item.id})`),
    };
  });
}

/** `seq` is the 1-based place in the item's custody list. `from` skips the entries already stored. */
export function evidenceCustodyToRows(item: EvidenceItem, from = 0): EvidenceCustodyRow[] {
  return item.custody.slice(from).map((entry, offset) => custodyToRow(item.id, entry, from + offset + 1));
}

function custodyToRow(evidenceId: string, entry: CustodyEntry, seq: number): EvidenceCustodyRow {
  const place = (column: string): string => `evidence_custody.${column} (${evidenceId} #${seq})`;
  return {
    evidenceId,
    seq,
    at: safeInteger(entry.at, place('at')),
    action: storableText(entry.action, place('action')),
    actorId: storableTextOrNull(entry.actorId, place('actor_id')),
    detail: storableTextOrNull(entry.detail, place('detail')),
  };
}

/** One item from its row, its track rows and its custody rows (any order; they are sorted here). */
export function evidenceItemFromRows(
  row: EvidenceItemRow,
  tracks: readonly EvidenceTrackRow[],
  custody: readonly EvidenceCustodyRow[],
): EvidenceItem {
  const signature = signatureFromRow(row);
  const orderedTracks: EvidenceTrack[] = [...tracks]
    .sort((a, b) => a.position - b.position)
    .map((track) => ({ trackId: track.trackId, label: track.label, sizeBytes: track.sizeBytes, sha256: track.sha256 }));
  const orderedCustody: CustodyEntry[] = [...custody]
    .sort((a, b) => a.seq - b.seq)
    .map((entry) => ({ at: entry.at, action: entry.action, actorId: entry.actorId, detail: entry.detail }));
  // Schema v2 (D44 R5): a track row that carries its fragment count and chain head is a sealed
  // FILE row. The file list comes back in the order of `EVIDENCE_FILE_TRACKS`; its `fileName` is
  // the seal's own convention (`buildEvidenceFilesV2`: `<item>/<track>.m4v|.m4a`), which the sim
  // derives from the item id and the track id and never varies; its size and hash are the track's
  // (the seal writes the same value into both - `trackSize` and `computeTrackHash`). The item's
  // chain head is the one every file row carries. A v1 item has no such rows and stays v1-shaped.
  const fileRows = [...tracks]
    .sort((a, b) => a.position - b.position)
    .filter((track) => track.fragmentCount !== null && track.fragmentChainHead !== null && track.sha256Plain !== null);
  const files: EvidenceFileEntry[] | null =
    fileRows.length === 0
      ? null
      : [...fileRows]
          .sort((a, b) => EVIDENCE_FILE_TRACKS.indexOf(a.trackId as (typeof EVIDENCE_FILE_TRACKS)[number]) - EVIDENCE_FILE_TRACKS.indexOf(b.trackId as (typeof EVIDENCE_FILE_TRACKS)[number]))
          .map((track) => ({
            trackId: track.trackId,
            fileName: `${row.id.toLowerCase()}/${track.trackId.toLowerCase()}.m4${track.trackId.startsWith('VIDEO') ? 'v' : 'a'}`,
            sizeBytes: track.sizeBytes,
            sha256: track.sha256Plain as string,
            fragmentCount: track.fragmentCount as number,
          }));
  return {
    id: row.id,
    sessionId: row.sessionId,
    caseNumber: row.caseNumber,
    subjectName: row.subjectName,
    subjectType: row.subjectType,
    investigatorId: row.investigatorId,
    room: row.room,
    profileId: row.profileId,
    recordedAt: row.recordedAt,
    endedAt: row.endedAt,
    sealedAt: row.sealedAt,
    durationMs: row.durationMs,
    sizeBytes: row.sizeBytes,
    status: row.status,
    lifecycleStage: row.lifecycleStage,
    tracks: orderedTracks,
    manifestHash: row.manifestHash,
    signature,
    custody: orderedCustody,
    verification: { status: row.verificationStatus, at: row.verificationAt },
    tampered: row.tampered,
    tamperedTrackId: row.tamperedTrackId,
    // The seal's development mark (F-82-3): NULL stays absent, never `false` (never read as production).
    ...(row.developmentSources === null ? {} : { developmentSources: row.developmentSources }),
    ...(row.caseType === null ? {} : { caseType: row.caseType }),
    markers: row.markers,
    notes: row.notes,
    ...(row.integritySource === null ? {} : { integritySource: row.integritySource }),
    // Schema v2 (CS-18; row 129b): the sealed columns round-trip; absent stays absent (MR-2).
    ...sealedMembersOf(row),
    // Schema v2 (D44 R5): the sealed file list and the running chain head round-trip through the
    // file rows of `evidence_tracks`; a v1 item gets neither key back.
    ...(files === null ? {} : { files, fragmentChainHead: fileRows[0]?.fragmentChainHead ?? null }),
    startTimeSource: row.startTimeSource,
    endTimeSource: row.endTimeSource,
  };
}

/**
 * The way back of the three sealed columns. Three row shapes exist, and each names its writer:
 *   (1, NULL, NULL)        a v1 item: no member comes back;
 *   (2, hash, NULL)        an item that only binds a hash (written before the seal stated its
 *                          columns; the simulator's own seal): `transcriptSha256` alone, as before;
 *   (2, hash, labels) and  the seal's `SealedItemColumns`: all three members come back, the hash
 *   (2, NULL, NULL)        as `null` where the seal carried none (STT disabled).
 * A real seal never writes the second shape: a sealed document always has a speaker state. Any
 * other combination is not a row the mapping wrote, and is refused.
 */
function sealedMembersOf(row: EvidenceItemRow): { transcriptSha256?: string | null } & SealedItemMembers {
  if (row.manifestVersion === 1) {
    if (row.transcriptSha256 !== null || row.labelsStatus !== null) {
      throw new MappingError('ROW_SHAPE', `evidence_items.manifest_version (${row.id})`, 'a version 1 item holds a transcript hash or a speaker state.');
    }
    return {};
  }
  if (row.manifestVersion !== 2) {
    throw new MappingError('ROW_SHAPE', `evidence_items.manifest_version (${row.id})`, `the manifest version of an item is 1 or 2; the row holds ${row.manifestVersion}.`);
  }
  if (row.transcriptSha256 === null && row.labelsStatus !== null) {
    throw new MappingError('ROW_SHAPE', `evidence_items.labels_status (${row.id})`, 'the row holds a speaker state and no transcript hash.');
  }
  if (row.transcriptSha256 !== null && row.labelsStatus === null) return { transcriptSha256: row.transcriptSha256 };
  return { manifestVersion: 2, transcriptSha256: row.transcriptSha256, labelsStatus: row.labelsStatus };
}

// ── capture_config, capture_devices (register SH-16; D44 R5) ──────────────────────────────────

/**
 * The transport a registry row carries for a device the selector's mic list does not name. The
 * column is NOT NULL with the `CODE` format; the sim registry has no transport member, so the
 * mapping writes the built-in's own code for the five known devices and this neutral code for a
 * discovered one until supervisor telemetry (row 57) names it. It is never read back into a slice.
 */
const NEUTRAL_TRANSPORT = 'UNKNOWN';
/**
 * The same code, named for the write-through (`changes.ts`, pass D4): a row built with it says
 * "the state holds no transport for this device", NOT "the transport became unknown". The
 * write-through therefore never stores it over a registry row that exists - a device that leaves
 * the selector keeps the transport it was registered with. It is still what a NEW row is inserted
 * with (the column is NOT NULL).
 */
export const CAPTURE_TRANSPORT_NOT_IN_STATE = NEUTRAL_TRANSPORT;

/**
 * The five built-ins' transport codes (RECON-B2a R5; dbc-3 §B.2, §E.3; D-52-3). The device slice
 * carries no transport - the state's only home for one is a selector mic slot - so a row for a
 * built-in device takes its transport from the selector slot naming the same device, then from
 * this topology table, and only for a discovered device nothing is known: `UNKNOWN`. Without the
 * table the engine's own write of CAM-01 would clobber the seeded `RTSP` with `UNKNOWN`; ST-3
 * pins the stored rows to exactly what `toRows` gives, so this builder is the ONE writer of the
 * shape in both directions.
 */
const BUILT_IN_TRANSPORTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['CAM-01', 'RTSP'],
  ['CAM-02', 'RTSP'],
  ['MIC-01', 'USB'],
  ['MIC-02', 'USB'],
  ['POE-SWITCH', 'SNMP'],
]);

/**
 * The media profile CODE, state form to row form and back (RECON-F1 erratum; row 55 §5, C3 §1,
 * dbc-3 §B.1). The simulator used to name its profiles with a hyphen between the codec and the
 * resolution while the column's `CODE` format (`^[A-Z][A-Z0-9_]{0,63}$`) admits none, so this seam
 * held a two-way
 * spelling table and a blanket `replace(/-/g,'_')` fallback that silently normalised ANY hyphenated
 * value rather than refusing it (finding F8). C3 §1 requires `SCREAMING_SNAKE_CASE` machine codes,
 * so the shared constant now holds the canonical underscore form and the two spellings are one:
 * what follows is a validated identity in both directions. Anything outside the `CODE` format - the
 * retired hyphenated spelling, a lowercase or empty value, a row written by other software - is
 * refused here as `ROW_SHAPE`, before a statement can reach the CHECK and before a bad code can
 * reach the wire. An open-set CODE operation 77 may write (e.g. `H264_720P30`) still travels both
 * ways unchanged.
 */
const PROFILE_CODE_FORM = /^[A-Z][A-Z0-9_]{0,63}$/;

function profileToCode(profile: string, place: string): string {
  if (!PROFILE_CODE_FORM.test(profile)) {
    throw new MappingError('ROW_SHAPE', place, `the media profile "${profile}" is not a CODE: SCREAMING_SNAKE_CASE only (dbc-3 §B.1).`);
  }
  return profile;
}

function codeToProfile(code: string, place: string): string {
  if (!PROFILE_CODE_FORM.test(code)) {
    throw new MappingError('ROW_SHAPE', place, `the stored media profile "${code}" is not a CODE: SCREAMING_SNAKE_CASE only (dbc-3 §B.1).`);
  }
  return code;
}

/** The five built-in devices' capability codes, derived from the shared baseline (D-52-3). The
 * registry table holds no capabilities column (dbc-3 §B.2); a discovered device answers `[]`. */
const BUILT_IN_CAPABILITIES: ReadonlyMap<string, readonly string[]> = new Map(
  DEFAULT_CAPTURE_DEVICES.devices.map((device) => [device.id, device.capabilities] as const),
);

/**
 * Slice 29 to its one row (T-31). Only the selector travels: `online`/`streamState` of the camera
 * slots and `transport`/`online` of the mic slots are facts of the registry (read back from the
 * T-32 rows), `locked` is a fact of the live session that the sim itself never stores in the slice
 * (op 76 recomputes it per answer, api.ts:550), and `revision`/`updated_by` belong to operation 77
 * and the module, not to the engine state - the row carries the seed's values unchanged.
 */
export function captureConfigToRow(slice: CaptureConfigSlice): CaptureConfigRow {
  const place = (column: string): string => `capture_config.${column}`;
  const [camera01, camera02] = slice.cameras;
  const primary = slice.mics.find((mic) => mic.role === 'PRIMARY') ?? slice.mics[0];
  const standby = slice.mics.find((mic) => mic.role === 'STANDBY') ?? slice.mics[1];
  if (camera01 === undefined || camera02 === undefined || primary === undefined || standby === undefined) {
    throw new MappingError('ROW_SHAPE', 'capture_config', 'the selector slice must name two cameras and a PRIMARY and a STANDBY mic.');
  }
  return {
    singleton: true,
    video01DeviceId: storableText(camera01.deviceId, place('video_01_device_id')),
    video01Profile: profileToCode(camera01.profile, place('video_01_profile')),
    video02DeviceId: storableText(camera02.deviceId, place('video_02_device_id')),
    video02Profile: profileToCode(camera02.profile, place('video_02_profile')),
    micPrimaryId: storableText(primary.deviceId, place('mic_primary_id')),
    micStandbyId: storableText(standby.deviceId, place('mic_standby_id')),
    revision: 1,
    updatedBy: null,
    // The selector's instant is the slice's own `updated_at`; `revision` and `updated_by` belong
    // to operation 77 and the module, never to an engine write (dbc-3 §B.1).
    updatedAt: safeInteger(slice.updatedAt, place('updated_at')),
  };
}

/**
 * The adapter kinds a device class may carry (dbc-4 §N.2, `capture_devices_adapter_pairing_check`).
 * Stated here because the mapping imports TYPES of the schema only (its static rule); the M4-MT-12
 * test holds this table equal to `CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND` of the typed schema.
 */
export const MAPPED_ADAPTER_KINDS_BY_DEVICE_KIND = {
  CAMERA: ['ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE'],
  MIC: ['USB_AUDIO', 'FAKE', 'LOCAL_DEVICE'],
  POE: ['SNMP_POE', 'FAKE'],
} as const satisfies Record<CaptureDeviceKindValue, readonly CaptureAdapterKindValue[]>;

/** The adapter kind a device row is written with when the slice names none: a development source (D-DB-12). */
export const DEFAULT_CAPTURE_ADAPTER_KIND: CaptureAdapterKindValue = 'FAKE';

/**
 * The adapter kind of one slice device (dbc-4 §N.2). The slice member `adapter` is added to the
 * shared slice by the rows that surface it (132 / 136); until it exists the engine state names no
 * adapter and the row is written with the safe default `FAKE` - in the VALUES list only: the
 * store's UPSERT never names `adapter_kind` in its SET list, so an existing row keeps what it was
 * inserted with. A value outside the closed set, or one the device class may not carry, is refused
 * here instead of at the CHECK.
 */
function adapterKindOf(device: CaptureDevicesSlice['devices'][number]): CaptureAdapterKindValue {
  const named: unknown = (device as { adapter?: unknown }).adapter;
  if (named === undefined || named === null) return DEFAULT_CAPTURE_ADAPTER_KIND;
  const allowed: readonly string[] = MAPPED_ADAPTER_KINDS_BY_DEVICE_KIND[device.kind];
  if (typeof named !== 'string' || !allowed.includes(named)) {
    throw new MappingError('ROW_SHAPE', `capture_devices.adapter_kind (${device.id})`, `the adapter is not one a ${device.kind} device may carry.`);
  }
  return named as CaptureAdapterKindValue;
}

/**
 * Slice 30 to its registry rows (T-32), in id order. `enabled` carries the slice's `online`; the
 * mic rows take their `transport` from the selector slot that names the same device (the only
 * home the state has for it); `address` is the slice's `host`, never a credential URL (C-N8).
 * `profiles`, `mac`, `onvif_uuid` and `last_seen_at` are discovery/telemetry columns the engine
 * state does not model; they read back as the empty forms the builders use.
 */
export function captureDevicesToRows(slice: CaptureDevicesSlice, config: CaptureConfigSlice): CaptureDeviceRow[] {
  const transportOf = (deviceId: string): string =>
    config.mics.find((mic) => mic.deviceId === deviceId)?.transport ?? BUILT_IN_TRANSPORTS.get(deviceId) ?? NEUTRAL_TRANSPORT;
  return [...slice.devices]
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .map((device) => ({
      id: storableText(device.id, `capture_devices.id (${device.id})`),
      kind: device.kind,
      transport: storableText(transportOf(device.id), `capture_devices.transport (${device.id})`),
      model: storableTextOrNull(device.model, `capture_devices.model (${device.id})`),
      firmware: storableTextOrNull(device.firmware, `capture_devices.firmware (${device.id})`),
      address: storableTextOrNull(device.host, `capture_devices.address (${device.id})`),
      mac: null,
      onvifUuid: null,
      profiles: [],
      poePort: storableTextOrNull(device.poePort, `capture_devices.poe_port (${device.id})`),
      enabled: device.online,
      lastSeenAt: null,
      adapterKind: adapterKindOf(device),
    }));
}

/** One registry row plus the selector fact it needs, back to a slice device (SH-18 keeps the order). */
function captureDeviceFromRow(row: CaptureDeviceRow): Omit<CaptureDevicesSlice['devices'][number], never> {
  return {
    id: row.id,
    kind: row.kind,
    model: row.model,
    firmware: row.firmware,
    host: row.address,
    poePort: row.poePort,
    online: row.enabled,
    streamState: row.kind === 'CAMERA' ? (BUILT_IN_CAPABILITIES.has(row.id) ? (row.enabled ? 'LIVE' : 'LOST') : null) : null,
    capabilities: [...(BUILT_IN_CAPABILITIES.get(row.id) ?? (row.kind === 'CAMERA' ? ADOPTED_CAMERA_CAPABILITIES : []))],
    // A device that operation 96 registered (the INTERNAL action `registerCaptureDevice`, row 132)
    // carries its adapter and the class derived from it, and reads back exactly as it was
    // registered: no stream until a track is assigned, the one capability of a camera. The
    // built-in devices keep the shape they had: they gain the two members with the rows that
    // surface them (136 / 139).
    ...(BUILT_IN_CAPABILITIES.has(row.id) ? {} : { adapter: row.adapterKind, sourceClass: DEVELOPMENT_ADAPTER_KINDS.has(row.adapterKind) ? ('DEVELOPMENT' as const) : ('PRODUCTION' as const) }),
  };
}

/** What `registerCaptureDevice` gives a camera it registers (`packages/shared/src/sim/capture-registry.ts`). */
const ADOPTED_CAMERA_CAPABILITIES: readonly string[] = ['VIDEO'];
/** The adapter kinds of a source that is not a production device (dbc-4 §N.2). */
const DEVELOPMENT_ADAPTER_KINDS: ReadonlySet<string> = new Set(['FAKE', 'LOCAL_DEVICE']);

/**
 * Slice 29 back from its row and the registry rows (the same derivations the capture-config
 * module's builders state, `modules/capture-config/slices.ts`, which this mapping mirrors at the
 * row layer to keep `db/mapping` free of module imports): the camera slots' `online`/`streamState`
 * and the mic slots' `transport`/`online` come from the registry row the selector names; `locked`
 * is false because the sim never stores the lock in the slice (op 76 recomputes it per answer).
 * A named device the registry does not hold is a refusal, never an invented row (fail closed).
 *
 * THE MICROPHONES COME BACK IN INPUT ORDER - `MIC-01`, then `MIC-02` - whichever of them is the
 * PRIMARY (decision D106 (1); AC-B-70; the simulator and the hosted action `setCaptureConfig` list
 * them so). The role is a member of the line, not its position: after `setPrimaryMic(MIC-02)` the
 * stored selector reads back as the engine holds it, so a restarted Core replicates the same order.
 */
export function captureConfigFromRow(row: CaptureConfigRow, devices: readonly CaptureDeviceRow[]): CaptureConfigSlice {
  const byId = new Map(devices.map((device) => [device.id, device] as const));
  const named = (column: string, deviceId: string): CaptureDeviceRow => {
    const device = byId.get(deviceId);
    if (device === undefined) {
      throw new MappingError('ROW_SHAPE', `capture_config.${column}`, `the selector names ${deviceId}, which capture_devices does not hold.`);
    }
    return device;
  };
  const camera = (trackId: 'VIDEO-01' | 'VIDEO-02', deviceId: string, profile: string) => {
    const device = named(trackId === 'VIDEO-01' ? 'video_01_device_id' : 'video_02_device_id', deviceId);
    return { trackId, deviceId, profile, online: device.enabled, streamState: (device.enabled ? 'LIVE' : 'LOST') as CaptureConfigSlice['cameras'][number]['streamState'] };
  };
  const mic = (inputId: CaptureConfigSlice['mics'][number]['inputId'], deviceId: string, role: 'PRIMARY' | 'STANDBY') => {
    const device = named(role === 'PRIMARY' ? 'mic_primary_id' : 'mic_standby_id', deviceId);
    return { inputId, deviceId, role, transport: device.transport, online: device.enabled };
  };
  return {
    cameras: [camera('VIDEO-01', row.video01DeviceId, codeToProfile(row.video01Profile, 'capture_config.video_01_profile')), camera('VIDEO-02', row.video02DeviceId, codeToProfile(row.video02Profile, 'capture_config.video_02_profile'))],
    mics: [mic(row.micPrimaryId as 'MIC-01' | 'MIC-02', row.micPrimaryId, 'PRIMARY'), mic(row.micStandbyId as 'MIC-01' | 'MIC-02', row.micStandbyId, 'STANDBY')].sort((left, right) =>
      compareIds(left.inputId, right.inputId),
    ),
    locked: false,
    updatedAt: row.updatedAt,
  };
}

/**
 * Whether a stored registry row is in the device list of the running Core (review row 69, finding
 * R69-03; C3 §2.6, ux §8f.3, R-11 AC-2: "in `REAL_PRODUCTION` operations 76 / 77 list 0 development
 * devices"). The rule is the capture fence's (`storedDeviceListingOf`, the caller of
 * `deviceSourceFieldsOf`); the mapping only applies it, because it is the one place where the
 * stored rows become the slice every client reads. Absent: every row is listed, as in `SIMULATED`.
 */
export type CaptureDeviceListing = (device: Pick<CaptureDeviceRow, 'id' | 'kind' | 'adapterKind'>) => boolean;

/**
 * Slice 30 back from the registry rows, in id order (MR-3). A row the listing rule refuses is left
 * out of the slice and stays stored: nothing here deletes or rewrites it, and the write-through
 * never sees it (the state before and after a unit both lack it). A row in `keep` - a device the
 * selector names - is never left out: an assigned development source in a production operation is
 * the capture fence's refusal of the boot (`DEV_SOURCE_WITHOUT_FLAG`), not a state without it.
 */
export function captureDevicesFromRows(rows: readonly CaptureDeviceRow[], listing?: CaptureDeviceListing, keep: ReadonlySet<string> = NO_DEVICE_IDS): CaptureDevicesSlice {
  const listed = listing === undefined ? rows : rows.filter((row) => keep.has(row.id) || listing(row));
  return { devices: [...listed].sort((left, right) => compareIds(left.id, right.id)).map(captureDeviceFromRow) };
}

const NO_DEVICE_IDS: ReadonlySet<string> = new Set();

/** The device ids the selector row names (its four slots). */
export function selectorDeviceIds(row: Pick<CaptureConfigRow, 'video01DeviceId' | 'video02DeviceId' | 'micPrimaryId' | 'micStandbyId'>): ReadonlySet<string> {
  return new Set([row.video01DeviceId, row.video02DeviceId, row.micPrimaryId, row.micStandbyId]);
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ── active_session ─────────────────────────────────────────────────────────────────────────────

/** True when a stored v2 snapshot object holds at least one member (an absent snapshot stores `{}`). */
function hasMembers(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}

/**
 * The empty form of an absent v2 snapshot column, ONE frozen object (D44 R5). The write-through
 * tells a changed column by REFERENCE (ENG-4); a fresh `{}` literal per build would make every
 * session UPDATE name the absent snapshots - `transcript_status` above all, which no M2 command
 * ever fills. The way back reads `{}` as "absent" (`hasMembers`), so the round trip is unchanged.
 */
const EMPTY_SNAPSHOT_JSON = Object.freeze({}) as Record<string, never>;

export function activeSessionToRow(session: ActiveSession, context: RowContext): ActiveSessionRow {
  const place = (column: string): string => `active_session.${column}`;
  return {
    singleton: true,
    id: storableText(session.id, place('id')),
    state: session.state,
    caseNumber: storableText(session.input.caseNumber, place('case_number')),
    subjectType: session.input.subjectType,
    subjectName: storableText(session.input.subjectName, place('subject_name')),
    investigatorId: storableText(session.input.investigatorId, place('investigator_id')),
    room: storableText(session.input.room, place('room')),
    profileId: session.input.profileId,
    inputNotes: storableText(session.input.notes, place('input_notes')),
    createdAt: safeInteger(session.createdAt, place('created_at')),
    createdBy: storableTextOrNull(session.createdBy, place('created_by')),
    armedAt: safeIntegerOrNull(session.armedAt, place('armed_at')),
    startedAt: safeIntegerOrNull(session.startedAt, place('started_at')),
    stoppedAt: safeIntegerOrNull(session.stoppedAt, place('stopped_at')),
    stopReason: storableTextOrNull(session.stopReason, place('stop_reason')),
    sealedAt: safeIntegerOrNull(session.sealedAt, place('sealed_at')),
    markerCount: safeInteger(session.markerCount, place('marker_count')),
    snapshotCount: safeInteger(session.snapshotCount, place('snapshot_count')),
    bytesWritten: safeInteger(session.bytesWritten, place('bytes_written')),
    evidenceId: storableTextOrNull(session.evidenceId, place('evidence_id')),
    startTimeSource: session.startTimeSource ?? null,
    stopTimeSource: session.stopTimeSource ?? null,
    precheck: storableJson(session.precheck, place('precheck')),
    finalization: storableJson(session.finalization, place('finalization')),
    timeline: storableJson(session.timeline, place('timeline')),
    notes: storableJson(session.notes, place('notes')),
    fault: session.fault === null ? null : storableJson(session.fault, place('fault')),
    recovery: session.recovery === null ? null : storableJson(session.recovery, place('recovery')),
    // Schema v2 (CS-18; dbc-3 §B.10). The three snapshots are optional on the state; the columns are
    // NOT NULL with an object CHECK, so an absent snapshot stores `{}` and the way back reads an
    // empty object as "absent" (MR-2), keeping a v1 session byte-stable across the round trip.
    // `started_by`/`stopped_by` have no member on the sim `ActiveSession`; they are recorded in
    // session history / audit, so the mapping stores NULL and the way back ignores them.
    captureConfig: storableJson(session.captureConfig ?? EMPTY_SNAPSHOT_JSON, place('capture_config')),
    audioSource: storableJson(session.audioSource ?? EMPTY_SNAPSHOT_JSON, place('audio_source')),
    transcriptStatus: storableJson(session.transcript ?? EMPTY_SNAPSHOT_JSON, place('transcript_status')),
    startedBy: null,
    stoppedBy: null,
    updatedAt: safeInteger(context.at, place('updated_at')),
  };
}

export function activeSessionFromRow(row: ActiveSessionRow): ActiveSession {
  return {
    id: row.id,
    state: row.state,
    input: {
      caseNumber: row.caseNumber,
      subjectType: row.subjectType,
      subjectName: row.subjectName,
      investigatorId: row.investigatorId,
      room: row.room,
      profileId: row.profileId,
      notes: row.inputNotes,
    },
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    precheck: row.precheck,
    armedAt: row.armedAt,
    startedAt: row.startedAt,
    stoppedAt: row.stoppedAt,
    stopReason: row.stopReason,
    sealedAt: row.sealedAt,
    finalization: row.finalization,
    timeline: row.timeline,
    notes: row.notes,
    markerCount: row.markerCount,
    snapshotCount: row.snapshotCount,
    bytesWritten: row.bytesWritten,
    fault: row.fault,
    recovery: row.recovery,
    evidenceId: row.evidenceId,
    // The shared session machine leaves these two members out until the recording starts and
    // stops; it never sets them to null. NULL is therefore read back as "absent".
    ...(row.startTimeSource === null ? {} : { startTimeSource: row.startTimeSource }),
    ...(row.stopTimeSource === null ? {} : { stopTimeSource: row.stopTimeSource }),
    // Schema v2 (CS-18): a non-empty snapshot reads back; the `{}` an absent snapshot stored reads
    // back as absent, so a v1 session is byte-stable across the round trip (MR-2).
    ...(hasMembers(row.captureConfig) ? { captureConfig: row.captureConfig as ActiveSession['captureConfig'] } : {}),
    ...(hasMembers(row.audioSource) ? { audioSource: row.audioSource as ActiveSession['audioSource'] } : {}),
    ...(hasMembers(row.transcriptStatus) ? { transcript: row.transcriptStatus as ActiveSession['transcript'] } : {}),
  };
}

// ── alerts ─────────────────────────────────────────────────────────────────────────────────────

/** The `CODE` form of `alerts_reason_check` (database contract erratum PE-0013-01). */
const ALERT_REASON = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * The enumerated cause of an alert: the third member of the fault key (kind, reason, device;
 * ruling D146). The alert carries it as `params.reason` (the shared raise writes it there, and
 * `params` of a stored alert never changes); the column `alerts.reason` is the same value in the
 * `CODE` form, or NULL for an alert without a cause. A `params.reason` that is no code (free text)
 * is no key member: the column stays NULL and the text stays in `params`.
 */
export function alertReasonOf(alert: Pick<SimAlert, 'params'>): string | null {
  const reason = alert.params?.['reason'];
  return typeof reason === 'string' && ALERT_REASON.test(reason) ? reason : null;
}

export function alertToRow(alert: SimAlert): AlertRow {
  const place = (column: string): string => `alerts.${column} (${alert.id})`;
  return {
    id: storableText(alert.id, 'alerts.id'),
    at: safeInteger(alert.at, place('at')),
    severity: alert.severity,
    kind: alert.kind,
    message: storableText(alert.message, place('message')),
    active: alert.active,
    acknowledged: alert.acknowledged,
    resolvedAt: safeIntegerOrNull(alert.resolvedAt, place('resolved_at')),
    target: storableTextOrNull(alert.target, place('target')),
    params: alert.params === undefined ? null : storableJson(alert.params, place('params')),
    reason: alertReasonOf(alert),
  };
}

/**
 * The way back. A row older than migration 0013 holds NULL in `reason` whatever its `params`
 * say (no backfill, MG-8): it reads back as the alert it was. A row that DOES hold a cause must
 * carry the same value in `params.reason` - the column is written from it and neither is ever
 * updated - so a difference is a row no writer of this code produced, and it is refused rather
 * than read under one of two keys.
 */
export function alertFromRow(row: AlertRow): SimAlert {
  if (row.reason !== null && row.params?.['reason'] !== row.reason) {
    throw new MappingError('ROW_SHAPE', `alerts.reason (${row.id})`, 'the cause column and the cause in params differ.');
  }
  return {
    id: row.id,
    at: row.at,
    severity: row.severity,
    kind: row.kind,
    message: row.message,
    active: row.active,
    acknowledged: row.acknowledged,
    resolvedAt: row.resolvedAt,
    target: row.target,
    ...(row.params === null ? {} : { params: row.params }),
  };
}

// ── audit_log ──────────────────────────────────────────────────────────────────────────────────

/**
 * An audit row exactly as the shared chain built it: `seq`, `prev_hash` and `hash` are copied,
 * nothing is hashed again (SD-6). A text that PostgreSQL could not store exactly is refused,
 * because the stored row would then no longer hash to its own `hash`.
 */
export function auditRowToRow(row: AuditRow): AuditLogRow {
  const place = (column: string): string => `audit_log.${column} (seq ${row.seq})`;
  return {
    seq: safeInteger(row.seq, 'audit_log.seq'),
    id: storableText(row.id, place('id')),
    at: safeInteger(row.at, place('at')),
    type: storableText(row.type, place('type')),
    category: row.category,
    severity: row.severity,
    actorId: storableTextOrNull(row.actorId, place('actor_id')),
    message: storableText(row.message, place('message')),
    sessionId: storableTextOrNull(row.sessionId, place('session_id')),
    evidenceId: storableTextOrNull(row.evidenceId, place('evidence_id')),
    deviceId: storableTextOrNull(row.deviceId, place('device_id')),
    details: storableJson(row.details, place('details')),
    prevHash: storableText(row.prevHash, place('prev_hash')),
    hash: storableText(row.hash, place('hash')),
  };
}

/** The shared row shape, with the members in the order the shared chain hashes them. */
export function auditRowFromRow(row: AuditLogRow): AuditRow {
  return {
    seq: row.seq,
    id: row.id,
    at: row.at,
    // The table checks the type by format (an open set, MG-11); the shared type is the closed
    // vocabulary. Only the shared chain writes rows, so a stored type is one of its values.
    type: row.type as AuditRow['type'],
    category: row.category,
    severity: row.severity,
    actorId: row.actorId,
    message: row.message,
    sessionId: row.sessionId,
    evidenceId: row.evidenceId,
    deviceId: row.deviceId,
    details: row.details,
    prevHash: row.prevHash,
    hash: row.hash,
  };
}

// ── events ─────────────────────────────────────────────────────────────────────────────────────

/** `category` is derived with the shared `eventCategory`; it is not a member of the event. */
export function eventToRow(event: SimEvent): EventRow {
  const place = (column: string): string => `events.${column} (seq ${event.seq})`;
  return {
    seq: safeInteger(event.seq, 'events.seq'),
    id: storableText(event.id, place('id')),
    at: safeInteger(event.at, place('at')),
    type: storableText(event.type, place('type')),
    category: eventCategory(event),
    severity: event.severity,
    message: storableText(event.message, place('message')),
    params: storableJson(event.params, place('params')),
    sessionId: storableTextOrNull(event.sessionId, place('session_id')),
    deviceId: storableTextOrNull(event.deviceId, place('device_id')),
  };
}

export function eventFromRow(row: EventRow): SimEvent {
  return {
    id: row.id,
    seq: row.seq,
    at: row.at,
    type: row.type as SimEvent['type'],
    severity: row.severity,
    message: row.message,
    params: row.params,
    sessionId: row.sessionId,
    deviceId: row.deviceId,
  };
}
