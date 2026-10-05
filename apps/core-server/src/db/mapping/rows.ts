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
import { eventCategory } from '@dems/shared/sim';
import type {
  ActiveSession,
  AuditRow,
  CustodyEntry,
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
  if (state.simSchemaVersion !== 1) {
    throw new MappingError(
      'ROW_SHAPE',
      'core_state.sim_schema_version',
      `the stored state has shape version ${state.simSchemaVersion}; this mapping reads version 1.`,
    );
  }
  return {
    schemaVersion: 1,
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
  if (row.simSchemaVersion !== 1) {
    throw new MappingError(
      'ROW_SHAPE',
      'hardware_snapshot.sim_schema_version',
      `the stored snapshot has shape version ${row.simSchemaVersion}; this mapping reads version 1.`,
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

export function evidenceItemToRow(item: EvidenceItem, context: RowContext): EvidenceItemRow {
  const place = (column: string): string => `evidence_items.${column} (${item.id})`;
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
    createdAt: safeInteger(context.at, place('created_at')),
    updatedAt: safeInteger(context.at, place('updated_at')),
  };
}

/** `position` is the 1-based place in the item's track list (the order of the shared `TRACK_ORDER`). */
export function evidenceTracksToRows(item: EvidenceItem): EvidenceTrackRow[] {
  return item.tracks.map((track, index) => ({
    evidenceId: item.id,
    trackId: track.trackId,
    position: index + 1,
    label: storableText(track.label, `evidence_tracks.label (${item.id})`),
    sizeBytes: safeInteger(track.sizeBytes, `evidence_tracks.size_bytes (${item.id})`),
    sha256: storableText(track.sha256, `evidence_tracks.sha256 (${item.id})`),
  }));
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
  if (row.signatureSimulated !== true) {
    throw new MappingError('ROW_SHAPE', `evidence_items.signature_simulated (${row.id})`, 'a stored signature is always a simulated one.');
  }
  const orderedTracks: EvidenceTrack[] = [...tracks]
    .sort((a, b) => a.position - b.position)
    .map((track) => ({ trackId: track.trackId, label: track.label, sizeBytes: track.sizeBytes, sha256: track.sha256 }));
  const orderedCustody: CustodyEntry[] = [...custody]
    .sort((a, b) => a.seq - b.seq)
    .map((entry) => ({ at: entry.at, action: entry.action, actorId: entry.actorId, detail: entry.detail }));
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
    signature: {
      value: row.signatureValue,
      keyId: row.signatureKeyId,
      algorithm: row.signatureAlgorithm,
      simulated: true,
    },
    custody: orderedCustody,
    verification: { status: row.verificationStatus, at: row.verificationAt },
    tampered: row.tampered,
    tamperedTrackId: row.tamperedTrackId,
    ...(row.caseType === null ? {} : { caseType: row.caseType }),
    markers: row.markers,
    notes: row.notes,
    ...(row.integritySource === null ? {} : { integritySource: row.integritySource }),
    startTimeSource: row.startTimeSource,
    endTimeSource: row.endTimeSource,
  };
}

// ── active_session ─────────────────────────────────────────────────────────────────────────────

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
  };
}

// ── alerts ─────────────────────────────────────────────────────────────────────────────────────

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
  };
}

export function alertFromRow(row: AlertRow): SimAlert {
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
