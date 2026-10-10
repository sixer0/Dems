/**
 * Typed schema, group `core`: T-21 `alerts`, T-22 `storage_policy`, T-23 `console_settings`,
 * T-24 `engine_counters`, T-25 `core_device`, T-26 `core_state`, T-27 `hardware_snapshot`,
 * T-28 `health_snapshots` (database contract §4.21 to §4.28).
 *
 * A single-row table has `singleton boolean PRIMARY KEY DEFAULT true` and `CHECK (singleton)`
 * (K-4). The 14 slice columns of `hardware_snapshot` are the simulated-hardware slices in the
 * wire form of their shared types (J-3).
 */
import type {
  CameraStatus,
  Details,
  DiagnosticsRun,
  FaultsSlice,
  HealthSlice,
  MicStatus,
  NetworkSlice,
  OtherDevice,
  PortStatus,
  SecuritySlice,
  ServiceEntry,
  StorageSlice,
  TabletLinkSlice,
  TimeSlice,
  UpdateSlice,
} from '@dems/shared/sim';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { code, flat, matches, oneOf } from './checks';
import {
  ENGINE_COUNTER,
  FAULT_KIND,
  RETENTION,
  SCENARIO,
  SECURITY_STATE,
  SESSION_STATE,
  SEVERITY,
  SNAPSHOT_CAUSE,
  STORAGE_STATE,
  TIME_FORMAT,
  TIME_SOURCE,
  VIDEO_TRACK_ID,
  type EngineCounterName,
  type FaultKindValue,
  type RetentionValue,
  type ScenarioValue,
  type SecurityStateValue,
  type SessionStateValue,
  type SeverityValue,
  type SnapshotCauseValue,
  type StorageStateValue,
  type TimeFormatValue,
  type TimeSourceValue,
  type VideoTrackIdValue,
} from './value-sets';

/** T-21. The table keeps every alert; the engine keeps the newest 100. */
export const alerts = pgTable(
  'alerts',
  {
    id: text('id').primaryKey(),
    at: bigint('at', { mode: 'number' }).notNull(),
    severity: text('severity').$type<SeverityValue>().notNull(),
    kind: text('kind').$type<FaultKindValue | 'SYSTEM'>().notNull(),
    message: text('message').notNull(),
    active: boolean('active').notNull().default(true),
    acknowledged: boolean('acknowledged').notNull().default(false),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
    target: text('target'),
    params: jsonb('params').$type<Details>(),
    // ── schema v6 addition (dbc-7, erratum PE-0013-01; D146). Declared LAST: `0013` appends it.
    //    The enumerated cause of the alert, the third member of the fault key (kind, reason,
    //    device): two causes of one kind on one device are two rows. NULL = an alert without a
    //    cause, and every row older than 0013 (no backfill, MG-8). Written in the alert's INSERT
    //    from `params.reason`; no UPDATE grant (`0014`). ──
    reason: text('reason'),
  },
  (t) => [
    index('alerts_at_idx').on(t.at.desc().nullsFirst(), t.id.desc().nullsFirst()),
    check('alerts_id_check', matches(t.id, '^ALR-[0-9]{6,}$')),
    check(
      'alerts_kind_check',
      sql`${oneOf(t.severity, SEVERITY)} AND (${t.kind} = 'SYSTEM' OR ${oneOf(t.kind, FAULT_KIND)})`,
    ),
    check('alerts_params_check', sql`${t.params} IS NULL OR ${flat(t.params)}`),
    check('alerts_reason_check', sql`${t.reason} IS NULL OR ${code(t.reason)}`),
  ],
);

/** T-22. One row. */
export const storagePolicy = pgTable(
  'storage_policy',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    retentionPolicy: text('retention_policy').$type<RetentionValue>().notNull(),
    retentionDays: integer('retention_days').notNull(),
    autoArchive: boolean('auto_archive').notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('storage_policy_singleton_check', sql`${t.singleton}`),
    check(
      'storage_policy_values_check',
      sql`${oneOf(t.retentionPolicy, RETENTION)} AND ${t.retentionDays} BETWEEN 1 AND 3650`,
    ),
  ],
);

/** T-23. One row; kept across a reset. */
export const consoleSettings = pgTable(
  'console_settings',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    presentationMode: boolean('presentation_mode').notNull().default(false),
    timeFormat: text('time_format').$type<TimeFormatValue>().notNull().default('24'),
    notifyWarnings: boolean('notify_warnings').notNull().default(true),
    notifySound: boolean('notify_sound').notNull().default(false),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('console_settings_singleton_check', sql`${t.singleton}`),
    check('console_settings_time_format_check', oneOf(t.timeFormat, TIME_FORMAT)),
  ],
);

/** T-24. One row per counter of `meta.counters`; the row `export` is absent until the first export. */
export const engineCounters = pgTable(
  'engine_counters',
  {
    name: text('name').$type<EngineCounterName>().primaryKey(),
    nextValue: bigint('next_value', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('engine_counters_name_check', oneOf(t.name, ENGINE_COUNTER)),
    check('engine_counters_value_check', sql`${t.nextValue} >= 1`),
  ],
);

/** T-25. One row: `DeviceSlice` with the 14 members of `DeviceIdentity` and the certificate fingerprint. */
export const coreDevice = pgTable(
  'core_device',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    id: text('id').notNull(),
    name: text('name').notNull(),
    room: text('room').notNull(),
    productName: text('product_name').notNull(),
    softwareVersion: text('software_version').notNull(),
    certificateFingerprint: text('certificate_fingerprint').notNull(),
    serialNumber: text('serial_number').notNull(),
    hardwareUuid: text('hardware_uuid').notNull(),
    chassisRevision: text('chassis_revision').notNull(),
    somPartRevision: text('som_part_revision').notNull(),
    audioBoardRevision: text('audio_board_revision').notNull(),
    poeBoardRevision: text('poe_board_revision').notNull(),
    powerBoardRevision: text('power_board_revision').notNull(),
    bspVersion: text('bsp_version').notNull(),
    coreSoftwareVersion: text('core_software_version').notNull(),
    tabletAppVersion: text('tablet_app_version').notNull(),
    tpmModelFirmware: text('tpm_model_firmware').notNull(),
    cameraModelFirmware: text('camera_model_firmware').notNull(),
    provisioningRecordId: text('provisioning_record_id').notNull(),
    deviceCertificateId: text('device_certificate_id').notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [check('core_device_singleton_check', sql`${t.singleton}`)],
);

/**
 * T-26. One row: the scalar parts of `meta`, the two `lastSealed` slices and the seed
 * bookkeeping. Its presence is the "seeded" test of boot check B-6.
 */
export const coreState = pgTable(
  'core_state',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    simSchemaVersion: integer('sim_schema_version').notNull(),
    scenario: text('scenario').$type<ScenarioValue>().notNull(),
    epoch: bigint('epoch', { mode: 'number' }).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    seededAt: bigint('seeded_at', { mode: 'number' }).notNull(),
    lastResetAt: bigint('last_reset_at', { mode: 'number' }),
    lastSealedSessionId: text('last_sealed_session_id'),
    lastSealedAcknowledged: boolean('last_sealed_acknowledged').notNull().default(true),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('core_state_singleton_check', sql`${t.singleton}`),
    check(
      'core_state_values_check',
      sql`${oneOf(t.scenario, SCENARIO)} AND ${t.epoch} >= 0 AND ${t.simSchemaVersion} >= 1`,
    ),
  ],
);

/**
 * T-27. One row; one column per snapshot slice. Written at most once a second when a slice
 * changed, and at shutdown; the UPDATE names only the changed slice columns (MR-8).
 * `written_at` is the server-clock instant of that write.
 */
export const hardwareSnapshot = pgTable(
  'hardware_snapshot',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    simSchemaVersion: integer('sim_schema_version').notNull(),
    tabletLink: jsonb('tablet_link').$type<TabletLinkSlice>().notNull(),
    activeCameraId: text('active_camera_id').$type<VideoTrackIdValue>().notNull(),
    cameras: jsonb('cameras').$type<CameraStatus[]>().notNull(),
    mics: jsonb('mics').$type<MicStatus[]>().notNull(),
    storage: jsonb('storage').$type<StorageSlice>().notNull(),
    timeStatus: jsonb('time_status').$type<TimeSlice>().notNull(),
    network: jsonb('network').$type<NetworkSlice>().notNull(),
    security: jsonb('security').$type<SecuritySlice>().notNull(),
    services: jsonb('services').$type<ServiceEntry[]>().notNull(),
    health: jsonb('health').$type<HealthSlice>().notNull(),
    otherDevices: jsonb('other_devices').$type<OtherDevice[]>().notNull(),
    ports: jsonb('ports').$type<PortStatus[]>().notNull(),
    faults: jsonb('faults').$type<FaultsSlice>().notNull(),
    diagnostics: jsonb('diagnostics').$type<DiagnosticsRun>(),
    softwareUpdate: jsonb('software_update').$type<UpdateSlice>().notNull(),
    writtenAt: bigint('written_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('hardware_snapshot_singleton_check', sql`${t.singleton}`),
    check('hardware_snapshot_camera_check', oneOf(t.activeCameraId, VIDEO_TRACK_ID)),
    check(
      'hardware_snapshot_shapes_check',
      sql`jsonb_typeof(${t.cameras}) = 'array' AND jsonb_typeof(${t.mics}) = 'array' AND jsonb_typeof(${t.services}) = 'array' AND jsonb_typeof(${t.otherDevices}) = 'array' AND jsonb_typeof(${t.ports}) = 'array' AND jsonb_typeof(${t.tabletLink}) = 'object' AND jsonb_typeof(${t.storage}) = 'object' AND jsonb_typeof(${t.timeStatus}) = 'object' AND jsonb_typeof(${t.network}) = 'object' AND jsonb_typeof(${t.security}) = 'object' AND jsonb_typeof(${t.health}) = 'object' AND jsonb_typeof(${t.faults}) = 'object' AND jsonb_typeof(${t.softwareUpdate}) = 'object' AND (${t.diagnostics} IS NULL OR jsonb_typeof(${t.diagnostics}) = 'object')`,
    ),
  ],
);

/** T-28. One row every 60 s and one at every fault raise and clear. */
export const healthSnapshots = pgTable(
  'health_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    at: bigint('at', { mode: 'number' }).notNull(),
    cause: text('cause').$type<SnapshotCauseValue>().notNull(),
    faultKind: text('fault_kind').$type<FaultKindValue>(),
    cpuPercent: doublePrecision('cpu_percent').notNull(),
    cpuTempC: doublePrecision('cpu_temp_c').notNull(),
    storageTempC: doublePrecision('storage_temp_c').notNull(),
    ambientTempC: doublePrecision('ambient_temp_c').notNull(),
    fanRpm: integer('fan_rpm').notNull(),
    fanOk: boolean('fan_ok').notNull(),
    storageState: text('storage_state').$type<StorageStateValue>().notNull(),
    evidenceUsedBytes: bigint('evidence_used_bytes', { mode: 'number' }).notNull(),
    timeSource: text('time_source').$type<TimeSourceValue>().notNull(),
    timeOffsetMs: doublePrecision('time_offset_ms').notNull(),
    securityState: text('security_state').$type<SecurityStateValue>().notNull(),
    sessionState: text('session_state').$type<SessionStateValue>(),
    activeFaults: smallint('active_faults').notNull(),
  },
  (t) => [
    index('health_snapshots_at_idx').on(t.at),
    check(
      'health_snapshots_cause_check',
      sql`${oneOf(t.cause, SNAPSHOT_CAUSE)} AND ((${t.cause} = 'INTERVAL') = (${t.faultKind} IS NULL)) AND (${t.faultKind} IS NULL OR ${oneOf(t.faultKind, FAULT_KIND)})`,
    ),
    check(
      'health_snapshots_states_check',
      sql`${oneOf(t.storageState, STORAGE_STATE)} AND ${oneOf(t.timeSource, TIME_SOURCE)} AND ${oneOf(t.securityState, SECURITY_STATE)} AND (${t.sessionState} IS NULL OR ${oneOf(t.sessionState, SESSION_STATE)}) AND ${t.activeFaults} >= 0`,
    ),
  ],
);

/**
 * T-43 (dbc-7, erratum PE-0013-01; ruling D166 / D11-9). One row: WHERE THIS CORE KEEPS ITS MEDIA.
 *
 * The Core writes its media store root (`config.mediaStoreDir`) here at every boot, as the runtime
 * role; the command-line reset (`db:reset`) reads it when its own environment does not carry
 * `DEMS_MEDIA_DIR`, so that it judges the folder the server really uses and not a default. KEPT
 * across a reset (the thirteenth kept table): the fact describes the installation, not the demo
 * data.
 *
 * A PATH, NOTHING ELSE. The CHECK admits an absolute POSIX path of at most 1,024 characters with
 * no control character and no `://` - a URL (which could carry user information) has no place
 * here, and no other column exists that could hold a value. Nothing of the row is secret.
 */
export const coreMediaStore = pgTable(
  'core_media_store',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    mediaRoot: text('media_root').notNull(),
    recordedAt: bigint('recorded_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check('core_media_store_singleton_check', sql`${t.singleton}`),
    check(
      'core_media_store_root_check',
      sql`char_length(${t.mediaRoot}) BETWEEN 1 AND 1024 AND ${matches(t.mediaRoot, '^/[^[:cntrl:]]*$')} AND position('://' in ${t.mediaRoot}) = 0`,
    ),
  ],
);

export type CoreMediaStoreRow = typeof coreMediaStore.$inferSelect;
export type NewCoreMediaStoreRow = typeof coreMediaStore.$inferInsert;
export type AlertRow = typeof alerts.$inferSelect;
export type NewAlertRow = typeof alerts.$inferInsert;
export type StoragePolicyRow = typeof storagePolicy.$inferSelect;
export type NewStoragePolicyRow = typeof storagePolicy.$inferInsert;
export type ConsoleSettingsRow = typeof consoleSettings.$inferSelect;
export type NewConsoleSettingsRow = typeof consoleSettings.$inferInsert;
export type EngineCounterRow = typeof engineCounters.$inferSelect;
export type NewEngineCounterRow = typeof engineCounters.$inferInsert;
export type CoreDeviceRow = typeof coreDevice.$inferSelect;
export type NewCoreDeviceRow = typeof coreDevice.$inferInsert;
export type CoreStateRow = typeof coreState.$inferSelect;
export type NewCoreStateRow = typeof coreState.$inferInsert;
export type HardwareSnapshotRow = typeof hardwareSnapshot.$inferSelect;
export type NewHardwareSnapshotRow = typeof hardwareSnapshot.$inferInsert;
export type HealthSnapshotRow = typeof healthSnapshots.$inferSelect;
export type NewHealthSnapshotRow = typeof healthSnapshots.$inferInsert;
